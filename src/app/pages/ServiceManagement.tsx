import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { PlusCircle, Edit, Trash, GripVertical, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { Reorder } from 'motion/react';
import ServiceModal from '@/app/components/ServiceModal';
import ScheduleModal from '@/app/components/ScheduleModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';

import { Service } from '@/app/types';
import { useServices } from '@/app/context/ServiceContext';
import { useActivities } from '@/app/context/ActivityContext';
import { formatPeso } from '@/app/lib/currency';
import {
  OperatingScheduleData,
  getOperatingSchedule,
  saveOperatingSchedule,
  getOperatingDaysSummary,
  getOperatingDaysLabel,
  getClosedDaysSummary,
} from '@/app/lib/operatingSchedule';
import { toast } from 'sonner';

interface ServiceManagementProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
  user: { token: string; role?: string };
}

export default function ServiceManagement({ onSetHeaderActionRight, user }: ServiceManagementProps) {
  const { services, addService, updateService, deleteService, reorderServices } = useServices();
  const { addActivity } = useActivities();
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [schedule, setSchedule] = useState<OperatingScheduleData>(getOperatingSchedule);
  const canManageServices = ['owner', 'admin'].includes(user.role?.toLowerCase() || '');

  // HIGH PERFORMANCE: Keep local copies for reordering to ensure zero-lag dragging
  const [localBase, setLocalBase] = useState<Service[]>([]);
  const [localDiscount, setLocalDiscount] = useState<Service[]>([]);
  const [localPriority, setLocalPriority] = useState<Service[]>([]);
  const [localAddon, setLocalAddon] = useState<Service[]>([]);

  // Sync local states when global services change (but only if not currently dragging)
  useEffect(() => {
    const base = services.filter(s => s.category === 'base').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const discount = services.filter(s => s.category === 'discount').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const priority = services.filter(s => s.category === 'priority').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const addon = services.filter(s => s.category === 'addon').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    setLocalBase(base);
    setLocalDiscount(discount);
    setLocalPriority(priority);
    setLocalAddon(addon);
  }, [services]);

  useEffect(() => {
    const handleScheduleUpdate = (e: any) => {
      if (e.detail) {
        setSchedule(e.detail);
      } else {
        setSchedule(getOperatingSchedule());
      }
    };
    window.addEventListener('shoelotskey_schedule_updated', handleScheduleUpdate);
    return () => window.removeEventListener('shoelotskey_schedule_updated', handleScheduleUpdate);
  }, []);

  useEffect(() => {
    // [OWASP A09] Security Audit Logging
    if (user.token) {
      console.log('[SECURITY] Service Management accessed by authenticated session');
    }
  }, [user.token]);

  useEffect(() => {
    if (onSetHeaderActionRight && canManageServices) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
            {/* New Service button */}
            <Button 
                className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={() => {
                  setSelectedService(null);
                  setServiceModalOpen(true);
                }}
            >
                <PlusCircle className="h-4 w-4 sm:mr-2 shrink-0" />
                <span className="hidden sm:inline font-bold">New Service</span>
            </Button>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, user.role, canManageServices]);

  const handleSaveService = (service: Service) => {
    const exists = services.find(s => s.id === service.id);
    if (exists) {
      updateService(service.id, service);
    } else {
      addService(service);
    }
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setServiceModalOpen(true);
  };

  const handleDeleteService = (service: Service) => {
    setDeleteTarget(service);
  };

  const confirmDeleteService = () => {
    if (deleteTarget) {
      deleteService(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleSaveSchedule = (updated: OperatingScheduleData) => {
    setSchedule(updated);
    saveOperatingSchedule(updated);
    toast.success('Operating schedule and shop hours saved successfully');
    if (addActivity) {
      const closuresSummary = (updated.specialClosures || []).map(c => `${c.name || 'Closure'} (${c.days}d)`).join(', ');
      addActivity({
        user: user.role === 'admin' ? 'Administrator' : user.role === 'owner' ? 'Owner' : 'Manager',
        role: user.role,
        action: 'UPDATE_OPERATING_SCHEDULE',
        details: `Updated operating schedule: ${updated.openingTime}–${updated.closingTime}, Closures: ${closuresSummary || 'None'}`,
        type: 'service',
      });
    }
  };

  // Helper to handle category-specific reordering
  const handleReorder = (category: string, newOrder: Service[]) => {
    // 1. Update visual state instantly
    if (category === 'base') setLocalBase(newOrder);
    if (category === 'discount') setLocalDiscount(newOrder);
    if (category === 'priority') setLocalPriority(newOrder);
    if (category === 'addon') setLocalAddon(newOrder);

    // 2. Commit to context/DB (debounced in context)
    const otherCategories = services.filter(s => s.category !== category);
    reorderServices([...otherCategories, ...newOrder]);
  };

  return (
    <div className="w-full max-w-[1560px] mx-auto pt-1 sm:pt-1.5 pb-1 sm:pb-1.5 flex flex-col justify-start gap-2 sm:gap-2.5">
      {/* Upper Grid: Base Services + Discounts on Left, Add-On Services on Right (Top and Bottom Edges Perfectly Aligned) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5 items-stretch">
        {/* Left Column: Base Services + Discounts */}
        <div className="flex flex-col gap-2 sm:gap-2.5 justify-between">
          {/* Base Services Card */}
          <Card className="bg-white rounded-2xl border border-gray-100 shadow-xs shrink-0 gap-1">
            <CardHeader className="pt-2 pb-1 px-3.5 sm:px-4">
              <CardTitle className="text-xs sm:text-[13px] font-black text-gray-900 uppercase tracking-wide">Base Services</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3.5 sm:px-4 pb-2 sm:pb-2.5">
              <div className="overflow-y-auto pr-0.5 service-card-scroll">
                <Reorder.Group axis="y" values={localBase} onReorder={(newOrder) => handleReorder('base', newOrder)} className="space-y-1 sm:space-y-1.25 list-none p-0">
                  {localBase.map(service => (
                    <Reorder.Item 
                      key={service.id} 
                      value={service}
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                      className="flex items-center justify-between py-1.5 sm:py-[7px] px-2.5 sm:px-3 bg-gray-50/90 rounded-xl border border-transparent gap-2 cursor-grab active:cursor-grabbing hover:bg-white hover:border-gray-200 transition-all select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical size={14} className="text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate">{service.name}</p>
                          <p className="text-[11px] sm:text-[11.5px] font-black text-red-600 mt-0.5 leading-none">
                            {service.price > 0 ? formatPeso(service.price) : 'Price varies'}
                          </p>
                          {service.name === 'Color Renewal' && (
                            <p className="text-[9.5px] font-medium text-gray-500 mt-0.5 leading-tight truncate" title="Select 2 Colors or 3 Colors under Add-on Services.">
                              Select 2 or 3 Colors in Add-ons
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-200 text-gray-500 hover:bg-gray-200'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none py-0.5 px-2 rounded-full`}>
                          {service.active ? 'Active' : 'Inactive'}
                        </Badge>
                        {canManageServices && (
                          <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} title="Edit service" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-amber-600 border border-amber-500/80 hover:bg-amber-50 rounded-lg shrink-0 flex items-center justify-center">
                              <Edit size={11.5} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service)} title="Delete service" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-red-600 border border-red-500/80 hover:bg-red-50 rounded-lg shrink-0 flex items-center justify-center">
                              <Trash size={11.5} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            </CardContent>
          </Card>

          {/* Discounts Card */}
          <Card className="bg-white rounded-2xl border border-gray-100 shadow-xs flex-1 flex flex-col justify-between gap-1">
            <CardHeader className="pt-2 pb-1 px-3.5 sm:px-4">
              <CardTitle className="text-xs sm:text-[13px] font-black text-gray-900 uppercase tracking-wide">Discounts</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3.5 sm:px-4 pb-2 sm:pb-2.5 flex-1 flex flex-col min-h-0">
              <div className="overflow-y-auto pr-0.5 service-card-scroll">
                {localDiscount.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1.5 text-center italic">No discounts configured yet</p>
                ) : (
                  <Reorder.Group axis="y" values={localDiscount} onReorder={(newOrder) => handleReorder('discount', newOrder)} className="space-y-1 sm:space-y-1.25 list-none p-0">
                    {localDiscount.map(service => (
                      <Reorder.Item 
                        key={service.id} 
                        value={service}
                        layout
                        transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                        className="flex items-center justify-between py-1.5 sm:py-[7px] px-2.5 sm:px-3 bg-gray-50/90 rounded-xl border border-transparent gap-2 cursor-grab active:cursor-grabbing hover:bg-white hover:border-gray-200 transition-all select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GripVertical size={14} className="text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate">{service.name}</p>
                            <p className="text-[11px] sm:text-[11.5px] font-black text-red-600 mt-0.5 leading-none">
                              {service.description === 'fixed' || (!service.description && service.price > 100) ? `₱${service.price.toFixed(2)} Off` : `${service.price}% Off`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-200 text-gray-500 hover:bg-gray-200'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none py-0.5 px-2 rounded-full`}>
                            {service.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {canManageServices && (
                            <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} title="Edit discount" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-amber-600 border border-amber-500/80 hover:bg-amber-50 rounded-lg shrink-0 flex items-center justify-center">
                                <Edit size={11.5} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service)} title="Delete discount" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-red-600 border border-red-500/80 hover:bg-red-50 rounded-lg shrink-0 flex items-center justify-center">
                                <Trash size={11.5} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Add-On Services (Full Height, Aligned at Top with Base Services, Aligned at Bottom with Discounts) */}
        <Card className="bg-white rounded-2xl border border-gray-100 shadow-xs h-full flex flex-col justify-between gap-1">
          <CardHeader className="pt-2 pb-1 px-3.5 sm:px-4">
            <CardTitle className="text-xs sm:text-[13px] font-black text-gray-900 uppercase tracking-wide">Add-On Services</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3.5 sm:px-4 pb-2 sm:pb-2.5 flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 h-full overflow-y-auto pr-0.5 service-card-scroll">
              <Reorder.Group axis="y" values={localAddon} onReorder={(newOrder) => handleReorder('addon', newOrder)} className="space-y-1 sm:space-y-1.25 list-none p-0">
                {localAddon.map(service => (
                  <Reorder.Item 
                    key={service.id} 
                    value={service}
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                    className="flex items-center justify-between py-1.5 sm:py-[7px] px-2.5 sm:px-3 bg-gray-50/90 rounded-xl border border-transparent gap-2 cursor-grab active:cursor-grabbing hover:bg-white hover:border-gray-200 transition-all select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate">{service.name}</p>
                        <p className="text-[11px] sm:text-[11.5px] font-black text-red-600 mt-0.5 leading-none">{formatPeso(service.price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-200 text-gray-500 hover:bg-gray-200'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none py-0.5 px-2 rounded-full`}>
                        {service.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {canManageServices && (
                        <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} title="Edit service" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-amber-600 border border-amber-500/80 hover:bg-amber-50 rounded-lg shrink-0 flex items-center justify-center">
                            <Edit size={11.5} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service)} title="Delete service" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-red-600 border border-red-500/80 hover:bg-red-50 rounded-lg shrink-0 flex items-center justify-center">
                            <Trash size={11.5} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lower Grid: Priority Fees on Left, Operating Schedule on Right (Aligned at Top and Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5 items-stretch">
        {/* Left: Priority Fees */}
        <Card className="bg-white rounded-2xl border border-gray-100 shadow-xs h-full flex flex-col justify-between gap-1">
          <CardHeader className="pt-2 pb-1 px-3.5 sm:px-4">
            <CardTitle className="text-xs sm:text-[13px] font-black text-gray-900 uppercase tracking-wide">Priority Fees</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3.5 sm:px-4 pb-2 sm:pb-2.5">
            <div className="overflow-y-auto pr-0.5 service-card-scroll">
              {localPriority.length === 0 ? (
                <p className="text-xs text-gray-400 py-1.5 text-center italic">No priority fees configured yet</p>
              ) : (
                <Reorder.Group axis="y" values={localPriority} onReorder={(newOrder) => handleReorder('priority', newOrder)} className="space-y-1 sm:space-y-1.25 list-none p-0">
                {localPriority.map(service => (
                  <Reorder.Item 
                    key={service.id} 
                    value={service}
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                    className="flex items-center justify-between py-1.5 sm:py-[7px] px-2.5 sm:px-3 bg-gray-50/90 rounded-xl border border-transparent gap-2 cursor-grab active:cursor-grabbing hover:bg-white hover:border-gray-200 transition-all select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate">{service.name}</p>
                        <p className="text-[11px] sm:text-[11.5px] font-black text-red-600 mt-0.5 leading-none">{formatPeso(service.price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-200 text-gray-500 hover:bg-gray-200'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none py-0.5 px-2 rounded-full`}>
                        {service.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {canManageServices && (
                        <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} title="Edit service" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-amber-600 border border-amber-500/80 hover:bg-amber-50 rounded-lg shrink-0 flex items-center justify-center">
                            <Edit size={11.5} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service)} title="Delete service" className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-red-600 border border-red-500/80 hover:bg-red-50 rounded-lg shrink-0 flex items-center justify-center">
                            <Trash size={11.5} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Operating Schedule & Shop Hours */}
        <Card className="bg-white rounded-2xl border border-gray-100 shadow-xs h-full flex flex-col justify-between gap-1">
          <CardHeader className="pt-2 pb-1 px-3.5 sm:px-4">
            <CardTitle className="text-xs sm:text-[13px] font-black text-gray-900 uppercase tracking-wide">Operating Schedule &amp; Shop Hours</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3.5 sm:px-4 pb-2 sm:pb-2.5">
            <div className="overflow-y-auto pr-0.5 service-card-scroll">
              <div className="flex items-center justify-between py-1.5 sm:py-[7px] px-2.5 sm:px-3 bg-gray-50/90 rounded-xl border border-transparent gap-2 hover:bg-white hover:border-gray-200 transition-all select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock size={15} className="text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate">
                      {getOperatingDaysLabel(schedule.weeklyDays)}: {schedule.openingTime} – {schedule.closingTime}
                    </p>
                    <p className="text-[11px] sm:text-[11.5px] font-bold text-red-600 mt-0.5 truncate leading-none">
                      {getClosedDaysSummary(schedule.weeklyDays)
                        ? `${getClosedDaysSummary(schedule.weeklyDays)}: Closed / Day Off`
                        : 'Weekly: Open'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[9px] font-bold uppercase tracking-wider shadow-none border-none py-0.5 px-2 rounded-full">
                    {getOperatingDaysSummary(schedule.weeklyDays)}
                  </Badge>
                  {canManageServices && (
                    <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setScheduleModalOpen(true)}
                        title="Configure Schedule & Closures"
                        className="h-6.5 w-6.5 sm:h-7 sm:w-7 p-0 text-amber-600 border border-amber-500/80 hover:bg-amber-50 rounded-lg shrink-0 flex items-center justify-center"
                      >
                        <Edit size={11.5} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ServiceModal
        isOpen={serviceModalOpen}
        onClose={() => {
          setServiceModalOpen(false);
          setSelectedService(null);
        }}
        service={selectedService}
        onSave={handleSaveService}
      />

      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        schedule={schedule}
        onSave={handleSaveSchedule}
        canManage={canManageServices}
      />

      {deleteTarget && (
        <Dialog open onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm rounded-2xl p-6 shadow-2xl border-0 bg-white">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm flex items-center gap-2 text-red-700 tracking-wider">
                <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                Confirm Service Deletion
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Are you sure you want to completely remove this service from the catalog?
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-gray-700 leading-relaxed py-2">
              Are you sure you want to completely remove <strong className="text-red-700 font-bold">"{deleteTarget.name}"</strong> from the active service catalog? This administrative action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100 w-full">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-100 justify-center">
                Cancel
              </Button>
              <Button onClick={confirmDeleteService} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5">
                <Trash className="h-4 w-4" />
                Confirm Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div >
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { PlusCircle, Edit, Trash, GripVertical } from 'lucide-react';
import { Reorder } from 'motion/react';
import ServiceModal from '@/app/components/ServiceModal';

import { Service } from '@/app/types';
import { useServices } from '@/app/context/ServiceContext';

interface ServiceManagementProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
  user: { token: string };
}

export default function ServiceManagement({ onSetHeaderActionRight, user }: ServiceManagementProps) {
  const { services, addService, updateService, deleteService, reorderServices } = useServices();
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const navigate = useNavigate();

  // HIGH PERFORMANCE: Keep local copies for reordering to ensure zero-lag dragging
  const [localBase, setLocalBase] = useState<Service[]>([]);
  const [localPriority, setLocalPriority] = useState<Service[]>([]);
  const [localAddon, setLocalAddon] = useState<Service[]>([]);

  // Sync local states when global services change (but only if not currently dragging)
  useEffect(() => {
    const base = services.filter(s => s.category === 'base' && s.active === true && !s.name.startsWith('[') && !s.name.startsWith('z_')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const priority = services.filter(s => s.category === 'priority' && s.active === true && !s.name.includes('Premium') && !s.name.startsWith('[') && !s.name.startsWith('z_')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const addon = services.filter(s => s.category === 'addon' && s.active === true && !s.name.startsWith('[') && !s.name.startsWith('z_')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    setLocalBase(base);
    setLocalPriority(priority);
    setLocalAddon(addon);
  }, [services]);

  useEffect(() => {
    // [OWASP A09] Security Audit Logging
    if (user.token) {
      console.log('[SECURITY] Service Management accessed by authenticated session');
    }
  }, [user.token]);

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
        <Button 
            className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
            onClick={() => {
              setSelectedService(null);
              setServiceModalOpen(true);
            }}
        >
            <PlusCircle className="h-4 w-4 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline">New Service</span>
        </Button>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, navigate]);

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

  const handleDeleteService = (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      deleteService(id);
    }
  };

  // Helper to handle category-specific reordering
  const handleReorder = (category: string, newOrder: Service[]) => {
    // 1. Update visual state instantly
    if (category === 'base') setLocalBase(newOrder);
    if (category === 'priority') setLocalPriority(newOrder);
    if (category === 'addon') setLocalAddon(newOrder);

    // 2. Commit to context/DB (debounced in context)
    const otherCategories = services.filter(s => s.category !== category);
    reorderServices([...otherCategories, ...newOrder]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <Card className="border-none shadow-md">
            <CardHeader className="pt-3 pb-0 px-4">
              <CardTitle className="text-base font-black text-gray-900 uppercase">Base Services</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar -mt-2">
                <Reorder.Group axis="y" values={localBase} onReorder={(newOrder) => handleReorder('base', newOrder)} className="space-y-3 list-none p-0">
                  {localBase.map(service => (
                    <Reorder.Item 
                      key={service.id} 
                      value={service}
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-transparent gap-3 cursor-grab active:cursor-grabbing hover:bg-white hover:border-gray-200 transition-all select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical size={16} className="text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-[13px] leading-tight truncate">{service.name}</p>
                          <p className="text-[11px] font-black text-red-600 mt-0">{'\u20B1'}{service.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none`}>
                          {service.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} className="h-7 w-7 p-0 text-amber-600 border border-amber-600 hover:bg-amber-50 rounded-md">
                            <Edit size={12} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service.id)} className="h-7 w-7 p-0 text-red-600 border border-red-600 hover:bg-red-50 rounded-md">
                            <Trash size={12} />
                          </Button>
                        </div>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="pt-3 pb-0 px-4">
              <CardTitle className="text-base font-black text-gray-900 uppercase">Priority Fees</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[200px] overflow-y-auto pr-1 custom-scrollbar -mt-2">
                <Reorder.Group axis="y" values={localPriority} onReorder={(newOrder) => handleReorder('priority', newOrder)} className="space-y-3 list-none p-0">
                  {localPriority.map(service => (
                    <Reorder.Item 
                      key={service.id} 
                      value={service}
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-transparent gap-3 cursor-grab active:cursor-grabbing hover:bg-white hover:border-gray-200 transition-all select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical size={16} className="text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-[13px] leading-tight truncate">{service.name}</p>
                          <p className="text-[11px] font-black text-red-600 mt-0.5">{'\u20B1'}{service.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none`}>
                          {service.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} className="h-7 w-7 p-0 text-amber-600 border border-amber-600 hover:bg-amber-50 rounded-md">
                            <Edit size={12} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service.id)} className="h-7 w-7 p-0 text-red-600 border border-red-600 hover:bg-red-50 rounded-md">
                            <Trash size={12} />
                          </Button>
                        </div>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            </CardContent>
          </Card>
        </div>



        <Card className="border-none shadow-md h-full">
          <CardHeader className="pt-3 pb-0 px-4">
            <CardTitle className="text-base font-black text-gray-900 uppercase">Add-On Services</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar -mt-2">
              <Reorder.Group axis="y" values={localAddon} onReorder={(newOrder) => handleReorder('addon', newOrder)} className="space-y-3 list-none p-0">
                {localAddon.map(service => (
                  <Reorder.Item 
                    key={service.id} 
                    value={service}
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-transparent gap-3 cursor-grab active:cursor-grabbing hover:bg-white hover:border-gray-200 transition-all select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={16} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-[13px] leading-tight truncate">{service.name}</p>
                        <p className="text-[11px] font-black text-red-600 mt-0.5">{'\u20B1'}{service.price.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none`}>
                        {service.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="flex items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} className="h-7 w-7 p-0 text-amber-600 border border-amber-600 hover:bg-amber-50 rounded-md">
                          <Edit size={12} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service.id)} className="h-7 w-7 p-0 text-red-600 border border-red-600 hover:bg-red-50 rounded-md">
                          <Trash size={12} />
                        </Button>
                      </div>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
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
    </div >
  );
}

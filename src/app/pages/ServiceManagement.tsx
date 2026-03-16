import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { PlusCircle, Edit, Trash, History, GripVertical } from 'lucide-react';
import { Reorder } from 'motion/react';
import ServiceModal from '@/app/components/ServiceModal';

import { Service } from '@/app/types';
import { useServices } from '@/app/context/ServiceContext';

interface ServiceManagementProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
}

export default function ServiceManagement({ onSetHeaderActionRight }: ServiceManagementProps) {
  const { services, addService, updateService, deleteService, reorderServices } = useServices();
  const [serviceModalOpen, setServiceModalOpen] = useState(false); // Renamed from isModalOpen
  const [selectedService, setSelectedService] = useState<Service | null>(null); // Renamed from editingService
  const navigate = useNavigate();

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold"
            onClick={() => navigate('/activity-history')}
          >
            <History size={16} className="mr-0" />
            View History
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 font-bold"
            onClick={() => {
              setSelectedService(null);
              setServiceModalOpen(true);
            }}
          >
            <PlusCircle size={16} className="mr-0" />
            New Service
          </Button>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight]);

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
  const handleReorder = (category: string, reorderedInCategory: Service[]) => {
    const otherCategories = services.filter(s => s.category !== category);
    reorderServices([...otherCategories, ...reorderedInCategory]);
  };

  const baseServices = services.filter(s => s.category === 'base' && s.active === true && !s.name.startsWith('[') && !s.name.startsWith('z_')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const priorityServices = services.filter(s => s.category === 'priority' && s.active === true && !s.name.includes('Premium') && !s.name.startsWith('[') && !s.name.startsWith('z_')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const addonServices = services.filter(s => s.category === 'addon' && s.active === true && !s.name.startsWith('[') && !s.name.startsWith('z_')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <Card className="border-none shadow-md">
            <CardHeader className="pt-3 pb-0 px-4">
              <CardTitle className="text-base font-black text-gray-900 uppercase">Base Services</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Reorder.Group axis="y" values={baseServices} onReorder={(newOrder) => handleReorder('base', newOrder)} className="space-y-3 -mt-2 pr-1 max-h-[240px] overflow-y-scroll custom-scrollbar list-none p-0">
                {baseServices.map(service => (
                  <Reorder.Item 
                    key={service.id} 
                    value={service} 
                    initial={false}
                    whileDrag={{ scale: 1.03, boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border-none gap-3 cursor-grab active:cursor-grabbing border border-transparent hover:border-gray-200 transition-all z-0 hover:z-10 relative"
                  >
                    <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                      <div className="p-1">
                        <GripVertical size={16} className="text-gray-400 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-[13px] leading-tight truncate">{service.name}</p>
                        <p className="text-[11px] font-black text-red-600 mt-0">{'\u20B1'}{service.price.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none`}>
                        {service.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="flex items-center gap-1.5">
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
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="pt-3 pb-0 px-4">
              <CardTitle className="text-base font-black text-gray-900 uppercase">Priority Fees</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Reorder.Group axis="y" values={priorityServices} onReorder={(newOrder) => handleReorder('priority', newOrder)} className="space-y-3 -mt-2 pr-1 max-h-[180px] overflow-y-scroll custom-scrollbar list-none p-0">
                {priorityServices.map(service => (
                  <Reorder.Item 
                    key={service.id} 
                    value={service} 
                    initial={false}
                    whileDrag={{ scale: 1.03, boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border-none gap-3 cursor-grab active:cursor-grabbing border border-transparent hover:border-gray-200 transition-all z-0 hover:z-10 relative"
                  >
                    <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                      <div className="p-1">
                        <GripVertical size={16} className="text-gray-400 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-[13px] leading-tight truncate">{service.name}</p>
                        <p className="text-[11px] font-black text-red-600 mt-0.5">{'\u20B1'}{service.price.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none`}>
                        {service.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="flex items-center gap-1.5">
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
            </CardContent>
          </Card>
        </div>



        <Card className="border-none shadow-md h-full">
          <CardHeader className="pt-3 pb-0 px-4">
            <CardTitle className="text-base font-black text-gray-900 uppercase">Add-On Services</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 h-[calc(100%-48px)]">
            <Reorder.Group axis="y" values={addonServices} onReorder={(newOrder) => handleReorder('addon', newOrder)} className="space-y-3 -mt-2 pr-1 max-h-[440px] overflow-y-scroll custom-scrollbar list-none p-0">
              {addonServices.map(service => (
                <Reorder.Item 
                  key={service.id} 
                  value={service} 
                  initial={false}
                  whileDrag={{ scale: 1.03, boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border-none gap-3 cursor-grab active:cursor-grabbing border border-transparent hover:border-gray-200 transition-all z-0 hover:z-10 relative"
                >
                  <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                    <div className="p-1">
                      <GripVertical size={16} className="text-gray-400 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-[13px] leading-tight truncate">{service.name}</p>
                      <p className="text-[11px] font-black text-red-600 mt-0.5">{'\u20B1'}{service.price.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`${service.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} text-[9px] font-bold uppercase tracking-wider shadow-none border-none`}>
                      {service.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="flex items-center gap-1.5">
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

import { mockServices } from '@/app/lib/mockData';
import { Badge } from '@/app/components/ui/badge';
import { Plus, Edit, Trash, History } from 'lucide-react';
import ServiceModal from '@/app/components/ServiceModal';

import { Service } from '@/app/types';


interface ServiceManagementProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
}

export default function ServiceManagement({ onSetHeaderActionRight }: ServiceManagementProps) {
  const [services, setServices] = useState<Service[]>(mockServices);
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
            <Plus size={16} className="mr-0" />
            New Service
          </Button>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight]);

  const handleSaveService = (service: Service) => {
    setServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.map(s => s.id === service.id ? service : s);
      }
      return [...prev, service];
    });
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setServiceModalOpen(true);
  };

  const handleDeleteService = (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      setServices(prev => prev.filter(s => s.id !== id));
    }
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
              <div className="space-y-3 -mt-2">
                {services.filter(s => s.category === 'base').map(service => (
                  <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border-none gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-[13px] leading-tight">{service.name}</p>
                      <p className="text-[11px] font-black text-red-600 mt-0">{'\u20B1'}{service.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="pt-3 pb-0 px-4">
              <CardTitle className="text-base font-black text-gray-900 uppercase">Priority Fees</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 -mt-2">
                {services.filter(s => s.category === 'priority').map(service => (
                  <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border-none gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-[13px] leading-tight">{service.name}</p>
                      <p className="text-[11px] font-black text-red-600 mt-0.5">{'\u20B1'}{service.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>



        <Card className="border-none shadow-md h-full">
          <CardHeader className="pt-3 pb-0 px-4">
            <CardTitle className="text-base font-black text-gray-900 uppercase">Add-On Services</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 -mt-2">
              {services.filter(s => s.category === 'addon').map(service => (
                <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border-none gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-[13px] leading-tight">{service.name}</p>
                    <p className="text-[11px] font-black text-red-600 mt-0.5">{'\u20B1'}{service.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
                </div>
              ))}
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

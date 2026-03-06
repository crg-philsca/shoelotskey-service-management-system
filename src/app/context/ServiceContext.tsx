import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Service } from '@/app/types';
import { mockServices } from '@/app/lib/mockData';

interface ServiceContextType {
    services: Service[];
    addService: (service: Service) => void;
    updateService: (id: string, updates: Partial<Service>) => void;
    deleteService: (id: string) => void;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>([]);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/services')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setServices(data);
                }
            })
            .catch(err => {
                console.error("Failed to fetch services from backend, falling back to mock", err);
                setServices(mockServices);
            });
    }, []);

    const addService = (service: Service) => {
        fetch('http://127.0.0.1:8000/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(service)
        })
            .then(res => res.json())
            .then(data => {
                setServices((prev) => [...prev, data]);
            })
            .catch(err => {
                console.error(err);
                setServices((prev) => [...prev, service]); // Fallback
            });
    };

    const updateService = (id: string, updates: Partial<Service>) => {
        fetch(`http://127.0.0.1:8000/api/services/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        })
            .then(res => res.json())
            .then(data => {
                setServices((prev) => prev.map((service) => service.id === id ? { ...service, ...data } : service));
            })
            .catch(err => {
                console.error(err);
                setServices((prev) => prev.map((service) => service.id === id ? { ...service, ...updates } : service)); // Fallback
            });
    };

    const deleteService = (id: string) => {
        fetch(`http://127.0.0.1:8000/api/services/${id}`, {
            method: 'DELETE'
        })
            .then(() => {
                setServices((prev) => prev.filter((s) => s.id !== id));
            })
            .catch(err => {
                console.error(err);
                setServices((prev) => prev.filter((s) => s.id !== id)); // Fallback
            });
    };

    return (
        <ServiceContext.Provider value={{ services, addService, updateService, deleteService }}>
            {children}
        </ServiceContext.Provider>
    );
}

export function useServices() {
    const context = useContext(ServiceContext);
    if (context === undefined) {
        throw new Error('useServices must be used within a ServiceProvider');
    }
    return context;
}

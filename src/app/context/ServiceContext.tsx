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
    const [services, setServices] = useState<Service[]>(() => {
        const saved = localStorage.getItem('services_v1');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse services from localStorage");
            }
        }
        return mockServices;
    });

    useEffect(() => {
        localStorage.setItem('services_v1', JSON.stringify(services));
    }, [services]);

    const addService = (service: Service) => {
        setServices((prev) => [...prev, service]);
    };

    const updateService = (id: string, updates: Partial<Service>) => {
        setServices((prev) => prev.map((service) => {
            if (service.id === id) {
                return { ...service, ...updates };
            }
            return service;
        }));
    };

    const deleteService = (id: string) => {
        setServices((prev) => prev.filter((s) => s.id !== id));
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

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Service } from '@/app/types';
import { mockServices } from '@/app/lib/mockData';

interface ServiceContextType {
    services: Service[];
    addService: (service: Service) => void;
    updateService: (id: string, updates: Partial<Service>) => void;
    deleteService: (id: string) => void;
    reorderServices: (newOrder: Service[]) => void;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:8000/api'
    : '/api';

export function ServiceProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>([]);

    useEffect(() => {
        fetch(`${API_BASE}/services`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Map Backend(3NF) fields to Frontend UI fields
                    const mappedServices = data.map((bs: any) => ({
                        id: bs.service_id.toString(),
                        name: bs.service_name,
                        price: parseFloat(bs.base_price),
                        // Extract category name from nested 3NF object
                        category: typeof bs.category === 'object' ? bs.category?.category_name : bs.category,
                        active: bs.is_active,
                        description: bs.description || '',
                        durationDays: bs.duration_days || 0,
                        code: bs.service_code || '',
                        sortOrder: bs.sort_order || 0
                    }));
                    setServices(mappedServices);
                }
            })
            .catch(err => {
                console.error("Failed to fetch services from backend, falling back to mock", err);
                setServices(mockServices);
            });
    }, []);

    const addService = (service: Service) => {
        const payload = {
            service_name: service.name,
            base_price: service.price,
            category: service.category,
            is_active: service.active,
            description: service.description || null,
            duration_days: service.durationDays || 0,
            service_code: service.code || null
        };

        fetch(`${API_BASE}/services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) throw new Error('API failed');
                return res.json();
            })
            .then(data => {
                const newSvc: Service = {
                    id: data.service_id.toString(),
                    name: data.service_name,
                    price: parseFloat(data.base_price),
                    category: data.category,
                    active: data.is_active,
                    description: data.description || '',
                    durationDays: data.duration_days || 0,
                    code: data.service_code || ''
                };
                setServices((prev) => [...prev, newSvc]);
            })
            .catch(err => {
                console.error(err);
                setServices((prev) => [...prev, service]); // Fallback
            });
    };

    const updateService = (id: string, updates: Partial<Service>) => {
        const payload: any = {};
        if (updates.name !== undefined) payload.service_name = updates.name;
        if (updates.price !== undefined) payload.base_price = updates.price;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.active !== undefined) payload.is_active = updates.active;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.durationDays !== undefined) payload.duration_days = updates.durationDays;
        if (updates.code !== undefined) payload.service_code = updates.code;

        fetch(`${API_BASE}/services/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) throw new Error('API failed');
                return res.json();
            })
            .then(data => {
                setServices((prev) => prev.map((service) => service.id === id ? {
                    ...service,
                    name: data.service_name,
                    price: parseFloat(data.base_price),
                    category: data.category,
                    active: data.is_active,
                    description: data.description || '',
                    durationDays: data.duration_days || 0,
                    code: data.service_code || ''
                } : service));
            })
            .catch(err => {
                console.error(err);
                setServices((prev) => prev.map((service) => service.id === id ? { ...service, ...updates } : service)); // Fallback
            });
    };

    const deleteService = (id: string) => {
        fetch(`${API_BASE}/services/${id}`, {
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

    const reorderServices = (newOrder: Service[]) => {
        // 1. Optimistically update local state
        setServices(newOrder);

        // 2. Prepare bulk payload (mappings frontend IDs to backend sort_orders)
        const reorderPayload = newOrder.map((svc, index) => ({
            id: parseInt(svc.id),
            sort_order: index + 1
        }));

        // 3. Save entire sequence in one transaction (Pro-Level Sync)
        fetch(`${API_BASE}/services/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reorderPayload)
        }).catch(err => {
            console.error("Bulk reorder sync failed", err);
            // Optional: revert state if critical
        });
    };

    return (
        <ServiceContext.Provider value={{ services, addService, updateService, deleteService, reorderServices }}>
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

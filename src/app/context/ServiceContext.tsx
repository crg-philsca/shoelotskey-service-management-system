import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { Service } from '@/app/types';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';

interface ServiceContextType {
    services: Service[];
    addService: (service: Service) => void;
    updateService: (id: string, updates: Partial<Service>) => void;
    deleteService: (id: string) => void;
    reorderServices: (newOrder: Service[]) => void;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children, user }: { children: ReactNode, user: { token: string } }) {
    const [services, setServices] = useState<Service[]>([]);

    // --- OFFLINE AUTO-SYNC QUEUE ---
    const queueServiceSync = (task: any) => {
        if (typeof window === 'undefined') return;
        const queueStr = localStorage.getItem('service_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ ...task, timestamp: Date.now() });
        localStorage.setItem('service_sync_queue', JSON.stringify(queue));
    };

    const sanitizeServices = (raw: any[]): Service[] => {
        if (!Array.isArray(raw)) return [];
        return raw
            .filter(bs => {
                const name = (bs.name || bs.service_name || '').trim().toLowerCase();
                if (name === 'midsole full reglue' || name === 'undersole full reglue') return false;
                return true;
            })
            .map((bs: any) => ({
                id: (bs.service_id ?? bs.id).toString(),
                name: bs.service_name ?? bs.name,
                price: parseFloat(bs.base_price ?? bs.price ?? 0),
                category: typeof bs.category === 'object' ? bs.category?.category_name : bs.category,
                active: bs.is_active !== undefined ? bs.is_active : (bs.active ?? true),
                description: bs.description || '',
                durationDays: bs.duration_days ?? bs.durationDays ?? 0,
                code: bs.service_code ?? bs.code ?? '',
                sortOrder: bs.sort_order ?? bs.sortOrder ?? 0
            }));
    };

    useEffect(() => {
        const processSyncQueue = async () => {
            if (typeof window === 'undefined' || !navigator.onLine) return;
            const queueStr = localStorage.getItem('service_sync_queue');
            if (!queueStr) return;
            
            try {
                const queue: any[] = JSON.parse(queueStr);
                if (queue.length === 0) return;
                
                let remainingQueue = [];
                let hasChanges = false;
                for (const task of queue) {
                    try {
                        let res;
                        if (task.type === 'POST') {
                            res = await fetch(`${API_BASE}/services`, {
                                method: 'POST',
                                headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${user.token}`
                                },
                                body: JSON.stringify(task.payload)
                            });
                        } else if (task.type === 'PUT') {
                            // Only retry real DB IDs
                            if (!isNaN(parseInt(task.id))) {
                                res = await fetch(`${API_BASE}/services/${task.id}`, {
                                    method: 'PUT',
                                    headers: { 
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${user.token}`
                                    },
                                    body: JSON.stringify(task.payload)
                                });
                            } else {
                                console.warn('Skipping PUT for invalid ID', task.id);
                                continue;
                            }
                        } else if (task.type === 'DELETE') {
                            if (!isNaN(parseInt(task.id))) {
                                res = await fetch(`${API_BASE}/services/${task.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${user.token}` }
                                });
                            } else {
                                console.warn('Skipping DELETE for invalid ID', task.id);
                                continue;
                            }
                        }
                        
                        if (res && !res.ok) throw new Error('Sync failed');
                        hasChanges = true;
                    } catch (err) {
                        remainingQueue.push(task);
                    }
                }
                localStorage.setItem('service_sync_queue', JSON.stringify(remainingQueue));
                
                if (hasChanges) {
                    // Refetch to align exact database IDs
                    const response = await fetch(`${API_BASE}/services?_t=${Date.now()}`, {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        const cleanServices = sanitizeServices(data);
                        setServices(cleanServices);
                        localStorage.setItem('service_data_cache', JSON.stringify(cleanServices));
                    }
                }
            } catch (e) {
                console.error("Failed to parse service sync queue", e);
            }
        };

        const initialFetch = () => {
            const cache = localStorage.getItem('service_data_cache');
            if (cache) {
                try {
                    const parsed = JSON.parse(cache);
                    const cleanCache = sanitizeServices(parsed);
                    setServices(cleanCache);
                    localStorage.setItem('service_data_cache', JSON.stringify(cleanCache));
                } catch(e) {}
            }

            fetch(`${API_BASE}/services?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        const cleanServices = sanitizeServices(data);
                        setServices(cleanServices);
                        localStorage.setItem('service_data_cache', JSON.stringify(cleanServices));
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch services from backend. Keeping cached data.", err);
                });
        };

        initialFetch();
        processSyncQueue();
        window.addEventListener('online', processSyncQueue);
        return () => window.removeEventListener('online', processSyncQueue);
    }, [user.token]);

    const addService = (service: Service) => {
        const tempId = service.id && service.id !== 'new' ? service.id : Math.random().toString();
        const optimisticService: Service = { ...service, id: tempId, sortOrder: service.sortOrder || services.length + 1 };
        setServices((prev) => {
            const updated = sanitizeServices([...prev, optimisticService]);
            localStorage.setItem('service_data_cache', JSON.stringify(updated));
            return updated;
        });

        const payload = {
            service_name: service.name,
            base_price: service.price,
            category: service.category,
            is_active: service.active,
            description: service.description || null,
            duration_days: service.durationDays || 0,
            service_code: service.code || null,
            sort_order: optimisticService.sortOrder
        };

        fetch(`${API_BASE}/services`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (res.status === 400 || res.status === 401 || res.status === 403) {
                    throw new Error(`HTTP_${res.status}: Permission denied or invalid data.`);
                }
                if (!res.ok) throw new Error('API failed');
                return res.json();
            })
            .then(data => {
                const verifiedSvc: Service = {
                    id: data.service_id.toString(),
                    name: data.service_name,
                    price: parseFloat(data.base_price),
                    category: typeof data.category === 'object' ? data.category?.category_name : (data.category || service.category),
                    active: data.is_active,
                    description: data.description || '',
                    durationDays: data.duration_days || 0,
                    code: data.service_code || '',
                    sortOrder: data.sort_order || optimisticService.sortOrder
                };
                setServices((prev) => {
                    const updated = prev.map(s => s.id === tempId ? verifiedSvc : s);
                    localStorage.setItem('service_data_cache', JSON.stringify(updated));
                    return updated;
                });
            })
            .catch(err => {
                console.error("Service sync failed:", err);
                if (err.message && err.message.startsWith('HTTP_')) {
                    import('sonner').then(({ toast }) => toast.error('Action denied (400/401/403).'));
                    setServices((prev) => {
                        const updated = prev.filter(s => s.id !== tempId);
                        localStorage.setItem('service_data_cache', JSON.stringify(updated));
                        return updated;
                    });
                    return;
                }
                queueServiceSync({ type: 'POST', payload });
            });
    };

    const updateService = (id: string, updates: Partial<Service>) => {
        setServices((prev) => {
            const updated = prev.map((s) => s.id === id ? { ...s, ...updates } : s);
            localStorage.setItem('service_data_cache', JSON.stringify(updated));
            return updated;
        });

        const payload: any = {};
        if (updates.name !== undefined) payload.service_name = updates.name;
        if (updates.price !== undefined) payload.base_price = updates.price;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.active !== undefined) payload.is_active = updates.active;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.durationDays !== undefined) payload.duration_days = updates.durationDays;
        if (updates.code !== undefined) payload.service_code = updates.code;
        if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

        fetch(`${API_BASE}/services/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (res.status === 400 || res.status === 401 || res.status === 403) {
                    throw new Error(`HTTP_${res.status}: Permission denied or invalid data.`);
                }
                if (!res.ok) throw new Error('API failed');
                return res.json();
            })
            .then(data => {
                setServices((prev) => {
                    const updated = prev.map((service) => service.id === id ? {
                        ...service,
                        name: data.service_name,
                        price: parseFloat(data.base_price),
                        category: typeof data.category === 'object' ? data.category?.category_name : (data.category || service.category),
                        active: data.is_active,
                        description: data.description || '',
                        durationDays: data.duration_days || 0,
                        code: data.service_code || '',
                        sortOrder: data.sort_order ?? service.sortOrder
                    } : service);
                    localStorage.setItem('service_data_cache', JSON.stringify(updated));
                    return updated;
                });
            })
            .catch(err => {
                console.error("Service sync failed:", err);
                if (err.message && err.message.startsWith('HTTP_')) {
                    import('sonner').then(({ toast }) => toast.error('Update denied (400/401/403).'));
                    return;
                }
                queueServiceSync({ type: 'PUT', id, payload });
            });
    };

    const deleteService = (id: string) => {
        // 1. Instantly remove from state and update localStorage cache
        setServices((prev) => {
            const updated = prev.filter((s) => s.id !== id);
            localStorage.setItem('service_data_cache', JSON.stringify(updated));
            return updated;
        });

        fetch(`${API_BASE}/services/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${user.token}` }
        })
            .then((res) => {
                if (res.status === 400 || res.status === 401 || res.status === 403) {
                    throw new Error(`HTTP_${res.status}: Permission denied or invalid data.`);
                }
                if (!res.ok) throw new Error('Delete failed');
            })
            .catch(err => {
                console.error("Service sync failed:", err);
                if (err.message && err.message.startsWith('HTTP_')) {
                    import('sonner').then(({ toast }) => toast.error('Delete denied (400/401/403).'));
                    return;
                }
                queueServiceSync({ type: 'DELETE', id });
            });
    };

    // debounce timeout reference
    const [reorderTimeout, setReorderTimeout] = useState<NodeJS.Timeout | null>(null);

    const reorderServices = (newOrder: Service[]) => {
        // 1. Instantly update sortOrder properties to prevent the "flicker/pop-back" bug
        const updatedLocalOrder = newOrder.map((svc, index) => ({
            ...svc,
            sortOrder: index + 1
        }));

        // 2. Optimistically update global state
        setServices(updatedLocalOrder);

        // 3. Clear existing timeout to debounce the backend sync
        if (reorderTimeout) clearTimeout(reorderTimeout);

        // 4. Set a new timeout to sync with the database only after the user stops dragging (500ms)
        const timeout = setTimeout(() => {
            const reorderPayload = updatedLocalOrder.map((svc) => ({
                id: parseInt(svc.id),
                sort_order: svc.sortOrder
            }));

            fetch(`${API_BASE}/services/reorder`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(reorderPayload)
            }).catch(() => {
                // Silent failure on reorder sync in UI
            });
        }, 500);

        setReorderTimeout(timeout);
    };

    const contextValue = useMemo(() => ({ 
        services, 
        addService, 
        updateService, 
        deleteService, 
        reorderServices 
    }), [services, addService, updateService, deleteService, reorderServices]);

    return (
        <ServiceContext.Provider value={contextValue}>
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

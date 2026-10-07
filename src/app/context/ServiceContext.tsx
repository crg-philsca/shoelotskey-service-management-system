import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { Service } from '@/app/types';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';
import { useActivities } from './ActivityContext';

interface ServiceContextType {
    services: Service[];
    authorizationCode: string;
    setAuthorizationCode: (code: string) => Promise<boolean>;
    addService: (service: Service) => void;
    updateService: (id: string, updates: Partial<Service>) => void;
    deleteService: (id: string) => void;
    reorderServices: (newOrder: Service[]) => void;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

const parseConnectedAddons = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
            } catch (_) {}
        }
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
};

const parseDiscountMeta = (description: any, name: string) => {
    let parsed: any = null;
    if (typeof description === 'string' && description.trim().startsWith('{')) {
        try {
            parsed = JSON.parse(description);
        } catch (_) {}
    }
    const sName = (name || '').toLowerCase();
    const isSenior = sName.includes('senior') || sName.includes('snr');
    const isPwd = sName.includes('pwd') || sName.includes('disability');

    const requiresIdVerification = parsed?.requiresId ?? (parsed?.idType && parsed.idType !== 'none' ? true : (isSenior || isPwd));
    const idVerificationType: 'control_number' | 'id_number' | 'none' = parsed?.idType || (isSenior ? 'control_number' : isPwd ? 'id_number' : 'none');
    const idFormat: 'alphanumeric' | 'numbers' | 'letters' = parsed?.idFormat || 'alphanumeric';
    const idDigits = parsed?.digits != null ? Number(parsed.digits) : undefined;
    const discountType = parsed?.discountType || (description === 'fixed' ? 'fixed' : 'percent');

    return { requiresIdVerification, idVerificationType, idFormat, idDigits, discountType };
};

const sanitizeServices = (raw: any[]): Service[] => {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(bs => {
            const name = (bs.name || bs.service_name || '').trim().toLowerCase();
            if (name === 'midsole full reglue' || name === 'undersole full reglue') return false;
            return true;
        })
        .map((bs: any) => {
            const rawCat = typeof bs.category === 'object' ? bs.category?.category_name : bs.category;
            const isDiscount = rawCat === 'discount';
            const meta = isDiscount ? parseDiscountMeta(bs.description, bs.service_name ?? bs.name) : null;

            return {
                id: (bs.service_id ?? bs.id).toString(),
                name: bs.service_name ?? bs.name,
                price: parseFloat(bs.base_price ?? bs.price ?? 0),
                category: rawCat,
                active: bs.is_active !== undefined ? bs.is_active : (bs.active ?? true),
                description: meta?.discountType || bs.description || '',
                durationDays: bs.duration_days ?? bs.durationDays ?? 0,
                code: bs.service_code ?? bs.code ?? '',
                sortOrder: bs.sort_order ?? bs.sortOrder ?? 0,
                connectedAddons: parseConnectedAddons(bs.connected_addons ?? bs.connectedAddons),
                connectedBaseServices: parseConnectedAddons(bs.connected_base_services ?? bs.connectedBaseServices),
                requiresIdVerification: meta ? meta.requiresIdVerification : Boolean(bs.requiresIdVerification),
                idVerificationType: meta ? meta.idVerificationType : (bs.idVerificationType || 'none'),
                idFormat: meta ? meta.idFormat : (bs.idFormat || 'alphanumeric'),
                idDigits: meta ? meta.idDigits : bs.idDigits,
                hasSpinner: (bs.category === 'addon' || bs.category?.category_name === 'addon') ? (bs.has_spinner !== undefined ? Boolean(bs.has_spinner) : (bs.hasSpinner !== undefined ? Boolean(bs.hasSpinner) : ((bs.service_name || bs.name || '').toLowerCase() === 'unyellowing' || (bs.service_name || bs.name || '').toLowerCase() === 'white paint'))) : false,
            };
        });
};

export function ServiceProvider({ children, user }: { children: ReactNode, user: { token: string; username?: string } }) {
    const { addActivity } = useActivities();
    const [services, setServices] = useState<Service[]>(() => {
        if (typeof window !== 'undefined') {
            const cache = localStorage.getItem('service_data_cache');
            if (cache) {
                try {
                    const parsed = JSON.parse(cache);
                    return sanitizeServices(parsed);
                } catch(e) {}
            }
        }
        return [];
    });

    const [authorizationCode, setAuthorizationCodeState] = useState<string>('');

    useEffect(() => {
        // Security Cleanup: Purge any legacy authorization codes from localStorage to prevent XSS exfiltration
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('shoelotskey_auth_code');
            } catch (_) {}
        }
        if (!user.token) return;

        const fetchCode = () => {
            fetch(`${API_BASE}/settings/authorization-code`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.authorization_code && data.authorization_code !== '***') {
                    setAuthorizationCodeState(data.authorization_code);
                }
            })
            .catch(() => {});
        };

        fetchCode();

        const handleLocalUpdate = (e: any) => {
            if (e?.detail) setAuthorizationCodeState(e.detail);
        };
        window.addEventListener('shoelotskey:auth-code-updated', handleLocalUpdate);
        window.addEventListener('focus', fetchCode);

        let bc: BroadcastChannel | null = null;
        try {
            bc = new BroadcastChannel('shoelotskey_auth_channel');
            bc.onmessage = (event) => {
                if (event.data?.code) {
                    setAuthorizationCodeState(event.data.code);
                }
            };
        } catch (_) {}

        return () => {
            window.removeEventListener('shoelotskey:auth-code-updated', handleLocalUpdate);
            window.removeEventListener('focus', fetchCode);
            if (bc) bc.close();
        };
    }, [user.token]);

    const setAuthorizationCode = async (code: string): Promise<boolean> => {
        const clean = code.trim();
        setAuthorizationCodeState(clean);
        try {
            const res = await fetch(`${API_BASE}/settings/authorization-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({ authorization_code: clean })
            });
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                const savedCode = data.authorization_code || clean;
                setAuthorizationCodeState(savedCode);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('shoelotskey:auth-code-updated', { detail: savedCode }));
                    try {
                        const bc = new BroadcastChannel('shoelotskey_auth_channel');
                        bc.postMessage({ type: 'AUTH_CODE_UPDATED', code: savedCode });
                        bc.close();
                    } catch (_) {}
                }
                return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    // --- OFFLINE AUTO-SYNC QUEUE ---
    const queueServiceSync = (task: any) => {
        if (typeof window === 'undefined') return;
        const queueStr = localStorage.getItem('service_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ ...task, timestamp: Date.now() });
        localStorage.setItem('service_sync_queue', JSON.stringify(queue));
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
                        
                        if (res) {
                            if (res.status === 404) {
                                // If resource is already 404, it is already deleted or does not exist on backend
                                hasChanges = true;
                                continue;
                            }
                            if (!res.ok) {
                                if (res.status === 400 || res.status === 422) {
                                    console.warn(`[SERVICE SYNC] Dropping unprocessable task (status ${res.status})`, task);
                                    continue;
                                }
                                throw new Error(`Sync failed with status ${res.status}`);
                            }
                        }
                        hasChanges = true;
                    } catch (err) {
                        const isStale = task.timestamp && (Date.now() - task.timestamp > 24 * 60 * 60 * 1000);
                        if (!isStale) {
                            remainingQueue.push(task);
                        }
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

        const isJobOrderForm = typeof window !== 'undefined' && window.location.pathname.startsWith('/job-order-form');
        let deferTimer: any;
        if (isJobOrderForm) {
            deferTimer = setTimeout(initialFetch, 10000);
        } else {
            initialFetch();
        }

        processSyncQueue();
        window.addEventListener('online', processSyncQueue);
        return () => {
            clearTimeout(deferTimer);
            window.removeEventListener('online', processSyncQueue);
        };
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
            sort_order: optimisticService.sortOrder,
            connected_addons: service.connectedAddons || [],
            connected_base_services: service.connectedBaseServices || [],
            has_spinner: service.category === 'addon' ? Boolean(service.hasSpinner) : false
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
                const rawCat = typeof data.category === 'object' ? data.category?.category_name : (data.category || service.category);
                const meta = rawCat === 'discount' ? parseDiscountMeta(data.description, data.service_name) : null;
                const verifiedSvc: Service = {
                    id: data.service_id.toString(),
                    name: data.service_name,
                    price: parseFloat(data.base_price),
                    category: rawCat,
                    active: data.is_active,
                    description: meta?.discountType || data.description || '',
                    durationDays: data.duration_days || 0,
                    code: data.service_code || '',
                    sortOrder: data.sort_order || optimisticService.sortOrder,
                    connectedAddons: parseConnectedAddons(data.connected_addons) || optimisticService.connectedAddons || [],
                    connectedBaseServices: parseConnectedAddons(data.connected_base_services) || optimisticService.connectedBaseServices || [],
                    requiresIdVerification: meta ? meta.requiresIdVerification : Boolean(service.requiresIdVerification),
                    idVerificationType: meta ? meta.idVerificationType : (service.idVerificationType || 'none'),
                    idFormat: meta ? meta.idFormat : (service.idFormat || 'alphanumeric'),
                    idDigits: meta ? meta.idDigits : service.idDigits,
                    hasSpinner: rawCat === 'addon' ? (data.has_spinner !== undefined ? Boolean(data.has_spinner) : Boolean(service.hasSpinner)) : false,
                };
                setServices((prev) => {
                    const updated = prev.map(s => s.id === tempId ? verifiedSvc : s);
                    localStorage.setItem('service_data_cache', JSON.stringify(updated));
                    return updated;
                });

                addActivity({
                    user: user.username || 'System',
                    action: 'CREATE',
                    actionRaw: 'CREATE',
                    type: 'service',
                    table: 'services',
                    module: 'Services',
                    recordId: data.service_id,
                    details: `Created new service: ${service.name} (₱${service.price})`,
                    newValues: {
                        service_name: service.name,
                        base_price: service.price,
                        category: service.category
                    }
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
        if (updates.connectedAddons !== undefined) payload.connected_addons = updates.connectedAddons;
        if (updates.connectedBaseServices !== undefined) payload.connected_base_services = updates.connectedBaseServices;
        if (updates.hasSpinner !== undefined) payload.has_spinner = (updates.category ?? service.category) === 'addon' ? Boolean(updates.hasSpinner) : false;

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
                const rawCat = typeof data.category === 'object' ? data.category?.category_name : (data.category || updates.category);
                const meta = rawCat === 'discount' ? parseDiscountMeta(data.description, data.service_name) : null;
                setServices((prev) => {
                    const updated = prev.map((service) => service.id === id ? {
                        ...service,
                        name: data.service_name,
                        price: parseFloat(data.base_price),
                        category: rawCat || service.category,
                        active: data.is_active,
                        description: meta?.discountType || data.description || '',
                        durationDays: data.duration_days || 0,
                        code: data.service_code || '',
                        sortOrder: data.sort_order ?? service.sortOrder,
                        connectedAddons: parseConnectedAddons(data.connected_addons ?? updates.connectedAddons ?? service.connectedAddons),
                        connectedBaseServices: parseConnectedAddons(data.connected_base_services ?? updates.connectedBaseServices ?? service.connectedBaseServices),
                        requiresIdVerification: meta ? meta.requiresIdVerification : (updates.requiresIdVerification ?? service.requiresIdVerification),
                        idVerificationType: meta ? meta.idVerificationType : (updates.idVerificationType ?? service.idVerificationType ?? 'none'),
                        idFormat: meta ? meta.idFormat : (updates.idFormat ?? service.idFormat ?? 'alphanumeric'),
                        idDigits: meta ? meta.idDigits : (updates.idDigits ?? service.idDigits),
                        hasSpinner: (rawCat || service.category) === 'addon' ? (data.has_spinner !== undefined ? Boolean(data.has_spinner) : (updates.hasSpinner ?? service.hasSpinner)) : false,
                    } : service);
                    localStorage.setItem('service_data_cache', JSON.stringify(updated));
                    return updated;
                });

                addActivity({
                    user: user.username || 'System',
                    action: 'UPDATE',
                    actionRaw: 'UPDATE',
                    type: 'service',
                    table: 'services',
                    module: 'Services',
                    recordId: id,
                    details: `Updated service: ${data.service_name || updates.name || id}`,
                    newValues: updates
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
        const targetSvc = services.find(s => s.id === id);
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

                addActivity({
                    user: user.username || 'System',
                    action: 'DELETE',
                    actionRaw: 'DELETE',
                    type: 'service',
                    table: 'services',
                    module: 'Services',
                    recordId: id,
                    details: `Deleted service: ${targetSvc?.name || id}`,
                    oldValues: targetSvc ? {
                        service_name: targetSvc.name,
                        base_price: targetSvc.price
                    } : undefined
                });
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
        if (typeof window !== 'undefined') {
            localStorage.setItem('service_data_cache', JSON.stringify(updatedLocalOrder));
        }

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
        authorizationCode,
        setAuthorizationCode,
        addService, 
        updateService, 
        deleteService, 
        reorderServices 
    }), [services, authorizationCode, addService, updateService, deleteService, reorderServices]);

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

import { createContext, useContext, useState, ReactNode, useEffect, useRef, useMemo } from 'react';
import { JobOrder } from '@/app/types';
import { mockJobOrders } from '@/app/lib/mockData';
import { useActivities } from './ActivityContext';

// Backend API Base URL
const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173' || window.location.hostname.startsWith('192.')))
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : '/api';

// Resilience Check: Verifies if the backend is actually reachable
const checkBackend = async (token: string) => {
    try {
        const res = await fetch(`${API_BASE}/orders?limit=1`, { 
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        return res.ok || res.status === 401; // Reachable even if unauthorized
    } catch {
        return false;
    }
};

interface OrderContextType {
    orders: JobOrder[];
    loading: boolean;
    refreshing: boolean;
    dbStatus: 'remote' | 'local' | 'unknown';
    addOrder: (order: JobOrder) => Promise<void>;
    updateOrder: (id: string, updates: Partial<JobOrder>, statusUser?: string) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
    refreshOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

/**
 * @module OrderContext
 * @description Centralized state management for Job Orders.
 * Handles real-time synchronization with the FastAPI backend while providing
 * a robust localStorage fallback for offline/resilient operations.
 */
export function OrderProvider({ children, user }: { children: ReactNode, user: { id?: number, username: string, token: string } }) {
    const syncNotificationShown = useRef(false);
    const { addActivity } = useActivities();
    const [orders, setOrders] = useState<JobOrder[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem('jobOrders_v19_cache');
        let initialOrders: JobOrder[] = [];
        if (saved) {
            try {
                initialOrders = JSON.parse(saved).map((o: any) => ({
                    ...o,
                    createdAt: new Date(o.createdAt),
                    updatedAt: new Date(o.updatedAt),
                    transactionDate: new Date(o.transactionDate || o.createdAt),
                    predictedCompletionDate: o.predictedCompletionDate ? new Date(o.predictedCompletionDate) : undefined,
                    actualCompletionDate: o.actualCompletionDate ? new Date(o.actualCompletionDate) : undefined,
                    statusHistory: o.statusHistory?.map((sl: any) => ({
                        ...sl,
                        timestamp: new Date(sl.timestamp)
                    })) || []
                }));
            } catch (e) {
                console.error("Failed to parse cached orders", e);
            }
        }

        // Merge from sync queue (important for persistent offline data)
        const queueStr = localStorage.getItem('order_sync_queue');
        if (queueStr) {
            try {
                const queue = JSON.parse(queueStr);
                const pendingAdds = queue
                    .filter((q: any) => q.type === 'ADD')
                    .map((q: any) => ({
                        ...q.payload,
                        id: q.payload.id || `offline-${q.timestamp}`,
                        createdAt: new Date(q.timestamp),
                        updatedAt: new Date(q.timestamp),
                        statusHistory: []
                    }));
                
                // Add pending orders that aren't already in initialOrders
                pendingAdds.forEach((pa: JobOrder) => {
                    if (!initialOrders.find(o => o.orderNumber === pa.orderNumber)) {
                        initialOrders.unshift(pa);
                    }
                });
            } catch (e) {
                console.error("Failed to merge sync queue", e);
            }
        }
        return initialOrders;
    });

    // Helper to merge pending ADD tasks into an orders array
    const mergePendingOrders = (serverOrders: JobOrder[]) => {
        const queueStr = localStorage.getItem('order_sync_queue');
        if (!queueStr) return serverOrders;
        
        try {
            const queue = JSON.parse(queueStr);
            const pendingAdds = queue
                .filter((q: any) => q.type === 'ADD')
                .map((q: any) => ({
                    ...q.payload,
                    id: q.payload.id || `offline-${q.timestamp}`,
                    createdAt: new Date(q.timestamp),
                    updatedAt: new Date(q.timestamp),
                    statusHistory: []
                }));
            
            const merged = [...serverOrders];
            pendingAdds.forEach((pa: JobOrder) => {
                if (!merged.find(o => o.orderNumber === pa.orderNumber)) {
                    merged.unshift(pa);
                }
            });
            return merged;
        } catch (e) {
            return serverOrders;
        }
    };

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [dbStatus, setDbStatus] = useState<'remote' | 'local' | 'unknown'>('unknown');

    // Diagnostic Check: Verify if we are on Remote or Local DB
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch(`${API_BASE}/health-check`);
                const data = await res.json();
                setDbStatus(data.database.includes('PostgreSQL') ? 'remote' : 'local');
                
                // Auto-trigger cloud sync if we have pending local data and we're back on Remote
                if (data.has_pending_offline_data && !data.database.includes('SQLite') && user.token) {
                    console.log("[SYNC] Local orders detected. Attempting migration to Cloud...");
                    fetch(`${API_BASE}/sync-backup-to-cloud`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    }).then(r => r.json()).then(syncData => {
                        if (syncData.status === 'success') {
                            const { toast } = require('sonner');
                            toast.success("Database Restored", {
                                description: `Successfully synced ${syncData.synced_records} orders from local backup to Cloud Database.`,
                                duration: 10000
                            });
                            refreshOrders();
                        }
                    }).catch(console.error);
                }
            } catch (e) {
                setDbStatus('unknown');
            }
        };
        checkHealth();
    }, [user.token]);

    // Robust Mapping: Converts Backend 3NF Model to Frontend JobOrder Type
    const mapBackendToFrontend = (bo: any): JobOrder => {
        const firstItem = bo.items?.[0] || {};

        return {
            id: bo.order_id.toString(),
            orderNumber: bo.order_number,
            customerName: bo.customer?.customer_name || 'Guest',
            contactNumber: bo.customer?.contact_number || '-',
            grandTotal: parseFloat(bo.grand_total) || 0,
            baseServiceFee: bo.items?.reduce((total: number, currItem: any) =>
                total + (currItem.services?.filter((s: any) =>
                    (s.category?.category_name || s.category) === 'base'
                ).reduce((sum: number, s: any) => sum + (parseFloat(s.base_price) || 0) * (currItem.quantity || 1), 0) || 0)
                , 0) || 0,
            addOnsTotal: bo.items?.reduce((total: number, currItem: any) =>
                total + (currItem.services?.filter((s: any) =>
                    (s.category?.category_name || s.category) === 'addon'
                ).reduce((sum: number, s: any) => sum + (parseFloat(s.base_price) || 0) * (currItem.quantity || 1), 0) || 0)
                , 0) || 0,
            priorityLevel: (bo.priority?.priority_name || bo.priority || 'regular').toLowerCase() as any,
            paymentStatus: (bo.payments?.[0]?.p_status?.status_name || 'fully-paid').toLowerCase() as any,
            paymentMethod: (bo.payments?.[0]?.method?.method_name || 'cash').toLowerCase() as any,
            shippingPreference: (bo.delivery?.preference?.pref_name || 'pickup').toLowerCase() as any,
            deliveryAddress: bo.delivery?.delivery_address || '',
            deliveryCourier: bo.delivery?.delivery_courier || '',
            amountReceived: parseFloat(bo.payments?.[0]?.amount_received) || 0,
            change: Math.max(0, (parseFloat(bo.payments?.[0]?.amount_received) || 0) - (parseFloat(bo.grand_total) || 0)),
            referenceNo: bo.payments?.[0]?.reference_no || '',
            depositAmount: parseFloat(bo.payments?.[0]?.deposit_amount) || 0,
            releaseTime: bo.delivery?.release_time || '',
            province: bo.delivery?.province || '',
            city: bo.delivery?.city || '',
            barangay: bo.delivery?.barangay || '',
            zipCode: bo.delivery?.zip_code || '',

            // Status Mapping
            status: mapBackendStatus(bo.status?.status_name),

            createdAt: new Date(bo.created_at || Date.now()),
            updatedAt: new Date(bo.updated_at || bo.created_at || Date.now()),
            transactionDate: new Date(bo.created_at || Date.now()),
            predictedCompletionDate: bo.expected_at ? new Date(bo.expected_at) : undefined,
            actualCompletionDate: bo.released_at ? new Date(bo.released_at) : undefined,

            // Items Mapping - conditions come from 3NF conditions[] array
            items: bo.items?.map((bi: any) => {
                const condNames: string[] = bi.conditions?.map((c: any) => c.condition_name?.toLowerCase()) || [];
                return {
                    id: bi.item_id?.toString() || Math.random().toString(),
                    brand: bi.brand || 'Other',
                    shoeModel: bi.shoe_model || 'Other',
                    shoeMaterial: bi.material || 'Other',
                    quantity: bi.quantity || 1,
                    condition: {
                        scratches:      condNames.includes('scratches'),
                        yellowing:      condNames.includes('yellowing'),
                        ripsHoles:      condNames.includes('ripsholes'),
                        deepStains:     condNames.includes('deepstains'),
                        soleSeparation: condNames.includes('soleseparation'),
                        wornOut:        condNames.includes('wornout'),
                        others: bi.item_notes || ''
                    },
                    inventoryUsed: bi.inventory_used || [],
                    // category is a nested 3NF object: { category_id, category_name }
                    baseService: bi.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'base'
                    ).map((s: any) => s.service_name) || [],
                    addOns: bi.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'addon'
                    ).map((s: any) => ({ name: s.service_name, quantity: 1 })) || []
                };
            }) || [],

            // Fallback fields
            brand: bo.items?.map((i: any) => i.brand).filter(Boolean).join(', ') || 'Unknown',
            shoeModel: firstItem.shoe_model || 'Unknown',
            shoeMaterial: bo.items?.map((i: any) => i.material).filter(Boolean).join(', ') || 'Unknown',
            quantity: bo.items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1,
            condition: bo.items?.[0] ? {
                scratches:      bo.items[0].conditions?.some((c: any) => c.condition_name?.toLowerCase() === 'scratches') || false,
                yellowing:      bo.items[0].conditions?.some((c: any) => c.condition_name?.toLowerCase() === 'yellowing') || false,
                ripsHoles:      bo.items[0].conditions?.some((c: any) => c.condition_name?.toLowerCase() === 'ripsholes') || false,
                deepStains:     bo.items[0].conditions?.some((c: any) => c.condition_name?.toLowerCase() === 'deepstains') || false,
                soleSeparation: bo.items[0].conditions?.some((c: any) => c.condition_name?.toLowerCase() === 'soleseparation') || false,
                wornOut:        bo.items[0].conditions?.some((c: any) => c.condition_name?.toLowerCase() === 'wornout') || false,
                others: bo.items[0].item_notes || ''
            } : {
                scratches: false, yellowing: false, ripsHoles: false,
                deepStains: false, soleSeparation: false, wornOut: false, others: ''
            },
            baseService: Array.from(new Set(
                bo.items?.flatMap((item: any) =>
                    item.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'base'
                    ).map((s: any) => s.service_name) || []
                ) || []
            )),
            addOns: firstItem.services?.filter((s: any) =>
                (s.category?.category_name || s.category) === 'addon'
            ).map((s: any) => ({ name: s.service_name, quantity: 1 })) || [],
            processedBy: bo.processor?.username || 'System',
            inventoryUsed: bo.inventory_used || [],

            statusHistory: bo.status_logs?.map((sl: any) => ({
                status: mapBackendStatus(sl.status?.status_name),
                timestamp: new Date(sl.changed_at),
                user: sl.user?.username || 'System'
            })) || []
        };
    };


    // Initial Load - Hydrate from API with LocalStorage fallback
    useEffect(() => {
        const loadInitialData = async () => {
            // If we have no orders, show blocking loading
            if (orders.length === 0) setLoading(true);
            setRefreshing(true);

            try {
                const response = await fetch(`${API_BASE}/orders`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    const mappedOrders = data.map(mapBackendToFrontend);
                    const finalOrders = mergePendingOrders(mappedOrders);

                    setOrders(finalOrders);
                    localStorage.setItem('jobOrders_v19_cache', JSON.stringify(finalOrders));
                } else {
                    throw new Error('API unreachable');
                }
            } catch (err) {
                console.warn("Retaining cached data due to fetch failure", err);
                if (orders.length === 0) {
                    setOrders(mockJobOrders);
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        };

        loadInitialData();
    }, []);

    // Maps DB status_name to frontend JobStatus type
    // DB values now match frontend: 'new-order', 'on-going', 'for-release', 'claimed', 'cancelled'
    const mapBackendStatus = (statusName: string): any => {
        const map: Record<string, string> = {
            'new-order': 'new-order',
            'on-going': 'on-going',
            'for-release': 'for-release',
            'claimed': 'claimed',
            'cancelled': 'claimed', // fallback - treat cancelled as claimed for display
            // Legacy mappings in case old DB data exists
            'Pending': 'new-order',
            'In Progress': 'on-going',
            'Completed': 'for-release',
            'Claimed': 'claimed',
        };
        return map[statusName] || 'new-order';
    };

    /**
     * @function refreshOrders
     * @description Force-refetches the latest data from the database.
     * Useful for resolving temporary out-of-sync states or confirming optimistic updates.
     */
    const refreshOrders = async () => {
        try {
            const response = await fetch(`${API_BASE}/orders`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const mapped = data.map(mapBackendToFrontend);
                setOrders(mergePendingOrders(mapped));
            }
        } catch (err) {
            console.error('[DEBUG] OrderProvider: Refresh failed.', err);
        }
    };

    // --- OFFLINE AUTO-SYNC QUEUE ---
    const queueSyncTask = (task: any) => {
        if (typeof window === 'undefined') return;
        const queueStr = localStorage.getItem('order_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ ...task, timestamp: Date.now() });
        localStorage.setItem('order_sync_queue', JSON.stringify(queue));
        
        // Notify the user ONLY if it is a connectivity issue
        if (!navigator.onLine) {
            import('sonner').then(({ toast }) => {
                toast.warning('You are offline. Change saved locally and will auto-sync when connection is restored.');
            });
        }
    };

    // Persist to cache whenever orders change
    useEffect(() => {
        if (orders.length > 0) {
            localStorage.setItem('jobOrders_v19_cache', JSON.stringify(orders));
        }
    }, [orders]);

    useEffect(() => {
        const processSyncQueue = async () => {
            if (typeof window === 'undefined' || !navigator.onLine) return;
            const queueStr = localStorage.getItem('order_sync_queue');
            if (!queueStr) return;
            
            try {
                const queue: any[] = JSON.parse(queueStr);
                if (queue.length === 0) return;
                
                // Verify server reachability before showing "Syncing" toast
                const isReachable = await checkBackend(user.token);
                if (!isReachable) {
                    console.warn('[SYNC] Backend unreachable, skipping auto-sync attempt.');
                    return;
                }

                if (syncNotificationShown.current) return;
                syncNotificationShown.current = true;

                const { toast } = await import('sonner');
                const toastId = 'order-sync-toast';
                toast.loading(`Syncing ${queue.length} offline changes...`, { id: toastId });
                
                let hasChanges = false;
                let syncErrorCount = 0;
                const remainingQueue = [];
                
                for (const task of queue) {
                    try {
                        const endpoint = task.type === 'ADD' ? `${API_BASE}/orders` : `${API_BASE}/orders/${parseInt(task.id)}`;
                        const method = task.type === 'ADD' ? 'POST' : 'PUT';
                        
                        if (task.type === 'UPDATE' && isNaN(parseInt(task.id))) {
                             // Defer UPDATEs for temp IDs if they weren't linked just now
                             remainingQueue.push(task);
                             continue;
                        }

                        const response = await fetch(endpoint, {
                            method,
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${user.token}`
                            },
                            body: JSON.stringify(task.payload)
                        });
                        
                        if (response.ok) {
                            hasChanges = true;
                            if (task.type === 'ADD') {
                                const newOrderData = await response.json();
                                const newDbId = newOrderData.order_id?.toString();
                                const tempId = task.payload.id;

                                if (newDbId && tempId) {
                                    queue.forEach(t => {
                                        if (t.id === tempId) t.id = newDbId;
                                    });
                                }
                            }
                        } else {
                            syncErrorCount++;
                            task.status = response.status;
                            remainingQueue.push(task);
                        }
                    } catch (err) {
                        syncErrorCount++;
                        task.status = 500;
                        remainingQueue.push(task);
                    }
                }
                
                localStorage.setItem('order_sync_queue', JSON.stringify(remainingQueue));
                
                if (hasChanges) {
                    toast.success("Offline changes synced successfully!", { id: toastId });
                    syncNotificationShown.current = false;
                    refreshOrders();
                } else if (remainingQueue.length > 0) {
                    // Only show error if we actually tried and failed multiple tasks
                    if (syncErrorCount > 0) {
                        const isAuthError = remainingQueue.some(t => t.status === 401);
                        if (isAuthError) {
                            toast.error(`Session Expired: Please Log Out and Log In again to sync ${remainingQueue.length} items.`, { id: toastId, duration: 5000 });
                        } else {
                            toast.error(`Sync failed for ${remainingQueue.length} items. Check server status.`, { id: toastId });
                        }
                    } else {
                        toast.dismiss(toastId);
                    }
                    syncNotificationShown.current = false;
                } else {
                    toast.dismiss(toastId);
                    syncNotificationShown.current = false;
                }
                
                // Alert user if strictly using local backup database
                const healthRes = await fetch(`${API_BASE}/health-check`).catch(() => null);
                if (healthRes && healthRes.ok) {
                    const healthData = await healthRes.json();
                    if (healthData.database.includes('SQLite')) {
                        const { toast } = await import('sonner');
                        toast.info("Connectivity Note", {
                            description: "The system is currently writing to the local backup database. Remote sync will occur once the cloud connection is stabilized.",
                            duration: 8000
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to process sync queue", err);
            }
        };

        // Try syncing initially, and whenever network status goes "online"
        processSyncQueue();
        window.addEventListener('online', processSyncQueue);
        return () => window.removeEventListener('online', processSyncQueue);
    }, [user.token]);
    // -------------------------------

    const addOrder = async (order: JobOrder) => {
        // OPTIMISTIC UPDATE: Update UI immediately to ensure zero-latency response for the user
        setOrders((prev) => [{ ...order, updatedAt: new Date() }, ...prev]);

        const payload = {
            ...order,
            user_id: user.id
        };

        try {
            const response = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Server Error: Failed to save to database.');
            }

            refreshOrders(); 
        } catch (err: any) {
            console.error('[CRITICAL] OrderProvider: Sync failed.', err);
            
            // Only queue and show 'offline' if it's a network error
            if (!navigator.onLine || err.message.includes('failed to fetch') || err.name === 'TypeError') {
                queueSyncTask({ type: 'ADD', payload });
            } else {
                const { toast } = await import('sonner');
                toast.error("Execution Error", {
                    description: err.message || "The server rejected this order. Check connection or data integrity.",
                    duration: 5000
                });
            }
        }
    };

    const updateOrder = async (id: string, updates: Partial<JobOrder>, statusUser?: string) => {
        // Optimistic Update
        setOrders((prev) => prev.map((order) => {
            if (order.id === id) {
                return { ...order, ...updates, updatedAt: new Date() };
            }
            return order;
        }));

        const payload = { ...updates, updater_id: user.id };

        try {
            const dbId = parseInt(id);
            if (!isNaN(dbId)) {
                const response = await fetch(`${API_BASE}/orders/${dbId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    },
                    body: JSON.stringify(payload)
                });

                // [SAFETY NET] Handle concurrent deletion by another staff member
                if (response.status === 404) {
                    console.warn(`[DEBUG] OrderProvider: Order ${id} not found. Likely deleted.`);
                    const { toast } = await import('sonner');
                    toast.error("Resource Unavailable", {
                        description: "This order needs a 'Full Reglue' (it might have been deleted by another staff member).",
                        duration: 5000
                    });
                    refreshOrders(); // Remove the "ghost" order from UI
                    return;
                }

                if (!response.ok) throw new Error('API update failed');
            } else {
                // If it doesn't have a valid ID yet, it was likely created offline recently
                throw new Error('Unsynced temporary ID');
            }

            // Log Activity
            if (updates.status) {
                addActivity({
                    user: statusUser || 'System',
                    action: 'Status Change',
                    details: `Order ID ${id} moved to "${updates.status.replace('-', ' ')}"`,
                    type: 'order'
                });
            }
        } catch (err) {
            console.error('[DEBUG] OrderProvider: Backend sync pending. Queueing task.', err);
            queueSyncTask({ type: 'UPDATE', id, payload });
        }
    };
    
    const deleteOrder = async (id: string) => {
        // Optimistic Update
        const oldOrders = [...orders];
        setOrders((prev) => prev.filter(o => o.id !== id));
        
        try {
            const dbId = parseInt(id);
            if (!isNaN(dbId)) {
                const response = await fetch(`${API_BASE}/orders/${dbId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (!response.ok) throw new Error('Delete failed');
                
                addActivity({
                    user: user.username,
                    action: 'Delete Order',
                    details: `Deleted order ID ${id}`,
                    type: 'order'
                });
            }
        } catch (err) {
            console.error('[ERROR] OrderProvider: Delete failed.', err);
            setOrders(oldOrders);
            import('sonner').then(({ toast }) => {
                toast.error('Failed to delete order. Restoring logic.');
            });
        }
    };

    const contextValue = useMemo(() => ({
        orders,
        loading,
        refreshing,
        dbStatus,
        addOrder,
        updateOrder,
        deleteOrder,
        refreshOrders
    }), [orders, loading, refreshing, dbStatus, addOrder, updateOrder, deleteOrder, refreshOrders]);

    return (
        <OrderContext.Provider value={contextValue}>
            {children}
        </OrderContext.Provider>
    );
}

export function useOrders() {
    const context = useContext(OrderContext);
    if (context === undefined) {
        throw new Error('useOrders must be used within an OrderProvider');
    }
    return context;
}

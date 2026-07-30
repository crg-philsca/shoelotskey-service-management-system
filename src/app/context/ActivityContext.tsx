import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { format as dateFnsFormat } from 'date-fns';

export interface ActivityLog {
    id: string;
    timestamp: string;
    user: string;
    role?: string;
    module?: string;
    ip_address?: string;
    user_agent?: string;
    action: string;
    table?: string;
    recordId?: number | string;
    details: string;
    oldValues?: any;
    newValues?: any;
    type: 'service' | 'order' | 'system' | 'expense' | 'inventory' | 'critical' | string;
}

const DEFAULT_SEED_LOGS: ActivityLog[] = [
    {
        id: '104',
        timestamp: '07/27/2026, 14:45',
        user: 'Owner',
        action: 'Deleted Inventory Item',
        table: 'Inventory',
        recordId: '12',
        details: 'Deleted inventory item #12 (Expired Sole Adhesive Paste) from stock records',
        type: 'inventory',
        oldValues: { itemName: 'Expired Sole Adhesive Paste', category: 'Chemicals', stockQuantity: 0, unitPrice: 250.00 },
        newValues: null
    },
    {
        id: '103',
        timestamp: '07/27/2026, 11:00',
        user: 'Staff B',
        action: 'Changed Order Status to "On-going"',
        table: 'Orders',
        recordId: '101',
        details: 'Changed status of Job Order #ORD-2026-07-27-101 from New Order to On-going',
        type: 'order',
        oldValues: { orderNumber: 'ORD-2026-07-27-101', status: 'New Order' },
        newValues: { orderNumber: 'ORD-2026-07-27-101', status: 'On-going', updatedBy: 'Staff B' }
    },
    {
        id: '102',
        timestamp: '07/27/2026, 10:30',
        user: 'Owner',
        action: 'Updated Service Price',
        table: 'Services',
        recordId: '5',
        details: 'Updated price for Deep Cleaning & Reglue service from ₱300.00 to ₱325.00',
        type: 'service',
        oldValues: { serviceName: 'Deep Cleaning & Reglue', price: 300.00, durationDays: 10 },
        newValues: { serviceName: 'Deep Cleaning & Reglue', price: 325.00, durationDays: 10 }
    },
    {
        id: '101',
        timestamp: '07/27/2026, 09:15',
        user: 'Staff A',
        action: 'Created Job Order #102',
        table: 'Orders',
        recordId: '102',
        details: 'Created Job Order #ORD-2026-07-27-102 with 1 Pair (Nike Air Force 1)',
        type: 'order',
        oldValues: null,
        newValues: { orderNumber: 'ORD-2026-07-27-102', customerName: 'Juan Dela Cruz', totalAmount: 450.00, status: 'New Order' }
    }
];

interface ActivityContextType {
    activities: ActivityLog[];
    addActivity: (activity: Omit<ActivityLog, 'id' | 'timestamp'> & { table?: string; recordId?: number | string; oldValues?: any; newValues?: any }) => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

/**
 * CONTEXT: ActivityProvider
 * PURPOSE: Manages the Audit Trail (System Logs).
 * PERSISTENCE: Syncs with Backend API (/api/activities).
 * FALLBACK: Uses localStorage if backend is unreachable.
 */
const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173'))
    ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:8000/api`
    : '/api';

export function ActivityProvider({ children, user }: { children: ReactNode, user: { token: string } }) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);

    /**
     * EFFECT: Initial Sync
     * Pulls system logs from backend or local storage.
     */
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                console.log('[DEBUG] ActivityContext: Fetching system logs...');
                const res = await fetch(`${API_BASE}/activities`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
                const data = await res.json();
                const logList = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
                if (logList.length > 0) {
                    const formatted = logList.map((d: any) => ({
                        ...d,
                        table: d.table || (d.type === 'service' ? 'Services' : d.type === 'inventory' ? 'Inventory' : d.type === 'expense' ? 'Expenses' : d.type === 'system' ? 'Users' : 'Orders'),
                        module: d.module || (d.type === 'service' ? 'Services' : d.type === 'inventory' ? 'Inventory' : d.type === 'expense' ? 'Expenses' : d.type === 'system' ? 'User Management' : 'Job Orders'),
                        role: d.role || (d.user === 'Owner' ? 'owner' : 'staff')
                    }));
                    setActivities(formatted);
                    localStorage.setItem('shoelotskey_activities', JSON.stringify(formatted));
                } else {
                    setActivities(DEFAULT_SEED_LOGS);
                }
            } catch (err) {
                console.warn("[DEBUG] ActivityContext: Backend unreachable. Using local cache or seed logs.", err);
                try {
                    const saved = localStorage.getItem('shoelotskey_activities');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        setActivities(parsed.length > 0 ? parsed : DEFAULT_SEED_LOGS);
                    } else {
                        setActivities(DEFAULT_SEED_LOGS);
                    }
                } catch (parseErr) {
                    setActivities(DEFAULT_SEED_LOGS);
                }
            }
        };
        // --- OFFLINE AUTO-SYNC logic ---
        const processSyncQueue = async () => {
            if (typeof window === 'undefined' || !navigator.onLine) return;
            const queueStr = localStorage.getItem('activity_sync_queue');
            if (!queueStr) return;
            try {
                const queue: any[] = JSON.parse(queueStr);
                if (queue.length === 0) return;
                
                let remainingQueue = [];
                let hasChanges = false;
                for (const task of queue) {
                    try {
                        const res = await fetch(`${API_BASE}/activities`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${user.token}`
                            },
                            body: JSON.stringify(task)
                        });
                        if (!res.ok) throw new Error('Offline sync item failed');
                        hasChanges = true;
                    } catch (syncErr) {
                        remainingQueue.push(task);
                    }
                }
                if (hasChanges || remainingQueue.length !== queue.length) {
                    localStorage.setItem('activity_sync_queue', JSON.stringify(remainingQueue));
                    console.log(`[SYNC] Processed activity sync queue. ${remainingQueue.length} remaining.`);
                }
            } catch (err) {
                console.warn("[SYNC ERROR] Failed to process offline activity queue:", err);
            }
        };

        fetchLogs();
        processSyncQueue();
        const syncInterval = setInterval(processSyncQueue, 30000); // Check every 30s
        return () => clearInterval(syncInterval);
    }, [user.token]);

    const queueActivitySync = (activity: ActivityLog) => {
        if (typeof window === 'undefined') return;
        const queueStr = localStorage.getItem('activity_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ payload: activity, timestamp: Date.now() });
        localStorage.setItem('activity_sync_queue', JSON.stringify(queue));
    };

    /**
     * DISPATCHER: Add Activity
     */
    const addActivity = async (activity: Omit<ActivityLog, 'id' | 'timestamp'> & { table?: string; recordId?: number | string; oldValues?: any; newValues?: any }) => {
        console.log('[DEBUG] ActivityContext: Dispatching activity record...', activity.action);
        const timestamp = dateFnsFormat(new Date(), 'MM/dd/yyyy, HH:mm');
        const defaultRole = (activity.user && activity.user.toLowerCase() === 'owner') ? 'owner' : 'staff';
        const defaultModule = activity.module || (activity.type === 'service' ? 'Services' : activity.type === 'inventory' ? 'Inventory' : activity.type === 'expense' ? 'Expenses' : activity.type === 'system' ? 'User Management' : 'Job Orders');

        const newActivity: ActivityLog = {
            ...activity,
            role: activity.role || defaultRole,
            module: defaultModule,
            table: activity.table || (activity.type === 'service' ? 'Services' : activity.type === 'inventory' ? 'Inventory' : activity.type === 'expense' ? 'Expenses' : activity.type === 'system' ? 'Users' : 'Orders'),
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp,
        };

        try {
            const res = await fetch(`${API_BASE}/activities`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(newActivity)
            });

            if (res.ok) {
                const savedData = await res.json();
                setActivities(prev => [{ ...newActivity, id: String(savedData.id || newActivity.id) }, ...prev]);
            } else {
                throw new Error('Backend failed to save activity');
            }
        } catch (err) {
            /** 
             * ERROR HANDLING: Persistence Fallback
             * If the backend is down, we still show the activity in the UI but 
             * store current session logs in localStorage until the next sync.
             */
            console.warn("[DEBUG] ActivityContext: Failed to sync activity with backend. Queuing for online sync.", err);
            setActivities(prev => [newActivity, ...prev]);

            localStorage.setItem('shoelotskey_activities', JSON.stringify([newActivity, ...activities].slice(0, 100)));
            queueActivitySync(newActivity);
        }
    };

    const contextValue = useMemo(() => ({ activities, addActivity }), [activities, addActivity]);

    return (
        <ActivityContext.Provider value={contextValue}>
            {children}
        </ActivityContext.Provider>
    );
}

export function useActivities() {
    const context = useContext(ActivityContext);
    if (context === undefined) {
        throw new Error('useActivities must be used within an ActivityProvider');
    }
    return context;
}

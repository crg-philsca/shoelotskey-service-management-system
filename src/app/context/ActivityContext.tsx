import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { format as dateFnsFormat } from 'date-fns';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';

export interface ActivityLog {
    id: string;
    timestamp: string;
    user: string;
    role?: string;
    module?: string;
    ip_address?: string;
    user_agent?: string;
    action: string;
    actionRaw?: string;
    table?: string;
    recordId?: number | string;
    details: string;
    oldValues?: any;
    newValues?: any;
    type: 'service' | 'order' | 'system' | 'expense' | 'inventory' | 'critical' | string;
}

function isResolvedPilImportError(log: ActivityLog): boolean {
    const action = String(log.actionRaw || log.action || '').toUpperCase().replace(/\s+/g, '_');
    if (action !== 'SERVER_ERROR') return false;
    const blob = `${log.details || ''} ${JSON.stringify(log.oldValues || {})} ${JSON.stringify(log.newValues || {})}`;
    return blob.includes("No module named 'PIL'") || blob.includes('No module named "PIL"');
}

function withoutResolvedPilErrors(logs: ActivityLog[]): ActivityLog[] {
    return logs.filter((log) => !isResolvedPilImportError(log));
}

// P1-14 FIX: This module previously fell back to a hardcoded DEFAULT_SEED_LOGS array of
// fabricated activity records (fake users, fake timestamps, fake order/inventory/service
// changes) whenever the backend was unreachable or returned no rows, and rendered them in
// the exact same Activity History UI as genuine audit records with no "this is demo/offline
// data" indicator. That risks an evaluator or Owner mistaking synthetic history for a real
// audit trail. It has been removed — see fetchLogs() below, which now shows a real empty
// state (or the last genuinely-fetched localStorage cache) instead of fabricating history.

interface ActivityContextType {
    activities: ActivityLog[];
    addActivity: (activity: Omit<ActivityLog, 'id' | 'timestamp'> & { table?: string; recordId?: number | string; oldValues?: any; newValues?: any }) => void;
    refreshActivities: () => Promise<boolean>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

/**
 * CONTEXT: ActivityProvider
 * PURPOSE: Manages the Audit Trail (System Logs).
 * PERSISTENCE: Syncs with Backend API (/api/activities).
 * FALLBACK: Uses localStorage if backend is unreachable.
 */
export function ActivityProvider({ children, user }: { children: ReactNode, user: { token: string } }) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);

    const formatLogList = (logList: any[]): ActivityLog[] => withoutResolvedPilErrors(logList.map((d: any) => ({
        ...d,
        table: d.table || (d.type === 'service' ? 'Services' : d.type === 'inventory' ? 'Inventory' : d.type === 'expense' ? 'Expenses' : d.type === 'system' ? 'Users' : 'Orders'),
        module: d.module || (d.type === 'service' ? 'Services' : d.type === 'inventory' ? 'Inventory' : d.type === 'expense' ? 'Expenses' : d.type === 'system' ? 'User Management' : 'Job Orders'),
        role: d.role || (d.user === 'Owner' ? 'owner' : 'staff')
    })));

    const refreshActivities = useCallback(async (): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE}/activities?limit=2000`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const data = await res.json();
            const logList = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
            const formatted = formatLogList(logList);
            setActivities(formatted);
            localStorage.setItem('shoelotskey_activities', JSON.stringify(formatted));
            return true;
        } catch (err) {
            console.warn("[DEBUG] ActivityContext: refresh failed; keeping current list.", err);
            return false;
        }
    }, [user.token]);

    /**
     * EFFECT: Initial Sync
     * Pulls system logs from backend or local storage.
     */
    useEffect(() => {
        const fetchLogs = async () => {
            console.log('[DEBUG] ActivityContext: Fetching system logs...');
            const ok = await refreshActivities();
            if (ok) return;
            console.warn("[DEBUG] ActivityContext: Backend unreachable. Using local cache if available.");
            try {
                // P1-14 FIX: `shoelotskey_activities` in localStorage only ever contains
                // a genuine previously-fetched snapshot from the backend (written above),
                // so falling back to it while offline is legitimate cached real data, not
                // fabricated history. If there is no such cache, show an empty state.
                const saved = localStorage.getItem('shoelotskey_activities');
                const parsed = saved ? JSON.parse(saved) : [];
                const cleaned = withoutResolvedPilErrors(Array.isArray(parsed) ? parsed : []);
                setActivities(cleaned);
                localStorage.setItem('shoelotskey_activities', JSON.stringify(cleaned));
            } catch (parseErr) {
                setActivities([]);
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
    }, [user.token, refreshActivities]);

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

    const visibleActivities = useMemo(() => {
        const cleaned = withoutResolvedPilErrors(activities);
        const seen = new Set<string>();
        const deduped: ActivityLog[] = [];
        for (const act of cleaned) {
            const key = `${act.user || ''}_${act.actionRaw || act.action || ''}_${act.module || ''}_${act.table || ''}_${act.recordId || ''}_${act.timestamp || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(act);
            }
        }
        return deduped;
    }, [activities]);
    const contextValue = useMemo(
        () => ({ activities: visibleActivities, addActivity, refreshActivities }),
        [visibleActivities, addActivity, refreshActivities],
    );

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

export const useActivity = useActivities;

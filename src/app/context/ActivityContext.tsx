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

function isOwnerHiddenActivity(log: ActivityLog): boolean {
    const actionRaw = String(log.actionRaw || log.action || '').toUpperCase().replace(/\s+/g, '_');
    if (actionRaw === 'SERVER_ERROR' || actionRaw === 'JOB_ORDER_RETRIEVED') return true;
    if (actionRaw.includes('SERVER_ERROR') || actionRaw.includes('SERVER ERROR')) return true;
    if (actionRaw.includes('TELEMETRY') || actionRaw.includes('BENCHMARK')) return true;
    if (String(log.table || '').toLowerCase() === 'backend_v2') return true;
    const mod = String(log.module || '').toUpperCase();
    if (mod === 'SYSTEM TELEMETRY' || mod.includes('TELEMETRY') || mod.includes('BENCHMARK')) return true;
    const act = String(log.action || '').toUpperCase();
    if (act.includes('SERVER ERROR')) return true;
    const det = String(log.details || '').toLowerCase();
    if (det.startsWith('server error') || det.includes('server error during')) return true;
    return false;
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
    addActivity: (activity: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string; table?: string; recordId?: number | string; oldValues?: any; newValues?: any }) => void;
    refreshActivities: (limit?: number) => Promise<boolean>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

/**
 * CONTEXT: ActivityProvider
 * PURPOSE: Manages the Audit Trail (System Logs).
 * PERSISTENCE: Syncs with Backend API (/api/activities).
 * FALLBACK: Uses localStorage if backend is unreachable.
 */
export function ActivityProvider({ children, user }: { children: ReactNode, user: { token: string; role?: string } }) {
    const isOwner = (() => {
        const role = (user.role || '').toLowerCase();
        if (role === 'owner') return true;
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            const r = (u.role || '').toLowerCase();
            const uname = (u.username || '').toLowerCase();
            return r === 'owner' || uname === 'owner';
        } catch {
            return false;
        }
    })();

    const [activities, setActivities] = useState<ActivityLog[]>(() => {
        try {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('shoelotskey_activities') : null;
            if (saved) {
                const parsed = JSON.parse(saved);
                let logs = withoutResolvedPilErrors(Array.isArray(parsed) ? parsed : []);
                if (isOwner) {
                    logs = logs.filter((log) => !isOwnerHiddenActivity(log));
                }
                return logs;
            }
        } catch {}
        return [];
    });

    const normalizeRole = (role?: string, u?: string): string => {
        const r = (role || '').toLowerCase();
        const usr = (u || '').toLowerCase();
        if (r === 'admin' || usr === 'admin' || r === 'system' || usr === 'system') return 'System';
        if (r === 'owner' || usr === 'owner') return 'owner';
        return r || (usr === 'owner' ? 'owner' : 'staff');
    };

    const formatLogList = (logList: any[]): ActivityLog[] => {
        let logs = withoutResolvedPilErrors(logList.map((d: any) => ({
            ...d,
            table: d.table || (d.type === 'service' ? 'Services' : d.type === 'inventory' ? 'Inventory' : d.type === 'expense' ? 'Expenses' : d.type === 'system' ? 'Users' : 'Orders'),
            module: d.module || (d.type === 'service' ? 'Services' : d.type === 'inventory' ? 'Inventory' : d.type === 'expense' ? 'Expenses' : d.type === 'system' ? 'User Management' : 'Job Orders'),
            role: normalizeRole(d.role, d.user)
        })));
        if (isOwner) {
            logs = logs.filter((log) => !isOwnerHiddenActivity(log));
        }
        return logs;
    };

    const refreshActivities = useCallback(async (limit: number = 100): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE}/activities?limit=${limit}`, {
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
        let isMounted = true;
        const isJobOrderForm = typeof window !== 'undefined' && window.location.pathname.startsWith('/job-order-form');
        if (isJobOrderForm) {
            // Job Order Form never displays audit logs; skip heavy 122KB fetch on page load
            return;
        }

        const fetchLogs = async () => {
            console.log('[DEBUG] ActivityContext: Fetching system logs...');
            const ok = await refreshActivities();
            if (ok || !isMounted) return;
            console.warn("[DEBUG] ActivityContext: Backend unreachable. Using local cache if available.");
            try {
                const saved = localStorage.getItem('shoelotskey_activities');
                const parsed = saved ? JSON.parse(saved) : [];
                let cleaned = withoutResolvedPilErrors(Array.isArray(parsed) ? parsed : []);
                if (isOwner) {
                    cleaned = cleaned.filter((log) => !isOwnerHiddenActivity(log));
                }
                setActivities(cleaned);
                localStorage.setItem('shoelotskey_activities', JSON.stringify(cleaned));
            } catch (parseErr) {
                setActivities([]);
            }
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const idleId = (window as any).requestIdleCallback(() => {
                if (isMounted) fetchLogs();
            }, { timeout: 2000 });
            return () => {
                isMounted = false;
                (window as any).cancelIdleCallback(idleId);
            };
        } else {
            const timer = setTimeout(() => {
                if (isMounted) fetchLogs();
            }, 800);
            return () => {
                isMounted = false;
                clearTimeout(timer);
            };
        }

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
    const addActivity = async (activity: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string; table?: string; recordId?: number | string; oldValues?: any; newValues?: any }) => {
        console.log('[DEBUG] ActivityContext: Dispatching activity record...', activity.action);
        const timestamp = activity.timestamp || dateFnsFormat(new Date(), 'MM/dd/yyyy, HH:mm');
        const defaultRole = (activity.user && (activity.user.toLowerCase() === 'admin' || activity.user.toLowerCase() === 'system')) ? 'System' : ((activity.user && activity.user.toLowerCase() === 'owner') ? 'owner' : 'staff');
        const defaultModule = activity.module || (activity.type === 'service' ? 'Services' : activity.type === 'inventory' ? 'Inventory' : activity.type === 'expense' ? 'Expenses' : activity.type === 'system' ? 'User Management' : 'Job Orders');

        const newActivity: ActivityLog = {
            ...activity,
            role: normalizeRole(activity.role || defaultRole, activity.user),
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
        let cleaned = withoutResolvedPilErrors(activities);
        if (isOwner) {
            cleaned = cleaned.filter((log) => !isOwnerHiddenActivity(log));
        }
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
    }, [activities, isOwner]);
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

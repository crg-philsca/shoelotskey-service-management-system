import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { format as dateFnsFormat } from 'date-fns';

export interface ActivityLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    details: string;
    type: 'service' | 'order' | 'system' | 'expense' | 'critical';
}

interface ActivityContextType {
    activities: ActivityLog[];
    addActivity: (activity: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
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
     * Pulls the last 50+ logs from MySQL via FastAPI.
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
                if (Array.isArray(data)) {
                    setActivities(data.reverse());
                    localStorage.setItem('shoelotskey_activities', JSON.stringify(data));
                    console.log('[DEBUG] ActivityContext: Loaded', data.length, 'logs from DB.');
                }
            } catch (err) {
                console.warn("[DEBUG] ActivityContext: Backend unreachable. Using local cache.", err);
                try {
                    const saved = localStorage.getItem('shoelotskey_activities');
                    if (saved) {
                        setActivities(JSON.parse(saved));
                    }
                } catch (parseErr) {
                    console.error("[DEBUG] ActivityContext: Local cache corrupted.", parseErr);
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
                            body: JSON.stringify(task.payload)
                        });
                        if (!res.ok) throw new Error('Sync failed');
                        hasChanges = true;
                    } catch (err) {
                        remainingQueue.push(task);
                    }
                }
                localStorage.setItem('activity_sync_queue', JSON.stringify(remainingQueue));
                if (hasChanges && process.env.NODE_ENV !== 'production') {
                    console.log('[DEBUG] ActivityContext: Offline queue synced.');
                }
            } catch (e) {
                console.error("Failed to parse activity sync queue", e);
            }
        };

        processSyncQueue();
        window.addEventListener('online', processSyncQueue);
        
        fetchLogs();
        
        return () => window.removeEventListener('online', processSyncQueue);
    }, []);

    const queueActivitySync = (activity: ActivityLog) => {
        if (typeof window === 'undefined') return;
        const queueStr = localStorage.getItem('activity_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ payload: activity, timestamp: Date.now() });
        localStorage.setItem('activity_sync_queue', JSON.stringify(queue));
    };

    /**
     * HANDLER: addActivity
     * Logic: 1. Locally generate entry -> 2. Push to Backend -> 3. Update State
     */
    const addActivity = async (activity: Omit<ActivityLog, 'id' | 'timestamp'>) => {
        const timestamp = dateFnsFormat(new Date(), 'MM/dd/yyyy, HH:mm');


        const newActivity: ActivityLog = {
            ...activity,
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
                setActivities(prev => [savedData, ...prev]);
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

    return (
        <ActivityContext.Provider value={{ activities, addActivity }}>
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

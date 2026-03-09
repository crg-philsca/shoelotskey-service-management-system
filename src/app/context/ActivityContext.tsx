import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { format as dateFnsFormat } from 'date-fns';

export interface ActivityLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    details: string;
    type: 'service' | 'order' | 'system' | 'expense';
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
export function ActivityProvider({ children }: { children: ReactNode }) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);

    /**
     * EFFECT: Initial Sync
     * Pulls the last 50+ logs from MySQL via FastAPI.
     */
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                console.log('[DEBUG] ActivityContext: Fetching system logs...');
                const res = await fetch('http://localhost:8000/api/activities');
                if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

                const data = await res.json();
                if (Array.isArray(data)) {
                    // LOGIC: Reverse chronological sort for immediate 'latest-first' viewing in UI
                    setActivities(data.reverse());
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
        fetchLogs();
    }, []);

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
            const res = await fetch('http://localhost:8000/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            console.warn("[DEBUG] ActivityContext: Failed to sync activity with backend. Saving locally.", err);
            setActivities(prev => [newActivity, ...prev]);

            localStorage.setItem('shoelotskey_activities', JSON.stringify([newActivity, ...activities].slice(0, 100)));
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

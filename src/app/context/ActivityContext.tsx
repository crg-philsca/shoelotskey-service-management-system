import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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

export function ActivityProvider({ children }: { children: ReactNode }) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/activities')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Reverse to show newest first, assuming DB returns in insert order
                    setActivities(data.reverse());
                }
            })
            .catch(err => {
                console.error("Failed to fetch activities from backend", err);
                const saved = localStorage.getItem('shoelotskey_activities');
                if (saved) setActivities(JSON.parse(saved));
            });
    }, []);

    const addActivity = (activity: Omit<ActivityLog, 'id' | 'timestamp'>) => {
        const timestamp = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const newActivity: ActivityLog = {
            ...activity,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp,
        };

        fetch('http://127.0.0.1:8000/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newActivity)
        })
            .then(res => res.json())
            .then(data => {
                setActivities(prev => [data, ...prev]);
            })
            .catch(err => {
                console.error(err);
                setActivities(prev => [newActivity, ...prev]); // Fallback
            });
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

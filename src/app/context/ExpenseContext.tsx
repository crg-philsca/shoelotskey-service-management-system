import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Expense } from '@/app/lib/mockData';
import { useActivities } from './ActivityContext';

interface ExpenseContextType {
    expenses: Expense[];
    addExpense: (expense: Expense) => void;
    updateExpense: (id: string, expense: Partial<Expense>) => void;
    removeExpense: (id: string) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173'))
    ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:8000/api`
    : '/api';

export function ExpenseProvider({ children, user }: { children: ReactNode, user: { token: string } }) {
    const { addActivity } = useActivities();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{"username": "System"}').username;

    const [expenses, setExpenses] = useState<Expense[]>([]);

    // --- OFFLINE AUTO-SYNC logic ---
    const queueExpenseSync = (expense: Expense) => {
        if (typeof window === 'undefined') return;
        const queueStr = localStorage.getItem('expense_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ payload: expense, timestamp: Date.now() });
        localStorage.setItem('expense_sync_queue', JSON.stringify(queue));
    };

    useEffect(() => {
        const processSyncQueue = async () => {
            if (typeof window === 'undefined' || !navigator.onLine) return;
            const queueStr = localStorage.getItem('expense_sync_queue');
            if (!queueStr) return;
            
            try {
                const queue: any[] = JSON.parse(queueStr);
                if (queue.length === 0) return;
                
                let remainingQueue = [];
                let hasChanges = false;
                for (const task of queue) {
                    try {
                        const res = await fetch(`${API_BASE}/expenses`, {
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
                localStorage.setItem('expense_sync_queue', JSON.stringify(remainingQueue));
                
                if (hasChanges) {
                    // Refetch to get real db ids
                    const refetch = await fetch(`${API_BASE}/expenses`, {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    const data = await refetch.json();
                    if (Array.isArray(data)) {
                        const mappedData = data.map((item: any) => {
                            const parts = (item.description || '').split(' || ');
                            return {
                                id: item.expense_id || item.id,
                                amount: item.amount,
                                category: parts[0] || 'Misc Expense',
                                notes: parts[1] || '',
                                date: item.expense_date || item.date
                            };
                        });
                        mappedData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        setExpenses(mappedData);
                    }
                }
            } catch (e) {
                console.error("Failed to parse expense sync queue", e);
            }
        };

        const initialFetch = () => {
            // First load from cache for instant feedback
            const cache = localStorage.getItem('expense_data_cache');
            if (cache) {
                try {
                    setExpenses(JSON.parse(cache));
                } catch(e) {}
            }

            fetch(`${API_BASE}/expenses`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        const mappedData = data.map((item: any) => {
                            const parts = (item.description || '').split(' || ');
                            return {
                                id: item.expense_id || item.id,
                                amount: item.amount,
                                category: parts[0] || 'Misc Expense',
                                notes: parts[1] || '',
                                date: item.expense_date || item.date
                            };
                        });
                        mappedData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        setExpenses(mappedData);
                        localStorage.setItem('expense_data_cache', JSON.stringify(mappedData));
                    }
                })
                .catch(err => {
                    console.error("Expense fetch failed. Keeping cached data.", err);
                });
        };

        initialFetch();
        processSyncQueue();
        window.addEventListener('online', processSyncQueue);
        return () => window.removeEventListener('online', processSyncQueue);
    }, []);

    const addExpense = (expense: Expense) => {
        fetch(`${API_BASE}/expenses`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify(expense)
        })
            .then(res => res.json())
            .then(data => {
                const parts = (data.description || '').split(' || ');
                const mappedAdded = {
                    id: data.expense_id || data.id,
                    amount: Number(data.amount),
                    category: parts[0] || expense.category || 'Misc Expense',
                    notes: parts[1] || expense.notes || '',
                    date: data.expense_date || data.date
                };
                setExpenses((prev) => [mappedAdded, ...prev]);
                addActivity({
                    user: currentUser,
                    action: 'Add Expense',
                    details: `Logged new expense: ${mappedAdded.category} - ${mappedAdded.amount}`,
                    type: 'expense'
                });
            })
            .catch(err => {
                console.error("Expense backend sync failed, queueing offline sync.", err);
                // Fallback for offline mode
                setExpenses((prev) => [expense, ...prev]);
                queueExpenseSync(expense);
            });
    };

    const updateExpense = (id: string, updatedFields: Partial<Expense>) => {
        fetch(`${API_BASE}/expenses/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify(updatedFields)
        })
            .then(res => {
                if (!res.ok) throw new Error('Update failed');
                return res.json();
            })
            .then(() => {
                setExpenses(prev => prev.map(exp => {
                    if (String(exp.id) === String(id)) {
                        return { ...exp, ...updatedFields };
                    }
                    return exp;
                }));
                addActivity({
                    user: currentUser,
                    action: 'Update Expense',
                    details: `Updated expense record ID: ${id}`,
                    type: 'expense'
                });
            })
            .catch(err => {
                console.error("Expense update failed.", err);
                // Optimistic UI fallback
                setExpenses(prev => prev.map(exp => {
                    if (String(exp.id) === String(id)) {
                        return { ...exp, ...updatedFields };
                    }
                    return exp;
                }));
            });
    };

    const removeExpense = (id: string) => {
        fetch(`${API_BASE}/expenses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${user.token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error('Delete failed');
                setExpenses(prev => prev.filter(exp => String(exp.id) !== String(id)));
                addActivity({
                    user: currentUser,
                    action: 'Delete Expense',
                    details: `Deleted expense record ID: ${id}`,
                    type: 'expense'
                });
            })
            .catch(err => {
                console.error("Expense delete failed.", err);
                // Optimistic UI fallback
                setExpenses(prev => prev.filter(exp => String(exp.id) !== String(id)));
            });
    };

    return (
        <ExpenseContext.Provider value={{ expenses, addExpense, updateExpense, removeExpense }}>
            {children}
        </ExpenseContext.Provider>
    );
}

export function useExpenses() {
    const context = useContext(ExpenseContext);
    if (context === undefined) {
        throw new Error('useExpenses must be used within an ExpenseProvider');
    }
    return context;
}

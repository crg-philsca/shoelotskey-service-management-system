import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Expense, mockExpenses } from '@/app/lib/mockData';
import { useActivities } from './ActivityContext';

interface ExpenseContextType {
    expenses: Expense[];
    addExpense: (expense: Expense) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export function ExpenseProvider({ children }: { children: ReactNode }) {
    const { addActivity } = useActivities();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{"username": "System"}').username;

    const [expenses, setExpenses] = useState<Expense[]>([]);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/expenses')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // sort by date descending to match original behavior
                    data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setExpenses(data);
                }
            })
            .catch(err => {
                console.error("Failed to fetch expenses from backend, falling back to mock", err);
                setExpenses(mockExpenses);
            });
    }, []);

    const addExpense = (expense: Expense) => {
        fetch('http://127.0.0.1:8000/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expense)
        })
            .then(res => res.json())
            .then(data => {
                setExpenses((prev) => [data, ...prev]);
                addActivity({
                    user: currentUser,
                    action: 'Add Expense',
                    details: `Logged new expense: ${data.category} - ${data.amount}`,
                    type: 'expense'
                });
            })
            .catch(err => {
                console.error(err);
                // Fallback for offline mode
                setExpenses((prev) => [expense, ...prev]);
            });
    };

    return (
        <ExpenseContext.Provider value={{ expenses, addExpense }}>
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

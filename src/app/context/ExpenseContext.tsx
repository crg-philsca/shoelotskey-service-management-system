import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Expense, mockExpenses } from '@/app/lib/mockData';

interface ExpenseContextType {
    expenses: Expense[];
    addExpense: (expense: Expense) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export function ExpenseProvider({ children }: { children: ReactNode }) {
    const [expenses, setExpenses] = useState<Expense[]>(() => {
        const saved = localStorage.getItem('expenses');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.map((exp: any) => ({
                ...exp,
                date: new Date(exp.date).toISOString() // Keeping it as ISO string as per original type but ensuring it's valid
            }));
        }
        return mockExpenses;
    });

    useEffect(() => {
        localStorage.setItem('expenses', JSON.stringify(expenses));
    }, [expenses]);

    const addExpense = (expense: Expense) => {
        setExpenses((prev) => [expense, ...prev]);
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

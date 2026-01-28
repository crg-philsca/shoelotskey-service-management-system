import { createContext, useContext, useState, ReactNode } from 'react';
import { Expense, mockExpenses } from '@/app/lib/mockData';

interface ExpenseContextType {
    expenses: Expense[];
    addExpense: (expense: Expense) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export function ExpenseProvider({ children }: { children: ReactNode }) {
    const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);

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

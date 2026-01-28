import { createContext, useContext, useState, ReactNode } from 'react';
import { JobOrder } from '@/app/types';
import { mockJobOrders } from '@/app/lib/mockData';

interface OrderContextType {
    orders: JobOrder[];
    addOrder: (order: JobOrder) => void;
    updateOrder: (id: string, updates: Partial<JobOrder>, statusUser?: string) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
    // Initialize with mock data
    const [orders, setOrders] = useState<JobOrder[]>(mockJobOrders);

    const addOrder = (order: JobOrder) => {
        setOrders((prev) => [order, ...prev]);
    };

    const updateOrder = (id: string, updates: Partial<JobOrder>, statusUser?: string) => {
        setOrders((prev) => prev.map((order) => {
            if (order.id === id) {
                const newOrder = { ...order, ...updates };
                // Automatically add to status history if status is explicitly updated
                if (updates.status && updates.status !== order.status) {
                    newOrder.statusHistory = [
                        ...(order.statusHistory || []),
                        {
                            status: updates.status,
                            timestamp: new Date(),
                            user: statusUser || 'System'
                        }
                    ];
                }
                return newOrder;
            }
            return order;
        }));
    };

    return (
        <OrderContext.Provider value={{ orders, addOrder, updateOrder }}>
            {children}
        </OrderContext.Provider>
    );
}

export function useOrders() {
    const context = useContext(OrderContext);
    if (context === undefined) {
        throw new Error('useOrders must be used within an OrderProvider');
    }
    return context;
}

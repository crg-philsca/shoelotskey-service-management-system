import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { JobOrder } from '@/app/types';
import { mockJobOrders } from '@/app/lib/mockData';
import { useActivities } from './ActivityContext';

interface OrderContextType {
    orders: JobOrder[];
    addOrder: (order: JobOrder) => void;
    updateOrder: (id: string, updates: Partial<JobOrder>, statusUser?: string) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
    const { addActivity } = useActivities();
    // Initialize with saved data or mock data
    const [orders, setOrders] = useState<JobOrder[]>(() => {
        const saved = localStorage.getItem('jobOrders_v19');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.map((order: any) => ({
                ...order,
                createdAt: new Date(order.createdAt),
                updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined,
                transactionDate: order.transactionDate ? new Date(order.transactionDate) : undefined,
                predictedCompletionDate: order.predictedCompletionDate ? new Date(order.predictedCompletionDate) : undefined,
                actualCompletionDate: order.actualCompletionDate ? new Date(order.actualCompletionDate) : undefined,
                statusHistory: order.statusHistory?.map((h: any) => ({
                    ...h,
                    timestamp: new Date(h.timestamp)
                }))
            }));
        }
        return mockJobOrders;
    });

    // Persist to localStorage whenever orders change
    useEffect(() => {
        localStorage.setItem('jobOrders_v19', JSON.stringify(orders));
    }, [orders]);

    const addOrder = (order: JobOrder) => {
        setOrders((prev) => [{ ...order, updatedAt: new Date() }, ...prev]);

        // Log activity (but maybe skipped if JobOrderFormComponent already does it)
        // We'll log it if we didn't add the addActivity call inside form
    };

    const updateOrder = (id: string, updates: Partial<JobOrder>, statusUser?: string) => {
        setOrders((prev) => prev.map((order) => {
            if (order.id === id) {
                // Create the updated order object
                // We ensure updatedAt is set to now to move it to the top of lists
                const newOrder = { ...order, ...updates, updatedAt: new Date() };

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
                    addActivity({
                        user: statusUser || 'System',
                        action: 'Status Change',
                        details: `Order #${order.orderNumber} moved to "${updates.status.replace('-', ' ')}"`,
                        type: 'order'
                    });
                } else if (updates && !updates.status) {
                    addActivity({
                        user: statusUser || 'System',
                        action: 'Order Updated',
                        details: `Updated details for Order #${order.orderNumber}`,
                        type: 'order'
                    });
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

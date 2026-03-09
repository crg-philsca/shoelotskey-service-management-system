import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { JobOrder } from '@/app/types';
import { mockJobOrders } from '@/app/lib/mockData';
import { useActivities } from './ActivityContext';

// Backend API Base URL
const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:8000/api'
    : '/api';

interface OrderContextType {
    orders: JobOrder[];
    addOrder: (order: JobOrder) => Promise<void>;
    updateOrder: (id: string, updates: Partial<JobOrder>, statusUser?: string) => Promise<void>;
    refreshOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

/**
 * @module OrderContext
 * @description Centralized state management for Job Orders.
 * Handles real-time synchronization with the FastAPI backend while providing
 * a robust localStorage fallback for offline/resilient operations.
 */
export function OrderProvider({ children, user }: { children: ReactNode, user: { id?: number, username: string } }) {

    const { addActivity } = useActivities();
    const [orders, setOrders] = useState<JobOrder[]>([]);

    // Robust Mapping: Converts Backend 3NF Model to Frontend JobOrder Type
    const mapBackendToFrontend = (bo: any): JobOrder => {
        const firstItem = bo.items?.[0] || {};

        return {
            id: bo.order_id.toString(),
            orderNumber: bo.order_number,
            customerName: bo.customer?.customer_name || 'Guest',
            contactNumber: bo.customer?.contact_number || '-',
            grandTotal: parseFloat(bo.grand_total) || 0,
            baseServiceFee: bo.items?.reduce((total: number, currItem: any) =>
                total + (currItem.services?.filter((s: any) => s.category === 'base').reduce((sum: number, s: any) => sum + (parseFloat(s.base_price) || 0) * (currItem.quantity || 1), 0) || 0)
                , 0) || 0,
            addOnsTotal: bo.items?.reduce((total: number, currItem: any) =>
                total + (currItem.services?.filter((s: any) => s.category === 'addon').reduce((sum: number, s: any) => sum + (parseFloat(s.base_price) || 0) * (currItem.quantity || 1), 0) || 0)
                , 0) || 0,
            priorityLevel: (bo.priority || 'regular').toLowerCase() as any,
            paymentStatus: (bo.payment_status || 'fully-paid').toLowerCase() as any,
            paymentMethod: (bo.payment_method || 'cash').toLowerCase() as any,
            shippingPreference: (bo.shipping_preference || 'pickup').toLowerCase() as any,
            deliveryAddress: bo.delivery_address || '',
            deliveryCourier: bo.delivery_courier || '',
            amountReceived: parseFloat(bo.amount_received) || 0,
            change: Math.max(0, (parseFloat(bo.amount_received) || 0) - (parseFloat(bo.grand_total) || 0)),
            referenceNo: bo.reference_no || '',
            // shelfLocation removed
            depositAmount: parseFloat(bo.deposit_amount) || 0,
            releaseTime: bo.release_time || '',
            province: bo.province || '',
            city: bo.city || '',
            barangay: bo.barangay || '',
            zipCode: bo.zip_code || '',

            // Status Mapping
            status: mapBackendStatus(bo.status?.status_name),

            createdAt: new Date(bo.created_at || Date.now()),
            updatedAt: new Date(bo.updated_at || bo.created_at || Date.now()),
            transactionDate: new Date(bo.created_at || Date.now()),
            predictedCompletionDate: bo.expected_at ? new Date(bo.expected_at) : undefined,
            actualCompletionDate: bo.released_at ? new Date(bo.released_at) : undefined,

            // Items Mapping
            items: bo.items?.map((bi: any) => ({
                id: bi.item_id?.toString() || Math.random().toString(),
                brand: bi.brand || 'Other',
                shoeModel: bi.shoe_model || 'Other',
                shoeMaterial: bi.material || 'Other',
                quantity: bi.quantity || 1,
                condition: {
                    scratches: bi.cond_scratches || false,
                    yellowing: bi.cond_yellowing || false,
                    ripsHoles: bi.cond_ripsholes || false,
                    deepStains: bi.cond_deepstains || false,
                    soleSeparation: bi.cond_soleseparation || false,
                    wornOut: bi.cond_wornout || false,
                    others: bi.item_notes || ''
                },
                baseService: bi.services?.filter((s: any) => s.category === 'base').map((s: any) => s.service_name) || [],
                addOns: bi.services?.filter((s: any) => s.category === 'addon').map((s: any) => ({
                    name: s.service_name,
                    quantity: 1
                })) || []
            })) || [],

            // Fallback fields
            brand: bo.items?.map((i: any) => i.brand).filter(Boolean).join(', ') || 'Unknown',
            shoeModel: firstItem.shoe_model || 'Unknown',
            shoeMaterial: bo.items?.map((i: any) => i.material).filter(Boolean).join(', ') || 'Unknown',
            quantity: bo.items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1,
            condition: {
                scratches: firstItem.cond_scratches || false,
                yellowing: firstItem.cond_yellowing || false,
                ripsHoles: firstItem.cond_ripsholes || false,
                deepStains: firstItem.cond_deepstains || false,
                soleSeparation: firstItem.cond_soleseparation || false,
                wornOut: firstItem.cond_wornout || false,
                others: firstItem.item_notes || ''
            },
            baseService: Array.from(new Set(
                bo.items?.flatMap((item: any) =>
                    item.services?.filter((s: any) => s.category === 'base').map((s: any) => s.service_name) || []
                ) || []
            )),
            addOns: firstItem.services?.filter((s: any) => s.category === 'addon').map((s: any) => ({
                name: s.service_name,
                quantity: 1
            })) || [],
            processedBy: bo.processor?.username || 'System',

            statusHistory: bo.status_logs?.map((sl: any) => ({
                status: mapBackendStatus(sl.status?.status_name),
                timestamp: new Date(sl.changed_at),
                user: sl.user?.username || 'System'
            })) || []
        };
    };


    // Initial Load - Hydrate from API with LocalStorage fallback
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                console.log('[DEBUG] OrderProvider: Fetching orders from backend...');
                const response = await fetch(`${API_BASE}/orders`);
                if (response.ok) {
                    const data = await response.json();
                    const mappedOrders = data.map(mapBackendToFrontend);

                    setOrders(mappedOrders);
                    localStorage.setItem('jobOrders_v19_cache', JSON.stringify(mappedOrders));
                    console.log('[DEBUG] OrderProvider: Backend sync successful.');
                } else {
                    throw new Error('API unreachable');
                }
            } catch (err) {
                console.warn('[DEBUG] OrderProvider: Backend offline. Using offline cache.');
                const saved = localStorage.getItem('jobOrders_v19_cache');
                if (saved) {
                    setOrders(JSON.parse(saved).map((o: any) => ({
                        ...o,
                        createdAt: new Date(o.createdAt),
                        updatedAt: new Date(o.updatedAt),
                        transactionDate: new Date(o.transactionDate || o.createdAt)
                    })));
                } else {
                    setOrders(mockJobOrders);
                }
            }
        };

        loadInitialData();
    }, []);

    const mapBackendStatus = (statusName: string) => {
        const map: any = {
            'Pending': 'new-order',
            'In Progress': 'on-going',
            'Completed': 'for-release',
            'Claimed': 'claimed'
        };
        return map[statusName] || 'new-order';
    };

    /**
     * @function refreshOrders
     * @description Force-refetches the latest data from the database.
     * Useful for resolving temporary out-of-sync states or confirming optimistic updates.
     */
    const refreshOrders = async () => {
        try {
            const response = await fetch(`${API_BASE}/orders`);
            if (response.ok) {
                const data = await response.json();
                setOrders(data.map(mapBackendToFrontend));
            }
        } catch (err) {
            console.error('[DEBUG] OrderProvider: Refresh failed.', err);
        }
    };


    const addOrder = async (order: JobOrder) => {
        // OPTIMISTIC UPDATE: Update UI immediately to ensure zero-latency response for the user
        setOrders((prev) => [{ ...order, updatedAt: new Date() }, ...prev]);

        try {
            console.log('[DEBUG] OrderProvider: Persisting order to backend...');
            const response = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...order,
                    user_id: user.id
                })

            });

            if (!response.ok) throw new Error('Failed to save to backend');

            console.log('[DEBUG] OrderProvider: Order persisted successfully.');
            refreshOrders(); // Get the official DB IDs
        } catch (err) {
            console.error('[CRITICAL] OrderProvider: Backend sync failed. Order exists only in memory.', err);
        }
    };

    const updateOrder = async (id: string, updates: Partial<JobOrder>, statusUser?: string) => {
        // Optimistic Update
        setOrders((prev) => prev.map((order) => {
            if (order.id === id) {
                return { ...order, ...updates, updatedAt: new Date() };
            }
            return order;
        }));

        try {
            // Find numerical ID (if it was from backend)
            // Note: In a real app, we'd store the actual DB ID in the 'id' field
            const dbId = parseInt(id);
            if (!isNaN(dbId)) {
                await fetch(`${API_BASE}/orders/${dbId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...updates, updater_id: user.id })
                });

            }

            // Log Activity
            if (updates.status) {
                addActivity({
                    user: statusUser || 'System',
                    action: 'Status Change',
                    details: `Order ID ${id} moved to "${updates.status.replace('-', ' ')}"`,
                    type: 'order'
                });
            }
        } catch (err) {
            console.error('[DEBUG] OrderProvider: Backend update failed.', err);
        }
    };

    return (
        <OrderContext.Provider value={{ orders, addOrder, updateOrder, refreshOrders }}>
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

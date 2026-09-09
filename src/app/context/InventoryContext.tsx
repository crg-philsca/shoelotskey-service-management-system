import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';


export interface InventoryItem {
    id: number;
    inventory_number?: string;
    name: string;
    category: string;
    stock: number;
    unit: string;
    price: number;
    status: string;
    isActive: boolean;
    auto_deduct?: boolean;
    auto_deduct_trigger?: string;
    trigger_service?: string;
    consumption_qty?: number;
    consumption_unit?: string;
    package_size?: number;
    package_unit?: string;
    low_stock_threshold?: number;  // Alert threshold in internal units (mL / g)
    is_retail?: boolean;
    retail_price?: number;
}

interface InventoryContextType {
    inventoryData: InventoryItem[];
    setInventoryData: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    updateStock: (itemId: number, usedQuantity: number, orderId?: number) => void;
    addItem: (item: Omit<InventoryItem, 'id' | 'status'>) => void;
    updateItem: (item: InventoryItem) => void;
    deleteItem: (id: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode, user: { token: string } }> = ({ children, user }) => {
    const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);

    // [FIX] Use per-item low_stock_threshold. Fall back to package_size, then 1.
    const calculateStatus = (stock: number, threshold?: number, packageSize?: number) => {
        if (stock <= 0) return 'Critical';
        const limit = (threshold && threshold > 0) ? threshold
            : ((packageSize && packageSize > 0) ? packageSize : 1);
        if (stock <= limit) return 'Low Stock';
        return 'In Stock';
    };

    const fetchInventory = async () => {
        try {
            const res = await fetch(`${API_BASE}/inventory?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch inventory');
            const data = await res.json();
            if (Array.isArray(data)) {
                const mapped = data.map((item: any) => ({
                    id: item.item_id,
                    inventory_number: item.inventory_number,
                    name: item.item_name,
                    category: item.category,
                    stock: item.stock_quantity,
                    unit: item.unit,
                    price: parseFloat(item.unit_price),
                    status: item.status,
                    isActive: item.is_active,
                    auto_deduct: item.auto_deduct,
                    auto_deduct_trigger: item.auto_deduct_trigger,
                    trigger_service: item.trigger_service,
                    consumption_qty: item.consumption_qty,
                    consumption_unit: item.consumption_unit,
                    package_size: item.package_size,
                    package_unit: item.package_unit,
                    low_stock_threshold: item.low_stock_threshold ?? 0,
                    is_retail: item.is_retail || false,
                    retail_price: parseFloat(item.retail_price || 0)
                }));
                setInventoryData(mapped);
                localStorage.setItem('inventory_cache', JSON.stringify(mapped));
            } else {
                console.warn("Inventory API returned non-array data:", data);
            }
        } catch (err) {
            console.error("Inventory fetch failed, using cache:", err);
            const saved = localStorage.getItem('inventory_cache');
            if (saved) setInventoryData(JSON.parse(saved));
        }
    };

    useEffect(() => {
        fetchInventory();
    }, [user.token]);

    const updateStock = async (itemId: number, usedQuantity: number, orderId?: number) => {
        const isRestock = usedQuantity < 0;
        const absoluteAmount = Math.abs(usedQuantity);
        const oldData = [...inventoryData];

        // Optimistic UI Update (works offline too)
        setInventoryData(prev => prev.map(item => {
            if (item.id === itemId) {
                const newStock = isRestock ? item.stock + absoluteAmount : Math.max(0, item.stock - absoluteAmount);
                return { 
                    ...item, 
                    stock: newStock, 
                    status: calculateStatus(newStock, item.low_stock_threshold, item.package_size) 
                };
            }
            return item;
        }));

        // Also update localStorage immediately for offline persistence
        setInventoryData(current => {
            localStorage.setItem('inventory_cache', JSON.stringify(current));
            return current;
        });

        // Attempt to sync with backend; queue if offline
        const task = { item_id: itemId, amount: absoluteAmount, action: isRestock ? 'restock' : 'deduction', order_id: orderId ?? null };

        if (!navigator.onLine) {
            // Queue for later sync
            const q = JSON.parse(localStorage.getItem('inventory_sync_queue') || '[]');
            q.push({ ...task, timestamp: Date.now() });
            localStorage.setItem('inventory_sync_queue', JSON.stringify(q));
            console.warn('[OFFLINE] Stock adjustment queued for sync:', task);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/inventory/adjust`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(task)
            });
            if (res.status === 400 || res.status === 401 || res.status === 403) {
                throw new Error(`HTTP_${res.status}`);
            }
            if (!res.ok) throw new Error('Stock adjustment failed');
        } catch (err: any) {
            console.error("Inventory sync failed:", err);
            if (err?.message && err.message.startsWith('HTTP_')) {
                setInventoryData(oldData);
                localStorage.setItem('inventory_cache', JSON.stringify(oldData));
                import('sonner').then(({ toast }) => toast.error('Stock adjustment denied (400/401/403).'));
                return;
            }
            const q = JSON.parse(localStorage.getItem('inventory_sync_queue') || '[]');
            q.push({ ...task, timestamp: Date.now() });
            localStorage.setItem('inventory_sync_queue', JSON.stringify(q));
        }
    };

    // [OFFLINE] Process queued inventory adjustments when coming back online
    const processInventorySyncQueue = async () => {
        if (!navigator.onLine || !user.token) return;

        const queueString = localStorage.getItem('inventory_sync_queue');
        if (!queueString) return;

        const queue: any[] = JSON.parse(queueString);
        if (queue.length === 0) return;

        console.log(`[ONLINE SYNC] Processing ${queue.length} inventory sync items...`);
        const remainingQueue: any[] = [];

        for (const task of queue) {
            try {
                const res = await fetch(`${API_BASE}/inventory/adjust`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    },
                    body: JSON.stringify({ item_id: task.item_id, amount: task.amount, action: task.action, order_id: task.order_id })
                });
                if (!res.ok) {
                    remainingQueue.push(task);
                }
            } catch {
                remainingQueue.push(task);
            }
        }

        if (remainingQueue.length > 0) {
            localStorage.setItem('inventory_sync_queue', JSON.stringify(remainingQueue));
        } else {
            localStorage.removeItem('inventory_sync_queue');
            console.log("[ONLINE SYNC] Inventory queue cleared.");
        }
    };

    useEffect(() => {
        processInventorySyncQueue();
        window.addEventListener('online', processInventorySyncQueue);
        return () => window.removeEventListener('online', processInventorySyncQueue);
    }, [user.token]);

    const addItem = async (item: Omit<InventoryItem, 'id' | 'status'>) => {
        const oldData = [...inventoryData];
        const tempId = Date.now();
        const optimisticItem: InventoryItem = {
            ...item,
            id: tempId,
            status: calculateStatus(item.stock, item.low_stock_threshold, item.package_size)
        };
        setInventoryData(prev => [optimisticItem, ...prev]);
        
        try {
            const res = await fetch(`${API_BASE}/inventory`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    // P1-3 FIX: inventory_number was never sent to the backend, so newly
                    // created items always landed with a null inventory_number regardless
                    // of what the Add Item form captured.
                    inventory_number: item.inventory_number || null,
                    item_name: item.name,
                    category: item.category,
                    stock_quantity: item.stock,
                    unit: item.unit,
                    unit_price: item.price,
                    is_active: item.isActive,
                    auto_deduct: item.auto_deduct || false,
                    auto_deduct_trigger: item.auto_deduct_trigger || 'Job Started',
                    trigger_service: item.trigger_service || 'All',
                    consumption_qty: item.consumption_qty || 0.0,
                    consumption_unit: item.consumption_unit || '',
                    package_size: item.package_size || 0.0,
                    package_unit: item.package_unit || '',
                    low_stock_threshold: item.low_stock_threshold || 0.0
                })
            });
            if (res.status === 400 || res.status === 401 || res.status === 403) {
                // P1-3 FIX: surface the backend's actual validation message (e.g. a clear
                // duplicate Inventory Number error) instead of a generic status-code toast.
                let detail = 'Action denied.';
                try { detail = (await res.json())?.detail || detail; } catch { /* ignore */ }
                throw new Error(`HTTP_${res.status}::${detail}`);
            }
            if (res.ok) {
                fetchInventory();
            } else {
                throw new Error(await res.text());
            }
        } catch (err: any) {
            console.error("[CRITICAL] Inventory Add failed:", err);
            if (err?.message && err.message.startsWith('HTTP_')) {
                setInventoryData(oldData);
                const detail = err.message.split('::')[1] || 'Action denied (400/401/403).';
                import('sonner').then(({ toast }) => toast.error(detail));
                return;
            }
            const saved = localStorage.getItem('inventory_cache');
            const cache = saved ? JSON.parse(saved) : [];
            cache.unshift(optimisticItem);
            localStorage.setItem('inventory_cache', JSON.stringify(cache));
        }
    };

    const updateItem = async (updatedItem: InventoryItem) => {
        const oldData = [...inventoryData];
        setInventoryData(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        try {
            const res = await fetch(`${API_BASE}/inventory/${updatedItem.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    // P1-3 FIX: inventory_number was never sent on update either, so an
                    // edited Inventory Number never actually persisted to the backend.
                    inventory_number: updatedItem.inventory_number || null,
                    item_name: updatedItem.name,
                    category: updatedItem.category,
                    stock_quantity: updatedItem.stock,
                    unit: updatedItem.unit,
                    unit_price: updatedItem.price,
                    is_active: updatedItem.isActive,
                    status: updatedItem.status,
                    auto_deduct: updatedItem.auto_deduct || false,
                    auto_deduct_trigger: updatedItem.auto_deduct_trigger || 'Job Started',
                    trigger_service: updatedItem.trigger_service || 'All',
                    consumption_qty: updatedItem.consumption_qty || 0.0,
                    consumption_unit: updatedItem.consumption_unit || '',
                    package_size: updatedItem.package_size || 0.0,
                    package_unit: updatedItem.package_unit || '',
                    low_stock_threshold: updatedItem.low_stock_threshold || 0.0
                })
            });
            if (res.status === 400 || res.status === 401 || res.status === 403) {
                // P1-3 FIX: surface the backend's actual validation message.
                let detail = 'Update denied.';
                try { detail = (await res.json())?.detail || detail; } catch { /* ignore */ }
                throw new Error(`HTTP_${res.status}::${detail}`);
            }
            if (res.ok) {
                fetchInventory();
            } else {
                throw new Error("Update failed");
            }
        } catch (err: any) {
            console.error("[CRITICAL] Inventory Update failed:", err);
            if (err?.message && err.message.startsWith('HTTP_')) {
                setInventoryData(oldData);
                const detail = err.message.split('::')[1] || 'Update denied (400/401/403).';
                import('sonner').then(({ toast }) => toast.error(detail));
                return;
            }
            const saved = localStorage.getItem('inventory_cache');
            if (saved) {
                const cache = JSON.parse(saved).map((i: any) => i.id === updatedItem.id ? updatedItem : i);
                localStorage.setItem('inventory_cache', JSON.stringify(cache));
            }
        }
    };

    const deleteItem = async (id: number) => {
        const oldData = [...inventoryData];
        setInventoryData(prev => prev.filter(item => item.id !== id));
        const saved = localStorage.getItem('inventory_cache');
        if (saved) {
            const cache = JSON.parse(saved).filter((i: any) => i.id !== id);
            localStorage.setItem('inventory_cache', JSON.stringify(cache));
        }
        
        try {
            const res = await fetch(`${API_BASE}/inventory/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (!res.ok) {
                setInventoryData(oldData);
                localStorage.setItem('inventory_cache', JSON.stringify(oldData));
                import('sonner').then(({ toast }) => toast.error('Delete failed. Item was restored.'));
                return;
            }
            // Confirm server state so soft-deleted rows stay hidden after sync/refetch.
            await fetchInventory();
        } catch(e) {
            console.error("Failed to delete from server", e);
            setInventoryData(oldData);
            localStorage.setItem('inventory_cache', JSON.stringify(oldData));
            import('sonner').then(({ toast }) => toast.error('Delete failed (offline/network). Item was restored.'));
        }
    };

    const contextValue = React.useMemo(() => ({ 
        inventoryData, 
        setInventoryData, 
        updateStock, 
        addItem, 
        updateItem, 
        deleteItem 
    }), [inventoryData, updateStock, addItem, updateItem, deleteItem]);

    return (
        <InventoryContext.Provider value={contextValue}>
            {children}
        </InventoryContext.Provider>
    );
};

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (undefined === context) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
};

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';
import { useActivities } from './ActivityContext';


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
    addItem: (item: Omit<InventoryItem, 'id' | 'status'>) => Promise<boolean>;
    updateItem: (item: InventoryItem) => void;
    deleteItem: (id: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode, user: { token: string; username?: string } }> = ({ children, user }) => {
    const { refreshActivities } = useActivities();
    const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
    const inFlightActions = useRef<Set<string>>(new Set());

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
            refreshActivities().catch(() => {});
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

    const addItem = async (item: Omit<InventoryItem, 'id' | 'status'>): Promise<boolean> => {
        const itemKey = `add-${item.name.trim().toLowerCase()}`;
        if (inFlightActions.current.has(itemKey)) {
            console.warn(`[DUPLICATE PREVENTED] Add already in progress for ${item.name}`);
            return false;
        }
        inFlightActions.current.add(itemKey);
        const oldData = [...inventoryData];
        const tempId = Date.now();
        const optimisticItem: InventoryItem = {
            ...item,
            id: tempId,
            status: calculateStatus(item.stock, item.low_stock_threshold, item.package_size),
            is_retail: Boolean(item.is_retail),
            retail_price: item.is_retail ? Number(item.retail_price || 0) : 0
        };
        setInventoryData(prev => {
            const updated = [optimisticItem, ...prev];
            localStorage.setItem('inventory_cache', JSON.stringify(updated));
            return updated;
        });
        
        try {
            const res = await fetch(`${API_BASE}/inventory`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
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
                    package_size: item.package_size || 1.0,
                    package_unit: item.package_unit || '',
                    low_stock_threshold: item.low_stock_threshold || 0.0,
                    is_retail: Boolean(item.is_retail),
                    retail_price: item.is_retail ? Number(item.retail_price || 0) : 0
                })
            });
            if (!res.ok) {
                let detail = 'Action denied.';
                try { 
                    const errData = await res.json();
                    detail = errData?.detail || detail; 
                } catch { 
                    try { detail = await res.text(); } catch {}
                }
                setInventoryData(oldData);
                localStorage.setItem('inventory_cache', JSON.stringify(oldData));
                const { toast } = await import('sonner');
                toast.error(detail || 'Could not save inventory item.');
                return false;
            }

            const savedItem = await res.json();
            const realItem: InventoryItem = {
                id: savedItem.item_id,
                inventory_number: savedItem.inventory_number || undefined,
                name: savedItem.item_name,
                category: savedItem.category,
                stock: savedItem.stock_quantity,
                unit: savedItem.unit,
                price: parseFloat(savedItem.unit_price),
                status: calculateStatus(savedItem.stock_quantity, savedItem.low_stock_threshold, savedItem.package_size),
                isActive: savedItem.is_active,
                auto_deduct: savedItem.auto_deduct,
                auto_deduct_trigger: savedItem.auto_deduct_trigger,
                trigger_service: savedItem.trigger_service,
                consumption_qty: savedItem.consumption_qty,
                consumption_unit: savedItem.consumption_unit,
                package_size: savedItem.package_size,
                package_unit: savedItem.package_unit,
                low_stock_threshold: savedItem.low_stock_threshold,
                is_retail: Boolean(savedItem.is_retail),
                retail_price: parseFloat(savedItem.retail_price || 0)
            };

            setInventoryData(prev => {
                const updated = prev.map(i => i.id === tempId ? realItem : i);
                localStorage.setItem('inventory_cache', JSON.stringify(updated));
                return updated;
            });

            return true;
        } catch (err: any) {
            console.error("[CRITICAL] Inventory Add failed:", err);
            setInventoryData(oldData);
            localStorage.setItem('inventory_cache', JSON.stringify(oldData));
            const { toast } = await import('sonner');
            toast.error(err.message || 'Could not connect to inventory server.');
            return false;
        } finally {
            inFlightActions.current.delete(itemKey);
        }
    };

    const updateItem = async (updatedItem: InventoryItem) => {
        const updateKey = `update-${updatedItem.id}`;
        if (inFlightActions.current.has(updateKey)) {
            console.warn(`[DUPLICATE PREVENTED] Update already in progress for item #${updatedItem.id}`);
            return;
        }
        inFlightActions.current.add(updateKey);
        const oldData = [...inventoryData];
        const normalizedItem: InventoryItem = {
            ...updatedItem,
            is_retail: Boolean(updatedItem.is_retail),
            retail_price: updatedItem.is_retail ? Number(updatedItem.retail_price || 0) : 0
        };

        // Optimistic UI Update and immediate cache persistence
        setInventoryData(prev => {
            const updated = prev.map(item => item.id === normalizedItem.id ? normalizedItem : item);
            localStorage.setItem('inventory_cache', JSON.stringify(updated));
            return updated;
        });

        try {
            const res = await fetch(`${API_BASE}/inventory/${normalizedItem.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    inventory_number: normalizedItem.inventory_number || null,
                    item_name: normalizedItem.name,
                    category: normalizedItem.category,
                    stock_quantity: normalizedItem.stock,
                    unit: normalizedItem.unit,
                    unit_price: normalizedItem.price,
                    is_active: normalizedItem.isActive,
                    status: normalizedItem.status,
                    auto_deduct: normalizedItem.auto_deduct || false,
                    auto_deduct_trigger: normalizedItem.auto_deduct_trigger || 'Job Started',
                    trigger_service: normalizedItem.trigger_service || 'All',
                    consumption_qty: normalizedItem.consumption_qty || 0.0,
                    consumption_unit: normalizedItem.consumption_unit || '',
                    package_size: normalizedItem.package_size || 0.0,
                    package_unit: normalizedItem.package_unit || '',
                    low_stock_threshold: normalizedItem.low_stock_threshold || 0.0,
                    is_retail: normalizedItem.is_retail,
                    retail_price: normalizedItem.retail_price
                })
            });
            if (res.status === 400 || res.status === 401 || res.status === 403) {
                let detail = 'Update denied.';
                try { detail = (await res.json())?.detail || detail; } catch { /* ignore */ }
                throw new Error(`HTTP_${res.status}::${detail}`);
            }
            if (res.ok) {
                const returned = await res.json();
                const mappedReturned: InventoryItem = {
                    id: returned.item_id,
                    inventory_number: returned.inventory_number,
                    name: returned.item_name,
                    category: returned.category,
                    stock: returned.stock_quantity,
                    unit: returned.unit,
                    price: parseFloat(returned.unit_price),
                    status: returned.status,
                    isActive: returned.is_active,
                    auto_deduct: returned.auto_deduct,
                    auto_deduct_trigger: returned.auto_deduct_trigger,
                    trigger_service: returned.trigger_service,
                    consumption_qty: returned.consumption_qty,
                    consumption_unit: returned.consumption_unit,
                    package_size: returned.package_size,
                    package_unit: returned.package_unit,
                    low_stock_threshold: returned.low_stock_threshold ?? 0,
                    is_retail: Boolean(returned.is_retail),
                    retail_price: parseFloat(returned.retail_price || 0)
                };
                setInventoryData(prev => {
                    const updated = prev.map(item => item.id === mappedReturned.id ? mappedReturned : item);
                    localStorage.setItem('inventory_cache', JSON.stringify(updated));
                    return updated;
                });
            } else {
                throw new Error("Update failed");
            }
        } catch (err: any) {
            console.error("[CRITICAL] Inventory Update failed:", err);
            if (err?.message && err.message.startsWith('HTTP_')) {
                setInventoryData(oldData);
                localStorage.setItem('inventory_cache', JSON.stringify(oldData));
                const detail = err.message.split('::')[1] || 'Update denied (400/401/403).';
                import('sonner').then(({ toast }) => toast.error(detail));
                return;
            }
            const saved = localStorage.getItem('inventory_cache');
            if (saved) {
                const cache = JSON.parse(saved).map((i: any) => i.id === normalizedItem.id ? normalizedItem : i);
                localStorage.setItem('inventory_cache', JSON.stringify(cache));
            }
        } finally {
            inFlightActions.current.delete(updateKey);
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

            refreshActivities().catch(() => {});
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


import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface InventoryItem {
    id: number;
    name: string;
    category: string;
    stock: number;
    unit: string;
    price: number;
    status: string;
    isActive: boolean;
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

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173' || window.location.hostname.startsWith('192.')))
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : '/api';

export const InventoryProvider: React.FC<{ children: ReactNode, user: { token: string } }> = ({ children, user }) => {
    const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);

    const calculateStatus = (stock: number, unit: string) => {
        const u = unit.toLowerCase();
        // Dynamic Thresholds for Shoelotskey Chemicals
        if (u.includes('liter')) {
            if (stock <= 5) return 'Critical';
            if (stock <= 20) return 'Low Stock';
        } else if (u.includes('bottle') || u.includes('tub') || u.includes('can')) {
            if (stock <= 10) return 'Critical';
            if (stock <= 50) return 'Low Stock';
        } else {
            if (stock <= 5) return 'Critical';
            if (stock <= 10) return 'Low Stock';
        }
        return 'In Stock';
    };

    const fetchInventory = async () => {
        try {
            const res = await fetch(`${API_BASE}/inventory`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch inventory');
            const data = await res.json();
            if (Array.isArray(data)) {
                const mapped = data.map((item: any) => ({
                    id: item.item_id,
                    name: item.item_name,
                    category: item.category,
                    stock: item.stock_quantity,
                    unit: item.unit,
                    price: parseFloat(item.unit_price),
                    status: item.status,
                    isActive: item.is_active
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
        // Optimistic UI Update
        setInventoryData(prev => prev.map(item => {
            if (item.id === itemId) {
                const newStock = Math.max(0, item.stock - usedQuantity);
                return { ...item, stock: newStock, status: calculateStatus(newStock, item.unit) };
            }
            return item;
        }));

        try {
            const res = await fetch(`${API_BASE}/inventory/adjust`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    item_id: itemId,
                    amount: usedQuantity,
                    action: 'deduction',
                    order_id: orderId
                })
            });
            if (!res.ok) throw new Error('Stock adjustment failed');
        } catch (err) {
            console.error("Inventory sync failed, adjustment will retry on next reload", err);
            // In a real app, we'd add this to an offline queue like OrderContext does.
        }
    };

    const addItem = async (item: Omit<InventoryItem, 'id' | 'status'>) => {
        const tempId = Date.now();
        const optimisticItem: InventoryItem = {
            ...item,
            id: tempId,
            status: calculateStatus(item.stock, item.unit)
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
                    item_name: item.name,
                    category: item.category,
                    stock_quantity: item.stock,
                    unit: item.unit,
                    unit_price: item.price,
                    is_active: item.isActive
                })
            });
            if (res.ok) {
                fetchInventory();
            } else {
                throw new Error(await res.text());
            }
        } catch (err) {
            console.error("[CRITICAL] Inventory Add failed, persisting locally.", err);
            // In a real robust system we'd use a queue like OrderContext. Here we just rely on localStorage cache.
            const saved = localStorage.getItem('inventory_cache');
            const cache = saved ? JSON.parse(saved) : [];
            cache.unshift(optimisticItem);
            localStorage.setItem('inventory_cache', JSON.stringify(cache));
        }
    };

    const updateItem = async (updatedItem: InventoryItem) => {
        setInventoryData(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        try {
            const res = await fetch(`${API_BASE}/inventory/${updatedItem.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    item_name: updatedItem.name,
                    category: updatedItem.category,
                    stock_quantity: updatedItem.stock,
                    unit: updatedItem.unit,
                    unit_price: updatedItem.price,
                    is_active: updatedItem.isActive,
                    status: updatedItem.status
                })
            });
            if (res.ok) {
                fetchInventory();
            } else {
                throw new Error("Update failed");
            }
        } catch (err) {
            console.error("[CRITICAL] Inventory Update failed, persisting locally.", err);
            const saved = localStorage.getItem('inventory_cache');
            if (saved) {
                const cache = JSON.parse(saved).map((i: any) => i.id === updatedItem.id ? updatedItem : i);
                localStorage.setItem('inventory_cache', JSON.stringify(cache));
            }
        }
    };

    const deleteItem = async (id: number) => {
        setInventoryData(prev => prev.filter(item => item.id !== id));
        // Also update local storage
        const saved = localStorage.getItem('inventory_cache');
        if (saved) {
            const cache = JSON.parse(saved).filter((i: any) => i.id !== id);
            localStorage.setItem('inventory_cache', JSON.stringify(cache));
        }
        
        try {
            await fetch(`${API_BASE}/inventory/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
        } catch(e) {
            console.error("Failed to delete from server", e);
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

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useInventory } from '@/app/context/InventoryContext';
import { Package, Plus, Minus, Trash2, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { JobOrder, InventoryUsed } from '@/app/types';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { useActivities } from '@/app/context/ActivityContext';

interface StockUpdateModalProps {
    order: JobOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (orderId: string, updates: Partial<JobOrder>) => void;
    user?: { username: string; role?: string };
}

export default function StockUpdateModal({ order, open, onOpenChange, onSave, user }: StockUpdateModalProps) {
    const { inventoryData, updateStock } = useInventory();
    const { addActivity } = useActivities();
    const [inventoryUsed, setInventoryUsed] = useState<InventoryUsed[]>([]);
    const [originalUsed, setOriginalUsed] = useState<InventoryUsed[]>([]);
    const [selectedItem, setSelectedItem] = useState<string>('');
    const [isApplied, setIsApplied] = useState(false);
    // [FIX] Track quantity inputs as strings to allow partial decimal typing (e.g. "0." or ".3")
    const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>({});

    useEffect(() => {
        if (order && open) {
            // [STABILITY] Ensure we have a valid array even if the DB returns a string or object
            let rawUsed = order.inventoryUsed || [];
            if (typeof rawUsed === 'string') {
                try { rawUsed = JSON.parse(rawUsed); } catch (e) { rawUsed = []; }
            }
            
            // If it's an object (non-null, non-array), convert values to array
            if (rawUsed && typeof rawUsed === 'object' && !Array.isArray(rawUsed)) {
                rawUsed = Object.values(rawUsed);
            }
            
            let parsedArray = Array.isArray(rawUsed) ? [...rawUsed] : [];
            const applied = order.inventoryApplied || false;
            setIsApplied(applied);

            // [REQUIREMENT 3] Suggested Materials with initial 0 value (Never deduct inventory yet)
            if (parsedArray.length === 0 && !applied && inventoryData.length > 0) {
                const serviceNames: string[] = [];
                order.items?.forEach(it => {
                    if (Array.isArray(it.baseService)) it.baseService.forEach(s => serviceNames.push(String(s).toLowerCase()));
                    else if (it.baseService) serviceNames.push(String(it.baseService).toLowerCase());
                    if (Array.isArray(it.addOns)) it.addOns.forEach(a => serviceNames.push(String(a).toLowerCase()));
                });

                const suggested: InventoryUsed[] = [];
                inventoryData.forEach(inv => {
                    if (!inv.isActive) return;
                    let isSuggested = false;
                    if (inv.auto_deduct) isSuggested = true;
                    if (inv.trigger_service && inv.trigger_service.toLowerCase() !== 'all') {
                        const triggers = inv.trigger_service.split(',').map(s => s.trim().toLowerCase());
                        if (triggers.some(t => serviceNames.some(sn => sn.includes(t) || t.includes(sn)))) {
                            isSuggested = true;
                        }
                    } else if (inv.category?.toLowerCase() === 'chemicals' || inv.name?.toLowerCase().includes('cleaner') || inv.name?.toLowerCase().includes('deodorizer')) {
                        isSuggested = true;
                    }
                    if (isSuggested && !suggested.some(s => s.itemId === inv.id)) {
                        suggested.push({
                            itemId: inv.id,
                            name: inv.name,
                            quantity: 0, // Recommended initial value of 0 mL without deducting inventory
                            unit: inv.unit || 'mL', // Always use consumption unit (e.g. mL, grams), never packaging container unit (CAN, JUG)
                            staffMember: user?.username || 'Staff',
                            date: new Date().toLocaleDateString(),
                            time: new Date().toLocaleTimeString()
                        });
                    }
                });
                if (suggested.length > 0) {
                    parsedArray = suggested;
                    // Immediately sync suggested items to order without deducting stock
                    onSave(order.id, { inventoryUsed: suggested, inventoryApplied: false });
                }
            }

            setInventoryUsed([...parsedArray]);
            setOriginalUsed(JSON.parse(JSON.stringify(parsedArray)));
            
            // Reset input string states whenever modal re-opens
            const inputMap: Record<number, string> = {};
            parsedArray.forEach((i: InventoryUsed) => { inputMap[i.itemId] = String(i.quantity); });
            setQuantityInputs(inputMap);
        }
    }, [order, open, inventoryData]);

    // [REQUIREMENT 1] Helper to sync changes immediately without deducting inventory when order is on-going/unclaimed
    const saveImmediately = (newList: InventoryUsed[]) => {
        if (!order || isApplied) return;
        onSave(order.id, { inventoryUsed: newList, inventoryApplied: false });
    };

    const handleAddItem = (itemId: string) => {
        const item = inventoryData.find(i => i.id.toString() === itemId);
        if (!item) return;

        if (inventoryUsed.some(i => i.itemId === item.id)) {
            toast.error('Item already added');
            return;
        }

        const isPackaged = item.package_size && item.package_size > 0;
        const defaultQty = isPackaged ? (item.consumption_qty || 10) : 1;
        
        if (defaultQty > item.stock) {
            toast.error('Insufficient stock available.');
            return;
        }

        const displayUnit = item.unit || 'mL';

        const updatedList: InventoryUsed[] = [...inventoryUsed, {
            itemId: item.id,
            name: item.name,
            quantity: defaultQty,
            unit: displayUnit,
            staffMember: user?.username || 'Staff',
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        }];

        setInventoryUsed(updatedList);
        setQuantityInputs(prev => ({ ...prev, [item.id]: String(defaultQty) }));
        setSelectedItem('');
        saveImmediately(updatedList);
    };

    const handleUpdateQty = (itemId: number, delta: number) => {
        const itemObj = inventoryData.find(i => i.id === itemId);
        const currentItem = inventoryUsed.find(i => i.itemId === itemId);
        if (delta > 0 && itemObj && currentItem && (currentItem.quantity + delta) > itemObj.stock) {
            toast.error('Insufficient stock available.');
            return;
        }
        const updatedList = inventoryUsed.map(i => {
            if (i.itemId !== itemId) return i;
            const newQty = Math.max(0, parseFloat((i.quantity + delta).toFixed(2)));
            setQuantityInputs(pv => ({ ...pv, [itemId]: String(newQty) }));
            return { 
                ...i, 
                quantity: newQty,
                unit: itemObj?.unit || i.unit || 'mL',
                staffMember: user?.username || i.staffMember || 'Staff',
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString()
            };
        });
        setInventoryUsed(updatedList);
        saveImmediately(updatedList);
    };

    const handleQuickAdd = (itemId: number, addVal: number) => {
        const itemObj = inventoryData.find(i => i.id === itemId);
        const currentItem = inventoryUsed.find(i => i.itemId === itemId);
        if (addVal > 0 && itemObj && currentItem && (currentItem.quantity + addVal) > itemObj.stock) {
            toast.error('Insufficient stock available.');
            return;
        }
        const updatedList = inventoryUsed.map(i => {
            if (i.itemId !== itemId) return i;
            const newQty = Math.max(0, parseFloat((i.quantity + addVal).toFixed(2)));
            setQuantityInputs(pv => ({ ...pv, [itemId]: String(newQty) }));
            return { 
                ...i, 
                quantity: newQty,
                unit: itemObj?.unit || i.unit || 'mL',
                staffMember: user?.username || i.staffMember || 'Staff',
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString()
            };
        });
        setInventoryUsed(updatedList);
        saveImmediately(updatedList);
    };

    const handleRemoveItem = (itemId: number) => {
        const updatedList = inventoryUsed.filter(i => i.itemId !== itemId);
        setInventoryUsed(updatedList);
        saveImmediately(updatedList);
    };

    const handleSaveAndClose = async () => {
        if (!order) return;

        const stampedUsed = inventoryUsed.map(i => ({
            ...i,
            staffMember: i.staffMember || user?.username || 'Staff',
            date: i.date || new Date().toLocaleDateString(),
            time: i.time || new Date().toLocaleTimeString()
        }));

        // Prevent negative inventory on final save check
        for (const item of stampedUsed) {
            const invItem = inventoryData.find(i => i.id === item.itemId);
            const oldQty = originalUsed.find(o => o.itemId === item.itemId)?.quantity || 0;
            const needed = isApplied ? (item.quantity - oldQty) : item.quantity;
            if (invItem && needed > invItem.stock) {
                toast.error('Insufficient stock available.');
                return;
            }
        }

        if (isApplied || order.inventoryApplied) {
            const hasChanges = stampedUsed.some(i => {
                const old = originalUsed.find(o => o.itemId === i.itemId);
                return !old || old.quantity !== i.quantity;
            }) || originalUsed.some(o => !stampedUsed.find(i => i.itemId === o.itemId));

            if (!hasChanges) {
                toast.error("Inventory usage has already been applied.");
                return;
            }

            const dbId = parseInt(order.id);
            const orderIdVal = isNaN(dbId) ? undefined : dbId;

            // Compute delta adjustments if stock was already previously deducted
            const allItemIds = Array.from(new Set([
                ...stampedUsed.map(i => i.itemId),
                ...originalUsed.map(i => i.itemId)
            ]));

            allItemIds.forEach(itemId => {
                const newItem = stampedUsed.find(i => i.itemId === itemId);
                const oldItem = originalUsed.find(i => i.itemId === itemId);
                
                const newQty = newItem ? newItem.quantity : 0;
                const oldQty = oldItem ? oldItem.quantity : 0;
                
                const delta = newQty - oldQty;
                if (delta !== 0) {
                    const invItem = inventoryData.find(i => i.id === itemId);
                    const oldStock = invItem ? invItem.stock : 0;
                    const newStock = Math.max(0, oldStock - delta);
                    const unit = invItem?.unit || newItem?.unit || 'mL';
                    const staff = user?.username || "Staff";

                    updateStock(itemId, delta, orderIdVal);

                    addActivity({
                        type: 'inventory',
                        module: 'Inventory',
                        table: 'Inventory',
                        recordId: itemId,
                        user: staff,
                        role: user?.role || 'Staff',
                        action: `${invItem?.name || 'Item'}: ${oldStock} → ${newStock} ${unit} (Updated by ${staff})`,
                        details: `${invItem?.name || 'Item'}: ${oldStock} → ${newStock} ${unit} (Updated by ${staff}) during usage update for Order #${order.orderNumber}`
                    });
                }
            });

            onSave(order.id, { inventoryUsed: stampedUsed, inventoryApplied: true });
            toast.success('Stock levels updated and saved to order.');
        } else {
            // [REQUIREMENT 1 & 4] Do NOT deduct inventory yet! Save temporary material list for automatic deduction upon claiming.
            onSave(order.id, { inventoryUsed: stampedUsed, inventoryApplied: false });
            toast.success('Material usage saved! Stock will be deducted automatically upon order claiming.');
        }
        onOpenChange(false);
    };

    if (!order) return null;

    const totalUsage = inventoryUsed.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px] max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-3xl border-none shadow-2xl bg-white">
                <DialogHeader className="shrink-0 bg-emerald-600 px-6 py-5 text-white text-center">
                    <div className="mx-auto w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2">
                        <Package size={20} className="text-white" />
                    </div>
                    <DialogTitle className="text-base font-black uppercase tracking-widest">
                        Update Inventory
                    </DialogTitle>
                    <p className="text-emerald-100 text-[11px] font-bold uppercase tracking-wide">
                        Order #{order.orderNumber} • {order.customerName}
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                    {isApplied ? (
                        <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 flex gap-3 items-start">
                            <CheckCircle2 size={16} className="text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs font-medium text-amber-900 leading-relaxed">
                                <strong>Notice:</strong> Inventory was already deducted for this order. Changes here will immediately adjust current stock balances.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 flex gap-3 items-start">
                            <Info size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                            <p className="text-xs font-medium text-emerald-900 leading-relaxed">
                                <strong>Record Materials:</strong> Gradually record materials during service. Changes are saved immediately without deducting inventory until order claiming.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">
                            Add Material / Supply
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Select value={selectedItem} onValueChange={setSelectedItem}>
                                    <SelectTrigger className="w-full h-11 bg-gray-50 rounded-xl border-gray-100 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-600">
                                        <SelectValue placeholder="Choose material..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(inventoryData || []).filter(i => i.isActive).map(item => {
                                            const presentation = getInventoryPresentation(item);
                                            return (
                                                <SelectItem key={item.id} value={item.id.toString()}>
                                                    <span className="font-bold">{item.name}</span> <span className="text-gray-400 font-normal">({presentation.availableText})</span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button 
                                type="button" 
                                onClick={() => handleAddItem(selectedItem)}
                                disabled={!selectedItem}
                                className="bg-emerald-600 hover:bg-emerald-700 h-11 w-11 p-0 rounded-xl shadow-lg shadow-emerald-100 shrink-0"
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                Recorded Materials ({inventoryUsed.length})
                            </label>
                            <span className="text-[11px] font-black text-emerald-600">
                                Total: {totalUsage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} units
                            </span>
                        </div>
                        <p className="text-[11px] text-amber-700 font-medium bg-amber-50/80 border border-amber-200/60 rounded-xl px-3.5 py-2 leading-snug">
                            💡 <strong>Tip:</strong> Click any quantity box to type exact usage directly, or use quick adjustment buttons below each item. All units are in <strong>consumption measurement</strong> (e.g., mL, grams).
                        </p>
                        <div className="space-y-2.5">
                            {(inventoryUsed || []).map((item) => {
                                const invObj = inventoryData.find(i => i.id === item.itemId);
                                const rawUnit = invObj?.unit || item.unit || 'mL';
                                const actualUnit = (rawUnit.toUpperCase() === 'CAN' || rawUnit.toUpperCase() === 'JUG' || rawUnit.toUpperCase() === 'BOTTLE' || rawUnit.toUpperCase() === 'CANS' || rawUnit.toUpperCase() === 'JUGS') ? (invObj?.unit !== rawUnit ? (invObj?.unit || 'mL') : 'mL') : rawUnit;

                                return (
                                    <div key={item.itemId} className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100 group hover:border-emerald-200 hover:bg-white transition-all shadow-2xs space-y-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 shrink-0 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-xs border border-gray-100 group-hover:scale-105 transition-transform">
                                                    <Package size={18} />
                                                </div>
                                                <div className="min-w-0 truncate">
                                                    <p className="text-sm font-black text-gray-900 truncate">{item.name}</p>
                                                    <p className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider">{actualUnit}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200/80 p-1 shadow-2xs">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleUpdateQty(item.itemId, -1)}
                                                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Subtract 1 unit"
                                                    >
                                                        <Minus size={13} />
                                                    </button>
                                                    <input 
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={quantityInputs[item.itemId] ?? String(item.quantity)}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
                                                                setQuantityInputs(prev => ({ ...prev, [item.itemId]: raw }));
                                                                const parsed = parseFloat(raw);
                                                                if (!isNaN(parsed)) {
                                                                    const updated = inventoryUsed.map(i => 
                                                                        i.itemId === item.itemId ? { ...i, quantity: parsed, unit: actualUnit, staffMember: user?.username || i.staffMember || 'Staff', date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() } : i
                                                                    );
                                                                    setInventoryUsed(updated);
                                                                    saveImmediately(updated);
                                                                }
                                                            }
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        onBlur={() => {
                                                            const parsed = Math.max(0, parseFloat(quantityInputs[item.itemId] ?? '') || 0);
                                                            setQuantityInputs(prev => ({ ...prev, [item.itemId]: String(parsed) }));
                                                            const updated = inventoryUsed.map(i => 
                                                                i.itemId === item.itemId ? { ...i, quantity: parsed, unit: actualUnit, staffMember: user?.username || i.staffMember || 'Staff', date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() } : i
                                                            );
                                                            setInventoryUsed(updated);
                                                            saveImmediately(updated);
                                                        }}
                                                        title="Click to type exact usage"
                                                        className="w-14 h-7 text-xs font-black text-center bg-emerald-50/40 hover:bg-white border border-emerald-200/80 rounded-md text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all px-1 shadow-inner"
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleUpdateQty(item.itemId, 1)}
                                                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                        title="Add 1 unit"
                                                    >
                                                        <Plus size={13} />
                                                    </button>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.itemId)}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remove item completely"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200/60">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateQty(item.itemId, -item.quantity)}
                                                disabled={item.quantity === 0}
                                                className="px-2 py-0.5 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-md text-[10px] font-extrabold tracking-wide transition-all disabled:opacity-40 disabled:pointer-events-none"
                                            >
                                                Reset to 0
                                            </button>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 mr-1">Adjust:</span>
                                                {[-10, -5, 5, 10, 25, 50].map((val) => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => handleQuickAdd(item.itemId, val)}
                                                        disabled={val < 0 && item.quantity === 0}
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black shadow-2xs transition-all border disabled:opacity-40 disabled:pointer-events-none ${
                                                            val < 0 
                                                                ? 'bg-white hover:bg-red-50/80 border-gray-200 text-red-600' 
                                                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                                        }`}
                                                    >
                                                        {val > 0 ? `+${val}` : val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {inventoryUsed.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                                    <Package size={32} className="text-gray-200 mx-auto mb-2" />
                                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">No materials recorded yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="shrink-0 bg-gray-50 p-5 border-t border-gray-100 flex gap-3 sm:justify-center">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        className="flex-1 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest text-gray-500 bg-white border border-gray-200 hover:bg-gray-100"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSaveAndClose}
                        className="flex-1 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                    >
                        {isApplied ? 'Save & Adjust Stock' : 'Save Usage Record'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

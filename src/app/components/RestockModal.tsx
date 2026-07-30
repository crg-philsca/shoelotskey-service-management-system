import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { useInventory } from '@/app/context/InventoryContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useActivities } from '@/app/context/ActivityContext';
import { PackagePlus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';

interface RestockModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: { username?: string };
}

export default function RestockModal({ open, onOpenChange, user }: RestockModalProps) {
    const { inventoryData, updateItem } = useInventory();
    const { addExpense } = useExpenses();
    const { addActivity } = useActivities();

    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('1');
    const [customCost, setCustomCost] = useState<string>('');
    const [restockDate, setRestockDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState<string>('');
    const [recordExpense, setRecordExpense] = useState<boolean>(true);

    // Select first item by default when opened if nothing selected
    useEffect(() => {
        if (open && !selectedItemId && inventoryData.length > 0) {
            setSelectedItemId(String(inventoryData[0].id));
        }
        if (open) {
            setQuantity('1');
            setCustomCost('');
            setNotes('');
            setRecordExpense(true);
            setRestockDate(new Date().toISOString().split('T')[0]);
        }
    }, [open, inventoryData]);

    const selectedItem = inventoryData.find(i => String(i.id) === selectedItemId);
    const pres = selectedItem ? getInventoryPresentation(selectedItem) : null;

    // Determine package unit & conversion rate
    const hasPackage = selectedItem && Number((selectedItem as any).package_size || (selectedItem as any).packageSize) > 0;
    const packageUnit = hasPackage 
        ? ((selectedItem as any).package_unit || (selectedItem as any).packageUnit || 'Package') 
        : (selectedItem?.unit?.toLowerCase() === 'ml' ? 'Jug / Bottle' : selectedItem?.unit?.toLowerCase() === 'g' ? 'Tub / Can' : (selectedItem?.unit || 'Unit'));
    const packageSize = hasPackage 
        ? Number((selectedItem as any).package_size || (selectedItem as any).packageSize) 
        : (selectedItem?.unit?.toLowerCase() === 'ml' || selectedItem?.unit?.toLowerCase() === 'g' ? 1000 : 1);
    
    const unitPrice = selectedItem ? Number(selectedItem.price || 0) : 0;
    const computedTotalCost = (Number(quantity) || 0) * unitPrice;
    const effectiveCost = customCost.trim() !== '' ? Number(customCost) : computedTotalCost;
    const totalUnitsAdded = (Number(quantity) || 0) * packageSize;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) {
            toast.error('Please select an item to restock.');
            return;
        }
        const qtyNum = Number(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            toast.error('Please enter a valid restock quantity (1 or more whole containers).');
            return;
        }

        // 1. Update Inventory stock
        const oldStock = Number(selectedItem.stock || 0);
        const newStock = oldStock + totalUnitsAdded;
        const updatedItem = { ...selectedItem, stock: newStock };
        
        updateItem(updatedItem);

        // 2. Log Expense if enabled
        if (recordExpense && effectiveCost > 0) {
            addExpense({
                id: `exp_${Date.now()}`,
                amount: effectiveCost,
                category: 'INVENTORY',
                notes: `Restock: ${selectedItem.name} (+${qtyNum} ${packageUnit})${notes ? ` - ${notes}` : ''}`,
                frequency: 'Variable / Restock',
                date: new Date(restockDate).toISOString()
            });
        }

        // 3. Log Activity
        addActivity({
            user: user?.username || 'Owner',
            action: 'Restock Inventory',
            table: 'Inventory',
            recordId: selectedItem.id,
            oldValues: { stock: oldStock },
            newValues: { stock: newStock, restockContainers: qtyNum, totalCost: effectiveCost },
            module: 'Inventory',
            details: `Restocked ${qtyNum} ${packageUnit} of ${selectedItem.name} (+${totalUnitsAdded} ${selectedItem.unit}) for ₱${effectiveCost.toFixed(2)}`,
            type: 'inventory' as any
        });

        toast.success(`Successfully restocked ${selectedItem.name} (+${qtyNum} ${packageUnit})`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] p-6 rounded-2xl border-0 shadow-2xl bg-white">
                <DialogHeader className="border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm">
                            <PackagePlus className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black tracking-wider text-gray-900 uppercase">
                                Restock Whole Product
                            </DialogTitle>
                            <p className="text-xs text-gray-500 font-medium">
                                Purchase and add whole containers (Jugs, Tubs, Cans) directly to inventory stock
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Select Item */}
                    <div>
                        <Label className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                            Select Inventory Item
                        </Label>
                        <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                            <SelectTrigger className="mt-1.5 w-full h-11 rounded-xl border border-gray-200 bg-gray-50/50 font-bold text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all">
                                <SelectValue placeholder="Choose an item..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 rounded-xl border border-gray-100 shadow-xl">
                                {inventoryData.map(item => {
                                    const itemPres = getInventoryPresentation(item);
                                    return (
                                        <SelectItem key={item.id} value={String(item.id)} className="font-semibold text-xs py-2">
                                            <span className="font-bold text-gray-900">{item.name}</span>
                                            <span className="ml-2 text-gray-400 font-medium">({itemPres.containersLabel || `${item.stock} ${item.unit}`}) - ₱{item.price || 0}</span>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Current Status Box */}
                    {selectedItem && (
                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-500 block">Current Stock</span>
                                <span className="text-sm font-black text-slate-900">{selectedItem.stock} {selectedItem.unit}</span>
                                {pres?.containersLabel && (
                                    <span className="text-xs font-extrabold text-indigo-600 ml-2">({pres.containersLabel})</span>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-slate-500 block">Package Price</span>
                                <span className="text-sm font-black text-emerald-700">₱{unitPrice.toFixed(2)} / {packageUnit}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Quantity in whole containers */}
                        <div>
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-700 block">
                                Quantity ({packageUnit}s)
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                step="1"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                className="mt-1.5 h-11 rounded-xl border border-gray-200 font-extrabold text-sm px-3.5 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                placeholder="e.g. 1, 2, 5"
                                required
                            />
                            {selectedItem && Number(quantity) > 0 && (
                                <p className="text-[10px] font-extrabold text-emerald-600 mt-1">
                                    ✓ Adds +{totalUnitsAdded.toLocaleString()} {selectedItem.unit} to stock
                                </p>
                            )}
                        </div>

                        {/* Total Restock Cost */}
                        <div>
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-700 block flex items-center justify-between">
                                <span>Total Cost (₱)</span>
                                <span className="text-[9px] text-gray-400 normal-case font-medium">(Editable)</span>
                            </Label>
                            <div className="relative mt-1.5">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">₱</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={customCost !== '' ? customCost : computedTotalCost ? computedTotalCost.toFixed(2) : '0.00'}
                                    onChange={e => setCustomCost(e.target.value)}
                                    className="h-11 rounded-xl border border-gray-200 font-black text-sm pl-8 pr-3 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-red-700 transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Restock Date & Notes */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-700 block">
                                Purchase Date
                            </Label>
                            <Input
                                type="date"
                                value={restockDate}
                                onChange={e => setRestockDate(e.target.value)}
                                className="mt-1.5 h-11 rounded-xl border border-gray-200 font-bold text-xs px-3 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                            />
                        </div>
                        <div>
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-700 block">
                                Receipt / Supplier Note
                            </Label>
                            <Input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="mt-1.5 h-11 rounded-xl border border-gray-200 font-semibold text-xs px-3 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                placeholder="e.g. Invoice #1042"
                            />
                        </div>
                    </div>

                    {/* Record as Expense Toggle */}
                    <div className="bg-red-50/40 border border-red-100 rounded-xl p-3.5 flex items-center justify-between mt-2">
                        <div>
                            <span className="text-xs font-black text-red-950 block uppercase tracking-wide">
                                Record in Expenses
                            </span>
                            <span className="text-[11px] font-medium text-red-800/80 block mt-0.5">
                                Automatically log this ₱{effectiveCost.toFixed(2)} purchase to financial overheads
                            </span>
                        </div>
                        <Switch
                            checked={recordExpense}
                            onCheckedChange={setRecordExpense}
                            className="data-[state=checked]:bg-red-600"
                        />
                    </div>

                    <DialogFooter className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-11 px-5 rounded-xl font-bold text-xs text-gray-600 uppercase border-gray-200 hover:bg-gray-100 tracking-wider"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="h-11 px-6 rounded-xl font-black text-xs text-white uppercase bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/25 transition-all tracking-wider flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirm Restock</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

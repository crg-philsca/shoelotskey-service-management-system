import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { useInventory } from '@/app/context/InventoryContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInventoryExpenseCategory } from '@/app/lib/expenseCategories';

interface RestockModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: { username?: string };
}

export default function RestockModal({ open, onOpenChange }: RestockModalProps) {
    const { inventoryData, updateStock } = useInventory();
    const { addExpense } = useExpenses();

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


    // Determine package unit & conversion rate
    const hasPackage = selectedItem && Number((selectedItem as any).package_size || (selectedItem as any).packageSize) > 0;
    const packageUnit = hasPackage 
        ? ((selectedItem as any).package_unit || (selectedItem as any).packageUnit || 'Package') 
        : (selectedItem?.unit || 'Unit');
    const packageSize = hasPackage 
        ? Number((selectedItem as any).package_size || (selectedItem as any).packageSize) 
        : 1;
    
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
        // 1. Update Inventory stock using adjustStock endpoint (negative quantity for restock)
        updateStock(selectedItem.id, -totalUnitsAdded);

        // 2. Log Expense if enabled
        if (recordExpense && effectiveCost > 0) {
            const expenseCat = getInventoryExpenseCategory(selectedItem.category);
            const formattedPrice = effectiveCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const breakdownHeader = `[${expenseCat.toUpperCase()} ITEMS BREAKDOWN]`;
            const itemLine = `• ${selectedItem.name}: ₱${formattedPrice}`;
            const restockRemark = `Restock: ${selectedItem.name} (+${qtyNum} ${packageUnit})${notes ? ` - ${notes}` : ''}`;
            const fullNotes = `${breakdownHeader}\n${itemLine}\n\n[ADDITIONAL NOTES]\n${restockRemark}`;

            addExpense({
                id: `exp_${Date.now()}`,
                amount: effectiveCost,
                category: expenseCat,
                notes: fullNotes,
                frequency: 'Restock',
                date: new Date(restockDate).toISOString()
            });
        }

        toast.success(`${selectedItem.name} restocked successfully. +${totalUnitsAdded.toLocaleString()} ${selectedItem.unit} added. Current stock: ${newStock.toLocaleString()} ${selectedItem.unit}.`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[520px] p-0 rounded-2xl border-0 shadow-2xl bg-white overflow-hidden flex flex-col max-h-[85vh]">
                <DialogHeader className="border-b border-gray-100 p-6 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-full text-center">
                            <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                                Restock Whole Product
                            </DialogTitle>
                            <DialogDescription className="text-xs text-gray-500 font-medium text-center mt-1">
                                Purchase and add whole containers directly to inventory stock
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">
                    <div className="overflow-y-auto p-6 pt-2 space-y-4 custom-scrollbar">
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

                                    return (
                                        <SelectItem key={item.id} value={String(item.id)} className="font-semibold text-xs py-2">
                                            <span className="font-bold text-gray-900">{item.name}</span>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Current Status Box */}
                    {selectedItem && (
                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Current Stock</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-slate-900">{selectedItem.stock} {selectedItem.unit}</span>
                                    {Number(selectedItem.stock) < 1000 && (
                                        <span className="text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.5 rounded shadow-sm border border-red-200">
                                            Low Stock
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Package Details</span>
                                <span className="text-xs font-black text-emerald-700">{packageUnit} • {packageSize} {selectedItem.unit}</span>
                                <p className="text-[9px] text-gray-400 font-bold mt-0.5">₱{unitPrice.toFixed(2)} per pkg</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Quantity in whole containers */}
                        <div>
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-700 block">
                                Packages to Purchase
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
                        </div>

                        {/* Total Restock Cost */}
                        <div>
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-700 block flex items-center justify-between">
                                <span>Purchase Cost (₱)</span>
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

                    {/* Stock Math Preview */}
                    {selectedItem && Number(quantity) > 0 && (
                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-800">
                            <span>Current: {selectedItem.stock} {selectedItem.unit}</span>
                            <span className="text-indigo-400">+</span>
                            <span>Restock: {totalUnitsAdded.toLocaleString()} {selectedItem.unit}</span>
                            <span className="text-indigo-400">=</span>
                            <span className="text-indigo-900 bg-indigo-200 px-2 py-0.5 rounded shadow-sm">New Stock: {(Number(selectedItem.stock) + totalUnitsAdded).toLocaleString()} {selectedItem.unit}</span>
                        </div>
                    )}

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
                                Reference Number (Optional)
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
                                Record this purchase as an expense. This restock will automatically create an expense transaction worth ₱{effectiveCost.toFixed(2)}.
                            </span>
                        </div>
                        <Switch
                            checked={recordExpense}
                            onCheckedChange={setRecordExpense}
                            className="data-[state=checked]:bg-red-600"
                        />
                    </div>

                    </div>
                    <DialogFooter className="p-6 pt-4 border-t border-gray-100 bg-white shrink-0 flex flex-row gap-3 sm:justify-end sm:space-x-0 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-9 border-gray-200 text-gray-700 rounded-lg font-black text-xs uppercase hover:bg-gray-200 tracking-widest flex items-center justify-center transition-all"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-9 rounded-lg font-black text-xs text-white uppercase bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25 transition-all tracking-widest flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

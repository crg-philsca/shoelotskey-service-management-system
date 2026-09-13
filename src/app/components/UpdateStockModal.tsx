import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useInventory } from '@/app/context/InventoryContext';
import { useActivities } from '@/app/context/ActivityContext';
import { CheckCircle2, PackageMinus, ArrowDownRight, ArrowUpRight, Scale, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';

interface UpdateStockModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialItem?: any;
    user?: { username?: string; token?: string };
}

type AdjustmentMode = 'deduct' | 'add' | 'set';

const COMMON_REASONS: Record<AdjustmentMode, string[]> = {
    deduct: [
        'Daily Service Usage',
        'Physical Count Audit (Shortage)',
        'Spillage / Damaged Material',
        'Extra Shoe Treatment',
        'Internal Workshop Consumption',
        'Other Deduction'
    ],
    add: [
        'Unused Material Return',
        'Physical Count Audit (Overage)',
        'Emergency Local Purchase',
        'Batch Adjustment',
        'Other Addition'
    ],
    set: [
        'Physical Count Audit Balance',
        'Monthly Stocktaking Reconciliation',
        'Inventory Reset',
        'Catalog Correction'
    ]
};

export default function UpdateStockModal({ open, onOpenChange, initialItem, user }: UpdateStockModalProps) {
    const { inventoryData, updateStock } = useInventory();
    const { addActivity } = useActivities();

    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [mode, setMode] = useState<AdjustmentMode>('deduct');
    const [quantity, setQuantity] = useState<string>('1');
    const [reason, setReason] = useState<string>('Daily Service Usage');
    const [reference, setReference] = useState<string>('');
    const [usageDate, setUsageDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize or select item when opening
    useEffect(() => {
        if (open) {
            if (initialItem && initialItem.id) {
                setSelectedItemId(String(initialItem.id));
            } else if (!selectedItemId && inventoryData.length > 0) {
                setSelectedItemId(String(inventoryData[0].id));
            }
            setQuantity('1');
            setMode('deduct');
            setReason('Daily Service Usage');
            setReference('');
            setUsageDate(new Date().toISOString().split('T')[0]);
        }
    }, [open, initialItem, inventoryData]);

    const selectedItem = inventoryData.find(i => String(i.id) === selectedItemId);
    const presentation = selectedItem ? getInventoryPresentation(selectedItem) : null;
    const currentStock = Number(selectedItem?.stock ?? 0);
    const unit = selectedItem?.unit || 'units';

    const countUnits = ['pcs', 'pc', 'pair', 'pairs', 'set', 'sets', 'item', 'items', 'bottle', 'bottles', 'box', 'boxes', 'can', 'cans', 'roll', 'rolls', 'sheet', 'sheets'];
    const isCount = countUnits.includes(unit.toLowerCase());

    // When mode changes, pick default reason
    const handleModeChange = (newMode: AdjustmentMode) => {
        setMode(newMode);
        setReason(COMMON_REASONS[newMode][0] || '');
        if (newMode === 'set' && selectedItem) {
            setQuantity(String(currentStock));
        } else if (quantity === String(currentStock)) {
            setQuantity(isCount ? '1' : '50');
        }
    };

    const qtyNum = parseFloat(quantity) || 0;

    // Calculate preview new stock
    let newStock = currentStock;
    if (mode === 'deduct') {
        newStock = currentStock - qtyNum;
    } else if (mode === 'add') {
        newStock = currentStock + qtyNum;
    } else if (mode === 'set') {
        newStock = qtyNum;
    }

    const hasStockError = mode === 'deduct' && qtyNum > currentStock;
    const isNegativeSet = mode === 'set' && qtyNum < 0;

    const quickValues = isCount 
        ? [1, 2, 5, 10] 
        : [10, 25, 50, 100, 250, 500];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) {
            toast.error('Please select an item to update.');
            return;
        }

        if (isNaN(qtyNum) || qtyNum < 0) {
            toast.error('Please enter a valid non-negative quantity.');
            return;
        }

        if (mode === 'deduct' && qtyNum <= 0) {
            toast.error('Please enter a usage quantity greater than 0.');
            return;
        }

        if (hasStockError) {
            toast.error(`Cannot deduct ${qtyNum} ${unit}. Current stock is only ${currentStock} ${unit}.`);
            return;
        }

        if (isNegativeSet) {
            toast.error('Stock balance cannot be negative.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Determine delta to pass to updateStock
            // updateStock expects: positive delta for deduction, negative delta for restock (per InventoryContext convention)
            let deltaForUpdateStock = 0;

            if (mode === 'deduct') {
                deltaForUpdateStock = qtyNum; // positive = deduction in updateStock
            } else if (mode === 'add') {
                deltaForUpdateStock = -qtyNum; // negative = restock in updateStock
            } else if (mode === 'set') {
                const diff = currentStock - qtyNum; // if current 10, set to 8, diff = +2 (deduct 2)
                deltaForUpdateStock = diff;
            }

            if (deltaForUpdateStock !== 0) {
                await updateStock(selectedItem.id, deltaForUpdateStock);
            }

            // Create rich system audit log
            const currentUser = user?.username || JSON.parse(localStorage.getItem('user') || '{"username": "Staff"}').username || 'Staff';
            const changeStr = mode === 'deduct' 
                ? `-${qtyNum} ${unit}` 
                : (mode === 'add' ? `+${qtyNum} ${unit}` : `Set to ${qtyNum} ${unit}`);
            
            const detailText = `Stock updated for '${selectedItem.name}' (${changeStr}). Reason: ${reason}${reference ? ` | Ref: ${reference}` : ''}. Stock balance: ${currentStock.toLocaleString()} → ${newStock.toLocaleString()} ${unit}.`;

            addActivity({
                user: currentUser,
                action: 'Update Stock Usage',
                details: detailText,
                type: 'inventory',
                recordId: selectedItem.id,
                oldValues: {
                    item_name: selectedItem.name,
                    stock_quantity: currentStock,
                    unit: selectedItem.unit,
                    status: selectedItem.status
                },
                newValues: {
                    item_name: selectedItem.name,
                    stock_quantity: newStock,
                    unit: selectedItem.unit,
                    adjustment_mode: mode,
                    change_amount: changeStr,
                    reason,
                    reference_no: reference || undefined,
                    details: detailText
                }
            });

            toast.success(`Stock updated for ${selectedItem.name}. New balance: ${newStock.toLocaleString()} ${unit}.`);
            onOpenChange(false);
        } catch (err: any) {
            console.error('Error updating stock usage:', err);
            toast.error(err?.message || 'Failed to update stock usage.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[480px] p-0 rounded-2xl border-0 shadow-2xl bg-white overflow-hidden flex flex-col max-h-[88vh]">
                <DialogHeader className="border-b border-gray-100 p-6 pb-4 shrink-0 bg-emerald-700 text-white text-center">
                    <div className="mx-auto w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2">
                        <PackageMinus size={20} className="text-white" />
                    </div>
                    <DialogTitle className="text-xl font-bold uppercase tracking-wide text-white text-center">
                        Update Stock Usage
                    </DialogTitle>
                    <DialogDescription className="text-xs text-emerald-100 font-medium text-center mt-1">
                        Record material consumption or adjust physical inventory with audit trail
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">
                    <div className="overflow-y-auto p-6 pt-3 space-y-4 custom-scrollbar">
                        {/* Mode Selector Tabs */}
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                                Action Type
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('deduct')}
                                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                                        mode === 'deduct'
                                            ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <ArrowDownRight size={14} className={mode === 'deduct' ? 'text-rose-600' : 'text-gray-400'} />
                                    <span>Deduct Usage</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('add')}
                                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                                        mode === 'add'
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <ArrowUpRight size={14} className={mode === 'add' ? 'text-emerald-600' : 'text-gray-400'} />
                                    <span>Add Stock</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('set')}
                                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                                        mode === 'set'
                                            ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <Scale size={14} className={mode === 'set' ? 'text-blue-600' : 'text-gray-400'} />
                                    <span>Set Balance</span>
                                </button>
                            </div>
                        </div>

                        {/* Select Item */}
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block">
                                Select Inventory Item
                            </Label>
                            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                                <SelectTrigger className="mt-1.5 w-full h-11 rounded-xl border border-gray-200 bg-gray-50/60 font-bold text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all">
                                    <SelectValue placeholder="Choose an item..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-56 max-w-[calc(100vw-3rem)] sm:max-w-[420px] w-full overflow-y-auto z-50">
                                    {inventoryData.map(item => {
                                        const pres = getInventoryPresentation(item);
                                        return (
                                            <SelectItem key={item.id} value={String(item.id)} className="font-semibold text-xs py-2">
                                                <div className="flex items-center justify-between gap-2 w-full max-w-[340px] truncate text-left">
                                                    <span className="font-bold text-gray-900 truncate">{item.name}</span>
                                                    <span className="text-gray-500 font-normal shrink-0 text-[11px]">({pres.availableText})</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Current Status Box */}
                        {selectedItem && presentation && (
                            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Current Stock</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-slate-900">{currentStock.toLocaleString()} {unit}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-xs border ${
                                            presentation.stockStatus === 'In Stock'
                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                : presentation.stockStatus === 'Low Stock'
                                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                                    : 'bg-rose-100 text-rose-800 border-rose-200'
                                        }`}>
                                            {presentation.stockStatus}
                                        </span>
                                    </div>
                                    {presentation.isPackaged && (
                                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">{presentation.containersLabel}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Category & Measure</span>
                                    <span className="text-xs font-black text-slate-800">{selectedItem.category || 'General'}</span>
                                    <p className="text-[9px] text-gray-400 font-bold mt-0.5">Base Unit: {unit}</p>
                                </div>
                            </div>
                        )}

                        {/* Quantity & Quick Adjust */}
                        <div>
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block">
                                    {mode === 'deduct' ? 'Usage Quantity to Deduct' : (mode === 'add' ? 'Quantity to Add' : 'New Total Stock Balance')} ({unit})
                                </Label>
                                {mode !== 'set' && (
                                    <div className="flex items-center gap-1">
                                        {quickValues.map(v => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setQuantity(String(v))}
                                                className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 text-gray-600 transition-colors"
                                            >
                                                +{v}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="relative mt-1.5">
                                <Input
                                    type="number"
                                    step={isCount ? "1" : "0.01"}
                                    min="0"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                    className={`h-11 rounded-xl border font-extrabold text-sm px-3.5 bg-gray-50/50 focus:bg-white focus:ring-2 transition-all ${
                                        hasStockError || isNegativeSet
                                            ? 'border-rose-400 text-rose-700 focus:ring-rose-500/20 focus:border-rose-500'
                                            : 'border-gray-200 text-gray-900 focus:ring-emerald-500/20 focus:border-emerald-600'
                                    }`}
                                    placeholder={isCount ? "e.g. 1" : "e.g. 50"}
                                    required
                                />
                            </div>
                        </div>

                        {/* Stock Math Preview */}
                        {selectedItem && (
                            <div className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-between ${
                                hasStockError
                                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            }`}>
                                <div className="flex items-center gap-1.5">
                                    {hasStockError ? <AlertTriangle size={14} className="text-rose-600 shrink-0" /> : <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
                                    <span>
                                        Current: <strong className="font-black">{currentStock.toLocaleString()} {unit}</strong>
                                    </span>
                                </div>
                                <div>
                                    <span>
                                        {mode === 'deduct' && `Usage: -${qtyNum.toLocaleString()} ${unit}`}
                                        {mode === 'add' && `Added: +${qtyNum.toLocaleString()} ${unit}`}
                                        {mode === 'set' && `New Balance`}
                                    </span>
                                    <span className="mx-1.5">→</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                        hasStockError ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'
                                    }`}>
                                        New: {newStock.toLocaleString()} {unit}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Reason & Reference */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block">
                                    Usage Reason
                                </Label>
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger className="mt-1.5 h-10 rounded-xl border border-gray-200 bg-gray-50/60 font-semibold text-xs text-gray-800 focus:bg-white">
                                        <SelectValue placeholder="Select reason..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-56 z-50">
                                        {COMMON_REASONS[mode].map((r: string) => (
                                            <SelectItem key={r} value={r} className="text-xs py-1.5">
                                                {r}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block">
                                    Reference / Job Order #
                                </Label>
                                <Input
                                    type="text"
                                    value={reference}
                                    onChange={e => setReference(e.target.value)}
                                    className="mt-1.5 h-10 rounded-xl border border-gray-200 font-semibold text-xs px-3 bg-gray-50/60 focus:bg-white focus:border-emerald-600"
                                    placeholder="e.g. ORD-001 / Audit"
                                />
                            </div>
                        </div>

                        {/* Date */}
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block">
                                Recorded Date
                            </Label>
                            <Input
                                type="date"
                                value={usageDate}
                                onChange={e => setUsageDate(e.target.value)}
                                className="mt-1.5 h-10 rounded-xl border border-gray-200 font-bold text-xs px-3 bg-gray-50/60 focus:bg-white focus:border-emerald-600"
                            />
                        </div>

                        {/* Audit Trail Guarantee Notice */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
                            <strong className="text-slate-800 font-black uppercase text-[10px] block mb-0.5">Audit Trail Guaranteed:</strong>
                            Every adjustment is automatically stamped with user credentials, before/after balances, timestamps, and logged to Activity History & Inventory Logs.
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t border-gray-100 bg-white shrink-0 flex flex-row gap-3 sm:justify-end sm:space-x-0 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-9 border-gray-200 text-gray-700 rounded-lg font-black text-xs uppercase hover:bg-gray-100 tracking-widest flex items-center justify-center transition-all"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={hasStockError || isNegativeSet || isSubmitting || !selectedItem}
                            className="flex-1 h-9 rounded-lg font-black text-xs text-white uppercase bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? 'Saving...' : 'Save Stock'}</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

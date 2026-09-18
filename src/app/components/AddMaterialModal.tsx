import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useInventory } from '@/app/context/InventoryContext';
import { API_BASE } from '@/app/lib/apiBase';
import { Package, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddMaterialModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string | number;
    orderNumber: string;
    itemId?: string | number;
    itemLabel?: string;
    onSuccess?: (material: any) => void;
    user?: any;
}

export default function AddMaterialModal({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    itemId,
    itemLabel = "Pair #1",
    onSuccess,
    user
}: AddMaterialModalProps) {
    const { inventoryData, refreshInventory } = useInventory();
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('1');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState<string>('');

    // Generate fresh idempotency key each time modal is opened
    useEffect(() => {
        if (open) {
            setIdempotencyKey(`mat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
            setSelectedItemId('');
            setQuantity('1');
            setNotes('');
        }
    }, [open]);

    // Active inventory items with positive stock preferred
    const availableItems = inventoryData.filter(i => i.isActive);

    const selectedInventoryItem = availableItems.find(i => String(i.id) === selectedItemId);

    // Auto-fill suggested consumption quantity when material is chosen
    const handleSelectMaterial = (val: string) => {
        setSelectedItemId(val);
        const item = availableItems.find(i => String(i.id) === val);
        if (item) {
            const defaultQty = item.consumption_qty && item.consumption_qty > 0 ? item.consumption_qty : 1;
            setQuantity(String(defaultQty));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInventoryItem) {
            toast.error("Please select a material");
            return;
        }

        const qtyNum = parseFloat(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            toast.error("Please enter a valid quantity greater than 0");
            return;
        }

        if (qtyNum > selectedInventoryItem.stock) {
            toast.error(`Cannot exceed current stock (${selectedInventoryItem.stock} ${selectedInventoryItem.unit || 'units'} available)`);
            return;
        }

        setIsSubmitting(true);
        try {
            const token = user?.token || JSON.parse(localStorage.getItem('user') || '{}')?.token || localStorage.getItem('token') || '';
            const dbOrderId = parseInt(String(orderId), 10);
            const dbItemId = itemId ? parseInt(String(itemId), 10) : undefined;

            const res = await fetch(`${API_BASE}/orders/${dbOrderId}/materials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    item_id: isNaN(Number(dbItemId)) ? undefined : dbItemId,
                    inventory_id: selectedInventoryItem.id,
                    quantity: qtyNum,
                    unit: selectedInventoryItem.unit || 'units',
                    notes: notes.trim() || undefined,
                    idempotency_key: idempotencyKey
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Failed to log material");
            }

            const data = await res.json();
            toast.success(`Logged ${qtyNum} ${selectedInventoryItem.unit || ''} of ${selectedInventoryItem.name}`);
            
            // Refresh global inventory so counts immediately reflect deduction
            refreshInventory();
            
            if (onSuccess) {
                onSuccess(data.material);
            }
            onOpenChange(false);
        } catch (err: any) {
            console.error("Add material error:", err);
            toast.error(err.message || "Failed to add material");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="bg-slate-900 px-5 py-4 text-white">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white/10 rounded-lg flex items-center justify-center text-white">
                            <Package size={18} />
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-black uppercase tracking-wider text-white">
                                Add Material / Supply
                            </DialogTitle>
                            <DialogDescription className="text-[11px] text-slate-300 font-medium mt-0.5">
                                Order #{orderNumber} • <span className="text-red-400 font-bold">{itemLabel}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                    {/* Material Select */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Select Material <span className="text-red-500">*</span>
                        </Label>
                        <Select value={selectedItemId} onValueChange={handleSelectMaterial}>
                            <SelectTrigger className="h-9 border-slate-200 focus:border-red-500 rounded-lg text-xs font-semibold bg-white">
                                <SelectValue placeholder="Choose supply / chemical..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
                                {availableItems.map(inv => (
                                    <SelectItem key={inv.id} value={String(inv.id)} className="text-xs">
                                        <div className="flex items-center justify-between w-full gap-3">
                                            <span className="font-bold text-slate-800">{inv.name}</span>
                                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                                inv.stock <= 0 
                                                    ? 'bg-rose-50 text-rose-700 font-bold' 
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {inv.stock} {inv.unit || 'units'}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Quantity & Unit Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Quantity Used <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                value={quantity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) setQuantity(val);
                                }}
                                placeholder="1"
                                className="h-9 border-slate-200 focus:border-red-500 rounded-lg text-xs font-bold font-mono"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Unit <span className="text-slate-400 font-normal lowercase">(auto)</span>
                            </Label>
                            <div className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                                {selectedInventoryItem?.unit || '—'}
                            </div>
                        </div>
                    </div>

                    {/* Optional Notes */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Usage Notes <span className="text-slate-400 font-normal lowercase">(optional)</span>
                        </Label>
                        <Input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Midsole reglue extra coat, deep clean scrub"
                            className="h-9 border-slate-200 focus:border-red-500 rounded-lg text-xs"
                        />
                    </div>

                    {/* Stock Preview Helper */}
                    {selectedInventoryItem && (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Stock After Deduction:</span>
                            <span className="font-mono font-bold text-slate-900">
                                {Math.max(0, selectedInventoryItem.stock - (parseFloat(quantity) || 0)).toFixed(1)} {selectedInventoryItem.unit}
                            </span>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="h-9 px-4 text-xs font-bold text-slate-700 rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !selectedItemId || !quantity || parseFloat(quantity) <= 0}
                            className="h-9 px-5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm gap-1.5"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Recording...</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={13} strokeWidth={3} />
                                    <span>Log Material</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

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
import { hasPermission } from '@/app/lib/permissions';

interface AddMaterialModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string | number;
    orderNumber: string;
    orderStatus?: string;
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
    orderStatus,
    itemId,
    itemLabel = "Pair #1",
    onSuccess,
    user
}: AddMaterialModalProps) {
    const { inventoryData, refreshInventory } = useInventory();
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState<string>('');

    // Generate fresh idempotency key each time modal is opened
    useEffect(() => {
        if (open) {
            setIdempotencyKey(`mat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
            setSelectedItemId('');
            setQuantity('');
            setNotes('');
        }
    }, [open]);

    // Active inventory items with positive stock preferred
    const availableItems = inventoryData.filter(i => i.isActive);

    const selectedInventoryItem = availableItems.find(i => String(i.id) === selectedItemId);

    const normalizedOrderStatus = (orderStatus || '').toLowerCase().trim();
    const isLockedOrder = ['claimed', 'cancelled'].includes(normalizedOrderStatus);

    // Manual actual usage: Prompt user for actual recorded amount consumed
    const handleSelectMaterial = (val: string) => {
        setSelectedItemId(val);
        setQuantity('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOrder) {
            toast.error(`Cannot record material usage on a locked order (${orderStatus || 'Locked'}). Material usage can only be recorded on active orders.`);
            return;
        }
        if (user && !hasPermission(user, 'inventory.use_stock') && !hasPermission(user, 'inventory.edit')) {
            toast.error("You do not have permission to deduct inventory materials.");
            return;
        }
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
                    {isLockedOrder && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                            <p className="font-bold flex items-center gap-1.5 text-amber-800">
                                🔒 Order is Locked ({orderStatus || 'Completed'})
                            </p>
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                Actual material consumption can only be recorded on active orders (New Order, On-going, For Release). Claimed and cancelled orders cannot have new material usage recorded.
                            </p>
                        </div>
                    )}

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
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    Actual Qty Used <span className="text-red-500">*</span>
                                </Label>
                                {selectedInventoryItem && (
                                    <span className="text-[9.5px] font-mono text-slate-500">
                                        Max: <strong className="text-slate-800">{selectedInventoryItem.stock}</strong>
                                    </span>
                                )}
                            </div>
                            <Input
                                type="text"
                                inputMode="decimal"
                                value={quantity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) setQuantity(val);
                                }}
                                placeholder="Enter qty used"
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
                            disabled={isSubmitting || isLockedOrder || !selectedItemId || !quantity || parseFloat(quantity) <= 0}
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

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { JobOrder, PaymentMethod, InventoryUsed } from "@/app/types";
import { CheckCircle2, User, ShieldAlert, Wrench, ShoppingBag, Plus, Minus, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatReferenceNo } from "@/app/lib/utils";
import { useInventory } from "@/app/context/InventoryContext";
import { useActivity } from "@/app/context/ActivityContext";
import { getInventoryPresentation } from "@/app/lib/inventoryPresentation";

interface ProcessClaimModalProps {
    order: JobOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (
        orderId: string,
        data: {
            claimedBy: string;
            paymentMethod?: PaymentMethod;
            amountReceived?: number;
            change?: number;
            paymentStatus: 'fully-paid';
            status: 'claimed';
            actualCompletionDate: Date;
            updatedAt: Date;
            referenceNo?: string;
            grandTotal?: number;
            inventoryUsed?: InventoryUsed[];
            inventoryApplied?: boolean;
            refundAmount?: number;
            refundReason?: string;
        }
    ) => void;
    user?: { username: string; role?: string };
}

export default function ProcessClaimModal({ order, open, onOpenChange, onConfirm, user }: ProcessClaimModalProps) {
    const { inventoryData, updateStock } = useInventory();
    const { addActivity } = useActivity();

    const [claimedBy, setClaimedBy] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [amountReceived, setAmountReceived] = useState<number>(0);
    const [change, setChange] = useState<number>(0);
    const [referenceNo, setReferenceNo] = useState("");

    // Conditional refund states
    const [enableRefund, setEnableRefund] = useState(false);
    const [refundReason, setRefundReason] = useState("Minor Restoration: Paint did not adhere to shoes and faded");
    const [customRefundReason, setCustomRefundReason] = useState("");
    const [refundAmount, setRefundAmount] = useState<number>(0);

    // [REQUIREMENT 5] Optional Section 1: Materials Used (Service Supplies)
    const [showMaterialsSection, setShowMaterialsSection] = useState(false);
    const [recordedMaterials, setRecordedMaterials] = useState<InventoryUsed[]>([]);
    const [matInputs, setMatInputs] = useState<Record<number, string>>({});
    const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState<string>('');

    // [REQUIREMENT 5] Optional Section 2: Additional Products Purchased (Pickup Retail)
    const [showRetailSection, setShowRetailSection] = useState(false);
    const [purchasedProducts, setPurchasedProducts] = useState<InventoryUsed[]>([]);
    const [selectedRetailToAdd, setSelectedRetailToAdd] = useState<string>('');
    const [retailQtyInput, setRetailQtyInput] = useState<string>("1");
    const [retailPriceInput, setRetailPriceInput] = useState<string>("0");

    // Receipt modal state
    const [showReceipt, setShowReceipt] = useState(false);
    const [claimedOrderSummary, setClaimedOrderSummary] = useState<any>(null);

    useEffect(() => {
        if (order && open) {
            setClaimedBy(order.customerName);
            setPaymentMethod("cash");
            setAmountReceived(0);
            setChange(0);
            setReferenceNo("");
            setEnableRefund(false);
            setRefundReason("Minor Restoration: Paint did not adhere to shoes and faded");
            setCustomRefundReason("");
            setRefundAmount(0);
            setShowMaterialsSection(false);
            setShowRetailSection(false);
            setShowReceipt(false);

            // Parse recorded materials from order.inventoryUsed
            let rawUsed = order.inventoryUsed || [];
            if (typeof rawUsed === 'string') {
                try { rawUsed = JSON.parse(rawUsed); } catch (e) { rawUsed = []; }
            }
            if (rawUsed && typeof rawUsed === 'object' && !Array.isArray(rawUsed)) {
                rawUsed = Object.values(rawUsed);
            }
            const parsedArray: InventoryUsed[] = Array.isArray(rawUsed) ? [...rawUsed] : [];
            
            const serviceMats = parsedArray.filter(i => !i.isRetail);
            const retailMats = parsedArray.filter(i => i.isRetail);
            
            setRecordedMaterials(serviceMats);
            setPurchasedProducts(retailMats);

            const inputMap: Record<number, string> = {};
            serviceMats.forEach(i => { inputMap[i.itemId] = String(i.quantity); });
            setMatInputs(inputMap);
        }
    }, [order, open]);

    // Update default price when selecting a retail item
    useEffect(() => {
        if (selectedRetailToAdd) {
            const item = inventoryData.find(i => i.id.toString() === selectedRetailToAdd);
            if (item) {
                setRetailPriceInput(String(item.price || 150));
            }
        }
    }, [selectedRetailToAdd, inventoryData]);

    // Financial totals with additional retail products and conditional refunds accounted for
    const baseTotal = order?.grandTotal || 0;
    const retailTotal = purchasedProducts.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);
    const totalAmount = baseTotal + retailTotal;
    const amountPaid = order?.amountReceived || 0;
    const effectiveTotal = Math.max(0, totalAmount - (enableRefund ? refundAmount : 0));
    const isFullyPaid = order?.paymentStatus === 'fully-paid' && retailTotal === 0 && (!enableRefund || refundAmount === 0);
    const remainingBalance = isFullyPaid ? 0 : Math.max(0, effectiveTotal - amountPaid);

    useEffect(() => {
        if (remainingBalance > 0) {
            setChange(Math.max(0, amountReceived - remainingBalance));
        } else {
            setChange(0);
        }
    }, [amountReceived, remainingBalance]);

    // Handlers for Materials Used adjustment before claim
    const handleAddMaterial = (itemIdStr: string) => {
        const item = inventoryData.find(i => i.id.toString() === itemIdStr);
        if (!item) return;
        if (recordedMaterials.some(m => m.itemId === item.id)) {
            toast.error("Material already added to service record");
            return;
        }
        const isPackaged = item.package_size && item.package_size > 0;
        const defaultQty = isPackaged ? (item.consumption_qty || 10) : 1;
        const displayUnit = isPackaged ? (item.package_unit || item.unit) : item.unit;
        
        const updated = [...recordedMaterials, {
            itemId: item.id,
            name: item.name,
            quantity: defaultQty,
            unit: displayUnit || 'mL',
            staffMember: user?.username || 'Staff',
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            isRetail: false
        }];
        setRecordedMaterials(updated);
        setMatInputs(prev => ({ ...prev, [item.id]: String(defaultQty) }));
        setSelectedMaterialToAdd('');
    };

    const handleQuickAddMat = (itemId: number, addVal: number) => {
        setRecordedMaterials(prev => prev.map(m => {
            if (m.itemId !== itemId) return m;
            const newQty = parseFloat((m.quantity + addVal).toFixed(2));
            setMatInputs(im => ({ ...im, [itemId]: String(newQty) }));
            return { ...m, quantity: newQty, staffMember: user?.username || m.staffMember || 'Staff' };
        }));
    };

    // Handlers for Additional Retail Products Purchased
    const handleAddRetailProduct = () => {
        const item = inventoryData.find(i => i.id.toString() === selectedRetailToAdd);
        if (!item) return;
        const qty = parseFloat(retailQtyInput) || 1;
        const price = parseFloat(retailPriceInput) || 0;
        if (qty <= 0) {
            toast.error("Quantity must be greater than 0");
            return;
        }
        if (qty > item.stock) {
            toast.error("Insufficient stock available.");
            return;
        }
        if (purchasedProducts.some(p => p.itemId === item.id)) {
            setPurchasedProducts(prev => prev.map(p => 
                p.itemId === item.id ? { ...p, quantity: p.quantity + qty, price } : p
            ));
        } else {
            setPurchasedProducts(prev => [...prev, {
                itemId: item.id,
                name: item.name,
                quantity: qty,
                unit: item.unit || 'pcs',
                price: price,
                staffMember: user?.username || 'Staff',
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                isRetail: true
            }]);
        }
        setSelectedRetailToAdd('');
        setRetailQtyInput("1");
        toast.success(`Added retail product: ${item.name}`);
    };

    const handleConfirm = () => {
        if (!order) return;
        if (remainingBalance > 0 && amountReceived < remainingBalance) {
            toast.error("Insufficient amount received to cover the remaining balance due.");
            return;
        }

        if (order.inventoryApplied && purchasedProducts.length === 0 && order.status === 'claimed') {
            toast.error("Inventory usage has already been applied.");
            return;
        }

        if (!order.inventoryApplied) {
            for (const item of recordedMaterials) {
                const invItem = inventoryData.find(i => i.id === item.itemId);
                if (invItem && item.quantity > invItem.stock) {
                    toast.error("Insufficient stock available.");
                    return;
                }
            }
        }
        for (const prod of purchasedProducts) {
            const invItem = inventoryData.find(i => i.id === prod.itemId);
            if (invItem && prod.quantity > invItem.stock) {
                toast.error("Insufficient stock available.");
                return;
            }
        }

        const timestamp = new Date();
        const currentUser = user?.username || "Staff";
        const currentRole = user?.role || "Staff";

        // [REQUIREMENT 4 & 6] Deduct Service Materials ONLY upon claiming if not yet applied
        const dbId = parseInt(order.id);
        const orderIdVal = isNaN(dbId) ? undefined : dbId;

        recordedMaterials.forEach(item => {
            if (item.quantity > 0) {
                const invItem = inventoryData.find(i => i.id === item.itemId);
                const oldStock = invItem ? invItem.stock : 0;
                const newStock = Math.max(0, oldStock - item.quantity);
                const unit = invItem?.unit || item.unit || 'mL';

                if (!order.inventoryApplied) {
                    updateStock(item.itemId, item.quantity, orderIdVal);
                    // Record granular Audit Trail in requested From -> To format
                    addActivity({
                        type: 'inventory',
                        module: 'Inventory',
                        table: 'Inventory',
                        recordId: item.itemId,
                        user: currentUser,
                        role: currentRole,
                        action: `${item.name}: ${oldStock} → ${newStock} ${unit} (Updated by ${currentUser})`,
                        details: `Job Order ID: #${order.orderNumber} | Material: ${item.name}: ${oldStock} → ${newStock} ${unit} (Updated by ${currentUser}) | Timestamp: ${timestamp.toLocaleString()}`
                    });
                } else {
                    toast.error("Inventory usage has already been applied.");
                }
            }
        });

        // [REQUIREMENT 5 & 6] Deduct Retail Products Purchased and Record Audit Trail
        purchasedProducts.forEach(prod => {
            if (prod.quantity > 0) {
                const invItem = inventoryData.find(i => i.id === prod.itemId);
                const oldStock = invItem ? invItem.stock : 0;
                const newStock = Math.max(0, oldStock - prod.quantity);
                const unit = invItem?.unit || prod.unit || 'pcs';

                updateStock(prod.itemId, prod.quantity, orderIdVal);
                addActivity({
                    type: 'inventory',
                    module: 'Inventory',
                    table: 'Inventory',
                    recordId: prod.itemId,
                    user: currentUser,
                    role: currentRole,
                    action: `${prod.name}: ${oldStock} → ${newStock} ${unit} (Updated by ${currentUser})`,
                    details: `Job Order ID: #${order.orderNumber} | Retail Product: ${prod.name}: ${oldStock} → ${newStock} ${unit} | Total: ₱${((prod.quantity || 1) * (prod.price || 0)).toFixed(2)} | Processed By: ${currentUser}`
                });
            }
        });

        const allInventoryUsed = [...recordedMaterials, ...purchasedProducts];

        const updateData: any = {
            claimedBy,
            status: 'claimed',
            updatedAt: timestamp,
            actualCompletionDate: timestamp,
            grandTotal: effectiveTotal,
            inventoryUsed: allInventoryUsed,
            inventoryApplied: true
        };

        let currentTotal = effectiveTotal;
        if (enableRefund && refundAmount > 0) {
            const finalReason = refundReason === 'Custom Quality / Service Warranty Defect' ? customRefundReason : refundReason;
            updateData.refundAmount = refundAmount;
            updateData.refundReason = finalReason;
        }

        if (remainingBalance > 0) {
            updateData.paymentStatus = 'fully-paid';
            updateData.paymentMethod = paymentMethod;
            updateData.amountReceived = (order.amountReceived || 0) + amountReceived;
            updateData.balance = 0;
            updateData.change = Math.max(0, updateData.amountReceived - currentTotal);
            if (['gcash', 'maya'].includes(paymentMethod)) {
                updateData.referenceNo = referenceNo;
            }
        } else {
            updateData.paymentStatus = 'fully-paid';
            updateData.balance = 0;
            if (enableRefund && refundAmount > 0) {
                updateData.amountReceived = Math.max(0, (order.amountReceived || 0) - refundAmount + retailTotal);
            } else if (retailTotal > 0) {
                updateData.amountReceived = (order.amountReceived || 0) + retailTotal;
            }
        }

        // Execute changes to order and trigger real-time system updates
        onConfirm(order.id, updateData);
        toast.success(`Order #${order.orderNumber} claimed and inventory automatically deducted!`);

        // Prepare receipt data and display receipt modal
        setClaimedOrderSummary({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            contactNumber: order.contactNumber || 'N/A',
            claimedBy,
            processedBy: currentUser,
            claimDate: timestamp.toLocaleString(),
            baseTotal,
            retailTotal,
            refundAmount: enableRefund ? refundAmount : 0,
            refundReason: enableRefund ? (refundReason === 'Custom Quality / Service Warranty Defect' ? customRefundReason : refundReason) : null,
            grandTotal: effectiveTotal,
            amountPaid: updateData.amountReceived || order.amountReceived || effectiveTotal,
            paymentMethod: remainingBalance > 0 ? paymentMethod : (order.paymentMethod || 'cash'),
            referenceNo: remainingBalance > 0 ? referenceNo : order.referenceNo,
            change: updateData.change || 0,
            services: order.items || [],
            recordedMaterials,
            purchasedProducts
        });

        setShowReceipt(true);
    };

    const isPaymentValid = (remainingBalance <= 0 || amountReceived >= remainingBalance) &&
        (paymentMethod === 'gcash' ? referenceNo.replace(/\D/g, '').length === 13 : paymentMethod === 'maya' ? referenceNo.replace(/[^a-zA-Z0-9]/g, '').length === 12 : true) &&
        (!enableRefund || (refundAmount >= 0 && refundAmount <= totalAmount && (refundReason !== 'Custom Quality / Service Warranty Defect' || customRefundReason.trim().length > 0)));

    if (!order) return null;

    return (
        <>
            <Dialog open={open && !showReceipt} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[480px] max-h-[88vh] flex flex-col bg-white p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                    <DialogHeader className="px-5 py-3.5 bg-white border-b border-gray-50 flex flex-row items-center justify-between shrink-0">
                        <DialogTitle className="text-[14px] font-black uppercase tracking-tight text-gray-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-red-600" />
                            Process Claim & Finalize Inventory
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-4 space-y-3.5 overflow-y-auto max-h-[68vh] flex-1 custom-scrollbar">
                        {/* Compact Order Summary Card */}
                        <div className="bg-[#F9FAFB] p-3 rounded-xl border border-gray-100 flex flex-col gap-2 shadow-sm">
                            <div className="flex justify-between items-start border-b border-gray-200/50 pb-2">
                                <div>
                                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Order ID</p>
                                    <p className="text-[11px] font-bold text-gray-900">{order.orderNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Customer</p>
                                    <p className="text-[11px] font-bold text-gray-900 truncate max-w-[140px]">{order.customerName}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-0.5">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Balance Due</p>
                                    <p className={`text-xl font-black leading-none tracking-tight ${remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ₱{remainingBalance.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-0.5">
                                    <div className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-[9px] font-bold text-gray-600 whitespace-nowrap">
                                        Total: ₱{effectiveTotal.toFixed(2)} {retailTotal > 0 && `(incl. +₱${retailTotal} retail)`}
                                    </div>
                                    <div className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-bold text-emerald-600 whitespace-nowrap">
                                        Previously Paid: ₱{(order.amountReceived || 0).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Form Fields Section */}
                        <div className="space-y-3">
                            {/* Claimed By */}
                            <div className="space-y-1">
                                <Label htmlFor="claimedBy" className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-red-500"></span>
                                    Claimed By
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                                    <Input
                                        id="claimedBy"
                                        value={claimedBy}
                                        onChange={(e) => setClaimedBy(e.target.value)}
                                        className="pl-8 h-9 text-[11px] font-medium bg-white border-gray-200 rounded-lg focus:border-red-400 focus:ring-red-50 transition-all shadow-sm"
                                        placeholder="Enter claimer name"
                                    />
                                </div>
                            </div>

                            {/* [REQUIREMENT 5] Optional Section 1: Materials Used (Service Supplies) */}
                            <div className="pt-2 border-t border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/60 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showMaterialsSection}
                                        onChange={(e) => setShowMaterialsSection(e.target.checked)}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-wide text-emerald-900 flex items-center gap-1.5 flex-1">
                                        <Wrench className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        Review / Adjust Materials Used ({recordedMaterials.length})
                                    </span>
                                    <span className="text-[9px] font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-100">
                                        {showMaterialsSection ? 'Hide' : 'Expand'}
                                    </span>
                                </label>

                                {showMaterialsSection && (
                                    <div className="mt-2 p-3 bg-white border border-emerald-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
                                        <div className="flex gap-2 items-center">
                                            <Select value={selectedMaterialToAdd} onValueChange={setSelectedMaterialToAdd}>
                                                <SelectTrigger className="flex-1 h-8 text-[11px] font-bold bg-gray-50 border-gray-100 rounded-lg">
                                                    <SelectValue placeholder="Add material..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {inventoryData.filter(i => i.isActive).map(item => {
                                                        const pres = getInventoryPresentation(item);
                                                        return (
                                                            <SelectItem key={item.id} value={item.id.toString()} className="text-[11px]">
                                                                <span className="font-bold">{item.name}</span> <span className="text-gray-400 font-normal">({pres.availableText})</span>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                onClick={() => handleAddMaterial(selectedMaterialToAdd)}
                                                disabled={!selectedMaterialToAdd}
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-3 rounded-lg"
                                            >
                                                Add
                                            </Button>
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {recordedMaterials.map(mat => (
                                                <div key={mat.itemId} className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs font-black text-gray-800">{mat.name}</p>
                                                            <p className="text-[9px] font-bold text-gray-400 uppercase">{mat.unit}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    const n = Math.max(0, parseFloat((mat.quantity - 1).toFixed(2)));
                                                                    setMatInputs(im => ({ ...im, [mat.itemId]: String(n) }));
                                                                    setRecordedMaterials(pv => pv.map(m => m.itemId === mat.itemId ? { ...m, quantity: n } : m));
                                                                }}
                                                                className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-500 hover:text-red-500 flex items-center justify-center font-black text-xs"
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={matInputs[mat.itemId] ?? String(mat.quantity)}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
                                                                        setMatInputs(im => ({ ...im, [mat.itemId]: raw }));
                                                                        const v = parseFloat(raw);
                                                                        if (!isNaN(v)) {
                                                                            setRecordedMaterials(pv => pv.map(m => m.itemId === mat.itemId ? { ...m, quantity: v } : m));
                                                                        }
                                                                    }
                                                                }}
                                                                onBlur={() => {
                                                                    const v = parseFloat(matInputs[mat.itemId] ?? '') || 0;
                                                                    setMatInputs(im => ({ ...im, [mat.itemId]: String(v) }));
                                                                    setRecordedMaterials(pv => pv.map(m => m.itemId === mat.itemId ? { ...m, quantity: v } : m));
                                                                }}
                                                                className="w-12 text-center text-xs font-black bg-white border border-gray-200 rounded py-0.5"
                                                            />
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    const n = parseFloat((mat.quantity + 1).toFixed(2));
                                                                    setMatInputs(im => ({ ...im, [mat.itemId]: String(n) }));
                                                                    setRecordedMaterials(pv => pv.map(m => m.itemId === mat.itemId ? { ...m, quantity: n } : m));
                                                                }}
                                                                className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-500 hover:text-emerald-600 flex items-center justify-center font-black text-xs"
                                                            >
                                                                +
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRecordedMaterials(pv => pv.filter(m => m.itemId !== mat.itemId))}
                                                                className="text-gray-400 hover:text-red-500 p-1 ml-1"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-gray-200/50">
                                                        <span className="text-[8px] font-extrabold uppercase text-gray-400 mr-1">Quick:</span>
                                                        {[10, 20, 50, 100].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                onClick={() => handleQuickAddMat(mat.itemId, val)}
                                                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[9px] font-black transition-colors"
                                                            >
                                                                +{val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {recordedMaterials.length === 0 && (
                                                <p className="text-center py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">No service materials recorded</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* [REQUIREMENT 5] Optional Section 2: Additional Products Purchased (Pickup Retail) */}
                            <div className="pt-2 border-t border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-sky-50/70 hover:bg-sky-100/70 border border-sky-200/60 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showRetailSection}
                                        onChange={(e) => setShowRetailSection(e.target.checked)}
                                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-wide text-sky-900 flex items-center gap-1.5 flex-1">
                                        <ShoppingBag className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                        Add Retail Products ({purchasedProducts.length}) {retailTotal > 0 && <span className="text-emerald-700 font-extrabold">• +₱{retailTotal.toFixed(2)}</span>}
                                    </span>
                                    <span className="text-[9px] font-extrabold text-sky-700 bg-white px-2 py-0.5 rounded-md border border-sky-100">
                                        {showRetailSection ? 'Hide' : 'Expand'}
                                    </span>
                                </label>

                                {showRetailSection && (
                                    <div className="mt-2 p-3 bg-white border border-sky-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
                                        <div className="space-y-2 bg-sky-50/30 p-2.5 rounded-xl border border-sky-100">
                                            <Label className="text-[9px] font-black uppercase text-sky-950 tracking-wider block">Select Retail Item (Shoelaces, Insoles, Shoe Cleaner, etc.)</Label>
                                            <Select value={selectedRetailToAdd} onValueChange={setSelectedRetailToAdd}>
                                                <SelectTrigger className="w-full h-8 text-[11px] font-bold bg-white border-sky-200 rounded-lg">
                                                    <SelectValue placeholder="Choose product..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {inventoryData.filter(i => i.isActive && i.stock > 0).map(item => (
                                                        <SelectItem key={item.id} value={item.id.toString()} className="text-[11px]">
                                                            <span className="font-bold">{item.name}</span> <span className="text-gray-400 font-normal">({item.stock} {item.unit} left • ₱{item.price || 0})</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <div className="grid grid-cols-3 gap-2 pt-1">
                                                <div>
                                                    <Label className="text-[8px] font-bold uppercase text-gray-500 block mb-0.5">Qty</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={retailQtyInput}
                                                        onChange={(e) => setRetailQtyInput(e.target.value)}
                                                        className="h-7 text-xs font-black text-center bg-white border-sky-200 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[8px] font-bold uppercase text-gray-500 block mb-0.5">Unit Price (₱)</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={retailPriceInput}
                                                        onChange={(e) => setRetailPriceInput(e.target.value)}
                                                        className="h-7 text-xs font-black text-center bg-white border-sky-200 text-emerald-700 rounded"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <Button
                                                        type="button"
                                                        onClick={handleAddRetailProduct}
                                                        disabled={!selectedRetailToAdd}
                                                        className="w-full h-7 bg-sky-600 hover:bg-sky-700 text-white font-black text-[10px] uppercase rounded"
                                                    >
                                                        Add Item
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {purchasedProducts.map((prod, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                                                    <div>
                                                        <span className="font-black text-gray-800">{prod.name}</span>
                                                        <span className="text-gray-500 text-[11px] font-bold ml-1">x{prod.quantity} ({prod.unit})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-emerald-700">₱{((prod.quantity || 1) * (prod.price || 0)).toFixed(2)}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setPurchasedProducts(prev => prev.filter((_, i) => i !== idx))}
                                                            className="text-gray-300 hover:text-red-500 p-1"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {purchasedProducts.length === 0 && (
                                                <p className="text-center py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">No retail products added to pickup order</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Payment Group */}
                            {remainingBalance > 0 && (
                                <div className="space-y-3 pt-3 border-t border-gray-50">
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Method</Label>
                                            <Select value={paymentMethod} onValueChange={(val: PaymentMethod) => setPaymentMethod(val)}>
                                                <SelectTrigger className="h-9 text-[11px] font-bold bg-white border-gray-200 rounded-lg focus:ring-red-50 shadow-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-gray-100">
                                                    <SelectItem value="cash" className="text-[11px]">Cash</SelectItem>
                                                    <SelectItem value="gcash" className="text-[11px]">GCash</SelectItem>
                                                    <SelectItem value="maya" className="text-[11px]">Maya</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Amount</Label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">₱</span>
                                                <Input
                                                    type="number"
                                                    min={remainingBalance}
                                                    value={amountReceived || ''}
                                                    onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                                                    className="h-9 pl-6 text-[12px] font-black bg-white border-gray-200 rounded-lg focus:ring-red-50 text-red-600 shadow-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {['gcash', 'maya'].includes(paymentMethod) && (
                                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Reference Number <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={referenceNo}
                                                onChange={(e) => setReferenceNo(formatReferenceNo(e.target.value, paymentMethod))}
                                                className="h-9 text-[11px] font-mono font-bold bg-white border-gray-200 rounded-lg focus:ring-red-50 shadow-sm"
                                                placeholder={paymentMethod === 'gcash' ? "xxxx-xxx-xxx-xxx" : "xxxx-xxxx-xxxx"}
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center bg-[#FDF2F2] px-3 py-2 rounded-xl border border-red-100 shadow-inner">
                                        <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Change Due</span>
                                        <span className="text-[13px] font-black text-red-700">₱{change.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Conditional Service Refund / Warranty Claim */}
                            <div className="pt-2.5 border-t border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={enableRefund}
                                        onChange={(e) => setEnableRefund(e.target.checked)}
                                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        Apply Conditional Service Refund
                                    </span>
                                </label>

                                {enableRefund && (
                                    <div className="mt-2.5 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <p className="text-[10px] text-amber-900 leading-tight font-medium">
                                            Refunds during claim are strictly allowed only for specific service quality conditions (e.g., paint fading or material non-adherence) and deduct from sales revenue.
                                        </p>
                                        
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-amber-950 tracking-wider">Condition / Refund Reason</Label>
                                            <Select value={refundReason} onValueChange={(val) => setRefundReason(val)}>
                                                <SelectTrigger className="h-8 text-[11px] font-bold bg-white border-amber-300/80 text-slate-800 rounded-lg shadow-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-amber-100 max-h-56">
                                                    <SelectItem value="Minor Restoration: Paint did not adhere to shoes and faded" className="text-[11px] font-semibold text-slate-800">
                                                        Minor Restoration: Paint did not adhere / faded
                                                    </SelectItem>
                                                    <SelectItem value="Deep Cleaning: Persistent stain could not be safely removed" className="text-[11px] font-medium text-slate-800">
                                                        Deep Cleaning: Persistent stain unremoved
                                                    </SelectItem>
                                                    <SelectItem value="Sole Restoration: Yellowing re-emerged post-treatment" className="text-[11px] font-medium text-slate-800">
                                                        Sole Restoration: Yellowing re-emerged
                                                    </SelectItem>
                                                    <SelectItem value="Unglued / Re-attachment: Adhesive bonding defect" className="text-[11px] font-medium text-slate-800">
                                                        Unglued: Adhesive bonding defect
                                                    </SelectItem>
                                                    <SelectItem value="Custom Quality / Service Warranty Defect" className="text-[11px] font-black text-amber-700">
                                                        + Custom Condition Reason...
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {refundReason === 'Custom Quality / Service Warranty Defect' && (
                                            <div className="space-y-1">
                                                <Input
                                                    value={customRefundReason}
                                                    onChange={(e) => setCustomRefundReason(e.target.value)}
                                                    placeholder="Enter specific service defect reason..."
                                                    className="h-8 text-[11px] bg-white border-amber-300/80 rounded-lg placeholder:text-gray-400 font-medium"
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-amber-950 tracking-wider flex items-center justify-between">
                                                <span>Refund Amount to Deduct</span>
                                                <span className="text-gray-500 font-bold lowercase text-[9px]">(max ₱{totalAmount})</span>
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">₱</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={totalAmount}
                                                    value={refundAmount || ''}
                                                    onChange={(e) => setRefundAmount(Math.min(totalAmount, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                    placeholder="0.00"
                                                    className="h-8 pl-6 text-[12px] font-black bg-white border-amber-300/80 rounded-lg text-rose-600 shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="p-2 bg-white rounded-lg border border-amber-200 flex justify-between items-center text-[11px]">
                                            <span className="font-bold text-slate-600">Adjusted Sales Revenue:</span>
                                            <span className="font-black text-emerald-700">₱{Math.max(0, totalAmount - (refundAmount || 0)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="bg-[#FAFAFA] border-t border-gray-100 p-3 flex flex-row gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleConfirm}
                            disabled={!claimedBy || !isPaymentValid}
                            className="flex-1 h-9 text-[10px] bg-[#D92D20] hover:bg-[#B42318] text-white font-black uppercase tracking-widest shadow-lg shadow-red-100 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            Claim & Deduct Stock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* [REQUIREMENT 5] Customer Claim & Purchase Receipt Modal */}
            <Dialog open={showReceipt} onOpenChange={(val) => { if (!val) { setShowReceipt(false); onOpenChange(false); } }}>
                <DialogContent className="max-w-[420px] bg-white p-6 rounded-3xl border-none shadow-2xl">
                    <div id="print-receipt-content" className="space-y-5 text-gray-800 print:p-0 print:m-0 print:shadow-none print:border-none">
                        {/* Receipt Header */}
                        <div className="text-center border-b border-dashed border-gray-200 pb-4 space-y-1">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Shoelotskey</h3>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Shoe Restoration & Care Services</p>
                            <div className="pt-2">
                                <span className="inline-block bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase tracking-widest px-3 py-0.5 rounded-full">
                                    Official Receipt
                                </span>
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-gray-600 border-b border-dashed border-gray-200 pb-3">
                            <div>
                                <span className="text-[9px] text-gray-400 uppercase font-black block">Order Number</span>
                                <span className="font-bold text-gray-900">#{claimedOrderSummary?.orderNumber}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-gray-400 uppercase font-black block">Date & Time</span>
                                <span>{claimedOrderSummary?.claimDate}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-gray-400 uppercase font-black block">Customer Name</span>
                                <span className="font-bold text-gray-900">{claimedOrderSummary?.customerName}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-gray-400 uppercase font-black block">Claimed By</span>
                                <span className="font-bold text-gray-900">{claimedOrderSummary?.claimedBy}</span>
                            </div>
                        </div>

                        {/* Services Performed */}
                        <div className="space-y-1.5 border-b border-dashed border-gray-200 pb-3">
                            <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Shoe Care Services</span>
                            {claimedOrderSummary?.services?.map((s: any, i: number) => (
                                <div key={i} className="flex justify-between text-[11px]">
                                    <div>
                                        <p className="font-bold text-gray-800">{s.brand} {s.shoeModel} ({s.quantity} pairs)</p>
                                        <p className="text-[10px] text-gray-500">{Array.isArray(s.baseService) ? s.baseService.join(', ') : s.baseService}</p>
                                    </div>
                                    <span className="font-bold text-gray-900">₱{((s.subTotal || s.total || 0)).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-xs font-black pt-1 text-gray-700">
                                <span>Service Total:</span>
                                <span>₱{claimedOrderSummary?.baseTotal?.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Additional Products Purchased */}
                        {claimedOrderSummary?.purchasedProducts?.length > 0 && (
                            <div className="space-y-1.5 border-b border-dashed border-gray-200 pb-3">
                                <span className="text-[9px] font-black uppercase text-sky-600 tracking-wider block">Retail Products Purchased</span>
                                {claimedOrderSummary.purchasedProducts.map((prod: any, i: number) => (
                                    <div key={i} className="flex justify-between text-[11px]">
                                        <span>{prod.name} (x{prod.quantity})</span>
                                        <span className="font-bold text-gray-900">₱{((prod.quantity || 1) * (prod.price || 0)).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-xs font-black pt-1 text-sky-700">
                                    <span>Retail Total:</span>
                                    <span>+₱{claimedOrderSummary?.retailTotal?.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* Materials Consumed (Transparency / Warranty) */}
                        {claimedOrderSummary?.recordedMaterials?.length > 0 && (
                            <div className="space-y-1 border-b border-dashed border-gray-200 pb-3">
                                <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider block">Supplies Utilized (Inventory Deducted)</span>
                                <div className="flex flex-wrap gap-1">
                                    {claimedOrderSummary.recordedMaterials.map((mat: any, i: number) => (
                                        <span key={i} className="text-[9px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-semibold">
                                            {mat.name}: {mat.quantity} {mat.unit}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Financial Totals */}
                        <div className="space-y-1.5 bg-gray-50/70 p-3 rounded-2xl border border-gray-100">
                            {claimedOrderSummary?.refundAmount > 0 && (
                                <div className="flex justify-between text-xs font-bold text-rose-600 border-b border-rose-100 pb-1 mb-1">
                                    <span>Conditional Refund ({claimedOrderSummary.refundReason}):</span>
                                    <span>-₱{claimedOrderSummary.refundAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base font-black text-gray-900">
                                <span>Grand Total:</span>
                                <span className="text-emerald-700">₱{claimedOrderSummary?.grandTotal?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-gray-600 pt-1 border-t border-gray-200">
                                <span>Amount Received ({claimedOrderSummary?.paymentMethod?.toUpperCase()}):</span>
                                <span>₱{claimedOrderSummary?.amountPaid?.toFixed(2)}</span>
                            </div>
                            {claimedOrderSummary?.referenceNo && (
                                <div className="flex justify-between text-[10px] font-mono text-gray-500">
                                    <span>Ref No:</span>
                                    <span>{claimedOrderSummary.referenceNo}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-[11px] font-bold text-gray-600">
                                <span>Change Due:</span>
                                <span>₱{claimedOrderSummary?.change?.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Footer Message */}
                        <div className="text-center pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider space-y-1">
                            <p>Thank you for trusting Shoelotskey!</p>
                            <p className="text-[9px]">Processed By: {claimedOrderSummary?.processedBy}</p>
                        </div>
                    </div>

                    {/* Action Buttons (Excluded from print) */}
                    <div className="flex items-center gap-2 pt-4 border-t border-gray-100 print:hidden">
                        <Button
                            variant="outline"
                            onClick={() => window.print()}
                            className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-700 border-gray-200 hover:bg-gray-50"
                        >
                            <Printer size={16} className="mr-2" />
                            Print Receipt
                        </Button>
                        <Button
                            onClick={() => { setShowReceipt(false); onOpenChange(false); }}
                            className="flex-1 h-11 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100"
                        >
                            Done & Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

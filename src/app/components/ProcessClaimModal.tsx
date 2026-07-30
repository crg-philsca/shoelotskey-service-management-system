
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { JobOrder, PaymentMethod } from "@/app/types";
import { CheckCircle2, User, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

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
        }
    ) => void;
}

export default function ProcessClaimModal({ order, open, onOpenChange, onConfirm }: ProcessClaimModalProps) {
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

    // Calculate remaining balance after any conditional refund deduction
    const totalAmount = order?.grandTotal || 0;
    const amountPaid = order?.amountReceived || 0;
    const effectiveTotal = Math.max(0, totalAmount - (enableRefund ? refundAmount : 0));
    const isFullyPaid = order?.paymentStatus === 'fully-paid';
    const remainingBalance = isFullyPaid ? 0 : Math.max(0, effectiveTotal - amountPaid);

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
        }
    }, [order, open]);

    useEffect(() => {
        if (remainingBalance > 0) {
            setChange(Math.max(0, amountReceived - remainingBalance));
        } else {
            setChange(0);
        }
    }, [amountReceived, remainingBalance]);

    const handleConfirm = () => {
        if (!order) return;

        // Validate if balance needs to be paid
        if (remainingBalance > 0 && amountReceived < remainingBalance) {
            return; // Cannot proceed
        }

        // Calculate final amount received to update the order record
        // If there was a previous partial payment, we add the new amount to it?
        // The order type has 'amountReceived'. Usually this tracks total amount received.
        // So new total amount received = old amount received + current payment amount.
        // However, the backend/mock likely just overwrites or we should send the TOTAL amount received.
        // Let's assume we update the record to be fully paid with the full amount.

        // For simplicity in this mock setup:
        // If it was unpaid/partial, we are now paying the remainder.
        // The `amountReceived` in the update payload should probably be the TOTAL amount received (old + new).
        // Or simpler: just set it to `grandTotal` (exact payment) + any tip/extra if we were tracking that, 
        // but here `amountReceived` seems to be the total cash handed over.

        // Let's send the specific values needed.
        // If fully paid, we don't change payment info.
        // If not fully paid, we update payment info.

        const updateData: any = {
            claimedBy,
            status: 'claimed',
            updatedAt: new Date(),
            actualCompletionDate: new Date(),
        };

        let currentTotal = order.grandTotal;
        if (enableRefund && refundAmount > 0) {
            const finalReason = refundReason === 'Custom Quality / Service Warranty Defect' ? customRefundReason : refundReason;
            currentTotal = Math.max(0, order.grandTotal - refundAmount);
            updateData.grandTotal = currentTotal;
            updateData.refundAmount = refundAmount;
            updateData.refundReason = finalReason;
            
            toast.success(`Order #${order.orderNumber} claimed with ₱${refundAmount.toLocaleString()} conditional refund deducted from sales (${finalReason}).`);
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
                // Deduct refund from received revenue so sales reports reflect accurate collection
                updateData.amountReceived = Math.max(0, (order.amountReceived || 0) - refundAmount);
            }
        }

        onConfirm(order.id, updateData);
        onOpenChange(false);
    };

    const isPaymentValid = (remainingBalance <= 0 || amountReceived >= remainingBalance) &&
        (!['gcash', 'maya'].includes(paymentMethod) || referenceNo.trim().length > 0) &&
        (!enableRefund || (refundAmount >= 0 && refundAmount <= totalAmount && (refundReason !== 'Custom Quality / Service Warranty Defect' || customRefundReason.trim().length > 0)));

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[400px] max-h-[82vh] flex flex-col bg-white p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                <DialogHeader className="px-4 py-3 bg-white border-b border-gray-50 flex flex-row items-center justify-between shrink-0">
                    <DialogTitle className="text-[14px] font-black uppercase tracking-tight text-gray-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-red-600" />
                        Process Claim
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-3.5 overflow-y-auto max-h-[60vh] flex-1">
                    {/* Compact Order Summary Card */}
                    <div className="bg-[#F9FAFB] p-3 rounded-xl border border-gray-100 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-start border-b border-gray-200/50 pb-2">
                            <div>
                                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Order ID</p>
                                <p className="text-[11px] font-bold text-gray-900">{order.orderNumber}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Customer</p>
                                <p className="text-[11px] font-bold text-gray-900 truncate max-w-[100px]">{order.customerName}</p>
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
                                <div className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-[9px] font-bold text-gray-500 whitespace-nowrap">
                                    Total: ₱{order.grandTotal.toFixed(2)}
                                </div>
                                <div className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-bold text-emerald-600 whitespace-nowrap">
                                    Paid: ₱{(order.amountReceived || 0).toFixed(2)}
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
                                            onChange={(e) => setReferenceNo(e.target.value)}
                                            className="h-9 text-[11px] font-mono font-bold bg-white border-gray-200 rounded-lg focus:ring-red-50 shadow-sm"
                                            placeholder="Enter Transaction ID"
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
                        Claim
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

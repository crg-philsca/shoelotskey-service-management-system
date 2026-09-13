import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { API_BASE } from '@/app/lib/apiBase';
import {
  User,
  UserCheck,
  Phone,
  Calendar as CalendarIcon,
  Truck,
  MapPin,
  Tag,
  Package,
  Wallet,
  Copy,
  Check,
  Sparkles,
  CheckCircle2,
  Printer,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Edit3,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';
import { useOrders } from '@/app/context/OrderContext';
import type { JobOrder } from '@/app/types';
import { calculateOfficialReleaseBreakdown } from '@/app/lib/businessRules';
import StockUpdateModal from '@/app/components/StockUpdateModal';

interface OrderDetailModalProps {
  order: JobOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
}

function displayItemSize(item: any, order?: any) {
  const candidates = [
    item?.shoeSize,
    item?.size,
    item?.shoe_size,
    order?.shoeSize,
    order?.size,
    order?.shoe_size,
  ];
  for (const value of candidates) {
    const text = String(value ?? '').trim();
    if (text && text !== '-' && text.toLowerCase() !== 'n/a') return text;
  }
  return '-';
}

function displayItemColor(item: any, order?: any) {
  const candidates = [item?.color, order?.color];
  for (const raw of candidates) {
    if (Array.isArray(raw)) {
      const joined = raw.map((c) => String(c).trim()).filter(Boolean).join(', ');
      if (joined) return joined;
      continue;
    }
    const text = String(raw ?? '').trim();
    if (text && text !== '-' && text.toLowerCase() !== 'n/a') return text;
  }
  return '-';
}

function DateValue({ colorClass, children }: { colorClass: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <CalendarIcon size={12} className={`${colorClass} shrink-0`} />
      <p className="text-sm font-mono font-bold text-slate-900">{children}</p>
    </div>
  );
}

function releaseTimestamp(order: JobOrder) {
  if (order.actualReleaseDate) return order.actualReleaseDate;
  const fromLogs = ((order as any).statusHistory || [])
    .filter((s: any) => s.status === 'for-release' && s.timestamp)
    .map((s: any) => new Date(s.timestamp))
    .filter((d: Date) => !isNaN(d.getTime()))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime());
  if (fromLogs[0]) return fromLogs[0];
  if (order.status === 'for-release' || order.status === 'claimed') {
    return order.actualCompletionDate || null;
  }
  return null;
}

export default function OrderDetailModal({
  order: propOrder,
  open,
  onOpenChange,
  user,
}: OrderDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [showPrintSummary, setShowPrintSummary] = useState(false);
  const [estimate, setEstimate] = useState<{
    business_rule_days?: number;
    business_rule_date?: string;
    ml_predicted_days?: number | null;
    ml_predicted_date?: string | null;
    ml_status?: string;
    ml_model?: string;
    ml_reason?: string | null;
  } | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState(false);
  const [editingPairIndex, setEditingPairIndex] = useState<number | null>(null);
  const [pairStatus, setPairStatus] = useState<string>('pending');
  const [pairReleaseDate, setPairReleaseDate] = useState<string>('');
  const [pairClaimedDate, setPairClaimedDate] = useState<string>('');
  const [isUpdatingPair, setIsUpdatingPair] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const { orders, updateOrder } = useOrders();

  // Dynamically retrieve the real-time updated order from OrderContext so edits are reflected immediately
  const order = propOrder ? (orders.find((o) => o.id === propOrder.id) || propOrder) : null;

  const toDateTimeLocal = (dateVal: any) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const { normalizedItems, officialBreakdown } = useMemo(() => {
    if (!order) {
      return {
        normalizedItems: [],
        officialBreakdown: { baseDays: 0, addOnDays: 0, priorityDays: 0, totalDays: 0 },
      };
    }

    const rawItems = order.items && order.items.length > 0 ? order.items : [order];
    const items = rawItems.map((item: any) => {
      let bServices: string[] = [];
      if (Array.isArray(item.baseService)) {
        bServices = item.baseService;
      } else if (typeof item.baseService === 'string' && item.baseService.trim()) {
        try {
          const parsed = JSON.parse(item.baseService);
          bServices = Array.isArray(parsed) ? parsed : [item.baseService];
        } catch {
          bServices = item.baseService.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      if (bServices.length === 0 && Array.isArray(item.services)) {
        bServices = item.services
          .filter((s: any) => (s?.category?.category_name || s?.category) === 'base' || !s?.category)
          .map((s: any) => s?.service_name || s?.name || String(s))
          .filter(Boolean);
      }
      if (bServices.length === 0 && order.baseService) {
        if (Array.isArray(order.baseService)) bServices = order.baseService;
        else if (typeof order.baseService === 'string') bServices = [order.baseService];
      }

      let addOns: any[] = [];
      if (Array.isArray(item.addOns)) {
        addOns = item.addOns;
      } else if (typeof item.addOns === 'string' && item.addOns.trim()) {
        try {
          const parsed = JSON.parse(item.addOns);
          addOns = Array.isArray(parsed) ? parsed : [item.addOns];
        } catch {
          addOns = item.addOns.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      if (addOns.length === 0 && Array.isArray(item.services)) {
        addOns = item.services
          .filter((s: any) => (s?.category?.category_name || s?.category) === 'addon')
          .map((s: any) => ({ name: s?.service_name || s?.name || String(s), quantity: 1 }));
      }
      if (addOns.length === 0 && order.addOns) {
        if (Array.isArray(order.addOns)) addOns = order.addOns;
      }

      let cond = item.condition;
      if (typeof cond === 'string') {
        try { cond = JSON.parse(cond); } catch {}
      }

      return {
        id: item.id,
        brand: item.brand || 'Other',
        shoeModel: item.shoeModel || 'Other',
        shoeMaterial: item.shoeMaterial || 'Other',
        condition: cond || {},
        baseService: bServices,
        addOns: addOns,
        quantity: item.quantity || 1,
        status: item.status,
        actualReleaseDate: item.actualReleaseDate,
        actualCompletionDate: item.actualCompletionDate,
      };
    });

    const breakdown = calculateOfficialReleaseBreakdown(items, order.priorityLevel || 'regular');
    return { normalizedItems: items, officialBreakdown: breakdown };
  }, [order]);

  useEffect(() => {
    if (!open || !order) {
      setEstimate(null);
      setPredictionLoading(false);
      setPredictionError(false);
      return;
    }

    const items = normalizedItems;

    // Synchronous immediate calculation of official Business Rules days (0ms delay)
    const initialBrDays = officialBreakdown.totalDays > 0
      ? officialBreakdown.totalDays
      : (order.estimatedDays != null
          ? Number(order.estimatedDays)
          : (order.predictedCompletionDate && (order.transactionDate || order.createdAt)
              ? Math.max(1, Math.round((new Date(order.predictedCompletionDate).getTime() - new Date(order.transactionDate || order.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
              : 25));

    const rawTxDate = order.transactionDate || order.createdAt;
    const initialBrDate = (() => {
        const base = rawTxDate ? new Date(rawTxDate) : new Date();
        const d = new Date(base.getTime() + initialBrDays * 24 * 60 * 60 * 1000);
        return d.toISOString();
    })();

    const initialStoredDays = order.predictedDays != null ? Number(order.predictedDays) : null;
    const initialStoredDate = order.predictedAt
      ? new Date(order.predictedAt).toISOString()
      : (initialStoredDays != null && rawTxDate
          ? new Date(new Date(rawTxDate).getTime() + initialStoredDays * 24 * 60 * 60 * 1000).toISOString()
          : null);
    const hasStoredPrediction = initialStoredDays != null && Boolean(initialStoredDate);

    // Immediately pre-populate estimate so there is 0ms delay and zero missing information
    setEstimate({
      business_rule_days: initialBrDays,
      business_rule_date: initialBrDate,
      ml_predicted_date: initialStoredDate,
      ml_predicted_days: initialStoredDays,
      ml_status: hasStoredPrediction ? 'valid' : 'calculating',
      ml_model: 'Random Forest Regression',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    let authToken = user?.token || user?.access_token || '';
    if (!authToken && typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          authToken = parsed.token || parsed.access_token || '';
        }
      } catch {}
    }
    if (!authToken && typeof window !== 'undefined') {
      try {
        const offlineAuth = localStorage.getItem('shoelotskey_offline_auth') || sessionStorage.getItem('shoelotskey_offline_auth');
        if (offlineAuth) {
          const parsed = JSON.parse(offlineAuth);
          authToken = parsed.token || parsed.access_token || '';
        }
      } catch {}
    }

    let isoTxDate = new Date().toISOString();
    try {
      if (rawTxDate) {
        const parsed = new Date(rawTxDate);
        if (!isNaN(parsed.getTime())) {
          isoTxDate = parsed.toISOString();
        }
      }
    } catch {}

    setPredictionLoading(true);
    setPredictionError(false);
    fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        items,
        priorityLevel: order.priorityLevel || 'regular',
        rushReductionDays: (order.priorityLevel || 'regular').toLowerCase() === 'rush' ? 9 : undefined,
        grandTotal: order.grandTotal || 0,
        transactionDate: isoTxDate,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Prediction request failed');
        return res.json();
      })
      .then((data) => {
        if (data) {
          setEstimate(prev => ({
            ...data,
            business_rule_days: data.business_rule_days ?? prev?.business_rule_days ?? initialBrDays,
            business_rule_date: data.business_rule_date ?? prev?.business_rule_date ?? initialBrDate,
            ml_predicted_days: data.ml_predicted_days ?? prev?.ml_predicted_days,
            ml_predicted_date: data.ml_predicted_date ?? prev?.ml_predicted_date,
            ml_status: data.ml_status ?? prev?.ml_status,
          }));
          // If the order in DB didn't have predictedAt or predictedDays saved yet, auto-persist it now
          if (data.ml_predicted_date && (!order.predictedAt || order.predictedDays == null)) {
            updateOrder(order.id, {
              predictedAt: data.ml_predicted_date,
              predictedDays: data.ml_predicted_days,
            });
          }
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setPredictionError(true);
      })
      .finally(() => setPredictionLoading(false));
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, order?.id]);

  const handleOpenUpdatePair = (item: any, idx: number) => {
    setEditingPairIndex(idx);
    const effectiveStatus = (item.status || order?.status || 'pending').toLowerCase();
    setPairStatus(effectiveStatus);
    setPairReleaseDate(toDateTimeLocal(item.actualReleaseDate || (effectiveStatus === 'for-release' || effectiveStatus === 'claimed' ? order?.actualReleaseDate : '')));
    setPairClaimedDate(toDateTimeLocal(item.actualCompletionDate || (effectiveStatus === 'claimed' ? order?.actualCompletionDate : '')));
  };

  const handlePairStatusChange = (newStatus: string) => {
    setPairStatus(newStatus);
    if (newStatus === 'for-release' && !pairReleaseDate) {
      setPairReleaseDate(toDateTimeLocal(new Date()));
    } else if (newStatus === 'claimed') {
      if (!pairClaimedDate) setPairClaimedDate(toDateTimeLocal(new Date()));
      if (!pairReleaseDate) setPairReleaseDate(toDateTimeLocal(new Date()));
    }
  };

  const handleSavePairUpdate = async () => {
    if (editingPairIndex === null || !order) return;
    setIsUpdatingPair(true);
    try {
      const rawItems = order.items && order.items.length > 0 ? [...order.items] : [{ ...order }];
      const targetItem = rawItems[editingPairIndex];
      if (!targetItem) throw new Error("Pair not found");

      const releaseIso = pairReleaseDate ? new Date(pairReleaseDate).toISOString() : undefined;
      const claimedIso = pairClaimedDate ? new Date(pairClaimedDate).toISOString() : undefined;

      const updatedItem = {
        ...targetItem,
        status: pairStatus as any,
        actualReleaseDate: releaseIso,
        actualCompletionDate: claimedIso,
      };
      rawItems[editingPairIndex] = updatedItem;

      // Check if multi-pair status synchronization applies
      const allClaimed = rawItems.length > 0 && rawItems.every(it => (it.status || '').toLowerCase() === 'claimed');
      const allForRelease = rawItems.length > 0 && rawItems.every(it => ['for-release', 'claimed'].includes((it.status || '').toLowerCase()));

      const updates: Partial<JobOrder> = {
        items: rawItems,
      };

      if (allClaimed && order.status !== 'claimed') {
        updates.status = 'claimed';
        if (!order.actualCompletionDate) updates.actualCompletionDate = claimedIso ? new Date(claimedIso) : new Date();
        if (!order.actualReleaseDate) updates.actualReleaseDate = releaseIso ? new Date(releaseIso) : new Date();
      } else if (allForRelease && ['pending', 'in-progress'].includes(order.status)) {
        updates.status = 'for-release';
        if (!order.actualReleaseDate) updates.actualReleaseDate = releaseIso ? new Date(releaseIso) : new Date();
      }

      await updateOrder(order.id, updates, user?.username || 'Staff');
      toast.success(`Pair #${editingPairIndex + 1} status updated to ${pairStatus.toUpperCase()}`);
      setEditingPairIndex(null);
    } catch (err: any) {
      console.error("Failed to update pair:", err);
      toast.error("Failed to update pair: " + (err?.message || "Unknown error"));
    } finally {
      setIsUpdatingPair(false);
    }
  };

  if (!order) return null;

  const itemsToDisplay = order.items && order.items.length > 0 ? order.items : [order];

  // Safe date formatter helper
  const formatDate = (dateVal: any, formatStr: string = 'MM/dd/yy HH:mm') => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return dateFnsFormat(d, formatStr);
  };

  const handleCopyOrderNumber = () => {
    if (order.orderNumber) {
      navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      toast.success(`Order ID #${order.orderNumber} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Financial calculations
  const baseTotal = order.baseServiceFee || 0;
  const addOnsTotal = order.addOnsTotal || 0;
  const calculatedRushFee = Math.max(0, (order.grandTotal || 0) - (baseTotal + addOnsTotal));
  const effectivePaid = order.paymentStatus === 'fully-paid'
    ? (order.grandTotal || 0)
    : (order.depositAmount || (order.amountReceived && order.amountReceived < (order.grandTotal || 0) ? order.amountReceived : 0));
  const remainingBalance = order.paymentStatus === 'fully-paid'
    ? 0
    : Math.max(
        0,
        (order as any).balance !== undefined && (order as any).balance !== null && (order as any).balance > 0
          ? (order as any).balance
          : (order.grandTotal || 0) - effectivePaid
      );

  const isClaimed = order.status === 'claimed';
  const isForRelease = order.status === 'for-release' || isClaimed;

  // Resolve or synthesize payment history
  const paymentHistory: any[] = (() => {
    if (Array.isArray(order.paymentHistory) && order.paymentHistory.length > 0) {
      return order.paymentHistory;
    }
    const history: any[] = [];
    const dpAmt = order.depositAmount || (order.paymentStatus === 'downpayment' ? order.amountReceived : 0) || 0;
    const totalRecv = order.amountReceived || 0;
    const initialMethod = order.initialPaymentMethod || order.paymentMethod || 'cash';
    const finalMethod = order.finalPaymentMethod;

    if (dpAmt > 0 && totalRecv > dpAmt && isClaimed) {
      history.push({
        id: 'pay-1',
        paymentType: 'downpayment',
        method: initialMethod,
        amount: dpAmt,
        referenceNo: order.referenceNo,
        date: order.createdAt || order.transactionDate,
        processedBy: order.processedBy || 'Staff',
        notes: 'Initial Downpayment'
      });
      history.push({
        id: 'pay-2',
        paymentType: 'final-payment',
        method: finalMethod || (String(order.paymentMethod || '').includes(',') ? String(order.paymentMethod).split(',')[1].trim() : 'cash'),
        amount: Math.max(0, totalRecv - dpAmt),
        referenceNo: (order as any).claimReferenceNo,
        date: order.actualCompletionDate || order.updatedAt,
        processedBy: order.claimedBy || order.releasedBy || 'Staff',
        notes: 'Balance Settlement upon Claim'
      });
    } else if (totalRecv > 0) {
      const isDownpayment = dpAmt > 0 || order.paymentStatus === 'downpayment';
      history.push({
        id: 'pay-1',
        paymentType: isDownpayment ? 'downpayment' : 'full-payment',
        method: initialMethod,
        amount: isDownpayment && dpAmt > 0 ? dpAmt : totalRecv,
        referenceNo: order.referenceNo,
        date: order.createdAt || order.transactionDate,
        processedBy: order.processedBy || 'Staff',
        notes: isDownpayment ? 'Initial Downpayment' : 'Full Payment'
      });
    }
    return history;
  })();

  const safeInventoryUsed: any[] = Array.isArray(order?.inventoryUsed)
    ? order.inventoryUsed
    : (typeof order?.inventoryUsed === 'string'
      ? (() => { try { const p = JSON.parse(order.inventoryUsed); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[540px] bg-white p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col border border-gray-100 shadow-2xl">
        {/* Header Bar with Interactive Copyable Order ID & Print Icon */}
        <DialogHeader className="p-4 sm:px-6 border-b border-gray-100 bg-white flex flex-row items-center justify-between shrink-0 pr-14">
          <DialogDescription className="sr-only">Detailed view of order items, status, and financials</DialogDescription>
          <button
            onClick={() => setShowPrintSummary(true)}
            title="Print Job Order Summary"
            className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-red-600 border border-slate-200 flex items-center justify-center transition-colors shadow-2xs no-print"
          >
            <Printer size={16} />
          </button>
          <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2 text-slate-900">
            <span>Order #</span>
            <button
              onClick={handleCopyOrderNumber}
              title="Click to copy Order ID"
              className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 group"
            >
              <span>{order.orderNumber}</span>
              {copied ? (
                <Check size={13} className="text-emerald-600 shrink-0" />
              ) : (
                <Copy size={13} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
              )}
            </button>
          </DialogTitle>
          <div className="w-8" /> {/* Spacer to keep title centered */}
        </DialogHeader>

        {/* Scrollable Content Body - Cleanly Categorized Cards */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 scrollbar-thin">
          {/* Dedicated Card: Cancellation & Refund Details (Only for cancelled orders) */}
          {(order.status === 'cancelled' || order.cancellationStage || order.refundStatus) && (() => {
            const isRefund = order.refundStatus === 'refunded' || order.cancellationStage === 'new-order';
            const refundAmt = order.refundAmount != null ? order.refundAmount : (order.depositAmount || order.amountReceived || 0);
            const stageLabel = order.cancellationStage === 'new-order' ? 'New Order (Pre-Service)' : (order.cancellationStage === 'on-going' ? 'On-Going (Work in Progress)' : (order.cancellationStage || 'Pre-Service'));

            return (
              <div className={`p-4 rounded-xl border-2 space-y-3 ${isRefund ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                <div className="flex items-center justify-between pb-2 border-b border-black/5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isRefund ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {isRefund ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    </div>
                    <h4 className={`text-xs font-black uppercase tracking-wider ${isRefund ? 'text-emerald-900' : 'text-rose-900'}`}>
                      Cancellation & Refund Details
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const targetStage = order.cancellationStage || 'new-order';
                        updateOrder(order.id, {
                          status: targetStage as any,
                          cancellationStage: null as any,
                          refundStatus: null as any,
                          refundAmount: 0,
                          refundReason: null as any,
                          cancelledAt: null as any,
                          updatedAt: new Date()
                        }, user?.username || 'Staff');
                        toast.success(`Order #${order.orderNumber} restored to ${targetStage.replace('-', ' ')} (${isRefund ? 'Refund Undone' : 'Cancellation Undone'})`);
                        onOpenChange(false);
                      }}
                      className="h-6 px-2 text-[11px] font-bold text-purple-700 border-purple-300 bg-white hover:bg-purple-50 shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={11} />
                      {isRefund ? 'Undo Refund' : 'Undo Cancellation'}
                    </Button>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${isRefund ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
                      {isRefund ? 'Refunded' : 'Deposit Forfeited'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Cancelled Stage</span>
                    <span className="font-bold text-gray-800">{stageLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Refund Status</span>
                    <span className={`font-black uppercase ${isRefund ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isRefund ? `₱${refundAmt.toLocaleString()} Refunded` : '₱0.00 (No Refund)'}
                    </span>
                  </div>
                  {order.cancelledAt && (
                    <div className="col-span-2 flex items-center justify-between pt-1 border-t border-black/5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cancelled At</span>
                      <span className="text-xs font-mono font-bold text-gray-700">{formatDate(order.cancelledAt)}</span>
                    </div>
                  )}
                </div>

                <div className={`p-2.5 rounded-lg text-[11px] leading-relaxed font-medium ${isRefund ? 'bg-emerald-100/60 text-emerald-900' : 'bg-rose-100/60 text-rose-900'}`}>
                  {isRefund
                    ? `Pre-service cancellation policy: Treatment had not commenced when cancelled, so the deposit of ₱${refundAmt.toLocaleString()} has been fully refunded to the customer.`
                    : `In-service cancellation policy: Treatment was already in progress ('On-Going') when cancelled. Deposit of ₱${(order.depositAmount || order.amountReceived || 0).toLocaleString()} is forfeited per policy to cover materials and labor initiated.`
                  }
                </div>
              </div>
            );
          })()}

          {/* Card 1: Order Status & Process Overview */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Package size={15} className="text-red-500" />
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Order Overview
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-4 items-center pb-3 border-b border-slate-200/60">
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Order Status
                </Label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                    order.status === 'new-order'
                      ? 'bg-purple-50 text-purple-700 border-purple-100'
                      : order.status === 'on-going'
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : order.status === 'for-release'
                      ? 'bg-orange-50 text-orange-700 border-orange-100'
                      : order.status === 'claimed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-red-50 text-red-700 border-red-100'
                  }`}
                >
                  {order.status ? order.status.replace('-', ' ') : 'New Order'}
                </span>
              </div>

              <div className="text-right">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Priority Level
                </Label>
                {order.priorityLevel === 'rush' ? (
                  <span className="text-xs font-black text-red-600 uppercase flex items-center justify-end gap-1">
                    ⚡ RUSH
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-800 capitalize">
                    {order.priorityLevel || 'Regular'}
                  </span>
                )}
              </div>
            </div>

            {/* Processed By & Last Updated */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Processed By
                </Label>
                <p className="text-sm font-bold text-slate-800 truncate">{order.processedBy || 'Staff'}</p>
              </div>

              <div className="text-right">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Last Updated
                </Label>
                <div className="flex items-center justify-end gap-1.5">
                  <CalendarIcon size={12} className="text-slate-500 shrink-0" />
                  <p className="text-sm font-mono font-bold text-slate-900 truncate">
                    {order.updatedAt ? formatDate(order.updatedAt) : formatDate(order.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Customer Details */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <User size={15} className="text-red-500" />
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Customer Details
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Customer Name
                </Label>
                <p className="text-sm font-bold text-slate-800">{order.customerName || '-'}</p>
              </div>
              <div className="text-right">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Contact Number
                </Label>
                <div className="flex items-center justify-end gap-1.5">
                  <Phone size={12} className="text-slate-400 shrink-0" />
                  <p className="text-sm font-bold text-slate-800">{order.contactNumber || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Schedule & Release/Claim Tracking */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon size={15} className="text-red-500" />
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Schedule & Tracking
              </h4>
            </div>

            {/* Order Date, Estimated Date, Predicted Date, Total Days, Release Date */}
            <div className={`grid gap-4 ${isForRelease ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Order Date
                </Label>
                <DateValue colorClass="text-purple-600">
                  {formatDate(order.transactionDate || order.createdAt)}
                </DateValue>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">Received Date</p>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Expected Date
                </Label>
                <DateValue colorClass="text-emerald-600">
                  {(() => {
                    const dt = estimate?.business_rule_date 
                      || (officialBreakdown.totalDays > 0 && (order.transactionDate || order.createdAt)
                          ? new Date(new Date(order.transactionDate || order.createdAt).getTime() + officialBreakdown.totalDays * 24 * 60 * 60 * 1000).toISOString()
                          : null)
                      || order.predictedCompletionDate;
                    if (!dt) return '-';
                    return `${formatDate(dt, 'MM/dd/yy')}${order.releaseTime ? ` ${order.releaseTime}` : ''}`;
                  })()}
                </DateValue>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  {(() => {
                    const days = (officialBreakdown.totalDays > 0 ? officialBreakdown.totalDays : null)
                      ?? estimate?.business_rule_days 
                      ?? (order.estimatedDays != null ? Number(order.estimatedDays) : null)
                      ?? 25;
                    return `BR: ${days} ${days === 1 ? 'day' : 'days'}`;
                  })()}
                </p>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Predicted Date
                </Label>
                <DateValue colorClass="text-blue-600">
                  {(() => {
                    if (predictionLoading) {
                      return (
                        <span className="inline-flex items-center gap-1.5 text-red-600 text-xs font-semibold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500 shrink-0" />
                          <span className="text-[11px] font-semibold text-red-500">Predicting...</span>
                        </span>
                      );
                    }
                    const mlDays = estimate?.ml_predicted_days ?? (order.predictedDays != null ? Number(order.predictedDays) : null);
                    const baseDate = order.transactionDate || order.createdAt;
                    const dt = estimate?.ml_predicted_date
                      || (order.predictedAt ? order.predictedAt : null)
                      || (mlDays != null && baseDate ? new Date(new Date(baseDate).getTime() + mlDays * 24 * 60 * 60 * 1000) : null);
                    if (dt) return formatDate(dt, 'MM/dd/yy');
                    if (predictionError && !estimate?.ml_predicted_date && !order.predictedAt && mlDays == null) {
                      return <span className="text-slate-400 text-xs font-medium">Unavailable</span>;
                    }
                    return <span className="text-slate-400 text-xs font-medium">Unavailable</span>;
                  })()}
                </DateValue>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                  {(() => {
                    if (predictionLoading) {
                      return (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                          <span className="text-slate-500 font-semibold">ML:</span>
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-red-500 shrink-0" />
                        </span>
                      );
                    }
                    const days = estimate?.ml_predicted_days ?? (order.predictedDays != null ? Number(order.predictedDays) : null);
                    if (days != null && days > 0) {
                      return (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-700">ML: {days} {days === 1 ? 'day' : 'days'}</span>
                        </span>
                      );
                    }
                    return <span className="text-slate-400 text-[10px]">ML: Unavailable</span>;
                  })()}
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Total Days
                </Label>
                {(() => {
                  const completedDate = order.actualCompletionDate || (order as any).claimedAt || (order.statusHistory?.find((s: any) => s.status === 'claimed')?.timestamp);
                  const receivedDate = order.transactionDate || order.createdAt;
                  if (isClaimed && completedDate && receivedDate) {
                    const diffMs = new Date(completedDate).getTime() - new Date(receivedDate).getTime();
                    const totalDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                    return (
                      <>
                        <DateValue colorClass="text-slate-900">
                          {totalDays} {totalDays === 1 ? 'day' : 'days'}
                        </DateValue>
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">Actual service duration</p>
                      </>
                    );
                  }
                  return (
                    <>
                      <DateValue colorClass="text-slate-400 text-xs">
                        Not yet completed
                      </DateValue>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">Order in progress</p>
                    </>
                  );
                })()}
              </div>

              {isForRelease && (
                <div>
                  <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                    Release Date
                  </Label>
                  <DateValue colorClass="text-orange-600">
                    {(() => {
                      const released = releaseTimestamp(order);
                      return released ? formatDate(released) : '-';
                    })()}
                  </DateValue>
                </div>
              )}
            </div>

            {/* Claimed Date, Claimed By, & Released By (Shown STRICTLY ONLY if status is Claimed) */}
            {isClaimed && (
              <div className="pt-3 border-t border-slate-200/60 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Claimed Date
                    </Label>
                    <DateValue colorClass="text-slate-500">
                      {order.actualCompletionDate
                        ? formatDate(order.actualCompletionDate)
                        : (order as any).statusHistory?.find((s: any) => s.status === 'claimed')
                        ? formatDate((order as any).statusHistory.find((s: any) => s.status === 'claimed').timestamp)
                        : '-'}
                    </DateValue>
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Claimed By
                    </Label>
                    <p className="text-sm font-bold text-emerald-800 truncate" title={order.claimedBy || order.customerName || '-'}>
                      {order.claimedBy || order.customerName || '-'}
                    </p>
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Released By
                    </Label>
                    <div className="flex items-center gap-1">
                      <UserCheck size={12} className="text-emerald-600 shrink-0" />
                      <p className="text-sm font-bold text-emerald-800 truncate" title={order.releasedBy || order.processedBy || 'owner'}>
                        {order.releasedBy || order.processedBy || 'owner'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Shipping Preference (Shown only if delivery address or courier is applicable) */}
          {(order.shippingPreference === 'delivery' || order.deliveryAddress || order.deliveryCourier) && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Truck size={14} className="text-red-500" />
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Shipping Details
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                    Preference
                  </Label>
                  <p className="text-sm font-bold text-slate-800 uppercase">
                    {order.shippingPreference || 'Pickup'}
                  </p>
                </div>
                {order.deliveryCourier && (
                  <div className="text-right">
                    <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Courier
                    </Label>
                    <p className="text-sm font-bold text-slate-800">{order.deliveryCourier}</p>
                  </div>
                )}
              </div>

              {order.deliveryAddress && (
                <div className="pt-2 border-t border-slate-200/60">
                  <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                    Full Delivery Address
                  </Label>
                  <div className="flex items-start gap-1.5">
                    <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-slate-600 leading-snug">
                      {order.deliveryAddress}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card 5: Shoe & Service Details Breakdown */}
          <div className="space-y-3">
            {itemsToDisplay.map((item: any, index: number) => {
              const baseServicesList = Array.isArray(item.baseService)
                ? item.baseService
                : [item.baseService].filter(Boolean);

              // Robust Add-ons Extraction
              let addOnsList: any[] = [];
              const rawItemAddOns = item.addOns || item.add_ons;
              const rawOrderAddOns = (order as any).addOns || (order as any).add_ons;

              if (Array.isArray(rawItemAddOns) && rawItemAddOns.length > 0) {
                addOnsList = rawItemAddOns;
              } else if (Array.isArray(rawOrderAddOns) && rawOrderAddOns.length > 0) {
                addOnsList = rawOrderAddOns;
              } else if (typeof rawItemAddOns === 'string' && rawItemAddOns.trim()) {
                try {
                  const parsed = JSON.parse(rawItemAddOns);
                  addOnsList = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  addOnsList = [rawItemAddOns];
                }
              } else if (typeof rawOrderAddOns === 'string' && rawOrderAddOns.trim()) {
                try {
                  const parsed = JSON.parse(rawOrderAddOns);
                  addOnsList = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  addOnsList = [rawOrderAddOns];
                }
              }

              return (
                <div key={index} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag size={15} className="text-red-500" />
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {itemsToDisplay.length > 1 ? `Item #${index + 1} Details` : 'Shoe & Service Details'}
                    </h4>
                  </div>

                  {/* Shoe Specifications */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Brand
                      </Label>
                      <p className="text-sm font-bold text-slate-800">{item.brand || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Model
                      </Label>
                      <p className="text-sm font-bold text-slate-800">{item.shoeModel || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Material
                      </Label>
                      <p className="text-sm font-bold text-slate-800">{item.shoeMaterial || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Size
                      </Label>
                      <p className="text-sm font-bold text-slate-800">{displayItemSize(item, order)}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Color
                      </Label>
                      <p className="text-sm font-bold text-slate-800">
                        {displayItemColor(item, order)}
                      </p>
                    </div>
                  </div>

                  {/* Shoe Condition Tags */}
                  <div className="pt-3 border-t border-slate-200/60">
                    <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                      Shoe Condition
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(item.condition || {}).map(([key, value]) => {
                        if (key === 'others' && value) {
                          return (
                            <span
                              key={key}
                              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 shadow-2xs"
                            >
                              Note: {String(value)}
                            </span>
                          );
                        }
                        if (value === true) {
                          const labels: Record<string, string> = {
                            scratches: 'Scratches',
                            yellowing: 'Yellowing',
                            ripsHoles: 'Rips/Holes',
                            deepStains: 'Deep Stains',
                            soleSeparation: 'Sole Separation',
                            wornOut: 'Faded/Worn',
                          };
                          const label =
                            labels[key] ||
                            key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
                          return (
                            <span
                              key={key}
                              className="px-2.5 py-0.5 bg-red-50 border border-red-100 rounded-full text-xs font-bold text-red-600"
                            >
                              {label}
                            </span>
                          );
                        }
                        return null;
                      })}
                      {Object.values(item.condition || {}).every((v) => !v) && (
                        <p className="text-xs text-slate-400 italic">No conditions applied</p>
                      )}
                    </div>
                  </div>

                  {/* Base & Add-on Services */}
                  <div className="pt-3 border-t border-slate-200/60">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                          Base Service
                        </Label>
                        <p className="text-sm font-bold text-slate-800">
                          {baseServicesList.length > 0
                            ? baseServicesList.map((s: string) => String(s).replace(' (with basic cleaning)', '')).join(', ')
                            : '-'}
                        </p>
                      </div>

                      <div className="text-right">
                        <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                          Add-ons Applied
                        </Label>
                        {addOnsList.length > 0 ? (
                          <div className="flex flex-wrap justify-end gap-1.5 pt-0.5">
                            {addOnsList.map((addon: any, idx: number) => {
                              const addonName =
                                typeof addon === 'string'
                                  ? addon
                                  : addon.name || addon.service_name || String(addon);
                              const addonQty =
                                typeof addon === 'object' && addon.quantity && addon.quantity > 1
                                  ? ` (x${addon.quantity})`
                                  : '';
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50/80 border border-blue-100 rounded-lg text-xs font-bold text-blue-700 shadow-2xs"
                                >
                                  <Sparkles size={11} className="text-blue-500 shrink-0" />
                                  <span>
                                    {addonName}
                                    {addonQty}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-slate-400 italic">None</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pair Status & Dates Tracking Card */}
                  <div className="mt-3 pt-3 border-t border-slate-200/80 bg-white/70 p-3 rounded-xl border border-slate-100 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-red-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                          {itemsToDisplay.length > 1 ? `Pair #${index + 1} Status & Tracking` : 'Pair Status & Tracking'}
                        </span>
                        {(() => {
                          const itemSt = (item.status || order.status || 'pending').toLowerCase();
                          const badgeStyles: Record<string, string> = {
                            'pending': 'bg-amber-100 text-amber-800 border-amber-200',
                            'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
                            'for-release': 'bg-emerald-100 text-emerald-800 border-emerald-200',
                            'claimed': 'bg-slate-900 text-white border-slate-900',
                            'cancelled': 'bg-red-100 text-red-800 border-red-200',
                          };
                          const badgeStyle = badgeStyles[itemSt] || 'bg-gray-100 text-gray-800 border-gray-200';
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                              {itemSt.replace('-', ' ')}
                            </span>
                          );
                        })()}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenUpdatePair(item, index)}
                        className="h-7 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-1.5 shadow-2xs"
                      >
                        <Edit3 size={12} />
                        Update Pair
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Release Date
                        </span>
                        {item.actualReleaseDate ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-mono font-bold text-xs">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            <span>{formatDate(item.actualReleaseDate, 'MM/dd/yy hh:mm a')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium italic text-[11px]">
                            {['for-release', 'claimed'].includes((item.status || order.status || '').toLowerCase()) && releaseTimestamp(order)
                              ? `${formatDate(releaseTimestamp(order), 'MM/dd/yy hh:mm a')} (Order Batch)`
                              : 'Pending completion'}
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Claimed Date
                        </span>
                        {item.actualCompletionDate ? (
                          <div className="flex items-center gap-1.5 text-slate-900 font-mono font-bold text-xs">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            <span>{formatDate(item.actualCompletionDate, 'MM/dd/yy hh:mm a')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium italic text-[11px]">
                            {(item.status || order.status || '').toLowerCase() === 'claimed' && order.actualCompletionDate
                              ? `${formatDate(order.actualCompletionDate, 'MM/dd/yy hh:mm a')} (Order Batch)`
                              : 'Pending customer claim'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card 6: Payment Details */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-red-500" />
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Payment Details
                </h4>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                  order.paymentStatus === 'fully-paid'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : order.paymentStatus === 'downpayment'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-red-100 text-red-800 border-red-200'
                }`}
              >
                {order.paymentStatus === 'fully-paid'
                  ? 'Fully Paid'
                  : order.paymentStatus === 'downpayment'
                  ? '50% Downpayment'
                  : 'Unpaid'}
              </span>
            </div>

            <div className={`grid gap-4 ${['gcash', 'maya'].includes(order.paymentMethod?.toLowerCase() || '') && order.referenceNo && paymentHistory.length <= 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="text-left">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Method
                </Label>
                <p className="text-sm font-bold text-slate-800 uppercase">
                  {order.paymentMethod || 'Cash'}
                </p>
              </div>

              <div className={['gcash', 'maya'].includes(order.paymentMethod?.toLowerCase() || '') && order.referenceNo && paymentHistory.length <= 1 ? 'text-center' : 'text-right'}>
                <Label className={`text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block ${['gcash', 'maya'].includes(order.paymentMethod?.toLowerCase() || '') && order.referenceNo && paymentHistory.length <= 1 ? 'text-center' : 'text-right'}`}>
                  Amount Received
                </Label>
                <p className="text-sm font-bold text-slate-800">
                  ₱{(order.amountReceived || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {['gcash', 'maya'].includes(order.paymentMethod?.toLowerCase() || '') && order.referenceNo && paymentHistory.length <= 1 && (
                <div className="text-right">
                  <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block text-right">
                    Reference Number
                  </Label>
                  <p className="text-sm font-mono font-bold text-slate-900 tracking-tight">
                    {order.referenceNo}
                  </p>
                </div>
              )}

              {/* Payment History Breakdown Section */}
              {paymentHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 col-span-full space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Payment History
                    </Label>
                    <span className="text-[10px] font-bold text-slate-500">
                      {paymentHistory.length} transaction{paymentHistory.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {paymentHistory.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md ${p.paymentType === 'downpayment' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {p.paymentType === 'downpayment' ? <Wallet size={14} /> : <CheckCircle2 size={14} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800">
                                {p.paymentType === 'downpayment' ? 'Downpayment' : p.paymentType === 'final-payment' ? 'Balance Settled (Claim)' : 'Payment'}
                              </span>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {p.method}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                              {p.referenceNo && (
                                <span>Ref: <span className="font-mono font-bold text-slate-600">{p.referenceNo}</span></span>
                              )}
                              {p.date && (
                                <span>• {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              )}
                              {p.processedBy && (
                                <span>• By: {p.processedBy}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900">
                            ₱{Number(p.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {order.change !== undefined && order.change > 0 && (
                <div className="text-left col-span-full">
                  <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                    Customer Change
                  </Label>
                  <p className="text-sm font-bold text-emerald-600">
                    ₱{(order.change || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200/60 col-span-full flex justify-between items-center">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Remaining Balance
                </Label>
                <p
                  className={`text-sm font-black ${
                    remainingBalance > 0.01 ? 'text-red-500' : 'text-emerald-600'
                  }`}
                >
                  ₱{remainingBalance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Card 7: Logged Materials & Stock Status */}
          {order && (
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-emerald-600" />
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Materials / Supply Logged
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  {(order as any).inventoryApplied && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Stock Deducted
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsStockModalOpen(true)}
                    className="h-6 px-2.5 text-[11px] font-bold text-emerald-700 border-emerald-300 bg-white hover:bg-emerald-100 shadow-xs flex items-center gap-1 cursor-pointer"
                    title="Update materials recorded for this order"
                  >
                    <Package size={12} className="text-emerald-600" />
                    <span>Update Inventory</span>
                  </Button>
                </div>
              </div>
              {safeInventoryUsed && safeInventoryUsed.filter((u: any) => u.quantity > 0).length > 0 ? (
                <div className="space-y-2">
                  {safeInventoryUsed.filter((u: any) => u.quantity > 0).map((used: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-xs font-medium text-slate-700"
                    >
                      <span>{used.name}</span>
                      <span className="font-bold text-slate-900 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                        {used.quantity} {used.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2 text-[11px] text-emerald-700/80 font-medium">
                  No materials recorded for this order yet. Click &quot;Update Inventory&quot; to log consumed supplies.
                </div>
              )}
            </div>
          )}

          {/* Card 8: Pricing & Grand Total Breakdown Card */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-xs font-medium uppercase tracking-wide">Total Quantity</span>
              <span className="text-sm font-bold text-slate-800">
                {order.quantity || 1} {(order.quantity || 1) === 1 ? 'Pair' : 'Pairs'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-xs font-medium uppercase tracking-wide">Base Service Fee</span>
              <span className="text-sm font-bold text-slate-800">
                ₱{(order.baseServiceFee || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-xs font-medium uppercase tracking-wide">Add-ons Total</span>
              <span className="text-sm font-bold text-slate-800">
                ₱{(order.addOnsTotal || 0).toFixed(2)}
              </span>
            </div>
            {order.priorityLevel === 'rush' && calculatedRushFee > 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="text-xs font-medium uppercase tracking-wide">Rush Fee</span>
                <span className="text-sm font-bold text-slate-800">₱{calculatedRushFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200/80 mt-2">
              <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Grand Total
              </span>
              <span className="text-lg font-black text-red-600 tracking-tight">
                ₱{(order.grandTotal || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Printable Job Order Summary Modal */}
      <Dialog open={showPrintSummary} onOpenChange={setShowPrintSummary}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[450px] bg-white p-4 sm:p-8 rounded-3xl border-none shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogTitle className="sr-only">Printable Job Order Summary</DialogTitle>
          <DialogDescription className="sr-only">Receipt and job order summary for printing</DialogDescription>
          <div id="print-job-summary" className="space-y-3 font-mono text-xs text-slate-800 print:p-0 print:m-0 print:shadow-none print:border-none print:w-full">
            {/* Logo and Header */}
            <div className="text-center space-y-1 pb-1">
              <div className="flex justify-center mb-2">
                <img src="/logo.png" alt="Shoelotskey Logo" className="h-14 w-14 object-contain mx-auto" />
              </div>
              <div className="border-b border-dashed border-gray-300 my-2"></div>
              <h2 className="text-base font-black uppercase tracking-widest text-slate-900 font-sans">SHOELOTSKEY</h2>
              <p className="text-[11px] font-bold text-slate-700 font-sans uppercase">Shoe Cleaning & Restoration Services</p>
              <p className="text-[10px] text-slate-500 font-sans">Villamor, Pasay City</p>
              <div className="pt-2 pb-1">
                <span className="inline-block bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest px-4 py-1 rounded">
                  JOB ORDER SUMMARY
                </span>
              </div>
              <div className="border-b border-dashed border-gray-300 my-2"></div>
            </div>

            {/* Order Summary Section */}
            <div className="space-y-1 pt-1">
              <div className="grid grid-cols-[110px_1fr] gap-1 text-[11px]">
                <span className="text-slate-500 font-bold uppercase">Order No.</span>
                <span className="font-black text-slate-900">: {order.orderNumber}</span>
                <span className="text-slate-500 font-bold uppercase">Status</span>
                <span className="font-bold uppercase text-slate-900">: {order.status?.replace('-', ' ')}</span>
                <span className="text-slate-500 font-bold uppercase">Priority</span>
                <span className="font-bold uppercase text-slate-900">: {order.priorityLevel || 'Regular'}</span>
              </div>
            </div>

            {/* Customer Section */}
            <div className="space-y-1 pt-1">
              <div className="border-b border-dashed border-gray-300 my-2"></div>
              <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Customer Details</h3>
              <div className="grid grid-cols-[110px_1fr] gap-1 text-[11px]">
                <span className="text-slate-500 font-bold">Name</span>
                <span className="font-bold text-slate-900">: {order.customerName || '-'}</span>
                <span className="text-slate-500 font-bold">Contact No.</span>
                <span className="font-bold text-slate-900">: {order.contactNumber || '-'}</span>
              </div>
            </div>

            {/* Service Details Section */}
            <div className="space-y-1.5 pt-1">
              <div className="border-b border-dashed border-gray-300 my-2"></div>
              <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Service Details</h3>
              <div className="space-y-1 text-[11px]">
                <span className="font-bold text-slate-800 block">Total Qty: {order.quantity || 1} Pair{(order.quantity || 1) > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1 pt-1 text-[11px]">
                <span className="font-bold text-slate-800 block">Shoe Information:</span>
                {itemsToDisplay.map((it: any, idx: number) => {
                  const itemServices = Array.isArray(it.baseService) ? it.baseService.join(', ') : (it.baseService || 'General Service');
                  const itemAddOnsRaw = it.addOns || it.add_ons;
                  let itemAddOns = '';
                  if (Array.isArray(itemAddOnsRaw) && itemAddOnsRaw.length > 0) {
                      itemAddOns = itemAddOnsRaw.map((a: any) => typeof a === 'string' ? a : (a.name || a.service_name)).join(', ');
                  } else if (typeof itemAddOnsRaw === 'string' && itemAddOnsRaw) {
                      try {
                          const p = JSON.parse(itemAddOnsRaw);
                          itemAddOns = Array.isArray(p) ? p.map((a: any) => typeof a === 'string' ? a : (a.name || a.service_name)).join(', ') : itemAddOnsRaw;
                      } catch { itemAddOns = itemAddOnsRaw; }
                  }
                  
                  return (
                    <div key={idx} className="pl-2 space-y-0.5 pb-2 border-l-2 border-slate-200 my-1">
                      <p className="text-slate-900 font-bold uppercase tracking-wide text-[10px] text-red-600">Item {idx + 1}</p>
                      <p className="text-slate-900 font-bold">• {it.brand} {it.shoeModel}</p>
                      <p className="text-slate-600 text-[10px]">  Material: {it.shoeMaterial || 'N/A'}</p>
                      <p className="text-slate-600 text-[10px]">  Size: {(() => { const size = displayItemSize(it, order); return size === '-' ? 'N/A' : size; })()}</p>
                      <p className="text-slate-600 text-[10px]">  Color: {(() => { const color = displayItemColor(it, order); return color === '-' ? 'N/A' : color; })()}</p>
                      <p className="text-slate-800 text-[10px] pt-0.5 font-medium">  Services: {itemServices}</p>
                      {itemAddOns && <p className="text-slate-800 text-[10px] font-medium">  Add-ons: {itemAddOns}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Additional Products Section */}
            {(() => {
              const retailItems = safeInventoryUsed.filter((i: any) => i.isRetail || (i.price && i.price > 0));
              const extraProducts = (order as any).purchasedProducts || (retailItems.length > 0 ? retailItems : []);
              if (extraProducts.length === 0) return null;
              return (
                <div className="space-y-1.5 pt-1">
                  <div className="border-b border-dashed border-gray-300 my-2"></div>
                  <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Additional Products</h3>
                  <div className="space-y-1 text-[11px]">
                    {extraProducts.map((prod: any, idx: number) => {
                      const qty = prod.quantity || 1;
                      const price = prod.price || 0;
                      return (
                        <div key={idx} className="flex justify-between items-center text-slate-800">
                          <span className="font-semibold">• {prod.name} ×{qty}</span>
                          <span className="font-bold text-slate-900">₱{(qty * price).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Schedule Section */}
            <div className="space-y-1 pt-1">
              <div className="border-b border-dashed border-gray-300 my-2"></div>
              <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Schedule Details</h3>
              <div className="grid grid-cols-[110px_1fr] gap-1 text-[11px]">
                <span className="text-slate-500 font-bold">Order Date</span>
                <span className="font-bold text-slate-900">: {(() => {
                  try { return dateFnsFormat(new Date(order.createdAt || (order as any).orderDate || Date.now()), 'MMMM d, yyyy'); }
                  catch { return '-'; }
                })()}</span>
                <span className="text-slate-500 font-bold">Estimated Date</span>
                <span className="font-bold text-slate-900">: {(() => {
                  try {
                    const raw = order.predictedCompletionDate || (order as any).estimatedReleaseDate || (order as any).releaseDate;
                    const brDays = estimate?.business_rule_days ?? (order.estimatedDays != null ? Number(order.estimatedDays) : null);
                    const formatted = raw ? dateFnsFormat(new Date(raw), 'MMMM d, yyyy') : '-';
                    return brDays != null ? `${formatted} (BR: ${brDays} ${brDays === 1 ? 'day' : 'days'})` : formatted;
                  }
                  catch { return '-'; }
                })()}</span>
                <span className="text-slate-500 font-bold">Predicted Date</span>
                <span className="font-bold text-slate-900">: {(() => {
                  try {
                    const mlDays = estimate?.ml_predicted_days ?? (order.predictedDays != null ? Number(order.predictedDays) : null);
                    const baseDate = order.transactionDate || order.createdAt;
                    const dt = estimate?.ml_predicted_date || order.predictedAt || (mlDays != null && baseDate ? new Date(new Date(baseDate).getTime() + mlDays * 24 * 60 * 60 * 1000) : null);
                    const formatted = dt ? dateFnsFormat(new Date(dt), 'MMMM d, yyyy') : 'Unavailable';
                    return mlDays != null ? `${formatted} (ML: ${mlDays} ${mlDays === 1 ? 'day' : 'days'})` : formatted;
                  }
                  catch { return '-'; }
                })()}</span>
                <span className="text-slate-500 font-bold">Total Days</span>
                <span className="font-bold text-slate-900">: {(() => {
                  try {
                    const completedDate = order.actualCompletionDate || (order as any).claimedAt || (order.statusHistory?.find((s: any) => s.status === 'claimed')?.timestamp);
                    const receivedDate = order.transactionDate || order.createdAt;
                    if (isClaimed && completedDate && receivedDate) {
                      const diffMs = new Date(completedDate).getTime() - new Date(receivedDate).getTime();
                      const totalDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                      return `${totalDays} ${totalDays === 1 ? 'day' : 'days'} (Completed)`;
                    }
                    return 'Not yet completed';
                  } catch { return 'Not yet completed'; }
                })()}</span>
                {isForRelease && (
                  <>
                    <span className="text-slate-500 font-bold">Release Date</span>
                    <span className="font-bold text-slate-900">: {(() => {
                      try {
                        const raw = releaseTimestamp(order);
                        return raw ? dateFnsFormat(new Date(raw), 'MMMM d, yyyy') : '-';
                      }
                      catch { return '-'; }
                    })()}</span>
                  </>
                )}
                {isClaimed && (
                  <>
                    <span className="text-slate-500 font-bold">Claimed Date</span>
                    <span className="font-bold text-slate-900">: {(() => {
                      try {
                        const claimHist = order.statusHistory?.find((h: any) => h.status === 'claimed');
                        return dateFnsFormat(new Date(claimHist?.timestamp || order.updatedAt || Date.now()), 'MMMM d, yyyy');
                      } catch { return '-'; }
                    })()}</span>
                  </>
                )}
              </div>
            </div>

            {/* Payment Summary Section (Receipt Formatted) */}
            <div className="space-y-1 pt-1">
              <div className="border-b border-dashed border-gray-300 my-2"></div>
              <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Payment Summary</h3>
              <div className="bg-slate-50/80 print:bg-transparent p-3 print:p-0 rounded-xl space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Service Total</span>
                  <span className="font-bold text-slate-900">₱{(baseTotal + addOnsTotal + calculatedRushFee).toFixed(2)}</span>
                </div>
                
                {(() => {
                  const retailItems = safeInventoryUsed.filter((i: any) => i.isRetail || (i.price && i.price > 0));
                  const extraProducts = (order as any).purchasedProducts || (retailItems.length > 0 ? retailItems : []);
                  const addlTotal = extraProducts.reduce((acc: number, item: any) => acc + ((item.quantity || 1) * (item.price || 0)), 0);
                  if (addlTotal === 0) return null;
                  return (
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Additional Items</span>
                      <span className="font-bold text-slate-900">₱{addlTotal.toFixed(2)}</span>
                    </div>
                  );
                })()}

                {(((order as any).discountAmount || (order as any).refundAmount || 0) > 0) && (
                  <div className="flex justify-between items-center text-rose-600 font-semibold">
                    <span>Discount/Refund</span>
                    <span>-₱{((order as any).discountAmount || (order as any).refundAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="border-b border-dashed border-gray-300 my-1"></div>
                <div className="flex justify-between items-center text-sm font-black text-slate-900">
                  <span>TOTAL AMOUNT</span>
                  <span>₱{(order.grandTotal || 0).toFixed(2)}</span>
                </div>
                <div className="border-b border-dashed border-gray-300 my-1"></div>
                
                {paymentHistory && paymentHistory.length > 0 ? (
                  <div className="space-y-1 pt-0.5">
                    {paymentHistory.map((p: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-slate-600">
                        <span>
                          {p.paymentType === 'downpayment' ? 'Downpayment' : p.paymentType === 'final-payment' ? 'Balance Paid' : 'Payment'}
                          {' '}({String(p.method || 'cash').toUpperCase()}{p.referenceNo ? ` · Ref: ${p.referenceNo}` : ''})
                        </span>
                        <span className="font-bold text-slate-900">₱{Number(p.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Deposit Paid</span>
                    <span className="font-bold text-slate-900">₱{(order.paymentStatus === 'downpayment' ? (order.amountReceived || (order.grandTotal || 0) / 2) : (order.amountReceived || 0)).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-slate-600">
                  <span>Balance Due</span>
                  <span className="font-bold text-slate-900">₱{isClaimed ? '0.00' : Math.max(0, (order.grandTotal || 0) - (order.amountReceived || (order.paymentStatus === 'downpayment' ? (order.grandTotal || 0) / 2 : 0))).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 print:border-dashed">
                  <span className="font-bold text-slate-700 uppercase">Payment Status</span>
                  <span className="font-black uppercase tracking-wider text-slate-900 bg-slate-200 print:bg-transparent px-2 py-0.5 rounded text-[10px]">
                    {isClaimed ? 'FULLY PAID' : (order.paymentStatus?.replace('-', ' ') || 'PENDING')}
                  </span>
                </div>
              </div>
            </div>

            {/* Claimed By Section */}
            {isClaimed && (
              <div className="space-y-1 pt-1">
                <div className="border-b border-dashed border-gray-300 my-2"></div>
                <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Claim Detail</h3>
                <div className="grid grid-cols-[110px_1fr] gap-1 text-[11px]">
                  <span className="text-slate-500 font-bold">Customer</span>
                  <span className="font-bold text-slate-900">: {order.claimedBy || order.customerName || '-'}</span>
                  <span className="text-slate-500 font-bold">Released By</span>
                  <span className="font-bold text-slate-900">: {(() => {
                    const claimHist = order.statusHistory?.find((h: any) => h.status === 'claimed');
                    return claimHist?.user || 'Staff';
                  })()}</span>
                </div>
              </div>
            )}

            {/* Disclaimer Footer (Disguising as Summary) */}
            <div className="text-center pt-3 space-y-1.5">
              <div className="border-b border-dashed border-gray-300 my-2"></div>
              <p className="text-[10px] text-slate-500 font-sans italic leading-relaxed px-4">
                This document is generated for reference and service tracking purposes only.<br />
                It is not a BIR Official Receipt or Sales Invoice.
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-1">
                *** THANK YOU FOR TRUSTING SHOELOTSKEY ***
              </p>
              <div className="border-b border-dashed border-gray-300 my-2"></div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-100 no-print w-full">
            <Button variant="outline" onClick={() => setShowPrintSummary(false)} className="flex-1 h-11 rounded-2xl font-bold text-xs uppercase tracking-widest border-slate-200 text-gray-700 hover:bg-slate-100 transition-all justify-center">
              Close
            </Button>
            <Button
              onClick={() => {
                document.body.classList.add('printing-job-summary');
                const scrollParent = document.getElementById('print-job-summary')?.parentElement;
                if (scrollParent) scrollParent.scrollTop = 0;
                window.print();
                setTimeout(() => {
                  document.body.classList.remove('printing-job-summary');
                }, 1000);
              }}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Printer size={16} strokeWidth={2.5} /> Print Summary
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingPairIndex !== null && (() => {
        const currentItem = itemsToDisplay[editingPairIndex];
        return (
          <Dialog open={editingPairIndex !== null} onOpenChange={(isOpen) => !isOpen && setEditingPairIndex(null)}>
            <DialogContent className="max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl z-[100]">
              <DialogHeader>
                <DialogTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-slate-900">
                  <Package size={16} className="text-red-600" />
                  Update Pair #{editingPairIndex + 1} Status
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {currentItem?.brand || 'Shoe'} - {currentItem?.shoeModel || 'Item'} ({displayItemColor(currentItem, order)})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pair Status
                  </Label>
                  <Select value={pairStatus === 'in-progress' ? 'on-going' : pairStatus} onValueChange={handlePairStatusChange}>
                    <SelectTrigger className="h-10 text-xs border border-slate-300 bg-white shadow-sm font-semibold rounded-lg focus:ring-1 focus:ring-red-500">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                      <SelectItem value="on-going" className="text-xs">On-Going (In Progress)</SelectItem>
                      <SelectItem value="for-release" className="text-xs">For Release (Done)</SelectItem>
                      <SelectItem value="claimed" className="text-xs">Claimed (Collected)</SelectItem>
                      <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Release Date & Time
                    </Label>
                    <button
                      type="button"
                      onClick={() => setPairReleaseDate(toDateTimeLocal(new Date()))}
                      className="text-[10px] font-bold text-red-600 hover:underline"
                    >
                      Set to Now
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={pairReleaseDate}
                    onChange={(e) => setPairReleaseDate(e.target.value)}
                    className="w-full h-9 px-3 border border-gray-200 rounded-md text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    When this pair was completed and ready for pickup/delivery.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Claimed Date & Time
                    </Label>
                    <button
                      type="button"
                      onClick={() => setPairClaimedDate(toDateTimeLocal(new Date()))}
                      className="text-[10px] font-bold text-red-600 hover:underline"
                    >
                      Set to Now
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={pairClaimedDate}
                    onChange={(e) => setPairClaimedDate(e.target.value)}
                    className="w-full h-9 px-3 border border-gray-200 rounded-md text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    When the customer picked up or received this specific pair.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingPairIndex(null)}
                  disabled={isUpdatingPair}
                  className="min-w-[130px] sm:min-w-[140px] h-10 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-md shadow-slate-300/50 hover:shadow-lg rounded-xl active:scale-[0.98] transition-all"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSavePairUpdate}
                  disabled={isUpdatingPair}
                  className="min-w-[130px] sm:min-w-[140px] h-10 px-6 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider gap-2 shadow-md shadow-red-500/30 hover:shadow-lg rounded-xl active:scale-[0.98] transition-all"
                >
                  {isUpdatingPair ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <StockUpdateModal
        order={order}
        open={isStockModalOpen}
        onOpenChange={setIsStockModalOpen}
        onSilentSave={(id, updates) => {
          updateOrder(id, updates);
        }}
        onSave={(id, updates) => {
          updateOrder(id, updates);
          setIsStockModalOpen(false);
        }}
        user={user}
      />
    </Dialog>
  );
}



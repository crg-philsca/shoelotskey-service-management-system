import { useState } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
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
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { useOrders } from '@/app/context/OrderContext';
import type { JobOrder } from '@/app/types';

interface OrderDetailModalProps {
  order: JobOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OrderDetailModal({
  order: propOrder,
  open,
  onOpenChange,
}: OrderDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [showPrintSummary, setShowPrintSummary] = useState(false);
  const { orders } = useOrders();

  // Dynamically retrieve the real-time updated order from OrderContext so edits are reflected immediately
  const order = propOrder ? (orders.find((o) => o.id === propOrder.id) || propOrder) : null;

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
  const remainingBalance = Math.max(
    0,
    (order as any).balance ?? (order.grandTotal || 0) - (order.amountReceived || 0)
  );

  const isClaimed = order.status === 'claimed';
  const isForRelease = order.status === 'for-release' || isClaimed;

  const safeInventoryUsed: any[] = Array.isArray(order?.inventoryUsed)
    ? order.inventoryUsed
    : (typeof order?.inventoryUsed === 'string'
      ? (() => { try { const p = JSON.parse(order.inventoryUsed); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden rounded-2xl max-h-[85vh] flex flex-col border-none shadow-2xl">
        {/* Header Bar with Interactive Copyable Order ID & Print Icon */}
        <DialogHeader className="p-4 border-b border-gray-100 bg-white flex flex-row items-center justify-between">
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
          {/* Card 1: Order Status & Process Overview */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-3">
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
                <p className="text-xs font-mono font-semibold text-slate-700 truncate">
                  {order.updatedAt ? formatDate(order.updatedAt) : formatDate(order.createdAt)}
                </p>
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
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Contact Number
                </Label>
                <div className="flex items-center gap-1.5">
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

            {/* Order Date & Predicted Release Date (Matching Calendar Icon & Font/Time Format) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Order Date
                </Label>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={12} className="text-slate-400 shrink-0" />
                  <p className="text-xs font-mono font-semibold text-slate-800">
                    {formatDate(order.transactionDate || order.createdAt)}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Predicted Release Date
                </Label>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={12} className="text-slate-400 shrink-0" />
                  <p className="text-xs font-mono font-semibold text-slate-800">
                    {order.predictedCompletionDate
                      ? `${formatDate(order.predictedCompletionDate, 'MM/dd/yy')}${order.releaseTime ? ` ${order.releaseTime}` : ''}`
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Actual Release Date (Shown ONLY if status is For Release or Claimed) */}
            {isForRelease && (
              <div className="pt-3 border-t border-slate-200/60">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Actual Release Date
                </Label>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-orange-600 shrink-0" />
                  <p className="text-xs font-mono font-bold text-orange-700">
                    {order.actualReleaseDate
                      ? formatDate(order.actualReleaseDate)
                      : (order as any).statusHistory?.find((s: any) => s.status === 'for-release')
                      ? formatDate((order as any).statusHistory.find((s: any) => s.status === 'for-release').timestamp)
                      : formatDate(order.updatedAt)}
                  </p>
                </div>
              </div>
            )}

            {/* Claimed Date, Claimed By, & Released By (Shown STRICTLY ONLY if status is Claimed) */}
            {isClaimed && (
              <div className="pt-3 border-t border-slate-200/60 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Claimed Date
                    </Label>
                    <p className="text-xs font-mono font-bold text-emerald-800">
                      {order.actualCompletionDate
                        ? formatDate(order.actualCompletionDate)
                        : (order as any).statusHistory?.find((s: any) => s.status === 'claimed')
                        ? formatDate((order as any).statusHistory.find((s: any) => s.status === 'claimed').timestamp)
                        : formatDate(order.updatedAt)}
                    </p>
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
                  <div>
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
                  <div className="grid grid-cols-3 gap-4">
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
                        Material & Qty
                      </Label>
                      <p className="text-sm font-bold text-slate-800">
                        {item.shoeMaterial || '-'} ({item.quantity || 1} {(item.quantity || 1) === 1 ? 'Pair' : 'Pairs'})
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

                      <div>
                        <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                          Add-ons Applied
                        </Label>
                        {addOnsList.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Method
                </Label>
                <p className="text-sm font-bold text-slate-800 uppercase">
                  {order.paymentMethod || 'Cash'}
                </p>
              </div>

              {['gcash', 'maya'].includes(order.paymentMethod?.toLowerCase() || '') && order.referenceNo && (
                <div>
                  <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                    Reference Number
                  </Label>
                  <p className="text-xs font-mono font-bold text-slate-800 tracking-tight">
                    {order.referenceNo}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Amount Received
                </Label>
                <p className="text-sm font-bold text-slate-800">
                  ₱{(order.amountReceived || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {order.change !== undefined && order.change > 0 && (
                <div>
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

              <div className="pt-3 border-t border-slate-200/60 col-span-2 flex justify-between items-center">
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

          {/* Card 7: Logged Materials & Stock Status (Shown only if supplies logged) */}
          {safeInventoryUsed && safeInventoryUsed.length > 0 && (
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-emerald-600" />
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Materials / Supply Logged
                  </h4>
                </div>
                {(order as any).inventoryApplied && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Stock Deducted
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {safeInventoryUsed.map((used: any, idx: number) => (
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
        <DialogContent className="max-w-[500px] bg-white p-6 sm:p-8 rounded-3xl border-none shadow-2xl overflow-y-auto max-h-[90vh]">
          <div id="print-job-summary" className="space-y-4 font-mono text-xs text-slate-800 print:p-0 print:m-0 print:shadow-none print:border-none print:w-full">
            {/* Logo and Header */}
            <div className="text-center space-y-1.5 pb-2">
              <div className="flex justify-center mb-2">
                <img src="/logo.png" alt="Shoelotskey Logo" className="h-14 w-14 object-contain mx-auto" />
              </div>
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
              <h2 className="text-base font-black uppercase tracking-widest text-slate-900 font-sans">SHOELOTSKEY</h2>
              <p className="text-xs font-semibold text-slate-700 font-sans">Shoe Cleaning & Restoration Services</p>
              <p className="text-[11px] text-slate-500 font-sans">Villamor, Pasay City</p>
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
            </div>

            {/* Order Summary Section */}
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider font-sans text-xs">ORDER SUMMARY</h3>
              <div className="grid grid-cols-[130px_1fr] gap-2 pt-1">
                <span className="text-slate-600">Order No.</span>
                <span className="font-bold text-slate-900">: {order.orderNumber}</span>
                <span className="text-slate-600">Status</span>
                <span className="font-bold capitalize text-slate-900">: {order.status?.replace('-', ' ')}</span>
              </div>
            </div>

            {/* Customer Section */}
            <div className="space-y-1 pt-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider font-sans text-xs">Customer</h3>
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-600">Name</span>
                <span className="font-bold text-slate-900">: {order.customerName || '-'}</span>
                <span className="text-slate-600">Contact Number</span>
                <span className="font-bold text-slate-900">: {order.contactNumber || '-'}</span>
              </div>
            </div>

            {/* Service Details Section */}
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider font-sans text-xs">Service Details</h3>
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Services:</span>
                {Array.from(new Set(itemsToDisplay.flatMap((it: any) => 
                  Array.isArray(it.baseService) ? it.baseService : [it.baseService || 'General Service']
                ))).filter(Boolean).map((srv: string, idx: number) => (
                  <p key={idx} className="text-slate-700 pl-2">• {srv}</p>
                ))}
              </div>
              <div className="space-y-1 pt-1">
                <span className="font-bold text-slate-800 block">Shoe Information:</span>
                {itemsToDisplay.map((it: any, idx: number) => (
                  <div key={idx} className="pl-2 space-y-0.5 pb-1">
                    <p className="text-slate-900 font-semibold">• {it.brand} {it.shoeModel}</p>
                    <p className="text-slate-600">• {it.shoeMaterial || 'Material N/A'}</p>
                    <p className="text-slate-600">• {it.quantity || 1} Pair{(it.quantity || 1) > 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Products Section (If customer bought products) */}
            {(() => {
              const retailItems = safeInventoryUsed.filter((i: any) => i.isRetail || (i.price && i.price > 0));
              const extraProducts = (order as any).purchasedProducts || (retailItems.length > 0 ? retailItems : []);
              if (extraProducts.length === 0) return null;
              return (
                <div className="space-y-1.5 pt-2">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider font-sans text-xs">Additional Products</h3>
                  <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
                  <div className="space-y-1">
                    {extraProducts.map((prod: any, idx: number) => {
                      const qty = prod.quantity || 1;
                      const price = prod.price || 0;
                      return (
                        <div key={idx} className="flex justify-between items-center text-slate-800">
                          <span>• {prod.name} ×{qty} <span className="text-gray-300 font-mono">.............</span></span>
                          <span className="font-bold">₱{(qty * price).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Schedule Section */}
            <div className="space-y-1 pt-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider font-sans text-xs">Schedule</h3>
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-600">Order Date</span>
                <span className="font-bold text-slate-900">: {(() => {
                  try { return dateFnsFormat(new Date(order.createdAt || (order as any).orderDate || Date.now()), 'MMMM d, yyyy'); }
                  catch { return '-'; }
                })()}</span>
                <span className="text-slate-600">Release Date</span>
                <span className="font-bold text-slate-900">: {(() => {
                  try { return dateFnsFormat(new Date((order as any).estimatedReleaseDate || (order as any).releaseDate || Date.now()), 'MMMM d, yyyy'); }
                  catch { return '-'; }
                })()}</span>
                {isClaimed && (
                  <>
                    <span className="text-slate-600">Claim Date</span>
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

            {/* Payment Summary Section */}
            <div className="space-y-1 pt-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider font-sans text-xs">Payment Summary</h3>
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
              <div className="grid grid-cols-[130px_1fr] gap-1.5">
                <span className="text-slate-600">Service Total</span>
                <span className="font-bold text-slate-900">: ₱{(baseTotal + addOnsTotal + calculatedRushFee).toFixed(2)}</span>
                
                {(() => {
                  const retailItems = safeInventoryUsed.filter((i: any) => i.isRetail || (i.price && i.price > 0));
                  const extraProducts = (order as any).purchasedProducts || (retailItems.length > 0 ? retailItems : []);
                  const addlTotal = extraProducts.reduce((acc: number, item: any) => acc + ((item.quantity || 1) * (item.price || 0)), 0);
                  return (
                    <>
                      <span className="text-slate-600">Additional Items</span>
                      <span className="font-bold text-slate-900">: ₱{addlTotal.toFixed(2)}</span>
                    </>
                  );
                })()}

                <span className="text-slate-600">Discount/Refund</span>
                <span className="font-bold text-slate-900">: ₱{((order as any).discountAmount || (order as any).refundAmount || 0).toFixed(2)}</span>
                
                <span className="text-slate-600">Total Amount</span>
                <span className="font-bold text-slate-900">: ₱{(order.grandTotal || 0).toFixed(2)}</span>
                
                <span className="text-slate-600">Deposit</span>
                <span className="font-bold text-slate-900">: ₱{(order.paymentStatus === 'downpayment' ? (order.amountReceived || (order.grandTotal || 0) / 2) : (order.amountReceived || 0)).toFixed(2)}</span>
                
                <span className="text-slate-600">Balance Paid</span>
                <span className="font-bold text-slate-900">: ₱{isClaimed ? Math.max(0, (order.grandTotal || 0) - (order.amountReceived || 0)).toFixed(2) : '0.00'}</span>
                
                <span className="text-slate-600">Payment Status</span>
                <span className="font-bold capitalize text-slate-900">: {isClaimed ? 'Fully Paid' : (order.paymentStatus?.replace('-', ' ') || 'Pending')}</span>
              </div>
            </div>

            {/* Claimed By Section */}
            {isClaimed && (
              <div className="space-y-1 pt-2">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider font-sans text-xs">Claimed By</h3>
                <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
                <div className="grid grid-cols-[130px_1fr] gap-1.5">
                  <span className="text-slate-600">Customer</span>
                  <span className="font-bold text-slate-900">: {order.claimedBy || order.customerName || '-'}</span>
                  <span className="text-slate-600">Released By</span>
                  <span className="font-bold text-slate-900">: {(() => {
                    const claimHist = order.statusHistory?.find((h: any) => h.status === 'claimed');
                    return claimHist?.user || 'Staff';
                  })()}</span>
                </div>
              </div>
            )}

            {/* Disclaimer Footer */}
            <div className="text-center pt-4 space-y-1">
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
              <p className="text-[11px] text-slate-500 font-sans italic leading-tight">
                This document is generated for reference purposes only.<br />
                It is not a BIR Official Receipt or Sales Invoice.
              </p>
              <p className="text-gray-400 font-bold tracking-tighter">--------------------------------------------------------</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 no-print">
            <Button variant="outline" onClick={() => setShowPrintSummary(false)} className="rounded-xl font-bold">
              Close
            </Button>
            <Button onClick={() => window.print()} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 rounded-xl flex items-center gap-2 shadow-md">
              <Printer size={16} /> Print Summary
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}



import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { API_BASE } from '@/app/lib/apiBase';
import { parseDateFromOrderId } from '@/app/lib/orderNumber';
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
  Pencil,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Edit3,
  Plus,
  Camera,
  ZoomIn,
  Upload,
  Trash2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';
import { useOrders } from '@/app/context/OrderContext';
import { useInventory } from '@/app/context/InventoryContext';
import type { JobOrder } from '@/app/types';
import { calculateOfficialReleaseBreakdown, addCalendarDays } from '@/app/lib/businessRules';
import AddMaterialModal from '@/app/components/AddMaterialModal';
import SignaturePadModal from '@/app/components/SignaturePadModal';
import ImagePreviewModal from '@/app/components/ImagePreviewModal';
import ClaimSlipModal from '@/app/components/ClaimSlipModal';
import EditOrderModal from '@/app/components/EditOrderModal';
import { compressImageFile, saveOrderAttachments, enrichOrderWithAttachments } from '@/app/lib/imageUtils';

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
    if (text && text !== '-' && text.toLowerCase() !== 'n/a' && text.toLowerCase() !== 'other' && text.toLowerCase() !== 'unknown') return text;
  }
  return '-';
}

function displayItemColor(item: any, order?: any) {
  const candidates = [item?.color, order?.color];
  for (const raw of candidates) {
    if (Array.isArray(raw)) {
      const joined = raw
        .map((c) => String(c).trim())
        .filter(Boolean)
        .filter((c) => c.toLowerCase() !== 'other' && c.toLowerCase() !== 'unknown')
        .join(', ');
      if (joined) return joined;
      continue;
    }
    const text = String(raw ?? '').trim();
    if (text && text !== '-' && text.toLowerCase() !== 'n/a' && text.toLowerCase() !== 'other' && text.toLowerCase() !== 'unknown') return text;
  }
  return '-';
}

function formatSpecification(val?: any): string {
  const text = String(val ?? '').trim();
  if (!text || text === '-' || text.toLowerCase() === 'other' || text.toLowerCase() === 'unknown' || text.toLowerCase() === 'n/a') {
    return '-';
  }
  return text;
}

function DateValue({ colorClass, children }: { colorClass: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <CalendarIcon size={12} className={`${colorClass} shrink-0`} />
      <p className="text-sm font-mono font-bold text-slate-900">{children}</p>
    </div>
  );
}

function ScheduleDateInput({
  value,
  onChange,
  className = '',
  id,
}: {
  value: string; // ISO: YYYY-MM-DD
  onChange: (isoDate: string) => void;
  className?: string;
  id?: string;
}) {
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const toDisplay = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) {
      const yy = parts[0].length === 4 ? parts[0].slice(2) : parts[0];
      return `${parts[1]}/${parts[2]}/${yy}`;
    }
    return iso;
  };

  const [displayVal, setDisplayVal] = useState(toDisplay(value));

  useEffect(() => {
    setDisplayVal(toDisplay(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let digits = raw.replace(/[^0-9]/g, '');
    if (digits.length > 8) digits = digits.slice(0, 8);

    let formatted = digits;
    if (digits.length > 2 && digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    setDisplayVal(formatted);

    // If 6 digits (MMDDYY)
    if (digits.length === 6) {
      const mm = digits.slice(0, 2);
      const dd = digits.slice(2, 4);
      const yy = digits.slice(4, 6);
      const yyyy = parseInt(yy, 10) < 50 ? `20${yy}` : `19${yy}`;
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        onChange(`${yyyy}-${mm}-${dd}`);
      }
    } else if (digits.length === 8) {
      const mm = digits.slice(0, 2);
      const dd = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        onChange(`${yyyy}-${mm}-${dd}`);
      }
    } else if (digits.length === 0) {
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!displayVal) {
      onChange('');
      return;
    }
    const digits = displayVal.replace(/[^0-9]/g, '');
    if (digits.length === 6) {
      const mm = digits.slice(0, 2);
      const dd = digits.slice(2, 4);
      const yy = digits.slice(4, 6);
      const yyyy = parseInt(yy, 10) < 50 ? `20${yy}` : `19${yy}`;
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        const iso = `${yyyy}-${mm}-${dd}`;
        onChange(iso);
        setDisplayVal(`${mm}/${dd}/${yy}`);
        return;
      }
    } else if (digits.length === 8) {
      const mm = digits.slice(0, 2);
      const dd = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      const yy = yyyy.slice(2);
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        const iso = `${yyyy}-${mm}-${dd}`;
        onChange(iso);
        setDisplayVal(`${mm}/${dd}/${yy}`);
        return;
      }
    }
    // Revert to valid value if incomplete or invalid
    setDisplayVal(toDisplay(value));
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isoVal = e.target.value;
    if (isoVal) {
      setDisplayVal(toDisplay(isoVal));
      onChange(isoVal);
    }
  };

  const openPicker = () => {
    if (hiddenDateRef.current) {
      try {
        if (typeof (hiddenDateRef.current as any).showPicker === 'function') {
          (hiddenDateRef.current as any).showPicker();
        } else {
          hiddenDateRef.current.focus();
          hiddenDateRef.current.click();
        }
      } catch {
        hiddenDateRef.current.click();
      }
    }
  };

  return (
    <div className="relative w-full flex items-center min-w-0">
      <input
        id={id}
        type="text"
        placeholder="MM/DD/YY"
        value={displayVal}
        onChange={handleTextChange}
        onBlur={handleBlur}
        maxLength={8}
        className={`w-full bg-white h-7 text-[11px] font-mono font-semibold pl-1.5 pr-6 py-0.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded text-left placeholder:text-slate-400 text-slate-800 ${className}`}
        title="Date (MM/DD/YY)"
      />
      <button
        type="button"
        onClick={openPicker}
        title="Open Calendar Picker"
        tabIndex={-1}
        className="absolute right-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5 text-[10px] leading-none shrink-0"
      >
        <CalendarIcon size={12} />
      </button>
      <input
        ref={hiddenDateRef}
        type="date"
        value={value || ''}
        onChange={handlePickerChange}
        className="sr-only absolute pointer-events-none opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

function ScheduleMilitaryTimeInput({
  value,
  onChange,
  className = '',
  id,
}: {
  value: string; // HH:mm (24-hour military time)
  onChange: (timeStr: string) => void;
  className?: string;
  id?: string;
}) {
  const hiddenTimeRef = useRef<HTMLInputElement>(null);
  const [displayVal, setDisplayVal] = useState(value || '');

  useEffect(() => {
    setDisplayVal(value || '');
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let digits = raw.replace(/[^0-9]/g, '');
    if (digits.length > 4) digits = digits.slice(0, 4);

    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }

    setDisplayVal(formatted);

    if (digits.length === 4) {
      let hh = parseInt(digits.slice(0, 2), 10);
      let mm = parseInt(digits.slice(2, 4), 10);
      if (hh > 23) hh = 23;
      if (mm > 59) mm = 59;
      const validTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      onChange(validTime);
    } else if (digits.length === 0) {
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!displayVal) {
      onChange('');
      return;
    }
    const digits = displayVal.replace(/[^0-9]/g, '');
    if (digits.length === 4) {
      let hh = parseInt(digits.slice(0, 2), 10);
      let mm = parseInt(digits.slice(2, 4), 10);
      if (hh > 23) hh = 23;
      if (mm > 59) mm = 59;
      const validTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      onChange(validTime);
      setDisplayVal(validTime);
      return;
    } else if (digits.length === 1 || digits.length === 2) {
      let hh = parseInt(digits, 10);
      if (hh > 23) hh = 23;
      const validTime = `${String(hh).padStart(2, '0')}:00`;
      onChange(validTime);
      setDisplayVal(validTime);
      return;
    } else if (digits.length === 3) {
      let hh = parseInt(digits.slice(0, 1), 10);
      let mm = parseInt(digits.slice(1, 3), 10);
      if (hh > 23) hh = 23;
      if (mm > 59) mm = 59;
      const validTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      onChange(validTime);
      setDisplayVal(validTime);
      return;
    }
    setDisplayVal(value || '');
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeVal = e.target.value;
    setDisplayVal(timeVal);
    onChange(timeVal);
  };

  const openPicker = () => {
    if (hiddenTimeRef.current) {
      try {
        if (typeof (hiddenTimeRef.current as any).showPicker === 'function') {
          (hiddenTimeRef.current as any).showPicker();
        } else {
          hiddenTimeRef.current.focus();
          hiddenTimeRef.current.click();
        }
      } catch {
        hiddenTimeRef.current.click();
      }
    }
  };

  return (
    <div className="relative w-full flex items-center min-w-0">
      <input
        id={id}
        type="text"
        placeholder="HH:mm"
        value={displayVal}
        onChange={handleTextChange}
        onBlur={handleBlur}
        maxLength={5}
        className={`w-full bg-white h-7 text-[11px] font-mono font-semibold pl-1.5 pr-5 py-0.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded text-left placeholder:text-slate-400 text-slate-800 ${className}`}
        title="Military Time (24h: 00:00 - 23:59)"
      />
      <button
        type="button"
        onClick={openPicker}
        title="Select Military Time (24h)"
        tabIndex={-1}
        className="absolute right-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5 text-[10px] leading-none shrink-0"
      >
        <Clock size={12} />
      </button>
      <input
        ref={hiddenTimeRef}
        type="time"
        step="60"
        value={value || ''}
        onChange={handlePickerChange}
        className="sr-only absolute pointer-events-none opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

function hasExplicitTime(dateVal: any): boolean {
  if (!dateVal) return false;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
    if (/T00:00(:00(\.000)?)?(Z)?$/.test(trimmed)) return false;
    if (/\s00:00(:00)?$/.test(trimmed)) return false;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function releaseTimestamp(order: JobOrder) {
  if (order.actualReleaseDate) return order.actualReleaseDate;
  if ((order as any).released_at) return (order as any).released_at;
  const fromLogs = ((order as any).statusHistory || [])
    .filter((s: any) => s.status === 'for-release' && s.timestamp)
    .map((s: any) => new Date(s.timestamp))
    .filter((d: Date) => !isNaN(d.getTime()))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime());
  if (fromLogs[0]) return fromLogs[0];
  // Strict separation: never use Claimed Date (actualCompletionDate) as release/service completion date
  return null;
}

function claimTimestamp(order: JobOrder) {
  if (order.actualCompletionDate) return order.actualCompletionDate;
  if ((order as any).claimedAt) return new Date((order as any).claimedAt);
  const fromLogs = ((order as any).statusHistory || [])
    .filter((s: any) => s.status === 'claimed' && s.timestamp)
    .map((s: any) => new Date(s.timestamp))
    .filter((d: Date) => !isNaN(d.getTime()))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime());
  if (fromLogs[0]) return fromLogs[0];
  return null;
}

export default function OrderDetailModal({
  order: propOrder,
  open,
  onOpenChange,
  user,
}: OrderDetailModalProps) {
  const { orders, updateOrder, refreshOrders } = useOrders();
  const [copied, setCopied] = useState(false);
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
  const [materialModalTarget, setMaterialModalTarget] = useState<{ itemId?: string | number; label: string } | null>(null);
  const [signatureRole, setSignatureRole] = useState<'customer' | 'staff' | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);
  const [uploadingType, setUploadingType] = useState<'before' | 'after' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadContextRef = useRef<{ itemIndex: number; type: 'before' | 'after' } | null>(null);

  // Collapsible cards state
  const [expandedPhotos, setExpandedPhotos] = useState<Record<number, boolean>>({});
  const [expandedPairTracking, setExpandedPairTracking] = useState<Record<number, boolean>>({});
  const [expandedPairMaterials, setExpandedPairMaterials] = useState<Record<number, boolean>>({});
  const [expandedRetail, setExpandedRetail] = useState<boolean>(false);
  const [showAddRetailForm, setShowAddRetailForm] = useState<boolean>(false);

  // Schedule & Tracking inline edit state
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleOrderDate, setScheduleOrderDate] = useState('');
  const [scheduleOrderTime, setScheduleOrderTime] = useState('');
  const [scheduleTargetReleaseDate, setScheduleTargetReleaseDate] = useState('');
  const [scheduleTargetReleaseTime, setScheduleTargetReleaseTime] = useState('');
  const [scheduleActualReleaseDate, setScheduleActualReleaseDate] = useState('');
  const [scheduleActualReleaseTime, setScheduleActualReleaseTime] = useState('');
  const [scheduleClaimedDate, setScheduleClaimedDate] = useState('');
  const [scheduleClaimedTime, setScheduleClaimedTime] = useState('');

  useEffect(() => {
    if (open) {
      setExpandedRetail(false);
      setShowAddRetailForm(false);
      setExpandedPhotos({});
      setExpandedPairTracking({});
      setExpandedPairMaterials({});
      setIsEditingSchedule(false);
      setIsSavingSchedule(false);
    }
  }, [open, propOrder?.id]);

  // Inventory context & Retail store products integration
  const { inventoryData, updateStock } = useInventory();
  const [showClaimSlip, setShowClaimSlip] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);

  const handleSaveOrderEdit = async (orderId: string, updates: Partial<JobOrder>) => {
    try {
      await updateOrder(orderId, updates, user?.username || 'Staff');
      await refreshOrders();
      toast.success('Order details updated successfully');
      setIsEditingOrder(false);
    } catch (err: any) {
      toast.error('Failed to update order details: ' + (err?.message || 'Error'));
    }
  };

  const [selectedRetailId, setSelectedRetailId] = useState<string>('');
  const [retailQty, setRetailQty] = useState<string>('1');
  const [retailPrice, setRetailPrice] = useState<string>('0.00');
  const [isAddingRetail, setIsAddingRetail] = useState(false);

  // Dynamically retrieve the real-time updated order from OrderContext so edits are reflected immediately
  const rawOrder = propOrder ? (orders.find((o: JobOrder) => o.id === propOrder.id || (Boolean(propOrder.orderNumber) && o.orderNumber === propOrder.orderNumber)) || propOrder) : null;
  const order = useMemo(() => rawOrder ? enrichOrderWithAttachments(rawOrder) : null, [rawOrder]);
  const customerSig = order?.customerSignature || '';
  const staffSig = order?.staffSignature || '';

  // Auto-fill retail price with 2 decimal places when selecting an item
  useEffect(() => {
    if (selectedRetailId) {
      const item = inventoryData.find(i => i.id.toString() === selectedRetailId);
      if (item) {
        const p = Number(item.retail_price || 0);
        setRetailPrice(p > 0 ? p.toFixed(2) : '0.00');
      }
    }
  }, [selectedRetailId, inventoryData]);

  const triggerCameraCapture = (itemIndex: number, type: 'before' | 'after') => {
    uploadContextRef.current = { itemIndex, type };
    setUploadingItemIndex(itemIndex);
    setUploadingType(type);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const triggerFileUpload = (itemIndex: number, type: 'before' | 'after') => {
    uploadContextRef.current = { itemIndex, type };
    setUploadingItemIndex(itemIndex);
    setUploadingType(type);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetCtx = uploadContextRef.current || (uploadingItemIndex !== null && uploadingType ? { itemIndex: uploadingItemIndex, type: uploadingType } : null);
    if (!file || !targetCtx || !order) return;
    const targetItemIndex = targetCtx.itemIndex;
    const targetType = targetCtx.type;

    try {
      toast.loading('Processing and attaching photo...', { id: 'attach-photo' });
      const compressedDataUrl = await compressImageFile(file);
      const rawItems = order.items && order.items.length > 0 ? [...order.items] : [{ ...order }];
      if (rawItems[targetItemIndex]) {
        rawItems[targetItemIndex] = {
          ...rawItems[targetItemIndex],
          [targetType === 'before' ? 'beforeImage' : 'afterImage']: compressedDataUrl,
        };
      }
      const orderKey = order.orderNumber || order.id;
      const itemId = rawItems[targetItemIndex]?.id || targetItemIndex;
      saveOrderAttachments(orderKey, {
        itemAttachments: {
          itemIdOrIndex: itemId,
          [targetType === 'before' ? 'beforeImage' : 'afterImage']: compressedDataUrl,
        },
        ...(targetItemIndex === 0 ? { [targetType === 'before' ? 'beforeImage' : 'afterImage']: compressedDataUrl } : {}),
      });

      await updateOrder(order.id, {
        items: rawItems,
        ...(targetItemIndex === 0 ? { [targetType === 'before' ? 'beforeImage' : 'afterImage']: compressedDataUrl } : {}),
      }, user?.username || 'Staff');

      toast.success(`${targetType === 'before' ? 'Before (Received)' : 'After (Released)'} photo attached!`, { id: 'attach-photo' });
    } catch (err: any) {
      toast.error('Failed to attach photo: ' + (err?.message || 'Error processing image'), { id: 'attach-photo' });
    } finally {
      uploadContextRef.current = null;
      setUploadingItemIndex(null);
      setUploadingType(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = async (itemIndex: number, type: 'before' | 'after') => {
    if (!order) return;
    try {
      const rawItems = order.items && order.items.length > 0 ? [...order.items] : [{ ...order }];
      if (rawItems[itemIndex]) {
        rawItems[itemIndex] = {
          ...rawItems[itemIndex],
          [type === 'before' ? 'beforeImage' : 'afterImage']: '',
        };
      }
      const orderKey = order.orderNumber || order.id;
      const itemId = rawItems[itemIndex]?.id || itemIndex;
      saveOrderAttachments(orderKey, {
        itemAttachments: {
          itemIdOrIndex: itemId,
          [type === 'before' ? 'beforeImage' : 'afterImage']: '',
        },
        ...(itemIndex === 0 ? { [type === 'before' ? 'beforeImage' : 'afterImage']: '' } : {}),
      });

      await updateOrder(order.id, {
        items: rawItems,
        ...(itemIndex === 0 ? { [type === 'before' ? 'beforeImage' : 'afterImage']: '' } : {}),
      }, user?.username || 'Staff');

      toast.success(`${type === 'before' ? 'Before' : 'After'} photo removed.`);
    } catch (err: any) {
      toast.error('Failed to remove photo.');
    }
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!order || !signatureRole) return;
    try {
      const orderKey = order.orderNumber || order.id;
      if (signatureRole === 'customer') {
        saveOrderAttachments(orderKey, { customerSignature: signatureDataUrl });
        await updateOrder(order.id, { customerSignature: signatureDataUrl }, user?.username || 'Customer');
        toast.success('Customer signature saved!');
      } else {
        saveOrderAttachments(orderKey, { staffSignature: signatureDataUrl });
        await updateOrder(order.id, { staffSignature: signatureDataUrl }, user?.username || 'Staff');
        toast.success('Staff signature saved!');
      }
      setSignatureRole(null);
    } catch (err: any) {
      toast.error('Failed to save signature.');
    }
  };

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
        brand: item.brand || '',
        shoeModel: item.shoeModel || '',
        shoeMaterial: item.shoeMaterial || '',
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

  // =========================================================================
  // AUTHORITATIVE SCHEDULE & TRACKING DEFINITIONS (RESEARCH/OPERATIONAL LOCK)
  // Unconditionally called at top level before any early returns (Rule of Hooks)
  // =========================================================================
  // 1. Authoritative Received Date (Order Date)
  const receivedDate = useMemo(() => {
    if (!order) return new Date();
    const idDate = parseDateFromOrderId(order.orderNumber);

    let timeSourceDate: Date | null = null;
    if (order.transactionDate && !isNaN(new Date(order.transactionDate).getTime())) {
      timeSourceDate = new Date(order.transactionDate);
    } else if (order.createdAt && !isNaN(new Date(order.createdAt).getTime())) {
      timeSourceDate = new Date(order.createdAt);
    } else if ((order as any).created_at && !isNaN(new Date((order as any).created_at).getTime())) {
      timeSourceDate = new Date((order as any).created_at);
    } else if (order.statusHistory && order.statusHistory.length > 0 && order.statusHistory[0]?.timestamp) {
      timeSourceDate = new Date(order.statusHistory[0].timestamp);
    }

    let resultDate: Date;
    if (idDate) {
      resultDate = new Date(idDate);
    } else if (order.orderDate && !isNaN(new Date(order.orderDate).getTime())) {
      resultDate = new Date(order.orderDate);
    } else if (timeSourceDate) {
      resultDate = new Date(timeSourceDate);
    } else {
      resultDate = new Date();
    }

    if (order.orderTime && typeof order.orderTime === 'string') {
      const parts = order.orderTime.split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        resultDate.setHours(parts[0], parts[1], parts[2] || 0, 0);
      }
    } else if (timeSourceDate && (timeSourceDate.getHours() !== 0 || timeSourceDate.getMinutes() !== 0)) {
      resultDate.setHours(timeSourceDate.getHours(), timeSourceDate.getMinutes(), timeSourceDate.getSeconds(), 0);
    } else if (order.createdAt && !isNaN(new Date(order.createdAt).getTime())) {
      const cDate = new Date(order.createdAt);
      if (cDate.getHours() !== 0 || cDate.getMinutes() !== 0) {
        resultDate.setHours(cDate.getHours(), cDate.getMinutes(), cDate.getSeconds(), 0);
      }
    }

    return resultDate;
  }, [order]);

  // 2. Authoritative Business Rule Duration (Shoelotskey Non-Additive Combination Dominance Rules)
  const authoritativeBrDays = useMemo(() => {
    if (!order) return 0;
    if (officialBreakdown.totalDays > 0) return officialBreakdown.totalDays;
    if (order.estimatedDays != null && Number(order.estimatedDays) > 0) return Number(order.estimatedDays);
    if ((order as any).business_rule_days != null && Number((order as any).business_rule_days) > 0) return Number((order as any).business_rule_days);
    return 25;
  }, [officialBreakdown, order]);

  // 3. Authoritative Official Release Date (Strictly: Received Date + BR Duration using calendar-day math)
  const authoritativeOfficialReleaseDate = useMemo(() => {
    if (!order || !authoritativeBrDays) return null;
    return addCalendarDays(receivedDate, authoritativeBrDays);
  }, [order, receivedDate, authoritativeBrDays]);

  // 4. Advisory ML Predicted Duration & Date
  const mlDays = useMemo(() => {
    if (!order) return null;
    const d = (order.predictedDays != null ? Number(order.predictedDays) : null)
      ?? ((order as any).predicted_days != null ? Number((order as any).predicted_days) : null)
      ?? estimate?.ml_predicted_days;
    return (d != null && d > 0) ? d : null;
  }, [order, estimate]);

  const mlDate = useMemo(() => {
    if (!order) return null;
    if (order.predictedAt) return new Date(order.predictedAt);
    if ((order as any).predicted_at) return new Date((order as any).predicted_at);
    if (estimate?.ml_predicted_date) return new Date(estimate.ml_predicted_date);
    if (mlDays != null) return addCalendarDays(receivedDate, mlDays);
    return null;
  }, [order, estimate, mlDays, receivedDate]);

  // 5. Actual Release Date (from released_at / for-release event)
  const actualReleaseDate = useMemo(() => {
    if (!order) return null;
    return releaseTimestamp(order);
  }, [order]);

  // 6. Claimed Date (from claimed_at / claimed event)
  const actualClaimedDate = useMemo(() => {
    if (!order) return null;
    return claimTimestamp(order);
  }, [order]);

  // 7. Actual Turnaround (Authoritative: Actual Release Date - Received Date)
  const actualTurnaroundDays = useMemo(() => {
    if (actualReleaseDate && receivedDate && !isNaN(new Date(actualReleaseDate).getTime()) && !isNaN(new Date(receivedDate).getTime())) {
      const rD = new Date(receivedDate);
      rD.setHours(0, 0, 0, 0);
      const aD = new Date(actualReleaseDate);
      aD.setHours(0, 0, 0, 0);
      const diffDays = Math.round((aD.getTime() - rD.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    }
    return null;
  }, [actualReleaseDate, receivedDate]);

  useEffect(() => {
    if (!open || !order) {
      setEstimate(null);
      setPredictionLoading(false);
      setPredictionError(false);
      return;
    }

    // Use persisted authoritative data from the saved order directly (no re-calculation)
    const rawTxDate = order.transactionDate || order.createdAt;
    const storedBrDays = order.estimatedDays != null
      ? Number(order.estimatedDays)
      : ((order as any).business_rule_days != null
          ? Number((order as any).business_rule_days)
          : (officialBreakdown.totalDays > 0
              ? officialBreakdown.totalDays
              : (order.predictedCompletionDate && rawTxDate
                  ? Math.max(1, Math.round((new Date(order.predictedCompletionDate).getTime() - new Date(rawTxDate).getTime()) / (1000 * 60 * 60 * 24)))
                  : 25)));

    const storedBrDate = order.predictedCompletionDate || (order as any).expected_at || (() => {
      const base = rawTxDate ? new Date(rawTxDate) : new Date();
      return new Date(base.getTime() + storedBrDays * 24 * 60 * 60 * 1000).toISOString();
    })();

    const storedMlDays = order.predictedDays != null
      ? Number(order.predictedDays)
      : ((order as any).predicted_days != null ? Number((order as any).predicted_days) : null);
    const storedMlDate = (order.predictedAt || (order as any).predicted_at)
      ? new Date(order.predictedAt || (order as any).predicted_at).toISOString()
      : (storedMlDays != null && rawTxDate
          ? new Date(new Date(rawTxDate).getTime() + storedMlDays * 24 * 60 * 60 * 1000).toISOString()
          : null);

    setEstimate({
      business_rule_days: storedBrDays,
      business_rule_date: storedBrDate,
      ml_predicted_date: storedMlDate,
      ml_predicted_days: storedMlDays,
      ml_status: storedMlDays != null ? 'valid' : 'unavailable',
      ml_model: 'Random Forest Regression',
    });
    setPredictionLoading(false);
    setPredictionError(false);

    // If order already has persisted authoritative date and days, do NOT fetch /api/predict
    if ((order.predictedCompletionDate || (order as any).expected_at) && storedMlDays != null) {
      return;
    }

    // Legacy fallback: fetch /api/predict only if record completely lacks stored prediction
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
    fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        items: normalizedItems,
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
            business_rule_days: prev?.business_rule_days ?? data.business_rule_days ?? storedBrDays,
            business_rule_date: prev?.business_rule_date ?? data.business_rule_date ?? storedBrDate,
            ml_predicted_days: data.ml_predicted_days ?? prev?.ml_predicted_days,
            ml_predicted_date: data.ml_predicted_date ?? prev?.ml_predicted_date,
            ml_status: data.ml_status ?? prev?.ml_status,
          }));
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
    const rawStatus = (item.status || order?.status || 'pending').toLowerCase();
    const effectiveStatus = (rawStatus === 'new-order' || rawStatus === 'new order') ? 'pending' : (rawStatus === 'in-progress' ? 'on-going' : rawStatus);
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

      const finalStatus = (pairStatus === 'pending' || pairStatus === 'new order') ? 'new-order' : pairStatus;
      const updatedItem = {
        ...targetItem,
        status: finalStatus as any,
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
      const toastStatus = (finalStatus === 'new-order' ? 'New Order' : finalStatus.replace(/-/g, ' ')).toUpperCase();
      toast.success(`Pair #${editingPairIndex + 1} status updated to ${toastStatus}`);
      setEditingPairIndex(null);
    } catch (err: any) {
      console.error("Failed to update pair:", err);
      toast.error("Failed to update pair: " + (err?.message || "Unknown error"));
    } finally {
      setIsUpdatingPair(false);
    }
  };

  const handleDirectPairStatusChange = async (pairIdx: number, newStatus: string) => {
    if (!order) return;
    try {
      const rawItems = order.items && order.items.length > 0 ? [...order.items] : [{ ...order }];
      const targetItem = rawItems[pairIdx];
      if (!targetItem) return;

      const normalizedStatus = (newStatus === 'on-going' ? 'in-progress' : (newStatus === 'pending' || newStatus === 'new-order') ? 'new-order' : newStatus).toLowerCase();
      const nowIso = new Date().toISOString();
      let releaseIso = targetItem.actualReleaseDate;
      let claimedIso = targetItem.actualCompletionDate;

      if (['for-release', 'claimed'].includes(normalizedStatus) && !releaseIso) {
        releaseIso = nowIso;
      }
      if (normalizedStatus === 'claimed') {
        if (!claimedIso) claimedIso = nowIso;
        if (!releaseIso) releaseIso = nowIso;
      }

      const updatedItem = {
        ...targetItem,
        status: normalizedStatus as any,
        actualReleaseDate: releaseIso,
        actualCompletionDate: claimedIso,
      };
      rawItems[pairIdx] = updatedItem;

      const allClaimed = rawItems.length > 0 && rawItems.every(it => (it.status || '').toLowerCase() === 'claimed');
      const allForRelease = rawItems.length > 0 && rawItems.every(it => ['for-release', 'claimed'].includes((it.status || '').toLowerCase()));

      const updates: Partial<JobOrder> = {
        items: rawItems,
      };

      if (rawItems.length <= 1) {
        updates.status = normalizedStatus as any;
        if (['for-release', 'claimed'].includes(normalizedStatus) && !order.actualReleaseDate) {
          updates.actualReleaseDate = new Date(releaseIso || nowIso);
        }
        if (normalizedStatus === 'claimed' && !order.actualCompletionDate) {
          updates.actualCompletionDate = new Date(claimedIso || nowIso);
        }
      } else {
        if (allClaimed && order.status !== 'claimed') {
          updates.status = 'claimed';
          if (!order.actualCompletionDate) updates.actualCompletionDate = claimedIso ? new Date(claimedIso) : new Date();
          if (!order.actualReleaseDate) updates.actualReleaseDate = releaseIso ? new Date(releaseIso) : new Date();
        } else if (allForRelease && ['pending', 'in-progress'].includes(order.status)) {
          updates.status = 'for-release';
          if (!order.actualReleaseDate) updates.actualReleaseDate = releaseIso ? new Date(releaseIso) : new Date();
        }
      }

      await updateOrder(order.id, updates, user?.username || 'Staff');
      toast.success(`${rawItems.length > 1 ? `Pair #${pairIdx + 1}` : 'Pair'} status updated to ${newStatus === 'on-going' ? 'ON-GOING' : newStatus.toUpperCase()}`);
    } catch (err: any) {
      console.error('Failed to update pair status:', err);
      toast.error('Failed to update pair status: ' + (err?.message || 'Error'));
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

  const handleStartEditSchedule = () => {
    if (!order) return;

    // 1. Order Date & Time (Counter Logging)
    const ordDate = order.transactionDate ? new Date(order.transactionDate) : (order.createdAt ? new Date(order.createdAt) : null);
    if (ordDate && !isNaN(ordDate.getTime())) {
      const oy = ordDate.getFullYear();
      const om = String(ordDate.getMonth() + 1).padStart(2, '0');
      const oday = String(ordDate.getDate()).padStart(2, '0');
      setScheduleOrderDate(`${oy}-${om}-${oday}`);
      const ohh = String(ordDate.getHours()).padStart(2, '0');
      const omm = String(ordDate.getMinutes()).padStart(2, '0');
      setScheduleOrderTime(`${ohh}:${omm}`);
    } else {
      setScheduleOrderDate('');
      setScheduleOrderTime('');
    }

    // 2. Target Release Date & Time (Promised)
    const targetDate = authoritativeOfficialReleaseDate || (order.predictedCompletionDate ? new Date(order.predictedCompletionDate) : null);
    if (targetDate && !isNaN(new Date(targetDate).getTime())) {
      const td = new Date(targetDate);
      const ty = td.getFullYear();
      const tm = String(td.getMonth() + 1).padStart(2, '0');
      const tday = String(td.getDate()).padStart(2, '0');
      setScheduleTargetReleaseDate(`${ty}-${tm}-${tday}`);
      if (hasExplicitTime(targetDate)) {
        const thh = String(td.getHours()).padStart(2, '0');
        const tmm = String(td.getMinutes()).padStart(2, '0');
        setScheduleTargetReleaseTime(`${thh}:${tmm}`);
      } else if (order.releaseTime) {
        setScheduleTargetReleaseTime(order.releaseTime);
      } else {
        setScheduleTargetReleaseTime('');
      }
    } else {
      setScheduleTargetReleaseDate('');
      setScheduleTargetReleaseTime('');
    }

    // 3. Actual Release Date & Time (Workshop Completion)
    if (actualReleaseDate) {
      const d = new Date(actualReleaseDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setScheduleActualReleaseDate(`${y}-${m}-${day}`);
        if (hasExplicitTime(actualReleaseDate)) {
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          setScheduleActualReleaseTime(`${hh}:${mm}`);
        } else {
          setScheduleActualReleaseTime('');
        }
      } else {
        setScheduleActualReleaseDate('');
        setScheduleActualReleaseTime('');
      }
    } else {
      setScheduleActualReleaseDate('');
      setScheduleActualReleaseTime('');
    }

    // 4. Claimed Date & Time (Customer Pickup)
    const claimDate = claimTimestamp(order);
    if (claimDate) {
      const cd = new Date(claimDate);
      if (!isNaN(cd.getTime())) {
        const cy = cd.getFullYear();
        const cm = String(cd.getMonth() + 1).padStart(2, '0');
        const cday = String(cd.getDate()).padStart(2, '0');
        setScheduleClaimedDate(`${cy}-${cm}-${cday}`);
        if (hasExplicitTime(claimDate)) {
          const chh = String(cd.getHours()).padStart(2, '0');
          const cmm = String(cd.getMinutes()).padStart(2, '0');
          setScheduleClaimedTime(`${chh}:${cmm}`);
        } else {
          setScheduleClaimedTime('');
        }
      } else {
        setScheduleClaimedDate('');
        setScheduleClaimedTime('');
      }
    } else {
      setScheduleClaimedDate('');
      setScheduleClaimedTime('');
    }

    setIsEditingSchedule(true);
  };

  const handleUseReleaseDateForActual = () => {
    const targetDate = authoritativeOfficialReleaseDate || (order?.predictedCompletionDate ? new Date(order.predictedCompletionDate) : null);
    if (targetDate && !isNaN(new Date(targetDate).getTime())) {
      const td = new Date(targetDate);
      const ty = td.getFullYear();
      const tm = String(td.getMonth() + 1).padStart(2, '0');
      const tday = String(td.getDate()).padStart(2, '0');
      setScheduleActualReleaseDate(`${ty}-${tm}-${tday}`);
      setScheduleActualReleaseTime('');
      toast.info(`Release date set as actual release date (${tm}/${tday}/${ty}) without time`);
    } else {
      toast.error('Scheduled release date is not available');
    }
  };

  const handleResetTargetToBusinessRules = () => {
    const targetDate = authoritativeOfficialReleaseDate;
    if (targetDate && !isNaN(new Date(targetDate).getTime())) {
      const td = new Date(targetDate);
      const ty = td.getFullYear();
      const tm = String(td.getMonth() + 1).padStart(2, '0');
      const tday = String(td.getDate()).padStart(2, '0');
      setScheduleTargetReleaseDate(`${ty}-${tm}-${tday}`);
      setScheduleTargetReleaseTime(order?.releaseTime || '');
      toast.info(`Target release date reset to business rules (${tm}/${tday}/${ty})`);
    } else {
      toast.error('Business rules target is not available');
    }
  };

  const handleSaveSchedule = async () => {
    if (!order) return;
    setIsSavingSchedule(true);
    try {
      const updates: Partial<JobOrder> & Record<string, any> = {};

      // 1. Order Date & Time
      if (scheduleOrderDate.trim()) {
        const oTime = scheduleOrderTime.trim() ? `${scheduleOrderTime.trim()}:00` : '00:00:00';
        const finalOrderDate = new Date(`${scheduleOrderDate.trim()}T${oTime}`);
        updates.transactionDate = finalOrderDate;
        updates.createdAt = finalOrderDate;
      }

      // 2. Target Release Date & Time
      if (scheduleTargetReleaseDate.trim()) {
        const tTime = scheduleTargetReleaseTime.trim() ? `${scheduleTargetReleaseTime.trim()}:00` : '00:00:00';
        const finalTargetDate = new Date(`${scheduleTargetReleaseDate.trim()}T${tTime}`);
        updates.predictedCompletionDate = finalTargetDate;
        updates.expected_at = `${scheduleTargetReleaseDate.trim()}T${tTime}`;
        if (scheduleTargetReleaseTime.trim()) {
          updates.releaseTime = scheduleTargetReleaseTime.trim();
        }
      }

      // 3. Actual Release Date & Time
      let finalActualReleaseDate: string | null | undefined = undefined;
      if (scheduleActualReleaseDate.trim()) {
        if (scheduleActualReleaseTime.trim()) {
          finalActualReleaseDate = `${scheduleActualReleaseDate.trim()}T${scheduleActualReleaseTime.trim()}:00`;
        } else {
          finalActualReleaseDate = `${scheduleActualReleaseDate.trim()}`;
        }
      } else {
        finalActualReleaseDate = null;
      }
      updates.actualReleaseDate = finalActualReleaseDate;
      updates.released_at = finalActualReleaseDate;

      // 4. Claimed Date & Time
      let finalClaimedDate: string | null | undefined = undefined;
      if (scheduleClaimedDate.trim()) {
        if (scheduleClaimedTime.trim()) {
          finalClaimedDate = `${scheduleClaimedDate.trim()}T${scheduleClaimedTime.trim()}:00`;
        } else {
          finalClaimedDate = `${scheduleClaimedDate.trim()}`;
        }
        updates.actualCompletionDate = finalClaimedDate;
        updates.claimedAt = finalClaimedDate;
        updates.status = 'claimed';
      } else {
        updates.actualCompletionDate = null;
        updates.claimedAt = null;
        if ((order.status || '').toLowerCase() === 'claimed') {
          updates.status = finalActualReleaseDate ? 'for-release' : 'on-going';
        }
      }

      // If not claimed and actual release date was set, elevate to for-release
      if (!updates.status && finalActualReleaseDate && ['pending', 'new-order', 'in-progress', 'on-going'].includes((order.status || '').toLowerCase())) {
        updates.status = 'for-release';
      }

      // Sync items if order has items
      if (order.items && order.items.length > 0) {
        updates.items = order.items.map((it: any) => ({
          ...it,
          actualReleaseDate: finalActualReleaseDate,
          actualCompletionDate: finalClaimedDate,
          status: updates.status || it.status,
        }));
      }

      await updateOrder(order.id, updates, user?.username || 'Staff');
      await refreshOrders();
      toast.success('Schedule & Tracking updated successfully');
      setIsEditingSchedule(false);
    } catch (err: any) {
      console.error('Failed to update schedule:', err);
      toast.error('Failed to update schedule: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingSchedule(false);
    }
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
  const isClaimed = order.status === 'claimed';


  const resolveEntryMethod = (m?: string, ref?: string) => {
    const cleanRef = ref ? ref.replace(/\D/g, '') : '';
    if (cleanRef.length === 13) return 'gcash';
    const cleanMaya = ref ? ref.replace(/[^a-zA-Z0-9]/g, '') : '';
    if (cleanMaya.length === 12) return 'maya';
    const norm = String(m || '').trim().toLowerCase();
    if ((!norm || norm === 'cash') && cleanRef.length === 13) return 'gcash';
    return norm || 'cash';
  };

  // Resolve or sanitize payment history
  const paymentHistory: any[] = (() => {
    const rawHistory = Array.isArray(order.paymentHistory) ? order.paymentHistory : [];
    
    // An unclaimed order must NEVER contain a synthetic claim settlement transaction!
    const validHistory = rawHistory.filter((p: any) => {
      if (!isClaimed && (p.paymentType === 'final-payment' || String(p.notes || '').toLowerCase().includes('claim'))) {
        return false;
      }
      return true;
    });

    const gt = Number(order.grandTotal || 0);
    const dp = Number(order.depositAmount || 0);

    if (validHistory.length > 0) {
      return validHistory.map((p: any) => {
        const itemRef = p.referenceNo || (p.paymentType === 'downpayment' || validHistory.length === 1 ? order.referenceNo : (order as any).claimReferenceNo);
        const resolvedM = resolveEntryMethod(p.method, itemRef);
        // Ensure downpayment does not exceed grandTotal or deposit amount
        if (p.paymentType === 'downpayment' && dp > 0 && Number(p.amount) > dp) {
          return { ...p, method: resolvedM, referenceNo: itemRef || p.referenceNo, amount: dp };
        }
        if (p.paymentType === 'full-payment' && gt > 0 && Number(p.amount) > gt) {
          return { ...p, method: resolvedM, referenceNo: itemRef || p.referenceNo, amount: gt };
        }
        return { ...p, method: resolvedM, referenceNo: itemRef || p.referenceNo };
      });
    }

    const history: any[] = [];
    const dpAmt = dp || (order.paymentStatus === 'downpayment' ? Math.min(gt, Number(order.amountReceived || 0)) : 0) || 0;
    const totalRecv = Number(order.amountReceived || 0);
    const rawInitial = (order.initialPaymentMethod || (String(order.paymentMethod || '').includes(',') ? String(order.paymentMethod).split(',')[0].trim() : order.paymentMethod) || 'cash').toLowerCase();
    const initialMethod = resolveEntryMethod(rawInitial, order.referenceNo);
    const rawFinal = order.finalPaymentMethod ? String(order.finalPaymentMethod).toLowerCase() : (String(order.paymentMethod || '').includes(',') ? String(order.paymentMethod).split(',')[1].trim().toLowerCase() : undefined);
    const finalMethod = resolveEntryMethod(rawFinal, (order as any).claimReferenceNo);

    // ONLY synthesize pay-2 if order is genuinely CLAIMED, had a downpayment < grandTotal, and has claimed timestamp
    if (dpAmt > 0 && dpAmt < gt && isClaimed && ((order as any).claimedAt || (order as any).actualCompletionDate)) {
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
        amount: Math.max(0, gt - dpAmt),
        referenceNo: (order as any).claimReferenceNo,
        date: order.actualCompletionDate || order.updatedAt,
        processedBy: order.claimedBy || order.releasedBy || 'Staff',
        notes: 'Balance Settlement upon Claim'
      });
    } else if (dpAmt > 0 || order.paymentStatus === 'downpayment') {
      history.push({
        id: 'pay-1',
        paymentType: 'downpayment',
        method: initialMethod,
        amount: dpAmt > 0 ? dpAmt : (gt > 0 ? gt / 2 : totalRecv),
        referenceNo: order.referenceNo,
        date: order.createdAt || order.transactionDate,
        processedBy: order.processedBy || 'Staff',
        notes: 'Initial Downpayment'
      });
    } else if (totalRecv > 0 || gt > 0) {
      history.push({
        id: 'pay-1',
        paymentType: 'full-payment',
        method: initialMethod,
        amount: gt > 0 ? gt : totalRecv,
        referenceNo: order.referenceNo,
        date: order.createdAt || order.transactionDate,
        processedBy: order.processedBy || 'Staff',
        notes: 'Full Payment'
      });
    }
    return history;
  })();

  const effectivePaid = (() => {
    if (order.paymentStatus === 'fully-paid' || isClaimed) return Number(order.grandTotal || 0);
    if (paymentHistory.length > 0) {
      return Math.min(Number(order.grandTotal || 0), paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
    }
    const dp = Number(order.depositAmount);
    if (Number.isFinite(dp) && dp > 0) return Math.min(Number(order.grandTotal || 0), dp);
    const recv = Number(order.amountReceived);
    if (Number.isFinite(recv) && recv > 0 && recv < Number(order.grandTotal || 0)) return recv;
    return Number(order.grandTotal || 0) > 0 ? Number(order.grandTotal) / 2 : 0;
  })();

  const remainingBalance = (order.paymentStatus === 'fully-paid' || isClaimed)
    ? 0
    : Math.max(
        0,
        (order as any).balance !== undefined && (order as any).balance !== null && !isNaN(Number((order as any).balance))
          ? Number((order as any).balance)
          : (Number(order.grandTotal) || 0) - effectivePaid
      );

  const effectiveCustomerChange = (() => {
    if (order.change != null && !isNaN(Number(order.change)) && Number(order.change) >= 0) {
      return Number(order.change);
    }
    const rawTendered = Number(order.amountReceived || 0);
    return rawTendered > effectivePaid ? rawTendered - effectivePaid : 0;
  })();

  const effectivePaymentMethod = (() => {
    if (paymentHistory.length > 1) {
      const uniqueMethods = Array.from(new Set(paymentHistory.map(p => resolveEntryMethod(p.method, p.referenceNo).toLowerCase()))).join(', ');
      return uniqueMethods;
    }
    if (paymentHistory.length === 1) {
      return resolveEntryMethod(paymentHistory[0].method, paymentHistory[0].referenceNo || order.referenceNo);
    }
    return resolveEntryMethod(order.initialPaymentMethod || order.paymentMethod, order.referenceNo);
  })();

  const safeInventoryUsed: any[] = Array.isArray(order?.inventoryUsed)
    ? order.inventoryUsed
    : (typeof order?.inventoryUsed === 'string'
      ? (() => { try { const p = JSON.parse(order.inventoryUsed); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : []);

  const retailProducts = safeInventoryUsed.filter((item: any) => Boolean(item.isRetail));
  const retailTotal = retailProducts.reduce((sum: number, item: any) => sum + ((Number(item.quantity) || 0) * (Number(item.price) || 0)), 0);

  const handleAddRetailProduct = async () => {
    if (!order) return;
    const item = inventoryData.find(i => i.id.toString() === selectedRetailId);
    if (!item) {
      toast.error('Please select a retail product');
      return;
    }
    const qty = parseFloat(retailQty) || 1;
    const price = parseFloat(retailPrice) || 0;
    if (qty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (qty > item.stock) {
      toast.error(`Insufficient stock available (${item.stock} ${item.unit} left)`);
      return;
    }

    setIsAddingRetail(true);
    try {
      const currentUsed = Array.isArray(safeInventoryUsed) ? [...safeInventoryUsed] : [];
      const existingIdx = currentUsed.findIndex(u => u.itemId === item.id && u.isRetail);

      let updatedUsed: any[];
      if (existingIdx >= 0) {
        const updatedItem = {
          ...currentUsed[existingIdx],
          quantity: currentUsed[existingIdx].quantity + qty,
          price: price,
        };
        updatedUsed = [...currentUsed];
        updatedUsed[existingIdx] = updatedItem;
      } else {
        const newItem = {
          itemId: item.id,
          name: item.name,
          quantity: qty,
          unit: item.unit || 'pcs',
          price: price,
          isRetail: true,
          staffMember: user?.username || 'Staff',
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        };
        updatedUsed = [...currentUsed, newItem];
      }

      const newRetailTotal = updatedUsed
        .filter(u => Boolean(u.isRetail))
        .reduce((s, u) => s + ((Number(u.quantity) || 0) * (Number(u.price) || 0)), 0);

      const serviceSubtotal = (Number(order.baseServiceFee) || 0) + (Number(order.addOnsTotal) || 0) + calculatedRushFee;
      const newGrandTotal = serviceSubtotal + newRetailTotal;

      const orderDbId = parseInt(order.id);
      updateStock(item.id, qty, isNaN(orderDbId) ? undefined : orderDbId);

      await updateOrder(order.id, {
        inventoryUsed: updatedUsed,
        grandTotal: newGrandTotal,
      }, user?.username || 'Staff');

      setSelectedRetailId('');
      setRetailQty('1');
      setRetailPrice('0.00');
      toast.success(`Added ${qty} ${item.name} to order retail products!`);
    } catch (err: any) {
      toast.error('Failed to add retail product: ' + (err?.message || 'Error'));
    } finally {
      setIsAddingRetail(false);
    }
  };

  const handleRemoveRetailProduct = async (itemId: number) => {
    if (!order) return;
    try {
      const currentUsed = Array.isArray(safeInventoryUsed) ? [...safeInventoryUsed] : [];
      const targetProd = currentUsed.find(u => u.itemId === itemId && u.isRetail);
      if (!targetProd) return;

      const updatedUsed = currentUsed.filter(u => !(u.itemId === itemId && u.isRetail));
      const newRetailTotal = updatedUsed
        .filter(u => Boolean(u.isRetail))
        .reduce((s, u) => s + ((Number(u.quantity) || 0) * (Number(u.price) || 0)), 0);

      const serviceSubtotal = (Number(order.baseServiceFee) || 0) + (Number(order.addOnsTotal) || 0) + calculatedRushFee;
      const newGrandTotal = serviceSubtotal + newRetailTotal;

      const orderDbId = parseInt(order.id);
      updateStock(itemId, -(Number(targetProd.quantity) || 0), isNaN(orderDbId) ? undefined : orderDbId);

      await updateOrder(order.id, {
        inventoryUsed: updatedUsed,
        grandTotal: newGrandTotal,
      }, user?.username || 'Staff');

      toast.success(`Removed ${targetProd.name} from retail products`);
    } catch (err: any) {
      toast.error('Failed to remove retail product');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[540px] bg-white p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col border border-gray-100 shadow-2xl">
        {/* Header Bar with Interactive Copyable Order ID & Print Icons */}
        <DialogHeader className="p-3.5 sm:px-5 border-b border-gray-100 bg-white flex flex-row items-center justify-between shrink-0">
          <DialogDescription className="sr-only">Detailed view of order items, status, and financials</DialogDescription>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowClaimSlip(true)}
              title="Print Job Order & Claim Slip"
              aria-label="Print Job Order & Claim Slip"
              className="h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xs no-print cursor-pointer"
            >
              <Printer size={16} />
            </button>
          </div>
          <DialogTitle className="text-sm sm:text-base font-bold flex items-center justify-center gap-1.5 text-slate-900">
            <span>Order #</span>
            <button
              onClick={handleCopyOrderNumber}
              title="Click to copy Order ID"
              className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 group"
            >
              <span>{order.orderNumber}</span>
              {copied ? (
                <Check size={12} className="text-emerald-600 shrink-0" />
              ) : (
                <Copy size={12} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
              )}
            </button>
          </DialogTitle>
          <div className="w-8" /> {/* Spacer to balance header */}
        </DialogHeader>

        {/* Scrollable Content Body - Cleanly Categorized Cards */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 no-scrollbar">
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
                        const pre = order.preCancellationState;
                        const targetStage = (pre?.status || order.cancellationStage || 'new-order') as any;
                        const restoredPaymentStatus = pre?.paymentStatus || (Number(order.balance || 0) <= 0 ? 'fully-paid' : 'downpayment');
                        const restoredAmountReceived = pre?.amountReceived != null ? pre.amountReceived : order.amountReceived;
                        const restoredBalance = pre?.balance != null ? pre.balance : order.balance;
                        const restoredDepositAmount = pre?.depositAmount != null ? pre.depositAmount : order.depositAmount;

                        updateOrder(order.id, {
                          status: targetStage,
                          cancellationStage: null as any,
                          refundStatus: null as any,
                          refundAmount: 0,
                          refundReason: null as any,
                          cancelledAt: null as any,
                          preCancellationState: null as any,
                          paymentStatus: restoredPaymentStatus as any,
                          amountReceived: restoredAmountReceived,
                          balance: restoredBalance,
                          depositAmount: restoredDepositAmount,
                          ...(pre?.paymentMethod ? { paymentMethod: pre.paymentMethod } : {}),
                          ...(pre?.initialPaymentMethod ? { initialPaymentMethod: pre.initialPaymentMethod } : {}),
                          ...(pre?.finalPaymentMethod ? { finalPaymentMethod: pre.finalPaymentMethod } : {}),
                          ...(pre?.paymentHistory ? { paymentHistory: pre.paymentHistory } : {}),
                          updatedAt: new Date()
                        }, user?.username || 'Staff');
                        toast.success(`Order #${order.orderNumber} restored to ${String(targetStage).replace('-', ' ')} (${isRefund ? 'Refund Undone' : 'Cancellation Undone'})`);
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
                  {(order.cancellationReason || order.refundReason) && (
                    <div className="col-span-2 pt-1 border-t border-black/5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Reason for Cancellation</span>
                      <p className="text-xs text-gray-800 font-medium italic mt-0.5">{order.cancellationReason || order.refundReason}</p>
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
                  {order.status ? (order.status === 'new-order' ? 'New Order' : order.status.replace(/-/g, ' ')) : 'New Order'}
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

          {/* Card 3: Schedule & Tracking (Research/Operational Specification) */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <CalendarIcon size={15} className="text-red-500" />
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Schedule & Tracking
                </h4>
              </div>
              {!isEditingSchedule ? (
                <button
                  type="button"
                  onClick={handleStartEditSchedule}
                  className="h-7 w-7 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 flex items-center justify-center shadow-2xs cursor-pointer transition-all hover:scale-105 active:scale-95"
                  title="Edit Schedule & Tracking Dates"
                  aria-label="Edit Schedule & Tracking Dates"
                >
                  <Pencil size={13} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveSchedule}
                    disabled={isSavingSchedule}
                    className="h-7 px-3 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-2xs gap-1 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSavingSchedule ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={12} />
                        <span>Save</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingSchedule(false)}
                    disabled={isSavingSchedule}
                    className="h-7 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Row 1: Target Timeline (Order Date, Official Release, ML Predicted) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Order Date (Logged at counter) */}
              <div className="p-3 rounded-lg bg-white border border-slate-200/70 shadow-2xs min-w-0 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    Order Date
                  </Label>
                </div>
                {!isEditingSchedule ? (
                  <>
                    <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                      <DateValue colorClass="text-purple-600">
                        {formatDate(receivedDate, 'MM/dd/yy')}
                      </DateValue>
                      <span className="text-[11px] text-slate-500 font-mono font-medium">
                        {formatDate(receivedDate, 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium truncate">
                      Order logged at counter
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5 my-0.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-7">
                        <ScheduleDateInput
                          id="edit-schedule-order-date"
                          value={scheduleOrderDate}
                          onChange={(val) => setScheduleOrderDate(val)}
                          className="focus:border-purple-500"
                        />
                      </div>
                      <div className="col-span-5">
                        <ScheduleMilitaryTimeInput
                          id="edit-schedule-order-time"
                          value={scheduleOrderTime}
                          onChange={(val) => setScheduleOrderTime(val)}
                          className="focus:border-purple-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const y = now.getFullYear();
                          const m = String(now.getMonth() + 1).padStart(2, '0');
                          const d = String(now.getDate()).padStart(2, '0');
                          const hh = String(now.getHours()).padStart(2, '0');
                          const mm = String(now.getMinutes()).padStart(2, '0');
                          setScheduleOrderDate(`${y}-${m}-${d}`);
                          setScheduleOrderTime(`${hh}:${mm}`);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 px-2 py-0.5 rounded-md shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                        title="Set to Current Date and Time"
                      >
                        <Clock size={10} /> Set to Now
                      </button>
                      <span className="text-[9.5px] text-slate-400 font-medium truncate text-right">Counter intake</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Official Release Date (Derived from authoritative Business Rule duration) */}
              <div className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-200/60 shadow-2xs min-w-0 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block truncate">
                    Release Date
                  </Label>
                </div>
                {!isEditingSchedule ? (
                  <>
                    <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                      <DateValue colorClass="text-emerald-700">
                        {formatDate(authoritativeOfficialReleaseDate, 'MM/dd/yy')}
                        {order.releaseTime ? ` ${order.releaseTime}` : ''}
                      </DateValue>
                    </div>
                    <p className="text-[10px] text-emerald-700 mt-1 font-semibold truncate">
                      Business Rules: {authoritativeBrDays} {authoritativeBrDays === 1 ? 'day' : 'days'}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5 my-0.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-7">
                        <ScheduleDateInput
                          id="edit-schedule-release-date"
                          value={scheduleTargetReleaseDate}
                          onChange={(val) => setScheduleTargetReleaseDate(val)}
                          className="focus:border-emerald-500"
                        />
                      </div>
                      <div className="col-span-5">
                        <ScheduleMilitaryTimeInput
                          id="edit-schedule-release-time"
                          value={scheduleTargetReleaseTime}
                          onChange={(val) => setScheduleTargetReleaseTime(val)}
                          className="focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-1 pt-0.5">
                      <button
                        type="button"
                        onClick={handleResetTargetToBusinessRules}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200/80 border border-emerald-300/80 px-2 py-0.5 rounded-md shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                        title="Reset to authoritative Business Rules"
                      >
                        <Sparkles size={10} /> Reset BR
                      </button>
                      <span className="text-[9.5px] text-emerald-800 font-semibold truncate text-right">BR: {authoritativeBrDays} {authoritativeBrDays === 1 ? 'day' : 'days'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. ML Predicted Date (Turnaround duration estimation) */}
              <div className="p-3 rounded-lg bg-blue-50/40 border border-blue-200/60 shadow-2xs min-w-0 flex flex-col justify-between">
                <Label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1 block truncate">
                  ML Predicted Date
                </Label>
                <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <DateValue colorClass="text-blue-700">
                    {predictionLoading ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Predicting...
                      </span>
                    ) : mlDate ? (
                      formatDate(mlDate, 'MM/dd/yy')
                    ) : predictionError ? (
                      <span className="text-amber-600 text-xs font-medium">Error</span>
                    ) : (
                      <span className="text-slate-400 text-xs font-medium">Unavailable</span>
                    )}
                  </DateValue>
                </div>
                <p className="text-[10px] text-blue-700 mt-1 font-semibold truncate">
                  {predictionLoading ? (
                    'ML: Calculating...'
                  ) : mlDays != null ? (
                    `ML Estimate: ${mlDays} ${mlDays === 1 ? 'day' : 'days'}`
                  ) : (
                    'ML: Unavailable'
                  )}
                </p>
              </div>
            </div>

            {/* Row 2: Actual Execution & Claim Timeline (Actual Release, Claimed, Turnaround) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 4. Actual Release Date (Strictly from released_at) */}
              <div className="p-3 rounded-lg bg-white border border-slate-200/70 shadow-2xs min-w-0 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    Actual Release Date
                  </Label>
                </div>
                {!isEditingSchedule ? (
                  <>
                    <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                      <DateValue colorClass={actualReleaseDate ? "text-orange-600" : "text-slate-400"}>
                        {actualReleaseDate ? formatDate(actualReleaseDate, 'MM/dd/yy') : '—'}
                      </DateValue>
                      {actualReleaseDate && hasExplicitTime(actualReleaseDate) && (
                        <span className="text-[11px] text-slate-500 font-mono font-medium">
                          {formatDate(actualReleaseDate, 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium truncate">
                      {actualReleaseDate ? 'Released from workshop' : 'Not yet released'}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5 my-0.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-7">
                        <ScheduleDateInput
                          id="edit-schedule-actual-release-date"
                          value={scheduleActualReleaseDate}
                          onChange={(val) => setScheduleActualReleaseDate(val)}
                          className="focus:border-orange-500"
                        />
                      </div>
                      <div className="col-span-5">
                        <ScheduleMilitaryTimeInput
                          id="edit-schedule-actual-release-time"
                          value={scheduleActualReleaseTime}
                          onChange={(val) => setScheduleActualReleaseTime(val)}
                          className="focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-1 pt-0.5">
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const y = now.getFullYear();
                            const m = String(now.getMonth() + 1).padStart(2, '0');
                            const d = String(now.getDate()).padStart(2, '0');
                            const hh = String(now.getHours()).padStart(2, '0');
                            const mm = String(now.getMinutes()).padStart(2, '0');
                            setScheduleActualReleaseDate(`${y}-${m}-${d}`);
                            setScheduleActualReleaseTime(`${hh}:${mm}`);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded-md shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                          title="Set to Current Date and Time"
                        >
                          <Clock size={10} /> Set Now
                        </button>
                        <button
                          type="button"
                          onClick={handleUseReleaseDateForActual}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-md shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                          title="Copy target release date to actual release date (date only)"
                        >
                          Use Target
                        </button>
                        {scheduleActualReleaseDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setScheduleActualReleaseDate('');
                              setScheduleActualReleaseTime('');
                            }}
                            className="inline-flex items-center text-[10px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 px-1 py-0.5 rounded cursor-pointer transition-all shrink-0"
                            title="Clear actual release date and time"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <span className="text-[9.5px] text-slate-400 font-medium truncate text-right">Workshop</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Claimed Date (Strictly from claimed_at - separate from release) */}
              <div className="p-3 rounded-lg bg-white border border-slate-200/70 shadow-2xs min-w-0 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    Claimed Date
                  </Label>
                </div>
                {!isEditingSchedule ? (
                  <>
                    <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                      <DateValue colorClass={actualClaimedDate ? "text-slate-700" : "text-slate-400"}>
                        {actualClaimedDate ? formatDate(actualClaimedDate, 'MM/dd/yy') : '—'}
                      </DateValue>
                      {actualClaimedDate && hasExplicitTime(actualClaimedDate) && (
                        <span className="text-[11px] text-slate-500 font-mono font-medium">
                          {formatDate(actualClaimedDate, 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium truncate">
                      {actualClaimedDate ? 'Claimed by customer' : 'Not yet claimed'}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5 my-0.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-7">
                        <ScheduleDateInput
                          id="edit-schedule-claimed-date"
                          value={scheduleClaimedDate}
                          onChange={(val) => setScheduleClaimedDate(val)}
                          className="focus:border-slate-500"
                        />
                      </div>
                      <div className="col-span-5">
                        <ScheduleMilitaryTimeInput
                          id="edit-schedule-claimed-time"
                          value={scheduleClaimedTime}
                          onChange={(val) => setScheduleClaimedTime(val)}
                          className="focus:border-slate-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-1 pt-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const y = now.getFullYear();
                            const m = String(now.getMonth() + 1).padStart(2, '0');
                            const d = String(now.getDate()).padStart(2, '0');
                            const hh = String(now.getHours()).padStart(2, '0');
                            const mm = String(now.getMinutes()).padStart(2, '0');
                            setScheduleClaimedDate(`${y}-${m}-${d}`);
                            setScheduleClaimedTime(`${hh}:${mm}`);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded-md shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                          title="Set to Current Date and Time"
                        >
                          <Clock size={10} /> Set Now
                        </button>
                        {scheduleClaimedDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setScheduleClaimedDate('');
                              setScheduleClaimedTime('');
                            }}
                            className="inline-flex items-center text-[10px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 px-1 py-0.5 rounded cursor-pointer transition-all shrink-0"
                            title="Clear claimed date and time"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <span className="text-[9.5px] text-slate-400 font-medium truncate text-right">Customer handover</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Actual Turnaround (Renamed from Total Days: released_at - received) */}
              <div className="p-3 rounded-lg bg-white border border-slate-200/70 shadow-2xs min-w-0 flex flex-col justify-between">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block truncate">
                  Actual Turnaround
                </Label>
                <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                  {actualTurnaroundDays != null ? (
                    <DateValue colorClass="text-slate-900">
                      {actualTurnaroundDays} {actualTurnaroundDays === 1 ? 'day' : 'days'}
                    </DateValue>
                  ) : (
                    <DateValue colorClass="text-slate-400 text-xs">
                      In progress
                    </DateValue>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-medium truncate">
                  {actualTurnaroundDays != null ? 'Received to actual release' : 'Order in progress'}
                </p>
              </div>
            </div>

            {/* Claimed Details (Shown if claimed) */}
            {isClaimed && (
              <div className="pt-3 border-t border-slate-200/60 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Claim Punctuality
                    </Label>
                    {(() => {
                      const expDt = authoritativeOfficialReleaseDate;
                      const claimDt = actualClaimedDate;
                      if (!expDt || !claimDt) return <p className="text-xs text-slate-500 font-medium">—</p>;
                      const expMid = new Date(new Date(expDt).getFullYear(), new Date(expDt).getMonth(), new Date(expDt).getDate()).getTime();
                      const claimMid = new Date(new Date(claimDt).getFullYear(), new Date(claimDt).getMonth(), new Date(claimDt).getDate()).getTime();
                      const diffDays = Math.round((claimMid - expMid) / (1000 * 60 * 60 * 24));
                      if (diffDays > 0) {
                        return <p className="text-xs text-rose-600 font-bold">Claimed {diffDays} {diffDays === 1 ? 'day' : 'days'} late</p>;
                      } else if (diffDays === 0) {
                        return <p className="text-xs text-emerald-600 font-bold">Claimed on official date</p>;
                      } else {
                        const early = Math.abs(diffDays);
                        return <p className="text-xs text-blue-600 font-bold">Claimed {early} {early === 1 ? 'day' : 'days'} early</p>;
                      }
                    })()}
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

          {/* Card 4: Shipping Details */}
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
                      <p className="text-sm font-bold text-slate-800">{formatSpecification(item.brand)}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Model
                      </Label>
                      <p className="text-sm font-bold text-slate-800">{formatSpecification(item.shoeModel)}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                        Material
                      </Label>
                      <p className="text-sm font-bold text-slate-800">{formatSpecification(item.shoeMaterial)}</p>
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

                  {/* Before & After Shoe Condition Photos (Collapsible) */}
                  <div className="pt-2.5 border-t border-slate-200/60 space-y-2">
                    <button
                      type="button"
                      onClick={() => setExpandedPhotos(prev => ({ ...prev, [index]: !prev[index] }))}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 transition-all cursor-pointer text-left group"
                      title="Click to toggle photos"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-white border border-slate-200 text-red-500 group-hover:text-red-600 shadow-2xs">
                          <Camera size={13} />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                          Shoe Condition Photos (Before & After)
                        </span>
                        {Boolean(item.beforeImage || item.afterImage) && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full">
                            {[item.beforeImage && 'Before', item.afterImage && 'After'].filter(Boolean).join(' & ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {expandedPhotos[index] ? 'Hide' : 'Expand'}
                        </span>
                        {expandedPhotos[index] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {expandedPhotos[index] && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
                        {/* Before Photo */}
                        <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Before (When Received)
                            </span>
                            {item.beforeImage && (
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(index, 'before')}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                title="Remove photo"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {item.beforeImage ? (
                            <div className="flex flex-col gap-2">
                              <div 
                                onClick={() => setPreviewImage({ url: item.beforeImage, title: `${item.brand || 'Shoe'} - Before (Received)`, subtitle: `Order #${order.orderNumber}` })}
                                className="relative group/photo w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer shadow-inner"
                                title="Tap or click to zoom image"
                              >
                                <img src={item.beforeImage} alt="Before received" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                  <ZoomIn size={14} /> Tap to Zoom
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => triggerCameraCapture(index, 'before')}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Retake photo using camera"
                                >
                                  <Camera size={13} className="text-red-500" />
                                  <span>Retake</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerFileUpload(index, 'before')}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Change photo from files or gallery"
                                >
                                  <Upload size={13} className="text-blue-500" />
                                  <span>Change</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full min-h-[110px] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/60 p-2.5 flex flex-col items-center justify-center gap-2">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">No photo attached</span>
                              <div className="grid grid-cols-2 gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => triggerCameraCapture(index, 'before')}
                                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-red-50 text-slate-800 hover:text-red-700 border border-slate-200 hover:border-red-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Take photo directly with camera"
                                >
                                  <Camera size={14} className="text-red-500" />
                                  <span>Take Photo</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerFileUpload(index, 'before')}
                                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Upload photo from files or gallery"
                                >
                                  <Upload size={14} className="text-blue-500" />
                                  <span>Upload</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* After Photo */}
                        <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              After (When Released)
                            </span>
                            {item.afterImage && (
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(index, 'after')}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                title="Remove photo"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {item.afterImage ? (
                            <div className="flex flex-col gap-2">
                              <div 
                                onClick={() => setPreviewImage({ url: item.afterImage, title: `${item.brand || 'Shoe'} - After (Released)`, subtitle: `Order #${order.orderNumber}` })}
                                className="relative group/photo w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer shadow-inner"
                                title="Tap or click to zoom image"
                              >
                                <img src={item.afterImage} alt="After released" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                  <ZoomIn size={14} /> Tap to Zoom
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => triggerCameraCapture(index, 'after')}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Retake photo using camera"
                                >
                                  <Camera size={13} className="text-emerald-600" />
                                  <span>Retake</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerFileUpload(index, 'after')}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Change photo from files or gallery"
                                >
                                  <Upload size={13} className="text-blue-500" />
                                  <span>Change</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full min-h-[110px] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/60 p-2.5 flex flex-col items-center justify-center gap-2">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">No photo attached</span>
                              <div className="grid grid-cols-2 gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => triggerCameraCapture(index, 'after')}
                                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Take photo directly with camera"
                                >
                                  <Camera size={14} className="text-emerald-600" />
                                  <span>Take Photo</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerFileUpload(index, 'after')}
                                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Upload photo from files or gallery"
                                >
                                  <Upload size={14} className="text-blue-500" />
                                  <span>Upload</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pair Status & Tracking (Collapsible Accordion) */}
                  <div className="pt-2.5 border-t border-slate-200/60 space-y-2">
                    {/* Collapsible Header Button */}
                    {(() => {
                      const itemSt = (item.status || order.status || 'pending').toLowerCase();
                      const badgeColors: Record<string, string> = {
                        'pending': 'bg-amber-100 text-amber-800 border-amber-300',
                        'new-order': 'bg-amber-100 text-amber-800 border-amber-300',
                        'new order': 'bg-amber-100 text-amber-800 border-amber-300',
                        'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
                        'on-going': 'bg-blue-100 text-blue-800 border-blue-300',
                        'for-release': 'bg-emerald-100 text-emerald-800 border-emerald-300',
                        'claimed': 'bg-slate-900 text-white border-slate-900',
                        'cancelled': 'bg-red-100 text-red-800 border-red-300',
                      };
                      const statusDisplayNames: Record<string, string> = {
                        'pending': 'New Order',
                        'new-order': 'New Order',
                        'new order': 'New Order',
                        'in-progress': 'On-Going',
                        'on-going': 'On-Going',
                        'for-release': 'For Release',
                        'claimed': 'Claimed',
                        'cancelled': 'Cancelled',
                      };
                      const currentStyle = badgeColors[itemSt] || 'bg-gray-100 text-gray-800 border-gray-200';
                      const selectVal = itemSt === 'in-progress' ? 'on-going' : (itemSt === 'new-order' || itemSt === 'new order') ? 'pending' : itemSt;
                      const currentLabel = statusDisplayNames[itemSt] || itemSt.replace(/-/g, ' ');

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedPairTracking(prev => ({ ...prev, [index]: !prev[index] }))}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 transition-all cursor-pointer text-left group"
                            title="Click to toggle pair status and tracking"
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1 rounded-md bg-white border border-slate-200 text-red-500 group-hover:text-red-600 shadow-2xs">
                                <Package size={13} />
                              </div>
                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                {itemsToDisplay.length > 1 ? `Pair #${index + 1} Status & Tracking` : 'Pair Status & Tracking'}
                              </span>
                              {/* Read-only status badge on collapsed header */}
                              <span className={`text-[8.5px] font-bold uppercase px-1.5 py-0.5 rounded-full border shadow-2xs tracking-wider ${currentStyle}`}>
                                {currentLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-400">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {expandedPairTracking[index] ? 'Hide' : 'Expand'}
                              </span>
                              {expandedPairTracking[index] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </button>

                          {/* Expanded Content: Editable Status Selector, Update Pair Button & Tracking Dates */}
                          {expandedPairTracking[index] && (
                            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status:</span>
                                  <div className="relative inline-block">
                                    <Select value={selectVal} onValueChange={(newVal) => handleDirectPairStatusChange(index, newVal)}>
                                      <SelectTrigger className={`w-auto min-w-[86px] h-6 px-2 text-[9.5px] font-bold uppercase tracking-wider border rounded-md shadow-2xs gap-1 cursor-pointer [&_svg]:size-3 ${currentStyle}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="z-[120]">
                                        <SelectItem value="pending" className="text-[11px] font-semibold text-amber-700 py-1">New Order</SelectItem>
                                        <SelectItem value="on-going" className="text-[11px] font-semibold text-blue-700 py-1">On-Going</SelectItem>
                                        <SelectItem value="for-release" className="text-[11px] font-semibold text-emerald-700 py-1">For Release</SelectItem>
                                        <SelectItem value="claimed" className="text-[11px] font-semibold text-slate-900 py-1">Claimed</SelectItem>
                                        <SelectItem value="cancelled" className="text-[11px] font-semibold text-red-600 py-1">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenUpdatePair(item, index)}
                                  className="h-6 w-6 p-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-2xs rounded-md cursor-pointer flex items-center justify-center"
                                  title="Update Pair Tracking Dates"
                                >
                                  <Edit3 size={12} />
                                </Button>
                              </div>

                              {/* Dates Tracking Details */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Release Date
                                  </span>
                                  {item.actualReleaseDate ? (
                                    <div className="flex items-center gap-1.5 text-emerald-700 font-mono font-bold text-xs">
                                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                      <span>{formatDate(item.actualReleaseDate, hasExplicitTime(item.actualReleaseDate) ? 'MM/dd/yy hh:mm a' : 'MM/dd/yy')}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-medium italic text-[11px]">
                                      {['for-release', 'claimed'].includes((item.status || order.status || '').toLowerCase()) && releaseTimestamp(order)
                                        ? `${formatDate(releaseTimestamp(order), hasExplicitTime(releaseTimestamp(order)) ? 'MM/dd/yy hh:mm a' : 'MM/dd/yy')} (Order Batch)`
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
                                      <span>{formatDate(item.actualCompletionDate, hasExplicitTime(item.actualCompletionDate) ? 'MM/dd/yy hh:mm a' : 'MM/dd/yy')}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-medium italic text-[11px]">
                                      {(item.status || order.status || '').toLowerCase() === 'claimed' && order.actualCompletionDate
                                        ? `${formatDate(order.actualCompletionDate, hasExplicitTime(order.actualCompletionDate) ? 'MM/dd/yy hh:mm a' : 'MM/dd/yy')} (Order Batch)`
                                        : 'Pending customer claim'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Materials / Supplies Used (Collapsible Accordion inside Pair) */}
                  {(() => {
                    const pairUsed = (item.inventoryUsed && item.inventoryUsed.length > 0)
                      ? item.inventoryUsed
                      : (itemsToDisplay.length === 1 ? safeInventoryUsed.filter((u: any) => !u.isRetail) : []);
                    const activeMaterials = pairUsed.filter((u: any) => (u.quantity || u.amount) > 0);

                    return (
                      <div className="pt-2.5 border-t border-slate-200/60 space-y-2">
                        {/* Collapsible Header Button */}
                        <button
                          type="button"
                          onClick={() => setExpandedPairMaterials(prev => ({ ...prev, [index]: !prev[index] }))}
                          className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 transition-all cursor-pointer text-left group"
                          title="Click to toggle materials"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-white border border-emerald-200 text-emerald-600 group-hover:text-emerald-700 shadow-2xs">
                              <Package size={13} />
                            </div>
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                              Materials / Supplies Used
                            </span>
                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {activeMaterials.length}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              {expandedPairMaterials[index] ? 'Hide' : 'Expand'}
                            </span>
                            {expandedPairMaterials[index] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </button>

                        {/* Expanded Content: Add Material Button + Recorded Materials List */}
                        {expandedPairMaterials[index] && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                                Recorded Supplies ({activeMaterials.length})
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setMaterialModalTarget({ itemId: item.id || (itemsToDisplay.length === 1 ? order.id : undefined), label: itemsToDisplay.length > 1 ? `Pair #${index + 1}` : 'Pair' })}
                                className="h-7 px-3 text-xs font-bold text-emerald-700 border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 gap-1.5 rounded-lg shadow-2xs cursor-pointer"
                              >
                                <Plus size={12} strokeWidth={2.5} />
                                <span>Add Material</span>
                              </Button>
                            </div>

                            {activeMaterials.length > 0 ? (
                              <div className="space-y-1.5">
                                {activeMaterials.map((used: any, uIdx: number) => (
                                  <div key={uIdx} className="flex justify-between items-center text-[11px] bg-slate-50/90 px-2.5 py-1.5 rounded-lg border border-slate-100">
                                    <div className="min-w-0 pr-2">
                                      <span className="font-bold text-slate-800">{used.name}</span>
                                      {used.notes && <span className="text-slate-400 ml-1.5 text-[10px]">({used.notes})</span>}
                                    </div>
                                    <span className="font-bold font-mono text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded text-[10.5px] shrink-0">
                                      {used.quantity || used.amount} {used.unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-2 text-[11px] text-slate-400 italic">
                                {itemsToDisplay.length > 1 ? `No materials recorded for Pair #${index + 1} yet.` : 'No materials recorded for this pair yet.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
              <div className="flex items-center gap-2">
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
                    ? (() => {
                        const gt = Number(order.grandTotal || 0);
                        const dp = Number((order as any).depositAmount || (order.paymentHistory?.find((p: any) => p.paymentType === 'downpayment')?.amount) || 0);
                        const pct = gt > 0 && dp > 0 ? Math.round((dp / gt) * 100) : 50;
                        return `${pct}% Downpayment`;
                      })()
                    : 'Unpaid'}
                </span>
              </div>
            </div>

            <div className={`grid gap-4 ${['gcash', 'maya'].includes(effectivePaymentMethod.toLowerCase()) && order.referenceNo && paymentHistory.length <= 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="text-left">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Method
                </Label>
                <p className="text-sm font-bold text-slate-800 uppercase">
                  {effectivePaymentMethod}
                </p>
              </div>

              <div className={['gcash', 'maya'].includes(effectivePaymentMethod.toLowerCase()) && order.referenceNo && paymentHistory.length <= 1 ? 'text-center' : 'text-right'}>
                <Label className={`text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block ${['gcash', 'maya'].includes(effectivePaymentMethod.toLowerCase()) && order.referenceNo && paymentHistory.length <= 1 ? 'text-center' : 'text-right'}`}>
                  Amount Received
                </Label>
                <p className="text-sm font-bold text-slate-800">
                  ₱{(order.amountReceived || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {['gcash', 'maya'].includes(effectivePaymentMethod.toLowerCase()) && order.referenceNo && paymentHistory.length <= 1 && (
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

              {effectiveCustomerChange > 0 && (
                <div className="text-left col-span-full">
                  <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                    Customer Change
                  </Label>
                  <p className="text-sm font-bold text-emerald-600">
                    ₱{effectiveCustomerChange.toLocaleString('en-US', {
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



          {/* Card: Retail Products (Shoelaces, Cleaner, Insoles, etc., Collapsible) */}
          <div className="bg-sky-50/40 p-3.5 rounded-xl border border-sky-100/90 space-y-2.5">
            <button
              type="button"
              onClick={() => setExpandedRetail(prev => !prev)}
              className="w-full flex items-center justify-between cursor-pointer group text-left"
              title="Click to toggle retail products"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-white border border-sky-200 text-sky-600 group-hover:text-sky-700 shadow-2xs">
                  <ShoppingBag size={14} />
                </div>
                <h4 className="text-xs font-black text-sky-950 uppercase tracking-wider group-hover:text-sky-800">
                  Retail Products ({retailProducts.length})
                </h4>
                {retailTotal > 0 && (
                  <span className="text-[10.5px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded-full border border-emerald-200">
                    ₱{retailTotal.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {expandedRetail ? 'Hide' : 'Expand'}
                </span>
                {expandedRetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {expandedRetail && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                {/* List of current retail products on this order */}
                {retailProducts.length > 0 ? (
                  <div className="space-y-1.5">
                    {retailProducts.map((prod: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{prod.name}</span>
                            <span className="text-[10.5px] text-slate-500 font-semibold">x{prod.quantity} ({prod.unit})</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            @ ₱{Number(prod.price || 0).toFixed(2)} each
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-black text-emerald-700 text-xs">
                            ₱{((Number(prod.quantity) || 1) * (Number(prod.price) || 0)).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRetailProduct(prod.itemId)}
                            title="Remove retail product and restock"
                            className="text-slate-300 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-2 text-[11px] text-sky-800/70 font-medium">
                    No retail products attached to this order yet.
                  </p>
                )}

                {/* Inline Add Retail Product Form */}
                {!showAddRetailForm ? (
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddRetailForm(true)}
                      className="h-6 px-2.5 text-[11px] font-bold text-sky-700 border-sky-300 bg-white hover:bg-sky-100 shadow-2xs flex items-center gap-1 cursor-pointer rounded-md"
                    >
                      <Plus size={12} strokeWidth={2.5} />
                      <span>Add Retail Item</span>
                    </Button>
                  </div>
                ) : (
                  <div className="p-2.5 bg-white rounded-xl border border-sky-200/70 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9.5px] font-black uppercase text-sky-950 tracking-wider block">
                        Add Retail Item (Shoelaces, Cleaners, Insoles, etc.)
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowAddRetailForm(false)}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <Select value={selectedRetailId} onValueChange={setSelectedRetailId}>
                      <SelectTrigger className="w-full h-8 text-[11px] font-bold bg-white border-sky-200 rounded-lg">
                        <SelectValue placeholder="Choose product..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {inventoryData.filter(i => i.isActive && Boolean(i.is_retail) && Number(i.retail_price || 0) > 0 && i.stock > 0).map(item => (
                          <SelectItem key={item.id} value={item.id.toString()} className="text-[11px]">
                            <span className="font-bold">{item.name}</span>{' '}
                            <span className="text-gray-400 font-normal">
                              ({item.stock} {item.unit} left • ₱{Number(item.retail_price || 0).toFixed(2)})
                            </span>
                          </SelectItem>
                        ))}
                        {inventoryData.filter(i => i.isActive && Boolean(i.is_retail) && Number(i.retail_price || 0) > 0 && i.stock > 0).length === 0 && (
                          <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">
                            No retail items with available stock configured
                          </div>
                        )}
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      <div>
                        <Label className="text-[8.5px] font-bold uppercase text-slate-500 block mb-0.5">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={retailQty}
                          onChange={(e) => setRetailQty(e.target.value)}
                          className="h-7 text-xs font-black text-center bg-white border-sky-200 rounded"
                        />
                      </div>
                      <div>
                        <Label className="text-[8.5px] font-bold uppercase text-slate-500 block mb-0.5">Unit Price (₱)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={retailPrice}
                          onChange={(e) => setRetailPrice(e.target.value)}
                          onBlur={() => {
                            const val = parseFloat(retailPrice);
                            if (!isNaN(val)) setRetailPrice(val.toFixed(2));
                          }}
                          className="h-7 text-xs font-black text-center bg-white border-sky-200 text-emerald-700 rounded"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          onClick={async () => {
                            await handleAddRetailProduct();
                            setShowAddRetailForm(false);
                          }}
                          disabled={!selectedRetailId || isAddingRetail}
                          className="w-full h-7 bg-red-600 hover:bg-red-700 text-white font-black text-[10.5px] uppercase rounded shadow-sm hover:shadow active:scale-[0.98] transition-all"
                        >
                          {isAddingRetail ? 'Adding...' : 'Add Item'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 8: Pricing & Grand Total Breakdown Card */}
          {(() => {
            const baseFee = Number(order.baseServiceFee || 0);
            const addOnsFee = Number(order.addOnsTotal || 0);
            const rushFee = order.priorityLevel === 'rush' ? calculatedRushFee : 0;
            const grossSubtotal = Number((order as any).grossTotal || (baseFee + addOnsFee + retailTotal + rushFee));
            const grandTotalValue = Number(order.grandTotal || 0);

            const directDiscount = Number((order as any).discountAmount || (order as any).discount || 0);
            const derivedDiscount = grossSubtotal > grandTotalValue ? (grossSubtotal - grandTotalValue) : 0;
            const discountAmount = directDiscount > 0 ? directDiscount : derivedDiscount;
            const discountPercent = grossSubtotal > 0 && discountAmount > 0.01 
              ? Math.round((discountAmount / grossSubtotal) * 100) 
              : 0;

            const depositAmountValue = Number((order as any).depositAmount || (order.paymentHistory?.find((p: any) => p.paymentType === 'downpayment')?.amount) || order.amountReceived || 0);
            const isMoreThan50Deposit = grandTotalValue > 0 && depositAmountValue > (grandTotalValue * 0.5) + 0.5;
            const isExact50Deposit = grandTotalValue > 0 && Math.abs(depositAmountValue - (grandTotalValue * 0.5)) <= 0.5;
            const depositPercent = grandTotalValue > 0 ? Math.round((depositAmountValue / grandTotalValue) * 100) : 0;

            const computedRemainingBalance = Math.max(0, grandTotalValue - depositAmountValue);
            const finalRemainingBalance = order.balance !== undefined && order.balance !== null 
              ? Number(order.balance) 
              : (remainingBalance !== undefined ? remainingBalance : computedRemainingBalance);

            return (
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs font-medium uppercase tracking-wide">Total Quantity</span>
                  <span className="text-sm font-bold text-slate-800">
                    {order.quantity || 1} {(order.quantity || 1) === 1 ? 'Pair' : 'Pairs'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs font-medium uppercase tracking-wide">Base Service Fee</span>
                  <span className="text-sm font-bold text-slate-800">
                    ₱{baseFee.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs font-medium uppercase tracking-wide">Add-ons Total</span>
                  <span className="text-sm font-bold text-slate-800">
                    ₱{addOnsFee.toFixed(2)}
                  </span>
                </div>
                {retailTotal > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-xs font-medium uppercase tracking-wide">Retail Products Total</span>
                    <span className="text-sm font-bold text-emerald-700">₱{retailTotal.toFixed(2)}</span>
                  </div>
                )}
                {rushFee > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-xs font-medium uppercase tracking-wide">Rush Fee</span>
                    <span className="text-sm font-bold text-slate-800">₱{rushFee.toFixed(2)}</span>
                  </div>
                )}

                {/* Discount Indicator */}
                {discountAmount > 0.01 && (
                  <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                      <span>Discount</span>
                      {discountPercent > 0 && (
                        <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-full">
                          {discountPercent}% OFF
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-black">-₱{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 mt-1">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Grand Total
                  </span>
                  <span className="text-lg font-black text-red-600 tracking-tight">
                    ₱{grandTotalValue.toFixed(2)}
                  </span>
                </div>

                {/* Amount Deposited */}
                {depositAmountValue > 0 && (
                  <div className="flex justify-between items-center text-slate-700 pt-2 border-t border-slate-200/60">
                    <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                      <span>Amount Deposited</span>
                      {isMoreThan50Deposit && (
                        <span className="text-[9.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          &gt; 50% Deposit ({depositPercent}%)
                        </span>
                      )}
                      {isExact50Deposit && (
                        <span className="text-[9.5px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md">
                          50% Deposit
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      ₱{depositAmountValue.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Remaining Balance */}
                <div className="flex justify-between items-center text-slate-700 pt-1">
                  <span className="text-xs font-bold uppercase tracking-wide">Remaining Balance</span>
                  <span className={`text-sm font-black ${finalRemainingBalance > 0.01 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₱{finalRemainingBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })()}
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
                  {(formatSpecification(currentItem?.brand) !== '-' ? currentItem?.brand : 'Shoe')} - {(formatSpecification(currentItem?.shoeModel) !== '-' ? currentItem?.shoeModel : 'Item')} ({displayItemColor(currentItem, order)})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pair Status
                  </Label>
                  <Select value={pairStatus === 'in-progress' ? 'on-going' : (pairStatus === 'new-order' || pairStatus === 'new order') ? 'pending' : pairStatus} onValueChange={handlePairStatusChange}>
                    <SelectTrigger className="h-10 text-xs border border-slate-300 bg-white shadow-sm font-semibold rounded-lg focus:ring-1 focus:ring-red-500">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="pending" className="text-xs font-bold text-amber-700">New Order</SelectItem>
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

      {order && materialModalTarget && (
        <AddMaterialModal
          open={materialModalTarget !== null}
          onOpenChange={(open) => !open && setMaterialModalTarget(null)}
          orderId={order.id}
          orderNumber={order.orderNumber}
          itemId={materialModalTarget.itemId}
          itemLabel={materialModalTarget.label}
          onSuccess={() => {
            refreshOrders();
          }}
          user={user}
        />
      )}

      {/* Hidden file input for capturing shoe photos directly from device camera */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileSelected}
        accept="image/*"
        capture="environment"
        className="sr-only fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Hidden file input for uploading shoe photos from device files or gallery */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept="image/*"
        className="sr-only fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* E-Signature Drawing Modal */}
      <SignaturePadModal
        open={signatureRole !== null}
        onOpenChange={(open) => !open && setSignatureRole(null)}
        title={signatureRole === 'customer' ? `Customer Signature (${order.customerName || 'Customer'})` : `Staff Signature (${order.releasedBy || user?.username || 'Staff'})`}
        onSave={handleSaveSignature}
        initialSignature={signatureRole === 'customer' ? customerSig : staffSig}
      />

      {/* High-Resolution Image Preview Modal */}
      <ImagePreviewModal
        open={previewImage !== null}
        onOpenChange={(open) => !open && setPreviewImage(null)}
        imageUrl={previewImage?.url || ''}
        title={previewImage?.title || 'Shoe Photo Preview'}
      />

      {/* Official Customer Claim Slip Modal */}
      <ClaimSlipModal
        order={order}
        open={showClaimSlip}
        onOpenChange={setShowClaimSlip}
        user={user}
      />

      {/* Edit Full Order Modal */}
      {isEditingOrder && (
        <EditOrderModal
          order={order}
          open={isEditingOrder}
          onOpenChange={setIsEditingOrder}
          onSave={handleSaveOrderEdit}
          user={user}
        />
      )}
    </>
  );
}



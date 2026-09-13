import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Archive, Plus, Download, Search, Trash2, Edit2, Eye,
  ChevronLeft, ChevronRight, BarChart2, Cpu, X, Check, AlertTriangle,
  TrendingUp, Users, Package, Clock, DollarSign, Star, Loader2, RefreshCw,
  FileText, Zap, Target, Activity, Upload, CircleCheck, CircleAlert
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/app/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/app/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import HistoricalValidationQueue from './HistoricalValidationQueue';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';
import { formatOrderId } from '@/app/lib/orderNumber';
import { validateCustomerName, CUSTOMER_NAME_MAX_LENGTH } from '@/app/lib/customerValidation';
import { calculateOfficialReleaseBreakdown } from '@/app/lib/businessRules';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoricalRecordsProps {
  user: { username: string; role: 'owner' | 'staff' | 'admin'; token: string };
  onSetHeaderActionRight?: (node: React.ReactNode) => void;
}

interface ShoeItem {
  brand: string; model: string; color: string; size: string;
  material: string; priority: string; remarks: string;
  item_price?: number | null;
  is_free?: boolean;
  price_breakdown?: string | null;
  services: { service_name: string; service_type: string; price: number; display_label?: string }[];
}

interface HistoricalRecord {
  historical_order_id: number; order_id: string;
  customer_name: string; contact_number: string; branch: string;
  date_received: string; original_estimated_release_date: string;
  claimed_date: string | null; completion_days: number | null;
  total_pairs: number; grand_total: number; downpayment: number; balance: number;
  priority: string; sync_status: string; status: string;
  payment_method?: string;
  items: (ShoeItem & { historical_item_id?: number })[];
  image?: { image_filename: string; image_path: string; ocr_status: string } | null;
}


const CHART_COLORS = ['#b91c1c','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
const BASE_SERVICES = ['Basic Cleaning','Full Reglue','Minor Reglue','Full Restoration','Minor Restoration','Color Renewal','Unyellowing'];
const ADDON_SERVICES = ['Deep Cleaning','Sole Whitening','Deodorizing','Repainting','Sole Replacement'];
const PRIORITIES = ['regular','rush'];
const MATERIALS = ['Leather','Suede','Canvas','Mesh','Knit','Synthetic','Nubuck','Rubber','Other'];
const BRANCHES = ['Villamor'];
const RUSH_FEE_BASIC_CLEANING = 150;
const HISTORICAL_CATALOG_PRICES: Record<string, number> = {
  'Basic Cleaning': 325, BC: 325, BCN: 325,
  'Full Restoration': 250,
  'Full Reglue': 250, FR: 250, FRG: 250,
  'Minor Restoration': 225, MRES: 225, MRS: 225,
  'Minor Retouch': 125, MRET: 125, MRT: 125,
  'Minor Reglue': 125, MR: 125, MRG: 125,
  'Color Renewal': 325, CR: 325, CRN: 325,
  'Unyellowing': 125, UY: 125, UNY: 125,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function presentField(value?: string | number | null) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === '—') return null;
  if (['.', '-', '–', 'n/a', 'na', 'none', 'null', 'unknown'].includes(text.toLowerCase())) return null;
  return text;
}

function fmtDate(iso?: string | null) {
  const cleaned = presentField(iso);
  if (!cleaned) return '—';
  try { return new Date(cleaned).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return cleaned; }
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const HISTORICAL_SERVICE_NAMES: Record<string, string> = {
  BC: 'Basic Cleaning',
  BCN: 'Basic Cleaning',
  FR: 'Full Reglue',
  FRG: 'Full Reglue',
  MRES: 'Minor Restoration',
  MRS: 'Minor Restoration',
  MR: 'Minor Reglue',
  MRG: 'Minor Reglue',
  MRET: 'Minor Retouch',
  MRT: 'Minor Retouch',
  UY: 'Unyellowing',
  UNY: 'Unyellowing',
  CR: 'Color Renewal',
  CRN: 'Color Renewal',
};

function canonicalServiceName(name?: string | null) {
  const stripped = String(name || '')
    .trim()
    .replace(/\s*\(\d+(?:\.\d+)?\)\s*$/, '')
    .replace(/[\s\-]+rush(?:\s*service)?$/i, '')
    .trim();
  if (!stripped) return '';
  const compact = stripped.replace(/[\s\-]+/g, '').toUpperCase().replace(/\d+$/, '');
  if (HISTORICAL_SERVICE_NAMES[compact]) return HISTORICAL_SERVICE_NAMES[compact];
  const first = stripped.split(/[\s\-\/+]+/)[0]?.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (first && HISTORICAL_SERVICE_NAMES[first]) return HISTORICAL_SERVICE_NAMES[first];
  const byFullName = Object.values(HISTORICAL_SERVICE_NAMES).find((label) => label.toLowerCase() === stripped.toLowerCase());
  return byFullName || stripped;
}

function mergeServiceDistribution(rows: { service?: string; count?: number }[] | undefined) {
  const freq = new Map<string, number>();
  for (const row of rows || []) {
    const raw = String(row.service || '').trim();
    const parts = raw.split(/\s*[+,/]\s*|\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    const names = parts.length > 1
      ? parts.map((part) => canonicalServiceName(part) || part)
      : [canonicalServiceName(raw) || raw || 'Other'];
    const known = new Set(Object.values(HISTORICAL_SERVICE_NAMES).map((label) => label.toLowerCase()));
    const expanded = names.length > 1 && names.every((name) => known.has(name.toLowerCase()))
      ? names
      : [canonicalServiceName(raw) || raw || 'Other'];
    for (const name of expanded) {
      freq.set(name, (freq.get(name) || 0) + Number(row.count || 0));
    }
  }
  return [...freq.entries()]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count);
}

function expandHistoricalService(name?: string | null) {
  return canonicalServiceName(name);
}

function serviceIsSelected(shoe: ShoeItem, svcName: string) {
  const chip = canonicalServiceName(svcName);
  return (shoe.services || []).some((s) => {
    const stored = canonicalServiceName(s.service_name || s.display_label);
    return stored.toLowerCase() === chip.toLowerCase();
  });
}

function catalogPriceFor(name?: string | null, storedPrice?: number | null, extra?: Record<string, number>) {
  if (storedPrice != null && Number(storedPrice) > 0) return Number(storedPrice);
  const canonical = canonicalServiceName(name);
  const raw = String(name || '').trim();
  return extra?.[canonical] ?? extra?.[raw] ?? HISTORICAL_CATALOG_PRICES[canonical] ?? HISTORICAL_CATALOG_PRICES[raw] ?? 0;
}

function shoePriceBreakdown(shoe: ShoeItem, priority: string, extra?: Record<string, number>) {
  const services = shoe.services || [];
  const baseLines = services
    .filter((s) => s.service_type !== 'addon')
    .map((s) => {
      const name = canonicalServiceName(s.service_name || s.display_label);
      return { name, price: catalogPriceFor(s.service_name || s.display_label, s.price, extra) };
    })
    .filter((line) => line.name);
  const addonLines = services
    .filter((s) => s.service_type === 'addon')
    .map((s) => {
      const name = canonicalServiceName(s.service_name || s.display_label);
      return { name, price: catalogPriceFor(s.service_name || s.display_label, s.price, extra) };
    })
    .filter((line) => line.name);
  const hasBasicCleaning = services.some((s) => canonicalServiceName(s.service_name || s.display_label) === 'Basic Cleaning');
  const rushFee = priority === 'rush' && hasBasicCleaning ? RUSH_FEE_BASIC_CLEANING : 0;
  const serviceTotal = baseLines.reduce((sum, line) => sum + line.price, 0);
  const addonTotal = addonLines.reduce((sum, line) => sum + line.price, 0);
  return {
    baseLines,
    addonLines,
    serviceTotal,
    addonTotal,
    rushFee,
    itemTotal: serviceTotal + addonTotal + rushFee,
  };
}

function normalizeShoe(item: ShoeItem): ShoeItem {
  const services = (item.services || []).map((s) => {
    const name = canonicalServiceName(s.service_name || s.display_label);
    const isBase = BASE_SERVICES.some((svc) => svc.toLowerCase() === name.toLowerCase());
    return {
      ...s,
      service_name: name || s.service_name,
      service_type: isBase ? 'base' : (s.service_type || 'addon'),
    };
  });
  return {
    ...item,
    brand: item.brand || '',
    model: item.model || '',
    color: item.color || '',
    size: item.size || '',
    material: item.material || '',
    remarks: item.remarks || '',
    services,
  };
}

function fmtPeso(n?: number | null) {
  return `₱${(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Title-case: capitalizes first letter of each word,
 * preserves Roman numerals and initials (e.g. "Arnold R. Villamin").
 */
function toTitleCase(name?: string | null): string {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ').split(' ').map((word) =>
    word.split(/([-'])/).map((part) => {
      if (part === '-' || part === "'") return part;
      const bare = part.replace(/\.$/, '');
      if (!bare) return '';
      return bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase() +
        (bare.length === 1 || part.endsWith('.') ? '.' : '');
    }).join('')
  ).join(' ');
}

/**
 * Display helper for order IDs:
 * - Canonical ORD-YYYY-MM-DD-NNN → shown as-is
 * - Short numeric legacy IDs (e.g. "081901") → shown as-is but styled differently
 * - UNKNOWN / OCR- / HIST- placeholders → shown as "—"
 */
function displayOrderId(id?: string | null): { text: string; isCanonical: boolean; isPlaceholder: boolean } {
  if (!id || !id.trim()) return { text: '—', isCanonical: false, isPlaceholder: true };
  const trimmed = id.trim();
  if (/^ORD-\d{4}-\d{2}-\d{2}-\d{3}$/.test(trimmed)) return { text: trimmed, isCanonical: true, isPlaceholder: false };
  if (/^(UNKNOWN|OCR-|HIST-|IMPORT-|HEALTH-)/i.test(trimmed.toUpperCase()) || ['UNKNOWN','N/A','NULL','NONE'].includes(trimmed.toUpperCase())) {
    return { text: '—', isCanonical: false, isPlaceholder: true };
  }
  return { text: trimmed, isCanonical: false, isPlaceholder: false };
}

function originalFormFilename(record?: HistoricalRecord | null) {
  return presentField(record?.image?.image_filename);
}

// ─── Empty shoe factory ───────────────────────────────────────────────────────

function emptyShoe(): ShoeItem {
  return { brand:'', model:'', color:'', size:'', material:'', priority:'regular', remarks:'', services:[] };
}

// ─── Auto Order ID ────────────────────────────────────────────────────────────

function buildOrderId(seq: number) {
  return formatOrderId(new Date(), seq);
}

// ─── FORM DIALOG ─────────────────────────────────────────────────────────────

function HistoricalOrderForm({
  token, existingRecord, onClose, onSaved, recordCount
}: {
  token: string;
  existingRecord?: HistoricalRecord | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  recordCount: number;
}) {
  const isEdit = !!existingRecord;

  const [orderId, setOrderId] = useState(existingRecord?.order_id ?? buildOrderId(recordCount + 1));
  const [customerName, setCustomerName] = useState(existingRecord?.customer_name ?? '');
  const [contactNumber, setContactNumber] = useState(existingRecord?.contact_number ?? '');
  const [branch, setBranch] = useState(existingRecord?.branch ?? 'Villamor');
  const [dateReceived, setDateReceived] = useState(existingRecord?.date_received?.slice(0,10) ?? '');
  const [expectedRelease, setExpectedRelease] = useState(existingRecord?.original_estimated_release_date?.slice(0,10) ?? '');
  const [claimedDate, setClaimedDate] = useState(existingRecord?.claimed_date?.slice(0,10) ?? '');
  const [grandTotal, setGrandTotal] = useState(String(existingRecord?.grand_total ?? ''));
  const [downpayment, setDownpayment] = useState(String(existingRecord?.downpayment ?? '0'));
  const [priority, setPriority] = useState(
    existingRecord?.priority === 'premium' ? 'regular' : (existingRecord?.priority ?? 'regular')
  );
  const [shoes, setShoes] = useState<ShoeItem[]>(
    existingRecord?.items?.length ? existingRecord.items.map((item) => normalizeShoe(item)) : [emptyShoe()]
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [catalogPrices, setCatalogPrices] = useState<Record<string, number>>({});
  const [completionDaysInput, setCompletionDaysInput] = useState(
    existingRecord?.completion_days != null ? String(existingRecord.completion_days) : ''
  );
  const daysManualRef = useRef(false);

  const officialDays = useMemo(() => {
    const items = shoes.map((shoe) => {
      const base = (shoe.services || [])
        .filter((s) => s.service_type !== 'addon')
        .map((s) => expandHistoricalService(s.service_name))
        .filter(Boolean);
      const addOns = (shoe.services || [])
        .filter((s) => s.service_type === 'addon')
        .map((s) => ({ name: expandHistoricalService(s.service_name), quantity: 1 }))
        .filter((s) => s.name);
      return { baseService: base, addOns };
    });
    return calculateOfficialReleaseBreakdown(items, priority).totalDays;
  }, [shoes, priority]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/services`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { service_name?: string; service_code?: string; base_price?: number }[]) => {
        if (cancelled || !Array.isArray(list)) return;
        const map: Record<string, number> = {};
        for (const svc of list) {
          const price = Number(svc.base_price);
          if (!price) continue;
          if (svc.service_name) map[svc.service_name] = price;
          if (svc.service_code) map[svc.service_code] = price;
        }
        setCatalogPrices(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (daysManualRef.current) {
      const days = parseInt(completionDaysInput, 10);
      if (dateReceived && !Number.isNaN(days) && days >= 0) {
        const next = addDaysIso(dateReceived, days);
        setClaimedDate(next);
      }
      return;
    }
    if (!dateReceived || !officialDays) return;
    const ready = addDaysIso(dateReceived, officialDays);
    const claimedSpan = claimedDate
      ? Math.round((new Date(claimedDate).getTime() - new Date(dateReceived).getTime()) / 86400000)
      : null;
    const overlong = claimedSpan != null && claimedSpan > officialDays;
    if (!expectedRelease || overlong) setExpectedRelease(ready);
    if (!claimedDate || overlong) {
      setClaimedDate(ready);
      setCompletionDaysInput(String(officialDays));
    } else if (claimedSpan != null && claimedSpan >= 0) {
      setCompletionDaysInput((prev) => prev || String(claimedSpan));
    } else {
      setCompletionDaysInput((prev) => prev || String(officialDays));
    }
  }, [dateReceived, officialDays]);

  function handleCompletionDaysChange(value: string) {
    daysManualRef.current = true;
    setCompletionDaysInput(value);
    const days = parseInt(value, 10);
    if (!dateReceived || Number.isNaN(days) || days < 0) return;
    const next = addDaysIso(dateReceived, days);
    const syncExpected = !expectedRelease || expectedRelease === claimedDate;
    setClaimedDate(next);
    if (syncExpected) setExpectedRelease(next);
  }

  function handleClaimedDateChange(value: string) {
    daysManualRef.current = true;
    setClaimedDate(value);
    if (dateReceived && value) {
      const diff = Math.round((new Date(value).getTime() - new Date(dateReceived).getTime()) / 86400000);
      if (diff >= 0) setCompletionDaysInput(String(diff));
    }
  }

  const balance = useMemo(() => {
    const gt = parseFloat(grandTotal) || 0;
    const dp = parseFloat(downpayment) || 0;
    return Math.max(0, gt - dp);
  }, [grandTotal, downpayment]);

  const totalPairs = shoes.length;

  function addShoe() { setShoes(prev => [...prev, emptyShoe()]); }
  function removeShoe(i: number) { setShoes(prev => prev.filter((_,idx) => idx !== i)); }
  function updateShoe(i: number, field: keyof ShoeItem, val: any) {
    setShoes(prev => prev.map((s,idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function toggleService(shoeIdx: number, svcName: string, type: 'base'|'addon') {
    setShoes(prev => prev.map((s, idx) => {
      if (idx !== shoeIdx) return s;
      const chip = canonicalServiceName(svcName);
      const has = serviceIsSelected(s, chip);
      const services = has
        ? s.services.filter(sv => canonicalServiceName(sv.service_name || sv.display_label).toLowerCase() !== chip.toLowerCase())
        : [...s.services, { service_name: chip, service_type: type, price: catalogPriceFor(chip, 0, catalogPrices) }];
      return { ...s, services };
    }));
  }

  function validate(): boolean {
    const errs: string[] = [];
    if (!orderId.trim()) errs.push('Order ID is required.');
    const cValidation = validateCustomerName(customerName);
    if (!cValidation.isValid) {
      errs.push(cValidation.error || 'Customer Name is invalid.');
    }
    if (!dateReceived) errs.push('Date Received is required.');
    if (!expectedRelease) errs.push('Expected Release Date is required.');
    if (expectedRelease && dateReceived && expectedRelease < dateReceived)
      errs.push('Expected Release Date cannot be earlier than Date Received.');
    if (claimedDate && claimedDate < dateReceived)
      errs.push('Claimed Date cannot be earlier than Date Received.');
    if (completionDaysInput !== '') {
      const days = parseInt(completionDaysInput, 10);
      if (Number.isNaN(days) || days < 0) errs.push('Completion Days must be a valid number.');
    }
    if (!grandTotal || isNaN(parseFloat(grandTotal)))
      errs.push('Grand Total must be a valid number.');
    setErrors(errs);
    return errs.length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        order_id: orderId,
        customer_name: customerName,
        contact_number: contactNumber,
        branch,
        date_received: dateReceived,
        original_estimated_release_date: expectedRelease,
        claimed_date: claimedDate || null,
        completion_days: completionDaysInput === '' ? null : parseInt(completionDaysInput, 10),
        grand_total: parseFloat(grandTotal) || 0,
        downpayment: parseFloat(downpayment) || 0,
        priority,
        payment_method: existingRecord?.payment_method || 'Cash',
        total_pairs: totalPairs,
        items: shoes.map(s => {
          const breakdown = shoePriceBreakdown(s, priority, catalogPrices);
          return {
            brand: s.brand, model: s.model, color: s.color,
            size: s.size, material: s.material, priority: s.priority || priority,
            remarks: s.remarks,
            item_price: s.is_free ? 0 : (
              typeof s.item_price === 'number' && !Number.isNaN(s.item_price)
                ? s.item_price
                : breakdown.itemTotal
            ),
            services: s.services.map((sv) => ({
              service_name: canonicalServiceName(sv.service_name || sv.display_label) || sv.service_name,
              service_type: sv.service_type || 'base',
              price: catalogPriceFor(sv.service_name || sv.display_label, sv.price, catalogPrices),
            })),
          };
        }),
      };
      const url = isEdit
        ? `${API_BASE}/historical/orders/${existingRecord!.historical_order_id}`
        : `${API_BASE}/historical/orders`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err?.detail;
        const message = Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
          : (typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : 'Save failed.'));
        throw new Error(message);
      }
      toast.success(isEdit ? 'Historical record updated.' : 'Historical record saved.');
      await onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-900 text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5" />
            <h2 className="text-base font-black uppercase tracking-widest">
              {isEdit ? 'Edit Historical Record' : 'New Historical Record'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-black text-red-700 uppercase tracking-wide">Please fix the following</span>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((e, i) => <li key={i} className="text-sm text-red-600">{e}</li>)}
              </ul>
            </div>
          )}

          {/* Section: Customer Information */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Customer Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Order ID *</label>
                <Input value={orderId} onChange={e => setOrderId(e.target.value)}
                  placeholder="ORD-YYYY-MM-DD-001" className="h-9 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Branch</label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-gray-500">Customer Name *</label>
                  <span className={`text-[9px] font-bold ${customerName.length >= CUSTOMER_NAME_MAX_LENGTH ? 'text-red-600' : 'text-gray-400'}`}>
                    {customerName.length}/{CUSTOMER_NAME_MAX_LENGTH}
                  </span>
                </div>
                <Input value={customerName} maxLength={CUSTOMER_NAME_MAX_LENGTH} onChange={e => setCustomerName(e.target.value.slice(0, CUSTOMER_NAME_MAX_LENGTH))}
                  placeholder="Full name (e.g. Juan Carlos Dela Cruz)" className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Contact Number</label>
                <Input value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                  placeholder="09XX XXX XXXX" className="h-9 text-xs" />
              </div>
            </div>
          </div>

          {/* Section: Dates */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Dates</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Date Received *</label>
                <Input type="date" value={dateReceived} onChange={e => setDateReceived(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Expected Release *</label>
                <Input type="date" value={expectedRelease} onChange={e => setExpectedRelease(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Claimed Date</label>
                <Input type="date" value={claimedDate} onChange={e => handleClaimedDateChange(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Completion Days</label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={completionDaysInput}
                    onChange={e => handleCompletionDaysChange(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-gray-400">days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Priority */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Priority Level</h3>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${priority === p
                    ? p === 'rush' ? 'bg-red-600 text-white border-red-600'
                      : 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Shoe Details */}
          <div>
            <div className="flex items-center justify-between mb-3 border-b pb-1">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Shoe Details ({totalPairs} {totalPairs === 1 ? 'Pair' : 'Pairs'})</h3>
              <Button size="sm" onClick={addShoe}
                className="h-7 px-3 text-[10px] font-black uppercase bg-red-600 hover:bg-red-700 text-white rounded-lg">
                <Plus className="h-3 w-3 mr-1" />Add Shoe
              </Button>
            </div>
            <div className="space-y-4">
              {shoes.map((shoe, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 relative">
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Shoe {i+1}</span>
                    {shoes.length > 1 && (
                      <button onClick={() => removeShoe(i)}
                        className="ml-2 p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pr-20">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Brand</label>
                      <Input value={shoe.brand} onChange={e => updateShoe(i,'brand',e.target.value)}
                        placeholder="Nike, Adidas..." className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Model</label>
                      <Input value={shoe.model} onChange={e => updateShoe(i,'model',e.target.value)}
                        placeholder="Air Jordan 1..." className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Color</label>
                      <Input value={shoe.color} onChange={e => updateShoe(i,'color',e.target.value)}
                        placeholder="White/Black" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Size</label>
                      <Input value={shoe.size} onChange={e => updateShoe(i,'size',e.target.value)}
                        placeholder="US 10" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Material</label>
                      <Select value={shoe.material || undefined} onValueChange={v => updateShoe(i,'material',v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Material" />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIALS.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Remarks</label>
                      <Input value={shoe.remarks} onChange={e => updateShoe(i,'remarks',e.target.value)}
                        placeholder="Notes..." className="h-8 text-xs" />
                    </div>
                  </div>
                  {/* Services */}
                  <div className="mt-3">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1.5">Base Service</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {BASE_SERVICES.map(svc => {
                        const active = serviceIsSelected(shoe, svc);
                        return (
                          <button key={svc} type="button" onClick={() => toggleService(i, svc, 'base')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border transition-all ${active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200 hover:border-red-300'}`}>
                            {svc}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1.5">Add-ons</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ADDON_SERVICES.map(svc => {
                        const active = serviceIsSelected(shoe, svc);
                        return (
                          <button key={svc} type="button" onClick={() => toggleService(i, svc, 'addon')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                            {svc}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const breakdown = shoePriceBreakdown(shoe, priority, catalogPrices);
                      return (
                        <div className="mt-3 bg-white border border-gray-100 rounded-lg p-3 space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Price Breakdown</p>
                          <div className="space-y-1">
                            {breakdown.baseLines.map((line, idx) => (
                              <div key={`svc-${i}-${idx}`} className="flex justify-between text-[11px]">
                                <span className="text-gray-500">{line.name}</span>
                                <span className="font-bold text-gray-800">{fmtPeso(line.price)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-[11px] pt-1 border-t border-gray-50">
                              <span className="text-gray-500 font-medium">Service</span>
                              <span className="font-bold text-gray-800">{fmtPeso(breakdown.serviceTotal)}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {breakdown.addonLines.map((line, idx) => (
                              <div key={`addon-${i}-${idx}`} className="flex justify-between text-[11px]">
                                <span className="text-gray-500">{line.name}</span>
                                <span className="font-bold text-gray-800">{fmtPeso(line.price)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-[11px]">
                              <span className="text-gray-500 font-medium">Add-on</span>
                              <span className="font-bold text-gray-800">{fmtPeso(breakdown.addonTotal)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Rush Fee</span>
                            <span className="font-bold text-gray-800">{fmtPeso(breakdown.rushFee)}</span>
                          </div>
                          <div className="flex justify-between items-baseline text-[11px] pt-2 border-t border-gray-100">
                            <span className="font-black uppercase text-gray-700">Item Total</span>
                            <span className="font-black text-red-600">{fmtPeso(breakdown.itemTotal)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Payment */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Payment</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Grand Total *</label>
                <Input type="number" value={grandTotal} onChange={e => setGrandTotal(e.target.value)}
                  placeholder="0.00" className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Downpayment</label>
                <Input type="number" value={downpayment} onChange={e => setDownpayment(e.target.value)}
                  placeholder="0.00" className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Balance</label>
                <div className="h-9 flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 text-xs font-bold text-gray-700">
                  {fmtPeso(balance)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-center gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl min-w-[120px]">Cancel</Button>
          <Button onClick={handleSave} disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest px-8 min-w-[120px]">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Check className="h-4 w-4 mr-2" />Save</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PREDICT DIALOG ───────────────────────────────────────────────────────────

function PredictDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const [form, setForm] = useState({
    total_pairs: 1, basic_cleaning_qty: 0, full_reglue_qty: 0,
    minor_reglue_qty: 0, full_restoration_qty: 0, minor_restoration_qty: 0,
    color_renewal_qty: 0, unyellowing_qty: 0, grand_total: 0,
    priority: 'regular', date_received: new Date().toISOString().slice(0,10),
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function predict() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/historical/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      setResult(await res.json());
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  const setF = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
            <Target className="h-4 w-4 text-red-600" />Predict Release Date
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {result ? (
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-6 text-center">
              <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Prediction Result</p>
              <p className="text-4xl font-black text-emerald-700">{result.predicted_completion_days} days</p>
              <p className="text-sm text-emerald-600 mt-1">Estimated Release: <strong>{result.predicted_release_date}</strong></p>
              <p className="text-[10px] text-gray-400 mt-3">{result.algorithm} · v{result.model_version}</p>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                onClick={() => setResult(null)}>New Prediction</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-xs">Total Pairs</label>
                  <Input type="number" min={1} value={form.total_pairs} onChange={e => setF('total_pairs', +e.target.value)} className="h-8 text-xs mt-1" /></div>
                <div><label className="label-xs">Grand Total (₱)</label>
                  <Input type="number" value={form.grand_total} onChange={e => setF('grand_total', +e.target.value)} className="h-8 text-xs mt-1" /></div>
                <div><label className="label-xs">Date Received</label>
                  <Input type="date" value={form.date_received} onChange={e => setF('date_received', e.target.value)} className="h-8 text-xs mt-1" /></div>
                <div><label className="label-xs">Priority</label>
                  <Select value={form.priority} onValueChange={v => setF('priority', v)}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[10px] font-black uppercase text-gray-400">Service Quantities</p>
              <div className="grid grid-cols-2 gap-2">
                {['basic_cleaning_qty','full_reglue_qty','minor_reglue_qty','full_restoration_qty','minor_restoration_qty','color_renewal_qty','unyellowing_qty'].map(key => (
                  <div key={key}>
                    <label className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5">{key.replace(/_qty$/,'').replace(/_/g,' ')}</label>
                    <Input type="number" min={0} value={(form as any)[key]}
                      onChange={e => setF(key, +e.target.value)} className="h-7 text-xs" />
                  </div>
                ))}
              </div>
              <Button onClick={predict} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Predicting...</> : <><Zap className="h-4 w-4 mr-2" />Predict Release Date</>}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── TAB: RECORDS ────────────────────────────────────────────────────────────

function RecordsTab({ user, showForm, setShowForm, editRecord, setEditRecord }: { 
  user: HistoricalRecordsProps['user'],
  showForm: boolean,
  setShowForm: (v: boolean) => void,
  editRecord: HistoricalRecord | null,
  setEditRecord: (v: HistoricalRecord | null) => void
}) {
  const navigate = useNavigate();
  const [records, setRecords] = useState<HistoricalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSync, setFilterSync] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewRecord, setViewRecord] = useState<HistoricalRecord | null>(null);
  const [shoeDetailRecord, setShoeDetailRecord] = useState<HistoricalRecord | null>(null);
  const [formPreview, setFormPreview] = useState<HistoricalRecord | null>(null);
  const [formPreviewUrl, setFormPreviewUrl] = useState('');
  const [formPreviewKind, setFormPreviewKind] = useState<'image' | 'pdf'>('image');
  const [formPreviewLoading, setFormPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistoricalRecord | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors: any[] } | null>(null);

  const limit = 10;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), finalized_only: 'true' });
      if (search) params.set('search', search);
      if (filterPriority !== 'all') params.set('priority', filterPriority);
      if (filterSync !== 'all') params.set('sync_status', filterSync);
      const res = await fetch(`${API_BASE}/historical/orders?${params}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch records.');
      const data = await res.json();
      setRecords(data.data);
      setTotal(data.total);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page, search, filterPriority, filterSync, user.token]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    const filename = originalFormFilename(formPreview);
    if (!filename || !user.token) {
      setFormPreviewUrl('');
      setFormPreviewLoading(false);
      return;
    }
    let objectUrl = '';
    let cancelled = false;
    setFormPreviewLoading(true);
    setFormPreviewUrl('');
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/historical/image/${encodeURIComponent(filename)}`,
          { headers: { Authorization: `Bearer ${user.token}` } },
        );
        if (!res.ok) throw new Error('Original form could not be loaded.');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        const type = (res.headers.get('content-type') || blob.type || '').toLowerCase();
        setFormPreviewKind(
          type.includes('pdf') || filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
        );
        setFormPreviewUrl(url);
      } catch {
        if (!cancelled) {
          setFormPreviewUrl('');
          toast.error('Original form could not be loaded.');
        }
      } finally {
        if (!cancelled) setFormPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [formPreview, user.token]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/historical/orders/${deleteTarget.historical_order_id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` },
      });
      toast.success('Record deleted.');
      setDeleteTarget(null);
      fetchRecords();
    } catch { toast.error('Delete failed.'); }
  }

  async function handleExportCSV() {
    try {
      const res = await fetch(`${API_BASE}/historical/export-csv`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'historical_dataset.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully.');
    } catch { toast.error('Export failed.'); }
  }



  const totalPages = Math.ceil(total / limit) || 1;

  async function handleBulkImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : [json];
      const res = await fetch(`${API_BASE}/historical/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(arr),
      });
      const result = await res.json();
      setImportResult(result);
      if (result.inserted > 0) {
        toast.success(`Imported ${result.inserted} record${result.inserted !== 1 ? 's' : ''} successfully.`);
        fetchRecords();
      }
      if (result.skipped > 0) toast.warning(`${result.skipped} record${result.skipped !== 1 ? 's' : ''} skipped.`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between w-full gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <Button onClick={() => navigate('/service-management')}
            className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 shrink-0">
            <ChevronLeft className="h-4 w-4" /> BACK
          </Button>
          <div className="relative min-w-[160px] w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search order # or customer..." className="pl-9 h-9 text-xs rounded-xl" />
        </div>
        <Select value={filterPriority} onValueChange={v => { setFilterPriority(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-32 text-xs rounded-xl border-gray-200"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Priority</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSync} onValueChange={v => { setFilterSync(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-32 text-xs rounded-xl border-gray-200"><SelectValue placeholder="Sync Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Sync</SelectItem>
            <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            <SelectItem value="synced" className="text-xs">Synced</SelectItem>
            <SelectItem value="failed" className="text-xs">Failed</SelectItem>
          </SelectContent>
        </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={handleExportCSV} title="Export CSV"
            className="h-9 w-9 p-0 rounded-xl border-gray-200 hover:border-emerald-500 hover:text-emerald-700 flex items-center justify-center shrink-0">
            <Download className="h-4 w-4" />
          </Button>
          {/* Bulk JSON Import */}
          <label title="Import JSON from AI extraction" className="cursor-pointer">
            <input type="file" accept=".json" className="hidden" onChange={handleBulkImport} />
            <div className={`h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 hover:border-blue-500 hover:text-blue-700 transition-colors ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </div>
          </label>
          <Button onClick={() => { setEditRecord(null); setShowForm(true); }}
            className="bg-red-600 hover:bg-red-700 text-white h-9 px-4 rounded-xl font-black uppercase text-[11px] tracking-widest flex items-center gap-1.5 shadow-md shrink-0">
            <Plus className="h-4 w-4" /><span className="hidden sm:inline">New Historical Record</span>
          </Button>
        </div>
      </div>

          {importResult && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border mb-2 ${
              importResult.skipped > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {importResult.skipped > 0 ? <CircleAlert className="h-3.5 w-3.5 shrink-0" /> : <CircleCheck className="h-3.5 w-3.5 shrink-0" />}
              <span className="font-bold">{importResult.inserted} imported, {importResult.skipped} skipped.</span>
              {importResult.errors.length > 0 && <span className="text-[10px] text-gray-500 ml-1">{importResult.errors[0]?.error}</span>}
              <button onClick={() => setImportResult(null)} className="ml-auto"><X className="h-3 w-3" /></button>
            </div>
          )}
          {/* Table */}
          <div className="overflow-x-auto w-full rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full table-fixed min-w-[1150px] text-xs">
          <colgroup>
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[6%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[4%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead>
            <tr className="bg-red-50/60 border-b border-red-100">
              {['Order ID','Customer','Priority','Shoes','Services','Order Date','Expected Date','Claimed Date','Total Days','Grand Total','View','Actions'].map(h => (
                <th key={h} className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-gray-600 text-center whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={12} className="py-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-red-500 mx-auto" />
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={12} className="py-20 text-center">
                <Archive className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No historical records found</p>
              </td></tr>
            ) : records.map(r => {
              const orderId = displayOrderId(r.order_id);
              return (
              <tr key={r.historical_order_id} className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setViewRecord(r)}>
                <td className="px-2 py-3 text-xs font-bold text-center font-mono whitespace-nowrap">
                  {orderId.isPlaceholder ? (
                    <span className="text-gray-300">—</span>
                  ) : orderId.isCanonical ? (
                    <span className="text-red-700">{orderId.text}</span>
                  ) : (
                    <span className="text-orange-600" title="Legacy ID — not yet in ORD-YYYY-MM-DD-NNN format">{orderId.text}</span>
                  )}
                </td>
                <td className="px-2 py-3 text-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="text-xs font-medium text-gray-900 leading-tight truncate max-w-full">{toTitleCase(presentField(r.customer_name)) || '—'}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-full">{presentField(r.contact_number) || '—'}</div>
                  </div>
                </td>
                <td className="px-1 py-3 text-center whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                    r.priority === 'rush' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>{r.priority || 'Regular'}</span>
                </td>
                <td className="px-2 py-3 text-xs text-center text-gray-700 whitespace-normal break-words">
                  {r.items?.length > 0 ? r.items.slice(0,2).map((it, i) => (
                    <div key={i} className="text-[10px] leading-tight">{it.brand} {it.model}</div>
                  )) : <span className="text-gray-300">—</span>}
                  {r.items?.length > 2 && <div className="text-[9px] text-gray-400">+{r.items.length - 2} more</div>}
                </td>
                <td className="px-2 py-3 text-xs text-center whitespace-normal break-words">
                  {r.items?.flatMap(it => it.services).slice(0,3).map((s, i) => (
                    <span key={i} className="inline-block mr-0.5 mb-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-50 text-red-700">{s.display_label || s.service_name}</span>
                  ))}
                  {r.items?.flatMap(it => it.services).length > 3 && <span className="text-[9px] text-gray-400">+more</span>}
                  {!r.items?.flatMap(it => it.services).length && <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-xs text-center">{fmtDate(r.date_received)}</td>
                <td className="px-3 py-3 text-xs text-center">{fmtDate(r.original_estimated_release_date)}</td>
                <td className="px-3 py-3 text-xs text-center">{fmtDate(r.claimed_date)}</td>
                <td className="px-3 py-3 text-xs text-center font-bold">{r.completion_days ?? '—'}</td>
                <td className="px-3 py-3 text-xs text-center font-bold">{fmtPeso(r.grand_total)}</td>
                <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!originalFormFilename(r)) {
                        toast.error('No scanned form photo is linked to this record.');
                        return;
                      }
                      setFormPreview(r);
                    }}
                    className="inline-flex items-center gap-1 h-7 px-2 text-[10px] font-black uppercase border border-red-600 text-red-600 rounded bg-red-50 hover:bg-red-100 transition-colors"
                    title="View original scanned form"
                  >
                    <Eye className="h-3.5 w-3.5" />View
                  </button>
                </td>
                <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center h-7 w-7 text-xs border border-red-200 text-red-700 rounded-md bg-red-50 hover:bg-red-100 transition-colors" title="Actions">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 p-1.5 space-y-0.5">
                      <DropdownMenuItem onClick={() => {
                        if (!originalFormFilename(r)) {
                          toast.error('No scanned form photo is linked to this record.');
                          return;
                        }
                        setFormPreview(r);
                      }}
                        className="text-xs font-bold flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-700">
                        <FileText className="h-3.5 w-3.5" />View Form Photo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShoeDetailRecord(r)}
                        className="text-xs font-bold flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-700">
                        <Package className="h-3.5 w-3.5" />Shoe Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditRecord(r); setShowForm(true); }}
                        className="text-xs font-bold flex items-center gap-2 rounded-md px-2 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100">
                        <Edit2 className="h-3.5 w-3.5" />Edit Record
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(r)}
                        className="text-xs font-bold flex items-center gap-2 rounded-md px-2 py-1.5 text-red-700 bg-red-50 hover:bg-red-100">
                        <Trash2 className="h-3.5 w-3.5" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">
          {total} record{total !== 1 ? 's' : ''} · Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p-1)}
            className="h-8 w-8 p-0 rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({length: totalPages}, (_,i) => i+1).map(n => (
            <Button key={n} size="sm" onClick={() => setPage(n)}
              className={`h-7 w-7 min-w-[28px] p-0 text-[10px] font-black rounded-lg ${n === page ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-red-50'}`}>
              {n}
            </Button>
          ))}
          <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p+1)}
            className="h-8 w-8 p-0 rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <HistoricalOrderForm
          key={editRecord?.historical_order_id ?? 'new-historical'}
          token={user.token}
          existingRecord={editRecord}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
          onSaved={fetchRecords}
          recordCount={total}
        />
      )}

      {/* View Dialog */}
      {viewRecord && (
        <Dialog open onOpenChange={() => setViewRecord(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
                <Archive className="h-4 w-4 text-red-600" />{viewRecord.order_id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Customer', toTitleCase(viewRecord.customer_name)],
                  ['Contact', viewRecord.contact_number],
                  ['Branch', viewRecord.branch],
                  ['Priority', viewRecord.priority],
                  ['Order Date', fmtDate(viewRecord.date_received)],
                  ['Expected Date', fmtDate(viewRecord.original_estimated_release_date)],
                  ['Claimed Date', fmtDate(viewRecord.claimed_date)],
                  ['Total Days', viewRecord.completion_days !== null && viewRecord.completion_days !== undefined ? `${viewRecord.completion_days} days` : null],
                  ['Grand Total', fmtPeso(viewRecord.grand_total)],
                  ['Downpayment', viewRecord.downpayment ? fmtPeso(viewRecord.downpayment) : null],
                  ['Balance', viewRecord.balance ? fmtPeso(viewRecord.balance) : null],
                  ['Payment Method', viewRecord.payment_method],
                  ['Sync Status', viewRecord.sync_status],
                ].filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '—').map(([k,v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[9px] font-black uppercase text-gray-400">{k}</p>
                    <p className="font-bold text-gray-800">{v}</p>
                  </div>
                ))}
              </div>
              {viewRecord.items.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Shoe Details</p>
                  {viewRecord.items.map((item, i) => {
                    const meta = [
                      presentField(item.color) ? `Color: ${item.color}` : null,
                      presentField(item.size) ? `Size: ${item.size}` : null,
                      presentField(item.material) ? `Material: ${item.material}` : null,
                    ].filter(Boolean);
                    const services = item.services || [];
                    return (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 mb-2 bg-gray-50">
                      <p className="text-xs font-black text-gray-700 mb-1">Shoe {i+1}: {[item.brand, item.model].filter(Boolean).join(' ')}</p>
                      {meta.length > 0 && (
                        <p className="text-[10px] text-gray-500">{meta.join(' · ')}</p>
                      )}
                      {services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {services.map((s, sIdx) => (
                            <span key={`${s.service_name}-${sIdx}`} className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-50 text-red-700 border border-red-100">
                              {s.display_label || s.service_name}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.is_free ? (
                        <p className="text-[10px] font-bold text-gray-700 mt-2">Total Price: FREE</p>
                      ) : item.price_breakdown ? (
                        <p className="text-[10px] font-bold text-gray-700 mt-2">
                          {item.price_breakdown} Total Price: {fmtPeso(item.item_price)}
                        </p>
                      ) : item.item_price ? (
                        <p className="text-[10px] font-bold text-gray-700 mt-2">Total Price: {fmtPeso(item.item_price)}</p>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Shoe Details Dialog */}
      {shoeDetailRecord && (
        <Dialog open onOpenChange={() => setShoeDetailRecord(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
                <Package className="h-4 w-4 text-red-600" />
                Shoe Details · {shoeDetailRecord.order_id}
              </DialogTitle>
            </DialogHeader>
            <div className="text-xs text-gray-500 mb-3 font-medium">
              {toTitleCase(shoeDetailRecord.customer_name)}
              {shoeDetailRecord.contact_number ? ` · ${shoeDetailRecord.contact_number}` : ''}
            </div>
            {shoeDetailRecord.items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No shoe details recorded.</p>
            ) : (
              <div className="space-y-3">
                {shoeDetailRecord.items.map((item, i) => {
                  const meta = [
                    presentField(item.color) ? `Color: ${item.color}` : null,
                    presentField(item.size) ? `Size: ${item.size}` : null,
                    presentField(item.material) ? `Material: ${item.material}` : null,
                  ].filter(Boolean);
                  const services = item.services || [];
                  return (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                      <p className="text-sm font-black text-gray-800 mb-1">
                        Shoe {i + 1}: {[item.brand, item.model].filter(Boolean).join(' ') || '—'}
                      </p>
                      {meta.length > 0 && (
                        <p className="text-[10px] text-gray-500 mb-2">{meta.join(' · ')}</p>
                      )}
                      {item.remarks && (
                        <p className="text-[10px] text-gray-400 italic mb-2">Remarks: {item.remarks}</p>
                      )}
                      {services.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {services.map((s, sIdx) => (
                            <span key={`${s.service_name}-${sIdx}`} className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-50 text-red-700 border border-red-100">
                              {s.display_label || s.service_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-300 mb-2">No services recorded</p>
                      )}
                      {item.is_free ? (
                        <p className="text-[10px] font-bold text-emerald-600">Total Price: FREE</p>
                      ) : item.price_breakdown ? (
                        <p className="text-[10px] font-bold text-gray-700">
                          {item.price_breakdown} &mdash; Total: {fmtPeso(item.item_price)}
                        </p>
                      ) : item.item_price ? (
                        <p className="text-[10px] font-bold text-gray-700">Total Price: {fmtPeso(item.item_price)}</p>
                      ) : (
                        <p className="text-[10px] text-gray-300">Price not recorded</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Original Form Viewer */}
      {formPreview && (
        <Dialog open onOpenChange={() => { setFormPreview(null); setFormPreviewUrl(''); setFormPreviewLoading(false); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-600" />
                Original Form · {formPreview.order_id}
              </DialogTitle>
            </DialogHeader>
            <p className="text-[11px] text-gray-500 -mt-2 mb-2 truncate">
              {originalFormFilename(formPreview)}
            </p>
            <div className="flex-1 min-h-[420px] bg-gray-50 border border-gray-100 rounded-xl overflow-auto">
              {formPreviewLoading ? (
                <div className="h-[420px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                </div>
              ) : formPreviewUrl ? (
                formPreviewKind === 'pdf' ? (
                  <iframe
                    src={formPreviewUrl}
                    title={`Original form ${formPreview.order_id}`}
                    className="w-full h-[70vh] min-h-[420px] border-0 bg-white"
                  />
                ) : (
                  <img
                    src={formPreviewUrl}
                    alt={`Original form for ${formPreview.order_id}`}
                    className="w-full object-contain object-top"
                  />
                )
              ) : (
                <div className="h-[420px] flex flex-col items-center justify-center text-center px-6">
                  <Archive className="h-10 w-10 text-gray-200 mb-2" />
                  <p className="text-sm font-bold text-gray-500">
                    {originalFormFilename(formPreview)
                      ? 'Original form could not be loaded.'
                      : 'No scanned form photo is linked to this record.'}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />Confirm Delete
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Delete historical record <strong>{deleteTarget.order_id}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100 w-full">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-100 justify-center">Cancel</Button>
              <Button onClick={handleDelete} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5">
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── TAB: ANALYTICS ──────────────────────────────────────────────────────────

function AnalyticsTab({ user }: { user: HistoricalRecordsProps['user'] }) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState('all');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (priority !== 'all') params.set('priority', priority);
      
      const [analyticsRes, infoRes] = await Promise.all([
        fetch(`${API_BASE}/historical/analytics?${params}`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${API_BASE}/historical/model-info`, { headers: { Authorization: `Bearer ${user.token}` } })
      ]);
      
      if (!analyticsRes.ok) throw new Error('Failed to load analytics.');
      setData(await analyticsRes.json());
      if (infoRes.ok) setModelInfo(await infoRes.json());
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate, priority, user.token]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const serviceDistribution = useMemo(
    () => mergeServiceDistribution(data?.service_distribution),
    [data?.service_distribution],
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-10 w-10 animate-spin text-red-500" />
    </div>
  );

  const ov = data?.overview ?? {};

  const overviewCards = [
    { label: 'Total Historical Orders', value: ov.total_records ?? 0, icon: FileText, color: 'from-purple-50 to-purple-100', text: 'text-purple-700', iconColor: 'text-purple-400' },
    { label: 'Revenue', value: fmtPeso(ov.total_revenue), icon: DollarSign, color: 'from-emerald-50 to-emerald-100', text: 'text-emerald-700', iconColor: 'text-emerald-400' },
    { label: 'Average Completion Time', value: `${ov.avg_completion_time ?? 0} days`, icon: Clock, color: 'from-blue-50 to-blue-100', text: 'text-blue-700', iconColor: 'text-blue-400' },
    { label: 'Total Pairs', value: ov.total_pairs ?? 0, icon: Package, color: 'from-amber-50 to-amber-100', text: 'text-amber-700', iconColor: 'text-amber-400' },
    { label: 'Total Customers', value: ov.total_customers ?? 0, icon: Users, color: 'from-rose-50 to-rose-100', text: 'text-rose-700', iconColor: 'text-rose-400' },
    { label: 'Most Requested Service', value: serviceDistribution[0]?.service || ov.most_requested_service || 'N/A', icon: Star, color: 'from-indigo-50 to-indigo-100', text: 'text-indigo-700', iconColor: 'text-indigo-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/service-management')}
            className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 shrink-0 mr-2">
            <ChevronLeft className="h-4 w-4" /> BACK
          </Button>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs w-36 rounded-xl" />
        <span className="text-xs text-gray-400">to</span>
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs w-36 rounded-lg" />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-8 w-28 text-xs rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Priority</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        </div>
        <Button size="sm" onClick={fetchAnalytics} className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md shrink-0">
          <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {overviewCards.map(c => (
          <Card key={c.label} className={`border-none shadow-sm bg-gradient-to-br ${c.color} overflow-hidden relative`}>
            <div className={`absolute top-2 right-2 opacity-10`}><c.icon size={36} className={c.iconColor} /></div>
            <CardContent className="pt-4 pb-3 px-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">{c.label}</p>
              <p className={`text-lg font-black ${c.text} leading-tight`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Machine Learning Overview */}
      {modelInfo && (
        <Card className="border border-red-100 bg-gradient-to-r from-red-50/50 to-white shadow-sm overflow-hidden relative">
          <div className="absolute -right-4 -top-4 opacity-5"><Cpu size={120} className="text-red-500" /></div>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-red-700 flex items-center gap-2">
              <Cpu className="h-4 w-4" />Machine Learning Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Model</p>
                <p className="text-sm font-bold text-gray-800">Random Forest Regression</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Training Records</p>
                <p className="text-sm font-bold text-blue-700">{modelInfo.records_available ?? 0}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Last Training</p>
                <p className="text-sm font-bold text-gray-800">
                  {modelInfo.last_trained_at ? new Date(modelInfo.last_trained_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Test R²</p>
                <p className="text-sm font-black text-emerald-600">
                  {modelInfo.r2_score != null ? Number(modelInfo.r2_score).toFixed(3) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Test MAE (days)</p>
                <p className="text-sm font-bold text-gray-800">
                  {modelInfo.mae != null ? Number(modelInfo.mae).toFixed(1) : '—'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 leading-snug">
              Target: order-to-claim turnaround days (claimed − received). R² is a fit score (not “accuracy %”). Official release dates still come from Shoelotskey business rules.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-red-500" />Monthly Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.monthly_chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#b91c1c" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.revenue_chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `₱${v}`} />
                <Tooltip formatter={(v: any) => fmtPeso(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-blue-500" />Service Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={serviceDistribution} dataKey="count" nameKey="service" outerRadius={80} label={({ service }) => service}>
                  {serviceDistribution.map((_:any, i:number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-amber-500" />Top Shoe Brands
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.brand_distribution ?? []} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="brand" tick={{ fontSize: 9 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Services */}
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500">Top Requested Services</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <table className="w-full text-xs">
              <thead><tr className="text-[9px] font-black uppercase text-gray-400 border-b">
                <th className="py-1 text-left">Service</th><th className="py-1 text-right">Count</th>
              </tr></thead>
              <tbody>{serviceDistribution.map((s:any) => (
                <tr key={s.service} className="border-b border-gray-50">
                  <td className="py-1.5 font-medium">{s.service}</td>
                  <td className="py-1.5 text-right font-black text-red-700">{s.count}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>

        {/* Highest Revenue */}
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500">Highest Revenue Orders</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <table className="w-full text-xs">
              <thead><tr className="text-[9px] font-black uppercase text-gray-400 border-b">
                <th className="py-1 text-left">Order ID</th>
                <th className="py-1 text-left">Customer</th>
                <th className="py-1 text-right">Amount</th>
              </tr></thead>
              <tbody>{(data?.highest_revenue_orders ?? []).map((o:any) => (
                <tr key={o.order_id} className="border-b border-gray-50">
                  <td className="py-1.5 font-mono text-red-700">{o.order_id}</td>
                  <td className="py-1.5 text-gray-600">{o.customer_name}</td>
                  <td className="py-1.5 text-right font-black text-emerald-700">{fmtPeso(o.grand_total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: MACHINE LEARNING ────────────────────────────────────────────────────

function MachineLearningTab({ user }: { user: HistoricalRecordsProps['user'] }) {
  const navigate = useNavigate();
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [liveStats, setLiveStats] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPredict, setShowPredict] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [infoRes, statsRes, predsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/historical/model-info`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${API_BASE}/historical/stats`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${API_BASE}/historical/predictions`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${API_BASE}/etl/import-history`, { headers: { Authorization: `Bearer ${user.token}` } }),
      ]);
      if (infoRes.ok) setModelInfo(await infoRes.json());
      if (statsRes.ok) setLiveStats(await statsRes.json());
      if (predsRes.ok) setPredictions(await predsRes.json());
      if (historyRes.ok) setImportHistory(await historyRes.json());
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [user.token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleTrain() {
    setTraining(true);
    try {
      const res = await fetch(`${API_BASE}/historical/train`, {
        method: 'POST', headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(`Model trained! R²: ${data.r2_score} · MAE: ${data.mae} days · ${data.dataset_size} records`);
        fetchData();
      } else if (data.status === 'insufficient_data') {
        toast.warning(data.message);
      } else {
        toast.error('Training failed.');
      }
    } catch { toast.error('Training request failed.'); }
    finally { setTraining(false); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/historical/export-csv`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'historical_dataset.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Dataset exported successfully.');
    } catch { toast.error('Export failed.'); }
    finally { setExporting(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-10 w-10 animate-spin text-red-500" />
    </div>
  );

  const info = modelInfo ?? {};
  const exportCount = liveStats?.export_record_count ?? liveStats?.ml_eligible ?? liveStats?.ready_for_training ?? info.records_available ?? 0;
  const totalCount = liveStats?.total ?? info.records_available ?? exportCount;
  const validatedCount = liveStats?.validated ?? info.records_available ?? exportCount;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between w-full gap-2">
        <Button onClick={() => navigate('/service-management')}
          className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 shrink-0">
          <ChevronLeft className="h-4 w-4" /> BACK
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={handleTrain} disabled={training}
            className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md flex items-center shrink-0">
            {training ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Training...</> : <><Cpu className="h-4 w-4 mr-1" />Train Model</>}
          </Button>
          <Button onClick={() => setShowPredict(true)}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-md flex items-center shrink-0">
            <Target className="h-4 w-4 mr-1" />Predict
          </Button>
        </div>
      </div>

      {/* Dataset & Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dataset Info */}
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-blue-500" />Dataset Information
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Total Historical Records</span>
              <span className="font-black text-blue-700">{totalCount} Records</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Ready for Training</span>
              <span className="font-black text-emerald-700">{validatedCount} Validated · {exportCount} ML-Eligible</span>
            </div>
            {liveStats?.missing_fields > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 font-medium">Missing Critical Fields</span>
                <span className="font-black text-amber-600">{liveStats.missing_fields} Records</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Features</span>
              <span className="font-black text-gray-700">18</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Target Variable</span>
              <span className="font-black text-gray-700">Completion Days</span>
            </div>
            <div className="pt-2">
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">historical_dataset.csv</p>
                    <p className="text-[10px] text-gray-500">{exportCount} Records · Click to export</p>
                  </div>
                </div>
                <Button onClick={handleExport} disabled={exporting} size="sm" variant="outline" className="h-8 rounded-lg hover:bg-blue-50 hover:text-blue-700">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model Info */}
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-red-500" />Model Information
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Algorithm</span>
              <span className="font-black text-gray-700">Random Forest Regression</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Model Status</span>
              <span className={`font-black ${info.model_trained ? 'text-emerald-700' : 'text-amber-700'}`}>
                {info.model_trained ? 'Ready' : 'Not Trained'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Last Trained</span>
              <span className="font-black text-gray-700">{info.last_trained_at ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Version</span>
              <span className="font-black text-gray-700">v{info.model_version ?? '1.0'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature List */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5 text-purple-500" />ML Features (Input Variables)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {['Total Pairs','Basic Cleaning Qty','Full Reglue Qty','Minor Reglue Qty','Full Restoration Qty',
              'Minor Restoration Qty','Color Renewal Qty','Unyellowing Qty','Priority (Encoded)',
              'Grand Total','Day of Week Received','Month Received',
              'Scratches Count','Yellowing Count','Sole Separation Count','Deep Stains Count',
              'Rips/Holes Count','Worn Out Count'].map(f => (
              <span key={f} className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-md text-[10px] font-bold uppercase">
                {f}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-blue-500" />ETL Import History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {importHistory.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8 font-bold uppercase tracking-widest">No imports yet. Click Import Dataset in the Records tab to get started.</p>
          ) : (
            <div className="space-y-3">
              {/* Latest import highlight card */}
              {(() => {
                const latest = importHistory[0];
                const statusColor = latest.status === 'completed' ? 'emerald' : latest.status === 'running' ? 'blue' : 'red';
                const duration = latest.duration_seconds != null ? `${latest.duration_seconds.toFixed(1)}s` : '—';
                return (
                  <div className={`p-4 rounded-xl border bg-${statusColor}-50 border-${statusColor}-200`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-200`}>
                            {latest.status === 'completed' ? '✅ Completed' : latest.status === 'running' ? '🔄 Running' : '❌ Failed'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">{latest.filename}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium">
                          By <strong>{latest.imported_by}</strong> · {latest.import_started ? new Date(latest.import_started).toLocaleString('en-PH') : '—'}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 shrink-0">{duration}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {[
                        { label: 'Records Read', value: latest.records_read ?? 0, color: 'text-gray-700' },
                        { label: 'Imported', value: latest.records_imported ?? 0, color: 'text-emerald-700' },
                        { label: 'Duplicates', value: latest.duplicates_removed ?? 0, color: 'text-amber-600' },
                        { label: 'Invalid', value: latest.invalid_records ?? 0, color: 'text-red-600' },
                      ].map(stat => (
                        <div key={stat.label} className="text-center">
                          <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                          <p className="text-[9px] font-bold uppercase text-gray-400">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    {latest.error_message && (
                      <p className="mt-2 text-[10px] text-red-600 font-medium bg-red-50 border border-red-100 rounded p-2 break-all">{latest.error_message}</p>
                    )}
                  </div>
                );
              })()}
              {/* Previous imports table */}
              {importHistory.length > 1 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-[9px] font-black uppercase text-gray-400 border-b">
                      <th className="py-1 text-left">File</th>
                      <th className="py-1 text-center">Imported</th>
                      <th className="py-1 text-center">Dupes</th>
                      <th className="py-1 text-center">Invalid</th>
                      <th className="py-1 text-center">Duration</th>
                      <th className="py-1 text-center">By</th>
                      <th className="py-1 text-right">Date</th>
                      <th className="py-1 text-right">Status</th>
                    </tr></thead>
                    <tbody>{importHistory.slice(1).map((h: any) => (
                      <tr key={h.import_id} className="border-b border-gray-50">
                        <td className="py-1.5 font-mono text-gray-500 max-w-[120px] truncate">{h.filename}</td>
                        <td className="py-1.5 text-center font-black text-emerald-700">{h.records_imported ?? 0}</td>
                        <td className="py-1.5 text-center font-bold text-amber-600">{h.duplicates_removed ?? 0}</td>
                        <td className="py-1.5 text-center font-bold text-red-600">{h.invalid_records ?? 0}</td>
                        <td className="py-1.5 text-center text-gray-500">{h.duration_seconds != null ? `${h.duration_seconds.toFixed(1)}s` : '—'}</td>
                        <td className="py-1.5 text-center text-gray-500">{h.imported_by}</td>
                        <td className="py-1.5 text-right text-gray-400">{h.import_started ? new Date(h.import_started).toLocaleDateString('en-PH') : '—'}</td>
                        <td className="py-1.5 text-right">
                          <span className={`font-black text-[10px] uppercase ${ h.status === 'completed' ? 'text-emerald-600' : h.status === 'running' ? 'text-blue-600' : 'text-red-600'}`}>{h.status}</span>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prediction History */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />Prediction History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {predictions.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8 font-bold uppercase tracking-widest">No predictions yet. Train the model and use Predict to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-[9px] font-black uppercase text-gray-400 border-b">
                  <th className="py-1 text-left">Order ID</th>
                  <th className="py-1 text-center">Predicted Days</th>
                  <th className="py-1 text-center">Actual Days</th>
                  <th className="py-1 text-center">Error</th>
                  <th className="py-1 text-center">Release Date</th>
                  <th className="py-1 text-center">Algorithm</th>
                  <th className="py-1 text-right">Predicted At</th>
                </tr></thead>
                <tbody>{predictions.map((p:any) => (
                  <tr key={p.prediction_id} className="border-b border-gray-50">
                    <td className="py-2 font-mono text-red-700">{p.order_id ?? '—'}</td>
                    <td className="py-2 text-center font-black text-blue-700">{p.predicted_completion_days}</td>
                    <td className="py-2 text-center font-bold text-gray-700">{p.actual_completion_days ?? '—'}</td>
                    <td className="py-2 text-center font-bold text-red-600">{p.prediction_error !== null ? p.prediction_error : '—'}</td>
                    <td className="py-2 text-center">{p.predicted_release_date}</td>
                    <td className="py-2 text-center text-gray-500">{p.algorithm}</td>
                    <td className="py-2 text-right text-gray-400">{p.prediction_date ? new Date(p.prediction_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showPredict && <PredictDialog token={user.token} onClose={() => { setShowPredict(false); fetchData(); }} />}
    </div>
  );
}

// ─── ARCHIVES TAB ─────────────────────────────────────────────────────────────

function ArchivesTab({ user }: { user: HistoricalRecordsProps['user'] }) {
  const navigate = useNavigate();
  const [archives, setArchives] = useState<{ month: string; year: string; filename: string; url: string; pdf_count?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/historical/archives`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) throw new Error('Failed to load archives.');
        const data = await res.json();
        setArchives(data.archives ?? []);
      } catch (e: any) {
        setError(e.message || 'Could not load archives.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.token]);

  const openArchive = async (url: string) => {
    const filename = url.split('/').filter(Boolean).pop() || '';
    try {
      const res = await fetch(`${API_BASE}/historical/image/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error('Could not open archive.');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (e: any) {
      setError(e.message || 'Could not open archive.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between w-full">
        <Button onClick={() => navigate('/service-management')}
          className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 shrink-0">
          <ChevronLeft className="h-4 w-4" /> BACK
        </Button>
      </div>
      <Card className="border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-600" />
            Monthly Report Archives
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Original scanned PDF batch reports discovered from the historical source folder.</p>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-600 font-medium">{error}</div>
          ) : archives.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">No PDF archives found in the source directory.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {archives.map((archive) => (
                <button
                  key={`${archive.month}-${archive.filename}`}
                  type="button"
                  className="group border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:border-red-300 hover:bg-red-50 transition-all text-left"
                  onClick={() => openArchive(archive.url)}
                >
                  <FileText className="h-10 w-10 text-gray-400 group-hover:text-red-500 transition-colors" />
                  <span className="text-sm font-bold text-gray-700 group-hover:text-red-700">{archive.month} {archive.year}</span>
                  <span className="text-[10px] text-gray-400 truncate max-w-full px-2">{archive.filename}</span>
                  <div className="flex items-center gap-1 text-gray-400 group-hover:text-red-500">
                    <span className="text-[10px] uppercase font-black tracking-widest">Open PDF</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type Tab = 'records' | 'analytics' | 'ml' | 'ocr' | 'archives';

export default function HistoricalRecords({ user, onSetHeaderActionRight }: HistoricalRecordsProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('records');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<HistoricalRecord | null>(null);
  const isOwner = ['owner', 'admin'].includes(user.role?.toLowerCase() || '');

  useEffect(() => {
    if (onSetHeaderActionRight) {
      if (activeTab === 'ocr') {
        onSetHeaderActionRight(null);
      } else {
        onSetHeaderActionRight(
          <Button
            onClick={() => navigate('/service-management')}
            className="h-9 px-3 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition"
            title="Back to Service Management"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Services</span>
            <span className="sm:hidden">Back</span>
          </Button>
        );
      }
    }
    return () => { if (onSetHeaderActionRight) onSetHeaderActionRight(null); };
  }, [onSetHeaderActionRight, navigate, activeTab]);

  const tabs: { key: Tab; label: string; icon: React.ElementType; ownerOnly?: boolean }[] = [
    { key: 'records',   label: 'Records',          icon: Archive },
    { key: 'analytics', label: 'Analytics',        icon: BarChart2, ownerOnly: true },
    { key: 'ml',        label: 'ML Training',      icon: Cpu, ownerOnly: true },
    { key: 'ocr',       label: 'OCR Validation',   icon: Zap },
    { key: 'archives',  label: 'Archives',         icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-500">
        {/* Page intro */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="flex items-center gap-4 text-left">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-200">
              <Archive className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Shoelotskey SMS · Centralized Repository
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Encode old paper receipts • Data Analytics • Machine Learning Training Data
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation — horizontal scroll on narrow screens; no vertical scrollbar */}
        <div className="overflow-x-auto overflow-y-hidden pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
          <div className="flex justify-start sm:justify-center gap-2 sm:gap-4 border-b border-gray-200 min-w-max sm:min-w-0">
          {tabs.filter(t => !t.ownerOnly || isOwner).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 min-w-[7.5rem] text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 -mb-px shrink-0 ${
                activeTab === t.key
                  ? 'text-red-700 border-red-600 bg-red-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <t.icon className="h-3.5 w-3.5 shrink-0" />
              {t.label}
            </button>
          ))}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'records'   && <RecordsTab user={user} showForm={showForm} setShowForm={setShowForm} editRecord={editRecord} setEditRecord={setEditRecord} />}
          {activeTab === 'analytics' && isOwner && <AnalyticsTab user={user} />}
          {activeTab === 'ml'        && isOwner && <MachineLearningTab user={user} />}
          {activeTab === 'ocr'       && <div className="animate-in fade-in duration-500"><HistoricalValidationQueue user={user} onBack={() => setActiveTab('records')} /></div>}
          {activeTab === 'archives'  && <ArchivesTab user={user} />}
        </div>
      </div>
    </div>
  );
}

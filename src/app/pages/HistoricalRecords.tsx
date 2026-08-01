import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Archive, Plus, Download, Search, Trash2, Edit2, Eye,
  ChevronLeft, ChevronRight, BarChart2, Cpu, X, Check, AlertTriangle,
  TrendingUp, Users, Package, Clock, DollarSign, Star, Loader2, RefreshCw,
  FileText, Zap, Target, Activity
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
import { MoreVertical, ChevronDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoricalRecordsProps {
  user: { username: string; role: 'owner' | 'staff'; token: string };
  onSetHeaderActionRight?: (node: React.ReactNode) => void;
}

interface ShoeItem {
  brand: string; model: string; color: string; size: string;
  material: string; priority: string; remarks: string;
  services: { service_name: string; service_type: string; price: number }[];
}

interface HistoricalRecord {
  historical_order_id: number; order_id: string;
  customer_name: string; contact_number: string; branch: string;
  date_received: string; expected_release_date: string;
  claimed_date: string | null; completion_days: number | null;
  total_pairs: number; grand_total: number; downpayment: number; balance: number;
  priority: string; sync_status: string; status: string;
  items: (ShoeItem & { historical_item_id?: number })[];
}

const API_BASE = (typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173'
))
  ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:8000/api`
  : '/api';

const CHART_COLORS = ['#b91c1c','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
const BASE_SERVICES = ['Basic Cleaning','Full Reglue','Minor Reglue','Full Restoration','Minor Restoration','Color Renewal','Unyellowing'];
const ADDON_SERVICES = ['Deep Cleaning','Sole Whitening','Deodorizing','Repainting','Sole Replacement'];
const PRIORITIES = ['regular','rush','premium'];
const MATERIALS = ['Leather','Suede','Canvas','Mesh','Knit','Synthetic','Nubuck','Rubber','Other'];
const BRANCHES = ['Villamor'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return iso; }
}

function fmtPeso(n?: number) {
  return `₱${(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function syncBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    synced: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
  };
  const iconMap: Record<string, string> = {
    pending: '🟡 Pending',
    synced: '🟢 Synced',
    failed: '🔴 Failed',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${map[s] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {iconMap[s] || s}
    </span>
  );
}

// ─── Empty shoe factory ───────────────────────────────────────────────────────

function emptyShoe(): ShoeItem {
  return { brand:'', model:'', color:'', size:'', material:'', priority:'regular', remarks:'', services:[] };
}

// ─── Auto Order ID ────────────────────────────────────────────────────────────

function buildOrderId(seq: number) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `ORD-${y}-${m}-${day}-${String(seq).padStart(3,'0')}`;
}

// ─── FORM DIALOG ─────────────────────────────────────────────────────────────

function HistoricalOrderForm({
  token, existingRecord, onClose, onSaved, recordCount
}: {
  token: string;
  existingRecord?: HistoricalRecord | null;
  onClose: () => void;
  onSaved: () => void;
  recordCount: number;
}) {
  const isEdit = !!existingRecord;

  const [orderId, setOrderId] = useState(existingRecord?.order_id ?? buildOrderId(recordCount + 1));
  const [customerName, setCustomerName] = useState(existingRecord?.customer_name ?? '');
  const [contactNumber, setContactNumber] = useState(existingRecord?.contact_number ?? '');
  const [branch, setBranch] = useState(existingRecord?.branch ?? 'Villamor');
  const [dateReceived, setDateReceived] = useState(existingRecord?.date_received?.slice(0,10) ?? '');
  const [expectedRelease, setExpectedRelease] = useState(existingRecord?.expected_release_date?.slice(0,10) ?? '');
  const [claimedDate, setClaimedDate] = useState(existingRecord?.claimed_date?.slice(0,10) ?? '');
  const [grandTotal, setGrandTotal] = useState(String(existingRecord?.grand_total ?? ''));
  const [downpayment, setDownpayment] = useState(String(existingRecord?.downpayment ?? '0'));
  const [priority, setPriority] = useState(existingRecord?.priority ?? 'regular');
  const [shoes, setShoes] = useState<ShoeItem[]>(existingRecord?.items?.length ? existingRecord.items as ShoeItem[] : [emptyShoe()]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const completionDays = useMemo(() => {
    if (!dateReceived || !claimedDate) return null;
    const diff = (new Date(claimedDate).getTime() - new Date(dateReceived).getTime()) / 86400000;
    return Math.round(diff);
  }, [dateReceived, claimedDate]);

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
      const has = s.services.some(sv => sv.service_name === svcName);
      const services = has
        ? s.services.filter(sv => sv.service_name !== svcName)
        : [...s.services, { service_name: svcName, service_type: type, price: 0 }];
      return { ...s, services };
    }));
  }

  function validate(): boolean {
    const errs: string[] = [];
    if (!orderId.trim()) errs.push('Order ID is required.');
    if (!customerName.trim()) errs.push('Customer Name is required.');
    if (!dateReceived) errs.push('Date Received is required.');
    if (!expectedRelease) errs.push('Expected Release Date is required.');
    if (expectedRelease && dateReceived && expectedRelease < dateReceived)
      errs.push('Expected Release Date cannot be earlier than Date Received.');
    if (claimedDate && claimedDate < dateReceived)
      errs.push('Claimed Date cannot be earlier than Date Received.');
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
        expected_release_date: expectedRelease,
        claimed_date: claimedDate || null,
        grand_total: parseFloat(grandTotal) || 0,
        downpayment: parseFloat(downpayment) || 0,
        priority,
        total_pairs: totalPairs,
        items: shoes.map(s => ({
          brand: s.brand, model: s.model, color: s.color,
          size: s.size, material: s.material, priority: s.priority,
          remarks: s.remarks, services: s.services,
        })),
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
        throw new Error(err.detail || 'Save failed.');
      }
      toast.success(isEdit ? 'Historical record updated.' : 'Historical record saved.');
      onSaved();
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
                <label className="text-[10px] font-bold uppercase text-gray-500">Customer Name *</label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder="Full name" className="h-9 text-xs" />
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
                <Input type="date" value={claimedDate} onChange={e => setClaimedDate(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Completion Days</label>
                <div className="h-9 flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 text-xs font-bold text-gray-600">
                  {completionDays !== null ? `${completionDays} days` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Priority */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Priority Level</h3>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${priority === p
                    ? p === 'rush' ? 'bg-red-600 text-white border-red-600'
                      : p === 'premium' ? 'bg-amber-500 text-white border-amber-500'
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
                      <Select value={shoe.material} onValueChange={v => updateShoe(i,'material',v)}>
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
                        const active = shoe.services.some(s => s.service_name === svc);
                        return (
                          <button key={svc} onClick={() => toggleService(i, svc, 'base')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border transition-all ${active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200 hover:border-red-300'}`}>
                            {svc}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1.5">Add-ons</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ADDON_SERVICES.map(svc => {
                        const active = shoe.services.some(s => s.service_name === svc);
                        return (
                          <button key={svc} onClick={() => toggleService(i, svc, 'addon')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                            {svc}
                          </button>
                        );
                      })}
                    </div>
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
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest px-6">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Check className="h-4 w-4 mr-2" />Save Record</>}
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
  const [records, setRecords] = useState<HistoricalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSync, setFilterSync] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewRecord, setViewRecord] = useState<HistoricalRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoricalRecord | null>(null);
  const limit = 10;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
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

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between w-full gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <Button onClick={() => window.location.href = '/job-order-form'}
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
          <Button onClick={() => { setEditRecord(null); setShowForm(true); }}
            className="bg-red-600 hover:bg-red-700 text-white h-9 px-4 rounded-xl font-black uppercase text-[11px] tracking-widest flex items-center gap-1.5 shadow-md shrink-0">
            <Plus className="h-4 w-4" /><span className="hidden sm:inline">New Historical Record</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-red-50">
              {['Order ID','Customer','Received','Expected Release','Claimed','Days','Branch','Grand Total','Sync','Status','Actions'].map(h => (
                <th key={h} className="px-3 py-3 text-[10px] font-black uppercase text-gray-500 text-center">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={11} className="py-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-red-500 mx-auto" />
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={11} className="py-20 text-center">
                <Archive className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No historical records found</p>
              </td></tr>
            ) : records.map(r => (
              <tr key={r.historical_order_id} className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setViewRecord(r)}>
                <td className="px-3 py-3 text-xs font-bold text-red-700 text-center font-mono">{r.order_id}</td>
                <td className="px-3 py-3 text-xs text-center">{r.customer_name}</td>
                <td className="px-3 py-3 text-xs text-center">{fmtDate(r.date_received)}</td>
                <td className="px-3 py-3 text-xs text-center">{fmtDate(r.expected_release_date)}</td>
                <td className="px-3 py-3 text-xs text-center">{fmtDate(r.claimed_date)}</td>
                <td className="px-3 py-3 text-xs text-center font-bold">{r.completion_days ?? '—'}</td>
                <td className="px-3 py-3 text-xs text-center">{r.branch || '—'}</td>
                <td className="px-3 py-3 text-xs text-center font-bold">{fmtPeso(r.grand_total)}</td>
                <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                  {syncBadge(r.sync_status)}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">Completed</span>
                </td>
                <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-0.5 h-7 px-1.5 text-xs border border-red-600 text-red-600 rounded bg-red-50 hover:bg-red-100 transition-colors">
                        <MoreVertical className="h-3.5 w-3.5" /><ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 p-1.5 space-y-0.5">
                      <DropdownMenuItem onClick={() => setViewRecord(r)}
                        className="text-xs font-bold flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-700">
                        <Eye className="h-3.5 w-3.5" />View Details
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
            ))}
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
        <HistoricalOrderForm token={user.token} existingRecord={editRecord}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
          onSaved={fetchRecords} recordCount={total} />
      )}

      {/* View Dialog */}
      {viewRecord && (
        <Dialog open onOpenChange={() => setViewRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
                <Archive className="h-4 w-4 text-red-600" />{viewRecord.order_id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Customer', viewRecord.customer_name],
                  ['Contact', viewRecord.contact_number || '—'],
                  ['Branch', viewRecord.branch || '—'],
                  ['Priority', viewRecord.priority],
                  ['Date Received', fmtDate(viewRecord.date_received)],
                  ['Expected Release', fmtDate(viewRecord.expected_release_date)],
                  ['Claimed Date', fmtDate(viewRecord.claimed_date)],
                  ['Completion Days', viewRecord.completion_days !== null ? `${viewRecord.completion_days} days` : '—'],
                  ['Grand Total', fmtPeso(viewRecord.grand_total)],
                  ['Downpayment', fmtPeso(viewRecord.downpayment)],
                  ['Balance', fmtPeso(viewRecord.balance)],
                  ['Sync Status', viewRecord.sync_status],
                ].map(([k,v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[9px] font-black uppercase text-gray-400">{k}</p>
                    <p className="font-bold text-gray-800 capitalize">{v}</p>
                  </div>
                ))}
              </div>
              {viewRecord.items.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Shoe Details</p>
                  {viewRecord.items.map((item, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 mb-2 bg-gray-50">
                      <p className="text-xs font-black text-gray-700 mb-1">Shoe {i+1}: {item.brand} {item.model}</p>
                      <p className="text-[10px] text-gray-500">Color: {item.color} · Size: {item.size} · Material: {item.material}</p>
                      {item.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.services.map(s => (
                            <span key={s.service_name} className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-50 text-red-700 border border-red-100">
                              {s.service_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
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
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs">
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
    { label: 'Most Requested Service', value: ov.most_requested_service ?? 'N/A', icon: Star, color: 'from-indigo-50 to-indigo-100', text: 'text-indigo-700', iconColor: 'text-indigo-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={() => window.location.href = '/job-order-form'}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Model</p>
                <p className="text-sm font-bold text-gray-800">Random Forest</p>
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
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Prediction Accuracy</p>
                <p className="text-sm font-black text-emerald-600">
                  {modelInfo.r2_score ? `${(modelInfo.r2_score * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
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
                <Pie data={data?.service_distribution ?? []} dataKey="count" nameKey="service" outerRadius={80} label={({ service }) => service}>
                  {(data?.service_distribution ?? []).map((_:any, i:number) => (
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
              <tbody>{(data?.service_distribution ?? []).map((s:any) => (
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
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPredict, setShowPredict] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [infoRes, predsRes] = await Promise.all([
        fetch(`${API_BASE}/historical/model-info`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${API_BASE}/historical/predictions`, { headers: { Authorization: `Bearer ${user.token}` } }),
      ]);
      if (infoRes.ok) setModelInfo(await infoRes.json());
      if (predsRes.ok) setPredictions(await predsRes.json());
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

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between w-full gap-2">
        <Button onClick={() => window.location.href = '/job-order-form'}
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
              <span className="text-gray-500 font-medium">Dataset Size</span>
              <span className="font-black text-blue-700">{info.records_available ?? 0} Records</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Features</span>
              <span className="font-black text-gray-700">12</span>
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
                    <p className="text-[10px] text-gray-500">{info.records_available ?? 0} Records · Last Export: {new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
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
              <span className="font-black text-gray-700">Random Forest Regressor</span>
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
              'Grand Total','Day of Week Received','Month Received'].map(f => (
              <span key={f} className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-md text-[10px] font-bold uppercase">
                {f}
              </span>
            ))}
          </div>
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

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type Tab = 'records' | 'analytics' | 'ml';

export default function HistoricalRecords({ user, onSetHeaderActionRight }: HistoricalRecordsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('records');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<HistoricalRecord | null>(null);
  const isOwner = user.role === 'owner';

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(null);
    }
    return () => { if (onSetHeaderActionRight) onSetHeaderActionRight(null); };
  }, [onSetHeaderActionRight]);

  const tabs: { key: Tab; label: string; icon: React.ElementType; ownerOnly?: boolean }[] = [
    { key: 'records',   label: 'Records',          icon: Archive },
    { key: 'analytics', label: 'Analytics',        icon: BarChart2, ownerOnly: true },
    { key: 'ml',        label: 'Machine Learning', icon: Cpu, ownerOnly: true },
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

        {/* Tab navigation */}
        <div className="flex justify-center gap-4 border-b border-gray-200 pb-0">
          {tabs.filter(t => !t.ownerOnly || isOwner).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center justify-center gap-2 px-8 py-3 w-48 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${
                activeTab === t.key
                  ? 'text-red-700 border-red-600 bg-red-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'records'   && <RecordsTab user={user} showForm={showForm} setShowForm={setShowForm} editRecord={editRecord} setEditRecord={setEditRecord} />}
          {activeTab === 'analytics' && isOwner && <AnalyticsTab user={user} />}
          {activeTab === 'ml'        && isOwner && <MachineLearningTab user={user} />}
        </div>
      </div>
    </div>
  );
}

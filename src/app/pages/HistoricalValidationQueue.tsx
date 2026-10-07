import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, IconButton, 
  Divider, TextField, Card, CircularProgress, Alert, MenuItem, InputAdornment, Chip, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { CheckCircle, Cancel, Edit, ArrowBack, ArrowForward, Refresh, Add, DeleteOutline, Clear as ClearIcon, WarningAmber, InfoOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
// P1-10 FIX: this previously hardcoded `http://localhost:8000/api` unconditionally, which
// would fail outright in production (this component is reachable by the admin-only
// Historical Records module on the live Heroku deployment). Centralized (see
// src/app/lib/apiBase.ts) so this correctly targets same-origin `/api` in production.
import { API_BASE } from '@/app/lib/apiBase';
import { calculateOfficialReleaseBreakdown } from '@/app/lib/businessRules';
const API_BASE_URL = API_BASE;
const OCR_REVIEW_POSITION_KEY = 'shoelotskey.ocrReview.currentImageId';

const DEFAULT_BRANDS = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Converse', 'Vans', 'Puma', 'Hoka', 'Crocs', 'On Running', 'Asics', 'Under Armour', 'Sperry', 'Timberland'];
const DEFAULT_MODELS = ['Air Force 1', 'Dunk Low', 'Air Jordan 1', 'Ultraboost', 'Stan Smith', 'Superstar', 'Ebernon', 'Trekking', 'Classic Clog', 'Clifton', 'Bondi', 'Chuck Taylor', 'Old Skool'];
const DEFAULT_MATERIALS = ['Leather', 'Suede', 'Canvas', 'Mesh', 'Nubuck', 'Nylon', 'Patent Leather', 'Knit', 'Rubber', 'Foam', 'Synthetic'];
const DEFAULT_COLORS = ['White', 'Black', 'Red', 'Blue', 'Green', 'Grey', 'Brown', 'Yellow', 'Orange', 'Pink', 'Purple', 'Multi', 'Tan', 'Beige', 'Navy'];
const DEFAULT_SIZES = ['US 6', 'US 6.5', 'US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9', 'US 9.5', 'US 10', 'US 10.5', 'US 11', 'US 11.5', 'US 12', 'UK 6', 'UK 6.5', 'UK 7', 'UK 7.5', 'UK 8', 'UK 8.5', 'UK 9', 'UK 9.5', 'UK 10', 'EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44', 'EU 45'];

export const BASE_SERVICE_OPTIONS = ['Basic Cleaning', 'Full Reglue', 'Minor Reglue', 'Color Renewal'];
export const ADDON_SERVICE_OPTIONS = ['White Paint', 'Unyellowing', 'Minor Restoration', 'Minor Retouch', 'Full Reglue Midsole', 'Full Reglue Undersole', '2 Color', '3 Color'];
export const DEFAULT_CONDITIONS = ['scratches', 'yellowing', 'sole separation', 'deep stains', 'rips/holes', 'worn out', 'creasing', 'heel drag'];

function getRememberedOptions(category: string, defaults: string[]): string[] {
  const key = `shoelotskey_custom_${category}`;
  try {
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const combined = [...defaults];
    for (const item of list) {
      if (item && !combined.some(c => c.toLowerCase() === item.toLowerCase())) {
        combined.push(item);
      }
    }
    return combined;
  } catch {
    return defaults;
  }
}

function rememberCustomOption(category: string, value: string) {
  if (!value || typeof value !== 'string') return;
  const val = value.trim();
  if (!val || val === '—' || val === '-') return;
  const key = `shoelotskey_custom_${category}`;
  try {
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.some(item => item.toLowerCase() === val.toLowerCase())) {
      list.push(val);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {}
}

function cleanRemarks(val?: string | null): string {
  if (!val) return '';
  const s = String(val).trim();
  if (/ocr produced no items/i.test(s)) return '';
  return s;
}

function normalizeHistoricalOrderId(rawId?: string | null, dateReceived?: string | null, controlNo?: string | null): string {
  const inferYear = (monthStr: string | number): string => {
    const m = parseInt(String(monthStr), 10);
    return m === 1 ? '2026' : '2025';
  };

  const idText = String(rawId || '').trim();
  const ctrlText = String(controlNo || '').trim();

  // If already standard full canonical: ORD-YYYY-MM-DD-NNN or ORD-YYYY-MM-NN
  if (/^ORD-\d{4}-\d{2}(-\d{2})?-\d{2,4}$/i.test(idText)) {
    return idText.toUpperCase();
  }
  if (/^ORD-\d{4}-\d{2}-\d{2,4}$/i.test(idText)) {
    return idText.toUpperCase();
  }

  // Check if control number or rawId has mm dd nn or mm-dd-nn or mm.dd.nn (e.g. "08 26 04" or "08-26-04")
  const mdnMatch = ctrlText.match(/^(\d{1,2})[\s\-_/.]+(\d{1,2})[\s\-_/.]+(\d{1,4})$/)
    || idText.match(/^(\d{1,2})[\s\-_/.]+(\d{1,2})[\s\-_/.]+(\d{1,4})$/);
  if (mdnMatch) {
    const mm = mdnMatch[1].padStart(2, '0');
    const dd = mdnMatch[2].padStart(2, '0');
    const nn = mdnMatch[3].padStart(3, '0');
    const yyyy = inferYear(mm);
    return `ORD-${yyyy}-${mm}-${dd}-${nn}`;
  }

  // Check if 6 digits like 082604 or 682603
  const digits = (ctrlText || idText).replace(/\D/g, '');
  if (digits.length === 6) {
    let mm = digits.substring(0, 2);
    if (parseInt(mm, 10) > 12 && mm.startsWith('6')) {
      mm = '0' + mm[1];
    }
    const dd = digits.substring(2, 4);
    const nn = digits.substring(4, 6).padStart(3, '0');
    const yyyy = inferYear(mm);
    return `ORD-${yyyy}-${mm}-${dd}-${nn}`;
  }

  // Check if mm-nn (e.g. 08-04)
  const mnMatch = ctrlText.match(/^(\d{1,2})[\s\-_/.]+(\d{1,4})$/)
    || idText.match(/^(\d{1,2})[\s\-_/.]+(\d{1,4})$/);
  if (mnMatch) {
    const mm = mnMatch[1].padStart(2, '0');
    const nn = mnMatch[2].padStart(2, '0');
    const yyyy = inferYear(mm);
    return `ORD-${yyyy}-${mm}-${nn}`;
  }

  // If dateReceived has date
  const rec = datePartOf(dateReceived);
  if (rec) {
    const parts = rec.split('-');
    if (parts.length === 3) {
      let [yyyy, mm, dd] = parts;
      if (!yyyy || yyyy.length < 4) {
        yyyy = inferYear(mm);
      }
      const seqMatch = (ctrlText || idText).match(/\d+/);
      const nn = seqMatch ? seqMatch[0].padStart(3, '0') : '001';
      return `ORD-${yyyy}-${mm}-${dd}-${nn}`;
    }
  }

  return idText;
}

function recalculateBusinessRulesExpectedDate(draft: any, force = false): any {
  if (!draft) return draft;
  const shoes = (draft.items || []).map((it: any) => ({
    baseService: it.base_services,
    addOns: it.addon_services,
    priorityLevel: it.priority || draft.priority || 'regular'
  }));
  const priority = String(draft.priority || 'regular').toLowerCase();
  const breakdown = calculateOfficialReleaseBreakdown(shoes, priority);
  const totalDays = breakdown?.totalDays || 10;
  draft.completion_days = totalDays;

  // Incomplete orders must allow expected release date to remain empty.
  // Do not generate a synthetic date if the field is blank unless explicitly forced.
  const hasExpectedDate = draft.expected_release_date !== '' && draft.expected_release_date !== null && draft.expected_release_date !== undefined;
  if (!force && !hasExpectedDate) {
    draft.expected_release_date = '';
    draft.original_estimated_release_date = '';
    return draft;
  }

  const rec = datePartOf(draft.date_received);
  if (rec) {
    const d = new Date(`${rec}T12:00:00`);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + totalDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      draft.expected_release_date = `${y}-${m}-${day}`;
      draft.original_estimated_release_date = draft.expected_release_date;
    }
  }
  return draft;
}

function rememberOcrPosition(imageId: number | null | undefined) {
  try {
    if (imageId == null) sessionStorage.removeItem(OCR_REVIEW_POSITION_KEY);
    else sessionStorage.setItem(OCR_REVIEW_POSITION_KEY, String(imageId));
  } catch {
    // ignore storage failures
  }
}

function recalledOcrPosition(): number | null {
  try {
    const raw = sessionStorage.getItem(OCR_REVIEW_POSITION_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/** ISO YYYY-MM-DD → MM/DD/YYYY for display / text entry (native date inputs follow browser locale). */
function isoToMmDdYyyy(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return iso;
}



/** ISO / datetime string → YYYY-MM-DD for native date inputs. */
function datePartOf(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  return String(val).split('T')[0].split(' ')[0];
}

/** Datetime string → HH:MM for native time inputs. */
function timePartOf(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  const text = String(val).trim();
  if (text.includes('T')) return (text.split('T')[1] || '').substring(0, 5);
  if (text.includes(' ')) return (text.split(' ')[1] || '').substring(0, 5);
  return '';
}

/** Combine YYYY-MM-DD + optional HH:MM without breaking the date input. */
function combineDateAndTime(datePart: string, timePart: string): string {
  const d = datePartOf(datePart);
  const t = (timePart || '').trim().substring(0, 5);
  if (!d) return '';
  return t ? `${d} ${t}` : d;
}

interface HistoricalValidationQueueProps {
  user: { username: string; role: 'owner' | 'staff' | 'admin' | 'front staff'; token: string };
  onBack?: () => void;
}

export default function HistoricalValidationQueue({ user, onBack }: HistoricalValidationQueueProps) {
  const [queue, setQueue] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showCsvSource, setShowCsvSource] = useState(true);

  const [activeFilter, setActiveFilter] = useState<string>('potential_ml');
  const [filterCounts, setFilterCounts] = useState<{
    all_pending: number;
    potential_ml: number;
    historical_only: number;
    needs_human_review: number;
    order_id_collision: number;
    legacy_reference_match: number;
    validated: number;
    corrected: number;
    rejected: number;
    confirmed_ml_eligible: number;
    unresolved_collisions: number;
  }>({
    all_pending: 714,
    potential_ml: 120,
    historical_only: 591,
    needs_human_review: 3,
    order_id_collision: 6,
    legacy_reference_match: 61,
    validated: 0,
    corrected: 0,
    rejected: 0,
    confirmed_ml_eligible: 0,
    unresolved_collisions: 6,
  });

  const [rejectionCategory, setRejectionCategory] = useState<string>('confirmed duplicate');
  const [rejectReason, setRejectReason] = useState<string>('Confirmed duplicate');

  const [brandOptions, setBrandOptions] = useState(() => getRememberedOptions('brands', DEFAULT_BRANDS));
  const [modelOptions, setModelOptions] = useState(() => getRememberedOptions('models', DEFAULT_MODELS));
  const [materialOptions, setMaterialOptions] = useState(() => getRememberedOptions('materials', DEFAULT_MATERIALS));
  const [colorOptions, setColorOptions] = useState(() => getRememberedOptions('colors', DEFAULT_COLORS));
  const [sizeOptions, setSizeOptions] = useState(() => getRememberedOptions('sizes', DEFAULT_SIZES));
  
  const navigate = useNavigate();

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user.token}`,
  });

  const refreshCountsOnly = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/historical/processing/queue?limit=1&source_filter=${encodeURIComponent(activeFilter)}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const p = await res.json();
        if (p?.counts) {
          setFilterCounts(p.counts);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchQueue = async (opts?: { keepPosition?: boolean; filter?: string }) => {
    const keepPosition = opts?.keepPosition !== false;
    const filterToUse = opts?.filter !== undefined ? opts.filter : activeFilter;
    const previousId = keepPosition
      ? (queue[currentIndex]?.historical_image_id ?? recalledOcrPosition())
      : null;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/historical/processing/queue?limit=800&source_filter=${encodeURIComponent(filterToUse)}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(`Queue request failed (${response.status})`);
      const payload = await response.json();
      // Support both new { items, total } and legacy bare-array responses.
      const data = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items) ? payload.items : null);
      if (!data) throw new Error('Queue response was not a list');
      const serverTotal = Array.isArray(payload)
        ? data.length
        : Number(payload?.total);
      setQueue(data);
      if (payload?.counts) {
        setFilterCounts(payload.counts);
      }
      setEditMode(false);
      const restoredIdx = previousId != null
        ? data.findIndex((item: any) => item?.historical_image_id === previousId)
        : -1;
      const nextIdx = restoredIdx >= 0 ? restoredIdx : 0;
      setCurrentIndex(data.length === 0 ? 0 : Math.min(nextIdx, data.length - 1));
      if (data[nextIdx]?.historical_image_id != null) {
        rememberOcrPosition(data[nextIdx].historical_image_id);
      }
      const totalPending = Number.isFinite(serverTotal) && serverTotal >= 0
        ? Math.max(serverTotal, data.length)
        : data.length;
      setPendingTotal(totalPending);
    } catch (error) {
      console.error("Failed to fetch queue", error);
      setQueue([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter: string) => {
    if (newFilter === activeFilter) return;
    setActiveFilter(newFilter);
    setCurrentIndex(0);
    rememberOcrPosition(null);
    void fetchQueue({ keepPosition: false, filter: newFilter });
  };

  useEffect(() => {
    // Always open at POTENTIAL ML filter first as prioritized by requirements.
    rememberOcrPosition(null);
    void fetchQueue({ keepPosition: false, filter: 'potential_ml' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = queue[currentIndex]?.historical_image_id;
    if (id != null) rememberOcrPosition(id);
  }, [queue, currentIndex]);

  const goToQueueIndex = (nextIdx: number) => {
    if (queue.length === 0) return;
    const clamped = Math.max(0, Math.min(nextIdx, queue.length - 1));
    if (clamped === currentIndex) return;
    setEditMode(false);
    setEditedData(null);
    setCurrentIndex(clamped);
    rememberOcrPosition(queue[clamped]?.historical_image_id);
  };


  const displayIsoDate = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    return String(val).split('T')[0];
  };

  const displayMmDdYyyy = (val: any) => {
    const iso = displayIsoDate(val);
    return iso ? isoToMmDdYyyy(iso) : '';
  };

  const displayReceivedDateTime = (val: any) => {
    if (val === undefined || val === null || val === '') return '—';
    const text = String(val).trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!match) return displayMmDdYyyy(val) || '—';
    const datePart = isoToMmDdYyyy(match[1]);
    if (!match[2] || (match[2] === '00' && match[3] === '00')) return datePart;
    return `${datePart} ${match[2]}:${match[3]}`;
  };

  const parseRowPriceInput = (raw: any): number | '' => {
    const text = String(raw ?? '').replace(/[₱,]/g, '').trim();
    if (!text) return '';
    if (text.toLowerCase() === 'free') return 0;
    const chunks = text.split('+').map((part) => part.replace(/=/g, '').trim()).filter(Boolean);
    const numbers = chunks.map((part) => parseFloat(part)).filter((n) => Number.isFinite(n));
    if (!numbers.length) return '';
    const total = numbers.reduce((sum, n) => sum + n, 0);
    return Math.round(total * 100) / 100;
  };

  const REVIEW_CATALOG: Record<string, number> = {
    BC: 325, 'BASIC CLEANING': 325,
    MR: 125, 'MINOR REGLUE': 125,
    FR: 250, 'FULL REGLUE': 250,
    CR: 325, COR: 325, 'COLOR RENEWAL': 325,
    WPT: 150, 'WHITE PAINT': 150,
    MRET: 125, 'MINOR RETOUCH': 125,
    MRES: 225, 'MINOR RESTORATION': 225,
    UNY: 125, UY: 125, UNYELLOWING: 125,
    '2CR': 200, '2CL': 200, '2 COLORS': 200, COR2: 200, '2 COLOR': 200,
    '3CR': 300, '3CL': 300, '3 COLORS': 300, COR3: 300, '3 COLOR': 300,
    UFR: 150, 'UNDERSOLE FULL REGLUE': 150, FRUND: 150, 'FULL REGLUE UNDERSOLE': 150,
    MFR: 150, 'MIDSOLE FULL REGLUE': 150, FRMID: 150, 'FULL REGLUE MIDSOLE': 150,
  };

  const serviceCodeLabel = (name: string) => {
    const compact = String(name || '').replace(/[\s\-]+/g, '').toUpperCase();
    const names: Record<string, string> = {
      BASICCLEANING: 'BC',
      MINORREGLUE: 'MR',
      FULLREGLUE: 'FR',
      COLORRENEWAL: 'COR',
      WHITEPAINT: 'WPT',
      MINORRETOUCH: 'MRET',
      MINORRESTORATION: 'MRES',
      UNYELLOWING: 'UNY',
      TWOCOLORS: 'COR2',
      '2COLORS': 'COR2',
      '2COLOR': 'COR2',
      '2CL': 'COR2',
      '2CR': 'COR2',
      COR2: 'COR2',
      THREECOLORS: 'COR3',
      '3COLORS': 'COR3',
      '3COLOR': 'COR3',
      '3CL': 'COR3',
      '3CR': 'COR3',
      COR3: 'COR3',
      UNDERSOLEFULLREGLUE: 'FRUND',
      FULLREGLUEUNDERSOLE: 'FRUND',
      FRUND: 'FRUND',
      UFR: 'FRUND',
      MIDSOLEFULLREGLUE: 'FRMID',
      FULLREGLUEMIDSOLE: 'FRMID',
      FRMID: 'FRMID',
      MFR: 'FRMID',
      UY: 'UNY',
      COR: 'COR',
      CR: 'COR',
      WPT: 'WPT',
    };
    if (compact === 'UY') return 'UNY';
    return names[compact] || compact;
  };

  const BASE_SERVICE_LABELS: Record<string, string> = {
    BC: 'Basic Cleaning',
    MR: 'Minor Reglue',
    FR: 'Full Reglue',
    COR: 'Color Renewal',
    CR: 'Color Renewal',
  };
  const ADDON_SERVICE_LABELS: Record<string, string> = {
    WPT: 'White Paint',
    UNY: 'Unyellowing',
    UY: 'Unyellowing',
    MRES: 'Minor Restoration',
    MRET: 'Minor Retouch',
    COR2: '2 Color',
    '2CR': '2 Color',
    COR3: '3 Color',
    '3CR': '3 Color',
    FRUND: 'Full Reglue Undersole',
    UFR: 'Full Reglue Undersole',
    FRMID: 'Full Reglue Midsole',
    MFR: 'Full Reglue Midsole',
  };

  const isAddonService = (name: string) => {
    const code = serviceCodeLabel(name);
    return Boolean(ADDON_SERVICE_LABELS[code]);
  };

  const serviceFullName = (name: string) => {
    const code = serviceCodeLabel(name);
    return BASE_SERVICE_LABELS[code] || ADDON_SERVICE_LABELS[code] || String(name || '').trim();
  };

  const parseServicesInput = (input: unknown): string[] => {
    if (Array.isArray(input)) {
      return Array.from(
        new Set(
          input
            .flatMap((item) => parseServicesInput(item))
            .filter(Boolean)
        )
      );
    }
    if (typeof input !== 'string') return [];
    const parts = input.split(/[,+/|\n]+/).map((s) => s.trim()).filter(Boolean);
    const normalized = parts.map((p) => serviceFullName(p) || p);
    return Array.from(new Set(normalized));
  };

  const parseConditionsInput = (input: unknown): string[] => {
    if (Array.isArray(input)) {
      return Array.from(
        new Set(
          input
            .flatMap((item) => parseConditionsInput(item))
            .filter(Boolean)
        )
      );
    }
    if (typeof input !== 'string') return [];
    const parts = input.split(/[,+|\n]+/).map((s) => s.trim()).filter(Boolean);
    return Array.from(new Set(parts));
  };

  const catalogGroupedServices = (item: any) => {
    const all = [
      ...(Array.isArray(item?.base_services) ? item.base_services : []),
      ...(Array.isArray(item?.addon_services) ? item.addon_services : []),
    ].map((name: any) => String(name || '').trim()).filter(Boolean);
    const base: string[] = [];
    const addon: string[] = [];
    all.forEach((name) => {
      if (isAddonService(name)) addon.push(name);
      else base.push(name);
    });
    return { base, addon };
  };

  const resolveCatalogPrice = (name: string): number | null => {
    const raw = String(name || '').trim();
    if (!raw) return null;
    return REVIEW_CATALOG[raw.toUpperCase()] ?? REVIEW_CATALOG[serviceCodeLabel(raw)] ?? null;
  };

  const parsePriceAddends = (raw: any): number[] => {
    const text = String(raw ?? '').replace(/[₱,]/g, '');
    if (!text.includes('+')) return [];
    return text
      .split('+')
      .map((part) => parseFloat(part.replace(/=/g, '').trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  };

  const formatBreakdownAmount = (value: number) => (
    Math.abs(value - Math.round(value)) < 0.001 ? String(Math.round(value)) : value.toFixed(2)
  );

  const itemServiceNames = (item: any): string[] => {
    const grouped = catalogGroupedServices(item);
    return [...grouped.base, ...grouped.addon];
  };

  const listGroupServices = (item: any, group: 'base' | 'addon'): string[] => {
    return catalogGroupedServices(item)[group];
  };

  const parseOptionalMoney = (raw: any): number | '' => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return '';
    return parseRowPriceInput(raw);
  };

  const storedServicePrice = (item: any, name: string): number | '' => {
    const mapped = item?.service_prices?.[name];
    if (mapped != null && Number(mapped) > 0) return Number(mapped);
    const match = (Array.isArray(item?.services) ? item.services : []).find((svc: any) =>
      String(svc.service_name || '').trim() === name && Number(svc.price) > 0
    );
    if (match) return Number(match.price);
    const catalog = resolveCatalogPrice(name);
    return catalog != null && Number(catalog) > 0 ? Number(catalog) : '';
  };

  const explicitGroupPrice = (item: any, group: 'base' | 'addon'): number | '' => {
    const key = group === 'base' ? 'base_service_price' : 'addon_service_price';
    if (item?.[key] !== undefined && item?.[key] !== null && String(item[key]).trim() !== '') {
      return parseOptionalMoney(item[key]);
    }
    const amounts = listGroupServices(item, group)
      .map((name) => storedServicePrice(item, name))
      .filter((value): value is number => value !== '' && Number(value) > 0);
    if (!amounts.length) return '';
    return Math.round(amounts.reduce((sum, value) => sum + value, 0) * 100) / 100;
  };

  const allocateServicePrices = (item: any): Record<string, number> => {
    const prices: Record<string, number> = {};
    const existing = item?.service_prices || {};
    Object.entries(existing).forEach(([name, value]) => {
      const amount = Number(value);
      if (name && Number.isFinite(amount) && amount > 0) prices[name] = amount;
    });
    (['base', 'addon'] as const).forEach((group) => {
      const names = listGroupServices(item, group);
      const amount = explicitGroupPrice(item, group);
      if (amount !== '' && names.length) {
        if (names.length === 1) {
          prices[names[0]] = amount;
        } else {
          const currentSum = names.reduce((sum, n) => sum + (prices[n] || 0), 0);
          if (Math.abs(currentSum - amount) > 0.05) {
            const catalogVals = names.map(resolveCatalogPrice);
            const catalogSum = catalogVals.reduce<number>((sum, val) => sum + (val || 0), 0);
            if (catalogVals.every((val) => val != null) && Math.abs(catalogSum - amount) < 0.05) {
              names.forEach((name, idx) => { prices[name] = catalogVals[idx] as number; });
            } else {
              let remaining = amount;
              names.forEach((name, idx) => {
                if (idx === names.length - 1) {
                  prices[name] = Math.max(0, Math.round(remaining * 100) / 100);
                } else if (catalogVals[idx] != null && catalogVals[idx]! < remaining) {
                  prices[name] = catalogVals[idx] as number;
                  remaining = Math.round((remaining - (catalogVals[idx] as number)) * 100) / 100;
                } else {
                  const share = Math.round((amount / names.length) * 100) / 100;
                  prices[name] = share;
                  remaining = Math.round((remaining - share) * 100) / 100;
                }
              });
            }
          }
        }
      }
    });
    if (item?.prices_manual) return prices;

    const names = itemServiceNames(item);
    const parsedAddends = parsePriceAddends(item?.item_price);
    const storedAddends: number[] = Array.isArray(item?.price_addends)
      ? item.price_addends
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value))
      : [];
    const addends: number[] = parsedAddends.length ? parsedAddends : storedAddends;
    if (!addends.length) {
      const total = parseRowPriceInput(item?.item_price);
      if (typeof total === 'number' && names.length === 1) {
        prices[names[0]] = total;
      } else if (typeof total === 'number' && names.length >= 2) {
        const catalogVals = names.map(resolveCatalogPrice);
        const catalogSum = catalogVals.reduce<number>((sum, value) => sum + (value || 0), 0);
        if (catalogVals.every((value) => value != null) && Math.abs(catalogSum - total) < 0.05) {
          names.forEach((name, idx) => { prices[name] = catalogVals[idx] as number; });
        } else {
          let remaining = total;
          names.forEach((name, idx) => {
            if (idx === names.length - 1) {
              prices[name] = Math.round(remaining * 100) / 100;
            } else if (catalogVals[idx] != null) {
              prices[name] = catalogVals[idx] as number;
              remaining = Math.round((remaining - (catalogVals[idx] as number)) * 100) / 100;
            }
          });
        }
      }
      return prices;
    }

    const assigned: Array<number | null> = names.map((name) => prices[name] ?? null);
    const used = new Set<number>();
    names.forEach((name, idx) => {
      if (assigned[idx] != null) return;
      const catalogPrice = resolveCatalogPrice(name);
      if (catalogPrice == null) return;
      const match = addends.findIndex((amount, addendIdx) => !used.has(addendIdx) && Math.abs(amount - catalogPrice) <= 10);
      if (match >= 0) {
        assigned[idx] = catalogPrice;
        used.add(match);
      }
    });
    names.forEach((_, idx) => {
      if (assigned[idx] != null) return;
      const match = addends.findIndex((_, addendIdx) => !used.has(addendIdx));
      if (match >= 0) {
        assigned[idx] = addends[match];
        used.add(match);
      }
    });
    names.forEach((name, idx) => {
      if (assigned[idx] != null) prices[name] = assigned[idx] as number;
    });
    return prices;
  };

  const formatServicePriceBreakdown = (item: any): string | null => {
    const names = itemServiceNames(item);
    if (!names.length) return item?.price_breakdown || null;
    const prices = allocateServicePrices(item);
    const parts = names
      .filter((name) => prices[name] != null)
      .map((name) => `${serviceCodeLabel(name)}(${formatBreakdownAmount(prices[name])})`);
    return parts.length ? parts.join('+') : (item?.price_breakdown || null);
  };

  const formatServiceGroupBreakdown = (item: any, group: 'base' | 'addon'): string | null => {
    const cleaned = listGroupServices(item, group);
    if (!cleaned.length) return null;
    return cleaned.map((name: string) => `${serviceFullName(name)}(${serviceCodeLabel(name)})`).join(', ');
  };

  const DEFAULT_RUSH_FEE = 150;

  const isRushPriority = (order: any) => {
    return String(order?.priority || 'regular').toLowerCase() === 'rush';
  };

  const itemHasBasicCleaning = (item: any) => {
    return itemServiceNames(item).some((name) => {
      const code = serviceCodeLabel(name);
      return code === 'BC' || String(name).toLowerCase().includes('basic cleaning');
    });
  };

  const orderHasBasicCleaning = (order: any) => (
    (order?.items || []).some((item: any) => itemHasBasicCleaning(item))
  );

  /** Editable rush amount (forms use ₱100 or ₱150). One fee per job order. */
  const resolveRushFeeAmount = (order: any): number => {
    const raw = order?.rush_fee;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return DEFAULT_RUSH_FEE;
  };

  /** Single rush fee for the whole job order when priority is rush and any item has BC. */
  const orderRushFee = (order: any): number => (
    isRushPriority(order) && orderHasBasicCleaning(order) ? resolveRushFeeAmount(order) : 0
  );

  const sumPricedItems = (items: any[]) => (
    (items || []).reduce((acc: number, item: any) => {
      if (isExplicitlyFree(item)) return acc;
      const n = Number(item?.item_price);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0)
  );

  const orderGrandWithRush = (order: any, items?: any[]) => {
    const itemsSum = Math.round(sumPricedItems(items ?? order?.items) * 100) / 100;
    return Math.round((itemsSum + orderRushFee({ ...order, items: items ?? order?.items })) * 100) / 100;
  };

  /** Keep item prices as service/add-on only; one rush applies on the order total. */
  const applyRushPricingToOrder = (prev: any, nextPriority: string, nextRushFee?: number | string) => {
    const priority = String(nextPriority || 'regular').toLowerCase();
    const feeCandidate = nextRushFee !== undefined && nextRushFee !== null && String(nextRushFee).trim() !== ''
      ? Number(nextRushFee)
      : resolveRushFeeAmount({ ...prev, priority, rush_fee: nextRushFee ?? prev?.rush_fee });
    const fee = priority === 'rush' && Number.isFinite(feeCandidate) && feeCandidate >= 0
      ? feeCandidate
      : DEFAULT_RUSH_FEE;

    const items = (prev.items || []).map((item: any) => {
      if (isExplicitlyFree(item)) return item;
      const base = explicitGroupPrice(item, 'base');
      const addon = explicitGroupPrice(item, 'addon');
      if (base !== '' || addon !== '') {
        const item_price = Math.round((Number(base || 0) + Number(addon || 0)) * 100) / 100;
        return decorateItemPricing({ ...item, item_price, is_free: false });
      }
      return item;
    });

    const nextOrder = {
      ...prev,
      priority,
      rush_fee: fee,
      items,
    };
    const computed = orderGrandWithRush(nextOrder, items);
    const prevOriginal = Number(prev.original_grand_total);
    const prevDiscount = Number(prev.discount);
    const prevGrand = Number(prev.grand_total);
    const hasDiscount =
      (Number.isFinite(prevDiscount) && prevDiscount > 0)
      || (Number.isFinite(prevOriginal) && Number.isFinite(prevGrand) && prevOriginal > prevGrand + 0.009);

    let original_grand_total = prev.original_grand_total ?? null;
    let discount = prev.discount ?? null;
    let grand_total = computed;
    if (hasDiscount) {
      const disc = Number.isFinite(prevDiscount) && prevDiscount > 0
        ? prevDiscount
        : Math.round((prevOriginal - prevGrand) * 100) / 100;
      original_grand_total = computed;
      discount = disc;
      grand_total = Math.round(Math.max(0, computed - disc) * 100) / 100;
    }

    const down = Number(prev.downpayment);
    const downSafe = Number.isFinite(down) ? down : 0;
    return {
      ...nextOrder,
      original_grand_total,
      discount,
      grand_total,
      balance: Math.round((grand_total - downSafe) * 100) / 100,
    };
  };

  const decorateItemPricing = (item: any) => {
    const addends = parsePriceAddends(item?.item_price);
    const priced = {
      ...item,
      price_addends: addends.length ? addends : item?.price_addends,
    };
    const service_prices = allocateServicePrices(priced);
    const next = {
      ...priced,
      service_prices,
      price_breakdown: formatServicePriceBreakdown({ ...priced, service_prices }),
    };
    const baseNames = listGroupServices(next, 'base');
    const addonNames = listGroupServices(next, 'addon');
    if (!next.prices_manual && explicitGroupPrice(next, 'base') === '' && baseNames.length) {
      const baseSum = baseNames.reduce((sum, name) => sum + (Number(service_prices[name]) || 0), 0);
      if (baseSum > 0) next.base_service_price = Math.round(baseSum * 100) / 100;
    }
    if (!next.prices_manual && explicitGroupPrice(next, 'addon') === '' && addonNames.length) {
      const addonSum = addonNames.reduce((sum, name) => sum + (Number(service_prices[name]) || 0), 0);
      if (addonSum > 0) next.addon_service_price = Math.round(addonSum * 100) / 100;
    }
    return next;
  };

  const formatMoney = (val: any) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = Number(val);
    return isNaN(num) ? '—' : num.toFixed(2);
  };

  const displayPaymentMethod = (val: any) => {
    if (val === undefined || val === null || val === '') return 'Cash';
    return val;
  };

  const isExplicitlyFree = (item: any) => {
    if (String(item?.item_price ?? '').trim().toLowerCase() === 'free') return true;
    if (!item?.is_free) return false;
    const hasServices = Boolean(
      (Array.isArray(item?.base_services) && item.base_services.length)
      || (Array.isArray(item?.addon_services) && item.addon_services.length)
    );
    const remarksFree = String(item?.remarks || '').trim().toUpperCase().startsWith('FREE');
    // Empty placeholder rows should show blank/unknown, not FREE.
    return hasServices || remarksFree || Boolean(item?.brand);
  };

  const displayItemPrice = (item: any) => {
    if (isExplicitlyFree(item)) return 'FREE';
    const raw = item?.item_price;
    if (raw === '' || raw == null) return '—';
    const formatted = formatMoney(raw);
    return formatted === '—' ? '—' : `₱${formatted}`;
  };

  const formatTotalPriceLine = (item: any): string => {
    if (isExplicitlyFree(item)) return 'FREE';
    const raw = item?.item_price;
    if (raw === '' || raw == null) return '—';
    return formatServicePriceBreakdown(item) || displayItemPrice(item);
  };

  const editItemPriceValue = (item: any) => {
    if (isExplicitlyFree(item)) return 'FREE';
    if (item?.item_price === '' || item?.item_price == null) return '';
    return String(item.item_price);
  };

  const currentSnapshot = () => {
    const current = queue[currentIndex];
    const base = editMode ? editedData : current?.order;
    if (!base) return undefined;
    return {
      ...base,
      order_id: base.order_id,
      control_no: base.control_no == null ? '' : String(base.control_no),
      source_document_ref: current?.source_document_ref,
      expected_release_date: base.expected_release_date ? (datePartOf(base.expected_release_date) || null) : null,
      original_estimated_release_date: base.expected_release_date ? (datePartOf(base.expected_release_date) || null) : null,
      claimed_date: base.claimed_date ? (datePartOf(base.claimed_date) || null) : null,
      items: (base.items || []).map((item: any) => {
        const priced = decorateItemPricing(item);
        const rawPrice = item?.item_price;
        const priceText = String(rawPrice ?? '').trim().toLowerCase();
        const free = Boolean(item?.is_free) || priceText === 'free';
        const blank = !free && (rawPrice === '' || rawPrice == null);
        const parsedPrice = free
          ? 0
          : (blank ? null : parseRowPriceInput(rawPrice));
        return {
          ...priced,
          is_free: free,
          item_price: blank ? null : parsedPrice,
          claimed_date: item?.claimed_date ? datePartOf(item.claimed_date) || item.claimed_date : null,
          base_service_price: free ? 0 : (blank ? null : explicitGroupPrice(priced, 'base')),
          addon_service_price: free ? 0 : (blank ? null : explicitGroupPrice(priced, 'addon')),
          price_breakdown: free || blank ? null : priced.price_breakdown,
        };
      }),
    };
  };

  const handleAction = async (action: 'approve' | 'reject' | 'correct' | 'save', customReason?: string) => {
    if (queue.length === 0 || busy) return;
    const currentImg = queue[currentIndex];
    const stayInQueue = action === 'correct' || action === 'save';
    const isEditApproval = action === 'approve' && editMode;
    const hasCorrections = stayInQueue || isEditApproval;
    const snapshot = hasCorrections ? currentSnapshot() : undefined;

    setBusy(true);
    try {
      const endpoint = currentImg.historical_image_id
        ? `${API_BASE_URL}/historical/processing/validate/${currentImg.historical_image_id}`
        : `${API_BASE_URL}/historical/processing/validate-order/${currentImg.order.historical_order_id}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action,
          corrections: hasCorrections ? snapshot : undefined,
          reason: action === 'reject' ? (customReason || rejectReason || 'Manual rejection by researcher') : undefined,
          was_corrected: editMode,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const detailMsg = errJson?.detail || res.statusText || 'Server Error';
        throw new Error(`Validation failed (HTTP ${res.status}: ${detailMsg}). Record was not modified.`);
      }

      const data = await res.json().catch(() => ({}));

      if (stayInQueue) {
        setQueue((prev) => prev.map((item, i) => (
          i === currentIndex ? { ...item, order: { ...item.order, ...snapshot } } : item
        )));
        setEditMode(false);
        toast.success('Corrections saved. This record is still in the review queue.');
        return;
      }

      const remaining = queue.filter((_, i) => i !== currentIndex);
      setQueue(remaining);
      setEditMode(false);
      setPendingTotal((total) => {
        const base = total != null ? total : queue.length;
        return Math.max(0, base - 1);
      });

      if (action === 'approve') {
        if (data?.is_ml_eligible) {
          toast.success('Historical record validated successfully and added to the clean ML dataset.');
        } else if (data?.new_status === 'CORRECTED') {
          toast.success('Historical record corrected and validated successfully.');
        } else {
          toast.success('Historical record validated successfully.');
        }
      } else if (action === 'reject') {
        toast.success('Historical record rejected.');
      }

      if (remaining.length === 0) {
        rememberOcrPosition(null);
        await fetchQueue({ keepPosition: false });
      } else {
        const nextIdx = Math.min(currentIndex, remaining.length - 1);
        setCurrentIndex(nextIdx);
        rememberOcrPosition(remaining[nextIdx]?.historical_image_id);
        void refreshCountsOnly();
      }
    } catch (error: any) {
      console.error(`Failed to ${action} record`, error);
      toast.error(error?.message || 'Validation failed. Record was not modified.');
    } finally {
      setBusy(false);
    }
  };


  const roundMoney = (n: number) => Math.round(n * 100) / 100;

  const toFiniteMoney = (val: any): number | null => {
    if (val === '' || val === undefined || val === null) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  /** Pre-discount base: original if set, else final + discount, else final. */
  const resolveBaseTotal = (orderLike: any): number | null => {
    const orig = toFiniteMoney(orderLike?.original_grand_total);
    if (orig != null && orig > 0) return roundMoney(orig);
    const disc = toFiniteMoney(orderLike?.discount);
    const gt = toFiniteMoney(orderLike?.grand_total);
    if (gt != null && disc != null && disc > 0) return roundMoney(gt + disc);
    if (gt != null && gt > 0) return roundMoney(gt);
    if (orig != null && orig >= 0) return roundMoney(orig);
    return gt != null ? roundMoney(Math.max(0, gt)) : null;
  };

  const hasActiveDiscountInput = (orderLike: any) => {
    if (orderLike?.discount_enabled === false) return false;
    const raw = orderLike?.discount_value;
    if (raw === '' || raw == null) return false;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0;
  };

  /** Balance = max(0, discounted total − downpayment); downpayment cannot exceed total. */
  const syncBalanceFromGrand = (next: any) => {
    const grandRaw = toFiniteMoney(next.grand_total);
    if (grandRaw == null) return next;
    const grand = roundMoney(Math.max(0, grandRaw));
    if (typeof next.grand_total !== 'string') {
      next.grand_total = grand;
    }

    if (next.downpayment === '' || next.downpayment == null) {
      // No deposit entered — leave balance alone unless it went negative.
      const bal = toFiniteMoney(next.balance);
      if (bal != null && bal < 0) next.balance = 0;
      return next;
    }
    let down = toFiniteMoney(next.downpayment);
    if (down == null || down < 0) {
      return next;
    }
    down = roundMoney(down);
    if (down > grand) {
      down = grand;
      next.downpayment = down;
    }
    next.balance = roundMoney(Math.max(0, grand - down));
    return next;
  };

  /** Apply ₱ or % discount against original; discounted grand_total is the final payable. */
  const recomputeFromDiscount = (next: any, explicitBase?: number | null) => {
    const dtype = String(next.discount_type || 'amount').toLowerCase() === 'percent' ? 'percent' : 'amount';
    next.discount_type = dtype;

    const base = explicitBase != null ? explicitBase : resolveBaseTotal(next);
    const rawInput = next.discount_value;

    // Clearing discount must never wipe the grand total.
    if (rawInput === '' || rawInput == null) {
      const restored = base != null ? base : toFiniteMoney(next.grand_total);
      next.discount = null;
      next.discount_percent = null;
      next.discount_value = '';
      if (explicitBase == null) {
        next.original_grand_total = null;
      }
      if (restored != null) {
        next.grand_total = roundMoney(Math.max(0, restored));
      }
      return syncBalanceFromGrand(next);
    }

    const inputNum = Number(rawInput);
    if (!Number.isFinite(inputNum) || inputNum < 0) {
      return next;
    }
    // Ignore incomplete typing (e.g. ".") without changing totals.
    if (base == null || base <= 0) {
      return next;
    }

    if (next.original_grand_total === undefined || next.original_grand_total === null || next.original_grand_total === '') {
      next.original_grand_total = base;
    }
    let discountAmt = 0;
    let percent: number | null = null;
    if (dtype === 'percent') {
      percent = Math.min(100, inputNum);
      next.discount_percent = percent;
      discountAmt = roundMoney(base * (percent / 100));
    } else {
      discountAmt = roundMoney(Math.min(base, inputNum));
      percent = base > 0 ? roundMoney((discountAmt / base) * 100) : null;
      next.discount_percent = percent;
    }
    next.discount = discountAmt;
    next.grand_total = roundMoney(Math.max(0, base - discountAmt));
    return syncBalanceFromGrand(next);
  };

  const handleEditChange = (field: string, value: any) => {
    setEditedData((prev: any) => {
      if (field === 'priority') {
        const rushFee = String(value).toLowerCase() === 'rush'
          ? resolveRushFeeAmount({ ...prev, priority: value })
          : prev?.rush_fee;
        const rushDraft = applyRushPricingToOrder(prev, value, rushFee);
        return recalculateBusinessRulesExpectedDate(rushDraft);
      }
      if (field === 'rush_fee') {
        if (String(prev?.priority || '').toLowerCase() !== 'rush') {
          return { ...prev, rush_fee: value };
        }
        return applyRushPricingToOrder(prev, 'rush', value);
      }
      const next = { ...prev, [field]: value };
      if (field === 'control_no') {
        next.control_no = value;
        next.order_id = normalizeHistoricalOrderId(next.order_id, next.date_received, value);
        return next;
      }
      if (field === 'date_received') {
        next.date_received = value;
        next.order_id = normalizeHistoricalOrderId(next.order_id, value, next.control_no);
        return recalculateBusinessRulesExpectedDate(next);
      }
      if (field === 'expected_release_date') {
        next.expected_release_date = value || '';
        next.original_estimated_release_date = value || '';
        return next;
      }
      if (field === 'claimed_date') {
        next.claimed_date = value || '';
        return next;
      }
      if (field === 'completion_days') {
        const received = datePartOf(next.date_received || prev.date_received);
        const days = parseInt(next.completion_days ?? prev.completion_days, 10);
        if (received && !isNaN(days) && days >= 0) {
          // Noon avoids UTC day-shift when converting with toISOString().
          const d = new Date(`${received}T12:00:00`);
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + days);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const iso = `${y}-${m}-${day}`;
            next.expected_release_date = iso;
            next.claimed_date = iso;
          }
        }
      }
      if (field === 'downpayment') {
        return syncBalanceFromGrand(next);
      }
      if (field === 'discount_enabled') {
        const enabled = Boolean(value);
        next.discount_enabled = enabled;
        if (!enabled) {
          const base = resolveBaseTotal(prev) ?? toFiniteMoney(prev.grand_total);
          next.discount_value = '';
          next.discount = null;
          next.discount_percent = null;
          next.original_grand_total = null;
          next.discount_type = 'amount';
          if (base != null) next.grand_total = roundMoney(Math.max(0, base));
          return syncBalanceFromGrand(next);
        }
        // Turning on: treat current payable as pre-discount base until user edits discount.
        const current = toFiniteMoney(prev.grand_total);
        if (current != null && toFiniteMoney(prev.original_grand_total) == null) {
          next.original_grand_total = current;
        }
        next.discount_type = next.discount_type || 'amount';
        return next;
      }
      if (field === 'discount_type' || field === 'discount_value') {
        next.discount_enabled = true;
        return recomputeFromDiscount(next);
      }
      if (field === 'original_grand_total') {
        // Allow clearing / mid-typing (e.g. "650.", "650.50") without snapping back.
        next.original_grand_total = value;
        if (value === '' || value == null) {
          if (!next.discount_enabled) {
            next.grand_total = '';
          }
          return next;
        }
        const orig = toFiniteMoney(value);
        if (orig == null || orig < 0) return next; // incomplete input like "650."
        if (next.discount_enabled || hasActiveDiscountInput(next)) {
          return recomputeFromDiscount(next, orig);
        }
        next.grand_total = orig;
        next.discount = null;
        next.discount_percent = null;
        return syncBalanceFromGrand(next);
      }
      if (field === 'grand_total') {
        // Allow empty while typing so the last digit can be deleted.
        if (value === '' || value == null) {
          next.grand_total = '';
          if (!next.discount_enabled) {
            next.original_grand_total = null;
            next.discount = null;
            next.discount_percent = null;
            next.discount_value = '';
          }
          return next;
        }
        next.grand_total = value;
        const discounted = toFiniteMoney(value);
        if (discounted == null || discounted < 0) return next;
        next.grand_total = roundMoney(discounted);

        if (next.discount_enabled || hasActiveDiscountInput(next)) {
          // When discount is on, editing "final payable" adjusts discount against original.
          let original = toFiniteMoney(next.original_grand_total);
          if (original == null || original <= 0) {
            original = resolveBaseTotal({ ...next, grand_total: discounted, discount: next.discount });
          }
          if (original != null && original >= discounted) {
            const amt = roundMoney(original - discounted);
            next.original_grand_total = original;
            next.discount = amt > 0 ? amt : null;
            next.discount_type = next.discount_type || 'amount';
            if (String(next.discount_type).toLowerCase() === 'percent') {
              next.discount_percent = original > 0 ? roundMoney((amt / original) * 100) : null;
              next.discount_value = next.discount_percent ?? '';
            } else {
              next.discount_value = amt > 0 ? amt : '';
              next.discount_percent = original > 0 ? roundMoney((amt / original) * 100) : null;
            }
          }
        } else {
          next.original_grand_total = null;
          next.discount = null;
          next.discount_percent = null;
          next.discount_value = '';
        }
        return syncBalanceFromGrand(next);
      }
      if (field === 'balance') {
        const bal = toFiniteMoney(value);
        if (value === '' || value == null) {
          next.balance = '';
          return next;
        }
        if (bal == null || bal < 0) {
          next.balance = 0;
          return next;
        }
        next.balance = roundMoney(bal);
        return next;
      }
      return next;
    });
  };

  const handleEditItem = (idx: number, field: string, value: any) => {
    setEditedData((prev: any) => {
      const newItems = [...(prev.items || [])];
      const current = newItems[idx] || {};
      let nextItem = { ...current, [field]: value };
      if (field === 'base_service_price' || field === 'addon_service_price') {
        const group = field === 'base_service_price' ? 'base' : 'addon';
        const names = listGroupServices(nextItem, group);
        const amount = parseOptionalMoney(value);
        const service_prices = { ...(current.service_prices || {}) };
        if (amount === '') {
          names.forEach((name) => delete service_prices[name]);
        } else if (names.length === 1) {
          service_prices[names[0]] = amount;
        } else if (names.length > 1) {
          const catalogVals = names.map(resolveCatalogPrice);
          const catalogSum = catalogVals.reduce<number>((sum, val) => sum + (val || 0), 0);
          if (catalogVals.every((val) => val != null) && Math.abs(catalogSum - amount) < 0.05) {
            names.forEach((name, idx) => { service_prices[name] = catalogVals[idx] as number; });
          } else {
            let remaining = amount;
            names.forEach((name, idx) => {
              if (idx === names.length - 1) {
                service_prices[name] = Math.max(0, Math.round(remaining * 100) / 100);
              } else if (catalogVals[idx] != null && catalogVals[idx]! < remaining) {
                service_prices[name] = catalogVals[idx] as number;
                remaining = Math.round((remaining - (catalogVals[idx] as number)) * 100) / 100;
              } else {
                const share = Math.round((amount / names.length) * 100) / 100;
                service_prices[name] = share;
                remaining = Math.round((remaining - share) * 100) / 100;
              }
            });
          }
        }
        nextItem = {
          ...nextItem,
          service_prices,
          prices_manual: true,
        };
        const basePrice = field === 'base_service_price' ? amount : explicitGroupPrice(nextItem, 'base');
        const addonPrice = field === 'addon_service_price' ? amount : explicitGroupPrice(nextItem, 'addon');
        if (basePrice !== '' || addonPrice !== '') {
          nextItem.item_price = Math.round((Number(basePrice || 0) + Number(addonPrice || 0)) * 100) / 100;
          nextItem.is_free = false;
        }
        nextItem.price_breakdown = formatServicePriceBreakdown(nextItem);
      } else if (['item_price', 'base_services', 'addon_services'].includes(field)) {
        if (field === 'base_services' || field === 'addon_services') {
          const group = field === 'base_services' ? 'base' : 'addon';
          const newNames = listGroupServices(nextItem, group);
          const service_prices = { ...(nextItem.service_prices || {}) };
          newNames.forEach((name) => {
            if (service_prices[name] == null) {
              const catPrice = resolveCatalogPrice(name);
              if (catPrice != null) service_prices[name] = catPrice;
            }
          });
          const oldNames = listGroupServices(current, group);
          oldNames.forEach((name) => {
            if (!newNames.includes(name)) delete service_prices[name];
          });
          nextItem.service_prices = service_prices;
          const groupSum = newNames.reduce((sum, n) => sum + (Number(service_prices[n]) || 0), 0);
          if (groupSum > 0) {
            if (field === 'base_services') nextItem.base_service_price = groupSum;
            else nextItem.addon_service_price = groupSum;
          }
        }
        nextItem = decorateItemPricing(nextItem);
        if (field === 'base_services' || field === 'addon_services') {
          const basePrice = explicitGroupPrice(nextItem, 'base');
          const addonPrice = explicitGroupPrice(nextItem, 'addon');
          if (basePrice !== '' || addonPrice !== '') {
            nextItem.item_price = Math.round((Number(basePrice || 0) + Number(addonPrice || 0)) * 100) / 100;
            nextItem.is_free = false;
          }
        }
      }
      if (['brand', 'model', 'material', 'color', 'size'].includes(field) && value) {
        rememberCustomOption(field + 's', String(value));
      }
      newItems[idx] = nextItem;
      let nextOrder = { ...prev, items: newItems };
      if (field === 'base_services' || field === 'addon_services') {
        nextOrder = recalculateBusinessRulesExpectedDate(nextOrder);
      }
      const pricedCount = newItems.filter((item: any) => {
        if (isExplicitlyFree(item)) return false;
        const n = Number(item?.item_price);
        return Number.isFinite(n);
      }).length;
      if (pricedCount > 0) {
        const grand = orderGrandWithRush(nextOrder, newItems);
        const down = Number(prev.downpayment);
        nextOrder.grand_total = grand;
        if (Number.isFinite(down)) {
          nextOrder.balance = Math.round((grand - down) * 100) / 100;
        }
      }
      return nextOrder;
    });
  };

  const emptyEditableItem = () => ({
    brand: '',
    model: '',
    material: '',
    color: '',
    size: '',
    remarks: '',
    claimed_date: null,
    item_price: '',
    is_free: false,
    base_services: [],
    addon_services: [],
    base_service_price: '',
    addon_service_price: '',
    conditions: [],
    service_prices: {},
  });

  const addEditableItem = () => {
    setEditedData((prev: any) => ({
      ...prev,
      items: [...(prev?.items || []), emptyEditableItem()],
    }));
  };

  const removeEditableItem = (idx: number) => {
    setEditedData((prev: any) => {
      const items = [...(prev?.items || [])];
      if (items.length <= 1) {
        items[0] = emptyEditableItem();
        return { ...prev, items };
      }
      items.splice(idx, 1);
      return { ...prev, items };
    });
  };

  const startEdit = () => {
    const orderCopy = { ...queue[currentIndex]?.order };
    const rushFee = resolveRushFeeAmount(orderCopy);
    const rawOid = orderCopy.order_id;
    const normOid = normalizeHistoricalOrderId(rawOid, orderCopy.date_received, orderCopy.control_no);
    const rawExpected = orderCopy.expected_release_date ?? orderCopy.original_estimated_release_date ?? '';
    const rawClaimed = orderCopy.claimed_date ?? '';
    let draft: any = {
      ...orderCopy,
      order_id: normOid,
      control_no: orderCopy.control_no ?? '',
      expected_release_date: rawExpected ? (datePartOf(rawExpected) || '') : '',
      original_estimated_release_date: rawExpected ? (datePartOf(rawExpected) || '') : '',
      claimed_date: rawClaimed ? (datePartOf(rawClaimed) || '') : '',
      payment_method: ['Cash', 'GCash', 'Maya'].includes(String(orderCopy.payment_method || ''))
        ? orderCopy.payment_method
        : 'Cash',
      rush_fee: rushFee,
      items: (orderCopy.items || []).map((item: any) => {
        const basePrice = explicitGroupPrice(item, 'base');
        const addonPrice = explicitGroupPrice(item, 'addon');
        const hasServices = Boolean(
          (Array.isArray(item.base_services) && item.base_services.length)
          || (Array.isArray(item.addon_services) && item.addon_services.length)
        );
        const remClean = cleanRemarks(item.remarks);
        const remarksFree = remClean.toUpperCase().startsWith('FREE');
        // Empty OCR placeholder wrongly flagged FREE → leave blank so a real amount can be typed.
        const free = Boolean(item.is_free) && (hasServices || remarksFree || Boolean(item.brand));
        return {
          ...item,
          brand: item.brand || '',
          model: item.model || '',
          material: item.material || '',
          color: item.color || '',
          size: item.size || '',
          remarks: remClean,
          base_services: item.base_services || [],
          addon_services: item.addon_services || [],
          conditions: item.conditions || [],
          base_service_price: basePrice === '' || basePrice == null ? '' : basePrice,
          addon_service_price: addonPrice === '' || addonPrice == null ? '' : addonPrice,
          item_price: free
            ? 'FREE'
            : (item.item_price == null || item.item_price === '' ? '' : item.item_price),
          is_free: free,
        };
      }),
    };
    draft = recalculateBusinessRulesExpectedDate(draft);
    // Rebuild totals from base/addon + editable rush so grand total includes the fee.
    if (String(draft.priority || '').toLowerCase() === 'rush') {
      draft = applyRushPricingToOrder(draft, 'rush', rushFee);
    }
    const orig = Number(draft.original_grand_total);
    const gt = Number(draft.grand_total);
    const disc = Number(draft.discount);
    const hasDisc = (Number.isFinite(disc) && disc > 0.009)
      || (Number.isFinite(orig) && Number.isFinite(gt) && orig > gt + 0.009);
    const dtype = String(draft.discount_type || '').toLowerCase() === 'percent' ? 'percent' : 'amount';
    draft.discount_type = hasDisc ? dtype : (draft.discount_type || 'amount');
    draft.discount_enabled = hasDisc;
    if (hasDisc) {
      if (draft.original_grand_total == null || draft.original_grand_total === '') {
        draft.original_grand_total = Number.isFinite(orig) ? orig : (Number.isFinite(gt) && Number.isFinite(disc) ? roundMoney(gt + disc) : gt);
      }
      if (dtype === 'percent' && draft.discount_percent != null && draft.discount_percent !== '') {
        draft.discount_value = draft.discount_percent;
      } else if (Number.isFinite(disc) && disc > 0) {
        draft.discount_value = disc;
      } else if (Number.isFinite(orig) && Number.isFinite(gt) && orig > gt) {
        draft.discount_value = roundMoney(orig - gt);
        draft.discount = draft.discount_value;
      } else {
        draft.discount_value = '';
      }
    } else {
      draft.discount_value = '';
      draft.discount = null;
      draft.discount_percent = null;
      draft.discount_enabled = false;
    }
    draft = syncBalanceFromGrand(draft);
    setEditedData(draft);
    setEditMode(true);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
      <CircularProgress color="error" />
    </Box>
  );

  if (loadError) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
          The review queue could not be loaded. Pending historical records were not validated or deleted.
          {pendingTotal ? ` About ${pendingTotal} records are still waiting for review.` : ''}
        </Alert>
        <Typography color="textSecondary" sx={{ mb: 3 }}>{loadError}</Typography>
        <Button variant="contained" startIcon={<Refresh />} onClick={() => { void fetchQueue(); }} sx={{ mr: 1 }}>
          Retry Queue
        </Button>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => onBack ? onBack() : navigate('/job-order-form/historical-records')}>
          Return to Historical Records
        </Button>
      </Box>
    );
  }

  const renderLiveCountersRibbon = () => (
    <Box sx={{ mb: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', bgcolor: '#f8fafc', p: 1, borderRadius: 2, border: '1px solid #e2e8f0' }}>
      <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', mr: 0.5, fontSize: '0.72rem' }}>
        Live Database Status:
      </Typography>
      <Chip label={`ALL PENDING: ${filterCounts.all_pending}`} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22, bgcolor: '#e2e8f0' }} />
      <Chip label={`POTENTIAL ML REMAINING: ${filterCounts.potential_ml}`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 800, fontSize: '0.7rem', height: 22 }} />
      <Chip label={`VALIDATED: ${filterCounts.validated}`} size="small" color="success" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
      <Chip label={`CORRECTED: ${filterCounts.corrected}`} size="small" color="secondary" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
      <Chip label={`REJECTED: ${filterCounts.rejected}`} size="small" color="error" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
      <Chip label={`CONFIRMED ML ELIGIBLE: ${filterCounts.confirmed_ml_eligible}`} size="small" sx={{ fontWeight: 900, fontSize: '0.7rem', height: 22, bgcolor: '#dcfce7', color: '#166534', border: '1px solid #86efac' }} />
      <Chip label={`HISTORICAL ONLY: ${filterCounts.historical_only}`} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22, bgcolor: '#f1f5f9' }} />
      <Chip label={`NEEDS HUMAN REVIEW: ${filterCounts.needs_human_review}`} size="small" color="warning" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
      <Chip label={`UNRESOLVED COLLISIONS: ${filterCounts.unresolved_collisions}`} size="small" color="error" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
    </Box>
  );

  const renderFilterTabs = () => (
    <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', bgcolor: '#ffffff', p: 1, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', px: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Queue Filter:
      </Typography>
      {[
        { key: 'potential_ml', label: 'POTENTIAL ML', count: filterCounts.potential_ml, activeColor: '#2563eb' },
        { key: 'all_pending', label: 'ALL PENDING', count: filterCounts.all_pending, activeColor: '#1e293b' },
        { key: 'historical_only', label: 'HISTORICAL ONLY', count: filterCounts.historical_only, activeColor: '#475569' },
        { key: 'needs_human_review', label: 'NEEDS HUMAN REVIEW', count: filterCounts.needs_human_review, activeColor: '#dc2626' },
        { key: 'order_id_collision', label: 'ORDER ID COLLISION', count: filterCounts.order_id_collision, activeColor: '#d97706' },
        { key: 'legacy_reference_match', label: 'LEGACY REFERENCE MATCH', count: filterCounts.legacy_reference_match, activeColor: '#7c3aed' },
      ].map((tab) => {
        const isSelected = activeFilter === tab.key;
        return (
          <Button
            key={tab.key}
            variant={isSelected ? 'contained' : 'outlined'}
            size="small"
            onClick={() => handleFilterChange(tab.key)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: isSelected ? 800 : 600,
              fontSize: '0.8rem',
              py: 0.5,
              px: 1.5,
              bgcolor: isSelected ? tab.activeColor : 'transparent',
              color: isSelected ? '#ffffff' : '#334155',
              borderColor: isSelected ? 'transparent' : '#cbd5e1',
              '&:hover': {
                bgcolor: isSelected ? tab.activeColor : '#f1f5f9',
                filter: isSelected ? 'brightness(0.92)' : 'none',
              }
            }}
          >
            {tab.label}
            <Box
              component="span"
              sx={{
                ml: 1,
                px: 0.75,
                py: 0.15,
                borderRadius: 10,
                fontSize: '0.72rem',
                fontWeight: 800,
                bgcolor: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: isSelected ? '#ffffff' : '#334155',
              }}
            >
              {tab.count}
            </Box>
          </Button>
        );
      })}
    </Box>
  );

  if (queue.length === 0) {
    return (
      <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
        {renderLiveCountersRibbon()}
        {renderFilterTabs()}
        <Box sx={{ p: 6, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" gutterBottom fontWeight="bold">
            No Records in "{activeFilter.toUpperCase().replace(/_/g, ' ')}"
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            There are currently 0 records waiting in this validation category.
          </Typography>
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => { void fetchQueue(); }} sx={{ mr: 1 }}>
            Refresh Queue
          </Button>
          <Button variant="contained" startIcon={<ArrowBack />} onClick={() => onBack ? onBack() : navigate('/job-order-form/historical-records')}>
            Return to Historical Records
          </Button>
        </Box>
      </Box>
    );
  }

  const currentItem = queue[currentIndex];
  const reviewedSoFar = (filterCounts.validated || 0) + (filterCounts.corrected || 0) + (filterCounts.rejected || 0);
  const totalPotentialMl = (filterCounts.potential_ml || 0) + reviewedSoFar;
  const isPotentialMlView = activeFilter === 'potential_ml';
  const reviewTotal = isPotentialMlView ? (totalPotentialMl || 120) : Math.max(pendingTotal ?? 0, queue.length);
  const reviewCurrent = isPotentialMlView 
    ? Math.min(reviewTotal, reviewedSoFar + 1)
    : (queue.length === 0 ? 0 : Math.min(currentIndex + 1, queue.length));
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < queue.length - 1;

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', px: { xs: 1.5, md: 2.5, xl: 3 }, py: 1.5, minHeight: '100vh', display: 'flex', flexDirection: 'column', pb: 4 }}>
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 25,
        bgcolor: '#f8fafc',
        py: 1,
        mb: 1.5,
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontWeight: 800 }}>
            HISTORICAL DATA VALIDATION
            {activeFilter === 'potential_ml' && (
              <Chip
                label="POTENTIAL ML CANDIDATE"
                size="small"
                sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 900, fontSize: '0.75rem', height: 26 }}
              />
            )}
            {currentItem?.order && (
              <Chip
                label={currentItem.order?.raw_order_id || currentItem.order?.original_order_id || currentItem.order?.order_id}
                size="small"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', height: 26, borderColor: '#cbd5e1', bgcolor: '#ffffff' }}
              />
            )}
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                ml: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'grey.100',
                fontSize: '0.95rem',
                fontWeight: 700,
              }}
            >
              <IconButton
                size="small"
                aria-label="Previous record"
                disabled={!canGoPrev || busy}
                onClick={() => goToQueueIndex(currentIndex - 1)}
              >
                <ArrowBack fontSize="small" />
              </IconButton>
              Candidate {reviewCurrent} of {reviewTotal}
              <IconButton
                size="small"
                aria-label="Next record"
                disabled={!canGoNext || busy}
                onClick={() => goToQueueIndex(currentIndex + 1)}
              >
                <ArrowForward fontSize="small" />
              </IconButton>
            </Box>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          {/* Read-Only Clean ML Dataset Counter */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              bgcolor: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Clean ML Dataset:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 900 }}>
              {filterCounts.confirmed_ml_eligible || 0} validated records
            </Typography>
          </Box>
          <Button
            variant="text"
            size="small"
            disabled={busy || queue.length === 0 || currentIndex === 0}
            onClick={() => goToQueueIndex(0)}
            title="Jump to the first pending record"
          >
            First
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowCsvSource((prev) => !prev)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.75rem',
              borderRadius: 2,
              borderColor: '#cbd5e1',
              color: '#1e293b',
              bgcolor: showCsvSource ? '#ffffff' : '#e0e7ff',
              '&:hover': { bgcolor: '#f1f5f9' },
            }}
          >
            {showCsvSource ? 'Hide CSV Source (Full Width)' : 'Show CSV Source (Split View)'}
          </Button>
        </Box>
      </Box>

      {renderLiveCountersRibbon()}
      {renderFilterTabs()}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: showCsvSource
            ? { xs: '1fr', md: 'minmax(380px, 42%) minmax(480px, 58%)', lg: 'minmax(420px, 40%) minmax(620px, 60%)' }
            : '1fr',
          gap: 2.5,
          width: '100%',
          maxWidth: 'none',
          alignItems: 'start',
          flex: 1,
        }}
      >
        {/* Left Side: Original CSV Source (~40% on desktop) */}
        {showCsvSource && (
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#0f172a', letterSpacing: 0.5 }}>
                    ORIGINAL CSV SOURCE
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ overflowWrap: 'anywhere' }}>
                    {currentItem.order?.source_filename
                      ? `${currentItem.order.source_filename}${currentItem.order?.source_row ? ` · Row ${currentItem.order.source_row}` : ''}`
                      : 'Structured Historical CSV Import'}
                  </Typography>
                </Box>
              </Box>

              {/* Status & Reconciliation Banners */}
              {currentItem.order?.reconciliation_status === 'ORDER_ID_COLLISION' && (
                <Alert severity="warning" icon={<WarningAmber fontSize="inherit" />} sx={{ py: 0.5, px: 1.5, fontSize: '0.78rem' }}>
                  <strong>ORDER ID COLLISION — HUMAN REVIEW REQUIRED:</strong> Duplicated Order ID in source spreadsheet. Preserved as a genuine distinct candidate record with internal technical identity. Manual human review required.
                </Alert>
              )}
              {currentItem.order?.reconciliation_status === 'NEEDS_HUMAN_REVIEW' && (
                <Alert severity="error" sx={{ py: 0.5, px: 1.5, fontSize: '0.78rem' }}>
                  <strong>NEEDS HUMAN REVIEW:</strong> Intake date contains date-range or complex text (<code>{currentItem.order?.raw_date_received}</code>). <code>date_received</code> is NULL until manual human resolution.
                </Alert>
              )}
              {currentItem.order?.reconciliation_notes?.includes('LEGACY_REFERENCE_MATCH') && (
                <Alert severity="info" icon={<InfoOutlined fontSize="inherit" />} sx={{ py: 0.5, px: 1.5, fontSize: '0.78rem' }}>
                  <strong>LEGACY REFERENCE MATCH:</strong> Matches archived reference order. CSV remains primary active candidate; reference record remains archived.
                </Alert>
              )}

              {/* 1. SOURCE INFORMATION */}
              <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  1. SOURCE INFORMATION
                </Typography>
                <Grid container spacing={1.25} sx={{ fontSize: '0.75rem' }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Source Type:</Typography>
                      <Typography variant="body2" fontWeight="bold">CSV_IMPORT</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Source Filename:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {currentItem.order?.source_filename || '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Source Row:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {currentItem.order?.source_row != null ? currentItem.order.source_row : '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Original CSV Order ID:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: '#0f766e', overflowWrap: 'anywhere' }}>
                        {currentItem.order?.raw_order_id || currentItem.order?.original_order_id || currentItem.order?.order_id || '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Control No:</Typography>
                      <Typography variant="body2" fontWeight="bold" color={currentItem.order?.control_no ? 'text.primary' : 'text.disabled'}>
                        {currentItem.order?.control_no || 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Import Batch:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: '#475569', fontSize: '0.72rem', overflowWrap: 'anywhere' }}>
                        {currentItem.order?.import_batch_id || 'CSV_REBUILD_2026'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* 2. ORDER INFORMATION */}
              <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  2. ORDER INFORMATION
                </Typography>
                <Grid container spacing={1.25} sx={{ fontSize: '0.75rem' }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Customer:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ overflowWrap: 'anywhere' }}>{currentItem.order?.customer?.name || 'NOT_RECORDED'}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Contact:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ overflowWrap: 'anywhere' }}>{currentItem.order?.customer?.contact || 'NOT_RECORDED'}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 1, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0', height: '100%' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.25 }}>DATE RECEIVED</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        <strong>Source:</strong> {currentItem.order?.raw_date_received || 'NOT_RECORDED'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: currentItem.order?.date_received ? '#0369a1' : '#dc2626', fontWeight: 700, display: 'block' }}>
                        <strong>Normalized:</strong> {currentItem.order?.date_received ? currentItem.order.date_received.slice(0, 10) : 'NULL (Needs Review)'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 1, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0', height: '100%' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.25 }}>CLAIMED DATE</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        <strong>Source:</strong> {currentItem.order?.raw_claimed_date || 'NOT_RECORDED'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: currentItem.order?.claimed_date ? '#047857' : '#64748b', fontWeight: 700, display: 'block' }}>
                        <strong>Normalized:</strong> {currentItem.order?.claimed_date ? currentItem.order.claimed_date.slice(0, 10) : 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* 3. ITEM INFORMATION */}
              <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase' }}>
                    3. ITEM INFORMATION
                  </Typography>
                  <Chip
                    label={`Qty: ${currentItem.order?.items?.length || 1} (${currentItem.order?.quantity_source || 'DERIVED_FROM_ITEM_ENTRIES'})`}
                    size="small"
                    sx={{ fontSize: '0.68rem', height: 20 }}
                  />
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: (currentItem.order?.items || []).length > 1 ? { xs: '1fr', sm: 'repeat(2, 1fr)' } : '1fr',
                    gap: 1.25,
                  }}
                >
                  {(currentItem.order?.items || []).map((it: any, idx: number) => (
                    <Box key={idx} sx={{ p: 1.25, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, borderBottom: '1px solid #e2e8f0', pb: 0.25 }}>
                        <Typography variant="caption" fontWeight="bold" sx={{ color: '#1e293b' }}>
                          PAIR #{idx + 1}
                        </Typography>
                        {it.attribute_normalization_status === 'NEEDS_ATTRIBUTE_REVIEW' && (
                          <Chip label="NEEDS REVIEW" size="small" color="warning" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }} />
                        )}
                      </Box>
                      <Grid container spacing={0.75} sx={{ fontSize: '0.72rem' }}>
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Raw Description (Source):</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, overflowWrap: 'anywhere', fontFamily: 'monospace', bgcolor: '#f1f5f9', p: 0.5, borderRadius: 1 }}>
                            {it.raw_model || it.model || 'NOT_RECORDED'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Brand:</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{it.brand || 'NOT_RECORDED'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Size:</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{it.size || 'NOT_RECORDED'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Model:</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{it.model || 'NOT_RECORDED'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Color:</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: it.color ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere' }}>{it.color || 'NOT_RECORDED'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Material:</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: it.material ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere' }}>{it.material || 'NOT_RECORDED'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Condition:</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: (it.conditions && it.conditions.length > 0) ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere' }}>
                            {(it.conditions && it.conditions.length > 0) ? it.conditions.join(', ') : 'NOT_RECORDED'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* 4. SERVICE INFORMATION */}
              <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                  4. SERVICE INFORMATION
                </Typography>
                <Grid container spacing={1.25} sx={{ fontSize: '0.75rem' }}>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">Raw Service (Source Value):</Typography>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: 'monospace', bgcolor: '#f1f5f9', p: 0.75, borderRadius: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {currentItem.order?.raw_services || 'NOT_RECORDED'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Normalized Service(s):</Typography>
                      {(
                        ['ORD-2025-08-16-005', 'ORD-2025-08-27-006', 'ORD-2025-12-05-006', 'ORD-2025-12-26-005'].includes(currentItem.order?.order_id) ||
                        ['ORD-2025-08-16-005', 'ORD-2025-08-27-006', 'ORD-2025-12-05-006', 'ORD-2025-12-26-005'].includes(currentItem.order?.raw_order_id) ||
                        (currentItem.order?.raw_services && (/\b(DC|M RES|100)\b/i.test(currentItem.order.raw_services) || /recolor renewal/i.test(currentItem.order.raw_services)))
                      ) && (
                        <Chip 
                          label="⚠️ NEEDS SERVICE REVIEW" 
                          size="small" 
                          sx={{ 
                            fontWeight: 800, 
                            fontSize: '0.7rem', 
                            height: 20, 
                            bgcolor: '#fef3c7', 
                            color: '#b45309', 
                            border: '1px solid #f59e0b'
                          }} 
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {(currentItem.order?.items || []).flatMap((it: any) => (it.base_services || []).concat(it.addon_services || [])).length > 0 ? (
                        Array.from(new Set((currentItem.order?.items || []).flatMap((it: any) => (it.base_services || []).concat(it.addon_services || [])))).map((s: any, sIdx: number) => (
                          <Chip key={sIdx} label={String(s)} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.72rem', height: 22 }} />
                        ))
                      ) : (
                        <Chip label="Basic Cleaning" size="small" variant="outlined" sx={{ fontSize: '0.72rem', height: 22 }} />
                      )}
                    </Box>
                    {(
                      ['ORD-2025-08-16-005', 'ORD-2025-08-27-006', 'ORD-2025-12-05-006', 'ORD-2025-12-26-005'].includes(currentItem.order?.order_id) ||
                      ['ORD-2025-08-16-005', 'ORD-2025-08-27-006', 'ORD-2025-12-05-006', 'ORD-2025-12-26-005'].includes(currentItem.order?.raw_order_id) ||
                      (currentItem.order?.raw_services && (/\b(DC|M RES|100)\b/i.test(currentItem.order.raw_services) || /recolor renewal/i.test(currentItem.order.raw_services)))
                    ) && (
                      <Alert severity="warning" sx={{ mt: 1, py: 0.5, px: 1, fontSize: '0.72rem', fontWeight: 600 }}>
                        NEEDS SERVICE REVIEW: Source CSV context contains ambiguous service ({currentItem.order?.raw_services}). Please inspect and determine correct service manually.
                      </Alert>
                    )}
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Distinct Service Types:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {Array.from(new Set((currentItem.order?.items || []).flatMap((it: any) => (it.base_services || []).concat(it.addon_services || [])))).length || (currentItem.order?.raw_services ? 1 : 0)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Total Service Applications:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: '#2563eb' }}>
                        {(currentItem.order?.items || []).flatMap((it: any) => (it.base_services || []).concat(it.addon_services || [])).length || (currentItem.order?.raw_services ? 1 : 0)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Total Pairs:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {currentItem.order?.total_pairs || (currentItem.order?.items || []).length || 1}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Priority (Source):</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: currentItem.order?.raw_priority === 'RUSH' || String(currentItem.order?.priority).toUpperCase() === 'RUSH' ? '#dc2626' : '#64748b' }}>
                        {currentItem.order?.raw_priority || (String(currentItem.order?.priority).toUpperCase() === 'RUSH' ? 'RUSH' : 'NOT_RECORDED')}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* 5. FINANCIAL INFORMATION */}
              <Box sx={{ p: 1.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                  5. FINANCIAL INFORMATION
                </Typography>
                <Grid container spacing={1.25} sx={{ fontSize: '0.75rem' }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Grand Total (Source):</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ overflowWrap: 'anywhere' }}>
                        {currentItem.order?.raw_total != null ? `₱${currentItem.order.raw_total}` : 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Grand Total (Normalized):</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: '#047857', overflowWrap: 'anywhere' }}>
                        {currentItem.order?.grand_total != null ? `₱${Number(currentItem.order.grand_total).toLocaleString()}` : 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Downpayment:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                        {currentItem.order?.downpayment != null ? `₱${Number(currentItem.order.downpayment).toLocaleString()}` : 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Balance:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                        {currentItem.order?.balance != null ? `₱${Number(currentItem.order.balance).toLocaleString()}` : 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #f1f5f9', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Payment Method:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ overflowWrap: 'anywhere' }}>
                        {currentItem.order?.payment_method || 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* 6. ML TARGET PREVIEW */}
              <Box sx={{ p: 1.5, bgcolor: currentItem.order?.potential_ml_candidate ? '#f0fdf4' : '#f8fafc', border: `1px solid ${currentItem.order?.potential_ml_candidate ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: currentItem.order?.potential_ml_candidate ? '#166534' : '#475569', textTransform: 'uppercase' }}>
                    6. ML TARGET PREVIEW
                  </Typography>
                  {currentItem.order?.potential_ml_candidate && currentItem.order?.ocr_status === 'PENDING_REVIEW' ? (
                    <Chip
                      label="POTENTIAL ML — NOT YET VALIDATED"
                      color="warning"
                      size="small"
                      sx={{ fontWeight: 900, fontSize: '0.68rem', height: 20 }}
                    />
                  ) : (
                    <Chip
                      label={currentItem.order?.potential_ml_candidate ? 'POTENTIAL ML: YES' : 'POTENTIAL ML: NO'}
                      color={currentItem.order?.potential_ml_candidate ? 'success' : 'default'}
                      size="small"
                      sx={{ fontWeight: 800, fontSize: '0.7rem', height: 20 }}
                    />
                  )}
                </Box>
                <Grid container spacing={1.25} sx={{ fontSize: '0.75rem' }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#ffffff', borderRadius: 1, border: '1px solid #dcfce7', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Date Received:</Typography>
                      <Typography variant="body2" fontWeight="bold">{currentItem.order?.date_received ? currentItem.order.date_received.slice(0, 10) : 'NULL'}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#ffffff', borderRadius: 1, border: '1px solid #dcfce7', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Claimed Date:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: currentItem.order?.claimed_date ? '#047857' : '#dc2626' }}>
                        {currentItem.order?.claimed_date ? currentItem.order.claimed_date.slice(0, 10) : 'NOT_RECORDED'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#ffffff', borderRadius: 1, border: '1px solid #dcfce7', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Calculated Turnaround:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: currentItem.order?.completion_days != null ? '#15803d' : '#64748b' }}>
                        {currentItem.order?.completion_days != null ? `${currentItem.order.completion_days} days` : 'Ineligible'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 0.75, bgcolor: '#ffffff', borderRadius: 1, border: '1px solid #dcfce7', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Target Provenance:</Typography>
                      <Typography variant="body2" fontWeight="bold" sx={{ overflowWrap: 'anywhere', color: '#1e3a8a' }}>
                        {currentItem.order?.target_provenance || 'NONE'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Right Side: Normalized Data (~60% on desktop, 100% when source hidden) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
          <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <IconButton
                  size="small"
                  onClick={() => fetchQueue({ keepPosition: true })}
                  disabled={busy}
                  title="Refresh Queue"
                  sx={{ color: 'primary.contrastText', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, p: 0.75 }}
                >
                  <Refresh fontSize="small" />
                </IconButton>
                <Typography variant="subtitle1" fontWeight="bold">
                  NORMALIZED DATA
                </Typography>
                {!showCsvSource && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setShowCsvSource(true)}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.4)',
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      py: 0.2,
                      px: 1,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: 'white' },
                    }}
                  >
                    Show CSV Source
                  </Button>
                )}
              </Box>
              <Chip
                label={currentItem.order?.potential_ml_candidate ? "★ POTENTIAL ML CANDIDATE" : "HISTORICAL RECORD"}
                size="small"
                sx={{
                  bgcolor: currentItem.order?.potential_ml_candidate ? '#fef3c7' : 'rgba(255,255,255,0.2)',
                  color: currentItem.order?.potential_ml_candidate ? '#92400e' : 'white',
                  fontWeight: 900,
                  fontSize: '0.7rem'
                }}
              />
            </Box>
            <Box sx={{ p: 2, flex: 1, pb: 4 }}>
              {currentItem.source_document_ref
                && currentItem.source_document_ref !== currentItem.order?.order_id && (
                <Alert severity="info" sx={{ mb: 2, py: 0 }}>
                  <Typography variant="body2">
                    Original document / control number: <strong>{currentItem.source_document_ref}</strong>
                  </Typography>
                </Alert>
              )}

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>Order Information</Typography>
              <Grid container spacing={1} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Order ID" 
                    value={currentItem.order?.raw_order_id || currentItem.order?.original_order_id || currentItem.order?.order_id || '—'} 
                    InputProps={{ readOnly: true }}
                    helperText={!editMode ? 'Original CSV transaction identifier' : undefined}
                    variant="filled"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small"
                    label="Control No"
                    value={editMode
                      ? (editedData?.control_no ?? currentItem.order?.control_no ?? '')
                      : (currentItem.order?.control_no || '—')}
                    onChange={(e) => handleEditChange('control_no', e.target.value)}
                    InputProps={{ readOnly: !editMode }}
                    placeholder={editMode ? 'Optional if blank on form' : undefined}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                {currentItem.order?.raw_order_id && currentItem.order?.order_id && currentItem.order?.raw_order_id !== currentItem.order?.order_id && (
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ p: 1, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                        Internal Record Reference: <span style={{ fontFamily: 'monospace', color: '#475569' }}>{currentItem.order?.order_id}</span>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block', mt: 0.25 }}>
                        Internal database identifier generated to prevent a collision with an archived legacy record.
                      </Typography>
                    </Box>
                  </Grid>
                )}
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Branch" 
                    value={editMode ? editedData?.branch : currentItem.order?.branch} 
                    onChange={(e) => handleEditChange('branch', e.target.value)}
                    InputProps={{ readOnly: !editMode }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  {editMode ? (
                    <TextField
                      fullWidth size="small"
                      label="Priority"
                      select
                      value={editedData?.priority || 'regular'}
                      onChange={(e) => handleEditChange('priority', e.target.value)}
                      variant="outlined"
                    >
                      <MenuItem value="regular">Regular</MenuItem>
                      <MenuItem value="rush">Rush</MenuItem>
                    </TextField>
                  ) : (
                    <TextField
                      fullWidth size="small"
                      label="Priority"
                      value={String(currentItem.order?.priority || 'regular').toLowerCase() === 'rush'
                        ? 'Rush'
                        : 'Regular'}
                      InputProps={{ readOnly: true }}
                      helperText={
                        String(currentItem.order?.priority || 'regular').toLowerCase() === 'rush'
                          ? (currentItem.order?.priority_provenance === 'EXPLICIT_SOURCE_VALUE' ? 'Explicit source value' : 'Rush priority')
                          : 'Derived — default non-Rush priority'
                      }
                      FormHelperTextProps={{ sx: { fontSize: '0.68rem', mt: 0.25 } }}
                      variant="filled"
                    />
                  )}
                </Grid>
                {editMode && String(editedData?.priority || '').toLowerCase() === 'rush' && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <TextField
                      fullWidth size="small"
                      label="Rush Fee"
                      type="number"
                      value={editedData?.rush_fee ?? DEFAULT_RUSH_FEE}
                      onChange={(e) => handleEditChange('rush_fee', e.target.value)}
                      title="Usually ₱100 or ₱150 — added once when Basic Cleaning is present"
                      InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                      variant="outlined"
                      inputProps={{ min: 0, step: 50 }}
                    />
                  </Grid>
                )}
                {!editMode && String(currentItem.order?.priority || '').toLowerCase() === 'rush' && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <TextField
                      fullWidth size="small"
                      label="Rush Fee"
                      value={`₱${resolveRushFeeAmount(currentItem.order)}`}
                      InputProps={{ readOnly: true }}
                      variant="filled"
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 6, sm: 4 }}>
                  {editMode ? (
                    <TextField
                      fullWidth size="small"
                      label="Total Days"
                      type="number"
                      value={editedData?.completion_days ?? ''}
                      onChange={(e) => handleEditChange('completion_days', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      variant="outlined"
                    />
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label="Total Days"
                      value={currentItem.order?.completion_days ?? '—'}
                      InputProps={{ readOnly: true }}
                      InputLabelProps={{ shrink: true }}
                      variant="filled"
                    />
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 5 }}>
                  {editMode ? (
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 7 }}>
                        <TextField
                          fullWidth size="small"
                          label="Date Received"
                          type="date"
                          value={datePartOf(editedData?.date_received)}
                          onChange={(e) => {
                            handleEditChange(
                              'date_received',
                              combineDateAndTime(e.target.value, timePartOf(editedData?.date_received)),
                            );
                          }}
                          InputLabelProps={{ shrink: true }}
                          title="From form DATE & TIME"
                          variant="outlined"
                        />
                      </Grid>
                      <Grid size={{ xs: 5 }}>
                        <TextField
                          fullWidth size="small"
                          label="Time"
                          type="time"
                          value={timePartOf(editedData?.date_received)}
                          onChange={(e) => {
                            const datePart = datePartOf(editedData?.date_received);
                            if (!datePart) {
                              // Date input must stay valid YYYY-MM-DD; set the date first.
                              return;
                            }
                            handleEditChange(
                              'date_received',
                              combineDateAndTime(datePart, e.target.value),
                            );
                          }}
                          InputLabelProps={{ shrink: true }}
                          title="Optional · e.g. 1:08 PM → 13:08"
                          variant="outlined"
                        />
                      </Grid>
                    </Grid>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label="Date Received"
                      value={displayReceivedDateTime(currentItem.order?.date_received)}
                      InputProps={{ readOnly: true }}
                      InputLabelProps={{ shrink: true }}
                      helperText={currentItem.date_received_unverified
                        ? 'Copy DATE & TIME from the scan (not the Aug 15 placeholder)'
                        : undefined}
                      variant="filled"
                    />
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 3.5 }}>
                  {editMode ? (
                    <TextField
                      fullWidth size="small"
                      label="Expected Release"
                      type="date"
                      value={datePartOf(editedData?.expected_release_date !== undefined ? editedData?.expected_release_date : editedData?.original_estimated_release_date) || ''}
                      onChange={(e) => handleEditChange('expected_release_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: (editedData?.expected_release_date || editedData?.original_estimated_release_date) ? (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              title="Clear Expected Release Date"
                              onClick={() => handleEditChange('expected_release_date', '')}
                              edge="end"
                              sx={{ p: 0.5 }}
                            >
                              <ClearIcon fontSize="small" sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        ) : null,
                      }}
                      helperText="Optional · Leave blank if incomplete"
                      variant="outlined"
                    />
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label="Expected Release"
                      value={displayMmDdYyyy(currentItem.order?.expected_release_date ?? currentItem.order?.original_estimated_release_date) || '—'}
                      InputProps={{ readOnly: true }}
                      InputLabelProps={{ shrink: true }}
                      helperText={currentItem.order?.completion_days != null
                        ? `Business rule: ${currentItem.order.completion_days} day(s)`
                        : undefined}
                      variant="filled"
                    />
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 3.5 }}>
                  {editMode ? (
                    <TextField
                      fullWidth size="small"
                      label="Order Claimed Date"
                      type="date"
                      value={datePartOf(editedData?.claimed_date) || ''}
                      onChange={(e) => handleEditChange('claimed_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: editedData?.claimed_date ? (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              title="Clear Claimed Date"
                              onClick={() => handleEditChange('claimed_date', '')}
                              edge="end"
                              sx={{ p: 0.5 }}
                            >
                              <ClearIcon fontSize="small" sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        ) : null,
                      }}
                      helperText="Optional · Leave blank if unclaimed"
                      variant="outlined"
                    />
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label="Order Claimed Date"
                      value={displayMmDdYyyy(currentItem.order?.claimed_date) || '—'}
                      InputProps={{ readOnly: true }}
                      InputLabelProps={{ shrink: true }}
                      variant="filled"
                    />
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Customer Name" 
                    value={editMode ? editedData?.customer?.name : currentItem.order?.customer?.name} 
                    onChange={(e) => handleEditChange('customer', { ...editedData?.customer, name: e.target.value.slice(0, 60) })}
                    InputProps={{ readOnly: !editMode }}
                    inputProps={{ maxLength: 60 }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Contact Number" 
                    value={editMode ? editedData?.customer?.contact : currentItem.order?.customer?.contact} 
                    onChange={(e) => handleEditChange('customer', { ...editedData?.customer, contact: e.target.value })}
                    InputProps={{ readOnly: !editMode }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                {(editMode || currentItem.order?.notes) && (
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth size="small"
                      label="Notes / Special Instructions"
                      value={editMode ? (editedData?.notes ?? currentItem.order?.notes ?? '') : (currentItem.order?.notes || '—')}
                      onChange={(e) => handleEditChange('notes', e.target.value)}
                      InputProps={{ readOnly: !editMode }}
                      variant={editMode ? "outlined" : "filled"}
                    />
                  </Grid>
                )}
              </Grid>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Extracted Items ({((editMode ? editedData?.items : currentItem.order?.items) || []).length})
                </Typography>
                {editMode && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={addEditableItem}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Add Item
                  </Button>
                )}
              </Box>
              <Grid container spacing={2}>
              {((editMode ? editedData?.items : currentItem.order?.items) || []).map((item: any, idx: number) => (
                <Grid size={{ xs: 12, md: 6 }} key={idx}>
                <Card variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0', pb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">ITEM {idx + 1}</Typography>
                      {!editMode && item.attribute_normalization_status === 'NEEDS_ATTRIBUTE_REVIEW' && (
                        <Chip
                          label="Needs Attribute Review"
                          size="small"
                          color="warning"
                          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }}
                          title={item.attribute_review_reason || 'Ambiguous shoe attributes'}
                        />
                      )}
                      {!editMode && item.attribute_normalization_status !== 'NEEDS_ATTRIBUTE_REVIEW' && (!item.brand || !item.base_services?.length) && (
                        <Chip
                          label="Needs Review"
                          size="small"
                          color="warning"
                          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 'bold' }}
                        />
                      )}
                    </Box>
                    {editMode && (
                      <IconButton
                        size="small"
                        aria-label={`Remove item ${idx + 1}`}
                        onClick={() => removeEditableItem(idx)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  
                  {editMode ? (
                    <Grid container spacing={1}>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={brandOptions}
                           value={item.brand || ''}
                           onChange={(_, newValue) => {
                             handleEditItem(idx, 'brand', newValue || '');
                             if (newValue) {
                               rememberCustomOption('brands', String(newValue));
                               setBrandOptions(prev => prev.some(b => b.toLowerCase() === String(newValue).toLowerCase()) ? prev : [...prev, String(newValue)]);
                             }
                           }}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'brand', newInputValue || '')}
                           renderInput={(params) => <TextField {...params} label="Brand" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={modelOptions}
                           value={item.model || ''}
                           onChange={(_, newValue) => {
                             handleEditItem(idx, 'model', newValue || '');
                             if (newValue) {
                               rememberCustomOption('models', String(newValue));
                               setModelOptions(prev => prev.some(m => m.toLowerCase() === String(newValue).toLowerCase()) ? prev : [...prev, String(newValue)]);
                             }
                           }}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'model', newInputValue || '')}
                           renderInput={(params) => <TextField {...params} label="Model" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={materialOptions}
                           value={item.material || ''}
                           onChange={(_, newValue) => {
                             handleEditItem(idx, 'material', newValue || '');
                             if (newValue) {
                               rememberCustomOption('materials', String(newValue));
                               setMaterialOptions(prev => prev.some(m => m.toLowerCase() === String(newValue).toLowerCase()) ? prev : [...prev, String(newValue)]);
                             }
                           }}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'material', newInputValue || '')}
                           renderInput={(params) => <TextField {...params} label="Material" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={colorOptions}
                           value={item.color || ''}
                           onChange={(_, newValue) => {
                             handleEditItem(idx, 'color', newValue || '');
                             if (newValue) {
                               rememberCustomOption('colors', String(newValue));
                               setColorOptions(prev => prev.some(c => c.toLowerCase() === String(newValue).toLowerCase()) ? prev : [...prev, String(newValue)]);
                             }
                           }}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'color', newInputValue || '')}
                           renderInput={(params) => <TextField {...params} label="Color" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={sizeOptions}
                           value={item.size || ''}
                           onChange={(_, newValue) => {
                             handleEditItem(idx, 'size', newValue || '');
                             if (newValue) {
                               rememberCustomOption('sizes', String(newValue));
                               setSizeOptions(prev => prev.some(s => s.toLowerCase() === String(newValue).toLowerCase()) ? prev : [...prev, String(newValue)]);
                             }
                           }}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'size', newInputValue || '')}
                           renderInput={(params) => <TextField {...params} label="Size" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <TextField 
                           label="Item Price" 
                           value={editItemPriceValue(item)}
                           placeholder="Blank if unknown"
                           onChange={e => {
                             const raw = e.target.value;
                             const trimmed = raw.trim().toLowerCase();
                             setEditedData((prev: any) => {
                               const items = [...(prev.items || [])];
                               const current = items[idx] || {};
                               if (raw.trim() === '') {
                                 items[idx] = {
                                   ...current,
                                   is_free: false,
                                   item_price: '',
                                   price_addends: [],
                                   price_breakdown: null,
                                 };
                               } else if (trimmed === 'free') {
                                 items[idx] = {
                                   ...current,
                                   is_free: true,
                                   item_price: 'FREE',
                                   price_addends: [],
                                   price_breakdown: null,
                                 };
                               } else {
                                 items[idx] = {
                                   ...current,
                                   is_free: false,
                                   item_price: raw,
                                 };
                               }
                               return { ...prev, items };
                             });
                           }}
                           onBlur={() => {
                             setEditedData((prev: any) => {
                               const items = [...(prev.items || [])];
                               const current = items[idx] || {};
                               const text = String(current.item_price ?? '').trim();
                               const lower = text.toLowerCase();
                               if (text === '' || current.item_price === '' || current.item_price == null) {
                                 items[idx] = {
                                   ...current,
                                   is_free: false,
                                   item_price: '',
                                   price_addends: [],
                                   price_breakdown: null,
                                 };
                                 return { ...prev, items };
                               }
                               if (lower === 'free' || current.is_free) {
                                 items[idx] = {
                                   ...current,
                                   is_free: true,
                                   item_price: 'FREE',
                                   price_addends: [],
                                   price_breakdown: null,
                                 };
                                 return { ...prev, items };
                               }
                               const addends = parsePriceAddends(current.item_price);
                               const parsed = parseRowPriceInput(current.item_price);
                               items[idx] = decorateItemPricing({
                                 ...current,
                                 is_free: false,
                                 price_addends: addends,
                                 item_price: parsed === '' ? text : parsed,
                               });
                               return { ...prev, items };
                             });
                           }}
                           size="small" 
                           fullWidth 
                           variant="outlined"
                           InputProps={{
                             startAdornment: isExplicitlyFree(item) || editItemPriceValue(item) === ''
                               ? undefined
                               : <InputAdornment position="start">₱</InputAdornment>,
                           }}
                         />
                         <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.2 }}>
                           Type FREE if complimentary
                         </Typography>
                       </Grid>
                       <Grid size={{ xs: 12, sm: 6 }}>
                         <TextField
                           label="Item Claimed Date"
                           type="date"
                           value={datePartOf(item.claimed_date)}
                           onChange={e => handleEditItem(idx, 'claimed_date', e.target.value || null)}
                           size="small"
                           fullWidth
                           variant="outlined"
                           InputLabelProps={{ shrink: true }}
                         />
                       </Grid>
                       <Grid size={{ xs: 12, sm: 6 }}>
                         <TextField
                           label="Remarks / Conditions"
                           value={item.remarks || (typeof item.conditions === 'string' ? item.conditions : '') || ''}
                           onChange={e => handleEditItem(idx, 'remarks', e.target.value)}
                           size="small"
                           fullWidth
                           variant="outlined"
                         />
                       </Grid>
                       <Grid size={{ xs: 12, sm: 7 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            options={BASE_SERVICE_OPTIONS}
                            value={Array.isArray(item.base_services) ? item.base_services : []}
                            onChange={(_, newValue) => {
                              const parsed = parseServicesInput(newValue);
                              handleEditItem(idx, 'base_services', parsed);
                            }}
                            renderTags={(tagValue, getTagProps) =>
                              tagValue.map((option, tagIdx) => (
                                <Chip
                                  {...getTagProps({ index: tagIdx })}
                                  key={option + tagIdx}
                                  label={option}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600 }}
                                />
                              ))
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Base Services"
                                placeholder={(!item.base_services || !item.base_services.length) ? "Select or type (e.g. Full Reglue, BC)" : ""}
                                size="small"
                                fullWidth
                                variant="outlined"
                                onKeyDown={(e) => {
                                  if (e.key === ',' || e.key === '+') {
                                    const inputVal = (e.target as HTMLInputElement).value;
                                    if (inputVal && inputVal.trim()) {
                                      e.preventDefault();
                                      const currentVals = Array.isArray(item.base_services) ? item.base_services : [];
                                      const newParsed = parseServicesInput([...currentVals, inputVal]);
                                      handleEditItem(idx, 'base_services', newParsed);
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const inputVal = e.target.value;
                                  if (inputVal && inputVal.trim()) {
                                    const currentVals = Array.isArray(item.base_services) ? item.base_services : [];
                                    const newParsed = parseServicesInput([...currentVals, inputVal]);
                                    handleEditItem(idx, 'base_services', newParsed);
                                  }
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <TextField
                            label="Base Service Price"
                            value={item.base_service_price ?? ''}
                            onChange={e => handleEditItem(idx, 'base_service_price', e.target.value)}
                            size="small"
                            fullWidth
                            variant="outlined"
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 7 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            options={ADDON_SERVICE_OPTIONS}
                            value={Array.isArray(item.addon_services) ? item.addon_services : []}
                            onChange={(_, newValue) => {
                              const parsed = parseServicesInput(newValue);
                              handleEditItem(idx, 'addon_services', parsed);
                            }}
                            renderTags={(tagValue, getTagProps) =>
                              tagValue.map((option, tagIdx) => (
                                <Chip
                                  {...getTagProps({ index: tagIdx })}
                                  key={option + tagIdx}
                                  label={option}
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                  sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600 }}
                                />
                              ))
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Add-on Services"
                                placeholder={(!item.addon_services || !item.addon_services.length) ? "Select or type (e.g. White Paint, UNY)" : ""}
                                size="small"
                                fullWidth
                                variant="outlined"
                                onKeyDown={(e) => {
                                  if (e.key === ',' || e.key === '+') {
                                    const inputVal = (e.target as HTMLInputElement).value;
                                    if (inputVal && inputVal.trim()) {
                                      e.preventDefault();
                                      const currentVals = Array.isArray(item.addon_services) ? item.addon_services : [];
                                      const newParsed = parseServicesInput([...currentVals, inputVal]);
                                      handleEditItem(idx, 'addon_services', newParsed);
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const inputVal = e.target.value;
                                  if (inputVal && inputVal.trim()) {
                                    const currentVals = Array.isArray(item.addon_services) ? item.addon_services : [];
                                    const newParsed = parseServicesInput([...currentVals, inputVal]);
                                    handleEditItem(idx, 'addon_services', newParsed);
                                  }
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <TextField
                            label="Add-on Service Price"
                            value={item.addon_service_price ?? ''}
                            onChange={e => handleEditItem(idx, 'addon_service_price', e.target.value)}
                            size="small"
                            fullWidth
                            variant="outlined"
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            options={DEFAULT_CONDITIONS}
                            value={
                              Array.isArray(item.conditions)
                                ? item.conditions
                                : (typeof item.conditions === 'string' && item.conditions
                                    ? item.conditions.split(/[,+|\n]+/).map((s: string) => s.trim()).filter(Boolean)
                                    : [])
                            }
                            onChange={(_, newValue) => {
                              const parsed = parseConditionsInput(newValue);
                              handleEditItem(idx, 'conditions', parsed);
                            }}
                            renderTags={(tagValue, getTagProps) =>
                              tagValue.map((option, tagIdx) => (
                                <Chip
                                  {...getTagProps({ index: tagIdx })}
                                  key={option + tagIdx}
                                  label={option}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 24, fontSize: '0.75rem' }}
                                />
                              ))
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Conditions / Defects"
                                placeholder={(!item.conditions || (Array.isArray(item.conditions) && !item.conditions.length)) ? "Select or type conditions (e.g. scratches, sole separation)..." : ""}
                                size="small"
                                fullWidth
                                variant="outlined"
                                onKeyDown={(e) => {
                                  if (e.key === ',' || e.key === '+') {
                                    const inputVal = (e.target as HTMLInputElement).value;
                                    if (inputVal && inputVal.trim()) {
                                      e.preventDefault();
                                      const currentVals = Array.isArray(item.conditions)
                                        ? item.conditions
                                        : (typeof item.conditions === 'string' && item.conditions ? item.conditions.split(/[,+|\n]+/).map((s: string) => s.trim()).filter(Boolean) : []);
                                      const newParsed = parseConditionsInput([...currentVals, inputVal]);
                                      handleEditItem(idx, 'conditions', newParsed);
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const inputVal = e.target.value;
                                  if (inputVal && inputVal.trim()) {
                                    const currentVals = Array.isArray(item.conditions)
                                      ? item.conditions
                                      : (typeof item.conditions === 'string' && item.conditions ? item.conditions.split(/[,+|\n]+/).map((s: string) => s.trim()).filter(Boolean) : []);
                                    const newParsed = parseConditionsInput([...currentVals, inputVal]);
                                    handleEditItem(idx, 'conditions', newParsed);
                                  }
                                }}
                              />
                            )}
                          />
                        </Grid>
                    </Grid>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                      {/* Item Details Block - always show all fields so validators can see what OCR did/didn't extract */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: 0.5, columnGap: 1 }}>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Brand</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.brand ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.brand || 'NOT_RECORDED'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Model</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.model ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.model || 'NOT_RECORDED'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Color</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.color ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.color || 'NOT_RECORDED'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Material</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.material ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.material || 'NOT_RECORDED'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Size</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.size ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.size || 'NOT_RECORDED'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Claimed</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.claimed_date ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                            {displayMmDdYyyy(item.claimed_date) || '—'}
                          </Typography>
                        </>
                        {(cleanRemarks(item.remarks) || (typeof item.conditions === 'string' && item.conditions)) && (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Remarks</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                              {cleanRemarks(item.remarks) || item.conditions}
                            </Typography>
                          </>
                        )}
                      </Box>

                      {/* Services Blocks - always shown */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box>
                          <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1.2 }}>BASE SERVICE</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.base_services?.length > 0 ? 'text.primary' : 'text.disabled' }}>
                            {item.base_services?.length > 0 ? formatServiceGroupBreakdown(item, 'base') : '—'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1.2 }}>ADD-ONS</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.addon_services?.length > 0 ? 'text.primary' : 'text.disabled' }}>
                            {item.addon_services?.length > 0 ? formatServiceGroupBreakdown(item, 'addon') : '—'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Conditions Block */}
                      {item.conditions && item.conditions.length > 0 && (
                        <Box>
                          <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1.2 }}>CONDITIONS</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {item.conditions.map((cond: string, cIdx: number) => (
                              <Chip key={cIdx} label={cond} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}

                      <Box sx={{ pt: 1 }}>
                          <Box sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'bold', fontSize: '0.75rem' }}>Total Price:</Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {displayItemPrice(item)}
                              </Typography>
                            </Box>
                            {(() => {
                              const breakdown = formatTotalPriceLine(item);
                              const total = displayItemPrice(item);
                              if (!breakdown || breakdown === total || breakdown === 'FREE' || breakdown === '—') return null;
                              return (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.25, fontWeight: 600, textAlign: 'left' }}>
                                  {breakdown}
                                </Typography>
                              );
                            })()}
                          </Box>
                      </Box>
                    </Box>
                  )}
                </Card>
                </Grid>
              ))}
              </Grid>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>Order Totals & Payment</Typography>
              
              {/* COMPUTE DISCREPANCY */}
              {(() => {
                const toNum = (val: any) => {
                  if (val === undefined || val === null || val === '') return null;
                  const n = parseFloat(val);
                  return isNaN(n) ? null : n;
                };
                const itemsToSum = (editMode ? editedData?.items : currentItem.order?.items) || [];
                const orderForTotals = editMode ? editedData : currentItem.order;
                const pricedItems = itemsToSum.filter((item: any) => toNum(item.item_price) !== null);
                const itemsSubtotal = pricedItems.reduce((acc: number, item: any) => acc + (toNum(item.item_price) || 0), 0);
                const rushAmt = orderRushFee({ ...orderForTotals, items: itemsToSum });
                const calculatedTotal = Math.round((itemsSubtotal + rushAmt) * 100) / 100;
                const recordedOriginal = editMode
                  ? toNum(editedData?.original_grand_total)
                  : toNum(currentItem.order?.original_grand_total);
                const recordedTotal = editMode ? toNum(editedData?.grand_total) : toNum(currentItem.order?.grand_total);
                const recordedDiscount = editMode
                  ? toNum(editedData?.discount)
                  : toNum(currentItem.order?.discount);
                const recordedDiscountPercent = editMode
                  ? toNum(editedData?.discount_percent)
                  : toNum(currentItem.order?.discount_percent);
                const recordedDiscountType = editMode
                  ? String(editedData?.discount_type || 'amount').toLowerCase()
                  : String(currentItem.order?.discount_type || 'amount').toLowerCase();
                const recordedDownpayment = editMode ? toNum(editedData?.downpayment) : toNum(currentItem.order?.downpayment);
                const recordedBalance = editMode ? toNum(editedData?.balance) : toNum(currentItem.order?.balance);
                const priceDiff = recordedTotal !== null ? Math.round((recordedTotal - calculatedTotal) * 100) / 100 : null;
                const hasPriceDifference = priceDiff !== null && Math.abs(priceDiff) > 0.01;
                const discountDisplay = editMode
                  ? toNum(editedData?.discount_value)
                  : (recordedDiscount != null && recordedDiscount > 0.009 ? recordedDiscount : null);
                const hasExplicitDiscount = editMode ? Boolean(editedData?.discount_enabled) : (discountDisplay !== null && discountDisplay > 0.009);
                const percentLabel = recordedDiscountPercent != null && recordedDiscountPercent > 0
                  ? recordedDiscountPercent
                  : (recordedOriginal != null && recordedOriginal > 0 && discountDisplay != null
                    ? Math.round((discountDisplay / recordedOriginal) * 1000) / 10
                    : null);
                const calculatedBalance = recordedTotal !== null && recordedDownpayment !== null
                  ? Math.round((recordedTotal - recordedDownpayment) * 100) / 100
                  : null;
                const hasPaymentDiscrepancy = calculatedBalance !== null && recordedBalance !== null
                  && Math.abs(calculatedBalance - recordedBalance) > 0.009;
                
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {rushAmt > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">
                          Rush Fee (once for this job order)
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">₱{formatMoney(rushAmt)}</Typography>
                      </Box>
                    )}
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexWrap: 'wrap' }}>
                      <Box sx={{ flex: 1.2, p: 1.5, minWidth: '140px', borderRight: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          HISTORICAL GRAND TOTAL (SOURCE)
                        </Typography>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#0f172a' }}>
                          ₱{formatMoney(recordedTotal)}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1.2, p: 1.5, minWidth: '140px', borderRight: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          CURRENT/REFERENCE SERVICE TOTAL
                        </Typography>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#2563eb' }}>
                          ₱{formatMoney(calculatedTotal)}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: hasPriceDifference ? (priceDiff < 0 ? '#fff1f2' : '#f0fdf4') : '#f8fafc' }}>
                        <Typography variant="caption" sx={{ color: hasPriceDifference ? (priceDiff < 0 ? '#e11d48' : '#16a34a') : 'text.secondary', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          DIFFERENCE
                        </Typography>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: hasPriceDifference ? (priceDiff < 0 ? '#e11d48' : '#16a34a') : '#64748b' }}>
                          {priceDiff !== null ? (priceDiff > 0 ? `+₱${formatMoney(priceDiff)}` : priceDiff < 0 ? `-₱${formatMoney(Math.abs(priceDiff))}` : '₱0.00') : '—'}
                        </Typography>
                      </Box>
                      {hasExplicitDiscount && (
                        <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                            DISCOUNT AMOUNT
                          </Typography>
                          <Typography variant="subtitle1" fontWeight="bold">
                            ₱{formatMoney(discountDisplay)}
                          </Typography>
                          {percentLabel != null && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {recordedDiscountType === 'percent' ? `${formatMoney(percentLabel)}%` : `≈ ${formatMoney(percentLabel)}%`}
                            </Typography>
                          )}
                        </Box>
                      )}
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '110px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }}>DOWNPAYMENT</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">₱{formatMoney(recordedDownpayment)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '110px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }}>BALANCE</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">₱{formatMoney(recordedBalance)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '110px', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }}>PAYMENT METHOD</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">{displayPaymentMethod(editMode ? editedData?.payment_method : currentItem.order?.payment_method)}</Typography>
                      </Box>
                    </Box>
                    
                    {hasPriceDifference && (
                      <Alert severity="info" sx={{ py: 1, px: 2, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e40af', fontSize: '0.8125rem' }}>
                              HISTORICAL PRICE DIFFERENCE — Source grand total differs from the total calculated using current service prices.
                            </Typography>
                            <Chip 
                              label="SOURCE TOTAL DIFFERS FROM CURRENT REFERENCE PRICING" 
                              size="small" 
                              sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: '0.68rem', height: 20 }} 
                            />
                          </Box>
                          <Typography variant="caption" sx={{ color: '#475569', fontSize: '0.75rem', lineHeight: 1.4 }}>
                            Current service prices are displayed for reference only and are not used to alter historical transaction amounts.
                          </Typography>
                        </Box>
                      </Alert>
                    )}

                    {hasPaymentDiscrepancy && (
                      <Alert severity="warning" sx={{ py: 0.75, px: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                          Payment discrepancy detected: Recorded Downpayment (₱{formatMoney(recordedDownpayment)}) + Balance (₱{formatMoney(recordedBalance)}) does not equal Recorded Total (₱{formatMoney(recordedTotal)}). Please verify against the original document.
                        </Typography>
                      </Alert>
                    )}

                    {editMode && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={Boolean(editedData?.discount_enabled)}
                              onChange={(e) => handleEditChange('discount_enabled', e.target.checked)}
                            />
                          }
                          label="Apply discount"
                          sx={{ m: 0, alignSelf: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: '0.875rem', fontWeight: 600 } }}
                        />
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField 
                              fullWidth size="small" select
                              label="Payment Method" 
                              value={['Cash', 'GCash', 'Maya'].includes(String(editedData?.payment_method || ''))
                                ? editedData.payment_method
                                : 'Cash'} 
                              onChange={(e) => handleEditChange('payment_method', e.target.value)}
                              variant="outlined"
                              InputLabelProps={{ shrink: true }}
                            >
                              <MenuItem value="Cash">Cash</MenuItem>
                              <MenuItem value="GCash">GCash</MenuItem>
                              <MenuItem value="Maya">Maya</MenuItem>
                            </TextField>
                          </Grid>
                          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                            <TextField 
                              fullWidth size="small"
                              label={editedData?.discount_enabled ? 'Subtotal' : 'Grand Total'}
                              value={editedData?.discount_enabled
                                ? (editedData?.original_grand_total ?? '')
                                : (editedData?.grand_total ?? '')}
                              onChange={(e) => handleEditChange(
                                editedData?.discount_enabled ? 'original_grand_total' : 'grand_total',
                                e.target.value,
                              )}
                              onBlur={() => {
                                if (editedData?.discount_enabled) {
                                  const num = toFiniteMoney(editedData?.original_grand_total);
                                  if (num != null) handleEditChange('original_grand_total', num.toFixed(2));
                                } else {
                                  const num = toFiniteMoney(editedData?.grand_total);
                                  if (num != null) handleEditChange('grand_total', num.toFixed(2));
                                }
                              }}
                              InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                              InputLabelProps={{ shrink: true }}
                              title={editedData?.discount_enabled ? 'Amount before discount' : 'Order total'}
                              variant="outlined"
                            />
                          </Grid>
                          {editedData?.discount_enabled && (
                            <>
                              <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                                <TextField 
                                  fullWidth size="small"
                                  label="Discount"
                                  value={editedData?.discount_value ?? ''} 
                                  onChange={(e) => handleEditChange('discount_value', e.target.value)}
                                  InputLabelProps={{ shrink: true }}
                                  InputProps={{
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        {String(editedData?.discount_type || 'amount') === 'percent' ? '%' : '₱'}
                                      </InputAdornment>
                                    ),
                                    endAdornment: (
                                      <InputAdornment position="end">
                                        <ToggleButtonGroup
                                          exclusive
                                          size="small"
                                          value={String(editedData?.discount_type || 'amount') === 'percent' ? 'percent' : 'amount'}
                                          onChange={(_e, val) => {
                                            if (val) handleEditChange('discount_type', val);
                                          }}
                                          aria-label="Discount as amount or percent"
                                        >
                                          <ToggleButton value="amount" sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>₱</ToggleButton>
                                          <ToggleButton value="percent" sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>%</ToggleButton>
                                        </ToggleButtonGroup>
                                      </InputAdornment>
                                    ),
                                  }}
                                  variant="outlined"
                                />
                              </Grid>
                              <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                                <TextField 
                                  fullWidth size="small"
                                  label="Final Total"
                                  value={toFiniteMoney(editedData?.grand_total) != null ? Number(editedData.grand_total).toFixed(2) : (editedData?.grand_total ?? '')} 
                                  InputProps={{
                                    readOnly: true,
                                    startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                                  }}
                                  InputLabelProps={{ shrink: true }}
                                  title="Payable after discount"
                                  variant="filled"
                                />
                              </Grid>
                            </>
                          )}
                          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                            <TextField 
                              fullWidth size="small"
                              label="Downpayment" 
                              value={editedData?.downpayment ?? ''} 
                              onChange={(e) => handleEditChange('downpayment', e.target.value)}
                              onBlur={() => {
                                const num = toFiniteMoney(editedData?.downpayment);
                                if (num != null) handleEditChange('downpayment', num.toFixed(2));
                              }}
                              InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                              InputLabelProps={{ shrink: true }}
                              title="Cannot exceed payable"
                              variant="outlined"
                            />
                          </Grid>
                          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                            <TextField 
                              fullWidth size="small"
                              label="Balance" 
                              value={editedData?.balance ?? ''} 
                              onChange={(e) => handleEditChange('balance', e.target.value)}
                              onBlur={() => {
                                const num = toFiniteMoney(editedData?.balance);
                                if (num != null) handleEditChange('balance', num.toFixed(2));
                              }}
                              InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                              InputLabelProps={{ shrink: true }}
                              title="Payable − downpayment"
                              variant="outlined"
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Box>

            {/* Sticky Action Bar */}
            <Divider />
            <Box
              sx={{
                p: 2,
                display: 'flex',
                gap: 2,
                bgcolor: '#ffffff',
                alignItems: 'center',
                flexDirection: { xs: 'column', sm: 'row' },
                position: 'sticky',
                bottom: 0,
                zIndex: 10,
                borderTop: '1px solid #e2e8f0',
                boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
              }}
            >
              {!editMode ? (
                <>
                  <Button 
                    variant="contained" 
                    color="success" 
                    startIcon={<CheckCircle />}
                    onClick={() => handleAction('approve')}
                    disabled={busy}
                    sx={{ flex: 1, minHeight: 46, height: 46, fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.05em', width: { xs: '100%', sm: 'auto' }, borderRadius: 2 }}
                  >
                    ACCEPT VALIDATION
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    startIcon={<Edit />}
                    onClick={startEdit}
                    disabled={busy}
                    sx={{ flex: 1, minHeight: 46, height: 46, fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.05em', width: { xs: '100%', sm: 'auto' }, borderRadius: 2 }}
                  >
                    EDIT
                  </Button>
                  <Button 
                    variant="contained" 
                    color="error" 
                    startIcon={<Cancel />}
                    onClick={() => {
                      setRejectionCategory('confirmed duplicate');
                      setRejectReason('Confirmed duplicate');
                      setShowRejectConfirm(true);
                    }}
                    disabled={busy}
                    sx={{ flex: 1, minHeight: 46, height: 46, fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.05em', width: { xs: '100%', sm: 'auto' }, borderRadius: 2 }}
                  >
                    REJECT
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="contained" 
                    color="success" 
                    startIcon={<CheckCircle />}
                    onClick={() => handleAction('approve')}
                    disabled={busy}
                    sx={{ flex: 1, minHeight: 46, height: 46, fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.05em', width: { xs: '100%', sm: 'auto' }, borderRadius: 2 }}
                  >
                    ACCEPT WITH CORRECTIONS
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => handleAction('save')}
                    disabled={busy}
                    sx={{ flex: 1, minHeight: 46, height: 46, fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.05em', width: { xs: '100%', sm: 'auto' }, borderRadius: 2 }}
                  >
                    {busy ? 'Saving…' : 'Save Corrections (Stay in Queue)'}
                  </Button>
                  <Button 
                    variant="contained" 
                    color="inherit" 
                    onClick={() => setEditMode(false)}
                    disabled={busy}
                    sx={{ flex: 1, minHeight: 46, height: 46, fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.05em', width: { xs: '100%', sm: 'auto' }, borderRadius: 2, bgcolor: 'grey.300', '&:hover': { bgcolor: 'grey.400' } }}
                  >
                    Cancel Edit
                  </Button>
                </>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Confirmation Dialog for Rejecting Record */}
      <Dialog open={showRejectConfirm} onClose={() => setShowRejectConfirm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'error.main' }}>
          Reject this historical record?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will flag the pending historical record as rejected and prevent it from entering the canonical dataset. The decision and original evidence will remain preserved in the audit trail.
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="Rejection Category"
            value={rejectionCategory}
            onChange={(e) => {
              const val = e.target.value;
              setRejectionCategory(val);
              if (val !== 'Other') {
                setRejectReason(val.charAt(0).toUpperCase() + val.slice(1));
              } else {
                setRejectReason('');
              }
            }}
            sx={{ mb: 2 }}
          >
            <MenuItem value="confirmed duplicate">Confirmed duplicate</MenuItem>
            <MenuItem value="cannot identify genuine transaction">Cannot identify genuine transaction</MenuItem>
            <MenuItem value="source corruption prevents reliable interpretation">Source corruption prevents reliable interpretation</MenuItem>
            <MenuItem value="record does not represent an actual Shoelotskey order">Record does not represent an actual Shoelotskey order</MenuItem>
            <MenuItem value="Other">Other (specify custom reason below)</MenuItem>
          </TextField>
          <TextField
            fullWidth
            required
            multiline
            rows={3}
            size="small"
            label="Rejection Justification *"
            placeholder="Explain why this record cannot serve as a canonical historical transaction..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            helperText="A valid reason is required. Note: Missing fields (Color, Material, Claimed Date, Priority) are historically valid and should NOT be rejected solely for missing data."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowRejectConfirm(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={busy || !rejectReason.trim()}
            onClick={async () => {
              const reasonToSubmit = rejectReason.trim();
              setShowRejectConfirm(false);
              await handleAction('reject', reasonToSubmit);
            }}
          >
            Reject Record
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

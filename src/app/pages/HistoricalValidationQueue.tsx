import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, IconButton, 
  Divider, TextField, Card, CircularProgress, Alert, MenuItem, InputAdornment, Chip, Autocomplete
} from '@mui/material';
import { CheckCircle, Cancel, Edit, ArrowBack, Refresh, Add, DeleteOutline, DocumentScanner } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
// P1-10 FIX: this previously hardcoded `http://localhost:8000/api` unconditionally, which
// would fail outright in production (this component is reachable by the admin-only
// Historical Records module on the live Heroku deployment). Centralized (see
// src/app/lib/apiBase.ts) so this correctly targets same-origin `/api` in production.
import { API_BASE } from '@/app/lib/apiBase';
const API_BASE_URL = API_BASE;
const OCR_REVIEW_POSITION_KEY = 'shoelotskey.ocrReview.currentImageId';

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
  user: { username: string; role: 'owner' | 'staff' | 'admin'; token: string };
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
  const [imageUrl, setImageUrl] = useState<string>('');
  const [previewKind, setPreviewKind] = useState<'image' | 'pdf'>('image');
  const [busy, setBusy] = useState(false);
  
  const navigate = useNavigate();

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user.token}`,
  });

  const fetchQueue = async (opts?: { keepPosition?: boolean }) => {
    const keepPosition = opts?.keepPosition !== false;
    const previousId = keepPosition
      ? (queue[currentIndex]?.historical_image_id ?? recalledOcrPosition())
      : null;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/historical/processing/queue?limit=800`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(`Queue request failed (${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Queue response was not a list');
      setQueue(data);
      setEditMode(false);
      const restoredIdx = previousId != null
        ? data.findIndex((item: any) => item?.historical_image_id === previousId)
        : -1;
      const nextIdx = restoredIdx >= 0 ? restoredIdx : 0;
      setCurrentIndex(nextIdx);
      if (data[nextIdx]?.historical_image_id != null) {
        rememberOcrPosition(data[nextIdx].historical_image_id);
      }
      setPendingTotal(data.length);
      try {
        const statsRes = await fetch(`${API_BASE_URL}/historical/stats`, {
          headers: authHeaders(),
        });
        if (statsRes.ok) {
          const stats = await statsRes.json();
          const total = Number(stats.pending_ocr ?? stats.pending_review ?? data.length);
          if (Number.isFinite(total)) setPendingTotal(total);
        }
      } catch {
        // Stats must never hide a successfully loaded queue.
      }
    } catch (error) {
      console.error("Failed to fetch queue", error);
      setQueue([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue({ keepPosition: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = queue[currentIndex]?.historical_image_id;
    if (id != null) rememberOcrPosition(id);
  }, [queue, currentIndex]);

  useEffect(() => {
    const filename = queue[currentIndex]?.image_filename;
    if (!filename || !user.token) {
      setImageUrl('');
      return;
    }
    let objectUrl = '';
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/historical/image/${encodeURIComponent(filename)}`,
          { headers: { Authorization: `Bearer ${user.token}` } },
        );
        if (!res.ok) throw new Error('image');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        const type = (res.headers.get('content-type') || blob.type || '').toLowerCase();
        setPreviewKind(
          type.includes('pdf') || String(filename).toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
        );
        setImageUrl(url);
      } catch {
        if (!cancelled) setImageUrl('');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [queue, currentIndex, user.token]);

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
    CR: 325, 'COLOR RENEWAL': 325,
    MRET: 125, 'MINOR RETOUCH': 125,
    MRES: 225, 'MINOR RESTORATION': 225,
    UNY: 125, UY: 125, UNYELLOWING: 125,
    '2CR': 200, '2CL': 200, '2 COLORS': 200,
    '3CR': 300, '3CL': 300, '3 COLORS': 300,
    UFR: 150, 'UNDERSOLE FULL REGLUE': 150,
    MFR: 150, 'MIDSOLE FULL REGLUE': 150,
  };

  const serviceCodeLabel = (name: string) => {
    const compact = String(name || '').replace(/[\s\-]+/g, '').toUpperCase();
    const names: Record<string, string> = {
      BASICCLEANING: 'BC',
      MINORREGLUE: 'MR',
      FULLREGLUE: 'FR',
      COLORRENEWAL: 'CR',
      MINORRETOUCH: 'MRET',
      MINORRESTORATION: 'MRES',
      UNYELLOWING: 'UNY',
      TWOCOLORS: '2CR',
      '2COLORS': '2CR',
      '2CL': '2CR',
      THREECOLORS: '3CR',
      '3COLORS': '3CR',
      '3CL': '3CR',
      UNDERSOLEFULLREGLUE: 'UFR',
      MIDSOLEFULLREGLUE: 'MFR',
      UY: 'UNY',
    };
    if (compact === 'UY') return 'UNY';
    return names[compact] || compact;
  };

  const BASE_SERVICE_LABELS: Record<string, string> = {
    BC: 'Basic Cleaning',
    MR: 'Minor Reglue',
    FR: 'Full Reglue',
    CR: 'Color Renewal',
  };
  const ADDON_SERVICE_LABELS: Record<string, string> = {
    UNY: 'Unyellowing',
    UY: 'Unyellowing',
    MRES: 'Minor Restoration',
    MRET: 'Minor Retouch',
    '2CR': '2 Colors',
    '3CR': '3 Colors',
    UFR: 'Undersole Full Reglue',
    MFR: 'Midsole Full Reglue',
  };

  const isAddonService = (name: string) => {
    const code = serviceCodeLabel(name);
    return Boolean(ADDON_SERVICE_LABELS[code]);
  };

  const serviceFullName = (name: string) => {
    const code = serviceCodeLabel(name);
    return BASE_SERVICE_LABELS[code] || ADDON_SERVICE_LABELS[code] || String(name || '').trim();
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
    return match ? Number(match.price) : '';
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
      if (amount !== '' && names.length) prices[names[0]] = amount;
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
    if (!next.prices_manual && explicitGroupPrice(next, 'base') === '' && baseNames.length && service_prices[baseNames[0]] != null) {
      next.base_service_price = service_prices[baseNames[0]];
    }
    if (!next.prices_manual && explicitGroupPrice(next, 'addon') === '' && addonNames.length && service_prices[addonNames[0]] != null) {
      next.addon_service_price = service_prices[addonNames[0]];
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

  const handleAction = async (action: 'approve' | 'reject' | 'correct' | 'save') => {
    if (queue.length === 0 || busy) return;
    const currentImg = queue[currentIndex];
    const stayInQueue = action === 'correct' || action === 'save';
    const snapshot = stayInQueue || action === 'approve' ? currentSnapshot() : undefined;

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
          corrections: action === 'reject' ? undefined : snapshot,
        }),
      });
      if (!res.ok) {
        throw new Error(stayInQueue ? 'Failed to save corrections' : 'Failed to validate record');
      }

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
      setPendingTotal((total) => (total != null ? Math.max(0, total - 1) : total));
      if (remaining.length === 0) {
        rememberOcrPosition(null);
        await fetchQueue({ keepPosition: false });
      } else {
        const nextIdx = Math.min(currentIndex, remaining.length - 1);
        setCurrentIndex(nextIdx);
        rememberOcrPosition(remaining[nextIdx]?.historical_image_id);
      }
    } catch (error: any) {
      console.error(`Failed to ${action} record`, error);
      alert(`${stayInQueue ? 'Failed to save corrections' : 'Failed to validate record'}: ${error.message || 'Server Error'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReocr = async () => {
    const currentImg = queue[currentIndex];
    if (!currentImg?.historical_image_id || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/historical/processing/reocr/${currentImg.historical_image_id}`,
        { method: 'POST', headers: authHeaders() },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail;
        const message = Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
          : (typeof detail === 'string' ? detail : null);
        throw new Error(message || `Re-OCR failed (${res.status})`);
      }
      if (data?.item) {
        setQueue((prev) => prev.map((item, i) => (i === currentIndex ? data.item : item)));
        setEditMode(false);
        setEditedData(null);
      }
      if (data?.usable) {
        toast.success(`OCR refreshed (${data.engine || 'engine'}, ${Math.round((data.confidence || 0) * 100)}%). Review the filled fields.`);
      } else {
        toast.message('OCR ran again but still could not read most fields. Keep verifying against the scan.');
      }
    } catch (error: any) {
      console.error('Re-OCR failed', error);
      toast.error(error?.message || 'Re-OCR failed');
    } finally {
      setBusy(false);
    }
  };

  const roundMoney = (n: number) => Math.round(n * 100) / 100;

  const syncBalanceFromGrand = (next: any) => {
    const grand = Number(next.grand_total);
    const down = Number(next.downpayment);
    if (Number.isFinite(grand) && Number.isFinite(down)) {
      next.balance = roundMoney(grand - down);
    }
    return next;
  };

  /** Apply ₱ or % discount against original; discounted grand_total is the final total. */
  const recomputeFromDiscount = (next: any) => {
    const dtype = String(next.discount_type || 'amount').toLowerCase() === 'percent' ? 'percent' : 'amount';
    next.discount_type = dtype;
    let original = Number(next.original_grand_total);
    if (!Number.isFinite(original) || original <= 0) {
      const fallback = Number(next.grand_total);
      if (Number.isFinite(fallback) && fallback > 0) {
        original = fallback;
        next.original_grand_total = original;
      }
    }
    const rawInput = next.discount_value;
    if (rawInput === '' || rawInput == null) {
      next.discount = null;
      next.discount_percent = null;
      if (Number.isFinite(original) && original > 0) {
        next.grand_total = original;
      }
      next.original_grand_total = null;
      return syncBalanceFromGrand(next);
    }
    const inputNum = Number(rawInput);
    if (!Number.isFinite(inputNum) || inputNum < 0 || !Number.isFinite(original) || original <= 0) {
      return next;
    }
    let discountAmt = 0;
    let percent: number | null = null;
    if (dtype === 'percent') {
      percent = Math.min(100, inputNum);
      next.discount_percent = percent;
      discountAmt = roundMoney(original * (percent / 100));
    } else {
      discountAmt = roundMoney(Math.min(original, inputNum));
      percent = original > 0 ? roundMoney((discountAmt / original) * 100) : null;
      next.discount_percent = percent;
    }
    next.discount = discountAmt;
    next.grand_total = roundMoney(Math.max(0, original - discountAmt));
    return syncBalanceFromGrand(next);
  };

  const handleEditChange = (field: string, value: any) => {
    setEditedData((prev: any) => {
      if (field === 'priority') {
        const rushFee = String(value).toLowerCase() === 'rush'
          ? resolveRushFeeAmount({ ...prev, priority: value })
          : prev?.rush_fee;
        return applyRushPricingToOrder(prev, value, rushFee);
      }
      if (field === 'rush_fee') {
        if (String(prev?.priority || '').toLowerCase() !== 'rush') {
          return { ...prev, rush_fee: value };
        }
        return applyRushPricingToOrder(prev, 'rush', value);
      }
      const next = { ...prev, [field]: value };
      if (field === 'completion_days' || field === 'date_received') {
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
      if (field === 'discount_type' || field === 'discount_value') {
        return recomputeFromDiscount(next);
      }
      if (field === 'original_grand_total') {
        if (value === '' || value == null) {
          next.discount = null;
          next.discount_percent = null;
          next.discount_value = '';
          return syncBalanceFromGrand(next);
        }
        if (next.discount_value !== '' && next.discount_value != null) {
          return recomputeFromDiscount(next);
        }
        // No discount yet — original edit mirrors the payable total.
        next.grand_total = value;
        return syncBalanceFromGrand(next);
      }
      if (field === 'grand_total') {
        // Manual override of discounted/final total.
        const original = Number(next.original_grand_total);
        const discounted = Number(value);
        if (Number.isFinite(original) && Number.isFinite(discounted) && original >= discounted) {
          const amt = roundMoney(original - discounted);
          next.discount = amt;
          next.discount_type = next.discount_type || 'amount';
          if (String(next.discount_type).toLowerCase() === 'percent') {
            next.discount_percent = original > 0 ? roundMoney((amt / original) * 100) : null;
            next.discount_value = next.discount_percent;
          } else {
            next.discount_value = amt;
            next.discount_percent = original > 0 ? roundMoney((amt / original) * 100) : null;
          }
        } else if (!Number.isFinite(original) || original <= 0) {
          next.discount = null;
          next.discount_percent = null;
          next.original_grand_total = null;
        }
        return syncBalanceFromGrand(next);
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
        names.forEach((name, nameIdx) => {
          if (amount === '') delete service_prices[name];
          else if (nameIdx === 0) service_prices[name] = amount;
          else delete service_prices[name];
        });
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
      newItems[idx] = nextItem;
      const nextOrder = { ...prev, items: newItems };
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
    let draft: any = {
      ...orderCopy,
      control_no: orderCopy.control_no ?? '',
      payment_method: orderCopy.payment_method || 'Cash',
      rush_fee: rushFee,
      items: (orderCopy.items || []).map((item: any) => {
        const basePrice = explicitGroupPrice(item, 'base');
        const addonPrice = explicitGroupPrice(item, 'addon');
        const hasServices = Boolean(
          (Array.isArray(item.base_services) && item.base_services.length)
          || (Array.isArray(item.addon_services) && item.addon_services.length)
        );
        const remarksFree = String(item.remarks || '').trim().toUpperCase().startsWith('FREE');
        // Empty OCR placeholder wrongly flagged FREE → leave blank so a real amount can be typed.
        const free = Boolean(item.is_free) && (hasServices || remarksFree || Boolean(item.brand));
        return {
          ...item,
          brand: item.brand || '',
          model: item.model || '',
          material: item.material || '',
          color: item.color || '',
          size: item.size || '',
          remarks: item.remarks || '',
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
    }
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
          The review queue could not be loaded. Pending OCR records were not validated or deleted.
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

  if (queue.length === 0) {
    if (pendingTotal && pendingTotal > 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
            About {pendingTotal} records are still waiting for review, but this page did not receive them.
            They were not validated or deleted.
          </Alert>
          <Button variant="contained" startIcon={<Refresh />} onClick={() => { void fetchQueue(); }} sx={{ mr: 1 }}>
            Retry Queue
          </Button>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => onBack ? onBack() : navigate('/job-order-form/historical-records')}>
            Return to Historical Records
          </Button>
        </Box>
      );
    }
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h5" gutterBottom>Validation Queue Empty</Typography>
        <Typography color="textSecondary" sx={{ mb: 3 }}>All historical records have been successfully validated.</Typography>
        <Button variant="outlined" startIcon={<Refresh />} onClick={() => { void fetchQueue(); }} sx={{ mr: 1 }}>
          Refresh Queue
        </Button>
        <Button variant="contained" startIcon={<ArrowBack />} onClick={() => onBack ? onBack() : navigate('/job-order-form/historical-records')}>
          Return to Historical Records
        </Button>
      </Box>
    );
  }

  const currentItem = queue[currentIndex];

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => onBack ? onBack() : navigate('/job-order-form/historical-records')}><ArrowBack /></IconButton>
          <Typography variant="h5">
            Needs Human Review ({currentIndex + 1} of {queue.length}
            {pendingTotal !== null && pendingTotal > queue.length ? ` · ${pendingTotal} pending` : ''})
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {currentItem?.historical_image_id && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DocumentScanner />}
              onClick={handleReocr}
              disabled={busy}
            >
              {busy ? 'Running OCR…' : 'Re-run OCR'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => fetchQueue({ keepPosition: true })}
            disabled={busy}
            title="Reload queue but stay on this scan"
          >
            Refresh Queue
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        {/* Left Side: Original Document (45%) */}
        <Grid size={{ xs: 12, md: 5.4 }} sx={{ display: 'flex', flexDirection: 'column', height: { xs: '50vh', md: '100%' } }}>
          <Paper variant="outlined" sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Original Scanned Document</Typography>
                <Typography variant="body2" color="textSecondary">{currentItem.image_filename}</Typography>
              </Box>
              {currentItem?.historical_image_id && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<DocumentScanner />}
                  onClick={handleReocr}
                  disabled={busy}
                  sx={{ flexShrink: 0 }}
                >
                  {busy ? 'Running…' : 'Re-run OCR'}
                </Button>
              )}
            </Box>
            <Box sx={{ flex: 1, position: 'relative', bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: 1, overflowY: 'auto' }}>
              {imageUrl ? (
                previewKind === 'pdf' ? (
                  <iframe
                    src={imageUrl}
                    title="Receipt PDF"
                    style={{ width: '100%', height: '100%', minHeight: 420, border: 0 }}
                  />
                ) : (
                  <img
                    src={imageUrl}
                    alt="Receipt"
                    style={{ width: '100%', objectFit: 'contain', objectPosition: 'top' }}
                  />
                )
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">Source image could not be loaded.</Typography>
                  <Typography variant="caption">{currentItem.image_filename}</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Right Side: Extracted Data (55%) */}
        <Grid size={{ xs: 12, md: 6.6 }} sx={{ display: 'flex', flexDirection: 'column', height: { xs: 'auto', md: '100%' } }}>
          <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold">Extracted Data</Typography>
              <Typography variant="body2">Confidence: {(currentItem.ocr_confidence * 100).toFixed(1)}%</Typography>
            </Box>

            <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
              {currentItem.ocr_empty && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  action={
                    currentItem.historical_image_id ? (
                      <Button
                        color="inherit"
                        size="small"
                        startIcon={<DocumentScanner />}
                        disabled={busy}
                        onClick={handleReocr}
                      >
                        Re-run OCR
                      </Button>
                    ) : undefined
                  }
                >
                  <Typography variant="body2" fontWeight={600}>
                    OCR did not extract line items for this scan.
                  </Typography>
                  <Typography variant="body2">
                    Brand, service, item price, downpayment, and balance were not stored — that is why the form looks empty and needs typing from the paper image. Use <strong>Re-run OCR</strong> to try again, then save corrections once.
                  </Typography>
                </Alert>
              )}
              {(currentItem.missing_fields?.length > 0 || (currentItem.ocr_confidence ?? 1) < 0.7) && !currentItem.ocr_empty && (
                <Alert severity="warning" sx={{ mb: 2, py: 0 }}>
                  <Typography variant="body2">
                    ⚠ Low OCR confidence detected. Please verify highlighted fields against the original scan.
                    {currentItem.missing_fields?.length > 0 && (
                      <> Fields to verify: {currentItem.missing_fields.filter((f: string) => !f.startsWith('pair_') || f.endsWith('_item_price') || f.endsWith('_brand')).slice(0, 8).join(', ')}</>
                    )}
                  </Typography>
                </Alert>
              )}
              {currentItem.source_document_ref
                && currentItem.source_document_ref !== currentItem.order?.order_id && (
                <Alert severity="info" sx={{ mb: 2, py: 0 }}>
                  <Typography variant="body2">
                    Original document / control number: <strong>{currentItem.source_document_ref}</strong>
                  </Typography>
                </Alert>
              )}
              {currentItem.raw_text_summary && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    OCR text snapshot (copy from here instead of retyping from scratch)
                  </Typography>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      m: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      maxHeight: 120,
                      overflow: 'auto',
                    }}
                  >
                    {currentItem.raw_text_summary}
                  </Typography>
                </Alert>
              )}

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>Customer Information</Typography>
              <Grid container spacing={1} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Order ID" 
                    value={editMode ? editedData?.order_id : currentItem.order?.order_id} 
                    onChange={(e) => handleEditChange('order_id', e.target.value)}
                    InputProps={{ readOnly: !editMode }}
                    helperText={!editMode ? 'Canonical ORD-YYYY-MM-DD-NNN' : undefined}
                    variant={editMode ? "outlined" : "filled"}
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
                    helperText={editMode ? 'Optional — leave blank if none on the form' : 'Paper form control number (optional)'}
                    placeholder={editMode ? 'Optional' : undefined}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
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
                      helperText="Usually ₱100 or ₱150 — added to items with Basic Cleaning and grand total"
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
                      helperText="Per item with Basic Cleaning"
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 4 }}>
                  {editMode ? (
                    <TextField
                      fullWidth size="small"
                      label="Total Days"
                      type="number"
                      value={editedData?.completion_days ?? ''}
                      onChange={(e) => handleEditChange('completion_days', e.target.value)}
                      variant="outlined"
                    />
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label="Total Days"
                      value={currentItem.order?.completion_days ?? '—'}
                      InputProps={{ readOnly: true }}
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
                          helperText="From form DATE & TIME"
                          variant="outlined"
                        />
                      </Grid>
                      <Grid size={{ xs: 5 }}>
                        <TextField
                          fullWidth size="small"
                          label="Time (Optional)"
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
                          helperText="e.g. 1:08 PM → 13:08"
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
                      value={datePartOf(editedData?.expected_release_date || editedData?.original_estimated_release_date)}
                      onChange={(e) => handleEditChange('expected_release_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
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
                      value={datePartOf(editedData?.claimed_date)}
                      onChange={(e) => handleEditChange('claimed_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
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
                    onChange={(e) => handleEditChange('customer', { ...editedData?.customer, name: e.target.value })}
                    InputProps={{ readOnly: !editMode }}
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
                      {!editMode && (!item.brand || !item.base_services?.length) && (
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
                           options={['Nike', 'Adidas', 'Jordan', 'New Balance', 'Converse', 'Vans', 'Puma']}
                           value={item.brand || ''}
                           onChange={(_, newValue) => handleEditItem(idx, 'brand', newValue)}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'brand', newInputValue)}
                           renderInput={(params) => <TextField {...params} label="Brand" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={['Air Force 1', 'Dunk Low', 'Air Jordan 1', 'Ultraboost', 'Stan Smith', 'Superstar']}
                           value={item.model || ''}
                           onChange={(_, newValue) => handleEditItem(idx, 'model', newValue)}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'model', newInputValue)}
                           renderInput={(params) => <TextField {...params} label="Model" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={['Leather', 'Suede', 'Canvas', 'Mesh', 'Nubuck', 'Nylon', 'Patent Leather']}
                           value={item.material || ''}
                           onChange={(_, newValue) => handleEditItem(idx, 'material', newValue)}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'material', newInputValue)}
                           renderInput={(params) => <TextField {...params} label="Material" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={['White', 'Black', 'Red', 'Blue', 'Green', 'Grey', 'Brown', 'Multi']}
                           value={item.color || ''}
                           onChange={(_, newValue) => handleEditItem(idx, 'color', newValue)}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'color', newInputValue)}
                           renderInput={(params) => <TextField {...params} label="Color" size="small" fullWidth variant="outlined" />}
                         />
                       </Grid>
                       <Grid size={{ xs: 6 }}>
                         <Autocomplete
                           freeSolo
                           options={['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12']}
                           value={item.size || ''}
                           onChange={(_, newValue) => handleEditItem(idx, 'size', newValue)}
                           onInputChange={(_, newInputValue) => handleEditItem(idx, 'size', newInputValue)}
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
                       <Grid size={{ xs: 12, sm: 7 }}><TextField label="Base Services" value={Array.isArray(item.base_services) ? item.base_services.join(', ') : item.base_services || ''} onChange={e => handleEditItem(idx, 'base_services', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} size="small" fullWidth variant="outlined" /></Grid>
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
                       <Grid size={{ xs: 12, sm: 7 }}><TextField label="Add-on Services" value={Array.isArray(item.addon_services) ? item.addon_services.join(', ') : item.addon_services || ''} onChange={e => handleEditItem(idx, 'addon_services', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} size="small" fullWidth variant="outlined" /></Grid>
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
                       <Grid size={{ xs: 12 }}><TextField label="Conditions (comma separated)" value={Array.isArray(item.conditions) ? item.conditions.join(', ') : item.conditions || ''} onChange={e => handleEditItem(idx, 'conditions', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} size="small" fullWidth variant="outlined" /></Grid>
                    </Grid>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                      {/* Item Details Block - always show all fields so validators can see what OCR did/didn't extract */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: 0.5, columnGap: 1 }}>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Brand</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.brand ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.brand || '—'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Model</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.model ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.model || '—'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Color</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.color ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.color || '—'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Material</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.material ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.material || '—'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Size</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.size ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.size || '—'}</Typography>
                        </>
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Claimed</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: item.claimed_date ? 'text.primary' : 'text.disabled', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                            {displayMmDdYyyy(item.claimed_date) || '—'}
                          </Typography>
                        </>
                        {(item.remarks || (typeof item.conditions === 'string' && item.conditions)) && (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Remarks</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                              {item.remarks || item.conditions}
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
                const discountDisplay = recordedDiscount != null
                  ? recordedDiscount
                  : (recordedOriginal != null && recordedTotal != null && recordedOriginal > recordedTotal
                    ? Math.round((recordedOriginal - recordedTotal) * 100) / 100
                    : null);
                const hasDiscount = discountDisplay != null && discountDisplay > 0.009;
                const percentLabel = recordedDiscountPercent != null && recordedDiscountPercent > 0
                  ? recordedDiscountPercent
                  : (recordedOriginal != null && recordedOriginal > 0 && discountDisplay != null
                    ? Math.round((discountDisplay / recordedOriginal) * 1000) / 10
                    : null);
                // Item-sum check: against original when discounted, else final grand total.
                const compareForItems = hasDiscount && recordedOriginal != null ? recordedOriginal : recordedTotal;
                const hasDiscrepancy = compareForItems !== null && pricedItems.length > 0 && Math.abs(calculatedTotal - compareForItems) > 0.009;
                const calculatedBalance = recordedTotal !== null && recordedDownpayment !== null
                  ? Math.round((recordedTotal - recordedDownpayment) * 100) / 100
                  : null;
                const hasPaymentDiscrepancy = calculatedBalance !== null && recordedBalance !== null
                  && Math.abs(calculatedBalance - recordedBalance) > 0.009;
                const backendWarnings = currentItem.payment_warnings || [];
                const showPaymentWarning = hasDiscrepancy || hasPaymentDiscrepancy || backendWarnings.length > 0;
                
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
                      {hasDiscount ? (
                        <>
                          <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.100' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>GRAND TOTAL (ORIGINAL)</Typography>
                            <Typography variant="subtitle1" fontWeight="bold">
                              ₱{formatMoney(recordedOriginal)}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>DISCOUNT</Typography>
                            <Typography variant="subtitle1" fontWeight="bold">
                              −₱{formatMoney(discountDisplay)}
                            </Typography>
                            {percentLabel != null && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {recordedDiscountType === 'percent' ? `${formatMoney(percentLabel)}%` : `≈ ${formatMoney(percentLabel)}%`}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>DISCOUNTED GRAND TOTAL</Typography>
                            <Typography variant="subtitle1" fontWeight="bold">₱{formatMoney(recordedTotal)}</Typography>
                          </Box>
                        </>
                      ) : (
                        <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>GRAND TOTAL</Typography>
                          <Typography variant="subtitle1" fontWeight="bold">₱{formatMoney(recordedTotal)}</Typography>
                        </Box>
                      )}
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>DOWNPAYMENT</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">₱{formatMoney(recordedDownpayment)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>BALANCE</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">₱{formatMoney(recordedBalance)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>PAYMENT METHOD</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">{displayPaymentMethod(editMode ? editedData?.payment_method : currentItem.order?.payment_method)}</Typography>
                      </Box>
                    </Box>
                    
                    {showPaymentWarning && (
                      <Alert severity="warning" sx={{ py: 0, px: 2 }}>
                        <Typography variant="body2">
                          Payment discrepancy detected. Please verify against the original document.
                        </Typography>
                      </Alert>
                    )}

                    {editMode && (
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                          <TextField 
                            fullWidth size="small" select
                            label="Payment Method" 
                            value={editedData?.payment_method || 'Cash'} 
                            onChange={(e) => handleEditChange('payment_method', e.target.value)}
                            variant="outlined"
                          >
                            <MenuItem value="">Not specified</MenuItem>
                            <MenuItem value="Cash">Cash</MenuItem>
                            <MenuItem value="GCash">GCash</MenuItem>
                            <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                            <MenuItem value="Card">Card</MenuItem>
                            <MenuItem value="Maya">Maya</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Grand Total (Original)" 
                            value={editedData?.original_grand_total ?? editedData?.grand_total ?? ''} 
                            onChange={(e) => handleEditChange('original_grand_total', e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                            variant="outlined"
                            helperText="Before discount"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                          <TextField
                            fullWidth size="small" select
                            label="Discount Type"
                            value={editedData?.discount_type || 'amount'}
                            onChange={(e) => handleEditChange('discount_type', e.target.value)}
                            variant="outlined"
                          >
                            <MenuItem value="amount">Amount (₱)</MenuItem>
                            <MenuItem value="percent">Percent (%)</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Discount"
                            value={editedData?.discount_value ?? ''} 
                            onChange={(e) => handleEditChange('discount_value', e.target.value)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  {String(editedData?.discount_type || 'amount') === 'percent' ? '%' : '₱'}
                                </InputAdornment>
                              ),
                            }}
                            variant="outlined"
                            helperText="Leave blank if none"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Discounted Grand Total" 
                            value={editedData?.grand_total || ''} 
                            onChange={(e) => handleEditChange('grand_total', e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                            variant="outlined"
                            helperText="Final total"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Downpayment" 
                            value={editedData?.downpayment || ''} 
                            onChange={(e) => handleEditChange('downpayment', e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                            variant="outlined"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Balance" 
                            value={editedData?.balance || ''} 
                            onChange={(e) => handleEditChange('balance', e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                            variant="outlined"
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                );
              })()}
            </Box>

            {/* Action Bar */}
            <Divider />
            <Box sx={{ p: 2, display: 'flex', gap: 2, bgcolor: 'grey.100', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
              {!editMode ? (
                <>
                  <Button 
                    variant="contained" 
                    color="success" 
                    size="medium"
                    startIcon={<CheckCircle />}
                    onClick={() => handleAction('approve')}
                    disabled={busy}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    VALIDATE & SAVE
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="medium"
                    startIcon={<Edit />}
                    onClick={startEdit}
                    disabled={busy}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    EDIT DATA
                  </Button>
                  <Button 
                    variant="contained" 
                    color="error" 
                    size="medium"
                    startIcon={<Cancel />}
                    onClick={() => handleAction('reject')}
                    disabled={busy}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    REJECT / FLAG
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="medium"
                    startIcon={<CheckCircle />}
                    onClick={() => handleAction('save')}
                    disabled={busy}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    {busy ? 'Saving…' : 'Save Corrections'}
                  </Button>
                  <Button 
                    variant="contained" 
                    color="inherit" 
                    size="medium"
                    onClick={() => setEditMode(false)}
                    disabled={busy}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    Cancel Edit
                  </Button>
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

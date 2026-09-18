import { format as dateFnsFormat } from 'date-fns';
import type { JobOrder, ShoeItem } from '@/app/types';
import { parseDateFromOrderId } from './orderNumber';

export type ReportRange = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually' | 'Custom';

export const CANONICAL_BASE_SERVICES = ['Basic Cleaning', 'Minor Reglue', 'Full Reglue', 'Color Renewal'] as const;
export type CanonicalBaseService = (typeof CANONICAL_BASE_SERVICES)[number];

export const CANONICAL_SERVICE_COLORS: Record<CanonicalBaseService, string> = {
  'Basic Cleaning': '#A2C2B9',
  'Minor Reglue': '#93C5FD',
  'Full Reglue': '#D69BE5',
  'Color Renewal': '#F5CD93',
};

export const BC_BREAKDOWN_KEYS = ['Unyellowing', 'White Paint', 'Minor Retouch', 'Minor Restoration'] as const;
export const FR_BREAKDOWN_KEYS = ['Full Reglue Midsole', 'Full Reglue Undersole'] as const;
export const CR_BREAKDOWN_KEYS = ['2 Colors', '3 Colors'] as const;

export function isCancelledOrder(order: JobOrder): boolean {
  const st = String(order?.status || '').toLowerCase().trim();
  return st === 'cancelled' || st === 'canceled';
}

export function getOrderPaidAmount(order: JobOrder): number {
  if (!order) return 0;
  const gt = Number(order.grandTotal || 0);
  const status = String(order.paymentStatus || '').toLowerCase();

  // If order has paymentHistory with valid transactions, sum them (capped at grandTotal)
  if (Array.isArray(order.paymentHistory) && order.paymentHistory.length > 0) {
    const historyTotal = order.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (historyTotal > 0) return Math.min(gt > 0 ? gt : historyTotal, historyTotal);
  }

  if (status === 'downpayment') {
    const dp = Number(order.depositAmount);
    if (Number.isFinite(dp) && dp > 0) return Math.min(gt > 0 ? gt : dp, dp);
    const recv = Number(order.amountReceived);
    if (Number.isFinite(recv) && recv > 0 && recv < gt) return recv;
    return gt > 0 ? gt / 2 : 0;
  }

  if (status === 'fully-paid') {
    return gt > 0 ? gt : Number(order.amountReceived || 0);
  }

  return 0;
}

export function getOrderRetainedAmount(order: JobOrder): number {
  if (!order || !isCancelledOrder(order)) return 0;
  const paid = getOrderPaidAmount(order);
  const isRefunded = String(order.refundStatus || '').toLowerCase() === 'refunded';
  const rf = Number(order.refundAmount || 0);
  const refunded = isRefunded ? (rf > 0 ? rf : paid) : rf;
  return Math.max(0, paid - refunded);
}

export function totalRefundsIssued(orders: JobOrder[]): number {
  return (orders || []).reduce((sum, o) => {
    const rf = Number(o.refundAmount || 0);
    const isCancelled = isCancelledOrder(o);
    const isRefunded = String(o?.refundStatus || '').toLowerCase() === 'refunded';
    if (isCancelled || isRefunded || rf > 0) {
      if (rf > 0) return sum + rf;
      if (isRefunded) {
        const paid = getOrderPaidAmount(o);
        return sum + paid;
      }
    }
    return sum;
  }, 0);
}

export function totalRetainedPayments(orders: JobOrder[]): number {
  return (orders || []).reduce((sum, o) => {
    if (isCancelledOrder(o)) {
      return sum + getOrderRetainedAmount(o);
    }
    return sum;
  }, 0);
}

// Retained Deposit alias maintained for backwards compatibility
export const totalRetainedDeposits = totalRetainedPayments;

/**
 * Authoritative single-definition formula:
 * Net Sales = Active Order Sales + Retained Payments from Cancelled Orders
 *
 * - Active Order Sales: Grand total of active, non-cancelled orders recognized in the order-date cohort.
 * - Retained Payments: Actual retained amount paid on cancelled orders under cancellation policy.
 * - Fully refunded cancelled orders contribute ₱0.
 * - Refunds are NEVER added to sales.
 */
export function calculateNetSales(orders: JobOrder[]): number {
  const activeSales = (orders || [])
    .filter(isSalesEligible)
    .reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
  const retained = totalRetainedPayments(orders);
  return Math.max(0, activeSales + retained);
}

export function cancelledOrdersBreakdown(orders: JobOrder[]) {
  const cancelled = (orders || []).filter(isCancelledOrder);
  const totalRefunded = totalRefundsIssued(cancelled);
  const totalRetained = totalRetainedPayments(cancelled);
  const totalPaid = cancelled.reduce((sum, o) => sum + getOrderPaidAmount(o), 0);
  return {
    count: cancelled.length,
    totalPaid,
    totalRefunded,
    totalRetained,
    refundedCount: cancelled.filter(o => o.refundStatus === 'refunded' || Number(o.refundAmount || 0) > 0).length,
    retainedCount: cancelled.filter(o => o.refundStatus === 'no-refund' || getOrderRetainedAmount(o) > 0).length,
  };
}

export function collectedSales(order: JobOrder): number {
  if (!order || isCancelledOrder(order)) return 0;
  const billed = Number(order.grandTotal || 0);
  const status = String(order.paymentStatus || '').toLowerCase();
  let received = Number(order.amountReceived || 0);
  if (status === 'downpayment' && order.depositAmount != null && Number(order.depositAmount) > 0) {
    received = Number(order.depositAmount);
  }
  if (!Number.isFinite(billed) || !Number.isFinite(received)) return 0;
  return Math.max(0, Math.min(billed, received));
}

export function isSalesEligible(order: JobOrder): boolean {
  if (!order || isCancelledOrder(order)) return false;
  const status = String(order.paymentStatus || '').toLowerCase();
  return status === 'fully-paid' || status === 'downpayment';
}

export function orderEventDate(order: JobOrder): Date {
  const idStr = String(order?.orderNumber || (order as any)?.order_number || order?.id || '').trim();
  const idDate = parseDateFromOrderId(idStr);
  if (idDate && !isNaN(idDate.getTime())) {
    const raw = order?.transactionDate || order?.createdAt;
    if (raw) {
      const rawDt = new Date(raw as any);
      if (!isNaN(rawDt.getTime())) {
        const combined = new Date(idDate);
        combined.setHours(rawDt.getHours(), rawDt.getMinutes(), rawDt.getSeconds(), rawDt.getMilliseconds());
        return combined;
      }
    }
    return idDate;
  }
  const raw = order?.transactionDate || order?.createdAt;
  return raw ? new Date(raw as any) : new Date(NaN);
}

export function orderReleaseDate(order: JobOrder): Date | null {
  const raw = order?.actualReleaseDate 
    || order?.actualCompletionDate 
    || (Array.isArray((order as any).statusHistory) 
        ? ((order as any).statusHistory.find((s: any) => s.status === 'claimed' || s.status === 'for-release')?.timestamp) 
        : null);
  if (!raw) return null;
  const date = new Date(raw as any);
  return isNaN(date.getTime()) ? null : date;
}

export function isDateInRange(
  date: Date,
  range: ReportRange,
  now: Date,
  customStartDate = '',
  customEndDate = '',
): boolean {
  if (!date || isNaN(date.getTime())) return false;
  const todayStr = dateFnsFormat(now, 'yyyy-MM-dd');
  const dateStr = dateFnsFormat(date, 'yyyy-MM-dd');

  if (range === 'Daily') return dateStr === todayStr;
  if (range === 'Weekly') {
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
    return date >= monday && date <= sunday;
  }
  if (range === 'Monthly') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (range === 'Quarterly') {
    const nowQuarter = Math.floor(now.getMonth() / 3);
    const dateQuarter = Math.floor(date.getMonth() / 3);
    return date.getFullYear() === now.getFullYear() && nowQuarter === dateQuarter;
  }
  if (range === 'Annually') {
    return date.getFullYear() === now.getFullYear();
  }
  if (range === 'Custom') {
    if (customStartDate && customEndDate) {
      return dateStr >= customStartDate && dateStr <= customEndDate;
    }
    if (customStartDate) {
      return dateStr >= customStartDate;
    }
    if (customEndDate) {
      return dateStr <= customEndDate;
    }
    return true;
  }
  return false;
}

export function getOrderActivityPeriodLabel(
  range: ReportRange,
  customStartDate = '',
  customEndDate = '',
  now = new Date(),
): string {
  if (range === 'Daily') {
    return dateFnsFormat(now, 'MMMM d, yyyy');
  }

  if (range === 'Weekly') {
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    if (monday.getMonth() === sunday.getMonth()) {
      return `${dateFnsFormat(monday, 'MMMM')} ${monday.getDate()}–${sunday.getDate()}, ${sunday.getFullYear()}`;
    }
    return `${dateFnsFormat(monday, 'MMMM d')} – ${dateFnsFormat(sunday, 'MMMM d, yyyy')}`;
  }

  if (range === 'Monthly') {
    return dateFnsFormat(now, 'MMMM yyyy');
  }

  if (range === 'Quarterly') {
    const q = Math.floor(now.getMonth() / 3) + 1;
    const quarterMonths: Record<number, string> = {
      1: 'January–March',
      2: 'April–June',
      3: 'July–September',
      4: 'October–December',
    };
    return `Q${q} ${now.getFullYear()} (${quarterMonths[q]})`;
  }

  if (range === 'Annually') {
    return `${now.getFullYear()}`;
  }

  if (range === 'Custom') {
    if (customStartDate && customEndDate) {
      const s = new Date(customStartDate);
      const e = new Date(customEndDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        return `${dateFnsFormat(s, 'MMMM d, yyyy')} – ${dateFnsFormat(e, 'MMMM d, yyyy')}`;
      }
    }
    return 'Custom Range';
  }

  return '';
}

export function classifyBaseService(name: string): CanonicalBaseService | null {
  const n = String(name || '')
    .toLowerCase()
    .replace(/\(with basic cleaning\)/g, '')
    .trim();
  if (!n) return null;
  if (n.includes('full reglue')) return 'Full Reglue';
  if (n.includes('minor reglue')) return 'Minor Reglue';
  if (n.includes('color renewal') || (n.includes('color') && n.includes('renewal'))) return 'Color Renewal';
  if (
    n.includes('basic cleaning') ||
    n.includes('unyellowing') ||
    n.includes('retouch') ||
    n.includes('restoration') ||
    n === 'cleaning' ||
    n.includes('deep cleaning')
  ) {
    return 'Basic Cleaning';
  }
  return null;
}

export function breakdownKey(name: string): (typeof BC_BREAKDOWN_KEYS)[number] | null {
  const n = String(name || '').toLowerCase();
  if (n.includes('white paint') || n === 'wpt') return 'White Paint';
  if (n.includes('unyellowing') || n === 'uny') return 'Unyellowing';
  if (n.includes('retouch') || n === 'mrt') return 'Minor Retouch';
  if (n.includes('restoration') || n === 'mrs') return 'Minor Restoration';
  return null;
}

function orderItems(order: JobOrder): Array<Partial<ShoeItem> & { quantity?: number; baseService?: string[] }> {
  if (order.items && order.items.length) return order.items;
  return [{
    baseService: Array.isArray(order.baseService) ? order.baseService : order.baseService ? [order.baseService as any] : [],
    addOns: order.addOns || [],
    historicalBasePrices: order.historicalBasePrices,
    historicalAddOnPrices: order.historicalAddOnPrices,
    quantity: order.quantity || 1,
  }];
}

function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function money(value: number): number {
  return Math.max(0, roundCents(value));
}

function reconcileParts<T extends string>(parts: Record<T, number>, total: number, keys: readonly T[]): Record<T, number> {
  keys.forEach((key) => {
    parts[key] = money(parts[key]);
  });
  const assigned = roundCents(keys.reduce((sum, key) => sum + parts[key], 0));
  const remainder = roundCents(roundCents(total) - assigned);
  if (remainder !== 0) {
    const target = keys.slice().sort((a, b) => parts[b] - parts[a])[0];
    parts[target] = money(parts[target] + remainder);
  }
  return parts;
}

/**
 * Split collected cash (not unpaid balance) across canonical base services.
 * An order with Basic Cleaning + Full Reglue contributes to both bars, but the
 * two amounts always sum to that order's collected sales — never 2x the total.
 */
export function allocateCollectedToCanonicalServices(order: JobOrder): Record<CanonicalBaseService, number> {
  const shares: Record<CanonicalBaseService, number> = {
    'Basic Cleaning': 0,
    'Minor Reglue': 0,
    'Full Reglue': 0,
    'Color Renewal': 0,
  };
  const collected = money(collectedSales(order));
  if (collected <= 0) return shares;

  const items = orderItems(order);
  const prepared = items.map((item) => {
    const qty = Number(item.quantity || 1) || 1;
    const names = Array.isArray(item.baseService) ? item.baseService : item.baseService ? [item.baseService] : [];
    const hist = item.historicalBasePrices || [];
    const lines = names
      .map((name) => {
        const canonical = classifyBaseService(String(name));
        if (!canonical) return null;
        const exact = hist.find((h) => String(h.name).toLowerCase() === String(name).toLowerCase())?.price;
        const byClass = hist.find((h) => classifyBaseService(String(h.name)) === canonical)?.price;
        const price = Number(exact ?? byClass);
        return { canonical, weight: (Number.isFinite(price) && price > 0 ? price : 1) * qty };
      })
      .filter((line): line is { canonical: CanonicalBaseService; weight: number } => Boolean(line));

    const directWeights: Record<CanonicalBaseService, number> = {
      'Basic Cleaning': 0,
      'Minor Reglue': 0,
      'Full Reglue': 0,
      'Color Renewal': 0,
    };

    lines.forEach((line) => {
      directWeights[line.canonical] += line.weight;
    });

    // Directly attribute service-specific add-on prices to their canonical parent
    const unassociatedAddonWeight = (item.historicalAddOnPrices || []).reduce((sum, row) => {
      const price = Number(row.price);
      const rowWeight = Number.isFinite(price) && price > 0 ? price * qty : 0;
      if (rowWeight <= 0) return sum;

      const addonName = String(row.name || '').toLowerCase();
      const hasLine = (cat: CanonicalBaseService) => lines.some((l) => l.canonical === cat);

      if (hasLine('Color Renewal') && (addonName.includes('color') || addonName.includes('colour') || addonName.includes('paint') || addonName.includes('restoration'))) {
        directWeights['Color Renewal'] += rowWeight;
      } else if (hasLine('Full Reglue') && (addonName.includes('reglue') || addonName.includes('midsole') || addonName.includes('undersole'))) {
        directWeights['Full Reglue'] += rowWeight;
      } else if (hasLine('Minor Reglue') && (addonName.includes('reglue') || addonName.includes('midsole') || addonName.includes('undersole'))) {
        directWeights['Minor Reglue'] += rowWeight;
      } else if (hasLine('Basic Cleaning') && (addonName.includes('clean') || addonName.includes('unyellowing') || addonName.includes('booster') || addonName.includes('white paint') || addonName.includes('retouch') || addonName.includes('restoration'))) {
        directWeights['Basic Cleaning'] += rowWeight;
      } else {
        return sum + rowWeight;
      }
      return sum;
    }, 0);

    // If there are unassociated add-ons, distribute them evenly among lines
    if (unassociatedAddonWeight > 0 && lines.length > 0) {
      const perLine = unassociatedAddonWeight / lines.length;
      lines.forEach((line) => {
        directWeights[line.canonical] += perLine;
      });
    }

    const itemWeight = lines.reduce((sum, line) => sum + (directWeights[line.canonical] > 0 ? directWeights[line.canonical] : 1), 0);
    return { lines, directWeights, itemWeight };
  }).filter((row) => row.lines.length > 0);

  if (prepared.length === 0) return shares;

  const orderWeight = prepared.reduce((sum, row) => sum + row.itemWeight, 0);
  const fallbackCount = prepared.length || 1;

  prepared.forEach((row) => {
    const itemShare = collected * ((row.itemWeight > 0 ? row.itemWeight : 1) / (orderWeight > 0 ? orderWeight : fallbackCount));
    const totalRowWeight = row.lines.reduce((sum, line) => sum + (row.directWeights[line.canonical] > 0 ? row.directWeights[line.canonical] : 1), 0) || row.lines.length;
    row.lines.forEach((line) => {
      const effectiveWeight = row.directWeights[line.canonical] > 0 ? row.directWeights[line.canonical] : 1;
      shares[line.canonical] += itemShare * (effectiveWeight / totalRowWeight);
    });
  });

  (Object.keys(shares) as CanonicalBaseService[]).forEach((key) => {
    shares[key] = money(shares[key]);
  });
  reconcileParts(shares, collected, CANONICAL_BASE_SERVICES);
  return shares;
}

export function salesByCanonicalService(orders: JobOrder[]): Array<{ name: CanonicalBaseService; amount: number; fill: string }> {
  const totals: Record<CanonicalBaseService, number> = {
    'Basic Cleaning': 0,
    'Minor Reglue': 0,
    'Full Reglue': 0,
    'Color Renewal': 0,
  };
  orders.forEach((order) => {
    if (!isSalesEligible(order)) return;
    const shares = allocateCollectedToCanonicalServices(order);
    (Object.keys(shares) as CanonicalBaseService[]).forEach((key) => {
      totals[key] += shares[key];
    });
  });
  return CANONICAL_BASE_SERVICES.map((name) => ({
    name,
    amount: money(totals[name]),
    fill: CANONICAL_SERVICE_COLORS[name],
  }));
}

export function serviceVolumeByCanonical(orders: JobOrder[]) {
  const basicCleaningBreakdown: Record<(typeof BC_BREAKDOWN_KEYS)[number], number> = {
    'Unyellowing': 0,
    'White Paint': 0,
    'Minor Retouch': 0,
    'Minor Restoration': 0,
  };
  const fullReglueBreakdown: Record<(typeof FR_BREAKDOWN_KEYS)[number], number> = {
    'Full Reglue Midsole': 0,
    'Full Reglue Undersole': 0,
  };
  const colorRenewalBreakdown: Record<(typeof CR_BREAKDOWN_KEYS)[number], number> = {
    '2 Colors': 0,
    '3 Colors': 0,
  };

  const result = [
    { name: 'Basic Cleaning' as CanonicalBaseService, value: 0, sales: 0, breakdown: basicCleaningBreakdown },
    { name: 'Minor Reglue' as CanonicalBaseService, value: 0, sales: 0 },
    { name: 'Full Reglue' as CanonicalBaseService, value: 0, sales: 0, breakdown: fullReglueBreakdown },
    { name: 'Color Renewal' as CanonicalBaseService, value: 0, sales: 0, breakdown: colorRenewalBreakdown },
  ];
  const indexOf: Record<CanonicalBaseService, number> = {
    'Basic Cleaning': 0,
    'Minor Reglue': 1,
    'Full Reglue': 2,
    'Color Renewal': 3,
  };

  orders.forEach((order) => {
    if (!order || isCancelledOrder(order)) return;
    const shares = isSalesEligible(order) ? allocateCollectedToCanonicalServices(order) : null;
    if (shares) {
      result.forEach((row) => {
        row.sales += shares[row.name];
      });
    }

    orderItems(order).forEach((item) => {
      const qty = Number(item.quantity || 1) || 1;
      const baseNames = Array.isArray(item.baseService) ? item.baseService : item.baseService ? [item.baseService] : [];
      const addOns = Array.isArray(item.addOns) ? item.addOns : [];
      const addOnNames = addOns.map((a: any) => typeof a === 'string' ? a : a?.name || '').filter(Boolean);
      const histAddonNames = Array.isArray(item.historicalAddOnPrices) ? item.historicalAddOnPrices.map((h: any) => h?.name || '').filter(Boolean) : [];
      const allServicesAndAddons = [...baseNames.map(String), ...addOnNames, ...histAddonNames];

      const unique = new Set<CanonicalBaseService>();
      baseNames.forEach((name) => {
        const canonical = classifyBaseService(String(name));
        if (canonical) unique.add(canonical);
      });

      // Infer canonical if not directly in baseService
      if (!unique.has('Full Reglue') && allServicesAndAddons.some((s) => {
        const l = s.toLowerCase();
        return l.includes('full reglue') || l.includes('midsole') || l.includes('undersole');
      })) {
        unique.add('Full Reglue');
      }
      if (!unique.has('Color Renewal') && allServicesAndAddons.some((s) => {
        const l = s.toLowerCase();
        return l.includes('color renewal') || l.includes('2 color') || l.includes('3 color');
      })) {
        unique.add('Color Renewal');
      }
      if (!unique.has('Basic Cleaning') && allServicesAndAddons.some((s) => {
        const l = s.toLowerCase();
        return l.includes('cleaning') || l.includes('unyellowing') || l.includes('white paint') || l.includes('retouch') || l.includes('restoration');
      })) {
        unique.add('Basic Cleaning');
      }

      unique.forEach((canonical) => {
        result[indexOf[canonical]].value += qty;
      });

      // 1. Basic Cleaning Breakdown
      const itemHasCleaning = unique.has('Basic Cleaning') || allServicesAndAddons.some((s) => {
        const l = s.toLowerCase();
        return l.includes('cleaning') || l.includes('unyellowing') || l.includes('white paint') || l.includes('retouch') || l.includes('restoration');
      });

      if (itemHasCleaning) {
        if (allServicesAndAddons.some((s) => s.toLowerCase().includes('unyellowing') || s.toLowerCase() === 'uny')) {
          basicCleaningBreakdown['Unyellowing'] += qty;
        }
        if (allServicesAndAddons.some((s) => s.toLowerCase().includes('white paint') || s.toLowerCase() === 'wpt')) {
          basicCleaningBreakdown['White Paint'] += qty;
        }
        if (allServicesAndAddons.some((s) => s.toLowerCase().includes('retouch') || s.toLowerCase() === 'mrt')) {
          basicCleaningBreakdown['Minor Retouch'] += qty;
        }
        if (allServicesAndAddons.some((s) => (s.toLowerCase().includes('restoration') && !s.toLowerCase().includes('color')) || s.toLowerCase() === 'mrs')) {
          basicCleaningBreakdown['Minor Restoration'] += qty;
        }
      }

      // 2. Full Reglue Breakdown (Midsole & Undersole)
      const itemHasFullReglue = unique.has('Full Reglue') || allServicesAndAddons.some((s) => {
        const l = s.toLowerCase();
        return l.includes('full reglue') || l.includes('midsole') || l.includes('undersole');
      });

      if (itemHasFullReglue) {
        if (allServicesAndAddons.some((s) => s.toLowerCase().includes('midsole'))) {
          fullReglueBreakdown['Full Reglue Midsole'] += qty;
        }
        if (allServicesAndAddons.some((s) => s.toLowerCase().includes('undersole'))) {
          fullReglueBreakdown['Full Reglue Undersole'] += qty;
        }
      }

      // 3. Color Renewal Breakdown (2 Colors & 3 Colors)
      const itemHasColorRenewal = unique.has('Color Renewal') || allServicesAndAddons.some((s) => {
        const l = s.toLowerCase();
        return l.includes('color renewal') || l.includes('2 color') || l.includes('3 color');
      });

      if (itemHasColorRenewal) {
        const has2Colors = allServicesAndAddons.some((s) => {
          const l = s.toLowerCase().trim();
          return l === '2 colors' || l.includes('2 color') || l.includes('two color') || l === 'cr2';
        });
        const has3Colors = allServicesAndAddons.some((s) => {
          const l = s.toLowerCase().trim();
          return l === '3 colors' || l.includes('3 color') || l.includes('three color') || l === 'cr3';
        });

        if (has2Colors) {
          colorRenewalBreakdown['2 Colors'] += qty;
        } else if (has3Colors) {
          colorRenewalBreakdown['3 Colors'] += qty;
        } else if (unique.has('Color Renewal')) {
          colorRenewalBreakdown['2 Colors'] += qty;
        }
      }
    });
  });

  result.forEach((row) => {
    row.sales = money(row.sales);
  });
  return result;
}

export function resolvePaymentMethod(method?: string, referenceNo?: string, fallbackMethod?: string): 'cash' | 'gcash' | 'maya' {
  const norm = String(method || '').toLowerCase().trim();
  const fallbackNorm = String(fallbackMethod || '').toLowerCase().trim();

  // If method or fallback explicitly specifies maya or gcash
  if (norm.includes('maya') || fallbackNorm.includes('maya')) return 'maya';
  if (norm.includes('gcash') || fallbackNorm.includes('gcash')) return 'gcash';

  if (referenceNo) {
    const cleanRef = referenceNo.replace(/\D/g, '');
    if (cleanRef.length === 13) return 'gcash';
    const cleanAlnum = referenceNo.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanAlnum.length === 12) return 'maya';
    if (/^may/i.test(referenceNo)) return 'maya';
    if (/^gc/i.test(referenceNo)) return 'gcash';
  }

  if (norm === 'gcash' || fallbackNorm === 'gcash') return 'gcash';
  if (norm === 'maya' || fallbackNorm === 'maya') return 'maya';
  return 'cash';
}

export function paymentMethodAnalytics(orders: JobOrder[]) {
  const counts: Record<string, { count: number; amount: number }> = {
    cash: { count: 0, amount: 0 },
    gcash: { count: 0, amount: 0 },
    maya: { count: 0, amount: 0 },
  };

  orders.forEach((order) => {
    if (!order) return;
    const isCancelled = isCancelledOrder(order);
    if (!isSalesEligible(order) && !isCancelled) return;

    // For cancelled orders, only consider retained payment if any
    const retainedAmt = isCancelled ? getOrderRetainedAmount(order) : 0;
    if (isCancelled && retainedAmt <= 0) return;

    const validHistory = Array.isArray(order.paymentHistory)
      ? order.paymentHistory.filter((p) => p && p.paymentType !== 'refund' && Number(p.amount) > 0)
      : [];

    const orderRef = order.referenceNo || (order as any).paymentReference || (order as any).reference_no || (order as any).claimReferenceNo;
    const fallbackMethod = order.paymentMethod || order.initialPaymentMethod;

    if (validHistory.length > 0) {
      if (isCancelled) {
        // Apportion the retained payment across the payment history methods
        const totalPaid = validHistory.reduce((s, p) => s + Number(p.amount || 0), 0);
        validHistory.forEach((p) => {
          const itemRef = p.referenceNo || (p as any).reference_no || orderRef;
          const key = resolvePaymentMethod(p.method || (p as any).paymentMethod, itemRef, fallbackMethod);
          const portion = totalPaid > 0 ? (Number(p.amount) / totalPaid) * retainedAmt : 0;
          counts[key].count += 1;
          counts[key].amount += portion;
        });
      } else {
        validHistory.forEach((p) => {
          const itemRef = p.referenceNo || (p as any).reference_no || orderRef;
          const key = resolvePaymentMethod(p.method || (p as any).paymentMethod, itemRef, fallbackMethod);
          counts[key].count += 1;
          counts[key].amount += Number(p.amount);
        });
      }
    } else {
      const amount = isCancelled ? retainedAmt : collectedSales(order);
      if (amount > 0) {
        const key = resolvePaymentMethod(order.paymentMethod, orderRef, order.initialPaymentMethod);
        counts[key].count += 1;
        counts[key].amount += amount;
      }
    }
  });

  const collectedTotal = money(counts.cash.amount + counts.gcash.amount + counts.maya.amount);
  const amountParts = { cash: counts.cash.amount, gcash: counts.gcash.amount, maya: counts.maya.amount };
  reconcileParts(amountParts, collectedTotal, ['cash', 'gcash', 'maya'] as const);

  return [
    { name: 'Cash', value: counts.cash.count, amount: amountParts.cash, color: '#9333ea' },
    { name: 'GCash', value: counts.gcash.count, amount: amountParts.gcash, color: '#2563eb' },
    { name: 'Maya', value: counts.maya.count, amount: amountParts.maya, color: '#16a34a' },
  ];
}

export type ActivityPoint = { period: string; newOrders: number; releasedOrders: number };

function inBucket(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

export function buildOrderActivityTrends(
  orders: JobOrder[],
  range: ReportRange,
  customStartDate = '',
  customEndDate = '',
  now = new Date(),
): ActivityPoint[] {
  const activeOrders = (orders || []).filter((order) => {
    return order && !isCancelledOrder(order);
  });

  const countIn = (start: Date, end: Date): ActivityPoint => {
    let newOrders = 0;
    let releasedOrders = 0;
    activeOrders.forEach((order) => {
      const created = orderEventDate(order);
      if (!isNaN(created.getTime()) && inBucket(created, start, end)) {
        newOrders += 1;
      }
      const released = orderReleaseDate(order);
      if (released && !isNaN(released.getTime()) && inBucket(released, start, end)) {
        releasedOrders += 1;
      }
    });
    return { period: '', newOrders, releasedOrders };
  };

  if (range === 'Daily') {
    const hours = Array.from({ length: 24 }, (_, hour) => hour);
    const dailyData = hours.map((hour) => {
      const periodStart = new Date(now);
      periodStart.setHours(hour, 0, 0, 0);
      const periodEnd = new Date(now);
      periodEnd.setHours(hour, 59, 59, 999);
      const point = countIn(periodStart, periodEnd);
      const militaryHour = `${String(hour).padStart(2, '0')}:00`;
      return { hourIndex: hour, period: militaryHour, newOrders: point.newOrders, releasedOrders: point.releasedOrders };
    });
    const startHour = Math.min(9, dailyData.reduce((min, d) => (d.newOrders > 0 || d.releasedOrders > 0) ? Math.min(min, d.hourIndex) : min, 9));
    const endHour = Math.max(21, dailyData.reduce((max, d) => (d.newOrders > 0 || d.releasedOrders > 0) ? Math.max(max, d.hourIndex) : max, 21));
    return dailyData
      .filter((data) => data.hourIndex >= startHour && data.hourIndex <= endHour)
      .map(({ hourIndex, ...rest }) => rest);
  }

  if (range === 'Weekly') {
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const point = countIn(dayStart, dayEnd);
      return { 
        period: date.toLocaleDateString('en-US', { weekday: 'short' }), 
        newOrders: point.newOrders, 
        releasedOrders: point.releasedOrders 
      };
    });
  }

  if (range === 'Custom') {
    if (!customStartDate || !customEndDate) return [];
    const start = new Date(`${customStartDate}T00:00:00`);
    const end = new Date(`${customEndDate}T23:59:59.999`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const points: ActivityPoint[] = [];
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard < 366) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);
      const point = countIn(dayStart, dayEnd);
      points.push({
        period: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        newOrders: point.newOrders,
        releasedOrders: point.releasedOrders,
      });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return points;
  }

  if (range === 'Monthly') {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const start = new Date(year, month, day, 0, 0, 0, 0);
      const end = new Date(year, month, day, 23, 59, 59, 999);
      const point = countIn(start, end);
      return {
        period: String(day),
        newOrders: point.newOrders,
        releasedOrders: point.releasedOrders,
      };
    });
  }

  if (range === 'Quarterly') {
    const currentMonth = now.getMonth();
    const quarterIndex = Math.floor(currentMonth / 3);
    const startMonth = quarterIndex * 3;
    const year = now.getFullYear();

    return Array.from({ length: 3 }, (_, i) => {
      const monthIdx = startMonth + i;
      const start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
      const end = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
      const point = countIn(start, end);
      return {
        period: start.toLocaleDateString('en-US', { month: 'short' }),
        newOrders: point.newOrders,
        releasedOrders: point.releasedOrders,
      };
    });
  }

  // Annually: 12 months of the selected year
  const year = now.getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(year, i, 1, 0, 0, 0, 0);
    const end = new Date(year, i + 1, 0, 23, 59, 59, 999);
    const point = countIn(start, end);
    return {
      period: start.toLocaleDateString('en-US', { month: 'short' }),
      newOrders: point.newOrders,
      releasedOrders: point.releasedOrders,
    };
  });
}

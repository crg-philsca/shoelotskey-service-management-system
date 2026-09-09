import { format as dateFnsFormat } from 'date-fns';
import type { JobOrder, ShoeItem } from '@/app/types';

export type ReportRange = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually' | 'Custom';

export const CANONICAL_BASE_SERVICES = ['Basic Cleaning', 'Minor Reglue', 'Full Reglue', 'Color Renewal'] as const;
export type CanonicalBaseService = (typeof CANONICAL_BASE_SERVICES)[number];

export const CANONICAL_SERVICE_COLORS: Record<CanonicalBaseService, string> = {
  'Basic Cleaning': '#A2C2B9',
  'Minor Reglue': '#93C5FD',
  'Full Reglue': '#D69BE5',
  'Color Renewal': '#F5CD93',
};

const BC_BREAKDOWN_KEYS = ['Basic Cleaning', 'Unyellowing', 'Minor Retouch', 'Minor Restoration'] as const;

export function isCancelledOrder(order: JobOrder): boolean {
  return String(order?.status || '').toLowerCase() === 'cancelled';
}

export function collectedSales(order: JobOrder): number {
  if (!order || isCancelledOrder(order)) return 0;
  const billed = Number(order.grandTotal || 0);
  const received = Number(order.amountReceived || 0);
  if (!Number.isFinite(billed) || !Number.isFinite(received)) return 0;
  return Math.max(0, Math.min(billed, received));
}

export function isSalesEligible(order: JobOrder): boolean {
  if (!order || isCancelledOrder(order)) return false;
  const status = String(order.paymentStatus || '').toLowerCase();
  return status === 'fully-paid' || status === 'downpayment';
}

export function orderEventDate(order: JobOrder): Date {
  const raw = order?.transactionDate || order?.createdAt;
  return raw ? new Date(raw as any) : new Date(NaN);
}

export function orderReleaseDate(order: JobOrder): Date | null {
  const raw = order?.actualReleaseDate || order?.actualCompletionDate;
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
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (range === 'Daily') return dateStr === todayStr;
  if (range === 'Weekly') return diffDays <= 7.5;
  if (range === 'Monthly') return diffDays <= 31.5;
  if (range === 'Quarterly') return diffDays <= 93;
  if (range === 'Annually') return diffDays <= 367;
  if (range === 'Custom') {
    if (!customStartDate || !customEndDate) return false;
    return dateStr >= customStartDate && dateStr <= customEndDate;
  }
  return false;
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

function breakdownKey(name: string): (typeof BC_BREAKDOWN_KEYS)[number] {
  const n = String(name || '').toLowerCase();
  if (n.includes('unyellowing')) return 'Unyellowing';
  if (n.includes('retouch')) return 'Minor Retouch';
  if (n.includes('restoration')) return 'Minor Restoration';
  return 'Basic Cleaning';
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

    const addonWeight = (item.historicalAddOnPrices || []).reduce((sum, row) => {
      const price = Number(row.price);
      return sum + (Number.isFinite(price) && price > 0 ? price * qty : 0);
    }, 0);

    const baseWeight = lines.reduce((sum, line) => sum + line.weight, 0);
    return { lines, itemWeight: baseWeight + addonWeight };
  }).filter((row) => row.lines.length > 0);

  if (prepared.length === 0) return shares;

  const orderWeight = prepared.reduce((sum, row) => sum + row.itemWeight, 0);
  const fallbackCount = prepared.length || 1;

  prepared.forEach((row) => {
    const itemShare = collected * ((row.itemWeight > 0 ? row.itemWeight : 1) / (orderWeight > 0 ? orderWeight : fallbackCount));
    const lineWeight = row.lines.reduce((sum, line) => sum + line.weight, 0) || row.lines.length;
    row.lines.forEach((line) => {
      shares[line.canonical] += itemShare * (line.weight / lineWeight);
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
  return CANONICAL_BASE_SERVICES
    .map((name) => ({
      name,
      amount: money(totals[name]),
      fill: CANONICAL_SERVICE_COLORS[name],
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function serviceVolumeByCanonical(orders: JobOrder[]) {
  const basicCleaningBreakdown: Record<(typeof BC_BREAKDOWN_KEYS)[number], number> = {
    'Basic Cleaning': 0,
    'Unyellowing': 0,
    'Minor Retouch': 0,
    'Minor Restoration': 0,
  };
  const result = [
    { name: 'Basic Cleaning' as CanonicalBaseService, value: 0, sales: 0, breakdown: basicCleaningBreakdown },
    { name: 'Minor Reglue' as CanonicalBaseService, value: 0, sales: 0 },
    { name: 'Full Reglue' as CanonicalBaseService, value: 0, sales: 0 },
    { name: 'Color Renewal' as CanonicalBaseService, value: 0, sales: 0 },
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
      const names = Array.isArray(item.baseService) ? item.baseService : item.baseService ? [item.baseService] : [];
      const unique = new Set<CanonicalBaseService>();
      names.forEach((name) => {
        const canonical = classifyBaseService(String(name));
        if (!canonical) return;
        unique.add(canonical);
        if (canonical === 'Basic Cleaning') {
          basicCleaningBreakdown[breakdownKey(String(name))] += qty;
        }
      });
      unique.forEach((canonical) => {
        result[indexOf[canonical]].value += qty;
      });
    });
  });

  result.forEach((row) => {
    row.sales = money(row.sales);
  });
  return result;
}

export function paymentMethodAnalytics(orders: JobOrder[]) {
  const counts: Record<string, { count: number; amount: number }> = {
    cash: { count: 0, amount: 0 },
    gcash: { count: 0, amount: 0 },
    maya: { count: 0, amount: 0 },
  };

  orders.forEach((order) => {
    if (!isSalesEligible(order)) return;
    const amount = collectedSales(order);
    const method = String(order.paymentMethod || 'cash').toLowerCase();
    const key = counts[method] ? method : 'cash';
    counts[key].count += 1;
    counts[key].amount += amount;
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
  const source = (orders || []).filter((order) => order && !isCancelledOrder(order));

  const countIn = (start: Date, end: Date): ActivityPoint => {
    let newOrders = 0;
    let releasedOrders = 0;
    source.forEach((order) => {
      const created = orderEventDate(order);
      if (!isNaN(created.getTime()) && isDateInRange(created, range, now, customStartDate, customEndDate) && inBucket(created, start, end)) {
        newOrders += 1;
      }
      const released = orderReleaseDate(order);
      if (released && isDateInRange(released, range, now, customStartDate, customEndDate) && inBucket(released, start, end)) {
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
      return { hourIndex: hour, period: `${hour}:00`, newOrders: point.newOrders, releasedOrders: point.releasedOrders };
    });
    const startHour = Math.min(9, dailyData.reduce((min, d) => (d.newOrders > 0 || d.releasedOrders > 0) ? Math.min(min, d.hourIndex) : min, 9));
    const endHour = Math.max(21, dailyData.reduce((max, d) => (d.newOrders > 0 || d.releasedOrders > 0) ? Math.max(max, d.hourIndex) : max, 21));
    return dailyData
      .filter((data) => data.hourIndex >= startHour && data.hourIndex <= endHour)
      .map(({ hourIndex, ...rest }) => rest);
  }

  if (range === 'Weekly') {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const point = countIn(dayStart, dayEnd);
      return { period: date.toLocaleDateString('en-US', { weekday: 'short' }), newOrders: point.newOrders, releasedOrders: point.releasedOrders };
    });
  }

  if (range === 'Custom') {
    if (!customStartDate || !customEndDate) return [];
    const start = new Date(`${customStartDate}T00:00:00`);
    const end = new Date(`${customEndDate}T00:00:00`);
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
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (29 - i));
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      const point = countIn(start, end);
      return {
        period: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        newOrders: point.newOrders,
        releasedOrders: point.releasedOrders,
      };
    });
  }

  if (range === 'Quarterly') {
    return Array.from({ length: 12 }, (_, i) => {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (11 - i) * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const point = countIn(weekStart, weekEnd);
      return { period: `Wk ${i + 1}`, newOrders: point.newOrders, releasedOrders: point.releasedOrders };
    });
  }

  return Array.from({ length: 12 }, (_, i) => {
    const ms = new Date(now);
    ms.setMonth(ms.getMonth() - (11 - i));
    ms.setDate(1); ms.setHours(0, 0, 0, 0);
    const me = new Date(ms);
    me.setMonth(me.getMonth() + 1);
    me.setDate(0); me.setHours(23, 59, 59, 999);
    const point = countIn(ms, me);
    return {
      period: ms.toLocaleDateString('en-US', { month: 'short' }),
      newOrders: point.newOrders,
      releasedOrders: point.releasedOrders,
    };
  });
}

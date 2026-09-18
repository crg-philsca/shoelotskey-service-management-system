/**
 * Authoritative Shoelotskey Job Order ID helpers.
 * Must stay aligned with backend/order_numbering.py and JobOrderForm.tsx:
 *   ORD-YYYY-MM-DD-NNN
 */

export const CANONICAL_ORDER_ID_RE = /^ORD-\d{4}-\d{2}-\d{2}-\d{3}$/;

export function isCanonicalOrderId(value?: string | null): boolean {
  return !!value && CANONICAL_ORDER_ID_RE.test(value.trim());
}

export function isPlaceholderOrderId(value?: string | null): boolean {
  if (!value || !value.trim()) return true;
  if (isCanonicalOrderId(value)) return false;
  const upper = value.trim().toUpperCase();
  if (['UNKNOWN', 'N/A', 'NULL', 'NONE', 'N-A'].includes(upper)) return true;
  return /^(UNKNOWN|OCR-|HIST-|IMPORT-|HEALTH-)/i.test(upper);
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

export function formatOrderId(dateValue: Date | string, sequence: number): string {
  const d = toDate(dateValue);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `ORD-${year}-${month}-${day}-${String(sequence).padStart(3, '0')}`;
}

export function nextOrderId(
  dateValue: Date | string,
  existingNumbers: Array<string | null | undefined>,
): string {
  const d = toDate(dateValue);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const prefix = `ORD-${year}-${month}-${day}-`;

  const existingIds = (existingNumbers || [])
    .filter((n): n is string => typeof n === 'string' && n.startsWith(prefix))
    .map((n) => {
      const parts = n.split('-');
      const seqPart = parts[4] || '';
      const numericMatch = seqPart.match(/\d+/);
      return numericMatch ? parseInt(numericMatch[0], 10) : 0;
    })
    .filter((n) => !isNaN(n) && n > 0);

  const maxSeq = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * Extracts the calendar Date represented by an order ID.
 * Supports:
 * - ORD-YYYY-MM-DD-NNN (e.g. ORD-2026-09-02-001 -> September 2, 2026)
 * - ORD-MM-DD-YYYY-NNN (e.g. ORD-09-02-2026-001 -> September 2, 2026)
 * - ORD-YYYY-MM-NN (e.g. ORD-2025-08-04)
 * - ORD-MM-DD-NN (e.g. ORD-08-26-04 -> August 26, 2025; January is 2026, Aug-Dec is 2025)
 */
export function parseDateFromOrderId(orderId?: string | null): Date | null {
  if (!orderId || typeof orderId !== 'string') return null;
  const trimmed = orderId.trim();

  // Pattern 1: ORD-YYYY-MM-DD-... (e.g. ORD-2026-09-02-001)
  const matchYMD = trimmed.match(/^ORD-(\d{4})-(\d{2})-(\d{2})(?:-\d+)?$/i);
  if (matchYMD) {
    const y = parseInt(matchYMD[1], 10);
    const m = parseInt(matchYMD[2], 10) - 1;
    const d = parseInt(matchYMD[3], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  // Pattern 2: ORD-MM-DD-YYYY-... (e.g. ORD-09-02-2026-001)
  const matchMDY = trimmed.match(/^ORD-(\d{2})-(\d{2})-(\d{4})(?:-\d+)?$/i);
  if (matchMDY) {
    const m = parseInt(matchMDY[1], 10) - 1;
    const d = parseInt(matchMDY[2], 10);
    const y = parseInt(matchMDY[3], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  // Pattern 3: ORD-YYYY-MM-NN (e.g. ORD-2025-08-04)
  const matchYM = trimmed.match(/^ORD-(\d{4})-(\d{2})-\d+$/i);
  if (matchYM) {
    const y = parseInt(matchYM[1], 10);
    const m = parseInt(matchYM[2], 10) - 1;
    const dt = new Date(y, m, 1);
    if (!isNaN(dt.getTime())) return dt;
  }

  // Pattern 4: ORD-MM-DD-NN without year (e.g. ORD-08-26-04)
  // Historical data runs August 2025 to January 2026 -> only January (01) is 2026, all other months are 2025
  const matchMD = trimmed.match(/^ORD-(\d{2})-(\d{2})-\d+$/i);
  if (matchMD) {
    const m = parseInt(matchMD[1], 10) - 1;
    const d = parseInt(matchMD[2], 10);
    const y = m === 0 ? 2026 : 2025;
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
}

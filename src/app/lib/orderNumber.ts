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

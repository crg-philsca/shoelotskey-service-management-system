/**
 * Central currency formatter for Philippine Peso (₱).
 * Ensures consistent rendering of two decimal places across all views (e.g. ₱912.50 instead of ₱912.5).
 */
export function formatPeso(amount: number | string | null | undefined): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(numeric) || numeric === null || numeric === undefined) {
    return '\u20B10.00';
  }
  return `\u20B1${numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPesoNumber(amount: number | string | null | undefined): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(numeric) || numeric === null || numeric === undefined) {
    return '0.00';
  }
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

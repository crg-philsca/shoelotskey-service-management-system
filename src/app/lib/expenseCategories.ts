/**
 * Canonical expense categories used by Log/Edit Expense and the Expenses filter.
 * Keep this list in sync so filter options match the edit modal.
 */
export const EXPENSE_CATEGORIES = [
    'Water',
    'Internet',
    'Staff Salary',
    'Logistics',
    'Cleaning Materials',
    'Cleaning Aids',
    'Chemicals',
    'Food',
    'Rent',
    'Electricity',
    'Other (Manual Insert)',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Categories shown in filters (excludes the "manual insert" placeholder). */
export const EXPENSE_FILTER_CATEGORIES = EXPENSE_CATEGORIES.filter(
    (cat) => cat !== 'Other (Manual Insert)'
);

/** Strip legacy frequency suffixes like "(Monthly)" / "(Daily)" from stored category labels. */
export function cleanExpenseCategory(category: string): string {
    return String(category || '')
        .replace(/\s*\((Monthly|Daily|Weekly|Bi-Weekly|Quarterly|Yearly|One-Time)\)/gi, '')
        .trim();
}

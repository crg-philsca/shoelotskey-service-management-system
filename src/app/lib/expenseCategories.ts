/**
 * Authoritative expense categories and groups used across the application:
 * - Inventory Expenses (restocking, supplies, tools, chemicals, equipment)
 * - Operational Expenses (operating overhead: utilities, salaries, rent, logistics)
 * - Other Expenses (repairs, marketing, packaging, miscellaneous)
 */

export type ExpenseGroupType = 'Inventory Expenses' | 'Operating Expenses' | 'Other Expenses';

/**
 * 1. INVENTORY EXPENSES
 * Categories used in Inventory and restocking shoe care & repair materials.
 */
export const INVENTORY_EXPENSE_CATEGORIES = [
    'Chemicals',
    'Supplies',
    'Tools',
    'Equipment',
    'Cleaning Materials',
    'Cleaning Aids',
    'Inventory / Restock',
] as const;

/**
 * 2. OPERATIONAL EXPENSES (Operating Expenses)
 * Core business running costs and facility overhead.
 */
export const OPERATIONAL_EXPENSE_CATEGORIES = [
    'Water',
    'Electricity',
    'Internet',
    'Staff Salary',
    'Rent',
    'Logistics',
    'Food',
] as const;

/**
 * 3. OTHER EXPENSES
 * Non-operating overhead, maintenance, marketing, and miscellaneous costs.
 */
export const OTHER_EXPENSE_CATEGORIES = [
    'Repairs & Maintenance',
    'Marketing & Promotion',
    'Packaging & Delivery',
    'Miscellaneous',
    'Other (Manual Insert)',
] as const;

export const EXPENSE_GROUPS = [
    {
        id: 'inventory' as const,
        name: 'Inventory Expenses' as const,
        label: 'Inventory Expenses',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        categories: INVENTORY_EXPENSE_CATEGORIES,
    },
    {
        id: 'operating' as const,
        name: 'Operating Expenses' as const,
        label: 'Operational Expenses',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        categories: OPERATIONAL_EXPENSE_CATEGORIES,
    },
    {
        id: 'other' as const,
        name: 'Other Expenses' as const,
        label: 'Other Expenses',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        categories: OTHER_EXPENSE_CATEGORIES,
    },
] as const;

/** Full list of canonical categories */
export const EXPENSE_CATEGORIES = [
    ...INVENTORY_EXPENSE_CATEGORIES,
    ...OPERATIONAL_EXPENSE_CATEGORIES,
    ...OTHER_EXPENSE_CATEGORIES,
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Categories shown in filter selectors (excludes the manual insert trigger) */
export const EXPENSE_FILTER_CATEGORIES = EXPENSE_CATEGORIES.filter(
    (cat) => cat !== 'Other (Manual Insert)'
);

/**
 * Maps any category name to its canonical Expense Group.
 */
export function getExpenseGroup(category: string): ExpenseGroupType {
    const c = String(category || '').toLowerCase().trim();
    if (
        c.includes('cleaning') ||
        c.includes('chemical') ||
        c.includes('inventory') ||
        c.includes('restock') ||
        c.includes('supplies') ||
        c.includes('supply') ||
        c.includes('tool') ||
        c.includes('equipment')
    ) {
        return 'Inventory Expenses';
    }
    if (
        c.includes('water') ||
        c.includes('electricity') ||
        c.includes('internet') ||
        c.includes('salary') ||
        c.includes('payroll') ||
        c.includes('logistics') ||
        c.includes('food') ||
        c.includes('lunch') ||
        c.includes('rent') ||
        c.includes('utilities')
    ) {
        return 'Operating Expenses';
    }
    return 'Other Expenses';
}

/** Strip legacy frequency suffixes like "(Monthly)" / "(Daily)" from stored category labels. */
export function cleanExpenseCategory(category: string): string {
    return String(category || '')
        .replace(/\s*\((Monthly|Daily|Weekly|Bi-Weekly|Quarterly|Yearly|One-Time)\)/gi, '')
        .trim();
}

/**
 * Intelligent filter matching for category filtering:
 * Handles exact matches, case differences, singular/plural aliases, and restock variants.
 */
export function matchExpenseCategory(expenseCat: string, targetCat: string): boolean {
    if (!targetCat || targetCat === 'all') return true;
    const cleanExp = cleanExpenseCategory(expenseCat).toLowerCase();
    const cleanTarget = cleanExpenseCategory(targetCat).toLowerCase();

    if (cleanExp === cleanTarget) return true;

    // Singular/plural aliases
    if ((cleanTarget === 'chemicals' && cleanExp === 'chemical') || (cleanTarget === 'chemical' && cleanExp === 'chemicals')) return true;
    if ((cleanTarget === 'supplies' && cleanExp === 'supply') || (cleanTarget === 'supply' && cleanExp === 'supplies')) return true;
    if ((cleanTarget === 'tools' && cleanExp === 'tool') || (cleanTarget === 'tool' && cleanExp === 'tools')) return true;
    if ((cleanTarget === 'cleaning materials' && cleanExp === 'cleaning material') || (cleanTarget === 'cleaning material' && cleanExp === 'cleaning materials')) return true;
    if ((cleanTarget === 'cleaning aids' && cleanExp === 'cleaning aid') || (cleanTarget === 'cleaning aid' && cleanExp === 'cleaning aids')) return true;

    // Inventory & Restock
    if (cleanTarget.includes('inventory') || cleanTarget.includes('restock')) {
        if (cleanExp.includes('inventory') || cleanExp.includes('restock')) return true;
    }

    return false;
}

/**
 * Maps an inventory item's category to the most appropriate Inventory Expense Category.
 */
export function getInventoryExpenseCategory(invCategory?: string): string {
    if (!invCategory) return 'Inventory / Restock';
    const c = invCategory.trim().toLowerCase();
    for (const validCat of INVENTORY_EXPENSE_CATEGORIES) {
        if (validCat.toLowerCase() === c) return validCat;
    }
    if (c.includes('clean') && c.includes('aid')) return 'Cleaning Aids';
    if (c.includes('clean') || c.includes('material')) return 'Cleaning Materials';
    if (c.includes('chem') || c.includes('adhesive') || c.includes('glue') || c.includes('dye') || c.includes('paint')) return 'Chemicals';
    if (c.includes('tool')) return 'Tools';
    if (c.includes('equip')) return 'Equipment';
    if (c.includes('supply') || c.includes('supplies')) return 'Supplies';
    return 'Inventory / Restock';
}

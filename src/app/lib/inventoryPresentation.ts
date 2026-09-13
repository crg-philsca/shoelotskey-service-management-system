/**
 * Inventory Presentation Model & Calculations
 * Correctly represents physical stock, partial packaging containers, and usage estimates.
 */

export interface InventoryPresentation {
    currentQuantityLabel: string;        // e.g., "1,000 mL"
    containersLabel: string;             // e.g., "2 Full Jugs + 3,000 mL"
    containersSubLabel?: string;         // secondary label
    equivalentLabel: string;             // e.g., "2 Full Jugs + 3,000 mL" or "20% of one Jug"
    packageLabel: string;                // e.g., "Jug (4,000 mL)" – for dashboard / table
    daysRemainingLabel?: string;
    daysRemaining: number | null;
    totalContainers: number;
    percentageInCurrentPackage: number;
    isPackaged: boolean;
    stockStatus: 'No Stock' | 'Low Stock' | 'In Stock';
    statusLabel: string;
    reorderRecommendation?: string;
    dropdownLabel: string;
    availableText: string;
    fullPackages: number;
    remainingVolume: number;
    percentageRemaining: number;
    progressBarValue: number;
    compactLabel: string;
}

/**
 * Helper to pluralize package unit names cleanly (Jug -> Jugs, Can -> Cans, Box -> Boxes)
 */
function formatUnitName(unit: string, count: number): string {
    const clean = unit.trim();
    if (!clean) return '';
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (count <= 1) return capitalized;
    const lower = clean.toLowerCase();
    if (lower.endsWith('s')) return capitalized;
    if (lower.endsWith('x')) return capitalized.slice(0, -1) + 'xes';
    if (lower.endsWith('box')) return capitalized.slice(0, -3) + 'Boxes';
    return capitalized + 's';
}

/** Lowercase version for use mid-sentence ("of one Jug") */
function formatUnitNameLower(unit: string, count: number): string {
    const result = formatUnitName(unit, count);
    if (!result) return '';
    return result.charAt(0).toLowerCase() + result.slice(1);
}

/**
 * Calculates physical container breakdown and usage projections from item data.
 * Compatible with both camelCase frontend items and snake_case backend items.
 */
export function getInventoryPresentation(item: any): InventoryPresentation {
    const stock = Number(item.stock ?? item.stock_quantity ?? 0);
    const unit = String(item.unit ?? '').trim();
    const packageSize = Number(item.package_size ?? item.packageSize ?? 0);
    const packageUnit = String(item.package_unit ?? item.packageUnit ?? '').trim();
    const threshold = Number(item.low_stock_threshold ?? item.lowStockThreshold ?? 0);
    const consumption = Number(item.consumption_qty ?? item.consumptionQty ?? 0);

    const isPackaged = packageSize > 0 && packageUnit !== '';
    const currentQuantityLabel = `${stock.toLocaleString()} ${unit}`;

    let fullPackages = 0;
    let remainingVolume = 0;
    let percentageRemaining = 0;
    let progressBarValue = 0;
    let containersLabel = '';
    let containersSubLabel: string | undefined = undefined;
    let compactLabel = '';
    let equivalentLabel = '';
    let packageLabel = '';

    const effectiveThreshold = threshold > 0 ? threshold : (packageSize > 0 ? packageSize : 1);

    if (isPackaged) {
        const unitSingular = formatUnitName(packageUnit, 1);
        const unitSingularLower = formatUnitNameLower(packageUnit, 1);

        // e.g. "Jug (4,000 mL)"
        packageLabel = `${unitSingular} (${packageSize.toLocaleString()} ${unit})`;

        if (stock <= 0) {
            containersLabel = `0 ${formatUnitNameLower(packageUnit, 0)}`;
            compactLabel = `0% of one ${unitSingularLower}`;
            equivalentLabel = compactLabel;
            progressBarValue = 0;
        } else {
            fullPackages = Math.floor(stock / packageSize);
            remainingVolume = Math.round(stock % packageSize);
            percentageRemaining = Math.round((remainingVolume / packageSize) * 100);
            // progressBarValue: if 1 or more full packages, stock is well-supplied (100%).
            // If less than 1 package, show exact percentage of the single package remaining.
            if (fullPackages >= 1) {
                progressBarValue = 100;
            } else {
                progressBarValue = Math.min(Math.max(percentageRemaining, 0), 100);
            }

            if (fullPackages > 0) {
                const pluralUnit = formatUnitName(packageUnit, fullPackages);
                if (remainingVolume > 0) {
                    containersLabel = `${fullPackages} Full ${pluralUnit} + ${remainingVolume.toLocaleString()} ${unit}`;
                    containersSubLabel = `${percentageRemaining}% of next ${unitSingularLower}`;
                    compactLabel = containersLabel;
                    equivalentLabel = containersLabel;
                } else {
                    containersLabel = `${fullPackages} Full ${pluralUnit}`;
                    compactLabel = containersLabel;
                    equivalentLabel = containersLabel;
                }
            } else {
                // Less than one full package
                containersLabel = `${percentageRemaining}% of one ${unitSingularLower} remaining`;
                compactLabel = containersLabel;
                equivalentLabel = containersLabel;
            }
        }
    } else {
        containersLabel = currentQuantityLabel;
        compactLabel = currentQuantityLabel;
        equivalentLabel = currentQuantityLabel;
        packageLabel = '';
        if (stock <= 0) {
            progressBarValue = 0;
        } else if (effectiveThreshold > 0 && stock <= effectiveThreshold) {
            progressBarValue = Math.min(100, Math.max(10, Math.round((stock / effectiveThreshold) * 50)));
        } else {
            progressBarValue = 100;
        }
    }

    const totalContainers = isPackaged && packageSize > 0 ? Math.ceil(stock / packageSize) : 0;
    const percentageInCurrentPackage = isPackaged && packageSize > 0
        ? (stock % packageSize === 0 && stock > 0 ? 100 : Math.round(((stock % packageSize) / packageSize) * 100))
        : 100;

    let daysRemaining: number | null = null;
    let daysRemainingLabel: string | undefined = undefined;

    if (consumption > 0) {
        if (stock <= 0) {
            daysRemaining = 0;
            daysRemainingLabel = '0 days remaining (Depleted)';
        } else {
            const rawDays = stock / consumption;
            const formattedDays = Number(rawDays.toFixed(rawDays < 1 ? 1 : (rawDays % 1 === 0 ? 0 : 1)));
            daysRemaining = formattedDays;
            const dayText = formattedDays <= 1 ? 'day' : 'days';
            daysRemainingLabel = `≈ ${formattedDays} ${dayText} remaining`;
        }
    }

    let stockStatus: 'No Stock' | 'Low Stock' | 'In Stock';
    let statusLabel: string;
    let reorderRecommendation: string;

    // P1-4 FIX: This previously only treated an item as "Low Stock" when an explicit
    // low_stock_threshold (> 0) was set, silently reporting "In Stock" for any item
    // relying on the packageSize/1-unit fallback threshold. That diverged from the single
    // authoritative rule used everywhere else (backend `Inventory.recalculate_status()`,
    // `InventoryContext.calculateStatus()`, and `Dashboard.tsx`'s lowStockItems filter),
    // which all fall back to packageSize, then 1, when no explicit threshold is set. This
    // effectiveThreshold mirrors that same rule so the Inventory table/detail view can never
    // show a different status than the Dashboard or the backend-persisted `item.status`.
    if (stock <= 0) {
        stockStatus = 'No Stock';
        statusLabel = 'NO STOCK';
        reorderRecommendation = 'URGENT: Reorder immediately (Stock depleted)';
    } else if (stock <= effectiveThreshold) {
        stockStatus = 'Low Stock';
        statusLabel = 'LOW STOCK';
        reorderRecommendation = `Reorder recommended (At or below threshold of ${effectiveThreshold.toLocaleString()} ${unit})`;
    } else {
        stockStatus = 'In Stock';
        statusLabel = 'IN STOCK';
        reorderRecommendation = 'Stock levels sufficient';
    }

    let dropdownLabel = currentQuantityLabel;
    if (isPackaged) {
        dropdownLabel = `${currentQuantityLabel} (${containersLabel})`;
    }
    const availableText = dropdownLabel;

    return {
        currentQuantityLabel,
        containersLabel,
        containersSubLabel,
        equivalentLabel,
        packageLabel,
        daysRemainingLabel,
        daysRemaining,
        totalContainers,
        percentageInCurrentPackage,
        isPackaged,
        stockStatus,
        statusLabel,
        reorderRecommendation,
        dropdownLabel,
        availableText,
        fullPackages,
        remainingVolume,
        percentageRemaining,
        progressBarValue,
        compactLabel
    };
}

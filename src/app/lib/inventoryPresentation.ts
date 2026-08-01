/**
 * Inventory Presentation Model & Calculations
 * Correctly represents physical stock, partial packaging containers, and usage estimates.
 */

export interface InventoryPresentation {
    currentQuantityLabel: string;        // e.g., "1000 mL"
    containersLabel: string;             // e.g., "≈ 1 Jug (25%)" or "≈ 2 Jugs"
    containersSubLabel?: string;         // e.g., "1 Full + 25%"
    daysRemainingLabel?: string;         // e.g., "≈ 0.5 day remaining" or "≈ 4 days remaining"
    daysRemaining: number | null;
    totalContainers: number;
    percentageInCurrentPackage: number;
    isPackaged: boolean;
    stockStatus: 'Critical' | 'Low Stock' | 'In Stock';
    statusLabel: string;
    reorderRecommendation?: string;
    dropdownLabel: string;               // Clean string for select options: e.g., "4000 mL (11 cans, 340 mL remaining)"
    availableText: string;               // Alias for dropdownLabel
}

/**
 * Helper to pluralize package unit names cleanly (Jug -> Jugs, Can -> Cans, Tub -> Tubs, Box -> Boxes)
 */
function formatUnitName(unit: string, count: number): string {
    const clean = unit.trim();
    if (count <= 1) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    const lower = clean.toLowerCase();
    if (lower.endsWith('s')) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    if (lower.endsWith('box')) return clean.charAt(0).toUpperCase() + clean.slice(1, -3).toLowerCase() + 'Boxes';
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() + 's';
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

    // 1. Calculate Physical Containers & Percentage Breakdown
    let totalContainers = 0;
    let percentageInCurrentPackage = 100;
    let containersLabel = '';
    let containersSubLabel: string | undefined = undefined;

    if (isPackaged) {
        if (stock <= 0) {
            totalContainers = 0;
            percentageInCurrentPackage = 0;
            containersLabel = `0 ${formatUnitName(packageUnit, 0).toLowerCase()}`;
        } else {
            // Any leftover liquid/powder is inside a real, physical container
            totalContainers = Math.ceil(stock / packageSize);
            const fullContainers = Math.floor(stock / packageSize);
            const remainder = Math.round(Number((stock - (fullContainers * packageSize)).toFixed(4)));
            
            if (remainder === 0) {
                percentageInCurrentPackage = 100;
                containersLabel = `${fullContainers} ${formatUnitName(packageUnit, fullContainers).toLowerCase()}`;
            } else {
                percentageInCurrentPackage = Math.round((remainder / packageSize) * 100);
                if (fullContainers === 0) {
                    containersLabel = `${remainder} ${unit} remaining`;
                } else {
                    containersLabel = `${fullContainers} ${formatUnitName(packageUnit, fullContainers).toLowerCase()}, ${remainder} ${unit} remaining`;
                    containersSubLabel = `${remainder} ${unit} left`;
                }
            }
        }
    } else {
        // Unpackaged items (e.g., standard supplies measured only by count)
        containersLabel = currentQuantityLabel;
    }

    // 2. Calculate Estimated Days Remaining
    let daysRemaining: number | null = null;
    let daysRemainingLabel: string | undefined = undefined;

    if (consumption > 0) {
        if (stock <= 0) {
            daysRemaining = 0;
            daysRemainingLabel = '0 days remaining (Depleted)';
        } else {
            const rawDays = stock / consumption;
            // Round to sensible decimal display (e.g., 0.5 or integer)
            const formattedDays = Number(rawDays.toFixed(rawDays < 1 ? 1 : (rawDays % 1 === 0 ? 0 : 1)));
            daysRemaining = formattedDays;
            const dayText = formattedDays <= 1 ? 'day' : 'days';
            daysRemainingLabel = `≈ ${formattedDays} ${dayText} remaining`;
        }
    }

    // 3. Stock Status & Reorder Recommendation
    let stockStatus: 'Critical' | 'Low Stock' | 'In Stock';
    let statusLabel: string;
    let reorderRecommendation: string;

    if (stock <= 0) {
        stockStatus = 'Critical';
        statusLabel = 'CRITICAL / OUT OF STOCK';
        reorderRecommendation = 'URGENT: Reorder immediately (Stock depleted)';
    } else if (stock <= threshold) {
        stockStatus = 'Low Stock';
        statusLabel = 'LOW STOCK';
        reorderRecommendation = `Reorder recommended (At or below low stock threshold of ${threshold} ${unit})`;
    } else {
        stockStatus = 'In Stock';
        statusLabel = 'IN STOCK';
        reorderRecommendation = 'Stock levels sufficient';
    }

    // 4. Dropdown Label & Available Text
    let dropdownLabel = currentQuantityLabel;
    if (isPackaged) {
        dropdownLabel = `${currentQuantityLabel} (${containersLabel})`;
    }
    const availableText = dropdownLabel;

    return {
        currentQuantityLabel,
        containersLabel,
        containersSubLabel,
        daysRemainingLabel,
        daysRemaining,
        totalContainers,
        percentageInCurrentPackage,
        isPackaged,
        stockStatus,
        statusLabel,
        reorderRecommendation,
        dropdownLabel,
        availableText
    };
}

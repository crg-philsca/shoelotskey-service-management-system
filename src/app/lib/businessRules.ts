/** Official Job Order release durations from the deployed Shoelotskey form. */

export const OFFICIAL_DURATION_DAYS: Record<string, number> = {
    'Basic Cleaning': 10,
    'Minor Reglue': 25,
    'Full Reglue': 25,
    'Color Renewal': 25,
    'Unyellowing': 5,
    'Sole Unyellowing': 5,
    'Minor Retouch': 0,
    'Minor Restoration': 0,
    'Full Restoration': 25,
    'White Paint': 0,
    '2 Colors': 0,
    '3 Colors': 0,
    'Midsole Full Reglue': 25,
    'Undersole Full Reglue': 25,
    'Full Reglue Midsole': 25,
    'Full Reglue Undersole': 25,
    'Midsole': 25,
    'Undersole': 25,
    'Add Glue Layer': 0,
};

export const DEFAULT_RUSH_REDUCTION_DAYS = 9;
export const MIN_DURATION_DAYS = 1;

export type OfficialShoeInput = {
    baseService?: string[] | string;
    addOns?: Array<string | { name?: string; quantity?: number }>;
};

export type OfficialBreakdown = {
    baseDays: number;
    addOnDays: number;
    priorityDays: number;
    totalDays: number;
};

export function parseDuration(val: string | number | undefined | null): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (val.includes('-')) {
        const parts = val.split('-').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
        return parts.length > 0 ? Math.max(...parts) : 0;
    }
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function asNameList(value: OfficialShoeInput['baseService']): string[] {
    if (!value) return [];
    if (typeof value === 'string') return value ? [value] : [];
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function addonPairs(value: OfficialShoeInput['addOns']): Array<[string, number]> {
    if (!value) return [];
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (typeof item === 'string') return [item, 1] as [string, number];
            const name = item?.name || '';
            const qty = item?.quantity || 1;
            return [name, qty] as [string, number];
        })
        .filter(([name]) => Boolean(name));
}

export function officialServiceDays(
    name: string,
    catalogDurations?: Record<string, string | number>,
): number {
    const trimmedName = (name || '').trim();
    const lowered = trimmedName.toLowerCase();
    if (
        trimmedName === 'Full Reglue Midsole' ||
        trimmedName === 'Full Reglue Undersole' ||
        trimmedName === 'Midsole Full Reglue' ||
        trimmedName === 'Undersole Full Reglue' ||
        trimmedName === 'Midsole' ||
        trimmedName === 'Undersole' ||
        (lowered.includes('reglue') && (lowered.includes('midsole') || lowered.includes('undersole')))
    ) {
        return 25;
    }
    if (catalogDurations && catalogDurations[trimmedName] !== undefined && catalogDurations[trimmedName] !== '') {
        return parseDuration(catalogDurations[trimmedName]);
    }
    if (trimmedName in OFFICIAL_DURATION_DAYS) return OFFICIAL_DURATION_DAYS[trimmedName];
    if (trimmedName === 'Basic Cleaning') return 10;
    if (lowered.includes('reglue') || lowered.includes('color renewal')) return 25;
    return 0;
}

export function calculateOfficialReleaseBreakdown(
    shoes: OfficialShoeInput[],
    priorityLevel = 'regular',
    rushReductionDays = DEFAULT_RUSH_REDUCTION_DAYS,
    catalogDurations?: Record<string, string | number>,
): OfficialBreakdown {
    let baseDays = 0;
    let addOnDays = 0;
    let priorityDays = 0;

    const safeShoes = Array.isArray(shoes) ? shoes : [];

    let pairBaseDays = 0;
    let pairAddOnDays = 0;
    safeShoes.forEach((shoe) => {
        let shoeBase = 0;
        let shoeAddOn = 0;
        const servicesArr = asNameList(shoe.baseService);
        const hasDurationInclusive = servicesArr.some((s) => {
            const low = (s || '').trim().toLowerCase();
            return low.includes('reglue') || low.includes('color renewal');
        });
        const filtered = hasDurationInclusive
            ? servicesArr.filter((s) => (s || '').trim() !== 'Basic Cleaning')
            : servicesArr;
        filtered.forEach((serviceName) => {
            const days = officialServiceDays(serviceName, catalogDurations) || ((serviceName || '').trim() === 'Basic Cleaning' ? 10 : 25);
            shoeBase = Math.max(shoeBase, days);
        });
        const hasFullReglueBase = servicesArr.some((s) => {
            const low = (s || '').trim().toLowerCase();
            return low === 'full reglue' || low.includes('full reglue');
        });

        let reglueAddonDaysAccounted = false;

        addonPairs(shoe.addOns).forEach(([name, qty]) => {
            const trimmedName = (name || '').trim();
            const lowered = trimmedName.toLowerCase();
            const isRegluePart = (
                trimmedName === 'Full Reglue Midsole' ||
                trimmedName === 'Full Reglue Undersole' ||
                trimmedName === 'Midsole Full Reglue' ||
                trimmedName === 'Undersole Full Reglue' ||
                trimmedName === 'Midsole' ||
                trimmedName === 'Undersole' ||
                (lowered.includes('reglue') && (lowered.includes('midsole') || lowered.includes('undersole')))
            );
            if (isRegluePart) {
                // Full Reglue already encompasses midsole and undersole reglue (25 days total) - do NOT add extra days
                if (hasFullReglueBase) {
                    return;
                }
                // If Full Reglue is not in base, but midsole/undersole reglue are both selected as add-ons:
                // they cure concurrently in 25 days total, not 50 days
                if (!reglueAddonDaysAccounted) {
                    shoeAddOn += officialServiceDays(trimmedName, catalogDurations);
                    reglueAddonDaysAccounted = true;
                }
                return;
            }
            shoeAddOn += officialServiceDays(trimmedName, catalogDurations) * qty;
        });
        if (shoeBase + shoeAddOn > pairBaseDays + pairAddOnDays) {
            pairBaseDays = shoeBase;
            pairAddOnDays = shoeAddOn;
        }
    });
    baseDays = pairBaseDays;
    addOnDays = pairAddOnDays;

    if (priorityLevel === 'rush') {
        const rush = Number(rushReductionDays);
        priorityDays = -(Number.isFinite(rush) ? rush : DEFAULT_RUSH_REDUCTION_DAYS);
    }

    const hasServices = safeShoes.some((shoe) => {
        const base = asNameList(shoe.baseService);
        const addons = addonPairs(shoe.addOns);
        return base.length > 0 || addons.length > 0;
    });
    const effectiveDays = baseDays + addOnDays;
    const rawTotal = effectiveDays + priorityDays;
    const totalDays = hasServices ? Math.max(MIN_DURATION_DAYS, rawTotal) : 0;
    return { baseDays, addOnDays, priorityDays, totalDays };
}

export function formatBusinessRuleLabel(breakdown: OfficialBreakdown): string {
    const parts = ['Base Service'];
    if (breakdown.addOnDays > 0) parts.push('Add-ons');
    let text = parts.join(' + ');
    if (breakdown.priorityDays < 0) text += ' - Rush';
    else if (breakdown.priorityDays > 0) text += ' + Priority';
    return text;
}

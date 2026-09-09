/** Official Job Order release durations from the deployed Shoelotskey form. */

export const OFFICIAL_DURATION_DAYS: Record<string, number> = {
    'Basic Cleaning': 10,
    'Minor Reglue': 25,
    'Full Reglue': 25,
    'Color Renewal': 25,
    'Unyellowing': 5,
    'Minor Retouch': 5,
    'Minor Restoration': 25,
    'Full Restoration': 25,
    'White Paint': 0,
    '2 Colors': 0,
    '3 Colors': 0,
    'Midsole Full Reglue': 20,
    'Undersole Full Reglue': 20,
    'Midsole': 20,
    'Undersole': 20,
    'Add Glue Layer': 2,
};

export const DEFAULT_RUSH_REDUCTION_DAYS = 9;
export const MIN_DURATION_DAYS = 3;

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
    if (catalogDurations && catalogDurations[name] !== undefined && catalogDurations[name] !== '') {
        return parseDuration(catalogDurations[name]);
    }
    if (name in OFFICIAL_DURATION_DAYS) return OFFICIAL_DURATION_DAYS[name];
    if (name === 'Basic Cleaning') return 10;
    const lowered = (name || '').toLowerCase();
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

    let hasBasicCleaning = false;
    let hasMinorReglue = false;
    let hasFullReglue = false;
    let hasColorRenewal = false;
    let hasUnyellowing = false;
    let hasMinorRestoration = false;
    let hasFullRestoration = false;
    let hasMinorRetouch = false;

    const safeShoes = Array.isArray(shoes) ? shoes : [];
    safeShoes.forEach((shoe) => {
        const names = [
            ...asNameList(shoe.baseService),
            ...addonPairs(shoe.addOns).map(([name]) => name),
        ];
        if (names.includes('Basic Cleaning')) hasBasicCleaning = true;
        if (names.includes('Minor Reglue')) hasMinorReglue = true;
        if (names.includes('Full Reglue')) hasFullReglue = true;
        if (names.includes('Color Renewal')) hasColorRenewal = true;
        if (names.includes('Unyellowing')) hasUnyellowing = true;
        if (names.includes('Minor Restoration') || names.includes('MRES')) hasMinorRestoration = true;
        if (names.includes('Full Restoration') || names.includes('FR')) hasFullRestoration = true;
        if (names.includes('Minor Retouch')) hasMinorRetouch = true;
    });

    let overriddenDays: number | null = null;
    if (hasBasicCleaning) {
        if (hasColorRenewal || hasFullReglue) overriddenDays = 25;
        else if (hasMinorRestoration || hasMinorRetouch) overriddenDays = 20;
        else if (hasUnyellowing) overriddenDays = 15;
        else if (hasMinorReglue) overriddenDays = 10;
    }
    if (overriddenDays === null) {
        if ((hasFullRestoration || hasFullReglue) && hasMinorRestoration) {
            overriddenDays = 25;
        } else if ((hasFullReglue || hasColorRenewal) && hasUnyellowing) {
            overriddenDays = 25;
        }
    }

    let pairBaseDays = 0;
    let pairAddOnDays = 0;
    safeShoes.forEach((shoe) => {
        let shoeBase = 0;
        let shoeAddOn = 0;
        const servicesArr = asNameList(shoe.baseService);
        const hasDurationInclusive = servicesArr.some((s) =>
            s.toLowerCase().includes('reglue') || s.toLowerCase().includes('color renewal')
        );
        const filtered = hasDurationInclusive
            ? servicesArr.filter((s) => s !== 'Basic Cleaning')
            : servicesArr;
        filtered.forEach((serviceName) => {
            const days = officialServiceDays(serviceName, catalogDurations);
            shoeBase += days || (serviceName === 'Basic Cleaning' ? 10 : 25);
        });
        addonPairs(shoe.addOns).forEach(([name, qty]) => {
            shoeAddOn += officialServiceDays(name, catalogDurations) * qty;
        });
        if (shoeBase + shoeAddOn > pairBaseDays + pairAddOnDays) {
            pairBaseDays = shoeBase;
            pairAddOnDays = shoeAddOn;
        }
    });
    baseDays = pairBaseDays;
    addOnDays = pairAddOnDays;

    if (overriddenDays === null && priorityLevel === 'rush') {
        const rush = Number(rushReductionDays);
        priorityDays = -(Number.isFinite(rush) ? rush : DEFAULT_RUSH_REDUCTION_DAYS);
    }

    const hasServices = safeShoes.some((shoe) => {
        const base = asNameList(shoe.baseService);
        const addons = addonPairs(shoe.addOns);
        return base.length > 0 || addons.length > 0;
    });
    const rawTotal = overriddenDays !== null
        ? overriddenDays
        : baseDays + addOnDays + priorityDays;
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

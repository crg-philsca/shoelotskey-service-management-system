/** Pairing lists keep existing Job Order add-on rules; unmatched catalog add-ons still appear. */
const BASIC_CLEANING_ADDONS = ['Unyellowing', 'White Paint', 'Minor Restoration', 'Minor Retouch'];
const REGLUE_ADDONS = [
    'Add Glue Layer',
    'Premium Glue',
    'Midsole',
    'Undersole',
    'Midsole Full Reglue',
    'Undersole Full Reglue',
    'Middlesole Glue',
    'Undersole Glue',
    'Midsole Glue',
];
export const TWO_COLORS = '2 Colors';
export const THREE_COLORS = '3 Colors';
const COLOR_ADDONS = [TWO_COLORS, THREE_COLORS];
const PAIRED_ADDONS = new Set([...BASIC_CLEANING_ADDONS, ...REGLUE_ADDONS, ...COLOR_ADDONS]);

type AddonEntry = { name: string; quantity?: number };

export function hasColorRenewal(baseServices: string[] = []): boolean {
    return (baseServices || []).some((s) => (s || '').includes('Color Renewal'));
}

export function isColorCountAddon(name: string): boolean {
    return name === TWO_COLORS || name === THREE_COLORS;
}

/** Color Renewal may use 2 Colors or 3 Colors, never both. */
export function applyColorCountExclusive(
    addOns: AddonEntry[] = [],
    selectedName: string,
    checked: boolean,
    baseServices: string[] = [],
): AddonEntry[] {
    if (!isColorCountAddon(selectedName)) return addOns || [];
    const other = selectedName === TWO_COLORS ? THREE_COLORS : TWO_COLORS;
    let next = [...(addOns || [])];

    if (checked) {
        next = next.filter((addon) => addon.name !== other);
        if (!next.some((addon) => addon.name === selectedName)) {
            next.push({ name: selectedName, quantity: 1 });
        }
        return next;
    }

    if (hasColorRenewal(baseServices) && !next.some((addon) => addon.name === other)) {
        return addOns || [];
    }
    return next.filter((addon) => addon.name !== selectedName);
}

export function syncColorRenewalAddons(
    addOns: AddonEntry[] = [],
    baseServices: string[] = [],
): AddonEntry[] {
    if (!hasColorRenewal(baseServices)) {
        return (addOns || []).filter((addon) => !isColorCountAddon(addon.name));
    }
    const hasTwo = (addOns || []).some((addon) => addon.name === TWO_COLORS);
    const hasThree = (addOns || []).some((addon) => addon.name === THREE_COLORS);
    if (hasTwo && hasThree) {
        return (addOns || []).filter((addon) => addon.name !== THREE_COLORS);
    }
    if (!hasTwo && !hasThree) {
        return [...(addOns || []), { name: TWO_COLORS, quantity: 1 }];
    }
    return addOns || [];
}

export function shoeHasBothColorCounts(addOns: Array<string | { name?: string }> = []): boolean {
    const names = (addOns || []).map((addon) => (typeof addon === 'string' ? addon : addon?.name || ''));
    return names.includes(TWO_COLORS) && names.includes(THREE_COLORS);
}

export function isAddonVisibleForBaseServices(addonName: string, baseServices: string[] = []): boolean {
    if (!baseServices.length) return false;
    if (baseServices.includes('Basic Cleaning') && BASIC_CLEANING_ADDONS.includes(addonName)) return true;
    if (baseServices.some((s) => s.toLowerCase().includes('reglue')) && REGLUE_ADDONS.includes(addonName)) return true;
    if (baseServices.some((s) => s.includes('Color Renewal')) && COLOR_ADDONS.includes(addonName)) return true;
    return !PAIRED_ADDONS.has(addonName);
}

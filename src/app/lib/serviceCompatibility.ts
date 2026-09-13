export const BASIC_CLEANING_ADDONS = ['Unyellowing', 'White Paint', 'Minor Restoration', 'Minor Retouch'];
export const FULL_REGLUE_SOLE_ADDONS = [
    'Full Reglue Midsole',
    'Full Reglue Undersole',
    'Midsole Full Reglue',
    'Undersole Full Reglue',
    'Midsole',
    'Undersole',
];
export const GENERAL_REGLUE_ADDONS = [
    'Add Glue Layer',
    'Premium Glue',
    'Middlesole Glue',
    'Undersole Glue',
    'Midsole Glue',
];
export const TWO_COLORS = '2 Colors';
export const THREE_COLORS = '3 Colors';
export const COLOR_ADDONS = [TWO_COLORS, THREE_COLORS];

function norm(str: string): string {
    return (str || '').trim().toLowerCase();
}

export function isFullReglueSoleAddon(addonName: string): boolean {
    const n = norm(addonName);
    return (
        n === 'full reglue midsole' ||
        n === 'full reglue undersole' ||
        n === 'midsole full reglue' ||
        n === 'undersole full reglue' ||
        n === 'midsole' ||
        n === 'undersole' ||
        (n.includes('reglue') && (n.includes('midsole') || n.includes('undersole')))
    );
}

export function isGeneralReglueAddon(addonName: string): boolean {
    const n = norm(addonName);
    if (isFullReglueSoleAddon(addonName)) return false;
    return (
        n.includes('glue layer') ||
        n.includes('premium glue') ||
        n.includes('glue')
    );
}

export function isCleaningAddon(addonName: string): boolean {
    const n = norm(addonName);
    return (
        n.includes('unyellowing') ||
        n.includes('white paint') ||
        n.includes('minor retouch') ||
        n.includes('minor restoration')
    );
}

export function isColorRenewalAddon(addonName: string): boolean {
    const n = norm(addonName);
    return n.includes('color') || n === '2 colors' || n === '3 colors';
}

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

export function isAddonCompatibleWithSingleService(addonName: string, serviceName: string): boolean {
    const s = norm(serviceName);
    const hasFullReglue = s === 'full reglue';
    const hasMinorReglue = s === 'minor reglue';
    const hasBasicCleaning = s === 'basic cleaning';
    const hasColorRenewal = s.includes('color renewal');

    if (isFullReglueSoleAddon(addonName)) return hasFullReglue;
    if (isGeneralReglueAddon(addonName)) return hasFullReglue || hasMinorReglue;
    if (isCleaningAddon(addonName)) return hasBasicCleaning;
    if (isColorRenewalAddon(addonName)) return hasColorRenewal;
    return false;
}

export function isAddonVisibleForBaseServices(
    addonName: string,
    baseServices: string[] = [],
    allServices?: any[]
): boolean {
    if (!baseServices || !baseServices.length) return false;

    const normAddon = norm(addonName);

    // Dynamic connected add-ons check if allServices catalog is provided
    if (allServices && allServices.length > 0) {
        const selectedBaseObjs = allServices.filter((s: any) =>
            s?.category === 'base' &&
            baseServices.some((bsName) => {
                const cleanBs = norm(bsName).replace(/\(with basic cleaning\)/g, '').trim();
                const cleanS = norm(s?.name || '').replace(/\(with basic cleaning\)/g, '').trim();
                return cleanBs === cleanS || cleanBs.includes(cleanS) || cleanS.includes(cleanBs);
            })
        );

        if (selectedBaseObjs.length > 0) {
            const addonObj = allServices.find((s: any) => s?.category === 'addon' && norm(s?.name || '') === normAddon);
            const addonIdStr = addonObj?.id ? norm(String(addonObj.id)) : null;

            // An add-on is visible if it is connected or compatible with ANY of the selected base services
            return selectedBaseObjs.some((s: any) => {
                const hasConfig = Array.isArray(s.connectedAddons) && s.connectedAddons.length > 0;
                if (hasConfig) {
                    return s.connectedAddons.some((conn: string) => {
                        const normConn = norm(conn);
                        return normConn === normAddon || (addonIdStr && normConn === addonIdStr);
                    });
                }
                // Unconfigured fallback: use standard compatibility for this specific base service
                return isAddonCompatibleWithSingleService(addonName, s.name);
            });
        }
    }

    const hasFullReglue = baseServices.some((s) => norm(s) === 'full reglue');
    const hasMinorReglue = baseServices.some((s) => norm(s) === 'minor reglue');
    const hasBasicCleaning = baseServices.some((s) => norm(s) === 'basic cleaning');
    const hasColorRenewal = baseServices.some((s) => norm(s).includes('color renewal'));

    // 1. Full Reglue Midsole and Undersole: STRICTLY shown only when "Full Reglue" base service is selected
    if (isFullReglueSoleAddon(addonName)) {
        return hasFullReglue;
    }

    // 2. General reglue add-ons: shown when either Full Reglue or Minor Reglue is selected
    if (isGeneralReglueAddon(addonName)) {
        return hasFullReglue || hasMinorReglue;
    }

    // 3. Cleaning add-ons: shown only when Basic Cleaning is selected
    if (isCleaningAddon(addonName)) {
        return hasBasicCleaning;
    }

    // 4. Color count add-ons: shown only when Color Renewal is selected
    if (isColorRenewalAddon(addonName)) {
        return hasColorRenewal;
    }

    return false;
}


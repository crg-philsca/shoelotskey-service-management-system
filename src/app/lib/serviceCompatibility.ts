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

function getAddonItemName(addon: string | { name?: string }): string {
    return typeof addon === 'string' ? addon : addon?.name || '';
}

export function hasColorRenewal(baseServices: string[] = []): boolean {
    return (baseServices || []).some((s) => (s || '').includes('Color Renewal'));
}

export function isColorCountAddon(name: string): boolean {
    return name === TWO_COLORS || name === THREE_COLORS;
}

/** Color Renewal may use 2 Colors or 3 Colors, never both. */
export function applyColorCountExclusive(
    addOns: Array<string | AddonEntry> = [],
    selectedName: string,
    checked: boolean,
    baseServices: string[] = [],
): any[] {
    if (!isColorCountAddon(selectedName)) return addOns || [];
    const other = selectedName === TWO_COLORS ? THREE_COLORS : TWO_COLORS;
    let next = (addOns || []).filter((addon) => getAddonItemName(addon) !== other);

    if (checked) {
        if (!next.some((addon) => getAddonItemName(addon) === selectedName)) {
            next.push({ name: selectedName, quantity: 1 });
        }
        return next;
    }

    return next.filter((addon) => getAddonItemName(addon) !== selectedName);
}

export function syncColorRenewalAddons(
    addOns: Array<string | AddonEntry> = [],
    baseServices: string[] = [],
): any[] {
    if (!hasColorRenewal(baseServices)) {
        return (addOns || []).filter((addon) => !isColorCountAddon(getAddonItemName(addon)));
    }
    const hasTwo = (addOns || []).some((addon) => getAddonItemName(addon) === TWO_COLORS);
    const hasThree = (addOns || []).some((addon) => getAddonItemName(addon) === THREE_COLORS);
    if (hasTwo && hasThree) {
        return (addOns || []).filter((addon) => getAddonItemName(addon) !== THREE_COLORS);
    }
    return addOns || [];
}

export function shoeHasBothColorCounts(addOns: Array<string | { name?: string }> = []): boolean {
    const names = (addOns || []).map((addon) => (typeof addon === 'string' ? addon : addon?.name || ''));
    return names.includes(TWO_COLORS) && names.includes(THREE_COLORS);
}

export interface ColorRenewalValidationResult {
    isValid: boolean;
    error?: string;
    hasColorRenewal: boolean;
    hasTwoColors: boolean;
    hasThreeColors: boolean;
}

/**
 * Validates Color Renewal selection and color count add-ons:
 * 1. If Color Renewal is selected, require exactly one applicable color add-on: 2 Colors or 3 Colors.
 * 2. Prevent selecting both color options for the same shoe.
 * 3. If Color Renewal is not selected, neither color option should be selected.
 */
export function validateColorRenewalSelection(
    baseServices: string[] = [],
    addOns: Array<string | { name?: string }> = []
): ColorRenewalValidationResult {
    const hasCR = hasColorRenewal(baseServices);
    const names = (addOns || []).map((a) => (typeof a === 'string' ? a : a?.name || ''));
    const has2 = names.includes(TWO_COLORS);
    const has3 = names.includes(THREE_COLORS);

    if (hasCR) {
        if (has2 && has3) {
            return {
                isValid: false,
                error: 'Color Renewal cannot have both 2 Colors and 3 Colors selected for the same shoe.',
                hasColorRenewal: true,
                hasTwoColors: true,
                hasThreeColors: true,
            };
        }
        if (!has2 && !has3) {
            return {
                isValid: false,
                error: 'Color Renewal requires selecting either 2 Colors or 3 Colors under Add-on Services.',
                hasColorRenewal: true,
                hasTwoColors: false,
                hasThreeColors: false,
            };
        }
        return {
            isValid: true,
            hasColorRenewal: true,
            hasTwoColors: has2,
            hasThreeColors: has3,
        };
    }

    if (has2 || has3) {
        return {
            isValid: false,
            error: '2 Colors or 3 Colors can only be selected when Color Renewal is selected.',
            hasColorRenewal: false,
            hasTwoColors: has2,
            hasThreeColors: has3,
        };
    }

    return {
        isValid: true,
        hasColorRenewal: false,
        hasTwoColors: false,
        hasThreeColors: false,
    };
}

export function hasFullReglue(baseServices: string[] = []): boolean {
    return (baseServices || []).some((s) => norm(s) === 'full reglue');
}

export function syncFullReglueAddons(
    addOns: Array<string | AddonEntry> = [],
    baseServices: string[] = [],
): any[] {
    if (!hasFullReglue(baseServices)) {
        return (addOns || []).filter((addon) => !isFullReglueSoleAddon(getAddonItemName(addon)));
    }
    return addOns || [];
}

export interface FullReglueValidationResult {
    isValid: boolean;
    error?: string;
    hasFullReglue: boolean;
    hasSoleSelection: boolean;
    soleAddonsCount: number;
}

/**
 * Validates Full Reglue specification:
 * 1. If Full Reglue is selected, at least one sole section (Midsole, Undersole, or both) must be selected.
 * 2. If Full Reglue is not selected, neither Midsole nor Undersole should be selected.
 */
export function validateFullReglueSelection(
    baseServices: string[] = [],
    addOns: Array<string | { name?: string }> = []
): FullReglueValidationResult {
    const hasFR = hasFullReglue(baseServices);
    const soleAddons = (addOns || []).filter((a) => isFullReglueSoleAddon(getAddonItemName(a)));

    if (hasFR) {
        if (soleAddons.length === 0) {
            return {
                isValid: false,
                error: 'Full Reglue requires specifying the reglue location (Midsole, Undersole, or both) under Add-on Services.',
                hasFullReglue: true,
                hasSoleSelection: false,
                soleAddonsCount: 0,
            };
        }
        return {
            isValid: true,
            hasFullReglue: true,
            hasSoleSelection: true,
            soleAddonsCount: soleAddons.length,
        };
    }

    if (soleAddons.length > 0) {
        return {
            isValid: false,
            error: 'Midsole or Undersole reglue can only be selected when Full Reglue is selected.',
            hasFullReglue: false,
            hasSoleSelection: true,
            soleAddonsCount: soleAddons.length,
        };
    }

    return {
        isValid: true,
        hasFullReglue: false,
        hasSoleSelection: false,
        soleAddonsCount: 0,
    };
}

export interface SolePricingDisplay {
    isSoleAddon: boolean;
    isCoveredByBase: boolean;
    displayLabel: string; // "Included", "+₱150.00", or formatted price
}

/**
 * Calculates dynamic pricing label for Full Reglue sole add-ons:
 * - One location selected: "Included" (covered by base Full Reglue fee)
 * - Both locations selected: "Included" for the included location, "+₱150.00" for the additional location.
 */
export function getSoleAddonPricingDisplay(
    addonName: string,
    selectedAddons: Array<string | { name?: string }> = [],
    baseServices: string[] = [],
    defaultPrice: number = 150
): SolePricingDisplay {
    const isFR = hasFullReglue(baseServices);
    const isSole = isFullReglueSoleAddon(addonName);

    if (!isFR || !isSole) {
        return {
            isSoleAddon: isSole,
            isCoveredByBase: false,
            displayLabel: `₱${defaultPrice.toFixed(2)}`,
        };
    }

    const soleAddons = (selectedAddons || []).filter((a) => isFullReglueSoleAddon(getAddonItemName(a)));
    const isThisSelected = soleAddons.some((a) => {
        const aName = norm(getAddonItemName(a));
        const curr = norm(addonName);
        return aName === curr || (curr.includes('midsole') && aName.includes('midsole')) || (curr.includes('undersole') && aName.includes('undersole'));
    });

    if (!isThisSelected) {
        return {
            isSoleAddon: true,
            isCoveredByBase: false,
            displayLabel: '',
        };
    }

    // Only one sole location selected: covered by base Full Reglue
    if (soleAddons.length === 1) {
        return {
            isSoleAddon: true,
            isCoveredByBase: true,
            displayLabel: 'Included',
        };
    }

    // Multiple sole locations selected:
    // Whichever sole was selected first is covered/included, and the subsequent sole is chargeable (+₱150.00)
    const firstSole = soleAddons[0];
    const isFirstMidsole = norm(getAddonItemName(firstSole)).includes('midsole');
    const isCurrentMidsole = norm(addonName).includes('midsole');
    const isCovered = isFirstMidsole ? isCurrentMidsole : !isCurrentMidsole;

    if (isCovered) {
        return {
            isSoleAddon: true,
            isCoveredByBase: true,
            displayLabel: 'Included',
        };
    }

    return {
        isSoleAddon: true,
        isCoveredByBase: false,
        displayLabel: '+₱150.00',
    };
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

/**
 * Checks whether a shoe's selected base services and add-ons are eligible for a given Priority/Rush fee.
 */
export function isRushApplicableForShoe(
    baseServices: string[],
    addOns: (string | { name: string })[],
    rushService?: any | null
): boolean {
    if (!rushService || rushService.active === false) return false;
    if (!baseServices || baseServices.length === 0) return false;

    // Check base services eligibility if configured
    const allowedBase = Array.isArray(rushService.connectedBaseServices) ? rushService.connectedBaseServices : [];
    if (allowedBase.length > 0) {
        const matchesBase = baseServices.some(bs => 
            allowedBase.some((allowed: string) => norm(allowed) === norm(bs) || norm(bs).includes(norm(allowed)))
        );
        if (!matchesBase) return false;
    }

    // Check add-ons eligibility if configured
    const addonNames = (addOns || []).map((a: any) => typeof a === 'string' ? a : a?.name).filter(Boolean);
    const allowedAddons = Array.isArray(rushService.connectedAddons) ? rushService.connectedAddons : [];
    if (allowedAddons.length > 0) {
        // If specific add-ons are whitelisted for rush, ensure all selected add-ons are allowed
        const hasDisallowedAddon = addonNames.some((selected: string) => 
            !allowedAddons.some((allowed: string) => norm(allowed) === norm(selected))
        );
        if (hasDisallowedAddon) return false;
    }

    return true;
}

/**
 * Finds the best matching Rush/Priority fee for a shoe's services from the active catalog.
 */
export function getApplicableRushFee(
    baseServices: string[],
    addOns: (string | { name: string })[],
    allServices: any[]
): any | null {
    const priorityServices = (allServices || []).filter((s: any) => s?.category === 'priority' && s?.active);
    if (!priorityServices.length) return null;

    // 1. Look for a priority service specifically configured for these base services & add-ons
    const matched = priorityServices.find((ps: any) => isRushApplicableForShoe(baseServices, addOns, ps));
    if (matched) return matched;

    // 2. Fallback: if an unconfigured priority fee exists (universal fallback)
    const generic = priorityServices.find((ps: any) => 
        (!ps.connectedBaseServices || ps.connectedBaseServices.length === 0) &&
        (!ps.connectedAddons || ps.connectedAddons.length === 0)
    );
    return generic || null;
}

/**
 * Sorts add-ons for display according to user requirements:
 * 1. If Full Reglue is chosen, its sole options (Full Reglue Midsole & Undersole) appear at the top row.
 * 2. If Color Renewal is chosen, its options (2 Colors & 3 Colors) appear at the top row.
 * 3. If both are chosen, whichever base service was checked first appears at Row 1, and the other at Row 2.
 * 4. Remaining add-ons follow below sorted by sortOrder.
 */
export function sortAddonsForDisplay<T extends { name: string; sortOrder?: number | string }>(
    addons: T[],
    baseServices: string[] = []
): T[] {
    const frIndex = baseServices.findIndex(s => norm(s).includes('full reglue'));
    const crIndex = baseServices.findIndex(s => norm(s).includes('color renewal'));

    const hasFR = frIndex !== -1;
    const hasCR = crIndex !== -1;

    const getPriority = (addonName: string): number => {
        const isFRAddon = isFullReglueSoleAddon(addonName);
        const isCRAddon = isColorCountAddon(addonName);

        if (hasFR && hasCR) {
            if (frIndex < crIndex) {
                // Full Reglue checked first -> Full Reglue row 1, Color Renewal row 2
                if (isFRAddon) return 1;
                if (isCRAddon) return 2;
            } else {
                // Color Renewal checked first -> Color Renewal row 1, Full Reglue row 2
                if (isCRAddon) return 1;
                if (isFRAddon) return 2;
            }
        } else if (hasFR) {
            if (isFRAddon) return 1;
        } else if (hasCR) {
            if (isCRAddon) return 1;
        }

        return 3;
    };

    return [...addons].sort((a, b) => {
        const prioA = getPriority(a.name);
        const prioB = getPriority(b.name);
        if (prioA !== prioB) {
            return prioA - prioB;
        }

        // Within Full Reglue sole add-ons, Midsole first, then Undersole
        if (isFullReglueSoleAddon(a.name) && isFullReglueSoleAddon(b.name)) {
            const isMidA = norm(a.name).includes('midsole');
            const isMidB = norm(b.name).includes('midsole');
            if (isMidA && !isMidB) return -1;
            if (!isMidA && isMidB) return 1;
        }

        // Within Color Renewal add-ons, 2 Colors first, then 3 Colors
        if (isColorCountAddon(a.name) && isColorCountAddon(b.name)) {
            if (a.name === TWO_COLORS && b.name === THREE_COLORS) return -1;
            if (a.name === THREE_COLORS && b.name === TWO_COLORS) return 1;
        }

        // Default sort order
        const sortA = Number(a.sortOrder) || 999;
        const sortB = Number(b.sortOrder) || 999;
        if (sortA !== sortB) return sortA - sortB;

        return (a.name || '').localeCompare(b.name || '');
    });
}



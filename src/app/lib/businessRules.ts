/** Official Job Order release durations from the authoritative Shoelotskey Business Rules.
 * Decoupled from editable service codes and strictly non-additive.
 */

export const OFFICIAL_DURATION_DAYS: Record<string, number> = {
    'Basic Cleaning': 10,
    'Minor Reglue': 10,
    'Full Reglue': 25,
    'Color Renewal': 25,
    'Unyellowing': 20,
    'Sole Unyellowing': 20,
    'Minor Retouch': 20,
    'Minor Restoration': 20,
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
    'Add Glue Layer': 2,
};

export const NORMAL_MAX_DAYS = 25;
export const SAFETY_CEILING_DAYS = 30;
export const DEFAULT_RUSH_REDUCTION_DAYS = 9;
export const MIN_DURATION_DAYS = 1;

export type OfficialShoeInput = {
    baseService?: string[] | string | Array<{ id?: number | string; name?: string; service_id?: number | string; service_name?: string }>;
    addOns?: Array<string | { id?: number | string; name?: string; service_id?: number | string; service_name?: string; quantity?: number }>;
};

export type OfficialBreakdown = {
    baseDays: number;
    addOnDays: number;
    priorityDays: number;
    totalDays: number;
};

// Canonical identities
export const CANONICAL_BC = 'BC';
export const CANONICAL_MR = 'MR';
export const CANONICAL_FR = 'FR';
export const CANONICAL_COR = 'COR';
export const CANONICAL_UNY = 'UNY';
export const CANONICAL_MRES = 'MRES';
export const CANONICAL_MRET = 'MRET';

// Stable service_id to canonical identity mapping
export const STABLE_ID_TO_CANONICAL: Record<number, string> = {
    1: CANONICAL_BC,    // Basic Cleaning
    3: CANONICAL_FR,    // Full Reglue
    4: CANONICAL_MR,    // Minor Reglue
    6: CANONICAL_UNY,   // Unyellowing
    10: CANONICAL_MRET, // Minor Retouch
    41: CANONICAL_MRES, // Minor Restoration
    67: CANONICAL_COR,  // Color Renewal
    166: CANONICAL_FR,  // Full Reglue Midsole
    167: CANONICAL_FR,  // Full Reglue Undersole
    39: CANONICAL_FR,   // Undersole Full Reglue
    40: CANONICAL_FR,   // Midsole Full Reglue
};

export function resolveCanonicalService(serviceRef: any): string | null {
    if (serviceRef === undefined || serviceRef === null) return null;

    if (typeof serviceRef === 'object') {
        const sid = serviceRef.service_id ?? serviceRef.id;
        if (sid !== undefined && sid !== null) {
            const sidNum = Number(sid);
            if (!isNaN(sidNum) && STABLE_ID_TO_CANONICAL[sidNum]) {
                return STABLE_ID_TO_CANONICAL[sidNum];
            }
        }
        const name = serviceRef.name || serviceRef.service_name || serviceRef.service_code;
        if (name) return resolveCanonicalService(String(name));
        return null;
    }

    if (typeof serviceRef === 'number') {
        return STABLE_ID_TO_CANONICAL[serviceRef] || null;
    }

    const text = String(serviceRef).trim();
    if (!text) return null;

    const num = Number(text);
    if (!isNaN(num) && STABLE_ID_TO_CANONICAL[num]) {
        return STABLE_ID_TO_CANONICAL[num];
    }

    const lowered = text.toLowerCase();

    if (
        lowered.includes('full reglue') ||
        (lowered.includes('reglue') && (lowered.includes('midsole') || lowered.includes('undersole'))) ||
        lowered.includes('full restoration') ||
        lowered === 'fr'
    ) {
        return CANONICAL_FR;
    }
    if (lowered.includes('minor reglue') || lowered === 'mr') {
        return CANONICAL_MR;
    }
    if (lowered.includes('color renewal') || lowered.includes('color restoration') || lowered === 'cor' || lowered === 'cr') {
        return CANONICAL_COR;
    }
    if (lowered.includes('unyellowing') || lowered === 'uny') {
        return CANONICAL_UNY;
    }
    if (lowered.includes('minor restoration') || lowered === 'mres') {
        return CANONICAL_MRES;
    }
    if (lowered.includes('minor retouch') || lowered === 'mret') {
        return CANONICAL_MRET;
    }
    if (lowered.includes('basic cleaning') || lowered === 'bc') {
        return CANONICAL_BC;
    }

    return null;
}

export function toServiceCode(nameOrCode: string): string {
    if (!nameOrCode) return '';
    const trimmed = String(nameOrCode).trim();
    if (!trimmed) return '';
    const upper = trimmed.toUpperCase();
    if (['BC', 'FR', 'MR', 'BR', 'COR', 'WPT', 'UNY', 'MRES', 'MRET', 'FRMID', 'FRUND', 'COR2', 'COR3'].includes(upper)) {
        return upper;
    }
    if (upper === 'CR') return 'COR';
    if (upper === 'UY') return 'UNY';
    if (upper === 'FRUS') return 'FRUND';

    const lower = trimmed.toLowerCase()
        .replace(/\s*\(\d+(?:\.\d+)?\)\s*$/, '')
        .replace(/[\s\-]+rush(?:\s*service)?$/i, '')
        .trim();

    if (lower.includes('midsole') || lower === 'fr mid' || lower === 'frmid') return 'FRMID';
    if (lower.includes('undersole') || lower === 'frunder' || lower === 'frund' || lower === 'frus') return 'FRUND';
    if (lower.includes('3 color') || lower.includes('3 colors')) return 'COR3';
    if (lower.includes('2 color') || lower.includes('2 colors')) return 'COR2';
    if (lower.includes('color renewal') || lower.includes('color restoration') || lower === 'cor' || lower === 'cr') return 'COR';
    if (lower.includes('white paint') || lower === 'wpt') return 'WPT';
    if (lower.includes('unyellowing') || lower === 'uny' || lower === 'uy') return 'UNY';
    if (lower.includes('minor restoration') || lower === 'mres') return 'MRES';
    if (lower.includes('minor retouch') || lower === 'mret') return 'MRET';
    if (lower.includes('minor reglue') || lower === 'mr') return 'MR';
    if (lower.includes('basic reglue') || lower === 'br') return 'BR';
    if (lower.includes('full reglue') || lower.includes('full restoration') || lower === 'fr') return 'FR';
    if (lower.includes('basic cleaning') || lower.includes('cleaning') || lower === 'bc') return 'BC';

    const canon = resolveCanonicalService(trimmed);
    if (canon) return canon;

    return upper;
}

/**
 * Normalizes an array of services (names, codes, or objects) into canonical display codes.
 * - Suppresses generic 'FR' if 'FRMID' or 'FRUND' specification is present.
 * - Suppresses generic 'COR' if 'COR2' or 'COR3' specification is present.
 * - Preserves generic 'FR' or 'COR' if no specific sub-specification is recorded (historical compatibility).
 * - Deduplicates while preserving order.
 */
export function normalizeServiceCodes(services: (string | any)[]): string[] {
    if (!services || !Array.isArray(services)) return [];

    const rawList: string[] = [];
    services.forEach((s) => {
        if (!s) return;
        if (typeof s === 'string') {
            if (s.includes(',')) {
                s.split(',').forEach((sub) => {
                    const trimmed = sub.trim();
                    if (trimmed) rawList.push(trimmed);
                });
            } else {
                const trimmed = s.trim();
                if (trimmed) rawList.push(trimmed);
            }
        } else if (typeof s === 'object') {
            const name = s.service_code || s.code || s.name || s.service_name || s.service || '';
            if (name) {
                if (typeof name === 'string' && name.includes(',')) {
                    name.split(',').forEach((sub) => {
                        const trimmed = sub.trim();
                        if (trimmed) rawList.push(trimmed);
                    });
                } else {
                    rawList.push(String(name).trim());
                }
            }
        }
    });

    let codes: string[] = [];
    for (const item of rawList) {
        const clean = item.replace(/\s*\(with basic cleaning\)/gi, '').trim();
        const code = toServiceCode(clean) || clean.toUpperCase();
        if (code && !codes.includes(code)) {
            codes.push(code);
        }
    }

    // Specification replacements:
    // If FRMID or FRUND is present, remove generic FR
    const hasFullReglueSpec = codes.some((c) => c === 'FRMID' || c === 'FRUND');
    if (hasFullReglueSpec) {
        codes = codes.filter((c) => c !== 'FR');
    }

    // If COR2 or COR3 is present, remove generic COR
    const hasColorRenewalSpec = codes.some((c) => c === 'COR2' || c === 'COR3');
    if (hasColorRenewalSpec) {
        codes = codes.filter((c) => c !== 'COR');
    }

    return codes;
}

/**
 * Chunks service names/codes into lines with up to 2 service codes per row.
 * E.g. ['BC'] -> ['BC']
 * E.g. ['BC', 'FR', 'FRMID'] -> ['BC, FRMID']
 * E.g. ['BC', 'COR', 'COR2'] -> ['BC, COR2']
 * E.g. ['BC', 'FR', 'FRMID', 'FRUND'] -> ['BC, FRMID,', 'FRUND']
 */
export function chunkServiceCodesTwoPerRow(services: string[]): string[] {
    const codes = normalizeServiceCodes(services);
    if (codes.length === 0) return [];

    const rows: string[] = [];
    for (let i = 0; i < codes.length; i += 2) {
        const chunk = codes.slice(i, i + 2);
        const isLastChunk = i + 2 >= codes.length;
        rows.push(chunk.join(', ') + (isLastChunk ? '' : ','));
    }
    return rows;
}

export function formatServiceBadge(service: { service_name?: string; display_label?: string; price?: number } | string | null | undefined): string {
    if (!service) return '';
    if (typeof service === 'string') {
        const raw = service.trim();
        const match = raw.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (match) {
            const namePart = match[1].trim();
            const pricePart = match[2];
            const code = toServiceCode(namePart);
            return pricePart !== undefined ? `${code}(${pricePart})` : code;
        }
        return toServiceCode(raw);
    }

    const rawLabel = (service.display_label || '').trim();
    if (rawLabel) {
        const match = rawLabel.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (match) {
            const namePart = match[1].trim();
            const pricePart = match[2];
            const code = toServiceCode(namePart || service.service_name || '');
            return pricePart !== undefined ? `${code}(${pricePart})` : (service.price && service.price > 0 ? `${code}(${Math.round(service.price)})` : code);
        }
    }

    const name = service.service_name || '';
    const code = toServiceCode(name);
    if (service.price && service.price > 0) {
        return `${code}(${Math.round(service.price)})`;
    }
    return code || name;
}

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
    if (typeof value === 'string') {
        if (value.includes(',')) {
            return value.split(',').map((s) => s.trim()).filter(Boolean);
        }
        return value ? [value.trim()] : [];
    }
    if (Array.isArray(value)) {
        return value.map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') return (item.name || item.service_name || '').trim();
            return '';
        }).filter(Boolean);
    }
    return [];
}

function addonPairs(value: OfficialShoeInput['addOns']): Array<[string, number]> {
    if (!value || !Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (typeof item === 'string') {
                return [item.trim(), 1] as [string, number];
            }
            const name = (item?.name || item?.service_name || '').trim();
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
    const c = resolveCanonicalService(trimmedName);
    if (c === CANONICAL_FR) return 25;
    if (c === CANONICAL_COR) return 25;
    if (c === CANONICAL_MR) return 10;
    if (c === CANONICAL_UNY) return 20;
    if (c === CANONICAL_MRES) return 20;
    if (c === CANONICAL_BC) return 10;
    if (c === CANONICAL_MRET) return 20;

    if (catalogDurations && catalogDurations[trimmedName] !== undefined && catalogDurations[trimmedName] !== '') {
        return parseDuration(catalogDurations[trimmedName]);
    }
    if (trimmedName in OFFICIAL_DURATION_DAYS) return OFFICIAL_DURATION_DAYS[trimmedName];
    return 0;
}

export function calculatePairDuration(
    canonicalServices: Set<string>,
    rawServices: string[],
    catalogDurations?: Record<string, string | number>,
): number {
    if (canonicalServices.size === 0 && rawServices.length === 0) {
        return 0;
    }

    // 1. Any combination containing Full Reglue (FR Dominant)
    if (canonicalServices.has(CANONICAL_FR)) {
        return 25;
    }

    // 2. Color Renewal Dominant (without FR)
    if (canonicalServices.has(CANONICAL_COR)) {
        return 25;
    }

    // 3. Minor Restoration Dominant (without FR/COR)
    if (canonicalServices.has(CANONICAL_MRES)) {
        return 20;
    }

    // 4. Unyellowing Dominant (without FR/COR/MRES)
    if (canonicalServices.has(CANONICAL_UNY)) {
        return 20;
    }

    // 5. Minor Retouch Dominant (without FR/COR)
    if (canonicalServices.has(CANONICAL_MRET)) {
        return 20;
    }

    // 6. BC + MR Combination
    if (canonicalServices.has(CANONICAL_MR) && canonicalServices.has(CANONICAL_BC)) {
        return 10;
    }

    // 6. Minor Reglue Standalone (without BC)
    if (canonicalServices.has(CANONICAL_MR)) {
        return 10;
    }

    // 7. Basic Cleaning Standalone
    if (canonicalServices.has(CANONICAL_BC)) {
        return 10;
    }

    // 8. Custom / unrecognized service: maximum catalog duration
    let maxD = 0;
    for (const s of rawServices) {
        const d = officialServiceDays(s, catalogDurations);
        if (d > maxD) maxD = d;
    }

    const capped = Math.min(maxD > 0 ? maxD : 10, NORMAL_MAX_DAYS);
    return Math.min(capped, SAFETY_CEILING_DAYS);
}

export function calculateOfficialReleaseBreakdown(
    shoes: OfficialShoeInput[],
    priorityLevel = 'regular',
    rushReductionDays = DEFAULT_RUSH_REDUCTION_DAYS,
    catalogDurations?: Record<string, string | number>,
): OfficialBreakdown {
    const safeShoes = Array.isArray(shoes) ? shoes : [];
    let longestPairWithoutRush = 0;
    let longestPairWithRush = 0;
    let hasAnyService = false;
    let anyRush = false;

    safeShoes.forEach((shoe) => {
        const canonicalSet = new Set<string>();
        const rawServices: string[] = [];

        const baseList = asNameList(shoe.baseService);
        baseList.forEach((s) => {
            rawServices.push(s);
            const c = resolveCanonicalService(s);
            if (c) canonicalSet.add(c);
        });

        const addons = addonPairs(shoe.addOns);
        addons.forEach(([name]) => {
            rawServices.push(name);
            const c = resolveCanonicalService(name);
            if (c) canonicalSet.add(c);
        });

        if (rawServices.length > 0 || canonicalSet.size > 0) {
            hasAnyService = true;
            const pairBaseDays = calculatePairDuration(canonicalSet, rawServices, catalogDurations);
            longestPairWithoutRush = Math.max(longestPairWithoutRush, pairBaseDays);

            const isPairRush = (shoe as any).priorityLevel === 'rush' || (safeShoes.length === 1 && priorityLevel.toLowerCase() === 'rush');
            let pairEffectiveDays = pairBaseDays;
            if (isPairRush) {
                anyRush = true;
                const shoeReduction = Number((shoe as any).rushReductionDays);
                const globalReduction = Number(rushReductionDays);
                const reduction = (Number.isFinite(shoeReduction) && shoeReduction > 0)
                    ? shoeReduction
                    : (Number.isFinite(globalReduction) && globalReduction > 0 ? globalReduction : DEFAULT_RUSH_REDUCTION_DAYS);
                pairEffectiveDays = Math.max(MIN_DURATION_DAYS, pairBaseDays - reduction);
            }
            longestPairWithRush = Math.max(longestPairWithRush, pairEffectiveDays);
        }
    });

    if (!hasAnyService || longestPairWithoutRush <= 0) {
        return { baseDays: 0, addOnDays: 0, priorityDays: 0, totalDays: 0 };
    }

    const baseDays = longestPairWithoutRush;
    const addOnDays = 0; // Non-additive: add-ons do not linearly sum
    const priorityDays = anyRush ? -(longestPairWithoutRush - longestPairWithRush) : 0;
    const totalDays = Math.min(
        SAFETY_CEILING_DAYS,
        Math.max(MIN_DURATION_DAYS, longestPairWithRush)
    );

    return { baseDays, addOnDays, priorityDays, totalDays };
}

/**
 * Authoritative Calendar-Day Addition.
 * Definition: The received/order date itself is NOT counted as Day 1.
 * The day after the received date is Day 1.
 * Examples:
 *   08/31 + 10 days = 09/10
 *   04/22 + 1 day   = 04/23
 *   09/14 + 25 days = 10/09
 */
export function addCalendarDays(baseDate: Date | string | number, days: number): Date {
    const d = new Date(baseDate);
    if (isNaN(d.getTime())) return new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return d;
}

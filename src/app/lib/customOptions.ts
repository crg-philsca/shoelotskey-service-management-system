/**
 * Custom Options persistence utility for Shoelotskey Job Order Form & Modals.
 * Remembers custom-typed brands, models, couriers, materials, sizes, and colors
 * in browser storage and synchronizes them across components and sessions.
 */

export const CUSTOM_OPTION_KEYS = {
    COURIERS: 'shoelotskey_custom_couriers',
    BRANDS: 'shoelotskey_custom_brands',
    MODELS: 'shoelotskey_custom_models',
    MATERIALS: 'shoelotskey_custom_materials',
    SIZES: 'shoelotskey_custom_sizes',
    COLORS: 'shoelotskey_custom_colors',
    INVENTORY_UNITS: 'shoelotskey_custom_inv_units',
    PACKAGE_TYPES: 'shoelotskey_custom_pkg_types',
    PACKAGE_SIZES: 'shoelotskey_custom_pkg_sizes',
    INVENTORY_CATEGORIES: 'shoelotskey_custom_inv_categories',
} as const;

export const CUSTOM_OPTION_EVENT = 'shoelotskey-custom-option-updated';

export function getStoredCustomOptions(key?: string): string[] {
    if (!key || typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item): item is string => typeof item === 'string' && !!item.trim() && item.trim().toLowerCase() !== 'other')
            .map(item => item.trim());
    } catch {
        return [];
    }
}

export function saveStoredCustomOption(key?: string, newOption?: string): boolean {
    if (!key || !newOption || typeof window === 'undefined') return false;
    const clean = newOption.trim();
    if (!clean || clean.toLowerCase() === 'other' || clean.length < 1) return false;

    try {
        const existing = getStoredCustomOptions(key);
        const lower = clean.toLowerCase();
        if (!existing.some(item => item.toLowerCase() === lower)) {
            const updated = [...existing, clean];
            localStorage.setItem(key, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent(CUSTOM_OPTION_EVENT, {
                detail: { key, option: clean, action: 'add' }
            }));
            return true;
        }
    } catch (e) {
        console.warn(`[CustomOptions] Failed to persist custom option for ${key}:`, e);
    }
    return false;
}

export function removeStoredCustomOption(key?: string, optionToRemove?: string): boolean {
    if (!key || !optionToRemove || typeof window === 'undefined') return false;
    const target = optionToRemove.trim().toLowerCase();
    try {
        const existing = getStoredCustomOptions(key);
        const updated = existing.filter(item => item.toLowerCase() !== target);
        if (updated.length !== existing.length) {
            localStorage.setItem(key, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent(CUSTOM_OPTION_EVENT, {
                detail: { key, option: optionToRemove, action: 'remove' }
            }));
            return true;
        }
    } catch (e) {
        console.warn(`[CustomOptions] Failed to remove custom option from ${key}:`, e);
    }
    return false;
}

/**
 * Harvests custom values from fetched database orders so any custom brand,
 * courier, model, etc., added by any user/station becomes automatically selectable.
 */
export function seedCustomOptionsFromOrders(orders: any[]): void {
    if (!orders || !Array.isArray(orders) || typeof window === 'undefined') return;

    for (const order of orders) {
        if (!order) continue;

        // Courier
        const courier = order.deliveryCourier || order.delivery_courier;
        if (courier && typeof courier === 'string') {
            saveStoredCustomOption(CUSTOM_OPTION_KEYS.COURIERS, courier);
        }

        // Shoes / Items
        const items = order.items || [];
        if (Array.isArray(items)) {
            for (const item of items) {
                if (!item) continue;
                if (item.brand && typeof item.brand === 'string') {
                    saveStoredCustomOption(CUSTOM_OPTION_KEYS.BRANDS, item.brand);
                }
                const model = item.shoeModel || item.shoe_model || item.model;
                if (model && typeof model === 'string') {
                    saveStoredCustomOption(CUSTOM_OPTION_KEYS.MODELS, model);
                }
                const material = item.shoeMaterial || item.shoe_material || item.material;
                if (material && typeof material === 'string') {
                    saveStoredCustomOption(CUSTOM_OPTION_KEYS.MATERIALS, material);
                }
                const size = item.shoeSize || item.shoe_size || item.size;
                if (size && typeof size === 'string') {
                    saveStoredCustomOption(CUSTOM_OPTION_KEYS.SIZES, size);
                }
                const color = item.color;
                if (color && typeof color === 'string') {
                    // Could be comma separated if multiple
                    color.split(',').forEach(c => {
                        const trimmed = c.trim();
                        if (trimmed) saveStoredCustomOption(CUSTOM_OPTION_KEYS.COLORS, trimmed);
                    });
                }
            }
        }
    }
}

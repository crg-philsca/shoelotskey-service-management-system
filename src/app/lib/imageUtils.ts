/**
 * @module imageUtils
 * Client-side image compression and persistent local storage helper for
 * before/after shoe photos and e-signatures.
 */

const ATTACHMENTS_STORE_KEY = 'shoelotskey_order_attachments_v1';

export interface StoredOrderAttachments {
  beforeImage?: string;
  afterImage?: string;
  customerSignature?: string;
  staffSignature?: string;
  items?: Record<string, { beforeImage?: string; afterImage?: string }>;
}

/**
 * Compresses an image file (e.g. from camera or file input) down to reasonable
 * dimensions and quality (~80-150KB) using an offscreen HTML5 canvas.
 */
export async function compressImageFile(file: File, maxDimension = 1000, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Draw with high quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Returns all stored order attachments from localStorage.
 */
function getAllStoredAttachments(): Record<string, StoredOrderAttachments> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ATTACHMENTS_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Retrieves stored attachments for a specific order by order number or ID.
 */
export function getOrderAttachments(orderNumberOrId?: string): StoredOrderAttachments | undefined {
  if (!orderNumberOrId) return undefined;
  const store = getAllStoredAttachments();
  const rawKey = String(orderNumberOrId).trim();
  return store[rawKey] || store[rawKey.toUpperCase()] || store[rawKey.toLowerCase()];
}

/**
 * Saves or updates attachments (before/after photos, signatures) for an order.
 */
export function saveOrderAttachments(
  orderNumberOrId: string,
  attachments: Partial<StoredOrderAttachments> & {
    itemAttachments?: { itemIdOrIndex: string | number; beforeImage?: string; afterImage?: string };
  }
): void {
  if (!orderNumberOrId || typeof window === 'undefined') return;
  try {
    const store = getAllStoredAttachments();
    const existing = store[orderNumberOrId] || { items: {} };

    const updated: StoredOrderAttachments = {
      ...existing,
      ...(attachments.beforeImage !== undefined ? { beforeImage: attachments.beforeImage } : {}),
      ...(attachments.afterImage !== undefined ? { afterImage: attachments.afterImage } : {}),
      ...(attachments.customerSignature !== undefined ? { customerSignature: attachments.customerSignature } : {}),
      ...(attachments.staffSignature !== undefined ? { staffSignature: attachments.staffSignature } : {}),
      items: { ...(existing.items || {}), ...(attachments.items || {}) },
    };

    if (attachments.customerSignature === '' || attachments.customerSignature === null) {
      delete updated.customerSignature;
    }
    if (attachments.staffSignature === '' || attachments.staffSignature === null) {
      delete updated.staffSignature;
    }

    if (attachments.itemAttachments) {
      const { itemIdOrIndex, beforeImage, afterImage } = attachments.itemAttachments;
      const key = String(itemIdOrIndex);
      updated.items = updated.items || {};
      updated.items[key] = {
        ...(updated.items[key] || {}),
        ...(beforeImage !== undefined ? { beforeImage } : {}),
        ...(afterImage !== undefined ? { afterImage } : {}),
      };
    }

    // Auto-sync first item beforeImage with root beforeImage
    if (updated.beforeImage && !updated.items?.['0']?.beforeImage) {
      updated.items = updated.items || {};
      updated.items['0'] = { ...(updated.items['0'] || {}), beforeImage: updated.beforeImage };
    }
    if (updated.items?.['0']?.beforeImage && !updated.beforeImage) {
      updated.beforeImage = updated.items['0'].beforeImage;
    }

    store[orderNumberOrId] = updated;
    localStorage.setItem(ATTACHMENTS_STORE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Failed to save order attachments to localStorage:', err);
  }
}

/**
 * Enriches an order object with stored before/after images and signatures.
 */
export function enrichOrderWithAttachments<T extends { orderNumber?: string; id?: string; items?: any[]; beforeImage?: string; afterImage?: string; customerSignature?: string; staffSignature?: string }>(
  order: T
): T {
  if (!order) return order;
  const key = order.orderNumber || order.id;
  const stored = (order.orderNumber ? getOrderAttachments(order.orderNumber) : undefined)
    || (order.id ? getOrderAttachments(String(order.id)) : undefined)
    || getOrderAttachments(key);
  if (!stored) return order;

  const enrichedOrder = { ...order };

  if (!enrichedOrder.beforeImage && stored.beforeImage) enrichedOrder.beforeImage = stored.beforeImage;
  if (!enrichedOrder.afterImage && stored.afterImage) enrichedOrder.afterImage = stored.afterImage;
  if (!enrichedOrder.customerSignature && stored.customerSignature) enrichedOrder.customerSignature = stored.customerSignature;
  if (!enrichedOrder.staffSignature && stored.staffSignature) enrichedOrder.staffSignature = stored.staffSignature;

  if (Array.isArray(enrichedOrder.items) && stored.items) {
    enrichedOrder.items = enrichedOrder.items.map((item, idx) => {
      const itemStored = stored.items?.[item.id] || stored.items?.[String(idx)] || (idx === 0 ? stored.items?.['0'] : undefined);
      if (!itemStored) {
        if (idx === 0 && stored.beforeImage && !item.beforeImage) {
          return { ...item, beforeImage: stored.beforeImage };
        }
        return item;
      }
      return {
        ...item,
        beforeImage: item.beforeImage || itemStored.beforeImage || (idx === 0 ? stored.beforeImage : undefined),
        afterImage: item.afterImage || itemStored.afterImage || (idx === 0 ? stored.afterImage : undefined),
      };
    });
  } else if (Array.isArray(enrichedOrder.items) && enrichedOrder.items.length > 0 && stored.beforeImage) {
    enrichedOrder.items = enrichedOrder.items.map((item, idx) => {
      if (idx === 0 && !item.beforeImage) {
        return { ...item, beforeImage: stored.beforeImage };
      }
      return item;
    });
  }

  // Cross-synchronize pair 0 beforeImage with root beforeImage
  if (Array.isArray(enrichedOrder.items) && enrichedOrder.items.length > 0) {
    if (!enrichedOrder.items[0].beforeImage && enrichedOrder.beforeImage) {
      enrichedOrder.items[0].beforeImage = enrichedOrder.beforeImage;
    }
    if (!enrichedOrder.beforeImage && enrichedOrder.items[0].beforeImage) {
      enrichedOrder.beforeImage = enrichedOrder.items[0].beforeImage;
    }
  }

  return enrichedOrder;
}

import { createContext, useContext, useState, ReactNode, useEffect, useRef, useMemo } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { JobOrder, PaymentRecord } from '@/app/types';
import { useActivities } from './ActivityContext';
import { toast } from 'sonner';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';
import { parseDateFromOrderId } from '@/app/lib/orderNumber';
import { resolvePaymentMethod } from '@/app/lib/salesAnalytics';
import { saveOrderAttachments, enrichOrderWithAttachments } from '@/app/lib/imageUtils';

function parseServerDate(dateStr: any): Date {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string') {
        return new Date(dateStr.replace(' ', 'T'));
    }
    return new Date(dateStr);
}

function parseOrderDateWithId(rawDate: any, orderNumber?: string): Date {
    const idDate = parseDateFromOrderId(orderNumber);
    const base = parseServerDate(rawDate);
    if (idDate && !isNaN(idDate.getTime())) {
        const combined = new Date(idDate);
        if (!isNaN(base.getTime())) {
            combined.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
        }
        return combined;
    }
    return base;
}

// Resilience Check: Verifies if the backend is actually reachable
const checkBackend = async (token: string) => {
    try {
        const res = await fetch(`${API_BASE}/orders?limit=1`, { 
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        return res.ok || res.status === 401; // Reachable even if unauthorized
    } catch {
        return false;
    }
};

interface OrderContextType {
    orders: JobOrder[];
    loading: boolean;
    refreshing: boolean;
    dbStatus: 'remote' | 'local' | 'unknown';
    // P1-7 FIX: now resolves `true` once the order is either genuinely confirmed saved by
    // the backend OR legitimately queued for offline auto-sync, and `false` on a definite
    // backend rejection (validation/auth/server error) — see addOrder() below. Callers must
    // await this before treating the submission as successful.
    addOrder: (order: JobOrder) => Promise<boolean>;
    updateOrder: (id: string, updates: Partial<JobOrder>, statusUser?: string) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
    refreshOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

/**
 * @module OrderContext
 * @description Centralized state management for Job Orders.
 * Handles real-time synchronization with the FastAPI backend while providing
 * a robust localStorage fallback for offline/resilient operations.
 */
export function OrderProvider({ children, user }: { children: ReactNode, user: { id?: number, username: string, token: string } }) {
    const syncNotificationShown = useRef(false);
    const inFlightOrderUpdates = useRef<Set<string>>(new Set());
    const { addActivity } = useActivities();
    const CACHE_KEY = 'jobOrders_v23_cache';

    // Safe cache saver with quota overflow eviction and stripping heavy base64 strings
    const safeSaveCachedOrders = (ordersToCache: JobOrder[]) => {
        if (typeof window === 'undefined' || !ordersToCache) return;
        try {
            // Strip heavy base64 strings (signatures, photos) from order cache to stay well under 5MB quota
            const lightOrders = ordersToCache.map(o => {
                const { beforeImage, afterImage, customerSignature, staffSignature, ...rest } = o as any;
                return rest;
            });
            const serialized = JSON.stringify(lightOrders);
            try {
                localStorage.setItem(CACHE_KEY, serialized);
            } catch (e: any) {
                if (e?.name === 'QuotaExceededError' || e?.code === 22 || String(e).includes('quota')) {
                    console.warn('[OrderContext] LocalStorage quota exceeded. Purging stale keys...');
                    try {
                        localStorage.removeItem('jobOrders_v19_cache');
                        localStorage.removeItem('jobOrders_v20_cache');
                        localStorage.removeItem('jobOrders_v21_cache');
                        localStorage.removeItem('jobOrders_v22_cache');
                        localStorage.removeItem('shoelotskey_job_orders');
                        localStorage.removeItem('jobOrders_cache');
                    } catch (_) {}
                    try {
                        localStorage.setItem(CACHE_KEY, serialized);
                    } catch (_) {
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify(lightOrders.slice(0, 50)));
                        } catch (finalErr) {
                            console.warn('[OrderContext] LocalStorage quota exhausted. Skipping cache write.', finalErr);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[OrderContext] Failed to serialize orders for cache:', err);
        }
    };

    const [orders, setOrders] = useState<JobOrder[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            localStorage.removeItem('jobOrders_v19_cache');
            localStorage.removeItem('jobOrders_v20_cache');
            localStorage.removeItem('jobOrders_v21_cache');
            localStorage.removeItem('jobOrders_v22_cache');
            localStorage.removeItem('shoelotskey_job_orders');
        } catch (_) {}

        const saved = localStorage.getItem(CACHE_KEY);
        let initialOrders: JobOrder[] = [];
        if (saved) {
            try {
                initialOrders = JSON.parse(saved).map((o: any) => {
                    const isClaimed = o.status === 'claimed';
                    let history: PaymentRecord[] = Array.isArray(o.paymentHistory) ? o.paymentHistory : [];
                    if (!isClaimed) {
                        history = history.filter(p => p.paymentType !== 'final-payment' && !String(p.notes || '').toLowerCase().includes('claim'));
                    }
                    const gt = Number(o.grandTotal || 0);
                    const dp = Number(o.depositAmount || 0);
                    const totalPaid = history.length > 0
                        ? history.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                        : (o.paymentStatus === 'downpayment' ? (dp > 0 ? dp : gt / 2) : gt);
                    const rawTendered = Number(o.amountReceived || 0);
                    const changeAmt = rawTendered > totalPaid ? rawTendered - totalPaid : (Number(o.change) || 0);

                    return {
                        ...o,
                        paymentHistory: history,
                        change: changeAmt,
                        paymentMethod: history.length > 1
                            ? history.map(p => p.method).filter((v, i, a) => a.indexOf(v) === i).join(', ')
                            : (history[0]?.method || o.initialPaymentMethod || o.paymentMethod || 'cash'),
                        createdAt: parseOrderDateWithId(o.createdAt, o.orderNumber),
                        updatedAt: new Date(o.updatedAt),
                        transactionDate: parseOrderDateWithId(o.transactionDate || o.createdAt, o.orderNumber),
                        predictedCompletionDate: o.predictedCompletionDate ? new Date(o.predictedCompletionDate) : undefined,
                        predictedAt: o.predictedAt ? new Date(o.predictedAt) : undefined,
                        predictedDays: o.predictedDays != null ? Number(o.predictedDays) : undefined,
                        actualCompletionDate: o.actualCompletionDate ? new Date(o.actualCompletionDate) : undefined,
                        balance: o.balance != null && !isNaN(Number(o.balance))
                            ? Number(o.balance)
                            : Math.max(0, gt - totalPaid),
                        statusHistory: o.statusHistory?.map((sl: any) => ({
                            ...sl,
                            timestamp: new Date(sl.timestamp)
                        })) || []
                    };
                });
            } catch (e) {
                console.error("Failed to parse cached orders", e);
            }
        }

        // Merge from sync queue (important for persistent offline data)
        const queueStr = localStorage.getItem('order_sync_queue');
        if (queueStr) {
            try {
                const queue = JSON.parse(queueStr);
                const pendingAdds = queue
                    .filter((q: any) => q.type === 'ADD')
                    .map((q: any) => ({
                        ...q.payload,
                        id: q.payload.id || `offline-${q.timestamp}`,
                        createdAt: new Date(q.timestamp),
                        updatedAt: new Date(q.timestamp),
                        statusHistory: []
                    }));
                
                // Add pending orders that aren't already in initialOrders
                pendingAdds.forEach((pa: JobOrder) => {
                    if (!initialOrders.find(o => o.orderNumber === pa.orderNumber)) {
                        initialOrders.unshift(pa);
                    }
                });
            } catch (e) {
                console.error("Failed to merge sync queue", e);
            }
        }
        return initialOrders;
    });

    // Helper to merge pending ADD tasks into an orders array
    const mergePendingOrders = (serverOrders: JobOrder[]) => {
        const queueStr = localStorage.getItem('order_sync_queue');
        if (!queueStr) return serverOrders;
        
        try {
            const queue = JSON.parse(queueStr);
            const pendingAdds = queue
                .filter((q: any) => q.type === 'ADD')
                .map((q: any) => ({
                    ...q.payload,
                    id: q.payload.id || `offline-${q.timestamp}`,
                    createdAt: new Date(q.timestamp),
                    updatedAt: new Date(q.timestamp),
                    statusHistory: []
                }));
            
            const merged = [...serverOrders];
            pendingAdds.forEach((pa: JobOrder) => {
                if (!merged.find(o => o.orderNumber === pa.orderNumber)) {
                    merged.unshift(pa);
                }
            });
            return merged;
        } catch (e) {
            return serverOrders;
        }
    };

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [dbStatus, setDbStatus] = useState<'remote' | 'local' | 'unknown'>('unknown');

    // Diagnostic Check: Verify if we are on Remote or Local DB
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch(`${API_BASE}/health-check`);
                const data = await res.json();
                const dbLabel = String(data.database || '');
                setDbStatus(dbLabel.includes('PostgreSQL') ? 'remote' : dbLabel.includes('SQLite') ? 'local' : 'unknown');
                
                // Auto-trigger cloud sync if we have pending local data and we're back on Remote
                if (data.has_pending_offline_data && dbLabel.includes('PostgreSQL') && user.token) {
                    console.log("[SYNC] Local orders detected. Attempting migration to Cloud...");
                    fetch(`${API_BASE}/sync-backup-to-cloud`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    }).then(r => r.json()).then(syncData => {
                        if (syncData.status === 'success') {
                            toast.success("Database Restored", {
                                description: `Successfully synced ${syncData.synced_records} orders from local backup to Cloud Database.`,
                                duration: 10000
                            });
                            refreshOrders();
                        }
                    }).catch(console.error);
                }
            } catch (e) {
                setDbStatus('unknown');
            }
        };
        checkHealth();
    }, [user.token]);

    // Robust Mapping: Converts Backend 3NF Model to Frontend JobOrder Type
    const mapBackendToFrontend = (bo: any): JobOrder => {
        const firstItem = bo.items?.[0] || {};

        const parseUTC = (dateStr: any): Date => {
            if (!dateStr) return new Date();
            if (typeof dateStr === 'string') {
                const trimmed = dateStr.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                    const [y, m, d] = trimmed.split('-').map(Number);
                    return new Date(y, m - 1, d, 0, 0, 0, 0);
                }
                // Replace space with T for valid local parsing (e.g. "2026-08-11 23:00:40" -> "2026-08-11T23:00:40")
                const normalizedStr = trimmed.replace(' ', 'T');
                return new Date(normalizedStr);
            }
            return new Date(dateStr);
        };

        const safeArray = (val: any): any[] => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
                try {
                    const p = JSON.parse(val);
                    if (Array.isArray(p)) return p;
                } catch {
                    return [];
                }
            }
            return [];
        };

        return enrichOrderWithAttachments({
            id: bo.order_id.toString(),
            orderNumber: bo.order_number,
            customerName: bo.customer?.customer_name || 'Guest',
            contactNumber: bo.customer?.contact_number || '-',
            grandTotal: parseFloat(bo.grand_total) || 0,
            baseServiceFee: bo.items?.reduce((total: number, currItem: any) =>
                total + (currItem.services?.filter((s: any) =>
                    (s.category?.category_name || s.category) === 'base'
                ).reduce((sum: number, s: any) => sum + (parseFloat(s.base_price) || 0) * (currItem.quantity || 1), 0) || 0)
                , 0) || 0,
            addOnsTotal: bo.items?.reduce((total: number, currItem: any) =>
                total + (currItem.services?.filter((s: any) =>
                    (s.category?.category_name || s.category) === 'addon'
                ).reduce((sum: number, s: any) => sum + (parseFloat(s.base_price) || 0) * (currItem.quantity || 1), 0) || 0)
                , 0) || 0,
            priorityLevel: (bo.priority?.priority_name || bo.priority || 'regular').toLowerCase() as any,
            ...(() => {
                // Always sort payments ascending by payment_id so payment 0 is the initial intake payment
                const paymentsList: any[] = (bo.payments || []).slice().sort((a: any, b: any) => (Number(a.payment_id) || 0) - (Number(b.payment_id) || 0));
                let paymentHistory: PaymentRecord[] = [];

                const grandTotal = parseFloat(bo.grand_total) || 0;
                const isOrderClaimed = (bo.status?.status_name || '').toLowerCase() === 'claimed';

                if (paymentsList.length > 1) {
                    paymentHistory = paymentsList.map((p: any, idx: number) => {
                        const isDP = idx === 0 && ((parseFloat(p.deposit_amount) || 0) > 0 || (p.p_status?.status_name || '').toLowerCase() === 'downpayment');
                        const dpAmt = parseFloat(p.deposit_amount) || 0;
                        const rawAmt = parseFloat(p.amount_received) || 0;
                        // For downpayment row, actual credited payment is dpAmt if valid, else rawAmt
                        const actualRowAmount = isDP && dpAmt > 0 ? dpAmt : (isDP && rawAmt > 0 && rawAmt < grandTotal ? rawAmt : rawAmt);
                        return {
                            id: p.payment_id ? String(p.payment_id) : `pay-${idx + 1}`,
                            paymentType: isDP ? 'downpayment' : 'final-payment',
                            method: resolvePaymentMethod(p.method?.method_name, p.reference_no || bo.payments?.[0]?.reference_no),
                            amount: actualRowAmount,
                            referenceNo: p.reference_no || undefined,
                            date: p.created_at ? parseUTC(p.created_at) : parseUTC(bo.created_at),
                            processedBy: idx === 0 ? (bo.processor?.username || 'Staff') : (bo.status_logs?.find((sl: any) => (sl.status?.status_name || '').toLowerCase() === 'claimed')?.user?.username || 'Staff'),
                            notes: isDP ? 'Initial Downpayment' : 'Balance Settlement upon Claim'
                        };
                    });
                } else if (paymentsList.length === 1) {
                    const p = paymentsList[0];
                    const dpAmt = parseFloat(p.deposit_amount) || 0;
                    const rawRecv = parseFloat(p.amount_received) || 0;
                    const pStatusName = (p.p_status?.status_name || '').toLowerCase();
                    const isDP = pStatusName === 'downpayment' || (dpAmt > 0 && dpAmt < grandTotal && !isOrderClaimed);

                    // ONLY synthesize a second payment if the order was ACTUALLY CLAIMED,
                    // had an initial downpayment, and there is an actual remaining balance that was settled upon claim.
                    if (isOrderClaimed && dpAmt > 0 && dpAmt < grandTotal && bo.claimed_at) {
                        const remainingBalanceSettled = Math.max(0, grandTotal - dpAmt);
                        paymentHistory = [
                            {
                                id: 'pay-1',
                                paymentType: 'downpayment',
                                method: resolvePaymentMethod(p.method?.method_name, p.reference_no),
                                amount: dpAmt,
                                referenceNo: p.reference_no || undefined,
                                date: p.created_at ? parseUTC(p.created_at) : parseUTC(bo.created_at),
                                processedBy: bo.processor?.username || 'Staff',
                                notes: 'Initial Downpayment'
                            },
                            {
                                id: 'pay-2',
                                paymentType: 'final-payment',
                                method: 'cash',
                                amount: remainingBalanceSettled,
                                date: parseUTC(bo.claimed_at),
                                processedBy: bo.status_logs?.find((sl: any) => (sl.status?.status_name || '').toLowerCase() === 'claimed')?.user?.username || 'Staff',
                                notes: 'Balance Settlement upon Claim'
                            }
                        ];
                    } else if (isDP) {
                        // Downpayment only - order is NOT claimed!
                        const actualDownpayment = dpAmt > 0 ? dpAmt : (rawRecv > 0 && rawRecv < grandTotal ? rawRecv : Math.min(grandTotal, grandTotal / 2));
                        paymentHistory = [
                            {
                                id: 'pay-1',
                                paymentType: 'downpayment',
                                method: resolvePaymentMethod(p.method?.method_name, p.reference_no),
                                amount: actualDownpayment,
                                referenceNo: p.reference_no || undefined,
                                date: p.created_at ? parseUTC(p.created_at) : parseUTC(bo.created_at),
                                processedBy: bo.processor?.username || 'Staff',
                                notes: 'Initial Downpayment'
                            }
                        ];
                    } else {
                        // Single full payment (e.g. fully-paid at intake)
                        paymentHistory = [
                            {
                                id: 'pay-1',
                                paymentType: 'full-payment',
                                method: resolvePaymentMethod(p.method?.method_name, p.reference_no),
                                amount: grandTotal > 0 ? grandTotal : rawRecv,
                                referenceNo: p.reference_no || undefined,
                                date: p.created_at ? parseUTC(p.created_at) : parseUTC(bo.created_at),
                                processedBy: bo.processor?.username || 'Staff',
                                notes: 'Full Payment'
                            }
                        ];
                    }
                }

                const initialMethod = paymentHistory.length > 0 ? paymentHistory[0].method : resolvePaymentMethod(paymentsList[0]?.method?.method_name, paymentsList[0]?.reference_no);
                const finalMethod = paymentHistory.length > 1 ? paymentHistory[paymentHistory.length - 1].method : undefined;
                const combinedMethod = finalMethod && finalMethod !== initialMethod
                    ? `${initialMethod}, ${finalMethod}`
                    : initialMethod;
                const latestStatus = paymentsList.length > 1
                    ? (paymentsList[paymentsList.length - 1]?.p_status?.status_name || 'fully-paid').toLowerCase()
                    : (paymentsList[0]?.p_status?.status_name || (paymentHistory[0]?.paymentType === 'downpayment' ? 'downpayment' : 'fully-paid')).toLowerCase();

                // Find initial downpayment payment object
                const dpPayment = paymentsList.find((p: any) => ((parseFloat(p.deposit_amount) || 0) > 0 || (p.p_status?.status_name || '').toLowerCase() === 'downpayment')) || paymentsList[0];

                // Physical cash bill / tendered amount from customer
                const rawTendered = parseFloat(dpPayment?.amount_received) || parseFloat(paymentsList[0]?.amount_received) || 0;
                
                // Actual money collected towards the order
                const totalPaidTowardsOrder = paymentHistory.length > 0
                    ? paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0)
                    : (latestStatus === 'downpayment' ? (parseFloat(dpPayment?.deposit_amount) || grandTotal / 2) : grandTotal);

                const actualDeposit = parseFloat(dpPayment?.deposit_amount) 
                    || (paymentHistory.find(p => p.paymentType === 'downpayment')?.amount)
                    || (rawTendered > 0 && rawTendered < grandTotal ? rawTendered : undefined)
                    || (latestStatus === 'downpayment' ? totalPaidTowardsOrder : grandTotal);

                // Change given to customer at downpayment intake
                const changeAmount = rawTendered > actualDeposit
                    ? rawTendered - actualDeposit
                    : 0;

                const remainingBalance = (!isOrderClaimed && latestStatus === 'downpayment')
                    ? (dpPayment?.balance != null && !isNaN(parseFloat(dpPayment.balance))
                        ? parseFloat(dpPayment.balance)
                        : Math.max(0, grandTotal - actualDeposit))
                    : (isOrderClaimed ? 0 : Math.max(0, grandTotal - totalPaidTowardsOrder));

                return {
                    paymentStatus: latestStatus as any,
                    paymentMethod: combinedMethod as any,
                    initialPaymentMethod: initialMethod,
                    finalPaymentMethod: finalMethod,
                    amountReceived: rawTendered > 0 ? rawTendered : actualDeposit,
                    change: changeAmount,
                    referenceNo: paymentsList[0]?.reference_no || paymentHistory.find(p => p.referenceNo)?.referenceNo || '',
                    depositAmount: actualDeposit,
                    balance: remainingBalance,
                    paymentHistory
                };
            })(),
            shippingPreference: (bo.delivery?.preference?.pref_name || 'pickup').toLowerCase() as any,
            deliveryAddress: bo.delivery?.delivery_address || '',
            deliveryCourier: bo.delivery?.delivery_courier || '',
            releaseTime: bo.delivery?.release_time || '',
            province: bo.delivery?.province || '',
            city: bo.delivery?.city || '',
            barangay: bo.delivery?.barangay || '',
            zipCode: bo.delivery?.zip_code || '',

            // Status Mapping
            status: mapBackendStatus(bo.status?.status_name),
            cancellationStage: bo.cancellation_stage || bo.cancellationStage || undefined,
            cancellationReason: bo.cancellation_reason || bo.cancellationReason || bo.refund_reason || bo.refundReason || undefined,
            refundStatus: bo.refund_status || bo.refundStatus || undefined,
            refundAmount: bo.refund_amount != null ? parseFloat(bo.refund_amount) : (bo.refundAmount != null ? parseFloat(bo.refundAmount) : 0),
            refundReason: bo.refund_reason || bo.refundReason || undefined,
            cancelledAt: bo.cancelled_at ? parseUTC(bo.cancelled_at) : (bo.cancelledAt ? parseUTC(bo.cancelledAt) : undefined),
            preCancellationState: bo.pre_cancellation_state || bo.preCancellationState || undefined,

            createdAt: parseOrderDateWithId(bo.created_at, bo.order_number),
            updatedAt: parseUTC(bo.updated_at || bo.created_at),
            transactionDate: parseOrderDateWithId(bo.created_at, bo.order_number),
            predictedCompletionDate: bo.expected_at ? parseUTC(bo.expected_at) : undefined,
            predictedAt: bo.predicted_at ? parseUTC(bo.predicted_at) : undefined,
            predictedDays: bo.predicted_days != null ? Number(bo.predicted_days) : undefined,
            actualReleaseDate: bo.released_at ? parseUTC(bo.released_at) : (() => {
                const currentStatus = mapBackendStatus(bo.status?.status_name);
                if (currentStatus !== 'for-release' && currentStatus !== 'claimed') return undefined;
                const fromLogs = (bo.status_logs || [])
                    .filter((sl: any) => mapBackendStatus(sl.status?.status_name) === 'for-release' && sl.changed_at)
                    .map((sl: any) => new Date(sl.changed_at))
                    .filter((d: Date) => !isNaN(d.getTime()))
                    .sort((a: Date, b: Date) => a.getTime() - b.getTime());
                if (fromLogs[0]) return fromLogs[0];
                return bo.claimed_at ? parseUTC(bo.claimed_at) : undefined;
            })(),
            actualCompletionDate: bo.claimed_at ? parseUTC(bo.claimed_at) : (() => {
                if (mapBackendStatus(bo.status?.status_name) !== 'claimed') return undefined;
                const log = bo.status_logs?.find((sl: any) => mapBackendStatus(sl.status?.status_name) === 'claimed');
                return log ? new Date(log.changed_at) : undefined;
            })(),

            // Items Mapping - conditions come from 3NF conditions[] array
            items: bo.items?.map((bi: any) => {
                // [FIX] Normalize condition names: strip spaces and slashes so
                // "Rips/Holes" -> "ripsholes", "Deep Stains" -> "deepstains", etc.
                const condNames: string[] = bi.conditions?.map(
                    (c: any) => (c.condition_name || '').toLowerCase().replace(/\s+/g, '').replace(/\//g, '')
                ) || [];
                const getHistoricalPrice = (s: any) => {
                    const mapping = bi.service_mappings?.find((sm: any) => sm.service_id === s.service_id);
                    return mapping ? mapping.actual_price : s.base_price;
                };

                return {
                    id: bi.item_id?.toString() || Math.random().toString(),
                    brand: bi.brand || '',
                    shoeModel: bi.shoe_model || '',
                    shoeMaterial: bi.material || '',
                    shoeSize: bi.shoe_size || bi.shoeSize || bi.size || '',
                    color: Array.isArray(bi.color) ? bi.color.filter(Boolean).join(', ') : (bi.color || ''),
                    quantity: bi.quantity || 1,
                    condition: {
                        scratches:      condNames.includes('scratches'),
                        yellowing:      condNames.includes('yellowing'),
                        ripsHoles:      condNames.includes('ripsholes'),
                        deepStains:     condNames.includes('deepstains'),
                        soleSeparation: condNames.includes('soleseparation'),
                        wornOut:        condNames.includes('wornout'),
                        others: bi.item_notes || ''
                    },
                    inventoryUsed: safeArray(bi.inventory_used),
                    // category is a nested 3NF object: { category_id, category_name }
                    historicalBasePrices: bi.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'base'
                    ).map((s: any) => ({ name: s.service_name, price: getHistoricalPrice(s) })) || [],
                    historicalAddOnPrices: bi.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'addon'
                    ).map((s: any) => ({ name: s.service_name, price: getHistoricalPrice(s) })) || [],
                    baseService: bi.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'base'
                    ).map((s: any) => s.service_name) || [],
                    addOns: bi.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'addon'
                    ).map((s: any) => ({ name: s.service_name, quantity: 1 })) || [],
                    status: bi.status ? mapBackendStatus(bi.status) : undefined,
                    actualReleaseDate: bi.released_at ? parseUTC(bi.released_at) : (bi.actualReleaseDate ? parseUTC(bi.actualReleaseDate) : undefined),
                    actualCompletionDate: bi.claimed_at ? parseUTC(bi.claimed_at) : (bi.actualCompletionDate ? parseUTC(bi.actualCompletionDate) : undefined),
                };
            }) || [],

            // Fallback fields
            brand: bo.items?.map((i: any) => i.brand).filter(Boolean).join(', ') || '',
            shoeModel: firstItem.shoe_model || firstItem.shoeModel || '',
            shoeMaterial: bo.items?.map((i: any) => i.material || i.shoeMaterial).filter(Boolean).join(', ') || '',
            shoeSize: firstItem.shoe_size || firstItem.shoeSize || firstItem.size || '',
            color: firstItem.color || '',
            quantity: bo.items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1,
            // Fallback root-level condition (uses first item, same fix)
            condition: bo.items?.[0] ? (() => {
                const cNames: string[] = bo.items[0].conditions?.map(
                    (c: any) => (c.condition_name || '').toLowerCase().replace(/\s+/g, '').replace(/\//g, '')
                ) || [];
                return {
                    scratches:      cNames.includes('scratches'),
                    yellowing:      cNames.includes('yellowing'),
                    ripsHoles:      cNames.includes('ripsholes'),
                    deepStains:     cNames.includes('deepstains'),
                    soleSeparation: cNames.includes('soleseparation'),
                    wornOut:        cNames.includes('wornout'),
                    others: bo.items[0].item_notes || ''
                };
            })() : {
                scratches: false, yellowing: false, ripsHoles: false,
                deepStains: false, soleSeparation: false, wornOut: false, others: ''
            },
            baseService: Array.from(new Set(
                bo.items?.flatMap((item: any) =>
                    item.services?.filter((s: any) =>
                        (s.category?.category_name || s.category) === 'base'
                    ).map((s: any) => s.service_name) || []
                ) || []
            )),
            addOns: firstItem.services?.filter((s: any) =>
                (s.category?.category_name || s.category) === 'addon'
            ).map((s: any) => ({ name: s.service_name, quantity: 1 })) || [],
            processedBy: bo.processor?.username || 'System',
            claimedBy: bo.claimed_by || bo.claimedBy || (mapBackendStatus(bo.status?.status_name) === 'claimed' ? (bo.customer?.full_name || bo.customer_name) : undefined),
            releasedBy: bo.released_by || bo.releasedBy || (mapBackendStatus(bo.status?.status_name) === 'claimed' ? (bo.status_logs?.find((sl: any) => mapBackendStatus(sl.status?.status_name) === 'claimed')?.user?.username || bo.processor?.username || 'owner') : undefined),
            inventoryUsed: safeArray(bo.inventory_used),

            statusHistory: bo.status_logs?.map((sl: any) => ({
                status: mapBackendStatus(sl.status?.status_name),
                timestamp: new Date(sl.changed_at),
                user: sl.user?.username || 'System'
            })) || []
        });
    };


    // Initial Load - Hydrate from API with LocalStorage fallback
    useEffect(() => {
        const loadInitialData = async () => {
            // If we have no orders, show blocking loading
            if (orders.length === 0) setLoading(true);
            setRefreshing(true);

            try {
                const response = await fetch(`${API_BASE}/orders`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    const mappedOrders = data.map(mapBackendToFrontend);
                    const finalOrders = mergePendingOrders(mappedOrders);

                    setOrders(finalOrders);
                    safeSaveCachedOrders(finalOrders);
                } else {
                    throw new Error('API unreachable');
                }
            } catch (err) {
                console.warn("Retaining cached data due to fetch failure", err);
                // P1-17 FIX: this previously fell back to `mockJobOrders` (fabricated demo
                // customers/orders from src/app/lib/mockData.ts) whenever the initial fetch
                // failed with no cached orders yet available (e.g. first load on a fresh
                // browser/device with a flaky connection). That let entirely fake job orders
                // silently render as if they were real production records — exactly the
                // pattern flagged by the audit. If there is no real cached data, show a
                // genuine empty state instead and surface a clear connectivity error so
                // staff/owner know data failed to load rather than mistaking it for "no
                // orders exist yet".
                if (orders.length === 0) {
                    import('sonner').then(({ toast }) => toast.error(
                        "Unable to load Job Orders from the server. Check your connection and try again."
                    ));
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        };

        loadInitialData();
    }, []);

    // Real-time synchronization: Mirror active orders state to localStorage cache whenever changed
    useEffect(() => {
        if (orders.length > 0) {
            safeSaveCachedOrders(orders);
        }
    }, [orders]);

    // Maps DB status_name to frontend JobStatus type
    // DB values now match frontend: 'new-order', 'on-going', 'for-release', 'claimed', 'cancelled'
    const mapBackendStatus = (statusName: string): any => {
        const map: Record<string, string> = {
            'new-order': 'new-order',
            'on-going': 'on-going',
            'for-release': 'for-release',
            'claimed': 'claimed',
            'cancelled': 'cancelled',
            'canceled': 'cancelled',
            // Legacy mappings in case old DB data exists
            'Pending': 'new-order',
            'In Progress': 'on-going',
            'Completed': 'for-release',
            'Claimed': 'claimed',
            'Cancelled': 'cancelled',
            'Canceled': 'cancelled',
        };
        // [FIX] Only fall back to 'new-order' if the statusName itself is empty/null.
        if (!statusName) return 'new-order';
        
        const normalized = map[statusName] ?? map[statusName.toLowerCase()];
        if (!normalized) {
            console.error(`[OrderContext] Critical data integrity issue: Unknown backend status '${statusName}'. Falling back to 'new-order' for UI stability. Please check backend schema.`);
            return 'new-order';
        }
        return normalized;
    };

    /**
     * @function refreshOrders
     * @description Force-refetches the latest data from the database.
     * Merges backend data with any locally-pending sync queue updates so that
     * optimistic status changes (applied while offline) are NOT overwritten.
     */
    const refreshOrders = async () => {
        try {
            const response = await fetch(`${API_BASE}/orders`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const mapped = data.map(mapBackendToFrontend);
                const withPending = mergePendingOrders(mapped);

                // [FIX] Preserve optimistic local updates for orders in the sync queue.
                // The sync queue holds UPDATE tasks for orders that were edited offline.
                // We merge by ID: server data takes precedence EXCEPT for fields that are
                // present in a pending UPDATE payload (those were locally edited and not yet synced).
                const queueStr = localStorage.getItem('order_sync_queue');
                if (queueStr) {
                    try {
                        const queue: any[] = JSON.parse(queueStr);
                        const pendingUpdates: Record<string, any> = {};
                        queue.filter(t => t.type === 'UPDATE').forEach(t => {
                            pendingUpdates[t.id] = { ...(pendingUpdates[t.id] || {}), ...t.payload };
                        });

                        const merged = withPending.map(order => {
                            const pending = pendingUpdates[order.id];
                            if (!pending) return order;
                            // Overlay only the explicitly updated fields from local queue
                            return { ...order, ...pending, updatedAt: order.updatedAt };
                        });
                        setOrders(merged);
                        safeSaveCachedOrders(merged);
                        return;
                    } catch (_) { /* fall through to plain set */ }
                }

                setOrders(withPending);
                safeSaveCachedOrders(withPending);
            }
        } catch (err) {
            console.error('[DEBUG] OrderProvider: Refresh failed.', err);
        }
    };

    // --- OFFLINE AUTO-SYNC QUEUE ---
    const queueSyncTask = (task: any) => {
        if (typeof window === 'undefined') return;
        const queueStr = localStorage.getItem('order_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ ...task, timestamp: Date.now() });
        localStorage.setItem('order_sync_queue', JSON.stringify(queue));
        
        // Notify the user ONLY if it is a connectivity issue
        if (!navigator.onLine) {
            import('sonner').then(({ toast }) => {
                toast.warning('You are offline. Change saved locally and will auto-sync when connection is restored.');
            });
        }
    };



    useEffect(() => {
        const processSyncQueue = async () => {
            if (typeof window === 'undefined' || !navigator.onLine) return;
            const queueStr = localStorage.getItem('order_sync_queue');
            if (!queueStr) return;
            
            try {
                const queue: any[] = JSON.parse(queueStr);
                if (queue.length === 0) return;
                
                // Verify server reachability before showing "Syncing" toast
                const isReachable = await checkBackend(user.token);
                if (!isReachable) {
                    console.warn('[SYNC] Backend unreachable, skipping auto-sync attempt.');
                    return;
                }

                if (syncNotificationShown.current) return;
                syncNotificationShown.current = true;

                const { toast } = await import('sonner');
                const toastId = 'order-sync-toast';
                toast.loading(`Syncing ${queue.length} offline changes...`, { id: toastId });
                
                let hasChanges = false;
                let syncErrorCount = 0;
                const remainingQueue = [];
                
                for (const task of queue) {
                    try {
                        const endpoint = task.type === 'ADD' ? `${API_BASE}/orders` : `${API_BASE}/orders/${parseInt(task.id)}`;
                        const method = task.type === 'ADD' ? 'POST' : task.type === 'DELETE' ? 'DELETE' : 'PUT';
                        
                        if ((task.type === 'UPDATE' || task.type === 'DELETE') && isNaN(parseInt(task.id))) {
                             // Defer for temp IDs if they weren't linked just now, or remove if temp ID delete
                             if (task.type === 'DELETE') continue;
                             remainingQueue.push(task);
                             continue;
                        }

                        const fetchOptions: any = {
                            method,
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${user.token}`
                            }
                        };
                        if (task.type !== 'DELETE') {
                            fetchOptions.body = JSON.stringify(task.payload);
                        }
                        const response = await fetch(endpoint, fetchOptions);
                        
                        if (response.ok) {
                            hasChanges = true;
                            if (task.type === 'ADD') {
                                const newOrderData = await response.json();
                                const newDbId = newOrderData.order_id?.toString();
                                const tempId = task.payload.id;

                                if (newDbId && tempId) {
                                    queue.forEach(t => {
                                        if (t.id === tempId) t.id = newDbId;
                                    });
                                }
                            }
                        } else {
                            syncErrorCount++;
                            task.status = response.status;
                            remainingQueue.push(task);
                        }
                    } catch (err) {
                        syncErrorCount++;
                        task.status = 500;
                        remainingQueue.push(task);
                    }
                }
                
                localStorage.setItem('order_sync_queue', JSON.stringify(remainingQueue));
                
                if (hasChanges) {
                    toast.success("Offline changes synced successfully!", { id: toastId });
                    syncNotificationShown.current = false;
                    refreshOrders();
                } else if (remainingQueue.length > 0) {
                    // Only show error if we actually tried and failed multiple tasks
                    if (syncErrorCount > 0) {
                        const isAuthError = remainingQueue.some(t => t.status === 401);
                        if (isAuthError) {
                            toast.error(`Session Expired: Please Log Out and Log In again to sync ${remainingQueue.length} items.`, { id: toastId, duration: 5000 });
                        } else {
                            toast.error(`Sync failed for ${remainingQueue.length} items. Check server status.`, { id: toastId });
                        }
                    } else {
                        toast.dismiss(toastId);
                    }
                    syncNotificationShown.current = false;
                } else {
                    toast.dismiss(toastId);
                    syncNotificationShown.current = false;
                }
                
                // Sync process complete
            } catch (err) {
                console.error("Failed to process sync queue", err);
            }
        };

        // Try syncing initially, and whenever network status goes "online"
        processSyncQueue();
        window.addEventListener('online', processSyncQueue);
        return () => window.removeEventListener('online', processSyncQueue);
    }, [user.token]);
    // -------------------------------

    const addOrder = async (order: JobOrder): Promise<boolean> => {
        // Persist before/after images and signatures
        const firstBefore = order.beforeImage || order.items?.[0]?.beforeImage;
        const firstAfter = order.afterImage || order.items?.[0]?.afterImage;
        const itemAttachments: Record<string, { beforeImage?: string; afterImage?: string }> = {};
        order.items?.forEach((it, idx) => {
            if (it.beforeImage || it.afterImage) {
                itemAttachments[String(idx)] = {
                    ...(it.beforeImage ? { beforeImage: it.beforeImage } : {}),
                    ...(it.afterImage ? { afterImage: it.afterImage } : {}),
                };
                if (it.id) {
                    itemAttachments[String(it.id)] = {
                        ...(it.beforeImage ? { beforeImage: it.beforeImage } : {}),
                        ...(it.afterImage ? { afterImage: it.afterImage } : {}),
                    };
                }
            }
        });

        if (firstBefore || firstAfter || Object.keys(itemAttachments).length > 0) {
            if (order.orderNumber) {
                saveOrderAttachments(order.orderNumber, {
                    ...(firstBefore ? { beforeImage: firstBefore } : {}),
                    ...(firstAfter ? { afterImage: firstAfter } : {}),
                    items: itemAttachments,
                });
            }
            if (order.id) {
                saveOrderAttachments(String(order.id), {
                    ...(firstBefore ? { beforeImage: firstBefore } : {}),
                    ...(firstAfter ? { afterImage: firstAfter } : {}),
                    items: itemAttachments,
                });
            }
        }

        // OPTIMISTIC UPDATE: Update UI immediately to ensure zero-latency response for the user
        setOrders((prev) => [{ ...order, updatedAt: new Date() }, ...prev]);

        const payload = {
            ...order,
            user_id: user.id
        };

        try {
            const response = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Server Error: Failed to save to database.');
            }

            const saved = await response.json().catch(() => null);
            if (saved) {
                if (firstBefore || firstAfter || Object.keys(itemAttachments).length > 0) {
                    const enrichedItemAttachments = { ...itemAttachments };
                    if (Array.isArray(saved.items)) {
                        saved.items.forEach((si: any, sIdx: number) => {
                            const att = itemAttachments[String(sIdx)];
                            if (att && si.item_id) {
                                enrichedItemAttachments[String(si.item_id)] = att;
                            }
                        });
                    }
                    if (saved.order_number) {
                        saveOrderAttachments(saved.order_number, {
                            ...(firstBefore ? { beforeImage: firstBefore } : {}),
                            ...(firstAfter ? { afterImage: firstAfter } : {}),
                            items: enrichedItemAttachments,
                        });
                    }
                    if (saved.order_id != null) {
                        saveOrderAttachments(String(saved.order_id), {
                            ...(firstBefore ? { beforeImage: firstBefore } : {}),
                            ...(firstAfter ? { afterImage: firstAfter } : {}),
                            items: enrichedItemAttachments,
                        });
                    }
                }

                const persistedDate = saved.expected_at ? parseServerDate(saved.expected_at) : undefined;
                const persistedPredAt = saved.predicted_at ? parseServerDate(saved.predicted_at) : (order.predictedAt || persistedDate);
                const persistedPredDays = saved.predicted_days != null ? Number(saved.predicted_days) : order.predictedDays;
                setOrders((prev) => prev.map((o) =>
                    o.orderNumber === (saved.order_number || order.orderNumber)
                        ? {
                            ...o,
                            id: saved.order_id != null ? String(saved.order_id) : o.id,
                            predictedCompletionDate: persistedDate,
                            predictedAt: persistedPredAt,
                            predictedDays: persistedPredDays,
                        }
                        : o
                ));
            }
            const auditTimestamp = order.transactionDate || order.createdAt;
            const formattedAuditTimestamp = auditTimestamp ? dateFnsFormat(new Date(auditTimestamp), 'MM/dd/yyyy, HH:mm') : undefined;
            const durationNote = order.formDurationFormatted
                ? ` [Creation Time: ${order.formDurationFormatted} | Paper-based Manual Baseline: ~5–10m]`
                : '';

            addActivity({
                timestamp: formattedAuditTimestamp,
                user: user.username || 'System',
                action: 'CREATE',
                actionRaw: 'CREATE',
                type: 'order',
                table: 'orders',
                module: 'Job Orders',
                recordId: saved?.order_id != null ? String(saved.order_id) : order.id,
                details: `Created new Job Order #${order.orderNumber} for ${order.customerName}${durationNote}`,
                newValues: {
                    order_number: order.orderNumber,
                    customer_name: order.customerName,
                    grand_total: order.grandTotal,
                    status: order.status,
                    order_date: order.orderDate,
                    order_time: order.orderTime,
                    encoding_time: order.formDurationFormatted,
                    encoding_seconds: order.formDurationSeconds,
                    efficiency_vs_paper: order.efficiencyMetric,
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus,
                    amountReceived: order.amountReceived,
                    balance: order.balance,
                    referenceNo: order.referenceNo,
                    depositAmount: order.depositAmount
                }
            });
            refreshOrders();
            return true;
        } catch (err: any) {
            console.error('[CRITICAL] OrderProvider: Sync failed.', err);

            // Only queue and show 'offline' if it's a network error
            if (!navigator.onLine || err.message.includes('failed to fetch') || err.name === 'TypeError') {
                queueSyncTask({ type: 'ADD', payload });
                // P1-7 FIX: legitimately queued for offline auto-sync (existing, intended
                // offline-continuity behavior) — treat as a success for UX purposes, since
                // the order is durably queued and will sync once connectivity returns. The
                // optimistic order already carries this order's stable, client-generated
                // orderNumber, so the eventual sync is idempotent (backend-side dedupe by
                // order_number) even if the queue is retried more than once.
                return true;
            } else {
                const { toast } = await import('sonner');
                toast.error("Execution Error", {
                    description: err.message || "The server rejected this order. Check connection or data integrity.",
                    duration: 5000
                });
                // P1-7 FIX: a definite backend rejection (validation/auth/server error, not a
                // network blip) — roll back the optimistic insert so the failed order does
                // not linger in the visible list, and tell the caller so it does NOT show a
                // false "success" toast or clear the user's form data.
                setOrders((prev) => prev.filter((o) => o.id !== order.id));
                return false;
            }
        }
    };

    const updateOrder = async (id: string, updates: Partial<JobOrder>, statusUser?: string) => {
        const orderKey = String(id);
        if (inFlightOrderUpdates.current.has(orderKey)) {
            console.warn(`[DUPLICATE PREVENTED] Order update already in progress for #${orderKey}`);
            return;
        }
        inFlightOrderUpdates.current.add(orderKey);

        const targetOrder = orders.find(o => o.id === id || o.orderNumber === id);
        const effectiveReleasedBy = statusUser || user.username || 'staff';
        const now = new Date();

        // Persist any updated attachments locally
        const firstBefore = updates.beforeImage || updates.items?.[0]?.beforeImage;
        const firstAfter = updates.afterImage || updates.items?.[0]?.afterImage;
        const hasSigUpdate = updates.customerSignature !== undefined || updates.staffSignature !== undefined;
        if (firstBefore || firstAfter || updates.items?.some(i => i.beforeImage || i.afterImage) || hasSigUpdate) {
            const itemAtts: Record<string, { beforeImage?: string; afterImage?: string }> = {};
            updates.items?.forEach((it, idx) => {
                if (it.beforeImage || it.afterImage) {
                    itemAtts[String(idx)] = {
                        ...(it.beforeImage ? { beforeImage: it.beforeImage } : {}),
                        ...(it.afterImage ? { afterImage: it.afterImage } : {}),
                    };
                    if (it.id) {
                        itemAtts[String(it.id)] = {
                            ...(it.beforeImage ? { beforeImage: it.beforeImage } : {}),
                            ...(it.afterImage ? { afterImage: it.afterImage } : {}),
                        };
                    }
                }
            });
            if (targetOrder?.orderNumber) {
                saveOrderAttachments(targetOrder.orderNumber, {
                    ...(firstBefore ? { beforeImage: firstBefore } : {}),
                    ...(firstAfter ? { afterImage: firstAfter } : {}),
                    ...(updates.customerSignature !== undefined ? { customerSignature: updates.customerSignature || '' } : {}),
                    ...(updates.staffSignature !== undefined ? { staffSignature: updates.staffSignature || '' } : {}),
                    items: itemAtts,
                });
            }
            saveOrderAttachments(String(id), {
                ...(firstBefore ? { beforeImage: firstBefore } : {}),
                ...(firstAfter ? { afterImage: firstAfter } : {}),
                ...(updates.customerSignature !== undefined ? { customerSignature: updates.customerSignature || '' } : {}),
                ...(updates.staffSignature !== undefined ? { staffSignature: updates.staffSignature || '' } : {}),
                items: itemAtts,
            });
        }
        const finalUpdates: any = {
            ...updates,
            // Strictly preserve immutable intake dates
            createdAt: targetOrder?.createdAt || updates.createdAt,
            transactionDate: targetOrder?.transactionDate || targetOrder?.createdAt || updates.transactionDate,
            ...(updates.status === 'for-release' ? {
                actualReleaseDate: updates.actualReleaseDate || targetOrder?.actualReleaseDate || now,
                actualCompletionDate: undefined,
                claimedBy: undefined,
                releasedBy: undefined,
            } : {}),
            ...(updates.status === 'claimed' ? {
                actualCompletionDate: updates.actualCompletionDate || now,
                releasedBy: updates.releasedBy || effectiveReleasedBy
            } : {}),
            ...(updates.status === 'cancelled' ? {
                cancelledAt: updates.cancelledAt || now,
                cancellationStage: updates.cancellationStage,
                cancellationReason: updates.cancellationReason,
                refundStatus: updates.refundStatus,
                refundAmount: updates.refundAmount,
                refundReason: updates.refundReason,
                preCancellationState: updates.preCancellationState !== undefined ? updates.preCancellationState : targetOrder?.preCancellationState,
            } : {}),
            ...(updates.status && updates.status !== 'cancelled' ? {
                cancelledAt: null,
                cancellationStage: null,
                cancellationReason: null,
                refundStatus: null,
                refundAmount: 0,
                refundReason: null,
                preCancellationState: null,
            } : {}),
            ...(updates.status === 'on-going' || updates.status === 'new-order' ? {
                actualReleaseDate: null,
                actualCompletionDate: null,
                claimedBy: undefined,
                releasedBy: undefined,
            } : {})
        };

        // Target identification helper (matches by numeric id, string id, or ORD- string)
        const isTarget = (order: JobOrder) =>
            order.id === id ||
            order.orderNumber === id ||
            (targetOrder && (order.id === targetOrder.id || order.orderNumber === targetOrder.orderNumber));

        // Optimistic Update
        const optimisticUpdatedOrders = orders.map((order) => {
            if (isTarget(order)) {
                return { 
                    ...order, 
                    ...finalUpdates, 
                    createdAt: order.createdAt || finalUpdates.createdAt,
                    transactionDate: order.transactionDate || order.createdAt || finalUpdates.transactionDate,
                    updatedAt: new Date() 
                };
            }
            return order;
        });
        setOrders(optimisticUpdatedOrders);

        // Immediate write to localStorage so customer tracking and other tabs see it with 0ms latency
        safeSaveCachedOrders(optimisticUpdatedOrders);

        // Real-time broadcast to all open tabs, windows, and customer tracking portals
        const broadcastUpdate = (statusToEmit?: string) => {
            const st = statusToEmit || finalUpdates.status;
            if (!st) return;
            const targetNum = targetOrder?.orderNumber || (id.startsWith('ORD-') ? id : undefined);
            const detail = {
                type: 'ORDER_STATUS_CHANGED',
                orderId: id,
                orderNumber: targetNum,
                status: st,
                updatedAt: new Date().toISOString(),
                timestamp: Date.now()
            };
            try {
                if (typeof window !== 'undefined') {
                    if (typeof BroadcastChannel !== 'undefined') {
                        const bc = new BroadcastChannel('shoelotskey_orders_channel');
                        bc.postMessage(detail);
                        bc.close();
                    }
                    window.dispatchEvent(new CustomEvent('shoelotskey:order-status-updated', { detail }));
                }
            } catch (e) {
                console.warn('[BROADCAST] Status broadcast failed', e);
            }
        };

        broadcastUpdate();

        const payload = { ...finalUpdates, updater_id: user.id };

        let apiLookupId: string | number = id;
        const parsedId = parseInt(id);
        if (!isNaN(parsedId)) {
            apiLookupId = parsedId;
        } else if (targetOrder) {
            const targetDbId = parseInt(targetOrder.id);
            if (!isNaN(targetDbId)) {
                apiLookupId = targetDbId;
            } else if (targetOrder.orderNumber) {
                apiLookupId = targetOrder.orderNumber;
            }
        }

        try {
            const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(String(apiLookupId))}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(payload)
            });

            // [SAFETY NET] Handle concurrent deletion by another staff member
            if (response.status === 404) {
                console.warn(`[DEBUG] OrderProvider: Order ${id} not found. Likely deleted.`);
                const { toast } = await import('sonner');
                toast.error("Resource Unavailable", {
                    description: "This order needs a 'Full Reglue' (it might have been deleted by another staff member).",
                    duration: 5000
                });
                refreshOrders(); // Remove the "ghost" order from UI
                return;
            }

            if (response.status === 400 || response.status === 401 || response.status === 403) {
                throw new Error(`HTTP_${response.status}`);
            }
            if (!response.ok) throw new Error('API update failed');
            const saved = await response.json().catch(() => null);
            if (saved) {
                const persistedDate = saved.expected_at ? parseServerDate(saved.expected_at) : undefined;
                const persistedPredAt = saved.predicted_at ? parseServerDate(saved.predicted_at) : finalUpdates.predictedAt;
                const persistedPredDays = saved.predicted_days != null ? Number(saved.predicted_days) : finalUpdates.predictedDays;
                setOrders((prev) => {
                    const nextOrders = prev.map((order) =>
                        isTarget(order)
                            ? {
                                ...order,
                                ...finalUpdates,
                                createdAt: order.createdAt || (saved.created_at ? parseServerDate(saved.created_at) : order.createdAt),
                                transactionDate: order.transactionDate || order.createdAt || (saved.created_at ? parseServerDate(saved.created_at) : order.transactionDate),
                                ...(persistedDate ? { predictedCompletionDate: persistedDate } : {}),
                                ...(persistedPredAt !== undefined ? { predictedAt: persistedPredAt } : {}),
                                ...(persistedPredDays != null ? { predictedDays: persistedPredDays } : {}),
                                updatedAt: new Date(),
                            }
                            : order
                    );
                    safeSaveCachedOrders(nextOrders);
                    return nextOrders;
                });
                broadcastUpdate(finalUpdates.status);
            }
            // Note: Backend /api/orders/{id} automatically performs atomic log_audit inside the DB transaction.
        } catch (err: any) {
            console.error('[DEBUG] OrderProvider: Update failed or sync pending.', err);
            if (err?.message && err.message.startsWith('HTTP_')) {
                import('sonner').then(({ toast }) => toast.error("Update denied by server (400/401/403)."));
                refreshOrders();
                return;
            }
            queueSyncTask({ type: 'UPDATE', id, payload });
        } finally {
            inFlightOrderUpdates.current.delete(orderKey);
        }
    };
    
    const deleteOrder = async (id: string) => {
        // Optimistic Update: immediately remove from view
        setOrders((prev) => prev.filter(o => o.id !== id));
        
        try {
            const dbId = parseInt(id);
            if (!isNaN(dbId)) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);
                const response = await fetch(`${API_BASE}/orders/${dbId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${user.token}` },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error('Delete failed on server');
                
                addActivity({
                    user: user.username,
                    action: 'Delete Order',
                    details: `Deleted order ID ${id}`,
                    type: 'order'
                });
            } else {
                // If temporary offline order ID, remove any pending additions/updates from the offline sync queue
                if (typeof window !== 'undefined') {
                    const queueStr = localStorage.getItem('order_sync_queue');
                    if (queueStr) {
                        let queue: any[] = JSON.parse(queueStr);
                        queue = queue.filter(t => t.id !== id && t.payload?.id !== id);
                        localStorage.setItem('order_sync_queue', JSON.stringify(queue));
                    }
                }
            }
        } catch (err) {
            console.warn('[WARN] OrderProvider: Delete API unreachable or offline. Queueing offline DELETE sync task.', err);
            const dbId = parseInt(id);
            if (!isNaN(dbId)) {
                queueSyncTask({ type: 'DELETE', id });
                addActivity({
                    user: user.username,
                    action: 'Delete Order',
                    details: `Offline deletion queued for order ID ${id}`,
                    type: 'order'
                });
            }
        }
    };

    const contextValue = useMemo(() => ({
        orders,
        loading,
        refreshing,
        dbStatus,
        addOrder,
        updateOrder,
        deleteOrder,
        refreshOrders
    }), [orders, loading, refreshing, dbStatus, addOrder, updateOrder, deleteOrder, refreshOrders]);

    return (
        <OrderContext.Provider value={contextValue}>
            {children}
        </OrderContext.Provider>
    );
}

export function useOrders() {
    const context = useContext(OrderContext);
    if (context === undefined) {
        throw new Error('useOrders must be used within an OrderProvider');
    }
    return context;
}

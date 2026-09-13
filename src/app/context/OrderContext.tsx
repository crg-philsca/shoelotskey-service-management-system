import { createContext, useContext, useState, ReactNode, useEffect, useRef, useMemo } from 'react';
import { JobOrder, PaymentRecord } from '@/app/types';
import { useActivities } from './ActivityContext';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';

function parseServerDate(dateStr: any): Date {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string') {
        return new Date(dateStr.replace(' ', 'T'));
    }
    return new Date(dateStr);
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
    const [orders, setOrders] = useState<JobOrder[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem('jobOrders_v20_cache') || localStorage.getItem('jobOrders_v19_cache');
        let initialOrders: JobOrder[] = [];
        if (saved) {
            try {
                initialOrders = JSON.parse(saved).map((o: any) => ({
                    ...o,
                    createdAt: new Date(o.createdAt),
                    updatedAt: new Date(o.updatedAt),
                    transactionDate: new Date(o.transactionDate || o.createdAt),
                    predictedCompletionDate: o.predictedCompletionDate ? new Date(o.predictedCompletionDate) : undefined,
                    predictedAt: o.predictedAt ? new Date(o.predictedAt) : undefined,
                    predictedDays: o.predictedDays != null ? Number(o.predictedDays) : undefined,
                    actualCompletionDate: o.actualCompletionDate ? new Date(o.actualCompletionDate) : undefined,
                    balance: o.balance != null && !isNaN(Number(o.balance))
                        ? Number(o.balance)
                        : Math.max(0, (Number(o.grandTotal) || 0) - (Number(o.depositAmount) || (Number(o.amountReceived) && Number(o.amountReceived) < Number(o.grandTotal) ? Number(o.amountReceived) : 0))),
                    statusHistory: o.statusHistory?.map((sl: any) => ({
                        ...sl,
                        timestamp: new Date(sl.timestamp)
                    })) || []
                }));
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
                            const { toast } = require('sonner');
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
                // Replace space with T for valid local parsing (e.g. "2026-08-11 23:00:40" -> "2026-08-11T23:00:40")
                const normalizedStr = dateStr.replace(' ', 'T');
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

        return {
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
                const paymentsList: any[] = bo.payments || [];
                let paymentHistory: PaymentRecord[] = [];

                if (paymentsList.length > 1) {
                    paymentHistory = paymentsList.map((p: any, idx: number) => {
                        const isDP = idx === 0 && ((parseFloat(p.deposit_amount) || 0) > 0 || (p.p_status?.status_name || '').toLowerCase() === 'downpayment');
                        return {
                            id: p.payment_id ? String(p.payment_id) : `pay-${idx + 1}`,
                            paymentType: isDP ? 'downpayment' : 'final-payment',
                            method: (p.method?.method_name || 'cash').toLowerCase(),
                            amount: parseFloat(p.amount_received) || 0,
                            referenceNo: p.reference_no || undefined,
                            date: p.created_at ? parseUTC(p.created_at) : parseUTC(bo.created_at),
                            processedBy: idx === 0 ? (bo.processor?.username || 'Staff') : (bo.status_logs?.find((sl: any) => (sl.status?.status_name || '').toLowerCase() === 'claimed')?.user?.username || 'Staff'),
                            notes: isDP ? 'Initial Downpayment' : 'Balance Settlement upon Claim'
                        };
                    });
                } else if (paymentsList.length === 1) {
                    const p = paymentsList[0];
                    const dpAmt = parseFloat(p.deposit_amount) || 0;
                    const totalRecv = parseFloat(p.amount_received) || 0;
                    const isClaimedOrFull = (bo.status?.status_name || '').toLowerCase() === 'claimed' || (p.p_status?.status_name || '').toLowerCase() === 'fully-paid';

                    if (dpAmt > 0 && isClaimedOrFull && totalRecv > dpAmt) {
                        paymentHistory = [
                            {
                                id: 'pay-1',
                                paymentType: 'downpayment',
                                method: (p.method?.method_name || 'cash').toLowerCase(),
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
                                amount: Math.max(0, totalRecv - dpAmt),
                                date: bo.claimed_at ? parseUTC(bo.claimed_at) : parseUTC(bo.updated_at || bo.created_at),
                                processedBy: bo.status_logs?.find((sl: any) => (sl.status?.status_name || '').toLowerCase() === 'claimed')?.user?.username || 'Staff',
                                notes: 'Balance Settlement upon Claim'
                            }
                        ];
                    } else {
                        paymentHistory = [
                            {
                                id: 'pay-1',
                                paymentType: dpAmt > 0 || (p.p_status?.status_name || '').toLowerCase() === 'downpayment' ? 'downpayment' : 'full-payment',
                                method: (p.method?.method_name || 'cash').toLowerCase(),
                                amount: dpAmt > 0 ? dpAmt : totalRecv,
                                referenceNo: p.reference_no || undefined,
                                date: p.created_at ? parseUTC(p.created_at) : parseUTC(bo.created_at),
                                processedBy: bo.processor?.username || 'Staff',
                                notes: dpAmt > 0 ? 'Initial Downpayment' : 'Full Payment'
                            }
                        ];
                    }
                }

                const initialMethod = paymentHistory.length > 0 ? paymentHistory[0].method : (bo.payments?.[0]?.method?.method_name || 'cash').toLowerCase();
                const finalMethod = paymentHistory.length > 1 ? paymentHistory[paymentHistory.length - 1].method : undefined;
                const totalReceived = paymentHistory.length > 0
                    ? paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0)
                    : (parseFloat(bo.payments?.[0]?.amount_received) || 0);
                const combinedMethod = finalMethod && finalMethod !== initialMethod
                    ? `${initialMethod}, ${finalMethod}`
                    : initialMethod;
                const latestStatus = paymentsList.length > 1
                    ? (paymentsList[paymentsList.length - 1]?.p_status?.status_name || 'fully-paid').toLowerCase()
                    : (bo.payments?.[0]?.p_status?.status_name || 'fully-paid').toLowerCase();

                return {
                    paymentStatus: latestStatus as any,
                    paymentMethod: combinedMethod as any,
                    initialPaymentMethod: initialMethod,
                    finalPaymentMethod: finalMethod,
                    amountReceived: totalReceived,
                    change: Math.max(0, totalReceived - (parseFloat(bo.grand_total) || 0)),
                    referenceNo: bo.payments?.[0]?.reference_no || paymentHistory.find(p => p.referenceNo)?.referenceNo || '',
                    depositAmount: parseFloat(bo.payments?.[0]?.deposit_amount) || (paymentHistory.find(p => p.paymentType === 'downpayment')?.amount || 0),
                    balance: bo.payments?.[0]?.balance != null && !isNaN(parseFloat(bo.payments[0].balance))
                        ? parseFloat(bo.payments[0].balance)
                        : Math.max(0, (parseFloat(bo.grand_total) || 0) - (parseFloat(bo.payments?.[0]?.deposit_amount) || totalReceived)),
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
            refundStatus: bo.refund_status || bo.refundStatus || undefined,
            refundAmount: bo.refund_amount != null ? parseFloat(bo.refund_amount) : (bo.refundAmount != null ? parseFloat(bo.refundAmount) : 0),
            refundReason: bo.refund_reason || bo.refundReason || undefined,
            cancelledAt: bo.cancelled_at ? parseUTC(bo.cancelled_at) : (bo.cancelledAt ? parseUTC(bo.cancelledAt) : undefined),

            createdAt: parseUTC(bo.created_at),
            updatedAt: parseUTC(bo.updated_at || bo.created_at),
            transactionDate: parseUTC(bo.created_at),
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
                    brand: bi.brand || 'Other',
                    shoeModel: bi.shoe_model || 'Other',
                    shoeMaterial: bi.material || 'Other',
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
            brand: bo.items?.map((i: any) => i.brand).filter(Boolean).join(', ') || 'Unknown',
            shoeModel: firstItem.shoe_model || firstItem.shoeModel || 'Unknown',
            shoeMaterial: bo.items?.map((i: any) => i.material || i.shoeMaterial).filter(Boolean).join(', ') || 'Unknown',
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
        };
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
                    localStorage.setItem('jobOrders_v19_cache', JSON.stringify(finalOrders));
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
                        localStorage.setItem('jobOrders_v20_cache', JSON.stringify(merged));
                        return;
                    } catch (_) { /* fall through to plain set */ }
                }

                setOrders(withPending);
                localStorage.setItem('jobOrders_v20_cache', JSON.stringify(withPending));
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

    // Persist to cache whenever orders change
    useEffect(() => {
        if (orders.length > 0) {
            localStorage.setItem('jobOrders_v20_cache', JSON.stringify(orders));
        }
    }, [orders]);

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
            addActivity({
                user: user.username || 'System',
                action: 'CREATE',
                actionRaw: 'CREATE',
                type: 'order',
                table: 'orders',
                module: 'Job Orders',
                recordId: saved?.order_id != null ? String(saved.order_id) : order.id,
                details: `Created new Job Order #${order.orderNumber} for ${order.customerName}`,
                newValues: {
                    order_number: order.orderNumber,
                    customer_name: order.customerName,
                    grand_total: order.grandTotal,
                    status: order.status
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
        const finalUpdates: any = {
            ...updates,
            ...(updates.status === 'for-release' ? {
                actualReleaseDate: updates.actualReleaseDate || now,
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
                refundStatus: updates.refundStatus,
                refundAmount: updates.refundAmount,
                refundReason: updates.refundReason,
            } : {}),
            ...(updates.status && updates.status !== 'cancelled' ? {
                cancelledAt: null,
                cancellationStage: null,
                refundStatus: null,
                refundAmount: 0,
                refundReason: null,
            } : {}),
            ...(updates.status === 'on-going' || updates.status === 'new-order' ? {
                actualReleaseDate: null,
                actualCompletionDate: null,
                claimedBy: undefined,
                releasedBy: undefined,
            } : {})
        };

        // Optimistic Update
        setOrders((prev) => prev.map((order) => {
            if (order.id === id) {
                return { ...order, ...finalUpdates, updatedAt: new Date() };
            }
            return order;
        }));

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
                setOrders((prev) => prev.map((order) =>
                    order.id === id || order.orderNumber === id
                        ? {
                            ...order,
                            ...finalUpdates,
                            ...(persistedDate ? { predictedCompletionDate: persistedDate } : {}),
                            ...(persistedPredAt !== undefined ? { predictedAt: persistedPredAt } : {}),
                            ...(persistedPredDays != null ? { predictedDays: persistedPredDays } : {}),
                            updatedAt: new Date(),
                        }
                        : order
                ));
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

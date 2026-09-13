import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrders } from '@/app/context/OrderContext';
import { formatPeso } from '@/app/lib/currency';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Filter,
    ShoppingBag,
    Search,
    Calendar as CalendarIcon,
    ChevronDown,
    Wallet,
    Clock3,
    Ban,
    Trash2,
    MoreVertical,
    Edit,
    RotateCcw,
} from 'lucide-react';
import { format as dateFnsFormat } from 'date-fns';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { useServices } from '@/app/context/ServiceContext';
import EditOrderModal from '@/app/components/EditOrderModal';
import OrderDetailModal from '@/app/components/OrderDetailModal';
import { toast } from 'sonner';
import type { JobOrder } from '@/app/types';
import { isCancelledOrder, isDateInRange, orderEventDate, type ReportRange } from '@/app/lib/salesAnalytics';

type TotalOrdersProps = {
    onSetHeaderActionRight?: (action: ReactNode | null) => void;
    user: { token: string; role: 'owner' | 'staff' | 'admin'; username: string };
};

function FormattedDateInput({ value, onChange, className, id }: { value: string; onChange: (val: string) => void; className?: string; id?: string }) {
    const hiddenDateRef = useRef<HTMLInputElement>(null);
    const toDisplay = (iso: string) => {
        if (!iso) return '';
        const parts = iso.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return iso;
    };

    const [localVal, setLocalVal] = useState(toDisplay(value));

    useEffect(() => {
        setLocalVal(toDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputVal = e.target.value;
        let digits = inputVal.replace(/[^0-9]/g, '');
        if (digits.length > 8) digits = digits.substring(0, 8);

        let formatted = digits;
        if (digits.length > 2) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2);
        }
        if (digits.length > 4) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4);
        }

        setLocalVal(formatted);

        if (digits.length === 8) {
            const mm = digits.substring(0, 2);
            const dd = digits.substring(2, 4);
            const yyyy = digits.substring(4, 8);
            const iso = `${yyyy}-${mm}-${dd}`;
            const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            if (!isNaN(dateObj.getTime())) {
                onChange(iso);
            }
        }
    };

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isoVal = e.target.value;
        if (isoVal) {
            setLocalVal(toDisplay(isoVal));
            onChange(isoVal);
        }
    };

    const openPicker = () => {
        if (hiddenDateRef.current) {
            if (typeof hiddenDateRef.current.showPicker === 'function') {
                hiddenDateRef.current.showPicker();
            } else {
                hiddenDateRef.current.click();
            }
        }
    };

    return (
        <div className="relative w-full flex items-center">
            <Input
                id={id}
                type="text"
                placeholder="MM/DD/YYYY"
                value={localVal}
                onChange={handleChange}
                className={`${className || ''} pr-8 text-left`}
            />
            <button
                type="button"
                onClick={openPicker}
                title="Select date"
                className="absolute right-2.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-0.5"
            >
                <CalendarIcon size={14} />
            </button>
            <input
                ref={hiddenDateRef}
                type="date"
                value={value || ''}
                onChange={handlePickerChange}
                className="sr-only absolute pointer-events-none opacity-0"
                tabIndex={-1}
            />
        </div>
    );
}

export default function TotalOrders({ onSetHeaderActionRight, user }: TotalOrdersProps) {
    useEffect(() => {
        // [OWASP A09] Security Audit: Logging view access with token context
        if (user.token) {
            console.log('[SECURITY] Total Orders accessed by authenticated session');
        }
    }, [user.token]);

    const navigate = useNavigate();
    const location = useLocation();
    const { orders, updateOrder, deleteOrder } = useOrders();

    const [profitRange, setProfitRange] = useState<ReportRange>(() => {
        return (location.state as any)?.dateRange || 'Daily';
    });
    const [customStartDate, setCustomStartDate] = useState<string>(() => {
        return (location.state as any)?.customStartDate || '';
    });
    const [customEndDate, setCustomEndDate] = useState<string>(() => {
        return (location.state as any)?.customEndDate || '';
    });
    const [cardFilter, setCardFilter] = useState<'all' | 'fully-paid' | 'downpayment' | 'active' | 'cancelled'>(() => {
        return (location.state as any)?.filterCard || (location.state as any)?.cardFilter || 'all';
    });

    useEffect(() => {
        const state = location.state as any;
        if (state?.dateRange) {
            setProfitRange(state.dateRange);
        }
        if (state?.customStartDate !== undefined) {
            setCustomStartDate(state.customStartDate || '');
        }
        if (state?.customEndDate !== undefined) {
            setCustomEndDate(state.customEndDate || '');
        }
        if (state?.filterCard || state?.cardFilter) {
            setCardFilter(state.filterCard || state.cardFilter);
        }
    }, [location.state]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterService, setFilterService] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
    const [filterOrderStatus, setFilterOrderStatus] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<JobOrder | null>(null);
    const [orderToDelete, setOrderToDelete] = useState<JobOrder | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const isDeletingRef = useRef(false);
    const itemsPerPage = 15;

    const { services } = useServices();
    const baseServices = (services || []).filter((s) => s?.category === 'base' && s?.active);

    useEffect(() => {
        if (!onSetHeaderActionRight) return;

        const rangeMenu = (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="Select range"
                        className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <CalendarIcon className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline truncate mx-1 flex-1 text-center">{profitRange}</span>
                        <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 min-w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
                    {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Custom'].map((range) => (
                        <DropdownMenuItem
                            key={range}
                            onClick={() => setProfitRange(range as typeof profitRange)}
                            className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer ${profitRange === range
                                ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white'
                                : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'
                                }`}
                        >
                            {range}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );

        onSetHeaderActionRight(
            <div className="flex items-center gap-2">
                {profitRange === 'Custom' && (
                    <div className="hidden lg:flex items-center gap-1">
                        <input type="date" aria-label="Custom start date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-xs" />
                        <span className="text-xs text-gray-500">–</span>
                        <input type="date" aria-label="Custom end date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-xs" />
                        <button
                            type="button"
                            className="h-10 px-2 text-sm font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 hover:text-red-700"
                            onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setProfitRange('Daily'); }}
                        >
                            Clear
                        </button>
                    </div>
                )}
                {rangeMenu}
            </div>
        );

        return () => onSetHeaderActionRight(null);
    }, [onSetHeaderActionRight, profitRange, customStartDate, customEndDate]);

    // Base orders for selected date range
    const baseOrders = useMemo(() => {
        const now = new Date();
        return (orders || []).filter((order: JobOrder) =>
            order && isDateInRange(orderEventDate(order), profitRange, now, customStartDate, customEndDate)
        );
    }, [orders, profitRange, customStartDate, customEndDate]);

    // Base filtered orders for search, service, priority, and date range from dialog (independent of top card filter)
    const baseFilteredOrders = useMemo(() => {
        let filtered = [...baseOrders];

        if (filterService !== 'all') {
            filtered = filtered.filter((order) => {
                if (Array.isArray(order.baseService)) return order.baseService.some(s => String(s || '').toLowerCase().includes(filterService.toLowerCase()));
                if (typeof order.baseService === 'string') return (order.baseService as string).toLowerCase().includes(filterService.toLowerCase());
                return false;
            });
        }

        if (filterPriority !== 'all') {
            filtered = filtered.filter((order) => order.priorityLevel === filterPriority);
        }

        if (filterPaymentStatus !== 'all') {
            if (filterPaymentStatus === 'refunded') {
                filtered = filtered.filter((order) => order.refundStatus === 'refunded' || (isCancelledOrder(order) && Number(order.refundAmount || 0) > 0));
            } else {
                filtered = filtered.filter((order) => order.paymentStatus === filterPaymentStatus && !isCancelledOrder(order));
            }
        }

        if (filterOrderStatus !== 'all') {
            if (filterOrderStatus === 'active') {
                filtered = filtered.filter((order) => order.status !== 'claimed' && (order.status as string)?.toLowerCase() !== 'cancelled');
            } else {
                filtered = filtered.filter((order) => order.status === filterOrderStatus);
            }
        }

        if (startDate) {
            const start = new Date(startDate);
            filtered = filtered.filter((order) => {
                const d = new Date(order.createdAt || (order as any).transactionDate || 0);
                return !isNaN(d.getTime()) && d >= start;
            });
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter((order) => {
                const d = new Date(order.createdAt || (order as any).transactionDate || 0);
                return !isNaN(d.getTime()) && d <= end;
            });
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((order) =>
                String(order.customerName || '').toLowerCase().includes(query) ||
                String(order.orderNumber || order.id || '').toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [baseOrders, filterService, filterPriority, filterPaymentStatus, filterOrderStatus, startDate, endDate, searchQuery]);

    // Card counts calculated across all orders matching the date range & search/dialog filters
    const totalOrdersCount = baseFilteredOrders.length;
    const paidOrdersCount = baseFilteredOrders.filter((order) => order.paymentStatus === 'fully-paid').length;
    const downpaymentOrdersCount = baseFilteredOrders.filter((order) => order.paymentStatus === 'downpayment').length;
    const activeOrdersCount = baseFilteredOrders.filter((order) => 
        order.status !== 'claimed' && (order.status as string)?.toLowerCase() !== 'cancelled' && (order.status as string)?.toLowerCase() !== 'canceled'
    ).length;
    const allCancelledOrders = useMemo(() => {
        return (orders || []).filter(isCancelledOrder);
    }, [orders]);

    const cancelledOrdersCount = useMemo(() => {
        const inPeriod = baseFilteredOrders.filter(isCancelledOrder).length;
        return inPeriod > 0 ? inPeriod : allCancelledOrders.length;
    }, [baseFilteredOrders, allCancelledOrders]);

    // Table orders filtered by the active card filter
    const filteredOrders = useMemo(() => {
        let filtered = [...baseFilteredOrders];

        if (cardFilter === 'fully-paid') {
            filtered = filtered.filter((order) => order.paymentStatus === 'fully-paid' && !isCancelledOrder(order));
        } else if (cardFilter === 'downpayment') {
            filtered = filtered.filter((order) => order.paymentStatus === 'downpayment' && !isCancelledOrder(order));
        } else if (cardFilter === 'active') {
            filtered = filtered.filter((order) => order.status !== 'claimed' && !isCancelledOrder(order));
        } else if (cardFilter === 'cancelled') {
            const inPeriod = baseFilteredOrders.filter(isCancelledOrder);
            if (inPeriod.length > 0) {
                filtered = inPeriod;
            } else {
                filtered = (orders || []).filter((order) => {
                    if (!isCancelledOrder(order)) return false;
                    if (filterService !== 'all') {
                        if (Array.isArray(order.baseService)) return order.baseService.some(s => String(s || '').toLowerCase().includes(filterService.toLowerCase()));
                        if (typeof order.baseService === 'string') return (order.baseService as string).toLowerCase().includes(filterService.toLowerCase());
                        return false;
                    }
                    if (filterPriority !== 'all' && order.priorityLevel !== filterPriority) return false;
                    if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        return String(order.customerName || '').toLowerCase().includes(q) || String(order.orderNumber || order.id || '').toLowerCase().includes(q);
                    }
                    return true;
                });
            }
        }

        // Sort: Recently updated/created first, then by priority, then by Order Number descending
        filtered.sort((a, b) => {
            const lastStatusTimeA = (a.statusHistory && a.statusHistory.length > 0 && a.statusHistory[a.statusHistory.length - 1]?.timestamp)
                ? new Date(a.statusHistory[a.statusHistory.length - 1].timestamp).getTime() : 0;
            const timeA = lastStatusTimeA || (a.updatedAt ? new Date(a.updatedAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0);

            const lastStatusTimeB = (b.statusHistory && b.statusHistory.length > 0 && b.statusHistory[b.statusHistory.length - 1]?.timestamp)
                ? new Date(b.statusHistory[b.statusHistory.length - 1].timestamp).getTime() : 0;
            const timeB = lastStatusTimeB || (b.updatedAt ? new Date(b.updatedAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0);

            const validA = !isNaN(timeA) ? timeA : 0;
            const validB = !isNaN(timeB) ? timeB : 0;

            if (validA !== validB) return validB - validA;

            // Priority Level fallback (Rush first)
            const priorityOrder = { rush: 0, regular: 1 };
            const priorityA = priorityOrder[a.priorityLevel as keyof typeof priorityOrder] ?? 2;
            const priorityB = priorityOrder[b.priorityLevel as keyof typeof priorityOrder] ?? 2;
            if (priorityA !== priorityB) return priorityA - priorityB;

            return String(b.orderNumber || '').localeCompare(String(a.orderNumber || ''));
        });

        return filtered;
    }, [baseFilteredOrders, cardFilter]);

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-6">
            {profitRange === 'Custom' && (
                <div className="flex flex-wrap items-end justify-center gap-2 rounded-xl border border-red-100 bg-red-50/60 p-3 lg:hidden">
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Start date</span>
                        <input type="date" aria-label="Custom start date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-2 text-xs" />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">End date</span>
                        <input type="date" aria-label="Custom end date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-2 text-xs" />
                    </label>
                    <button
                        type="button"
                        className="h-10 px-3 text-sm font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 hover:text-red-700"
                        onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setProfitRange('Daily'); }}
                    >
                        Clear
                    </button>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                <Card 
                    onClick={() => { setCardFilter('all'); setCurrentPage(1); }}
                    className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-blue-50 to-white hover:shadow-md ${
                        cardFilter === 'all' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-transparent hover:border-blue-200'
                    }`}
                >
                    <CardContent className="pt-4 pb-3.5 px-3 sm:px-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                                <ShoppingBag className="h-4 w-4" />
                            </div>
                            <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Total Orders</p>
                        </div>
                        <p className="text-2xl font-black text-blue-700 tracking-tight">{totalOrdersCount}</p>
                    </CardContent>
                </Card>

                <Card 
                    onClick={() => { setCardFilter(cardFilter === 'fully-paid' ? 'all' : 'fully-paid'); setCurrentPage(1); }}
                    className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-green-50 to-white hover:shadow-md ${
                        cardFilter === 'fully-paid' ? 'border-green-600 ring-2 ring-green-600/20' : 'border-transparent hover:border-green-200'
                    }`}
                >
                    <CardContent className="pt-4 pb-3.5 px-3 sm:px-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="p-1.5 rounded-lg bg-green-100 text-green-700 shrink-0">
                                <Wallet className="h-4 w-4" />
                            </div>
                            <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Fully Paid Orders</p>
                        </div>
                        <p className="text-2xl font-black text-green-700 tracking-tight">{paidOrdersCount}</p>
                    </CardContent>
                </Card>

                <Card 
                    onClick={() => { setCardFilter(cardFilter === 'downpayment' ? 'all' : 'downpayment'); setCurrentPage(1); }}
                    className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-amber-50 to-white hover:shadow-md ${
                        cardFilter === 'downpayment' ? 'border-amber-600 ring-2 ring-amber-600/20' : 'border-transparent hover:border-amber-200'
                    }`}
                >
                    <CardContent className="pt-4 pb-3.5 px-3 sm:px-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                                <Wallet className="h-4 w-4" />
                            </div>
                            <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Downpayment Orders</p>
                        </div>
                        <p className="text-2xl font-black text-amber-700 tracking-tight">{downpaymentOrdersCount}</p>
                    </CardContent>
                </Card>

                <Card 
                    onClick={() => { setCardFilter(cardFilter === 'active' ? 'all' : 'active'); setCurrentPage(1); }}
                    className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-violet-50 to-white hover:shadow-md ${
                        cardFilter === 'active' ? 'border-violet-600 ring-2 ring-violet-600/20' : 'border-transparent hover:border-violet-200'
                    }`}
                >
                    <CardContent className="pt-4 pb-3.5 px-3 sm:px-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="p-1.5 rounded-lg bg-violet-100 text-violet-700 shrink-0">
                                <Clock3 className="h-4 w-4" />
                            </div>
                            <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Active Orders</p>
                        </div>
                        <p className="text-2xl font-black text-violet-700 tracking-tight">{activeOrdersCount}</p>
                    </CardContent>
                </Card>

                <Card 
                    onClick={() => { setCardFilter(cardFilter === 'cancelled' ? 'all' : 'cancelled'); setCurrentPage(1); }}
                    className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-rose-50 to-white hover:shadow-md ${
                        cardFilter === 'cancelled' ? 'border-rose-600 ring-2 ring-rose-600/20' : 'border-transparent hover:border-rose-200'
                    }`}
                >
                    <CardContent className="pt-4 pb-3.5 px-3 sm:px-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                                <Ban className="h-4 w-4" />
                            </div>
                            <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Cancelled Orders</p>
                        </div>
                        <p className="text-2xl font-black text-rose-700 tracking-tight">{cancelledOrdersCount}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-xl border-0">
                <CardHeader className="pb-2 pt-6">
                    <div className="flex flex-col items-center gap-2">
                        <CardTitle className="text-lg font-black uppercase tracking-tight text-gray-900">Orders</CardTitle>
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 w-full">
                            <Button
                                onClick={() => navigate('/sales-report', { state: { dateRange: profitRange, customStartDate, customEndDate } })}
                                className="bg-red-600 text-white hover:bg-red-700 h-10 px-3 flex-shrink-0 uppercase text-[11px] font-bold flex items-center gap-2 rounded-xl shadow-sm"
                                size="sm"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>

                            <div className="flex-1 min-w-[220px] relative group">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 text-gray-500 group-focus-within:text-red-600"
                                    onClick={() => (document.getElementById('ordersSearch') as HTMLInputElement)?.focus()}
                                    title="Focus search"
                                >
                                    <Search className="h-5 w-5" />
                                </Button>
                                <Input
                                    id="ordersSearch"
                                    placeholder="Search order # or customer..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-10 h-10 text-sm border-gray-200 bg-gray-50/70 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-xl"
                                />
                            </div>

                            <Button
                                variant="outline"
                                className={`h-10 w-10 p-0 rounded-xl transition-colors flex-shrink-0 ${filterService !== 'all' || filterPriority !== 'all' || filterPaymentStatus !== 'all' || filterOrderStatus !== 'all' || startDate || endDate
                                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                                    : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                onClick={() => setIsFilterOpen(true)}
                                title="Open filters"
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-2 sm:px-4 md:px-6">
                    <div className="overflow-x-auto w-full">
                        <Table className="w-full table-fixed min-w-0 text-xs">
                            <colgroup>
                                <col className="w-[12%]" />
                                <col className="w-[15%]" />
                                <col className="w-[15%]" />
                                <col className="w-[5%]" />
                                <col className="w-[9%]" />
                                <col className="w-[8%]" />
                                <col className="w-[10%]" />
                                <col className="w-[12%]" />
                                <col className="w-[8%]" />
                                <col className="w-[6%]" />
                            </colgroup>
                            <TableHeader className="bg-red-50/50 border-b border-red-100">
                                <TableRow className="border-b border-red-100 hover:bg-transparent">
                                    <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Order #</TableHead>
                                    <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Customer</TableHead>
                                    <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px]">Services</TableHead>
                                    <TableHead className="h-9 px-1 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">QTY</TableHead>
                                    <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Order Date</TableHead>
                                    <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Priority</TableHead>
                                    <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Status</TableHead>
                                    <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Payment</TableHead>
                                    <TableHead className="h-9 px-2 text-right font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Total</TableHead>
                                    <TableHead className="h-9 px-1 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-gray-100">
                                {paginatedOrders.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={10} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <ShoppingBag size={48} className="text-gray-300" />
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                                                    {searchQuery || cardFilter !== 'all' ? 'No matching orders found' : 'No orders found for this period'}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedOrders.map((order: JobOrder) => {
                                        const orderDate = new Date(order.createdAt || (order as any).transactionDate);
                                        const pStatus = order.paymentStatus || '';
                                        const servicesList = (Array.isArray(order.baseService)
                                            ? order.baseService
                                            : String(order.baseService || '').split(',')
                                        )
                                            .flatMap((s) => String(s || '').split(','))
                                            .map((s) => String(s || '').trim().replace(' (with basic cleaning)', ''))
                                            .filter(Boolean);
                                        const isCancelled = order.status === 'cancelled' || (order.status as string)?.toLowerCase() === 'cancelled' || (order.status as string)?.toLowerCase() === 'canceled';

                                        return (
                                        <TableRow key={order.id} onClick={() => setViewingOrder(order)} className="border-b border-gray-100 hover:bg-gray-50/80 transition-all cursor-pointer">
                                            <TableCell className="px-2 py-2 text-center text-[11px] font-semibold whitespace-nowrap text-gray-800" title={order.orderNumber || order.id || '-'}>{order.orderNumber || order.id || '-'}</TableCell>
                                            <TableCell className="px-2 py-2 text-center">
                                                <div className="flex flex-col items-center justify-center text-center w-full min-w-0">
                                                    <div className="text-xs font-bold text-gray-900 leading-tight truncate max-w-full" title={order.customerName || 'Walk-In'}>{order.customerName || 'Walk-In'}</div>
                                                    {order.contactNumber && (
                                                        <div className="text-[10px] text-gray-500 font-medium mt-0.5 whitespace-nowrap truncate max-w-full">{order.contactNumber}</div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-2 py-2 text-center text-[11px] font-semibold text-gray-800 whitespace-normal break-words">
                                                {servicesList.length > 0 ? (
                                                    <div className="flex flex-col items-center justify-center text-center text-[10.5px] font-semibold text-gray-800 leading-tight" title={servicesList.join(', ')}>
                                                        {servicesList.slice(0, 3).map((srv, idx) => (
                                                            <span key={idx} className="block text-[10.5px] font-semibold text-gray-800 leading-tight">
                                                                {srv}{idx < servicesList.length - 1 ? ',' : ''}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic font-normal text-center block">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-1 py-2 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                                                {order.quantity || 1} PR
                                            </TableCell>
                                            <TableCell className="px-2 py-2 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
                                                {isNaN(orderDate.getTime()) ? '-' : (
                                                    <div className="inline-flex items-center justify-center gap-1">
                                                        <CalendarIcon size={12} className="text-purple-600 shrink-0" />
                                                        <span>{dateFnsFormat(orderDate, 'MM/dd/yy')}</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-1 py-2 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap ${
                                                    order.priorityLevel === 'rush'
                                                        ? 'bg-red-50 text-red-700 border-red-100'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                }`}>
                                                    {order.priorityLevel === 'rush' ? 'Rush' : order.priorityLevel === 'regular' ? 'Regular' : (order.priorityLevel || 'Regular')}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-2 py-2 text-center whitespace-nowrap">
                                                {(() => {
                                                    const isCancelled = order.status === 'cancelled' || (order.status as string)?.toLowerCase() === 'cancelled' || (order.status as string)?.toLowerCase() === 'canceled';
                                                    if (isCancelled) {
                                                        return (
                                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap bg-red-50 text-red-700 border-red-200">
                                                                CANCELLED
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap ${
                                                            order.status === 'new-order' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            order.status === 'on-going' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            order.status === 'for-release' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                            order.status === 'claimed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                            {order.status ? order.status.replace('-', ' ') : 'new order'}
                                                        </span>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="px-2 py-2 whitespace-nowrap">
                                                 <div className="flex flex-col items-center justify-center text-center">
                                                     {isCancelled ? (
                                                         order.refundStatus === 'refunded' ? (
                                                             <>
                                                                 <span className="text-[10px] font-bold tracking-wider text-rose-600">
                                                                     REFUNDED
                                                                 </span>
                                                                 <span className="text-[9px] text-rose-600 font-medium tracking-wider mt-0.5">
                                                                     Refund: {formatPeso(Number(order.refundAmount || order.grandTotal || 0))}
                                                                 </span>
                                                             </>
                                                         ) : (
                                                             <>
                                                                 <span className="text-[10px] font-bold tracking-wider text-amber-700">
                                                                     NO REFUND
                                                                 </span>
                                                                 <span className="text-[9px] text-amber-700 font-medium tracking-wider mt-0.5">
                                                                     Retained: {formatPeso(Number(order.amountReceived || order.depositAmount || 0))}
                                                                 </span>
                                                             </>
                                                         )
                                                     ) : (
                                                         <>
                                                             <span className={`text-[10px] font-bold tracking-wider ${
                                                                 pStatus === 'fully-paid' ? 'text-green-600' :
                                                                 pStatus === 'downpayment' ? 'text-yellow-600' : 'text-red-600'
                                                             }`}>
                                                                 {pStatus === 'fully-paid' ? 'FULLY PAID' : pStatus === 'downpayment' ? 'DOWNPAYMENT' : pStatus ? pStatus.toUpperCase() : '-'}
                                                             </span>
                                                             {order.paymentMethod && (
                                                                 <>
                                                                     <span className="text-[8.5px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                                                                         {order.paymentMethod}
                                                                     </span>
                                                                     {pStatus === 'downpayment' && (
                                                                         <span className="text-[9px] text-red-500 font-bold tracking-wider mt-0.5">
                                                                             BAL: {formatPeso(order.balance !== undefined && order.balance !== null && !isNaN(Number(order.balance)) ? Math.max(0, Number(order.balance)) : Math.max(0, (Number(order.grandTotal) || 0) - (Number(order.depositAmount) || (Number(order.amountReceived) && Number(order.amountReceived) < Number(order.grandTotal) ? Number(order.amountReceived) : 0))))}
                                                                         </span>
                                                                     )}
                                                                 </>
                                                             )}
                                                         </>
                                                     )}
                                                 </div>
                                             </TableCell>
                                             <TableCell className="px-2 py-2 text-right whitespace-nowrap">
                                                  <span className="font-bold text-gray-900 text-xs">₱{(Number(order.grandTotal) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                              </TableCell>
                                              <TableCell className="px-1 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                  <DropdownMenu>
                                                      <DropdownMenuTrigger asChild>
                                                          <Button
                                                              variant="outline"
                                                              className="h-7 w-7 p-0 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-md inline-flex items-center justify-center"
                                                              title="Actions"
                                                          >
                                                              <MoreVertical className="h-3.5 w-3.5 text-red-500" />
                                                          </Button>
                                                      </DropdownMenuTrigger>
                                                      <DropdownMenuContent align="end" className="w-52 p-1.5 space-y-1">
                                                           {isCancelled && (
                                                               <DropdownMenuItem
                                                                   onClick={(e) => {
                                                                       e.stopPropagation();
                                                                       const targetStage = order.cancellationStage || 'new-order';
                                                                       updateOrder(order.id, {
                                                                           status: targetStage as any,
                                                                           cancellationStage: null as any,
                                                                           refundStatus: null as any,
                                                                           refundAmount: 0,
                                                                           refundReason: null as any,
                                                                           cancelledAt: null as any,
                                                                           updatedAt: new Date()
                                                                       }, user.username);
                                                                       toast.success(`Order #${order.orderNumber} restored to ${targetStage.replace('-', ' ')}`);
                                                                   }}
                                                                   className="border border-purple-200 rounded-md px-2.5 py-1.5 text-purple-700 bg-purple-50 hover:bg-purple-100 focus:text-purple-800 focus:bg-purple-100 font-bold cursor-pointer"
                                                               >
                                                                   <RotateCcw className="h-4 w-4 mr-2 text-purple-600" />
                                                                   Undo Cancel Order
                                                               </DropdownMenuItem>
                                                           )}
                                                          <DropdownMenuItem
                                                              onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setSelectedOrder(order);
                                                                  setIsEditing(true);
                                                              }}
                                                              className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold cursor-pointer"
                                                          >
                                                              <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                                              Edit Order Detail
                                                          </DropdownMenuItem>
                                                          <DropdownMenuItem
                                                              onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setOrderToDelete(order);
                                                              }}
                                                              className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold cursor-pointer"
                                                          >
                                                              <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                                                              Delete Order
                                                          </DropdownMenuItem>
                                                      </DropdownMenuContent>
                                                  </DropdownMenu>
                                              </TableCell>
                                        </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1.5 pb-1 border-top-0 border-t border-gray-50 px-3">
                        <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                            PAGE {currentPage} OF {totalPages}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPage === 1
                                    ? 'bg-slate-200 text-slate-500'
                                    : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                    }`}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <div className="max-w-[140px] md:max-w-[300px] overflow-x-auto no-scrollbar py-0.5 px-0.5 flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => {
                                    const pageNum = i + 1;
                                    const isActive = currentPage === pageNum;
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={isActive ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`h-7 w-7 min-w-[28px] p-0 text-[10px] font-black rounded-lg transition-all ${isActive
                                                ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm shadow-red-200'
                                                : 'bg-white border-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                                                }`}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPage === totalPages
                                    ? 'bg-slate-200 text-slate-500'
                                    : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                    }`}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Filters</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Service Type</label>
                            <Select value={filterService} onValueChange={setFilterService}>
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Services" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700">All Services</SelectItem>
                                    {baseServices.map((service) => (
                                        <SelectItem key={service.id} value={service.name} className="text-xs focus:bg-red-50 focus:text-red-700">
                                            {service.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Priority Level</label>
                            <Select value={filterPriority} onValueChange={setFilterPriority}>
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700">All Priority</SelectItem>
                                    <SelectItem value="regular" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Regular</SelectItem>
                                    <SelectItem value="rush" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Rush</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Payment Status</label>
                            <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Payment Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700">All Payment Status</SelectItem>
                                    <SelectItem value="fully-paid" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Fully Paid</SelectItem>
                                    <SelectItem value="downpayment" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Downpayment</SelectItem>
                                    <SelectItem value="refunded" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Refunded</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Order Status</label>
                            <Select value={filterOrderStatus} onValueChange={setFilterOrderStatus}>
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Order Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700">All Order Status</SelectItem>
                                    <SelectItem value="active" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Active Orders</SelectItem>
                                    <SelectItem value="new-order" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">New Order</SelectItem>
                                    <SelectItem value="on-going" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">On-going</SelectItem>
                                    <SelectItem value="for-release" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">For Release</SelectItem>
                                    <SelectItem value="claimed" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Claimed</SelectItem>
                                    <SelectItem value="cancelled" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Start Date</label>
                            <FormattedDateInput
                                value={startDate}
                                onChange={(val) => setStartDate(val)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">End Date</label>
                            <FormattedDateInput
                                value={endDate}
                                onChange={(val) => setEndDate(val)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <Button
                            variant="ghost"
                            className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-xl"
                            onClick={() => {
                                setCardFilter('all');
                                setFilterService('all');
                                setFilterPriority('all');
                                setFilterPaymentStatus('all');
                                setFilterOrderStatus('all');
                                setStartDate('');
                                setEndDate('');
                                setCurrentPage(1);
                            }}
                        >
                            Reset
                        </Button>
                        <Button className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-xl shadow-md uppercase tracking-wider transition-all" onClick={() => setIsFilterOpen(false)}>
                            Apply
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Order Modal */}
            {selectedOrder && (
                <EditOrderModal
                    open={isEditing}
                    onOpenChange={(open) => {
                        setIsEditing(open);
                        if (!open) setSelectedOrder(null);
                    }}
                    order={selectedOrder}
                    user={user}
                    onSave={(id, updates) => { 
                        updateOrder(id, updates); 
                        setSelectedOrder((prev: any) => prev ? { ...prev, ...updates } : null); 
                        setIsEditing(false); 
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && !isDeleting && setOrderToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Confirm Soft Delete</DialogTitle>
                        <DialogDescription className="sr-only">Confirm soft deletion of the selected order</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 flex flex-col items-center gap-4">
                        <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                            <Trash2 size={32} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-gray-900">Are you sure you want to delete this order?</p>
                            <p className="text-xs text-gray-500 mt-1">This action will remove <span className="font-black text-red-600">{orderToDelete?.orderNumber}</span> from the orders record. This cannot be undone.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button 
                            variant="ghost" 
                            className="flex-1 bg-gray-100 font-bold uppercase text-[10px] tracking-widest h-10 rounded-xl"
                            onClick={() => setOrderToDelete(null)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 bg-red-600 hover:bg-red-700 font-bold uppercase text-[10px] tracking-widest h-10 rounded-xl shadow-lg shadow-red-100 disabled:opacity-50"
                            disabled={isDeleting}
                            onClick={async () => {
                                if (isDeletingRef.current || isDeleting) return;
                                if (orderToDelete) {
                                    isDeletingRef.current = true;
                                    setIsDeleting(true);
                                    try {
                                        await deleteOrder(orderToDelete.id);
                                        toast.success(`Order ${orderToDelete.orderNumber} deleted successfully`);
                                        setOrderToDelete(null);
                                    } catch (err: any) {
                                        toast.error(err?.message || 'Failed to delete order');
                                    } finally {
                                        isDeletingRef.current = false;
                                        setIsDeleting(false);
                                    }
                                }
                            }}
                        >
                            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <OrderDetailModal
                order={viewingOrder}
                open={!!viewingOrder}
                onOpenChange={(open) => !open && setViewingOrder(null)}
            />
        </div>
    );
}

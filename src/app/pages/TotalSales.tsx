import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrders } from '@/app/context/OrderContext';
import type { JobOrder } from '@/app/types';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Filter,
    Wallet,
    Search,
    Calendar as CalendarIcon,
    ChevronDown,
    LineChart,
    TrendingUp,
    Pencil,
    Trash2
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { useServices } from '@/app/context/ServiceContext';
import EditOrderModal from '@/app/components/EditOrderModal';
import { toast } from 'sonner';

type TotalSalesProps = {
    onSetHeaderActionRight?: (action: ReactNode | null) => void;
    user: { token: string };
};

export default function TotalSales({ onSetHeaderActionRight, user }: TotalSalesProps) {
    useEffect(() => {
        // [OWASP A09] Security Audit: Logging view access with token context
        if (user.token) {
            console.log('[SECURITY] Total Sales accessed by authenticated session');
        }
    }, [user.token]);

    const navigate = useNavigate();
    const location = useLocation();
    const { orders, updateOrder, deleteOrder } = useOrders();

    const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<JobOrder | null>(null);

    const [profitRange, setProfitRange] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually'>(() => {
        return (location.state as any)?.dateRange || 'Daily';
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterService, setFilterService] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const formatNumericDateTime = (value: string | number | Date) => {
        const d = new Date(value);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${mm}/${dd}/${yy} ${hh}:${min}`;
    };

    const { services } = useServices();
    const baseServices = services.filter((s) => s.category === 'base' && s.active);

    useEffect(() => {
        if (!onSetHeaderActionRight) return;

        onSetHeaderActionRight(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="Select range"
                        className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-semibold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <CalendarIcon className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline truncate mx-1">{profitRange}</span>
                        <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
                    {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'].map((range) => (
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

        return () => onSetHeaderActionRight(null);
    }, [onSetHeaderActionRight, profitRange]);

    const salesOrders = useMemo(() => {
        const now = new Date();
        const isWithinRange = (createdAt: Date) => {
            const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            if (profitRange === 'Daily') {
                const startOfToday = new Date(now);
                startOfToday.setHours(0, 0, 0, 0);
                return createdAt >= startOfToday;
            }
            if (profitRange === 'Weekly') return diffDays < 7;
            if (profitRange === 'Monthly') return diffDays < 30;
            if (profitRange === 'Quarterly') return diffDays < 90;
            if (profitRange === 'Annually') return diffDays < 365;
            return true;
        };

        return orders
            .filter((order: JobOrder) => order.paymentStatus === 'fully-paid' || order.paymentStatus === 'downpayment')
            .filter((order: JobOrder) => isWithinRange(new Date(order.transactionDate || order.createdAt)));
    }, [orders, profitRange]);

    const filteredOrders = useMemo(() => {
        let filtered = [...salesOrders];

        if (filterService !== 'all') {
            filtered = filtered.filter((order) => order.baseService.includes(filterService));
        }

        if (filterPriority !== 'all') {
            filtered = filtered.filter((order) => order.priorityLevel === filterPriority);
        }

        if (startDate) {
            const start = new Date(startDate);
            filtered = filtered.filter((order) => new Date(order.transactionDate || order.createdAt) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter((order) => new Date(order.transactionDate || order.createdAt) <= end);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((order) =>
                order.customerName.toLowerCase().includes(query) || order.orderNumber.toLowerCase().includes(query)
            );
        }

        // Sort: Recently updated/created first, then by priority, then by Order Number descending
        filtered.sort((a, b) => {
            const lastStatusTimeA = a.statusHistory?.length ? new Date(a.statusHistory[a.statusHistory.length - 1].timestamp).getTime() : 0;
            const timeA = lastStatusTimeA || new Date(a.updatedAt || a.createdAt).getTime();

            const lastStatusTimeB = b.statusHistory?.length ? new Date(b.statusHistory[b.statusHistory.length - 1].timestamp).getTime() : 0;
            const timeB = lastStatusTimeB || new Date(b.updatedAt || b.createdAt).getTime();

            const validA = !isNaN(timeA) ? timeA : 0;
            const validB = !isNaN(timeB) ? timeB : 0;

            if (validA !== validB) return validB - validA;

            // Priority Level fallback (Rush first)
            const priorityOrder = { rush: 0, regular: 1 };
            const priorityA = priorityOrder[a.priorityLevel as keyof typeof priorityOrder] ?? 2;
            const priorityB = priorityOrder[b.priorityLevel as keyof typeof priorityOrder] ?? 2;
            if (priorityA !== priorityB) return priorityA - priorityB;

            return b.orderNumber.localeCompare(a.orderNumber);
        });

        return filtered;
    }, [salesOrders, filterService, filterPriority, startDate, endDate, searchQuery]);

    const totalSales = filteredOrders.reduce((sum: number, order: JobOrder) => sum + (order.amountReceived || 0), 0);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const paymentBreakdown = filteredOrders.reduce((acc: Record<string, number>, order: JobOrder) => {
        const method = (order.paymentMethod || 'cash').toLowerCase();
        acc[method] = (acc[method] || 0) + (order.amountReceived || 0);
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-green-100 text-green-700">
                                <LineChart className="h-4 w-4" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Total Sales</p>
                        </div>
                        <p className="text-3xl font-black text-green-700 tracking-tight">₱{totalSales.toLocaleString()}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                                <Wallet className="h-4 w-4" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Cash Sales</p>
                        </div>
                        <p className="text-3xl font-black text-amber-700 tracking-tight">₱{Math.round(paymentBreakdown.cash || 0).toLocaleString()}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-cyan-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700">
                                <Wallet className="h-4 w-4" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">GCash Sales</p>
                        </div>
                        <p className="text-3xl font-black text-cyan-700 tracking-tight">₱{Math.round(paymentBreakdown.gcash || 0).toLocaleString()}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-pink-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-pink-100 text-pink-700">
                                <Wallet className="h-4 w-4" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Maya Sales</p>
                        </div>
                        <p className="text-3xl font-black text-pink-700 tracking-tight">₱{Math.round(paymentBreakdown.maya || 0).toLocaleString()}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-xl border-0">
                <CardHeader className="pb-2 pt-6">
                    <div className="flex flex-col items-center gap-2">
                        <CardTitle className="text-lg font-black uppercase tracking-tight text-gray-900">Sales Transactions</CardTitle>
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 w-full">
                            <Button
                                onClick={() => navigate('/sales-report', { state: { dateRange: profitRange } })}
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
                                    onClick={() => (document.getElementById('salesSearch') as HTMLInputElement)?.focus()}
                                    title="Focus search"
                                >
                                    <Search className="h-5 w-5" />
                                </Button>
                                <Input
                                    id="salesSearch"
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
                                className={`h-10 w-10 p-0 rounded-xl transition-colors flex-shrink-0 ${filterService !== 'all' || filterPriority !== 'all' || startDate || endDate
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

                <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-[#fef5f3]">
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Order #</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Customer Name</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Service Type</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Order Date</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Payment Method</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Payment Status</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs text-right">Amount Paid</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs text-right">Balance</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-[11px] text-center tracking-wider">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-gray-400 py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <TrendingUp className="h-10 w-10 text-gray-300" />
                                                <p className="font-semibold">No sales transactions found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedOrders.map((order: JobOrder) => {
                                        const orderDate = new Date(order.transactionDate || order.createdAt);
                                        const remainingBalance = (order.grandTotal || 0) - (order.amountReceived || 0);
                                        const pStatus = order.paymentStatus || '';

                                        let badgeClass = 'bg-gray-100 text-gray-700';
                                        if (pStatus === 'fully-paid') badgeClass = 'bg-green-100 text-green-700';
                                        else if (pStatus === 'downpayment') badgeClass = 'bg-red-100 text-red-700';
                                        else if (pStatus === 'unpaid') badgeClass = 'bg-gray-200 text-gray-800';

                                        return (
                                            <TableRow key={order.id} className="hover:bg-gray-50">
                                                <TableCell className="font-semibold text-gray-800">{order.orderNumber || order.id}</TableCell>
                                                <TableCell className="text-sm text-gray-700">{order.customerName}</TableCell>
                                                <TableCell className="text-sm text-gray-700">
                                                    {Array.isArray(order.baseService)
                                                        ? order.baseService.map((s) => s.replace(' (with basic cleaning)', '')).join(', ')
                                                        : String(order.baseService).replace(' (with basic cleaning)', '')}
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-700">
                                                    {formatNumericDateTime(orderDate)}
                                                </TableCell>
                                                <TableCell className="text-sm font-semibold text-gray-800 uppercase">
                                                    {order.paymentMethod?.toUpperCase()}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase ${badgeClass}`}>
                                                        {pStatus === 'fully-paid' ? 'Fully Paid' : pStatus === 'downpayment' ? 'Downpayment' : pStatus.charAt(0).toUpperCase() + pStatus.slice(1)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-sm text-gray-900">
                                                    ₱{(order.amountReceived || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-sm text-gray-700">
                                                    ₱{Math.max(remainingBalance, 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 rounded-lg border border-amber-500 text-amber-600 hover:bg-amber-50 transition-colors"
                                                            onClick={() => {
                                                                setSelectedOrder(order);
                                                                setIsEditing(true);
                                                            }}
                                                            title="Edit Order"
                                                        >
                                                            <Pencil size={14} strokeWidth={2.5} />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 transition-colors"
                                                            onClick={() => setOrderToDelete(order)}
                                                            title="Delete Order"
                                                        >
                                                            <Trash2 size={14} strokeWidth={2.5} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1.5 pb-1 border-t border-gray-50 px-3">
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
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Start Date</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">End Date</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <Button
                            variant="ghost"
                            className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-xl"
                            onClick={() => {
                                setFilterService('all');
                                setFilterPriority('all');
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
                    onSave={(id, updates) => {
                        updateOrder(id, updates, "Owner");
                        setIsEditing(false);
                        toast.success('Order updated successfully');
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Confirm Soft Delete</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 flex flex-col items-center gap-4">
                        <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                            <Trash2 size={32} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-gray-900">Are you sure you want to delete this order?</p>
                            <p className="text-xs text-gray-500 mt-1">This action will remove <span className="font-black text-red-600">{orderToDelete?.orderNumber}</span> from the sales record. This cannot be undone.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button 
                            variant="ghost" 
                            className="flex-1 bg-gray-100 font-bold uppercase text-[10px] tracking-widest h-10 rounded-xl"
                            onClick={() => setOrderToDelete(null)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 bg-red-600 hover:bg-red-700 font-bold uppercase text-[10px] tracking-widest h-10 rounded-xl shadow-lg shadow-red-100"
                            onClick={async () => {
                                if (orderToDelete) {
                                    await deleteOrder(orderToDelete.id);
                                    toast.success(`Order ${orderToDelete.orderNumber} deleted successfully`);
                                    setOrderToDelete(null);
                                }
                            }}
                        >
                            Yes, Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

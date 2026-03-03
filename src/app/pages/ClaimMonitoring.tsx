import { useNavigate } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';
import { JobOrder } from '@/app/types';
import { Search, Filter, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { useState, useMemo } from 'react';
import { format as dateFnsFormat } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/app/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/app/components/ui/select";
import { Label } from "@/app/components/ui/label";
import { Calendar } from "@/app/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/app/components/ui/utils";

export default function ClaimMonitoring() {
    const navigate = useNavigate();
    const { orders } = useOrders();
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'fully-paid' | 'downpayment'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Advanced Filter State
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState<{
        paymentMethod: string;
        attendedBy: string;
        startDate: Date | undefined;
        endDate: Date | undefined;
    }>({
        paymentMethod: 'all',
        attendedBy: 'all',
        startDate: undefined,
        endDate: undefined
    });
    const [tempFilters, setTempFilters] = useState({ ...filters });

    // Filter and Search logic
    const filteredOrders = useMemo(() => {
        return orders
            .filter((order: JobOrder) => order.status === 'claimed')
            .filter((order: JobOrder) => {
                const matchesSearch =
                    order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());

                const balance = order.grandTotal - (order.amountReceived || 0);
                const isPaid = balance <= 0 && order.paymentStatus === 'fully-paid';

                const matchesPayment =
                    paymentFilter === 'all' ||
                    (paymentFilter === 'fully-paid' && isPaid) ||
                    (paymentFilter === 'downpayment' && !isPaid);

                const matchesPaymentMethod =
                    filters.paymentMethod === 'all' ||
                    (order.paymentMethod?.toLowerCase() === filters.paymentMethod.toLowerCase());

                const matchesAttendedBy =
                    filters.attendedBy === 'all' ||
                    (order.processedBy?.toLowerCase() === filters.attendedBy.toLowerCase());

                const orderDate = order.actualCompletionDate ? new Date(order.actualCompletionDate) : null;
                const matchesDateRange = (!filters.startDate || (orderDate && orderDate >= filters.startDate)) &&
                    (!filters.endDate || (orderDate && orderDate <= filters.endDate));

                return matchesSearch && matchesPayment && matchesPaymentMethod && matchesAttendedBy && matchesDateRange;
            })
            .sort((a: JobOrder, b: JobOrder) => {
                const dateA = a.actualCompletionDate ? new Date(a.actualCompletionDate).getTime() : 0;
                const dateB = b.actualCompletionDate ? new Date(b.actualCompletionDate).getTime() : 0;
                return dateB - dateA; // Newest first
            });
    }, [orders, searchTerm, paymentFilter, filters]);

    // Pagination logic
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const paginatedOrders = filteredOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleApplyFilters = () => {
        setFilters({ ...tempFilters });
        setIsFilterModalOpen(false);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        const resetFilters = {
            paymentMethod: 'all',
            attendedBy: 'all',
            startDate: undefined,
            endDate: undefined
        };
        setTempFilters(resetFilters);
        setFilters(resetFilters);
        setPaymentFilter('all');
        setIsFilterModalOpen(false);
        setCurrentPage(1);
    };

    const handleFilterChange = (filter: 'all' | 'fully-paid' | 'downpayment') => {
        setPaymentFilter(filter);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-4">
            <Card className="shadow-lg border-gray-200 overflow-hidden gap-0">
                <CardHeader className="pt-2 pb-0 px-4 bg-white">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-center pt-4 pb-2">
                            <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-[0.1em] leading-tight p-0 m-0 text-center">
                                Claim Monitoring Record
                            </h2>
                        </div>
                        {/* Search and Filter Section */}
                        <div className="flex gap-2 mb-1 items-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/calendar')}
                                className="bg-red-600 hover:bg-red-700 text-white hover:text-white border-red-600 font-black h-9 px-3 flex-shrink-0 uppercase text-[10px] tracking-wider"
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>

                            <div className="flex-1 relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-red-600 transition-colors" />
                                <Input
                                    placeholder="Search by order number or customer name..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className="pl-10 h-8 text-[11px] border-gray-100 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-xl w-full transition-all"
                                />
                            </div>

                            <Button
                                variant="outline"
                                className={`h-9 w-9 p-0 rounded-lg transition-colors ${paymentFilter !== 'all' ||
                                    filters.paymentMethod !== 'all' ||
                                    filters.attendedBy !== 'all' ||
                                    filters.startDate ||
                                    filters.endDate
                                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                                    : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                onClick={() => {
                                    setTempFilters({ ...filters });
                                    setIsFilterModalOpen(true);
                                }}
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div>
                        <table className="w-full border-collapse min-w-[700px]">
                            <thead className="bg-red-50">
                                <tr>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider w-[150px] whitespace-nowrap text-center">Order #</th>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center w-[180px]">Customer's Name</th>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider w-[90px] whitespace-nowrap text-center">Date</th>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider w-[60px] whitespace-nowrap text-center">Pairs</th>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider w-[130px] whitespace-nowrap text-center">Payment Method</th>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider w-[150px] whitespace-nowrap text-center">Remaining Balance</th>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider w-[90px] whitespace-nowrap text-center">Fully Paid</th>
                                    <th className="border-b border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-500 uppercase tracking-wider w-[130px] whitespace-nowrap text-center">ATTENDED BY</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-xs italic">
                                            {searchTerm || paymentFilter !== 'all' ? 'No matching records found.' : 'No claimed records found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedOrders.map((order: JobOrder) => {
                                        const balance = order.grandTotal - (order.amountReceived || 0);
                                        const isFullyPaid = balance <= 0 && order.paymentStatus === 'fully-paid';
                                        const releaseDate = order.actualCompletionDate ? dateFnsFormat(new Date(order.actualCompletionDate), 'MM/dd/yy HH:mm') : '-';

                                        return (
                                            <tr key={order.id} className="hover:bg-red-50/20 transition-colors border-b border-gray-100 last:border-0">
                                                <td className="px-2 py-1.5 text-sm text-center font-bold text-gray-900 border-r border-gray-50 whitespace-nowrap">
                                                    {order.orderNumber}
                                                </td>
                                                <td className="px-2 py-1.5 text-sm font-normal text-gray-700 text-left border-r border-gray-50 uppercase">
                                                    {order.customerName}
                                                </td>
                                                <td className="px-2 py-1.5 text-sm text-center font-normal text-gray-600 border-r border-gray-50 whitespace-nowrap">
                                                    {releaseDate}
                                                </td>
                                                <td className="px-2 py-1.5 text-sm text-center font-normal text-gray-600 border-r border-gray-50">
                                                    {Array.isArray(order.baseService) ? order.baseService.length : 1}
                                                </td>
                                                <td className="px-2 py-1.5 text-sm text-center font-normal text-gray-600 uppercase border-r border-gray-50 whitespace-nowrap">
                                                    {order.paymentMethod || '-'}
                                                </td>
                                                <td className="px-2 py-1.5 text-sm text-center font-normal text-gray-700 border-r border-gray-50 whitespace-nowrap">
                                                    {balance > 0 ? (
                                                        <span className="text-red-600 font-medium">{'\u20B1'}{balance.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 text-center border-r border-gray-50">
                                                    <div className="flex justify-center">
                                                        {isFullyPaid ? (
                                                            <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200">
                                                                <Check size={10} strokeWidth={4} />
                                                            </div>
                                                        ) : (
                                                            <div className="h-4 w-4 rounded-full border border-gray-200 bg-gray-50/50"></div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-sm text-center font-normal text-gray-500 uppercase whitespace-nowrap">
                                                    {order.processedBy || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 0 && (
                        <div className="bg-white border-t border-gray-100 pt-1.5 pb-1 px-3 flex items-center justify-between">
                            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                PAGE {currentPage} OF {totalPages}
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className={`h-8 w-8 p-0 rounded-lg transition-all border-none ${currentPage === 1
                                        ? 'bg-slate-200 text-slate-500'
                                        : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                        }`}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-2 overflow-x-auto max-w-[400px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent py-0.5 pb-2 px-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                            <Button
                                                key={page}
                                                variant={currentPage === page ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(page)}
                                                className={`h-8 w-8 p-0 text-[11px] font-bold rounded-lg flex-shrink-0 transition-all ${currentPage === page
                                                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm'
                                                    : 'bg-white border-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                                                    }`}
                                            >
                                                {page}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className={`h-8 w-8 p-0 rounded-lg transition-all border-none ${currentPage === totalPages
                                        ? 'bg-slate-200 text-slate-500'
                                        : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                        }`}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Filter Modal */}
            <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
                <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-4 border-b border-gray-100 flex flex-row items-center justify-between bg-white">
                        <DialogTitle className="text-lg font-bold text-gray-900 w-full text-center">Filters</DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-6 bg-white">
                        <div className="grid grid-cols-1 gap-6">
                            {/* Filter Row 1: Selectors */}
                            <div className="grid grid-cols-3 gap-4">
                                {/* Payment Status */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Payment Status</Label>
                                    <Select
                                        value={paymentFilter}
                                        onValueChange={(value: any) => handleFilterChange(value)}
                                    >
                                        <SelectTrigger className="h-9 bg-gray-50/50 border-gray-100 focus:ring-red-100 focus:border-red-300 rounded-lg text-xs">
                                            <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="all" className="focus:bg-red-50 focus:text-red-900">All</SelectItem>
                                                <SelectItem value="fully-paid" className="focus:bg-red-50 focus:text-red-900">Paid</SelectItem>
                                                <SelectItem value="downpayment" className="focus:bg-red-50 focus:text-red-900">Unpaid</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Payment Method */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Method</Label>
                                    <Select
                                        value={tempFilters.paymentMethod}
                                        onValueChange={(value) => setTempFilters({ ...tempFilters, paymentMethod: value })}
                                    >
                                        <SelectTrigger className="h-9 bg-gray-50/50 border-gray-100 focus:ring-red-100 focus:border-red-300 rounded-lg text-xs">
                                            <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="all" className="focus:bg-red-50 focus:text-red-900">All</SelectItem>
                                                <SelectItem value="cash" className="focus:bg-red-50 focus:text-red-900">Cash</SelectItem>
                                                <SelectItem value="gcash" className="focus:bg-red-50 focus:text-red-900">GCash</SelectItem>
                                                <SelectItem value="maya" className="focus:bg-red-50 focus:text-red-900">Maya</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Attended By */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Staff</Label>
                                    <Select
                                        value={tempFilters.attendedBy}
                                        onValueChange={(value) => setTempFilters({ ...tempFilters, attendedBy: value })}
                                    >
                                        <SelectTrigger className="h-9 bg-gray-50/50 border-gray-100 focus:ring-red-100 focus:border-red-300 rounded-lg text-xs">
                                            <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="all" className="focus:bg-red-50 focus:text-red-900">All</SelectItem>
                                                <SelectItem value="owner" className="focus:bg-red-50 focus:text-red-900">Owner</SelectItem>
                                                <SelectItem value="staff" className="focus:bg-red-50 focus:text-red-900">Staff</SelectItem>
                                                <SelectItem value="staff1" className="focus:bg-red-50 focus:text-red-900">Staff 1</SelectItem>
                                                <SelectItem value="staff2" className="focus:bg-red-50 focus:text-red-900">Staff 2</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Start Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full h-9 bg-gray-50/50 border-gray-100 justify-start text-left font-normal text-xs rounded-lg",
                                                    !tempFilters.startDate && "text-gray-400"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {tempFilters.startDate ? dateFnsFormat(tempFilters.startDate, "PPP") : <span>dd/mm/yyyy</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                                            <Calendar
                                                mode="single"
                                                selected={tempFilters.startDate}
                                                onSelect={(date) => setTempFilters({ ...tempFilters, startDate: date })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-gray-700 uppercase tracking-wider">End Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full h-9 bg-gray-50/50 border-gray-100 justify-start text-left font-normal text-xs rounded-lg",
                                                    !tempFilters.endDate && "text-gray-400"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {tempFilters.endDate ? dateFnsFormat(tempFilters.endDate, "PPP") : <span>dd/mm/yyyy</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                                            <Calendar
                                                mode="single"
                                                selected={tempFilters.endDate}
                                                onSelect={(date) => setTempFilters({ ...tempFilters, endDate: date })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between gap-3">
                            <Button
                                variant="ghost"
                                onClick={handleResetFilters}
                                className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-lg"
                            >
                                Reset
                            </Button>
                            <Button
                                onClick={handleApplyFilters}
                                className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-lg shadow-md uppercase tracking-wider transition-all"
                            >
                                Apply
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}

import { useNavigate } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';
import { useServices } from '@/app/context/ServiceContext';
import { JobOrder } from '@/app/types';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { useState, useMemo, useEffect, useRef } from 'react';
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
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/app/components/ui/select";
import OrderDetailModal from '@/app/components/OrderDetailModal';

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
        } else if (digits.length === 0) {
            onChange('');
        }
    };

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isoVal = e.target.value;
        setLocalVal(toDisplay(isoVal));
        onChange(isoVal);
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
                className={`${className || ''} pr-8 text-center`}
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

export default function ClaimRecord({ user }: { user: { token: string } }) {
    useEffect(() => {
        // [OWASP A09] Security Audit: Logging view access with token context
        if (user.token) {
            console.log('[SECURITY] Claim Record accessed by authenticated session');
        }
    }, [user.token]);

    const navigate = useNavigate();
    const { orders } = useOrders();
    const { services } = useServices();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);

    const baseServices = useMemo(() => {
        return (services || []).filter(s => s.category === 'base' && s.active);
    }, [services]);

    const [filters, setFilters] = useState<{
        serviceType: string;
        priority: string;
        processedBy: string;
        paymentMethod: string;
        startDate: string;
        endDate: string;
    }>({
        serviceType: 'all',
        priority: 'all',
        processedBy: 'all',
        paymentMethod: 'all',
        startDate: '',
        endDate: ''
    });

    // Temporary filter state for the modal until "Apply" or "Reset" is clicked
    const [tempFilters, setTempFilters] = useState<{
        serviceType: string;
        priority: string;
        processedBy: string;
        paymentMethod: string;
        startDate: string;
        endDate: string;
    }>({
        serviceType: 'all',
        priority: 'all',
        processedBy: 'all',
        paymentMethod: 'all',
        startDate: '',
        endDate: ''
    });

    // Sync temp filters when modal opens
    useEffect(() => {
        if (isFilterModalOpen) {
            setTempFilters(filters);
        }
    }, [isFilterModalOpen, filters]);

    /**
     * DYNAMIC LIST: processedByOptions
     * Extracts unique usernames of all users who attended, processed, or released orders
     * (especially claimed orders) so real usernames (e.g. CHARMAINE, OWNER, STAFF, etc.)
     * are dynamically populated.
     */
    const processedByOptions = useMemo(() => {
        const userMap = new Map<string, string>(); // lowercase key -> display name
        orders.forEach((order: JobOrder) => {
            const names = [
                order.processedBy,
                order.releasedBy,
                order.claimedBy
            ];

            // Also check paymentHistory for processors
            if (Array.isArray(order.paymentHistory)) {
                order.paymentHistory.forEach(p => {
                    if (p.processedBy) names.push(p.processedBy);
                });
            }

            // Also check statusHistory for users
            if (Array.isArray((order as any).statusHistory)) {
                (order as any).statusHistory.forEach((s: any) => {
                    if (s.user) names.push(s.user);
                });
            }

            names.forEach(name => {
                if (name && typeof name === 'string') {
                    const trimmed = name.trim();
                    if (trimmed && trimmed !== '-' && trimmed.toLowerCase() !== 'all') {
                        const key = trimmed.toLowerCase();
                        if (!userMap.has(key)) {
                            userMap.set(key, trimmed.toUpperCase());
                        }
                    }
                }
            });
        });

        return Array.from(userMap.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [orders]);

    /**
     * DYNAMIC LIST: paymentMethodOptions
     * Extracts unique payment methods from orders (e.g. Cash, GCash, Maya)
     */
    const paymentMethodOptions = useMemo(() => {
        const methodMap = new Map<string, string>();
        // Default standard methods
        ['Cash', 'GCash', 'Maya'].forEach(m => {
            methodMap.set(m.toLowerCase(), m);
        });

        orders.forEach((order: JobOrder) => {
            if (order.paymentMethod) {
                const methods = order.paymentMethod.split(',').map(s => s.trim());
                methods.forEach(m => {
                    if (m && m !== '-') {
                        const key = m.toLowerCase();
                        if (!methodMap.has(key)) {
                            methodMap.set(key, m.charAt(0).toUpperCase() + m.slice(1));
                        }
                    }
                });
            }
        });

        return Array.from(methodMap.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [orders]);

    /**
     * MEMO: filteredOrders
     * Handles multi-criteria filtering matching the claim status table:
     * 1. Status: Filter for 'claimed' only.
     * 2. Search: Matches Order # or Customer Name.
     * 3. Service Type: Matches baseService.
     * 4. Priority: Matches priorityLevel.
     * 5. Processed By: Matches processedBy, releasedBy, claimedBy or history user.
     * 6. Payment Method: Matches paymentMethod.
     * 7. Start / End Date: Matches claim/completion date.
     */
    const filteredOrders = useMemo(() => {
        return orders
            .filter((order: JobOrder) => order.status === 'claimed')
            .filter((order: JobOrder) => {
                // Search filter
                const matchesSearch =
                    order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());

                // Service Type filter
                let matchesServiceType = true;
                if (filters.serviceType !== 'all') {
                    const servicesList = Array.isArray(order.baseService) ? order.baseService : [order.baseService];
                    matchesServiceType = servicesList.some(s => s === filters.serviceType);
                }

                // Priority Level filter
                const matchesPriority =
                    filters.priority === 'all' ||
                    (order.priorityLevel || '').toLowerCase() === filters.priority.toLowerCase();

                // Payment Method filter
                const matchesPaymentMethod =
                    filters.paymentMethod === 'all' ||
                    (order.paymentMethod?.toLowerCase().includes(filters.paymentMethod.toLowerCase()));

                // Processed By filter
                let matchesProcessedBy = true;
                if (filters.processedBy !== 'all') {
                    const filterUser = filters.processedBy.toLowerCase();
                    const attendant = (order.processedBy || order.releasedBy || order.claimedBy || '').trim().toLowerCase();
                    const historyUsers = Array.isArray((order as any).statusHistory)
                        ? (order as any).statusHistory.map((s: any) => (s.user || '').trim().toLowerCase())
                        : [];
                    const paymentUsers = Array.isArray(order.paymentHistory)
                        ? order.paymentHistory.map(p => (p.processedBy || '').trim().toLowerCase())
                        : [];

                    matchesProcessedBy =
                        attendant === filterUser ||
                        historyUsers.includes(filterUser) ||
                        paymentUsers.includes(filterUser);
                }

                // Date filtering (claimed date or actualCompletionDate or updatedAt/createdAt)
                let matchesDate = true;
                const claimDateStr = order.actualCompletionDate || order.updatedAt || order.createdAt;
                if (claimDateStr && (filters.startDate || filters.endDate)) {
                    const targetDate = new Date(claimDateStr);
                    if (!isNaN(targetDate.getTime())) {
                        if (filters.startDate) {
                            const start = new Date(filters.startDate);
                            start.setHours(0, 0, 0, 0);
                            if (targetDate < start) matchesDate = false;
                        }
                        if (filters.endDate) {
                            const end = new Date(filters.endDate);
                            end.setHours(23, 59, 59, 999);
                            if (targetDate > end) matchesDate = false;
                        }
                    }
                } else if (filters.startDate || filters.endDate) {
                    matchesDate = false;
                }

                return matchesSearch && matchesServiceType && matchesPriority && matchesProcessedBy && matchesPaymentMethod && matchesDate;
            })
            .sort((a: JobOrder, b: JobOrder) => {
                const dateA = a.actualCompletionDate ? new Date(a.actualCompletionDate).getTime() : 0;
                const dateB = b.actualCompletionDate ? new Date(b.actualCompletionDate).getTime() : 0;
                return dateB - dateA; // Newest first
            });
    }, [orders, searchTerm, filters]);

    /**
     * LOGIC: Pagination
     * Ensures we only render 15 items per page to maintain UI performance.
     */
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const paginatedOrders = filteredOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        const defaultFilters = {
            serviceType: 'all',
            priority: 'all',
            processedBy: 'all',
            paymentMethod: 'all',
            startDate: '',
            endDate: ''
        };
        setTempFilters(defaultFilters);
        setFilters(defaultFilters);
        setIsFilterModalOpen(false);
        setCurrentPage(1);
    };

    const handleApplyFilters = () => {
        setFilters(tempFilters);
        setIsFilterModalOpen(false);
        setCurrentPage(1);
    };

    const isFiltered =
        filters.serviceType !== 'all' ||
        filters.priority !== 'all' ||
        filters.processedBy !== 'all' ||
        filters.paymentMethod !== 'all' ||
        !!filters.startDate ||
        !!filters.endDate;

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
                                onClick={() => navigate('/release-calendar')}
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
                                className={`h-9 w-9 p-0 rounded-xl transition-colors flex-shrink-0 ${
                                    isFiltered
                                        ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                                        : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'
                                }`}
                                onClick={() => setIsFilterModalOpen(true)}
                                title="Open filters"
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full table-fixed border-collapse min-w-[700px]">
                            <colgroup>
                                <col className="w-[15%]" />
                                <col className="w-[22%]" />
                                <col className="w-[17%]" />
                                <col className="w-[8%]" />
                                <col className="w-[18%]" />
                                <col className="w-[20%]" />
                            </colgroup>
                            <thead className="bg-red-50/50">
                                <tr>
                                    <th className="border-b border-gray-200 px-2 py-2 text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap text-center">Order #</th>
                                    <th className="border-b border-gray-200 px-3 py-2 text-[10px] font-black text-gray-700 uppercase tracking-wider text-center">Customer's Name</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap text-center">Claimed Date</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap text-center">Pairs</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap text-center">Payment Method</th>
                                    <th className="border-b border-gray-200 px-2 py-2 text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap text-center">Processed By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs italic">
                                            {searchTerm || isFiltered ? 'No matching records found.' : 'No claimed records found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedOrders.map((order: JobOrder) => {
                                        const releaseDate = order.actualCompletionDate ? dateFnsFormat(new Date(order.actualCompletionDate), 'MM/dd/yy HH:mm') : '-';

                                        return (
                                            <tr key={order.id} className="hover:bg-red-50/20 transition-colors border-b border-gray-100 last:border-0 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                                <td className="px-2 py-2 text-xs text-center font-bold text-gray-900 border-r border-gray-50 whitespace-nowrap">
                                                    {order.orderNumber}
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-gray-50">
                                                    <div className="flex flex-col items-center justify-center text-center">
                                                        <div className="text-xs font-semibold text-gray-800 uppercase leading-tight truncate max-w-full" title={order.customerName}>
                                                            {order.customerName}
                                                        </div>
                                                        {order.contactNumber && (
                                                            <div className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap truncate max-w-full">{order.contactNumber}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 text-xs text-center font-medium text-gray-600 border-r border-gray-50 whitespace-nowrap">
                                                    {releaseDate}
                                                </td>
                                                <td className="px-2 py-2 text-xs text-center font-medium text-gray-600 border-r border-gray-50">
                                                    {Array.isArray(order.baseService) ? order.baseService.length : 1}
                                                </td>
                                                <td className="px-2 py-2 text-xs text-center font-medium text-gray-600 uppercase border-r border-gray-50 whitespace-nowrap">
                                                    {order.paymentMethod || '-'}
                                                </td>
                                                <td className="px-2 py-2 text-xs text-center font-medium text-gray-500 uppercase whitespace-nowrap">
                                                    {order.processedBy || order.releasedBy || order.claimedBy || '-'}
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

            {/* Filter Modal matching Claim Status Table with Processed By & Payment Method */}
            <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Filters</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Service Type */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Service Type</label>
                            <Select
                                value={tempFilters.serviceType}
                                onValueChange={(val) => setTempFilters(prev => ({ ...prev, serviceType: val }))}
                            >
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Services" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">All Services</SelectItem>
                                    {baseServices.map(service => (
                                        <SelectItem key={service.id} value={service.name} className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">
                                            {service.name.replace(' (with basic cleaning)', '')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Priority Level */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Priority Level</label>
                            <Select
                                value={tempFilters.priority}
                                onValueChange={(val) => setTempFilters(prev => ({ ...prev, priority: val }))}
                            >
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">All Priority</SelectItem>
                                    <SelectItem value="regular" className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">Regular</SelectItem>
                                    <SelectItem value="rush" className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">Rush</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Processed By */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Processed By</label>
                            <Select
                                value={tempFilters.processedBy}
                                onValueChange={(val) => setTempFilters(prev => ({ ...prev, processedBy: val }))}
                            >
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">All</SelectItem>
                                    {processedByOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Payment Method</label>
                            <Select
                                value={tempFilters.paymentMethod}
                                onValueChange={(val) => setTempFilters(prev => ({ ...prev, paymentMethod: val }))}
                            >
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">All</SelectItem>
                                    {paymentMethodOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs focus:bg-red-50 focus:text-red-700 cursor-pointer">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Start Date</label>
                            <FormattedDateInput
                                value={tempFilters.startDate}
                                onChange={(val) => setTempFilters(prev => ({ ...prev, startDate: val }))}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">End Date</label>
                            <FormattedDateInput
                                value={tempFilters.endDate}
                                onChange={(val) => setTempFilters(prev => ({ ...prev, endDate: val }))}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <Button
                            variant="ghost"
                            className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-xl"
                            onClick={handleResetFilters}
                        >
                            Reset
                        </Button>
                        <Button
                            className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-xl shadow-md uppercase tracking-wider transition-all"
                            onClick={handleApplyFilters}
                        >
                            Apply
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Modal */}
            <OrderDetailModal
                order={selectedOrder}
                open={!!selectedOrder}
                onOpenChange={(open) => !open && setSelectedOrder(null)}
            />
        </div>
    );
}

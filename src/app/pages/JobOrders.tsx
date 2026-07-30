import { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { JobOrder } from '@/app/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Search, Filter, MoreVertical, Edit, ArrowRight, RotateCcw, UserPlus, ShoppingBag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useServices } from '@/app/context/ServiceContext';
import EditOrderModal from '@/app/components/EditOrderModal';
import JobOrderFormModal from '@/app/components/JobOrderFormModal';
import ProcessClaimModal from '@/app/components/ProcessClaimModal';
import OrderDetailModal from '@/app/components/OrderDetailModal';
import { toast } from 'sonner';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';

function FormattedDateInput({ value, onChange, className, id }: { value: string; onChange: (val: string) => void; className?: string; id?: string }) {
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

    return (
        <Input
            id={id}
            type="text"
            placeholder="MM/DD/YYYY"
            value={localVal}
            onChange={handleChange}
            className={className}
        />
    );
}

interface JobOrdersProps {
    user: { username: string; role: 'owner' | 'staff'; token: string };
    onSetHeaderActionRight: (action: React.ReactNode) => void;
}

/**
 * PAGE: JobOrders
 * PURPOSE: Main directory for tracking and managing all service orders.
 * FEATURES: 
 * - Multi-criteria Filtering (Status, Service, Date)
 * - Sorting (Status Recency + Rush Priority)
 * - Bulk Actions (Assign Staff to multiple orders)
 * - Detailed Order View & Inline Editing
 */
export default function JobOrders({ user, onSetHeaderActionRight }: JobOrdersProps) {
    const { orders, loading, updateOrder, deleteOrder } = useOrders();
    const { services } = useServices();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterService, setFilterService] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
    const [processClaimOrder, setProcessClaimOrder] = useState<JobOrder | null>(null);
    const [cancelOrderModal, setCancelOrderModal] = useState<JobOrder | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [bulkStaff, setBulkStaff] = useState<string>('unassigned');

    // Set header action
    useEffect(() => {
        onSetHeaderActionRight(<JobOrderFormModal user={user} />);
        return () => onSetHeaderActionRight(null);
    }, [onSetHeaderActionRight, user]);

    // Filter logic
    const filteredOrders = orders.filter((order: JobOrder) => {
        // Status
        if (filterStatus !== 'all' && order.status !== filterStatus) return false;

        // Service
        if (filterService !== 'all' && !order.baseService.includes(filterService)) return false;

        // Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!order.customerName.toLowerCase().includes(query) &&
                !order.orderNumber.toLowerCase().includes(query)) return false;
        }

        // Date Range
        if (startDate) {
            const start = new Date(startDate);
            if (new Date(order.createdAt) < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(order.createdAt) > end) return false;
        }

        return true;
    });

    // Sort: Recently updated first (move to status moves to top), then rush, then sequence
    filteredOrders.sort((a: JobOrder, b: JobOrder) => {
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

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIdx, startIdx + itemsPerPage);

    const baseServices = services.filter(s => s.category === 'base' && s.active);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedOrderIds(paginatedOrders.map((o: JobOrder) => o.id));
        } else {
            setSelectedOrderIds([]);
        }
    };

    const handleSelectOrder = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedOrderIds(prev => [...prev, id]);
        } else {
            setSelectedOrderIds(prev => prev.filter(oid => oid !== id));
        }
    };

    const handleBulkAssign = () => {
        if (selectedOrderIds.length === 0) return;

        selectedOrderIds.forEach(id => {
            updateOrder(id, { assignedTo: bulkStaff === 'unassigned' ? undefined : bulkStaff });
        });

        toast.success(`Successfully assigned ${selectedOrderIds.length} orders to ${bulkStaff === 'unassigned' ? 'Unassigned' : bulkStaff}`);
        setSelectedOrderIds([]);
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold">Job Orders Directory</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by order # or customer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="new-order">New Order</SelectItem>
                                    <SelectItem value="on-going">On-Going</SelectItem>
                                    <SelectItem value="for-release">For Release</SelectItem>
                                    <SelectItem value="claimed">Claimed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                className={`px-3 ${filterService !== 'all' || startDate || endDate ? 'text-red-600 border-red-200 bg-red-50' : ''}`}
                                onClick={() => setIsFilterOpen(true)}
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                Filters
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-xl border">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="h-10 px-4 text-center font-medium text-gray-500 w-10">
                                        <Checkbox
                                            checked={paginatedOrders.length > 0 && selectedOrderIds.length === paginatedOrders.length}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Order #</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Customer</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Service</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Total Qty</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Status</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Priority</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Payment</th>
                                    <th className="h-10 px-4 text-right font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-20 text-center">
                                            <div className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <ShoppingBag size={48} className="text-gray-300" />
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                                                    {(() => {
                                                        if (searchQuery) return 'No matching orders found';
                                                        switch (filterStatus) {
                                                            case 'new-order': return 'No new orders found';
                                                            case 'on-going': return 'No ongoing orders found';
                                                            case 'for-release': return 'No orders for release';
                                                            case 'claimed': return 'No claimed orders found';
                                                            case 'cancelled': return 'No cancelled orders found';
                                                            default: return 'No orders found';
                                                        }
                                                    })()}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedOrders.map((order: JobOrder) => (
                                        <tr
                                            key={order.id}
                                            className={`border-b border-gray-100 hover:bg-gray-50/80 transition-all cursor-pointer ${selectedOrderIds.includes(order.id) ? 'bg-red-50/30' : ''}`}
                                            onClick={() => {
                                                setSelectedOrder(order);
                                                setIsEditing(false);
                                            }}
                                        >
                                            <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedOrderIds.includes(order.id)}
                                                    onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                                                />
                                            </td>
                                            <td className="p-4 font-medium whitespace-nowrap">{order.orderNumber}</td>
                                            <td className="p-4">
                                                <div className="font-medium text-gray-900">{order.customerName}</div>
                                                <div className="text-xs text-gray-500">{order.contactNumber}</div>
                                            </td>
                                            <td className="p-4 text-gray-600">{Array.isArray(order.baseService) ? order.baseService.join(', ') : order.baseService}</td>
                                            <td className="p-4 font-bold text-gray-700">{order.quantity || 1} {(order.quantity || 1) === 1 ? 'Pair' : 'Pairs'}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border whitespace-nowrap
                                                    ${order.status === 'new-order' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                        order.status === 'on-going' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            order.status === 'for-release' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                                'bg-gray-50 text-gray-700 border-gray-200'
                                                    }`}>
                                                    {(order.status || 'new-order').replace('-', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border whitespace-nowrap
                                                    ${order.priorityLevel === 'rush' ? 'bg-red-50 text-red-700 border-red-100' :
                                                        'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                    {order.priorityLevel || 'regular'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-xs font-bold ${order.paymentStatus === 'fully-paid' ? 'text-green-600' :
                                                    order.paymentStatus === 'downpayment' ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>
                                                    {order.paymentStatus === 'fully-paid' ? 'Fully Paid' : order.paymentStatus === 'downpayment' ? 'Downpayment' : order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
                                                        {order.status === 'new-order' && (
                                                            <>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateOrder(order.id, { status: 'on-going', updatedAt: new Date() }, user.username);
                                                                    toast.success('Order moved to on going');
                                                                }} className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100 font-bold mb-1">
                                                                    <ArrowRight className="mr-2 h-4 w-4 text-blue-600" /> Move to On-Going
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedOrder(order);
                                                                    setIsEditing(true);
                                                                }} className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold mb-1">
                                                                    <Edit className="mr-2 h-4 w-4 text-yellow-600" /> Edit Order Detail
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCancelOrderModal(order);
                                                                }} className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold mb-1">
                                                                    <AlertTriangle className="mr-2 h-4 w-4 text-red-600" /> Cancel Order
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {order.status === 'on-going' && (
                                                            <>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateOrder(order.id, { status: 'for-release', updatedAt: new Date() }, user.username);
                                                                    toast.success('Order moved to for release');
                                                                }} className="border border-orange-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100 font-bold mb-1">
                                                                    <ArrowRight className="mr-2 h-4 w-4 text-orange-600" /> Move to For Release
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateOrder(order.id, { status: 'new-order', updatedAt: new Date(), actualCompletionDate: undefined }, user.username);
                                                                    toast.success('Order reverted to new order');
                                                                }} className="border border-purple-200 rounded-md px-2.5 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 focus:text-purple-700 focus:bg-purple-100 font-bold mb-1">
                                                                    <RotateCcw className="mr-2 h-4 w-4 text-purple-500" /> Undo to New Order
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCancelOrderModal(order);
                                                                }} className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold mb-1">
                                                                    <AlertTriangle className="mr-2 h-4 w-4 text-red-600" /> Cancel Order
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {order.status === 'for-release' && (
                                                            <>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setProcessClaimOrder(order);
                                                                }} className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100 font-bold mb-1">
                                                                    <ArrowRight className="mr-2 h-4 w-4 text-blue-600" /> Process Claim
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateOrder(order.id, { status: 'on-going', updatedAt: new Date(), actualCompletionDate: undefined }, user.username);
                                                                    toast.success('Order reverted to on going');
                                                                }} className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100 font-bold mb-1">
                                                                    <RotateCcw className="mr-2 h-4 w-4 text-blue-500" /> Undo to On-Going
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {order.status === 'claimed' && (
                                                            <DropdownMenuItem onClick={(e) => {
                                                                e.stopPropagation();
                                                                const depositAmt = order.depositAmount || 0;
                                                                const paymentUpdates = (depositAmt < order.grandTotal) ? {
                                                                    paymentStatus: 'downpayment' as any,
                                                                    amountReceived: depositAmt,
                                                                    balance: order.grandTotal - depositAmt,
                                                                    change: 0
                                                                } : {};
                                                                updateOrder(order.id, {
                                                                    status: 'for-release' as any,
                                                                    updatedAt: new Date(),
                                                                    actualCompletionDate: undefined,
                                                                    ...paymentUpdates
                                                                }, user.username);
                                                                toast.success('Order reverted to for release');
                                                            }} className="border border-orange-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100 font-bold mb-1">
                                                                <RotateCcw className="mr-2 h-4 w-4 text-orange-500" /> Undo to For Release
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-500">
                            Showing {startIdx + 1} to {Math.min(startIdx + itemsPerPage, filteredOrders.length)} of {filteredOrders.length} entries
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Action Bar */}
            {selectedOrderIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 border-r pr-6">
                        <span className="bg-red-600 text-white text-xs font-black px-2 py-1 rounded-full">{selectedOrderIds.length}</span>
                        <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Selected</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Assign To</span>
                        <Select value={bulkStaff} onValueChange={setBulkStaff}>
                            <SelectTrigger className="w-[140px] h-9 bg-gray-50 border-gray-200 text-xs font-bold">
                                <SelectValue placeholder="Select Staff" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                <SelectItem value="staff">staff</SelectItem>
                                <SelectItem value="staff1">staff1</SelectItem>
                                <SelectItem value="staff2">staff2</SelectItem>
                                <SelectItem value="technician">technician</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        onClick={handleBulkAssign}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-6 rounded-full shadow-lg shadow-red-200 flex items-center gap-2"
                    >
                        <UserPlus size={16} />
                        Apply
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={() => setSelectedOrderIds([])}
                        className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                    >
                        Clear
                    </Button>
                </div>
            )}

            {/* Edit Modal */}
            {selectedOrder && (
                <EditOrderModal
                    open={isEditing}
                    onOpenChange={(open) => {
                        setIsEditing(open);
                        if (!open) setSelectedOrder(null);
                    }}
                    order={selectedOrder}
                    onSave={(id, updates) => {
                        updateOrder(id, updates, user.username);
                        setSelectedOrder((prev: any) => prev ? { ...prev, ...updates } : null);
                        setIsEditing(false);
                        toast.success('Order updated successfully');
                    }}
                />
            )}

            {/* View Modal */}
            <OrderDetailModal
                order={selectedOrder}
                open={!isEditing && !!selectedOrder}
                onOpenChange={(open) => !open && setSelectedOrder(null)}
            />

            {/* Filter Dialog */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Filter Orders</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Service Type</Label>
                            <Select value={filterService} onValueChange={setFilterService}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Services" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Services</SelectItem>
                                    {baseServices.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Date Range</Label>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                                <FormattedDateInput value={startDate} onChange={val => setStartDate(val)} />
                                <FormattedDateInput value={endDate} onChange={val => setEndDate(val)} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => {
                                setFilterService('all');
                                setStartDate('');
                                setEndDate('');
                                setIsFilterOpen(false);
                            }}>Reset</Button>
                            <Button onClick={() => setIsFilterOpen(false)}>Apply</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ProcessClaimModal
                order={processClaimOrder}
                open={!!processClaimOrder}
                onOpenChange={(open) => !open && setProcessClaimOrder(null)}
                onConfirm={(id, data) => {
                    updateOrder(id, data, user.username);
                    setProcessClaimOrder(null);
                    toast.success('Order claimed successfully');
                }}
            />

            {/* CANCEL ORDER / DYNAMIC REFUND POLICY CONFIRMATION MODAL */}
            <Dialog open={!!cancelOrderModal} onOpenChange={() => setCancelOrderModal(null)}>
                <DialogContent className="max-w-[460px] p-6 text-center rounded-2xl shadow-2xl border border-red-100 bg-white">
                    {(() => {
                        const isRefundAllowed = cancelOrderModal?.status === 'new-order';
                        return (
                            <>
                                <DialogHeader className="flex flex-col items-center gap-2">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-1 border-4 ${isRefundAllowed ? 'bg-emerald-100 border-emerald-50 text-emerald-600' : 'bg-red-100 border-red-50 text-red-600'}`}>
                                        {isRefundAllowed ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
                                    </div>
                                    <DialogTitle className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                        {isRefundAllowed ? "Confirm Cancellation & Refund" : "Confirm Order Cancellation"}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="py-4 space-y-3">
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                        Are you sure you want to cancel <span className="font-black text-red-600 text-sm">#{cancelOrderModal?.orderNumber}</span>?
                                    </p>
                                    {isRefundAllowed ? (
                                        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-left flex items-start gap-3 shadow-sm">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-black text-emerald-950 uppercase tracking-wide">Pre-Service Policy: Refund Allowed</p>
                                                <p className="text-[11px] font-semibold text-emerald-800 mt-0.5 leading-normal">
                                                    Since this job order is in 'New Order' status and treatment has not commenced, canceling will issue a FULL REFUND of paid deposits (₱{(cancelOrderModal?.amountReceived || 0).toLocaleString()} paid).
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3.5 bg-rose-50 border-2 border-rose-200 rounded-xl text-left flex items-start gap-3 shadow-sm">
                                            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-black text-rose-900 uppercase tracking-wide">Strict Policy: No Refunds</p>
                                                <p className="text-[11px] font-semibold text-rose-700 mt-0.5 leading-normal">
                                                    This job order is currently 'On-Going' (or active) and treatment has already commenced. Canceling at this stage forfeits all deposit amounts paid (₱{(cancelOrderModal?.amountReceived || 0).toLocaleString()}). Payment cannot be refunded once work has started.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 bg-gray-100 border-gray-200 text-gray-700 font-black uppercase text-xs h-10 rounded-xl hover:bg-gray-200"
                                        onClick={() => setCancelOrderModal(null)}
                                    >
                                        Do Not Cancel
                                    </Button>
                                    <Button
                                        className={`flex-1 text-white font-black uppercase text-xs h-10 rounded-xl shadow-lg ${isRefundAllowed ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                                        onClick={async () => {
                                            if (cancelOrderModal) {
                                                await deleteOrder(cancelOrderModal.id);
                                                if (cancelOrderModal.status === 'new-order') {
                                                    toast.success(`Order #${cancelOrderModal.orderNumber} cancelled. Full refund of ₱${(cancelOrderModal.amountReceived || 0).toLocaleString()} issued since service had not commenced.`);
                                                } else {
                                                    toast.error(`Order #${cancelOrderModal.orderNumber} cancelled. No refund issued per policy (service already commenced).`);
                                                }
                                                setCancelOrderModal(null);
                                            }
                                        }}
                                    >
                                        {isRefundAllowed ? "Yes, Cancel & Refund" : "Yes, Cancel (No Refund)"}
                                    </Button>
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}

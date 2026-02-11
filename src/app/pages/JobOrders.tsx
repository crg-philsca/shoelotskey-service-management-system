import { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { JobOrder } from '@/app/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Search, Filter, MoreVertical, Edit, ArrowRight, RotateCcw, User, Phone, Clock, CreditCard, Tag, MapPin, UserPlus, Calendar as CalendarIcon } from 'lucide-react';
import { format as dateFnsFormat } from 'date-fns';
import { mockServices } from '@/app/lib/mockData';
import EditOrderModal from '@/app/components/EditOrderModal';
import ServiceIntakeModal from '@/app/components/ServiceIntakeModal';
import { toast } from 'sonner';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';

interface JobOrdersProps {
    user: { username: string; role: 'owner' | 'staff' };
    onSetHeaderAction: (action: React.ReactNode) => void;
}

export default function JobOrders({ user, onSetHeaderAction }: JobOrdersProps) {
    const { orders, updateOrder } = useOrders();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterService, setFilterService] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [bulkStaff, setBulkStaff] = useState<string>('unassigned');

    // Set header action
    useEffect(() => {
        onSetHeaderAction(<ServiceIntakeModal />);
        return () => onSetHeaderAction(null);
    }, [onSetHeaderAction]);

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
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();

        const validA = !isNaN(timeA) ? timeA : 0;
        const validB = !isNaN(timeB) ? timeB : 0;

        if (validA !== validB) return validB - validA;

        // Priority Level fallback (Rush first)
        const priorityOrder = { rush: 0, premium: 1, regular: 2 };
        const priorityA = priorityOrder[a.priorityLevel as keyof typeof priorityOrder] ?? 3;
        const priorityB = priorityOrder[b.priorityLevel as keyof typeof priorityOrder] ?? 3;
        if (priorityA !== priorityB) return priorityA - priorityB;

        return b.orderNumber.localeCompare(a.orderNumber);
    });

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIdx, startIdx + itemsPerPage);

    const baseServices = mockServices.filter(s => s.category === 'base');

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
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Assigned To</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Status</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Priority</th>
                                    <th className="h-10 px-4 text-left font-medium text-gray-500">Payment</th>
                                    <th className="h-10 px-4 text-right font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="h-24 text-center text-gray-500">
                                            No orders found.
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
                                            <td className="p-4 text-gray-600">{order.baseService}</td>
                                            <td className="p-4 font-semibold text-blue-600 uppercase">{order.assignedTo || '-'}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border whitespace-nowrap
                                                    ${order.status === 'new-order' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                        order.status === 'on-going' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            order.status === 'for-release' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                                order.status === 'claimed' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                                                                    'bg-red-50 text-red-700 border-red-100'
                                                    }`}>
                                                    {order.status.replace('-', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border whitespace-nowrap
                                                    ${order.priorityLevel === 'rush' ? 'bg-red-50 text-red-700 border-red-100' :
                                                        order.priorityLevel === 'premium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                    {order.priorityLevel}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-xs font-bold ${order.paymentStatus === 'paid' ? 'text-green-600' :
                                                    order.paymentStatus === 'partial' ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>
                                                    {order.paymentStatus.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {order.status === 'new-order' && (
                                                            <DropdownMenuItem onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedOrder(order);
                                                                setIsEditing(true);
                                                            }}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                        )}
                                                        {order.status !== 'new-order' && (
                                                            <DropdownMenuItem onClick={(e) => {
                                                                e.stopPropagation();
                                                                const prevStatus =
                                                                    order.status === 'on-going' ? 'new-order' :
                                                                        order.status === 'for-release' ? 'on-going' :
                                                                            order.status === 'claimed' ? 'for-release' : null;

                                                                if (prevStatus) {
                                                                    updateOrder(order.id, {
                                                                        status: prevStatus as any,
                                                                        updatedAt: new Date(),
                                                                        actualCompletionDate: undefined
                                                                    }, user.username);
                                                                    toast.success(`Order reverted to ${prevStatus.replace('-', ' ')}`);
                                                                }
                                                            }}>
                                                                <RotateCcw className="mr-2 h-4 w-4" />
                                                                {order.status === 'on-going' ? 'Undo to New Order' :
                                                                    order.status === 'for-release' ? 'Undo to On-Going' :
                                                                        'Undo to For Release'}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {['new-order', 'on-going', 'for-release', 'claimed'].includes(order.status) && order.status !== 'claimed' && (
                                                            <DropdownMenuItem onClick={(e) => {
                                                                e.stopPropagation();
                                                                const nextStatus =
                                                                    order.status === 'new-order' ? 'on-going' :
                                                                        order.status === 'on-going' ? 'for-release' :
                                                                            order.status === 'for-release' ? 'claimed' : null;

                                                                if (nextStatus) {
                                                                    updateOrder(order.id, {
                                                                        status: nextStatus as any,
                                                                        updatedAt: new Date(),
                                                                        actualCompletionDate: nextStatus === 'claimed' ? new Date() : undefined,
                                                                        claimedBy: nextStatus === 'claimed' ? order.customerName : order.claimedBy
                                                                    }, user.username);
                                                                    toast.success(`Order moved to ${nextStatus.replace('-', ' ')}`);
                                                                }
                                                            }}>
                                                                <ArrowRight className="mr-2 h-4 w-4" /> Move Next
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
                    hideHistory={user.role === 'staff'}
                    onOpenChange={(open) => {
                        setIsEditing(open);
                        if (!open) setSelectedOrder(null);
                    }}
                    order={selectedOrder}
                    onSave={(id, updates) => {
                        updateOrder(id, updates, user.username);
                        setIsEditing(false);
                        toast.success('Order updated successfully');
                    }}
                />
            )}

            {/* View Modal (Simple version if not editing) */}
            {!isEditing && selectedOrder && (
                <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                    <DialogContent className="max-w-md bg-white">
                        <DialogHeader className="border-b border-gray-100 pb-4">
                            <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
                                Order #
                                <span className="bg-gray-100/80 px-3 py-1 rounded-full text-sm text-gray-700">{selectedOrder.orderNumber}</span>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto px-1 pr-2 no-scrollbar">
                            {/* Customer Section */}
                            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <User size={16} className="text-red-500" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Customer Details</h4>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Customer Name</Label>
                                        <p className="text-sm font-bold text-gray-800">{selectedOrder.customerName}</p>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Contact Number</Label>
                                        <div className="flex items-center gap-2">
                                            <Phone size={12} className="text-gray-400" />
                                            <p className="text-sm font-medium text-gray-600">{selectedOrder.contactNumber}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/50">
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order Date</Label>
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon size={12} className="text-gray-400" />
                                            <p className="text-sm font-medium text-gray-600">
                                                {dateFnsFormat(new Date(selectedOrder.transactionDate || selectedOrder.createdAt), 'MM/dd/yy HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Release Date</Label>
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-gray-400" />
                                            <p className="text-sm font-bold text-gray-800">
                                                {selectedOrder.predictedCompletionDate ? dateFnsFormat(new Date(selectedOrder.predictedCompletionDate), 'MM/dd/yy HH:mm') : '-'}
                                                {['for-release', 'claimed'].includes(selectedOrder.status) && selectedOrder.releaseTime && (
                                                    <span className="text-xs text-gray-500 ml-1 font-normal">
                                                        @ {selectedOrder.releaseTime}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {selectedOrder.shippingPreference === 'delivery' && (
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Delivery Address</Label>
                                        <div className="flex items-start gap-2">
                                            <MapPin size={12} className="text-gray-400 mt-0.5" />
                                            <p className="text-sm font-medium text-gray-600 leading-snug">{selectedOrder.deliveryAddress || 'No address provided'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Items Loop */}
                            <div className="space-y-4">
                                {(selectedOrder.items?.length ? selectedOrder.items : [selectedOrder]).map((item: any, index: number) => (
                                    <div key={index} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Tag size={16} className="text-red-500" />
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                                {(selectedOrder.items?.length || 0) > 1 ? `Item #${index + 1} Details` : 'Shoe & Service Details'}
                                            </h4>
                                        </div>

                                        {/* Shoe Details */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Brand</Label>
                                                <p className="text-sm font-bold text-gray-800">{item.brand || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Material</Label>
                                                <p className="text-sm font-medium text-gray-600">{item.shoeMaterial || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Quantity</Label>
                                                <p className="text-sm font-bold text-gray-800">{item.quantity || 1} Pair(s)</p>
                                            </div>
                                        </div>

                                        {/* Physical Condition */}
                                        <div className="pt-2 border-t border-gray-200/50">
                                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Physical Condition</Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(item.condition || {}).map(([key, value]) => {
                                                    if (key === 'others' && value) return <span key={key} className="px-2 py-1 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 shadow-sm">Note: {String(value)}</span>;
                                                    if (value === true) {
                                                        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                                        return <span key={key} className="px-2 py-1 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600">{label}</span>;
                                                    }
                                                    return null;
                                                })}
                                                {Object.values(item.condition || {}).every(v => !v) && <p className="text-xs text-slate-400 italic">No issues reported</p>}
                                            </div>
                                        </div>

                                        {/* Service Details for this Item */}
                                        <div className="pt-2 border-t border-gray-200/50">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Base Service</Label>
                                                    <p className="text-sm font-bold text-gray-800">
                                                        {Array.isArray(item.baseService)
                                                            ? item.baseService.map((s: string) => s.replace(' (with basic cleaning)', '')).join(', ')
                                                            : String(item.baseService).replace(' (with basic cleaning)', '')}
                                                    </p>
                                                </div>

                                                {item.addOns && item.addOns.length > 0 && (
                                                    <div>
                                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Add-ons</Label>
                                                        <div className="space-y-1">
                                                            {item.addOns.map((addon: any, idx: number) => (
                                                                <div key={idx} className="flex items-center justify-between text-sm">
                                                                    <span className="font-medium text-gray-700">• {addon.name}</span>
                                                                    <span className="text-gray-500 text-xs font-bold">x{addon.quantity}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Order Status & Priority (Global) */}
                            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3 mt-2">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order Status</Label>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border
                                            ${selectedOrder.status === 'new-order' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                selectedOrder.status === 'on-going' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    selectedOrder.status === 'for-release' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                        selectedOrder.status === 'claimed' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                                                            'bg-red-50 text-red-700 border-red-100'
                                            }`}>
                                            {selectedOrder.status.replace('-', ' ')}
                                        </span>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Priority Level</Label>
                                        {selectedOrder.priorityLevel === 'rush' ? (
                                            <span className="text-xs font-black text-red-600 uppercase">RUSH</span>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-500 capitalize">{selectedOrder.priorityLevel}</span>
                                        )}
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Assigned To</Label>
                                        <p className="text-sm font-medium text-gray-700">{selectedOrder.assignedTo || 'Unassigned'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Section */}
                            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <CreditCard size={16} className="text-red-500" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Payment Details</h4>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {selectedOrder.paymentMethod && selectedOrder.paymentStatus !== 'unpaid' && (
                                        <div>
                                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Method</Label>
                                            <p className="text-sm font-bold text-gray-800 uppercase">
                                                {selectedOrder.paymentMethod || '-'}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Payment Status</Label>
                                        <span className={`text-sm font-black uppercase ${selectedOrder.paymentStatus === 'paid' ? 'text-green-600' :
                                            selectedOrder.paymentStatus === 'partial' ? 'text-yellow-600' : 'text-red-500'
                                            }`}>
                                            {selectedOrder.paymentStatus || 'unpaid'}
                                        </span>
                                    </div>
                                    {['gcash', 'maya'].includes(selectedOrder.paymentMethod?.toLowerCase()) && (selectedOrder.paymentStatus === 'paid' || selectedOrder.paymentStatus === 'partial') && (
                                        <div className="col-span-2">
                                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Reference Number</Label>
                                            <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">{selectedOrder.referenceNo || '-'}</p>
                                        </div>
                                    )}
                                    {selectedOrder.paymentStatus !== 'unpaid' && (
                                        <>
                                            <div>
                                                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Amount Received</Label>
                                                <p className="text-sm font-bold text-gray-800">₱{(selectedOrder.amountReceived || 0).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Change</Label>
                                                <p className="text-sm font-bold text-gray-800">₱{(selectedOrder.change || 0).toFixed(2)}</p>
                                            </div>
                                        </>
                                    )}
                                    {(selectedOrder.paymentStatus === 'unpaid' || selectedOrder.paymentStatus === 'partial') && (
                                        <div>
                                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Remaining Balance</Label>
                                            <p className="text-sm font-black uppercase tracking-wider text-red-600">
                                                ₱{(selectedOrder.grandTotal - (selectedOrder.amountReceived || 0)).toFixed(2)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pricing Summary */}
                            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-2 mt-2">
                                <div className="flex justify-between items-center text-gray-600/80">
                                    <span className="text-xs font-medium uppercase tracking-wide">Base Service Fee</span>
                                    <span className="text-sm font-bold text-gray-800">₱{selectedOrder.baseServiceFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600/80">
                                    <span className="text-xs font-medium uppercase tracking-wide">Add-ons Total</span>
                                    <span className="text-sm font-bold text-gray-800">₱{selectedOrder.addOnsTotal.toFixed(2)}</span>
                                </div>
                                {selectedOrder.priorityLevel === 'rush' && (
                                    <div className="flex justify-between items-center text-gray-600/80">
                                        <span className="text-xs font-medium uppercase tracking-wide">Rush Fee</span>
                                        <span className="text-sm font-bold text-gray-800">₱{(selectedOrder.grandTotal - (selectedOrder.baseServiceFee + selectedOrder.addOnsTotal)).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-2">
                                    <span className="text-base font-black text-gray-900 uppercase tracking-tight">Grand Total</span>
                                    <span className="text-lg font-black text-red-600 tracking-tight">₱{selectedOrder.grandTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 pb-2">
                                <Button
                                    onClick={() => setIsEditing(true)}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-red-100 transition-all uppercase tracking-wider"
                                >
                                    Edit Order Detail
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

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
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
        </div>
    );
}

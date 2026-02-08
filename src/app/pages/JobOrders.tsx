import { useState, useEffect } from 'react';
import { useOrders } from '@/app/context/OrderContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Search, Filter, MoreVertical, Edit, ArrowRight, RotateCcw } from 'lucide-react';
import { mockServices } from '@/app/lib/mockData';
import EditOrderModal from '@/app/components/EditOrderModal';
import ServiceIntakeModal from '@/app/components/ServiceIntakeModal';
import { toast } from 'sonner';
import { JobOrder } from '@/app/types';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { UserPlus } from 'lucide-react';

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
    const filteredOrders = orders.filter(order => {
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
    filteredOrders.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        if (timeA !== timeB) return timeB - timeA;
        if (a.priorityLevel === 'rush' && b.priorityLevel !== 'rush') return -1;
        if (a.priorityLevel !== 'rush' && b.priorityLevel === 'rush') return 1;
        return b.orderNumber.localeCompare(a.orderNumber);
    });

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIdx, startIdx + itemsPerPage);

    const baseServices = mockServices.filter(s => s.category === 'base');

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedOrderIds(paginatedOrders.map(o => o.id));
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
                    <div className="rounded-md border">
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
                                    paginatedOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className={`border-b last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors ${selectedOrderIds.includes(order.id) ? 'bg-red-50/30' : ''}`}
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
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                ${order.status === 'new-order' ? 'bg-purple-100 text-purple-800' :
                                                        order.status === 'on-going' ? 'bg-blue-100 text-blue-800' :
                                                            order.status === 'for-release' ? 'bg-orange-100 text-orange-800' :
                                                                order.status === 'claimed' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {order.status.replace('-', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {order.priorityLevel === 'rush' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                        RUSH
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500">Std</span>
                                                )}
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
                                                                        actualCompletionDate: nextStatus === 'claimed' ? new Date() : undefined
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
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Order # {selectedOrder.orderNumber}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-xs text-gray-500 uppercase">Customer</Label>
                                <p className="font-medium">{selectedOrder.customerName}</p>
                                <p className="text-sm text-gray-600">{selectedOrder.contactNumber}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase">Service</Label>
                                    <p className="font-medium">{selectedOrder.baseService}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 uppercase">Status</Label>
                                    <p className="font-medium capitalize">{selectedOrder.status.replace('-', ' ')}</p>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500 uppercase">Notes</Label>
                                <p className="text-sm text-gray-600">{selectedOrder.condition.others || 'No notes'}</p>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={() => setIsEditing(true)}>Edit Order Detail</Button>
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

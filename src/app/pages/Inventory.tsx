import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Package, PlusCircle, PackagePlus, Search, Filter, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import RestockModal from '@/app/components/RestockModal';
import InventoryDetailModal from '@/app/components/InventoryDetailModal';
import { Switch } from '@/app/components/ui/switch';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger
} from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { toast } from 'sonner';
import { useInventory } from '@/app/context/InventoryContext';
import { useServices } from '@/app/context/ServiceContext';
import { InventoryItem } from '@/app/types';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
interface InventoryProps {
    onSetHeaderActionRight?: (action: React.ReactNode) => void;
    user: { token: string; role?: string };
}

export default function Inventory({ onSetHeaderActionRight, user }: InventoryProps) {
    const { inventoryData, addItem, updateItem, deleteItem } = useInventory();
    const { services } = useServices();
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isRestockOpen, setIsRestockOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
    
    // Filter State
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Modal/Form State
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [isCustomUnit, setIsCustomUnit] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        inventory_number: '',
        category: 'Chemicals',
        stock: 0,
        unit: 'mL',
        price: 0,
        isActive: true,
        autoDeduct: false,
        autoDeductTrigger: 'Job Started',
        triggerService: 'All',
        consumptionQty: 0,
        consumptionUnit: '',
        packageSize: 0,
        packageUnit: 'Can',
        packageQty: 0,
        lowStockThreshold: 0,
        isRetail: false,
        retailPrice: 0
    });

    useEffect(() => {
        if (user.token) {
            console.log('[SECURITY] Inventory view accessed');
        }
    }, [user.token]);

    useEffect(() => {
        if (onSetHeaderActionRight) {
            onSetHeaderActionRight(
                <div className="flex items-center gap-2">
                    {/* P1-5 FIX: POST /api/inventory/adjust (used by RestockModal) requires
                        Depends(require_role("owner")) on the backend. Previously this button
                        was shown to Staff unconditionally, letting them fill out a restock and
                        only discover it was rejected after submitting. Gate visibility to match
                        backend RBAC, same as the "New Item"/Delete controls below. */}
                    {['owner', 'admin', 'staff'].includes(user.role?.toLowerCase() || '') && (
                        <Button 
                            className="w-10 h-10 sm:w-36 flex items-center justify-center rounded-md border border-red-200 bg-white px-2 sm:px-3 py-2 hover:bg-red-50 hover:text-red-600 text-sm font-bold uppercase text-red-600 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-red-500"
                            onClick={() => setIsRestockOpen(true)}
                            title="Restock Whole Product"
                        >
                            <PackagePlus className="h-4 w-4 sm:mr-1.5 shrink-0 text-red-600" />
                            <span className="hidden sm:inline font-bold text-red-600">Restock</span>
                        </Button>
                    )}
                    {['owner', 'admin', 'staff'].includes(user.role?.toLowerCase() || '') && (
                        <Button 
                            className="w-10 h-10 sm:w-36 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                            onClick={() => {
                                setEditingItem(null);
                                setFormData({ 
                                    name: '', 
                                    inventory_number: '',
                                    category: 'Chemicals', 
                                    stock: 0, 
                                    unit: 'mL', 
                                    price: 0, 
                                    isActive: true,
                                    autoDeduct: false,
                                    autoDeductTrigger: 'on-going',
                                    triggerService: 'All',
                                    consumptionQty: 0,
                                    consumptionUnit: '',
                                    packageSize: 0,
                                    packageUnit: 'Can',
                                    packageQty: 0,
                                    lowStockThreshold: 0,
                                    isRetail: false,
                                    retailPrice: 0
                                });
                                setIsCustomCategory(false);
                                setIsCustomUnit(false);
                                setIsModalOpen(true);
                            }}
                            title="Add New Item"
                        >
                            <PlusCircle className="h-4 w-4 sm:mr-1.5 shrink-0" />
                            <span className="hidden sm:inline font-bold">New Item</span>
                        </Button>
                    )}
                </div>
            );
        }
        return () => {
            if (onSetHeaderActionRight) onSetHeaderActionRight(null);
        };
    }, [onSetHeaderActionRight, user.role, setIsRestockOpen]);
 
    const handleSaveItem = () => {
        if (!formData.name) {
            toast.error('Item name is required.');
            return;
        }
        const pkgQty = Number(formData.packageQty || 0);
        const pkgSize = Number(formData.packageSize || 0);
        
        if (!editingItem && pkgQty <= 0) {
            toast.error('Package Quantity must be greater than zero.');
            return;
        }
        if (pkgSize <= 0) {
            toast.error('Volume per Package must be greater than zero.');
            return;
        }

        const saveStock = editingItem ? Number(formData.stock || 0) : Number((pkgQty * pkgSize).toFixed(2));
        
        if (saveStock < 0) {
            toast.error('Stock quantity cannot be negative.');
            return;
        }

        const saveItemPayload = {
            id: editingItem ? editingItem.id : Date.now(),
            inventory_number: formData.inventory_number || undefined,
            name: formData.name,
            category: formData.category,
            stock: saveStock,
            unit: formData.unit || 'mL',
            price: Number(formData.price || 0),
            isActive: formData.isActive,
            auto_deduct: formData.autoDeduct,
            auto_deduct_trigger: formData.autoDeductTrigger,
            trigger_service: formData.triggerService,
            consumption_qty: Number(formData.consumptionQty || 0),
            consumption_unit: formData.consumptionUnit || (formData.unit || 'mL'),
            package_size: pkgSize,
            package_unit: formData.packageUnit || 'Can',
            low_stock_threshold: Number(formData.lowStockThreshold || 0),
            is_retail: formData.isRetail,
            retail_price: formData.isRetail ? Number(formData.retailPrice || 0) : 0
        };
 
        if (editingItem) {
            const updated = { ...editingItem, ...saveItemPayload };
            updateItem(updated);
            toast.success(`Successfully updated ${formData.name}`);
        } else {
            addItem(saveItemPayload);
            toast.success(`Successfully added ${formData.name}`);
        }
        setEditingItem(null);
        setIsModalOpen(false);
    };
 
    const handleDeleteItem = (id: number) => {
        const item = inventoryData.find((d) => d.id === id);
        if (item) {
            setDeleteTarget(item);
        }
    };

    const confirmDeleteItem = () => {
        if (deleteTarget) {
            deleteItem(deleteTarget.id);
            toast.success(`Successfully removed ${deleteTarget.name}`);
            setDeleteTarget(null);
        }
    };
 
    const handleEditItem = (item: InventoryItem) => {
        setEditingItem(item);
        const pkgSize = Number(item.package_size || (item as any).packageSize || 0);
        const stockVal = Number(item.stock || 0);
        const calcPkgQty = pkgSize > 0 ? Number((stockVal / pkgSize).toFixed(2)) : (stockVal || 0);

        setFormData({
            name: item.name,
            inventory_number: item.inventory_number || '',
            category: item.category,
            stock: stockVal,
            unit: item.unit || 'mL',
            price: item.price,
            isActive: item.isActive,
            autoDeduct: item.auto_deduct || false,
            autoDeductTrigger: item.auto_deduct_trigger === 'Job Started' ? 'on-going' : 
                               (item.auto_deduct_trigger === 'Shoe Released' ? 'for-release' : 
                               (item.auto_deduct_trigger || 'on-going')),
            triggerService: item.trigger_service || 'All',
            consumptionQty: item.consumption_qty || 0,
            consumptionUnit: item.consumption_unit || (item.unit || 'mL'),
            packageSize: pkgSize,
            packageUnit: item.package_unit || (item as any).packageUnit || 'Can',
            packageQty: calcPkgQty,
            lowStockThreshold: item.low_stock_threshold || 0,
            isRetail: item.is_retail || false,
            retailPrice: item.retail_price || 0
        });
        setIsCustomCategory(false);
        setIsCustomUnit(false);
        setIsModalOpen(true);
    };

    const filteredInventory = inventoryData.filter((item: InventoryItem) => {
        const name = item.name || '';
        const category = item.category || '';
        const inventoryNum = item.inventory_number || `INV-${item.id.toString().padStart(4, '0')}`;
        
        const matchesSearch = 
            name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inventoryNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.id.toString().includes(searchQuery);
        
        const categoryStr = (category || '').toLowerCase();
        const filterStr = categoryFilter.toLowerCase();
        const matchesCategory = categoryFilter === 'all' || categoryStr === filterStr;

        const matchesStatus = statusFilter === 'all' || statusFilter === getInventoryPresentation(item).stockStatus;
        const matchesActive = activeFilter === 'all' || 
            (activeFilter === 'active' && item.isActive) || 
            (activeFilter === 'inactive' && !item.isActive);
        
        return matchesSearch && matchesCategory && matchesStatus && matchesActive;
    });

    const uniqueCategories = new Map<string, string>();
    ['Chemical', 'Supplies', 'Tools', 'Equipment'].forEach(c => uniqueCategories.set(c.toLowerCase(), c));
    inventoryData.forEach((item: InventoryItem) => {
        if (item.category && !uniqueCategories.has(item.category.toLowerCase())) {
            uniqueCategories.set(item.category.toLowerCase(), item.category);
        }
    });
    const categories = Array.from(uniqueCategories.values());

    const totalPages = Math.ceil(filteredInventory.length / itemsPerPage) || 1;
    const paginatedInventory = filteredInventory.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const statuses = ['In Stock', 'Low Stock', 'No Stock'];

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                <Card className="border-none shadow-sm bg-white group">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Items</p>
                            <h3 className="text-2xl font-black text-gray-900 leading-tight">{inventoryData.length}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white group">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Low Stock Alert</p>
                            <h3 className="text-2xl font-black text-gray-900 leading-tight">
                                {inventoryData.filter(i => {
                                    const qty = Number(i.stock || 0);
                                    const threshold = (i.low_stock_threshold && i.low_stock_threshold > 0)
                                        ? i.low_stock_threshold
                                        : ((i.package_size && i.package_size > 0) ? i.package_size : 1);
                                    return qty <= threshold;
                                }).length}
                            </h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white group">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                            <ArrowUpRight size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Items</p>
                            <h3 className="text-2xl font-black text-gray-900 leading-tight">
                                {inventoryData.filter(i => i.isActive).length}
                            </h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-md overflow-hidden bg-white">
                <CardHeader className="pt-6 pb-0 px-6">
                    <div className="flex items-center justify-center">
                        <CardTitle className="text-center text-[15px] font-black text-gray-900 uppercase tracking-[0.1em] leading-tight p-0 m-0">Stock Inventory</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                    <div className="flex items-center gap-2 mb-3 no-print">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-red-600 transition-colors" />
                            <Input 
                                className="pl-9 h-10 w-full text-xs border-gray-100 bg-gray-50/50 rounded-xl focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600" 
                                placeholder="Search items, category..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className={`h-10 w-10 p-0 rounded-xl border-gray-100 ${(categoryFilter !== 'all' || statusFilter !== 'all' || activeFilter !== 'all') ? 'bg-red-50 text-red-600 border-red-200' : 'text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'}`}>
                                    <Filter size={18} />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-center">Filters</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-1 gap-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Category</label>
                                        <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-9 rounded-lg border-gray-100 bg-gray-50 focus:ring-2 focus:ring-red-500">
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Categories</SelectItem>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {cat.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Stock Status</label>
                                        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-9 rounded-lg border-gray-100 bg-gray-50 focus:ring-2 focus:ring-red-500">
                                                <SelectValue placeholder="Select Stock Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Stock Statuses</SelectItem>
                                                {statuses.map(status => (
                                                    <SelectItem key={status} value={status}>
                                                        {status.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Status</label>
                                        <Select value={activeFilter} onValueChange={(val) => { setActiveFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-9 rounded-lg border-gray-100 bg-gray-50 focus:ring-2 focus:ring-red-500">
                                                <SelectValue placeholder="Select Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Statuses</SelectItem>
                                                <SelectItem value="active">Active Only</SelectItem>
                                                <SelectItem value="inactive">Inactive Only</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setCategoryFilter('all');
                                            setStatusFilter('all');
                                            setActiveFilter('all');
                                            setSearchQuery('');
                                            setCurrentPage(1);
                                        }}
                                        className="flex-1 h-12 font-black text-xs border border-gray-300 bg-gray-400 hover:bg-gray-500 text-white transition-all uppercase tracking-widest rounded-xl"
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        className="bg-red-600 hover:bg-red-700 text-white font-black flex-1 h-12 text-xs uppercase tracking-widest shadow-md rounded-xl"
                                        onClick={() => setIsFilterOpen(false)}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="overflow-x-auto -mx-6">
                        <table className="w-full border-t border-gray-100">
                            <thead className="bg-red-50 border-y border-red-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-800 uppercase tracking-widest">Item Name</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-800 uppercase tracking-widest">Category</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-800 uppercase tracking-widest">Package</th>
                                    <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-800 uppercase tracking-widest">Unit Price</th>
                                    <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-800 uppercase tracking-widest">Stock Level</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-800 uppercase tracking-widest">Stock Status</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-800 uppercase tracking-widest no-print">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedInventory.map((item) => (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => setSelectedItem(item)}
                                        className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-900 leading-none">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Inventory No.: {item.inventory_number || `INV-${item.id.toString().padStart(4, '0')}`}</p>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">
                                            {item.category}
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const pres = getInventoryPresentation(item);
                                                return pres.isPackaged ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-bold text-gray-800">{pres.packageLabel.split(' (')[0]}</span>
                                                        <span className="text-[10px] text-gray-400 font-semibold">{item.package_size?.toLocaleString()} {item.unit}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-400 italic">Bulk</span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-xs text-gray-900">₱{(item.price || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            {(() => {
                                                const pres = getInventoryPresentation(item);
                                                const isLow = pres.stockStatus === 'Low Stock';
                                                const isCrit = pres.stockStatus === 'No Stock';
                                                const equivalentColor = isCrit
                                                    ? 'text-red-600'
                                                    : isLow
                                                    ? 'text-amber-600'
                                                    : pres.percentageRemaining > 75
                                                    ? 'text-blue-600'
                                                    : 'text-gray-500';
                                                const barColor = isCrit ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-blue-500';
                                                return (
                                                    <div className="flex flex-col items-end gap-1.5">
                                                        {/* Primary: raw stock */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-black text-gray-900">{(item.stock || 0).toLocaleString()}</span>
                                                            <span className="text-[10px] font-extrabold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{item.unit || ''}</span>
                                                        </div>
                                                        {pres.isPackaged && (
                                                            <>
                                                                {/* Equivalent line */}
                                                                <span className={`text-[10px] font-bold leading-tight text-right ${equivalentColor}`}>
                                                                    {pres.equivalentLabel}
                                                                </span>
                                                                {/* Mini progress bar */}
                                                                <div className="w-24 bg-gray-100 rounded-full h-1 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${barColor}`}
                                                                        style={{ width: `${Math.min(pres.progressBarValue, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {(() => {
                                                const pres = getInventoryPresentation(item);
                                                const status = pres.stockStatus;
                                                return (
                                                    <Badge className={`
                                                        ${status === 'In Stock' ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
                                                        ${status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
                                                        ${status === 'No Stock' ? 'bg-red-50 text-red-700 border-red-100' : ''}
                                                        text-[10px] font-black uppercase
                                                    `} title={pres.reorderRecommendation}>
                                                        {status}
                                                    </Badge>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Badge className={`
                                                    ${item.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}
                                                    text-[10px] font-black uppercase
                                                `}>
                                                    {item.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center no-print" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-2">
                                                {/* P1-5 FIX: PUT /api/inventory/{id} requires Depends(require_role(["owner"]))
                                                    on the backend. Previously Edit was shown to every role, letting Staff
                                                    fill out changes and only find out on Update that the save was rejected.
                                                    Gate visibility to match backend RBAC, same as Delete/New Item/Restock. */}
                                                {['owner', 'admin', 'staff'].includes(user.role?.toLowerCase() || '') && (
                                                <Button 
                                                    variant="ghost" 
                                                    className="h-8 w-8 p-0 rounded-lg border border-amber-500 text-amber-600 hover:bg-amber-50 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditItem(item);
                                                    }}
                                                >
                                                    <Edit size={14} strokeWidth={2.5} />
                                                </Button>
                                                )}
                                                {['owner', 'admin', 'staff'].includes(user.role?.toLowerCase() || '') && (
                                                    <Button 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteItem(item.id);
                                                        }}
                                                    >
                                                        <Trash2 size={14} strokeWidth={2.5} />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-2 flex items-center justify-between pt-4 pb-1 no-print">
                        <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                            PAGE {currentPage} OF {totalPages}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`h-8 w-8 p-0 rounded-lg transition-all border-none ${currentPage === 1
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
                                className={`h-8 w-8 p-0 rounded-lg transition-all border-none ${currentPage === totalPages
                                    ? 'bg-slate-200 text-slate-500'
                                    : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                    }`}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="hidden print:block mt-8 text-center border-t border-gray-200 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">End of Automated Report</p>
                        <p className="text-[9px] text-gray-300 mt-1">Generated by Shoelotskey SMS v2.0 • {new Date().toLocaleString('en-PH')}</p>
                    </div>
                </CardContent>
            </Card>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
                    <DialogHeader className="shrink-0 sticky top-0 z-10 bg-white px-6 pt-6 pb-4 border-b border-gray-100 pr-14">
                        <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                            {editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    <div className="grid gap-3 py-1">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Item Name</label>
                            <Input 
                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                placeholder="e.g. Standard Shoe Cleaner" 
                                value={formData.name}
                                onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Inventory Number</label>
                            <Input 
                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                placeholder="e.g. INV-12345 (Leave blank for auto-fallback)" 
                                value={formData.inventory_number || ''}
                                onChange={(e) => setFormData((prev: any) => ({ ...prev, inventory_number: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase text-gray-400">Category</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCustomCategory(!isCustomCategory)} 
                                        className="text-[9px] font-black text-red-600 uppercase hover:underline"
                                    >
                                        {isCustomCategory ? 'Select' : 'Add New'}
                                    </button>
                                </div>
                                {isCustomCategory ? (
                                    <Input 
                                        className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                        placeholder="New Category"
                                        value={formData.category}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, category: e.target.value }))}
                                        autoFocus
                                    />
                                ) : (
                                    <select 
                                        className="w-full h-9 rounded-lg border border-red-100 bg-white px-3 text-xs focus:ring-2 focus:ring-red-500"
                                        value={formData.category}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, category: e.target.value }))}
                                    >
                                        <option value="">(NONE / CLEAR)</option>
                                        <option value="Chemical">CHEMICAL</option>
                                        <option value="Supplies">SUPPLIES</option>
                                        <option value="Tools">TOOLS</option>
                                        <option value="Equipment">EQUIPMENT</option>
                                        {inventoryData.map(item => item.category).filter((v, i, a) => !['Chemical', 'Supplies', 'Tools', 'Equipment'].includes(v) && a.indexOf(v) === i).map(cat => (
                                            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase text-gray-400">Package Type</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCustomUnit(!isCustomUnit)} 
                                        className="text-[9px] font-black text-red-600 uppercase hover:underline"
                                    >
                                        {isCustomUnit ? 'Select' : 'Add New'}
                                    </button>
                                </div>
                                {isCustomUnit ? (
                                    <Input 
                                        className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                        placeholder="New Package Type"
                                        value={formData.packageUnit}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, packageUnit: e.target.value }))}
                                        autoFocus
                                    />
                                ) : (
                                    <select 
                                        className="w-full h-9 rounded-lg border border-red-100 bg-white px-3 text-xs focus:ring-2 focus:ring-red-500"
                                        value={formData.packageUnit}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, packageUnit: e.target.value }))}
                                    >
                                        <option value="">(NONE / CLEAR)</option>
                                        <option value="Can">CAN</option>
                                        <option value="Bottle">BOTTLE</option>
                                        <option value="Jug">JUG</option>
                                        <option value="Gallon">GALLON</option>
                                        <option value="Sachet">SACHET</option>
                                        <option value="Box">BOX</option>
                                        <option value="Tube">TUBE</option>
                                        <option value="Tub">TUB</option>
                                        <option value="Pcs">PCS</option>
                                        <option value="Pairs">PAIRS</option>
                                        {inventoryData.map(item => item.package_unit || '').filter((v, i, a) => v && !['Can', 'Bottle', 'Jug', 'Gallon', 'Sachet', 'Box', 'Tube', 'Tub', 'Pcs', 'Pairs'].includes(v) && a.indexOf(v) === i).map((unit: string) => (
                                            <option key={unit} value={unit}>{unit.toUpperCase()}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                        {editingItem ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Current Stock</label>
                                        <div className="relative">
                                            <Input
                                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs pr-12 font-bold"
                                                type="number"
                                                step="any"
                                                min="0"
                                                value={(formData.stock as any) === '' ? '' : formData.stock}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFormData((prev: any) => ({ ...prev, stock: val === '' ? '' : Math.max(0, parseFloat(val) || 0) }));
                                                }}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 uppercase font-black pointer-events-none">
                                                {formData.unit || 'mL'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase text-gray-400">
                                                Package Size ({formData.unit || 'mL'})
                                            </label>
                                            <select
                                                value={formData.unit || 'mL'}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, unit: e.target.value }))}
                                                className="text-[9px] font-black text-red-600 uppercase bg-transparent border-none p-0 focus:outline-none cursor-pointer hover:underline"
                                            >
                                                <option value="mL">mL</option>
                                                <option value="g">g</option>
                                                <option value="L">L</option>
                                                <option value="fl oz">fl oz</option>
                                                <option value="pcs">pcs</option>
                                                <option value="pairs">pairs</option>
                                            </select>
                                        </div>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                            type="number" 
                                            step="any"
                                            min="0"
                                            placeholder="e.g. 360" 
                                            value={formData.packageSize || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const pkgSize = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
                                                setFormData((prev: any) => ({ ...prev, packageSize: pkgSize }));
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Equivalent Remaining
                                        </label>
                                        <div className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs flex items-center font-bold text-gray-700 select-none">
                                            {formData.packageSize ? getInventoryPresentation(formData).compactLabel : 'N/A'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Unit Price (₱)</label>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                            type="number" 
                                            step="any"
                                            min="0"
                                            placeholder="0.00" 
                                            value={formData.price || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData((prev: any) => ({ ...prev, price: val === '' ? 0 : Math.max(0, parseFloat(val) || 0) }));
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Initial Packages ({formData.packageUnit ? `${formData.packageUnit}s` : ''})
                                        </label>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                            type="number" 
                                            step="any"
                                            min="0"
                                            placeholder="e.g. 12" 
                                            value={formData.packageQty || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const pkgQty = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
                                                const calcStock = Number((pkgQty * (formData.packageSize || 0)).toFixed(2));
                                                setFormData((prev: any) => ({ ...prev, packageQty: pkgQty, stock: calcStock }));
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase text-gray-400">
                                                Volume per Package ({formData.unit || 'mL'})
                                            </label>
                                            <select
                                                value={formData.unit || 'mL'}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, unit: e.target.value }))}
                                                className="text-[9px] font-black text-red-600 uppercase bg-transparent border-none p-0 focus:outline-none cursor-pointer hover:underline"
                                            >
                                                <option value="mL">mL</option>
                                                <option value="g">g</option>
                                                <option value="L">L</option>
                                                <option value="fl oz">fl oz</option>
                                                <option value="pcs">pcs</option>
                                                <option value="pairs">pairs</option>
                                            </select>
                                        </div>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                            type="number" 
                                            step="any"
                                            min="0"
                                            placeholder="e.g. 360" 
                                            value={formData.packageSize || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const pkgSize = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
                                                const calcStock = Number(((formData.packageQty || 0) * pkgSize).toFixed(2));
                                                setFormData((prev: any) => ({ ...prev, packageSize: pkgSize, stock: calcStock }));
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Calculated Stock & Price */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Total Stock (Calculated)
                                        </label>
                                        <div className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs flex items-center justify-between font-bold text-gray-700 select-none">
                                            <span>{(Number(formData.stock) || 0).toLocaleString()}</span>
                                            <span className="text-[10px] text-gray-400 uppercase font-black">{formData.unit || 'mL'}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Unit Price (₱)</label>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                            type="number" 
                                            step="any"
                                            min="0"
                                            placeholder="0.00" 
                                            value={formData.price || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData((prev: any) => ({ ...prev, price: val === '' ? 0 : Math.max(0, parseFloat(val) || 0) }));
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Stock Management & Behavior */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-[10px] font-black uppercase text-gray-900 tracking-widest border-b border-gray-100 pb-1">Stock Management</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400">
                                        Low Stock Threshold
                                    </label>
                                    <div className="relative">
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs pr-10" 
                                            type="number" 
                                            step="any"
                                            min="0"
                                            placeholder="e.g. 1000"
                                            value={formData.lowStockThreshold || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData((prev: any) => ({ ...prev, lowStockThreshold: val === '' ? 0 : Math.max(0, parseFloat(val) || 0) }));
                                            }}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">{formData.unit || 'mL'}</span>
                                    </div>
                                </div>
                                {editingItem && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Current Status</label>
                                        <div className="h-9 flex items-center">
                                            {Number(formData.stock) <= Number(formData.lowStockThreshold) ? (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-1 rounded shadow-sm border border-red-200">🔴 Low Stock</span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-1 rounded shadow-sm border border-emerald-200">🟢 In Stock</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Collapsible/Expandable Consumption Settings */}
                        <div className="border border-red-100/60 rounded-xl p-3 bg-red-50/20 space-y-3 mt-4">
                            <h4 className="text-[10px] font-black uppercase text-red-900 tracking-widest border-b border-red-100 pb-1.5 mb-2">Inventory Behavior</h4>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2 border-b border-red-100/50 pb-3">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="isRetailCheckbox" 
                                            className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                            checked={formData.isRetail}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setFormData((prev: any) => ({ ...prev, isRetail: checked, retailPrice: checked ? prev.retailPrice : 0 }));
                                            }}
                                        />
                                        <label htmlFor="isRetailCheckbox" className="text-[10px] font-black uppercase text-red-900 cursor-pointer select-none font-bold">
                                            Allow Item for Retail Sale
                                        </label>
                                    </div>
                                    {formData.isRetail && (
                                        <div className="pl-6 max-w-[200px]">
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0.01"
                                                    step="0.01"
                                                    className="w-full h-8 rounded-lg border border-red-200 bg-white px-3 pl-7 text-xs font-semibold focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                                    placeholder="0.00"
                                                    value={formData.retailPrice || ''}
                                                    onChange={(e) => setFormData((prev: any) => ({ ...prev, retailPrice: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                                />
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">₱</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="autoDeductCheckbox" 
                                        className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                        checked={formData.autoDeduct}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, autoDeduct: e.target.checked }))}
                                    />
                                    <label htmlFor="autoDeductCheckbox" className="text-[10px] font-black uppercase text-red-900 cursor-pointer select-none font-bold">
                                        Automatically deduct during job order
                                    </label>
                                </div>
                            </div>

                            {formData.autoDeduct && (
                                <div className="space-y-3 pt-1.5 border-t border-red-100/50">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-gray-400">Trigger Event</label>
                                            <select 
                                                className="w-full h-8 rounded-lg border border-red-100 bg-white px-2 text-xs focus:ring-2 focus:ring-red-500"
                                                value={formData.autoDeductTrigger}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, autoDeductTrigger: e.target.value }))}
                                            >
                                                <option value="on-going">On-Going</option>
                                                <option value="for-release">For Release</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-gray-400">Trigger Services (Select multiple)</label>
                                            <div className="border border-red-100 rounded-lg bg-white p-2.5 max-h-[110px] overflow-y-auto space-y-1.5 focus-within:ring-2 focus-within:ring-red-500">
                                                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none text-gray-700 hover:text-red-600 transition-colors">
                                                    <input 
                                                        type="checkbox"
                                                        className="rounded text-red-500 focus:ring-red-500 h-3.5 w-3.5 border-red-200 cursor-pointer"
                                                        checked={formData.triggerService === 'All'}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData((prev: any) => ({ ...prev, triggerService: 'All' }));
                                                            } else {
                                                                setFormData((prev: any) => ({ ...prev, triggerService: '' }));
                                                            }
                                                        }}
                                                    />
                                                    <span>All Services</span>
                                                </label>
                                                {services.map((svc: any) => {
                                                    const currentList = formData.triggerService === 'All'
                                                        ? services.map((s: any) => s.name)
                                                        : formData.triggerService.split(',').map((s: string) => s.trim()).filter(Boolean);
                                                    const isChecked = formData.triggerService === 'All' || currentList.includes(svc.name);
                                                    return (
                                                        <label key={svc.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-gray-600 hover:text-red-600 transition-colors pl-2 border-l border-red-50/50">
                                                            <input 
                                                                type="checkbox"
                                                                className="rounded text-red-500 focus:ring-red-500 h-3.5 w-3.5 border-red-200 cursor-pointer"
                                                                checked={isChecked}
                                                                disabled={formData.triggerService === 'All'}
                                                                onChange={(e) => {
                                                                    const current = formData.triggerService.split(',').map((s: string) => s.trim()).filter(Boolean);
                                                                    let next: string[];
                                                                    if (e.target.checked) {
                                                                        next = [...current, svc.name];
                                                                    } else {
                                                                        next = current.filter((s: string) => s !== svc.name);
                                                                    }
                                                                    const sortedNext = services
                                                                        .filter((s: any) => next.includes(s.name))
                                                                        .map((s: any) => s.name);
                                                                    setFormData((prev: any) => ({ ...prev, triggerService: sortedNext.join(', ') }));
                                                                }}
                                                            />
                                                            <span>{svc.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-gray-400">Consumption Per Use</label>
                                            <Input 
                                                className="h-8 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                                type="number" 
                                                step="any"
                                                placeholder="e.g. 1" 
                                                value={formData.consumptionQty || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFormData((prev: any) => ({ ...prev, consumptionQty: val === '' ? 0 : parseFloat(val) }));
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-gray-400">Consumption Unit</label>
                                            <Input 
                                                className="h-8 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                                placeholder="e.g. mL" 
                                                value={formData.consumptionUnit || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, consumptionUnit: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4 pt-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Status</label>
                            <div className="flex items-center justify-end gap-2 bg-gray-50/50 px-3 py-1.5 rounded-full border border-gray-100">
                                <Switch 
                                    checked={formData.isActive}
                                    onCheckedChange={(checked) => setFormData((prev: any) => ({ ...prev, isActive: checked }))}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                                <span className={`text-[10px] font-black uppercase w-14 text-right ${formData.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {formData.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                    </div>
                    <div className="shrink-0 sticky bottom-0 z-10 bg-white px-6 pb-6 pt-4 border-t border-gray-100 flex gap-3">
                        <Button variant="outline" className="flex-1 h-9 text-xs font-black uppercase tracking-widest border-gray-200 text-gray-700 hover:bg-gray-100" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button className="flex-1 h-9 text-xs font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white" onClick={handleSaveItem}>
                            {editingItem ? 'Update' : 'Save'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <RestockModal open={isRestockOpen} onOpenChange={setIsRestockOpen} user={JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}')} />
            
            <InventoryDetailModal
                item={selectedItem}
                open={!!selectedItem}
                onOpenChange={(open) => {
                    if (!open) setSelectedItem(null);
                }}
                /* P1-5 FIX: only offer the Edit action from the detail modal to roles the
                   backend actually allows to PUT /api/inventory/{id} (owner/admin). */
                onEdit={['owner', 'admin'].includes(user.role?.toLowerCase() || '') ? (item) => {
                    setSelectedItem(null);
                    handleEditItem(item);
                } : undefined}
            />

            {/* CUSTOM PROFESSIONAL CONFIRMATION MODAL */}
            {deleteTarget && (
                <Dialog open onOpenChange={() => setDeleteTarget(null)}>
                    <DialogContent className="max-w-sm rounded-2xl p-6 shadow-2xl border-0 bg-white">
                        <DialogHeader>
                            <DialogTitle className="font-black uppercase text-sm flex items-center gap-2 text-red-700 tracking-wider">
                                <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                                Confirm Inventory Deletion
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-gray-700 leading-relaxed py-2">
                            Are you sure you want to permanently remove <strong className="text-red-700 font-bold">"{deleteTarget.name}"</strong> from physical inventory stock? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100 w-full">
                            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-100 justify-center">
                                Cancel
                            </Button>
                            <Button onClick={confirmDeleteItem} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5">
                                <Trash2 className="h-4 w-4" />
                                Confirm Delete
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

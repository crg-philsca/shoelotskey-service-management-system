import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Package, PlusCircle, PackagePlus, Search, Filter, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Edit, Trash2, XCircle, X, ShieldCheck, Loader2, MoreVertical } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import RestockModal from '@/app/components/RestockModal';
import InventoryDetailModal from '@/app/components/InventoryDetailModal';
import { Switch } from '@/app/components/ui/switch';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription,
    DialogTrigger
} from '@/app/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { toast } from 'sonner';
import { useInventory } from '@/app/context/InventoryContext';
import { useServices } from '@/app/context/ServiceContext';
import { InventoryItem } from '@/app/types';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { formatPeso } from '@/app/lib/currency';
import { CreatableCombobox } from '@/app/components/ui/creatable-combobox';
import { CUSTOM_OPTION_KEYS } from '@/app/lib/customOptions';
interface InventoryProps {
    onSetHeaderActionRight?: (action: React.ReactNode) => void;
    user: { token: string; role?: string };
}

function formatPackageUnitPlural(unit?: string): string {
    if (!unit) return '';
    const clean = unit.trim();
    if (!clean) return '';
    const lower = clean.toLowerCase();
    if (lower === 'pcs' || lower === 'piece' || lower === 'pieces') return 'PCS';
    if (lower === 'pairs' || lower === 'pair') return 'PAIRS';
    if (lower.endsWith('box')) return `${clean}es`;
    if (lower.endsWith('s')) return clean;
    return `${clean}s`;
}

function getNextInventoryNumber(items: InventoryItem[]): string {
    let maxNum = 0;
    for (const item of items) {
        if (item.inventory_number) {
            const match = String(item.inventory_number).match(/INV-(\d+)/i);
            if (match) {
                const n = parseInt(match[1], 10);
                if (!isNaN(n) && n > maxNum) {
                    maxNum = n;
                }
            }
        }
    }
    const nextNum = maxNum + 1;
    return `INV-${String(nextNum).padStart(4, '0')}`;
}

interface InventoryFormData {
    name: string;
    inventory_number: string;
    category: string;
    stock: number | string;
    unit: string;
    price: number | string;
    isActive: boolean;
    autoDeduct: boolean;
    autoDeductTrigger: string;
    triggerService: string;
    consumptionQty: number | string;
    consumptionUnit: string;
    packageSize: number | string;
    packageUnit: string;
    packageQty: number | string;
    lowStockThreshold: number | string;
    isRetail: boolean;
    retailPrice: number | string;
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
    const [activeFilter, setActiveFilter] = useState<string>('active');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal/Form State
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSavingRef = useRef(false);

    const categoryOptions = useMemo(() => {
        const set = new Set<string>(['Chemical', 'Supplies', 'Tools', 'Equipment']);
        inventoryData.forEach(item => {
            if (item.category && item.category.trim()) set.add(item.category.trim());
        });
        return Array.from(set);
    }, [inventoryData]);

    const packageTypeOptions = useMemo(() => {
        const set = new Set<string>([
            'Can', 'Bottle', 'Box', 'Jug', 'Gallon', 'Sachet', 'Tube', 'Tub', 'Pcs', 'Pairs', 'Roll', 'Sheet', 'Pack'
        ]);
        inventoryData.forEach(item => {
            if (item.package_unit && item.package_unit.trim()) set.add(item.package_unit.trim());
        });
        return Array.from(set);
    }, [inventoryData]);

    const unitOptions = useMemo(() => {
        const set = new Set<string>([
            'mL', 'g', 'kg', 'L', 'fl oz', 'pcs', 'pairs', 'meters', 'sets', 'packs', 'rolls', 'sheets', 'tubes', 'cans', 'bottles'
        ]);
        inventoryData.forEach(item => {
            if (item.unit && item.unit.trim()) set.add(item.unit.trim());
        });
        return Array.from(set);
    }, [inventoryData]);



    const [formData, setFormData] = useState<InventoryFormData>({
        name: '',
        inventory_number: '',
        category: 'Chemicals',
        stock: 0,
        unit: 'mL',
        price: '',
        isActive: true,
        autoDeduct: false,
        autoDeductTrigger: 'Job Started',
        triggerService: 'All',
        consumptionQty: 0,
        consumptionUnit: '',
        packageSize: '',
        packageUnit: 'Can',
        packageQty: '',
        lowStockThreshold: '',
        isRetail: false,
        retailPrice: ''
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
                                const nextInv = getNextInventoryNumber(inventoryData);
                                setEditingItem(null);
                                setFormData({ 
                                    name: '', 
                                    inventory_number: nextInv,
                                    category: 'Chemicals', 
                                    stock: 0, 
                                    unit: 'mL', 
                                    price: '', 
                                    isActive: true,
                                    autoDeduct: false,
                                    autoDeductTrigger: 'on-going',
                                    triggerService: 'All',
                                    consumptionQty: 0,
                                    consumptionUnit: '',
                                    packageSize: '',
                                    packageUnit: 'Can',
                                    packageQty: '',
                                    lowStockThreshold: '',
                                    isRetail: false,
                                    retailPrice: ''
                                });
                                setIsModalOpen(true);
                                if (user.token) {
                                    fetch('/api/inventory/next-number', {
                                        headers: { Authorization: `Bearer ${user.token}` }
                                    })
                                    .then(r => r.ok ? r.json() : null)
                                    .then(data => {
                                        if (data?.next_inventory_number) {
                                            setFormData((prev: any) => ({ ...prev, inventory_number: data.next_inventory_number }));
                                        }
                                    })
                                    .catch(() => {});
                                }
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
 
    const handleSaveItem = async () => {
        if (isSavingRef.current || isSubmitting) return;

        const cleanName = (formData.name || '').trim();
        if (!cleanName) {
            toast.error('Item name is required.');
            return;
        }
        const pkgQty = formData.packageQty === '' ? 0 : Number(formData.packageQty || 0);
        const pkgSize = formData.packageSize === '' ? 0 : Number(formData.packageSize || 0);
        
        if (!editingItem && pkgQty < 0) {
            toast.error('Package Quantity cannot be negative.');
            return;
        }
        if (pkgSize < 0) {
            toast.error('Volume per Package cannot be negative.');
            return;
        }

        const saveStock = editingItem 
            ? (formData.stock === '' ? 0 : Number(formData.stock)) 
            : Number((pkgQty * (pkgSize > 0 ? pkgSize : 1)).toFixed(2));
        
        if (saveStock < 0) {
            toast.error('Stock quantity cannot be negative.');
            return;
        }

        isSavingRef.current = true;
        setIsSubmitting(true);
        try {
            const saveItemPayload = {
                id: editingItem ? editingItem.id : Date.now(),
                inventory_number: formData.inventory_number || undefined,
                name: cleanName,
                category: formData.category || 'Supplies',
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
                await updateItem(updated);
                toast.success(`Successfully updated ${cleanName}`);
                setEditingItem(null);
                setIsModalOpen(false);
            } else {
                const success = await addItem(saveItemPayload);
                if (success) {
                    toast.success(`Successfully added ${cleanName}`);
                    setEditingItem(null);
                    setIsModalOpen(false);
                }
            }
        } finally {
            isSavingRef.current = false;
            setIsSubmitting(false);
        }
    };
 
    const handleDeleteItem = (id: number) => {
        const item = inventoryData.find((d) => d.id === id);
        if (item) {
            setDeleteTarget(item);
        }
    };

    const confirmDeleteItem = () => {
        if (deleteTarget) {
            const idToDelete = deleteTarget.id;
            const nameToDelete = deleteTarget.name;
            deleteItem(idToDelete);
            toast.success(`Successfully removed ${nameToDelete}`);
            setDeleteTarget(null);

            const remaining = filteredInventory.filter(i => i.id !== idToDelete).length;
            const newTotalPages = Math.ceil(remaining / itemsPerPage) || 1;
            if (currentPage > newTotalPages) {
                setCurrentPage(newTotalPages);
            }
        }
    };
 
    const handleEditItem = (item: InventoryItem) => {
        setEditingItem(item);
        const pkgSize = Number(item.package_size || (item as any).packageSize || 0);
        const stockVal = Number(item.stock || 0);
        const calcPkgQty = pkgSize > 0 ? Number((stockVal / pkgSize).toFixed(2)) : (stockVal || 0);

        setFormData({
            name: item.name,
            inventory_number: item.inventory_number || `INV-${item.id.toString().padStart(4, '0')}`,
            category: item.category,
            stock: stockVal,
            unit: item.unit || 'mL',
            price: item.price !== undefined && item.price !== null ? Number(item.price).toFixed(2) : '0.00',
            isActive: item.isActive,
            autoDeduct: item.auto_deduct || false,
            autoDeductTrigger: item.auto_deduct_trigger === 'Job Started' ? 'on-going' : 
                               (item.auto_deduct_trigger === 'Shoe Released' ? 'for-release' : 
                               (item.auto_deduct_trigger || 'on-going')),
            triggerService: item.trigger_service || 'All',
            consumptionQty: item.consumption_qty || 0,
            consumptionUnit: item.consumption_unit || (item.unit || 'mL'),
            packageSize: pkgSize > 0 ? pkgSize : '',
            packageUnit: item.package_unit || (item as any).packageUnit || 'Can',
            packageQty: calcPkgQty,
            lowStockThreshold: item.low_stock_threshold || '',
            isRetail: item.is_retail || false,
            retailPrice: item.retail_price !== undefined && item.retail_price !== null && Number(item.retail_price) > 0 ? Number(item.retail_price).toFixed(2) : '0.00'
        });
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

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

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
            {/* Summary Row - Interactive Filter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 no-print">
                {/* Total Items (Reset filter) */}
                <Card 
                    onClick={() => { setStatusFilter('all'); setActiveFilter('active'); setCurrentPage(1); }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${statusFilter === 'all' && activeFilter === 'active' ? 'ring-2 ring-red-500 bg-red-50/20 border-red-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 transition-all">
                            <Package size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Items</p>
                            <h3 className="text-xl font-black text-gray-900 leading-tight">{inventoryData.filter(i => i.isActive).length}</h3>
                        </div>
                    </CardContent>
                </Card>

                {/* In Stock Alert Card */}
                <Card 
                    onClick={() => { setStatusFilter(statusFilter === 'In Stock' ? 'all' : 'In Stock'); setActiveFilter('all'); setCurrentPage(1); }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${statusFilter === 'In Stock' ? 'ring-2 ring-emerald-500 bg-emerald-50/20 border-emerald-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 transition-all">
                            <ArrowUpRight size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">In Stock Alert</p>
                            <h3 className="text-xl font-black text-emerald-600 leading-tight">
                                {inventoryData.filter(i => getInventoryPresentation(i).stockStatus === 'In Stock').length}
                            </h3>
                        </div>
                    </CardContent>
                </Card>

                {/* No Stock Alert Card */}
                <Card 
                    onClick={() => { setStatusFilter(statusFilter === 'No Stock' ? 'all' : 'No Stock'); setActiveFilter('all'); setCurrentPage(1); }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${statusFilter === 'No Stock' ? 'ring-2 ring-rose-500 bg-rose-50/20 border-rose-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 transition-all">
                            <XCircle size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">No Stock Alert</p>
                            <h3 className="text-xl font-black text-rose-600 leading-tight">
                                {inventoryData.filter(i => getInventoryPresentation(i).stockStatus === 'No Stock').length}
                            </h3>
                        </div>
                    </CardContent>
                </Card>

                {/* Low Stock Alert Card */}
                <Card 
                    onClick={() => { setStatusFilter(statusFilter === 'Low Stock' ? 'all' : 'Low Stock'); setActiveFilter('all'); setCurrentPage(1); }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${statusFilter === 'Low Stock' ? 'ring-2 ring-amber-500 bg-amber-50/20 border-amber-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 transition-all">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Low Stock Alert</p>
                            <h3 className="text-xl font-black text-amber-600 leading-tight">
                                {inventoryData.filter(i => getInventoryPresentation(i).stockStatus === 'Low Stock').length}
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
                            <DialogContent className="max-w-sm p-4 sm:p-5 rounded-2xl">
                                <DialogHeader className="pb-1">
                                    <DialogTitle className="text-center text-sm font-bold text-gray-900">Filter Inventory</DialogTitle>
                                    <DialogDescription className="sr-only">Filter options for inventory items by category and status</DialogDescription>
                                </DialogHeader>
                                <div className="grid grid-cols-1 gap-2.5 py-2">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Category</label>
                                        <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-8 text-xs rounded-lg border-gray-200 bg-gray-50/80 focus:ring-1 focus:ring-red-500">
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
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Stock Status</label>
                                        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-8 text-xs rounded-lg border-gray-200 bg-gray-50/80 focus:ring-1 focus:ring-red-500">
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
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Item Status</label>
                                        <Select value={activeFilter} onValueChange={(val) => { setActiveFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-8 text-xs rounded-lg border-gray-200 bg-gray-50/80 focus:ring-1 focus:ring-red-500">
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
                                <div className="flex gap-2.5 mt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setCategoryFilter('all');
                                            setStatusFilter('all');
                                            setActiveFilter('all');
                                            setSearchQuery('');
                                            setCurrentPage(1);
                                        }}
                                        className="flex-1 h-9 font-bold text-xs border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all uppercase tracking-wider rounded-lg"
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-9 text-xs uppercase tracking-wider shadow-sm rounded-lg"
                                        onClick={() => setIsFilterOpen(false)}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="overflow-x-auto w-full min-h-[380px]">
                        <table className="w-full table-fixed min-w-0 border-t border-gray-100">
                            <colgroup>
                                <col className="w-[19%]" />
                                <col className="w-[11%]" />
                                <col className="w-[11%]" />
                                <col className="w-[9%]" />
                                <col className="w-[11%]" />
                                <col className="w-[14%]" />
                                <col className="w-[10%]" />
                                <col className="w-[9%]" />
                                <col className="w-[6%]" />
                            </colgroup>
                            <thead className="bg-red-50/60 border-y border-red-100">
                                <tr>
                                    <th className="px-2 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Item Name</th>
                                    <th className="px-1.5 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Category</th>
                                    <th className="px-1.5 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Package</th>
                                    <th className="px-1.5 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Unit Price</th>
                                    <th className="px-1.5 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Retail Price</th>
                                    <th className="px-1.5 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Stock Level</th>
                                    <th className="px-1 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Stock Status</th>
                                    <th className="px-1 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                                    <th className="px-1 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap no-print">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedInventory.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <Package size={48} className="text-gray-300" />
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                                                    {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || activeFilter !== 'all'
                                                        ? 'No matching inventory items found'
                                                        : 'No inventory items available'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedInventory.map((item) => (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => setSelectedItem(item)}
                                        className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                                    >
                                        <td className="px-2 py-2 max-w-0">
                                            <div className="flex justify-center w-full">
                                              <div className="w-[180px] max-w-full text-left min-w-0">
                                                <p className="text-xs font-bold text-gray-900 leading-snug truncate" title={item.name}>{item.name}</p>
                                                <p className="text-[9.5px] text-gray-400 mt-0.5 uppercase font-semibold truncate">{item.inventory_number || `INV-${item.id.toString().padStart(4, '0')}`}</p>
                                              </div>
                                            </div>
                                        </td>
                                        <td className="px-1.5 py-2 text-center max-w-0">
                                            <span className="block text-xs font-bold text-gray-600 uppercase truncate max-w-full" title={item.category}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-1.5 py-2 text-center max-w-0">
                                            {(() => {
                                                const pres = getInventoryPresentation(item);
                                                return pres.isPackaged ? (
                                                    <div className="flex flex-col items-center justify-center text-center gap-0.5 min-w-0 max-w-full">
                                                        <span className="text-xs font-bold text-gray-800 whitespace-nowrap truncate max-w-full" title={pres.packageLabel}>
                                                            {pres.packageLabel.split(' (')[0]}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap truncate max-w-full">
                                                            {item.package_size?.toLocaleString()} {item.unit}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-400 italic">Bulk</span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-1.5 py-2 text-center font-black text-xs text-gray-900 whitespace-nowrap max-w-0">
                                            <span className="block truncate max-w-full">{formatPeso(item.price || 0)}</span>
                                        </td>
                                        <td className="px-1.5 py-2 text-center font-black text-xs whitespace-nowrap max-w-0">
                                            {Boolean(item.is_retail) && Number(item.retail_price || 0) > 0 ? (
                                                <span className="text-emerald-700 font-black block truncate max-w-full">{formatPeso(item.retail_price)}</span>
                                            ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] sm:text-[8.5px] font-extrabold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">
                                                    NOT FOR SALE
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-1.5 py-2 text-center max-w-0">
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
                                                    <div className="flex flex-col items-center justify-center gap-1 min-w-0 max-w-full">
                                                        {/* Primary: raw stock */}
                                                        <div className="flex items-center justify-center gap-1.5 max-w-full">
                                                             <span className="text-xs font-black text-gray-900 truncate">{(item.stock || 0).toLocaleString()}</span>
                                                            <span className="text-[9.5px] font-extrabold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase shrink-0">{item.unit || ''}</span>
                                                        </div>
                                                        {pres.isPackaged && (
                                                            <>
                                                                {/* Equivalent line */}
                                                                <span className={`text-[9.5px] font-bold leading-tight text-center truncate max-w-full ${equivalentColor}`} title={pres.equivalentLabel}>
                                                                    {pres.equivalentLabel}
                                                                </span>
                                                                {/* Proportion bar */}
                                                                <div className="w-16 sm:w-20 max-w-full h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
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
                                        <td className="px-1 py-2 text-center max-w-0">
                                            {(() => {
                                                const pres = getInventoryPresentation(item);
                                                const status = pres.stockStatus;
                                                return (
                                                    <Badge className={`
                                                        ${status === 'In Stock' ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
                                                        ${status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
                                                        ${status === 'No Stock' ? 'bg-red-50 text-red-700 border-red-100' : ''}
                                                        text-[9.5px] font-black uppercase whitespace-nowrap px-1.5 py-0.5
                                                    `} title={pres.reorderRecommendation}>
                                                        {status}
                                                    </Badge>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-1 py-2 text-center max-w-0">
                                            <div className="flex justify-center">
                                                <Badge className={`
                                                    ${item.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}
                                                    text-[9.5px] font-black uppercase whitespace-nowrap px-1.5 py-0.5
                                                `}>
                                                    {item.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="px-1 py-2 text-center whitespace-nowrap no-print" onClick={(e) => e.stopPropagation()}>
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
                                                <DropdownMenuContent align="end" className="w-48 p-1.5 space-y-1">
                                                    {['owner', 'admin', 'staff'].includes(user.role?.toLowerCase() || '') && (
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditItem(item);
                                                            }}
                                                            className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold cursor-pointer"
                                                        >
                                                            <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                                            Edit Item Detail
                                                        </DropdownMenuItem>
                                                    )}
                                                    {['owner', 'admin', 'staff'].includes(user.role?.toLowerCase() || '') && (
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteItem(item.id);
                                                            }}
                                                            className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold cursor-pointer"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                                                            Delete Item
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                 )))}
                            </tbody>
                        </table>
                    </div>
                    {filteredInventory.length > 0 && (
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
                    )}
                    <div className="hidden print:block mt-8 text-center border-t border-gray-200 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">End of Automated Report</p>
                        <p className="text-[9px] text-gray-300 mt-1">Generated by Shoelotskey SMS v2.0 • {new Date().toLocaleString('en-PH')}</p>
                    </div>
                </CardContent>
            </Card>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
                    <DialogHeader className="shrink-0 sticky top-0 z-10 bg-white px-4 sm:px-6 py-4 border-b border-gray-100 relative flex items-center justify-center">
                        {editingItem && (
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center">
                                {Number(formData.stock) <= 0 ? (
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md shadow-xs border border-rose-200 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" /> Out of Stock
                                    </span>
                                ) : Number(formData.stock) <= Number(formData.lowStockThreshold || (formData.packageSize || 1)) ? (
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md shadow-xs border border-amber-200 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Low Stock
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md shadow-xs border border-emerald-200 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> In Stock
                                    </span>
                                )}
                            </div>
                        )}
                        <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                            {editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}
                        </DialogTitle>
                        <DialogDescription className="sr-only">Form to configure inventory item details and stock</DialogDescription>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            aria-label="Close"
                            className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xs flex items-center justify-center flex-shrink-0 cursor-pointer outline-none"
                        >
                            <X size={16} />
                        </button>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
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
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Inventory Number</label>
                                {editingItem ? (
                                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider inline-flex items-center gap-1">
                                        <ShieldCheck size={11} className="text-slate-500" /> Verified (Read-Only)
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider inline-flex items-center gap-1">
                                        <ShieldCheck size={11} className="text-emerald-600" /> Auto-Generated (Unique)
                                    </span>
                                )}
                            </div>
                            <Input 
                                className="h-9 border-slate-200 bg-slate-50 text-slate-800 font-mono font-bold rounded-lg text-xs cursor-not-allowed select-all focus-visible:ring-0 focus-visible:border-slate-300 shadow-none" 
                                value={formData.inventory_number || ''}
                                readOnly
                                title="Auto-generated unique inventory number (read-only to prevent duplicates)"
                            />
                            <p className="text-[9.5px] text-gray-400 font-medium">
                                {editingItem 
                                    ? 'Permanent verified identifier across local and cloud database.' 
                                    : 'Automatically assigned fixed format (INV-XXXX) with guaranteed uniqueness.'}
                            </p>
                        </div>                        {/* Category and Package Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400">Category</label>
                                <CreatableCombobox
                                    options={categoryOptions}
                                    value={formData.category}
                                    onChange={(val) => setFormData((prev: any) => ({ ...prev, category: val }))}
                                    placeholder="Select or type category..."
                                    storageKey={CUSTOM_OPTION_KEYS.INVENTORY_CATEGORIES}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400">Package Type</label>
                                <CreatableCombobox
                                    options={packageTypeOptions}
                                    value={formData.packageUnit}
                                    onChange={(val) => setFormData((prev: any) => ({ ...prev, packageUnit: val }))}
                                    placeholder="Select or type packaging..."
                                    storageKey={CUSTOM_OPTION_KEYS.PACKAGE_TYPES}
                                />
                            </div>
                        </div>

                        {editingItem ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Current Stock</label>
                                        <div className="relative">
                                            <Input
                                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs pr-14 font-bold"
                                                type="text"
                                                inputMode="decimal"
                                                value={formData.stock ?? ''}
                                                onFocus={(e) => {
                                                    if (e.target.value === '0') e.target.select();
                                                }}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        setFormData((prev: any) => ({ ...prev, stock: val }));
                                                    }
                                                }}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 uppercase font-black pointer-events-none">
                                                {formData.unit || 'mL'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Unit of Measurement</label>
                                        <CreatableCombobox
                                            options={unitOptions}
                                            value={formData.unit || 'mL'}
                                            onChange={(val) => setFormData((prev: any) => ({ ...prev, unit: val }))}
                                            placeholder="Select or type unit (mL, g, pcs, pairs...)"
                                            storageKey={CUSTOM_OPTION_KEYS.INVENTORY_UNITS}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Volume / Size per Package
                                        </label>
                                        <div className="relative">
                                            <Input 
                                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold pr-14" 
                                                type="text" 
                                                inputMode="decimal" 
                                                placeholder="e.g. 360" 
                                                value={formData.packageSize === '' ? '' : formData.packageSize} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        setFormData((prev: any) => ({ ...prev, packageSize: val }));
                                                    }
                                                }}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 uppercase font-black pointer-events-none">
                                                {formData.unit || 'mL'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                            <span className="text-[9px] text-gray-400 font-bold mr-0.5">Presets:</span>
                                            {[1, 100, 250, 350, 360, 500].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setFormData((prev: any) => ({ ...prev, packageSize: val }))}
                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                                        Number(formData.packageSize) === val
                                                            ? 'bg-red-50 border-red-300 text-red-700 font-black'
                                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {val}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Equivalent Remaining
                                        </label>
                                        <div className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs flex items-center font-bold text-gray-700 select-none">
                                            {formData.packageSize ? getInventoryPresentation(formData).compactLabel : 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Unit Price (₱)</label>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold" 
                                            type="text" 
                                            inputMode="decimal"
                                            placeholder="0.00" 
                                            value={formData.price ?? ''}
                                            onFocus={(e) => {
                                                if (e.target.value === '0' || e.target.value === '0.00') e.target.select();
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setFormData((prev: any) => ({ ...prev, price: val }));
                                                }
                                            }}
                                            onBlur={() => {
                                                if (formData.price !== '' && formData.price !== undefined && formData.price !== null) {
                                                    const num = parseFloat(String(formData.price));
                                                    if (!isNaN(num)) {
                                                        setFormData((prev: any) => ({ ...prev, price: num.toFixed(2) }));
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Low Stock Threshold
                                        </label>
                                        <div className="relative">
                                            <Input 
                                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs pr-10 font-semibold" 
                                                type="text" 
                                                inputMode="decimal" 
                                                placeholder="e.g. 1000"
                                                value={formData.lowStockThreshold ?? ''}
                                                onFocus={(e) => {
                                                    if (e.target.value === '0') e.target.select();
                                                }}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        setFormData((prev: any) => ({ ...prev, lowStockThreshold: val }));
                                                    }
                                                }}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">{formData.unit || 'mL'}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Unit of Measurement
                                        </label>
                                        <CreatableCombobox
                                            options={unitOptions}
                                            value={formData.unit || 'mL'}
                                            onChange={(val) => {
                                                setFormData((prev: any) => ({ ...prev, unit: val }));
                                            }}
                                            placeholder="Select or type unit (mL, g, pcs, pairs...)"
                                            storageKey={CUSTOM_OPTION_KEYS.INVENTORY_UNITS}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Volume / Size per Package
                                        </label>
                                        <div className="relative">
                                            <Input 
                                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold pr-14" 
                                                type="text" 
                                                inputMode="decimal" 
                                                placeholder="e.g. 360" 
                                                value={formData.packageSize === '' ? '' : formData.packageSize} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        const numQty = Number(formData.packageQty || 0);
                                                        const numSize = val === '' ? 0 : (parseFloat(val) || 0);
                                                        const calcStock = Number((numQty * (numSize > 0 ? numSize : 1)).toFixed(2));
                                                        setFormData((prev: any) => ({ ...prev, packageSize: val, stock: calcStock }));
                                                    }
                                                }}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 uppercase font-black pointer-events-none">
                                                {formData.unit || 'mL'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                            <span className="text-[9px] text-gray-400 font-bold mr-0.5">Presets:</span>
                                            {[1, 100, 250, 350, 360, 500].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => {
                                                        const numQty = Number(formData.packageQty || 0);
                                                        const calcStock = Number((numQty * val).toFixed(2));
                                                        setFormData((prev: any) => ({ ...prev, packageSize: val, stock: calcStock }));
                                                    }}
                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                                        Number(formData.packageSize) === val
                                                            ? 'bg-red-50 border-red-300 text-red-700 font-black'
                                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {val}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Initial Packages {formData.packageUnit ? `(${formatPackageUnitPlural(formData.packageUnit)})` : ''}
                                        </label>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold" 
                                            type="text" 
                                            inputMode="decimal" 
                                            placeholder="e.g. 12" 
                                            value={formData.packageQty ?? ''} 
                                            onFocus={(e) => {
                                                if (e.target.value === '0') e.target.select();
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    const numQty = val === '' ? 0 : (parseFloat(val) || 0);
                                                    const numSize = Number(formData.packageSize || 0);
                                                    const calcStock = Number((numQty * (numSize > 0 ? numSize : 1)).toFixed(2));
                                                    setFormData((prev: any) => ({ ...prev, packageQty: val, stock: calcStock }));
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Unit Price (₱)</label>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold" 
                                            type="text" 
                                            inputMode="decimal" 
                                            placeholder="0.00" 
                                            value={formData.price ?? ''} 
                                            onFocus={(e) => {
                                                if (e.target.value === '0' || e.target.value === '0.00') e.target.select();
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setFormData((prev: any) => ({ ...prev, price: val }));
                                                }
                                            }}
                                            onBlur={() => {
                                                if (formData.price !== '' && formData.price !== undefined && formData.price !== null) {
                                                    const num = parseFloat(String(formData.price));
                                                    if (!isNaN(num)) {
                                                        setFormData((prev: any) => ({ ...prev, price: num.toFixed(2) }));
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Calculated Total Stock Banner */}
                                <div className="p-3 bg-gradient-to-r from-red-50/70 to-amber-50/50 rounded-xl border border-red-100/80 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-wider text-red-600/90">Total Stock in Inventory</p>
                                        <p className="text-sm font-black text-gray-900 mt-0.5">
                                            {(Number(formData.stock) || 0).toLocaleString()} <span className="text-xs font-bold text-gray-500 uppercase">{formData.unit || 'mL'}</span>
                                        </p>
                                    </div>
                                    <div className="text-right text-[10px] font-semibold text-gray-500 bg-white/80 px-2.5 py-1 rounded-lg border border-red-100">
                                        <span>{Number(formData.packageQty) || 0} {formData.packageUnit ? formatPackageUnitPlural(formData.packageUnit) : 'packages'}</span>
                                        <span className="mx-1 text-gray-300">×</span>
                                        <span>{Number(formData.packageSize) || 1} {formData.unit || 'mL'}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Stock Management & Behavior */}
                        {!editingItem && (
                            <div className="space-y-3 pt-2">
                                <h4 className="text-[10px] font-black uppercase text-gray-900 tracking-widest border-b border-gray-100 pb-1">Stock Management</h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400">
                                        Low Stock Threshold
                                    </label>
                                    <div className="relative">
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs pr-10 font-semibold" 
                                            type="text" 
                                            inputMode="decimal" 
                                            placeholder="e.g. 1000"
                                            value={formData.lowStockThreshold ?? ''}
                                            onFocus={(e) => {
                                                if (e.target.value === '0') e.target.select();
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setFormData((prev: any) => ({ ...prev, lowStockThreshold: val }));
                                                }
                                            }}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">{formData.unit || 'mL'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                                setFormData((prev: any) => ({ ...prev, isRetail: checked, retailPrice: checked ? (prev.retailPrice || '') : '' }));
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
                                                    type="text" 
                                                    inputMode="decimal"
                                                    className="w-full h-8 rounded-lg border border-red-200 bg-white px-3 pl-7 text-xs font-semibold focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                                    placeholder="0.00"
                                                    value={formData.retailPrice ?? ''}
                                                    onFocus={(e) => {
                                                        if (e.target.value === '0' || e.target.value === '0.00') e.target.select();
                                                    }}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                            setFormData((prev: any) => ({ ...prev, retailPrice: val }));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (formData.retailPrice !== '' && formData.retailPrice !== undefined && formData.retailPrice !== null) {
                                                            const num = parseFloat(String(formData.retailPrice));
                                                            if (!isNaN(num)) {
                                                                setFormData((prev: any) => ({ ...prev, retailPrice: num.toFixed(2) }));
                                                            }
                                                        }
                                                    }}
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
                    <div className="shrink-0 sticky bottom-0 z-10 bg-white px-4 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4 border-t border-gray-100 flex gap-3">
                        <Button variant="outline" className="flex-1 h-9 text-xs font-black uppercase tracking-widest border-gray-200 text-gray-700 hover:bg-gray-100" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button 
                            className="flex-1 h-9 text-xs font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5" 
                            onClick={handleSaveItem}
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {isSubmitting ? (editingItem ? 'Updating...' : 'Saving...') : (editingItem ? 'Update' : 'Save')}
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

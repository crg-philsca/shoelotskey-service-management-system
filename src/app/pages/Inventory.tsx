import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Package, PlusCircle, PackageMinus, Search, Filter, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Edit, Trash2, XCircle, X, ShieldCheck, Loader2, MoreVertical, Lock, Plus, History } from 'lucide-react';
import { API_BASE } from '@/app/lib/apiBase';
import { useState, useEffect, useMemo, useRef } from 'react';
import RestockModal from '@/app/components/RestockModal';
import UpdateStockModal from '@/app/components/UpdateStockModal';
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
import { hasPermission } from '@/app/lib/permissions';
import { toServiceCode } from '@/app/lib/businessRules';

interface InventoryProps {
    onSetHeaderActionRight?: (action: React.ReactNode) => void;
    user: { token: string; role?: string; username?: string; id?: number; permissions?: string[] };
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

    const normalizedRole = (user.role || '').toLowerCase().trim();
    const isOwnerOrAdmin = normalizedRole === 'owner' || normalizedRole === 'admin' || ((user as any)?.username || '').toLowerCase().trim() === 'admin';
    const isStaffOrAbove = ['owner', 'admin', 'staff', 'front staff'].includes(normalizedRole) || 
                           normalizedRole.includes('staff') || 
                           ((user as any)?.username || '').toLowerCase().trim() === 'front_staff';

    const canViewInventory = hasPermission(user, 'inventory.view');
    const canCreateItem = hasPermission(user, 'inventory.create_item');
    const canAddInventory = canCreateItem;
    const canAddStock = hasPermission(user, 'inventory.add_stock');
    const canUseStock = hasPermission(user, 'inventory.use_stock');
    const canAdjustBalance = hasPermission(user, 'inventory.adjust_balance');
    const canEditInventory = canUseStock || canAdjustBalance;
    const canDeactivateInventory = hasPermission(user, 'inventory.deactivate');
    const canUpdateStock = canAddStock || canUseStock || canAdjustBalance;

    // Filter out rush fee from service list for materials/stock deduction
    const eligibleServices = useMemo(() => {
        return services.filter(s => {
            const name = (s.name || '').toLowerCase();
            const cat = ((s as any).category || '').toLowerCase();
            return !name.includes('rush') && !cat.includes('rush');
        });
    }, [services]);

    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isRestockOpen, setIsRestockOpen] = useState(false);
    const [isUpdateStockOpen, setIsUpdateStockOpen] = useState(false);
    const [selectedUpdateItem, setSelectedUpdateItem] = useState<InventoryItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
    
    // Filter State
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [activeFilter, setActiveFilter] = useState<string>('active');

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (categoryFilter !== 'all') count++;
        if (statusFilter !== 'all') count++;
        if (activeFilter !== 'all') count++;
        return count;
    }, [categoryFilter, statusFilter, activeFilter]);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal/Form State
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSavingRef = useRef(false);

    // Movement History State (Owner and Admin only)
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
    const [itemLogs, setItemLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const historyLogsPerPage = 8;

    const totalHistoryPages = Math.ceil(itemLogs.length / historyLogsPerPage) || 1;
    const paginatedHistoryLogs = useMemo(() => {
        const start = (historyPage - 1) * historyLogsPerPage;
        return itemLogs.slice(start, start + historyLogsPerPage);
    }, [itemLogs, historyPage, historyLogsPerPage]);

    const handleViewItemHistory = async (item: InventoryItem) => {
        if (!isOwnerOrAdmin) return;
        setHistoryItem(item);
        setHistoryPage(1);
        setIsLoadingLogs(true);
        setItemLogs([]);
        try {
            const token = user?.token || (typeof window !== 'undefined' ? (() => {
                try {
                    const u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
                    return u?.token;
                } catch { return ''; }
            })() : '');
            const resp = await fetch(`${API_BASE}/inventory/${item.id}/logs`, {
                headers: token ? {
                    'Authorization': `Bearer ${token}`
                } : {}
            });
            if (resp.ok) {
                const data = await resp.json();
                setItemLogs(Array.isArray(data) ? data : (data.logs || []));
            } else {
                toast.error('Failed to load item movement history.');
            }
        } catch (err) {
            console.error('Error fetching inventory logs:', err);
            toast.error('Network error loading movement history.');
        } finally {
            setIsLoadingLogs(false);
        }
    };

    // Dynamic service consumption config
    interface ServiceConsumptionRow {
        service: string;
        quantity: string;
    }
    const [serviceRows, setServiceRows] = useState<ServiceConsumptionRow[]>([]);

    const categoryOptions = useMemo(() => {
        const set = new Set<string>(['Chemical', 'Supplies', 'Tools', 'Equipment', 'Paints', 'Dyes']);
        inventoryData.forEach(item => {
            if (item.category && item.category.trim()) set.add(item.category.trim());
        });
        return Array.from(set);
    }, [inventoryData]);

    const packageTypeOptions = useMemo(() => {
        const set = new Set<string>([
            'Bottle', 'Can', 'Jug', 'Box', 'Jar', 'Tube', 'Tub', 'Pcs', 'Pairs', 'Roll', 'Sheet', 'Pack', 'Gallon', 'Bucket'
        ]);
        inventoryData.forEach(item => {
            if (item.package_unit && item.package_unit.trim()) set.add(item.package_unit.trim());
        });
        return Array.from(set);
    }, [inventoryData]);

    const unitOptions = useMemo(() => {
        const set = new Set<string>([
            'mL', 'g', 'kg', 'L', 'fl oz', 'pcs', 'pairs', 'meters', 'sets', 'packs', 'rolls', 'sheets', 'tubes', 'cans', 'bottles', 'unit'
        ]);
        inventoryData.forEach(item => {
            if (item.unit && item.unit.trim()) set.add(item.unit.trim());
        });
        return Array.from(set);
    }, [inventoryData]);

    const [formData, setFormData] = useState<InventoryFormData>({
        name: '',
        inventory_number: '',
        category: 'Chemical',
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
        packageUnit: 'Bottle',
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
                    {/* Left: Update Stock (styled like View History) */}
                    {canUpdateStock && (
                        <Button 
                            className="w-10 h-10 sm:w-44 flex items-center justify-center rounded-md border border-red-200 bg-white px-2 sm:px-3 py-2 text-sm font-bold uppercase text-red-600 shadow-sm transition hover:bg-red-50 hover:text-red-600 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                            onClick={() => {
                                setSelectedUpdateItem(null);
                                setIsUpdateStockOpen(true);
                            }}
                            title="Update Stock"
                        >
                            <PackageMinus className="h-4 w-4 sm:mr-2 shrink-0 text-red-600" />
                            <span className="hidden sm:inline font-bold text-red-600">Update Stock</span>
                        </Button>
                    )}
                    {/* Right: Add Item (Owner and Admin only) */}
                    {canAddInventory && isOwnerOrAdmin && (
                        <Button 
                            className="w-10 h-10 sm:w-36 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                            onClick={() => {
                                const nextInv = getNextInventoryNumber(inventoryData);
                                setEditingItem(null);
                                setFormData({ 
                                    name: '', 
                                    inventory_number: nextInv,
                                    category: 'Chemical', 
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
                                    packageUnit: 'Bottle',
                                    packageQty: '',
                                    lowStockThreshold: '',
                                    isRetail: false,
                                    retailPrice: ''
                                });
                                setServiceRows(eligibleServices.length > 0 ? [{ service: eligibleServices[0].name, quantity: '20' }] : []);
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
                            title="New Inventory Item"
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
    }, [onSetHeaderActionRight, user.role, isStaffOrAbove, canUpdateStock, canAddInventory, inventoryData, eligibleServices]);
 
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
            toast.error('Package Size cannot be negative.');
            return;
        }

        // Current stock is strictly preserved in edit mode (managed via Update Stock).
        // In create mode, stock is calculated from initial packages * package size.
        const saveStock = editingItem 
            ? Number(editingItem.stock || 0) 
            : Number((pkgQty * (pkgSize > 0 ? pkgSize : 1)).toFixed(2));
        
        if (saveStock < 0) {
            toast.error('Stock quantity cannot be negative.');
            return;
        }

        // Format trigger_service as JSON string from dynamic rows if autoDeduct is enabled
        let triggerServiceVal = '';
        let firstConsumptionQty = 0;
        if (formData.autoDeduct) {
            const validRows = serviceRows.filter(r => {
                const sName = r.service.trim().toLowerCase();
                return sName && !sName.includes('rush') && Number(r.quantity) > 0;
            });
            if (validRows.length > 0) {
                triggerServiceVal = JSON.stringify(validRows.map(r => ({
                    service: r.service.trim(),
                    quantity: Number(r.quantity)
                })));
                firstConsumptionQty = Number(validRows[0].quantity);
            } else if (eligibleServices.length > 0) {
                triggerServiceVal = JSON.stringify([{ service: eligibleServices[0].name, quantity: 20 }]);
                firstConsumptionQty = 20;
            }
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
                auto_deduct_trigger: formData.autoDeductTrigger || 'on-going',
                trigger_service: triggerServiceVal,
                consumption_qty: firstConsumptionQty,
                consumption_unit: formData.unit || 'mL',
                package_size: pkgSize,
                package_unit: formData.packageUnit || 'Bottle',
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

        // Parse trigger_service (JSON array, JSON dict, or comma-separated legacy)
        let parsedRows: ServiceConsumptionRow[] = [];
        const ts = (item.trigger_service || '').trim();
        if (ts.startsWith('[') || ts.startsWith('{')) {
            try {
                const parsed = JSON.parse(ts);
                if (Array.isArray(parsed)) {
                    parsedRows = parsed.map((p: any) => ({
                        service: p.service || '',
                        quantity: String(p.quantity ?? p.amount ?? item.consumption_qty ?? '')
                    })).filter((p: any) => p.service);
                } else if (typeof parsed === 'object' && parsed !== null) {
                    parsedRows = Object.entries(parsed).map(([s, q]) => ({
                        service: s,
                        quantity: String(q)
                    }));
                }
            } catch {
                parsedRows = [];
            }
        } else if (ts && ts.toLowerCase() !== 'all') {
            const parts = ts.split(',').map((s: string) => s.trim()).filter(Boolean);
            parsedRows = parts.map((p: string) => ({
                service: p,
                quantity: String(item.consumption_qty || 20)
            }));
        }

        // Filter out any rush fees from parsed rows
        parsedRows = parsedRows.filter(p => !p.service.toLowerCase().includes('rush'));

        if (parsedRows.length === 0 && eligibleServices.length > 0) {
            parsedRows = [{ service: eligibleServices[0].name, quantity: String(item.consumption_qty || 20) }];
        }
        setServiceRows(parsedRows);

        setFormData({
            name: item.name,
            inventory_number: item.inventory_number || `INV-${item.id.toString().padStart(4, '0')}`,
            category: item.category,
            stock: stockVal,
            unit: item.unit || 'mL',
            price: item.price !== undefined && item.price !== null && Number(item.price) > 0 ? Number(item.price).toFixed(2) : '',
            isActive: item.isActive,
            autoDeduct: item.auto_deduct || false,
            autoDeductTrigger: item.auto_deduct_trigger === 'Job Started' ? 'on-going' : 
                               (item.auto_deduct_trigger === 'Shoe Released' ? 'for-release' : 
                               (item.auto_deduct_trigger || 'on-going')),
            triggerService: item.trigger_service || 'All',
            consumptionQty: item.consumption_qty || 0,
            consumptionUnit: item.consumption_unit || (item.unit || 'mL'),
            packageSize: pkgSize > 0 ? pkgSize : '',
            packageUnit: item.package_unit || (item as any).packageUnit || 'Bottle',
            packageQty: calcPkgQty,
            lowStockThreshold: item.low_stock_threshold || '',
            isRetail: item.is_retail || false,
            retailPrice: item.retail_price !== undefined && item.retail_price !== null && Number(item.retail_price) > 0 ? Number(item.retail_price).toFixed(2) : ''
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

    if (!canViewInventory && normalizedRole.includes('staff')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <Lock size={32} />
                </div>
                <h2 className="text-xl font-black uppercase text-gray-900 tracking-wider">Access Denied</h2>
                <p className="text-sm text-gray-600 max-w-md">
                    You do not have permission to view inventory records. Contact the Owner if you believe access is required.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Summary Row - Interactive Filter Cards (4 Grids instead of 4 rows) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 no-print">
                {/* Total Items (Reset filter) */}
                <Card 
                    role="button"
                    tabIndex={0}
                    onClick={() => { setStatusFilter('all'); setActiveFilter('active'); setCurrentPage(1); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('all'); setActiveFilter('active'); setCurrentPage(1); } }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden select-none ${statusFilter === 'all' && activeFilter === 'active' ? 'ring-2 ring-red-500 bg-red-50/25 border-red-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <div className="absolute top-0 right-0 p-2 sm:p-2.5 opacity-10 pointer-events-none">
                        <Package size={44} className="text-red-600" />
                    </div>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 transition-all shrink-0">
                            <Package size={17} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-wider truncate">Total Items</p>
                            <h3 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                                {inventoryData.filter(i => i.isActive).length}
                            </h3>
                        </div>
                    </CardContent>
                </Card>

                {/* In Stock Alert Card */}
                <Card 
                    role="button"
                    tabIndex={0}
                    onClick={() => { setStatusFilter(statusFilter === 'In Stock' ? 'all' : 'In Stock'); setActiveFilter('all'); setCurrentPage(1); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(statusFilter === 'In Stock' ? 'all' : 'In Stock'); setActiveFilter('all'); setCurrentPage(1); } }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden select-none ${statusFilter === 'In Stock' ? 'ring-2 ring-emerald-500 bg-emerald-50/25 border-emerald-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <div className="absolute top-0 right-0 p-2 sm:p-2.5 opacity-10 pointer-events-none">
                        <ArrowUpRight size={44} className="text-emerald-600" />
                    </div>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 transition-all shrink-0">
                            <ArrowUpRight size={17} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-wider truncate">In Stock Alert</p>
                            <h3 className="text-lg sm:text-xl font-black text-emerald-600 leading-tight">
                                {inventoryData.filter(i => getInventoryPresentation(i).stockStatus === 'In Stock').length}
                            </h3>
                        </div>
                    </CardContent>
                </Card>

                {/* No Stock Alert Card */}
                <Card 
                    role="button"
                    tabIndex={0}
                    onClick={() => { setStatusFilter(statusFilter === 'No Stock' ? 'all' : 'No Stock'); setActiveFilter('all'); setCurrentPage(1); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(statusFilter === 'No Stock' ? 'all' : 'No Stock'); setActiveFilter('all'); setCurrentPage(1); } }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden select-none ${statusFilter === 'No Stock' ? 'ring-2 ring-rose-500 bg-rose-50/25 border-rose-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <div className="absolute top-0 right-0 p-2 sm:p-2.5 opacity-10 pointer-events-none">
                        <XCircle size={44} className="text-rose-600" />
                    </div>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 transition-all shrink-0">
                            <XCircle size={17} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-wider truncate">No Stock Alert</p>
                            <h3 className="text-lg sm:text-xl font-black text-rose-600 leading-tight">
                                {inventoryData.filter(i => getInventoryPresentation(i).stockStatus === 'No Stock').length}
                            </h3>
                        </div>
                    </CardContent>
                </Card>

                {/* Low Stock Alert Card */}
                <Card 
                    role="button"
                    tabIndex={0}
                    onClick={() => { setStatusFilter(statusFilter === 'Low Stock' ? 'all' : 'Low Stock'); setActiveFilter('all'); setCurrentPage(1); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(statusFilter === 'Low Stock' ? 'all' : 'Low Stock'); setActiveFilter('all'); setCurrentPage(1); } }}
                    className={`border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden select-none ${statusFilter === 'Low Stock' ? 'ring-2 ring-amber-500 bg-amber-50/25 border-amber-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                >
                    <div className="absolute top-0 right-0 p-2 sm:p-2.5 opacity-10 pointer-events-none">
                        <AlertTriangle size={44} className="text-amber-600" />
                    </div>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 transition-all shrink-0">
                            <AlertTriangle size={17} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-wider truncate">Low Stock Alert</p>
                            <h3 className="text-lg sm:text-xl font-black text-amber-600 leading-tight">
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
                                <Button variant="outline" className={`relative h-10 w-10 p-0 rounded-xl border-gray-100 ${activeFilterCount > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'}`}>
                                    <Filter size={18} />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm p-4 sm:p-5 rounded-2xl">
                                <DialogHeader className="pb-1">
                                    <DialogTitle className="text-center text-sm font-bold text-gray-900">Filter Inventory</DialogTitle>
                                    <DialogDescription className="sr-only">Filter options for inventory items by category and status</DialogDescription>
                                </DialogHeader>
                                <div className="grid grid-cols-1 gap-2.5 py-2">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Category</label>
                                        <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/80 focus:ring-1 focus:ring-red-500">
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat} value={cat} className="text-xs">
                                                        {cat.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Stock Status</label>
                                        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/80 focus:ring-1 focus:ring-red-500">
                                                <SelectValue placeholder="Select Stock Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all" className="text-xs">All Stock Statuses</SelectItem>
                                                {statuses.map(status => (
                                                    <SelectItem key={status} value={status} className="text-xs">
                                                        {status.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Item Status</label>
                                        <Select value={activeFilter} onValueChange={(val) => { setActiveFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-9 text-xs rounded-lg border-gray-200 bg-gray-50/80 focus:ring-1 focus:ring-red-500">
                                                <SelectValue placeholder="Select Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                                                <SelectItem value="active" className="text-xs">Active Only</SelectItem>
                                                <SelectItem value="inactive" className="text-xs">Inactive Only</SelectItem>
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

                    <div className="overflow-x-auto overflow-y-auto w-full max-h-[435px] xl:max-h-[460px] subtle-vertical-scroll border border-gray-100 rounded-lg pb-1">
                        <table className="w-full table-fixed min-w-[950px] border-t border-gray-100">
                            <colgroup>
                                <col className={isOwnerOrAdmin ? "w-[19%]" : "w-[24%]"} />
                                <col className={isOwnerOrAdmin ? "w-[11%]" : "w-[13%]"} />
                                <col className={isOwnerOrAdmin ? "w-[11%]" : "w-[13%]"} />
                                {isOwnerOrAdmin && <col className="w-[9%]" />}
                                <col className={isOwnerOrAdmin ? "w-[11%]" : "w-[12%]"} />
                                <col className={isOwnerOrAdmin ? "w-[14%]" : "w-[14%]"} />
                                <col className={isOwnerOrAdmin ? "w-[10%]" : "w-[10%]"} />
                                <col className={isOwnerOrAdmin ? "w-[9%]" : "w-[9%]"} />
                                <col className={isOwnerOrAdmin ? "w-[6%]" : "w-[5%]"} />
                            </colgroup>
                            <thead className="bg-red-50/95 backdrop-blur-xs border-y border-red-100 sticky top-0 z-10 shadow-xs">
                                <tr>
                                    <th className="px-2 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Item Name</th>
                                    <th className="px-1.5 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Category</th>
                                    <th className="px-1.5 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Package</th>
                                    {isOwnerOrAdmin && (
                                        <th className="px-1.5 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Unit Price</th>
                                    )}
                                    <th className="px-1.5 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Retail Price</th>
                                    <th className="px-1.5 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Stock Level</th>
                                    <th className="px-1 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Stock Status</th>
                                    <th className="px-1 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                                    <th className="px-1 py-2 text-center text-[11px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap no-print">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedInventory.length === 0 ? (
                                    <tr>
                                        <td colSpan={isOwnerOrAdmin ? 9 : 8} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <Package size={48} className="text-gray-600" />
                                                <p className="text-sm font-black text-gray-600 uppercase tracking-[0.2em]">
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
                                                <p className="text-[11px] text-gray-600 mt-0.5 uppercase font-semibold truncate">{item.inventory_number || `INV-${item.id.toString().padStart(4, '0')}`}</p>
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
                                                const pkgUnit = String(item.package_unit || (item as any).packageUnit || '').trim();
                                                const pkgSize = Number(item.package_size ?? (item as any).packageSize ?? 0);
                                                const unitStr = String(item.unit || (item as any).stockUnit || '').trim();

                                                if (pkgUnit || pres.isPackaged) {
                                                    const displayLabel = pkgUnit || pres.packageLabel.split(' (')[0];
                                                    return (
                                                        <div className="flex flex-col items-center justify-center text-center gap-0.5 min-w-0 max-w-full">
                                                            <span className="text-xs font-bold text-gray-800 whitespace-nowrap truncate max-w-full" title={displayLabel}>
                                                                {displayLabel}
                                                            </span>
                                                            {pkgSize > 0 && unitStr && (
                                                                <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap truncate max-w-full">
                                                                    {pkgSize.toLocaleString()} {unitStr}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                if (pkgSize > 0 && unitStr) {
                                                    return (
                                                        <div className="flex flex-col items-center justify-center text-center gap-0.5 min-w-0 max-w-full">
                                                            <span className="text-xs font-bold text-gray-800 whitespace-nowrap truncate max-w-full">
                                                                {pkgSize.toLocaleString()} {unitStr}
                                                            </span>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <span className="text-xs font-bold text-gray-400">—</span>
                                                );
                                            })()}
                                        </td>
                                        {isOwnerOrAdmin && (
                                            <td className="px-1.5 py-2 text-center font-black text-xs text-gray-900 whitespace-nowrap max-w-0">
                                                <span className="block truncate max-w-full">{formatPeso(item.price || 0)}</span>
                                            </td>
                                        )}
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
                                                        {/* Equivalent line / breakdown */}
                                                        {pres.isPackaged ? (
                                                            <span className={`text-[9.5px] font-bold leading-tight text-center truncate max-w-full ${equivalentColor}`} title={pres.equivalentLabel}>
                                                                {pres.equivalentLabel}
                                                            </span>
                                                        ) : (
                                                            <span className={`text-[9.5px] font-bold leading-tight text-center truncate max-w-full ${equivalentColor}`} title={pres.currentQuantityLabel}>
                                                                {pres.stockStatus}
                                                            </span>
                                                        )}
                                                        {/* Proportion bar */}
                                                        <div className="w-16 sm:w-20 max-w-full h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                            <div
                                                                className={`h-full rounded-full ${barColor}`}
                                                                style={{ width: `${Math.min(pres.progressBarValue, 100)}%` }}
                                                            />
                                                        </div>
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
                                                        className="h-7 w-7 p-0 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-md inline-flex items-center justify-center cursor-pointer transition-colors" 
                                                        title="More actions"
                                                        aria-label="More actions"
                                                    >
                                                        <MoreVertical className="h-3.5 w-3.5 text-red-500" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44 p-1.5 space-y-1">
                                                    {canEditInventory && (
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditItem(item);
                                                            }}
                                                            className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold cursor-pointer"
                                                        >
                                                            <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                                            Edit Item
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canUpdateStock && (
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedUpdateItem(item);
                                                                setIsUpdateStockOpen(true);
                                                            }}
                                                            className="border border-green-200 rounded-md px-2.5 py-1.5 text-green-700 bg-green-50 hover:bg-green-100 focus:text-green-800 focus:bg-green-100 font-bold cursor-pointer"
                                                        >
                                                            <PackageMinus className="h-4 w-4 mr-2 text-green-600" />
                                                            Update Stock
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canDeactivateInventory && (
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
                    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 sm:px-6 py-4">
                        <div className="space-y-4 py-1">
                            {/* ① Item Information */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                                    <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">1</div>
                                    <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">Item Information</h3>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-gray-500">
                                        Item Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input 
                                        className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-medium" 
                                        placeholder="e.g. Angelus Leather Paint White" 
                                        value={formData.name}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Inventory Number</label>
                                        {editingItem ? (
                                            <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider inline-flex items-center gap-1">
                                                <ShieldCheck size={11} className="text-slate-500" /> Verified (Read-Only)
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider inline-flex items-center gap-1">
                                                <ShieldCheck size={11} className="text-emerald-600" /> Auto-Generated
                                            </span>
                                        )}
                                    </div>
                                    <Input 
                                        className="h-9 border-slate-200 bg-slate-50 text-slate-800 font-mono font-bold rounded-lg text-xs cursor-not-allowed select-all focus-visible:ring-0 focus-visible:border-slate-300 shadow-none" 
                                        value={formData.inventory_number || ''}
                                        readOnly
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-500">Category</label>
                                        <CreatableCombobox
                                            options={categoryOptions}
                                            value={formData.category}
                                            onChange={(val) => setFormData((prev: any) => ({ ...prev, category: val }))}
                                            placeholder="e.g. Paints, Chemical..."
                                            storageKey={CUSTOM_OPTION_KEYS.INVENTORY_CATEGORIES}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-500">Package</label>
                                        <CreatableCombobox
                                            options={packageTypeOptions}
                                            value={formData.packageUnit}
                                            onChange={(val) => setFormData((prev: any) => ({ ...prev, packageUnit: val }))}
                                            placeholder="e.g. Bottle, Jug, Box..."
                                            storageKey={CUSTOM_OPTION_KEYS.PACKAGE_TYPES}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-500">Package Size</label>
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold" 
                                            type="text" 
                                            inputMode="decimal" 
                                            placeholder="e.g. 90" 
                                            value={formData.packageSize === '' ? '' : formData.packageSize} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setFormData((prev: any) => ({ ...prev, packageSize: val }));
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-500">Stock Unit</label>
                                        <CreatableCombobox
                                            options={unitOptions}
                                            value={formData.unit || 'mL'}
                                            onChange={(val) => setFormData((prev: any) => ({ ...prev, unit: val }))}
                                            placeholder="e.g. mL, g, pcs..."
                                            storageKey={CUSTOM_OPTION_KEYS.INVENTORY_UNITS}
                                        />
                                    </div>
                                </div>

                                {/* Stock Measurement readout */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                                    <span>Stock is measured in</span>
                                    <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-xs">
                                        {formData.unit || 'mL'}
                                    </span>
                                </div>

                                {/* Stock Display: Read-only in Edit, Initial packages in Create */}
                                {editingItem ? (
                                    <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Current Stock</label>
                                            <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider inline-flex items-center gap-1">
                                                <Lock size={11} className="text-slate-400" /> Read-Only
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                className="h-9 border-slate-200 bg-white text-slate-800 font-mono font-bold rounded-lg text-xs cursor-not-allowed select-all"
                                                value={`${Number(formData.stock).toLocaleString()} ${formData.unit || 'mL'}`}
                                                readOnly
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-9 px-3 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 rounded-lg flex items-center gap-1.5 shrink-0"
                                                onClick={() => {
                                                    setSelectedUpdateItem(editingItem);
                                                    setIsModalOpen(false);
                                                    setIsUpdateStockOpen(true);
                                                }}
                                                title="Adjust stock balance, record purchase, or use stock"
                                            >
                                                <PackageMinus className="h-3.5 w-3.5 text-emerald-600" />
                                                Update Stock
                                            </Button>
                                        </div>
                                        <p className="text-[9.5px] text-gray-500 font-medium">
                                            🔒 Managed through Update Stock to record audited changes.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 p-3 bg-red-50/40 rounded-xl border border-red-100">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-gray-600">
                                                Initial Stock ({formData.packageUnit ? formatPackageUnitPlural(formData.packageUnit) : 'Packages'})
                                            </label>
                                            <Input 
                                                className="h-9 border-red-100 bg-white focus:border-red-500 rounded-lg text-xs font-semibold" 
                                                type="text" 
                                                inputMode="decimal" 
                                                placeholder="e.g. 2" 
                                                value={formData.packageQty ?? ''} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        setFormData((prev: any) => ({ ...prev, packageQty: val }));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1.5 flex flex-col justify-end">
                                            <label className="text-[10px] font-black uppercase text-gray-600">Calculated Stock</label>
                                            <div className="h-9 rounded-lg border border-red-100 bg-white px-3 text-xs flex items-center font-bold text-gray-800">
                                                {(Number(formData.packageQty || 0) * (Number(formData.packageSize) || 1)).toLocaleString()} {formData.unit || 'mL'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-gray-500">Low Stock Threshold</label>
                                    <div className="relative">
                                        <Input 
                                            className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs pr-12 font-semibold" 
                                            type="text" 
                                            inputMode="decimal" 
                                            placeholder="e.g. 100" 
                                            value={formData.lowStockThreshold ?? ''} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setFormData((prev: any) => ({ ...prev, lowStockThreshold: val }));
                                                }
                                            }}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">
                                            {formData.unit || 'mL'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ② Pricing */}
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                                    <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">2</div>
                                    <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">Pricing</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-gray-500">
                                            Purchase Price (per {formData.packageUnit || 'Package'})
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₱</span>
                                            <Input 
                                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold pl-7" 
                                                type="text" 
                                                inputMode="decimal" 
                                                placeholder="0.00" 
                                                value={formData.price ?? ''} 
                                                onFocus={(e) => {
                                                    e.target.select();
                                                    if (formData.price === '0.00' || formData.price === '0') {
                                                        setFormData((prev: any) => ({ ...prev, price: '' }));
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    let val = e.target.value;
                                                    if (val.startsWith('0.00') && val.length > 4) {
                                                        val = val.slice(4);
                                                    } else if (val.startsWith('0') && val.length > 1 && !val.startsWith('0.')) {
                                                        val = val.replace(/^0+/, '');
                                                    }
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        setFormData((prev: any) => ({ ...prev, price: val }));
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (formData.price !== '' && formData.price !== undefined && formData.price !== null) {
                                                        const num = parseFloat(String(formData.price));
                                                        if (!isNaN(num) && num > 0) {
                                                            setFormData((prev: any) => ({ ...prev, price: num.toFixed(2) }));
                                                        } else if (num === 0) {
                                                            setFormData((prev: any) => ({ ...prev, price: '0.00' }));
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="isRetailCheckbox" className="text-[10px] font-black uppercase text-gray-500 cursor-pointer">
                                                Retail Sale
                                            </label>
                                            <div className="flex items-center gap-1.5">
                                                <input 
                                                    type="checkbox" 
                                                    id="isRetailCheckbox" 
                                                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                                    checked={formData.isRetail}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setFormData((prev: any) => ({ ...prev, isRetail: checked, retailPrice: checked ? (prev.retailPrice && prev.retailPrice !== '0.00' ? prev.retailPrice : '') : '' }));
                                                    }}
                                                />
                                                <label htmlFor="isRetailCheckbox" className="text-[10px] font-bold text-gray-600 cursor-pointer select-none">
                                                    Available for Retail
                                                </label>
                                            </div>
                                        </div>
                                        {formData.isRetail ? (
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₱</span>
                                                <Input 
                                                    className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold pl-7" 
                                                    type="text" 
                                                    inputMode="decimal" 
                                                    placeholder="Selling Price (0.00)" 
                                                    value={formData.retailPrice ?? ''} 
                                                    onFocus={(e) => {
                                                        e.target.select();
                                                        if (formData.retailPrice === '0.00' || formData.retailPrice === '0') {
                                                            setFormData((prev: any) => ({ ...prev, retailPrice: '' }));
                                                        }
                                                    }}
                                                    onChange={(e) => {
                                                        let val = e.target.value;
                                                        if (val.startsWith('0.00') && val.length > 4) {
                                                            val = val.slice(4);
                                                        } else if (val.startsWith('0') && val.length > 1 && !val.startsWith('0.')) {
                                                            val = val.replace(/^0+/, '');
                                                        }
                                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                            setFormData((prev: any) => ({ ...prev, retailPrice: val }));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (formData.retailPrice !== '' && formData.retailPrice !== undefined && formData.retailPrice !== null) {
                                                            const num = parseFloat(String(formData.retailPrice));
                                                            if (!isNaN(num) && num > 0) {
                                                                setFormData((prev: any) => ({ ...prev, retailPrice: num.toFixed(2) }));
                                                            } else if (num === 0) {
                                                                setFormData((prev: any) => ({ ...prev, retailPrice: '0.00' }));
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-9 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 text-xs flex items-center text-gray-400 select-none">
                                                Not sold as retail
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ③ Automatic Stock Usage */}
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                                    <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">3</div>
                                    <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">Automatic Stock Usage</h3>
                                </div>

                                <div className="border border-red-100 rounded-xl p-3 bg-red-50/20 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="autoDeductCheckbox" 
                                            className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                            checked={formData.autoDeduct}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setFormData((prev: any) => ({ ...prev, autoDeduct: checked }));
                                                if (checked && serviceRows.length === 0 && eligibleServices.length > 0) {
                                                    setServiceRows([{ service: eligibleServices[0].name, quantity: '20' }]);
                                                }
                                            }}
                                        />
                                        <label htmlFor="autoDeductCheckbox" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                                            Automatically deduct when used in a job order
                                        </label>
                                    </div>

                                    {formData.autoDeduct && (
                                        <div className="space-y-3 pt-2 border-t border-red-100/60">
                                            <p className="text-[10px] text-gray-500 font-medium">
                                                Configure which services deduct this item and the quantity consumed per order:
                                            </p>

                                            <div className="space-y-2">
                                                {serviceRows.map((row, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-red-100 shadow-xs">
                                                        <select
                                                            className="flex-1 h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs font-medium focus:ring-1 focus:ring-red-500 focus:bg-white"
                                                            value={row.service}
                                                            onChange={(e) => {
                                                                const updated = [...serviceRows];
                                                                updated[idx].service = e.target.value;
                                                                setServiceRows(updated);
                                                            }}
                                                        >
                                                            {eligibleServices.map(s => (
                                                                <option key={s.id} value={s.name}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                        <div className="relative w-28">
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                min="0"
                                                                className="h-8 text-xs font-semibold pr-10"
                                                                placeholder="Qty"
                                                                value={row.quantity}
                                                                onChange={(e) => {
                                                                    const updated = [...serviceRows];
                                                                    updated[idx].quantity = e.target.value;
                                                                    setServiceRows(updated);
                                                                }}
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">
                                                                {formData.unit || 'mL'}
                                                            </span>
                                                        </div>
                                                        {serviceRows.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                                                                onClick={() => {
                                                                    setServiceRows(serviceRows.filter((_, i) => i !== idx));
                                                                }}
                                                            >
                                                                <Trash2 size={13} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                                                    onClick={() => {
                                                        const available = eligibleServices.find(s => !serviceRows.some(r => r.service === s.name));
                                                        setServiceRows([...serviceRows, { service: available?.name || eligibleServices[0]?.name || '', quantity: '20' }]);
                                                    }}
                                                >
                                                    <Plus size={12} /> Add Service
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <label className="text-[10px] font-black uppercase text-gray-400">Item Status</label>
                                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
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
            
            <UpdateStockModal 
                open={isUpdateStockOpen} 
                onOpenChange={setIsUpdateStockOpen} 
                initialItem={selectedUpdateItem} 
                user={user} 
            />
            
            <InventoryDetailModal
                item={selectedItem}
                open={!!selectedItem}
                onOpenChange={(open) => {
                    if (!open) setSelectedItem(null);
                }}
                user={user}
                onOpenHistory={isOwnerOrAdmin ? (item) => {
                    setSelectedItem(null);
                    handleViewItemHistory(item);
                } : undefined}
                /* Offer the Edit action to authorized staff roles with edit permission */
                onEdit={canEditInventory ? (item) => {
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

            {/* ITEM MOVEMENT HISTORY DIALOG (Owner and Admin only) */}
            {isOwnerOrAdmin && (
                <Dialog open={!!historyItem} onOpenChange={(open) => { if (!open) setHistoryItem(null); }}>
                    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
                        <DialogHeader className="pb-3 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className="text-base font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                        <History className="h-5 w-5 text-red-600" />
                                        Movement History: {historyItem?.name}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-gray-500 mt-0.5">
                                        {historyItem?.inventory_number || `INV-${historyItem?.id}`} • Current Stock: {historyItem?.stock} {historyItem?.unit}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto min-h-0 py-3 visible-vertical-scroll">
                            {isLoadingLogs ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-red-600" />
                                    <span className="text-xs font-bold">Loading movement history...</span>
                                </div>
                            ) : itemLogs.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold uppercase tracking-wider">No movement records found for this item.</p>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-2xs">
                                    <table className="w-full text-left text-xs min-w-[580px]">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-600 tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2.5 whitespace-nowrap">Date & Time</th>
                                                <th className="px-3 py-2.5 text-center whitespace-nowrap">Action</th>
                                                <th className="px-3 py-2.5 text-right whitespace-nowrap">Change</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap min-w-[150px]">Reference</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap">Logged By</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {paginatedHistoryLogs.map((log) => {
                                                const isPositive = Number(log.change_amount) > 0;
                                                const isSetBalance = log.action_type === 'set_balance';
                                                const actionLabel = isSetBalance ? 'Manual Stock Adjustment' : log.action_type.replace('_', ' ');
                                                const actionColor = 
                                                    log.action_type === 'restock' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    log.action_type === 'auto_deduct' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    isSetBalance ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    'bg-rose-50 text-rose-700 border-rose-200';
                                                
                                                return (
                                                    <tr key={log.log_id} className="hover:bg-gray-50/60 transition-colors">
                                                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-[11px] font-medium">{log.created_at || '—'}</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase border ${actionColor}`}>
                                                                {actionLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right whitespace-nowrap font-black">
                                                            <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                                                                {isPositive ? `+${log.change_amount}` : log.change_amount} {historyItem?.unit}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-700 text-[11px] whitespace-nowrap min-w-[150px]">
                                                            {(() => {
                                                                let orderNum = '';
                                                                if (log.order_number) {
                                                                    orderNum = String(log.order_number).trim();
                                                                } else if (log.order_id) {
                                                                    orderNum = `ORD-${log.order_id}`;
                                                                } else if (log.execution_ref && /^ORD-/i.test(log.execution_ref)) {
                                                                    const m = log.execution_ref.match(/^(ORD-[A-Za-z0-9-]+?)(?:_ITEM|_SVC|$)/i);
                                                                    if (m) orderNum = m[1];
                                                                }

                                                                if (orderNum) {
                                                                    const cleanNum = orderNum
                                                                        .replace(/^Order\s*#?/i, '')
                                                                        .replace(/^#\s*Order\s*/i, '')
                                                                        .replace(/^#+/, '')
                                                                        .trim();

                                                                    return (
                                                                        <span className="font-mono font-bold text-gray-900 text-xs whitespace-nowrap inline-block">
                                                                            {cleanNum}
                                                                        </span>
                                                                    );
                                                                }

                                                                if (log.execution_ref) {
                                                                    return (
                                                                        <span className="font-mono text-[10px] text-gray-500 whitespace-nowrap block truncate max-w-[200px]" title={log.execution_ref}>
                                                                            {log.execution_ref}
                                                                        </span>
                                                                    );
                                                                }

                                                                return <span className="text-gray-400 whitespace-nowrap">Manual / Adjustment</span>;
                                                            })()}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600 text-[11px] font-medium whitespace-nowrap">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-semibold text-gray-800">{log.performed_by || 'System'}</span>
                                                                {log.authorized_by && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 w-fit">
                                                                        Auth: {log.authorized_by}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Dedicated Bottom Footer: Pagination Controls (Always visible even if there is no next page) */}
                        {!isLoadingLogs && itemLogs.length > 0 && (
                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between shrink-0 no-print">
                                <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                    PAGE {historyPage} OF {totalHistoryPages || 1} <span className="text-gray-400 font-normal">({itemLogs.length} {itemLogs.length === 1 ? 'record' : 'records'})</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                                        disabled={historyPage <= 1}
                                        className={`h-7 w-7 p-0 rounded-lg transition-all ${
                                            historyPage <= 1
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-gray-200'
                                                : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border-gray-300 shadow-2xs cursor-pointer'
                                        }`}
                                        title="Previous page"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalHistoryPages || 1 }, (_, i) => i + 1).map((pageNum) => (
                                            <Button
                                                key={pageNum}
                                                variant={historyPage === pageNum ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setHistoryPage(pageNum)}
                                                className={`h-7 w-7 p-0 rounded-lg text-xs font-bold transition-all ${
                                                    historyPage === pageNum
                                                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                                                        : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border-gray-300 shadow-2xs cursor-pointer'
                                                }`}
                                            >
                                                {pageNum}
                                            </Button>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages || 1, p + 1))}
                                        disabled={historyPage >= (totalHistoryPages || 1)}
                                        className={`h-7 w-7 p-0 rounded-lg transition-all ${
                                            historyPage >= (totalHistoryPages || 1)
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-gray-200'
                                                : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border-gray-300 shadow-2xs cursor-pointer'
                                        }`}
                                        title="Next page"
                                    >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

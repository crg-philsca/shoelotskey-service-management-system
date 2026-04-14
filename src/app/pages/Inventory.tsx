import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Package, PlusCircle, Search, Filter, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Switch } from '@/app/components/ui/switch';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger
} from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useActivities } from '@/app/context/ActivityContext';
import { toast } from 'sonner';
import { useInventory } from '@/app/context/InventoryContext';
import { InventoryItem } from '@/app/types';

interface InventoryProps {
    onSetHeaderActionRight?: (action: React.ReactNode) => void;
    user: { token: string };
}

export default function Inventory({ onSetHeaderActionRight, user }: InventoryProps) {
    const { addActivity } = useActivities();
    const { inventoryData, addItem, updateItem, deleteItem } = useInventory();
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    // Filter State
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Modal/Form State
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [isCustomUnit, setIsCustomUnit] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Chemicals',
        stock: 0,
        unit: 'Bottles',
        price: 0,
        isActive: true
    });

    useEffect(() => {
        if (user.token) {
            console.log('[SECURITY] Inventory view accessed');
        }
    }, [user.token]);

    useEffect(() => {
        if (onSetHeaderActionRight) {
            onSetHeaderActionRight(
                <Button 
                    className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
                    onClick={() => {
                        setEditingItem(null);
                        setFormData({ name: '', category: 'Chemicals', stock: 0, unit: 'Bottles', price: 0, isActive: true });
                        setIsCustomCategory(false);
                        setIsCustomUnit(false);
                        setIsModalOpen(true);
                    }}
                >
                    <PlusCircle className="h-4 w-4 sm:mr-2 shrink-0" />
                    <span className="hidden sm:inline">New Item</span>
                </Button>
            );
        }
        return () => {
            if (onSetHeaderActionRight) onSetHeaderActionRight(null);
        };
    }, [onSetHeaderActionRight]);

    const handleSaveItem = () => {
        if (!formData.name) return;

        if (editingItem) {
            updateItem({ ...editingItem, ...formData });
            addActivity({
                type: 'system',
                user: 'Owner',
                action: 'Update Inventory',
                details: `Updated details for ${formData.name}`
            });
            toast.success(`Successfully updated ${formData.name}`);
        } else {
            addItem(formData);
            addActivity({
                type: 'system',
                user: 'Owner',
                action: 'Add Inventory',
                details: `Added new item: ${formData.name}`
            });
            toast.success(`Successfully added ${formData.name}`);
        }
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleDeleteItem = (id: number) => {
        const item = inventoryData.find((d) => d.id === id);
        if (confirm(`Are you sure you want to delete ${item?.name}?`)) {
            deleteItem(id);
            addActivity({
                type: 'system',
                user: 'Owner',
                action: 'Delete Inventory',
                details: `Removed ${item?.name} from inventory`
            });
            toast.success(`Successfully removed ${item?.name}`);
        }
    };

    const handleEditItem = (item: InventoryItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            category: item.category,
            stock: item.stock,
            unit: item.unit,
            price: item.price,
            isActive: item.isActive
        });
        setIsCustomCategory(false);
        setIsCustomUnit(false);
        setIsModalOpen(true);
    };

    const filteredInventory = inventoryData.filter((item: InventoryItem) => {
        const name = item.name || '';
        const category = item.category || '';
        const status = item.status || '';

        const matchesSearch = 
            name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            category.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = categoryFilter === 'all' || category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || status === statusFilter;
        const matchesActive = activeFilter === 'all' || 
            (activeFilter === 'active' && item.isActive) || 
            (activeFilter === 'inactive' && !item.isActive);
        
        return matchesSearch && matchesCategory && matchesStatus && matchesActive;
    });

    const totalPages = Math.ceil(filteredInventory.length / itemsPerPage) || 1;
    const paginatedInventory = filteredInventory.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const categories = Array.from(new Set(inventoryData.map(item => item.category))) as string[];
    const statuses = Array.from(new Set(inventoryData.map(item => item.status))) as string[];

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                {inventoryData.filter(i => i.status !== 'In Stock').length}
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
                    <div className="flex items-center gap-2 mb-3">
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
                                    <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-800 uppercase tracking-widest">Unit Price</th>
                                    <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-800 uppercase tracking-widest">Stock Level</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-800 uppercase tracking-widest">Stock Status</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-800 uppercase tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedInventory.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-900 leading-none">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">ID: INV-{item.id.toString().padStart(4, '0')}</p>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">{item.category}</td>
                                        <td className="px-6 py-4 text-right font-black text-xs text-gray-900">₱{(item.price || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-gray-900">{item.stock}</span>
                                            <span className="text-[10px] text-gray-400 ml-1 font-bold">{item.unit}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge className={`
                                                ${item.status === 'In Stock' ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
                                                ${item.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
                                                ${item.status === 'Critical' ? 'bg-red-50 text-red-700 border-red-100' : ''}
                                                text-[10px] font-black uppercase
                                            `}>
                                                {item.status}
                                            </Badge>
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
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    className="h-8 w-8 p-0 rounded-lg border border-amber-500 text-amber-600 hover:bg-amber-50 transition-colors"
                                                    onClick={() => handleEditItem(item)}
                                                >
                                                    <Edit size={14} strokeWidth={2.5} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    className="h-8 w-8 p-0 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 transition-colors"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                >
                                                    <Trash2 size={14} strokeWidth={2.5} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-2 flex items-center justify-between pt-4 pb-1">
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
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-[12px] font-black uppercase tracking-widest text-center">
                            {editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Item Name</label>
                            <Input 
                                className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                placeholder="e.g. Standard Shoe Cleaner" 
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        autoFocus
                                    />
                                ) : (
                                    <select 
                                        className="w-full h-9 rounded-lg border border-red-100 bg-white px-3 text-xs focus:ring-2 focus:ring-red-500"
                                        value={formData.category}
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
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
                                    <label className="text-[10px] font-black uppercase text-gray-400">Unit</label>
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
                                        placeholder="New Unit"
                                        value={formData.unit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                        autoFocus
                                    />
                                ) : (
                                    <select 
                                        className="w-full h-9 rounded-lg border border-red-100 bg-white px-3 text-xs focus:ring-2 focus:ring-red-500"
                                        value={formData.unit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                    >
                                        <option value="">(NONE / CLEAR)</option>
                                        <option value="Liters">LITERS</option>
                                        <option value="bottle">BOTTLE</option>
                                        <option value="can">CAN</option>
                                        <option value="tub">TUB</option>
                                        <option value="ml">ML</option>
                                        <option value="pcs">PCS</option>
                                        <option value="pairs">PAIRS</option>
                                        {inventoryData.map(item => item.unit).filter((v, i, a) => !['liters', 'bottle', 'can', 'tub', 'ml', 'pcs', 'pairs'].includes(v.toLowerCase()) && a.indexOf(v) === i).map(unit => (
                                            <option key={unit} value={unit}>{unit.toUpperCase()}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400">Stock Qty</label>
                                <Input 
                                    className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                    type="number" 
                                    step="any"
                                    placeholder="0" 
                                    value={formData.stock || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, stock: val === '' ? 0 : parseFloat(val) }));
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400">Unit Price (₱)</label>
                                <Input 
                                    className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs" 
                                    type="number" 
                                    step="any"
                                    placeholder="0.00" 
                                    value={formData.price || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, price: val === '' ? 0 : parseFloat(val) }));
                                    }}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4 pt-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Status</label>
                            <div className="flex items-center justify-end gap-2 bg-gray-50/50 px-3 py-1.5 rounded-full border border-gray-100">
                                <Switch 
                                    checked={formData.isActive}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                                <span className={`text-[10px] font-black uppercase w-14 text-right ${formData.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {formData.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-center gap-2 mt-4">
                        <Button variant="outline" className="h-9 text-xs font-bold uppercase tracking-widest border-red-100 hover:bg-red-50" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button className="h-9 text-xs font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white" onClick={handleSaveItem}>
                            {editingItem ? 'Update' : 'Save'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

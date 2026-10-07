import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useInventory } from '@/app/context/InventoryContext';
import JobOrderCombobox from '@/app/components/JobOrderCombobox';
import InventoryItemCombobox from '@/app/components/InventoryItemCombobox';
import { Scale, AlertTriangle, ArrowDownRight, ArrowUpRight, ShoppingCart, RotateCcw, SlidersHorizontal, Edit3, X, Loader2, Package, ChevronDown, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { formatPeso } from '@/app/lib/currency';
import { hasPermission } from '@/app/lib/permissions';

interface UpdateStockModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialItem?: any;
    initialOrder?: any;
    user?: { username?: string; token?: string; role?: string; permissions?: string[] };
}

type TabMode = 'use' | 'add' | 'balance';
type AdditionType = 'purchase' | 'return' | 'adjustment' | 'custom';
type UnitInputMode = 'base' | 'package';

const USE_REASON_PRESETS = [
    'Daily Service Usage',
    'Spillage / Waste',
    'Quality Testing',
    'Routine Maintenance',
    'Damaged / Expired',
] as const;

const ADD_REASON_PRESETS = [
    'New Stock Purchase',
    'Unused Material Return',
    'Supplier Bonus / Freebie',
    'Stock Count Adjustment',
] as const;

const BALANCE_REASON_PRESETS = [
    'Manual Stock Adjustment',
    'Periodic Audit Recount',
    'Discrepancy Correction',
] as const;

interface ReasonComboboxProps {
    value: string;
    onChange: (val: string) => void;
    presets: readonly string[];
    placeholder?: string;
}

function ReasonCombobox({ value, onChange, presets, placeholder = "Select preset or type custom reason..." }: ReasonComboboxProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const cleanPresets = useMemo(() => {
        return presets.filter(p => p !== 'Custom...');
    }, [presets]);

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <Input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' || e.key === 'Enter') setOpen(false);
                    }}
                    placeholder={placeholder}
                    className="h-9 pr-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold bg-white text-gray-800 placeholder:font-normal placeholder:text-gray-400 transition-colors"
                />
                <button
                    type="button"
                    onClick={() => {
                        setOpen(prev => !prev);
                        inputRef.current?.focus();
                    }}
                    className="absolute right-1.5 h-6 w-6 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors cursor-pointer rounded"
                    tabIndex={-1}
                    title="Toggle reason presets"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180 text-red-600' : ''}`} />
                </button>
            </div>

            {open && cleanPresets.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-red-100 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto no-scrollbar">
                    <div className="px-3 py-1 text-[9px] font-black uppercase text-gray-400 tracking-wider">
                        Select Preset or Type Directly Above
                    </div>
                    {cleanPresets.map((preset) => {
                        const isSelected = value.trim().toLowerCase() === preset.trim().toLowerCase();
                        return (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                    onChange(preset);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected 
                                        ? 'bg-red-50 text-red-700 font-bold' 
                                        : 'text-gray-700 hover:bg-red-50/50 hover:text-red-700'
                                }`}
                            >
                                <span className="truncate">{preset}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 text-red-600 shrink-0 ml-2" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function UpdateStockModal({ open, onOpenChange, initialItem, initialOrder, user: _user }: UpdateStockModalProps) {
    const { inventoryData, updateStock, refreshInventory } = useInventory();

    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [tab, setTab] = useState<TabMode>('use');
    
    // Tab 1: Use Stock state
    const [useUnitMode, setUseUnitMode] = useState<UnitInputMode>('base');
    const [useAmount, setUseAmount] = useState<string>('1');
    const [usePackageQty, setUsePackageQty] = useState<string>('1');
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [useReason, setUseReason] = useState<string>('Daily Service Usage');

    // Tab 2: Add Stock state
    const [additionType, setAdditionType] = useState<AdditionType>('purchase');
    const [purchasePackageQty, setPurchasePackageQty] = useState<string>('1');
    const [directAddAmount, setDirectAddAmount] = useState<string>('100');
    const [recordExpense, setRecordExpense] = useState<boolean>(true);
    const [addReason, setAddReason] = useState<string>('New Stock Purchase');

    // Tab 3: Set Balance state
    const [balanceUnitMode, setBalanceUnitMode] = useState<'base' | 'package'>('base');
    const [balancePackageQty, setBalancePackageQty] = useState<string>('');
    const [balanceRemainder, setBalanceRemainder] = useState<string>('');
    const [physicalCount, setPhysicalCount] = useState<string>('');
    const [balanceReason, setBalanceReason] = useState<string>('Manual Stock Adjustment');

    const userRole = ((_user?.role || '') as string).toLowerCase().trim();
    const userUsername = ((_user?.username || '') as string).toLowerCase().trim();
    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin' || userUsername === 'admin';

    // Staff Balance Override authorization state
    const [authMethod, setAuthMethod] = useState<'code' | 'credentials'>('code');
    const [authCode, setAuthCode] = useState<string>('');
    const [authUsername, setAuthUsername] = useState<string>('');
    const [authPassword, setAuthPassword] = useState<string>('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const canUseStock = _user ? hasPermission(_user, 'inventory.use_stock') : true;
    const canAddStock = _user ? hasPermission(_user, 'inventory.add_stock') : true;
    const canSetBalance = _user ? hasPermission(_user, 'inventory.adjust_balance') : true;

    // Initialize state on modal open
    useEffect(() => {
        if (open) {
            if (initialItem && initialItem.id) {
                setSelectedItemId(String(initialItem.id));
            } else if (inventoryData && inventoryData.length > 0) {
                setSelectedItemId(String(inventoryData[0].id));
            } else {
                setSelectedItemId('');
            }

            if (initialOrder && initialOrder.id) {
                setSelectedOrderId(String(initialOrder.id));
            } else {
                setSelectedOrderId('');
            }

            if (canUseStock) {
                setTab('use');
            } else if (canAddStock) {
                setTab('add');
            } else if (canSetBalance) {
                setTab('balance');
            } else {
                setTab('use');
            }
            setUseUnitMode('base');
            setUseAmount('1');
            setUsePackageQty('1');
            setUseReason('Daily Service Usage');
            setAdditionType('purchase');
            setPurchasePackageQty('1');
            setDirectAddAmount('100');
            setRecordExpense(true);
            setAddReason('New Stock Purchase');
            setBalanceUnitMode('base');
            setBalanceReason('Manual Stock Adjustment');
            setAuthCode('');
            setAuthUsername('');
            setAuthPassword('');
            setAuthMethod('code');
        }
    }, [open, initialItem, initialOrder, inventoryData, canUseStock, canAddStock, canSetBalance]);

    const activeItem = useMemo(() => {
        return inventoryData.find(i => String(i.id) === selectedItemId) || null;
    }, [inventoryData, selectedItemId]);

    const currentStock = Number(activeItem?.stock ?? 0);
    const stockUnit = activeItem?.unit || 'units';
    const packageUnit = activeItem?.package_unit || 'package';
    const packageSize = Number(activeItem?.package_size || 1);
    const unitPrice = Number(activeItem?.price || 0);
    const hasPackages = packageSize > 1;

    // Update physical count field when active item or tab changes
    useEffect(() => {
        if (activeItem) {
            setPhysicalCount(String(currentStock));
            if (packageSize > 1) {
                const fullPkgs = Math.floor(currentStock / packageSize);
                const remainder = currentStock % packageSize;
                setBalancePackageQty(String(fullPkgs));
                setBalanceRemainder(remainder > 0 ? String(remainder) : '');
            } else {
                setBalancePackageQty('0');
                setBalanceRemainder('');
            }
            const isCountUnit = ['pcs', 'pc', 'pair', 'pairs', 'set', 'item'].includes(stockUnit.toLowerCase());
            setUseAmount(isCountUnit ? '1' : '50');
            setDirectAddAmount(isCountUnit ? '10' : '500');
        }
    }, [activeItem?.id, tab]);

    // Handle addition type preset changes
    useEffect(() => {
        if (additionType === 'purchase') {
            setAddReason('New Stock Purchase');
        } else if (additionType === 'return') {
            setAddReason('Unused Material Return');
        } else if (additionType === 'adjustment') {
            setAddReason('Stock Count Adjustment');
        } else {
            setAddReason('');
        }
    }, [additionType]);

    // Math Calculations
    // 1. USE STOCK
    const effectiveUseBaseAmount = useMemo(() => {
        if (hasPackages && useUnitMode === 'package') {
            const pkgs = parseFloat(usePackageQty) || 0;
            return pkgs * packageSize;
        }
        return parseFloat(useAmount) || 0;
    }, [hasPackages, useUnitMode, usePackageQty, packageSize, useAmount]);

    const postUseStock = Math.max(0, currentStock - effectiveUseBaseAmount);
    const isOverDeduct = effectiveUseBaseAmount > currentStock;

    // 2. ADD STOCK
    let addedStockUnits = 0;
    let purchaseTotalCost = 0;
    if (additionType === 'purchase') {
        const pkgQtyNum = parseFloat(purchasePackageQty) || 0;
        addedStockUnits = packageSize > 1 ? pkgQtyNum * packageSize : pkgQtyNum;
        purchaseTotalCost = pkgQtyNum * unitPrice;
    } else {
        addedStockUnits = parseFloat(directAddAmount) || 0;
    }
    const postAddStock = currentStock + addedStockUnits;

    // 3. SET BALANCE
    const physicalCountNum = useMemo(() => {
        if (hasPackages && balanceUnitMode === 'package') {
            const pkgs = parseFloat(balancePackageQty) || 0;
            const remainder = parseFloat(balanceRemainder) || 0;
            return (pkgs * packageSize) + remainder;
        }
        return parseFloat(physicalCount) || 0;
    }, [hasPackages, balanceUnitMode, balancePackageQty, balanceRemainder, packageSize, physicalCount]);

    const balanceDifference = physicalCountNum - currentStock;

    // Resolve final reason text
    const effectiveUseReason = useReason.trim() || 'Daily Service Usage';
    const effectiveAddReason = addReason.trim() || 'New Stock Purchase';
    const effectiveBalanceReason = balanceReason.trim() || 'Physical Count Reconciliation';

    // Submission Handler
    const handleConfirm = async () => {
        if (!activeItem) return;
        setIsSubmitting(true);

        try {
            if (tab === 'use') {
                if (effectiveUseBaseAmount <= 0) {
                    toast.error('Please enter a valid amount to use.');
                    setIsSubmitting(false);
                    return;
                }
                if (isOverDeduct) {
                    toast.error(`Cannot deduct ${effectiveUseBaseAmount.toLocaleString()} ${stockUnit}. Current stock is ${currentStock.toLocaleString()} ${stockUnit}.`);
                    setIsSubmitting(false);
                    return;
                }

                const orderNum = selectedOrderId ? parseInt(selectedOrderId, 10) : undefined;
                await updateStock(activeItem.id, effectiveUseBaseAmount, {
                    action: 'deduction',
                    orderId: orderNum,
                    reason: effectiveUseReason,
                    unit_mode: useUnitMode,
                    packages: useUnitMode === 'package' ? (parseFloat(usePackageQty) || 0) : undefined
                } as any);

                toast.success(`Used ${effectiveUseBaseAmount.toLocaleString()} ${stockUnit} of ${activeItem.name}. New stock: ${postUseStock.toLocaleString()} ${stockUnit}`);
            } else if (tab === 'add') {
                if (addedStockUnits <= 0) {
                    toast.error('Please enter a valid quantity to add.');
                    setIsSubmitting(false);
                    return;
                }

                const isPurchase = additionType === 'purchase';
                const shouldRecordExp = isPurchase && recordExpense && purchaseTotalCost > 0;

                await updateStock(activeItem.id, addedStockUnits, {
                    action: 'restock',
                    createExpense: shouldRecordExp,
                    expenseAmount: shouldRecordExp ? purchaseTotalCost : undefined,
                    expenseCategory: 'Inventory Restock',
                    expenseNotes: `Purchase of ${purchasePackageQty} ${packageUnit}(s) of ${activeItem.name}`,
                    reason: effectiveAddReason,
                    unit_mode: isPurchase ? 'package' : 'base',
                    packages: isPurchase ? (parseFloat(purchasePackageQty) || 0) : undefined
                } as any);

                toast.success(`Added +${addedStockUnits.toLocaleString()} ${stockUnit} to ${activeItem.name}. New stock: ${postAddStock.toLocaleString()} ${stockUnit}`);
            } else if (tab === 'balance') {
                if (isNaN(physicalCountNum) || physicalCountNum < 0) {
                    toast.error('Please enter a valid physical count (0 or greater).');
                    setIsSubmitting(false);
                    return;
                }

                if (!effectiveBalanceReason || !effectiveBalanceReason.trim()) {
                    toast.error('A non-empty reason is mandatory for manual balance adjustments.');
                    setIsSubmitting(false);
                    return;
                }

                if (!isOwnerOrAdmin) {
                    if (authMethod === 'code' && !authCode.trim()) {
                        toast.error('Store Owner authorization code is required for Staff balance adjustments.');
                        setIsSubmitting(false);
                        return;
                    }
                    if (authMethod === 'credentials') {
                        if (!authUsername.trim()) {
                            toast.error('Owner username is required.');
                            setIsSubmitting(false);
                            return;
                        }
                        if (!authPassword) {
                            toast.error('Owner password is required.');
                            setIsSubmitting(false);
                            return;
                        }
                    }
                }

                await updateStock(activeItem.id, physicalCountNum, {
                    action: 'set_balance',
                    reason: effectiveBalanceReason.trim(),
                    unit_mode: balanceUnitMode,
                    packages: balanceUnitMode === 'package' ? (parseFloat(balancePackageQty) || 0) : undefined,
                    authorization_code: !isOwnerOrAdmin && authMethod === 'code' ? authCode.trim() : undefined,
                    authorizer_username: !isOwnerOrAdmin && authMethod === 'credentials' ? authUsername.trim() : undefined,
                    authorizer_password: !isOwnerOrAdmin && authMethod === 'credentials' ? authPassword : undefined,
                } as any);

                toast.success(`Stock balance for ${activeItem.name} reconciled to ${physicalCountNum.toLocaleString()} ${stockUnit} (${balanceDifference >= 0 ? '+' : ''}${balanceDifference.toLocaleString()} adjustment).`);
            }

            if (refreshInventory) await refreshInventory();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to update inventory stock.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const presentation = activeItem ? getInventoryPresentation(activeItem) : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[580px] p-0 overflow-hidden rounded-2xl border border-gray-100 shadow-2xl max-h-[90vh] flex flex-col bg-white">
                {/* Header */}
                <DialogHeader className="px-4 sm:px-6 py-4 border-b border-gray-100 relative bg-white shrink-0">
                    {presentation && (
                        <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 flex items-center">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                                presentation.stockStatus === 'In Stock' 
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : presentation.stockStatus === 'Low Stock'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${
                                    presentation.stockStatus === 'In Stock' ? 'bg-emerald-500' : presentation.stockStatus === 'Low Stock' ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'
                                }`} />
                                {presentation.stockStatus}
                            </span>
                        </div>
                    )}
                    <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                        Update Stock
                    </DialogTitle>
                    <DialogDescription className="sr-only">Record inventory stock usage, additions, or reconciliation</DialogDescription>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        aria-label="Close"
                        className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xs flex items-center justify-center flex-shrink-0 cursor-pointer outline-none"
                    >
                        <X size={16} />
                    </button>
                </DialogHeader>

                {/* Body with smooth internal mousewheel scrolling */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
                    {/* ① Select Inventory Item */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                            <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">1</div>
                            <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">Select Item</h3>
                        </div>

                        <div className="space-y-2">
                            <InventoryItemCombobox
                                items={inventoryData}
                                value={selectedItemId}
                                onChange={setSelectedItemId}
                                placeholder="Search / Select Item"
                            />

                            {/* Current Stock Banner or Unselected Notice */}
                            {activeItem && presentation ? (
                                <div className="p-3 bg-red-50/40 rounded-xl border border-red-100 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Current Stock</span>
                                        <div className="text-base font-black text-gray-900 mt-0.5">
                                            {currentStock.toLocaleString()} <span className="text-xs font-bold text-gray-500 uppercase">{stockUnit}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                                            presentation.stockStatus === 'In Stock' 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : presentation.stockStatus === 'Low Stock'
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}>
                                            {presentation.stockStatus}
                                        </span>
                                        {packageSize > 1 && (
                                            <p className="text-[10px] text-gray-500 font-medium mt-1">
                                                1 {packageUnit} = {packageSize.toLocaleString()} {stockUnit}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                                    <p className="text-xs font-semibold text-slate-500">Please choose an inventory item above to view current stock and adjust inventory.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {activeItem && (
                        <>
                            {/* ② Action Type */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                                    <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">2</div>
                                    <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">Stock Movement</h3>
                                </div>

                                {/* 3 Action Tabs */}
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/60">
                                    <button
                                        type="button"
                                        disabled={!canUseStock}
                                        onClick={() => setTab('use')}
                                        title={canUseStock ? "Record stock usage" : "Permission required: Edit Inventory (Use Stock)"}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            !canUseStock
                                                ? 'opacity-40 cursor-not-allowed text-gray-400'
                                                : tab === 'use'
                                                    ? 'bg-white text-red-600 shadow-sm font-black cursor-pointer'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50 cursor-pointer'
                                        }`}
                                    >
                                        <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                                        Use Stock
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canAddStock}
                                        onClick={() => setTab('add')}
                                        title={canAddStock ? "Add or restock items" : "Permission required: Add / Restock Inventory"}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            !canAddStock
                                                ? 'opacity-40 cursor-not-allowed text-gray-400'
                                                : tab === 'add'
                                                    ? 'bg-white text-emerald-600 shadow-sm font-black cursor-pointer'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50 cursor-pointer'
                                        }`}
                                    >
                                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                                        Add Stock
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canSetBalance}
                                        onClick={() => setTab('balance')}
                                        title={canSetBalance ? "Reconcile physical stock count" : "Permission required: Edit Inventory (Set Balance)"}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            !canSetBalance
                                                ? 'opacity-40 cursor-not-allowed text-gray-400'
                                                : tab === 'balance'
                                                    ? 'bg-white text-indigo-600 shadow-sm font-black cursor-pointer'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50 cursor-pointer'
                                        }`}
                                    >
                                        <Scale className="h-3.5 w-3.5 text-indigo-500" />
                                        Set Balance
                                    </button>
                                </div>
                            </div>

                            {/* ③ Update Details */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                                    <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">3</div>
                                    <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">Update Details</h3>
                                </div>

                                {/* TAB 1: USE STOCK */}
                                {tab === 'use' && (
                                    <div className="space-y-3.5 animate-in fade-in duration-200">
                                        {/* Unit Mode Toggle if item supports packages */}
                                        {hasPackages && (
                                            <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                                                <span className="font-bold text-gray-600">Measurement Unit:</span>
                                                <div className="flex gap-1 bg-white p-0.5 rounded border border-gray-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => setUseUnitMode('base')}
                                                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                                                            useUnitMode === 'base' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        Base ({stockUnit})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setUseUnitMode('package')}
                                                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                                                            useUnitMode === 'package' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        Packages ({packageUnit})
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-gray-500">
                                                    Amount to Deduct ({useUnitMode === 'package' && hasPackages ? packageUnit : stockUnit}) <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={useUnitMode === 'package' && hasPackages ? usePackageQty : useAmount}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                if (useUnitMode === 'package' && hasPackages) {
                                                                    setUsePackageQty(val);
                                                                } else {
                                                                    setUseAmount(val);
                                                                }
                                                            }
                                                        }}
                                                        className="h-9 border-red-100 focus:border-red-500 rounded-lg text-xs font-semibold pr-16"
                                                        placeholder={useUnitMode === 'package' && hasPackages ? '1' : '100'}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">
                                                        {useUnitMode === 'package' && hasPackages ? packageUnit : stockUnit}
                                                    </span>
                                                </div>
                                                {useUnitMode === 'package' && hasPackages && (
                                                    <p className="text-[10px] text-gray-500 font-medium">
                                                        Yields: {effectiveUseBaseAmount.toLocaleString()} {stockUnit} deducted ({packageSize.toLocaleString()} {stockUnit} per {packageUnit})
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-gray-500">
                                                    Job Order <span className="text-gray-400 font-normal lowercase">(optional)</span>
                                                </label>
                                                <JobOrderCombobox
                                                    value={selectedOrderId}
                                                    onChange={(val) => setSelectedOrderId(val)}
                                                />
                                            </div>
                                        </div>

                                        {/* Reason Dropdown + Direct Typing Field */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-gray-500">
                                                Reason / Note <span className="text-gray-400 font-normal lowercase">(choose preset or type directly)</span>
                                            </label>
                                            <ReasonCombobox
                                                value={useReason}
                                                onChange={setUseReason}
                                                presets={USE_REASON_PRESETS}
                                                placeholder="Select preset or type usage reason..."
                                            />
                                        </div>

                                        {/* Live Step Calculation */}
                                        <div className={`p-3 rounded-xl border flex items-center justify-between ${
                                            isOverDeduct 
                                                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                                                : 'bg-red-50/40 border-red-100 text-slate-800'
                                        }`}>
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Live Calculation Preview</span>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs font-black">
                                                    <span>{currentStock.toLocaleString()} {stockUnit}</span>
                                                    <span className="text-red-500 font-extrabold">− {effectiveUseBaseAmount.toLocaleString()} {stockUnit}</span>
                                                    <span>→</span>
                                                    <span className={isOverDeduct ? 'text-rose-600 underline' : 'text-slate-900 font-extrabold'}>
                                                        {postUseStock.toLocaleString()} {stockUnit}
                                                    </span>
                                                </div>
                                            </div>
                                            {isOverDeduct && (
                                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200">
                                                    Exceeds Stock
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: ADD STOCK */}
                                {tab === 'add' && (
                                    <div className="space-y-3.5 animate-in fade-in duration-200">
                                        {/* Addition Type Pills */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-gray-500">
                                                Addition Type
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                {[
                                                    { key: 'purchase', label: 'New Purchase', icon: ShoppingCart },
                                                    { key: 'return', label: 'Returned Material', icon: RotateCcw },
                                                    { key: 'adjustment', label: 'Stock Adjustment', icon: SlidersHorizontal },
                                                    { key: 'custom', label: 'Custom', icon: Edit3 }
                                                ].map(type => (
                                                    <button
                                                        key={type.key}
                                                        type="button"
                                                        onClick={() => setAdditionType(type.key as AdditionType)}
                                                        className={`p-2 rounded-lg text-center border text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                                            additionType === type.key
                                                                ? 'bg-red-50 border-red-200 text-red-700 shadow-xs'
                                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <type.icon className={`h-3.5 w-3.5 ${additionType === type.key ? 'text-red-600' : 'text-gray-400'}`} />
                                                        {type.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Inputs: New Purchase uses Packages if available */}
                                        {additionType === 'purchase' && hasPackages ? (
                                            <div className="space-y-3 p-3 bg-red-50/40 border border-red-100 rounded-xl">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase text-gray-600">
                                                            Quantity in Packages ({packageUnit}) <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="relative">
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={purchasePackageQty}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) setPurchasePackageQty(val);
                                                                }}
                                                                className="h-9 border-red-100 bg-white focus:border-red-500 rounded-lg text-xs font-semibold pr-16"
                                                                placeholder="2"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">
                                                                {packageUnit}(s)
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5 flex flex-col justify-end">
                                                        <label className="text-[10px] font-black uppercase text-gray-600">
                                                            Conversion Output
                                                        </label>
                                                        <div className="h-9 px-3 bg-white border border-red-100 rounded-lg flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Yields:</span>
                                                            <span className="text-xs font-black text-red-600">
                                                                +{addedStockUnits.toLocaleString()} {stockUnit}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Cost Calculation & Expense Toggle */}
                                                {unitPrice > 0 && (
                                                    <div className="p-2.5 bg-white border border-red-100 rounded-lg flex flex-col gap-1.5">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-gray-500 font-medium">
                                                                Cost: {formatPeso(unitPrice)} × {purchasePackageQty || '0'} {packageUnit}
                                                            </span>
                                                            <span className="font-black text-slate-900">
                                                                = {formatPeso(purchaseTotalCost)}
                                                            </span>
                                                        </div>
                                                        <label className="flex items-center gap-2 cursor-pointer pt-1.5 border-t border-gray-100">
                                                            <input
                                                                type="checkbox"
                                                                checked={recordExpense}
                                                                onChange={(e) => setRecordExpense(e.target.checked)}
                                                                className="h-3.5 w-3.5 rounded text-red-600 focus:ring-red-500 border-gray-300 accent-red-600"
                                                            />
                                                            <span className="text-xs font-bold text-slate-800">
                                                                Record this purchase as an expense in accounting
                                                            </span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Base Units addition */
                                            <div className="space-y-2 p-3 bg-red-50/40 border border-red-100 rounded-xl">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-gray-600">
                                                        Amount to Add ({stockUnit}) <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={directAddAmount}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d*$/.test(val)) setDirectAddAmount(val);
                                                            }}
                                                            className="h-9 border-red-100 bg-white focus:border-red-500 rounded-lg text-xs font-semibold pr-12"
                                                            placeholder="500"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">
                                                            {stockUnit}
                                                        </span>
                                                    </div>
                                                    <p className="text-[9.5px] text-gray-400">
                                                        Direct stock unit addition (no package conversion needed).
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Reason Dropdown + Direct Typing Field */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-gray-500">
                                                Reason / Note <span className="text-gray-400 font-normal lowercase">(choose preset or type directly)</span>
                                            </label>
                                            <ReasonCombobox
                                                value={addReason}
                                                onChange={setAddReason}
                                                presets={ADD_REASON_PRESETS}
                                                placeholder="Select preset or type addition reason..."
                                            />
                                        </div>

                                        {/* Live Step Calculation */}
                                        <div className="p-3 rounded-xl border border-red-100 bg-red-50/40 text-slate-800 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Live Calculation Preview</span>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs font-black">
                                                    <span>{currentStock.toLocaleString()} {stockUnit}</span>
                                                    <span className="text-emerald-600 font-extrabold">+ {addedStockUnits.toLocaleString()} {stockUnit}</span>
                                                    <span>→</span>
                                                    <span className="text-slate-900 font-extrabold">
                                                        {postAddStock.toLocaleString()} {stockUnit}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: SET BALANCE */}
                                {tab === 'balance' && (
                                    <div className="space-y-3.5 animate-in fade-in duration-200">
                                        {/* Packaging mode toggle if item has packages */}
                                        {hasPackages && (
                                            <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                                                <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                                                    <Package className="h-3.5 w-3.5 text-red-600" />
                                                    <span>Count Method:</span>
                                                </div>
                                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setBalanceUnitMode('base')}
                                                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                                                            balanceUnitMode === 'base' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        Base ({stockUnit})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setBalanceUnitMode('package')}
                                                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                                                            balanceUnitMode === 'package' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        Packages ({packageUnit})
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-gray-500">
                                                    System Stock Recorded
                                                </label>
                                                <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                                                    <span className="text-xs text-gray-500 font-medium">Recorded:</span>
                                                    <span className="text-xs font-bold text-gray-800">
                                                        {currentStock.toLocaleString()} {stockUnit}
                                                        {hasPackages && (
                                                            <span className="text-gray-400 font-normal ml-1">
                                                                ({Math.floor(currentStock / packageSize)} {packageUnit}{currentStock % packageSize > 0 ? ` + ${currentStock % packageSize} ${stockUnit}` : ''})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Single base count input */}
                                            {(!hasPackages || balanceUnitMode === 'base') && (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-gray-500">
                                                        Physical Stock Count ({stockUnit}) <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={physicalCount}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d*$/.test(val)) setPhysicalCount(val);
                                                            }}
                                                            className="h-9 border-red-100 bg-white focus:border-red-500 rounded-lg text-xs font-semibold pr-12"
                                                            placeholder="750"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">
                                                            {stockUnit}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Package count input */}
                                            {hasPackages && balanceUnitMode === 'package' && (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-gray-500">
                                                        Full Packages ({packageUnit}) <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={balancePackageQty}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d*$/.test(val)) setBalancePackageQty(val);
                                                            }}
                                                            className="h-9 border-red-100 bg-white focus:border-red-500 rounded-lg text-xs font-semibold pr-14"
                                                            placeholder="1"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">
                                                            {packageUnit}(s)
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Loose / Partial Remainder for package counting */}
                                        {hasPackages && balanceUnitMode === 'package' && (
                                            <div className="p-3 bg-red-50/40 border border-red-100 rounded-xl space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black uppercase text-gray-600">
                                                        Partial / Loose Amount ({stockUnit}) <span className="text-gray-400 font-normal lowercase">(optional remainder)</span>
                                                    </label>
                                                    <span className="text-[10px] font-medium text-slate-500">
                                                        1 {packageUnit} = {packageSize.toLocaleString()} {stockUnit}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="relative">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={balanceRemainder}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d*$/.test(val)) setBalanceRemainder(val);
                                                            }}
                                                            className="h-9 border-red-100 bg-white focus:border-red-500 rounded-lg text-xs font-semibold pr-12"
                                                            placeholder="e.g. 800"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">
                                                            {stockUnit}
                                                        </span>
                                                    </div>
                                                    <div className="h-9 px-3 bg-white border border-red-100 rounded-lg flex items-center justify-between">
                                                        <span className="text-[11px] text-gray-500 font-medium">Reconciled Total:</span>
                                                        <span className="text-xs font-black text-red-600">
                                                            {physicalCountNum.toLocaleString()} {stockUnit}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Reason Dropdown + Direct Typing Field */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-gray-500">
                                                Reason for Count Update / Note <span className="text-red-500">*</span> <span className="text-gray-400 font-normal lowercase">(mandatory)</span>
                                            </label>
                                            <ReasonCombobox
                                                value={balanceReason}
                                                onChange={setBalanceReason}
                                                presets={BALANCE_REASON_PRESETS}
                                                placeholder="Select preset or type adjustment reason..."
                                            />
                                        </div>

                                        {/* Staff Balance Override: Owner Authorization Requirement */}
                                        {!isOwnerOrAdmin && (
                                            <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-3">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-red-200/60">
                                                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-red-700 tracking-wider">
                                                        <Lock className="h-3.5 w-3.5 text-red-600" />
                                                        <span>Owner Only Verification</span>
                                                    </div>
                                                    <div className="flex items-center bg-white border border-red-200 rounded-lg p-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAuthMethod('code')}
                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                                                authMethod === 'code' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            Auth Code
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAuthMethod('credentials')}
                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                                                authMethod === 'credentials' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            Credentials
                                                        </button>
                                                    </div>
                                                </div>

                                                {authMethod === 'code' ? (
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black uppercase text-gray-600">
                                                            Store Authorization Code <span className="text-red-500">*</span>
                                                        </label>
                                                        <Input
                                                            type="password"
                                                            value={authCode}
                                                            onChange={(e) => setAuthCode(e.target.value)}
                                                            placeholder="Enter store authorization code"
                                                            className="h-8 border-red-200 bg-white focus:border-red-500 rounded-lg text-xs font-semibold"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase text-gray-600">
                                                                Owner Username <span className="text-red-500">*</span>
                                                            </label>
                                                            <Input
                                                                type="text"
                                                                value={authUsername}
                                                                onChange={(e) => setAuthUsername(e.target.value)}
                                                                placeholder="e.g. admin or owner"
                                                                className="h-8 border-red-200 bg-white focus:border-red-500 rounded-lg text-xs font-semibold"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase text-gray-600">
                                                                Owner Password <span className="text-red-500">*</span>
                                                            </label>
                                                            <Input
                                                                type="password"
                                                                value={authPassword}
                                                                onChange={(e) => setAuthPassword(e.target.value)}
                                                                placeholder="Owner password"
                                                                className="h-8 border-red-200 bg-white focus:border-red-500 rounded-lg text-xs font-semibold"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <p className="text-[9.5px] text-red-600/90 font-medium leading-tight">
                                                    Manual stock adjustment overwrites ledger balance and requires explicit Owner-only verification.
                                                </p>
                                            </div>
                                        )}

                                        {/* Live Reconciliation Math */}
                                        <div className="p-3 bg-red-50/40 border border-red-100 rounded-xl space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between text-gray-600">
                                                <span>Current System Stock:</span>
                                                <span className="font-bold text-gray-900">{currentStock.toLocaleString()} {stockUnit}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-red-600 font-bold">
                                                <span>Stock Difference:</span>
                                                <span>{balanceDifference >= 0 ? '+' : ''}{balanceDifference.toLocaleString()} {stockUnit}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm font-black text-gray-900 pt-1 border-t border-red-100">
                                                <span>New Stock Level:</span>
                                                <span className="text-base flex items-baseline gap-1.5">
                                                    <span>{physicalCountNum.toLocaleString()} {stockUnit}</span>
                                                    {hasPackages && (
                                                        <span className="text-xs font-semibold text-gray-500">
                                                            ({Math.floor(physicalCountNum / packageSize)} {packageUnit}{physicalCountNum % packageSize > 0 ? ` + ${physicalCountNum % packageSize} ${stockUnit}` : ''})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Audit Warning */}
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-amber-800 leading-snug">
                                                This updates your stock to match your actual physical count. The difference ({balanceDifference >= 0 ? '+' : ''}{balanceDifference.toLocaleString()} {stockUnit}) will be recorded in stock history.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Sticky Footer */}
                <div className="shrink-0 sticky bottom-0 z-10 bg-white px-4 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4 border-t border-gray-100 flex gap-3">
                    <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 h-9 text-xs font-black uppercase tracking-widest border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="button"
                        className="flex-1 h-9 text-xs font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer" 
                        onClick={handleConfirm}
                        disabled={!activeItem || isSubmitting || (tab === 'use' && isOverDeduct)}
                    >
                        {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {isSubmitting ? 'Saving...' : tab === 'use' ? 'Save Stock Usage' : tab === 'add' ? 'Save Stock Addition' : 'Save Balance'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

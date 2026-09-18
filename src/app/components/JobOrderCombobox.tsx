import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useOrders } from '@/app/context/OrderContext';
import { API_BASE } from '@/app/lib/apiBase';
import { Search, ChevronDown, Check, X, Wrench, Loader2, Filter } from 'lucide-react';

export type OrderFilterType = 'active' | 'new_order' | 'on_going' | 'for_release' | 'claimed' | 'all';

interface FilterOption {
    id: OrderFilterType;
    label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
    { id: 'active', label: 'Active Orders' },
    { id: 'new_order', label: 'New Order' },
    { id: 'on_going', label: 'On-Going' },
    { id: 'for_release', label: 'For Release' },
    { id: 'claimed', label: 'Claimed' },
    { id: 'all', label: 'All Orders' },
];

export interface ComboboxOrderItem {
    id: number | string;
    orderNumber: string;
    customerName: string;
    status: string;
    createdAt?: string | Date;
}

interface JobOrderComboboxProps {
    value: string; // Order ID string or empty
    onChange: (orderId: string, order?: ComboboxOrderItem) => void;
    placeholder?: string;
    className?: string;
}

export default function JobOrderCombobox({
    value,
    onChange,
    placeholder = "None (Workshop / Internal)",
    className = ""
}: JobOrderComboboxProps) {
    const { orders: contextOrders } = useOrders();
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<OrderFilterType>('active');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [serverResults, setServerResults] = useState<ComboboxOrderItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus search input when popover opens
    useEffect(() => {
        if (open) {
            setTimeout(() => searchInputRef.current?.focus(), 80);
        } else {
            setSearchQuery('');
            setIsFilterMenuOpen(false);
        }
    }, [open]);

    // Query backend authoritative search with debounce
    useEffect(() => {
        let isCurrent = true;
        const fetchRemote = async () => {
            setIsSearching(true);
            try {
                const token = JSON.parse(localStorage.getItem('user') || '{}')?.token ||
                              localStorage.getItem('token') || '';
                const params = new URLSearchParams();
                if (searchQuery.trim()) params.set('q', searchQuery.trim());
                params.set('status_filter', selectedFilter);
                params.set('limit', '120');

                const res = await fetch(`${API_BASE}/orders/search?${params.toString()}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (res.ok && isCurrent) {
                    const data = await res.json();
                    setServerResults(data);
                }
            } catch (err) {
                // Fallback gracefully to contextOrders
            } finally {
                if (isCurrent) setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchRemote, 120);
        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [searchQuery, selectedFilter]);

    // Normalize and filter client-side orders from OrderContext for instant responsiveness
    const filteredContextOrders = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        return contextOrders.filter(ord => {
            const statusRaw = (ord.status || '').toLowerCase().replace(/[\s_]+/g, '-');

            // Status filter logic
            if (selectedFilter === 'active') {
                if (!['new-order', 'on-going', 'for-release'].includes(statusRaw)) return false;
            } else if (selectedFilter === 'new_order') {
                if (statusRaw !== 'new-order') return false;
            } else if (selectedFilter === 'on_going') {
                if (statusRaw !== 'on-going') return false;
            } else if (selectedFilter === 'for_release') {
                if (statusRaw !== 'for-release') return false;
            } else if (selectedFilter === 'claimed') {
                if (statusRaw !== 'claimed') return false;
            }

            // Search query matching: Order Number, Partial Number, Customer First/Last/Full Name
            if (!query) return true;

            const orderNum = (ord.orderNumber || '').toLowerCase();
            const custName = (ord.customerName || '').toLowerCase();

            return orderNum.includes(query) || custName.includes(query);
        }).map(ord => ({
            id: ord.id,
            orderNumber: ord.orderNumber,
            customerName: ord.customerName,
            status: ord.status || 'New Order',
            createdAt: ord.createdAt
        }));
    }, [contextOrders, searchQuery, selectedFilter]);

    // Merge server results with local context results without duplicates
    const combinedOrders = useMemo(() => {
        const map = new Map<string, ComboboxOrderItem>();

        // Local context first for instant availability
        filteredContextOrders.forEach(o => {
            map.set(String(o.id), o);
        });

        // Server results overwrite or extend
        serverResults.forEach(o => {
            map.set(String(o.id), o);
        });

        return Array.from(map.values());
    }, [filteredContextOrders, serverResults]);

    // Find currently selected order details
    const selectedOrder = useMemo(() => {
        if (!value || value === 'none') return null;
        return (
            combinedOrders.find(o => String(o.id) === String(value)) ||
            contextOrders.find(o => String(o.id) === String(value)) ||
            null
        );
    }, [value, combinedOrders, contextOrders]);

    const handleSelect = (orderId: string, orderItem?: ComboboxOrderItem) => {
        onChange(orderId, orderItem);
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('', undefined);
    };

    const getStatusBadge = (statusStr: string) => {
        const s = (statusStr || '').toLowerCase().replace(/[\s_]+/g, '-');
        if (s === 'claimed') {
            return <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Claimed</span>;
        }
        if (s === 'for-release') {
            return <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">For Release</span>;
        }
        if (s === 'on-going') {
            return <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">On-Going</span>;
        }
        return <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">New Order</span>;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Select Job Order"
                    className={`h-9 w-full justify-between rounded-lg border-red-100 bg-white px-3 text-xs font-semibold hover:bg-slate-50 focus:border-red-500 focus:ring-1 focus:ring-red-500 ${className}`}
                >
                    <div className="flex items-center gap-2 truncate min-w-0">
                        {selectedOrder ? (
                            <>
                                <span className="font-bold text-slate-900">{selectedOrder.orderNumber}</span>
                                <span className="text-slate-400 font-normal">({selectedOrder.customerName})</span>
                            </>
                        ) : (
                            <span className="text-slate-500 flex items-center gap-1.5">
                                <Wrench className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{placeholder}</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                        {selectedOrder && (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={handleClear}
                                title="Clear selection (use Workshop / Internal)"
                                className="h-5 w-5 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                                <X className="h-3 w-3" />
                            </div>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 opacity-70" />
                    </div>
                </Button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                sideOffset={4}
                className="w-[var(--radix-popover-trigger-width)] min-w-[300px] max-w-[calc(100vw-2rem)] p-0 rounded-xl border border-slate-200 bg-white shadow-xl z-[9999]"
            >
                {/* Search Header */}
                <div className="p-2.5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                ref={searchInputRef}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search order # or customer name..."
                                className="h-8 pl-8 pr-7 text-xs bg-white border-slate-200 focus:border-red-500 rounded-md w-full"
                            />
                            {isSearching ? (
                                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-500 animate-spin" />
                            ) : searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            ) : null}
                        </div>

                        {/* Compact Filter Menu Button */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                                className="h-8 inline-flex items-center gap-1.5 px-2.5 text-[11px] font-bold rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-red-200 transition-colors shadow-2xs shrink-0"
                                title="Filter by order status"
                            >
                                <Filter size={12} className="text-red-600 shrink-0" />
                                <span className="hidden xs:inline sm:inline truncate max-w-[70px]">
                                    {FILTER_OPTIONS.find(f => f.id === selectedFilter)?.label.replace(' Orders', '') || 'Filter'}
                                </span>
                                <ChevronDown size={11} className="text-slate-400 shrink-0" />
                            </button>

                            {isFilterMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                                    {FILTER_OPTIONS.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedFilter(opt.id);
                                                setIsFilterMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors ${
                                                selectedFilter === opt.id ? 'text-red-600 font-bold bg-red-50/50' : 'text-slate-700'
                                            }`}
                                        >
                                            <span>{opt.label}</span>
                                            {selectedFilter === opt.id && <Check size={12} className="text-red-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Options List */}
                <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 text-xs overscroll-contain touch-pan-y scroll-smooth">
                    {/* Always visible Workshop / Internal option */}
                    <div
                        onClick={() => handleSelect('', undefined)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            !value || value === 'none'
                                ? 'bg-red-50 text-red-700 font-bold border border-red-100'
                                : 'hover:bg-slate-100 text-slate-700'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-slate-400 shrink-0" />
                            <div>
                                <p className="font-bold text-slate-900">None (Workshop / Internal)</p>
                                <p className="text-[10.5px] text-slate-500 font-normal">General inventory usage not billed to a customer order</p>
                            </div>
                        </div>
                        {(!value || value === 'none') && <Check className="h-4 w-4 text-red-600 shrink-0 ml-2" />}
                    </div>

                    {/* Order Results */}
                    {combinedOrders.length > 0 ? (
                        combinedOrders.map(order => {
                            const isSelected = String(order.id) === String(value);
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => handleSelect(String(order.id), order)}
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                        isSelected
                                            ? 'bg-red-50 text-red-900 border border-red-200'
                                            : 'hover:bg-slate-50 text-slate-800'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-slate-900 font-mono text-xs">{order.orderNumber}</p>
                                            {getStatusBadge(order.status)}
                                        </div>
                                        <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                                            {order.customerName}
                                        </p>
                                    </div>
                                    {isSelected && <Check className="h-4 w-4 text-red-600 shrink-0" />}
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-6 text-center text-slate-400">
                            <p className="text-xs font-semibold">No orders found matching your search</p>
                            <p className="text-[10px] mt-0.5">Try searching by order number or customer name</p>
                        </div>
                    )}
                </div>

                {/* Footer Count */}
                <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium rounded-b-xl">
                    <span>Showing {combinedOrders.length} order(s)</span>
                    <span>Filter: {FILTER_OPTIONS.find(f => f.id === selectedFilter)?.label}</span>
                </div>
            </PopoverContent>
        </Popover>
    );
}

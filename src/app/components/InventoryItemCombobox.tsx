import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import type { InventoryItem } from '@/app/context/InventoryContext';

interface InventoryItemComboboxProps {
    items: InventoryItem[] | any[];
    value: string | number;
    onChange: (itemId: string, item?: any) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    autoFocus?: boolean;
}

export default function InventoryItemCombobox({
    items = [],
    value,
    onChange,
    placeholder = "Search / Select Item",
    className = "",
    disabled = false,
    autoFocus = false,
}: InventoryItemComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedItem = useMemo(() => {
        return items.find(i => String(i.id) === String(value)) || null;
    }, [items, value]);

    // Keep input text synced with selected item when dropdown is closed or value changes externally
    useEffect(() => {
        if (!open) {
            setSearch(selectedItem ? selectedItem.name : "");
        }
    }, [selectedItem, open]);

    // Focus input on mount if requested
    useEffect(() => {
        if (autoFocus) {
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [autoFocus]);

    // Filter items based on typed query
    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        // If dropdown is open and search exactly matches the selected item name, show full list so user can choose another
        if (!q || (selectedItem && selectedItem.name.toLowerCase() === q)) {
            return items;
        }
        return items.filter(item => {
            const name = (item.name || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            const num = (item.inventory_number || '').toLowerCase();
            const unit = (item.unit || '').toLowerCase();
            return name.includes(q) || cat.includes(q) || num.includes(q) || unit.includes(q);
        });
    }, [items, search, selectedItem]);

    // Reset highlight index when filtered items change
    useEffect(() => {
        setHighlightedIndex(0);
    }, [filteredItems]);

    // Scroll highlighted option into view
    useEffect(() => {
        if (open && listRef.current) {
            const el = listRef.current.children[highlightedIndex] as HTMLElement;
            if (el) {
                el.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex, open]);

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch(selectedItem ? selectedItem.name : "");
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedItem]);

    const handleSelect = (item: any) => {
        onChange(String(item.id), item);
        setSearch(item.name);
        setOpen(false);
        inputRef.current?.blur();
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('', undefined);
        setSearch('');
        setOpen(true);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) {
                setOpen(true);
            } else if (filteredItems.length > 0) {
                setHighlightedIndex(prev => (prev + 1) % filteredItems.length);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
                setOpen(true);
            } else if (filteredItems.length > 0) {
                setHighlightedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filteredItems[highlightedIndex]) {
                handleSelect(filteredItems[highlightedIndex]);
            } else if (!open) {
                setOpen(true);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            setSearch(selectedItem ? selectedItem.name : "");
            inputRef.current?.blur();
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    disabled={disabled}
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (!open) setOpen(true);
                    }}
                    onFocus={() => {
                        if (!disabled) {
                            setOpen(true);
                            setTimeout(() => inputRef.current?.select(), 40);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full h-9 pl-9 pr-16 text-xs font-semibold rounded-lg border border-red-100 bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400 text-gray-900 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                />

                <div className="absolute right-2 flex items-center gap-1">
                    {(search || value) && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            title="Clear item selection"
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                            <X size={13} />
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            if (!disabled) {
                                setOpen(prev => !prev);
                                inputRef.current?.focus();
                            }
                        }}
                        title={open ? "Close options" : "Show options"}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                        tabIndex={-1}
                    >
                        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Dropdown Options Popup */}
            {open && !disabled && (
                <div 
                    ref={listRef}
                    className="absolute left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-red-100 bg-white shadow-2xl z-50 p-1 divide-y divide-gray-50 animate-in fade-in zoom-in-95 duration-100"
                >
                    {filteredItems.length === 0 ? (
                        <div className="p-3.5 text-center text-xs text-gray-400 font-medium">
                            No items found matching <span className="font-bold text-gray-700">"{search}"</span>
                        </div>
                    ) : (
                        filteredItems.map((item, idx) => {
                            const isSelected = String(item.id) === String(value);
                            const isHighlighted = idx === highlightedIndex;

                            return (
                                <div
                                    key={item.id}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    onClick={() => handleSelect(item)}
                                    className={`px-3 py-2 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                                        isSelected 
                                            ? 'bg-red-50/90 text-red-900 font-semibold' 
                                            : isHighlighted 
                                            ? 'bg-red-50/50 text-gray-900' 
                                            : 'text-gray-800 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="font-bold text-gray-900 truncate">{item.name}</span>
                                        {item.category && (
                                            <span className="text-gray-500 font-mono text-[10px] uppercase bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                                                {item.category}
                                            </span>
                                        )}
                                        {item.inventory_number && (
                                            <span className="text-gray-400 font-mono text-[10px] shrink-0">
                                                {item.inventory_number}
                                            </span>
                                        )}
                                        <span className="text-gray-500 font-medium text-[11px] shrink-0">
                                            ({Number(item.stock || 0).toLocaleString()} {item.unit})
                                        </span>
                                    </div>
                                    {isSelected && (
                                        <Check size={14} className="text-red-600 shrink-0 ml-2" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

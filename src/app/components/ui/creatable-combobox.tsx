"use client"

import * as React from "react"
import { ChevronsUpDown, X, Sparkles } from "lucide-react"
import { Checkbox } from "./checkbox"

import { cn } from "./utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "./command"
import {
    Popover,
    PopoverContent,
    PopoverAnchor,
} from "./popover"
import {
    getStoredCustomOptions,
    saveStoredCustomOption,
    removeStoredCustomOption,
    CUSTOM_OPTION_EVENT,
} from "@/app/lib/customOptions"

interface CreatableComboboxProps {
    options: string[]
    value: string | string[]
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    multiple?: boolean
    storageKey?: string
}

export function CreatableCombobox({
    options,
    value,
    onChange,
    placeholder = "Select...",
    multiple = false,
    storageKey,
}: CreatableComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")
    const [storedCustomOptions, setStoredCustomOptions] = React.useState<string[]>(() => 
        getStoredCustomOptions(storageKey)
    )

    // Listen to custom options updates from other comboboxes/modals
    React.useEffect(() => {
        if (!storageKey) return;
        setStoredCustomOptions(getStoredCustomOptions(storageKey));

        const handleCustomUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{ key: string; option: string; action: string }>;
            if (customEvent.detail?.key === storageKey) {
                setStoredCustomOptions(getStoredCustomOptions(storageKey));
            }
        };

        window.addEventListener(CUSTOM_OPTION_EVENT, handleCustomUpdate);
        return () => {
            window.removeEventListener(CUSTOM_OPTION_EVENT, handleCustomUpdate);
        };
    }, [storageKey]);

    const valueText = Array.isArray(value)
        ? value.map((part) => String(part).trim()).filter(Boolean).join(', ')
        : String(value || '')

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange("")
        setSearchValue("")
    }

    // Combine standard base options with remembered custom options
    const combinedOptions = React.useMemo(() => {
        const set = new Map<string, string>();
        // 1. Add base options
        for (const opt of options) {
            if (!opt) continue;
            const clean = String(opt).trim();
            if (!clean || clean.toLowerCase() === 'other') continue;
            const lower = clean.toLowerCase();
            if (!set.has(lower)) {
                set.set(lower, clean);
            }
        }
        // 2. Add saved custom options
        for (const opt of storedCustomOptions) {
            if (!opt) continue;
            const clean = String(opt).trim();
            if (!clean || clean.toLowerCase() === 'other') continue;
            const lower = clean.toLowerCase();
            if (!set.has(lower)) {
                set.set(lower, clean);
            }
        }
        return Array.from(set.values());
    }, [options, storedCustomOptions]);

    const isBaseOption = React.useCallback((opt: string) => {
        const lower = opt.trim().toLowerCase();
        return options.some(o => String(o).trim().toLowerCase() === lower);
    }, [options]);

    // Check if the current value is one of the available options
    const selectedOptions = multiple ? valueText.split(',').map(s => s.trim()).filter(Boolean) : [];
    const isFixedValue = multiple ? false : combinedOptions.some(opt => opt.toLowerCase() === valueText.toLowerCase());

    const inputRef = React.useRef<HTMLInputElement>(null)

    // Filter suggestions dynamically while typing, removing 'Other' completely from dropdown
    const filteredOptions = React.useMemo(() => {
        const query = searchValue.toLowerCase().trim();
        return combinedOptions.filter((option) => {
            if (option === 'Other' || option.toLowerCase() === 'other') return false;
            if (!query) return true;
            return option.toLowerCase().includes(query);
        });
    }, [combinedOptions, searchValue]);

    const commitCustomOption = (text: string) => {
        const clean = text.trim();
        if (!clean || clean.toLowerCase() === 'other') return;
        if (storageKey) {
            saveStoredCustomOption(storageKey, clean);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div className="relative w-full group">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchValue || valueText}
                            readOnly={isFixedValue && !open && valueText !== 'Other'}
                            onChange={(e) => {
                                setSearchValue(e.target.value)
                                if (!multiple) onChange(e.target.value)
                                if (!open) setOpen(true)
                            }}
                            onFocus={() => {
                                setOpen(true)
                            }}
                            onPointerDown={() => {
                                if (!open) setOpen(true)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchValue.trim()) {
                                    e.preventDefault();
                                    const clean = searchValue.trim();
                                    commitCustomOption(clean);
                                    if (multiple) {
                                        if (!selectedOptions.some(s => s.toLowerCase() === clean.toLowerCase())) {
                                            const newValues = [...selectedOptions, clean];
                                            onChange(newValues.join(', '));
                                        }
                                    } else {
                                        onChange(clean);
                                        setOpen(false);
                                    }
                                    setSearchValue("");
                                }
                            }}
                            placeholder={placeholder}
                            className={cn(
                                "w-full flex h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-100 focus-visible:border-red-100 disabled:cursor-not-allowed disabled:opacity-50 pr-8",
                                isFixedValue && !open ? "cursor-default" : "cursor-text"
                            )}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            {(valueText || searchValue) && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            )}
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpen(!open);
                                }}
                                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
                            </button>
                        </div>
                    </div>
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[max(var(--radix-popover-trigger-width),240px)] min-w-[240px] p-0 shadow-xl border border-gray-200 z-50 overflow-hidden"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (inputRef.current?.parentElement?.parentElement?.contains(target)) {
                        e.preventDefault();
                        return;
                    }
                    if (searchValue.trim()) {
                        commitCustomOption(searchValue.trim());
                    }
                    setSearchValue("")
                }}
            >
                <Command className="w-full flex flex-col max-h-[320px] overflow-hidden">
                    <CommandList className="max-h-[240px] overflow-y-auto pb-4 overscroll-contain">
                        <CommandEmpty className="py-2 px-2 text-xs">
                            {searchValue ? (
                                <div
                                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm px-2 py-1.5 select-none font-medium flex items-center justify-between"
                                    onClick={() => {
                                        const clean = searchValue.trim();
                                        commitCustomOption(clean);
                                        if (multiple) {
                                            if (!selectedOptions.some(s => s.toLowerCase() === clean.toLowerCase())) {
                                                const newValues = [...selectedOptions, clean];
                                                onChange(newValues.join(', '));
                                            }
                                        } else {
                                            onChange(clean)
                                            setOpen(false)
                                        }
                                        setSearchValue("")
                                    }}
                                >
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Sparkles className="w-3 h-3 text-red-500 shrink-0" />
                                        <span>Use "{searchValue.trim()}"</span>
                                    </div>
                                    <span className="text-[10px] text-red-600 bg-red-50 font-semibold px-1.5 py-0.5 rounded border border-red-100">
                                        Save Custom
                                    </span>
                                </div>
                            ) : (
                                <div className="text-muted-foreground px-2 py-1 text-center">
                                    <p>No results found</p>
                                </div>
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {filteredOptions.map((option) => {
                                const isCustom = !isBaseOption(option);
                                return (
                                    <CommandItem
                                        key={option}
                                        value={option}
                                        onSelect={() => {
                                            if (multiple) {
                                                let newValues;
                                                if (selectedOptions.some(s => s.toLowerCase() === option.toLowerCase())) {
                                                    newValues = selectedOptions.filter(s => s.toLowerCase() !== option.toLowerCase());
                                                } else {
                                                    newValues = [...selectedOptions, option];
                                                }
                                                onChange(newValues.join(', '));
                                            } else {
                                                onChange(option)
                                                setOpen(false)
                                                setSearchValue("")
                                            }
                                        }}
                                        className="text-xs group/item flex items-center justify-between"
                                    >
                                        <div className="flex items-center truncate">
                                            {multiple && (
                                                <Checkbox
                                                    checked={selectedOptions.some(s => s.toLowerCase() === option.toLowerCase())}
                                                    className="mr-3"
                                                    tabIndex={-1}
                                                    style={{ pointerEvents: 'none' }}
                                                />
                                            )}
                                            <span className={cn(option === 'Other' && "font-semibold text-red-600")}>
                                                {option}
                                            </span>
                                            {isCustom && (
                                                <span className="ml-2 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                                    Custom
                                                </span>
                                            )}
                                        </div>
                                        {isCustom && storageKey && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeStoredCustomOption(storageKey, option);
                                                }}
                                                title={`Forget "${option}"`}
                                                className="opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-400 hover:text-red-600 rounded transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                    <div className="py-1.5 px-3 border-t border-gray-100 bg-gray-50/95 text-[10px] text-gray-500 font-medium flex items-center justify-between shrink-0 select-none whitespace-nowrap overflow-hidden">
                        <span>Type for custom entry</span>
                        <span className="text-[9px] text-gray-400">Auto-saved</span>
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    )
}


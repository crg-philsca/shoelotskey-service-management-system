"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

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
    PopoverTrigger,
} from "./popover"

interface CreatableComboboxProps {
    options: string[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
}

export function CreatableCombobox({
    options,
    value,
    onChange,
    placeholder = "Select...",
}: CreatableComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")

    // normalize value for comparison
    const normalizedValue = value?.toLowerCase() || ""

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange("")
        setSearchValue("")
    }

    // Check if the current value is one of the standard options (excluding "Other")
    const isFixedValue = options.filter(opt => opt !== 'Other').some(opt => opt.toLowerCase() === value.toLowerCase());

    const inputRef = React.useRef<HTMLInputElement>(null)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full group">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchValue || value || ""}
                            readOnly={isFixedValue && !open}
                            onChange={(e) => {
                                setSearchValue(e.target.value)
                                onChange(e.target.value)
                                if (!open) setOpen(true)
                            }}
                            onFocus={() => {
                                // Just ensure it opens
                                setOpen(true)
                            }}
                            onPointerDown={() => {
                                // For mobile/touch/pointer devices, ensures it opens
                                if (!open) setOpen(true)
                            }}
                            placeholder={value === "" && !searchValue ? "Type custom value..." : placeholder}
                            className={cn(
                                "w-full flex h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-100 focus-visible:border-red-100 disabled:cursor-not-allowed disabled:opacity-50 pr-8",
                                isFixedValue && !open ? "cursor-default" : "cursor-text"
                            )}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            {(value || searchValue) && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            )}
                            <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
                        </div>
                    </div>
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={() => {
                    // Reset search value when closing
                    setSearchValue("")
                }}
            >
                <Command className="w-full">
                    <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty className="py-2 px-2 text-xs">
                            {searchValue ? (
                                <div
                                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm px-2 py-1.5 select-none font-medium flex items-center justify-between"
                                    onClick={() => {
                                        onChange(searchValue)
                                        setOpen(false)
                                        setSearchValue("")
                                    }}
                                >
                                    <span>Use "{searchValue}"</span>
                                    <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">New</span>
                                </div>
                            ) : (
                                <div className="text-muted-foreground px-2 py-1 text-center">
                                    <p>Find or type custom value</p>
                                </div>
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => {
                                        if (option === 'Other') {
                                            onChange("")
                                            setSearchValue("")
                                            // The onSelect would normally close the popover.
                                            // We keep it open to allow immediate typing.
                                            return
                                        }
                                        onChange(option)
                                        setOpen(false)
                                        setSearchValue("")
                                    }}
                                    onPointerDown={(e) => {
                                        if (option === 'Other') {
                                            // Prevent the item click from stealing focus/closing
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onChange("")
                                            setSearchValue("")
                                            inputRef.current?.focus()
                                        }
                                    }}
                                    onPointerUp={(e) => {
                                        if (option === 'Other') {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }
                                    }}
                                    className="text-xs"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center">
                                            <Check
                                                className={cn(
                                                    "mr-2 h-3 w-3",
                                                    normalizedValue === option.toLowerCase() ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className={cn(option === 'Other' && "font-semibold text-red-600")}>
                                                {option === 'Other' ? 'Other (Type custom value...)' : option}
                                            </span>
                                        </div>
                                        {option === 'Other' && (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil opacity-50"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, X, User, Hash, ClipboardList, RotateCcw, Calendar as CalendarIcon, Clock, Sparkles, Info, Search, Check, ChevronDown, Loader2, Camera, Upload, Lock, ShieldCheck, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
const CameraCaptureModal = lazy(() => import('./CameraCaptureModal').then(m => ({ default: m.CameraCaptureModal })));
import { useOrders } from '../context/OrderContext';
import { useServices } from '../context/ServiceContext';
import { hasPermission } from '@/app/lib/permissions';
import { sanitizeClientAuthCode, sanitizeClientUsername, hasMaliciousPattern } from '@/app/lib/security';
import type { ShippingPreference, PaymentMethod, PaymentStatus, Priority } from '@/app/types';
import { format as dateFnsFormat } from 'date-fns';
import { CreatableCombobox } from './ui/creatable-combobox';
import { CUSTOM_OPTION_KEYS, seedCustomOptionsFromOrders, saveStoredCustomOption } from '@/app/lib/customOptions';
import { useInventory } from '../context/InventoryContext';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { API_BASE } from '@/app/lib/apiBase';
import { isAddonVisibleForBaseServices, applyColorCountExclusive, syncColorRenewalAddons, syncFullReglueAddons, shoeHasBothColorCounts, isColorCountAddon, isFullReglueSoleAddon, getApplicableRushFee, validateColorRenewalSelection, validateFullReglueSelection, getSoleAddonPricingDisplay, sortAddonsForDisplay, TWO_COLORS, THREE_COLORS } from '@/app/lib/serviceCompatibility';
import { nextOrderId } from '@/app/lib/orderNumber';
import { calculateOfficialReleaseBreakdown } from '@/app/lib/businessRules';
import { validateCustomerName, CUSTOMER_NAME_MAX_LENGTH, validateSecurityInput, stripCyberAttackInput } from '@/app/lib/customerValidation';
import { compressImageFile, saveOrderAttachments } from '@/app/lib/imageUtils';

function formatMlModelName(name?: string | null): string {
    if (!name) return 'Random Forest';
    if (/heuristic|fallback/i.test(name)) return name;
    if (/random forest/i.test(name)) return 'Random Forest';
    return name;
}

function toDateInputValue(isoOrDate: string | Date | null | undefined): string {
    if (!isoOrDate) return '';
    if (typeof isoOrDate === 'string') {
        const match = isoOrDate.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }
    const parsed = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (!parsed || isNaN(parsed.getTime())) return '';
    return dateFnsFormat(parsed, 'yyyy-MM-dd');
}

export function getPhilippineTimeString(): string {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(new Date());
    } catch {
        return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
}

export function getPhilippineDateString(): string {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    } catch {
        return dateFnsFormat(new Date(), 'yyyy-MM-dd');
    }
}

function formatIdWithHyphens(
    val: string, 
    format: 'alphanumeric' | 'numbers' | 'letters' = 'alphanumeric', 
    maxDigits?: number,
    prevVal?: string
): string {
    if (!val) return '';
    
    let clean = '';
    if (format === 'numbers') {
        clean = val.replace(/\D/g, '');
    } else if (format === 'letters') {
        clean = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
    } else {
        clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }

    // If user hit backspace on a hyphen (e.g. from "12-34" to "1234"), drop the previous char
    if (prevVal && val.length < prevVal.length) {
        let prevClean = '';
        if (format === 'numbers') {
            prevClean = prevVal.replace(/\D/g, '');
        } else if (format === 'letters') {
            prevClean = prevVal.replace(/[^a-zA-Z]/g, '').toUpperCase();
        } else {
            prevClean = prevVal.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        }

        if (clean === prevClean && clean.length > 0) {
            clean = clean.slice(0, -1);
        }
    }

    if (maxDigits && maxDigits > 0) {
        clean = clean.slice(0, maxDigits);
    } else if (clean.length > 30) {
        clean = clean.slice(0, 30);
    }

    const chunks = clean.match(/.{1,2}/g);
    return chunks ? chunks.join('-') : '';
}

function isValidIdInput(val: string, format: 'alphanumeric' | 'numbers' | 'letters' = 'alphanumeric', expectedDigits?: number): boolean {
    const clean = (val || '').replace(/-/g, '').trim();
    if (clean.length === 0) return false;
    if (expectedDigits && expectedDigits > 0 && clean.length !== expectedDigits) {
        return false;
    }
    if (format === 'numbers') {
        return /^\d+$/.test(clean);
    }
    if (format === 'letters') {
        return /^[a-zA-Z]+$/.test(clean);
    }
    return /^[a-zA-Z0-9]+$/.test(clean);
}

type ServerPrediction = {
    predicted_date?: string;
    predicted_date_ymd?: string;
    predicted_days?: number;
    source?: string;
    algorithm?: string;
    model_loaded?: boolean;
    fallback_reason?: string | null;
    authoritative?: string;
    standard_base_days?: number | null;
    standard_release_days?: number | null;
    standard_release_date?: string | null;
    standard_rollover_days?: number | null;
    standard_has_rollover?: boolean;
    business_rule_days?: number;
    business_rule_date?: string;
    ml_raw_prediction_days?: number | null;
    ml_elapsed_days?: number | null;
    ml_predicted_turnaround_days?: number | null;
    ml_base_days?: number | null;
    ml_predicted_release_date?: string | null;
    ml_rollover_days?: number | null;
    ml_has_rollover?: boolean;
    ml_safety_rollover_days?: number | null;
    ml_has_safety_rollover?: boolean;
    ml_predicted_days?: number | null;
    ml_predicted_date?: string | null;
    ml_model?: string;
    ml_status?: string;
    ml_source?: string;
    ml_reason?: string | null;
    model_status?: string;
    model_role?: string;
    prediction_target?: string;
};

// Dropdown options
const SHOE_BRANDS = [
    'Other', 'Nike', 'Adidas', 'Asics', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 'Jordan',
    'Under Armour', 'Timberland', 'Dr. Martens', 'Salomon', 'Merrell', 'Skechers', 'Mizuno',
    'Brooks', 'Saucony', 'Hoka', 'On Cloud'
];

const SHOE_MATERIALS = [
    'Other', 'Leather', 'Synthetic', 'Canvas', 'Mesh', 'Rubber', 'Textile', 'Suede', 'Knit', 'Patent Leather', 'Denim', 'Nubuck'
];

const SHOE_COLORS = [
    'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Brown', 'Grey', 'Navy', 'Beige', 'Pink', 'Purple', 'Orange', 'Other'
];

const SHOE_SIZES = [
    '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12', '13',
    '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'
];

const BRAND_MODELS: Record<string, string[]> = {
    'Nike': ['Air Force 1', 'Dunk Low', 'Air Max 90', 'Air Max 97', 'Cortez', 'Blazer', 'Pegasus', 'Other'],
    'Jordan': ['Air Jordan 1', 'Air Jordan 3', 'Air Jordan 4', 'Air Jordan 11', 'Other'],
    'Adidas': ['Superstar', 'Stan Smith', 'Ultraboost', 'Yeezy Boost 350', 'Samba', 'Gazelle', 'NMD', 'Other'],
    'Vans': ['Old Skool', 'Slip-On', 'Sk8-Hi', 'Authentic', 'Era', 'Other'],
    'Converse': ['Chuck Taylor All Star', 'Chuck 70', 'One Star', 'Run Star Hike', 'Other'],
    'New Balance': ['550', '990', '2002R', '574', '327', '9060', 'Other'],
    'Asics': ['Gel-Kayano', 'Gel-Lyte III', 'Gel-Nimbus', 'Other'],
    'Puma': ['Suede', 'RS-X', 'Cali', 'Rider', 'Other'],
    'Reebok': ['Club C 85', 'Classic Leather', 'Instapump Fury', 'Other'],
    'Under Armour': ['Curry', 'HOVR', 'Charged', 'Other'],
    'Timberland': ['6-Inch Premium Boot', 'Chukka', 'Boat Shoe', 'Other'],
    'Dr. Martens': ['1460 8-Eye Boot', '1461 3-Eye Shoe', 'Jadon', 'Chelsea Boot', 'Other'],
    'Salomon': ['XT-6', 'Speedcross', 'Other'],
    'Merrell': ['Moab', 'Jungle Moc', 'Other'],
    'Skechers': ['D\'Lites', 'Go Walk', 'Uno', 'Other'],
    'Mizuno': ['Wave Rider', 'Wave Inspire', 'Other'],
    'Brooks': ['Ghost', 'Adrenaline GTS', 'Glycerin', 'Other'],
    'Saucony': ['Jazz Original', 'Kinvara', 'Shadow', 'Other'],
    'Hoka': ['Clifton', 'Bondi', 'Speedgoat', 'Other'],
    'On Cloud': ['Cloudmonster', 'Cloudnova', 'Cloudstratus', 'Cloud 5', 'Other']
};

// Derived data for intelligent brand-model discovery
const ALL_MODELS = Object.values(BRAND_MODELS).flat().filter(m => m !== 'Other');
const MODEL_TO_BRAND: Record<string, string> = {};
Object.entries(BRAND_MODELS).forEach(([brand, models]) => {
    models.forEach(model => {
        if (model !== 'Other' && !MODEL_TO_BRAND[model]) {
            MODEL_TO_BRAND[model] = brand;
        }
    });
});

const MODEL_MATERIALS: Record<string, string>  = {
    // Nike
    'Air Force 1': 'Leather',
    'Dunk Low': 'Leather',
    'Air Max 90': 'Mesh',
    'Air Max 97': 'Mesh',
    'Cortez': 'Leather',
    'Blazer': 'Leather',
    // Jordan
    'Air Jordan 1': 'Leather',
    'Air Jordan 3': 'Leather',
    'Air Jordan 4': 'Leather',
    'Air Jordan 11': 'Patent Leather',
    // Adidas
    'Superstar': 'Leather',
    'Stan Smith': 'Leather',
    'Samba': 'Leather',
    'Ultraboost': 'Knit',
    'Yeezy Boost 350': 'Knit',
    'Gazelle': 'Suede',
    // Others
    'Club C 85': 'Leather',
    'Classic Leather': 'Leather',
    'Old Skool': 'Canvas',
    'Slip-On': 'Canvas',
    'Sk8-Hi': 'Canvas',
    'Authentic': 'Canvas',
    'Chuck Taylor All Star': 'Canvas',
    'Chuck 70': 'Canvas',
    '550': 'Leather',
    '574': 'Suede',
    '990': 'Suede',
    '2002R': 'Suede',
    'Gel-Lyte III': 'Suede',
    'Suede': 'Suede',
    '6-Inch Premium Boot': 'Nubuck',
    '1460 8-Eye Boot': 'Leather',
    '1461 3-Eye Shoe': 'Leather',
    'XT-6': 'Synthetic',
    'Moab': 'Leather',
    'Clifton': 'Mesh',
    'Bondi': 'Mesh',
    'Cloud 5': 'Mesh',
    'Cloudmonster': 'Mesh'
};

const DELIVERY_COURIERS = [
    'Lalamove', 'JRS', 'LBC', 'Grab', 'Other'
];

interface ShoeEntry {
    id: string;
    brand: string;
    otherBrand?: string;
    shoeMaterial: string;
    shoeModel: string;
    otherMaterial?: string;
    otherModel?: string;
    color?: string;
    otherColor?: string;
    shoeSize?: string;
    quantity: number;
    priorityLevel?: Priority;
    rushReductionDays?: string;
    beforeImage?: string;
    afterImage?: string;
    condition: {
        scratches: boolean;
        ripsHoles: boolean;
        wornOut: boolean;
        soleSeparation: boolean;
        yellowing: boolean;
        deepStains: boolean;
        others: string;
    };
    baseService: string[];
    addOns: { name: string; quantity?: number }[];
    inventoryUsed: { itemId: number; amount: number }[];
}



const LABEL_STYLE = "text-[11px] font-bold text-gray-700 mb-1 block uppercase tracking-tight";
const INPUT_STYLE = "bg-white border-gray-100 h-9 text-xs focus:ring-red-50 focus:border-red-100 transition-all shadow-sm";


const CARD_HEADER_STYLE = "bg-red-50/50 py-2 px-3.5 sm:px-6 border-b border-red-100/50";
const CARD_TITLE_STYLE = "text-gray-600 font-black text-xs sm:text-[14px] uppercase tracking-widest flex items-center gap-2";

function ClearableInput({ id, value, onChange, onClear, placeholder, className, required, type = "text", inputMode, maxLength, ...rest }: any) {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e?.target?.value;
        if (typeof raw === 'string' && (raw.includes('<') || raw.includes('>') || raw.toLowerCase().includes('script'))) {
            e.target.value = stripCyberAttackInput(raw);
        }
        onChange?.(e);
    };

    return (
        <div className="relative group/input">
            <Input
                id={id}
                name={rest?.name || id}
                value={value}
                onChange={handleInputChange}
                placeholder={placeholder}
                className={`${className} ${value ? 'pr-8' : ''}`}
                required={required}
                type={type}
                inputMode={inputMode}
                maxLength={maxLength}
                {...rest}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => {
                        if (onClear) onClear();
                        else onChange({ target: { value: '' } } as any);
                    }}
                    aria-label={`Clear ${placeholder || id || 'input'}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[24px] min-h-[24px] flex items-center justify-center p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors opacity-0 group-hover/input:opacity-100 cursor-pointer"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}

function FormattedDateInput({ value, onChange, className, id, iconClassName }: { value: string; onChange: (val: string) => void; className?: string; id?: string; iconClassName?: string }) {
    const hiddenDateRef = useRef<HTMLInputElement>(null);

    const toDisplay = (iso: string) => {
        if (!iso) return '';
        const parts = iso.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return iso;
    };

    const [localVal, setLocalVal] = useState(toDisplay(value));

    useEffect(() => {
        setLocalVal(toDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputVal = e.target.value;
        let digits = inputVal.replace(/[^0-9]/g, '');
        if (digits.length > 8) digits = digits.substring(0, 8);

        let formatted = digits;
        if (digits.length > 2) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2);
        }
        if (digits.length > 4) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4);
        }

        setLocalVal(formatted);

        if (digits.length === 8) {
            const mm = digits.substring(0, 2);
            const dd = digits.substring(2, 4);
            const yyyy = digits.substring(4, 8);
            const iso = `${yyyy}-${mm}-${dd}`;
            const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            if (!isNaN(dateObj.getTime())) {
                onChange(iso);
            }
        }
    };

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isoVal = e.target.value;
        if (isoVal) {
            setLocalVal(toDisplay(isoVal));
            onChange(isoVal);
        }
    };

    const openPicker = () => {
        if (hiddenDateRef.current) {
            if (typeof hiddenDateRef.current.showPicker === 'function') {
                hiddenDateRef.current.showPicker();
            } else {
                hiddenDateRef.current.click();
            }
        }
    };

    return (
        <div className="relative w-full flex items-center">
            <Input
                id={id}
                name={id}
                type="text"
                placeholder="MM/DD/YYYY"
                value={localVal}
                onChange={handleChange}
                className={`${className || ''} pr-8 text-left`}
            />
            <button
                type="button"
                onClick={openPicker}
                title="Select date"
                aria-label={id ? `Select ${id}` : 'Select date'}
                className={`absolute right-2.5 ${iconClassName || 'text-gray-400'} hover:text-red-600 transition-colors cursor-pointer min-w-[24px] min-h-[24px] flex items-center justify-center p-0.5`}
            >
                <CalendarIcon size={14} />
            </button>
            <input
                ref={hiddenDateRef}
                type="date"
                id={id ? `${id}-native-date` : 'native-date-picker'}
                name={id ? `${id}-native-date` : 'native-date-picker'}
                aria-label={id ? `${id} picker` : 'Date picker'}
                value={value || ''}
                onChange={handlePickerChange}
                className="sr-only absolute pointer-events-none opacity-0"
                tabIndex={-1}
            />
        </div>
    );
}

function FormattedTimeInput({ value, onChange, className, id }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; className?: string; id?: string }) {
    const hiddenTimeRef = useRef<HTMLInputElement>(null);

    const openPicker = () => {
        if (hiddenTimeRef.current) {
            if (typeof hiddenTimeRef.current.showPicker === 'function') {
                hiddenTimeRef.current.showPicker();
            } else {
                hiddenTimeRef.current.click();
            }
        }
    };

    return (
        <div className="relative w-full flex items-center">
            <Input
                id={id}
                name={id}
                ref={hiddenTimeRef}
                type="time"
                aria-label={id ? (id === 'orderTime' ? 'Order Time' : id === 'releaseTime' ? 'Release Time' : id) : 'Time picker'}
                value={value}
                onChange={onChange}
                className={`${className || ''} pr-8 text-left font-normal [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            />
            <button
                type="button"
                onClick={openPicker}
                title="Select time"
                aria-label={id ? `Select ${id}` : 'Select time'}
                className="absolute right-2.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer min-w-[24px] min-h-[24px] flex items-center justify-center p-0.5 pointer-events-none"
            >
                <Clock size={14} />
            </button>
        </div>
    );
}

export interface JobOrderFormProps {
    user?: { username: string; role: 'owner' | 'staff' | 'admin' | 'front staff', token?: string };
    onSuccess?: () => void;
    onCancel?: () => void;
    initialOrder?: any;
    mode?: 'create' | 'edit';
}

function shoeColorValue(shoe: { color?: string | string[]; otherColor?: string }) {
    const raw = shoe.color === 'Other' ? (shoe.otherColor || '') : (shoe.color || '');
    if (Array.isArray(raw)) return raw.map((c) => String(c).trim()).filter(Boolean).join(', ');
    return String(raw || '').trim();
}

export function getItemRetailPrice(item: any): number {
    if (!item) return 0;
    const isRetail = Boolean(item.is_retail ?? item.isRetail);
    if (!isRetail) return 0;
    const price = Number(item.retail_price ?? item.retailPrice ?? 0);
    return isNaN(price) || price < 0 ? 0 : price;
}

function formatPesoValue(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (isNaN(num)) return '\u20B10.00';
    return '\u20B1' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InventorySearchSelect({
    value,
    onValueChange,
    inventoryData,
}: {
    value: number | string;
    onValueChange: (val: string) => void;
    inventoryData: any[];
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedItem = useMemo(() => {
        return inventoryData.find((i: any) => i.id?.toString() === value?.toString());
    }, [inventoryData, value]);

    const selectedPresentation = useMemo(() => {
        return selectedItem ? getInventoryPresentation(selectedItem) : null;
    }, [selectedItem]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return inventoryData;
        return inventoryData.filter((inv: any) => {
            const pres = getInventoryPresentation(inv);
            const name = (inv.name || '').toLowerCase();
            const cat = (inv.category || '').toLowerCase();
            const unit = (inv.unit || '').toLowerCase();
            const label = (pres?.dropdownLabel || '').toLowerCase();
            return name.includes(q) || cat.includes(q) || unit.includes(q) || label.includes(q);
        });
    }, [inventoryData, search]);

    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 60);
            return () => clearTimeout(timer);
        } else {
            setSearch("");
        }
    }, [open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="h-8 text-[11px] font-bold border border-transparent hover:border-gray-200 shadow-none flex-1 flex items-center justify-between px-2 bg-transparent hover:bg-gray-50/80 rounded-md transition-colors text-left truncate gap-2 cursor-pointer group"
                >
                    <span className="truncate text-gray-800">
                        {selectedItem && selectedPresentation ? (
                            `${selectedItem.name} - ${selectedPresentation.dropdownLabel}`
                        ) : (
                            <span className="text-gray-400 font-normal">Select supply or material...</span>
                        )}
                    </span>
                    <ChevronDown size={13} className="text-gray-400 group-hover:text-gray-600 shrink-0 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[300px] sm:w-[360px] p-2 bg-white rounded-xl shadow-xl border border-gray-200/80 z-50"
                align="start"
                sideOffset={4}
            >
                <div className="relative mb-2">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        ref={inputRef}
                        id="inventory-search-input"
                        name="inventory-search-input"
                        type="text"
                        aria-label="Search supplies, volume, container"
                        placeholder="Search supplies, volume, container..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-7 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-100 focus:border-red-200 transition-all font-medium text-gray-800 placeholder:text-gray-500"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[24px] min-h-[24px] flex items-center justify-center p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-400 font-medium">
                            No supplies found matching <span className="font-semibold text-gray-600">"{search}"</span>
                        </div>
                    ) : (
                        filteredItems.map((inv: any) => {
                            const pres = getInventoryPresentation(inv);
                            const invRetPrice = getItemRetailPrice(inv);
                            const isSelected = inv.id?.toString() === value?.toString();

                            return (
                                <button
                                    key={inv.id}
                                    type="button"
                                    onClick={() => {
                                        onValueChange(inv.id?.toString() || "");
                                        setOpen(false);
                                    }}
                                    className={`w-full text-left px-2.5 py-2 text-[11px] rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                        isSelected
                                            ? "bg-red-50 text-red-700 font-bold"
                                            : "hover:bg-gray-50 text-gray-700 font-medium"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                        {isSelected ? (
                                            <Check size={12} className="text-red-600 shrink-0" />
                                        ) : (
                                            <span className="w-3 shrink-0" />
                                        )}
                                        <span className="truncate">
                                            {inv.name} - {pres.dropdownLabel}
                                        </span>
                                    </div>
                                    {invRetPrice > 0 && (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                            Retail: {formatPesoValue(invRetPrice)}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function formatPhilippineContactNumber(value: string): string {
    let digitsOnly = (value || '').replace(/\D/g, '');
    if (!digitsOnly) return '';
    // Enforce contact number to always start with 09
    if (digitsOnly.startsWith('639')) {
        digitsOnly = '09' + digitsOnly.slice(3);
    } else if (digitsOnly.startsWith('9')) {
        digitsOnly = '0' + digitsOnly;
    } else if (digitsOnly.startsWith('0')) {
        if (!digitsOnly.startsWith('09')) {
            digitsOnly = '09' + digitsOnly.slice(1);
        }
    } else {
        digitsOnly = '09' + digitsOnly;
    }
    digitsOnly = digitsOnly.slice(0, 11);
    // Format as 09xx-xxx-xxxx
    let formatted = '';
    for (let i = 0; i < digitsOnly.length; i++) {
        formatted += digitsOnly[i];
        if ((i === 3 || i === 6) && i !== digitsOnly.length - 1) {
            formatted += '-';
        }
    }
    return formatted;
}

export default function JobOrderFormComponent({ user, onSuccess, onCancel, initialOrder, mode = 'create' }: JobOrderFormProps) {
    const { addOrder, orders } = useOrders();
    const { services, authorizationCode } = useServices();
    const { inventoryData } = useInventory();
    const [customerName, setCustomerName] = useState('');
    const [contactNumber, setContactNumber] = useState(() => initialOrder?.contactNumber ? formatPhilippineContactNumber(initialOrder.contactNumber) : '');
    // State for Shipping Preference
    const [shippingPreference, setShippingPreference] = useState<string>("pickup");
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const [cameraModalShoeId, setCameraModalShoeId] = useState<string | null>(null);

    // Strictly check if current account is Admin account
    const currentLoggedInUser = useMemo(() => {
        if (user && (user.role || user.username)) return user;
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
                if (stored) return JSON.parse(stored);
            } catch {}
        }
        return null;
    }, [user]);

    const isAdminAccount = useMemo(() => {
        const role = String(currentLoggedInUser?.role?.role_name || currentLoggedInUser?.role || '').toLowerCase().trim();
        const uname = String(currentLoggedInUser?.username || '').toLowerCase().trim();
        return role === 'admin' || uname === 'admin';
    }, [currentLoggedInUser]);

    const isOwnerOrAdminUser = useMemo(() => {
        const role = String(currentLoggedInUser?.role?.role_name || currentLoggedInUser?.role || user?.role || '').toLowerCase().trim();
        const uname = String(currentLoggedInUser?.username || user?.username || '').toLowerCase().trim();
        return role === 'owner' || role === 'admin' || uname === 'owner' || uname === 'admin' || uname === 'expert_owner';
    }, [currentLoggedInUser, user]);

    const canSelfAuthorizeDiscounts = useMemo(() => {
        if (isOwnerOrAdminUser) return true;
        return hasPermission(user, 'discounts.authorize');
    }, [isOwnerOrAdminUser, user]);

    const canStaffUseAuthCode = useMemo(() => {
        if (isOwnerOrAdminUser) return true;
        return hasPermission(user, 'discounts.use_auth_code') || hasPermission(user, 'discounts.authorize');
    }, [isOwnerOrAdminUser, user]);

    const canApplyDiscounts = useMemo(() => {
        if (isOwnerOrAdminUser) return true;
        return hasPermission(user, 'discounts.apply');
    }, [isOwnerOrAdminUser, user]);

    // Automatically seed stored custom options from past orders so they appear in dropdowns (deferred to protect FCP/LCP)
    useEffect(() => {
        if (orders && orders.length > 0) {
            const timer = setTimeout(() => {
                if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                    (window as any).requestIdleCallback(() => {
                        seedCustomOptionsFromOrders(orders);
                    });
                } else {
                    seedCustomOptionsFromOrders(orders);
                }
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [orders]);

    // [REQUIREMENT 9] Smarter Search: Match any partial word across previous customer names (e.g. "John" finds "John Michael", "John Dela Cruz")
    const customerSuggestions = useMemo(() => {
        const query = customerName.trim().toLowerCase();
        if (query.length < 1) return [];
        const queryTerms = query.split(/\s+/).filter(Boolean);

        const customerMap = new Map<string, { name: string; contactNumber: string; }>();

        orders.forEach(order => {
            if (!order.customerName) return;
            const nameKey = order.customerName.trim().toLowerCase();
            if (!customerMap.has(nameKey)) {
                customerMap.set(nameKey, {
                    name: order.customerName.trim(),
                    contactNumber: order.contactNumber || ''
                });
            }
        });

        return Array.from(customerMap.values()).filter(cust => {
            const custNameLower = cust.name.toLowerCase();
            return queryTerms.every(term => custNameLower.includes(term));
        }).slice(0, 6);
    }, [customerName, orders]);


    // Auto-reset priority level if conditions are not met


    const [shoes, setShoes] = useState<ShoeEntry[]>([{
        id: Date.now().toString(),
        brand: '',
        shoeMaterial: '',
        shoeModel: '',
        shoeSize: '',
        color: '',
        quantity: 1,
        priorityLevel: 'regular',
        condition: {
            scratches: false,
            ripsHoles: false,
            wornOut: false,
            soleSeparation: false,
            yellowing: false,
            deepStains: false,
            others: '',
        },
        baseService: [],
        addOns: [],
        inventoryUsed: [],
    }]);

    const [priorityLevel, setPriorityLevel] = useState<Priority>('regular');
    const [basicCleaningRushReduction, setBasicCleaningRushReduction] = useState('9');
    const [deliveryAddress, setDeliveryAddress] = useState({
        houseNo: '',
        street: '',
        province: '',
        city: '',
        barangay: '',
        zipCode: '',
    });
    const [deliveryCourier, setDeliveryCourier] = useState('');
    const [otherCourier, setOtherCourier] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('downpayment');
    const [amountReceived, setAmountReceived] = useState('0.00');
    const [depositAmount, setDepositAmount] = useState('0.00');
    const [isDepositAmountCustom, setIsDepositAmountCustom] = useState(false);
    const [discountPreset, setDiscountPreset] = useState<string>('0');
    const [customDiscountType, setCustomDiscountType] = useState<'percent' | 'amount'>('percent');
    const [customDiscountValue, setCustomDiscountValue] = useState<string>('');
    const [enteredDiscountCode, setEnteredDiscountCode] = useState<string>('');
    const [discountIdNumber, setDiscountIdNumber] = useState<string>('');
    const [authorizedByUserId, setAuthorizedByUserId] = useState<number | null>(null);
    const [authorizedByUsername, setAuthorizedByUsername] = useState<string | null>(null);
    const [authUsername, setAuthUsername] = useState<string>('');
    const [authCredential, setAuthCredential] = useState<string>('');
    const [authMethod, setAuthMethod] = useState<'code' | 'credentials'>('code');
    const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);
    const [showDiscountAuthSecret, setShowDiscountAuthSecret] = useState<boolean>(false);

    const handleAuthorizeDiscount = async () => {
        const cleanUsername = sanitizeClientUsername(authUsername.trim());
        if (!cleanUsername || !authCredential) {
            toast.error('Please enter authorizer username and password.');
            return;
        }
        if (hasMaliciousPattern(cleanUsername) || hasMaliciousPattern(authCredential)) {
            toast.error('Malicious script or injection payload detected.');
            return;
        }
        setIsAuthorizing(true);
        try {
            const resp = await fetch(`${API_BASE}/discounts/authorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user?.token}`
                },
                body: JSON.stringify({
                    authorizer_username: cleanUsername,
                    authorizer_credential: authCredential,
                    discount_type: selectedDiscountService?.name || (discountPreset === 'custom' ? 'Custom Discount' : 'Standard Discount'),
                    discount_rate: totals?.grossSubtotal > 0 ? ((totals.discountAmount || 0) / totals.grossSubtotal) * 100 : 0
                })
            });
            if (resp.ok) {
                const data = await resp.json();
                setAuthorizedByUserId(data.authorizer_user_id);
                setAuthorizedByUsername(data.authorizer_username);
                setAuthCredential('');
                toast.success(`Discount authorized by ${data.authorizer_username} (${data.authorizer_role || 'Supervisor'})`);
            } else {
                const err = await resp.json().catch(() => ({}));
                toast.error(err.detail || 'Authorization failed. Authorizer must be Owner or have discount authorization permission.');
            }
        } catch (e) {
            toast.error('Network error during discount authorization.');
        } finally {
            setIsAuthorizing(false);
        }
    };
    const [referenceNo, setReferenceNo] = useState('');
    // shelfLocation removed
    const [orderDate, setOrderDate] = useState(getPhilippineDateString());
    const [orderTime, setOrderTime] = useState(getPhilippineTimeString());
    const [manualReleaseDate, setManualReleaseDate] = useState('');
    const [releaseTime, setReleaseTime] = useState('');

    // Form intake duration tracking (Digital vs Paper-based Manual System efficiency)
    const formStartTimeRef = useRef<number>(Date.now());

    // Past / Backfill Order Encoding Support
    const [isPastOrderMode, setIsPastOrderMode] = useState(false);
    const [pastOrderStatus, setPastOrderStatus] = useState<'claimed' | 'for-release' | 'on-going' | 'new-order'>('new-order');
    const [pastOrderClaimedDate, setPastOrderClaimedDate] = useState<string>('');
    const [serverPrediction, setServerPrediction] = useState<ServerPrediction | null>(null);
    const [predictionLoading, setPredictionLoading] = useState(false);
    const [predictionError, setPredictionError] = useState(false);
    const [isMlModalOpen, setIsMlModalOpen] = useState(false);
    const latestPredictionRequestIdRef = useRef<number>(0);

    useEffect(() => {
        if (initialOrder) {
            setCustomerName(initialOrder.customerName || '');
            setContactNumber(initialOrder.contactNumber ? formatPhilippineContactNumber(initialOrder.contactNumber) : '');
            setShippingPreference(initialOrder.shippingPreference || 'pickup');
            // Assuming deliveryAddress is a string for now, if it's supposed to be parsed, we handle it
            if (initialOrder.deliveryAddress && typeof initialOrder.deliveryAddress === 'string') {
                const parts = initialOrder.deliveryAddress.split(', ');
                if (parts.length >= 4) {
                    setDeliveryAddress({
                        houseNo: '',
                        street: parts[0] || '',
                        barangay: parts[1] || '',
                        city: parts[2] || '',
                        province: parts[3] || '',
                        zipCode: parts[4] || ''
                    });
                } else {
                    // simple fallback
                    setDeliveryAddress({ houseNo: '', street: initialOrder.deliveryAddress, province: '', city: '', barangay: '', zipCode: '' });
                }
            }
            setPriorityLevel(initialOrder.priorityLevel || 'regular');
            setShoes(initialOrder.items?.map((item: any) => ({
                id: item.id || Date.now().toString(),
                brand: item.brand || '',
                shoeModel: item.shoeModel || '',
                shoeMaterial: item.shoeMaterial || '',
                shoeSize: item.shoeSize || '',
                color: item.color || '',
                quantity: item.quantity || 1,
                priorityLevel: (item.priorityLevel || initialOrder.priorityLevel || 'regular') as Priority,
                condition: item.condition || {
                    scratches: false,
                    yellowing: false,
                    ripsHoles: false,
                    deepStains: false,
                    soleSeparation: false,
                    wornOut: false,
                    others: ''
                },
                baseService: item.baseService || [],
                addOns: item.addOns || [],
                inventoryUsed: item.inventoryUsed || [],
                beforeImage: item.beforeImage || '',
                afterImage: item.afterImage || '',
            })) || []);
            setPaymentMethod(initialOrder.paymentMethod || 'cash');
            setPaymentStatus(initialOrder.paymentStatus || 'unpaid');
            setDepositAmount(initialOrder.depositAmount ? initialOrder.depositAmount.toString() : '');
            setManualReleaseDate(initialOrder.manualReleaseDate || '');
            setReleaseTime(initialOrder.releaseTime || '');
            if (initialOrder.deliveryCourier) {
                setDeliveryCourier(initialOrder.deliveryCourier);
            }
            if (initialOrder.province) {
                setDeliveryAddress(prev => ({ ...prev, province: initialOrder.province || '' }));
            }
            if (initialOrder.city) {
                setDeliveryAddress(prev => ({ ...prev, city: initialOrder.city || '' }));
            }
            if (initialOrder.barangay) {
                setDeliveryAddress(prev => ({ ...prev, barangay: initialOrder.barangay || '' }));
            }
            if (initialOrder.zipCode) {
                setDeliveryAddress(prev => ({ ...prev, zipCode: initialOrder.zipCode || '' }));
            }
            
            setPaymentMethod(initialOrder.paymentMethod || 'cash');
            setPaymentStatus(initialOrder.paymentStatus || 'pending');
            if (initialOrder.amountReceived) {
                setAmountReceived(initialOrder.amountReceived.toString());
            }
            if (initialOrder.referenceNo) {
                setReferenceNo(initialOrder.referenceNo);
            }
            if (initialOrder.items && initialOrder.items.length > 0) {
                setShoes(initialOrder.items.map((item: any) => ({
                    id: item.id || Date.now().toString(),
                    brand: item.brand || '',
                    shoeModel: item.shoeModel || '',
                    shoeMaterial: item.shoeMaterial || '',
                    shoeSize: item.shoeSize || '',
                    color: item.color || '',
                    quantity: item.quantity || 1,
                    priorityLevel: (item.priorityLevel || initialOrder.priorityLevel || 'regular') as Priority,
                    condition: item.condition || {
                        scratches: false, ripsHoles: false, wornOut: false, soleSeparation: false, yellowing: false, deepStains: false, others: ''
                    },
                    baseService: item.baseService || [],
                    addOns: item.addOns || [],
                    inventoryUsed: []
                })));
            } else {
                setShoes([{
                    id: Date.now().toString(),
                    brand: initialOrder.brand || '',
                    shoeModel: initialOrder.shoeModel || '',
                    shoeMaterial: initialOrder.shoeMaterial || '',
                    shoeSize: initialOrder.shoeSize || '',
                    color: initialOrder.color || '',
                    quantity: initialOrder.quantity || 1,
                    priorityLevel: (initialOrder.priorityLevel || 'regular') as Priority,
                    condition: initialOrder.condition || {
                        scratches: false, ripsHoles: false, wornOut: false, soleSeparation: false, yellowing: false, deepStains: false, others: ''
                    },
                    baseService: initialOrder.baseService || [],
                    addOns: initialOrder.addOns || [],
                    inventoryUsed: []
                }]);
            }
            if (initialOrder.createdAt) {
                 const dt = new Date(initialOrder.createdAt);
                 setOrderDate(toDateInputValue(initialOrder.createdAt));
                 setOrderTime(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
            }
            if (initialOrder.predictedCompletionDate) {
                 const dt = new Date(initialOrder.predictedCompletionDate);
                 setManualReleaseDate(toDateInputValue(initialOrder.predictedCompletionDate));
                 setReleaseTime(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
            }
        }
    }, [initialOrder]);

    const handleResetForm = () => {
        // Reset Customer Info
        setCustomerName('');
        setContactNumber('');
        setShippingPreference('pickup');

        setDeliveryAddress({
            houseNo: '',
            street: '',
            province: '',
            city: '',
            barangay: '',
            zipCode: '',
        });
        setDeliveryCourier('');
        setOtherCourier('');

        // Reset Shoes
        setShoes([{
            id: '1',
            brand: '',
            shoeMaterial: '',
            shoeModel: '',
            shoeSize: '',
            color: '',
            quantity: 1,
            priorityLevel: 'regular',
            condition: {
                scratches: false,
                ripsHoles: false,
                wornOut: false,
                soleSeparation: false,
                yellowing: false,
                deepStains: false,
                others: '',
            },
            baseService: [],
            addOns: [],
            inventoryUsed: [],
        }]);

        // Reset Order Details
        setPriorityLevel('regular');
        setBasicCleaningRushReduction('9');
        setPaymentMethod('cash');
        setPaymentStatus('downpayment');
        setAmountReceived('');
        setDepositAmount('');
        setIsDepositAmountCustom(false);
        setIsAmountReceivedTyped(false);
        setDiscountPreset('0');
        setCustomDiscountValue('');
        setCustomDiscountType('percent');
        setEnteredDiscountCode('');
        setDiscountIdNumber('');
        setAuthorizedByUserId(null);
        setAuthorizedByUsername(null);
        setAuthUsername('');
        setAuthCredential('');
        setAuthMethod('code');
        setShowDiscountAuthSecret(false);
        setReferenceNo('');
        setOrderDate(getPhilippineDateString());
        setOrderTime(getPhilippineTimeString());
        setManualReleaseDate('');
        setReleaseTime('');
        setIsPastOrderMode(false);
        setPastOrderStatus('new-order');
        setPastOrderClaimedDate('');
        formStartTimeRef.current = Date.now();
        toast.info('Form has been reset.');
    };
    const [generatedOrderNumber, setGeneratedOrderNumber] = useState(() => {
        const safeOrders = Array.isArray(orders) ? orders : [];
        const existingNumbers = safeOrders
            .map(o => o && o.orderNumber)
            .filter((n): n is string => typeof n === 'string');
        const targetDate = getPhilippineDateString();
        return nextOrderId(targetDate, existingNumbers);
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        const safeOrders = Array.isArray(orders) ? orders : [];
        const existingNumbers = safeOrders
            .map(o => o && o.orderNumber)
            .filter((n): n is string => typeof n === 'string');
        const targetDate = orderDate || new Date();
        const nextId = nextOrderId(targetDate, existingNumbers);
        setGeneratedOrderNumber(prev => prev !== nextId ? nextId : prev);
    }, [orders, orderDate]);

    const effectivePriorityLevel: Priority = useMemo(() => {
        return shoes.some(s => s.priorityLevel === 'rush') ? 'rush' : 'regular';
    }, [shoes]);

    // Auto-reset shoe priority level if conditions are not met:
    // Rush order must be applicable to the selected base services & add-ons.
    useEffect(() => {
        let changed = false;
        const updated = shoes.map(shoe => {
            if (shoe.priorityLevel === 'rush') {
                const base = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                const addOns = Array.isArray(shoe.addOns) ? shoe.addOns : [];
                const applicable = getApplicableRushFee(base, addOns, services);
                if (base.length > 0 && !applicable) {
                    changed = true;
                    return { ...shoe, priorityLevel: 'regular' as Priority };
                }
            }
            return shoe;
        });
        if (changed) {
            setShoes(updated);
        }
    }, [shoes, services]);

    const activeServices = services.filter(s => s.active);
    const baseServices = activeServices.filter(s => s.category === 'base');
    const addOnServices = activeServices.filter(s => s.category === 'addon');

    const getAddonTotal = (addonName: string, quantity: number) => {
        const addon = addOnServices.find(s => s.name === addonName);
        if (!addon) return 0;
        return addon.price * quantity;
    };



    const catalogDurations = useMemo(() => {
        const map: Record<string, string | number> = {};
        services.forEach((service) => {
            if (service.name && service.durationDays !== undefined) {
                map[service.name] = service.durationDays;
            }
        });
        return map;
    }, [services]);

    const mlBreakdown = useMemo(
        () => calculateOfficialReleaseBreakdown(
            shoes,
            effectivePriorityLevel,
            parseInt(basicCleaningRushReduction, 10) || 9,
            catalogDurations,
        ),
        [shoes, effectivePriorityLevel, basicCleaningRushReduction, catalogDurations],
    );
    const hasSelectedServices = useMemo(() => {
        return shoes.some(shoe => (Array.isArray(shoe.baseService) ? shoe.baseService : []).length > 0 || (shoe.addOns || []).length > 0);
    }, [shoes]);

    const calculatePredictedDays = () => {
        if (!hasSelectedServices) return 0;
        return mlBreakdown.totalDays;
    };

    const getShoeTotal = (shoe: ShoeEntry) => {
        let total = 0;
        const servicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];

        servicesArr.forEach((serviceName: string) => {
            const service = baseServices.find(s => s.name === serviceName);
            if (service) total += service.price;
        });

        const hasFR = servicesArr.includes('Full Reglue');
        let soleAddonsCounted = 0;
        shoe.addOns.forEach((addon: { name: string; quantity?: number }) => {
            const addonQuantity = addon.quantity || 1;
            if (hasFR && isFullReglueSoleAddon(addon.name)) {
                if (soleAddonsCounted === 0) {
                    // First Full Reglue specification is included in base Full Reglue fee (₱0)
                    soleAddonsCounted++;
                } else {
                    // Second Full Reglue specification adds the additional section fee (+₱150)
                    total += getAddonTotal(addon.name, addonQuantity);
                }
            } else {
                total += getAddonTotal(addon.name, addonQuantity);
            }
        });

        // Add retail items from supplies used
        (shoe.inventoryUsed || []).forEach(usage => {
            const item = inventoryData.find((i: any) => i.id === usage.itemId);
            const retPrice = getItemRetailPrice(item);
            if (retPrice > 0) {
                total += retPrice * (Number(usage.amount) || 0);
            }
        });

        // Add rush fee to unit total if applicable
        if (shoe.priorityLevel === 'rush') {
            const applicableRush = getApplicableRushFee(servicesArr, shoe.addOns || [], services);
            if (applicableRush) {
                total += applicableRush.price;
            } else if (servicesArr.includes('Basic Cleaning')) {
                total += 150;
            }
        }

        return total * shoe.quantity;
    };
    const selectedDiscountService = useMemo(() => {
        return (services || []).find(s => s.id === discountPreset && s.category === 'discount');
    }, [services, discountPreset]);

    const activeDiscountConfig = useMemo(() => {
        if (!selectedDiscountService) {
            if (discountPreset === 'senior') {
                return {
                    requiresId: true,
                    idType: 'control_number' as const,
                    idFormat: 'numbers' as const,
                    digits: 6,
                    label: 'Senior Citizen Control No.',
                    name: 'Senior Citizen'
                };
            }
            if (discountPreset === 'pwd') {
                return {
                    requiresId: true,
                    idType: 'id_number' as const,
                    idFormat: 'numbers' as const,
                    digits: 12,
                    label: 'Person with Disability (PWD) ID No.',
                    name: 'Person with Disability (PWD)'
                };
            }
            return null;
        }
        const n = (selectedDiscountService.name || '').toLowerCase();
        const c = (selectedDiscountService.code || '').toLowerCase();
        const isSenior = n.includes('senior') || n.includes('snr') || c.includes('senior') || c.includes('snr');
        const isPwd = n.includes('pwd') || n.includes('disability') || c.includes('pwd') || c.includes('disability');
        
        const hasIdRequirement = selectedDiscountService.requiresIdVerification ?? (selectedDiscountService.idVerificationType && selectedDiscountService.idVerificationType !== 'none' ? true : (isSenior || isPwd));
        if (!hasIdRequirement && selectedDiscountService.idVerificationType === 'none') {
            return null;
        }
        if (!hasIdRequirement && !isSenior && !isPwd) {
            return null;
        }

        const idType: 'control_number' | 'id_number' = selectedDiscountService.idVerificationType === 'id_number' || (isPwd && selectedDiscountService.idVerificationType !== 'control_number')
            ? 'id_number'
            : 'control_number';
        
        const idFormat: 'alphanumeric' | 'numbers' | 'letters' = selectedDiscountService.idFormat || (isSenior ? 'numbers' : 'alphanumeric');
        const digits = selectedDiscountService.idDigits != null && Number(selectedDiscountService.idDigits) > 0
            ? Number(selectedDiscountService.idDigits)
            : (isSenior ? 6 : isPwd ? 12 : undefined);

        const label = idType === 'control_number'
            ? `${selectedDiscountService.name} Control No.`
            : `${selectedDiscountService.name} ID No.`;

        return {
            requiresId: true,
            idType,
            idFormat,
            digits,
            label,
            name: selectedDiscountService.name
        };
    }, [selectedDiscountService]);


    const isAuthCodeValid = useMemo(() => {
        if (!canStaffUseAuthCode) return false;
        const code = enteredDiscountCode.trim().toUpperCase();
        if (!code) return false;
        const validCodes = (services || [])
            .filter(s => s.category === 'discount' && s.code)
            .map(s => (s.code || '').trim().toUpperCase());
        const selectedCode = (selectedDiscountService?.code || '').trim().toUpperCase();
        const activeSysCode = (authorizationCode || '').trim().toUpperCase();
        return (Boolean(activeSysCode) && code === activeSysCode) || (Boolean(selectedCode) && code === selectedCode) || validCodes.includes(code);
    }, [canStaffUseAuthCode, enteredDiscountCode, services, selectedDiscountService, authorizationCode]);

    const isAuthorized = useMemo(() => {
        if (canSelfAuthorizeDiscounts) return true;
        if (authorizedByUserId) return true;
        if (isAuthCodeValid) return true;
        return false;
    }, [canSelfAuthorizeDiscounts, authorizedByUserId, isAuthCodeValid]);

    const isDiscountActivated = useMemo(() => {
        if (discountPreset === '0') return false;

        // Staff accounts must be authorized (via owner code or supervisor login)
        if (!isAuthorized) {
            return false;
        }

        // Beneficiary ID Verification (Senior / PWD / configured ID requirement)
        if (activeDiscountConfig) {
            return isValidIdInput(discountIdNumber, activeDiscountConfig.idFormat, activeDiscountConfig.digits);
        }

        // Custom discount (Only available to Owner / Admin)
        if (discountPreset === 'custom') {
            const customVal = parseFloat(customDiscountValue.replace(/,/g, '')) || 0;
            return customVal > 0;
        }

        // Configured discount or fallback statutory/numeric presets
        if (selectedDiscountService || !isNaN(Number(discountPreset)) || discountPreset === 'promo') {
            return true;
        }

        return false;
    }, [discountPreset, isAuthorized, activeDiscountConfig, discountIdNumber, customDiscountValue, selectedDiscountService]);

    const totals = useMemo(() => {
        let baseTotal = 0;
        let addOnsTotal = 0;
        let rushFee = 0;
        let retailTotal = 0;

        shoes.forEach((shoe: ShoeEntry) => {
            const servicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];

            servicesArr.forEach((serviceName: string) => {
                const service = baseServices.find(s => s.name === serviceName);
                if (service) {
                    baseTotal += service.price * shoe.quantity;
                }
            });

            const hasFR = servicesArr.includes('Full Reglue');
            let soleAddonsCounted = 0;
            shoe.addOns.forEach((addon: { name: string; quantity?: number }) => {
                const addonQuantity = addon.quantity || 1;
                if (hasFR && isFullReglueSoleAddon(addon.name)) {
                    if (soleAddonsCounted === 0) {
                        // First Full Reglue specification is included in base Full Reglue fee (₱0)
                        soleAddonsCounted++;
                    } else {
                        // Second Full Reglue specification adds the additional section fee (+₱150)
                        addOnsTotal += getAddonTotal(addon.name, addonQuantity) * shoe.quantity;
                    }
                } else {
                    addOnsTotal += getAddonTotal(addon.name, addonQuantity) * shoe.quantity;
                }
            });

            // Calculate retail supplies total
            (shoe.inventoryUsed || []).forEach((u) => {
                const item = inventoryData.find((i: any) => i.id === u.itemId);
                const retPrice = getItemRetailPrice(item);
                if (retPrice > 0) {
                    retailTotal += retPrice * (Number(u.amount) || 0) * shoe.quantity;
                }
            });

            // Rush Fee calculation
            if (shoe.priorityLevel === 'rush') {
                const applicableRush = getApplicableRushFee(servicesArr, shoe.addOns || [], services);
                if (applicableRush) {
                    rushFee += applicableRush.price * shoe.quantity;
                } else if (servicesArr.includes('Basic Cleaning')) {
                    rushFee += 150 * shoe.quantity;
                }
            }
        });

        const grossSubtotal = baseTotal + addOnsTotal + rushFee + retailTotal;

        // Discount calculation - only applies if discount code / Senior / PWD ID is verified
        let calculatedDiscount = 0;
        if (discountPreset !== '0' && isDiscountActivated) {
            if (discountPreset === 'custom') {
                if (customDiscountType === 'percent') {
                    const pct = Math.min(100, Math.max(0, parseFloat(customDiscountValue) || 0));
                    calculatedDiscount = (grossSubtotal * pct) / 100;
                } else {
                    const amt = Math.max(0, parseFloat(customDiscountValue.replace(/,/g, '')) || 0);
                    calculatedDiscount = Math.min(grossSubtotal, amt);
                }
            } else {
                const matchedSvc = (services || []).find(s => s.id === discountPreset && s.category === 'discount');
                if (matchedSvc) {
                    const isFixed = matchedSvc.description?.toLowerCase().includes('fixed') || matchedSvc.description?.toLowerCase().includes('amount') || matchedSvc.code === 'PHP' || matchedSvc.name.includes('₱');
                    if (isFixed) {
                        calculatedDiscount = Math.min(grossSubtotal, matchedSvc.price);
                    } else {
                        calculatedDiscount = (grossSubtotal * matchedSvc.price) / 100;
                    }
                } else if (discountPreset === 'senior' || discountPreset === 'pwd') {
                    calculatedDiscount = (grossSubtotal * 10) / 100;
                } else if (discountPreset === 'promo') {
                    calculatedDiscount = (grossSubtotal * 5) / 100;
                } else {
                    const pct = Number(discountPreset);
                    calculatedDiscount = (grossSubtotal * (isNaN(pct) ? 0 : pct)) / 100;
                }
            }
        }
        const discountAmount = Math.min(grossSubtotal, Math.round(calculatedDiscount * 100) / 100);
        const grandTotal = Math.max(0, Math.round((grossSubtotal - discountAmount) * 100) / 100);
        const minimumDownpayment = Math.round((grandTotal * 0.5) * 100) / 100;

        const amountReceivedNum = amountReceived ? parseFloat(amountReceived.replace(/,/g, '')) : 0;
        const currentDepositNum = depositAmount ? (parseFloat(depositAmount.replace(/,/g, '')) || 0) : minimumDownpayment;
        const effectiveDeposit = paymentStatus === 'downpayment' ? currentDepositNum : grandTotal;

        // Change logic uses deposit required/paid, not necessarily the overall total
        const change = amountReceivedNum - effectiveDeposit;

        // Remaining Balance
        const remainingBalance = Math.max(0, grandTotal - effectiveDeposit);

        return {
            baseTotal,
            addOnsTotal,
            rushFee,
            retailTotal,
            grossSubtotal,
            discountAmount,
            grandTotal,
            minimumDownpayment,
            amountReceivedNum,
            remainingBalance,
            change
        };
    }, [shoes, baseServices, addOnServices, priorityLevel, amountReceived, depositAmount, paymentStatus, inventoryData, discountPreset, customDiscountType, customDiscountValue, services, isDiscountActivated]);

    const discountOptions = useMemo(() => {
        const list: Array<{ id: string; label: string; fullLabel: string; value: number; isPercent: boolean; rateText: string }> = [
            { id: '0', label: 'None', fullLabel: 'No Discount', value: 0, isPercent: true, rateText: '' }
        ];
        const configured = (services || []).filter(s => s.category === 'discount' && s.active).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        if (configured.length > 0) {
            configured.forEach(s => {
                const isPercent = !s.description?.toLowerCase().includes('fixed') && !s.description?.toLowerCase().includes('amount') && s.code !== 'PHP' && !s.name.includes('₱');
                const rateText = isPercent ? `${s.price}%` : `₱${s.price}`;
                const trimmedName = (s.name || '').trim();
                list.push({
                    id: s.id,
                    label: trimmedName,
                    fullLabel: `${trimmedName} (${rateText})`,
                    value: s.price,
                    isPercent,
                    rateText,
                });
            });
        } else {
            [
                { id: 'senior', label: 'Senior Citizen', fullLabel: 'Senior Citizen (10%)', value: 10, isPercent: true, rateText: '10%' },
                { id: 'pwd', label: 'Person with Disability (PWD)', fullLabel: 'Person with Disability (PWD) (10%)', value: 10, isPercent: true, rateText: '10%' },
                { id: 'promo', label: 'Promo', fullLabel: 'Promo (5%)', value: 5, isPercent: true, rateText: '5%' },
            ].forEach(opt => list.push(opt));
        }
        // Only show "Custom" for Owner and Admin accounts
        if (isOwnerOrAdminUser) {
            list.push({ id: 'custom', label: 'Custom', fullLabel: 'Custom Discount', value: 0, isPercent: false, rateText: '' });
        }
        return list;
    }, [services, isOwnerOrAdminUser]);

    const handleSelectDiscount = (id: string) => {
        setDiscountPreset(id);
        setEnteredDiscountCode('');
        setDiscountIdNumber('');
        setAuthorizedByUserId(null);
        setAuthorizedByUsername(null);
        setAuthUsername('');
        setAuthCredential('');
        setAuthMethod('code');
        if (id === '0') {
            setCustomDiscountValue('');
        }
    };

    const { baseTotal, addOnsTotal, rushFee, retailTotal, discountAmount, grandTotal, minimumDownpayment } = totals;

    const [isAmountReceivedTyped, setIsAmountReceivedTyped] = useState(false);

    useEffect(() => {
        const exactHalf = Math.round((grandTotal / 2) * 100) / 100;
        const target = paymentStatus === 'downpayment' ? exactHalf.toFixed(2) : grandTotal.toFixed(2);

        if (!isDepositAmountCustom) {
            setDepositAmount(prev => prev !== target ? target : prev);
            if (!isAmountReceivedTyped) {
                setAmountReceived(prev => prev !== target ? target : prev);
            }
        }
    }, [paymentStatus, grandTotal, isAmountReceivedTyped, isDepositAmountCustom]);

    const officialDays = mlBreakdown.totalDays;
    const officialReleaseYmd = (() => {
        const val = isNaN(officialDays) ? 0 : officialDays;
        if (!val || !orderDate) return '';
        const [y, m, d] = orderDate.split('-').map(Number);
        const target = new Date(y, m - 1, d + val);
        return dateFnsFormat(isNaN(target.getTime()) ? new Date() : target, 'yyyy-MM-dd');
    })();
    const serverOfficialYmd = (serverPrediction?.authoritative === 'business_rule' || serverPrediction?.authoritative === 'standard_business_rule')
        ? (serverPrediction.standard_release_date || serverPrediction.business_rule_date || serverPrediction.predicted_date_ymd || '')
        : '';
    const previewReleaseYmd = manualReleaseDate || (hasSelectedServices ? (serverOfficialYmd || officialReleaseYmd) : '');

    const officialDateDisplay = previewReleaseYmd
        ? dateFnsFormat(new Date(previewReleaseYmd), 'MM/dd/yyyy')
        : (officialReleaseYmd ? dateFnsFormat(new Date(officialReleaseYmd), 'MM/dd/yyyy') : '—');

    const predictedDateDisplay = (() => {
        if (predictionLoading) {
            return 'Predicting…';
        }
        const mlDateStr = serverPrediction?.ml_predicted_release_date || serverPrediction?.ml_predicted_date;
        if (mlDateStr) {
            const d = new Date(mlDateStr);
            return isNaN(d.getTime()) ? '—' : dateFnsFormat(d, 'MM/dd/yyyy');
        }
        if (hasSelectedServices) {
            return 'Predicting…';
        }
        return '—';
    })();

    useEffect(() => {
        const hasServices = shoes.some(shoe => {
            const b = Array.isArray(shoe.baseService) ? shoe.baseService : (shoe.baseService ? [shoe.baseService] : []);
            const a = Array.isArray(shoe.addOns) ? shoe.addOns : (shoe.addOns ? [shoe.addOns] : []);
            return b.length > 0 || a.length > 0;
        });

        // 1. Immediately invalidate current server prediction whenever ANY ML input changes
        setServerPrediction(null);

        if (!hasServices || manualReleaseDate) {
            setPredictionLoading(false);
            setPredictionError(false);
            return;
        }

        // 2. Immediately mark loading state while fresh prediction is pending
        setPredictionLoading(true);
        setPredictionError(false);

        // 3. Track request sequence to prevent older async responses from overwriting newer ones
        const requestId = ++latestPredictionRequestIdRef.current;
        const controller = new AbortController();

        const timer = window.setTimeout(async () => {
            try {
                let authToken = user?.token || (user as any)?.access_token || '';
                if (!authToken && typeof window !== 'undefined') {
                    try {
                        const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            authToken = parsed.token || parsed.access_token || '';
                        }
                    } catch {}
                }
                if (!authToken && typeof window !== 'undefined') {
                    try {
                        const offline = localStorage.getItem('shoelotskey_offline_auth') || sessionStorage.getItem('shoelotskey_offline_auth');
                        if (offline) {
                            const parsed = JSON.parse(offline);
                            authToken = parsed.token || parsed.access_token || '';
                        }
                    } catch {}
                }

                const createdDate = new Date(`${orderDate}T${orderTime || '00:00'}:00`);
                const payload = {
                    items: shoes.map((shoe) => ({
                        brand: shoe.brand === 'Other' ? (shoe.otherBrand?.trim() || '') : (shoe.brand?.trim() || ''),
                        shoeModel: shoe.shoeModel === 'Other' ? (shoe.otherModel?.trim() || '') : (shoe.shoeModel?.trim() || ''),
                        shoeMaterial: shoe.shoeMaterial === 'Other' ? (shoe.otherMaterial?.trim() || '') : (shoe.shoeMaterial?.trim() || ''),
                        quantity: shoe.quantity,
                        condition: shoe.condition,
                        baseService: Array.isArray(shoe.baseService) ? shoe.baseService : (shoe.baseService ? [shoe.baseService] : []),
                        addOns: Array.isArray(shoe.addOns) ? shoe.addOns : (shoe.addOns ? [shoe.addOns] : []),
                        priorityLevel: shoe.priorityLevel || 'regular',
                        rushReductionDays: shoe.priorityLevel === 'rush' ? parseInt(basicCleaningRushReduction, 10) || 9 : undefined,
                    })),
                    priorityLevel: effectivePriorityLevel,
                    rushReductionDays: effectivePriorityLevel === 'rush' ? parseInt(basicCleaningRushReduction, 10) || 9 : undefined,
                    grandTotal: totals.grandTotal,
                    transactionDate: createdDate.toISOString(),
                };
                const res = await fetch(`${API_BASE}/predict`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error('Prediction request failed');
                const data: ServerPrediction = await res.json();
                // Apply ONLY if this response corresponds to the latest prediction request
                if (requestId === latestPredictionRequestIdRef.current) {
                    setServerPrediction(data);
                    setPredictionLoading(false);
                }
            } catch (err: any) {
                if (err?.name === 'AbortError') return;
                if (requestId === latestPredictionRequestIdRef.current) {
                    setPredictionError(true);
                    setPredictionLoading(false);
                }
            }
        }, 50);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [shoes, effectivePriorityLevel, orderDate, orderTime, totals.grandTotal, manualReleaseDate, user?.token, basicCleaningRushReduction]);


    const addShoe = () => {
        setShoes([...shoes, {
            id: Date.now().toString(),
            brand: '',
            shoeMaterial: '',
            shoeModel: '',
            shoeSize: '',
            color: '',
            quantity: 1,
            priorityLevel: 'regular',
            condition: {
                scratches: false,
                ripsHoles: false,
                wornOut: false,
                soleSeparation: false,
                yellowing: false,
                deepStains: false,
                others: '',
            },
            baseService: [],
            addOns: [],
            inventoryUsed: [],
        }]);
    };

    const updateShoe = (id: string, updates: Partial<ShoeEntry>) => {
        setShoes(shoes.map(shoe => shoe.id === id ? { ...shoe, ...updates } : shoe));
    };

    const removeShoe = (id: string) => {
        if (shoes.length > 1) {
            setShoes(shoes.filter(shoe => shoe.id !== id));
        }
    };

    /**
     * HANDLER: handleSubmit
     * PURPOSE: Consolidates all form fields into a single 3NF-compliant JobOrder.
     * LOGIC:
     * 1. Maps multiple shoe entries into an 'items' array.
     * 2. Calculates predicted completion date using ML parameters (priority).
     * 3. Triggers OrderContext to persist to FastAPI backend.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        try {
            const validation = validateCustomerName(customerName);
            if (!validation.isValid) {
                toast.error(validation.error || 'Please enter a valid customer name');
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
            const finalCustomerName = validation.sanitized;
            setCustomerName(finalCustomerName);
            const finalContactNumber = contactNumber.trim();

            const contactDigits = finalContactNumber ? finalContactNumber.replace(/\D/g, '') : '';
            if (contactDigits.length !== 11 || !contactDigits.startsWith('09')) {
                toast.error('Contact number must be exactly 11 digits starting with 09 (e.g., 09xx-xxx-xxxx)');
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }

        // Security check against script or SQL injection across all fields
        const contactSecCheck = validateSecurityInput(finalContactNumber, 'Contact Number');
        if (!contactSecCheck.isValid) {
            toast.error(contactSecCheck.error);
            setIsSubmitting(false);
            isSubmittingRef.current = false;
            return;
        }

        for (let idx = 0; idx < shoes.length; idx++) {
            const s = shoes[idx];
            const brandVal = s.brand === 'Other' ? s.otherBrand : s.brand;
            const bCheck = validateSecurityInput(brandVal, `Shoe #${idx + 1} Brand`);
            if (!bCheck.isValid) {
                toast.error(bCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
            const modelVal = s.shoeModel === 'Other' ? s.otherModel : s.shoeModel;
            const mCheck = validateSecurityInput(modelVal, `Shoe #${idx + 1} Model`);
            if (!mCheck.isValid) {
                toast.error(mCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
            const matVal = s.shoeMaterial === 'Other' ? s.otherMaterial : s.shoeMaterial;
            const matCheck = validateSecurityInput(matVal, `Shoe #${idx + 1} Material`);
            if (!matCheck.isValid) {
                toast.error(matCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
            if (s.shoeSize) {
                const sizeCheck = validateSecurityInput(String(s.shoeSize), `Shoe #${idx + 1} Size`);
                if (!sizeCheck.isValid) {
                    toast.error(sizeCheck.error);
                    setIsSubmitting(false);
                    isSubmittingRef.current = false;
                    return;
                }
            }
            if (s.color) {
                const colorVal = Array.isArray(s.color) ? s.color.join(', ') : String(s.color);
                const colorCheck = validateSecurityInput(colorVal, `Shoe #${idx + 1} Color`);
                if (!colorCheck.isValid) {
                    toast.error(colorCheck.error);
                    setIsSubmitting(false);
                    isSubmittingRef.current = false;
                    return;
                }
            }
            const condOthers = s.condition?.others;
            const condCheck = validateSecurityInput(condOthers, `Shoe #${idx + 1} Remarks/Condition`);
            if (!condCheck.isValid) {
                toast.error(condCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
        }

        if (shippingPreference === 'delivery') {
            const addressFields = [
                { val: deliveryAddress.houseNo, name: 'House Number' },
                { val: deliveryAddress.street, name: 'Street' },
                { val: deliveryAddress.barangay, name: 'Barangay' },
                { val: deliveryAddress.city, name: 'City' },
                { val: deliveryAddress.province, name: 'Province' },
                { val: deliveryAddress.zipCode, name: 'ZIP Code' },
                { val: deliveryCourier, name: 'Courier' },
                { val: otherCourier, name: 'Other Courier' },
            ];
            for (const field of addressFields) {
                if (field.val) {
                    const check = validateSecurityInput(field.val, field.name);
                    if (!check.isValid) {
                        toast.error(check.error);
                        setIsSubmitting(false);
                        isSubmittingRef.current = false;
                        return;
                    }
                }
            }
        }

        if (referenceNo) {
            const refCheck = validateSecurityInput(referenceNo, 'Reference Number');
            if (!refCheck.isValid) {
                toast.error(refCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
        }

        if (discountIdNumber) {
            const idCheck = validateSecurityInput(discountIdNumber, 'Discount ID');
            if (!idCheck.isValid) {
                toast.error(idCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
        }

        if (enteredDiscountCode) {
            const codeCheck = validateSecurityInput(enteredDiscountCode, 'Discount Code');
            if (!codeCheck.isValid) {
                toast.error(codeCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
        }

        if (customDiscountValue) {
            const valCheck = validateSecurityInput(customDiscountValue, 'Discount Value');
            if (!valCheck.isValid) {
                toast.error(valCheck.error);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
        }

        // Only Brand and Base Service are strictly required; Model, Material, Size, Color are optional
        const hasMissingShoeDetails = shoes.some(shoe => {
            const b = shoe.brand === 'Other' ? shoe.otherBrand : shoe.brand;
            const noService = !shoe.baseService || shoe.baseService.length === 0;
            return !b || !b.trim() || noService;
        });
        if (hasMissingShoeDetails) {
            toast.error('Brand and Base Service must be filled out for every item.');
            setIsSubmitting(false);
            isSubmittingRef.current = false;
            return;
        }

        // Color Renewal specification validation: requires exactly 2 Colors or 3 Colors, never both
        for (let i = 0; i < shoes.length; i++) {
            const shoe = shoes[i];
            const crValidation = validateColorRenewalSelection(shoe.baseService || [], shoe.addOns || []);
            if (!crValidation.isValid) {
                const itemLabel = shoe.brand ? `Shoe #${i + 1} (${shoe.brand})` : `Shoe #${i + 1}`;
                toast.error(`${itemLabel}: ${crValidation.error}`);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
        }

        // Full Reglue specification validation: requires at least one sole section (Midsole, Undersole, or both)
        for (let i = 0; i < shoes.length; i++) {
            const shoe = shoes[i];
            const frValidation = validateFullReglueSelection(shoe.baseService || [], shoe.addOns || []);
            if (!frValidation.isValid) {
                const itemLabel = shoe.brand ? `Shoe #${i + 1} (${shoe.brand})` : `Shoe #${i + 1}`;
                toast.error(`${itemLabel}: ${frValidation.error}`);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }
        }

        if (paymentMethod === 'gcash') {
            const cleanRef = referenceNo ? referenceNo.replace(/\D/g, '') : '';
            if (!cleanRef || cleanRef.length !== 13) {
                toast.error('GCash reference number must be filled out and exactly 13 digits.');
                setIsSubmitting(false);
                return;
            }
        } else if (paymentMethod === 'maya') {
            const cleanRef = referenceNo ? referenceNo.replace(/[^a-zA-Z0-9]/g, '') : '';
            if (!cleanRef || cleanRef.length !== 12) {
                toast.error('Maya reference number/ID must be filled out and exactly 12 alphanumeric characters.');
                setIsSubmitting(false);
                return;
            }
        }

        if (shippingPreference === 'delivery') {
            if (!deliveryAddress.houseNo || !deliveryAddress.street || !deliveryAddress.province || !deliveryAddress.city || !deliveryAddress.barangay || !deliveryAddress.zipCode) {
                toast.error('Please enter complete delivery address');
                setIsSubmitting(false);
                return;
            }
            if (!deliveryCourier) {
                toast.error('Please select a delivery courier');
                setIsSubmitting(false);
                return;
            }
        }

        // Discount Verification Validation
        if (discountPreset !== '0') {
            if (!isAuthorized) {
                toast.error('Discount requires owner authorization code or supervisor login.');
                isSubmittingRef.current = false;
                setIsSubmitting(false);
                return;
            }
            if (activeDiscountConfig) {
                if (!isValidIdInput(discountIdNumber, activeDiscountConfig.idFormat, activeDiscountConfig.digits)) {
                    const formatDesc = activeDiscountConfig.idFormat === 'numbers' ? 'numbers only' : activeDiscountConfig.idFormat === 'letters' ? 'letters only' : 'numbers & letters';
                    const lengthDesc = activeDiscountConfig.digits ? ` (${activeDiscountConfig.digits} characters, ${formatDesc})` : ` (${formatDesc})`;
                    toast.error(`${activeDiscountConfig.name} discount requires a valid ${activeDiscountConfig.idType === 'control_number' ? 'Control Number' : 'ID Number'}${lengthDesc}.`);
                    isSubmittingRef.current = false;
                    setIsSubmitting(false);
                    return;
                }
            } else if (discountPreset === 'custom') {
                const val = parseFloat(customDiscountValue.replace(/,/g, '')) || 0;
                if (val <= 0) {
                    toast.error('Please enter a valid custom discount value.');
                    isSubmittingRef.current = false;
                    setIsSubmitting(false);
                    return;
                }
            }
        }

        const minDownpayment = Math.round((grandTotal * 0.5) * 100) / 100;
        const amtReceived = parseFloat(amountReceived.replace(/,/g, '')) || 0;
        const depAmt = parseFloat(depositAmount.replace(/,/g, '')) || 0;

        if (paymentStatus === 'downpayment') {
            if (depAmt < minDownpayment - 0.01) {
                toast.error(`Downpayment cannot be less than 50% (${formatPeso(minDownpayment)})`);
                isSubmittingRef.current = false;
                setIsSubmitting(false);
                return;
            }
            if (depAmt > grandTotal) {
                toast.error(`Downpayment cannot exceed Grand Total (${formatPeso(grandTotal)})`);
                isSubmittingRef.current = false;
                setIsSubmitting(false);
                return;
            }
            if (amtReceived < depAmt) {
                toast.error(`Amount received is less than the required downpayment (${formatPeso(depAmt)})`);
                isSubmittingRef.current = false;
                setIsSubmitting(false);
                return;
            }
        } else {
            if (amtReceived < grandTotal) {
                toast.error(`Amount received is less than the total due (${formatPeso(grandTotal)})`);
                isSubmittingRef.current = false;
                setIsSubmitting(false);
                return;
            }
        }

        let [oHours, oMinutes] = [0, 0];
        if (orderTime) {
            const cleaned = orderTime.trim();
            const isPM = /pm/i.test(cleaned);
            const isAM = /am/i.test(cleaned);
            const match = cleaned.match(/(\d{1,2}):(\d{2})/);
            if (match) {
                let h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                if (isPM && h < 12) h += 12;
                if (isAM && h === 12) h = 0;
                oHours = h;
                oMinutes = m;
            } else {
                const timeParts = cleaned.split(':').map(Number);
                oHours = !isNaN(timeParts[0]) ? timeParts[0] : 0;
                oMinutes = !isNaN(timeParts[1]) ? timeParts[1] : 0;
            }
        } else {
            const now = new Date();
            oHours = now.getHours();
            oMinutes = now.getMinutes();
        }

        let createdDate: Date;
        if (orderDate && orderDate.includes('-')) {
            const [y, m, d] = orderDate.split('-').map(Number);
            createdDate = new Date(y, m - 1, d, oHours, oMinutes, 0, 0);
        } else if (orderDate) {
            createdDate = new Date(orderDate);
            createdDate.setHours(oHours, oMinutes, 0, 0);
        } else {
            createdDate = new Date();
        }
        const phFormattedTime = `${String(oHours).padStart(2, '0')}:${String(oMinutes).padStart(2, '0')}`;
        const phLocalIsoDate = `${orderDate || getPhilippineDateString()}T${phFormattedTime}:00`;

        // Measure creation duration from form opening to submission (Digital vs Paper Manual efficiency)
        const submitNow = Date.now();
        const durationSec = Math.max(1, Math.round((submitNow - (formStartTimeRef.current || submitNow)) / 1000));
        const formatFormDuration = (secs: number) => {
            if (secs < 60) return `${secs}s`;
            const m = Math.floor(secs / 60);
            const s = secs % 60;
            return s > 0 ? `${m}m ${s}s` : `${m}m`;
        };
        const formDurationFormatted = formatFormDuration(durationSec);
        const efficiencyMetric = formDurationFormatted;


        // Helper to format delivery address
        const formatAddress = () => {
            if (shippingPreference === 'pickup') return undefined;
            return `${deliveryAddress.houseNo} ${deliveryAddress.street}, ${deliveryAddress.barangay}, ${deliveryAddress.city}, ${deliveryAddress.province}, ${deliveryAddress.zipCode}`;
        };

        // New Logic: ONE JobOrder with many items
        const newOrder: any = {
            id: `JO-${Date.now()}`,
            orderNumber: generatedOrderNumber,
            customerName: finalCustomerName,
            contactNumber: finalContactNumber,
            // Fallback fields (using first shoe data)
            brand: shoes[0].brand === 'Other' ? (shoes[0].otherBrand?.trim() || '') : (shoes[0].brand?.trim() || ''),
            shoeModel: shoes[0].shoeModel === 'Other' ? (shoes[0].otherModel?.trim() || '') : (shoes[0].shoeModel?.trim() || ''),
            shoeMaterial: shoes[0].shoeMaterial === 'Other' ? (shoes[0].otherMaterial?.trim() || '') : (shoes[0].shoeMaterial?.trim() || ''),
            shoeSize: shoes[0].shoeSize || '',
            color: shoeColorValue(shoes[0]),
            baseService: shoes[0].baseService,
            historicalBasePrices: (shoes[0].baseService || []).map(serviceName => {
                const service = baseServices.find(s => s.name === serviceName);
                return { name: serviceName, price: service ? service.price : 0 };
            }),
            historicalAddOnPrices: (() => {
                const hasFR0 = (shoes[0].baseService || []).includes('Full Reglue');
                let sole0Recorded = 0;
                return (shoes[0].addOns || []).map((addon: any) => {
                    const addonName = typeof addon === 'string' ? addon : addon.name;
                    const service = addOnServices.find(s => s.name === addonName);
                    const catalogPrice = service ? service.price : 0;
                    if (hasFR0 && isFullReglueSoleAddon(addonName)) {
                        if (sole0Recorded === 0) {
                            sole0Recorded++;
                            return { name: addonName, price: 0 };
                        }
                    }
                    return { name: addonName, price: catalogPrice };
                });
            })(),
            quantity: shoes.reduce((acc, s) => acc + s.quantity, 0),

            // Nested items for breakdown view
            items: shoes.map((shoe, idx) => {
                const historicalBasePrices = (shoe.baseService || []).map(serviceName => {
                    const service = baseServices.find(s => s.name === serviceName);
                    return { name: serviceName, price: service ? service.price : 0 };
                });

                const hasFR = (shoe.baseService || []).includes('Full Reglue');
                let soleRecorded = 0;
                const historicalAddOnPrices = (shoe.addOns || []).map((addon: any) => {
                    const addonName = typeof addon === 'string' ? addon : addon.name;
                    const service = addOnServices.find(s => s.name === addonName);
                    const catalogPrice = service ? service.price : 0;
                    if (hasFR && isFullReglueSoleAddon(addonName)) {
                        if (soleRecorded === 0) {
                            soleRecorded++;
                            return { name: addonName, price: 0 };
                        }
                    }
                    return { name: addonName, price: catalogPrice };
                });

                const applicableRush = shoe.priorityLevel === 'rush'
                    ? getApplicableRushFee(shoe.baseService || [], shoe.addOns || [], services)
                    : null;
                const shoeReduction = (applicableRush && applicableRush.durationDays !== undefined && applicableRush.durationDays !== 0)
                    ? String(Math.abs(Number(applicableRush.durationDays)))
                    : basicCleaningRushReduction;

                return {
                    id: `${Date.now()}-${idx}`,
                    brand: shoe.brand === 'Other' ? (shoe.otherBrand?.trim() || '') : (shoe.brand?.trim() || ''),
                    shoeModel: shoe.shoeModel === 'Other' ? (shoe.otherModel?.trim() || '') : (shoe.shoeModel?.trim() || ''),
                    shoeMaterial: shoe.shoeMaterial === 'Other' ? (shoe.otherMaterial?.trim() || '') : (shoe.shoeMaterial?.trim() || ''),
                    shoeSize: shoe.shoeSize,
                    color: shoeColorValue(shoe),
                    quantity: shoe.quantity,
                    priorityLevel: shoe.priorityLevel || 'regular',
                    rushReductionDays: shoe.priorityLevel === 'rush' ? (shoe.rushReductionDays !== undefined ? String(shoe.rushReductionDays) : shoeReduction) : undefined,
                    rushFee: applicableRush ? applicableRush.price : (shoe.priorityLevel === 'rush' ? 150 : 0),
                    rushFeeName: applicableRush ? applicableRush.name : undefined,
                    rushFeeCode: applicableRush ? applicableRush.code : undefined,
                    condition: shoe.condition,
                    baseService: shoe.baseService,
                    addOns: shoe.addOns,
                    historicalBasePrices,
                    historicalAddOnPrices,
                    inventoryUsed: shoe.inventoryUsed,
                    beforeImage: shoe.beforeImage,
                    afterImage: shoe.afterImage
                };
            }),

            beforeImage: shoes[0]?.beforeImage,
            priorityLevel: effectivePriorityLevel,
            rushReductionDays: effectivePriorityLevel === 'rush' ? basicCleaningRushReduction : undefined,
            baseServiceFee: totals.baseTotal,
            addOnsTotal: totals.addOnsTotal,
            rushFee: totals.rushFee,
            retailTotal: totals.retailTotal,
            grossTotal: totals.grossSubtotal,
            discountAmount: totals.discountAmount,
            discount: totals.discountAmount,
            discountPreset,
            discountType: activeDiscountConfig ? (activeDiscountConfig.idType === 'id_number' ? 'pwd' : 'senior') : (discountPreset === 'custom' ? 'custom' : 'promotional'),
            discountName: selectedDiscountService?.name?.trim() || (discountPreset === 'custom' ? 'Custom Discount' : (discountPreset === 'senior' ? 'Senior Citizen' : (discountPreset === 'pwd' ? 'Person with Disability (PWD)' : (discountPreset === 'promo' ? 'Promo' : (discountPreset !== '0' ? `${discountPreset}% Discount` : ''))))),
            discountCode: enteredDiscountCode.trim().toUpperCase() || undefined,
            discountIdNumber: activeDiscountConfig ? discountIdNumber.trim() : undefined,
            authorized_by_user_id: authorizedByUserId || undefined,
            authorized_by_username: authorizedByUsername || (isAuthCodeValid ? `Authorized by Code (${enteredDiscountCode.trim().toUpperCase()})` : (isOwnerOrAdminUser ? (user?.username || 'Owner') : undefined)),
            grandTotal: totals.grandTotal,
            shippingPreference,
            deliveryAddress: formatAddress(),
            deliveryCourier: shippingPreference === 'delivery' ? (deliveryCourier === 'Other' ? otherCourier : deliveryCourier) : undefined,
            province: deliveryAddress.province,
            city: deliveryAddress.city,
            barangay: deliveryAddress.barangay,
            zipCode: deliveryAddress.zipCode,
            paymentMethod,
            initialPaymentMethod: paymentMethod,
            paymentStatus,
            amountReceived: totals.amountReceivedNum,
            balance: totals.remainingBalance,
            change: totals.change,
            referenceNo,
            // shelfLocation removed
            depositAmount: paymentStatus === 'downpayment' ? (parseFloat(depositAmount.replace(/,/g, '')) || totals.minimumDownpayment) : totals.grandTotal,
            paymentHistory: [
                {
                    id: `pay-${Date.now()}`,
                    paymentType: paymentStatus === 'downpayment' ? 'downpayment' : 'full-payment',
                    method: paymentMethod,
                    amount: paymentStatus === 'downpayment'
                        ? (parseFloat(depositAmount.replace(/,/g, '')) || totals.minimumDownpayment)
                        : totals.grandTotal,
                    referenceNo: ['gcash', 'maya'].includes(paymentMethod) ? referenceNo : undefined,
                    date: createdDate,
                    processedBy: user?.username || 'Current User',
                    notes: paymentStatus === 'downpayment' ? 'Initial Downpayment' : 'Full Payment'
                },
                ...((isPastOrderMode && pastOrderStatus === 'claimed' && paymentStatus === 'downpayment' && totals.remainingBalance > 0) ? [{
                    id: `pay-${Date.now()}-settle`,
                    paymentType: 'final-payment' as const,
                    method: 'cash' as const,
                    amount: totals.remainingBalance,
                    date: pastOrderClaimedDate ? new Date(`${pastOrderClaimedDate}T17:00:00`) : createdDate,
                    processedBy: user?.username || 'Current User',
                    notes: 'Balance Settlement upon Claim (Past Order)'
                }] : [])
            ],
            releaseTime,
            orderDate,
            orderTime: phFormattedTime,
            formDurationSeconds: durationSec,
            formDurationFormatted,
            efficiencyMetric,
            entry_started_at: new Date(formStartTimeRef.current || submitNow).toISOString(),
            transactionDate: phLocalIsoDate,
            createdAt: phLocalIsoDate,
            processedBy: user?.username || 'Current User',
            status: isPastOrderMode ? pastOrderStatus : 'new-order',
            claimedAt: (isPastOrderMode && pastOrderStatus === 'claimed')
                ? (pastOrderClaimedDate ? new Date(`${pastOrderClaimedDate}T17:00:00`) : createdDate)
                : undefined,
            releasedAt: (isPastOrderMode && (pastOrderStatus === 'claimed' || pastOrderStatus === 'for-release'))
                ? (pastOrderClaimedDate ? new Date(`${pastOrderClaimedDate}T17:00:00`) : createdDate)
                : undefined,
            actualCompletionDate: (isPastOrderMode && (pastOrderStatus === 'claimed' || pastOrderStatus === 'for-release'))
                ? (pastOrderClaimedDate ? new Date(`${pastOrderClaimedDate}T17:00:00`) : createdDate)
                : undefined,
            actualReleaseDate: (isPastOrderMode && pastOrderStatus === 'claimed')
                ? (pastOrderClaimedDate ? new Date(`${pastOrderClaimedDate}T17:00:00`) : createdDate)
                : undefined,
            claimedBy: (isPastOrderMode && pastOrderStatus === 'claimed') ? finalCustomerName : undefined,
            releasedBy: (isPastOrderMode && pastOrderStatus === 'claimed') ? (user?.username || 'Staff') : undefined,
            // Official expected_at is computed on the server from Shoelotskey business
            // rules. mlAutoPredicted tells the backend to ignore any client date and
            // persist the business-rule date. Random Forest is returned separately and
            // never becomes expected_at.
            mlAutoPredicted: !manualReleaseDate,
            predictedCompletionDate: (() => {
                if (manualReleaseDate) {
                    const date = new Date(manualReleaseDate);
                    if (releaseTime) {
                        const [rHours, rMinutes] = releaseTime.split(':').map(Number);
                        date.setHours(rHours, rMinutes, 0, 0);
                    }
                    return date;
                }
                const authoritativeYmd = officialReleaseYmd || serverOfficialYmd;
                if (authoritativeYmd) {
                    const date = new Date(`${authoritativeYmd}T${releaseTime || '00:00'}:00`);
                    if (!isNaN(date.getTime())) return date;
                }
                const daysToAdd = calculatePredictedDays();
                const date = new Date(createdDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                if (releaseTime) {
                    const [rHours, rMinutes] = releaseTime.split(':').map(Number);
                    date.setHours(rHours, rMinutes, 0, 0);
                }
                return date;
            })(),
            predictedAt: (() => {
                if (serverPrediction?.ml_predicted_date) {
                    const d = new Date(serverPrediction.ml_predicted_date);
                    if (!isNaN(d.getTime())) return d;
                }
                if (serverPrediction?.ml_predicted_days != null) {
                    return new Date(createdDate.getTime() + serverPrediction.ml_predicted_days * 24 * 60 * 60 * 1000);
                }
                return undefined;
            })(),
            predictedDays: serverPrediction?.ml_predicted_days != null
                ? serverPrediction.ml_predicted_days
                : (serverPrediction?.predicted_days != null ? serverPrediction.predicted_days : undefined),
            updatedAt: createdDate,
            statusHistory: (isPastOrderMode && pastOrderStatus === 'claimed') ? [
                {
                    status: 'new-order' as const,
                    timestamp: createdDate,
                    user: user?.username || 'Current User',
                },
                {
                    status: 'claimed' as const,
                    timestamp: pastOrderClaimedDate ? new Date(`${pastOrderClaimedDate}T17:00:00`) : createdDate,
                    user: user?.username || 'Current User',
                }
            ] : [
                {
                    status: (isPastOrderMode ? pastOrderStatus : 'new-order') as any,
                    timestamp: createdDate,
                    user: user?.username || 'Current User',
                }
            ]
        };

        // Persist beforeImage condition photos so they reflect in OrderDetailModal and survive backend refreshes
        const firstBeforeImage = shoes[0]?.beforeImage;
        const itemsAttachments: Record<string, { beforeImage?: string }> = {};
        shoes.forEach((shoe, idx) => {
            if (shoe.beforeImage) {
                itemsAttachments[String(idx)] = { beforeImage: shoe.beforeImage };
                if (shoe.id) {
                    itemsAttachments[String(shoe.id)] = { beforeImage: shoe.beforeImage };
                }
            }
        });

        if (firstBeforeImage || Object.keys(itemsAttachments).length > 0) {
            saveOrderAttachments(newOrder.orderNumber, {
                ...(firstBeforeImage ? { beforeImage: firstBeforeImage } : {}),
                items: itemsAttachments,
            });
            if (newOrder.id) {
                saveOrderAttachments(String(newOrder.id), {
                    ...(firstBeforeImage ? { beforeImage: firstBeforeImage } : {}),
                    items: itemsAttachments,
                });
            }
        }

        // P1-7 FIX: previously this call was not awaited, so the success toast, activity
        // log, and full form reset below always ran immediately regardless of whether the
        // backend actually confirmed the order — a definite backend rejection (e.g. a 400/
        // 500) could still show "Order created successfully!" and wipe the user's form data.
        // Now we wait for genuine confirmation (saved directly, or durably queued for
        // offline auto-sync) before treating this as a success; on a hard failure we keep
        // the form data intact and re-enable Submit so the user can safely retry.
        const orderConfirmed = await addOrder(newOrder);
        if (!orderConfirmed) {
            setIsSubmitting(false);
            return;
        }

        // Persist any custom-typed options so they appear in future job orders
        if (shippingPreference === 'delivery') {
            const finalCourier = deliveryCourier === 'Other' ? otherCourier : deliveryCourier;
            if (finalCourier) saveStoredCustomOption(CUSTOM_OPTION_KEYS.COURIERS, finalCourier);
        }
        shoes.forEach((shoe) => {
            const b = shoe.brand === 'Other' ? shoe.otherBrand : shoe.brand;
            if (b) saveStoredCustomOption(CUSTOM_OPTION_KEYS.BRANDS, b);
            const m = shoe.shoeModel === 'Other' ? shoe.otherModel : shoe.shoeModel;
            if (m) saveStoredCustomOption(CUSTOM_OPTION_KEYS.MODELS, m);
            const mat = shoe.shoeMaterial === 'Other' ? shoe.otherMaterial : shoe.shoeMaterial;
            if (mat) saveStoredCustomOption(CUSTOM_OPTION_KEYS.MATERIALS, mat);
            if (shoe.shoeSize) saveStoredCustomOption(CUSTOM_OPTION_KEYS.SIZES, shoe.shoeSize);
            const c = shoeColorValue(shoe);
            if (c) {
                c.split(',').forEach((col: string) => {
                    const trimmed = col.trim();
                    if (trimmed) saveStoredCustomOption(CUSTOM_OPTION_KEYS.COLORS, trimmed);
                });
            }
        });

        toast.success(`Order created successfully! (Duration: ${formDurationFormatted})`);

        if (onSuccess) onSuccess();

        // Reset form for next entry
        setCustomerName('');
        setContactNumber('');
        setShippingPreference('pickup');


        setShoes([{
            id: Date.now().toString(),
            brand: '',
            shoeMaterial: '',
            shoeModel: '',
            quantity: 1,
            condition: {
                scratches: false,
                ripsHoles: false,
                wornOut: false,
                soleSeparation: false,
                yellowing: false,
                deepStains: false,
                others: '',
            },
            baseService: [],
            addOns: [],
            inventoryUsed: [],
        }]);
        setPriorityLevel('regular');
        setDeliveryAddress({
            houseNo: '',
            street: '',
            province: '',
            city: '',
            barangay: '',
            zipCode: '',
        });
        setDeliveryCourier('');
        setOtherCourier('');
        setPaymentMethod('cash');
        setPaymentStatus('downpayment');
        setAmountReceived('');
        setDepositAmount('');
        setIsDepositAmountCustom(false);
        setIsAmountReceivedTyped(false);
        setDiscountPreset('0');
        setCustomDiscountValue('');
        setCustomDiscountType('percent');
        setEnteredDiscountCode('');
        setDiscountIdNumber('');
        setReferenceNo('');
        setOrderDate(getPhilippineDateString());
        setOrderTime(getPhilippineTimeString());
        setManualReleaseDate('');
        setReleaseTime('');
        } catch (error) {
            console.error('Error submitting form:', error);
            toast.error('An error occurred while creating the order.');
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const formatReferenceNo = (value: string) => {
        if (paymentMethod === 'gcash') {
            const digits = value.replace(/\D/g, '').slice(0, 13);
            let formatted = '';
            for (let i = 0; i < digits.length; i++) {
                formatted += digits[i];
                if ((i === 3 || i === 6 || i === 9) && i !== digits.length - 1) {
                    formatted += '-';
                }
            }
            return formatted;
        }
        if (paymentMethod === 'maya') {
            const chars = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
            let formatted = '';
            for (let i = 0; i < chars.length; i++) {
                formatted += chars[i];
                if ((i === 3 || i === 7) && i !== chars.length - 1) {
                    formatted += '-';
                }
            }
            return formatted;
        }
        return value;
    };
    const formatContactNumber = (value: string) => formatPhilippineContactNumber(value);

    const formatPeso = (amount: number | string) => {
        const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
        if (isNaN(num)) return '\u20B10.00';
        return '\u20B1' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2.5">

            
            {mode === 'edit' && (
                <div className="flex items-center justify-between mb-4 mt-2">
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                        Edit Order Detail
                    </h2>
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" onClick={() => {
                            if(onCancel) onCancel();
                        }} className="h-9 px-4 text-xs font-black uppercase tracking-widest text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors rounded-xl shadow-sm">
                            <RotateCcw className="w-3.5 h-3.5 mr-2" />
                            Revert Changes
                        </Button>
                    </div>
                </div>
            )}


            {/* Customer Information Section */}
            <Card className="border-red-100/50 shadow-sm bg-white overflow-visible relative z-30 rounded-2xl">
                <CardHeader className={`${CARD_HEADER_STYLE} !py-1.5 rounded-t-2xl`}>
                    <div className="flex items-center gap-3 translate-y-[1px]">
                        <User className="text-red-600 fill-red-600" size={18} />
                        <CardTitle className={`${CARD_TITLE_STYLE} text-slate-900`}>CUSTOMER DETAILS</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="px-3.5 sm:px-6 pt-0 pb-2.5 space-y-2.5 sm:space-y-3">
                    <div className={`grid gap-2.5 sm:gap-4 -mt-1 ${shippingPreference === 'pickup' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-12 mb-2.5'}`}>
                        <div className={`relative ${shippingPreference === 'pickup' ? 'col-span-2 md:col-span-1' : 'col-span-2 md:col-span-6'}`}>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="customerName" className={LABEL_STYLE}>Customer Name</Label>
                                <span className={`text-[10px] font-bold ${customerName.length >= CUSTOMER_NAME_MAX_LENGTH ? 'text-red-600' : 'text-gray-600'}`}>
                                    {customerName.length}/{CUSTOMER_NAME_MAX_LENGTH}
                                </span>
                            </div>
                            <ClearableInput
                                id="customerName"
                                autoComplete="new-password"
                                spellCheck={false}
                                value={customerName}
                                maxLength={CUSTOMER_NAME_MAX_LENGTH}
                                onChange={(e: any) => {
                                    const val = e.target.value.slice(0, CUSTOMER_NAME_MAX_LENGTH);
                                    setCustomerName(val);
                                    setShowCustomerSuggestions(true);
                                }}
                                onFocus={() => setShowCustomerSuggestions(true)}
                                onBlur={() => {
                                    setTimeout(() => {
                                        setShowCustomerSuggestions(false);
                                        setCustomerName(prev => prev.trim().replace(/\s+/g, ' ').slice(0, CUSTOMER_NAME_MAX_LENGTH));
                                    }, 200);
                                }}
                                placeholder="Enter name (e.g. Juan Carlos Dela Cruz)"
                                className={INPUT_STYLE}
                                required
                            />
                            {showCustomerSuggestions && customerSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-gray-100 no-print">
                                    <div className="px-3 py-1.5 bg-red-50 text-[10px] font-extrabold uppercase tracking-wider text-red-700 flex items-center justify-between">
                                        <span>Matching Customers</span>
                                        <span className="text-[9px] text-gray-400 font-medium">Click to select</span>
                                    </div>
                                    {customerSuggestions.map((cust, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="w-full px-3.5 py-2.5 text-left hover:bg-gray-50 focus:bg-gray-50 transition-colors flex items-center justify-between group"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setCustomerName(cust.name);
                                                if (cust.contactNumber) setContactNumber(formatContactNumber(cust.contactNumber));
                                                setShowCustomerSuggestions(false);
                                                toast.success(`Selected customer: ${cust.name}`);
                                            }}
                                        >
                                            <div>
                                                <div className="text-xs font-bold text-slate-800 group-hover:text-red-600">{cust.name}</div>
                                                <div className="text-[11px] text-gray-500 font-medium">{cust.contactNumber || 'No contact recorded'}</div>
                                            </div>
                                            <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={shippingPreference === 'pickup' ? 'col-span-1 md:col-span-1' : 'col-span-2 md:col-span-6'}>
                            <Label htmlFor="contactNumber" className={LABEL_STYLE}>Contact Number</Label>
                            <ClearableInput
                                id="contactNumber"
                                value={contactNumber}
                                onChange={(e: any) => setContactNumber(formatContactNumber(e.target.value))}
                                onClear={() => setContactNumber('')}
                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Backspace') {
                                        const digits = contactNumber.replace(/\D/g, '');
                                        if (digits.length <= 2) {
                                            e.preventDefault();
                                            setContactNumber('');
                                        }
                                    }
                                }}
                                placeholder="09xx-xxx-xxxx"
                                maxLength={13}
                                inputMode="numeric"
                                className={INPUT_STYLE}
                                required
                            />
                        </div>
                        {shippingPreference === 'pickup' && (
                            <div className="col-span-1 md:col-span-1">
                                <Label htmlFor="shippingPref" className={LABEL_STYLE}>Shipping Preference</Label>
                                <Select value={shippingPreference} onValueChange={(value: ShippingPreference) => setShippingPreference(value)}>
                                    <SelectTrigger id="shippingPref" aria-label="Shipping Preference" className={INPUT_STYLE}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pickup">Pickup</SelectItem>
                                        <SelectItem value="delivery">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {shippingPreference === 'delivery' && (
                        <div className="space-y-2.5">
                            {/* Row 1: Shipping Pref, Courier */}
                            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                                <div className="col-span-1">
                                    <Label htmlFor="shippingPref" className={LABEL_STYLE}>Shipping Preference</Label>
                                    <Select value={shippingPreference} onValueChange={(value: ShippingPreference) => setShippingPreference(value)}>
                                        <SelectTrigger id="shippingPref" aria-label="Shipping Preference" className={INPUT_STYLE}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pickup">Pickup</SelectItem>
                                            <SelectItem value="delivery">Delivery</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1">
                                    <Label htmlFor="deliveryCourier" className={LABEL_STYLE}>Delivery Courier</Label>
                                    <CreatableCombobox
                                        id="deliveryCourier"
                                        options={DELIVERY_COURIERS}
                                        value={deliveryCourier}
                                        onChange={setDeliveryCourier}
                                        placeholder="Select or type Courier"
                                        searchPlaceholder="Type custom courier (e.g. Lalamove, Grab)..."
                                        storageKey={CUSTOM_OPTION_KEYS.COURIERS}
                                    />
                                </div>
                            </div>

                            {/* Address: 2 cols on mobile, 3 cols on desktop */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
                                <div className="col-span-1">
                                    <Label htmlFor="unitNo" className={LABEL_STYLE}>HOUSE/UNIT NUMBER</Label>
                                    <ClearableInput
                                        id="unitNo"
                                        value={deliveryAddress.houseNo}
                                        onChange={(e: any) => setDeliveryAddress({ ...deliveryAddress, houseNo: e.target.value })}
                                        placeholder="#123"
                                        className={INPUT_STYLE}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <Label htmlFor="street" className={LABEL_STYLE}>STREET/BUILDING NAME</Label>
                                    <ClearableInput
                                        id="street"
                                        value={deliveryAddress.street}
                                        onChange={(e: any) => setDeliveryAddress({ ...deliveryAddress, street: e.target.value })}
                                        placeholder="Street/Subdivision"
                                        className={INPUT_STYLE}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <Label htmlFor="barangay" className={LABEL_STYLE}>BARANGAY/SUBDIVISION</Label>
                                    <ClearableInput
                                        id="barangay"
                                        value={deliveryAddress.barangay}
                                        onChange={(e: any) => setDeliveryAddress({ ...deliveryAddress, barangay: e.target.value })}
                                        placeholder="Barangay"
                                        className={INPUT_STYLE}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <Label htmlFor="city" className={LABEL_STYLE}>CITY/MUNICIPALITY</Label>
                                    <ClearableInput
                                        id="city"
                                        value={deliveryAddress.city}
                                        onChange={(e: any) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
                                        placeholder="City"
                                        className={INPUT_STYLE}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <Label htmlFor="province" className={LABEL_STYLE}>PROVINCE/REGION</Label>
                                    <ClearableInput
                                        id="province"
                                        value={deliveryAddress.province}
                                        onChange={(e: any) => setDeliveryAddress({ ...deliveryAddress, province: e.target.value })}
                                        placeholder="Province"
                                        className={INPUT_STYLE}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <Label htmlFor="zipCode" className={LABEL_STYLE}>ZIP CODE</Label>
                                    <ClearableInput
                                        id="zipCode"
                                        value={deliveryAddress.zipCode}
                                        onChange={(e: any) => setDeliveryAddress({ ...deliveryAddress, zipCode: e.target.value })}
                                        placeholder="Zip Code"
                                        className={INPUT_STYLE}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    )}


                </CardContent>
            </Card>

            {/* Shoes */}
            <div className="space-y-2">
                {
                    shoes.map((shoe, index) => (
                        <Card key={shoe.id} className="border-red-100/50 shadow-sm bg-white group relative rounded-2xl">
                            <CardHeader className={`${CARD_HEADER_STYLE} !py-1.5`}>
                                <div className="flex items-center justify-between translate-y-[1px]">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-600 text-white text-[10px] font-black w-[18px] h-[18px] flex items-center justify-center rounded">
                                            {index + 1}
                                        </div>
                                        <CardTitle className={`${CARD_TITLE_STYLE} text-slate-900`}>SHOE DETAILS</CardTitle>
                                    </div>
                                    {shoes.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeShoe(shoe.id)}
                                            className="h-5 w-5 bg-red-50 border border-red-200 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all p-0 rounded-full flex items-center justify-center shadow-2xs"
                                            title="Remove shoe"
                                        >
                                            <X size={12} strokeWidth={2.5} />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="px-3.5 sm:px-5 pt-0 pb-3">
                                <div className="space-y-4">
                                    {/* Top Section: Identification & Condition */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6 -mt-1">
                                        {/* Left Column: Identification & Condition */}
                                        <div className="md:col-span-5 flex flex-col gap-3 h-full">
                                            {/* Identification Row - Stacked for narrow column */}
                                            <div className="space-y-2.5">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label htmlFor={`shoeBrand-${shoe.id}`} className={LABEL_STYLE}>Brand <span className="text-red-500">*</span></Label>
                                                        <CreatableCombobox
                                                            id={`shoeBrand-${shoe.id}`}
                                                            options={SHOE_BRANDS}
                                                            value={shoe.brand}
                                                            onChange={(val) => {
                                                                const updates: Partial<ShoeEntry> = { brand: val };
                                                                if (val && shoe.shoeModel) {
                                                                    const modelBrand = MODEL_TO_BRAND[shoe.shoeModel];
                                                                    if (modelBrand && modelBrand !== val) {
                                                                        updates.shoeModel = '';
                                                                        updates.shoeMaterial = '';
                                                                    } else if (BRAND_MODELS[val] && !BRAND_MODELS[val].includes(shoe.shoeModel)) {
                                                                        updates.shoeModel = '';
                                                                        updates.shoeMaterial = '';
                                                                    }
                                                                }
                                                                updateShoe(shoe.id, updates);
                                                            }}
                                                            placeholder="Select or type Brand"
                                                            searchPlaceholder="Type custom brand..."
                                                            storageKey={CUSTOM_OPTION_KEYS.BRANDS}
                                                        />
                                                        {shoe.brand === 'Other' && (
                                                            <Input
                                                                id={`otherBrand-${shoe.id}`}
                                                                name={`otherBrand-${shoe.id}`}
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify brand"
                                                                value={shoe.otherBrand}
                                                                onChange={(e) => updateShoe(shoe.id, { otherBrand: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Label htmlFor={`shoeModel-${shoe.id}`} className={LABEL_STYLE}>Model <span className="text-gray-600 font-normal lowercase">(optional)</span></Label>
                                                        <CreatableCombobox
                                                            id={`shoeModel-${shoe.id}`}
                                                            options={shoe.brand ? (BRAND_MODELS[shoe.brand] || ['Other']) : ALL_MODELS}
                                                            value={shoe.shoeModel}
                                                            onChange={(val) => {
                                                                // [SMART BRAND DISCOVERY] If no brand is selected, automatically fill it based on the model chosen
                                                                if (!shoe.brand && MODEL_TO_BRAND[val]) {
                                                                    const detectedBrand = MODEL_TO_BRAND[val];
                                                                    const updates: Partial<ShoeEntry> = { 
                                                                        brand: detectedBrand, 
                                                                        shoeModel: val 
                                                                    };
                                                                    // Also auto-fill material if we know it
                                                                    if (MODEL_MATERIALS[val]) {
                                                                        updates.shoeMaterial = MODEL_MATERIALS[val];
                                                                    }
                                                                    updateShoe(shoe.id, updates);
                                                                    return;
                                                                }

                                                                const updates: Partial<ShoeEntry> = { shoeModel: val };
                                                                if (MODEL_MATERIALS[val]) {
                                                                    updates.shoeMaterial = MODEL_MATERIALS[val];
                                                                }
                                                                updateShoe(shoe.id, updates);
                                                            }}
                                                            placeholder="Select or type Model"
                                                            searchPlaceholder="Type model (e.g. Air Force 1)..."
                                                            storageKey={shoe.brand ? `${CUSTOM_OPTION_KEYS.MODELS}_${shoe.brand}` : CUSTOM_OPTION_KEYS.MODELS}
                                                        />
                                                        {shoe.shoeModel === 'Other' && (
                                                            <Input
                                                                id={`otherModel-${shoe.id}`}
                                                                name={`otherModel-${shoe.id}`}
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify model"
                                                                value={shoe.otherModel}
                                                                onChange={(e) => updateShoe(shoe.id, { otherModel: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Label htmlFor={`shoeMaterial-${shoe.id}`} className={LABEL_STYLE}>Material <span className="text-gray-600 font-normal lowercase">(optional)</span></Label>
                                                        <CreatableCombobox
                                                            id={`shoeMaterial-${shoe.id}`}
                                                            options={SHOE_MATERIALS}
                                                            value={shoe.shoeMaterial}
                                                            onChange={(val) => updateShoe(shoe.id, { shoeMaterial: val })}
                                                            placeholder="Select or type Material"
                                                            searchPlaceholder="Type custom material..."
                                                            storageKey={CUSTOM_OPTION_KEYS.MATERIALS}
                                                        />
                                                        {shoe.shoeMaterial === 'Other' && (
                                                            <Input
                                                                id={`otherMaterial-${shoe.id}`}
                                                                name={`otherMaterial-${shoe.id}`}
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify material"
                                                                value={shoe.otherMaterial}
                                                                onChange={(e) => updateShoe(shoe.id, { otherMaterial: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:flex md:flex-row gap-2.5 sm:gap-3 w-full">
                                                    <div className="col-span-1" style={{ flex: 24 }}>
                                                        <Label htmlFor={`shoeSize-${shoe.id}`} className={LABEL_STYLE}>Size <span className="text-gray-600 font-normal lowercase">(optional)</span></Label>
                                                        <CreatableCombobox
                                                            id={`shoeSize-${shoe.id}`}
                                                            options={SHOE_SIZES}
                                                            value={shoe.shoeSize || ''}
                                                            onChange={(val) => updateShoe(shoe.id, { shoeSize: val })}
                                                            placeholder="Select or type Size"
                                                            searchPlaceholder="Type custom size (e.g. 9.5)..."
                                                            storageKey={CUSTOM_OPTION_KEYS.SIZES}
                                                        />
                                                    </div>
                                                    <div className="col-span-1" style={{ flex: 28 }}>
                                                        <Label htmlFor={`shoeColor-${shoe.id}`} className={LABEL_STYLE} title="Multiple colors allowed (e.g. Black, Blue)">Color <span className="text-gray-600 font-normal lowercase">(optional)</span></Label>
                                                        <CreatableCombobox
                                                            id={`shoeColor-${shoe.id}`}
                                                            options={SHOE_COLORS}
                                                            value={Array.isArray(shoe.color) ? shoe.color.filter(Boolean).join(', ') : (shoe.color || '')}
                                                            onChange={(val) => updateShoe(shoe.id, { color: val })}
                                                            placeholder="Select or type Color"
                                                            searchPlaceholder="Type color (e.g. Black, Blue or White/Red)..."
                                                            multiple={true}
                                                            storageKey={CUSTOM_OPTION_KEYS.COLORS}
                                                        />
                                                        {shoe.color === 'Other' && (
                                                            <Input
                                                                id={`otherColor-${shoe.id}`}
                                                                name={`otherColor-${shoe.id}`}
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify color"
                                                                value={shoe.otherColor || ''}
                                                                onChange={(e) => updateShoe(shoe.id, { otherColor: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className={shoe.priorityLevel === 'rush' ? 'col-span-1 md:flex-1' : 'col-span-2 md:flex-1'} style={{ flex: shoe.priorityLevel === 'rush' ? 26 : 48 }}>
                                                        <div className="flex items-center justify-between">
                                                            <Label htmlFor={`priorityLevel-${shoe.id}`} className={LABEL_STYLE}>Priority Level</Label>
                                                        </div>
                                                        <div className="relative group/select">
                                                            <Select
                                                                value={shoe.priorityLevel || 'regular'}
                                                                onValueChange={(val: Priority) => {
                                                                    if (val === 'rush') {
                                                                        const applicable = getApplicableRushFee(shoe.baseService || [], shoe.addOns || [], services);
                                                                        const configuredReduction = (applicable && applicable.durationDays !== undefined && applicable.durationDays !== 0)
                                                                            ? Math.abs(Number(applicable.durationDays))
                                                                            : 9;
                                                                        const reductionStr = String(configuredReduction);
                                                                        updateShoe(shoe.id, { 
                                                                            priorityLevel: 'rush',
                                                                            rushReductionDays: reductionStr
                                                                        });
                                                                        setPriorityLevel('rush');
                                                                        setBasicCleaningRushReduction(reductionStr);
                                                                        if (applicable) {
                                                                            toast.info(`Rush priority set: ${applicable.name} (+${formatPeso(applicable.price)}, -${configuredReduction}d)`);
                                                                        } else {
                                                                            toast.info('Rush priority set for expedited turnaround.');
                                                                        }
                                                                    } else {
                                                                        updateShoe(shoe.id, { priorityLevel: 'regular', rushReductionDays: undefined });
                                                                    }
                                                                }}
                                                            >
                                                                <SelectTrigger id={`priorityLevel-${shoe.id}`} aria-label="Priority Level" className={`${INPUT_STYLE} font-normal`}>
                                                                    <SelectValue placeholder="Regular" />
                                                                </SelectTrigger>
                                                                {(() => {
                                                                    const applicable = getApplicableRushFee(shoe.baseService || [], shoe.addOns || [], services);
                                                                    const hasBase = (shoe.baseService || []).length > 0;
                                                                    return (
                                                                        <SelectContent align="start" side="bottom" position="popper" sideOffset={5} className="pb-0 overflow-hidden">
                                                                            <SelectItem value="regular">Regular</SelectItem>
                                                                            <SelectItem value="rush" disabled={!applicable && hasBase}>
                                                                                Rush
                                                                            </SelectItem>
                                                                            <div className="sticky bottom-0 z-10 p-1.5 border-t border-gray-100 bg-gray-50/95 backdrop-blur-xs text-[10px] text-gray-500 font-semibold flex items-center justify-center select-none text-center">
                                                                                <span>
                                                                                    {applicable 
                                                                                        ? `${applicable.name}: +${formatPeso(applicable.price)} • ${applicable.durationDays ? Math.abs(Number(applicable.durationDays)) : 9}d reduction`
                                                                                        : 'Rush: Expedited service'}
                                                                                </span>
                                                                            </div>
                                                                        </SelectContent>
                                                                    );
                                                                })()}
                                                            </Select>
                                                            {(shoe.priorityLevel && shoe.priorityLevel !== 'regular') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateShoe(shoe.id, { priorityLevel: 'regular', rushReductionDays: undefined })}
                                                                    aria-label="Reset to Regular"
                                                                    className="absolute right-8 top-1/2 -translate-y-1/2 min-w-[24px] min-h-[24px] flex items-center justify-center p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors opacity-0 group-hover/select:opacity-100 cursor-pointer"
                                                                    title="Reset to Regular"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {shoe.priorityLevel === 'rush' && (
                                                        <div className="col-span-1 md:flex-none" style={{ flex: 22 }}>
                                                            <Label htmlFor={`rushReductionDays-${shoe.id}`} className={`${LABEL_STYLE} whitespace-nowrap`} title="Reduced By">Reduced By</Label>
                                                            <div className="relative flex items-center">
                                                                <Input
                                                                    id={`rushReductionDays-${shoe.id}`}
                                                                    name={`rushReductionDays-${shoe.id}`}
                                                                    type="text"
                                                                    placeholder=""
                                                                    inputMode="numeric"
                                                                    pattern="[0-9]*"
                                                                    value={(() => {
                                                                        if (shoe.rushReductionDays !== undefined) return String(shoe.rushReductionDays);
                                                                        const applicable = getApplicableRushFee(shoe.baseService || [], shoe.addOns || [], services);
                                                                        return String((applicable && applicable.durationDays !== undefined && applicable.durationDays !== 0)
                                                                            ? Math.abs(Number(applicable.durationDays))
                                                                            : (parseInt(basicCleaningRushReduction, 10) || 9));
                                                                    })()}
                                                                    onChange={(e: any) => {
                                                                        const val = e.target.value.replace(/\D/g, '');
                                                                        const cleanVal = val.replace(/^0+/, '');
                                                                        updateShoe(shoe.id, { rushReductionDays: cleanVal });
                                                                        setBasicCleaningRushReduction(cleanVal);
                                                                    }}
                                                                    className={`${INPUT_STYLE} !text-left font-bold pl-3 pr-10`}
                                                                />
                                                                <span className="absolute right-3 text-[11px] text-gray-400 font-bold pointer-events-none">days</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Shoe Condition Section */}
                                            <div className="flex flex-col flex-1 gap-2 pt-2 border-t border-gray-200 mt-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Shoe Condition</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Reset condition"
                                                            className="h-6 w-6 min-w-[24px] min-h-[24px] flex items-center justify-center bg-transparent border border-transparent shadow-none text-gray-500 hover:bg-white hover:text-red-600 hover:border-red-100 hover:shadow-md p-0 transition-all rounded-md"
                                                            onClick={() => updateShoe(shoe.id, {
                                                                condition: {
                                                                    scratches: false,
                                                                    yellowing: false,
                                                                    ripsHoles: false,
                                                                    deepStains: false,
                                                                    soleSeparation: false,
                                                                    wornOut: false,
                                                                    others: ''
                                                                }
                                                            })}
                                                            title="Reset condition"
                                                        >
                                                            <RotateCcw className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-gray-600 uppercase italic">Check all that apply</span>
                                                </div>
                                                <div className="bg-white rounded-xl border border-red-100/50 p-3">
                                                    <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                                                        {[
                                                            { id: 'scratches', label: 'Scratches' },
                                                            { id: 'yellowing', label: 'Yellowing' },
                                                            { id: 'ripsHoles', label: 'Rips/Holes' },
                                                            { id: 'deepStains', label: 'Deep Stains' },
                                                            { id: 'soleSeparation', label: 'Sole Separation' },
                                                            { id: 'wornOut', label: 'Faded/Worn' },
                                                        ].map((cond) => (
                                                            <div key={cond.id} className="flex items-center space-x-3">
                                                                <Checkbox
                                                                    id={`${cond.id}-${shoe.id}`}
                                                                    checked={(shoe.condition as any)[cond.id]}
                                                                    onCheckedChange={(checked) =>
                                                                        updateShoe(shoe.id, {
                                                                            condition: { ...shoe.condition, [cond.id]: checked as boolean }
                                                                        })
                                                                    }
                                                                    className="h-5 w-5 border-gray-300 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                />
                                                                <label htmlFor={`${cond.id}-${shoe.id}`} className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                                                                    {cond.label}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="relative pt-1 flex-1 flex flex-col gap-1.5">
                                                    <div className="relative flex-1 flex flex-col min-h-[88px]">
                                                        <Textarea
                                                            id={`conditionNotes-${shoe.id}`}
                                                            name={`conditionNotes-${shoe.id}`}
                                                            aria-label="Shoe condition notes"
                                                            placeholder="Notes: "
                                                            value={shoe.condition.others}
                                                            onChange={(e) =>
                                                                updateShoe(shoe.id, {
                                                                    condition: { ...shoe.condition, others: e.target.value }
                                                                })
                                                            }
                                                            rows={3}
                                                            className="text-[11px] bg-[#F8F9FA]/80 border-none rounded-xl placeholder:text-gray-400/70 pl-3 pr-10 py-2.5 focus:ring-1 focus:ring-red-50 transition-all min-h-[88px] h-full flex-1 resize-none shadow-inner w-full leading-relaxed"
                                                        />
                                                        {/* Small camera button with dropdown to capture or upload before condition photo (Admin only) */}
                                                        {isAdminAccount && (
                                                            <div className="absolute right-2.5 top-2.5 flex items-center gap-1 z-10">
                                                                {/* Hidden input for direct device camera */}
                                                                <input
                                                                    type="file"
                                                                    id={`before-camera-native-${shoe.id}`}
                                                                    name={`before-camera-native-${shoe.id}`}
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    className="hidden"
                                                                    onChange={async (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (!file) return;
                                                                        try {
                                                                            const dataUrl = await compressImageFile(file);
                                                                            updateShoe(shoe.id, { beforeImage: dataUrl });
                                                                            toast.success("Before photo attached to shoe condition");
                                                                        } catch {
                                                                            const reader = new FileReader();
                                                                            reader.onload = () => {
                                                                                updateShoe(shoe.id, { beforeImage: reader.result as string });
                                                                                toast.success("Before photo attached to shoe condition");
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                        e.target.value = '';
                                                                    }}
                                                                />
                                                                {/* Hidden input for gallery/file upload */}
                                                                <input
                                                                    type="file"
                                                                    id={`before-camera-upload-${shoe.id}`}
                                                                    name={`before-camera-upload-${shoe.id}`}
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={async (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (!file) return;
                                                                        try {
                                                                            const dataUrl = await compressImageFile(file);
                                                                            updateShoe(shoe.id, { beforeImage: dataUrl });
                                                                            toast.success("Before photo attached to shoe condition");
                                                                        } catch {
                                                                            const reader = new FileReader();
                                                                            reader.onload = () => {
                                                                                updateShoe(shoe.id, { beforeImage: reader.result as string });
                                                                                toast.success("Before photo attached to shoe condition");
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                        e.target.value = '';
                                                                    }}
                                                                />

                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button
                                                                            type="button"
                                                                            aria-label="Take photo with camera or upload"
                                                                            className="p-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer shadow-2xs group"
                                                                            title="Take photo with camera or upload"
                                                                        >
                                                                            <Camera className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-52 bg-white border border-gray-100 shadow-xl rounded-xl p-1.5 z-50">
                                                                        <DropdownMenuItem
                                                                            onClick={() => setCameraModalShoeId(shoe.id)}
                                                                            className="text-xs font-bold text-gray-700 hover:text-red-600 hover:bg-red-50/80 rounded-lg p-2 flex items-center gap-2 cursor-pointer"
                                                                        >
                                                                            <Camera className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                                                            <span>Take Photo (Camera)</span>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() => document.getElementById(`before-camera-upload-${shoe.id}`)?.click()}
                                                                            className="text-xs font-bold text-gray-700 hover:text-red-600 hover:bg-red-50/80 rounded-lg p-2 flex items-center gap-2 cursor-pointer"
                                                                        >
                                                                            <Upload className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                                            <span>Upload from Files</span>
                                                                        </DropdownMenuItem>
                                                                        {shoe.beforeImage && (
                                                                            <DropdownMenuItem
                                                                                onClick={() => updateShoe(shoe.id, { beforeImage: undefined })}
                                                                                className="text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg p-2 flex items-center gap-2 cursor-pointer border-t border-gray-100 mt-1"
                                                                            >
                                                                                <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                                                                <span>Remove Photo</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Thumbnail preview if before photo attached (Admin only) */}
                                                    {isAdminAccount && shoe.beforeImage && (
                                                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-red-50/60 border border-red-200/60 shrink-0 animate-in fade-in duration-200">
                                                            <div className="w-8 h-8 rounded-md overflow-hidden border border-red-200 bg-white shrink-0 shadow-2xs">
                                                                <img src={shoe.beforeImage} alt="Before condition" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-[10px] font-bold text-red-900 block truncate">Before photo attached</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateShoe(shoe.id, { beforeImage: undefined })}
                                                                aria-label="Remove photo"
                                                                className="text-gray-400 hover:text-red-600 p-1 min-w-[24px] min-h-[24px] flex items-center justify-center cursor-pointer"
                                                                title="Remove photo"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Services & Add-ons */}
                                        <div className="md:col-span-7 border-l border-gray-50 md:pl-8 flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Services & Add-ons</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Reset services"
                                                        className="h-6 w-6 min-w-[24px] min-h-[24px] flex items-center justify-center bg-transparent border border-transparent shadow-none text-gray-500 hover:bg-white hover:text-red-600 hover:border-red-100 hover:shadow-md p-0 transition-all rounded-md"
                                                        onClick={() => updateShoe(shoe.id, { baseService: [], addOns: [] })}
                                                        title="Reset services"
                                                    >
                                                        <RotateCcw className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                {(shoe.baseService && shoe.baseService.length > 0) || getShoeTotal(shoe) > 0 ? (
                                                    <span className="text-xs font-black text-red-600 bg-red-50/50 px-2.5 py-1 rounded uppercase flex items-center gap-1.5">
                                                        <span className="text-[10px] opacity-70">Unit Total:</span> {formatPeso(getShoeTotal(shoe))}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-600 uppercase italic">Select applicable services</span>
                                                )}
                                            </div>

                                            <div className="bg-[#F8F9FA]/50 p-3 rounded-xl border border-gray-100 flex-grow flex flex-col">
                                                <div className="flex flex-col h-full gap-4">
                                                    {/* Base Services */}
                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Base Services</span>
                                                        <div className="w-full">
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                {baseServices.map(service => {
                                                                     const isChecked = (Array.isArray(shoe.baseService) ? shoe.baseService : []).includes(service.name);
                                                                     const isRushPair = shoe.priorityLevel === 'rush';
                                                                     const priorityCatalog = services.filter(s => s.category === 'priority' && s.active !== false);
                                                                     const isSupportedByRush = priorityCatalog.length === 0 || priorityCatalog.some(p => {
                                                                         if (!p.connectedBaseServices || p.connectedBaseServices.length === 0) return true;
                                                                         return p.connectedBaseServices.includes(service.name);
                                                                     });
                                                                     const isServiceDisabled = isRushPair && !isSupportedByRush;

                                                                     return (
                                                                         <label
                                                                             key={service.id}
                                                                             htmlFor={`shoe-${shoe.id}-service-${service.id}`}
                                                                             title={isServiceDisabled ? "No configured Rush Fee is applicable to this base service" : (service.name === 'Full Reglue' ? "Full Reglue (₱250.00) - (Select Midsole or Undersole)" : service.name === 'Color Renewal' ? "Color Renewal (Price varies) - (Select 2 Colors or 3 Colors)" : service.name)}
                                                                             className={`flex ${isChecked ? 'items-start min-h-[64px]' : 'items-center min-h-[58px]'} space-x-2 p-2.5 rounded-lg border transition-all shadow-sm ${
                                                                                 isServiceDisabled
                                                                                     ? 'opacity-40 cursor-not-allowed bg-gray-50/80 border-gray-200'
                                                                                     : isChecked
                                                                                         ? 'border-red-100 bg-red-50/10 cursor-pointer'
                                                                                         : 'bg-white border-gray-100 hover:border-red-100 cursor-pointer'
                                                                             }`}
                                                                         >
                                                                             <Checkbox
                                                                                 type="button"
                                                                                 id={`shoe-${shoe.id}-service-${service.id}`}
                                                                                 name={`shoe-${shoe.id}-service-${service.id}`}
                                                                                 checked={isChecked}
                                                                                 disabled={isServiceDisabled}
                                                                                 onCheckedChange={(checked) => {
                                                                                     const currentServices = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                                                                                     let newServices = checked
                                                                                         ? [...currentServices, service.name]
                                                                                         : currentServices.filter(s => s !== service.name);

                                                                                     if (isRushPair && newServices.length === 0) {
                                                                                         updateShoe(shoe.id, { priorityLevel: 'regular', baseService: [], addOns: [] });
                                                                                         return;
                                                                                     }

                                                                                     // Minor Reglue and Full Reglue are mutually exclusive
                                                                                     if (checked && service.name === 'Minor Reglue') {
                                                                                         newServices = newServices.filter(s => s !== 'Full Reglue');
                                                                                     } else if (checked && service.name === 'Full Reglue') {
                                                                                         newServices = newServices.filter(s => s !== 'Minor Reglue');
                                                                                     }

                                                                                     // Auto-select Basic Cleaning if Minor/Full Reglue or Color Renewal is selected
                                                                                     const requiresCleaning = ['Minor Reglue', 'Full Reglue', 'Color Renewal'];
                                                                                     if (checked && requiresCleaning.includes(service.name)) {
                                                                                         if (!newServices.includes('Basic Cleaning')) {
                                                                                             newServices.push('Basic Cleaning');
                                                                                         }
                                                                                     }

                                                                                     // If Basic Cleaning is unchecked, also uncheck services that require it
                                                                                     if (!checked && service.name === 'Basic Cleaning') {
                                                                                         newServices = newServices.filter(s => !requiresCleaning.includes(s));
                                                                                     }

                                                                                     const nextAddOns = syncFullReglueAddons(syncColorRenewalAddons(shoe.addOns || [], newServices), newServices).filter(a => isAddonVisibleForBaseServices(a.name, newServices, services));
                                                                                     updateShoe(shoe.id, { baseService: newServices, addOns: nextAddOns });
                                                                                 }}
                                                                                 className={`h-4 w-4 shrink-0 ${isChecked ? 'self-start mt-0.5' : ''} data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600`}
                                                                             />
                                                                             {isChecked ? (
                                                                                 <div className="flex flex-col min-w-0 flex-1">
                                                                                     <div className="flex items-center justify-between gap-1 min-w-0">
                                                                                         <span className="text-[11px] font-bold leading-tight text-gray-700 whitespace-nowrap truncate">
                                                                                             {service.name}
                                                                                         </span>
                                                                                         {service.code && (
                                                                                             <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ml-auto">
                                                                                                 {service.code}
                                                                                             </span>
                                                                                         )}
                                                                                     </div>
                                                                                     {service.name === 'Full Reglue' ? (
                                                                                         <div className="mt-0.5 min-w-0 overflow-hidden">
                                                                                             <span className="text-[7.5px] sm:text-[8px] font-medium text-gray-500 leading-tight block whitespace-nowrap truncate tracking-tight" title="(Select Midsole or Undersole)">
                                                                                                 (Select Midsole or Undersole)
                                                                                             </span>
                                                                                         </div>
                                                                                     ) : service.name === 'Color Renewal' ? (
                                                                                         <div className="mt-0.5 min-w-0 overflow-hidden">
                                                                                             <span className="text-[7.5px] sm:text-[8px] font-medium text-gray-500 leading-tight block whitespace-nowrap truncate tracking-tight" title="(Select 2 Colors or 3 Colors)">
                                                                                                 (Select 2 Colors or 3 Colors)
                                                                                             </span>
                                                                                         </div>
                                                                                     ) : null}
                                                                                      <div className="flex items-center justify-end mt-1 min-w-0">
                                                                                          <span className="text-[11px] font-black text-red-600 shrink-0 ml-auto whitespace-nowrap">
                                                                                              {service.price > 0 ? formatPeso(service.price) : 'Price varies'}
                                                                                          </span>
                                                                                      </div>
                                                                                  </div>
                                                                              ) : (
                                                                                 <div className="flex items-center justify-between gap-1.5 min-w-0 flex-1 overflow-hidden">
                                                                                     <span className="text-[11px] font-bold leading-tight text-gray-700 whitespace-nowrap truncate min-w-0" title={service.name}>
                                                                                         {service.name}
                                                                                     </span>
                                                                                     {service.code && (
                                                                                         <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ml-auto">
                                                                                             {service.code}
                                                                                         </span>
                                                                                     )}
                                                                                 </div>
                                                                             )}
                                                                         </label>
                                                                     );
                                                                 })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Add-ons Section */}
                                                    <div className="space-y-3 pt-3 border-t border-gray-200 flex flex-col flex-grow">
                                                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Add-on Services</span>
                                                        {(() => {
                                                            const activeRush = getApplicableRushFee(shoe.baseService || [], shoe.addOns || [], services);
                                                            const rushHasAddonWhitelist = activeRush && Array.isArray(activeRush.connectedAddons) && activeRush.connectedAddons.length > 0;
                                                            const rushBlocksAllAddons = shoe.priorityLevel === 'rush' && !rushHasAddonWhitelist;

                                                            if (rushBlocksAllAddons) {
                                                                return (
                                                                    <div className="border border-amber-200/80 bg-amber-50/60 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1.5 flex-grow min-h-[70px]">
                                                                        <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                                                                            <Info size={14} className="text-amber-600 shrink-0" />
                                                                            <span>Rush Order Restriction</span>
                                                                        </div>
                                                                        <p className="text-[11px] text-amber-700 font-medium">
                                                                            {activeRush?.name || 'Rush'} applies to base services only (no add-on services).
                                                                        </p>
                                                                    </div>
                                                                );
                                                            }

                                                            if (!shoe.baseService || shoe.baseService.length === 0) {
                                                                return (
                                                                    <div className="border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-white gap-2 min-h-[60px] flex-grow">
                                                                        <span className="text-xs font-bold italic text-gray-600 uppercase tracking-widest">Awaiting Base Service</span>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div className="max-h-[114px] overflow-y-auto pr-1.5 addon-scrollbar">
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                    {sortAddonsForDisplay(
                                                                        addOnServices.filter(addon => isAddonVisibleForBaseServices(addon.name, shoe.baseService || [], services)),
                                                                        shoe.baseService || []
                                                                    ).map((addon) => {
                                                                        const isChecked = shoe.addOns.some(a => a.name === addon.name);
                                                                        const addonItem = shoe.addOns.find(a => a.name === addon.name);
                                                                        const quantity = addonItem?.quantity || 1;
                                                                        const showSpinner = Boolean(addon.hasSpinner ?? ((addon.name || '').toLowerCase() === 'unyellowing' || (addon.name || '').toLowerCase() === 'white paint'));
                                                                        return (
                                                                            <div key={addon.id} className={`px-2 py-1.5 rounded-lg border bg-white transition-all h-[52px] flex flex-col justify-center ${isChecked ? 'border-red-100 bg-red-50/10' : 'border-gray-50'}`}>
                                                                                {isChecked ? (
                                                                                    <div className="flex items-start space-x-2 min-w-0 w-full">
                                                                                        <Checkbox
                                                                                            type="button"
                                                                                            id={`addon-${shoe.id}-${addon.id}`}
                                                                                            name={`addon-${shoe.id}-${addon.id}`}
                                                                                            checked={isChecked}
                                                                                            onCheckedChange={(checked) => {
                                                                                                let newAddOns = shoe.addOns || [];
                                                                                                if (isColorCountAddon(addon.name)) {
                                                                                                    newAddOns = applyColorCountExclusive(
                                                                                                        newAddOns,
                                                                                                        addon.name,
                                                                                                        Boolean(checked),
                                                                                                        shoe.baseService || [],
                                                                                                    );
                                                                                                } else {
                                                                                                    newAddOns = checked
                                                                                                        ? [...newAddOns, { name: addon.name, quantity: 1 }]
                                                                                                        : newAddOns.filter(a => a.name !== addon.name);
                                                                                                    if (addon.name === 'Unyellowing' && !checked) {
                                                                                                        newAddOns = newAddOns.filter(a => a.name !== 'White Paint');
                                                                                                    }
                                                                                                }

                                                                                                let newBaseServices = Array.isArray(shoe.baseService) ? [...shoe.baseService] : [];
                                                                                                const isReglueSoleAddon = (name: string) => {
                                                                                                    const l = (name || '').toLowerCase();
                                                                                                    return (
                                                                                                        name === 'Full Reglue Midsole' ||
                                                                                                        name === 'Full Reglue Undersole' ||
                                                                                                        name === 'Midsole Full Reglue' ||
                                                                                                        name === 'Undersole Full Reglue' ||
                                                                                                        name === 'Midsole' ||
                                                                                                        name === 'Undersole' ||
                                                                                                        (l.includes('reglue') && (l.includes('midsole') || l.includes('undersole')))
                                                                                                    );
                                                                                                };

                                                                                                if (checked && isReglueSoleAddon(addon.name)) {
                                                                                                    if (!newBaseServices.includes('Full Reglue')) {
                                                                                                        newBaseServices.push('Full Reglue');
                                                                                                    }
                                                                                                    if (!newBaseServices.includes('Basic Cleaning')) {
                                                                                                        newBaseServices.push('Basic Cleaning');
                                                                                                    }
                                                                                                }

                                                                                                const nextAddOns = syncFullReglueAddons(syncColorRenewalAddons(newAddOns, newBaseServices), newBaseServices).filter(a => isAddonVisibleForBaseServices(a.name, newBaseServices, services));
                                                                                                updateShoe(shoe.id, { baseService: newBaseServices, addOns: nextAddOns });
                                                                                            }}
                                                                                            className="h-4 w-4 shrink-0 self-start mt-0.5 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                                        />
                                                                                        <div className="flex flex-col min-w-0 flex-1">
                                                                                            <div className="flex items-center justify-between gap-1 min-w-0">
                                                                                                <label htmlFor={`addon-${shoe.id}-${addon.id}`} className="text-[11px] font-bold text-gray-700 cursor-pointer leading-tight whitespace-nowrap truncate">
                                                                                                    {addon.name}
                                                                                                </label>
                                                                                                {addon.code && (
                                                                                                    <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ml-auto">
                                                                                                        {addon.code}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex items-center justify-between gap-2 mt-1 min-w-0">
                                                                                                {showSpinner ? (
                                                                                                    <div className="flex items-center shrink-0">
                                                                                                        <input
                                                                                                            type="number"
                                                                                                            id={`addon-qty-${shoe.id}-${addon.id}`}
                                                                                                            name={`addon-qty-${shoe.id}-${addon.id}`}
                                                                                                            aria-label={`${addon.name} quantity`}
                                                                                                            min="1"
                                                                                                            value={quantity}
                                                                                                            onChange={(e) => {
                                                                                                                const val = e.target.value;
                                                                                                                const newQuantity = val === '' ? 1 : Math.max(1, parseInt(val));
                                                                                                                const newAddOns = shoe.addOns.map(a =>
                                                                                                                    a.name === addon.name ? { ...a, quantity: newQuantity } : a
                                                                                                                );
                                                                                                                updateShoe(shoe.id, { addOns: newAddOns });
                                                                                                            }}
                                                                                                            className="w-9 h-5 border border-gray-200 rounded text-[10px] font-bold text-center focus:outline-none focus:border-red-500 bg-white [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-inner-spin-button]:h-[16px] [&::-webkit-inner-spin-button]:my-auto px-0"
                                                                                                        />
                                                                                                    </div>
                                                                                                ) : <div />}
                                                                                                {(() => {
                                                                                                    const isFR = (shoe.baseService || []).includes('Full Reglue');
                                                                                                    const isSole = isFullReglueSoleAddon(addon.name);
                                                                                                    if (isFR && isSole) {
                                                                                                        const solePricing = getSoleAddonPricingDisplay(addon.name, shoe.addOns || [], shoe.baseService || []);
                                                                                                        return (
                                                                                                            <span className="text-[11px] font-black text-red-600 shrink-0 ml-auto">
                                                                                                                {solePricing.displayLabel}
                                                                                                            </span>
                                                                                                        );
                                                                                                    }
                                                                                                    return (
                                                                                                        <span className="text-[11px] font-black text-red-600 shrink-0 ml-auto">{formatPeso(getAddonTotal(addon.name, quantity))}</span>
                                                                                                    );
                                                                                                })()}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center space-x-2 min-w-0 w-full">
                                                                                        <Checkbox
                                                                                            type="button"
                                                                                            id={`addon-${shoe.id}-${addon.id}`}
                                                                                            name={`addon-${shoe.id}-${addon.id}`}
                                                                                            checked={isChecked}
                                                                                            className="h-4 w-4 shrink-0 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                                            onCheckedChange={(checked) => {
                                                                                                let newAddOns = shoe.addOns || [];
                                                                                                if (isColorCountAddon(addon.name)) {
                                                                                                    newAddOns = applyColorCountExclusive(
                                                                                                        newAddOns,
                                                                                                        addon.name,
                                                                                                        Boolean(checked),
                                                                                                        shoe.baseService || [],
                                                                                                    );
                                                                                                } else {
                                                                                                    newAddOns = checked
                                                                                                        ? [...newAddOns, { name: addon.name, quantity: 1 }]
                                                                                                        : newAddOns.filter(a => a.name !== addon.name);
                                                                                                    if (addon.name === 'Unyellowing' && !checked) {
                                                                                                        newAddOns = newAddOns.filter(a => a.name !== 'White Paint');
                                                                                                    }
                                                                                                }

                                                                                                let newBaseServices = Array.isArray(shoe.baseService) ? [...shoe.baseService] : [];
                                                                                                const isReglueSoleAddon = (name: string) => {
                                                                                                    const l = (name || '').toLowerCase();
                                                                                                    return (
                                                                                                        name === 'Full Reglue Midsole' ||
                                                                                                        name === 'Full Reglue Undersole' ||
                                                                                                        name === 'Midsole Full Reglue' ||
                                                                                                        name === 'Undersole Full Reglue' ||
                                                                                                        name === 'Midsole' ||
                                                                                                        name === 'Undersole' ||
                                                                                                        (l.includes('reglue') && (l.includes('midsole' ) || l.includes('undersole')))
                                                                                                    );
                                                                                                };

                                                                                                if (checked && isReglueSoleAddon(addon.name)) {
                                                                                                    if (!newBaseServices.includes('Full Reglue')) {
                                                                                                        newBaseServices.push('Full Reglue');
                                                                                                    }
                                                                                                    if (!newBaseServices.includes('Basic Cleaning')) {
                                                                                                        newBaseServices.push('Basic Cleaning');
                                                                                                    }
                                                                                                }

                                                                                                const nextAddOns = syncFullReglueAddons(syncColorRenewalAddons(newAddOns, newBaseServices), newBaseServices);
                                                                                                updateShoe(shoe.id, { baseService: newBaseServices, addOns: nextAddOns });
                                                                                            }}
                                                                                        />
                                                                                        <div className="flex items-center justify-between gap-1.5 min-w-0 flex-1">
                                                                                            <label htmlFor={`addon-${shoe.id}-${addon.id}`} className="text-[11px] font-bold text-gray-600 cursor-pointer leading-tight whitespace-nowrap truncate">
                                                                                                {addon.name}
                                                                                            </label>
                                                                                            {addon.code && (
                                                                                                <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ml-auto">
                                                                                                    {addon.code}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                </div>
                                            
                                            {/* Supplies & Materials Used */}
                                            <div className="space-y-3 pt-3 border-t border-gray-200 mt-4 h-full">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Supplies & Materials Used</span>
                                                    <span className="text-[10px] font-bold text-gray-600 uppercase italic">Stock will be subtracted</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {shoe.inventoryUsed.map((usage, uIdx) => {
                                                        const item = inventoryData.find((i: any) => i.id === usage.itemId);
                                                        const retPrice = getItemRetailPrice(item);
                                                        const isDiscrete = item?.is_retail || item?.unit === 'pairs' || item?.unit === 'pcs' || item?.unit === 'bottle' || item?.unit === 'pair' || item?.unit === 'box';
                                                        const rowRetailTotal = retPrice * (Number(usage.amount) || 0);

                                                        return (
                                                            <div key={uIdx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm animate-in fade-in slide-in-from-left-2 duration-300">
                                                                 <InventorySearchSelect
                                                                    value={usage.itemId?.toString() || ""}
                                                                    inventoryData={inventoryData}
                                                                    onValueChange={(val) => {
                                                                        const newUsage = [...shoe.inventoryUsed];
                                                                        const newId = parseInt(val);
                                                                        const selectedItem = inventoryData.find((i: any) => i.id === newId);
                                                                        const isNewDiscrete = selectedItem?.is_retail || selectedItem?.unit === 'pairs' || selectedItem?.unit === 'pcs' || selectedItem?.unit === 'bottle' || selectedItem?.unit === 'pair' || selectedItem?.unit === 'box';
                                                                        newUsage[uIdx].itemId = newId;
                                                                        if (isNewDiscrete && (newUsage[uIdx].amount < 1 || newUsage[uIdx].amount % 1 !== 0)) {
                                                                            newUsage[uIdx].amount = Math.max(1, Math.round(newUsage[uIdx].amount));
                                                                        }
                                                                        updateShoe(shoe.id, { inventoryUsed: newUsage });
                                                                    }}
                                                                />

                                                                {retPrice > 0 && (
                                                                    <div className="flex items-center gap-1 shrink-0 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                                                                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">
                                                                            Retail: {formatPeso(retPrice)}
                                                                        </span>
                                                                        {Number(usage.amount) > 1 && (
                                                                            <span className="text-[10px] font-black text-emerald-950">
                                                                                ({formatPeso(rowRetailTotal)})
                                                                            </span>
                                                                        )}
                                                                      </div>
                                                                  )}

                                                                  <div className="flex items-center gap-1 shrink-0 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                                                    <input
                                                                        type="number"
                                                                        id={`supply-amount-${shoe.id}-${uIdx}`}
                                                                        name={`supply-amount-${shoe.id}-${uIdx}`}
                                                                        aria-label={`Supply quantity for ${item?.name || 'supply'}`}
                                                                        step={isDiscrete ? "1" : "0.1"}
                                                                        min={isDiscrete ? "1" : "0.01"}
                                                                        value={usage.amount}
                                                                        onChange={(e) => {
                                                                            const newUsage = [...shoe.inventoryUsed];
                                                                            newUsage[uIdx].amount = parseFloat(e.target.value) || 0;
                                                                            updateShoe(shoe.id, { inventoryUsed: newUsage });
                                                                        }}
                                                                        className="w-12 h-6 bg-transparent text-[11px] font-black text-center focus:outline-none"
                                                                    />
                                                                    <span className="text-[9px] font-black text-gray-400 uppercase">{item?.unit || 'qty'}</span>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        const newUsage = shoe.inventoryUsed.filter((_, idx) => idx !== uIdx);
                                                                        updateShoe(shoe.id, { inventoryUsed: newUsage });
                                                                    }}
                                                                    className="h-6 w-6 text-red-400 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <X size={12} />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            const firstAvailable = inventoryData[0]?.id;
                                                            if (firstAvailable) {
                                                                updateShoe(shoe.id, {
                                                                    inventoryUsed: [...shoe.inventoryUsed, { itemId: firstAvailable, amount: 1 }]
                                                                });
                                                            } else {
                                                                toast.error("Inventory list is empty.");
                                                            }
                                                        }}
                                                        className="w-full h-8 border border-dashed border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50/50 hover:border-red-100 text-[10px] font-black uppercase tracking-widest gap-2"
                                                    >
                                                        <Plus size={12} className="stroke-[3]" />
                                                        Add Supply Used
                                                    </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                }
            </div>

            {/* Add Shoe Button */}
            <div className="my-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={addShoe}
                    className="w-full border-red-500 text-red-500 hover:bg-red-50 border flex items-center justify-center gap-1.5 h-10 font-black text-xs uppercase tracking-widest transition-all"
                >
                    <Plus size={16} className="stroke-[3]" />
                    Add Another Shoe Item
                </Button>
            </div>

            {/* Order Summary Section */}
            <Card className="border-red-100/50 shadow-sm bg-white overflow-hidden">
                <CardHeader className={`${CARD_HEADER_STYLE} !py-2`}>
                    <div className="flex items-center justify-between w-full translate-y-[1px]">
                        <div className="flex items-center gap-3">
                            <ClipboardList className="text-red-600" size={18} />
                            <CardTitle className={`${CARD_TITLE_STYLE} text-slate-900`}>JOB ORDER SUMMARY</CardTitle>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleResetForm}
                            className="h-7 px-2 text-xs font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors gap-2"
                        >
                            <RotateCcw size={14} />
                            RESET FORM
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="px-3.5 sm:px-5 pt-0 pb-4">
                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-4 -mt-1">
                        {/* Left: Metadata & Payment Details */}
                        <div className="h-full">
                            {(() => {
                                // Logic Helpers
                                const isPartial = paymentStatus === 'downpayment';
                                const isPaid = paymentStatus === 'fully-paid';
                                const showAmountRec = isPartial || isPaid;

                                // Calculations
                                const received = parseFloat(amountReceived.replace(/,/g, '')) || 0;
                                const total = grandTotal;


                                return (
                                    <div className="bg-[#F8F9FA]/50 p-3 sm:p-4 rounded-xl border border-red-50/50 space-y-3 shadow-sm h-full flex flex-col justify-center">
                                        <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
                                            {/* Row 1: Order Date, Order Time, Release Date & Release Time */}
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label htmlFor="orderDate" className={LABEL_STYLE}>Order Date</Label>
                                                <FormattedDateInput
                                                    id="orderDate"
                                                    value={orderDate}
                                                    onChange={(val) => setOrderDate(val)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                    iconClassName="text-purple-600"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label htmlFor="orderTime" className={LABEL_STYLE}>Order Time</Label>
                                                <FormattedTimeInput
                                                    id="orderTime"
                                                    value={orderTime}
                                                    onChange={(e) => setOrderTime(e.target.value)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label htmlFor="releaseDate" className={LABEL_STYLE}>Release Date</Label>
                                                <FormattedDateInput
                                                    id="releaseDate"
                                                    value={previewReleaseYmd}
                                                    onChange={(val) => setManualReleaseDate(val)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                    iconClassName="text-emerald-600"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label htmlFor="releaseTime" className={LABEL_STYLE}>Release Time</Label>
                                                <FormattedTimeInput
                                                    id="releaseTime"
                                                    value={releaseTime}
                                                    onChange={(e) => setReleaseTime(e.target.value)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                />
                                            </div>
                                            <div className="col-span-2 md:col-span-12 space-y-2 mt-1">
                                                {/* Card 1: Business Rules (Standard) */}
                                                <div 
                                                    className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-800 shadow-2xs hover:border-emerald-300 transition-colors"
                                                    title="Standard deterministic calculation based on service duration, add-ons, and rush order reduction."
                                                >
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <ClipboardList size={14} className="text-emerald-700 shrink-0" />
                                                            <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-950">
                                                                BUSINESS RULES
                                                            </span>
                                                            <span className="inline-flex items-center bg-emerald-700 text-white text-[8.5px] font-bold uppercase px-2 py-0.5 rounded tracking-wide shadow-2xs shrink-0">
                                                                STANDARD
                                                            </span>
                                                        </div>
                                                        {hasSelectedServices ? (
                                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-emerald-800/80 font-medium">Standard Release Date:</span>
                                                                    <span className="font-bold text-slate-900 text-xs">{officialDateDisplay}</span>
                                                                    {releaseTime && <span className="text-emerald-700/80 text-[11px]">({releaseTime})</span>}
                                                                </div>
                                                                {serverPrediction?.standard_has_rollover && (
                                                                    <div className="text-[10px] text-emerald-800 font-medium flex items-center gap-1">
                                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                                                        <span>Release date adjusted to next open date due to shop closure (+{serverPrediction.standard_rollover_days} {serverPrediction.standard_rollover_days === 1 ? 'day' : 'days'}).</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-emerald-800/80 font-medium">Select a service to calculate the Standard Release Date</span>
                                                                <span className="text-[10px] text-emerald-600/80 font-semibold hidden md:inline">(Service duration and combination rules)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60">
                                                        <div className="w-[185px] h-7 inline-flex items-center justify-between bg-white border border-emerald-300/90 px-2.5 rounded-lg shadow-2xs shrink-0">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 whitespace-nowrap">STANDARD DURATION</span>
                                                            <span className="h-3 w-px bg-emerald-200 shrink-0 mx-1" />
                                                            <span className="font-black text-slate-900 text-[11px] tabular-nums text-center shrink-0 flex items-center justify-center whitespace-nowrap min-w-[36px]">
                                                                {manualReleaseDate ? 'MANUAL' : (hasSelectedServices && officialDays > 0) ? `${officialDays} ${officialDays === 1 ? 'DAY' : 'DAYS'}` : '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card 2: ML Prediction (Active Random Forest) */}
                                                <div 
                                                    className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-800 shadow-2xs hover:border-blue-300 transition-colors"
                                                    title="Active Random Forest machine-learning operational prediction of Ready-for-Release turnaround."
                                                >
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <Sparkles size={14} className="text-amber-500 shrink-0" />
                                                            <span className="font-bold uppercase tracking-wider text-[11px] text-blue-950">
                                                                ML PREDICTION
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsMlModalOpen(true)}
                                                                className="group inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[8.5px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider transition-all duration-150 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 shrink-0"
                                                                title="Click to view Standard Release Date vs ML Prediction details"
                                                            >
                                                                <span>ACTIVE</span>
                                                                <Info size={10} className="text-blue-200 group-hover:text-white transition-colors" />
                                                            </button>
                                                        </div>
                                                        {hasSelectedServices ? (
                                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-blue-800/80 font-medium">ML Predicted Release Date:</span>
                                                                    <span className="font-bold text-slate-900 text-xs inline-flex items-center gap-1.5">
                                                                        {predictionLoading ? (
                                                                            <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                                                                                <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />
                                                                                <span>Predicting…</span>
                                                                            </span>
                                                                        ) : (serverPrediction?.ml_predicted_release_date || serverPrediction?.ml_predicted_date || serverPrediction?.ml_predicted_days != null) ? (
                                                                            predictedDateDisplay
                                                                        ) : hasSelectedServices && predictedDateDisplay !== '—' ? (
                                                                            predictedDateDisplay
                                                                        ) : (
                                                                            <span className="text-slate-400 font-normal">Predicting…</span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                {serverPrediction?.ml_has_safety_rollover && (
                                                                    <div className="text-[10px] text-blue-900 font-medium flex items-center gap-1">
                                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                                                                        <span>Release date moved to next open date due to unmodeled shop closure (+{serverPrediction.ml_safety_rollover_days} {serverPrediction.ml_safety_rollover_days === 1 ? 'day' : 'days'}).</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-blue-800/80 font-medium">Select a service to generate the ML Predicted Release Date</span>
                                                                <span className="text-[10px] text-blue-600/80 font-semibold hidden md:inline">(Random Forest Model)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-blue-200/60">
                                                        <div className="w-[185px] h-7 inline-flex items-center justify-between bg-white border border-blue-300/90 px-2.5 rounded-lg shadow-2xs shrink-0">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-800 whitespace-nowrap">PREDICTED DURATION</span>
                                                            <span className="h-3 w-px bg-blue-200 shrink-0 mx-1" />
                                                            <span className="font-black text-slate-900 text-[11px] tabular-nums text-center shrink-0 flex items-center justify-center whitespace-nowrap min-w-[36px]">
                                                                {predictionLoading ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                                                                ) : !hasSelectedServices ? (
                                                                    '—'
                                                                ) : serverPrediction?.ml_elapsed_days != null ? (
                                                                    `${serverPrediction.ml_elapsed_days} ${serverPrediction.ml_elapsed_days === 1 ? 'DAY' : 'DAYS'}`
                                                                ) : serverPrediction?.ml_base_days != null && serverPrediction.ml_base_days > 0 ? (
                                                                    `${serverPrediction.ml_base_days} ${serverPrediction.ml_base_days === 1 ? 'DAY' : 'DAYS'}`
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Row 2: Order ID, Processed By */}
                                            <div className="space-y-1 col-span-1 md:col-span-4">
                                                <span className={LABEL_STYLE}>Order ID</span>
                                                <div className="flex items-center bg-white h-9 rounded-xl px-3 text-xs font-normal text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <Hash size={14} className="mr-2 text-gray-400" />
                                                    <span className="whitespace-nowrap font-normal">{generatedOrderNumber || 'Generating...'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-4">
                                                <span className={LABEL_STYLE}>Processed By</span>
                                                <div className="flex items-center bg-white h-9 rounded-xl px-3 text-xs text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <User size={14} className="mr-2 text-gray-400" />
                                                    <span className="truncate">{user?.username || 'Current User'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-2 md:col-span-4">
                                                <Label htmlFor="paymentStatus" className={LABEL_STYLE}>Payment Status</Label>
                                                <Select
                                                    value={paymentStatus}
                                                    onValueChange={(value: PaymentStatus) => {
                                                        setPaymentStatus(value);
                                                        if (value === 'downpayment') {
                                                            setAmountReceived((grandTotal / 2).toFixed(2));
                                                        } else if (value === 'fully-paid') {
                                                            setAmountReceived(grandTotal.toFixed(2));
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger id="paymentStatus" aria-label="Payment Status" className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full pr-4 transition-all hover:border-red-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="downpayment">Downpayment</SelectItem>
                                                        <SelectItem value="fully-paid">Fully Paid</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200/50 mt-2">
                                            <div className={`space-y-1 ${!['gcash', 'maya'].includes(paymentMethod) ? 'sm:col-span-2' : ''}`}>
                                                <Label htmlFor="paymentMethod" className={LABEL_STYLE}>Payment Method</Label>
                                                <div className="relative group/select">
                                                    <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
                                                        <SelectTrigger id="paymentMethod" aria-label="Payment Method" className="bg-white border-gray-100/50 h-9 rounded-xl text-xs shadow-sm px-3 w-full pr-4 transition-all hover:border-red-200">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="cash">Cash</SelectItem>
                                                            <SelectItem value="gcash">GCash</SelectItem>
                                                            <SelectItem value="maya">Maya</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {['gcash', 'maya'].includes(paymentMethod) && (
                                                <div className="space-y-1">
                                                    <Label htmlFor="refNo" className={LABEL_STYLE}>Reference Number</Label>
                                                    <ClearableInput
                                                        id="refNo"
                                                        name="refNo"
                                                        value={referenceNo}
                                                        onChange={(e: any) => setReferenceNo(formatReferenceNo(e.target.value))}
                                                        placeholder={paymentMethod === 'gcash' ? "xxxx-xxx-xxx-xxx" : "xxxx-xxxx-xxxx"}
                                                        className="bg-white border-gray-100/50 h-9 rounded-xl text-xs shadow-sm transition-all hover:border-red-200"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {showAmountRec && (
                                                <>
                                                    <div className="space-y-1">
                                                        {isPartial ? (
                                                            <>
                                                                <div className="flex items-center justify-between">
                                                                    <Label htmlFor="depositAmt" className={LABEL_STYLE}>Downpayment (Min 50%)</Label>
                                                                    <span className="text-[10px] text-gray-600 font-semibold">Min: {formatPeso(minimumDownpayment)}</span>
                                                                </div>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                                    <Input
                                                                        id="depositAmt"
                                                                        name="depositAmt"
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={depositAmount}
                                                                        onChange={(e: any) => {
                                                                            let val = e.target.value;
                                                                            if (val.startsWith('0.00') && val.length > 4) val = val.substring(4);
                                                                            setDepositAmount(val);
                                                                            setIsDepositAmountCustom(true);
                                                                            if (!isAmountReceivedTyped) {
                                                                                setAmountReceived(val);
                                                                            }
                                                                        }}
                                                                        onBlur={() => {
                                                                            const num = parseFloat(depositAmount.replace(/,/g, '')) || 0;
                                                                            if (num < minimumDownpayment) {
                                                                                toast.warning(`Minimum downpayment is 50% (${formatPeso(minimumDownpayment)}). Reset to 50%.`);
                                                                                setDepositAmount(minimumDownpayment.toFixed(2));
                                                                                if (!isAmountReceivedTyped) {
                                                                                    setAmountReceived(minimumDownpayment.toFixed(2));
                                                                                }
                                                                            } else {
                                                                                setDepositAmount(num.toFixed(2));
                                                                            }
                                                                        }}
                                                                        placeholder={minimumDownpayment.toFixed(2)}
                                                                        className="bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black text-gray-800 shadow-sm hover:border-red-200 focus:border-red-500"
                                                                    />
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className={LABEL_STYLE}>Total Due</span>
                                                                <div className={`h-10 flex items-center px-4 rounded-xl font-black text-xs text-gray-900 bg-white border border-gray-100 shadow-sm`}>
                                                                    {formatPeso(total)}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label htmlFor="amountRec" className={LABEL_STYLE}>Amount Received</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                            <Input
                                                                id="amountRec"
                                                                name="amountRec"
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={amountReceived}
                                                                onChange={(e: any) => {
                                                                    let val = e.target.value;
                                                                    if (val === '0.00565') val = '565'; // user's specific bug case just in case
                                                                    // strip leading zeros if it looks like they appended to 0.00
                                                                    if (val.startsWith('0.00') && val.length > 4) {
                                                                        val = val.substring(4);
                                                                    }
                                                                    setAmountReceived(val);
                                                                    setIsAmountReceivedTyped(true);
                                                                }}
                                                                onFocus={(e: any) => {
                                                                    if (e.target.value === '0.00' || e.target.value === '0') {
                                                                        setAmountReceived('');
                                                                    }
                                                                }}
                                                                onBlur={(e: any) => {
                                                                    const raw = (e.target.value || '').replace(/,/g, '').trim();
                                                                    if (raw === '' || isNaN(Number(raw))) {
                                                                        setAmountReceived('0.00');
                                                                    } else {
                                                                        setAmountReceived(Number(raw).toFixed(2));
                                                                    }
                                                                }}
                                                                placeholder="0.00"
                                                                className="bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black text-gray-700 shadow-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {showAmountRec && (
                                                <>
                                                    <div className={`space-y-1 ${!isPartial ? 'col-span-2' : ''}`}>
                                                        <Label htmlFor="amountChange" className={LABEL_STYLE}>Amount Change</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                            <Input
                                                                id="amountChange"
                                                                name="amountChange"
                                                                title="Amount Change"
                                                                readOnly
                                                                value={(() => {
                                                                    const diff = received - (isPartial ? (parseFloat(depositAmount.replace(/,/g, '')) || minimumDownpayment) : total);
                                                                    const val = Math.max(0, diff);
                                                                    return isNaN(val) ? '0.00' : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                                })()}
                                                                className={`bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black shadow-sm ${received - (isPartial ? (parseFloat(depositAmount.replace(/,/g, '')) || minimumDownpayment) : total) >= 0 ? 'text-green-600' : 'text-red-500'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                    {isPartial && (
                                                        <div className="space-y-1">
                                                            <Label htmlFor="remainingBalance" className={LABEL_STYLE}>Remaining Balance</Label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                                <Input
                                                                    id="remainingBalance"
                                                                    name="remainingBalance"
                                                                    title="Remaining Balance"
                                                                    readOnly
                                                                    value={(() => {
                                                                        const dep = parseFloat(depositAmount.replace(/,/g, '')) || minimumDownpayment;
                                                                        const val = Math.max(0, total - dep);
                                                                        return isNaN(val) ? '0.00' : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                                    })()}
                                                                    className="bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black text-red-500 shadow-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Right: Totals */}
                        <div className="space-y-3 h-full">
                            <div className="bg-[#F8F9FA]/50 p-4 rounded-xl border border-red-50/50 space-y-3 shadow-sm h-full flex flex-col">
                                <div className="space-y-3 flex-grow">
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-gray-500 font-medium">Base Service Total</span>
                                        <span className="font-bold text-gray-800">{formatPeso(baseTotal)}</span>
                                    </div>
                                    {rushFee > 0 && (
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-gray-500 font-medium">
                                                {(() => {
                                                    if (shoes.length > 1) return 'Rush Fee Total';
                                                    const firstRush = shoes.find(s => s.priorityLevel === 'rush');
                                                    const matched = firstRush ? getApplicableRushFee(firstRush.baseService || [], firstRush.addOns || [], services) : null;
                                                    return matched ? matched.name : 'Rush Fee';
                                                })()}
                                            </span>
                                            <span className="font-bold text-gray-800">{formatPeso(rushFee)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-gray-500 font-medium">Add-ons Subtotal</span>
                                        <span className="font-bold text-gray-800">{formatPeso(addOnsTotal)}</span>
                                    </div>
                                    {retailTotal > 0 && (
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-gray-500 font-medium">Retail Items Total</span>
                                            <span className="font-bold text-emerald-700">{formatPeso(retailTotal)}</span>
                                        </div>
                                    )}
                                    {/* Discount Selector */}
                                    {canApplyDiscounts && (
                                    <div className="pt-2 pb-1 border-t border-gray-200/60">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                                                <span>Discount</span>
                                                {discountAmount > 0 && (
                                                    <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                        -{formatPeso(discountAmount)}
                                                    </span>
                                                )}
                                            </span>
                                            {discountPreset !== '0' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectDiscount('0')}
                                                    className="text-[10.5px] font-bold text-red-500 hover:text-red-700 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            {discountOptions.map(opt => {
                                                const isSelected = discountPreset === opt.id;
                                                const displayRate = opt.id !== '0' && opt.id !== 'custom'
                                                    ? opt.rateText
                                                    : (opt.id === 'custom' && customDiscountValue
                                                        ? (customDiscountType === 'percent' ? `${customDiscountValue}%` : `₱${customDiscountValue}`)
                                                        : '');
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        title={opt.fullLabel}
                                                        onClick={() => handleSelectDiscount(opt.id)}
                                                        className={`px-2.5 py-1 text-[11px] font-black rounded-lg border transition-all ${
                                                            isSelected
                                                                ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-red-200 hover:bg-red-50/50'
                                                        }`}
                                                    >
                                                        <span>{opt.label}</span>
                                                        {isSelected && displayRate && (
                                                            <span className="ml-1 opacity-90 font-bold">({displayRate})</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Beneficiary Verification & Integrated Authorization Panel */}
                                        {(() => {
                                            const renderDiscountAuthSection = () => {
                                                if (canSelfAuthorizeDiscounts || discountPreset === '0') return null;
                                                return (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                                                                <Lock size={11} className="text-red-600" />
                                                                <span>Discount Authorization</span>
                                                            </span>
                                                            {isAuthorized ? (
                                                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                                                                    <ShieldCheck size={10} className="text-emerald-600" />
                                                                    {authorizedByUsername ? `Authorized: ${authorizedByUsername}` : '✓ Code Verified'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-bold text-red-700 bg-white/90 px-1.5 py-0.5 rounded border border-red-200">
                                                                    Required
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Selector: Authorization Code or Username & Password (only displayed if staff has permission to use code) */}
                                                        {canStaffUseAuthCode ? (
                                                            <div className="flex items-center gap-3 text-[10px] pt-0.5 font-semibold text-gray-700">
                                                                <label htmlFor="authMethod-code" className="flex items-center gap-1 cursor-pointer hover:text-red-700">
                                                                    <input
                                                                        type="radio"
                                                                        id="authMethod-code"
                                                                        name="authMethod"
                                                                        checked={authMethod === 'code'}
                                                                        onChange={() => setAuthMethod('code')}
                                                                        className="accent-red-600 cursor-pointer"
                                                                    />
                                                                    <span>Authorization Code</span>
                                                                </label>
                                                                <label htmlFor="authMethod-credentials" className="flex items-center gap-1 cursor-pointer hover:text-red-700">
                                                                    <input
                                                                        type="radio"
                                                                        id="authMethod-credentials"
                                                                        name="authMethod"
                                                                        checked={authMethod === 'credentials'}
                                                                        onChange={() => setAuthMethod('credentials')}
                                                                        className="accent-red-600 cursor-pointer"
                                                                    />
                                                                    <span>Username & Password</span>
                                                                </label>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] text-gray-500 font-medium pt-0.5">
                                                                Requires supervisor or manager authorization:
                                                            </p>
                                                        )}

                                                        {canStaffUseAuthCode && authMethod === 'code' ? (
                                                            <div className="space-y-1">
                                                                <div className="relative">
                                                                    <Input
                                                                        id="discountAuthCode"
                                                                        name="discountAuthCode"
                                                                        type={showDiscountAuthSecret ? "text" : "password"}
                                                                        value={enteredDiscountCode}
                                                                        onChange={(e) => setEnteredDiscountCode(sanitizeClientAuthCode(e.target.value))}
                                                                        placeholder="Enter authorization code"
                                                                        autoComplete="off"
                                                                        maxLength={64}
                                                                        className={`h-7.5 text-xs font-medium pr-8 bg-white transition-colors ${
                                                                            isAuthCodeValid
                                                                                ? 'border-emerald-500 text-emerald-900 focus-visible:border-emerald-600 ring-1 ring-emerald-500/20'
                                                                                : enteredDiscountCode.trim()
                                                                                    ? 'border-red-500 text-red-900 focus-visible:border-red-600 ring-1 ring-red-500/20'
                                                                                    : 'border-red-200 focus-visible:border-red-600'
                                                                        }`}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        tabIndex={-1}
                                                                        onClick={() => setShowDiscountAuthSecret(!showDiscountAuthSecret)}
                                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                                                        title={showDiscountAuthSecret ? "Hide code" : "Show code"}
                                                                    >
                                                                        {showDiscountAuthSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                                                                    </button>
                                                                </div>
                                                                <p className="text-[9.5px]">
                                                                    {isAuthCodeValid ? (
                                                                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                                                                            <CheckCircle2 size={11} className="text-emerald-600 shrink-0 inline" />
                                                                            ✓ Authorization code accepted.
                                                                        </span>
                                                                    ) : enteredDiscountCode.trim() ? (
                                                                        <span className="text-red-600 font-bold flex items-center gap-1">
                                                                            <XCircle size={11} className="text-red-500 shrink-0 inline" />
                                                                            ✗ Invalid authorization code.
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-500">
                                                                            Enter authorization code to activate.
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1.5">
                                                                {!authorizedByUsername ? (
                                                                    <>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                            <Input
                                                                                id="discountAuthUsername"
                                                                                name="discountAuthUsername"
                                                                                type="text"
                                                                                placeholder="Authorizer Username"
                                                                                value={authUsername}
                                                                                onChange={(e) => setAuthUsername(sanitizeClientUsername(e.target.value))}
                                                                                autoComplete="off"
                                                                                maxLength={50}
                                                                                className="h-7.5 text-xs bg-white border-red-200 focus-visible:border-red-600"
                                                                            />
                                                                            <div className="relative">
                                                                                <Input
                                                                                    id="discountAuthPassword"
                                                                                    name="discountAuthPassword"
                                                                                    type={showDiscountAuthSecret ? "text" : "password"}
                                                                                    placeholder="Password"
                                                                                    value={authCredential}
                                                                                    onChange={(e) => setAuthCredential(e.target.value)}
                                                                                    autoComplete="current-password"
                                                                                    maxLength={128}
                                                                                    className="h-7.5 text-xs pr-8 bg-white border-red-200 focus-visible:border-red-600"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    tabIndex={-1}
                                                                                    onClick={() => setShowDiscountAuthSecret(!showDiscountAuthSecret)}
                                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                                                                    title={showDiscountAuthSecret ? "Hide password" : "Show password"}
                                                                                >
                                                                                    {showDiscountAuthSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            disabled={isAuthorizing || !authUsername.trim() || !authCredential}
                                                                            onClick={handleAuthorizeDiscount}
                                                                            className="w-full h-7.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                                                                        >
                                                                            {isAuthorizing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
                                                                            <span>Authorize Discount</span>
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex items-center justify-between text-[9.5px] text-emerald-800 pt-0.5">
                                                                        <span>Authorized by {authorizedByUsername}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setAuthorizedByUserId(null);
                                                                                setAuthorizedByUsername(null);
                                                                                setAuthUsername('');
                                                                                setAuthCredential('');
                                                                            }}
                                                                            className="text-red-700 underline hover:text-red-900 font-semibold cursor-pointer"
                                                                        >
                                                                            Change Authorizer
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            };

                                            return (
                                                <>
                                                    {/* ID Verification Panel with Integrated Authorization */}
                                                    {discountPreset !== '0' && activeDiscountConfig && (
                                                        <div className="mt-2 p-2 bg-red-50/50 border border-red-200/90 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10.5px] font-bold uppercase tracking-wider text-red-900 flex items-center gap-1">
                                                                    <ShieldCheck size={13} className="text-red-600" />
                                                                    <span>{activeDiscountConfig.label}</span>
                                                                </span>
                                                                {isValidIdInput(discountIdNumber, activeDiscountConfig.idFormat, activeDiscountConfig.digits) ? (
                                                                    <span className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                                        ✓ Verified (Active)
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9.5px] font-semibold text-gray-500">
                                                                        {activeDiscountConfig.digits
                                                                            ? `${discountIdNumber.replace(/-/g, '').trim().length}/${activeDiscountConfig.digits} ${activeDiscountConfig.idFormat === 'numbers' ? 'digits' : 'chars'}`
                                                                            : (activeDiscountConfig.idFormat === 'numbers' ? 'Numbers Only' : activeDiscountConfig.idFormat === 'letters' ? 'Letters Only' : 'Numbers & Letters')
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <Input
                                                                id="discountIdNumber"
                                                                name="discountIdNumber"
                                                                type="text"
                                                                value={discountIdNumber}
                                                                maxLength={activeDiscountConfig.digits ? activeDiscountConfig.digits + Math.floor((activeDiscountConfig.digits - 1) / 2) : 45}
                                                                onChange={(e) => {
                                                                    setDiscountIdNumber(formatIdWithHyphens(e.target.value, activeDiscountConfig.idFormat, activeDiscountConfig.digits, discountIdNumber));
                                                                }}
                                                                placeholder={activeDiscountConfig.digits
                                                                    ? Array.from({ length: Math.ceil(activeDiscountConfig.digits / 2) }).map((_, i) => `${(i * 2 + 1) % 10}${((i * 2 + 2) % 10)}`).join('-')
                                                                    : (activeDiscountConfig.idFormat === 'numbers' ? 'e.g. 12-34-56' : activeDiscountConfig.idFormat === 'letters' ? 'e.g. AB-CD-EF' : 'e.g. 12-34-AB')}
                                                                className="h-8 text-xs font-mono font-bold tracking-wider bg-white border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                                                            />
                                                            <p className="text-[9.5px] text-gray-500">
                                                                Allowed: {activeDiscountConfig.digits ? `Exactly ${activeDiscountConfig.digits} ` : ''}{activeDiscountConfig.idFormat === 'numbers' ? 'numbers only.' : activeDiscountConfig.idFormat === 'letters' ? 'letters only.' : 'characters (numbers & letters).' } Required to apply {activeDiscountConfig.name} discount.
                                                            </p>

                                                            {/* Integrated Authorization Inside the Red Box */}
                                                            {!canSelfAuthorizeDiscounts && (
                                                                <div className="pt-2 border-t border-red-200/80">
                                                                    {renderDiscountAuthSection()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Custom Discount Panel (Only for Owner / Admin) */}
                                                    {discountPreset === 'custom' && isOwnerOrAdminUser && (
                                                        <div className="mt-2.5 p-2.5 bg-red-50/40 border border-red-200 rounded-xl space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <Select
                                                                    value={customDiscountType}
                                                                    onValueChange={(val: 'percent' | 'amount') => {
                                                                        setCustomDiscountType(val);
                                                                        if (val === 'amount' && customDiscountValue.trim()) {
                                                                            const num = parseFloat(customDiscountValue.replace(/,/g, ''));
                                                                            if (!isNaN(num) && num >= 0) {
                                                                                setCustomDiscountValue(num.toFixed(2));
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <SelectTrigger id="customDiscountType" aria-label="Custom Discount Type" className="h-8 w-24 text-xs font-bold border-gray-200 bg-white">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="percent">% Off</SelectItem>
                                                                        <SelectItem value="amount">₱ Off</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <div className="relative flex-1">
                                                                    <Input
                                                                        id="customDiscountValue"
                                                                        name="customDiscountValue"
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        placeholder={customDiscountType === 'percent' ? "e.g. 12" : "0.00"}
                                                                        value={customDiscountValue}
                                                                        onChange={(e) => {
                                                                            let val = e.target.value;
                                                                            if (val === '') {
                                                                                setCustomDiscountValue('');
                                                                                return;
                                                                            }
                                                                            if (/^\d*\.?\d*$/.test(val)) {
                                                                                const parts = val.split('.');
                                                                                if (parts.length === 2 && parts[1].length > 2) {
                                                                                    val = `${parts[0]}.${parts[1].slice(0, 2)}`;
                                                                                }
                                                                                setCustomDiscountValue(val);
                                                                            }
                                                                        }}
                                                                        onBlur={() => {
                                                                            if (customDiscountValue.trim()) {
                                                                                const num = parseFloat(customDiscountValue.replace(/,/g, ''));
                                                                                if (!isNaN(num) && num >= 0) {
                                                                                    if (customDiscountType === 'amount') {
                                                                                        setCustomDiscountValue(num.toFixed(2));
                                                                                    } else {
                                                                                        setCustomDiscountValue(num <= 100 ? (num % 1 === 0 ? num.toString() : num.toFixed(2)) : '100');
                                                                                    }
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="h-8 text-xs font-bold pl-2 font-mono bg-white border-gray-200"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* If a discount without an ID config is selected by staff, show authorization in matching red card */}
                                                    {discountPreset !== '0' && !activeDiscountConfig && !canSelfAuthorizeDiscounts && (
                                                        <div className="mt-2 p-2 bg-red-50/50 border border-red-200/90 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                                                            {renderDiscountAuthSection()}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                    )}

                                    <div className="flex justify-between items-center text-[13px] pt-2 border-t border-gray-100">
                                        <span className="text-gray-500 font-medium">Total Quantity (Per Unit)</span>
                                        <span className="font-bold text-gray-800">{shoes.reduce((sum, s) => sum + s.quantity, 0)} {shoes.reduce((sum, s) => sum + s.quantity, 0) === 1 ? 'Pair' : 'Pairs'}</span>
                                    </div>
                                </div>
                                <div className="pt-3 mt-auto border-t border-solid border-gray-500 flex justify-between items-baseline">
                                    <span className="text-sm font-black text-gray-700 uppercase tracking-tight">Grand Total</span>
                                    <span className="text-2xl font-black text-red-600 leading-none">{formatPeso(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons: strictly 1 row with Cancel on left and Submit on right */}
                    <div className="grid grid-cols-2 gap-3 pt-4 sm:pt-5 mt-2 border-t border-gray-100 w-full">
                        <Button
                            type="button"
                            className="w-full bg-gray-200 hover:bg-gray-700 text-gray-600 hover:text-white font-black text-xs uppercase tracking-widest h-10 transition-all rounded-lg shadow-sm"
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest h-10 shadow-lg shadow-red-200 transition-all rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {/* P1-7 FIX: visually disable + relabel Submit while the request is
                                in flight, so the user gets clear feedback and cannot fire a
                                duplicate submission by clicking again before confirmation. */}
                            {isSubmitting ? 'Submitting...' : (mode === 'create' ? 'Submit' : 'Save')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* View ML Details Modal */}
            <Dialog open={isMlModalOpen} onOpenChange={setIsMlModalOpen}>
                <DialogContent className="max-w-xl w-full max-h-[88vh] flex flex-col p-6 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                    <DialogHeader className="pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 text-blue-700 mb-1">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            <DialogTitle className="text-base font-black text-gray-900 tracking-tight">
                                Standard Release Date & ML Prediction Details
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-[11px] sm:text-xs text-gray-500">
                            Comparison of the shop's Standard Release Date and the Random Forest ML Predicted Release Date.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3 text-xs overflow-y-auto overflow-x-hidden pr-1.5 flex-1 custom-scrollbar">
                        {/* Side-by-Side Comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Business Rules Card */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                                <div className="flex items-center gap-1.5">
                                    <ClipboardList className="w-4 h-4 text-emerald-700 shrink-0" />
                                    <span className="font-bold uppercase tracking-wider text-[11px] text-slate-900">
                                        BUSINESS RULES
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white border border-emerald-200/80 space-y-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/90 block">
                                        STANDARD RELEASE DATE
                                    </span>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-800 tabular-nums bg-emerald-50/60 px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                                            {officialDateDisplay}
                                        </span>
                                        <span className="inline-flex items-center bg-emerald-700 text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded tracking-wide shadow-2xs shrink-0">
                                            <span>STANDARD</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1 pt-1 border-t border-slate-200/60 text-[11px] text-slate-700">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Base Service:</span>
                                        <span className="font-bold text-slate-900">{mlBreakdown.baseDays} days</span>
                                    </div>
                                    {mlBreakdown.addOnDays > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Add-ons:</span>
                                            <span className="font-bold text-slate-900">+{mlBreakdown.addOnDays} days</span>
                                        </div>
                                    )}
                                    {mlBreakdown.priorityDays < 0 && (
                                        <div className="flex justify-between text-emerald-700">
                                            <span className="font-medium">Rush Reduction:</span>
                                            <span className="font-black">{mlBreakdown.priorityDays} days</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Calendar Adjustment:</span>
                                        <span className="font-semibold text-slate-800">
                                            {serverPrediction?.standard_has_rollover
                                                ? `+${serverPrediction.standard_rollover_days} day${serverPrediction.standard_rollover_days === 1 ? '' : 's'} — shop closure`
                                                : 'None'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-200/60 font-black text-slate-950">
                                        <span>Standard Duration:</span>
                                        <span>{officialDays} {officialDays === 1 ? 'day' : 'days'}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200/40">
                                    “The Standard Release Date is calculated using Shoelotskey's established service-duration and service-combination rules. It represents the shop's standard customer scheduling commitment.”
                                </p>
                            </div>

                            {/* ML Prediction Card */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span className="font-bold uppercase tracking-wider text-[11px] text-slate-900">
                                        ML PREDICTION
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white border border-blue-200/80 space-y-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800/90 block">
                                        ML PREDICTED RELEASE DATE
                                    </span>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-800 tabular-nums bg-blue-50/60 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                                            {predictionLoading ? (
                                                <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>Predicting…</span>
                                                </span>
                                            ) : !hasSelectedServices ? (
                                                <span className="text-slate-400 font-medium">Select service</span>
                                            ) : (serverPrediction?.ml_predicted_release_date || serverPrediction?.ml_predicted_date) ? (
                                                predictedDateDisplay
                                            ) : hasSelectedServices && predictedDateDisplay !== '—' ? (
                                                predictedDateDisplay
                                            ) : (
                                                <span className="text-slate-400 font-medium">Predicting…</span>
                                            )}
                                        </span>
                                        <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[8px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-2xs shrink-0">
                                            <span>ACTIVE</span>
                                            <Sparkles size={9} className="text-amber-300" />
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px] text-slate-700">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Model:</span>
                                        <span className="font-bold text-slate-900">Random Forest Regressor</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Model Status:</span>
                                        <span className="text-blue-700 font-bold">Active</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Prediction Target:</span>
                                        <span className="font-bold text-slate-900">Ready-for-Release Duration</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Features:</span>
                                        <span className="font-bold text-slate-900">12 Selected Features</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Development Dataset:</span>
                                        <span className="font-bold text-slate-900">10,000 Simulated Operational Orders</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                                        <span>Training / Val / Final Test:</span>
                                        <span className="font-semibold text-slate-700">7,000 / 1,500 / 1,500</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-100">
                                        <span className="text-slate-500">Raw RF Prediction:</span>
                                        <span className="font-mono font-bold text-slate-800">
                                            {predictionLoading ? (
                                                'Predicting…'
                                            ) : serverPrediction?.ml_raw_prediction_days != null ? (
                                                `${Number(serverPrediction.ml_raw_prediction_days).toFixed(2)} days`
                                            ) : '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Calendar Adjustment:</span>
                                        <span className="font-semibold text-slate-800">
                                            {serverPrediction?.ml_has_safety_rollover
                                                ? `+${serverPrediction.ml_safety_rollover_days} day — shop closure`
                                                : 'None'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-100 font-black text-slate-950">
                                        <span>Predicted Duration:</span>
                                        <span>
                                            {predictionLoading ? (
                                                <span className="inline-flex items-center gap-1.5 text-blue-600 font-bold">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>Predicting…</span>
                                                </span>
                                            ) : !hasSelectedServices ? (
                                                <span className="text-slate-400 font-medium text-[11px]">Select service</span>
                                            ) : serverPrediction?.ml_elapsed_days != null ? (
                                                `${serverPrediction.ml_elapsed_days} ${serverPrediction.ml_elapsed_days === 1 ? 'day' : 'days'}`
                                            ) : serverPrediction?.ml_base_days != null && serverPrediction.ml_base_days > 0 ? (
                                                `${serverPrediction.ml_base_days} ${serverPrediction.ml_base_days === 1 ? 'day' : 'days'}`
                                            ) : (
                                                <span className="text-slate-400 font-medium text-[11px]">Predicting…</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200/40">
                                    “The ML prediction estimates the number of days from Date Received to Ready-for-Release and may include calendar adjustments.”
                                </p>
                            </div>
                        </div>

                        {/* Explanation Sections */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 text-slate-800">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                <Info className="w-4 h-4 text-slate-600 shrink-0" />
                                <span>How Standard Release Dates & ML Predictions Work</span>
                            </div>
                            <div className="space-y-2 text-[11px] leading-relaxed">
                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-emerald-500 shadow-2xs space-y-1.5">
                                    <strong className="text-emerald-950 font-bold block">
                                        1. Business Rules
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The Standard Release Date is calculated using Shoelotskey's established service-duration and service-combination rules. Based on the selected service or combination of services, the system determines the applicable standard turnaround duration and calculates the corresponding release date.
                                    </p>
                                    <p className="text-[10px] text-emerald-800 font-medium italic bg-emerald-50/70 px-2 py-1 rounded border border-emerald-100">
                                        The Standard Release Date represents the shop's established customer scheduling commitment.
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-blue-500 shadow-2xs space-y-1.5">
                                    <strong className="text-blue-950 font-bold block">
                                        2. ML Prediction
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The ML Predicted Release Date is generated by the system's active Random Forest Regressor using 12 selected job-order features representing the selected services, number of pairs, priority, and date the order was received.
                                    </p>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The model predicts the expected Ready-for-Release turnaround duration for the current job order. The predicted duration is then used to calculate the corresponding ML Predicted Release Date.
                                    </p>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The model was developed using a 10,000-record Simulated Operational Dataset, divided into 7,000 training, 1,500 validation, and 1,500 final test records.
                                    </p>
                                    <p className="text-[10px] text-blue-800 font-medium italic bg-blue-50/70 px-2 py-1 rounded border border-blue-100">
                                        The Random Forest model actively generates a Ready-for-Release prediction for each eligible job order.
                                    </p>
                                    <div className="text-[9.5px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200/80 leading-normal">
                                        <strong>Dataset Information:</strong> The model-development dataset consists of simulated operational service orders generated using validated shop service-duration rules and operational conditions. It is separate from the 119 validated historical customer orders used in the historical empirical evaluation.
                                    </div>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-amber-500 shadow-2xs space-y-1.5">
                                    <strong className="text-amber-950 font-bold block">
                                        3. Why Can the Dates Differ?
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The Standard Release Date and ML Predicted Release Date are produced using different methods. The Standard Release Date follows Shoelotskey's established service-duration and service-combination rules, while the ML Predicted Release Date is generated by the Random Forest model using the characteristics of the current job order and patterns learned during model development.
                                    </p>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        Because one is a deterministic scheduling calculation and the other is a machine-learning regression prediction, their predicted turnaround durations and resulting dates may occasionally differ.
                                    </p>
                                    <p className="text-[10px] text-amber-800 font-medium italic bg-amber-50/70 px-2 py-1 rounded border border-amber-100">
                                        Both values are retained to provide standard shop scheduling and machine-learning-based predictive information.
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-purple-500 shadow-2xs space-y-1.5">
                                    <strong className="text-purple-950 font-bold block">
                                        4. Release Date Tracking
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The system maintains the Standard Release Date, ML Predicted Release Date, Actual Ready-for-Release timestamp, and Claimed Date as separate values for operational monitoring and future prediction evaluation.
                                    </p>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The Standard Release Date represents the shop's scheduled customer commitment. The ML Predicted Release Date represents the date estimated by the active Random Forest model. The Actual Ready-for-Release timestamp records when staff marks the order For Release, while the Claimed Date records when the customer receives or picks up the order.
                                    </p>
                                    <p className="text-[10px] text-purple-800 font-medium italic bg-purple-50/70 px-2 py-1 rounded border border-purple-100">
                                        Keeping these values separately allows the system to compare scheduled, predicted, actual ready-for-release, and claimed outcomes.
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-rose-500 shadow-2xs space-y-1.5">
                                    <strong className="text-rose-950 font-bold block">
                                        5. Machine Learning in Data Analytics
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        Machine learning serves as the predictive analytics component of the Shoelotskey Service Management System. The active Random Forest Regressor analyzes 12 selected job-order features to generate an expected Ready-for-Release turnaround duration and corresponding ML Predicted Release Date for each eligible new job order.
                                    </p>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The ML prediction complements the system's descriptive analytics provided through the Dashboard and Sales Report modules. Descriptive analytics summarizes historical and current operational information, while the Random Forest model provides predictive analytics for new job orders.
                                    </p>
                                    <p className="text-[10px] text-rose-800 font-medium italic bg-rose-50/70 px-2 py-1 rounded border border-rose-100">
                                        Together, the system provides rule-based scheduling, descriptive analytics, and machine-learning-based predictive analytics for service management.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-3 border-t border-gray-100 shrink-0">
                        <Button
                            type="button"
                            onClick={() => setIsMlModalOpen(false)}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest h-10 rounded-xl shadow-md shadow-red-200 cursor-pointer transition-all"
                        >
                            Understood
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Camera Capture Modal for Live Condition Photos */}
            {isAdminAccount && cameraModalShoeId !== null && (
                <Suspense fallback={null}>
                    <CameraCaptureModal
                        open={cameraModalShoeId !== null}
                        onClose={() => setCameraModalShoeId(null)}
                        onCapture={(dataUrl) => {
                            if (cameraModalShoeId) {
                                updateShoe(cameraModalShoeId, { beforeImage: dataUrl });
                            }
                        }}
                        title="Take Before Condition Photo"
                    />
                </Suspense>
            )}

        </form>
    );
}

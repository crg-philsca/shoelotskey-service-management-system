import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, X, User, Hash, ClipboardList, RotateCcw, Calendar as CalendarIcon, Clock, Sparkles, Info, Search, Check, ChevronDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { useOrders } from '../context/OrderContext';
import { useServices } from '../context/ServiceContext';
import type { ShippingPreference, PaymentMethod, PaymentStatus, Priority } from '@/app/types';
import { format as dateFnsFormat } from 'date-fns';
import { CreatableCombobox } from './ui/creatable-combobox';
import { CUSTOM_OPTION_KEYS, seedCustomOptionsFromOrders, saveStoredCustomOption } from '@/app/lib/customOptions';
import { useActivities } from '@/app/context/ActivityContext';
import { useInventory } from '../context/InventoryContext';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { API_BASE } from '@/app/lib/apiBase';
import { isAddonVisibleForBaseServices, applyColorCountExclusive, syncColorRenewalAddons, shoeHasBothColorCounts, isColorCountAddon } from '@/app/lib/serviceCompatibility';
import { nextOrderId } from '@/app/lib/orderNumber';
import { calculateOfficialReleaseBreakdown } from '@/app/lib/businessRules';
import { validateCustomerName, CUSTOMER_NAME_MAX_LENGTH } from '@/app/lib/customerValidation';

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

type ServerPrediction = {
    predicted_date?: string;
    predicted_date_ymd?: string;
    predicted_days?: number;
    source?: string;
    algorithm?: string;
    model_loaded?: boolean;
    fallback_reason?: string | null;
    authoritative?: string;
    business_rule_days?: number;
    business_rule_date?: string;
    ml_predicted_days?: number | null;
    ml_predicted_date?: string | null;
    ml_model?: string;
    ml_status?: string;
    ml_source?: string;
    ml_reason?: string | null;
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
    '6-Inch Premium Boot': 'Nubuck',
    '1460 8-Eye Boot': 'Leather',
    '1461 3-Eye Shoe': 'Leather',
    'Chuck Taylor All Star': 'Canvas',
    'Chuck 70': 'Canvas',
    'Old Skool': 'Suede',
    'Slip-On': 'Canvas',
    'Authentic': 'Canvas',
    'Sk8-Hi': 'Canvas',
    'Era': 'Canvas',
    '550': 'Leather',
    '990': 'Suede',
    '2002R': 'Suede',
    '574': 'Suede',
    'Gel-Lyte III': 'Suede',
    'Suede': 'Suede',
    'XT-6': 'Synthetic'
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



const LABEL_STYLE = "text-[11px] font-bold text-gray-500 mb-1 block uppercase tracking-tight";
const INPUT_STYLE = "bg-white border-gray-100 h-9 text-xs focus:ring-red-50 focus:border-red-100 transition-all shadow-sm";


const CARD_HEADER_STYLE = "bg-red-50/50 py-2 px-6 border-b border-red-100/50";
const CARD_TITLE_STYLE = "text-gray-600 font-black text-[14px] uppercase tracking-widest flex items-center gap-2";

function ClearableInput({ id, value, onChange, placeholder, className, required, type = "text", inputMode, maxLength, ...rest }: any) {
    return (
        <div className="relative group/input">
            <Input
                id={id}
                value={value}
                onChange={onChange}
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
                    onClick={() => onChange({ target: { value: '' } } as any)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover/input:opacity-100"
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
                className={`absolute right-2.5 ${iconClassName || 'text-gray-400'} hover:text-red-600 transition-colors cursor-pointer p-0.5`}
            >
                <CalendarIcon size={14} />
            </button>
            <input
                ref={hiddenDateRef}
                type="date"
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
                ref={hiddenTimeRef}
                type="time"
                value={value}
                onChange={onChange}
                className={`${className || ''} pr-8 text-left font-normal [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            />
            <button
                type="button"
                onClick={openPicker}
                title="Select time"
                className="absolute right-2.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-0.5 pointer-events-none"
            >
                <Clock size={14} />
            </button>
        </div>
    );
}

export interface JobOrderFormProps {
    user?: { username: string; role: 'owner' | 'staff' | 'admin', token?: string };
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
                        type="text"
                        placeholder="Search supplies, volume, container..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-7 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-100 focus:border-red-200 transition-all font-medium text-gray-800 placeholder:text-gray-400"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
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

export default function JobOrderFormComponent({ user, onSuccess, onCancel, initialOrder, mode = 'create' }: JobOrderFormProps) {
    const { addOrder, orders } = useOrders();
    const { services } = useServices();
    const { inventoryData } = useInventory();
    const { addActivity } = useActivities();
    const [customerName, setCustomerName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    // State for Shipping Preference
    const [shippingPreference, setShippingPreference] = useState<string>("pickup");
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

    // Automatically seed stored custom options from past orders so they appear in dropdowns
    useEffect(() => {
        if (orders && orders.length > 0) {
            seedCustomOptionsFromOrders(orders);
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
    const [amountReceived, setAmountReceived] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    // shelfLocation removed
    const [orderDate, setOrderDate] = useState(dateFnsFormat(new Date(), 'yyyy-MM-dd'));
    const [orderTime, setOrderTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    const [manualReleaseDate, setManualReleaseDate] = useState('');
    const [releaseTime, setReleaseTime] = useState('');
    const [serverPrediction, setServerPrediction] = useState<ServerPrediction | null>(null);
    const [predictionLoading, setPredictionLoading] = useState(false);
    const [predictionError, setPredictionError] = useState(false);
    const [isMlModalOpen, setIsMlModalOpen] = useState(false);

    useEffect(() => {
        if (initialOrder) {
            setCustomerName(initialOrder.customerName || '');
            setContactNumber(initialOrder.contactNumber || '');
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
                inventoryUsed: item.inventoryUsed || []
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
        setReferenceNo('');
        setOrderDate(dateFnsFormat(new Date(), 'yyyy-MM-dd'));
        setOrderTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        setManualReleaseDate('');
        setReleaseTime('');
    };
    const [generatedOrderNumber, setGeneratedOrderNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        const today = new Date();
        const safeOrders = Array.isArray(orders) ? orders : [];
        const existingNumbers = safeOrders
            .map(o => o && o.orderNumber)
            .filter((n): n is string => typeof n === 'string');
        setGeneratedOrderNumber(nextOrderId(today, existingNumbers));
    }, [orders]);

    const isRushEligible = useMemo(() => {
        if (shoes.length === 0) return false;
        // Rush is eligible if across all shoes:
        // 1. Base service is strictly 'Basic Cleaning'
        // 2. Any add-on services are strictly among: Minor Retouch, Minor Restoration, or White Paint (or no add-ons)
        const ALLOWED_RUSH_ADDONS = ['minor retouch', 'minor restoration', 'restoration', 'white paint'];
        return shoes.every(shoe => {
            const baseServices = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            if (!baseServices.includes('Basic Cleaning')) return false;
            if (baseServices.some(s => s !== 'Basic Cleaning')) return false;

            const addOns = Array.isArray(shoe.addOns) ? shoe.addOns : [];
            return addOns.every(a => {
                const name = (typeof a === 'string' ? a : (a?.name || '')).trim().toLowerCase();
                return ALLOWED_RUSH_ADDONS.some(allowed => name.includes(allowed));
            });
        });
    }, [shoes]);

    // Auto-reset priority level if conditions are not met
    useEffect(() => {
        const hasPremiumEligibleService = shoes.some(shoe => {
            const services = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            return services.some(s => s.includes('Color Renewal'));
        });

        if (priorityLevel === 'rush' && !isRushEligible) {
            setPriorityLevel('regular');
        } else if (priorityLevel === 'premium' && !hasPremiumEligibleService) {
            setPriorityLevel('regular');
        }
    }, [shoes, priorityLevel, isRushEligible]);

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
        [...baseServices, ...addOnServices].forEach((service) => {
            if (service.name && service.durationDays !== undefined) {
                map[service.name] = service.durationDays;
            }
        });
        return map;
    }, [baseServices, addOnServices]);

    const mlBreakdown = useMemo(
        () => calculateOfficialReleaseBreakdown(
            shoes,
            priorityLevel,
            parseInt(basicCleaningRushReduction, 10) || 9,
            catalogDurations,
        ),
        [shoes, priorityLevel, basicCleaningRushReduction, catalogDurations],
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

        shoe.addOns.forEach((addon: { name: string; quantity?: number }) => {
            total += getAddonTotal(addon.name, addon.quantity || 1);
        });

        // Add retail items from supplies used
        (shoe.inventoryUsed || []).forEach(usage => {
            const item = inventoryData.find((i: any) => i.id === usage.itemId);
            const retPrice = getItemRetailPrice(item);
            if (retPrice > 0) {
                total += retPrice * (Number(usage.amount) || 0);
            }
        });

        // Add rush fee to unit total if applicable (Only for BC)
        if (priorityLevel === 'rush' && servicesArr.includes('Basic Cleaning')) {
            total += 150;
        }

        return total * shoe.quantity;
    };

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

            shoe.addOns.forEach((addon: { name: string; quantity?: number }) => {
                const addonQuantity = addon.quantity || 1;
                addOnsTotal += getAddonTotal(addon.name, addonQuantity) * shoe.quantity;
            });

            // Calculate retail supplies total
            (shoe.inventoryUsed || []).forEach((u) => {
                const item = inventoryData.find((i: any) => i.id === u.itemId);
                const retPrice = getItemRetailPrice(item);
                if (retPrice > 0) {
                    retailTotal += retPrice * (Number(u.amount) || 0) * shoe.quantity;
                }
            });

            // Rush Fee only for Basic Cleaning
            if (priorityLevel === 'rush' && servicesArr.includes('Basic Cleaning')) {
                rushFee += 150 * shoe.quantity;
            }
        });

        const grandTotal = baseTotal + addOnsTotal + rushFee + retailTotal;
        const amountReceivedNum = amountReceived ? parseFloat(amountReceived.replace(/,/g, '')) : 0;

        // Dynamic exact halves (50%) for deposit
        const depositAmt = paymentStatus === 'downpayment' ? grandTotal / 2 : grandTotal;

        // Change logic uses deposit required, not necessarily the overall total
        const change = amountReceivedNum - depositAmt;

        // Remaining Balance
        const remainingBalance = Math.max(0, grandTotal - depositAmt);

        return { baseTotal, addOnsTotal, rushFee, retailTotal, grandTotal, amountReceivedNum, remainingBalance, change };
    }, [shoes, baseServices, addOnServices, priorityLevel, amountReceived, paymentStatus, inventoryData]);

    const { baseTotal, addOnsTotal, rushFee, retailTotal, grandTotal } = totals;

    const [isAmountReceivedTyped, setIsAmountReceivedTyped] = useState(false);

    useEffect(() => {
        const exactHalf = grandTotal / 2;

        if (paymentStatus === 'downpayment') {
            setDepositAmount(exactHalf.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            if (!isAmountReceivedTyped) {
                setAmountReceived(exactHalf.toFixed(2));
            }
        } else if (paymentStatus === 'fully-paid') {
            setDepositAmount(grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            if (!isAmountReceivedTyped) {
                setAmountReceived(grandTotal.toFixed(2));
            }
        }
    }, [paymentStatus, grandTotal, isAmountReceivedTyped]);

    const officialDays = mlBreakdown.totalDays;
    const officialReleaseYmd = (() => {
        const val = isNaN(officialDays) ? 0 : officialDays;
        if (!val) return '';
        const d = new Date(new Date(orderDate).getTime() + val * 24 * 60 * 60 * 1000);
        return dateFnsFormat(isNaN(d.getTime()) ? new Date() : d, 'yyyy-MM-dd');
    })();
    const serverOfficialYmd = serverPrediction?.authoritative === 'business_rule'
        ? (serverPrediction.business_rule_date || serverPrediction.predicted_date_ymd || '')
        : '';
    const previewReleaseYmd = manualReleaseDate || (hasSelectedServices ? (officialReleaseYmd || serverOfficialYmd) : '');

    const officialDateDisplay = previewReleaseYmd
        ? dateFnsFormat(new Date(previewReleaseYmd), 'MM/dd/yyyy')
        : (officialReleaseYmd ? dateFnsFormat(new Date(officialReleaseYmd), 'MM/dd/yyyy') : '—');

    const predictedDateDisplay = (() => {
        if (serverPrediction?.ml_predicted_date) {
            const d = new Date(serverPrediction.ml_predicted_date);
            return isNaN(d.getTime()) ? '—' : dateFnsFormat(d, 'MM/dd/yyyy');
        }
        if (serverPrediction?.ml_predicted_days != null) {
            const d = new Date(new Date(orderDate).getTime() + serverPrediction.ml_predicted_days * 24 * 60 * 60 * 1000);
            return isNaN(d.getTime()) ? '—' : dateFnsFormat(d, 'MM/dd/yyyy');
        }
        if (hasSelectedServices && officialReleaseYmd) {
            return `${dateFnsFormat(new Date(officialReleaseYmd), 'MM/dd/yyyy')} (Est.)`;
        }
        return '—';
    })();

    useEffect(() => {
        const hasServices = shoes.some(shoe => {
            const b = Array.isArray(shoe.baseService) ? shoe.baseService : (shoe.baseService ? [shoe.baseService] : []);
            const a = Array.isArray(shoe.addOns) ? shoe.addOns : (shoe.addOns ? [shoe.addOns] : []);
            return b.length > 0 || a.length > 0;
        });
        if (!hasServices || manualReleaseDate) {
            if (!hasServices) setServerPrediction(null);
            setPredictionLoading(false);
            setPredictionError(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setPredictionLoading(true);
            setPredictionError(false);
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
                        brand: shoe.brand === 'Other' ? (shoe.otherBrand || 'Other') : (shoe.brand || 'Other'),
                        shoeModel: shoe.shoeModel === 'Other' ? (shoe.otherModel || 'Other') : (shoe.shoeModel || 'Other'),
                        shoeMaterial: shoe.shoeMaterial === 'Other' ? (shoe.otherMaterial || 'Other') : (shoe.shoeMaterial || 'Other'),
                        quantity: shoe.quantity,
                        condition: shoe.condition,
                        baseService: Array.isArray(shoe.baseService) ? shoe.baseService : (shoe.baseService ? [shoe.baseService] : []),
                        addOns: Array.isArray(shoe.addOns) ? shoe.addOns : (shoe.addOns ? [shoe.addOns] : []),
                    })),
                    priorityLevel,
                    rushReductionDays: priorityLevel === 'rush' ? parseInt(basicCleaningRushReduction, 10) || 9 : undefined,
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
                setServerPrediction(data);
            } catch (err: any) {
                if (err?.name === 'AbortError') return;
                setPredictionError(true);
            } finally {
                setPredictionLoading(false);
            }
        }, 100);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [shoes, priorityLevel, orderDate, orderTime, totals.grandTotal, manualReleaseDate, user?.token, basicCleaningRushReduction]);


    const addShoe = () => {
        setShoes([...shoes, {
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
            if (contactDigits.length !== 11) {
                toast.error('Contact number must be exactly 11 digits (e.g., 09xx-xxx-xxxx)');
                setIsSubmitting(false);
                return;
            }

        const hasMissingShoeDetails = shoes.some(shoe => {
            const b = shoe.brand === 'Other' ? shoe.otherBrand : shoe.brand;
            const noService = !shoe.baseService || shoe.baseService.length === 0;
            const size = (shoe.shoeSize || '').trim();
            const color = shoeColorValue(shoe);
            return !b || !b.trim() || noService || !size || !color;
        });
        if (hasMissingShoeDetails) {
            toast.error('Brand, Size, Color, and Base Service must be filled out for every item.');
            setIsSubmitting(false);
            return;
        }

        if (shoes.some((shoe) => shoeHasBothColorCounts(shoe.addOns || []))) {
            toast.error('Color Renewal can use either 2 Colors or 3 Colors, not both.');
            setIsSubmitting(false);
            return;
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

        const depositAmt = paymentStatus === 'downpayment' ? grandTotal / 2 : grandTotal;
        const amtReceived = parseFloat(amountReceived.replace(/,/g, '')) || 0;
        if (amtReceived < depositAmt && paymentStatus !== 'downpayment') {
            toast.error('Amount received is less than the required amount');
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return;
        } else if (amtReceived < depositAmt && paymentStatus === 'downpayment') {
            toast.error('Amount received is less than the required 50% downpayment');
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return;
        }

        let [oHours, oMinutes] = [0, 0];
        if (orderTime) {
            const timeParts = orderTime.split(':').map(Number);
            oHours = timeParts[0] || 0;
            oMinutes = timeParts[1] || 0;
        } else {
            const now = new Date();
            oHours = now.getHours();
            oMinutes = now.getMinutes();
        }
        const createdDate = new Date(orderDate);
        createdDate.setHours(oHours, oMinutes, 0, 0);

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
            brand: shoes[0].brand === 'Other' ? (shoes[0].otherBrand || 'Other') : (shoes[0].brand || 'Other'),
            shoeModel: shoes[0].shoeModel === 'Other' ? (shoes[0].otherModel || 'Other') : (shoes[0].shoeModel || 'Other'),
            shoeMaterial: shoes[0].shoeMaterial === 'Other' ? (shoes[0].otherMaterial || 'Other') : (shoes[0].shoeMaterial || 'Other'),
            shoeSize: shoes[0].shoeSize || '',
            color: shoeColorValue(shoes[0]),
            baseService: shoes[0].baseService,
            historicalBasePrices: (shoes[0].baseService || []).map(serviceName => {
                const service = baseServices.find(s => s.name === serviceName);
                return { name: serviceName, price: service ? service.price : 0 };
            }),
            historicalAddOnPrices: (shoes[0].addOns || []).map((addon: any) => {
                const addonName = typeof addon === 'string' ? addon : addon.name;
                const service = addOnServices.find(s => s.name === addonName);
                return { name: addonName, price: service ? service.price : 0 };
            }),
            quantity: shoes.reduce((acc, s) => acc + s.quantity, 0),

            // Nested items for breakdown view
            items: shoes.map((shoe, idx) => {
                const historicalBasePrices = (shoe.baseService || []).map(serviceName => {
                    const service = baseServices.find(s => s.name === serviceName);
                    return { name: serviceName, price: service ? service.price : 0 };
                });

                const historicalAddOnPrices = (shoe.addOns || []).map((addon: any) => {
                    const addonName = typeof addon === 'string' ? addon : addon.name;
                    const service = addOnServices.find(s => s.name === addonName);
                    return { name: addonName, price: service ? service.price : 0 };
                });

                return {
                    id: `${Date.now()}-${idx}`,
                    brand: shoe.brand === 'Other' ? (shoe.otherBrand || 'Other') : (shoe.brand || 'Other'),
                    shoeModel: shoe.shoeModel === 'Other' ? (shoe.otherModel || 'Other') : (shoe.shoeModel || 'Other'),
                    shoeMaterial: shoe.shoeMaterial === 'Other' ? (shoe.otherMaterial || 'Other') : (shoe.shoeMaterial || 'Other'),
                    shoeSize: shoe.shoeSize,
                    color: shoeColorValue(shoe),
                    quantity: shoe.quantity,
                    condition: shoe.condition,
                    baseService: shoe.baseService,
                    addOns: shoe.addOns,
                    historicalBasePrices,
                    historicalAddOnPrices,
                    inventoryUsed: shoe.inventoryUsed
                };
            }),

            priorityLevel,
            rushReductionDays: priorityLevel === 'rush' ? basicCleaningRushReduction : undefined,
            baseServiceFee: totals.baseTotal,
            addOnsTotal: totals.addOnsTotal,
            retailTotal: totals.retailTotal,
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
            depositAmount: parseFloat(depositAmount) || 0,
            paymentHistory: [
                {
                    id: `pay-${Date.now()}`,
                    paymentType: paymentStatus === 'downpayment' ? 'downpayment' : 'full-payment',
                    method: paymentMethod,
                    amount: totals.amountReceivedNum,
                    referenceNo: ['gcash', 'maya'].includes(paymentMethod) ? referenceNo : undefined,
                    date: createdDate,
                    processedBy: user?.username || 'Current User',
                    notes: paymentStatus === 'downpayment' ? 'Initial Downpayment' : 'Full Payment'
                }
            ],
            releaseTime,
            transactionDate: createdDate,
            processedBy: user?.username || 'Current User',
            status: 'new-order',
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
            createdAt: createdDate,
            updatedAt: createdDate,
            statusHistory: [{
                status: 'new-order',
                timestamp: createdDate,
                user: user?.username || 'Current User',
            }]
        };

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

        const shoeSummaryStr = shoes.map((s, idx) => {
            const bServices = (Array.isArray(s.baseService) ? s.baseService : []).join(', ');
            const addOns = (Array.isArray(s.addOns) ? s.addOns : []).map((a: any) => typeof a === 'string' ? a : (a.name || '')).filter(Boolean).join(', ');
            const allSvcs = [bServices, addOns].filter(Boolean).join(' + ');
            return `Pair ${idx + 1}: ${s.brand || 'Shoe'} ${s.shoeModel || ''} (${s.shoeMaterial || 'Material'}) [Services: ${allSvcs || 'None'}]`;
        }).join(' | ');

        const allServicesList = Array.from(new Set(
            shoes.flatMap(s => [
                ...(Array.isArray(s.baseService) ? s.baseService : []),
                ...(Array.isArray(s.addOns) ? s.addOns : []).map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean)
            ])
        )).join(', ');

        addActivity({
            user: user?.username || 'Current User',
            action: 'New Order',
            details: `Created new job order #${newOrder.orderNumber} for ${finalCustomerName} (${shoes.length} pair${shoes.length > 1 ? 's' : ''}). Total: ₱${newOrder.grandTotal.toFixed(2)}`,
            type: 'order',
            table: 'orders',
            recordId: newOrder.orderNumber,
            newValues: {
                order_number: newOrder.orderNumber,
                customer_name: finalCustomerName,
                contact_number: finalContactNumber,
                grand_total: newOrder.grandTotal,
                downpayment: newOrder.downpayment,
                balance: newOrder.balance,
                payment_status: newOrder.paymentStatus,
                priority_level: priorityLevel,
                promised_release_date: newOrder.predictedCompletionDate ? new Date(newOrder.predictedCompletionDate).toLocaleDateString() : 'N/A',
                shipping_preference: shippingPreference,
                shoes_count: shoes.length,
                shoes: shoeSummaryStr,
                services: allServicesList || 'Basic Cleaning'
            }
        });

        toast.success('Order created successfully!');

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
        setReferenceNo('');
        setOrderDate(dateFnsFormat(new Date(), 'yyyy-MM-dd'));
        setOrderTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
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
    const formatContactNumber = (value: string) => {
        // Keep digits only and cap at 11
        const digitsOnly = value.replace(/\D/g, '').slice(0, 11);
        // Format as xxxx-xxxx-xxxx
        let formatted = '';
        for (let i = 0; i < digitsOnly.length; i++) {
            formatted += digitsOnly[i];
            if ((i === 3 || i === 6) && i !== digitsOnly.length - 1) {
                formatted += '-';
            }
        }
        return formatted;
    };

    const formatPeso = (amount: number | string) => {
        const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
        if (isNaN(num)) return '\u20B10.00';
        return '\u20B1' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">

            
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
                <CardHeader className={`${CARD_HEADER_STYLE} !py-2 rounded-t-2xl`}>
                    <div className="flex items-center gap-3 translate-y-[1px]">
                        <User className="text-red-600 fill-red-600" size={18} />
                        <CardTitle className={`${CARD_TITLE_STYLE} text-slate-900`}>CUSTOMER DETAILS</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="px-6 pt-0 pb-4 space-y-4">
                    <div className={`grid gap-3 md:gap-4 -mt-1 ${shippingPreference === 'pickup' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-12 mb-2.5'}`}>
                        <div className={`relative ${shippingPreference === 'pickup' ? 'col-span-1' : 'col-span-1 md:col-span-6'}`}>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="customerName" className={LABEL_STYLE}>Customer Name</Label>
                                <span className={`text-[10px] font-bold ${customerName.length >= CUSTOMER_NAME_MAX_LENGTH ? 'text-red-600' : 'text-gray-400'}`}>
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
                        <div className={shippingPreference === 'pickup' ? 'col-span-1' : 'col-span-1 md:col-span-6'}>
                            <Label htmlFor="contactNumber" className={LABEL_STYLE}>Contact Number</Label>
                            <ClearableInput
                                id="contactNumber"
                                value={contactNumber}
                                onChange={(e: any) => setContactNumber(formatContactNumber(e.target.value))}
                                placeholder="09xx-xxx-xxxx"
                                maxLength={13}
                                inputMode="numeric"
                                className={INPUT_STYLE}
                                required
                            />
                        </div>
                        {shippingPreference === 'pickup' && (
                            <div className="col-span-1">
                                <Label htmlFor="shippingPref" className={LABEL_STYLE}>Shipping Preference</Label>
                                <Select value={shippingPreference} onValueChange={(value: ShippingPreference) => setShippingPreference(value)}>
                                    <SelectTrigger id="shippingPref" className={INPUT_STYLE}>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                <div className="col-span-1">
                                    <Label htmlFor="shippingPref" className={LABEL_STYLE}>Shipping Preference</Label>
                                    <Select value={shippingPreference} onValueChange={(value: ShippingPreference) => setShippingPreference(value)}>
                                        <SelectTrigger id="shippingPref" className={INPUT_STYLE}>
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
                                        options={DELIVERY_COURIERS}
                                        value={deliveryCourier}
                                        onChange={setDeliveryCourier}
                                        placeholder="Select or type Courier"
                                        searchPlaceholder="Type custom courier (e.g. Lalamove, Grab)..."
                                        storageKey={CUSTOM_OPTION_KEYS.COURIERS}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Unit/No, Street, Barangay */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
                            </div>

                            {/* Row 3: City, Province, Zip Code */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
                            <CardHeader className={`${CARD_HEADER_STYLE} !py-2`}>
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
                            <CardContent className="px-5 pt-0 pb-3">
                                <div className="space-y-4">
                                    {/* Top Section: Identification & Condition */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6 -mt-1">
                                        {/* Left Column: Identification & Condition */}
                                        <div className="md:col-span-5 flex flex-col gap-3 h-full">
                                            {/* Identification Row - Stacked for narrow column */}
                                            <div className="space-y-2.5">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div className="col-span-1">
                                                        <Label className={LABEL_STYLE}>Brand</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_BRANDS}
                                                            value={shoe.brand}
                                                            onChange={(val) => updateShoe(shoe.id, { brand: val })}
                                                            placeholder="Select or type Brand"
                                                            searchPlaceholder="Type custom brand..."
                                                            storageKey={CUSTOM_OPTION_KEYS.BRANDS}
                                                        />
                                                        {shoe.brand === 'Other' && (
                                                            <Input
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify brand"
                                                                value={shoe.otherBrand}
                                                                onChange={(e) => updateShoe(shoe.id, { otherBrand: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Label className={LABEL_STYLE}>Model</Label>
                                                        <CreatableCombobox
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
                                                            storageKey={CUSTOM_OPTION_KEYS.MODELS}
                                                        />
                                                        {shoe.shoeModel === 'Other' && (
                                                            <Input
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify model"
                                                                value={shoe.otherModel}
                                                                onChange={(e) => updateShoe(shoe.id, { otherModel: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Label className={LABEL_STYLE}>Material</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_MATERIALS}
                                                            value={shoe.shoeMaterial}
                                                            onChange={(val) => updateShoe(shoe.id, { shoeMaterial: val })}
                                                            placeholder="Select or type Material"
                                                            searchPlaceholder="Type custom material..."
                                                            storageKey={CUSTOM_OPTION_KEYS.MATERIALS}
                                                        />
                                                        {shoe.shoeMaterial === 'Other' && (
                                                            <Input
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify material"
                                                                value={shoe.otherMaterial}
                                                                onChange={(e) => updateShoe(shoe.id, { otherMaterial: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col md:flex-row gap-3 w-full">
                                                    <div style={{ flex: 24 }}>
                                                        <Label className={LABEL_STYLE}>Size</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_SIZES}
                                                            value={shoe.shoeSize || ''}
                                                            onChange={(val) => updateShoe(shoe.id, { shoeSize: val })}
                                                            placeholder="Select or type Size"
                                                            searchPlaceholder="Type custom size (e.g. 9.5)..."
                                                            storageKey={CUSTOM_OPTION_KEYS.SIZES}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 28 }}>
                                                        <Label className={LABEL_STYLE} title="Multiple colors allowed (e.g. Black, Blue)">Color</Label>
                                                        <CreatableCombobox
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
                                                                className={`${INPUT_STYLE} mt-1`}
                                                                placeholder="Please specify color"
                                                                value={shoe.otherColor || ''}
                                                                onChange={(e) => updateShoe(shoe.id, { otherColor: e.target.value })}
                                                            />
                                                        )}
                                                    </div>
                                                    <div style={{ flex: priorityLevel === 'rush' && (Array.isArray(shoe.baseService) ? shoe.baseService : []).includes('Basic Cleaning') ? 26 : 48 }}>
                                                        <div className="flex items-center justify-between">
                                                            <Label className={LABEL_STYLE}>Priority Level</Label>
                                                        </div>
                                                        <div className="relative group/select">
                                                            <Select value={priorityLevel} onValueChange={(val: any) => setPriorityLevel(val)}>
                                                                <SelectTrigger className={`${INPUT_STYLE} font-normal`}>
                                                                    <SelectValue placeholder="Regular" />
                                                                </SelectTrigger>
                                                                <SelectContent align="start" side="bottom" position="popper" sideOffset={5} className="pb-0 overflow-hidden">
                                                                    <SelectItem value="regular">Regular</SelectItem>
                                                                    {isRushEligible && (
                                                                        <SelectItem value="rush">Rush</SelectItem>
                                                                    )}
                                                                    <div className="sticky bottom-0 z-10 p-1.5 border-t border-gray-100 bg-gray-50/95 backdrop-blur-xs text-[10px] text-gray-500 font-semibold flex items-center justify-center select-none text-center">
                                                                        <span>Rush: Basic Cleaning only</span>
                                                                    </div>
                                                                </SelectContent>
                                                            </Select>
                                                            {priorityLevel !== 'regular' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPriorityLevel('regular')}
                                                                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover/select:opacity-100"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {priorityLevel === 'rush' && (Array.isArray(shoe.baseService) ? shoe.baseService : []).includes('Basic Cleaning') && (
                                                        <div style={{ flex: 22 }}>
                                                            <Label className={`${LABEL_STYLE} whitespace-nowrap`} title="Reduced By">Reduced By</Label>
                                                            <div className="relative flex items-center">
                                                                <Input
                                                                    type="text"
                                                                    placeholder=""
                                                                    inputMode="numeric"
                                                                    pattern="[0-9]*"
                                                                    value={basicCleaningRushReduction}
                                                                    onChange={(e: any) => {
                                                                        const val = e.target.value.replace(/\D/g, '');
                                                                        const cleanVal = val.replace(/^0+/, '');
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
                                                        <Label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Shoe Condition</Label>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 bg-transparent border border-transparent shadow-none text-gray-400 hover:bg-white hover:text-red-600 hover:border-red-100 hover:shadow-md p-0 transition-all rounded-md"
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
                                                    <span className="text-[9px] font-bold text-gray-300 uppercase italic">Check all that apply</span>
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
                                                <div className="relative pt-1 flex-1 flex flex-col">
                                                    <Textarea
                                                        placeholder="Notes: "
                                                        value={shoe.condition.others}
                                                        onChange={(e) =>
                                                            updateShoe(shoe.id, {
                                                                condition: { ...shoe.condition, others: e.target.value }
                                                            })
                                                        }
                                                        rows={1}
                                                        className="text-[11px] bg-[#F8F9FA]/80 border-none rounded-xl placeholder:text-gray-400/70 px-3 py-2 focus:ring-1 focus:ring-red-50 transition-all min-h-[40px] h-full resize-none shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Services & Add-ons */}
                                        <div className="md:col-span-7 border-l border-gray-50 md:pl-8 flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Services & Add-ons</Label>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 bg-transparent border border-transparent shadow-none text-gray-400 hover:bg-white hover:text-red-600 hover:border-red-100 hover:shadow-md p-0 transition-all rounded-md"
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
                                                    <span className="text-xs font-bold text-gray-300 uppercase italic">Select applicable services</span>
                                                )}
                                            </div>

                                            <div className="bg-[#F8F9FA]/50 p-3 rounded-xl border border-gray-100 flex-grow flex flex-col">
                                                <div className="flex flex-col h-full gap-4">
                                                    {/* Base Services */}
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Services</Label>
                                                        <div className="w-full">
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                {baseServices.map(service => {
                                                                     const isChecked = (Array.isArray(shoe.baseService) ? shoe.baseService : []).includes(service.name);
                                                                     return (
                                                                         <label key={service.id} className={`flex ${isChecked ? 'items-start' : 'items-center'} space-x-2 p-2.5 rounded-lg border transition-all cursor-pointer shadow-sm ${isChecked ? 'border-red-100 bg-red-50/10' : 'bg-white border-gray-100 hover:border-red-100'}`}>
                                                                             <Checkbox
                                                                                 type="button"
                                                                                 id={`shoe-${shoe.id}-service-${service.id}`}
                                                                                 checked={isChecked}
                                                                                 onCheckedChange={(checked) => {
                                                                                     const currentServices = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                                                                                     let newServices = checked
                                                                                         ? [...currentServices, service.name]
                                                                                         : currentServices.filter(s => s !== service.name);

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

                                                                                     const nextAddOns = syncColorRenewalAddons(shoe.addOns || [], newServices).filter(a => isAddonVisibleForBaseServices(a.name, newServices, services));
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
                                                                                     <div className="flex items-center justify-end mt-1 min-w-0">
                                                                                         <span className="text-[11px] font-black text-red-600 shrink-0 ml-auto">{formatPeso(service.price)}</span>
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
                                                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Add-on Services</Label>
                                                        {(!shoe.baseService || shoe.baseService.length === 0) ? (
                                                            <div className="border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-white gap-2 min-h-[60px] flex-grow">
                                                                <span className="text-xs font-bold italic text-gray-300 uppercase tracking-widest">Awaiting Base Service</span>
                                                            </div>
                                                        ) : (
                                                            <div className="max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {addOnServices.filter(addon => isAddonVisibleForBaseServices(addon.name, shoe.baseService || [], services)).sort((a, b) => {
                                                                        const order: Record<string, number> = {
                                                                            'Unyellowing': 1,
                                                                            'Minor Retouch': 2,
                                                                            'White Paint': 3,
                                                                            'Minor Restoration': 4,
                                                                            '2 Colors': 5,
                                                                            '3 Colors': 6,
                                                                            'Add Glue Layer': 7,
                                                                            'Premium Glue': 8,
                                                                            'Full Reglue Midsole': 9,
                                                                            'Full Reglue Undersole': 10,
                                                                            'Midsole Full Reglue': 9,
                                                                            'Undersole Full Reglue': 10,
                                                                            'Midsole': 9,
                                                                            'Undersole': 10
                                                                        };
                                                                        return (order[a.name] || 99) - (order[b.name] || 99);
                                                                    }).map((addon) => {
                                                                        const isChecked = shoe.addOns.some(a => a.name === addon.name);
                                                                        const addonItem = shoe.addOns.find(a => a.name === addon.name);
                                                                        const quantity = addonItem?.quantity || 1;
                                                                        return (
                                                                            <div key={addon.id} className={`p-2 rounded-lg border bg-white transition-all ${isChecked ? 'border-red-100 bg-red-50/10' : 'border-gray-50'}`}>
                                                                                {isChecked ? (
                                                                                    <div className="flex items-start space-x-2 min-w-0 w-full">
                                                                                        <Checkbox
                                                                                            type="button"
                                                                                            id={`addon-${shoe.id}-${addon.id}`}
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

                                                                                                const nextAddOns = syncColorRenewalAddons(newAddOns, newBaseServices).filter(a => isAddonVisibleForBaseServices(a.name, newBaseServices, services));
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
                                                                                            <div className="flex items-center justify-between gap-2 mt-1.5 min-w-0">
                                                                                                <div className="flex items-center shrink-0">
                                                                                                    <input
                                                                                                        type="number"
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
                                                                                                <span className="text-[11px] font-black text-red-600 shrink-0 ml-auto">{formatPeso(getAddonTotal(addon.name, quantity))}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center space-x-2 min-w-0 w-full">
                                                                                        <Checkbox
                                                                                            type="button"
                                                                                            id={`addon-${shoe.id}-${addon.id}`}
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

                                                                                                const nextAddOns = syncColorRenewalAddons(newAddOns, newBaseServices);
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
                                                        )}
                                                    </div>
                                                </div>
                                            
                                            {/* Supplies & Materials Used */}
                                            <div className="space-y-3 pt-3 border-t border-gray-200 mt-4 h-full">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplies & Materials Used</Label>
                                                    <span className="text-[10px] font-bold text-gray-300 uppercase italic">Stock will be subtracted</span>
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
                <CardContent className="px-5 pt-0 pb-4">
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
                                const deposit = parseFloat(depositAmount.replace(/,/g, '')) || 0;
                                const total = grandTotal;


                                return (
                                    <div className="bg-[#F8F9FA]/50 p-4 rounded-xl border border-red-50/50 space-y-3 shadow-sm h-full flex flex-col justify-center">
                                        <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
                                            {/* Row 1: Order Date, Order Time, Release Date & Release Time */}
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label className={LABEL_STYLE}>Order Date</Label>
                                                <FormattedDateInput
                                                    id="orderDate"
                                                    value={orderDate}
                                                    onChange={(val) => setOrderDate(val)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                    iconClassName="text-purple-600"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label className={LABEL_STYLE}>Order Time</Label>
                                                <FormattedTimeInput
                                                    id="orderTime"
                                                    value={orderTime}
                                                    onChange={(e) => setOrderTime(e.target.value)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label className={LABEL_STYLE}>Estimated Date</Label>
                                                <FormattedDateInput
                                                    id="releaseDate"
                                                    value={previewReleaseYmd}
                                                    onChange={(val) => setManualReleaseDate(val)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                    iconClassName="text-emerald-600"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-3">
                                                <Label className={LABEL_STYLE}>Release Time</Label>
                                                <FormattedTimeInput
                                                    id="releaseTime"
                                                    value={releaseTime}
                                                    onChange={(e) => setReleaseTime(e.target.value)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full"
                                                />
                                            </div>
                                            <div className="col-span-2 md:col-span-12 space-y-2 mt-1">
                                                {/* Card 1: Business Rules (Official) */}
                                                <div 
                                                    className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-800 shadow-2xs hover:border-emerald-300 transition-colors"
                                                    title="Standard deterministic calculation based on service duration, add-ons, and rush order reduction."
                                                >
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <ClipboardList size={14} className="text-emerald-700 shrink-0" />
                                                            <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-950">
                                                                BUSINESS RULES:
                                                            </span>
                                                            <span className="inline-flex items-center bg-emerald-700 text-white text-[8.5px] font-bold uppercase px-2 py-0.5 rounded tracking-wide shadow-2xs shrink-0">
                                                                STANDARD
                                                            </span>
                                                        </div>
                                                        {hasSelectedServices ? (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-emerald-800/80 font-medium">Official Release Date:</span>
                                                                <span className="font-bold text-slate-900 text-xs">{officialDateDisplay}</span>
                                                                {releaseTime && <span className="text-emerald-700/80 text-[11px]">({releaseTime})</span>}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-emerald-800/80 font-medium">Select a service for official release date</span>
                                                                <span className="text-[10px] text-emerald-600/80 font-semibold hidden md:inline">(Standard duration & queue rules)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60">
                                                        <div className="w-[140px] inline-flex items-center justify-between bg-white border border-emerald-300/90 px-2.5 py-1 rounded-lg shadow-2xs shrink-0">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 whitespace-nowrap">TOTAL DAYS</span>
                                                            <span className="h-3 w-px bg-emerald-200 shrink-0" />
                                                            <span className="font-black text-slate-900 text-[11px] tabular-nums w-14 text-center shrink-0 flex items-center justify-center">
                                                                {manualReleaseDate ? 'MANUAL' : (hasSelectedServices && officialDays > 0) ? `${officialDays} ${officialDays === 1 ? 'DAY' : 'DAYS'}` : '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card 2: ML Prediction (Advisory) */}
                                                <div 
                                                    className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-800 shadow-2xs hover:border-blue-300 transition-colors"
                                                    title="Advisory operational prediction based on historical workshop order records."
                                                >
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <Sparkles size={14} className="text-amber-500 shrink-0" />
                                                            <span className="font-bold uppercase tracking-wider text-[11px] text-blue-950">
                                                                ML PREDICTION:
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsMlModalOpen(true)}
                                                                className="group inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[8.5px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider transition-all duration-150 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 shrink-0"
                                                                title="Click to view standard business rules vs ML prediction details"
                                                            >
                                                                <span>ADVISORY</span>
                                                                <Info size={10} className="text-indigo-200 group-hover:text-white transition-colors" />
                                                            </button>
                                                        </div>
                                                        {hasSelectedServices ? (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-blue-800/80 font-medium">Predicted Release Date:</span>
                                                                <span className="font-bold text-slate-900 text-xs inline-flex items-center gap-1.5">
                                                                    {predictionLoading ? (
                                                                        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                                                            <Loader2 className="w-3 h-3 animate-spin text-red-500 shrink-0" />
                                                                            <span>Predicting…</span>
                                                                        </span>
                                                                    ) : (serverPrediction?.ml_predicted_date || serverPrediction?.ml_predicted_days != null) ? (
                                                                        predictedDateDisplay
                                                                    ) : (
                                                                        <span className="text-slate-400 font-normal">Predicting…</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-blue-800/80 font-medium">Select a service for ML predicted release date</span>
                                                                <span className="text-[10px] text-blue-600/80 font-semibold hidden md:inline">(AI model trained on past orders)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-blue-200/60">
                                                        <div className="w-[140px] inline-flex items-center justify-between bg-white border border-blue-300/90 px-2.5 py-1 rounded-lg shadow-2xs shrink-0">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-800 whitespace-nowrap">TOTAL DAYS</span>
                                                            <span className="h-3 w-px bg-blue-200 shrink-0" />
                                                            <span className="font-black text-slate-900 text-[11px] tabular-nums w-14 text-center shrink-0 flex items-center justify-center">
                                                                {predictionLoading ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500 shrink-0" />
                                                                ) : !hasSelectedServices ? (
                                                                    '—'
                                                                ) : serverPrediction?.ml_predicted_days != null && serverPrediction.ml_predicted_days > 0 ? (
                                                                    `${serverPrediction.ml_predicted_days} ${serverPrediction.ml_predicted_days === 1 ? 'DAY' : 'DAYS'}`
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
                                                <Label className={LABEL_STYLE}>Order ID</Label>
                                                <div className="flex items-center bg-white h-9 rounded-xl px-3 text-xs font-normal text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <Hash size={14} className="mr-2 text-gray-400" />
                                                    <span className="whitespace-nowrap font-normal">{generatedOrderNumber || 'Generating...'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-1 md:col-span-4">
                                                <Label className={LABEL_STYLE}>Processed By</Label>
                                                <div className="flex items-center bg-white h-9 rounded-xl px-3 text-xs text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <User size={14} className="mr-2 text-gray-400" />
                                                    <span className="truncate">{user?.username || 'Current User'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-2 md:col-span-4">
                                                <Label className={LABEL_STYLE}>Payment Status</Label>
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
                                                    <SelectTrigger className="bg-white border-gray-100/50 h-9 rounded-xl text-xs text-gray-900 shadow-sm px-3 w-full pr-4 transition-all hover:border-red-200">
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
                                                <Label className={LABEL_STYLE}>Payment Method</Label>
                                                <div className="relative group/select">
                                                    <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
                                                        <SelectTrigger className="bg-white border-gray-100/50 h-9 rounded-xl text-xs shadow-sm px-3 w-full pr-4 transition-all hover:border-red-200">
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
                                                        value={referenceNo}
                                                        onChange={(e: any) => setReferenceNo(formatReferenceNo(e.target.value))}
                                                        placeholder={paymentMethod === 'gcash' ? "xxxx-xxx-xxx-xxx" : "xxxx-xxxx-xxxx"}
                                                        className="bg-white border-gray-100/50 h-9 rounded-xl text-xs shadow-sm transition-all hover:border-red-200"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                            {showAmountRec && (
                                                <>
                                                    <div className="space-y-1">
                                                        {isPartial ? (
                                                            <>
                                                                <Label htmlFor="depositAmt" className={LABEL_STYLE}>Required Downpayment (50%)</Label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                                    <Input
                                                                        id="depositAmt"
                                                                        type="text"
                                                                        readOnly
                                                                        value={depositAmount}
                                                                        className="bg-gray-100/50 border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black text-gray-800 shadow-sm cursor-not-allowed"
                                                                    />
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Label className={LABEL_STYLE}>Total Due</Label>
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
                                                                    if (e.target.value === '') {
                                                                        setAmountReceived('0.00');
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
                                                        <Label className={LABEL_STYLE}>Amount Change</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                            <Input
                                                                title="Amount Change"
                                                                readOnly
                                                                value={(() => {
                                                                    const diff = received - (isPartial ? deposit : total);
                                                                    const val = Math.max(0, diff);
                                                                    return isNaN(val) ? '0.00' : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                                })()}
                                                                className={`bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black shadow-sm ${received - (isPartial ? deposit : total) >= 0 ? 'text-green-600' : 'text-red-500'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                    {isPartial && (
                                                        <div className="space-y-1">
                                                            <Label className={LABEL_STYLE}>Remaining Balance</Label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                                <Input
                                                                    title="Remaining Balance"
                                                                    readOnly
                                                                    value={(() => {
                                                                        const val = Math.max(0, total - deposit);
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
                                            <span className="text-gray-500 font-medium">{shoes.length > 1 ? 'Rush Fee Total' : 'Rush Fee'}</span>
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

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 pt-5 mt-2 border-t border-gray-100">
                        <Button
                            type="button"
                            className="w-full sm:flex-1 bg-gray-200 hover:bg-gray-700 text-gray-600 hover:text-white font-black text-xs uppercase tracking-widest h-10 transition-all rounded-lg shadow-sm"
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest h-10 shadow-lg shadow-red-200 transition-all rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
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
                                Official Release Date & ML Prediction Details
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-[11px] sm:text-xs text-gray-500">
                            Comparison between standard shop business rules and advisory ML operational prediction.
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
                                        Business Rules
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white border border-emerald-200/80 space-y-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/90 block">
                                        Official Release Date
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
                                    <div className="flex justify-between pt-1 border-t border-slate-200/60 font-black text-slate-950">
                                        <span>Total Duration:</span>
                                        <span>{officialDays} {officialDays === 1 ? 'Day' : 'Days'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ML Prediction Card */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span className="font-bold uppercase tracking-wider text-[11px] text-slate-900">
                                        ML Prediction
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white border border-blue-200/80 space-y-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800/90 block">
                                        Predicted Release Date
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
                                            ) : predictionError && !serverPrediction?.ml_predicted_date ? (
                                                <span className="text-slate-400 font-medium">Unable to calculate</span>
                                            ) : serverPrediction?.ml_predicted_date ? (
                                                predictedDateDisplay
                                            ) : (
                                                <span className="text-slate-400 font-medium">Predicting…</span>
                                            )}
                                        </span>
                                        <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[8px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-2xs shrink-0">
                                            <span>ADVISORY</span>
                                            <Info size={9} className="text-indigo-200" />
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px] text-slate-700">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Algorithm:</span>
                                        <span className="font-bold text-slate-900">{formatMlModelName(serverPrediction?.ml_model)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Training Base:</span>
                                        <span className="font-bold text-slate-900">Historical Orders</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Model Status:</span>
                                        <span className="font-bold text-slate-900">
                                            {predictionLoading ? (
                                                <span className="inline-flex items-center gap-1 text-blue-600">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>Predicting…</span>
                                                </span>
                                            ) : !hasSelectedServices ? (
                                                <span className="text-slate-400 font-medium text-[11px]">Ready</span>
                                            ) : predictionError && !serverPrediction?.ml_status ? (
                                                <span className="text-amber-600 font-medium">Prediction unavailable</span>
                                            ) : serverPrediction?.ml_status === 'valid' ? (
                                                <span className="text-emerald-600 font-bold">Valid ✓</span>
                                            ) : serverPrediction?.ml_status ? (
                                                serverPrediction.ml_status.charAt(0).toUpperCase() + serverPrediction.ml_status.slice(1).toLowerCase()
                                            ) : (
                                                <span className="text-slate-400 font-medium">Predicting…</span>
                                            )}
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
                                            ) : predictionError && serverPrediction?.ml_predicted_days == null ? (
                                                <span className="text-slate-400 font-medium">Unable to calculate</span>
                                            ) : serverPrediction?.ml_predicted_days != null && serverPrediction.ml_predicted_days > 0 ? (
                                                `${serverPrediction.ml_predicted_days} ${serverPrediction.ml_predicted_days === 1 ? 'Day' : 'Days'}`
                                            ) : (
                                                <span className="text-slate-400 font-medium text-[11px]">Predicting…</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Why Dates Differ Explanation */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 text-slate-800">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                <Info className="w-4 h-4 text-slate-600 shrink-0" />
                                <span>How Official Release Dates & ML Predictions Work</span>
                            </div>
                            <div className="space-y-2 text-[11px] leading-relaxed">
                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-emerald-500 shadow-2xs space-y-1.5">
                                    <strong className="text-emerald-950 font-bold block">
                                        1. Business Rules
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The official release date is calculated using the shop's standard service policy:
                                    </p>
                                    <div className="py-1 flex justify-center">
                                        <code className="bg-emerald-50 text-emerald-900 border border-emerald-200/70 px-2.5 py-1 rounded font-mono text-[10px] font-bold inline-block text-center shadow-2xs">
                                            Base Service Days + Add-on Days − Rush Days Reduction
                                        </code>
                                    </div>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The calculation determines the official release date shown on the customer's claim stub. It follows the standard number of days assigned to the selected service and add-ons, with the applicable days reduction for rush orders.
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-blue-500 shadow-2xs space-y-1.5">
                                    <strong className="text-blue-950 font-bold block">
                                        2. ML Prediction
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The ML prediction is generated using a Random Forest Regressor trained on validated historical job orders. The model evaluates 18 features from job-order data, including service types, add-on quantities, pair volume, grand total, order date, priority level (Regular/Rush), and six shoe-condition severity factors: scratches, yellowing, deep stains, sole separation, rips/holes, and worn out. The resulting duration and date are advisory estimates based on historical job-order data. They serve as an internal operational reference and do not replace the official release date.
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-amber-500 shadow-2xs space-y-1.5">
                                    <strong className="text-amber-950 font-bold block">
                                        3. Why Can the Dates Differ?
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The two methods serve different purposes. Business Rules calculate the official release date using the shop's standard service policy. ML Prediction estimates a possible completion duration using relationships identified from validated historical job-order data. Because the two methods use different calculations and information, their results may differ. The Business Rules date remains the official release date, while the ML prediction serves as an advisory estimate.
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-purple-500 shadow-2xs space-y-1.5">
                                    <strong className="text-purple-950 font-bold block">
                                        4. Operational Safeguard
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        The ML prediction is intended for internal use by the owner and staff as a decision-support reference. It can assist in reviewing expected completion times, planning work schedules, and monitoring job-order progress. When an order is completed, staff can update its status and inform the customer when it is ready for pickup. The ML prediction does not override, shorten, or change the official release date.
                                    </p>
                                </div>

                                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 border-l-4 border-l-rose-500 shadow-2xs space-y-1.5">
                                    <strong className="text-rose-950 font-bold block">
                                        5. Machine Learning in Data Analytics
                                    </strong>
                                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                        Machine learning is used as the predictive analytics component of the system. The Random Forest Regressor analyzes relationships between validated historical job-order features and actual completion durations, then estimates the completion duration and predicted release date for a new job order. This complements the system's descriptive analytics, presented through the dashboard and sales reports.
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

        </form>
    );
}

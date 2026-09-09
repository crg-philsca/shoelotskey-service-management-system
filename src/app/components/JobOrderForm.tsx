import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, X, User, Hash, ClipboardList, RotateCcw, Calendar as CalendarIcon, Clock, Sparkles } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import { useServices } from '../context/ServiceContext';
import type { ShippingPreference, PaymentMethod, PaymentStatus, Priority } from '@/app/types';
import { format as dateFnsFormat } from 'date-fns';
import { CreatableCombobox } from './ui/creatable-combobox';
import { useActivities } from '@/app/context/ActivityContext';
import { useInventory } from '../context/InventoryContext';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { API_BASE } from '@/app/lib/apiBase';
import { isAddonVisibleForBaseServices, applyColorCountExclusive, syncColorRenewalAddons, shoeHasBothColorCounts, isColorCountAddon } from '@/app/lib/serviceCompatibility';
import { nextOrderId } from '@/app/lib/orderNumber';
import { calculateOfficialReleaseBreakdown, formatBusinessRuleLabel } from '@/app/lib/businessRules';

function formatMlModelName(name?: string | null): string {
    if (!name) return 'Random Forest Regression';
    if (/heuristic|fallback/i.test(name)) return name;
    if (/random forest/i.test(name)) return 'Random Forest Regression';
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

function ClearableInput({ id, value, onChange, placeholder, className, required, type = "text", inputMode }: any) {
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
    const [predictionError, setPredictionError] = useState<string | null>(null);

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
        // Rush is ONLY eligible if:
        // Across all shoes in the order:
        // 1. The ONLY service selected is 'Basic Cleaning'
        // 2. There are no add-on services selected
        return shoes.every(shoe => {
            const baseServices = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            const addOns = Array.isArray(shoe.addOns) ? shoe.addOns : [];
            return baseServices.length === 1 && baseServices[0] === 'Basic Cleaning' && addOns.length === 0;
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
    const calculatePredictedDays = () => {
        const hasServices = shoes.some(shoe => (Array.isArray(shoe.baseService) ? shoe.baseService : []).length > 0 || shoe.addOns.length > 0);
        if (!hasServices) return 0;
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

            // Rush Fee only for Basic Cleaning
            if (priorityLevel === 'rush' && servicesArr.includes('Basic Cleaning')) {
                rushFee += 150 * shoe.quantity;
            }
        });

        const grandTotal = baseTotal + addOnsTotal + rushFee;
        const amountReceivedNum = amountReceived ? parseFloat(amountReceived.replace(/,/g, '')) : 0;

        // Dynamic exact halves (50%) for deposit
        const depositAmt = paymentStatus === 'downpayment' ? grandTotal / 2 : grandTotal;

        // Change logic uses deposit required, not necessarily the overall total
        const change = amountReceivedNum - depositAmt;

        // Remaining Balance
        const remainingBalance = Math.max(0, grandTotal - depositAmt);

        return { baseTotal, addOnsTotal, rushFee, grandTotal, amountReceivedNum, remainingBalance, change };
    }, [shoes, baseServices, addOnServices, priorityLevel, amountReceived, paymentStatus]);

    const { baseTotal, addOnsTotal, rushFee, grandTotal } = totals;

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
    const previewReleaseYmd = manualReleaseDate || officialReleaseYmd || serverOfficialYmd;

    useEffect(() => {
        const hasServices = shoes.some(shoe =>
            (Array.isArray(shoe.baseService) ? shoe.baseService : []).length > 0
            || (Array.isArray(shoe.addOns) ? shoe.addOns : []).length > 0
        );
        if (!hasServices || manualReleaseDate) {
            if (!hasServices) setServerPrediction(null);
            setPredictionError(null);
            setPredictionLoading(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setPredictionLoading(true);
            setPredictionError(null);
            try {
                const createdDate = new Date(`${orderDate}T${orderTime || '00:00'}:00`);
                const payload = {
                    items: shoes.map((shoe) => ({
                        brand: shoe.brand === 'Other' ? (shoe.otherBrand || 'Other') : (shoe.brand || 'Other'),
                        shoeModel: shoe.shoeModel === 'Other' ? (shoe.otherModel || 'Other') : (shoe.shoeModel || 'Other'),
                        shoeMaterial: shoe.shoeMaterial === 'Other' ? (shoe.otherMaterial || 'Other') : (shoe.shoeMaterial || 'Other'),
                        quantity: shoe.quantity,
                        condition: shoe.condition,
                        baseService: shoe.baseService,
                        addOns: shoe.addOns,
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
                        ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error('Prediction request failed');
                const data: ServerPrediction = await res.json();
                setServerPrediction(data);
            } catch (err: any) {
                if (err?.name === 'AbortError') return;
                setPredictionError('Using catalog estimate until the server prediction is available.');
            } finally {
                setPredictionLoading(false);
            }
        }, 350);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [shoes, priorityLevel, orderDate, orderTime, totals.grandTotal, manualReleaseDate, user?.token]);


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
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const finalCustomerName = customerName.trim().replace(/\s+/g, ' ');
            const finalContactNumber = contactNumber.trim();

            if (!finalCustomerName) {
                toast.error('Please enter customer name (required)');
                setIsSubmitting(false);
                return;
            }
            setCustomerName(finalCustomerName);

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
            return;
        } else if (amtReceived < depositAmt && paymentStatus === 'downpayment') {
            toast.error('Amount received is less than the required 50% downpayment');
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
            grandTotal: totals.grandTotal,
            shippingPreference,
            deliveryAddress: formatAddress(),
            deliveryCourier: shippingPreference === 'delivery' ? (deliveryCourier === 'Other' ? otherCourier : deliveryCourier) : undefined,
            province: deliveryAddress.province,
            city: deliveryAddress.city,
            barangay: deliveryAddress.barangay,
            zipCode: deliveryAddress.zipCode,
            paymentMethod,
            paymentStatus,
            amountReceived: totals.amountReceivedNum,
            balance: totals.remainingBalance,
            change: totals.change,
            referenceNo,
            // shelfLocation removed
            depositAmount: parseFloat(depositAmount) || 0,
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
                            <Label htmlFor="customerName" className={LABEL_STYLE}>Customer Name</Label>
                            <ClearableInput
                                id="customerName"
                                autoComplete="new-password"
                                spellCheck={false}
                                value={customerName}
                                onChange={(e: any) => {
                                    setCustomerName(e.target.value);
                                    setShowCustomerSuggestions(true);
                                }}
                                onFocus={() => setShowCustomerSuggestions(true)}
                                onBlur={() => {
                                    setTimeout(() => {
                                        setShowCustomerSuggestions(false);
                                        setCustomerName(prev => prev.trim().replace(/\s+/g, ' '));
                                    }, 200);
                                }}
                                placeholder="Enter name (or search past customer...)"
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
                                        placeholder="Select Courier"
                                        searchPlaceholder="Search courier..."
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
                                            className="h-5 w-5 text-red-500 hover:text-white hover:bg-red-700 transition-all p-0 rounded-full"
                                        >
                                            <X size={14} />
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
                                                            placeholder="Type for custom"
                                                            searchPlaceholder="Search brand..."
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
                                                            placeholder="Type for custom"
                                                            searchPlaceholder="Type model name (e.g. Air Force 1)"
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
                                                            placeholder="Type for custom"
                                                            searchPlaceholder="Search material..."
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
                                                            placeholder="Type for custom"
                                                            searchPlaceholder="Type a size..."
                                                        />
                                                    </div>
                                                    <div style={{ flex: 28 }}>
                                                        <Label className={LABEL_STYLE}>Color</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_COLORS}
                                                            value={Array.isArray(shoe.color) ? shoe.color.filter(Boolean).join(', ') : (shoe.color || '')}
                                                            onChange={(val) => updateShoe(shoe.id, { color: val })}
                                                            placeholder="Select Color"
                                                            searchPlaceholder="Type color (e.g. White, Black)"
                                                            multiple={true}
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
                                                        <Label className={LABEL_STYLE}>Priority Level</Label>
                                                        <div className="relative group/select">
                                                            <Select value={priorityLevel} onValueChange={(val: any) => setPriorityLevel(val)}>
                                                                <SelectTrigger className={`${INPUT_STYLE} font-normal`}>
                                                                    <SelectValue placeholder="Regular" />
                                                                </SelectTrigger>
                                                                <SelectContent align="start" side="bottom" position="popper" sideOffset={5}>
                                                                    <SelectItem value="regular">Regular</SelectItem>
                                                                    {isRushEligible && (
                                                                        <SelectItem value="rush">Rush</SelectItem>
                                                                    )}
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
                                                {shoe.baseService && shoe.baseService.length > 0 ? (
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
                                                                        <label key={service.id} className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-all cursor-pointer shadow-sm ${isChecked ? 'border-red-100 bg-red-50/10' : 'bg-white border-gray-100 hover:border-red-100'}`}>
                                                                            <Checkbox
                                                                                type="button"
                                                                                id={`shoe-${shoe.id}-service-${service.id}`}
                                                                                checked={isChecked}
                                                                                onCheckedChange={(checked) => {
                                                                                    const currentServices = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                                                                                    let newServices = checked
                                                                                        ? [...currentServices, service.name]
                                                                                        : currentServices.filter(s => s !== service.name);

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

                                                                                    const nextAddOns = syncColorRenewalAddons(shoe.addOns || [], newServices);
                                                                                    updateShoe(shoe.id, { baseService: newServices, addOns: nextAddOns });
                                                                                }}
                                                                                className="h-4 w-4 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                            />
                                                                            <div className="flex items-center justify-between flex-1 min-w-0">
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span className="text-[11px] font-bold leading-tight text-gray-700 truncate">
                                                                                        {service.name}
                                                                                    </span>
                                                                                    <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                                                                                        {service.code && (
                                                                                            <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1 rounded uppercase tracking-wider">
                                                                                                {service.code}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                {isChecked && (
                                                                                    <span className="text-[11px] font-black text-red-600 shrink-0 ml-2">{formatPeso(service.price)}</span>
                                                                                )}
                                                                            </div>
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
                                                                    {addOnServices.filter(addon => isAddonVisibleForBaseServices(addon.name, shoe.baseService || [])).sort((a, b) => {
                                                                        const order: Record<string, number> = {
                                                                            'Unyellowing': 1,
                                                                            'Minor Retouch': 2,
                                                                            'White Paint': 3,
                                                                            'Minor Restoration': 4,
                                                                            '2 Colors': 5,
                                                                            '3 Colors': 6,
                                                                            'Add Glue Layer': 7,
                                                                            'Premium Glue': 8,
                                                                            'Midsole': 9,
                                                                            'Undersole': 10
                                                                        };
                                                                        return (order[a.name] || 99) - (order[b.name] || 99);
                                                                    }).map((addon) => {
                                                                        const isChecked = shoe.addOns.some(a => a.name === addon.name);
                                                                        const addonItem = shoe.addOns.find(a => a.name === addon.name);
                                                                        const quantity = addonItem?.quantity || 1;
                                                                        return (
                                                                            <div key={addon.id} className={`flex items-center justify-between p-2 rounded-lg border bg-white transition-all ${isChecked ? 'border-red-100 bg-red-50/10' : 'border-gray-50'} gap-4`}>
                                                                                <div className="flex items-center space-x-2 min-w-0 flex-1">
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
                                                                                            updateShoe(shoe.id, { addOns: newAddOns });
                                                                                        }}
                                                                                        className="h-4 w-4 shrink-0 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                                    />
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <label htmlFor={`addon-${shoe.id}-${addon.id}`} className="text-[11px] font-bold text-gray-600 cursor-pointer leading-tight truncate">
                                                                                            {addon.name}
                                                                                        </label>
                                                                                        <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                                                                                            {addon.code && (
                                                                                                <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1 rounded uppercase tracking-wider">
                                                                                                    {addon.code}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                {isChecked && (
                                                                                    <div className="flex items-center gap-3 ml-auto shrink-0">
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
                                                                                            className="w-10 h-5 border border-gray-200 rounded text-[10px] font-bold text-center focus:outline-none focus:border-red-500 bg-white [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-inner-spin-button]:h-[16px] [&::-webkit-inner-spin-button]:my-auto px-0"
                                                                                        />
                                                                                        <span className="text-[11px] font-black text-red-600 min-w-[50px] text-right">{formatPeso(getAddonTotal(addon.name, quantity))}</span>
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
                                                        return (
                                                            <div key={uIdx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm animate-in fade-in slide-in-from-left-2 duration-300">
                                                                 <Select 
                                                                    value={usage.itemId?.toString() || ""} 
                                                                    onValueChange={(val) => {
                                                                        const newUsage = [...shoe.inventoryUsed];
                                                                        newUsage[uIdx].itemId = parseInt(val);
                                                                        updateShoe(shoe.id, { inventoryUsed: newUsage });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-8 text-[11px] font-bold border-none shadow-none flex-1">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {inventoryData.map((inv: any) => {
                                                                            const pres = getInventoryPresentation(inv);
                                                                            return (
                                                                                <SelectItem key={inv.id} value={inv.id?.toString() || ""} className="text-[11px] font-medium">
                                                                                    {inv.name} - {pres.dropdownLabel}
                                                                                </SelectItem>
                                                                            );
                                                                        })}
                                                                    </SelectContent>
                                                                </Select>
                                                                <div className="flex items-center gap-1 shrink-0 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                                                    <input
                                                                        type="number"
                                                                        step="0.1"
                                                                        min="0.1"
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
                                                                    inventoryUsed: [...shoe.inventoryUsed, { itemId: firstAvailable, amount: 0.1 }]
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
                                                <div className="bg-emerald-50 border border-emerald-100/70 rounded-lg p-2 flex items-center justify-between gap-3 text-[10px] text-emerald-900 shadow-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <ClipboardList size={12} className="text-emerald-600 shrink-0" />
                                                        <span className="font-bold shrink-0 uppercase tracking-wider">
                                                            BUSINESS RULES:
                                                        </span>
                                                        <span>
                                                            {manualReleaseDate
                                                                ? `Manual date ${manualReleaseDate}`
                                                                : officialDays > 0
                                                                    ? formatBusinessRuleLabel(mlBreakdown)
                                                                    : 'Select a service to estimate the release date'}
                                                        </span>
                                                    </div>
                                                    <span className="font-black bg-emerald-100 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0">
                                                        {manualReleaseDate ? 'Manual' : officialDays > 0 ? `TOTAL: ${officialDays} DAYS` : 'TOTAL: —'}
                                                    </span>
                                                </div>
                                                <div className="bg-blue-50 border border-blue-100/50 rounded-lg p-2 flex items-center justify-between gap-3 text-[10px] text-blue-800 shadow-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Sparkles size={12} className="text-amber-500 shrink-0" />
                                                        <span className="font-bold shrink-0 uppercase tracking-wider">
                                                            ML PREDICTION:
                                                        </span>
                                                        <span>
                                                            {predictionLoading
                                                                ? 'Calculating…'
                                                                : predictionError
                                                                    || formatMlModelName(serverPrediction?.ml_model)}
                                                        </span>
                                                    </div>
                                                    <span className="font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0">
                                                        {serverPrediction?.ml_predicted_days != null
                                                            ? `TOTAL: ${serverPrediction.ml_predicted_days} DAYS`
                                                            : 'TOTAL: —'}
                                                    </span>
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
                            {isSubmitting ? 'Submitting...' : (mode === 'create' ? 'Submit' : 'Save Changes')}
                        </Button>
                    </div>
                </CardContent>
            </Card>


        </form>
    );
}

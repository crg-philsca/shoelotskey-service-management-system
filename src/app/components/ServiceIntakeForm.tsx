import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';
import { mockServices } from '@/app/lib/mockData';
import { Plus, X, Calendar, User, Hash, ClipboardList, RotateCcw } from 'lucide-react';
import { useOrders } from '@/app/context/OrderContext';
import type { ShippingPreference, PaymentMethod, PaymentStatus, Priority } from '@/app/types';
import { CreatableCombobox } from './ui/creatable-combobox';

// Dropdown options
const SHOE_BRANDS = [
    'Other', 'Nike', 'Adidas', 'Asics', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 'Jordan',
    'Under Armour', 'Timberland', 'Dr. Martens', 'Salomon', 'Merrell', 'Skechers', 'Mizuno',
    'Brooks', 'Saucony', 'Hoka'
];

const SHOE_MATERIALS = [
    'Other', 'Leather', 'Synthetic', 'Canvas', 'Mesh', 'Rubber', 'Textile', 'Suede', 'Knit', 'Patent Leather', 'Denim', 'Nubuck'
];

const DELIVERY_COURIERS = [
    'Other', 'Lalamove', 'JRS', 'LBC'
];

interface ShoeEntry {
    id: string;
    brand: string;
    otherBrand?: string;
    shoeMaterial: string;
    otherMaterial?: string;
    quantity: number;
    condition: {
        scratches: boolean;
        ripsHoles: boolean;
        fadedWorn: boolean;
        soleSeparation: boolean;
        yellowing: boolean;
        deepStains: boolean;
        others: string;
    };
    baseService: string[];
    addOns: { name: string; quantity?: number }[];
}

interface ServiceIntakeFormProps {
    user?: { username: string; role: string };
    onSuccess?: () => void;
    onCancel?: () => void;
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

export default function ServiceIntakeForm({ user, onSuccess, onCancel }: ServiceIntakeFormProps) {
    const { addOrder, orders } = useOrders();
    const [customerName, setCustomerName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    // State for Shipping Preference
    const [shippingPreference, setShippingPreference] = useState<string>("pickup");


    // Auto-reset priority level if conditions are not met


    const [shoes, setShoes] = useState<ShoeEntry[]>([{
        id: '1',
        brand: '',
        shoeMaterial: '',
        quantity: 1,
        condition: {
            scratches: false,
            ripsHoles: false,
            fadedWorn: false,
            soleSeparation: false,
            yellowing: false,
            deepStains: false,
            others: '',
        },
        baseService: [],
        addOns: [],
    }]);
    const [priorityLevel, setPriorityLevel] = useState<Priority>('regular');
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
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
    const [amountReceived, setAmountReceived] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [orderTime, setOrderTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    const [releaseTime, setReleaseTime] = useState('');

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
            quantity: 1,
            condition: {
                scratches: false,
                ripsHoles: false,
                fadedWorn: false,
                soleSeparation: false,
                yellowing: false,
                deepStains: false,
                others: '',
            },
            baseService: [],
            addOns: [],
        }]);

        // Reset Order Details
        setPriorityLevel('regular');
        setPaymentMethod('cash');
        setPaymentStatus('unpaid');
        setAmountReceived('');
        setDepositAmount('');
        setReferenceNo('');
        setOrderTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        setReleaseTime('');
    };
    const [generatedOrderNumber, setGeneratedOrderNumber] = useState('');

    // Generate Unique Order ID on Mount
    useEffect(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const prefix = `ORD-${year}-${month}-${day}-`;

        const existingIds = orders
            .filter(o => o.orderNumber.startsWith(prefix))
            .map(o => parseInt(o.orderNumber.split('-')[4] || '0')); // ORD-YYYY-MM-DD-XXX -> index 4 is XXX

        const maxSeq = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const nextSeq = String(maxSeq + 1).padStart(3, '0'); // e.g., 001, 002
        setGeneratedOrderNumber(`${prefix}${nextSeq}`);
    }, [orders]);

    // Auto-reset priority level if conditions are not met
    useEffect(() => {
        const hasRushEligibleService = shoes.some(shoe => {
            const services = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            return services.some(s => s === 'Basic Cleaning' || s.includes('Reglue'));
        });

        const hasPremiumEligibleService = shoes.some(shoe => {
            const services = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            return services.some(s => s.includes('Color Renewal'));
        });

        if (priorityLevel === 'rush' && !hasRushEligibleService) {
            setPriorityLevel('regular');
        } else if (priorityLevel === 'premium' && !hasPremiumEligibleService) {
            setPriorityLevel('regular');
        }
    }, [shoes, priorityLevel]);

    const baseServices = mockServices.filter(s => s.category === 'base');
    const addOnServices = mockServices.filter(s => s.category === 'addon');

    const getAddonTotal = (addonName: string, quantity: number) => {
        const addon = addOnServices.find(s => s.name === addonName);
        if (!addon) return 0;
        return addon.price * quantity;
    };



    const calculatePredictedDays = () => {
        const hasAdditional = shoes.some(shoe =>
            (shoe.baseService && shoe.baseService.some(s => s !== 'Basic Cleaning')) ||
            (shoe.addOns && shoe.addOns.length > 0)
        );
        const baseDays = hasAdditional ? 25 : 10;
        return priorityLevel === 'rush' ? baseDays - 1 : baseDays;
    };

    const getShoeTotal = (shoe: ShoeEntry) => {
        let total = 0;
        const services = Array.isArray(shoe.baseService) ? shoe.baseService : [];
        if (services.length > 0) {
            services.forEach(serviceName => {
                const service = baseServices.find(s => s.name === serviceName);
                if (service) total += service.price * shoe.quantity;
            });
        }
        shoe.addOns.forEach((addon: { name: string; quantity?: number }) => {
            total += getAddonTotal(addon.name, addon.quantity || 1) * shoe.quantity;
        });
        return total;
    };

    const calculateTotals = () => {
        let baseTotal = 0;
        let addOnsTotal = 0;
        let rushFee = 0;

        shoes.forEach((shoe: ShoeEntry) => {
            const services = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            if (services.length > 0) {
                services.forEach(serviceName => {
                    const service = baseServices.find(s => s.name === serviceName);
                    if (service) {
                        baseTotal += service.price * shoe.quantity;
                    }
                });
            }

            shoe.addOns.forEach((addon: { name: string; quantity?: number }) => {
                const addonQuantity = addon.quantity || 1;
                addOnsTotal += getAddonTotal(addon.name, addonQuantity) * shoe.quantity;
            });

            // Calculate Rush Fee per shoe (Additive logic)
            let shoePriorityFee = 0;
            // services is already declared in outer scope
            if (priorityLevel === 'rush') {
                if (services.includes('Basic Cleaning')) {
                    shoePriorityFee += 150;
                }
                if (services.some(s => s.toLowerCase().includes('reglue'))) {
                    shoePriorityFee += 250;
                }
            } else if (priorityLevel === 'premium') {
                if (services.some(s => s.toLowerCase().includes('color renewal'))) {
                    shoePriorityFee = 1000;
                }
            }
            rushFee += shoePriorityFee * shoe.quantity;
        });

        const grandTotal = baseTotal + addOnsTotal + rushFee;
        const amountReceivedNum = amountReceived ? parseFloat(amountReceived.replace(/,/g, '')) : 0;
        // const change = amountReceivedNum - grandTotal;
        const change = amountReceivedNum - grandTotal;
        const remainingBalance = Math.max(0, grandTotal - amountReceivedNum);

        return { baseTotal, addOnsTotal, rushFee, grandTotal, amountReceivedNum, remainingBalance, change };
    };

    const { baseTotal, addOnsTotal, rushFee, grandTotal } = calculateTotals();

    const addShoe = () => {
        setShoes([...shoes, {
            id: Date.now().toString(),
            brand: '',
            shoeMaterial: '',
            quantity: 1,
            condition: {
                scratches: false,
                ripsHoles: false,
                fadedWorn: false,
                soleSeparation: false,
                yellowing: false,
                deepStains: false,
                others: '',
            },
            baseService: [],
            addOns: [],
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!customerName || !contactNumber) {
            toast.error('Please fill in customer information');
            return;
        }

        if (shoes.some(shoe => !shoe.baseService)) {
            toast.error('Please select base service for all shoes');
            return;
        }

        if (shippingPreference === 'delivery') {
            if (!deliveryAddress.houseNo || !deliveryAddress.street || !deliveryAddress.province || !deliveryAddress.city || !deliveryAddress.barangay || !deliveryAddress.zipCode) {
                toast.error('Please enter complete delivery address');
                return;
            }
            if (!deliveryCourier) {
                toast.error('Please select a delivery courier');
                return;
            }
            if (deliveryCourier === 'Other' && !otherCourier) {
                toast.error('Please specify the courier');
                return;
            }
        }

        // Create new order
        const [oHours, oMinutes] = orderTime.split(':').map(Number);
        const createdDate = new Date();
        createdDate.setHours(oHours || 0, oMinutes || 0, 0, 0);
        const year = createdDate.getFullYear();
        const month = String(createdDate.getMonth() + 1).padStart(2, '0');
        const day = String(createdDate.getDate()).padStart(2, '0');
        const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); // Simplified sequence

        // Helper to format delivery address
        const formatAddress = () => {
            if (shippingPreference === 'pickup') return undefined;
            return `${deliveryAddress.houseNo} ${deliveryAddress.street}, ${deliveryAddress.barangay}, ${deliveryAddress.city}, ${deliveryAddress.province}, ${deliveryAddress.zipCode}`;
        };

        shoes.forEach((shoe, index) => {
            const groupSuffix = shoes.length > 1 ? `-${String.fromCharCode(65 + index)}` : '';

            const newOrder: any = { // Using any temporarily if types mismatch, but preferably match JobOrder type
                id: `JO-${year}${month}${day}-${sequence}${groupSuffix}`,
                orderNumber: `ORD-${year}-${month}-${day}-${sequence.slice(-3)}`, // Match format ORD-YYYY-MM-DD-XXX
                customerName,
                contactNumber,
                brand: shoe.brand === 'Other' ? (shoe.otherBrand || 'Other') : (shoe.brand || 'Other'),
                shoeType: 'Sneakers', // Defaulting as specific type selector is not in this specific view snippet
                shoeMaterial: shoe.shoeMaterial === 'Other' ? (shoe.otherMaterial || 'Other') : (shoe.shoeMaterial || 'Other'),
                quantity: shoe.quantity,
                condition: shoe.condition,
                baseService: shoe.baseService,
                addOns: shoe.addOns.map(a => ({ name: a.name, quantity: a.quantity || 1 })),
                priorityLevel,
                baseServiceFee: 0, // Calculate properly if needed
                addOnsTotal: 0, // Calculate properly if needed
                grandTotal: 0, // This is per shoe total in this loop context
                shippingPreference,
                deliveryAddress: formatAddress(),
                deliveryCourier: shippingPreference === 'delivery' ? (deliveryCourier === 'Other' ? otherCourier : deliveryCourier) : undefined,
                province: shippingPreference === 'delivery' ? deliveryAddress.province : undefined,
                city: shippingPreference === 'delivery' ? deliveryAddress.city : undefined,
                barangay: shippingPreference === 'delivery' ? deliveryAddress.barangay : undefined,
                zipCode: shippingPreference === 'delivery' ? deliveryAddress.zipCode : undefined,
                paymentMethod,
                paymentStatus,
                amountReceived: paymentStatus === 'paid' || paymentStatus === 'partial' ? parseFloat(amountReceived.replace(/,/g, '') || '0') / shoes.length : undefined, // Split payment? Or just assign to primary?
                change: 0,
                shelfLocation: undefined,
                transactionDate: createdDate,
                processedBy: user?.username || 'Current User',
                status: 'new-order',
                assignedTo: undefined,
                predictedCompletionDate: (() => {
                    const daysToAdd = calculatePredictedDays();
                    const date = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
                    if (releaseTime) {
                        const [rHours, rMinutes] = releaseTime.split(':').map(Number);
                        date.setHours(rHours, rMinutes, 0, 0);
                    } else {
                        date.setHours(10, 0, 0, 0); // Default to 10 AM if no time
                    }
                    return date;
                })(),
                actualCompletionDate: undefined,
                createdAt: createdDate,
                updatedAt: createdDate,
                statusHistory: [{
                    status: 'new-order',
                    timestamp: createdDate,
                    user: user?.username || 'Current User',
                }]
            };

            // Recalculate per-shoe financials
            // Recalculate per-shoe financials
            let shoeBaseFee = 0;
            const baseServicesArr = shoe.baseService || [];
            baseServicesArr.forEach(serviceName => {
                const service = baseServices.find(s => s.name === serviceName);
                if (service) shoeBaseFee += service.price * shoe.quantity;
            });
            newOrder.baseServiceFee = shoeBaseFee;

            let shoeAddonsTotal = 0;
            shoe.addOns.forEach(addon => {
                const addonObj = addOnServices.find(s => s.name === addon.name);
                shoeAddonsTotal += (addonObj?.price || 0) * (addon.quantity || 1) * shoe.quantity;
            });
            newOrder.addOnsTotal = shoeAddonsTotal;

            // Rush fee per shoe logic (simplified from calculateTotals)
            // Priority fee per shoe logic (Additive)
            let shoeRushFee = 0;
            const servicesForFee = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            if (priorityLevel === 'rush') {
                if (servicesForFee.includes('Basic Cleaning')) {
                    shoeRushFee += 150;
                }
                if (servicesForFee.some(s => s.toLowerCase().includes('reglue'))) {
                    shoeRushFee += 250;
                }
            } else if (priorityLevel === 'premium') {
                if (servicesForFee.some(s => s.toLowerCase().includes('color renewal'))) {
                    shoeRushFee = 1000;
                }
            }
            newOrder.grandTotal = (newOrder.baseServiceFee + newOrder.addOnsTotal + (shoeRushFee * shoe.quantity));

            addOrder(newOrder);
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
            quantity: 1,
            condition: {
                scratches: false,
                ripsHoles: false,
                fadedWorn: false,
                soleSeparation: false,
                yellowing: false,
                deepStains: false,
                others: '',
            },
            baseService: [],
            addOns: [],
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
        setPaymentStatus('unpaid');
        setAmountReceived('');
        setReferenceNo('');
        setOrderTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        setReleaseTime('');
    };

    const formatReferenceNo = (value: string) => {
        // Remove non-digits, limit to 12 digits
        const digits = value.replace(/\D/g, '').slice(0, 12);
        // Format as xxxx-xxxx-xxxx
        let formatted = '';
        for (let i = 0; i < digits.length; i++) {
            formatted += digits[i];
            if ((i === 2 || i === 5 || i === 8) && i !== digits.length - 1) {
                formatted += '-';
            }
        }
        return formatted;
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
            {/* Customer Information Section */}
            <Card className="border-red-100/50 shadow-sm bg-white overflow-hidden">
                <CardHeader className={`${CARD_HEADER_STYLE} !py-2`}>
                    <div className="flex items-center gap-3 translate-y-[1px]">
                        <User className="text-red-600 fill-red-600" size={18} />
                        <CardTitle className={`${CARD_TITLE_STYLE} text-slate-900`}>CUSTOMER INFORMATION</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="px-6 pt-0 pb-4 space-y-4">
                    <div className={`grid gap-3 md:gap-4 -mt-1 ${shippingPreference === 'pickup' ? 'grid-cols-3' : 'grid-cols-12 mb-2.5'}`}>
                        <div className={shippingPreference === 'pickup' ? 'col-span-1' : 'col-span-6'}>
                            <Label htmlFor="customerName" className={LABEL_STYLE}>Customer Name</Label>
                            <ClearableInput
                                id="customerName"
                                value={customerName}
                                onChange={(e: any) => setCustomerName(e.target.value)}
                                placeholder="Enter name"
                                className={INPUT_STYLE}
                                required
                            />
                        </div>
                        <div className={shippingPreference === 'pickup' ? 'col-span-1' : 'col-span-6'}>
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
                                        <SelectItem value="pickup">Pick-up</SelectItem>
                                        <SelectItem value="delivery">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {shippingPreference === 'delivery' && (
                        <div className="space-y-2.5">
                            {/* Row 1: Shipping Pref, Courier */}
                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                                <div className="col-span-1">
                                    <Label htmlFor="shippingPref" className={LABEL_STYLE}>Shipping Preference</Label>
                                    <Select value={shippingPreference} onValueChange={(value: ShippingPreference) => setShippingPreference(value)}>
                                        <SelectTrigger id="shippingPref" className={INPUT_STYLE}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pickup">Pick-up</SelectItem>
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
                            <div className="grid grid-cols-3 gap-3 md:gap-4">
                                <div className="col-span-1">
                                    <Label htmlFor="unitNo" className={LABEL_STYLE}>UNIT/NO</Label>
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
                                    <Label htmlFor="street" className={LABEL_STYLE}>STREET/SUBDIVISION</Label>
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
                                    <Label htmlFor="barangay" className={LABEL_STYLE}>BARANGAY</Label>
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
                            <div className="grid grid-cols-3 gap-3 md:gap-4">
                                <div className="col-span-1">
                                    <Label htmlFor="city" className={LABEL_STYLE}>CITY</Label>
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
                                    <Label htmlFor="province" className={LABEL_STYLE}>PROVINCE</Label>
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
            </Card >

            {/* Shoes */}
            < div className="space-y-2" >
                {
                    shoes.map((shoe, index) => (
                        <Card key={shoe.id} className="border-red-100/50 shadow-sm bg-white group relative">
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
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="col-span-1">
                                                        <Label className={LABEL_STYLE}>Brand</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_BRANDS}
                                                            value={shoe.brand}
                                                            onChange={(val) => updateShoe(shoe.id, { brand: val })}
                                                            placeholder="Select Brand"
                                                            searchPlaceholder="Search brand..."
                                                        />
                                                    </div>
                                                    <div className="col-span-1">
                                                        <Label className={LABEL_STYLE}>Material</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_MATERIALS}
                                                            value={shoe.shoeMaterial}
                                                            onChange={(val) => updateShoe(shoe.id, { shoeMaterial: val })}
                                                            placeholder="Select Material"
                                                            searchPlaceholder="Search material..."
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-3">
                                                    <div className="col-span-1">
                                                        <Label className={LABEL_STYLE}>Quantity</Label>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={shoe.quantity}
                                                            onChange={(e) => updateShoe(shoe.id, { quantity: parseInt(e.target.value) || 1 })}
                                                            className={`${INPUT_STYLE} text-center font-bold px-1`}
                                                        />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <Label className={LABEL_STYLE}>Priority Level</Label>
                                                        <div className="relative group/select">
                                                            <Select value={priorityLevel} onValueChange={(val: any) => setPriorityLevel(val)}>
                                                                <SelectTrigger className={INPUT_STYLE}>
                                                                    <SelectValue placeholder="Regular" />
                                                                </SelectTrigger>
                                                                <SelectContent align="start" side="bottom" position="popper" sideOffset={5}>
                                                                    <SelectItem value="regular">Regular</SelectItem>
                                                                    {shoes.some(shoe => {
                                                                        const services = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                                                                        return services.some(s => s === 'Basic Cleaning' || s.includes('Reglue'));
                                                                    }) && (
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
                                                                    fadedWorn: false,
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
                                                            { id: 'ripsHoles', label: 'Rips/holes' },
                                                            { id: 'deepStains', label: 'Deep stains' },
                                                            { id: 'soleSeparation', label: 'Sole separation' },
                                                            { id: 'fadedWorn', label: 'Faded/worn' },
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
                                                        <div className="max-h-[108px] overflow-y-auto pr-1 custom-scrollbar">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {baseServices.map(service => {
                                                                    const isChecked = (Array.isArray(shoe.baseService) ? shoe.baseService : []).includes(service.name);
                                                                    return (
                                                                        <label key={service.id} className={`flex items-center space-x-2 p-3 rounded-lg border transition-all cursor-pointer shadow-sm ${isChecked ? 'border-red-100 bg-red-50/10' : 'bg-white border-gray-100 hover:border-red-100'}`}>
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

                                                                                    updateShoe(shoe.id, { baseService: newServices });
                                                                                }}
                                                                                className="h-4 w-4 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                            />
                                                                            <div className="flex items-center justify-between flex-1 min-w-0">
                                                                                <span className="text-[11px] font-bold leading-tight text-gray-700 truncate">
                                                                                    {service.name}
                                                                                </span>
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
                                                            <div className="max-h-[108px] overflow-y-auto pr-1 custom-scrollbar">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {addOnServices.filter(addon => {
                                                                        const baseServicesArr = shoe.baseService || [];
                                                                        const basicCleaningAddOns = ['Unyellowing', 'White Paint', 'Minor Restoration', 'Minor Retouch'];
                                                                        const reglueAddOns = ['Another Layer', 'Premium Glue'];
                                                                        if (baseServicesArr.includes('Basic Cleaning') && basicCleaningAddOns.includes(addon.name)) return true;
                                                                        if (baseServicesArr.some(s => s.includes('Full Reglue')) && reglueAddOns.includes(addon.name)) return true;
                                                                        const colorAddOns = ['2 Colors', '3 Colors'];
                                                                        if (baseServicesArr.some(s => s.includes('Color Renewal')) && colorAddOns.includes(addon.name)) return true;
                                                                        return false;
                                                                    }).sort((a, b) => {
                                                                        const order: Record<string, number> = {
                                                                            'Unyellowing': 1,
                                                                            'Minor Retouch': 2,
                                                                            'White Paint': 3,
                                                                            'Minor Restoration': 4,
                                                                            '2 Colors': 5,
                                                                            '3 Colors': 6,
                                                                            'Another Layer': 7,
                                                                            'Premium Glue': 8
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
                                                                                            let newAddOns = checked
                                                                                                ? [...shoe.addOns, { name: addon.name, quantity: 1 }]
                                                                                                : shoe.addOns.filter(a => a.name !== addon.name);
                                                                                            if (addon.name === 'Unyellowing' && !checked) {
                                                                                                newAddOns = newAddOns.filter(a => a.name !== 'White Paint');
                                                                                            }
                                                                                            updateShoe(shoe.id, { addOns: newAddOns });
                                                                                        }}
                                                                                        className="h-4 w-4 shrink-0 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                                    />
                                                                                    <label htmlFor={`addon-${shoe.id}-${addon.id}`} className="text-[11px] font-bold text-gray-600 cursor-pointer leading-tight">
                                                                                        {addon.name}
                                                                                    </label>
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
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                }
            </div >

            {/* Add Shoe Button */}
            < div className="my-4" >
                <Button
                    type="button"
                    variant="outline"
                    onClick={addShoe}
                    className="w-full border-red-500 text-red-500 hover:bg-red-50 border flex items-center justify-center gap-1.5 h-10 font-black text-xs uppercase tracking-widest transition-all"
                >
                    <Plus size={16} className="stroke-[3]" />
                    Add Another Shoe Item
                </Button>
            </div >

            {/* Order Summary Section */}
            < Card className="border-red-100/50 shadow-sm bg-white overflow-hidden" >
                <CardHeader className={`${CARD_HEADER_STYLE} !py-2`}>
                    <div className="flex items-center justify-between w-full translate-y-[1px]">
                        <div className="flex items-center gap-3">
                            <ClipboardList className="text-red-600" size={18} />
                            <CardTitle className={`${CARD_TITLE_STYLE} text-slate-900`}>ORDER SUMMARY</CardTitle>
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
                                const isPartial = paymentStatus === 'partial';
                                const isPaid = paymentStatus === 'paid';
                                const showAmountRec = isPartial || isPaid;

                                // Calculations
                                const received = parseFloat(amountReceived.replace(/,/g, '')) || 0;
                                const deposit = parseFloat(depositAmount.replace(/,/g, '')) || 0;
                                const total = grandTotal;

                                // Display Logic
                                let resultLabel = 'TOTAL DUE';
                                let resultValue = total;
                                let resultColor = 'text-gray-900 bg-white border border-gray-100 shadow-sm';

                                if (isPartial) {
                                    resultLabel = 'REMAINING BALANCE';
                                    resultValue = Math.max(0, total - deposit);
                                    resultColor = resultValue > 0 ? 'text-red-500 bg-white border border-red-100 shadow-sm' : 'text-green-600 bg-white border border-green-100 shadow-sm';
                                } else if (isPaid) {
                                    resultLabel = 'AMOUNT CHANGE';
                                    resultValue = Math.max(0, received - total);
                                    resultColor = 'text-green-600 bg-white border border-green-100 shadow-sm';
                                }

                                return (
                                    <div className="bg-[#F8F9FA]/50 p-4 rounded-xl border border-red-50/50 space-y-3 shadow-sm h-full flex flex-col justify-center">
                                        <div className="grid grid-cols-12 gap-2">
                                            {/* Row 1: Order Date, Order Time, Release Date & Release Time */}
                                            <div className="space-y-1 col-span-3">
                                                <Label className={LABEL_STYLE}>Order Date</Label>
                                                <div className="flex items-center bg-white h-9 rounded-lg px-3 text-xs text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <Calendar size={14} className="mr-2 text-gray-400 shrink-0" />
                                                    <span>{new Date().toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-3">
                                                <Label className={LABEL_STYLE}>Order Time</Label>
                                                <Input
                                                    type="time"
                                                    value={orderTime}
                                                    onChange={(e) => setOrderTime(e.target.value)}
                                                    className="bg-white border-gray-100/50 h-9 rounded-lg text-xs text-gray-900 shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-3">
                                                <Label className={LABEL_STYLE}>Release Date</Label>
                                                <div className="flex items-center bg-white h-9 rounded-lg px-3 text-xs text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <Calendar size={14} className="mr-2 text-gray-400 shrink-0" />
                                                    <span>{(() => {
                                                        const daysToAdd = calculatePredictedDays();
                                                        return new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toLocaleDateString();
                                                    })()}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-3">
                                                <Label className={LABEL_STYLE}>Release Time</Label>
                                                <Input
                                                    type="time"
                                                    value={releaseTime}
                                                    onChange={(e) => setReleaseTime(e.target.value)}
                                                    placeholder="--:--"
                                                    className="bg-white border-gray-100/50 h-9 rounded-lg text-xs text-gray-900 shadow-sm"
                                                />
                                            </div>

                                            {/* Row 2: Order ID, Processed By & Payment Status */}
                                            <div className="space-y-1 col-span-4">
                                                <Label className={LABEL_STYLE}>Order ID</Label>
                                                <div className="flex items-center bg-white h-9 rounded-lg px-3 text-[11px] text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <Hash size={14} className="mr-2 text-gray-400" />
                                                    <span className="whitespace-nowrap">{generatedOrderNumber || 'Generating...'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-4">
                                                <Label className={LABEL_STYLE}>Processed By</Label>
                                                <div className="flex items-center bg-white h-9 rounded-lg px-3 text-xs text-gray-900 border border-gray-100/50 shadow-sm">
                                                    <User size={14} className="mr-2 text-gray-400" />
                                                    {user?.username || 'Current User'}
                                                </div>
                                            </div>
                                            <div className="space-y-1 col-span-4">
                                                <Label className={LABEL_STYLE}>Payment Status</Label>
                                                <div className="relative group/select">
                                                    <Select value={paymentStatus} onValueChange={(value: PaymentStatus) => setPaymentStatus(value)}>
                                                        <SelectTrigger className="bg-white border-gray-100/50 h-9 rounded-lg text-xs text-gray-900 shadow-sm pr-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="unpaid">Unpaid</SelectItem>
                                                            <SelectItem value="partial">Partial</SelectItem>
                                                            <SelectItem value="paid">Paid</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {paymentStatus !== 'unpaid' && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPaymentStatus('unpaid');
                                                            }}
                                                            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover/select:opacity-100"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-6 gap-2 pt-0">
                                            {/* Row 3: Payment Method & Reference Number */}
                                            {paymentStatus !== 'unpaid' && (
                                                <>
                                                    <div className={`space-y-1 ${paymentMethod === 'cash' ? 'col-span-6' : 'col-span-3'}`}>
                                                        <Label className={LABEL_STYLE}>Payment Method</Label>
                                                        <div className="relative group/select">
                                                            <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
                                                                <SelectTrigger className="bg-white border-gray-100/50 h-9 rounded-lg text-xs shadow-sm pr-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="cash">Cash</SelectItem>
                                                                    <SelectItem value="gcash">GCash</SelectItem>
                                                                    <SelectItem value="maya">Maya</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            {paymentMethod && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPaymentMethod('cash'); // Reset to default cash
                                                                    }}
                                                                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover/select:opacity-100"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {['gcash', 'maya'].includes(paymentMethod) && (paymentStatus === 'paid' || paymentStatus === 'partial') && (
                                                        <div className="space-y-1 col-span-3">
                                                            <Label htmlFor="refNo" className={LABEL_STYLE}>Reference Number</Label>
                                                            <ClearableInput
                                                                id="refNo"
                                                                value={referenceNo}
                                                                onChange={(e: any) => setReferenceNo(formatReferenceNo(e.target.value))}
                                                                placeholder="XXXX-XXXX-XXXX"
                                                                className="bg-white border-gray-100/50 h-9 rounded-lg text-xs shadow-sm"
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Row 4: Amount Received & Result Field */}
                                            {showAmountRec && (
                                                <>
                                                    <div className="space-y-1 col-span-3">
                                                        <Label htmlFor="amountRec" className={LABEL_STYLE}>Amount Received</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                            <Input
                                                                id="amountRec"
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={amountReceived}
                                                                onChange={(e: any) => {
                                                                    const val = e.target.value.replace(/\D/g, '');
                                                                    setAmountReceived(val ? parseInt(val).toLocaleString() : '');
                                                                }}
                                                                placeholder="0.00"
                                                                className="bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black text-gray-700 shadow-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1 col-span-3">
                                                        {isPartial ? (
                                                            <>
                                                                <Label htmlFor="depositAmt" className={LABEL_STYLE}>Deposit Amount</Label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                                    <Input
                                                                        id="depositAmt"
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={depositAmount}
                                                                        onChange={(e: any) => {
                                                                            const val = e.target.value.replace(/\D/g, '');
                                                                            setDepositAmount(val ? parseInt(val).toLocaleString() : '');
                                                                        }}
                                                                        placeholder="0.00"
                                                                        className="bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black text-gray-700 shadow-sm"
                                                                    />
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Label className={LABEL_STYLE}>{resultLabel}</Label>
                                                                <div className={`h-10 flex items-center px-4 rounded-xl font-black text-xs ${resultColor}`}>
                                                                    {formatPeso(resultValue)}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Row 5: Amount Change & Remaining Balance (Partial Only) */}
                                            {isPartial && (
                                                <>
                                                    <div className="space-y-1 col-span-3">
                                                        <Label className={LABEL_STYLE}>Amount Change</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                            <Input
                                                                title="Amount Change"
                                                                readOnly
                                                                value={Math.max(0, received - deposit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                className={`bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black shadow-sm ${received - deposit >= 0 ? 'text-green-600' : 'text-red-500'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 col-span-3">
                                                        <Label className={LABEL_STYLE}>Remaining Balance</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                                            <Input
                                                                title="Remaining Balance"
                                                                readOnly
                                                                value={Math.max(0, total - deposit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                className="bg-white border-gray-100/50 h-10 rounded-xl text-xs pl-7 font-black text-red-500 shadow-sm"
                                                            />
                                                        </div>
                                                    </div>
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
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-gray-500 font-medium">Total Quantity</span>
                                        <span className="font-bold text-gray-800">{shoes.reduce((sum, s) => sum + s.quantity, 0)} Units</span>
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
                    <div className="flex items-center gap-4 pt-5 mt-2 border-t border-gray-100">
                        <Button
                            type="button"
                            className="flex-1 bg-gray-200 hover:bg-gray-700 text-gray-600 hover:text-white font-black text-xs uppercase tracking-widest h-10 transition-all rounded-lg shadow-sm"
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest h-10 shadow-lg shadow-red-200 transition-all rounded-lg"
                        >
                            Submit
                        </Button>
                    </div>
                </CardContent>
            </Card>


        </form>
    );
}

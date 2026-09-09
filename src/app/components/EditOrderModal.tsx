import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import type { JobOrder, ShoeEntry } from '@/app/types';
import { useServices } from '../context/ServiceContext';
import { useOrderCalculations } from '../hooks/useOrderCalculations';
import { CreatableCombobox } from './ui/creatable-combobox';
import { isAddonVisibleForBaseServices, applyColorCountExclusive, syncColorRenewalAddons, isColorCountAddon } from '@/app/lib/serviceCompatibility';

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
    'Air Force 1': 'Leather',
    'Dunk Low': 'Leather',
    'Air Max 90': 'Mesh',
    'Air Max 97': 'Mesh',
    'Cortez': 'Leather',
    'Blazer': 'Leather',
    'Air Jordan 1': 'Leather',
    'Air Jordan 3': 'Leather',
    'Air Jordan 4': 'Leather',
    'Air Jordan 11': 'Patent Leather',
    'Superstar': 'Leather',
    'Stan Smith': 'Leather',
    'Samba': 'Leather',
    'Ultraboost': 'Knit',
    'Yeezy Boost 350': 'Knit',
    'Gazelle': 'Suede',
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

interface EditOrderModalProps {
    order: JobOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave?: (id: string, updates: Partial<JobOrder>) => void;
    user?: { username: string; role: 'owner' | 'staff' | 'admin' };
}

const SECTION_TITLE = "text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2";
const INPUT_STYLE = "bg-white border-gray-100 h-9 text-xs focus:ring-red-50 focus:border-red-100 transition-all shadow-sm rounded-xl";
const LABEL_STYLE = "text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1 block";

export default function EditOrderModal({ order, open, onOpenChange, onSave }: EditOrderModalProps) {
    const { services } = useServices();

    const [status, setStatus] = useState(order?.status || 'new-order');
    const [customerName, setCustomerName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [shippingPreference, setShippingPreference] = useState('pickup');
    const [paymentStatus, setPaymentStatus] = useState('pending');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountReceived, setAmountReceived] = useState('0');
    const [referenceNo, setReferenceNo] = useState('');
    const [priorityLevel, setPriorityLevel] = useState(order?.priorityLevel || 'regular');
    
    // Delivery address fields
    const [deliveryAddress, setDeliveryAddress] = useState(order?.deliveryAddress || '');
    const [province, setProvince] = useState(order?.province || '');
    const [city, setCity] = useState(order?.city || '');
    const [barangay, setBarangay] = useState(order?.barangay || '');
    const [zipCode, setZipCode] = useState(order?.zipCode || '');
    
    // Internal state for shoes
    const [shoes, setShoes] = useState<ShoeEntry[]>([]);
    
    // State for collapsible cards
    const [expandedShoeId, setExpandedShoeId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (order && open) {
            setStatus(order.status);
            setCustomerName(order.customerName);
            setContactNumber(order.contactNumber);
            setShippingPreference(order.shippingPreference);
            setPaymentStatus(order.paymentStatus || 'pending');
            setPaymentMethod(order.paymentMethod || 'cash');
            setAmountReceived((order.amountReceived || 0).toFixed(2));
            setReferenceNo(order.referenceNo || '');
            setPriorityLevel(order.priorityLevel || 'regular');
            
            setDeliveryAddress(order.deliveryAddress || '');
            setProvince(order.province || '');
            setCity(order.city || '');
            setBarangay(order.barangay || '');
            setZipCode(order.zipCode || '');
            
            if (order.items && order.items.length > 0) {
                const mappedShoes: ShoeEntry[] = order.items.map((item, idx) => ({
                    id: parseInt(item.id.split('-').pop() || String(idx), 10) || Date.now() + idx,
                    brand: item.brand,
                    shoeModel: item.shoeModel,
                    shoeMaterial: item.shoeMaterial,
                    shoeSize: item.shoeSize || '',
                    color: Array.isArray(item.color) ? item.color.join(', ') : (item.color || ''),
                    quantity: item.quantity,
                    condition: item.condition || {
                        scratches: false,
                        ripsHoles: false,
                        wornOut: false,
                        soleSeparation: false,
                        yellowing: false,
                        deepStains: false,
                        others: ''
                    },
                    baseService: item.baseService || [],
                    addOns: item.addOns || [],
                    historicalBasePrices: item.historicalBasePrices || [],
                    historicalAddOnPrices: item.historicalAddOnPrices || [],
                    inventoryUsed: [],
                    description: '',
                    shoeName: `${item.brand} ${item.shoeModel}`
                }));
                setShoes(mappedShoes);
                if (mappedShoes.length > 0) {
                    setExpandedShoeId(mappedShoes[0].id.toString());
                }
            } else if (order.brand && order.baseService) {
                setShoes([{
                    id: Date.now(),
                    brand: order.brand,
                    shoeModel: order.shoeModel,
                    shoeMaterial: order.shoeMaterial,
                    shoeSize: order.shoeSize || '',
                    color: order.color || '',
                    quantity: order.quantity || 1,
                    condition: order.condition || {
                        scratches: false,
                        ripsHoles: false,
                        wornOut: false,
                        soleSeparation: false,
                        yellowing: false,
                        deepStains: false,
                        others: ''
                    },
                    baseService: order.baseService || [],
                    addOns: order.addOns || [],
                    historicalBasePrices: order.historicalBasePrices || [],
                    historicalAddOnPrices: order.historicalAddOnPrices || [],
                    inventoryUsed: [],
                    description: '',
                    shoeName: `${order.brand} ${order.shoeModel}`
                }]);
                setExpandedShoeId(Date.now().toString());
            }
        }
    }, [order, open]);

    const calculations = useOrderCalculations({
        shoes,
        services,
        priorityLevel: priorityLevel as any,
        amountReceived,
        paymentStatus,
        basicCleaningRushReduction: order?.rushReductionDays || 9
    });

    const formatPeso = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const formatDate = (date: any) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    const formatContactNumber = (value: string) => {
        const digitsOnly = value.replace(/\D/g, '').slice(0, 11);
        let formatted = '';
        for (let i = 0; i < digitsOnly.length; i++) {
            formatted += digitsOnly[i];
            if ((i === 3 || i === 6) && i !== digitsOnly.length - 1) {
                formatted += '-';
            }
        }
        return formatted;
    };
    
    const formatReferenceNo = (value: string) => {
        const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (paymentMethod === 'gcash') {
            if (clean.length > 13) return clean.slice(0, 13).replace(/(.{4})(.{3})(.{3})(.{3})/, '$1-$2-$3-$4');
            const match = clean.match(/^(.{0,4})(.{0,3})(.{0,3})(.{0,3})$/);
            if (match) {
                return [match[1], match[2], match[3], match[4]].filter(Boolean).join('-');
            }
        } else if (paymentMethod === 'maya') {
            if (clean.length > 12) return clean.slice(0, 12).replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3');
            const match = clean.match(/^(.{0,4})(.{0,4})(.{0,4})$/);
            if (match) {
                return [match[1], match[2], match[3]].filter(Boolean).join('-');
            }
        }
        return value;
    };

    const handleSave = async () => {
        if (!onSave || !order || isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            const finalName = customerName.trim();
            if (!finalName) {
                toast.error('Customer name is required');
                setIsSubmitting(false);
                return;
            }
            
            if (['gcash', 'maya'].includes(paymentMethod) && !referenceNo) {
                toast.error('Reference number is required for e-payments');
                setIsSubmitting(false);
                return;
            }

            const hasMissingShoeDetails = shoes.some((shoe) => {
                const size = (shoe.shoeSize || '').trim();
                const color = Array.isArray(shoe.color)
                    ? shoe.color.filter(Boolean).join(', ').trim()
                    : String(shoe.color || '').trim();
                return !size || !color;
            });
            if (hasMissingShoeDetails) {
                toast.error('Size and Color must be filled out for every item.');
                setIsSubmitting(false);
                return;
            }

            const updates: Partial<JobOrder> = {
            customerName: finalName,
            contactNumber: contactNumber.trim(),
            shippingPreference: shippingPreference as any,
            deliveryAddress: shippingPreference === 'delivery' ? deliveryAddress : undefined,
            province: shippingPreference === 'delivery' ? province : undefined,
            city: shippingPreference === 'delivery' ? city : undefined,
            barangay: shippingPreference === 'delivery' ? barangay : undefined,
            zipCode: shippingPreference === 'delivery' ? zipCode : undefined,
            paymentStatus: paymentStatus as any,
            paymentMethod: paymentMethod as any,
            amountReceived: parseFloat(amountReceived) || 0,
            referenceNo: ['gcash', 'maya'].includes(paymentMethod) ? referenceNo : undefined,
            priorityLevel: priorityLevel as any,
            
            items: shoes.map(shoe => {
                const historicalBasePrices = (shoe.baseService || []).map(serviceName => {
                    const existing = shoe.historicalBasePrices?.find(h => h.name === serviceName);
                    if (existing) return existing;
                    const service = calculations.baseServices.find(s => s.name === serviceName);
                    return { name: serviceName, price: service ? service.price : 0 };
                });

                const historicalAddOnPrices = (shoe.addOns || []).map((addon: any) => {
                    const addonName = typeof addon === 'string' ? addon : addon.name;
                    const existing = shoe.historicalAddOnPrices?.find(h => h.name === addonName);
                    if (existing) return existing;
                    const service = calculations.addOnServices.find(s => s.name === addonName);
                    return { name: addonName, price: service ? service.price : 0 };
                });

                return {
                    // P1-8 FIX: this previously sent a composite "${order.id}-${shoe.id}"
                    // string (e.g. "105-42"). The backend's PUT /api/orders/{id} item-update
                    // loop only applies per-item field changes when `str(id).isdigit()` is
                    // true (see backend/main.py update_order()) so it can look the row up by
                    // its real numeric Item.item_id — a composite id with a dash always
                    // failed that check, silently no-op'ing EVERY shoe's edits (brand, model,
                    // material, color, size, quantity, inventoryUsed), not just one. `shoe.id`
                    // is already the correct plain numeric backend item_id for existing items
                    // (restored via parseInt(...) when this modal loaded the order below), so
                    // send it as-is instead of re-wrapping it in a composite string.
                    id: String(shoe.id),
                    brand: shoe.brand || '',
                    shoeModel: shoe.shoeModel || '',
                    shoeMaterial: shoe.shoeMaterial || '',
                    shoeSize: (shoe.shoeSize || '').trim(),
                    color: Array.isArray(shoe.color)
                        ? shoe.color.filter(Boolean).join(', ')
                        : (shoe.color || ''),
                    quantity: shoe.quantity || 1,
                    condition: shoe.condition,
                    baseService: shoe.baseService,
                    addOns: shoe.addOns,
                    historicalBasePrices,
                    historicalAddOnPrices
                };
            }),
            
            baseServiceFee: calculations.totals.baseTotal,
            addOnsTotal: calculations.totals.addOnsTotal,
            grandTotal: calculations.totals.grandTotal,
            balance: calculations.totals.remainingBalance,
            change: calculations.totals.change
        };
        
        if (updates.items && updates.items.length > 0) {
            updates.brand = updates.items[0].brand;
            updates.shoeModel = updates.items[0].shoeModel;
            updates.shoeMaterial = updates.items[0].shoeMaterial;
            updates.shoeSize = updates.items[0].shoeSize;
            updates.color = updates.items[0].color;
            updates.baseService = updates.items[0].baseService;
            updates.addOns = updates.items[0].addOns;
            updates.historicalBasePrices = updates.items[0].historicalBasePrices;
            updates.historicalAddOnPrices = updates.items[0].historicalAddOnPrices;
            updates.quantity = shoes.reduce((acc, s) => acc + (s.quantity || 1), 0);
        }

        await onSave(order.id, updates);
        toast.success('Order details updated');
        onOpenChange(false);
    } catch (error) {
        console.error('Error updating order:', error);
        toast.error('An error occurred while updating the order.');
    } finally {
        setIsSubmitting(false);
    }
};

    const updateShoe = (shoeId: number | string, updates: Partial<ShoeEntry>) => {
        setShoes(shoes.map(s => s.id === shoeId ? { ...s, ...updates } : s));
    };

    const removeShoe = (shoeId: number | string) => {
        if (shoes.length > 1) {
            setShoes(shoes.filter(s => s.id !== shoeId));
        } else {
            toast.error("An order must have at least one shoe.");
        }
    };
    
    const addShoe = () => {
        const newId = Date.now();
        setShoes([...shoes, {
            id: newId,
            shoeName: '',
            brand: '',
            shoeModel: '',
            shoeMaterial: '',
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
                others: ''
            },
            baseService: [],
            addOns: [],
            inventoryUsed: [],
            description: ''
        }]);
        setExpandedShoeId(newId.toString());
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[#F8F9FA] p-0 gap-0 rounded-2xl border-none shadow-2xl">
                
                {/* Header (Sticky) */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-red-600 uppercase tracking-tight">Edit Order Detail</h2>
                        <div className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all flex items-center gap-1.5 border border-slate-200 group cursor-default">
                          <span>{order.orderNumber}</span>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="h-8 w-8 text-gray-400 border border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-100 rounded-full transition-colors flex items-center justify-center flex-shrink-0"
                    >
                        <X size={16} />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Top Row: Meta */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-50">
                        <div>
                            <Label className={LABEL_STYLE}>Order Status</Label>
                            <div className="h-9 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-50/50 border border-gray-100 cursor-not-allowed flex items-center capitalize">
                                {status.replace('-', ' ')}
                            </div>
                        </div>
                        <div>
                            <Label className={LABEL_STYLE}>Processed By</Label>
                            <div className="h-9 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-50/50 border border-gray-100 flex items-center">
                                {order.processedBy || 'Owner'}
                            </div>
                        </div>
                        <div>
                            <Label className={LABEL_STYLE}>Order Date</Label>
                            <div className="h-9 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-100 flex items-center">
                                {formatDate(order.transactionDate)}
                            </div>
                        </div>
                        <div>
                            <Label className={LABEL_STYLE}>Estimated Date</Label>
                            <div className="h-9 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-100 flex items-center">
                                {formatDate(order.predictedCompletionDate)}
                            </div>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-50">
                        <h3 className={SECTION_TITLE}><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Customer Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className={LABEL_STYLE}>Customer Name</Label>
                                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={INPUT_STYLE} />
                            </div>
                            <div>
                                <Label className={LABEL_STYLE}>Contact Number</Label>
                                <Input 
                                    value={contactNumber} 
                                    onChange={(e) => setContactNumber(formatContactNumber(e.target.value))} 
                                    className={INPUT_STYLE} 
                                    placeholder="09xx-xxx-xxxx"
                                />
                            </div>
                            <div>
                                <Label className={LABEL_STYLE}>Shipping Preference</Label>
                                <Select value={shippingPreference} onValueChange={setShippingPreference}>
                                    <SelectTrigger className={INPUT_STYLE}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pickup">Pickup</SelectItem>
                                        <SelectItem value="delivery">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        {shippingPreference === 'delivery' && (
                            <div className="mt-4 pt-4 border-t border-gray-50 space-y-4">
                                <div>
                                    <Label className={LABEL_STYLE}>Delivery Address (House/Street)</Label>
                                    <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={INPUT_STYLE} placeholder="House No., Street, Building" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <Label className={LABEL_STYLE}>Barangay</Label>
                                        <Input value={barangay} onChange={(e) => setBarangay(e.target.value)} className={INPUT_STYLE} />
                                    </div>
                                    <div>
                                        <Label className={LABEL_STYLE}>City/Municipality</Label>
                                        <Input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT_STYLE} />
                                    </div>
                                    <div>
                                        <Label className={LABEL_STYLE}>Province/Region</Label>
                                        <Input value={province} onChange={(e) => setProvince(e.target.value)} className={INPUT_STYLE} />
                                    </div>
                                    <div>
                                        <Label className={LABEL_STYLE}>Zip Code</Label>
                                        <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={INPUT_STYLE} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Shoe Items */}
                    <div>
                        <div className="space-y-3">
                            {shoes.map((shoe, index) => {
                                const isExpanded = expandedShoeId === shoe.id.toString() || shoes.length === 1;
                                
                                const allowedAddons = calculations.addOnServices.filter(addon => isAddonVisibleForBaseServices(addon.name, shoe.baseService || [])).sort((a, b) => {
                                    const baseServicesArr = shoe.baseService || [];
                                    const hasColorRenewal = baseServicesArr.some((s: string) => s.includes('Color Renewal'));
                                    const hasReglue = baseServicesArr.some((s: string) => s.toLowerCase().includes('reglue'));
                                    
                                    const getPriority = (addonName: string) => {
                                        if (hasColorRenewal && (addonName === '2 Colors' || addonName === '3 Colors')) return 2;
                                        if (hasReglue && (addonName.toLowerCase().includes('midsole') || addonName.toLowerCase().includes('undersole'))) return 1;
                                        return 0;
                                    };
                                    
                                    return getPriority(b.name) - getPriority(a.name);
                                }).map(a => a.name);
                                
                                return (
                                    <div key={shoe.id} className="bg-white rounded-xl shadow-sm border border-gray-50 overflow-hidden">
                                        {/* Header */}
                                        <div 
                                            className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors border-b border-gray-50"
                                            onClick={() => setExpandedShoeId(isExpanded && shoes.length > 1 ? null : shoe.id.toString())}
                                        >
                                            <div className="flex items-center gap-3">
                                                {shoes.length > 1 && (isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
                                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Shoe {index + 1} Details
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {shoes.length > 1 && (
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={(e) => { e.stopPropagation(); removeShoe(shoe.id); }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Body */}
                                        {isExpanded && (
                                            <div className="p-4 space-y-6">
                                                {/* Identification */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <Label className={LABEL_STYLE}>Brand</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_BRANDS}
                                                            value={shoe.brand || ''}
                                                            onChange={(val) => updateShoe(shoe.id, { brand: val })}
                                                            placeholder="Select brand"
                                                            searchPlaceholder="Search brand..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className={LABEL_STYLE}>Model</Label>
                                                        <CreatableCombobox
                                                            options={shoe.brand ? (BRAND_MODELS[shoe.brand] || ['Other']) : ALL_MODELS}
                                                            value={shoe.shoeModel || ''}
                                                            onChange={(val) => {
                                                                if (!shoe.brand && MODEL_TO_BRAND[val]) {
                                                                    updateShoe(shoe.id, { brand: MODEL_TO_BRAND[val], shoeModel: val, shoeMaterial: MODEL_MATERIALS[val] || shoe.shoeMaterial });
                                                                    return;
                                                                }
                                                                updateShoe(shoe.id, { shoeModel: val, shoeMaterial: MODEL_MATERIALS[val] || shoe.shoeMaterial });
                                                            }}
                                                            placeholder="Select model"
                                                            searchPlaceholder="Search model..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className={LABEL_STYLE}>Material</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_MATERIALS}
                                                            value={shoe.shoeMaterial || ''}
                                                            onChange={(val) => updateShoe(shoe.id, { shoeMaterial: val })}
                                                            placeholder="Select material"
                                                            searchPlaceholder="Search material..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className={LABEL_STYLE}>Size</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_SIZES}
                                                            value={shoe.shoeSize || ''}
                                                            onChange={(val) => updateShoe(shoe.id, { shoeSize: val })}
                                                            placeholder="Select size"
                                                            searchPlaceholder="Search size..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className={LABEL_STYLE}>Color</Label>
                                                        <CreatableCombobox
                                                            options={SHOE_COLORS}
                                                            value={Array.isArray(shoe.color) ? shoe.color.filter(Boolean).join(', ') : (shoe.color || '')}
                                                            onChange={(val) => updateShoe(shoe.id, { color: val })}
                                                            placeholder="Select color"
                                                            searchPlaceholder="Search color..."
                                                            multiple={true}
                                                        />
                                                    </div>
                                                    {(shoe.baseService || []).includes('Basic Cleaning') && (
                                                        <div>
                                                            <Label className={LABEL_STYLE}>Priority</Label>
                                                            <Select value={priorityLevel} onValueChange={(val: any) => setPriorityLevel(val)}>
                                                                <SelectTrigger className={INPUT_STYLE}>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="regular">Regular</SelectItem>
                                                                    <SelectItem value="rush">Rush</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Condition */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Label className={LABEL_STYLE + " !mb-0"}>Shoe Condition</Label>
                                                    </div>
                                                    <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-3">
                                                        <div className="flex flex-wrap gap-3">
                                                            {[
                                                                { id: 'scratches', label: 'Scratches' },
                                                                { id: 'yellowing', label: 'Yellowing' },
                                                                { id: 'ripsHoles', label: 'Rips/Holes' },
                                                                { id: 'deepStains', label: 'Deep Stains' },
                                                                { id: 'soleSeparation', label: 'Sole Separation' },
                                                                { id: 'wornOut', label: 'Faded/Worn' },
                                                            ].map((cond) => (
                                                                <label key={cond.id} className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${shoe.condition[cond.id as keyof typeof shoe.condition] ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                                                    <Checkbox
                                                                        checked={shoe.condition[cond.id as keyof typeof shoe.condition] as boolean}
                                                                        onCheckedChange={(checked) =>
                                                                            updateShoe(shoe.id, {
                                                                                condition: { ...shoe.condition, [cond.id]: checked as boolean }
                                                                            })
                                                                        }
                                                                        className="h-3 w-3"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-gray-600">{cond.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <div className="mt-3">
                                                            <Label className={`${LABEL_STYLE} mb-1`}>Notes:</Label>
                                                            <Textarea
                                                                placeholder="Other conditions..."
                                                                value={shoe.condition.others}
                                                                onChange={(e) =>
                                                                    updateShoe(shoe.id, {
                                                                        condition: { ...shoe.condition, others: e.target.value }
                                                                    })
                                                                }
                                                                className="text-xs bg-white border-gray-100 rounded-xl resize-none min-h-[40px]"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Services section inside shoe */}
                                                <div className="border-t border-gray-100 pt-4">
                                                    <h3 className={SECTION_TITLE}><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Services</h3>
                                                    <div className="mb-4">
                                                        <Label className={LABEL_STYLE}>Primary Service</Label>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                            {calculations.baseServices.map(s => {
                                                                const isSelected = shoe.baseService?.includes(s.name);
                                                                return (
                                                                    <label 
                                                                        key={s.name} 
                                                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-red-500 bg-white shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'}`}
                                                                    >
                                                                        <Checkbox
                                                                            checked={isSelected}
                                                                            onCheckedChange={(checked) => {
                                                                                let newServices = [...(shoe.baseService || [])];
                                                                                if (checked) {
                                                                                    newServices.push(s.name);
                                                                                    if (s.name === 'Minor Reglue') {
                                                                                        newServices = newServices.filter((srv: string) => srv !== 'Full Reglue');
                                                                                    }
                                                                                    if (s.name === 'Full Reglue') {
                                                                                        newServices = newServices.filter((srv: string) => srv !== 'Minor Reglue');
                                                                                    }
                                                                                } else {
                                                                                    newServices = newServices.filter((srv: string) => srv !== s.name);
                                                                                }
                                                                                
                                                                                const newAllowedAddons = calculations.addOnServices.filter(addon => isAddonVisibleForBaseServices(addon.name, newServices)).map(a => a.name);
                                                                                
                                                                                let newAddons = [...(shoe.addOns || [])].filter((a: any) => newAllowedAddons.includes(a.name));
                                                                                newAddons = syncColorRenewalAddons(newAddons, newServices);
                                                                                
                                                                                updateShoe(shoe.id, { baseService: newServices, addOns: newAddons });
                                                                            }}
                                                                            className="mt-0.5"
                                                                        />
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="text-[11px] font-bold text-gray-700 leading-tight">{s.name}</span>
                                                                            <span className="text-[10px] font-black text-gray-400">₱{s.price}</span>
                                                                        </div>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {shoe.baseService && shoe.baseService.length > 0 && allowedAddons.length > 0 && (
                                                        <div>
                                                            <Label className={LABEL_STYLE}>Add-ons</Label>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                                {allowedAddons.map(addonName => {
                                                                    const addonData = calculations.addOnServices.find(a => a.name === addonName);
                                                                    if (!addonData) return null;
                                                                    const isSelected = shoe.addOns?.some((a: any) => a.name === addonName);
                                                                    
                                                                    return (
                                                                        <label 
                                                                            key={addonName} 
                                                                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-red-500 bg-white shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-gray-50/30'}`}
                                                                        >
                                                                            <Checkbox
                                                                                checked={isSelected}
                                                                                onCheckedChange={(checked) => {
                                                                                    let newAddons = [...(shoe.addOns || [])];
                                                                                    if (isColorCountAddon(addonName)) {
                                                                                        newAddons = applyColorCountExclusive(
                                                                                            newAddons,
                                                                                            addonName,
                                                                                            Boolean(checked),
                                                                                            shoe.baseService || [],
                                                                                        );
                                                                                    } else if (checked) {
                                                                                        newAddons.push({ name: addonName, quantity: 1 });
                                                                                    } else {
                                                                                        newAddons = newAddons.filter((a: any) => a.name !== addonName);
                                                                                    }
                                                                                    updateShoe(shoe.id, { addOns: newAddons });
                                                                                }}
                                                                                className="mt-0.5"
                                                                            />
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="text-[11px] font-bold text-gray-700 leading-tight">{addonName}</span>
                                                                                <span className="text-[10px] font-black text-gray-400">₱{addonData.price}</span>
                                                                            </div>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={addShoe}
                                className="w-full h-10 border-dashed border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors bg-transparent rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                            >
                                <Plus className="w-3.5 h-3.5 mr-2" /> Add Another Shoe
                            </Button>
                        </div>
                    </div>

                    {/* Payment & Summary */}
                    <div className="space-y-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-50 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col justify-end h-full">
                                    <Label className={`${LABEL_STYLE} mb-1`}>Payment Status</Label>
                                    <Select 
                                        value={paymentStatus} 
                                        onValueChange={(value) => {
                                            setPaymentStatus(value);
                                            if (value === 'downpayment') {
                                                setAmountReceived((calculations.totals.grandTotal / 2).toFixed(2));
                                            } else if (value === 'fully-paid') {
                                                setAmountReceived(calculations.totals.grandTotal.toFixed(2));
                                            }
                                        }}
                                    >
                                        <SelectTrigger className={INPUT_STYLE}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fully-paid">Fully Paid</SelectItem>
                                            <SelectItem value="downpayment">Downpayment</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col justify-end h-full">
                                    <Label className={`${LABEL_STYLE} mb-1`}>Payment Method</Label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger className={INPUT_STYLE}>
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
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex flex-col justify-end h-full">
                                        <Label className={`${LABEL_STYLE} mb-1`}>Reference Number</Label>
                                        <Input
                                            placeholder={paymentMethod === 'gcash' ? "0000-000-000-000" : "0000-0000-0000"}
                                            value={referenceNo}
                                            onChange={(e) => setReferenceNo(formatReferenceNo(e.target.value))}
                                            className={INPUT_STYLE}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col justify-end h-full">
                                    <Label className={`${LABEL_STYLE} mb-1`}>
                                        {paymentStatus === 'downpayment' ? 'Required Downpayment (50%)' : 'Total Due'}
                                    </Label>
                                    <div className="relative shrink-0">
                                        <span className={`absolute left-3 top-2.5 text-xs font-black ${paymentStatus === 'downpayment' ? 'text-gray-500' : 'text-gray-900'}`}>{'\u20B1'}</span>
                                        <Input
                                            readOnly
                                            type="text"
                                            className={`${INPUT_STYLE} !text-xs font-bold pl-6 ${paymentStatus === 'downpayment' ? 'bg-gray-100/50 text-gray-500 cursor-not-allowed border-gray-100/50' : 'bg-white text-gray-900 border-gray-100'}`}
                                            value={formatPeso(paymentStatus === 'downpayment' ? calculations.totals.grandTotal / 2 : calculations.totals.grandTotal).replace('₱', '')}
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex flex-col justify-end h-full">
                                    <Label className={`${LABEL_STYLE} mb-1`}>Amount Received</Label>
                                    <div className="relative shrink-0">
                                        <span className="absolute left-3 top-2.5 text-gray-900 text-xs font-black">{'\u20B1'}</span>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            className={`${INPUT_STYLE} !text-xs font-bold text-gray-900 pl-6 border-gray-100`}
                                            value={amountReceived}
                                            onChange={(e: any) => {
                                                let val = e.target.value.replace(/[^\d.]/g, '');
                                                const parts = val.split('.');
                                                if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                                                if (parts.length === 2 && parts[1].length > 2) val = parts[0] + '.' + parts[1].slice(0, 2);
                                                setAmountReceived(val);
                                            }}
                                            onFocus={(e: any) => {
                                                if (e.target.value === '0.00' || e.target.value === '0') {
                                                    setAmountReceived('');
                                                }
                                            }}
                                            onBlur={(e: any) => {
                                                if (e.target.value === '') {
                                                    setAmountReceived('0.00');
                                                } else {
                                                    const num = parseFloat(e.target.value);
                                                    if (!isNaN(num)) {
                                                        setAmountReceived(num.toFixed(2));
                                                    }
                                                }
                                            }}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                
                                <div className={`flex flex-col justify-end h-full ${paymentStatus !== 'downpayment' ? 'md:col-span-2' : ''}`}>
                                    <Label className={`${LABEL_STYLE} mb-1`}>Amount Change</Label>
                                    <div className="relative shrink-0">
                                        <span className="absolute left-3 top-2.5 text-xs font-black text-green-600">{'\u20B1'}</span>
                                        <Input
                                            readOnly
                                            type="text"
                                            className={`${INPUT_STYLE} !text-xs font-bold text-green-600 pl-6 bg-green-50/50 border-green-100 cursor-default`}
                                            value={formatPeso(calculations.totals.change).replace('₱', '')}
                                        />
                                    </div>
                                </div>
                                
                                {paymentStatus === 'downpayment' && (
                                    <div className="flex flex-col justify-end h-full">
                                        <Label className={`${LABEL_STYLE} mb-1`}>Remaining Balance</Label>
                                        <div className="relative shrink-0">
                                            <span className="absolute left-3 top-2.5 text-xs font-black text-red-500">{'\u20B1'}</span>
                                            <Input
                                                readOnly
                                                type="text"
                                                className={`${INPUT_STYLE} !text-xs font-bold text-red-500 pl-6 bg-red-50/50 border-red-100 cursor-default`}
                                                value={formatPeso(calculations.totals.remainingBalance).replace('₱', '')}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 border-t border-gray-100 pt-6 space-y-3">
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-gray-500 font-medium">Base Service Total</span>
                                <span className="font-bold text-gray-800">{formatPeso(calculations.totals.baseTotal)}</span>
                            </div>
                            {calculations.totals.rushFee > 0 && (
                                <div className="flex justify-between items-center text-[13px]">
                                    <span className="text-gray-500 font-medium">{shoes.length > 1 ? 'Rush Fee Total' : 'Rush Fee'}</span>
                                    <span className="font-bold text-gray-800">{formatPeso(calculations.totals.rushFee)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-gray-500 font-medium">Add-ons Subtotal</span>
                                <span className="font-bold text-gray-800">{formatPeso(calculations.totals.addOnsTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[13px] pt-2 border-t border-gray-100">
                                <span className="text-gray-500 font-medium">Total Quantity (Per Unit)</span>
                                <span className="font-bold text-gray-800">{shoes.reduce((sum, s) => sum + (s.quantity || 1), 0)} {shoes.reduce((sum, s) => sum + (s.quantity || 1), 0) === 1 ? 'Pair' : 'Pairs'}</span>
                            </div>
                            <div className="pt-3 mt-auto border-t border-solid border-gray-500 flex justify-between items-baseline">
                                <span className="text-sm font-black text-gray-700 uppercase tracking-tight">Grand Total</span>
                                <span className="text-2xl font-black text-red-600 leading-none">{formatPeso(calculations.totals.grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-gray-100 sticky bottom-0 z-10 w-full">
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <Button variant="outline" className="w-full h-11 rounded-xl font-black tracking-widest text-xs border-gray-300 text-gray-600 hover:bg-gray-50 uppercase shadow-sm" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button className="w-full h-11 rounded-xl bg-[#D3544E] hover:bg-[#b9443f] text-white font-black tracking-widest text-xs uppercase shadow-sm" onClick={handleSave}>
                            Save Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

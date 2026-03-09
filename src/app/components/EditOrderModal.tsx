
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { useServices } from '@/app/context/ServiceContext';
import type { JobOrder, JobStatus, PaymentStatus, PaymentMethod } from '@/app/types';

interface EditOrderModalProps {
    order: JobOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave?: (orderId: string, updates: Partial<JobOrder>) => void;
}

const SHOE_BRANDS = [
    'Nike', 'Adidas', 'Asics', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 'Jordan',
    'Under Armour', 'Timberland', 'Dr. Martens', 'Salomon', 'Merrell', 'Skechers', 'Mizuno',
    'Brooks', 'Saucony', 'Hoka', 'Other'
];

const SHOE_MATERIALS = [
    'Leather', 'Synthetic', 'Canvas', 'Mesh', 'Rubber', 'Textile', 'Suede', 'Knit', 'Patent Leather', 'Denim', 'Nubuck', 'Other'
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
    'Hoka': ['Clifton', 'Bondi', 'Speedgoat', 'Other']
};

const DEFAULT_MODELS = [
    'Sneakers', 'Running Shoes', 'Basketball', 'Leather Shoes', 'Boots', 'Sandals', 'Formal', 'Slip-on', 'Other'
];

const MODEL_MATERIALS: Record<string, string> = {
    'Air Force 1': 'Leather',
    'Dunk Low': 'Leather',
    'Air Jordan 1': 'Leather',
    'Superstar': 'Leather',
    'Stan Smith': 'Leather',
    'Samba': 'Leather',
    'Club C 85': 'Leather',
    'Classic Leather': 'Leather',
    '6-Inch Premium Boot': 'Nubuck',
    '1460 8-Eye Boot': 'Leather',
    '1461 3-Eye Shoe': 'Leather',
    'Chuck Taylor All Star': 'Canvas',
    'Chuck 70': 'Canvas',
    'Old Skool': 'Suede',
    'Slip-On': 'Canvas',
    'Authentic': 'Canvas'
};

const DELIVERY_COURIERS = [
    'Lalamove', 'JRS', 'LBC', 'Grab', 'Other'
];

export default function EditOrderModal({ order, open, onOpenChange, onSave }: EditOrderModalProps) {
    const [formData, setFormData] = useState<JobOrder | null>(null);

    useEffect(() => {
        if (order) {
            const initialCondition = (order.items && order.items[0]?.condition)
                ? { ...order.items[0].condition }
                : (order.condition || {
                    scratches: false,
                    ripsHoles: false,
                    wornOut: false,
                    soleSeparation: false,
                    yellowing: false,
                    deepStains: false,
                    others: ''
                });

            setFormData({
                ...order,
                condition: initialCondition,
                items: order.items || [],
                baseService: order.baseService || [],
                addOns: order.addOns || []
            });
        }
    }, [order]);

    if (!formData) return null;

    const { services } = useServices();
    const baseServices = services.filter(s => s.category === 'base' && s.active);
    const addOnServices = services.filter(s => s.category === 'addon' && s.active);

    const recalculateTotals = (data: JobOrder) => {
        let basePrice = 0;
        const baseServicesArr = Array.isArray(data.baseService) ? data.baseService : [];

        baseServicesArr.forEach(serviceName => {
            const baseServiceObj = baseServices.find(s => s.name === serviceName);
            if (baseServiceObj) basePrice += baseServiceObj.price * data.quantity;
        });

        let addonsPrice = 0;
        data.addOns.forEach(addon => {
            const addonObj = addOnServices.find(s => s.name === addon.name);
            if (addonObj) addonsPrice += addonObj.price * (addon.quantity || 1) * data.quantity;
        });

        let priorityFee = 0;
        if (data.priorityLevel === 'rush') {
            let maxFee = 0;
            if (baseServicesArr.includes('Basic Cleaning')) {
                maxFee = 150;
            }
            priorityFee = maxFee;
        } else if (data.priorityLevel === 'premium') {
            if (baseServicesArr.some(s => s.includes('Color Renewal'))) {
                priorityFee = 1000;
            }
        }

        const rushFeeTotal = priorityFee * data.quantity;
        const total = basePrice + addonsPrice + rushFeeTotal;

        return {
            baseServiceFee: basePrice,
            addOnsTotal: addonsPrice,
            grandTotal: total
        };
    };

    const updateFormData = (updates: any) => {
        if (!formData) return;
        const base = { ...formData, ...updates };

        let syncItems = [...(base.items || [])];
        const itemTemplate = {
            brand: base.brand,
            shoeMaterial: base.shoeMaterial,
            shoeModel: base.shoeModel,
            quantity: base.quantity,
            condition: base.condition,
            baseService: Array.isArray(base.baseService) ? base.baseService : [],
            addOns: base.addOns || []
        };

        if (syncItems.length === 0 && base.id) {
            syncItems = [{ id: `${Date.now()}-0`, ...itemTemplate }];
        } else if (syncItems.length > 0) {
            syncItems[0] = { ...syncItems[0], ...itemTemplate };
        }

        const totals = recalculateTotals({ ...base, items: syncItems });
        setFormData({ ...base, ...totals, items: syncItems });
    };

    const handleAddOnToggle = (addonName: string, checked: boolean) => {
        let newAddons = [...formData.addOns];
        if (checked) {
            if (!newAddons.some(a => a.name === addonName)) {
                newAddons.push({ name: addonName, quantity: 1 });
            }
        } else {
            newAddons = newAddons.filter(a => a.name !== addonName);
        }
        updateFormData({ addOns: newAddons });
    };

    const handleAddOnQuantityChange = (addonName: string, quantity: number) => {
        const newAddons = formData.addOns.map(a =>
            a.name === addonName ? { ...a, quantity } : a
        );
        const updated = { ...formData, addOns: newAddons };
        const totals = recalculateTotals(updated);
        setFormData({ ...updated, ...totals });
    };


    const INPUT_STYLE = "w-full bg-white border-gray-200 h-10 text-sm focus:ring-red-50 focus:border-red-100 transition-all shadow-sm rounded-xl px-3";
    const LABEL_STYLE = "text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wide";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white p-0 flex flex-col h-auto max-h-[90vh] rounded-2xl overflow-hidden border-none shadow-2xl">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col gap-2 flex-shrink-0">
                    <div className="flex flex-row items-center justify-center gap-3 w-full">
                        <DialogTitle className="text-xl font-bold text-gray-900 tracking-tight">
                            EDIT ORDER DETAIL
                        </DialogTitle>
                        <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap">
                            {formData.orderNumber}
                        </span>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-50/30 pb-10">
                    {/* Order Info Section */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label className={LABEL_STYLE}>Order Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(val: JobStatus) => updateFormData({
                                        status: val,
                                        actualCompletionDate: val === 'claimed' ? new Date() : undefined
                                    })}
                                >
                                    <SelectTrigger className={`h-10 border-gray-200 text-xs focus:ring-red-50 focus:border-red-100 font-bold px-3 rounded-xl transition-all
                                        ${formData.status === 'new-order' ? 'bg-purple-50 text-purple-700' :
                                            formData.status === 'on-going' ? 'bg-blue-50 text-blue-700' :
                                                formData.status === 'for-release' ? 'bg-orange-50 text-orange-700' :
                                                    'bg-gray-50 text-gray-700'}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new-order">New Order</SelectItem>
                                        <SelectItem value="on-going">On-Going</SelectItem>
                                        <SelectItem value="for-release">For Release</SelectItem>
                                        <SelectItem value="claimed">Claimed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className={LABEL_STYLE}>Priority Level</Label>
                                <Select
                                    value={formData.priorityLevel}
                                    onValueChange={(val: any) => updateFormData({ priorityLevel: val })}
                                >
                                    <SelectTrigger className={INPUT_STYLE}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="regular">Regular</SelectItem>
                                        {(Array.isArray(formData.baseService) ? formData.baseService : []).includes('Basic Cleaning') && (
                                            <SelectItem value="rush">Rush</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className={LABEL_STYLE}>Processed By</Label>
                                <p className="h-10 flex items-center px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700">
                                    {formData.processedBy || 'Current User'}
                                </p>
                            </div>
                            {['for-release', 'claimed'].includes(formData.status) && (
                                <div>
                                    <Label className={LABEL_STYLE}>Release Time</Label>
                                    <Input
                                        type="time"
                                        value={formData.releaseTime || ''}
                                        onChange={(e) => updateFormData({ releaseTime: e.target.value })}
                                        className={INPUT_STYLE}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Customer Section */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Customer Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 sm:col-span-1">
                                <Label className={LABEL_STYLE}>Customer Name</Label>
                                <Input
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    className={INPUT_STYLE}
                                />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <Label className={LABEL_STYLE}>Contact Number</Label>
                                <Input
                                    value={formData.contactNumber}
                                    onChange={(e) => updateFormData({ contactNumber: e.target.value })}
                                    className={INPUT_STYLE}
                                />
                            </div>
                            <div className="col-span-2">
                                <Label className={LABEL_STYLE}>Shipping Preference</Label>
                                <Select
                                    value={formData.shippingPreference}
                                    onValueChange={(val: any) => updateFormData({ shippingPreference: val })}
                                >
                                    <SelectTrigger className={INPUT_STYLE}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pickup">Pickup</SelectItem>
                                        <SelectItem value="delivery">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {formData.shippingPreference === 'delivery' && (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <Label className={LABEL_STYLE}>Delivery Address</Label>
                                    <Input
                                        value={formData.deliveryAddress || ''}
                                        onChange={(e) => updateFormData({ deliveryAddress: e.target.value })}
                                        className={INPUT_STYLE}
                                        placeholder="Enter full delivery address"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={formData.deliveryCourier === 'Other' ? 'col-span-1' : 'col-span-2'}>
                                        <Label className={LABEL_STYLE}>Courier</Label>
                                        <Select
                                            value={DELIVERY_COURIERS.includes(formData.deliveryCourier || '') ? formData.deliveryCourier : (formData.deliveryCourier ? 'Other' : undefined)}
                                            onValueChange={(val) => updateFormData({ deliveryCourier: val })}
                                        >
                                            <SelectTrigger className={INPUT_STYLE}><SelectValue placeholder="Select Courier" /></SelectTrigger>
                                            <SelectContent>
                                                {DELIVERY_COURIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {formData.deliveryCourier === 'Other' && (
                                        <div className="col-span-1">
                                            <Label className={LABEL_STYLE}>Specify Courier</Label>
                                            <Input
                                                value={formData.deliveryCourier === 'Other' ? '' : formData.deliveryCourier}
                                                onChange={(e) => updateFormData({ deliveryCourier: e.target.value })}
                                                className={INPUT_STYLE}
                                                placeholder="Courier name"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Shoe Details Section */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Shoe Details
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <Label className={LABEL_STYLE}>Brand</Label>
                                    <Select
                                        value={SHOE_BRANDS.includes(formData.brand || '') ? formData.brand : (formData.brand ? 'Other' : undefined)}
                                        onValueChange={(val) => updateFormData({ brand: val })}
                                    >
                                        <SelectTrigger className={INPUT_STYLE}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SHOE_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {(formData.brand === 'Other' || !SHOE_BRANDS.includes(formData.brand || '')) && (
                                        <Input
                                            className={`${INPUT_STYLE} mt-2`}
                                            placeholder="Specify brand..."
                                            value={SHOE_BRANDS.includes(formData.brand || '') ? '' : formData.brand}
                                            onChange={(e) => updateFormData({ brand: e.target.value })}
                                        />
                                    )}
                                </div>
                                <div>
                                    <Label className={LABEL_STYLE}>Model</Label>
                                    <Select
                                        value={(BRAND_MODELS[formData.brand || 'Other'] || DEFAULT_MODELS).includes(formData.shoeModel || '') ? formData.shoeModel : (formData.shoeModel ? 'Other' : undefined)}
                                        onValueChange={(val) => {
                                            const updates: Partial<JobOrder> = { shoeModel: val };
                                            if (MODEL_MATERIALS[val]) {
                                                updates.shoeMaterial = MODEL_MATERIALS[val];
                                            }
                                            updateFormData(updates);
                                        }}
                                    >
                                        <SelectTrigger className={INPUT_STYLE}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {(BRAND_MODELS[formData.brand || 'Other'] || DEFAULT_MODELS).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {(formData.shoeModel === 'Other' || !(BRAND_MODELS[formData.brand || 'Other'] || DEFAULT_MODELS).includes(formData.shoeModel || '')) && (
                                        <Input
                                            className={`${INPUT_STYLE} mt-2`}
                                            placeholder="Specify model..."
                                            value={(BRAND_MODELS[formData.brand || 'Other'] || DEFAULT_MODELS).includes(formData.shoeModel || '') ? '' : formData.shoeModel}
                                            onChange={(e) => updateFormData({ shoeModel: e.target.value })}
                                        />
                                    )}
                                </div>
                                <div>
                                    <Label className={LABEL_STYLE}>Material</Label>
                                    <Select
                                        value={SHOE_MATERIALS.includes(formData.shoeMaterial || '') ? formData.shoeMaterial : (formData.shoeMaterial ? 'Other' : undefined)}
                                        onValueChange={(val) => updateFormData({ shoeMaterial: val })}
                                    >
                                        <SelectTrigger className={INPUT_STYLE}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SHOE_MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {(formData.shoeMaterial === 'Other' || !SHOE_MATERIALS.includes(formData.shoeMaterial || '')) && (
                                        <Input
                                            className={`${INPUT_STYLE} mt-2`}
                                            placeholder="Specify material..."
                                            value={SHOE_MATERIALS.includes(formData.shoeMaterial || '') ? '' : formData.shoeMaterial}
                                            onChange={(e) => updateFormData({ shoeMaterial: e.target.value })}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <Label className={LABEL_STYLE}>Quantity</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={formData.quantity}
                                        onChange={(e) => updateFormData({ quantity: parseInt(e.target.value) || 1 })}
                                        className={INPUT_STYLE}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 font-medium">Selected: {formData.quantity || 1} {formData.quantity === 1 ? 'Pair' : 'Pairs'}</p>
                                </div>
                            </div>

                            <div>
                                <Label className={LABEL_STYLE}>Shoe Condition</Label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                    {[
                                        { key: 'scratches', label: 'Scratches' },
                                        { key: 'ripsHoles', label: 'Rips/ Holes' },
                                        { key: 'wornOut', label: 'Worn Out' },
                                        { key: 'soleSeparation', label: 'Sole Sep' },
                                        { key: 'yellowing', label: 'Yellowing' },
                                        { key: 'deepStains', label: 'Stains' }
                                    ].map((condition) => (
                                        <div
                                            key={condition.key}
                                            className={`flex items-center justify-center py-2 px-1 rounded-md border text-[10px] font-bold cursor-pointer transition-all text-center h-11 break-words leading-tight
                                                ${(formData.condition as any)[condition.key] ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                                            onClick={() => {
                                                const newCondition = { ...formData.condition, [condition.key]: !(formData.condition as any)[condition.key] };
                                                updateFormData({ condition: newCondition });
                                            }}
                                        >
                                            {condition.label}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <Input
                                        placeholder="Other conditions..."
                                        value={formData.condition.others}
                                        onChange={(e) => updateFormData({ condition: { ...formData.condition, others: e.target.value } })}
                                        className={INPUT_STYLE}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Services Section */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Services
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <Label className={LABEL_STYLE}>Primary Service</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                    {baseServices.map(s => {
                                        const isChecked = (Array.isArray(formData.baseService) ? formData.baseService : []).includes(s.name);
                                        return (
                                            <div key={s.id} className={`flex items-start space-x-2 bg-gray-50 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:bg-white'}`}
                                                onClick={() => {
                                                    const current = Array.isArray(formData.baseService) ? formData.baseService : [];
                                                    const next = isChecked ? current.filter(n => n !== s.name) : [...current, s.name];
                                                    updateFormData({ baseService: next });
                                                }}>
                                                <Checkbox checked={isChecked} onCheckedChange={() => { }} onClick={(e) => e.stopPropagation()} />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold text-gray-700 leading-tight">{s.name}</span>
                                                    <span className="text-[10px] text-gray-400 mt-1 font-medium">{'\u20B1'}{s.price}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <Label className={LABEL_STYLE}>Add-ons</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                    {addOnServices.map(s => {
                                        const isChecked = formData.addOns.some(a => a.name === s.name);
                                        const addonData = formData.addOns.find(a => a.name === s.name);
                                        return (
                                            <div key={s.id} className={`flex items-start space-x-2 bg-gray-50 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:bg-white'}`}
                                                onClick={() => handleAddOnToggle(s.name, !isChecked)}>
                                                <Checkbox checked={isChecked} onCheckedChange={() => { }} onClick={(e) => e.stopPropagation()} />
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-xs font-bold text-gray-700 leading-tight">{s.name}</span>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-[10px] text-gray-400 font-medium">{'\u20B1'}{s.price}</span>
                                                        {isChecked && (
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={addonData?.quantity || 1}
                                                                onChange={(e) => handleAddOnQuantityChange(s.name, parseInt(e.target.value) || 1)}
                                                                className="h-6 w-10 text-[10px] text-center p-0 font-bold text-red-600 bg-white"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financials & Payment */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium tracking-tight">Total Quantity</span>
                                <span className="font-bold">{formData.quantity || 1} {formData.quantity === 1 ? 'Pair' : 'Pairs'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium">Base Service Fee</span>
                                <span className="font-bold">{'\u20B1'}{(formData.baseServiceFee || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium">Add-ons Total</span>
                                <span className="font-bold">{'\u20B1'}{(formData.addOnsTotal || 0).toFixed(2)}</span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Grand Total</span>
                                <span className="text-2xl font-black text-red-600">{'\u20B1'}{(formData.grandTotal || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                            <div>
                                <Label className={LABEL_STYLE}>Payment Status</Label>
                                <Select value={formData.paymentStatus} onValueChange={(val: PaymentStatus) => setFormData({ ...formData, paymentStatus: val })}>
                                    <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="downpayment">Partial</SelectItem>
                                        <SelectItem value="fully-paid">Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className={LABEL_STYLE}>Payment Method</Label>
                                <Select value={formData.paymentMethod} onValueChange={(val: PaymentMethod) => setFormData({ ...formData, paymentMethod: val })}>
                                    <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="gcash">GCash</SelectItem>
                                        <SelectItem value="maya">Maya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className={LABEL_STYLE}>Amount Received</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">{'\u20B1'}</span>
                                    <Input
                                        type="number"
                                        value={formData.amountReceived || ''}
                                        onChange={(e) => setFormData({ ...formData, amountReceived: parseFloat(e.target.value) || 0 })}
                                        className="h-10 bg-white border-gray-200 text-right font-mono pl-6 rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                            {formData.paymentStatus === 'fully-paid' ? (
                                <div>
                                    <Label className={LABEL_STYLE}>Amount Change</Label>
                                    <div className="h-10 flex items-center justify-end px-3 bg-green-50 border border-green-100 rounded-xl text-sm font-bold text-green-700">
                                        ₱{Math.max(0, (formData.amountReceived || 0) - formData.grandTotal).toFixed(2)}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <Label className={LABEL_STYLE}>Remaining Balance</Label>
                                    <div className="h-10 flex items-center justify-end px-3 bg-red-50 border border-red-100 rounded-xl text-sm font-bold text-red-700">
                                        ₱{Math.max(0, formData.grandTotal - (formData.amountReceived || 0)).toFixed(2)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {['gcash', 'maya'].includes(formData.paymentMethod) && (
                            <div>
                                <Label className={LABEL_STYLE}>Reference Number</Label>
                                <Input
                                    value={formData.referenceNo || ''}
                                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                                    className={INPUT_STYLE}
                                    placeholder="Enter reference number"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="bg-white border-t border-gray-100 py-4 px-6 flex justify-between items-center gap-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold h-11 px-8 rounded-xl uppercase tracking-wider text-xs flex-1 transition-all">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onSave?.(formData.id, formData)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-100 h-11 px-8 rounded-xl uppercase tracking-wider text-xs flex-1 transition-all active:scale-95"
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

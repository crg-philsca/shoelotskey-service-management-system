
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { History } from 'lucide-react';
import { mockServices } from '@/app/lib/mockData';
import type { JobOrder, JobStatus, PaymentStatus, PaymentMethod } from '@/app/types';

interface EditOrderModalProps {
    order: JobOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (orderId: string, updates: Partial<JobOrder>) => void;
    hideHistory?: boolean;
}

const SHOE_BRANDS = [
    'Nike', 'Adidas', 'Asics', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 'Jordan',
    'Under Armour', 'Timberland', 'Dr. Martens', 'Salomon', 'Merrell', 'Skechers', 'Mizuno',
    'Brooks', 'Saucony', 'Hoka', 'Other'
];

const SHOE_MATERIALS = [
    'Leather', 'Synthetic', 'Canvas', 'Mesh', 'Rubber', 'Textile', 'Suede', 'Knit', 'Patent Leather', 'Denim', 'Nubuck', 'Other'
];

export default function EditOrderModal({ order, open, onOpenChange, onSave, hideHistory }: EditOrderModalProps) {
    const [formData, setFormData] = useState<JobOrder | null>(null);

    useEffect(() => {
        if (order) {
            setFormData({ ...order });
        }
    }, [order]);

    if (!formData) return null;

    const baseServices = mockServices.filter(s => s.category === 'base');
    const addOnServices = mockServices.filter(s => s.category === 'addon');

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

        // Priority Logic & Fees
        let priorityFee = 0;
        if (data.priorityLevel === 'rush') {
            // New Array Logic: Check max fee among all selected services?
            // Replicating Logic from ServiceIntakeForm:
            let maxFee = 0;
            if (baseServicesArr.some(s => s.includes('Reglue'))) {
                maxFee = 250;
            } else if (baseServicesArr.includes('Basic Cleaning')) {
                maxFee = 150;
            }
            // Fallback or multiple logic? 
            // If I have Basic Cleaning (150) AND Minor Reglue (250). 
            // Logic in Intake was: `if (Reglue) max = 250 else if (Cleaning) max = 150`. 
            // That logic implies if Reglue is present, fee is 250. 
            priorityFee = maxFee;

        } else if (data.priorityLevel === 'premium') {
            if (baseServicesArr.some(s => s.includes('Color Renewal'))) {
                priorityFee = 1000;
            }
        }

        // Calculate totals
        // Multiply priority fee by quantity (per pair logic)
        const rushFeeTotal = priorityFee * data.quantity;

        // Grand Total
        const total = basePrice + addonsPrice + rushFeeTotal;

        return {
            baseServiceFee: basePrice,
            addOnsTotal: addonsPrice,
            grandTotal: total
        };
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
        const updated = { ...formData, addOns: newAddons };
        const totals = recalculateTotals(updated);
        setFormData({ ...updated, ...totals });
    };

    const handleAddOnQuantityChange = (addonName: string, quantity: number) => {
        const newAddons = formData.addOns.map(a =>
            a.name === addonName ? { ...a, quantity } : a
        );
        const updated = { ...formData, addOns: newAddons };
        const totals = recalculateTotals(updated);
        setFormData({ ...updated, ...totals });
    };

    const remainingBalance = Math.max(0, formData.grandTotal - (formData.amountReceived || 0));

    const INPUT_STYLE = "w-full bg-white border-gray-200 h-10 text-sm focus:ring-red-50 focus:border-red-100 transition-all shadow-sm";
    const LABEL_STYLE = "text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wide";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] h-[95vh] flex flex-col bg-white p-0 gap-0 border-none shadow-2xl">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col gap-2 flex-shrink-0">
                    {/* Top Row: Title & Order Number */}
                    <div className="flex flex-row items-center justify-center gap-3 w-full">
                        <DialogTitle className="text-xl font-bold text-gray-900 whitespace-nowrap">
                            EDIT ORDER DETAIL
                        </DialogTitle>
                        <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap">
                            {formData.orderNumber}
                        </span>
                    </div>

                    {/* Bottom Row: Actions (Activity & Status) */}
                    <div className="flex flex-row justify-center gap-6 w-full">
                        {/* Activity */}
                        {!hideHistory && (
                            <div className="flex flex-row items-center gap-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activity</span>
                                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-red-50 hover:text-red-500 text-gray-600 text-xs">
                                    <History size={14} className="mr-0" /> History
                                </Button>
                            </div>
                        )}

                        {/* Status */}
                        <div className="flex flex-row items-center gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
                            <Select
                                value={formData.status}
                                onValueChange={(val: JobStatus) => setFormData({
                                    ...formData,
                                    status: val,
                                    actualCompletionDate: val === 'claimed' ? new Date() : undefined
                                })}
                            >
                                <SelectTrigger
                                    className={`h-6 border-none shadow-none p-0 px-2 text-xs focus:ring-0 font-medium min-w-[100px] text-left rounded-md transition-colors ml-1
                                    ${formData.status === 'new-order' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' :
                                            formData.status === 'on-going' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                                formData.status === 'for-release' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                                                    'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="new-order" className="text-purple-700 focus:bg-purple-50">New Order</SelectItem>
                                    <SelectItem value="on-going" className="text-blue-700 focus:bg-blue-50">On-Going</SelectItem>
                                    <SelectItem value="for-release" className="text-orange-700 focus:bg-orange-50">For Release</SelectItem>
                                    <SelectItem value="claimed" className="text-gray-700 focus:bg-gray-50">Claimed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                    {/* Customer Header */}
                    <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Customer Details
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            {/* Customer Name */}
                            <div>
                                <Label className={LABEL_STYLE}>Customer Name</Label>
                                <Input
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    className={INPUT_STYLE}
                                />
                            </div>
                            {/* Contact Number */}
                            <div>
                                <Label className={LABEL_STYLE}>Contact Number</Label>
                                <Input
                                    value={formData.contactNumber}
                                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                                    className={INPUT_STYLE}
                                />
                            </div>
                            {/* Shipping Preference */}
                            <div>
                                <Label className={LABEL_STYLE}>Shipping</Label>
                                <Select
                                    value={formData.shippingPreference}
                                    onValueChange={(val: any) => setFormData({ ...formData, shippingPreference: val })}
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
                            <div className="mt-4">
                                <Label className={LABEL_STYLE}>Delivery Address</Label>
                                <Input
                                    value={formData.deliveryAddress || ''}
                                    onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                                    className={INPUT_STYLE}
                                    placeholder="Enter full delivery address"
                                />
                            </div>
                        )}
                    </div>

                    {/* Shoe Details & Condition */}
                    <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Shoe Details
                        </h3>
                        <div className="space-y-6">
                            {/* Row 1: Brand, Material, Quantity */}
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-5">
                                    <Label className={LABEL_STYLE}>Brand</Label>
                                    <Select value={formData.brand} onValueChange={(val) => setFormData({ ...formData, brand: val })}>
                                        <SelectTrigger className={INPUT_STYLE}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SHOE_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-5">
                                    <Label className={LABEL_STYLE}>Material</Label>
                                    <Select value={formData.shoeMaterial} onValueChange={(val) => setFormData({ ...formData, shoeMaterial: val })}>
                                        <SelectTrigger className={INPUT_STYLE}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SHOE_MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2">
                                    <Label className={LABEL_STYLE}>Quantity</Label>
                                    <Input
                                        type="number"
                                        value={formData.quantity}
                                        onChange={(e) => {
                                            const qty = parseInt(e.target.value) || 1;
                                            const updated = { ...formData, quantity: qty };
                                            const totals = recalculateTotals(updated);
                                            setFormData({ ...updated, ...totals });
                                        }}
                                        className={INPUT_STYLE}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Condition Notes */}
                            <div>
                                <Label className={LABEL_STYLE}>Condition Notes</Label>
                                <div className="grid grid-cols-6 gap-3">
                                    {[
                                        { key: 'scratches', label: 'Scratches' },
                                        { key: 'ripsHoles', label: 'Rips/ Holes' },
                                        { key: 'fadedWorn', label: 'Faded/ Worn' },
                                        { key: 'soleSeparation', label: 'Sole Separation' },
                                        { key: 'yellowing', label: 'Yellowing' },
                                        { key: 'deepStains', label: 'Deep Stains' }
                                    ].map((condition) => (
                                        <div
                                            key={condition.key}
                                            className={`
                                        flex items-center justify-center py-2 px-1 rounded-md border text-[10px] font-bold cursor-pointer transition-all text-center h-auto min-h-[44px] break-words whitespace-normal leading-tight
                                        ${(formData.condition as any)[condition.key === 'fadedWorn' ? 'wornOut' : condition.key]
                                                    ? 'bg-red-50 border-red-200 text-red-700'
                                                    : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                                                }
`}
                                            onClick={() => {
                                                const key = condition.key === 'fadedWorn' ? 'wornOut' : condition.key;
                                                setFormData({
                                                    ...formData,
                                                    condition: {
                                                        ...formData.condition,
                                                        [key]: !(formData.condition as any)[key]
                                                    }
                                                });
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
                                        onChange={(e) => setFormData({ ...formData, condition: { ...formData.condition, others: e.target.value } })}
                                        className={INPUT_STYLE}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financials & Services */}
                    <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Services
                        </h3>
                        <div className="space-y-8">
                            {/* Top Row: Services Selection */}
                            <div className="space-y-6">
                                {/* Top Row: Priority & Assignment */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className={LABEL_STYLE}>Priority Level</Label>
                                        <Select
                                            value={formData.priorityLevel}
                                            onValueChange={(val: any) => {
                                                const updated = { ...formData, priorityLevel: val };
                                                const totals = recalculateTotals(updated);
                                                setFormData({ ...updated, ...totals });
                                            }}
                                        >
                                            <SelectTrigger className={`${INPUT_STYLE}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="regular">Regular</SelectItem>
                                                {(Array.isArray(formData.baseService) ? formData.baseService : []).some(s => s === 'Basic Cleaning' || s.includes('Reglue')) && (
                                                    <SelectItem value="rush">Rush</SelectItem>
                                                )}
                                                {formData.baseService.includes('Color Renewal') && (
                                                    <SelectItem value="premium">Premium</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className={LABEL_STYLE}>Assigned To</Label>
                                        <Select
                                            value={formData.assignedTo || 'unassigned'}
                                            onValueChange={(val: string) => setFormData({ ...formData, assignedTo: val === 'unassigned' ? undefined : val })}
                                        >
                                            <SelectTrigger className={`${INPUT_STYLE}`}>
                                                <SelectValue placeholder="Unassigned" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                                <SelectItem value="staff">staff</SelectItem>
                                                <SelectItem value="staff1">staff1</SelectItem>
                                                <SelectItem value="staff2">staff2</SelectItem>
                                                <SelectItem value="technician">technician</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Second Row: Primary Service (Full Width) */}
                                <div>
                                    <Label className={LABEL_STYLE}>Primary Service</Label>
                                    <div className="border border-gray-100 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 bg-[#F8F9FA]/50">
                                        {baseServices.map(s => {
                                            const isChecked = (Array.isArray(formData.baseService) ? formData.baseService : []).includes(s.name);
                                            return (
                                                <div key={s.id} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer" onClick={(e) => {
                                                    e.preventDefault();
                                                    const current = Array.isArray(formData.baseService) ? formData.baseService : [];
                                                    const newServices = current.includes(s.name)
                                                        ? current.filter(n => n !== s.name)
                                                        : [...current, s.name];

                                                    const updated = { ...formData, baseService: newServices };
                                                    const totals = recalculateTotals(updated);
                                                    setFormData({ ...updated, ...totals });
                                                }}>
                                                    <Checkbox
                                                        type="button"
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => {
                                                            const current = Array.isArray(formData.baseService) ? formData.baseService : [];
                                                            const newServices = checked
                                                                ? [...current, s.name]
                                                                : current.filter(n => n !== s.name);
                                                            const updated = { ...formData, baseService: newServices };
                                                            const totals = recalculateTotals(updated);
                                                            setFormData({ ...updated, ...totals });
                                                        }} id={`edit-base-${s.id}`} />
                                                    <label htmlFor={`edit-base-${s.id}`} className="text-xs font-medium cursor-pointer flex-1 flex justify-between items-start">
                                                        <div className="flex flex-col">
                                                            <span>{s.name.split(' (with basic cleaning)')[0]}</span>
                                                            {s.name.includes('(with basic cleaning)') && (
                                                                <span className="text-[10px] text-gray-500 font-normal">(with basic cleaning)</span>
                                                            )}
                                                        </div>
                                                        <span className="text-gray-400 ml-2">{'\u20B1'}{s.price}</span>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <Label className={LABEL_STYLE}>Add-ons</Label>
                                    <div className="grid grid-cols-2 gap-3 mt-2 max-h-64 overflow-y-auto pr-2">
                                        {addOnServices.map(s => {
                                            const isChecked = formData.addOns.some(a => a.name === s.name);
                                            const addonData = formData.addOns.find(a => a.name === s.name);

                                            return (
                                                <div key={s.id} className={`flex items-start space-x-2 bg-gray-50 p-3 rounded-lg border transition-colors cursor-pointer group ${isChecked ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:border-red-100 hover:bg-white flex-row justify-between'}`}
                                                    onClick={() => handleAddOnToggle(s.name, !isChecked)}
                                                >
                                                    <div className="flex items-center gap-2 flex-grow min-w-0">
                                                        <Checkbox
                                                            type="button"
                                                            id={`addon-${s.id}`}
                                                            checked={isChecked}
                                                            onCheckedChange={(c) => handleAddOnToggle(s.name, c as boolean)}
                                                            className="mt-0.5 flex-shrink-0"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <div className={`flex ${isChecked ? 'flex-col' : 'flex-row justify-between w-full'} min-w-0`}>
                                                            <label htmlFor={`addon-${s.id}`} className="text-xs font-bold text-gray-700 cursor-pointer text-wrap leading-tight whitespace-normal">
                                                                {s.name}
                                                            </label>
                                                            {!isChecked && <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap ml-2">{'\u20B1'}{s.price}</span>}
                                                        </div>
                                                    </div>

                                                    {isChecked && (
                                                        <div className="flex flex-col items-end gap-1 ml-2">
                                                            <div className="flex items-center flex-shrink-0 bg-white rounded border border-red-200 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                                                <div className="px-1.5 py-0.5 text-[9px] font-bold text-gray-400 border-r border-red-100 bg-white rounded-l">Qty</div>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    value={addonData?.quantity || 1}
                                                                    onChange={(e) => handleAddOnQuantityChange(s.name, parseInt(e.target.value) || 1)}
                                                                    className="h-6 w-7 text-center p-0 text-xs border-none focus:ring-0 font-bold text-red-600 outline-none bg-white"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-gray-500 font-medium">{'\u20B1'}{s.price}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Row: Calculations & Payment Status */}
                            <div className="flex justify-end pt-6 border-t border-gray-100">
                                <div className="bg-gray-50 rounded-xl p-6 space-y-5 border border-gray-200/60 w-full max-w-md">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">Unit Total</span>
                                        <span className="font-bold">{'\u20B1'}{formData.baseServiceFee.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">Add-ons Total</span>
                                        <span className="font-bold">{'\u20B1'}{formData.addOnsTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Grand Total</span>
                                        <span className="text-3xl font-black text-red-600 leading-none">{'\u20B1'}{formData.grandTotal.toFixed(2)}</span>
                                    </div>

                                    <div className="pt-2 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className={LABEL_STYLE}>Payment Status</Label>
                                                <div className={`grid ${formData.paymentStatus === 'unpaid' ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                                                    <Select value={formData.paymentStatus} onValueChange={(val: PaymentStatus) => setFormData({ ...formData, paymentStatus: val })}>
                                                        <SelectTrigger className="h-9 text-xs bg-white border-gray-200"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="unpaid">Unpaid</SelectItem>
                                                            <SelectItem value="partial">Partial</SelectItem>
                                                            <SelectItem value="paid">Paid</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {formData.paymentStatus !== 'unpaid' && (
                                                        <Select value={formData.paymentMethod} onValueChange={(val: PaymentMethod) => setFormData({ ...formData, paymentMethod: val })}>
                                                            <SelectTrigger className="h-9 text-xs bg-white border-gray-200"><SelectValue placeholder="Method" /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="cash">Cash</SelectItem>
                                                                <SelectItem value="gcash">GCash</SelectItem>
                                                                <SelectItem value="maya">Maya</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <Label className={LABEL_STYLE} >Amount Paid</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">{'\u20B1'}</span>
                                                    <Input
                                                        type="number"
                                                        value={formData.amountReceived || ''}
                                                        onChange={(e) => setFormData({ ...formData, amountReceived: parseFloat(e.target.value) || 0 })}
                                                        className="h-9 text-xs bg-white text-right font-mono pl-6"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {['gcash', 'maya'].includes(formData.paymentMethod) && (formData.paymentStatus === 'paid' || formData.paymentStatus === 'partial') && (
                                            <div className="pt-2">
                                                <Label className={LABEL_STYLE}>Reference Number</Label>
                                                <Input
                                                    value={formData.referenceNo || ''}
                                                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                                                    className="h-9 text-xs bg-white border-gray-200 font-mono"
                                                    placeholder="Enter reference number"
                                                />
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Remaining Balance</span>
                                            <span className={`text-base font-black ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'} `}>
                                                {'\u20B1'}{remainingBalance.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-white border-t border-gray-100 py-3 flex justify-center gap-6 items-center flex-shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] w-full pr-12">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold h-11 px-8 min-w-[200px] uppercase tracking-wider">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onSave(formData.id, formData)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-200 h-11 px-8 min-w-[200px] uppercase tracking-wider"
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

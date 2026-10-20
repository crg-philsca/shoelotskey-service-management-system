import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ShoppingBag, X, Plus } from 'lucide-react';
import { formatPeso } from '@/app/lib/utils';
import { useServices } from '@/app/context/ServiceContext';
import { useInventory } from '@/app/context/InventoryContext';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { isAddonVisibleForBaseServices, applyColorCountExclusive, syncColorRenewalAddons, syncFullReglueAddons, isColorCountAddon, isFullReglueSoleAddon, getSoleAddonPricingDisplay, sortAddonsForDisplay } from '@/app/lib/serviceCompatibility';

interface ShoeItemProps {
    shoe: any;
    index: number;
    updateShoe: (id: number, updates: any) => void;
    removeShoe: (id: number) => void;
}

const LABEL_STYLE = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 shadow-sm drop-shadow-sm";

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

const SHOE_BRANDS = Object.keys(BRAND_MODELS);
const ALL_MODELS = Object.values(BRAND_MODELS).flat().filter(m => m !== 'Other');
const MODEL_TO_BRAND: Record<string, string> = {};
Object.entries(BRAND_MODELS).forEach(([brand, models]) => {
    models.forEach(model => {
        if (model !== 'Other' && !MODEL_TO_BRAND[model]) {
            MODEL_TO_BRAND[model] = brand;
        }
    });
});

const MODEL_MATERIALS: Record<string, string> = {
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
    'Gel-Kayano': 'Mesh',
    'Gel-Nimbus': 'Mesh',
    'Suede': 'Suede',
    '6-Inch Premium Boot': 'Nubuck',
    '1460 8-Eye Boot': 'Leather'
};

export const ShoeItem: React.FC<ShoeItemProps> = ({ shoe, index, updateShoe, removeShoe }) => {
    const { services } = useServices();
    const { inventoryData } = useInventory();

    const baseServices = services.filter((s: any) => s.category !== 'addon');
    const addOnServices = services.filter((s: any) => s.category === 'addon');

    const getAddonTotal = (name: string, quantity: number) => {
        const addon = addOnServices.find(a => a.name === name);
        if (!addon) return 0;
        return addon.price * quantity;
    };

    return (
        <Card key={shoe.id} className="border-red-50/50 shadow-sm transition-all hover:shadow-md animate-in fade-in zoom-in-95 duration-500 overflow-hidden group/card bg-white">
            <CardHeader className="bg-gradient-to-r from-red-50/10 via-white to-transparent py-2.5 px-5 border-b border-red-50/50 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-red-100/50">
                        {index + 1}
                    </div>
                    <CardTitle className="text-[13px] font-black text-slate-900 uppercase tracking-widest">{shoe.shoeName || 'Unnamed Shoe'}</CardTitle>
                </div>
                {index > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeShoe(shoe.id)}
                        className="h-6 w-6 bg-red-50 border border-red-200 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all rounded-full p-0 flex items-center justify-center shadow-2xs"
                        title="Remove shoe"
                    >
                        <X size={12} strokeWidth={2.5} />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="px-5 pt-4 pb-5 bg-white">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
                        <div className="md:col-span-12 flex flex-col h-full gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pb-4 border-b border-dashed border-gray-100">
                                <div className="space-y-1">
                                    <Label className={LABEL_STYLE}>Brand</Label>
                                    <Input
                                        placeholder="e.g. Nike"
                                        list={`brand-options-${shoe.id}`}
                                        value={shoe.brand}
                                        onChange={(e) => {
                                            const newBrand = e.target.value;
                                            const updates: any = { brand: newBrand };
                                            if (newBrand && shoe.shoeModel) {
                                                const modelBrand = MODEL_TO_BRAND[shoe.shoeModel];
                                                if (modelBrand && modelBrand !== newBrand) {
                                                    updates.shoeModel = '';
                                                    updates.shoeMaterial = '';
                                                } else if (BRAND_MODELS[newBrand] && !BRAND_MODELS[newBrand].includes(shoe.shoeModel)) {
                                                    updates.shoeModel = '';
                                                    updates.shoeMaterial = '';
                                                }
                                            }
                                            updateShoe(shoe.id, updates);
                                        }}
                                        className="h-10 bg-white border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all focus:border-red-200"
                                    />
                                    <datalist id={`brand-options-${shoe.id}`}>
                                        {SHOE_BRANDS.map((b) => (
                                            <option key={b} value={b} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="space-y-1">
                                    <Label className={LABEL_STYLE}>Shoe Model</Label>
                                    <Input
                                        placeholder="e.g. Dunk Low Panda"
                                        list={`model-options-${shoe.id}`}
                                        value={shoe.shoeModel}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!shoe.brand && MODEL_TO_BRAND[val]) {
                                                updateShoe(shoe.id, {
                                                    brand: MODEL_TO_BRAND[val],
                                                    shoeModel: val,
                                                    shoeMaterial: MODEL_MATERIALS[val] || shoe.shoeMaterial,
                                                });
                                                return;
                                            }
                                            const updates: any = { shoeModel: val };
                                            if (MODEL_MATERIALS[val]) {
                                                updates.shoeMaterial = MODEL_MATERIALS[val];
                                            }
                                            updateShoe(shoe.id, updates);
                                        }}
                                        className="h-10 bg-white border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all focus:border-red-200"
                                    />
                                    <datalist id={`model-options-${shoe.id}`}>
                                        {(shoe.brand && BRAND_MODELS[shoe.brand]
                                            ? BRAND_MODELS[shoe.brand]
                                            : ALL_MODELS
                                        ).map((m) => (
                                            <option key={m} value={m} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="space-y-1">
                                    <Label className={LABEL_STYLE}>Material</Label>
                                    <Input
                                        placeholder="e.g. Leather"
                                        value={shoe.shoeMaterial}
                                        onChange={(e) => updateShoe(shoe.id, { shoeMaterial: e.target.value })}
                                        className="h-10 bg-white border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all focus:border-red-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className={LABEL_STYLE}>Quantity</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={shoe.quantity}
                                        onChange={(e) => updateShoe(shoe.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                        className="h-10 bg-white border-gray-100/50 rounded-xl text-xs font-black text-gray-700 shadow-sm transition-all focus:border-red-200"
                                    />
                                </div>
                                <div className="space-y-3 col-span-4 mt-2">
                                    <Label className={LABEL_STYLE}>Initial Condition Checklist</Label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                        {['scratches', 'ripsHoles', 'wornOut', 'soleSeparation', 'yellowing', 'deepStains'].map((cond) => (
                                            <label key={cond} className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${shoe.condition[cond] ? 'border-red-100 bg-red-50/20' : 'bg-gray-50/50 border-transparent hover:border-red-100'}`}>
                                                <Checkbox
                                                    checked={shoe.condition[cond]}
                                                    onCheckedChange={(checked) => {
                                                        updateShoe(shoe.id, { condition: { ...shoe.condition, [cond]: checked } });
                                                    }}
                                                    className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                />
                                                <span className="text-[10px] font-bold text-gray-600 capitalize">
                                                    {cond.replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label className={LABEL_STYLE}>Initial Condition & Description</Label>
                                    <Input
                                        placeholder="Note defects, stains, or special handling instructions"
                                        value={shoe.description}
                                        onChange={(e) => updateShoe(shoe.id, { description: e.target.value })}
                                        className="h-10 bg-white border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all focus:border-red-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <ShoppingBag size={12} className="text-red-500" /> Base Service Selection
                                    </Label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {baseServices.map((service) => {
                                            const isChecked = (Array.isArray(shoe.baseService) ? shoe.baseService : []).includes(service.name);
                                            return (
                                                <label key={service.id} className={`flex ${isChecked ? 'items-start min-h-[64px]' : 'items-center min-h-[58px]'} space-x-2 p-2.5 rounded-lg border transition-all cursor-pointer shadow-sm ${isChecked ? 'border-red-100 bg-red-50/10' : 'bg-white border-gray-100 hover:border-red-100'}`}>
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => {
                                                            const currentServices = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                                                            let newServices = checked
                                                                ? [...currentServices, service.name]
                                                                : currentServices.filter((s: string) => s !== service.name);

                                                            if (checked && service.name === 'Minor Reglue') {
                                                                newServices = newServices.filter((s: string) => s !== 'Full Reglue');
                                                            }
                                                            if (checked && service.name === 'Full Reglue') {
                                                                newServices = newServices.filter((s: string) => s !== 'Minor Reglue');
                                                            }

                                                            const requiresCleaning = ['Minor Reglue', 'Full Reglue', 'Color Renewal'];
                                                            if (checked && requiresCleaning.includes(service.name)) {
                                                                if (!newServices.includes('Basic Cleaning')) {
                                                                    newServices.push('Basic Cleaning');
                                                                }
                                                            }

                                                            if (!checked && service.name === 'Basic Cleaning') {
                                                                newServices = newServices.filter((s: string) => !requiresCleaning.includes(s));
                                                            }

                                                            let currentAddOns = shoe.addOns ? [...shoe.addOns] : [];
                                                            currentAddOns = syncFullReglueAddons(syncColorRenewalAddons(currentAddOns, newServices), newServices).filter((a: any) => isAddonVisibleForBaseServices(a.name, newServices, services));

                                                            // [DYNAMIC INVENTORY] Auto-suggest chemicals based on service
                                                            let newInventory = [...(shoe.inventoryUsed || [])];
                                                            if (checked) {
                                                                const serviceName = service.name.toLowerCase();
                                                                let suggestedItemName = "";
                                                                let suggestedAmount = 0.1; // Default suggested amount
                                                                
                                                                if (serviceName.includes("cleaning")) suggestedItemName = "Cleaner";
                                                                else if (serviceName.includes("reglue")) suggestedItemName = "Stain Remover";
                                                                else if (serviceName.includes("color")) suggestedItemName = "Leather Conditioner";
                                                                
                                                                if (suggestedItemName) {
                                                                    const invItem = inventoryData.find(i => i.name.toLowerCase() === suggestedItemName.toLowerCase());
                                                                    if (invItem && !newInventory.some(u => u.itemId === invItem.id)) {
                                                                        newInventory.push({ itemId: invItem.id, amount: suggestedAmount });
                                                                    }
                                                                }
                                                            }

                                                            updateShoe(shoe.id, { 
                                                                baseService: newServices,
                                                                inventoryUsed: newInventory,
                                                                addOns: currentAddOns
                                                            });
                                                        }}
                                                        className={`h-4 w-4 shrink-0 ${isChecked ? 'self-start mt-0.5' : ''} data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600`}
                                                    />
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-1 min-w-0">
                                                            <span className="text-[11px] font-bold leading-tight text-gray-700 truncate">
                                                                {service.name}
                                                            </span>
                                                            {service.code && (
                                                                <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ml-auto">
                                                                    {service.code}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isChecked && (service.name === 'Full Reglue' || service.name === 'Color Renewal') && (
                                                            <div className="mt-0.5 min-w-0">
                                                                <span className="text-[8.5px] font-semibold text-amber-700 leading-tight block break-words" title={service.name === 'Full Reglue' ? "Select Midsole or Undersole" : "Select 2 Colors or 3 Colors"}>
                                                                    {service.name === 'Full Reglue' ? "Select Midsole or Undersole" : "Select 2 Colors or 3 Colors"}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {isChecked && (
                                                            <div className="flex items-center justify-end mt-1 min-w-0">
                                                                <span className="text-[11px] font-black text-red-600 shrink-0 ml-auto whitespace-nowrap">
                                                                    {service.price > 0 ? formatPeso(service.price) : 'Price varies'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3 flex flex-col h-full">
                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Add-on Services</Label>
                                    {(!shoe.baseService || shoe.baseService.length === 0) ? (
                                        <div className="border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-white gap-2 min-h-[100px] flex-grow shadow-sm">
                                            <span className="text-xs font-bold italic text-gray-300 uppercase tracking-widest">Awaiting Base Service</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2 flex-grow overflow-y-auto max-h-[114px] pr-1.5 addon-scrollbar">
                                            {sortAddonsForDisplay(
                                                addOnServices.filter(addon => isAddonVisibleForBaseServices(addon.name, shoe.baseService || [], services)),
                                                shoe.baseService || []
                                            ).map((addon) => {
                                                const isChecked = shoe.addOns.some((a: any) => a.name === addon.name);
                                                const addonItem = shoe.addOns.find((a: any) => a.name === addon.name);
                                                const quantity = addonItem?.quantity || 1;
                                                return (
                                                    <div key={addon.id} className={`flex flex-col justify-center px-2 py-1.5 rounded-lg border bg-white transition-all h-[52px] ${isChecked ? 'border-red-100 bg-red-50/10' : 'border-gray-50'} shadow-sm`}>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
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
                                                                            : newAddOns.filter((a: any) => a.name !== addon.name);
                                                                    }
                                                                    updateShoe(shoe.id, { addOns: newAddOns });
                                                                }}
                                                                className="h-4 w-4 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                            />
                                                            <span className="text-[11px] font-bold text-gray-600 truncate">{addon.name}</span>
                                                        </div>
                                                        {isChecked && (
                                                            <div className="flex items-center justify-between border-t border-gray-100 pt-1 mt-1">
                                                                {Boolean(addon.hasSpinner ?? ((addon.name || '').toLowerCase() === 'unyellowing' || (addon.name || '').toLowerCase() === 'white paint')) ? (
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={quantity}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            const newQty = val === '' ? 1 : Math.max(1, parseInt(val));
                                                                            const newAddOns = shoe.addOns.map((a: any) =>
                                                                                a.name === addon.name ? { ...a, quantity: newQty } : a
                                                                            );
                                                                            updateShoe(shoe.id, { addOns: newAddOns });
                                                                        }}
                                                                        className="w-9 h-4.5 border border-gray-200 rounded text-[10px] font-bold text-center focus:outline-none focus:border-red-500 bg-white px-0"
                                                                    />
                                                                ) : <div />}
                                                                {(() => {
                                                                    const isFR = (shoe.baseService || []).includes('Full Reglue');
                                                                    const isSole = isFullReglueSoleAddon(addon.name);
                                                                    if (isFR && isSole) {
                                                                        const solePricing = getSoleAddonPricingDisplay(addon.name, shoe.addOns || [], shoe.baseService || []);
                                                                        return (
                                                                            <span className="text-[11px] font-black text-red-600 ml-auto">
                                                                                {solePricing.displayLabel}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return <span className="text-[11px] font-black text-red-600 ml-auto">{formatPeso(getAddonTotal(addon.name, quantity))}</span>;
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-gray-200 mt-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplies & Materials Used</Label>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {shoe.inventoryUsed.map((usage: any, uIdx: number) => {
                                        const item = inventoryData.find((i: any) => i.id === usage.itemId);
                                        return (
                                            <div key={uIdx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                                <Select 
                                                    value={usage.itemId?.toString() || ""} 
                                                    onValueChange={(val) => {
                                                        const newUsage = [...shoe.inventoryUsed];
                                                        newUsage[uIdx].itemId = parseInt(val);
                                                        updateShoe(shoe.id, { inventoryUsed: newUsage });
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 text-[11px] font-bold border-none shadow-none flex-1">
                                                        <SelectValue placeholder="Select Supply" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {inventoryData.map((inv: any) => {
                                                            const pres = getInventoryPresentation(inv);
                                                            return (
                                                                <SelectItem key={inv.id} value={inv.id?.toString()} className="text-[11px]">
                                                                    {inv.name} - {pres.dropdownLabel}
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
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
                                                        const newUsage = shoe.inventoryUsed.filter((_: any, idx: number) => idx !== uIdx);
                                                        updateShoe(shoe.id, { inventoryUsed: newUsage });
                                                    }}
                                                    className="h-7 w-7 text-red-400 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <X size={14} />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const first = inventoryData[0]?.id;
                                            if (first) {
                                                updateShoe(shoe.id, {
                                                    inventoryUsed: [...shoe.inventoryUsed, { itemId: first, amount: 0.1 }]
                                                });
                                            }
                                        }}
                                        className="h-9 border-dashed border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-100"
                                    >
                                        <Plus size={14} className="stroke-[3]" /> Add Supply Used
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

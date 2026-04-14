import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Trash2, ShoppingBag, X, Plus } from 'lucide-react';
import { formatPeso } from '@/app/lib/utils';
import { useServices } from '@/app/context/ServiceContext';
import { useInventory } from '@/app/context/InventoryContext';

interface ShoeItemProps {
    shoe: any;
    index: number;
    updateShoe: (id: number, updates: any) => void;
    removeShoe: (id: number) => void;
}

const LABEL_STYLE = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 shadow-sm drop-shadow-sm";

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
                        className="h-8 w-8 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-xl"
                    >
                        <Trash2 size={16} />
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
                                        value={shoe.brand}
                                        onChange={(e) => updateShoe(shoe.id, { brand: e.target.value })}
                                        className="h-10 bg-white border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all focus:border-red-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className={LABEL_STYLE}>Shoe Model</Label>
                                    <Input
                                        placeholder="e.g. Dunk Low Panda"
                                        value={shoe.shoeModel}
                                        onChange={(e) => updateShoe(shoe.id, { shoeModel: e.target.value })}
                                        className="h-10 bg-white border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all focus:border-red-200"
                                    />
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
                                    <div className="grid grid-cols-2 gap-2">
                                        {baseServices.map((service) => {
                                            const isChecked = (Array.isArray(shoe.baseService) ? shoe.baseService : []).includes(service.name);
                                            return (
                                                <label key={service.id} className={`flex items-center space-x-2 p-3 rounded-lg border transition-all cursor-pointer shadow-sm ${isChecked ? 'border-red-100 bg-red-50/10' : 'bg-white border-gray-100 hover:border-red-100'}`}>
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => {
                                                            const currentServices = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                                                            let newServices = checked
                                                                ? [...currentServices, service.name]
                                                                : currentServices.filter((s: string) => s !== service.name);

                                                            const requiresCleaning = ['Minor Reglue', 'Full Reglue', 'Color Renewal'];
                                                            if (checked && requiresCleaning.includes(service.name)) {
                                                                if (!newServices.includes('Basic Cleaning')) {
                                                                    newServices.push('Basic Cleaning');
                                                                }
                                                            }

                                                            if (!checked && service.name === 'Basic Cleaning') {
                                                                newServices = newServices.filter((s: string) => !requiresCleaning.includes(s));
                                                            }

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
                                                                inventoryUsed: newInventory 
                                                            });
                                                        }}
                                                        className="h-4 w-4 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                    />
                                                    <div className="flex items-center justify-between flex-1 min-w-0">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[11px] font-bold leading-tight text-gray-700 truncate">
                                                                {service.name}
                                                            </span>
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

                                <div className="space-y-3 flex flex-col h-full">
                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Add-on Services</Label>
                                    {(!shoe.baseService || shoe.baseService.length === 0) ? (
                                        <div className="border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-white gap-2 min-h-[100px] flex-grow shadow-sm">
                                            <span className="text-xs font-bold italic text-gray-300 uppercase tracking-widest">Awaiting Base Service</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2 flex-grow overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                                            {addOnServices.filter(addon => {
                                                const baseServicesArr = shoe.baseService || [];
                                                const basicCleaningAddOns = ['Unyellowing', 'White Paint', 'Minor Restoration', 'Minor Retouch'];
                                                const reglueAddOns = ['Add Glue Layer', 'Premium Glue', 'Midsole', 'Undersole'];
                                                if (baseServicesArr.includes('Basic Cleaning') && basicCleaningAddOns.includes(addon.name)) return true;
                                                if (baseServicesArr.some((s: string) => s.toLowerCase().includes('reglue')) && reglueAddOns.includes(addon.name)) return true;
                                                const colorAddOns = ['2 Colors', '3 Colors'];
                                                if (baseServicesArr.some((s: string) => s.includes('Color Renewal')) && colorAddOns.includes(addon.name)) return true;
                                                return false;
                                            }).map((addon) => {
                                                const isChecked = shoe.addOns.some((a: any) => a.name === addon.name);
                                                const addonItem = shoe.addOns.find((a: any) => a.name === addon.name);
                                                const quantity = addonItem?.quantity || 1;
                                                return (
                                                    <div key={addon.id} className={`flex flex-col p-2.5 rounded-lg border bg-white transition-all ${isChecked ? 'border-red-100 bg-red-50/10' : 'border-gray-50'} gap-2 shadow-sm`}>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                checked={isChecked}
                                                                onCheckedChange={(checked) => {
                                                                    let newAddOns = checked
                                                                        ? [...shoe.addOns, { name: addon.name, quantity: 1 }]
                                                                        : shoe.addOns.filter((a: any) => a.name !== addon.name);
                                                                    updateShoe(shoe.id, { addOns: newAddOns });
                                                                }}
                                                                className="h-4 w-4 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                            />
                                                            <span className="text-[11px] font-bold text-gray-600">{addon.name}</span>
                                                        </div>
                                                        {isChecked && (
                                                            <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 mt-1.5">
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
                                                                    className="w-10 h-6 border-none bg-gray-50 rounded text-[10px] font-black text-center focus:outline-none"
                                                                />
                                                                <span className="text-[11px] font-black text-red-600">{formatPeso(getAddonTotal(addon.name, quantity))}</span>
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
                                                        {inventoryData.map((inv: any) => (
                                                            <SelectItem key={inv.id} value={inv.id?.toString()} className="text-[11px]">
                                                                {inv.name} ({inv.stock} {inv.unit} left)
                                                            </SelectItem>
                                                        ))}
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

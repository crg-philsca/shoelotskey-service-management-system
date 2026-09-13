import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Service } from '@/app/types';
import { useServices } from '@/app/context/ServiceContext';
import { Sparkles } from 'lucide-react';

interface ServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    service?: Service | null;
    onSave: (service: Service) => void;
}

export default function ServiceModal({ isOpen, onClose, service, onSave }: ServiceModalProps) {
    const { services: allServices } = useServices();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState<'base' | 'addon' | 'priority'>('base');
    const [active, setActive] = useState(true);
    const [durationDays, setDurationDays] = useState('');
    const [code, setCode] = useState('');
    const [connectedAddons, setConnectedAddons] = useState<string[]>([]);

    const availableAddons = (allServices || []).filter(s => s.category === 'addon' && s.active);

    // Initialize form when service prop changes or modal opens
    useEffect(() => {
        if (isOpen) {
            if (service) {
                setName(service.name);
                setPrice(service.price.toString());
                setCategory(service.category);
                setActive(service.active);
                setDurationDays(service.durationDays !== undefined ? service.durationDays.toString() : '');
                setCode(service.code || '');
                setConnectedAddons(service.connectedAddons || []);
            } else {
                // Reset for new service
                setName('');
                setPrice('');
                setCategory('base');
                setActive(true);
                setDurationDays('');
                setCode('');
                setConnectedAddons([]);
            }
        }
    }, [isOpen, service]);

    const toggleAddon = (addonName: string) => {
        setConnectedAddons(prev => 
            prev.includes(addonName) ? prev.filter(a => a !== addonName) : [...prev, addonName]
        );
    };

    const handleSelectAllAddons = () => {
        setConnectedAddons(availableAddons.map(a => a.name));
    };

    const handleClearAllAddons = () => {
        setConnectedAddons([]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !price) return;

        const newService: Service = {
            id: service?.id || Math.random().toString(36).substr(2, 9),
            name,
            price: parseFloat(price),
            category,
            active,
            durationDays: parseInt(durationDays) || 0,
            ...(code ? { code } : {}),
            connectedAddons: category === 'base' ? connectedAddons : undefined
        };

        onSave(newService);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col rounded-2xl bg-white border border-gray-100 shadow-2xl">
                <DialogHeader className="shrink-0 bg-white px-6 pt-5 pb-3.5 border-b border-gray-100">
                    <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                        {service ? 'Edit Service' : 'Add New Service'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Configure service options and pricing</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="service-name" className="text-xs font-bold uppercase tracking-widest text-gray-500">Name</Label>
                        <Input
                            id="service-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Deep Cleaning"
                            className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price" className="text-xs font-bold uppercase tracking-widest text-gray-500">Price (PHP)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>
                                <Input
                                    id="price"
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="pl-7 font-bold text-red-600 border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category" className="text-xs font-bold uppercase tracking-widest text-gray-500">Category</Label>
                            <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                                <SelectTrigger className="font-medium border-red-200 focus:ring-0 focus:border-red-600">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="base">Base Service</SelectItem>
                                    <SelectItem value="addon">Add-On</SelectItem>
                                    <SelectItem value="priority">Priority Fee</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="durationDays" className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                Service Duration (Days)
                            </Label>
                            <p className="text-[10px] text-gray-400 mt-0 leading-tight">
                                {category === 'priority' ? 'Use negative values for rush reduction (e.g., -1)' : 'Positive values extend service duration'}
                            </p>
                            <Input
                                id="durationDays"
                                type="text"
                                value={durationDays}
                                onChange={(e) => setDurationDays(e.target.value)}
                                className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                                placeholder={category === 'priority' ? '-1' : '5'}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="serviceCode" className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                Service Code
                            </Label>
                            <p className="text-[10px] text-gray-400 mt-0 leading-tight">
                                Optional code indicator for the service
                            </p>
                            <Input
                                id="serviceCode"
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600 uppercase"
                                placeholder="e.g. BC"
                            />
                        </div>
                    </div>

                    {/* Connected Add-ons section for Base Services */}
                    {category === 'base' && (
                        <div className="space-y-2 pt-1 pb-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-xs font-bold uppercase tracking-widest text-gray-700 flex items-center gap-1.5">
                                        <Sparkles size={13} className="text-red-500" />
                                        Connected Add-ons
                                    </Label>
                                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                        Select which add-ons will be displayed in Job Orders when this service is selected.
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllAddons}
                                        className="text-[10px] font-bold text-red-600 hover:text-red-800 uppercase px-1.5 py-0.5 rounded hover:bg-red-50 transition"
                                    >
                                        All
                                    </button>
                                    <span className="text-gray-300 text-xs">|</span>
                                    <button
                                        type="button"
                                        onClick={handleClearAllAddons}
                                        className="text-[10px] font-bold text-gray-500 hover:text-gray-700 uppercase px-1.5 py-0.5 rounded hover:bg-gray-100 transition"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {availableAddons.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-2">No active add-ons available.</p>
                            ) : (
                                <div className="max-h-40 overflow-y-auto border border-red-100 rounded-xl p-2.5 bg-red-50/20 space-y-1.5 scrollbar-thin">
                                    {availableAddons.map((addon) => {
                                        const isChecked = connectedAddons.includes(addon.name);
                                        return (
                                            <label
                                                key={addon.id}
                                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all border ${
                                                    isChecked 
                                                        ? 'bg-red-50 border-red-200 text-red-900 font-bold shadow-2xs' 
                                                        : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => toggleAddon(addon.name)}
                                                    />
                                                    <span>{addon.name}</span>
                                                </div>
                                                <span className="text-[11px] font-semibold text-gray-500">
                                                    ₱{addon.price.toFixed(2)}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="text-[10px] text-gray-500 font-medium">
                                {connectedAddons.length} of {availableAddons.length} add-on{availableAddons.length === 1 ? '' : 's'} connected
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="active-status" className="text-sm font-bold text-gray-700">Active Status</Label>
                        <Switch
                            id="active-status"
                            checked={active}
                            onCheckedChange={setActive}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    </div>
                </div>

                    <div className="shrink-0 bg-white px-6 py-4 border-t border-gray-100 flex gap-3 shadow-xs">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 font-bold text-xs border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all rounded-xl">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-9 text-xs uppercase tracking-widest rounded-xl shadow-sm">
                            {service ? 'Save' : 'Create'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

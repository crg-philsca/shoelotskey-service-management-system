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
import { Sparkles, Zap, ChevronDown, ShieldCheck } from 'lucide-react';

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
    const [category, setCategory] = useState<'base' | 'addon' | 'priority' | 'discount'>('base');
    const [active, setActive] = useState(true);
    const [hasSpinner, setHasSpinner] = useState(false);
    const [durationDays, setDurationDays] = useState('');
    const [code, setCode] = useState('');
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
    const [idVerificationType, setIdVerificationType] = useState<'none' | 'control_number' | 'id_number'>('none');
    const [idFormat, setIdFormat] = useState<'alphanumeric' | 'numbers' | 'letters'>('alphanumeric');
    const [idDigits, setIdDigits] = useState<string>('');
    const [expandIdVerification, setExpandIdVerification] = useState(false);
    const [connectedAddons, setConnectedAddons] = useState<string[]>([]);
    const [connectedBaseServices, setConnectedBaseServices] = useState<string[]>([]);
    const [expandBaseServices, setExpandBaseServices] = useState(false);
    const [expandPriorityAddons, setExpandPriorityAddons] = useState(false);
    const [expandBaseAddons, setExpandBaseAddons] = useState(false);

    const availableAddons = (allServices || []).filter(s => s.category === 'addon' && s.active);
    const availableBaseServices = (allServices || []).filter(s => s.category === 'base' && s.active);

    // Initialize form when service prop changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setExpandBaseServices(false);
            setExpandPriorityAddons(false);
            setExpandBaseAddons(false);
            if (service) {
                setName(service.name);
                setPrice(service.category === 'discount' && Number(service.price || 0) % 1 === 0 ? Number(service.price || 0).toString() : Number(service.price || 0).toFixed(2));
                setCategory(service.category);
                setActive(service.active);
                setHasSpinner(Boolean(service.category === 'addon' && (service.hasSpinner ?? ((service.name || '').toLowerCase() === 'unyellowing' || (service.name || '').toLowerCase() === 'white paint'))));
                setDurationDays(service.durationDays !== undefined ? service.durationDays.toString() : '');
                setCode(service.code || '');
                const isFixed = service.description?.toLowerCase().includes('fixed') || service.description?.toLowerCase().includes('amount') || service.code === 'PHP' || service.name.includes('₱');
                setDiscountType(isFixed ? 'fixed' : 'percent');
                setConnectedAddons(service.connectedAddons || []);
                setConnectedBaseServices(service.connectedBaseServices || []);

                // Parse ID verification configuration
                if (service.category === 'discount') {
                    let parsed: any = null;
                    if (typeof service.description === 'string' && service.description.trim().startsWith('{')) {
                        try { parsed = JSON.parse(service.description); } catch (_) {}
                    }
                    const sName = (service.name || '').toLowerCase();
                    const isSenior = sName.includes('senior') || sName.includes('snr');
                    const isPwd = sName.includes('pwd') || sName.includes('disability');
                    const resolvedType = (parsed?.idType && parsed.idType !== 'none')
                        ? parsed.idType
                        : (service.idVerificationType && service.idVerificationType !== 'none')
                            ? service.idVerificationType
                            : (isSenior ? 'control_number' : isPwd ? 'id_number' : (service.requiresIdVerification ? 'control_number' : 'none'));
                    const resolvedFormat = parsed?.idFormat || service.idFormat || (isSenior ? 'numbers' : 'alphanumeric');
                    const resolvedDigits = parsed?.digits != null
                        ? String(parsed.digits)
                        : service.idDigits != null
                            ? String(service.idDigits)
                            : (isSenior ? '6' : isPwd ? '12' : '');

                    setIdVerificationType(resolvedType);
                    setIdFormat(resolvedFormat);
                    setIdDigits(resolvedDigits);
                    setExpandIdVerification(false);
                } else {
                    setIdVerificationType('none');
                    setIdFormat('alphanumeric');
                    setIdDigits('');
                    setExpandIdVerification(false);
                }
            } else {
                // Reset for new service
                setName('');
                setPrice('');
                setCategory('base');
                setActive(true);
                setHasSpinner(false);
                setDurationDays('');
                setCode('');
                setDiscountType('percent');
                setIdVerificationType('none');
                setIdFormat('alphanumeric');
                setIdDigits('');
                setExpandIdVerification(false);
                setConnectedAddons([]);
                setConnectedBaseServices([]);
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

    const toggleBaseService = (baseName: string) => {
        setConnectedBaseServices(prev =>
            prev.includes(baseName) ? prev.filter(b => b !== baseName) : [...prev, baseName]
        );
    };

    const handleSelectAllBaseServices = () => {
        setConnectedBaseServices(availableBaseServices.map(b => b.name));
    };

    const handleClearAllBaseServices = () => {
        setConnectedBaseServices([]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !price) return;

        let discountDescription = service?.description;
        const parsedDigits = idDigits.trim() ? parseInt(idDigits.trim(), 10) : undefined;
        const validDigits = parsedDigits && !isNaN(parsedDigits) && parsedDigits > 0 ? parsedDigits : undefined;

        if (category === 'discount') {
            discountDescription = JSON.stringify({
                discountType,
                requiresId: idVerificationType !== 'none',
                idType: idVerificationType,
                idFormat: idFormat,
                digits: validDigits || null
            });
        }

        const newService: Service = {
            id: service?.id || Math.random().toString(36).substr(2, 9),
            name,
            price: parseFloat(price),
            category,
            active,
            description: category === 'discount' ? discountDescription : service?.description,
            durationDays: category === 'discount' ? 0 : (parseInt(durationDays) || 0),
            ...(category !== 'discount' && code ? { code } : { code: '' }),
            connectedAddons: (category === 'base' || category === 'priority') ? connectedAddons : undefined,
            connectedBaseServices: category === 'priority' ? connectedBaseServices : undefined,
            requiresIdVerification: category === 'discount' ? idVerificationType !== 'none' : false,
            idVerificationType: category === 'discount' ? idVerificationType : 'none',
            idFormat: category === 'discount' ? idFormat : 'alphanumeric',
            idDigits: category === 'discount' ? validDigits : undefined,
            hasSpinner: category === 'addon' ? hasSpinner : false
        };

        onSave(newService);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[460px] max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col rounded-2xl bg-white border border-gray-100 shadow-2xl">
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
                            placeholder={category === 'discount' ? "e.g. Senior Citizen / PWD or 10% Off" : "e.g. Deep Cleaning"}
                            className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between h-6">
                                <Label htmlFor="price" className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                    {category === 'discount' 
                                        ? (discountType === 'percent' ? 'Rate (%)' : 'Amount (₱)') 
                                        : 'Price (PHP)'}
                                </Label>
                                {category === 'discount' && (
                                    <div className="flex items-center bg-gray-100 p-0.5 rounded border border-gray-200 text-[9px] font-black">
                                        <button
                                            type="button"
                                            onClick={() => setDiscountType('percent')}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none transition-all ${
                                                discountType === 'percent'
                                                    ? 'bg-red-600 text-white shadow-2xs'
                                                    : 'text-gray-600 hover:text-red-600'
                                            }`}
                                        >
                                            % Off
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDiscountType('fixed')}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none transition-all ${
                                                discountType === 'fixed'
                                                    ? 'bg-red-600 text-white shadow-2xs'
                                                    : 'text-gray-600 hover:text-red-600'
                                            }`}
                                        >
                                            ₱ Off
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                                    {category === 'discount' ? (discountType === 'percent' ? '%' : '₱') : '₱'}
                                </span>
                                <Input
                                    id="price"
                                    type="number"
                                    min="0"
                                    max={category === 'discount' && discountType === 'percent' ? '100' : undefined}
                                    step={category === 'discount' && discountType === 'percent' ? '1' : '0.01'}
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val)) {
                                            if (category === 'discount' && discountType === 'percent') {
                                                const clamped = Math.min(100, Math.max(0, val));
                                                setPrice(clamped % 1 === 0 ? clamped.toString() : clamped.toFixed(2));
                                            } else {
                                                setPrice(val.toFixed(2));
                                            }
                                        }
                                    }}
                                    className="pl-7 font-bold text-red-600 border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                                    placeholder={category === 'discount' ? (discountType === 'percent' ? '10' : '50.00') : '0.00'}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center h-6">
                                <Label htmlFor="category" className="text-xs font-bold uppercase tracking-widest text-gray-500">Category</Label>
                            </div>
                            <Select value={category} onValueChange={(val: any) => {
                                setCategory(val);
                                if (val !== 'addon') {
                                    setHasSpinner(false);
                                }
                            }}>
                                <SelectTrigger className="font-medium border-red-200 focus:ring-0 focus:border-red-600">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="base">Base Service</SelectItem>
                                    <SelectItem value="addon">Add-On</SelectItem>
                                    <SelectItem value="discount">Discount</SelectItem>
                                    <SelectItem value="priority">Priority Fee</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {category === 'discount' && (
                        <div className="border border-red-200/90 rounded-xl overflow-hidden bg-red-50/30 transition-all">
                            <button
                                type="button"
                                onClick={() => setExpandIdVerification(!expandIdVerification)}
                                className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-red-50/40 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <ShieldCheck size={14} className="text-red-500 shrink-0" />
                                    <div>
                                        <Label className="text-xs font-bold uppercase tracking-widest text-gray-700 cursor-pointer block leading-tight">
                                            ID Verification Setup
                                        </Label>
                                        <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                            {idVerificationType === 'none'
                                                ? 'No ID verification required'
                                                : `${idVerificationType === 'control_number' ? 'Control Number' : 'ID Number'} • ${idFormat === 'numbers' ? 'Numbers Only' : idFormat === 'letters' ? 'Letters Only' : 'Numbers & Letters'}${idDigits && parseInt(idDigits) > 0 ? ` (${idDigits} digits)` : ' (Flexible length)'}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors">
                                        {expandIdVerification ? 'Hide' : 'Configure'}
                                    </span>
                                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${expandIdVerification ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {expandIdVerification && (
                                <div className="p-3 pt-2.5 border-t border-red-100 space-y-2.5 animate-in fade-in duration-150 bg-white">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div className="space-y-1">
                                            <Label htmlFor="idVerificationType" className="text-[10.5px] font-bold text-gray-700">
                                                Verification Type
                                            </Label>
                                            <Select
                                                value={idVerificationType}
                                                onValueChange={(val: 'none' | 'control_number' | 'id_number') => {
                                                    setIdVerificationType(val);
                                                    if (val === 'control_number' && !idDigits) setIdDigits('6');
                                                    if (val === 'id_number' && !idDigits) setIdDigits('12');
                                                }}
                                            >
                                                <SelectTrigger id="idVerificationType" className="h-8 text-xs font-medium border-red-200 bg-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None (No ID Required)</SelectItem>
                                                    <SelectItem value="control_number">Control Number (e.g. Senior)</SelectItem>
                                                    <SelectItem value="id_number">ID Number (e.g. PWD)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="idFormat" className="text-[10.5px] font-bold text-gray-700">
                                                Allowed Characters
                                            </Label>
                                            <Select
                                                value={idFormat}
                                                disabled={idVerificationType === 'none'}
                                                onValueChange={(val: 'alphanumeric' | 'numbers' | 'letters') => setIdFormat(val)}
                                            >
                                                <SelectTrigger id="idFormat" className="h-8 text-xs font-medium border-red-200 bg-white disabled:bg-gray-100 disabled:text-gray-400">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="alphanumeric">Numbers & Letters</SelectItem>
                                                    <SelectItem value="numbers">Numbers Only</SelectItem>
                                                    <SelectItem value="letters">Letters Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="idDigits" className="text-[10.5px] font-bold text-gray-700">
                                                Digit Limit (Digits)
                                            </Label>
                                            <Input
                                                id="idDigits"
                                                type="number"
                                                min={1}
                                                max={30}
                                                disabled={idVerificationType === 'none'}
                                                value={idDigits}
                                                onChange={(e) => setIdDigits(e.target.value)}
                                                placeholder="e.g. 6, 12, or blank"
                                                className="h-8 text-xs font-medium border-red-200 bg-white disabled:bg-gray-100 disabled:text-gray-400 focus-visible:ring-0 focus-visible:border-red-600"
                                            />
                                        </div>
                                    </div>

                                    {idVerificationType !== 'none' && (
                                        <div className="bg-red-50/40 p-2 rounded-lg border border-red-100/80 text-[10.5px] text-gray-600 flex items-center justify-between">
                                            <span>
                                                Accepts: <strong className="font-semibold text-red-700">
                                                    {idFormat === 'numbers' ? 'Digits (0-9) only' : idFormat === 'letters' ? 'Alphabetical letters (A-Z) only' : 'Both letters and numbers'}
                                                </strong>
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-medium">
                                                {idDigits && parseInt(idDigits) > 0 ? `Exactly ${idDigits} characters` : 'Flexible length (no limit)'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {category !== 'discount' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="durationDays" className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                    Service Duration (Days)
                                </Label>
                                <p className="text-[10px] text-gray-400 mt-0 leading-tight min-h-[15px] truncate">
                                    {category === 'priority' ? 'Use negative values for rush reduction' : 'Positive values extend service duration'}
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
                                <p className="text-[10px] text-gray-400 mt-0 leading-tight min-h-[15px] truncate">
                                    Optional code indicator for the service
                                </p>
                                <Input
                                    id="serviceCode"
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600 uppercase"
                                    placeholder="e.g. BC"
                                />
                            </div>
                        </div>
                    )}

                    {/* Connected Add-ons section for Base Services */}
                    {category === 'base' && (
                        <div className="border border-gray-200/90 rounded-xl overflow-hidden bg-gray-50/40 transition-all">
                            <button
                                type="button"
                                onClick={() => setExpandBaseAddons(!expandBaseAddons)}
                                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50/80 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Sparkles size={14} className="text-red-500 shrink-0" />
                                    <div>
                                        <Label className="text-xs font-bold uppercase tracking-widest text-gray-700 cursor-pointer block leading-tight">
                                            Connected Add-ons
                                        </Label>
                                        <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                            {connectedAddons.length} of {availableAddons.length} add-on{availableAddons.length === 1 ? '' : 's'} connected
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors">
                                        {expandBaseAddons ? 'Hide' : 'Expand'}
                                    </span>
                                    <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${expandBaseAddons ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {expandBaseAddons && (
                                <div className="p-3 pt-2 border-t border-gray-100 space-y-2 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-400">
                                            Select which add-ons will be displayed in Job Orders when this service is selected.
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
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
                                </div>
                            )}
                        </div>
                    )}

                    {/* Connected Base Services & Add-ons for Priority Fees (Rush Fees) */}
                    {category === 'priority' && (
                        <div className="space-y-3 pt-1 pb-1">
                            {/* 1. Applicable Base Services (Collapsible) */}
                            <div className="border border-gray-200/90 rounded-xl overflow-hidden bg-gray-50/40 transition-all">
                                <button
                                    type="button"
                                    onClick={() => setExpandBaseServices(!expandBaseServices)}
                                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50/80 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Zap size={14} className="text-red-500 shrink-0" />
                                        <div>
                                            <Label className="text-xs font-bold uppercase tracking-widest text-gray-700 cursor-pointer block leading-tight">
                                                Applicable Base Services
                                            </Label>
                                            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                                {connectedBaseServices.length === 0 
                                                    ? "Applies to all base services (universal)" 
                                                    : `${connectedBaseServices.length} of ${availableBaseServices.length} base service${availableBaseServices.length === 1 ? '' : 's'} connected`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors">
                                            {expandBaseServices ? 'Hide' : 'Expand'}
                                        </span>
                                        <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${expandBaseServices ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {expandBaseServices && (
                                    <div className="p-3 pt-2 border-t border-gray-100 space-y-2 animate-in fade-in duration-150">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-400">
                                                Select which base service(s) this rush fee can be applied to.
                                            </span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={handleSelectAllBaseServices}
                                                    className="text-[10px] font-bold text-red-600 hover:text-red-800 uppercase px-1.5 py-0.5 rounded hover:bg-red-50 transition"
                                                >
                                                    All
                                                </button>
                                                <span className="text-gray-300 text-xs">|</span>
                                                <button
                                                    type="button"
                                                    onClick={handleClearAllBaseServices}
                                                    className="text-[10px] font-bold text-gray-500 hover:text-gray-700 uppercase px-1.5 py-0.5 rounded hover:bg-gray-100 transition"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        {availableBaseServices.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic py-2">No active base services available.</p>
                                        ) : (
                                            <div className="max-h-36 overflow-y-auto border border-red-100 rounded-xl p-2 bg-red-50/20 space-y-1.5 scrollbar-thin">
                                                {availableBaseServices.map((bs) => {
                                                    const isChecked = connectedBaseServices.includes(bs.name);
                                                    return (
                                                        <label
                                                            key={bs.id}
                                                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all border ${
                                                                isChecked 
                                                                    ? 'bg-red-50 border-red-200 text-red-900 font-bold shadow-2xs' 
                                                                    : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    onCheckedChange={() => toggleBaseService(bs.name)}
                                                                />
                                                                <span>{bs.name}</span>
                                                            </div>
                                                            <span className="text-[11px] font-semibold text-gray-500">
                                                                ₱{bs.price.toFixed(2)}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Applicable Add-on Services (Collapsible) */}
                            <div className="border border-gray-200/90 rounded-xl overflow-hidden bg-gray-50/40 transition-all">
                                <button
                                    type="button"
                                    onClick={() => setExpandPriorityAddons(!expandPriorityAddons)}
                                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50/80 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Sparkles size={14} className="text-red-500 shrink-0" />
                                        <div>
                                            <Label className="text-xs font-bold uppercase tracking-widest text-gray-700 cursor-pointer block leading-tight">
                                                Applicable Add-ons
                                            </Label>
                                            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                                {connectedAddons.length === 0 
                                                    ? "No add-on restrictions (or no add-ons required)" 
                                                    : `${connectedAddons.length} of ${availableAddons.length} add-on${availableAddons.length === 1 ? '' : 's'} connected`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors">
                                            {expandPriorityAddons ? 'Hide' : 'Expand'}
                                        </span>
                                        <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${expandPriorityAddons ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {expandPriorityAddons && (
                                    <div className="p-3 pt-2 border-t border-gray-100 space-y-2 animate-in fade-in duration-150">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-400">
                                                Select which add-on(s) are eligible under this rush fee.
                                            </span>
                                            <div className="flex items-center gap-1 shrink-0">
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
                                            <div className="max-h-36 overflow-y-auto border border-red-100 rounded-xl p-2 bg-red-50/20 space-y-1.5 scrollbar-thin">
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
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2 gap-4">
                        <div className={`flex items-center justify-between ${category === 'addon' ? 'flex-1' : 'w-full'}`}>
                            <Label htmlFor="active-status" className="text-sm font-bold text-gray-700 cursor-pointer">Active Status</Label>
                            <Switch
                                id="active-status"
                                checked={active}
                                onCheckedChange={setActive}
                                className="data-[state=checked]:bg-emerald-500"
                            />
                        </div>
                        {category === 'addon' && (
                            <div className="flex items-center justify-between flex-1 pl-4 border-l border-gray-200">
                                <div className="flex flex-col">
                                    <Label htmlFor="quantity-spinner" className="text-sm font-bold text-gray-700 cursor-pointer">Quantity Spinner</Label>
                                    <span className="text-[10px] text-gray-400">Allow item quantity</span>
                                </div>
                                <Switch
                                    id="quantity-spinner"
                                    checked={hasSpinner}
                                    onCheckedChange={setHasSpinner}
                                    className="data-[state=checked]:bg-red-600"
                                />
                            </div>
                        )}
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

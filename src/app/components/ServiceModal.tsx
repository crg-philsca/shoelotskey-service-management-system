import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { Service } from '@/app/types';

interface ServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    service?: Service | null;
    onSave: (service: Service) => void;
}

export default function ServiceModal({ isOpen, onClose, service, onSave }: ServiceModalProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState<'base' | 'addon' | 'priority'>('base');
    const [active, setActive] = useState(true);
    const [durationDays, setDurationDays] = useState('');
    const [code, setCode] = useState('');

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
            } else {
                // Reset for new service
                setName('');
                setPrice('');
                setCategory('base');
                setActive(true);
                setDurationDays('');
                setCode('');
            }
        }
    }, [isOpen, service]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !price) return;

        const newService: Service = {
            id: service?.id || Math.random().toString(36).substr(2, 9),
            name,
            price: parseFloat(price),
            category,
            active,
            ...(durationDays ? { durationDays: durationDays } : {}),
            ...(code ? { code } : {})
        };

        onSave(newService);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                        {service ? 'Edit Service' : 'Add New Service'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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
                                placeholder={category === 'priority' ? '-1' : '10 or 7-10'}
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

                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="active-status" className="text-sm font-bold text-gray-700">Active Status</Label>
                        <Switch
                            id="active-status"
                            checked={active}
                            onCheckedChange={setActive}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    </div>

                    <DialogFooter className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 font-bold text-xs border border-gray-300 bg-gray-200 hover:bg-gray-700 text-gray-700 hover:text-white transition-all">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-9 text-xs uppercase tracking-widest">
                            {service ? 'Save' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}


import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useInventory } from '@/app/context/InventoryContext';
import { Package, Plus, Minus, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { JobOrder, InventoryUsed } from '@/app/types';

interface StockUpdateModalProps {
    order: JobOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (orderId: string, updates: Partial<JobOrder>) => void;
}

export default function StockUpdateModal({ order, open, onOpenChange, onSave }: StockUpdateModalProps) {
    const { inventoryData, updateStock } = useInventory();
    const [inventoryUsed, setInventoryUsed] = useState<InventoryUsed[]>([]);
    const [selectedItem, setSelectedItem] = useState<string>('');
    const [isApplied, setIsApplied] = useState(false);

    useEffect(() => {
        if (order) {
            setInventoryUsed(order.inventoryUsed || []);
            setIsApplied(order.inventoryApplied || false);
        }
    }, [order, open]);

    const handleAddItem = (itemId: string) => {
        const item = inventoryData.find(i => i.id.toString() === itemId);
        if (!item) return;

        if (inventoryUsed.some(i => i.itemId === item.id)) {
            toast.error('Item already added');
            return;
        }

        setInventoryUsed(prev => [...prev, {
            itemId: item.id,
            name: item.name,
            quantity: 1,
            unit: item.unit
        }]);
        setSelectedItem('');
    };

    const handleUpdateQty = (itemId: number, delta: number) => {
        setInventoryUsed(prev => prev.map(i => 
            i.itemId === itemId ? { ...i, quantity: Math.max(0, parseFloat((i.quantity + delta).toFixed(2))) } : i
        ));
    };

    const handleRemoveItem = (itemId: number) => {
        setInventoryUsed(prev => prev.filter(i => i.itemId !== itemId));
    };

    const handleUpdateStock = async () => {
        if (!order || isApplied) return;

        const dbId = parseInt(order.id);
        inventoryUsed.forEach(item => {
            updateStock(item.itemId, item.quantity, isNaN(dbId) ? undefined : dbId);
        });

        setIsApplied(true);
        onSave(order.id, {
            inventoryUsed,
            inventoryApplied: true
        });
        toast.success('Stock levels updated and saved to order.');
        onOpenChange(false);
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                <DialogHeader className="bg-emerald-600 px-6 py-8 text-white text-center">
                    <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                        <Package size={24} className="text-white" />
                    </div>
                    <DialogTitle className="text-lg font-black uppercase tracking-widest">
                        Update Stock Inventory
                    </DialogTitle>
                    <p className="text-emerald-100 text-[11px] mt-1 font-bold uppercase tracking-wide">
                        Order #{order.orderNumber} • {order.customerName}
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {isApplied ? (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center space-y-3">
                            <div className="mx-auto w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={20} className="text-white" />
                            </div>
                            <h4 className="text-emerald-800 font-black uppercase text-xs tracking-widest">Stock Already Updated</h4>
                            <p className="text-emerald-600 text-[10px] font-medium leading-relaxed">
                                Materials for this order have already been deducted from the database inventory. 
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">
                                    Add Material / Supply
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Select value={selectedItem} onValueChange={setSelectedItem}>
                                            <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-emerald-500/20">
                                                <SelectValue placeholder="Select Supply or Chemical" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                                                {inventoryData.filter(i => i.isActive && i.stock > 0).map(item => (
                                                    <SelectItem key={item.id} value={item.id.toString()} className="text-xs font-medium py-2.5">
                                                        <div className="flex justify-between w-full gap-8">
                                                            <span>{item.name}</span>
                                                            <span className="text-gray-400">({item.stock} {item.unit} left)</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button 
                                        type="button" 
                                        onClick={() => handleAddItem(selectedItem)}
                                        disabled={!selectedItem}
                                        className="bg-emerald-600 hover:bg-emerald-700 h-11 w-11 p-0 rounded-xl shadow-lg shadow-emerald-100"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">
                                    Materials to Deduct ({inventoryUsed.length})
                                </label>
                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                                    {inventoryUsed.map((item) => (
                                        <div key={item.itemId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-emerald-200 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-gray-900">{item.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.unit}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
                                                    <button 
                                                        onClick={() => handleUpdateQty(item.itemId, -1)}
                                                        className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input 
                                                        type="number"
                                                        step="any"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setInventoryUsed(prev => prev.map(i => 
                                                                i.itemId === item.itemId ? { ...i, quantity: val } : i
                                                            ));
                                                        }}
                                                        className="text-xs font-black w-[40px] text-center bg-transparent border-none focus:ring-0 p-0"
                                                    />
                                                    <button 
                                                        onClick={() => handleUpdateQty(item.itemId, 1)}
                                                        className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveItem(item.itemId)}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {inventoryUsed.length === 0 && (
                                        <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                                            <Package size={32} className="text-gray-200 mx-auto mb-2" />
                                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">No supplies added yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="bg-gray-50/50 p-6 border-t border-gray-100 flex gap-3 sm:justify-center">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        className="flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-500 bg-white border border-gray-100 hover:bg-gray-100"
                    >
                        Close
                    </Button>
                    {!isApplied && (
                        <Button 
                            onClick={handleUpdateStock}
                            disabled={inventoryUsed.length === 0}
                            className="flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-100 active:scale-95 transition-all"
                        >
                            Subtract Stock
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

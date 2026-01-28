import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddExpense?: (expense: any) => void;
}

const EXPENSE_CATEGORIES = [
    'Water',
    'Internet',
    'Staff Salary',
    'Logistics',
    'Cleaning Materials',
    'Cleaning Aids',
    'Chemicals',
    'Food',
    'Other (Manual Insert)'
];

export default function AddExpenseModal({ isOpen, onClose, onAddExpense }: AddExpenseModalProps) {
    const [category, setCategory] = useState<string>('');
    const [customCategory, setCustomCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const finalCategory = category === 'Other (Manual Insert)' ? customCategory : category;

        if (!finalCategory || !amount) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (onAddExpense) {
            onAddExpense({
                id: Math.random().toString(36).substr(2, 9),
                category: finalCategory,
                amount: parseFloat(amount),
                date,
                notes
            });
        }

        toast.success(`Expense logged: ${finalCategory}`);
        onClose();
        // Reset form
        setCategory('');
        setCustomCategory('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setNotes('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-red-600 uppercase">Log New Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="category" className="text-xs font-bold uppercase tracking-widest text-gray-500">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger id="category" className="font-medium">
                                <SelectValue placeholder="Select expense type" />
                            </SelectTrigger>
                            <SelectContent>
                                {EXPENSE_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {category === 'Other (Manual Insert)' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <Label htmlFor="customCategory" className="text-xs font-bold uppercase tracking-widest text-gray-500">Custom Category Name</Label>
                            <Input
                                id="customCategory"
                                placeholder="e.g., Rent, Repair, etc."
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                className="font-medium"
                                required
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-widest text-gray-500">Amount</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{'\u20B1'}</span>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pl-7 font-bold text-red-600"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-xs font-bold uppercase tracking-widest text-gray-500">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="font-medium"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-widest text-gray-500">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add any additional details..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[80px] resize-none"
                        />
                    </div>

                    <DialogFooter className="pt-2 sm:justify-between">
                        <Button type="button" variant="outline" onClick={onClose} className="font-bold">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                            Record
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

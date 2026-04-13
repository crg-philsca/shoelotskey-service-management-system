import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddExpense?: (expense: any) => void;
    onEditExpense?: (id: string, expense: any) => void;
    initialData?: any | null;
}

const EXPENSE_CATEGORIES = [
    'Water (Monthly)',
    'Internet (Monthly)',
    'Staff Salary (Weekly)',
    'Staff Salary (Monthly)',
    'Logistics (Daily)',
    'Cleaning Materials (Monthly)',
    'Cleaning Aids (Monthly)',
    'Chemicals (Monthly)',
    'Food (Daily)',
    'Other (Manual Insert)'
];

const LABEL_STYLE = "text-[11px] font-bold text-gray-500 mb-1 block uppercase tracking-tight";
const INPUT_STYLE = "bg-[#F8F9FA] border-gray-100 h-9 text-xs focus:ring-red-50 focus:border-red-100 transition-all";

export default function AddExpenseModal({ isOpen, onClose, onAddExpense, onEditExpense, initialData }: AddExpenseModalProps) {
    const [category, setCategory] = useState<string>('');
    const [customCategory, setCustomCategory] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState('');

    // Pre-populate with current date and time or initialData
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const isCustom = !EXPENSE_CATEGORIES.includes(initialData.category);
                setCategory(isCustom ? 'Other (Manual Insert)' : initialData.category);
                if (isCustom) setCustomCategory(initialData.category);
                setAmount(formatAmount(initialData.amount.toString()));
                setNotes(initialData.notes || '');
                
                const d = new Date(initialData.date);
                if (!isNaN(d.getTime())) {
                    const offset = d.getTimezoneOffset() * 60000;
                    const localISO = new Date(d.getTime() - offset).toISOString();
                    setDate(localISO.slice(0, 10));
                    setTime(localISO.slice(11, 16));
                }
            } else {
                const now = new Date();
                const offset = now.getTimezoneOffset() * 60000;
                const localISO = new Date(now.getTime() - offset).toISOString();
                setDate(localISO.slice(0, 10)); // YYYY-MM-DD for date input
                setTime(localISO.slice(11, 16)); // HH:mm for time input (military)
                setCategory('');
                setCustomCategory('');
                setAmount('');
                setNotes('');
            }
        }
    }, [isOpen, initialData]);

    const formatAmount = (value: string) => {
        const cleanValue = value.replace(/,/g, '');
        const num = parseFloat(cleanValue);
        if (isNaN(num)) return '';
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9.]/g, '');

        // Allow only one decimal point
        const parts = val.split('.');
        if (parts.length > 2) return;

        // Format with commas as user types
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const formattedVal = parts.length > 1 ? `${integerPart}.${parts[1].slice(0, 2)}` : integerPart;

        setAmount(formattedVal);
    };

    const handleAmountBlur = () => {
        if (amount) {
            setAmount(formatAmount(amount));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const finalCategory = category === 'Other (Manual Insert)' ? customCategory : category;
        const finalAmount = parseFloat(amount.replace(/,/g, ''));

        if (!finalCategory || isNaN(finalAmount)) {
            toast.error('Please fill in all required fields');
            return;
        }

        const expensePayload = {
            id: initialData?.id || Math.random().toString(36).substr(2, 9),
            category: finalCategory,
            amount: finalAmount,
            date: `${date}T${time}`,
            notes
        };

        if (initialData && onEditExpense) {
            onEditExpense(initialData.id, expensePayload);
            toast.success(`Expense updated: ${finalCategory}`);
        } else if (onAddExpense) {
            onAddExpense(expensePayload);
            toast.success(`Expense logged: ${finalCategory}`);
        }

        onClose();
        // Reset form
        setCategory('');
        setCustomCategory('');
        setAmount('');
        setNotes('');
        setCategorySearch('');
    };

    const filteredCategories = EXPENSE_CATEGORIES.filter(cat =>
        cat.toLowerCase().includes(categorySearch.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-red-600 uppercase text-center w-full">
                        {initialData ? 'Edit Expense' : 'Log New Expense'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`space-y-2 ${category === 'Other (Manual Insert)' ? 'col-span-1' : 'col-span-2'}`}>
                            <Label htmlFor="category" className={LABEL_STYLE}>Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger id="category" className={INPUT_STYLE}>
                                    <SelectValue placeholder="Select expense type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-100 shadow-xl p-1">
                                    <div className="relative px-2 py-2 mb-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                        <input
                                            className="w-full pl-8 pr-4 py-1.5 bg-gray-50 border border-gray-100 rounded-md text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-red-100 transition-all"
                                            placeholder="Search categories..."
                                            value={categorySearch}
                                            onChange={(e) => setCategorySearch(e.target.value)}
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="max-h-[180px] overflow-y-auto">
                                        {filteredCategories.length > 0 ? (
                                            filteredCategories.map((cat) => (
                                                <SelectItem key={cat} value={cat} className="text-xs font-bold text-gray-600 focus:bg-red-100 focus:text-red-700">
                                                    {cat}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-[10px] text-gray-400 italic">No results</div>
                                        )}
                                    </div>
                                </SelectContent>
                            </Select>
                        </div>

                        {category === 'Other (Manual Insert)' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label htmlFor="customCategory" className={LABEL_STYLE}>Custom Category Name</Label>
                                <Input
                                    id="customCategory"
                                    placeholder="e.g., Rent, Repair, etc."
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    className={INPUT_STYLE}
                                    required
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-4 space-y-2">
                            <Label htmlFor="amount" className={LABEL_STYLE}>Amount</Label>
                            <div className="relative group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₱</span>
                                <Input
                                    id="amount"
                                    type="text"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    onBlur={handleAmountBlur}
                                    className={`${INPUT_STYLE} pl-7 font-bold text-red-600`}
                                    required
                                />
                            </div>
                        </div>
                        <div className="col-span-4 space-y-2">
                            <Label htmlFor="date" className={LABEL_STYLE}>Date <span className="lowercase opacity-70">(mm/dd/yyyy)</span></Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={`${INPUT_STYLE} accent-red-600`}
                                required
                            />
                        </div>
                        <div className="col-span-4 space-y-2">
                            <Label htmlFor="time" className={LABEL_STYLE}>Time <span className="lowercase opacity-70">(24h)</span></Label>
                            <Input
                                id="time"
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className={`${INPUT_STYLE} accent-red-600`}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes" className={LABEL_STYLE}>Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add any additional details..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[80px] bg-[#F8F9FA] border-gray-100 rounded-md p-3 text-xs focus:ring-red-50 focus:border-red-100 resize-none"
                        />
                    </div>

                    <DialogFooter className="pt-2 flex flex-row gap-3 sm:justify-between">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 font-bold text-xs border border-gray-300 bg-gray-200 hover:bg-gray-700 text-gray-700 hover:text-white transition-all uppercase tracking-widest">
                            CANCEL
                        </Button>
                        <Button type="submit" className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest">
                            {initialData ? 'SAVE CHANGES' : 'RECORD'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

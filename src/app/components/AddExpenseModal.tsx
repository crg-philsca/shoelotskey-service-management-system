import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Plus, Trash2, Users, Package } from 'lucide-react';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddExpense?: (expense: any) => void;
    onEditExpense?: (id: string, expense: any) => void;
    initialData?: any | null;
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
    'Rent',
    'Electricity',
    'Other (Manual Insert)'
];

const LABEL_STYLE = "text-[11px] font-bold text-gray-500 mb-1 block uppercase tracking-tight";
const INPUT_STYLE = "bg-[#F8F9FA] border-gray-100 h-9 text-xs focus:ring-red-50 focus:border-red-100 transition-all";

function FormattedDateInput({ value, onChange, className, id }: { value: string; onChange: (val: string) => void; className?: string; id?: string }) {
    const toDisplay = (iso: string) => {
        if (!iso) return '';
        const parts = iso.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return iso;
    };

    const [localVal, setLocalVal] = useState(toDisplay(value));

    useEffect(() => {
        setLocalVal(toDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputVal = e.target.value;
        let digits = inputVal.replace(/[^0-9]/g, '');
        if (digits.length > 8) digits = digits.substring(0, 8);

        let formatted = digits;
        if (digits.length > 2) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2);
        }
        if (digits.length > 4) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4);
        }

        setLocalVal(formatted);

        if (digits.length === 8) {
            const mm = digits.substring(0, 2);
            const dd = digits.substring(2, 4);
            const yyyy = digits.substring(4, 8);
            const iso = `${yyyy}-${mm}-${dd}`;
            const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            if (!isNaN(dateObj.getTime())) {
                onChange(iso);
            }
        }
    };

    return (
        <Input
            id={id}
            type="text"
            placeholder="MM/DD/YYYY"
            value={localVal}
            onChange={handleChange}
            className={className}
        />
    );
}

export default function AddExpenseModal({ isOpen, onClose, onAddExpense, onEditExpense, initialData }: AddExpenseModalProps) {
    const [category, setCategory] = useState<string>('');
    const [customCategory, setCustomCategory] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [amount, setAmount] = useState('');
    const [frequency, setFrequency] = useState<string>('Monthly');
    const [customFrequency, setCustomFrequency] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState('');

    // Dynamic itemized lists for specialized categories
    const [staffItems, setStaffItems] = useState<{ id: string; name: string; role: string; amount: string }[]>([]);
    const [supplyItems, setSupplyItems] = useState<{ id: string; name: string; price: string }[]>([]);

    // Pre-populate with current date and time or initialData
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                let cat = initialData.category;
                // Clean legacy tags like "(Monthly)" if present when editing
                const cleanCat = cat.replace(/\s*\((Monthly|Daily|Weekly|Quarterly|Yearly)\)/gi, '');
                const isCustom = !EXPENSE_CATEGORIES.includes(cleanCat);
                setCategory(isCustom ? 'Other (Manual Insert)' : cleanCat);
                if (isCustom) setCustomCategory(cleanCat);
                
                setAmount(formatAmount(initialData.amount.toString()));
                
                const freq = initialData.frequency || 'Monthly';
                if (['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Yearly', 'One-Time'].includes(freq)) {
                    setFrequency(freq);
                } else {
                    setFrequency('Custom (Specify)');
                    setCustomFrequency(freq);
                }
                
                setNotes(initialData.notes || '');
                setStaffItems([]);
                setSupplyItems([]);
                
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
                setDate(localISO.slice(0, 10));
                setTime(localISO.slice(11, 16));
                setCategory('');
                setCustomCategory('');
                setAmount('');
                setFrequency('Monthly');
                setCustomFrequency('');
                setNotes('');
                setStaffItems([]);
                setSupplyItems([]);
            }
        }
    }, [isOpen, initialData]);

    const handleCategorySelect = (selectedCat: string) => {
        setCategory(selectedCat);
        if (selectedCat === 'Staff Salary' && staffItems.length === 0) {
            setStaffItems([{ id: Math.random().toString(), name: '', role: 'Technician', amount: '' }]);
            setFrequency('Weekly');
        } else if (['Cleaning Materials', 'Cleaning Aids', 'Chemicals'].includes(selectedCat) && supplyItems.length === 0) {
            setSupplyItems([{ id: Math.random().toString(), name: '', price: '' }]);
            setFrequency('Monthly');
        }
    };

    const formatAmount = (value: string) => {
        const cleanValue = value.replace(/,/g, '');
        const num = parseFloat(cleanValue);
        if (isNaN(num)) return '';
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9.]/g, '');
        const parts = val.split('.');
        if (parts.length > 2) return;
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const formattedVal = parts.length > 1 ? `${integerPart}.${parts[1].slice(0, 2)}` : integerPart;
        setAmount(formattedVal);
    };

    const handleAmountBlur = () => {
        if (amount) {
            setAmount(formatAmount(amount));
        }
    };

    // Auto calculate amount when itemized lists change
    const updateStaffItem = (id: string, field: string, value: string) => {
        const updated = staffItems.map(item => item.id === id ? { ...item, [field]: value } : item);
        setStaffItems(updated);
        if (field === 'amount') {
            const total = updated.reduce((sum, item) => sum + (parseFloat(item.amount.replace(/,/g, '')) || 0), 0);
            if (total > 0) setAmount(formatAmount(total.toString()));
        }
    };

    const updateSupplyItem = (id: string, field: string, value: string) => {
        const updated = supplyItems.map(item => item.id === id ? { ...item, [field]: value } : item);
        setSupplyItems(updated);
        if (field === 'price') {
            const total = updated.reduce((sum, item) => sum + (parseFloat(item.price.replace(/,/g, '')) || 0), 0);
            if (total > 0) setAmount(formatAmount(total.toString()));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const finalCategory = category === 'Other (Manual Insert)' ? customCategory : category;
        const finalAmount = parseFloat(amount.replace(/,/g, ''));
        const finalFrequency = frequency === 'Custom (Specify)' ? customFrequency : frequency;

        if (!finalCategory || isNaN(finalAmount)) {
            toast.error('Please fill in all required fields and enter a valid amount');
            return;
        }

        // Compile itemized lists into notes for pristine data preservation
        let compiledNotes = notes;
        if (category === 'Staff Salary' && staffItems.length > 0 && staffItems.some(i => i.name || i.amount)) {
            const breakdown = "[STAFF PAYROLL ALLOCATION]\n" + staffItems.filter(i => i.name || i.amount).map(s => 
                `• ${s.name || 'Unnamed Staff'} (${s.role || 'Staff'}): ₱${parseFloat(s.amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ).join('\n');
            compiledNotes = breakdown + (notes ? `\n\n[ADDITIONAL NOTES]\n${notes}` : '');
        } else if (['Cleaning Materials', 'Cleaning Aids', 'Chemicals'].includes(category) && supplyItems.length > 0 && supplyItems.some(i => i.name || i.price)) {
            const breakdown = `[${category.toUpperCase()} ITEMIZED BREAKDOWN]\n` + supplyItems.filter(i => i.name || i.price).map(i => 
                `• ${i.name || 'Unnamed Item'}: ₱${parseFloat(i.price || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ).join('\n');
            compiledNotes = breakdown + (notes ? `\n\n[ADDITIONAL NOTES]\n${notes}` : '');
        }

        const expensePayload = {
            id: initialData?.id || Math.random().toString(36).substr(2, 9),
            category: finalCategory,
            amount: finalAmount,
            frequency: finalFrequency || 'One-Time',
            date: `${date}T${time}`,
            notes: compiledNotes
        };

        if (initialData && onEditExpense) {
            onEditExpense(initialData.id, expensePayload);
            toast.success(`Expense updated: ${finalCategory}`);
        } else if (onAddExpense) {
            onAddExpense(expensePayload);
            toast.success(`Expense logged: ${finalCategory}`);
        }

        onClose();
        setCategory('');
        setCustomCategory('');
        setAmount('');
        setNotes('');
        setCategorySearch('');
    };

    const filteredCategories = EXPENSE_CATEGORIES.filter(cat =>
        cat.toLowerCase().includes(categorySearch.toLowerCase())
    );

    const isStaffSalary = category === 'Staff Salary';
    const isSupplyCategory = ['Cleaning Materials', 'Cleaning Aids', 'Chemicals'].includes(category);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-red-600 uppercase text-center w-full">
                        {initialData ? 'Edit Expense' : 'Log New Expense'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`space-y-2 ${category === 'Other (Manual Insert)' ? 'col-span-1' : 'col-span-2'}`}>
                            <Label htmlFor="category" className={LABEL_STYLE}>Category</Label>
                            <Select value={category} onValueChange={handleCategorySelect}>
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
                                    <div className="max-h-[200px] overflow-y-auto">
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
                                    placeholder="e.g., Repair, Tools, etc."
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    className={INPUT_STYLE}
                                    required
                                />
                            </div>
                        )}
                    </div>

                    {/* DYNAMIC SECTION: Staff Salary Itemization */}
                    {isStaffSalary && (
                        <div className="bg-red-50/50 border border-red-100 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                                    <Users className="h-4 w-4 text-red-600" /> Staff Payroll Allocation
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStaffItems([...staffItems, { id: Math.random().toString(), name: '', role: 'Technician', amount: '' }])}
                                    className="h-7 text-[10px] bg-white border-red-200 text-red-700 hover:bg-red-600 hover:text-white font-black uppercase tracking-wider rounded-lg px-2.5 shadow-xs transition-all"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Staff
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {staffItems.map((item) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-red-100 shadow-xs">
                                        <div className="col-span-5">
                                            <Input
                                                placeholder="Staff Name / Username"
                                                value={item.name}
                                                onChange={(e) => updateStaffItem(item.id, 'name', e.target.value)}
                                                className="h-8 text-xs bg-gray-50 border-gray-100 font-semibold"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <Select value={item.role} onValueChange={(val) => updateStaffItem(item.id, 'role', val)}>
                                                <SelectTrigger className="h-8 text-[11px] bg-gray-50 border-gray-100 font-bold text-gray-700">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Technician">Technician</SelectItem>
                                                    <SelectItem value="Cleaner">Cleaner</SelectItem>
                                                    <SelectItem value="Manager">Manager</SelectItem>
                                                    <SelectItem value="Staff">Staff</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-3">
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₱</span>
                                                <Input
                                                    placeholder="0.00"
                                                    value={item.amount}
                                                    onChange={(e) => updateStaffItem(item.id, 'amount', e.target.value)}
                                                    className="h-8 text-xs bg-gray-50 border-gray-100 pl-5 font-bold text-red-600"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            {staffItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const remaining = staffItems.filter(s => s.id !== item.id);
                                                        setStaffItems(remaining);
                                                        const total = remaining.reduce((sum, s) => sum + (parseFloat(s.amount.replace(/,/g, '')) || 0), 0);
                                                        setAmount(formatAmount(total.toString()));
                                                    }}
                                                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium italic">Tip: Entering amounts automatically calculates the Total Expense Amount above.</p>
                        </div>
                    )}

                    {/* DYNAMIC SECTION: Cleaning Supplies / Chemicals Itemization */}
                    {isSupplyCategory && (
                        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                                    <Package className="h-4 w-4 text-amber-600" /> {category} Items Breakdown
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSupplyItems([...supplyItems, { id: Math.random().toString(), name: '', price: '' }])}
                                    className="h-7 text-[10px] bg-white border-amber-200 text-amber-800 hover:bg-amber-600 hover:text-white font-black uppercase tracking-wider rounded-lg px-2.5 shadow-xs transition-all"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Item
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {supplyItems.map((item) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-amber-100 shadow-xs">
                                        <div className="col-span-7">
                                            <Input
                                                placeholder="Item Name (e.g. Sole Sauce x2, Horsehair Brush)"
                                                value={item.name}
                                                onChange={(e) => updateSupplyItem(item.id, 'name', e.target.value)}
                                                className="h-8 text-xs bg-gray-50 border-gray-100 font-semibold"
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₱</span>
                                                <Input
                                                    placeholder="0.00"
                                                    value={item.price}
                                                    onChange={(e) => updateSupplyItem(item.id, 'price', e.target.value)}
                                                    className="h-8 text-xs bg-gray-50 border-gray-100 pl-6 font-bold text-amber-700"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            {supplyItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const remaining = supplyItems.filter(s => s.id !== item.id);
                                                        setSupplyItems(remaining);
                                                        const total = remaining.reduce((sum, s) => sum + (parseFloat(s.price.replace(/,/g, '')) || 0), 0);
                                                        setAmount(formatAmount(total.toString()));
                                                    }}
                                                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium italic">Tip: Entering individual item prices automatically totals up the amount.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-3 space-y-2">
                            <Label htmlFor="amount" className={LABEL_STYLE}>Total Amount</Label>
                            <div className="relative group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₱</span>
                                <Input
                                    id="amount"
                                    type="text"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    onBlur={handleAmountBlur}
                                    className={`${INPUT_STYLE} pl-7 font-bold text-red-600 text-sm`}
                                    required
                                />
                            </div>
                        </div>
                        <div className="col-span-4 space-y-2">
                            <Label htmlFor="frequency" className={LABEL_STYLE}>Frequency</Label>
                            <Select value={frequency} onValueChange={setFrequency}>
                                <SelectTrigger id="frequency" className={INPUT_STYLE}>
                                    <SelectValue placeholder="Select Frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Daily" className="font-medium text-xs">Daily</SelectItem>
                                    <SelectItem value="Weekly" className="font-medium text-xs">Weekly</SelectItem>
                                    <SelectItem value="Bi-Weekly" className="font-medium text-xs">Bi-Weekly</SelectItem>
                                    <SelectItem value="Monthly" className="font-medium text-xs">Monthly</SelectItem>
                                    <SelectItem value="Quarterly" className="font-medium text-xs">Quarterly</SelectItem>
                                    <SelectItem value="Yearly" className="font-medium text-xs">Yearly</SelectItem>
                                    <SelectItem value="One-Time" className="font-medium text-xs">One-Time</SelectItem>
                                    <SelectItem value="Custom (Specify)" className="font-bold text-xs text-red-600">Custom (Specify)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {frequency === 'Custom (Specify)' ? (
                            <div className="col-span-5 space-y-2 animate-in fade-in duration-200">
                                <Label htmlFor="customFrequency" className={LABEL_STYLE}>Custom Interval</Label>
                                <Input
                                    id="customFrequency"
                                    placeholder="e.g. Every 3 days, 15th & 30th"
                                    value={customFrequency}
                                    onChange={(e) => setCustomFrequency(e.target.value)}
                                    className={INPUT_STYLE}
                                    required
                                />
                            </div>
                        ) : (
                            <div className="col-span-5 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label htmlFor="date" className={LABEL_STYLE}>Date</Label>
                                        <FormattedDateInput
                                            id="date"
                                            value={date}
                                            onChange={(val) => setDate(val)}
                                            className={`${INPUT_STYLE}`}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="time" className={LABEL_STYLE}>Time</Label>
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
                            </div>
                        )}
                    </div>
                    
                    {frequency === 'Custom (Specify)' && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                            <div>
                                <Label htmlFor="date_custom" className={LABEL_STYLE}>Date <span className="lowercase opacity-70">(mm/dd/yyyy)</span></Label>
                                <FormattedDateInput
                                    id="date_custom"
                                    value={date}
                                    onChange={(val) => setDate(val)}
                                    className={`${INPUT_STYLE}`}
                                />
                            </div>
                            <div>
                                <Label htmlFor="time_custom" className={LABEL_STYLE}>Time <span className="lowercase opacity-70">(24h)</span></Label>
                                <Input
                                    id="time_custom"
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className={`${INPUT_STYLE} accent-red-600`}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="notes" className={LABEL_STYLE}>Additional Notes & Remarks (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add any additional details, invoice numbers, or payment memos..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[70px] bg-[#F8F9FA] border-gray-100 rounded-md p-3 text-xs focus:ring-red-50 focus:border-red-100 resize-none"
                        />
                    </div>

                    <DialogFooter className="pt-2 flex flex-row gap-3 sm:justify-between">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 font-bold text-xs border border-gray-300 bg-gray-200 hover:bg-gray-700 text-gray-700 hover:text-white transition-all uppercase tracking-widest">
                            CANCEL
                        </Button>
                        <Button type="submit" className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-200">
                            {initialData ? 'SAVE CHANGES' : 'RECORD EXPENSE'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

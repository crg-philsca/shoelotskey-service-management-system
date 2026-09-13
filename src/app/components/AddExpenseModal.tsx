import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Plus, Trash2, Users, Package } from 'lucide-react';
import {
    INVENTORY_EXPENSE_CATEGORIES,
    OPERATIONAL_EXPENSE_CATEGORIES,
    OTHER_EXPENSE_CATEGORIES,
    EXPENSE_CATEGORIES,
    cleanExpenseCategory,
} from '@/app/lib/expenseCategories';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddExpense?: (expense: any) => void;
    onEditExpense?: (id: string, expense: any) => void;
    initialData?: any | null;
}

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

function parseExpenseNotesToBreakdown(rawNotes: string, cat: string) {
    if (!rawNotes) return { parsedSupply: [], parsedStaff: [], cleanNotes: '' };

    const parsedSupply: { id: string; name: string; price: string }[] = [];
    const parsedStaff: { id: string; name: string; role: string; amount: string }[] = [];
    let cleanNotes = rawNotes;

    const breakdownHeaderRegex = /\[(.*?(?:BREAKDOWN|PAYROLL ALLOCATION))\]/i;
    const headerMatch = rawNotes.match(breakdownHeaderRegex);

    if (headerMatch && headerMatch.index !== undefined) {
        const afterHeader = rawNotes.substring(headerMatch.index + headerMatch[0].length);
        const addNotesRegex = /\[ADDITIONAL NOTES\]/i;
        const addNotesMatch = afterHeader.match(addNotesRegex);

        let breakdownBlock = '';
        if (addNotesMatch && addNotesMatch.index !== undefined) {
            breakdownBlock = afterHeader.substring(0, addNotesMatch.index);
            cleanNotes = afterHeader.substring(addNotesMatch.index + addNotesMatch[0].length).trim();
        } else {
            const lines = afterHeader.split('\n');
            const bulletLines: string[] = [];
            const remainderLines: string[] = [];
            let inBullets = true;
            for (const l of lines) {
                const tr = l.trim();
                if (!tr) continue;
                if (tr.startsWith('•') || tr.startsWith('-') || tr.startsWith('*')) {
                    if (inBullets) bulletLines.push(tr);
                    else remainderLines.push(l);
                } else {
                    inBullets = false;
                    remainderLines.push(l);
                }
            }
            breakdownBlock = bulletLines.join('\n');
            cleanNotes = remainderLines.join('\n').trim();
        }

        const bulletLines = breakdownBlock.split('\n');
        for (const line of bulletLines) {
            const trimmed = line.trim().replace(/^[•\-\*]\s*/, '');
            if (!trimmed) continue;

            if (cat === 'Staff Salary') {
                const staffMatch = trimmed.match(/^(.*?)(?:\s*\((.*?)\))?:\s*(?:₱|PHP|P)?\s*([\d,]+(?:\.\d+)?)/i);
                if (staffMatch) {
                    parsedStaff.push({
                        id: Math.random().toString(),
                        name: staffMatch[1].trim(),
                        role: staffMatch[2]?.trim() || 'Technician',
                        amount: staffMatch[3].replace(/,/g, '')
                    });
                    continue;
                }
            }

            const supplyMatch = trimmed.match(/^(.*?):\s*(?:₱|PHP|P)?\s*([\d,]+(?:\.\d+)?)/i);
            if (supplyMatch) {
                parsedSupply.push({
                    id: Math.random().toString(),
                    name: supplyMatch[1].trim(),
                    price: supplyMatch[2].replace(/,/g, '')
                });
            }
        }
    }

    return { parsedSupply, parsedStaff, cleanNotes };
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

    // Pre-populate with current date and time or initialData
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                let cat = initialData.category;
                // Clean legacy tags like "(Monthly)" if present when editing
                const cleanCat = cleanExpenseCategory(cat);
                const isCustom = !(EXPENSE_CATEGORIES as readonly string[]).includes(cleanCat);
                setCategory(isCustom ? 'Other (Manual Insert)' : cleanCat);
                if (isCustom) setCustomCategory(cleanCat);
                
                setAmount(formatAmount(initialData.amount.toString()));
                
                const freq = initialData.frequency || 'Monthly';
                if (['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Yearly', 'One-Time', 'Restock'].includes(freq)) {
                    setFrequency(freq);
                } else {
                    setFrequency('Custom (Specify)');
                    setCustomFrequency(freq);
                }
                
                const { parsedSupply, parsedStaff, cleanNotes } = parseExpenseNotesToBreakdown(initialData.notes || '', cleanCat);
                setNotes(cleanNotes);

                if (cleanCat === 'Staff Salary') {
                    setStaffItems(parsedStaff.length > 0 ? parsedStaff : [{ id: Math.random().toString(), name: '', role: 'Technician', amount: '' }]);
                    setSupplyItems([]);
                } else if ((INVENTORY_EXPENSE_CATEGORIES as readonly string[]).includes(cleanCat)) {
                    setSupplyItems(parsedSupply.length > 0 ? parsedSupply : [{ id: Math.random().toString(), name: '', price: '' }]);
                    setStaffItems([]);
                } else {
                    setStaffItems([]);
                    setSupplyItems([]);
                }
                
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
        } else if ((INVENTORY_EXPENSE_CATEGORIES as readonly string[]).includes(selectedCat) && supplyItems.length === 0) {
            setSupplyItems([{ id: Math.random().toString(), name: '', price: '' }]);
            setFrequency('One-Time');
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);

        try {
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
                    `• ${s.name || 'Unnamed Staff'} (${s.role || 'Staff'}): ₱${parseFloat(s.amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ).join('\n');
                compiledNotes = breakdown + (notes ? `\n\n[ADDITIONAL NOTES]\n${notes}` : '');
            } else if ((INVENTORY_EXPENSE_CATEGORIES as readonly string[]).includes(category) && supplyItems.length > 0 && supplyItems.some(i => i.name || i.price)) {
                const breakdown = `[${category.toUpperCase()} ITEMIZED BREAKDOWN]\n` + supplyItems.filter(i => i.name || i.price).map(i => 
                    `• ${i.name || 'Unnamed Item'}: ₱${parseFloat(i.price || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                await onEditExpense(initialData.id, expensePayload);
                toast.success(`Expense updated: ${finalCategory}`);
            } else if (onAddExpense) {
                await onAddExpense(expensePayload);
                toast.success(`Expense logged: ${finalCategory}`);
            }

            onClose();
            setCategory('');
            setCustomCategory('');
            setAmount('');
            setNotes('');
            setCategorySearch('');
        } catch (err: any) {
            console.error('[EXPENSE SUBMIT ERROR]', err);
            toast.error(err?.message || 'Failed to save expense');
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const searchLow = categorySearch.toLowerCase().trim();
    const filteredInv = INVENTORY_EXPENSE_CATEGORIES.filter(cat => cat.toLowerCase().includes(searchLow));
    const filteredOp = OPERATIONAL_EXPENSE_CATEGORIES.filter(cat => cat.toLowerCase().includes(searchLow));
    const filteredOth = OTHER_EXPENSE_CATEGORIES.filter(cat => cat.toLowerCase().includes(searchLow));
    const hasAnyResults = filteredInv.length > 0 || filteredOp.length > 0 || filteredOth.length > 0;

    const isStaffSalary = category === 'Staff Salary';
    const isSupplyCategory = (INVENTORY_EXPENSE_CATEGORIES as readonly string[]).includes(category);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 rounded-2xl border-0 shadow-2xl bg-white overflow-hidden">
                <DialogHeader className="p-6 pb-3 border-b border-gray-100 shrink-0">
                    <DialogTitle className="text-xl font-bold text-red-600 uppercase text-center w-full">
                        {initialData ? 'Edit Expense' : 'Log New Expense'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Form to log or edit business expenses</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="overflow-y-auto p-6 pt-4 space-y-4 flex-1 min-h-0 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                        <div className={`space-y-2 ${category === 'Other (Manual Insert)' ? 'col-span-1' : 'col-span-2'}`}>
                            <Label htmlFor="category" className={LABEL_STYLE}>Category</Label>
                            <Select value={category} onValueChange={handleCategorySelect}>
                                <SelectTrigger id="category" className={INPUT_STYLE}>
                                    <SelectValue placeholder="Select expense type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-100 shadow-xl p-1 max-w-[340px] sm:max-w-[420px]">
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
                                    <div className="max-h-[240px] overflow-y-auto pr-1">
                                        {filteredInv.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel className="text-[10px] font-black uppercase text-amber-800 bg-amber-50 px-2 py-1 rounded-md mb-1 tracking-wider flex items-center gap-1">
                                                    📦 Inventory Expenses
                                                </SelectLabel>
                                                {filteredInv.map((cat) => (
                                                    <SelectItem key={cat} value={cat} className="text-xs font-semibold text-gray-700 pl-3 focus:bg-amber-50 focus:text-amber-900 cursor-pointer">
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {filteredOp.length > 0 && (
                                            <SelectGroup className="mt-2">
                                                <SelectLabel className="text-[10px] font-black uppercase text-blue-800 bg-blue-50 px-2 py-1 rounded-md mb-1 tracking-wider flex items-center gap-1">
                                                    🏢 Operational Expenses
                                                </SelectLabel>
                                                {filteredOp.map((cat) => (
                                                    <SelectItem key={cat} value={cat} className="text-xs font-semibold text-gray-700 pl-3 focus:bg-blue-50 focus:text-blue-900 cursor-pointer">
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {filteredOth.length > 0 && (
                                            <SelectGroup className="mt-2">
                                                <SelectLabel className="text-[10px] font-black uppercase text-purple-800 bg-purple-50 px-2 py-1 rounded-md mb-1 tracking-wider flex items-center gap-1">
                                                    🏷️ Other Expenses
                                                </SelectLabel>
                                                {filteredOth.map((cat) => (
                                                    <SelectItem key={cat} value={cat} className="text-xs font-semibold text-gray-700 pl-3 focus:bg-purple-50 focus:text-purple-900 cursor-pointer">
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {!hasAnyResults && (
                                            <div className="px-4 py-3 text-[11px] text-gray-400 italic text-center">No categories matching &quot;{categorySearch}&quot;</div>
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
                                    <SelectItem value="Restock" className="font-bold text-xs text-amber-800">Restock</SelectItem>
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
                    </div>

                    <DialogFooter className="p-5 py-3.5 border-t border-gray-100 bg-gray-50/70 shrink-0 flex flex-row gap-3 sm:justify-between">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-10 font-bold text-xs border border-gray-300 bg-gray-200 hover:bg-gray-700 text-gray-700 hover:text-white transition-all uppercase tracking-widest rounded-xl">
                            CANCEL
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-200 disabled:opacity-50 rounded-xl">
                            {isSubmitting ? 'SAVING...' : initialData ? 'SAVE CHANGES' : 'RECORD EXPENSE'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

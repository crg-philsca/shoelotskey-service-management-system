import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useExpenses } from '@/app/context/ExpenseContext';
import { ArrowLeft, ChevronLeft, PlusCircle, Receipt, Calendar as CalendarIcon, ChevronRight, Filter, Search, ChevronDown, Wallet, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import AddExpenseModal from '@/app/components/AddExpenseModal';
import ExpenseDetailModal from '@/app/components/ExpenseDetailModal';
import { EXPENSE_FILTER_CATEGORIES, cleanExpenseCategory } from '@/app/lib/expenseCategories';
import { isDateInRange, type ReportRange } from '@/app/lib/salesAnalytics';



type ExpensesProps = {
    onSetHeaderActionRight?: (action: ReactNode | null) => void;
    user: { token: string; role?: string };
};

function FormattedDateInput({ value, onChange, className, id }: { value: string; onChange: (val: string) => void; className?: string; id?: string }) {
    const hiddenDateRef = useRef<HTMLInputElement>(null);
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

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isoVal = e.target.value;
        if (isoVal) {
            setLocalVal(toDisplay(isoVal));
            onChange(isoVal);
        }
    };

    const openPicker = () => {
        if (hiddenDateRef.current) {
            if (typeof hiddenDateRef.current.showPicker === 'function') {
                hiddenDateRef.current.showPicker();
            } else {
                hiddenDateRef.current.click();
            }
        }
    };

    return (
        <div className="relative w-full flex items-center">
            <Input
                id={id}
                type="text"
                placeholder="MM/DD/YYYY"
                value={localVal}
                onChange={handleChange}
                className={`${className || ''} pr-8 text-left`}
            />
            <button
                type="button"
                onClick={openPicker}
                title="Select date"
                className="absolute right-2.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-0.5"
            >
                <CalendarIcon size={14} />
            </button>
            <input
                ref={hiddenDateRef}
                type="date"
                value={value || ''}
                onChange={handlePickerChange}
                className="sr-only absolute pointer-events-none opacity-0"
                tabIndex={-1}
            />
        </div>
    );
}

export default function Expenses({ onSetHeaderActionRight, user }: ExpensesProps) {
    useEffect(() => {
        // [OWASP A09] Security Audit: Logging view access with token context
        if (user.token) {
            console.log('[SECURITY] Expenses accessed by authenticated session');
        }
    }, [user.token]);

    const navigate = useNavigate();
    const location = useLocation();
    const { expenses, addExpense, updateExpense, removeExpense } = useExpenses();
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [viewingExpense, setViewingExpense] = useState<any | null>(null);
    const [expenseToEdit, setExpenseToEdit] = useState<any | null>(null);
    const [expenseToDelete, setExpenseToDelete] = useState<any | null>(null);
    const [profitRange, setProfitRange] = useState<ReportRange>(() => {
        return (location.state as any)?.dateRange || 'Daily';
    });
    const [customStartDate, setCustomStartDate] = useState<string>(() => {
        return (location.state as any)?.customStartDate || '';
    });
    const [customEndDate, setCustomEndDate] = useState<string>(() => {
        return (location.state as any)?.customEndDate || '';
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;



    const formatNumericDate = (value: string | number | Date) => {
        const d = new Date(value);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${mm}/${dd}/${yy} ${hh}:${min}`;
    };

    const filteredFilterCategories = useMemo(
        () =>
            EXPENSE_FILTER_CATEGORIES.filter((cat) =>
                cat.toLowerCase().includes(categorySearch.toLowerCase())
            ),
        [categorySearch]
    );

    useEffect(() => {
        if (!onSetHeaderActionRight) return;

        const rangeMenu = (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="Select range"
                        className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <CalendarIcon className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline truncate mx-1 flex-1 text-center">{profitRange}</span>
                        <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 min-w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
                    {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Custom'].map((range) => (
                        <DropdownMenuItem
                            key={range}
                            onClick={() => setProfitRange(range as typeof profitRange)}
                            className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer ${profitRange === range
                                ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white'
                                : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'
                                }`}
                        >
                            {range}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );

        onSetHeaderActionRight(
            <div className="flex items-center gap-2">
                {profitRange === 'Custom' && (
                    <div className="hidden lg:flex items-center gap-1">
                        <input type="date" aria-label="Custom start date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-xs" />
                        <span className="text-xs text-gray-500">–</span>
                        <input type="date" aria-label="Custom end date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-xs" />
                        <button
                            type="button"
                            className="h-10 px-2 text-sm font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 hover:text-red-700"
                            onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setProfitRange('Daily'); }}
                        >
                            Clear
                        </button>
                    </div>
                )}
                {rangeMenu}
            </div>
        );

        return () => onSetHeaderActionRight(null);
    }, [onSetHeaderActionRight, profitRange, customStartDate, customEndDate]);

    const filteredExpenses = useMemo(() => {
        const now = new Date();
        let filtered = expenses
            .filter((exp) => isDateInRange(new Date(exp.date), profitRange, now, customStartDate, customEndDate))
            .map((exp) => ({ ...exp, parsedDate: new Date(exp.date) }));

        if (filterCategory !== 'all') {
            filtered = filtered.filter((exp) => cleanExpenseCategory(exp.category) === filterCategory);
        }

        if (startDate) {
            const start = new Date(startDate);
            filtered = filtered.filter((exp) => exp.parsedDate >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter((exp) => exp.parsedDate <= end);
        }

        if (minAmount) {
            const min = parseFloat(minAmount);
            if (!Number.isNaN(min)) {
                filtered = filtered.filter((exp) => exp.amount >= min);
            }
        }
        if (maxAmount) {
            const max = parseFloat(maxAmount);
            if (!Number.isNaN(max)) {
                filtered = filtered.filter((exp) => exp.amount <= max);
            }
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (exp) =>
                    exp.category.toLowerCase().includes(query) ||
                    (exp.notes ? exp.notes.toLowerCase().includes(query) : false)
            );
        }

        filtered.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

        return filtered;
    }, [expenses, profitRange, customStartDate, customEndDate, filterCategory, startDate, endDate, minAmount, maxAmount, searchQuery]);

    const totalExpensesFiltered = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-6">
            {profitRange === 'Custom' && (
                <div className="flex flex-wrap items-end justify-center gap-2 rounded-xl border border-red-100 bg-red-50/60 p-3 lg:hidden">
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Start date</span>
                        <input type="date" aria-label="Custom start date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-2 text-xs" />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">End date</span>
                        <input type="date" aria-label="Custom end date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-2 text-xs" />
                    </label>
                    <button
                        type="button"
                        className="h-10 px-3 text-sm font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 hover:text-red-700"
                        onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setProfitRange('Daily'); }}
                    >
                        Clear
                    </button>
                </div>
            )}
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-none shadow-lg bg-gradient-to-br from-red-50 to-white overflow-hidden">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-red-100 text-red-600">
                                <Wallet size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Total Expenses</p>
                        </div>
                        <p className="text-4xl font-black text-red-600 tracking-tight">₱{totalExpensesFiltered.toLocaleString()}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                                <CalendarIcon size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Total Entries</p>
                        </div>
                        <p className="text-4xl font-black text-purple-600 tracking-tight">{filteredExpenses.length}</p>
                    </CardContent>
                </Card>


            </div>

            {/* Expenses Table */}
            <Card className="shadow-xl border-0">
                <CardHeader className="pb-2 pt-6">
                    <div className="flex flex-col items-center gap-2">
                        <CardTitle className="text-lg font-black uppercase tracking-tight text-gray-900">Expense Records</CardTitle>
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 w-full">
                            <Button
                                onClick={() => navigate('/sales-report', { state: { dateRange: profitRange, customStartDate, customEndDate } })}
                                className="bg-red-600 text-white hover:bg-red-700 h-10 px-3 flex-shrink-0 uppercase text-[11px] font-bold flex items-center gap-2 rounded-xl shadow-sm"
                                size="sm"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>

                            <div className="flex-1 min-w-[220px] relative group">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 text-gray-500 group-focus-within:text-red-600"
                                    onClick={() => (document.getElementById('expensesSearch') as HTMLInputElement)?.focus()}
                                    title="Focus search"
                                >
                                    <Search className="h-5 w-5" />
                                </Button>
                                <Input
                                    id="expensesSearch"
                                    placeholder="Search category or notes..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-10 h-10 text-sm border-gray-200 bg-gray-50/70 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-xl"
                                />
                            </div>

                            <Button
                                variant="outline"
                                className={`h-10 w-10 p-0 rounded-xl transition-colors flex-shrink-0 ${filterCategory !== 'all' || startDate || endDate || minAmount || maxAmount
                                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                                    : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                onClick={() => setIsFilterOpen(true)}
                                title="Open filters"
                            >
                                <Filter className="h-4 w-4" />
                            </Button>

                            <Button
                                onClick={() => setIsExpenseModalOpen(true)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md h-10 px-3 rounded-xl flex items-center gap-2 uppercase text-[11px]"
                            >
                                <PlusCircle className="h-4 w-4" />
                                New Expense
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    <div className="overflow-x-auto -mx-1 px-1">
                        <Table className="w-full text-sm min-w-[700px]">
                            <TableHeader className="bg-red-50/50 border-b border-red-100">
                                <TableRow className="border-b border-red-100 hover:bg-transparent">
                                    <TableHead className="h-10 px-4 text-left font-black text-gray-700 uppercase tracking-widest text-[11px]">Date</TableHead>
                                    <TableHead className="h-10 px-4 text-left font-black text-gray-700 uppercase tracking-widest text-[11px]">Category</TableHead>
                                    <TableHead className="h-10 px-4 text-left font-black text-gray-700 uppercase tracking-widest text-[11px]">Frequency</TableHead>
                                    <TableHead className="h-10 px-4 text-left font-black text-gray-700 uppercase tracking-widest text-[11px]">Notes</TableHead>
                                    <TableHead className="h-10 px-4 text-right font-black text-gray-700 uppercase tracking-widest text-[11px]">Amount</TableHead>
                                    <TableHead className="h-10 px-4 text-center font-black text-gray-700 uppercase tracking-widest text-[11px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-gray-100">
                                {paginatedExpenses.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <Receipt size={48} className="text-gray-300" />
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">No expenses found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedExpenses.map((expense) => (
                                        <TableRow key={expense.id} onClick={() => setViewingExpense(expense)} className="border-b border-gray-100 hover:bg-gray-50/80 transition-all cursor-pointer">
                                            <TableCell className="p-4 text-sm font-medium text-gray-700 whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <CalendarIcon size={12} className="text-purple-600 shrink-0" />
                                                    <span>{formatNumericDate(expense.date)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-4">
                                                <span className="text-xs font-bold text-gray-900">{expense.category}</span>
                                            </TableCell>
                                            <TableCell className="p-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap bg-blue-50 text-blue-700 border-blue-100">
                                                    {expense.frequency || (expense.category?.toUpperCase() === 'INVENTORY' ? 'Variable / Restock' : 'One-Time')}
                                                </span>
                                            </TableCell>
                                            <TableCell className="p-4 text-xs font-medium text-gray-700 whitespace-normal max-w-[240px]">
                                                {expense.notes || <span className="text-gray-400 italic">-</span>}
                                            </TableCell>
                                            <TableCell className="p-4 text-right font-medium text-sm text-red-700 whitespace-nowrap">
                                                ₱{Number(expense.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="p-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="h-7 px-2 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-black text-xs gap-1 rounded-md">
                                                            <MoreVertical className="h-3.5 w-3.5 text-red-500" />
                                                            <ChevronDown className="h-3 w-3 opacity-50" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpenseToEdit(expense);
                                                            }}
                                                            className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold mb-1 cursor-pointer"
                                                        >
                                                            <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                                            Edit Expense Detail
                                                        </DropdownMenuItem>
                                                        {['owner', 'admin'].includes(user.role?.toLowerCase() || '') && (
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpenseToDelete(expense);
                                                                }}
                                                                className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold cursor-pointer"
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                                                                Delete Expense
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1.5 pb-1 border-t border-gray-50 px-3">
                        <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                            PAGE {currentPage} OF {totalPages}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPage === 1
                                    ? 'bg-slate-200 text-slate-500'
                                    : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                    }`}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <div className="max-w-[140px] md:max-w-[300px] overflow-x-auto no-scrollbar py-0.5 px-0.5 flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => {
                                    const pageNum = i + 1;
                                    const isActive = currentPage === pageNum;
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={isActive ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`h-7 w-7 min-w-[28px] p-0 text-[10px] font-black rounded-lg transition-all ${isActive
                                                ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm shadow-red-200'
                                                : 'bg-white border-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                                                }`}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPage === totalPages
                                    ? 'bg-slate-200 text-slate-500'
                                    : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                    }`}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={isFilterOpen}
                onOpenChange={(open) => {
                    setIsFilterOpen(open);
                    if (!open) setCategorySearch('');
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Filters</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Category</label>
                            <Select
                                value={filterCategory}
                                onValueChange={(val) => {
                                    setFilterCategory(val);
                                    setCategorySearch('');
                                }}
                            >
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Categories" />
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
                                        {(
                                            !categorySearch ||
                                            'all categories'.includes(categorySearch.toLowerCase())
                                        ) && (
                                            <SelectItem value="all" className="text-xs font-bold text-gray-600 focus:bg-red-100 focus:text-red-700">
                                                All Categories
                                            </SelectItem>
                                        )}
                                        {filteredFilterCategories.length > 0 ? (
                                            filteredFilterCategories.map((cat) => (
                                                <SelectItem
                                                    key={cat}
                                                    value={cat}
                                                    className="text-xs font-bold text-gray-600 focus:bg-red-100 focus:text-red-700"
                                                >
                                                    {cat}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            categorySearch &&
                                            !'all categories'.includes(categorySearch.toLowerCase()) && (
                                                <div className="px-4 py-2 text-[10px] text-gray-400 italic">No results</div>
                                            )
                                        )}
                                    </div>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Start Date</label>
                            <FormattedDateInput
                                value={startDate}
                                onChange={(val) => setStartDate(val)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">End Date</label>
                            <FormattedDateInput
                                value={endDate}
                                onChange={(val) => setEndDate(val)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Min Amount</label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                                placeholder="Min Amount"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Max Amount</label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                                placeholder="Max Amount"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <Button
                            variant="ghost"
                            className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-xl"
                            onClick={() => {
                                setFilterCategory('all');
                                setCategorySearch('');
                                setStartDate('');
                                setEndDate('');
                                setMinAmount('');
                                setMaxAmount('');
                                setCurrentPage(1);
                            }}
                        >
                            Reset
                        </Button>
                        <Button className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-xl shadow-md uppercase tracking-wider transition-all" onClick={() => setIsFilterOpen(false)}>
                            Apply
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>            <AddExpenseModal
                isOpen={isExpenseModalOpen || !!expenseToEdit}
                onClose={() => {
                    setIsExpenseModalOpen(false);
                    setExpenseToEdit(null);
                }}
                onAddExpense={addExpense}
                onEditExpense={updateExpense}
                initialData={expenseToEdit}
            />

            {/* DELETE CONFIRMATION MODAL */}
            <Dialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-red-600 uppercase text-center w-full">Delete Expense</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-center text-sm font-semibold text-gray-700">
                        Are you sure you want to permanently delete &quot;{expenseToDelete?.category}&quot; worth ₱{expenseToDelete?.amount}?
                    </div>
                    <div className="flex gap-3 justify-between">
                        <Button type="button" variant="outline" onClick={() => setExpenseToDelete(null)} className="flex-1 font-bold shadow-sm">
                            CANCEL
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => {
                            if (expenseToDelete) {
                                removeExpense(expenseToDelete.id);
                            }
                            setExpenseToDelete(null);
                        }} className="flex-1 bg-red-600 hover:bg-red-700 font-bold uppercase shadow-sm">
                            DELETE
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ExpenseDetailModal
                expense={viewingExpense}
                open={!!viewingExpense}
                onOpenChange={(open) => !open && setViewingExpense(null)}
                onEdit={(exp) => setExpenseToEdit(exp)}
                user={user}
            />
        </div>
    );
}

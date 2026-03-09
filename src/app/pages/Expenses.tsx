import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExpenses } from '@/app/context/ExpenseContext';
import { ArrowLeft, ChevronLeft, PlusCircle, Receipt, Calendar as CalendarIcon, ChevronRight, Filter, Search, ChevronDown, Wallet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import AddExpenseModal from '@/app/components/AddExpenseModal';


type ExpensesProps = {
    onSetHeaderActionRight?: (action: ReactNode | null) => void;
};

export default function Expenses({ onSetHeaderActionRight }: ExpensesProps) {
    const navigate = useNavigate();
    const { expenses, addExpense } = useExpenses();
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [profitRange, setProfitRange] = useState<'Daily' | 'Weekly' | 'Quarterly' | 'Annually'>('Daily');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
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

    const categories = useMemo(() => Array.from(new Set(expenses.map((exp) => exp.category))), [expenses]);

    useEffect(() => {
        if (!onSetHeaderActionRight) return;

        onSetHeaderActionRight(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="Select range"
                        className="w-10 h-10 md:w-40 flex items-center justify-center md:justify-between rounded-md border border-red-600 bg-red-600 px-2 md:px-3 py-2 text-sm font-semibold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <CalendarIcon className="h-4 w-4 md:mr-1 shrink-0" aria-hidden="true" />
                        <span className="hidden md:inline truncate mx-1">{profitRange}</span>
                        <ChevronDown className="hidden md:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
                    {['Daily', 'Weekly', 'Quarterly', 'Annually'].map((range) => (
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

        return () => onSetHeaderActionRight(null);
    }, [onSetHeaderActionRight, profitRange]);

    const filteredExpenses = useMemo(() => {
        const now = new Date();
        const isWithinRange = (dateValue: Date) => {
            const diffDays = (now.getTime() - dateValue.getTime()) / (1000 * 60 * 60 * 24);
            if (profitRange === 'Daily') {
                const startOfToday = new Date(now);
                startOfToday.setHours(0, 0, 0, 0);
                return dateValue >= startOfToday;
            }
            if (profitRange === 'Weekly') return diffDays < 7;
            if (profitRange === 'Quarterly') return diffDays < 90;
            if (profitRange === 'Annually') return diffDays < 365;
            return true;
        };

        let filtered = expenses
            .filter((exp) => isWithinRange(new Date(exp.date)))
            .map((exp) => ({ ...exp, parsedDate: new Date(exp.date) }));

        if (filterCategory !== 'all') {
            filtered = filtered.filter((exp) => exp.category === filterCategory);
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
    }, [expenses, profitRange, filterCategory, startDate, endDate, minAmount, maxAmount, searchQuery]);

    const totalExpensesFiltered = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

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
                                onClick={() => navigate(-1)}
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
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-[#fef5f3]">
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Date</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Category</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs">Notes</TableHead>
                                    <TableHead className="font-black text-gray-600 uppercase text-xs text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-400 py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <Receipt className="h-10 w-10 text-gray-300" />
                                                <p className="font-semibold">No expenses found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedExpenses.map((expense) => (
                                        <TableRow key={expense.id} className="hover:bg-gray-50">
                                            <TableCell className="font-medium text-gray-800">
                                                {formatNumericDate(expense.date)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-semibold text-gray-800">{expense.category}</span>
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                {expense.notes || <span className="text-gray-400 italic">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-sm text-red-700">
                                                ₱{expense.amount.toLocaleString()}
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

            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Filters</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Category</label>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700">All Categories</SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat} className="text-xs focus:bg-red-50 focus:text-red-700">
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Start Date</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">End Date</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
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
                                placeholder="0"
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
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <Button
                            variant="ghost"
                            className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-xl"
                            onClick={() => {
                                setFilterCategory('all');
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
            </Dialog>

            <AddExpenseModal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                onAddExpense={addExpense}
            />
        </div>
    );
}

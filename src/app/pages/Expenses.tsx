import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExpenses } from '@/app/context/ExpenseContext';
import { ChevronLeft, Plus, Receipt, TrendingDown, Calendar as CalendarIcon, DollarSign, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import AddExpenseModal from '@/app/components/AddExpenseModal';

// Category icon and color mapping
const categoryConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
    'Water': { icon: Receipt, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    'Internet': { icon: Receipt, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    'Staff Salary': { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-50' },
    'Logistics': { icon: Receipt, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    'Cleaning Materials': { icon: Receipt, color: 'text-teal-600', bgColor: 'bg-teal-50' },
    'Food': { icon: Receipt, color: 'text-amber-600', bgColor: 'bg-amber-50' },
};

export default function Expenses() {
    const navigate = useNavigate();
    const { expenses, addExpense } = useExpenses();
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Pagination
    const totalPages = Math.ceil(expenses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedExpenses = expenses.slice(startIndex, endIndex);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/reports')}
                    className="hover:bg-red-50 text-red-600 border-red-200 font-bold shadow-sm"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Reports
                </Button>
                <Button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Expense
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none shadow-lg bg-gradient-to-br from-red-50 to-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingDown size={80} className="text-red-600" />
                    </div>
                    <CardContent className="pt-6 pb-4 relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-red-100 text-red-600">
                                <Receipt size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Total Expenses</p>
                        </div>
                        <p className="text-4xl font-black text-red-600 tracking-tight">₱{totalExpenses.toLocaleString()}</p>
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
                        <p className="text-4xl font-black text-purple-600 tracking-tight">{expenses.length}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                <DollarSign size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Average Expense</p>
                        </div>
                        <p className="text-4xl font-black text-blue-600 tracking-tight">
                            ₱{expenses.length > 0 ? Math.round(totalExpenses / expenses.length).toLocaleString() : '0'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Expenses Table */}
            <Card className="shadow-xl border-0">
                <CardHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-xl border-b-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Expense Records
                        </CardTitle>
                        <p className="text-sm font-semibold text-red-100">
                            Showing {startIndex + 1}-{Math.min(endIndex, expenses.length)} of {expenses.length}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-black text-gray-700">Date</TableHead>
                                    <TableHead className="font-black text-gray-700">Category</TableHead>
                                    <TableHead className="font-black text-gray-700">Notes</TableHead>
                                    <TableHead className="font-black text-gray-700 text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-400 py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <Receipt className="h-12 w-12 text-gray-300" />
                                                <p className="font-semibold">No expenses recorded yet.</p>
                                                <p className="text-sm">Click "Add Expense" to get started.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedExpenses.map((expense) => {
                                        const config = categoryConfig[expense.category] || { icon: Receipt, color: 'text-gray-600', bgColor: 'bg-gray-50' };
                                        const CategoryIcon = config.icon;

                                        return (
                                            <TableRow key={expense.id} className="hover:bg-red-50/50 transition-colors">
                                                <TableCell className="font-medium text-gray-700">
                                                    {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                                                            <CategoryIcon className={`h-4 w-4 ${config.color}`} />
                                                        </div>
                                                        <span className="font-semibold text-gray-800">{expense.category}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-gray-600">
                                                    {expense.notes || <span className="text-gray-400 italic">-</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold text-sm px-3 py-1">
                                                        ₱{expense.amount.toLocaleString()}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="font-semibold"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>

                            <div className="flex items-center gap-2">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={currentPage === pageNum ? "bg-red-600 hover:bg-red-700 font-bold" : "font-semibold"}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="font-semibold"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddExpenseModal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                onAddExpense={addExpense}
            />
        </div>
    );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '@/app/context/OrderContext';
import { ChevronLeft, ChevronRight, TrendingUp, DollarSign, CreditCard, ShoppingCart } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';

export default function TotalSales() {
    const navigate = useNavigate();
    const { orders } = useOrders();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Filter for all paid orders
    const salesOrders = orders.filter(order => order.paymentStatus === 'paid');

    const totalSales = salesOrders.reduce((sum, order) => sum + (order.amountReceived || 0), 0);
    const averageSale = salesOrders.length > 0 ? totalSales / salesOrders.length : 0;

    // Pagination
    const totalPages = Math.ceil(salesOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedOrders = salesOrders.slice(startIndex, endIndex);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Payment method breakdown
    const paymentBreakdown = salesOrders.reduce((acc, order) => {
        const method = order.paymentMethod || 'cash';
        acc[method] = (acc[method] || 0) + (order.amountReceived || 0);
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/reports')}
                    className="hover:bg-red-50 text-red-600 border-red-200 font-bold shadow-sm"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Reports
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp size={80} className="text-green-600" />
                    </div>
                    <CardContent className="pt-6 pb-4 relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-green-100 text-green-600">
                                <DollarSign size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Total Sales</p>
                        </div>
                        <p className="text-4xl font-black text-green-600 tracking-tight">₱{totalSales.toLocaleString()}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                <ShoppingCart size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Transactions</p>
                        </div>
                        <p className="text-4xl font-black text-blue-600 tracking-tight">{salesOrders.length}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                                <TrendingUp size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Avg. Sale</p>
                        </div>
                        <p className="text-4xl font-black text-purple-600 tracking-tight">₱{Math.round(averageSale).toLocaleString()}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                                <CreditCard size={18} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Cash Sales</p>
                        </div>
                        <p className="text-3xl font-black text-amber-600 tracking-tight">₱{(paymentBreakdown.cash || 0).toLocaleString()}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Sales Table */}
            <Card className="shadow-xl border-0">
                <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-xl border-b-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Sales Transactions
                        </CardTitle>
                        <p className="text-sm font-semibold text-green-100">
                            Showing {startIndex + 1}-{Math.min(endIndex, salesOrders.length)} of {salesOrders.length}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-black text-gray-700">Order ID</TableHead>
                                    <TableHead className="font-black text-gray-700">Customer</TableHead>
                                    <TableHead className="font-black text-gray-700">Date</TableHead>
                                    <TableHead className="font-black text-gray-700">Service</TableHead>
                                    <TableHead className="font-black text-gray-700">Payment</TableHead>
                                    <TableHead className="font-black text-gray-700">Status</TableHead>
                                    <TableHead className="font-black text-gray-700 text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-gray-400 py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <TrendingUp className="h-12 w-12 text-gray-300" />
                                                <p className="font-semibold">No sales transactions found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedOrders.map((order) => (
                                        <TableRow key={order.id} className="hover:bg-green-50/50 transition-colors">
                                            <TableCell className="font-mono text-sm font-bold text-gray-700">{order.id}</TableCell>
                                            <TableCell className="font-semibold text-gray-800">{order.customerName}</TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {new Date(order.transactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-700">
                                                {Array.isArray(order.baseService) ? order.baseService.join(', ') : order.baseService}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    order.paymentMethod === 'cash' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        order.paymentMethod === 'gcash' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            'bg-green-50 text-green-700 border-green-200'
                                                }>
                                                    {order.paymentMethod?.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    order.status === 'claimed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        'bg-purple-50 text-purple-700 border-purple-200'
                                                }>
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge className="bg-green-100 text-green-700 border-green-300 font-bold text-sm px-3 py-1">
                                                    ₱{(order.amountReceived || 0).toLocaleString()}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
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
                                            className={currentPage === pageNum ? "bg-green-600 hover:bg-green-700 font-bold" : "font-semibold"}
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
        </div>
    );
}

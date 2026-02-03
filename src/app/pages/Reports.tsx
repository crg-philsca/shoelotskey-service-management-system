import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { mockServices } from '@/app/lib/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useEffect, useMemo } from 'react';

import { TrendingUp, ShoppingBag, Filter, Calendar, ArrowDownRight, ChevronDown } from 'lucide-react';
import { format, isSameDay, isSameWeek, isSameMonth, isSameYear } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useOrders } from '@/app/context/OrderContext';

interface ReportsProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
}



export default function Reports({ onSetHeaderActionRight }: ReportsProps) {
  const navigate = useNavigate();
  const { orders: allOrders } = useOrders();
  const { expenses } = useExpenses();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('daily');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. GLOBAL DATE FILTERING
  const filteredOrdersByDate = useMemo(() => {
    const now = new Date();
    return allOrders.filter(order => {
      const date = order.transactionDate || new Date();
      if (dateRange === 'daily') return isSameDay(date, now);
      if (dateRange === 'weekly') return isSameWeek(date, now);
      if (dateRange === 'monthly') return isSameMonth(date, now);
      if (dateRange === 'yearly') return isSameYear(date, now);
      return true;
    });
  }, [dateRange]);
  // Reset to first page when date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange]);

  const filteredExpensesByDate = useMemo(() => {
    const now = new Date();
    return expenses.filter(exp => {
      const date = new Date(exp.date);
      if (dateRange === 'daily') return isSameDay(date, now);
      if (dateRange === 'weekly') return isSameWeek(date, now);
      if (dateRange === 'monthly') return isSameMonth(date, now);
      if (dateRange === 'yearly') return isSameYear(date, now);
      return true;
    });
  }, [dateRange, expenses]);

  // 2. DATA SEGMENTATION

  // Total Sales & Analytics Data (All Paid Orders)
  const totalSalesData = useMemo(() => {
    return filteredOrdersByDate.filter(order => order.paymentStatus === 'paid');
  }, [filteredOrdersByDate]);

  // 3. CHART & METRIC DATA

  // Payment Method Analytics (Based on filtered date)
  const paymentMethodStats = useMemo(() => {
    const counts: Record<string, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      gcash: { count: 0, amount: 0 },
      maya: { count: 0, amount: 0 },
    };

    totalSalesData.forEach(order => {
      const method = order.paymentMethod?.toLowerCase() || 'cash';
      if (counts[method]) {
        counts[method].count += 1;
        counts[method].amount += (order.grandTotal || 0);
      }
    });

    return [
      { name: 'Cash', value: counts.cash.count, amount: counts.cash.amount, color: '#9333ea' }, // Purple
      { name: 'GCash', value: counts.gcash.count, amount: counts.gcash.amount, color: '#2563eb' }, // Blue
      { name: 'Maya', value: counts.maya.count, amount: counts.maya.amount, color: '#16a34a' }, // Green
    ];
  }, [totalSalesData]);

  // Total Sales Amount (Controlled by Payment Filter)
  const totalSalesAmount = useMemo(() => {
    if (selectedPaymentMethod === 'all') {
      return paymentMethodStats.reduce((sum, item) => sum + item.amount, 0);
    }
    return paymentMethodStats.find(p => p.name.toLowerCase() === selectedPaymentMethod.toLowerCase())?.amount || 0;
  }, [selectedPaymentMethod, paymentMethodStats]);

  // Total Orders: All filtered orders
  const totalOrdersCount = filteredOrdersByDate.length;

  // Total Expenses
  const totalExpensesAmount = filteredExpensesByDate.reduce((sum, exp) => sum + exp.amount, 0);

  // Profit
  const profit = totalSalesAmount - totalExpensesAmount;

  // Sales by Service Type (Total Sales)
  const serviceVolume = useMemo(() => {
    return mockServices
      .filter(s => s.category === 'base')
      .map((service) => {
        const cleanName = service.name.replace(' (with basic cleaning)', '');
        let fillColor = '#dc2626'; // default
        if (cleanName === 'Basic Cleaning') fillColor = '#0d948880'; // teal-700 50%
        else if (cleanName === 'Minor Reglue') fillColor = '#6366f180'; // indigo-500 50%
        else if (cleanName === 'Full Reglue') fillColor = '#c026d380'; // violet-600 50%
        else if (cleanName === 'Color Renewal') fillColor = '#f59e0b80'; // amber-500 50%

        return {
          name: cleanName,
          amount: totalSalesData
            .filter(j => (j.baseService as string[]).includes(service.name))
            .reduce((sum, j) => sum + (j.grandTotal || 0), 0),
          fill: fillColor
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [totalSalesData]);

  // Daily Monitoring Table Data
  const dailyReportData = useMemo(() => {
    return filteredOrdersByDate
      .filter(order => {
        const isNewOrClaim = order.status === 'claimed' || order.status === 'new-order';
        const hour = (order.transactionDate || new Date()).getHours();
        const isInTimeRange = hour >= 9 && hour <= 21;
        return isNewOrClaim && isInTimeRange;
      })
      .sort((a, b) => (a.transactionDate?.getTime() || 0) - (b.transactionDate?.getTime() || 0)) // Ascending: AM to PM
      .map(order => {
        const isClaim = order.status === 'claimed';
        const total = order.grandTotal || 0;
        const received = order.amountReceived || 0;

        return {
          time: format(order.transactionDate || new Date(), 'h:mm a'),
          customerType: isClaim ? 'Claim' : 'New',
          receiptNr: order.orderNumber,
          paymentMethod: order.paymentMethod?.toUpperCase() || 'CASH',
          amountPaid: isClaim ? total : received,
          balance: isClaim ? 0 : (total - received),
          remarks: order.quantity > 1 ? `${order.quantity} pairs` : '',
        };
      });
  }, [filteredOrdersByDate]);




  // Bottom Summary for Table
  const totalCashSales = paymentMethodStats.find(p => p.name === 'Cash')?.amount || 0;
  const totalGcashSales = paymentMethodStats.find(p => p.name === 'GCash')?.amount || 0;
  const totalMayaSales = paymentMethodStats.find(p => p.name === 'Maya')?.amount || 0;
  const totalDailySales = totalCashSales + totalGcashSales + totalMayaSales;
  const beginningCashFund = 5000;
  const expectedCashOnHand = beginningCashFund + totalCashSales - totalExpensesAmount;
  const actualCashCounted = expectedCashOnHand;
  const overShort = actualCashCounted - expectedCashOnHand;

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-32 flex items-center justify-between rounded-md border border-red-600 bg-red-600 px-3 py-2 text-sm font-semibold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Select range"
              type="button"
            >
              <Calendar className="h-4 w-4 mr-1" aria-hidden="true" />
              {dateRange}
              <ChevronDown className="ml-2 h-4 w-4 text-white" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32 p-0 rounded-md border border-red-600 bg-white shadow-lg">
            {['daily', 'weekly', 'monthly', 'yearly'].map((range) => (
              <DropdownMenuItem
                key={range}
                onClick={() => setDateRange(range as typeof dateRange)}
                className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer ${dateRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
              >
                {range}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, dateRange]);



  // 4. PAGINATION LOGIC
  const totalPages = Math.ceil(dailyReportData.length / itemsPerPage) || 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedDailyReportData = dailyReportData.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div className="space-y-8 pb-10">
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          className="border-none shadow-md bg-white overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate('/total-sales')}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={64} className="text-green-600" />
          </div>
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Sales</p>
            <p className="text-3xl font-black text-green-600 tracking-tight">
              ₱{totalSalesAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-md bg-white overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate('/total-orders')}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShoppingBag size={64} className="text-purple-600" />
          </div>
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Orders</p>
            <p className="text-3xl font-black text-purple-600 tracking-tight">
              {totalOrdersCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-md bg-white overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate('/expenses')}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowDownRight size={64} className="text-red-600" />
          </div>
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Expenses</p>
            <p className="text-3xl font-black text-red-600 tracking-tight">
              ₱{totalExpensesAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={64} className="text-blue-600" />
          </div>
          <CardContent className="pt-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Profit</p>
            <p className="text-3xl font-black text-blue-600 tracking-tight">
              ₱{profit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. PAYMENT ANALYTICS & SERVICE TYPE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader className="text-center">
            <CardTitle className="text-lg font-bold uppercase tracking-tight">Total Sales By Service Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceVolume} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-xl border-none shadow-lg">
                          <p className="font-bold text-gray-900 text-sm mb-1">{data.name}</p>
                          <p className="text-xs text-gray-600">Total Sales: ₱{data.amount.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                  {serviceVolume.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend below chart in 2 columns */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 justify-items-start max-w-lg mx-auto ml-[80px]">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                <div className="w-3 h-3 rounded-full" style={{ background: '#0d948880' }}></div>
                <span>BASIC CLEANING</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                <div className="w-3 h-3 rounded-full" style={{ background: '#c026d380' }}></div>
                <span>FULL REGLUE</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                <div className="w-3 h-3 rounded-full" style={{ background: '#6366f180' }}></div>
                <span>MINOR REGLUE</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b80' }}></div>
                <span>COLOR RENEWAL</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 uppercase text-center">Payment Method Analytics</CardTitle>
            <div className="flex justify-end mt-3">
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger className="w-[105px] h-7 text-[9px] font-black uppercase tracking-[0.1em] border-gray-200 bg-gray-50/50 focus:ring-0 focus:ring-offset-0">
                  <div className="flex items-center gap-1.5">
                    <Filter size={10} className="text-gray-400" />
                    <SelectValue placeholder="Filter" />
                  </div>
                </SelectTrigger>
                <SelectContent className="border-gray-200" align="end" side="bottom">
                  <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">ALL</SelectItem>
                  <SelectItem value="cash" className="text-[10px] font-bold uppercase tracking-widest">Cash</SelectItem>
                  <SelectItem value="gcash" className="text-[10px] font-bold uppercase tracking-widest">GCash</SelectItem>
                  <SelectItem value="maya" className="text-[10px] font-bold uppercase tracking-widest">Maya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center -mt-6">
            {/* Centered Pie Chart */}
            <div className="w-full flex justify-center">
              <ResponsiveContainer width="100%" height={300} className="max-w-md">
                <PieChart>
                  <Pie
                    data={paymentMethodStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentMethodStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-xl border-none shadow-lg">
                            <p className="font-bold text-gray-900 text-sm mb-1">{data.name}</p>
                            <p className="text-xs text-gray-600">Transactions: {data.value}</p>
                            <p className="text-xs text-gray-600">{data.name} Sales: ₱{data.amount.toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Simple legend below chart - matching Total Sales style */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 mt-4 justify-items-start max-w-lg mx-auto">
              {paymentMethodStats.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. DAILY SALES MONITORING TABLE */}
      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-red-600 py-3">
          <div className="flex flex-col items-center text-center px-4">
            <h2 className="text-white font-black text-lg tracking-tighter uppercase mb-0">Daily Sales Monitoring Record</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100/50 hover:bg-gray-100/50 border-b border-gray-200">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-600 py-3 text-center">Time</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-600 py-3 text-center border-l border-gray-200">Customer Type</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-600 py-3 text-center border-l border-gray-200">Order#</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-600 py-3 text-center border-l border-gray-200">Payment Method</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-600 py-3 text-center border-l border-gray-200">Amount Paid</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-600 py-3 text-center border-l border-gray-200">Remaining Balance</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-600 py-3 text-center border-l border-gray-200">Other Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDailyReportData.map((row, i) => (
                  <TableRow key={i} className="border-b border-gray-100 hover:bg-red-50/30 transition-colors">
                    <TableCell className="text-[11px] font-bold text-gray-700 py-2.5 text-center">{row.time}</TableCell>
                    <TableCell className="text-[11px] font-black py-2.5 text-center border-l border-gray-100">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${row.customerType === 'New' ? 'text-purple-600 bg-purple-50' : 'text-gray-600 bg-gray-100'}`}>
                        {row.customerType}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] font-black text-gray-900 py-2.5 text-center border-l border-gray-100">{row.receiptNr}</TableCell>
                    <TableCell className="text-[11px] font-black text-gray-600 py-2.5 text-center border-l border-gray-100">{row.paymentMethod}</TableCell>
                    <TableCell className="text-[11px] font-black text-red-600 py-2.5 text-center border-l border-gray-100">₱{row.amountPaid.toLocaleString()}</TableCell>
                    <TableCell className="text-[11px] font-bold text-gray-400 py-2.5 text-center border-l border-gray-100">₱{row.balance.toLocaleString()}</TableCell>
                    <TableCell className="text-[10px] font-medium text-gray-500 py-2.5 text-center border-l border-gray-100 italic">{row.remarks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {dailyReportData.length > itemsPerPage && (
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50/50 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Showing {startIdx + 1} to {Math.min(startIdx + itemsPerPage, dailyReportData.length)} of {dailyReportData.length} entries
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${currentPage === 1
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-white text-red-600 border border-red-100 hover:bg-red-600 hover:text-white shadow-sm'
                    }`}
                >
                  Previous
                </button>
                <div className="flex items-center px-4 text-[10px] font-black text-gray-400">
                  PAGE {currentPage} OF {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${currentPage === totalPages
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-white text-red-600 border border-red-100 hover:bg-red-600 hover:text-white shadow-sm'
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* BOTTOM SUMMARY GRID (Matching reference image) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-10 border-t border-gray-300">
            <div className="lg:col-span-3 bg-yellow-50/50 p-6 space-y-4 border-r border-gray-200">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                <span>Total Cash Sales:</span>
                <span className="text-gray-900 font-bold">₱{totalCashSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                <span>Total Gcash Sales:</span>
                <span className="text-gray-900 font-bold">₱{totalGcashSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                <span>Total Maya Sales:</span>
                <span className="text-gray-900 font-bold">₱{totalMayaSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-xs font-black uppercase tracking-widest text-red-600">Total Daily Sales:</span>
                <span className="text-sm font-black text-red-600">₱{totalDailySales.toLocaleString()}</span>
              </div>
            </div>

            <div className="lg:col-span-7 p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 bg-gray-50/30">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                <span>Beginning Cash Fund:</span>
                <span className="text-gray-900 font-black">₱{beginningCashFund.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                <span>Expected Cash on Hand:</span>
                <span className="text-gray-900 font-black">₱{expectedCashOnHand.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                <span>Total Expenses:</span>
                <span className="text-red-600 font-black">₱{totalExpensesAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                <span>Actual Cash Counted:</span>
                <span className="text-blue-600 font-black underline underline-offset-4 decoration-blue-200">₱{actualCashCounted.toLocaleString()}</span>
              </div>
              <div className="md:col-span-2 pt-2 border-t border-gray-200 flex justify-end">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500">Over / Short:</span>
                  <span className={`text-lg font-black ${overShort >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₱{overShort.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { mockServices } from '@/app/lib/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useEffect, useMemo } from 'react';

import { TrendingUp, ShoppingBag, Filter, Calendar, TrendingDown, ChevronDown, Wallet, CircleAlert } from 'lucide-react';
import { isSameDay, isSameWeek, isSameMonth, isSameYear } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useOrders } from '@/app/context/OrderContext';
import type { JobOrder } from '@/app/types';

interface ReportsProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
}



export default function Reports({ onSetHeaderActionRight }: ReportsProps) {
  const navigate = useNavigate();
  const { orders: allOrders } = useOrders();
  const { expenses } = useExpenses();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('daily');

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
  // Total Revenue (Total billable amount)
  const totalRevenue = useMemo(() => {
    return filteredOrdersByDate.reduce((sum, order) => sum + (order.grandTotal || 0), 0);
  }, [filteredOrdersByDate]);

  // Total Pending Payments (Total unpaid balance)
  const totalPendingPayments = useMemo(() => {
    return filteredOrdersByDate.reduce((sum, order) => sum + ((order.grandTotal || 0) - (order.amountReceived || 0)), 0);
  }, [filteredOrdersByDate]);

  // Total Sales & Analytics Data (All Paid Orders)
  const totalSalesData = useMemo(() => {
    return filteredOrdersByDate.filter((order: JobOrder) => order.paymentStatus === 'paid');
  }, [filteredOrdersByDate]);

  // 3. CHART & METRIC DATA
  // Payment Method Analytics (Based on filtered date)
  const paymentMethodStats = useMemo(() => {
    const counts: Record<string, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      gcash: { count: 0, amount: 0 },
      maya: { count: 0, amount: 0 },
    };

    totalSalesData.forEach((order: JobOrder) => {
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

  // Profit (Accrual Basis)
  const profit = totalRevenue - totalExpensesAmount;

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
  // Daily sales monitoring section removed per request




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

  return (
    <div className="space-y-8 pb-10">
      {/* 1. TOP SUMMARY CARDS - Business Activity Section */}
      <Card className="border-none shadow-none mb-2">
        <CardHeader className="pt-5 pb-0 mb-0">
          <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Business Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-0 mb-0 -mt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <Card
              className="border-none shadow-md bg-gradient-to-br from-green-50 to-green-100 overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate('/total-sales')}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={48} className="text-green-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Sales</p>
                <p className="text-2xl font-black text-green-600 tracking-tight">
                  ₱{totalSalesAmount.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate('/total-orders')}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShoppingBag size={48} className="text-purple-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Orders</p>
                <p className="text-2xl font-black text-purple-600 tracking-tight">
                  {totalOrdersCount.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate('/expenses')}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingDown size={48} className="text-orange-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Expenses</p>
                <p className="text-2xl font-black text-orange-600 tracking-tight">
                  ₱{totalExpensesAmount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary Section */}
      <Card className="border-none shadow-none mb-6">
        <CardHeader className="pt-5 pb-0 mb-0">
          <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-0 mb-0 -mt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <CircleAlert size={48} className="text-red-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Pending Payments</p>
                <p className="text-2xl font-black text-red-600 tracking-tight">
                  ₱{totalPendingPayments.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wallet size={48} className="text-yellow-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Revenue</p>
                <p className="text-2xl font-black text-yellow-600 tracking-tight">
                  ₱{totalRevenue.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={48} className="text-blue-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Net Profit</p>
                <p className="text-2xl font-black text-blue-600 tracking-tight">
                  ₱{profit.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

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

    </div>
  );
}

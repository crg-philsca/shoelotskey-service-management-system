import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Filter, Calendar, TrendingDown, ChevronDown, Wallet, CircleAlert, Percent, Download } from 'lucide-react';
import GenerateReportModal from '@/app/components/GenerateReportModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useNavigate, useLocation } from 'react-router-dom';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useOrders } from '@/app/context/OrderContext';
import { useActivities } from '@/app/context/ActivityContext';
import type { JobOrder } from '@/app/types';
import {
  collectedSales,
  getOrderActivityPeriodLabel,
  isDateInRange,
  isSalesEligible,
  cancelledOrdersBreakdown,
  orderEventDate,
  paymentMethodAnalytics,
  salesByCanonicalService,
  serviceVolumeByCanonical,
  type ReportRange,
} from '@/app/lib/salesAnalytics';
import { formatPeso } from '@/app/lib/currency';
import { getExpenseGroup } from '@/app/lib/expenseCategories';

interface SalesReportProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
  onSetHeaderCenter?: (action: React.ReactNode | null) => void;
  user: { token: string };
}

export default function SalesReport({ onSetHeaderActionRight, onSetHeaderCenter, user }: SalesReportProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // [OWASP A09] Security Audit: Logging view access with token context
    if (user.token) {
      console.log('[SECURITY] Sales Report accessed by authenticated session');
    }
  }, [user.token]);

  const { orders: allOrders, loading } = useOrders();
  const { expenses } = useExpenses();
  const { addActivity } = useActivities();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [printMode, setPrintMode] = useState<'all' | 'Sales' | 'Expenses' | 'ROI'>('all');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<ReportRange>(() => {
    return (location.state as any)?.dateRange || 'Daily';
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    return (location.state as any)?.customStartDate || '';
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return (location.state as any)?.customEndDate || '';
  });

  const periodLabel = useMemo(() => {
    return getOrderActivityPeriodLabel(dateRange, customStartDate, customEndDate);
  }, [dateRange, customStartDate, customEndDate]);

  const timeframePrefix = dateRange === 'Annually' ? 'Annual' : dateRange;

  useEffect(() => {
    if (onSetHeaderCenter) {
      onSetHeaderCenter(null);
    }
    return () => onSetHeaderCenter?.(null);
  }, [onSetHeaderCenter]);

  // 1. GLOBAL DATE FILTERING (Accrual Reference Point)
  const filteredOrdersByDate = useMemo<JobOrder[]>(() => {
    const now = new Date();
    return (allOrders || []).filter((order: JobOrder) => {
      return isDateInRange(orderEventDate(order), dateRange, now, customStartDate, customEndDate);
    });
  }, [dateRange, allOrders, customStartDate, customEndDate]);

  const filteredExpensesByDate = useMemo<any[]>(() => {
    const now = new Date();
    return expenses.filter((exp: any) => {
      const date = new Date(exp.date);
      return isDateInRange(date, dateRange, now, customStartDate, customEndDate);
    });
  }, [dateRange, expenses, customStartDate, customEndDate]);

  // Total Expenses for the selected timeframe
  const totalExpensesAmount = useMemo(() => {
    return filteredExpensesByDate.reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0);
  }, [filteredExpensesByDate]);

  // 2. DATA SEGMENTATION
  // Total Sales & Analytics Data (Includes Fully Paid and Downpayment Orders)
  const totalSalesData = useMemo(() => {
    return filteredOrdersByDate.filter((order: JobOrder) => isSalesEligible(order));
  }, [filteredOrdersByDate]);

  // Full Sales: Total Grand Total of applicable orders recognized within the selected timeframe
  const totalSalesAmount = useMemo(() => {
    return totalSalesData.reduce((sum: number, order: JobOrder) => sum + (Number(order.grandTotal) || 0), 0);
  }, [totalSalesData]);

  // Payments Received: Actual cash collected so far from applicable orders
  const totalPaymentsReceived = useMemo(() => {
    return totalSalesData.reduce((sum: number, order: JobOrder) => sum + collectedSales(order), 0);
  }, [totalSalesData]);

  // Balance Due: Remaining amount still owed by applicable orders (Sales − Payments Received)
  const totalBalanceDue = useMemo(() => {
    return totalSalesData.reduce((sum: number, order: JobOrder) => {
      const billed = Number(order.grandTotal) || 0;
      const collected = collectedSales(order);
      return sum + Math.max(0, billed - collected);
    }, 0);
  }, [totalSalesData]);

  // 3. CHART & METRIC DATA
  // Payment Method Analytics (Based on filtered date)
  const paymentMethodStats = useMemo(() => {
    const allStats = paymentMethodAnalytics(totalSalesData);
    if (selectedPaymentMethod && selectedPaymentMethod !== 'all') {
      return allStats.filter(p => p.name.toLowerCase() === selectedPaymentMethod.toLowerCase());
    }
    return allStats;
  }, [totalSalesData, selectedPaymentMethod]);

  // Total Orders: All filtered orders
  const totalOrdersCount = filteredOrdersByDate.length;


  // Cancellation Breakdown & Financial Adjustments
  const cancellationStats = useMemo(() => {
    return cancelledOrdersBreakdown(filteredOrdersByDate);
  }, [filteredOrdersByDate]);

  const totalRefundsAmount = cancellationStats.totalRefunded;
  const totalRetainedDepositsAmount = cancellationStats.totalRetained;

  // Net Sales: Recognized active sales less refunds issued plus retained deposits from cancelled orders
  const netSalesAmount = Math.max(0, totalSalesAmount - totalRefundsAmount + totalRetainedDepositsAmount);

  // Net profit uses recognized net sales less expenses
  const profit = netSalesAmount - totalExpensesAmount;

  // ROI = (Net Profit ÷ Total Expenses) × 100
  const roiSummary = useMemo(() => {
    const expenses = Number(totalExpensesAmount) || 0;
    const net = Number(profit) || 0;
    if (!(expenses > 0) || !Number.isFinite(expenses) || !Number.isFinite(net)) {
      return {
        display: 'N/A',
        applicable: false,
      };
    }
    const percent = (net / expenses) * 100;
    if (!Number.isFinite(percent)) {
      return {
        display: 'N/A',
        applicable: false,
      };
    }
    return {
      display: `${percent.toFixed(2)}%`,
      applicable: true,
    };
  }, [totalExpensesAmount, profit]);

  // Expenses Categorization Breakdown for parity with PDF & CSV
  const expenseBreakdown = useMemo(() => {
    let inv = 0;
    let op = 0;
    let oth = 0;
    for (const exp of filteredExpensesByDate) {
      const amt = Number(exp.amount) || 0;
      const grp = getExpenseGroup(exp.category);
      if (grp === 'Inventory Expenses') {
        inv += amt;
      } else if (grp === 'Operating Expenses') {
        op += amt;
      } else {
        oth += amt;
      }
    }
    return { inventory: inv, operating: op, other: oth };
  }, [filteredExpensesByDate]);

  // Sales by Service Type — collected cash only, allocated so bars cannot exceed period sales.
  const serviceVolume = useMemo(() => salesByCanonicalService(totalSalesData), [totalSalesData]);
  const canonicalServiceStats = useMemo(() => serviceVolumeByCanonical(totalSalesData), [totalSalesData]);
  const allPaymentMethodStats = useMemo(() => paymentMethodAnalytics(totalSalesData), [totalSalesData]);

  // 4. PRINT & EXPORT LOGIC
  const handleExport = (type: 'Sales' | 'Expenses' | 'ROI') => {
    addActivity({
      type: 'Reports',
      module: 'Reports',
      user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
      action: 'PRINT',
      table: 'Sales Report',
      details: `Printed ${type} Report for period: ${periodLabel}`
    });
    setPrintMode(type);
    document.body.classList.add('printing-report');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-report');
        setPrintMode('all');
      }, 500);
    }, 250);
  };

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
          {dateRange === 'Custom' && (
            <div className="hidden lg:flex items-center gap-1">
              <input type="date" aria-label="Custom start date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-xs" />
              <span className="text-xs text-gray-500">–</span>
              <input type="date" aria-label="Custom end date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-10 rounded-md border border-gray-300 px-2 text-xs" />
              <button
                type="button"
                className="h-10 px-2 text-sm font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 hover:text-red-700"
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setDateRange('Daily'); }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Export / Generate Report Action Icon Button */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-red-600 bg-white text-red-600 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            title="Generate Report"
            aria-label="Generate Report"
          >
            <Download className="h-5 w-5 text-red-600" />
          </button>

          {/* Date Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Select range"
                className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <Calendar className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline truncate mx-1 flex-1 text-center">{dateRange === 'Annually' ? 'Annual' : dateRange}</span>
                <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 min-w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
              {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Custom'].map((range) => (
                <DropdownMenuItem
                  key={range}
                  onClick={() => setDateRange(range as typeof dateRange)}
                  className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer ${dateRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
                >
                  {range === 'Annually' ? 'Annual' : range}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, dateRange, customStartDate, customEndDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-8 pb-10 animate-in fade-in duration-700 print:hidden">
      {dateRange === 'Custom' && (
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
            onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setDateRange('Daily'); }}
          >
            Clear
          </button>
        </div>
      )}
      {/* 1. TOP SUMMARY CARDS - Business Activity Section */}
      <Card className="border-none shadow-none mb-2">
        <CardHeader className="pt-5 pb-0 mb-0">
          <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Business Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-0 mb-0 -mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Card
              role="button"
              tabIndex={0}
              aria-label="View Total Sales details"
              className="border-none shadow-md bg-gradient-to-br from-green-50 to-green-100 overflow-hidden relative group cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              onClick={() => navigate('/total-sales', { state: { dateRange, customStartDate, customEndDate } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/total-sales', { state: { dateRange, customStartDate, customEndDate } });
                }
              }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={48} className="text-green-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} Sales</p>
                <p className="text-2xl font-black text-green-600 tracking-tight">
                  {formatPeso(totalSalesAmount || 0)}
                </p>
              </CardContent>
            </Card>

            <Card
              role="button"
              tabIndex={0}
              aria-label="View Payments Received ledger"
              className="border-none shadow-md bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden relative group cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              onClick={() => navigate('/payments-received', { state: { dateRange, customStartDate, customEndDate } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/payments-received', { state: { dateRange, customStartDate, customEndDate } });
                }
              }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wallet size={48} className="text-blue-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} Payments Received</p>
                <p className="text-2xl font-black text-blue-600 tracking-tight">
                  {formatPeso(totalPaymentsReceived || 0)}
                </p>
              </CardContent>
            </Card>

            <Card
              role="button"
              tabIndex={0}
              aria-label="View Total Orders"
              className="border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden relative group cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              onClick={() => navigate('/total-orders', { state: { dateRange, customStartDate, customEndDate } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/total-orders', { state: { dateRange, customStartDate, customEndDate } });
                }
              }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShoppingBag size={48} className="text-purple-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} Orders</p>
                <p className="text-2xl font-black text-purple-600 tracking-tight">
                  {(totalOrdersCount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card
              role="button"
              tabIndex={0}
              aria-label="View Expenses"
              className="border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden relative group cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              onClick={() => navigate('/expenses', { state: { dateRange, customStartDate, customEndDate } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/expenses', { state: { dateRange, customStartDate, customEndDate } });
                }
              }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingDown size={48} className="text-orange-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} Expenses</p>
                <p className="text-2xl font-black text-orange-600 tracking-tight">
                  {formatPeso(totalExpensesAmount || 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary Section */}
      <Card className="border-none shadow-none mb-4">
        <CardHeader className="pt-5 pb-0 mb-0">
          <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-0 mb-0 -mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Net Sales */}
            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={48} className="text-emerald-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} Net Sales</p>
                <p className="text-2xl font-black text-emerald-600 tracking-tight">
                  {formatPeso(netSalesAmount)}
                </p>
              </CardContent>
            </Card>

            {/* Balance Due */}
            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <CircleAlert size={48} className="text-red-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} Balance Due</p>
                <p className="text-2xl font-black text-red-600 tracking-tight">
                  {formatPeso(totalBalanceDue)}
                </p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={48} className="text-blue-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} Net Profit</p>
                <p className="text-2xl font-black text-blue-600 tracking-tight">
                  {formatPeso(profit)}
                </p>
              </CardContent>
            </Card>

            {/* ROI */}
            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Percent size={48} className="text-purple-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{timeframePrefix} ROI</p>
                <p className="text-2xl font-black text-purple-600 tracking-tight">
                  {roiSummary.display}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* 2. PAYMENT ANALYTICS & SERVICE TYPE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1.5 pt-3.5 px-4 sm:px-5 gap-2">
            <div className="flex flex-col text-center sm:text-left">
              <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight">
                TOTAL SALES BY SERVICE TYPE — {timeframePrefix.toUpperCase()}
              </CardTitle>
              {periodLabel && (
                <span className="text-[11px] font-bold text-red-600 mt-0.5 tracking-normal">
                  {periodLabel}
                </span>
              )}
            </div>
            {/* Header Legend matching Dashboard */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[8.5px] font-bold uppercase tracking-wider text-gray-500">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: '#A2C2B9' }} /> BASIC CLEANING</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: '#93C5FD' }} /> MINOR REGLUE</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: '#D69BE5' }} /> FULL REGLUE</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: '#F5CD93' }} /> COLOR RENEWAL</div>
            </div>
          </CardHeader>
          <CardContent className="pt-1 px-3 sm:px-4 pb-2.5">
            <ResponsiveContainer width="100%" height={215}>
              <BarChart data={serviceVolume} layout="vertical" margin={{ top: 6, right: 15, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9.5, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.04)', radius: 4 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const val = Number(data.amount || 0);
                      return (
                        <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xl">
                          <p className="font-bold text-gray-900 text-xs mb-0.5">{data.name}</p>
                          <p className="text-[11px] text-gray-600">Total Sales: ₱{val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
                  {serviceVolume.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1.5 pt-3.5 px-4 sm:px-5 gap-2">
            <div className="flex flex-col text-center sm:text-left">
              <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight">
                PAYMENT METHOD ANALYTICS — {timeframePrefix.toUpperCase()}
              </CardTitle>
              {periodLabel && (
                <span className="text-[11px] font-bold text-red-600 mt-0.5 tracking-normal">
                  {periodLabel}
                </span>
              )}
            </div>
            <div className="flex justify-center sm:justify-end">
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger className="w-[95px] h-6 text-[8.5px] font-black uppercase tracking-[0.1em] border-gray-200 bg-gray-50/50 focus:ring-0 focus:ring-offset-0">
                  <div className="flex items-center gap-1">
                    <Filter size={9} className="text-gray-400" />
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
          <CardContent className="pt-1 px-3 sm:px-4 pb-2.5 flex flex-col items-center">
            {/* Centered Donut Chart sized to match Dashboard */}
            <div className="w-full flex justify-center">
              <ResponsiveContainer width="100%" height={175} className="max-w-md">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={paymentMethodStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={4}
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
                          <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xl">
                            <p className="font-bold text-gray-900 text-xs mb-0.5">{data.name}</p>
                            <p className="text-[11px] text-gray-600">Transactions: {data.value}</p>
                            <p className="text-[11px] text-gray-600">{data.name} Sales: ₱{data.amount.toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Simple compact legend below chart */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 mt-1 max-w-lg mx-auto">
              {paymentMethodStats.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    {/* 3. PRINT-ONLY EXECUTIVE REPORTS (Exact Visual Mirror of PDF Specification) */}
    <div id="report-print-target" className="hidden print:block font-sans text-gray-900 bg-white box-border w-full">
      {/* Header Banner */}
      <div className="border-b-2 border-red-600 pb-3 mb-4 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Shoelotskey Logo" className="h-11 w-11 object-contain" />
          <div>
            <div className="text-base font-black text-red-600 leading-none tracking-tight uppercase">Shoelotskey</div>
            <div className="text-[9px] font-bold text-gray-700 tracking-wide uppercase mt-0.5">
              Shoe Care & Restoration Services • Villamor-Pasay
            </div>
            <div className="text-xs font-black text-gray-900 uppercase mt-1">
              {printMode === 'Sales' ? 'SALES REPORT' : printMode === 'Expenses' ? 'EXPENSES REPORT' : 'ROI & FINANCIAL PERFORMANCE REPORT'}
            </div>
          </div>
        </div>
        <div className="text-right text-[9px] space-y-0.5">
          <div className="font-bold text-red-600 uppercase">PERIOD: {periodLabel.toUpperCase()}</div>
          <div className="text-gray-600">GENERATED: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-gray-400">SYSTEM: Shoelotskey SMS v2.0</div>
        </div>
      </div>

      {/* SALES REPORT PRINT CONTENT */}
      {(printMode === 'Sales' || printMode === 'all') && (
        <section className="mb-6">
          {/* 2-Column Financial Summary Card */}
          <div className="border border-red-600 rounded-md overflow-hidden mb-5 bg-white">
            <div className="bg-gray-100 border-b border-red-200 px-3 py-1.5 text-[10px] font-black text-red-600 uppercase tracking-wide">
              Financial Summary
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[9.5px]">
              {/* Col 1 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Total Sales:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalSalesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Refunds Issued:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalRefundsAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-bold">Net Sales:</span>
                  <span className="font-black text-gray-900">{formatPeso(netSalesAmount)}</span>
                </div>
                {totalRetainedDepositsAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Retained Deposits:</span>
                    <span className="font-black text-gray-900">{formatPeso(totalRetainedDepositsAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Total Orders:</span>
                  <span className="font-bold text-gray-800">{totalOrdersCount}</span>
                </div>
              </div>

              {/* Col 2 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Payments Received:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalPaymentsReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Balance Due:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalBalanceDue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Total Expenses:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalExpensesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-bold">Net Profit:</span>
                  <span className="font-black text-gray-900">{formatPeso(profit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-bold">Return on Investment (ROI):</span>
                  <span className="font-black text-gray-900">{roiSummary.display}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Records Table */}
          <div className="mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-2">Sales Records</h3>
            <table className="w-full border-collapse border border-gray-200 text-[9px]">
              <thead>
                <tr className="bg-red-600 text-white font-bold uppercase text-[8.5px]">
                  <th className="px-2 py-1.5 text-center w-[16%]">Order #</th>
                  <th className="px-2 py-1.5 text-center w-[12%]">Date</th>
                  <th className="px-2 py-1.5 text-center w-[20%]">Customer</th>
                  <th className="px-2 py-1.5 text-center w-[18%]">Shoe Details</th>
                  <th className="px-2 py-1.5 text-center w-[9%]">Priority</th>
                  <th className="px-2 py-1.5 text-center w-[8%]">Total</th>
                  <th className="px-2 py-1.5 text-center w-[8%]">Paid</th>
                  <th className="px-2 py-1.5 text-center w-[9%]">Balance</th>
                </tr>
              </thead>
              <tbody>
                {totalSalesData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-400 font-semibold uppercase text-[10px]">
                      No sales records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  totalSalesData.map((order: JobOrder, idx: number) => {
                    const shoeStr = [order.brand, order.shoeModel].filter(Boolean).join(' ') || 'Shoes';
                    const svcStr = (order.baseService && order.baseService.length > 0)
                      ? order.baseService.join(', ')
                      : 'Standard Care';

                    const paidAmt = collectedSales(order);
                    const balAmt = Math.max(0, (Number(order.grandTotal) || 0) - paidAmt);
                    const isEven = idx % 2 === 1;

                    return (
                      <tr key={order.id || idx} className={`border-b border-gray-200 ${isEven ? 'bg-gray-50/70' : 'bg-white'}`}>
                        <td colSpan={8} className="p-0">
                          {/* Row Line 1 */}
                          <div className="flex items-center px-2 pt-1.5 pb-0.5">
                            <div className="w-[16%] font-black text-gray-900 truncate">{order.orderNumber}</div>
                            <div className="w-[12%] text-center text-gray-600">
                              {new Date(order.transactionDate || order.createdAt).toLocaleDateString()}
                            </div>
                            <div className="w-[20%] font-bold text-gray-900 truncate">{order.customerName}</div>
                            <div className="w-[18%] text-gray-700 truncate">{shoeStr}</div>
                            <div className="w-[9%] text-center text-gray-600 capitalize">{order.priorityLevel || 'Regular'}</div>
                            <div className="w-[8%] text-right font-black text-gray-900">{formatPeso(order.grandTotal || 0)}</div>
                            <div className="w-[8%] text-right text-gray-700">{formatPeso(paidAmt)}</div>
                            <div className="w-[9%] text-right font-black text-gray-900">{formatPeso(balAmt)}</div>
                          </div>
                          {/* Row Line 2 (Sub-line) */}
                          <div className="flex items-center justify-between px-2 pt-0.5 pb-1.5 text-[7.8px] text-gray-500 border-t border-gray-100">
                            <div className="w-[22%] truncate font-medium">Status: <span className="font-bold text-gray-700 capitalize">{order.status || 'New Order'}</span></div>
                            <div className="w-[18%] truncate"><span className="font-semibold text-gray-700">{order.contactNumber || 'N/A'}</span></div>
                            <div className="w-[36%] truncate">Services: <span className="text-gray-700">{svcStr}</span></div>
                            <div className="w-[24%] text-right truncate"><span className="font-semibold text-gray-700 uppercase">{order.paymentMethod || 'Cash'} • {order.paymentStatus || 'Unpaid'}</span></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* EXPENSES REPORT PRINT CONTENT */}
      {(printMode === 'Expenses') && (
        <section className="mb-6">
          {/* Expenses Breakdown Summary */}
          <div className="border border-red-600 rounded-md overflow-hidden mb-5 bg-white">
            <div className="bg-gray-100 border-b border-red-200 px-3 py-1.5 text-[10px] font-black text-red-600 uppercase tracking-wide">
              Expenses Breakdown Summary
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[9.5px]">
              <div className="flex justify-between">
                <span className="text-gray-900 font-bold">Total Expenses:</span>
                <span className="font-black text-gray-900">{formatPeso(totalExpensesAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Operating Expenses:</span>
                <span className="font-bold text-gray-800">{formatPeso(expenseBreakdown.operating)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Inventory Expenses:</span>
                <span className="font-bold text-gray-800">{formatPeso(expenseBreakdown.inventory)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Other Expenses:</span>
                <span className="font-bold text-gray-800">{formatPeso(expenseBreakdown.other)}</span>
              </div>
            </div>
          </div>

          {/* Expense Entries Table */}
          <div className="mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-2">Expense Entries</h3>
            <table className="w-full border-collapse border border-gray-200 text-[9px]">
              <thead>
                <tr className="bg-red-600 text-white font-bold uppercase text-[8.5px]">
                  <th className="px-2 py-1.5 text-center w-[18%]">Date & Time</th>
                  <th className="px-2 py-1.5 text-center w-[20%]">Category</th>
                  <th className="px-2 py-1.5 text-center w-[20%]">Group</th>
                  <th className="px-2 py-1.5 text-center w-[28%]">Description / Notes</th>
                  <th className="px-2 py-1.5 text-center w-[14%]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpensesByDate.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400 font-semibold uppercase text-[10px]">
                      No expense records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredExpensesByDate.map((exp: any, idx: number) => {
                    const cat = exp.category || 'Expense';
                    const grp = getExpenseGroup(cat);
                    const isEven = idx % 2 === 1;

                    return (
                      <tr key={exp.id || idx} className={`border-b border-gray-200 ${isEven ? 'bg-gray-50/70' : 'bg-white'}`}>
                        <td className="px-2 py-1.5 text-gray-700">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="px-2 py-1.5 font-bold text-gray-900 uppercase">{cat}</td>
                        <td className="px-2 py-1.5 text-gray-600">{grp}</td>
                        <td className="px-2 py-1.5 text-gray-700">{exp.notes || exp.description || '—'}</td>
                        <td className="px-2 py-1.5 text-right font-black text-gray-900">{formatPeso(exp.amount || 0)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ROI REPORT PRINT CONTENT */}
      {(printMode === 'ROI') && (
        <section className="mb-6">
          {/* Executive Performance Summary Card */}
          <div className="border border-red-600 rounded-md overflow-hidden mb-5 bg-white">
            <div className="bg-gray-100 border-b border-red-200 px-3 py-1.5 text-[10px] font-black text-red-600 uppercase tracking-wide">
              Executive Financial Performance Summary
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[9.5px]">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Total Sales:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalSalesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Refunds Issued:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalRefundsAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-bold">Net Sales:</span>
                  <span className="font-black text-gray-900">{formatPeso(netSalesAmount)}</span>
                </div>
                {totalRetainedDepositsAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Retained Deposits:</span>
                    <span className="font-black text-gray-900">{formatPeso(totalRetainedDepositsAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Total Orders:</span>
                  <span className="font-bold text-gray-800">{totalOrdersCount}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Payments Received:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalPaymentsReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Balance Due:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalBalanceDue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Total Expenses:</span>
                  <span className="font-black text-gray-900">{formatPeso(totalExpensesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-bold">Net Profit:</span>
                  <span className="font-black text-gray-900">{formatPeso(profit)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-900 font-bold">Return on Investment (ROI):</span>
                  <span className="font-black text-gray-900 text-xs">{roiSummary.display}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Accounting Formulas & Definitions Card */}
          <div className="border border-gray-300 rounded-md p-2.5 bg-gray-50/60 text-[9px] space-y-1 text-gray-700 mb-4">
            <div className="font-bold text-gray-900 uppercase text-[9.5px] mb-0.5">Accounting Formulas & Definitions</div>
            <div>• <strong>Net Profit</strong> = Net Sales - Total Expenses</div>
            <div>• <strong>ROI</strong> = (Net Profit / Total Expenses) × 100</div>
            {totalExpensesAmount === 0 ? (
              <div className="text-red-600 font-medium">
                • Note: No ROI can be calculated because business expenses for the selected period are zero (ROI = N/A).
              </div>
            ) : (
              <div>
                • Calculation: ({formatPeso(profit)} ÷ {formatPeso(totalExpensesAmount)}) × 100 = <strong>{roiSummary.display}</strong>
              </div>
            )}
          </div>

          {/* ROI FINANCIAL ANALYTICS SECTION */}
          <div className="space-y-3.5 mb-4">
            {/* 1. Service Revenue & Volume Analytics */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-1.5">Service Revenue & Performance Analytics</h3>
              <table className="w-full border-collapse border border-gray-200 text-[8.5px]">
                <thead>
                  <tr className="bg-red-600 text-white font-bold uppercase text-[8px]">
                    <th className="px-2 py-1 text-left w-[36%]">Service Category</th>
                    <th className="px-2 py-1 text-center w-[20%]">Volume (Pairs)</th>
                    <th className="px-2 py-1 text-right w-[24%]">Revenue Generated</th>
                    <th className="px-2 py-1 text-right w-[20%]">% Share of Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {canonicalServiceStats.map((svc) => {
                    const sharePercent = netSalesAmount > 0 ? ((svc.sales / netSalesAmount) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={svc.name} className="hover:bg-gray-50/50">
                        <td className="px-2 py-1 text-left font-bold text-gray-800">{svc.name}</td>
                        <td className="px-2 py-1 text-center text-gray-600">{svc.value} pairs</td>
                        <td className="px-2 py-1 text-right font-black text-gray-900">{formatPeso(svc.sales)}</td>
                        <td className="px-2 py-1 text-right font-bold text-gray-600">{sharePercent}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50/80 font-black border-t border-gray-200">
                    <td className="px-2 py-1 text-left text-gray-900">Total Canonical Services</td>
                    <td className="px-2 py-1 text-center text-gray-900">
                      {canonicalServiceStats.reduce((sum, s) => sum + s.value, 0)} pairs
                    </td>
                    <td className="px-2 py-1 text-right text-gray-900">
                      {formatPeso(canonicalServiceStats.reduce((sum, s) => sum + s.sales, 0))}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-900">100.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. Side-by-Side: Operational Expense Distribution & Payment Method Analytics */}
            <div className="grid grid-cols-2 gap-3">
              {/* Cost & Expense Distribution */}
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-1.5">Cost & Expense Distribution</h3>
                <table className="w-full border-collapse border border-gray-200 text-[8.5px]">
                  <thead>
                    <tr className="bg-red-600 text-white font-bold uppercase text-[8px]">
                      <th className="px-2 py-1 text-left w-[45%]">Expense Group</th>
                      <th className="px-2 py-1 text-right w-[30%]">Amount</th>
                      <th className="px-2 py-1 text-right w-[25%]">% Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-2 py-1 text-left font-bold text-gray-800">Inventory Expenses</td>
                      <td className="px-2 py-1 text-right font-bold text-gray-900">{formatPeso(expenseBreakdown.inventory)}</td>
                      <td className="px-2 py-1 text-right text-gray-600">
                        {totalExpensesAmount > 0 ? ((expenseBreakdown.inventory / totalExpensesAmount) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-left font-bold text-gray-800">Operating Expenses</td>
                      <td className="px-2 py-1 text-right font-bold text-gray-900">{formatPeso(expenseBreakdown.operating)}</td>
                      <td className="px-2 py-1 text-right text-gray-600">
                        {totalExpensesAmount > 0 ? ((expenseBreakdown.operating / totalExpensesAmount) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-left font-bold text-gray-800">Other Expenses</td>
                      <td className="px-2 py-1 text-right font-bold text-gray-900">{formatPeso(expenseBreakdown.other)}</td>
                      <td className="px-2 py-1 text-right text-gray-600">
                        {totalExpensesAmount > 0 ? ((expenseBreakdown.other / totalExpensesAmount) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                    <tr className="bg-gray-50/80 font-black border-t border-gray-200">
                      <td className="px-2 py-1 text-left text-gray-900">Total Expenses</td>
                      <td className="px-2 py-1 text-right text-gray-900">{formatPeso(totalExpensesAmount)}</td>
                      <td className="px-2 py-1 text-right text-gray-900">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Collection Analytics */}
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-1.5">Payment Collection Analytics</h3>
                <table className="w-full border-collapse border border-gray-200 text-[8.5px]">
                  <thead>
                    <tr className="bg-red-600 text-white font-bold uppercase text-[8px]">
                      <th className="px-2 py-1 text-left w-[40%]">Payment Channel</th>
                      <th className="px-2 py-1 text-center w-[25%]">Orders</th>
                      <th className="px-2 py-1 text-right w-[35%]">Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allPaymentMethodStats.map((m) => (
                      <tr key={m.name}>
                        <td className="px-2 py-1 text-left font-bold text-gray-800">{m.name}</td>
                        <td className="px-2 py-1 text-center text-gray-600">{m.value}</td>
                        <td className="px-2 py-1 text-right font-bold text-gray-900">{formatPeso(m.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50/80 font-black border-t border-gray-200">
                      <td className="px-2 py-1 text-left text-gray-900">Total Collections</td>
                      <td className="px-2 py-1 text-center text-gray-900">
                        {allPaymentMethodStats.reduce((sum, m) => sum + m.value, 0)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-900">{formatPeso(totalPaymentsReceived)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Executive Efficiency KPIs Banner */}
            <div className="border border-gray-300 rounded-md p-2 bg-gray-50/60 grid grid-cols-3 gap-2 text-center text-[8.5px]">
              <div>
                <div className="text-[7.5px] font-bold text-gray-500 uppercase">Collection Rate</div>
                <div className="font-black text-gray-900 text-[11px] mt-0.5">
                  {netSalesAmount > 0 ? ((totalPaymentsReceived / netSalesAmount) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
              <div>
                <div className="text-[7.5px] font-bold text-gray-500 uppercase">Operating Profit Margin</div>
                <div className="font-black text-gray-900 text-[11px] mt-0.5">
                  {netSalesAmount > 0 ? ((profit / netSalesAmount) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
              <div>
                <div className="text-[7.5px] font-bold text-gray-500 uppercase">Outstanding Receivables</div>
                <div className="font-black text-gray-900 text-[11px] mt-0.5">
                  {formatPeso(totalBalanceDue)}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Running Footer matching PDF */}
      <div className="mt-8 pt-2 border-t border-gray-300 flex items-center justify-between text-[8px] text-gray-500">
        <div>Shoelotskey SMS • Villamor, Pasay</div>
        <div className="font-bold text-red-600">Make it easy with Shoelotskey!</div>
        <div>System Generated • {new Date().toLocaleDateString()}</div>
      </div>
    </div>

      <GenerateReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        defaultReportType="Sales Report"
        defaultPeriod={dateRange}
        defaultStartDate={customStartDate}
        defaultEndDate={customEndDate}
        userToken={user.token}
        onPrintReport={(type, period, start, end) => {
          if (period !== dateRange) {
            setDateRange(period as any);
          }
          if (start) setCustomStartDate(start);
          if (end) setCustomEndDate(end);
          const cleanType = type === 'Sales Report' ? 'Sales' : type === 'Expenses Report' ? 'Expenses' : 'ROI';
          handleExport(cleanType);
        }}
      />
    </>
  );
}

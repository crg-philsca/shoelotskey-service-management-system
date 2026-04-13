import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useServices } from '@/app/context/ServiceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useMemo, useEffect } from 'react';

import { TrendingUp, ShoppingBag, Filter, Calendar, TrendingDown, ChevronDown, Wallet, CircleAlert, Printer, FileText, FileSpreadsheet } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useNavigate, useLocation } from 'react-router-dom';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useOrders } from '@/app/context/OrderContext';
import type { JobOrder } from '@/app/types';
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/app/components/ui/dropdown-menu';
import { toast } from 'sonner';
import html2pdf from 'html2pdf.js';

interface SalesReportProps {
  onSetHeaderActionRight?: (action: React.ReactNode | null) => void;
  user: { token: string };
}



export default function SalesReport({ onSetHeaderActionRight, user }: SalesReportProps) {
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
  const { services } = useServices();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [printMode, setPrintMode] = useState<'all' | 'Sales' | 'Expenses' | 'ROI'>('all');
  const [dateRange, setDateRange] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually'>(() => {
    return (location.state as any)?.dateRange || 'Daily';
  });

  // 1. GLOBAL DATE FILTERING (Accrual Reference Point)
  const now = new Date();

  const filteredOrdersByDate = useMemo<JobOrder[]>(() => {
    return allOrders.filter((order: JobOrder) => {
      const date = order.transactionDate ? new Date(order.transactionDate) : new Date(order.createdAt);
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

      if (dateRange === 'Daily') {
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        return date >= startOfToday;
      }
      if (dateRange === 'Weekly') return diffDays < 7;
      if (dateRange === 'Monthly') return diffDays < 30;
      if (dateRange === 'Quarterly') return diffDays < 90;
      if (dateRange === 'Annually') return diffDays < 365;
      return true;
    });
  }, [dateRange, allOrders]);

  const filteredExpensesByDate = useMemo<any[]>(() => {
    return expenses.filter((exp: any) => {
      const category = (exp.category || '').toLowerCase();
      const isDaily = category.includes('(daily)');
      const isWeekly = category.includes('(weekly)');
      const isMonthly = category.includes('(monthly)') || 
                        category.includes('water') || 
                        category.includes('electricity');
      
      // Enforce STRICT timeframe buckets as per user request
      if (isDaily && dateRange !== 'Daily') return false;
      if (isWeekly && dateRange !== 'Weekly') return false;
      if (isMonthly && (dateRange !== 'Monthly' && dateRange !== 'Quarterly' && dateRange !== 'Annually')) return false;

      const date = new Date(exp.date);
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dateRange === 'Daily') {
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        return date >= startOfToday;
      }
      if (dateRange === 'Weekly') return diffDays < 7;
      if (dateRange === 'Monthly') return diffDays < 30;
      if (dateRange === 'Quarterly') return diffDays < 90;
      if (dateRange === 'Annually') return diffDays < 365;
      return true;
    });
  }, [dateRange, expenses]);

  // 2. DATA SEGMENTATION
  // Total Revenue (Total billable amount)
  const totalRevenue = useMemo(() => {
    return filteredOrdersByDate.reduce((sum: number, order: JobOrder) => sum + (order.grandTotal || 0), 0);
  }, [filteredOrdersByDate]);

  // Total Pending Payments (Total unpaid balance)
  const totalPendingPayments = useMemo(() => {
    return filteredOrdersByDate.reduce((sum: number, order: JobOrder) => sum + ((order.grandTotal || 0) - (order.amountReceived || 0)), 0);
  }, [filteredOrdersByDate]);

  // Total Sales & Analytics Data (Includes Fully Paid and Downpayment Orders)
  const totalSalesData = useMemo(() => {
    return filteredOrdersByDate.filter((order: JobOrder) => order.paymentStatus === 'fully-paid' || order.paymentStatus === 'downpayment');
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
        counts[method].amount += (order.amountReceived || 0);
      }
    });

    return [
      { name: 'Cash', value: counts.cash.count, amount: counts.cash.amount, color: '#9333ea' },
      { name: 'GCash', value: counts.gcash.count, amount: counts.gcash.amount, color: '#2563eb' },
      { name: 'Maya', value: counts.maya.count, amount: counts.maya.amount, color: '#16a34a' },
    ];
  }, [totalSalesData]);

  // Total Sales Amount (Controlled by Payment Filter)
  const totalSalesAmount = useMemo(() => {
    if (selectedPaymentMethod === 'all') {
      return paymentMethodStats.reduce((sum: number, item) => sum + item.amount, 0);
    }
    return paymentMethodStats.find(p => p.name.toLowerCase() === selectedPaymentMethod.toLowerCase())?.amount || 0;
  }, [selectedPaymentMethod, paymentMethodStats]);

  // Total Orders: All filtered orders
  const totalOrdersCount = filteredOrdersByDate.length;

  // Total Expenses
  const totalExpensesAmount = filteredExpensesByDate.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

  // Profit (Accrual Basis)
  const profit = totalRevenue - totalExpensesAmount;

  // Sales by Service Type (Total Sales)
  const serviceVolume = useMemo(() => {
    return services
      .filter(s => s.category === 'base' && s.active)
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
            .reduce((sum, j) => sum + (j.amountReceived || 0), 0),
          fill: fillColor
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [totalSalesData, services]);

  // 4. PRINT & EXPORT LOGIC
  const handleExport = (type: 'Sales' | 'Expenses' | 'ROI', format: 'print' | 'csv' | 'pdf') => {
    if (format === 'print') {
      setPrintMode(type);
      // Give React a tick to update the DOM with print-only hidden classes
      setTimeout(() => {
        window.print();
        setPrintMode('all');
      }, 100);
      return;
    }

    if (format === 'pdf') {
      const toastId = toast.loading(`Preparing ${type} Report for Download...`);
      setPrintMode(type);

      // [VITAL FIX] Increase delay to 1000ms to ensure Recharts and layout are fully settled
      setTimeout(async () => {
        const element = document.getElementById('report-download-target');
        
        if (!element) {
          toast.error("Critical Error: Report target not found", { id: toastId });
          setPrintMode('all');
          return;
        }

        try {
          // Temporarily move off-screen but make visible for the capture engine
          element.classList.remove('hidden');
          element.style.position = 'fixed';
          element.style.left = '-9999px';
          element.style.top = '0';
          element.style.display = 'block';

          const opt = {
            margin: 0.5,
            filename: `${type}_Report_${dateRange}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2, 
              useCORS: true, 
              logging: false,
              letterRendering: true,
              windowWidth: 1200
            },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
          };

          // Execute download
          await (html2pdf as any)().from(element).set(opt).save();
          
          toast.success(`${type} Report Downloaded!`, { id: toastId });
        } catch (err) {
          console.error("PDF Engine Error:", err);
          toast.error("Download Failed. Try 'Print as PDF' instead.", { id: toastId });
        } finally {
          // CLEANUP: Always revert UI state so buttons don't stay "stuck"
          element.classList.add('hidden');
          element.style.display = '';
          element.style.position = '';
          element.style.left = '';
          setPrintMode('all');
        }
      }, 1000);
      return;
    }

    // CSV LOGIC
    let csvContent = "";
    let fileName = "";

    if (type === 'Sales') {
      fileName = `Sales_Report_${dateRange}_${now.toISOString().split('T')[0]}.csv`;
      csvContent = "Date,Order ID,Customer,Amount,Method,Status\n";
      filteredOrdersByDate.forEach(order => {
        csvContent += `${order.transactionDate || order.createdAt},ORD-${order.id},${order.customerName},${order.grandTotal},${order.paymentMethod},${order.paymentStatus}\n`;
      });
    } else if (type === 'Expenses') {
      fileName = `Expenses_Report_${dateRange}_${now.toISOString().split('T')[0]}.csv`;
      csvContent = "Date,Description,Category,Amount\n";
      filteredExpensesByDate.forEach(exp => {
        csvContent += `${exp.date},"${exp.description}",${exp.category},${exp.amount}\n`;
      });
    } else {
      fileName = `ROI_Report_${dateRange}_${now.toISOString().split('T')[0]}.csv`;
      csvContent = "Metric,Value\n";
      csvContent += `Period,${dateRange}\n`;
      csvContent += `Total Revenue,${totalRevenue}\n`;
      csvContent += `Total Expenses,${totalExpensesAmount}\n`;
      csvContent += `Net Profit,${profit}\n`;
      csvContent += `ROI %,${totalExpensesAmount > 0 ? ((profit / totalExpensesAmount) * 100).toFixed(2) : 'N/A'}\n`;
    }

    const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${type} Report downloaded successfully`);
  };




  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
          {/* Printables Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center rounded-md border border-slate-700 bg-slate-700 text-white shadow-md transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <Printer className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-0 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Report Options</p>
              </div>
              
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="uppercase px-4 py-3 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span>Sales Report</span>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 p-0 rounded-lg border border-slate-200 shadow-md">
                  <DropdownMenuItem onClick={() => handleExport('Sales', 'print')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <Printer className="h-3.5 w-3.5 mr-2 text-slate-500" /> Print as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('Sales', 'csv')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-green-600" /> Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('Sales', 'pdf')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5 mr-2 text-blue-600" /> Export to PDF
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="uppercase px-4 py-3 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 focus:bg-slate-50 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span>Expenses Report</span>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 p-0 rounded-lg border border-slate-200 shadow-md">
                  <DropdownMenuItem onClick={() => handleExport('Expenses', 'print')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <Printer className="h-3.5 w-3.5 mr-2 text-slate-500" /> Print as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('Expenses', 'csv')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-green-600" /> Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('Expenses', 'pdf')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5 mr-2 text-blue-600" /> Export to PDF
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="uppercase px-4 py-3 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 focus:bg-slate-50 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-blue-600" />
                    <span>Sales & Expenses (ROI)</span>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 p-0 rounded-lg border border-slate-200 shadow-md">
                  <DropdownMenuItem onClick={() => handleExport('ROI', 'print')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <Printer className="h-3.5 w-3.5 mr-2 text-slate-500" /> Print as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('ROI', 'csv')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-green-600" /> Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('ROI', 'pdf')} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-600 cursor-pointer hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5 mr-2 text-blue-600" /> Export to PDF
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Select range"
                className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
              >
                <Calendar className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline truncate mx-1 flex-1 text-center">{dateRange}</span>
                <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
              {/* [OWASP A03] Security Mapping: Verified static list prevent injection */}
              {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'].map((range) => (
                <DropdownMenuItem
                  key={range}
                  onClick={() => setDateRange(range as typeof dateRange)}
                  className={`uppercase px-4 py-2 text-[11px] font-black tracking-widest cursor-pointer ${dateRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
                >
                  {range}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, dateRange, filteredOrdersByDate, filteredExpensesByDate, totalRevenue, totalExpensesAmount, profit]);

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
      {/* 1. TOP SUMMARY CARDS - Business Activity Section */}
      <Card className="border-none shadow-none mb-2">
        <CardHeader className="pt-5 pb-0 mb-0">
          <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Business Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-0 mb-0 -mt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <Card
              className="border-none shadow-md bg-gradient-to-br from-green-50 to-green-100 overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate('/total-sales', { state: { dateRange } })}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={48} className="text-green-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{dateRange} Sales</p>
                <p className="text-2xl font-black text-green-600 tracking-tight">
                  ₱{(totalSalesAmount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate('/total-orders', { state: { dateRange } })}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShoppingBag size={48} className="text-purple-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{dateRange} Orders</p>
                <p className="text-2xl font-black text-purple-600 tracking-tight">
                  {(totalOrdersCount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden relative group cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate('/expenses', { state: { dateRange } })}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingDown size={48} className="text-orange-600" />
              </div>
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{dateRange} Expenses</p>
                <p className="text-2xl font-black text-orange-600 tracking-tight">
                  ₱{(totalExpensesAmount || 0).toLocaleString()}
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

    {/* 3. PRINT-ONLY REPORTS (Visible only when printing) */}
    <div id="report-download-target" className="hidden print:block mt-10">
          <div className="flex items-center justify-between border-b-2 border-red-600 pb-4 mb-8">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Shoelotskey" className="h-16 w-16" />
              <div>
                <h1 className="text-2xl font-black text-red-600 uppercase tracking-tighter leading-none">Shoelotskey</h1>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Service Management System</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-gray-900 uppercase">
                {printMode === 'Sales' ? 'SALES' : printMode === 'Expenses' ? 'EXPENSES' : 'FINANCIAL PERFORMANCE'} REPORT
              </h2>
              <p className="text-sm font-bold text-gray-400">{now.toLocaleDateString()} {now.toLocaleTimeString()}</p>
              <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mt-1">{dateRange} SUMMARY</p>
            </div>
          </div>

          {/* Individual Sales Table */}
          <section className={`mb-10 ${printMode !== 'Sales' && printMode !== 'ROI' ? 'print:hidden' : ''}`}>
            <h3 className="text-lg font-black uppercase tracking-widest text-red-600 border-l-4 border-red-600 pl-3 mb-4">Sales Records</h3>
            <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-gray-600 border border-gray-200">Date</th>
                <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-gray-600 border border-gray-200">Order ID</th>
                <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-gray-600 border border-gray-200">Customer</th>
                <th className="px-3 py-2 text-right text-[10px] font-black uppercase text-gray-600 border border-gray-200">Total</th>
                <th className="px-3 py-2 text-center text-[10px] font-black uppercase text-gray-600 border border-gray-200">Method</th>
                <th className="px-3 py-2 text-center text-[10px] font-black uppercase text-gray-600 border border-gray-200">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrdersByDate.map((order: JobOrder) => (
                <tr key={order.id}>
                  <td className="px-3 py-2 text-[10px] border border-gray-200">{new Date(order.transactionDate || order.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-[10px] font-bold border border-gray-200">ORD-{order.id}</td>
                  <td className="px-3 py-2 text-[10px] border border-gray-200">{order.customerName}</td>
                  <td className="px-3 py-2 text-[10px] font-black text-right border border-gray-200">₱{(order.grandTotal || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-[10px] text-center border border-gray-200 font-bold uppercase">{order.paymentMethod}</td>
                  <td className="px-3 py-2 text-[10px] text-center border border-gray-200 font-bold uppercase">{order.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-red-50">
                <td colSpan={3} className="px-3 py-2 text-[11px] font-black uppercase text-red-600 text-right">Total Applied Sales</td>
                <td className="px-3 py-2 text-[11px] font-black text-right text-red-600 border border-red-100">₱{totalRevenue.toLocaleString()}</td>
                <td colSpan={2} className="bg-white"></td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Expenses Table */}
        <section className={`mb-10 page-break-before ${printMode !== 'Expenses' && printMode !== 'ROI' ? 'print:hidden' : ''}`}>
          <h3 className="text-lg font-black uppercase tracking-widest text-red-600 border-l-4 border-red-600 pl-3 mb-4">Expenses Records</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-gray-600 border border-gray-200">Date</th>
                <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-gray-600 border border-gray-200">Description</th>
                <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-gray-600 border border-gray-200">Category</th>
                <th className="px-3 py-2 text-right text-[10px] font-black uppercase text-gray-600 border border-gray-200">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpensesByDate.map((exp: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-3 py-2 text-[10px] border border-gray-200">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-[10px] border border-gray-200">{exp.description}</td>
                  <td className="px-3 py-2 text-[10px] border border-gray-200 font-bold uppercase">{exp.category}</td>
                  <td className="px-3 py-2 text-[10px] font-black text-right border border-gray-200 text-red-600">₱{Number(exp.amount || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-red-50">
                <td colSpan={3} className="px-3 py-2 text-[11px] font-black uppercase text-red-600 text-right">Total Expenses</td>
                <td className="px-3 py-2 text-[11px] font-black text-right text-red-600 border border-red-100">₱{totalExpensesAmount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ROI / Profit Summary */}
        <section className={`mb-10 ${printMode !== 'ROI' ? 'print:hidden' : ''}`}>
          <h3 className="text-lg font-black uppercase tracking-widest text-red-600 border-l-4 border-red-600 pl-3 mb-4">ROI & Profitability Summary</h3>
          <div className="grid grid-cols-2 gap-4 border-2 border-gray-200 p-6 rounded-xl">
            <div className="space-y-4">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Sales Revenue</span>
                <span className="text-[12px] font-black text-gray-900">₱{totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Operating Expenses</span>
                <span className="text-[12px] font-black text-red-600">(₱{totalExpensesAmount.toLocaleString()})</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-sm font-black text-red-600 uppercase tracking-tighter">Net Profit / Loss</span>
                <span className={`text-lg font-black ${profit >= 0 ? 'text-green-600' : 'text-red-700'}`}>
                  ₱{profit.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Return on Investment (ROI)</span>
              <span className={`text-4xl font-black ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalExpensesAmount > 0 ? ((profit / totalExpensesAmount) * 100).toFixed(1) : '---'}%
              </span>
            </div>
          </div>
        </section>

        <div className="mt-20 pt-10 border-t border-gray-200 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">End of Automated Report</p>
          <p className="text-[9px] text-gray-300 mt-2">Generated by Shoelotskey SMS v2.0</p>
        </div>
      </div>
    </>
  );
}

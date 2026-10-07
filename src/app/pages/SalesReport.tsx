import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useMemo, useEffect, useRef } from 'react';
import { TrendingUp, ShoppingBag, Filter, Calendar, TrendingDown, ChevronDown, Wallet, CircleAlert, Percent, Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
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
import { toServiceCode, normalizeServiceCodes } from '@/app/lib/businessRules';
import MMDDYYYYDatePicker from '@/app/components/ui/MMDDYYYYDatePicker';

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

  // Total Discounts Granted for the selected timeframe
  const totalDiscountsAmount = useMemo(() => {
    return totalSalesData.reduce((sum: number, order: JobOrder) => {
      const disc = Number((order as any).discountAmount || (order as any).discount || 0);
      return sum + (disc > 0 ? disc : 0);
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
  const totalRetainedPaymentsAmount = cancellationStats.totalRetained;

  // Authoritative single formula: Active Order Sales + Retained Payments from Cancelled Orders
  // Refunds on cancelled orders are never added to sales (cancelled orders contribute only actual retained payments)
  const netSalesAmount = Math.max(0, totalSalesAmount + totalRetainedPaymentsAmount);

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
    const t0 = performance.now();
    const reportTitle = type === 'Sales' ? 'Sales Report' : type === 'Expenses' ? 'Expenses Report' : 'ROI Report';
    setPrintMode(type);
    document.body.classList.add('printing-report');
    setTimeout(() => {
      const renderDurationMs = Math.round(performance.now() - t0);
      console.log(`[REPORT GENERATION] Rendered ${reportTitle} for Print/Preview (${periodLabel}) in ${renderDurationMs}ms (${(renderDurationMs / 1000).toFixed(3)}s)`);
      addActivity({
        type: 'Reports',
        module: 'Sales Report',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'PRINT',
        table: 'reports',
        details: `Printed ${type} Report for period: ${periodLabel} (Duration: ${renderDurationMs}ms)`,
        newValues: {
          report_type: type.toLowerCase(),
          period_type: dateRange.toLowerCase(),
          period_label: periodLabel,
          duration_ms: renderDurationMs,
          duration_formatted: `${renderDurationMs}ms`,
          status: 'SUCCESS'
        }
      });
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-report');
        setPrintMode('all');
      }, 500);
    }, 250);
  };

  const formatDurationText = (ms: number) => {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  const handleRangeChange = (range: ReportRange) => {
    const t0 = performance.now();
    setDateRange(range);
    if (range === 'Custom' && (!customStartDate || !customEndDate)) {
      toast.info('Please select custom start and end dates');
      return;
    }
    requestAnimationFrame(() => {
      const elapsed = performance.now() - t0;
      const durMs = Math.max(12, Math.round(elapsed));
      const formatted = formatDurationText(durMs);
      const rangeLabel = range === 'Annually' ? 'Annual' : range;
      toast.success(`Sales Report (${rangeLabel}): Displayed (Duration: ${formatted})`);

      addActivity({
        type: 'Reports',
        module: 'Sales Report',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: `Displayed Sales Report for ${rangeLabel} timeframe (Duration: ${formatted})`,
        newValues: {
          report_type: 'sales',
          period_type: range.toLowerCase(),
          duration_ms: durMs,
          duration_formatted: formatted,
          status: 'SUCCESS'
        }
      });
    });
  };

  const handleClearCustomDates = () => {
    const t0 = performance.now();
    setCustomStartDate('');
    setCustomEndDate('');
    requestAnimationFrame(() => {
      const elapsed = performance.now() - t0;
      const durMs = Math.max(12, Math.round(elapsed));
      const formatted = formatDurationText(durMs);
      toast.success(`Sales Report (Custom): Dates Cleared (Duration: ${formatted})`);
      addActivity({
        type: 'Reports',
        module: 'Sales Report',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: `Cleared custom dates (Duration: ${formatted})`,
        newValues: {
          report_type: 'sales',
          period_type: 'custom',
          duration_ms: durMs,
          duration_formatted: formatted,
          status: 'SUCCESS'
        }
      });
    });
  };


  const handleCustomStartDateChange = (newStart: string) => {
    setCustomStartDate(newStart);
    if (!newStart) return;

    let targetEnd = customEndDate;
    let wasAdjusted = false;
    if (customEndDate && newStart > customEndDate) {
      targetEnd = newStart;
      setCustomEndDate(newStart);
      wasAdjusted = true;
    }

    const t0 = performance.now();
    requestAnimationFrame(() => {
      const elapsed = performance.now() - t0;
      const durMs = Math.max(12, Math.round(elapsed));
      const formatted = formatDurationText(durMs);
      const label = targetEnd ? `${newStart} to ${targetEnd}` : `from ${newStart}`;
      if (wasAdjusted) {
        toast.error(`Invalid range: Start date cannot be after end date. End date adjusted to ${newStart}.`);
      } else {
        toast.success(`Sales Report (Custom): Displayed (${label})`);
      }
      addActivity({
        type: 'Reports',
        module: 'Sales Report',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: wasAdjusted
          ? `Start date was after end date; end date auto-adjusted to ${newStart} (${label})`
          : `Displayed Sales Report for Custom timeframe (${label}) (Duration: ${formatted})`,
        newValues: {
          report_type: 'sales',
          period_type: 'custom',
          start_date: newStart,
          end_date: targetEnd || '',
          duration_ms: durMs,
          duration_formatted: formatted,
          status: 'SUCCESS'
        }
      });
    });
  };

  const handleCustomEndDateChange = (newEnd: string) => {
    setCustomEndDate(newEnd);
    if (!newEnd) return;

    let targetStart = customStartDate;
    let wasAdjusted = false;
    if (customStartDate && newEnd < customStartDate) {
      targetStart = newEnd;
      setCustomStartDate(newEnd);
      wasAdjusted = true;
    }

    const t0 = performance.now();
    requestAnimationFrame(() => {
      const elapsed = performance.now() - t0;
      const durMs = Math.max(12, Math.round(elapsed));
      const formatted = formatDurationText(durMs);
      const label = targetStart ? `${targetStart} to ${newEnd}` : `until ${newEnd}`;
      if (wasAdjusted) {
        toast.error(`Invalid range: End date cannot be earlier than start date. Start date adjusted to ${newEnd}.`);
      } else {
        toast.success(`Sales Report (Custom): Displayed (${label})`);
      }
      addActivity({
        type: 'Reports',
        module: 'Sales Report',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: wasAdjusted
          ? `End date was earlier than start date; start date auto-adjusted to ${newEnd} (${label})`
          : `Displayed Sales Report for Custom timeframe (${label}) (Duration: ${formatted})`,
        newValues: {
          report_type: 'sales',
          period_type: 'custom',
          start_date: targetStart || '',
          end_date: newEnd,
          duration_ms: durMs,
          duration_formatted: formatted,
          status: 'SUCCESS'
        }
      });
    });
  };

  const initialDailyLoggedRef = useRef(false);

  const handlePaymentMethodChange = (method: string) => {
    const t0 = performance.now();
    setSelectedPaymentMethod(method);
    requestAnimationFrame(() => {
      const elapsed = performance.now() - t0;
      const durMs = Math.max(12, Math.round(elapsed));
      const formatted = formatDurationText(durMs);
      const methodLabel = method === 'all' ? 'All Payment Methods' : method.toUpperCase();
      addActivity({
        type: 'Reports',
        module: 'Sales Report',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: `Filtered Sales Report by payment method: ${methodLabel} (Duration: ${formatted})`,
        newValues: {
          report_type: 'sales',
          period_type: dateRange.toLowerCase(),
          payment_method: method,
          duration_ms: durMs,
          duration_formatted: formatted,
          status: 'SUCCESS'
        }
      });
    });
  };

  useEffect(() => {
    if (!loading && allOrders && !initialDailyLoggedRef.current) {
      initialDailyLoggedRef.current = true;
      const t0 = performance.now();
      requestAnimationFrame(() => {
        const elapsed = performance.now() - t0;
        const durMs = Math.max(16, Math.round(elapsed));
        const formatted = formatDurationText(durMs);
        const rangeLabel = dateRange === 'Annually' ? 'Annual' : dateRange;

        addActivity({
          type: 'Reports',
          module: 'Sales Report',
          user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
          action: 'REPORT_GENERATION_COMPLETED',
          table: 'reports',
          details: `Displayed Sales Report for ${rangeLabel} timeframe (Duration: ${formatted})`,
          newValues: {
            report_type: 'sales',
            period_type: dateRange.toLowerCase(),
            duration_ms: durMs,
            duration_formatted: formatted,
            status: 'SUCCESS'
          }
        });
      });
    }
  }, [loading, allOrders, dateRange, addActivity]);

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
          {dateRange === 'Custom' && (
            <div className="hidden lg:flex items-center h-10 rounded-md border border-red-600 bg-white shadow-xs px-1.5 gap-1 focus-within:ring-2 focus-within:ring-red-500/20">
              <MMDDYYYYDatePicker
                aria-label="Custom start date"
                value={customStartDate}
                onChange={(val) => handleCustomStartDateChange(val)}
                variant="embedded"
              />
              <span className="text-xs text-red-500 font-bold px-0.5 select-none">–</span>
              <MMDDYYYYDatePicker
                aria-label="Custom end date"
                value={customEndDate}
                onChange={(val) => handleCustomEndDateChange(val)}
                variant="embedded"
              />
              <div className="h-5 w-px bg-red-200 mx-0.5" />
              <button
                type="button"
                onClick={handleClearCustomDates}
                className="h-7 w-7 flex items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition cursor-pointer"
                title="Clear dates"
                aria-label="Clear dates"
              >
                <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
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
                  onClick={() => handleRangeChange(range as typeof dateRange)}
                  className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer flex items-center justify-between transition-colors ${dateRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
                >
                  <span>{range === 'Annually' ? 'Annual' : range}</span>
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
    <div className="space-y-4 animate-in fade-in duration-700 print:hidden">
      {dateRange === 'Custom' && (
        <div className="flex flex-wrap items-end justify-center gap-2 rounded-xl border border-red-200 bg-white p-3 shadow-xs lg:hidden">
          <label className="flex flex-col gap-1 flex-1 min-w-[130px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Start date</span>
            <MMDDYYYYDatePicker aria-label="Custom start date" value={customStartDate} onChange={(val) => handleCustomStartDateChange(val)} className="w-full" />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[130px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">End date</span>
            <MMDDYYYYDatePicker aria-label="Custom end date" value={customEndDate} onChange={(val) => handleCustomEndDateChange(val)} className="w-full" />
          </label>
          <div className="flex items-center gap-1.5 pb-0.5">
            <button
              type="button"
              onClick={handleClearCustomDates}
              className="h-10 px-3 flex items-center gap-1.5 text-xs font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 transition cursor-pointer"
              title="Clear dates"
            >
              <RotateCcw className="h-4 w-4 stroke-[2.5]" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}
      {/* 1. TOP SUMMARY CARDS - Business Activity Section */}
      <Card>
        <CardHeader className="text-center pt-2 pb-0 mb-0">
          <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">
            Business Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center pt-0 pb-0 mb-0 -mt-5">
          <div className="grid w-full grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <TrendingUp size={42} className="text-green-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} Sales</p>
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
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Wallet size={42} className="text-blue-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} Payments Received</p>
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
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <ShoppingBag size={42} className="text-purple-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} Orders</p>
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
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <TrendingDown size={42} className="text-orange-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} Expenses</p>
                <p className="text-2xl font-black text-orange-600 tracking-tight">
                  {formatPeso(totalExpensesAmount || 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary Section */}
      <Card>
        <CardHeader className="text-center pt-2 pb-0 mb-0">
          <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center pt-0 pb-0 mb-0 -mt-5">
          <div className="grid w-full grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Net Sales */}
            <Card 
              role="button"
              tabIndex={0}
              aria-label="View Net Sales details in Total Sales"
              className="border-none shadow-md bg-white overflow-hidden relative group cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              onClick={() => navigate('/total-sales', { state: { dateRange, customStartDate, customEndDate, cardFilter: 'net-sales' } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/total-sales', { state: { dateRange, customStartDate, customEndDate, cardFilter: 'net-sales' } });
                }
              }}
            >
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <TrendingUp size={42} className="text-emerald-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} Net Sales</p>
                <p className="text-2xl font-black text-emerald-600 tracking-tight">
                  {formatPeso(netSalesAmount)}
                </p>
                {totalDiscountsAmount > 0 && (
                  <p className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200/80 rounded px-1.5 py-0.5 mt-1 inline-block">
                    Discounts: -{formatPeso(totalDiscountsAmount)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Balance Due */}
            <Card 
              role="button"
              tabIndex={0}
              aria-label="View Balance Due details in Total Sales"
              className="border-none shadow-md bg-white overflow-hidden relative group cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              onClick={() => navigate('/total-sales', { state: { dateRange, customStartDate, customEndDate, cardFilter: 'balance-due' } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/total-sales', { state: { dateRange, customStartDate, customEndDate, cardFilter: 'balance-due' } });
                }
              }}
            >
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <CircleAlert size={42} className="text-red-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} Balance Due</p>
                <p className="text-2xl font-black text-red-600 tracking-tight">
                  {formatPeso(totalBalanceDue)}
                </p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <TrendingUp size={42} className="text-blue-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} Net Profit</p>
                <p className="text-2xl font-black text-blue-600 tracking-tight">
                  {formatPeso(profit)}
                </p>
              </CardContent>
            </Card>

            {/* ROI */}
            <Card className="border-none shadow-md bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Percent size={42} className="text-purple-600" />
              </div>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">{timeframePrefix} ROI</p>
                <p className="text-2xl font-black text-purple-600 tracking-tight">
                  {roiSummary.display}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* 2. PAYMENT ANALYTICS & SERVICE TYPE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
        <Card className="border-none shadow-md bg-white overflow-hidden gap-0 h-full flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between pb-1.5 pt-3 sm:pt-4 px-3 sm:px-5 gap-2">
            <div className="flex flex-col text-left min-w-0 pr-1">
              <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight">
                TOTAL SALES BY SERVICE TYPE — {timeframePrefix.toUpperCase()}
              </CardTitle>
              {periodLabel && (
                <span className="text-[10px] sm:text-[11px] font-bold text-red-700 mt-0.5 tracking-normal leading-tight">
                  {periodLabel}
                </span>
              )}
            </div>
            {/* Header Legend: 2x2 grid */}
            <div className="grid grid-cols-2 gap-x-2.5 sm:gap-x-4 gap-y-1 text-[7.5px] sm:text-[8.5px] font-bold uppercase tracking-wider text-gray-500 shrink-0">
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#A2C2B9] shrink-0 inline-block" />
                <span className="leading-none">BASIC CLEANING</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#93C5FD] shrink-0 inline-block" />
                <span className="leading-none">MINOR REGLUE</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#D69BE5] shrink-0 inline-block" />
                <span className="leading-none">FULL REGLUE</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#F5CD93] shrink-0 inline-block" />
                <span className="leading-none">COLOR RENEWAL</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-3 sm:px-4 pb-1 flex-1 flex flex-col justify-center">
            <ResponsiveContainer width="100%" height={175} debounce={50}>
              <BarChart data={serviceVolume} layout="vertical" margin={{ top: 6, right: 15, left: -5, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
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

                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={15}>
                  {serviceVolume.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden gap-0 h-full flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between pb-1.5 pt-3 sm:pt-4 px-3 sm:px-5 gap-2">
            <div className="flex flex-col text-left min-w-0 pr-1 flex-1">
              <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight truncate">
                PAYMENT METHOD ANALYTICS — {timeframePrefix.toUpperCase()}
              </CardTitle>
              {periodLabel && (
                <span className="text-[10px] sm:text-[11px] font-bold text-red-700 mt-0.5 tracking-normal leading-tight">
                  {periodLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-end shrink-0">
              <Select value={selectedPaymentMethod} onValueChange={handlePaymentMethodChange}>
                <SelectTrigger className="w-[85px] sm:w-[95px] h-6 text-[8.5px] font-black uppercase tracking-[0.1em] border-gray-200 bg-gray-50/50 focus:ring-0 focus:ring-offset-0">
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
          <CardContent className="pt-0 px-3 sm:px-4 pb-1 flex flex-col justify-between flex-1">
            <div className="w-full flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={146} debounce={50}>
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={paymentMethodStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={62}
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
                            <p className="text-[11px] text-gray-600">{data.name} Sales: {formatPeso(data.amount)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Compact bottom legend */}
            <div className="flex items-center justify-center gap-3 sm:gap-5 pb-0.5 whitespace-nowrap">
              {paymentMethodStats.map((item) => (
                <div key={item.name} className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: item.color }} />
                  <span className="leading-none">{item.name}</span>
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
          <img src="/logo.webp" alt="Shoelotskey Logo" width="44" height="44" className="h-11 w-11 object-contain" />
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
                  <span className="text-gray-900 font-bold">Total Sales:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalSalesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Refunds Issued:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalRefundsAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Net Sales:</span>
                  <span className="font-bold text-gray-900">{formatPeso(netSalesAmount)}</span>
                </div>
                {totalRetainedPaymentsAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-normal">Retained Payments:</span>
                    <span className="font-bold text-gray-900">{formatPeso(totalRetainedPaymentsAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Total Orders:</span>
                  <span className="font-bold text-gray-900">{totalOrdersCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Discounts Granted:</span>
                  <span className={totalDiscountsAmount > 0 ? "font-bold text-emerald-700" : "font-bold text-gray-900"}>
                    {totalDiscountsAmount > 0 ? `-${formatPeso(totalDiscountsAmount)}` : formatPeso(0)}
                  </span>
                </div>
              </div>

              {/* Col 2 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Payments Received:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalPaymentsReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Balance Due:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalBalanceDue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Total Expenses:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalExpensesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Net Profit:</span>
                  <span className="font-bold text-gray-900">{formatPeso(profit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Return on Investment (ROI):</span>
                  <span className="font-bold text-gray-900">{roiSummary.display}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Records Table */}
          <div className="mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-2">Sales Records</h3>
            <table className="w-full border-collapse border border-gray-200 text-[9px]">
              <colgroup>
                <col style={{width:'14%'}} />
                <col style={{width:'11%'}} />
                <col style={{width:'17%'}} />
                <col style={{width:'19%'}} />
                <col style={{width:'7%'}} />
                <col style={{width:'8%'}} />
                <col style={{width:'8%'}} />
                <col style={{width:'8%'}} />
                <col style={{width:'8%'}} />
              </colgroup>
              <thead>
                <tr className="bg-red-600 text-white font-bold uppercase text-[8.5px]">
                  <th className="px-2 py-1.5 text-left">Order #</th>
                  <th className="px-2 py-1.5 text-center">Order Date</th>
                  <th className="px-2 py-1.5 text-left">Customer</th>
                  <th className="px-2 py-1.5 text-center">Shoe Details</th>
                  <th className="px-2 py-1.5 text-center">Qty</th>
                  <th className="px-2 py-1.5 text-center">Priority</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                  <th className="px-2 py-1.5 text-right">Paid</th>
                  <th className="px-2 py-1.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {totalSalesData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-600 font-semibold uppercase text-xs">
                      No sales records found for the selected period.
                    </td>
                  </tr>
                ) : (
                  totalSalesData.map((order: JobOrder, idx: number) => {
                    const pairCount = order.items && order.items.length > 0 
                      ? order.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0)
                      : (Number((order as any).pairsCount) || 1);
                    const pairText = `${pairCount} PR`;
                    const shoeStr = [order.brand, order.shoeModel].filter(Boolean).join(' ') || 'Shoes';
                    
                    const baseSvcs = (Array.isArray(order.baseService)
                      ? order.baseService
                      : String(order.baseService || '').split(',')
                    ).map(s => String(s || '').trim().replace(' (with basic cleaning)', '')).filter(Boolean);

                    const addonSvcs = (Array.isArray(order.addOns)
                      ? order.addOns
                      : String(order.addOns || '').split(',')
                    ).flatMap((a: any) => {
                      if (!a) return [];
                      if (typeof a === 'string') return a.split(',');
                      return [a.name || a.service_name || a.service_code || ''];
                    }).map(s => String(s || '').trim()).filter(Boolean);

                    const allSvcs = [...baseSvcs, ...addonSvcs];
                    const serviceCodes = normalizeServiceCodes(allSvcs.length > 0 ? allSvcs : ['BC']);
                    const codesStr = (serviceCodes.length > 0 ? serviceCodes : ['BC']).join(', ');

                    const paidAmt = collectedSales(order);
                    const balAmt = Math.max(0, (Number(order.grandTotal) || 0) - paidAmt);
                    const isEven = idx % 2 === 1;

                    return (
                      <tr key={order.id || idx} className={`border-b border-gray-200 ${isEven ? 'bg-gray-50/70' : 'bg-white'}`}>
                        {/* Main data row — one cell per column */}
                        <td className="px-2 pt-1.5 pb-0.5 font-black text-gray-900 truncate align-top">{order.orderNumber}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-center text-gray-600 align-top whitespace-nowrap">
                          {new Date(order.transactionDate || order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-2 pt-1.5 pb-0.5 font-bold text-gray-900 truncate align-top">{order.customerName}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-center align-top">
                          <div className="font-semibold text-gray-800 truncate text-center">
                            {shoeStr}
                          </div>
                          <div className="text-[7.8px] text-gray-600 mt-0.5 leading-tight text-center">
                            {codesStr}
                          </div>
                        </td>
                        <td className="px-2 pt-1.5 pb-0.5 text-center font-bold text-gray-800 align-top whitespace-nowrap">
                          {pairText}
                        </td>
                        <td className="px-2 pt-1.5 pb-0.5 text-center text-gray-600 capitalize align-top">{order.priorityLevel || 'Regular'}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-right font-black text-gray-900 align-top">
                          <div>{formatPeso(order.grandTotal || 0)}</div>
                          {Boolean(Number((order as any).discountAmount || (order as any).discount || 0) > 0.01) && (
                            <div className="text-[7.5px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded inline-block mt-0.5 border border-emerald-200">
                              Disc: -{formatPeso(Number((order as any).discountAmount || (order as any).discount || 0))}
                            </div>
                          )}
                        </td>
                        <td className="px-2 pt-1.5 pb-0.5 text-right font-black text-gray-900 align-top">{formatPeso(paidAmt)}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-right font-black text-gray-900 align-top">{formatPeso(balAmt)}</td>
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
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-600 font-semibold uppercase text-xs">
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
                  <span className="text-gray-600 font-normal">Total Sales:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalSalesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Refunds Issued:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalRefundsAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Net Sales:</span>
                  <span className="font-bold text-gray-900">{formatPeso(netSalesAmount)}</span>
                </div>
                {totalRetainedPaymentsAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-normal">Retained Payments:</span>
                    <span className="font-bold text-gray-900">{formatPeso(totalRetainedPaymentsAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Total Orders:</span>
                  <span className="font-bold text-gray-900">{totalOrdersCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Discounts Granted:</span>
                  <span className={totalDiscountsAmount > 0 ? "font-bold text-emerald-700" : "font-bold text-gray-900"}>
                    {totalDiscountsAmount > 0 ? `-${formatPeso(totalDiscountsAmount)}` : formatPeso(0)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Payments Received:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalPaymentsReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Balance Due:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalBalanceDue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Total Expenses:</span>
                  <span className="font-bold text-gray-900">{formatPeso(totalExpensesAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-normal">Net Profit:</span>
                  <span className="font-bold text-gray-900">{formatPeso(profit)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-900 font-bold">Return on Investment (ROI):</span>
                  <span className="font-bold text-gray-900 text-xs">{roiSummary.display}</span>
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
              <h3 className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-1.5">Primary Service Revenue & Pair Volume</h3>
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
                        <td className="px-2 py-1 text-left font-bold text-gray-800">{toServiceCode(svc.name)} <span className="font-normal text-gray-500">({svc.name})</span></td>
                        <td className="px-2 py-1 text-center text-gray-600">{svc.value} pairs</td>
                        <td className="px-2 py-1 text-right font-black text-gray-900">{formatPeso(svc.sales)}</td>
                        <td className="px-2 py-1 text-right font-bold text-gray-600">{sharePercent}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50/80 font-black border-t border-gray-200">
                    <td className="px-2 py-1 text-left text-gray-900">Total Services</td>
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

import { useEffect, useMemo, useState, useRef } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import EditOrderModal from '@/app/components/EditOrderModal';
import StockUpdateModal from '@/app/components/StockUpdateModal';
import OrderDetailModal from '@/app/components/OrderDetailModal';
import { Badge } from '@/app/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useServices } from '@/app/context/ServiceContext';
import { useOrders } from '@/app/context/OrderContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useInventory } from '@/app/context/InventoryContext';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import AddExpenseModal from '@/app/components/AddExpenseModal';
import ProcessClaimModal from '@/app/components/ProcessClaimModal';
import {
  Search,
  MoreVertical,
  Calendar as CalendarIcon,
  Package,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Edit,
  ArrowRight,
  PlusCircle,
  Filter,
  RotateCcw,
  Clock7,
  PackageOpen,
  ClipboardCheck,
  FileText,
  CircleAlert,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import type { JobOrder } from '@/app/types';
import React from 'react';
import {
  buildOrderActivityTrends,
  getOrderActivityPeriodLabel,
  collectedSales,
  isDateInRange,
  isSalesEligible,
  isCancelledOrder,
  totalRefundsIssued,
  totalRetainedDeposits,
  orderEventDate,
  serviceVolumeByCanonical,
  type ReportRange,
} from '@/app/lib/salesAnalytics';
import { formatPeso } from '@/app/lib/currency';

// [STABILITY] Error Boundary to prevent White Screen on crash
class DashboardErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-4">
          <CircleAlert className="h-12 w-12 text-red-600 mx-auto" />
          <h2 className="text-xl font-black text-red-900 uppercase">Dashboard Engine Halted</h2>
          <pre className="text-[10px] bg-white p-4 rounded text-left overflow-auto border border-red-100 max-h-40">
            {this.state.error?.toString()}
          </pre>
          <Button onClick={() => window.location.reload()} className="bg-red-600 text-white font-bold uppercase py-2 px-6 rounded-xl">Re-Ignite Engine</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * INTERFACE: DashboardProps
 * Defines the properties passed to the Dashboard component.
 * @param user - Information about the currently logged-in user.
 * @param onSetHeaderActionRight - Function to inject components into the global header's right action area.
 */
interface DashboardProps {
  user: { username: string; role: 'owner' | 'staff' | 'admin'; token: string };
  onSetHeaderActionRight?: (action: ReactNode | null) => void;
}

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

export default function Dashboard(props: DashboardProps) {
  return (
    <DashboardErrorBoundary>
      <DashboardMain {...props} />
    </DashboardErrorBoundary>
  );
}

// [AESTHETIC] Custom Tooltip for Service Volume Chart
const ServiceTooltip = ({ active, payload, isOwner }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-100 min-w-[180px] animate-in zoom-in-95 duration-200">
        <p className="text-sm font-black text-gray-900 mb-2">{data.name}</p>
        <div className="space-y-1 pb-2 border-b border-gray-50 mb-2">
           <div className="flex justify-between text-[11px] font-bold">
             <span className="text-gray-400">Total Orders:</span>
             <span className="text-gray-900">{data.value}</span>
           </div>
           {isOwner && (
             <div className="flex justify-between text-[11px] font-bold">
               <span className="text-gray-400">Revenue:</span>
               <span className="text-emerald-600 font-black">{'\u20B1'}{Number(data.sales || 0).toLocaleString()}</span>
             </div>
           )}
        </div>
        {data.breakdown && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 mt-1">Service Breakdown:</p>
            {Object.entries(data.breakdown).map(([key, val]: any) => (
              <div key={key} className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-500">{key}:</span>
                <span className="text-gray-800">{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

// [AESTHETIC] Custom Tooltip for Activity Trends
const TrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
        <p className="text-sm font-black text-gray-900 mb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-black text-[#A78BFA] uppercase">
            <div className="w-2 h-2 rounded-full bg-[#A78BFA]" /> Orders Created: {payload[0].value}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-[#F97316] uppercase">
            <div className="w-2 h-2 rounded-full bg-[#F97316]" /> Orders Released: {payload[1].value}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function DashboardMain({ user, onSetHeaderActionRight }: DashboardProps) {
  const role = user.role;

  const { orders, loading, refreshing, updateOrder } = useOrders();
  const { services } = useServices();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [cancelOrderModal, setCancelOrderModal] = useState<JobOrder | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);
  const [profitRange, setProfitRange] = useState<ReportRange>('Daily');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  // STATE: Drill-down status filter
  // When a user clicks a status card (e.g., 'New Order'), this state is set
  // and the dashboard switches to show a detailed table for that status.
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<'new-order' | 'on-going' | 'for-release' | 'claimed' | 'cancelled' | null>(() => {
    return (location.state as any)?.status || null;
  });

  useEffect(() => {
    const stateStatus = (location.state as any)?.status;
    if (stateStatus) {
      setSelectedStatus(stateStatus);
    }
  }, [location.state]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
  const [processClaimOrder, setProcessClaimOrder] = useState<JobOrder | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const { expenses, addExpense } = useExpenses();
  const itemsPerPage = 10;

  const baseServices = services.filter(s => s.category === 'base' && s.active);

  // Separate Range-Filtered Orders (for Analytics) from Global Orders (for Status Cards)
  const analyticsOrders = useMemo(() => {
    const now = new Date();
    return (orders || []).filter((order) => {
      if (!order) return false;
      return isDateInRange(orderEventDate(order), profitRange, now, customStartDate, customEndDate);
    });
  }, [orders, profitRange, customStartDate, customEndDate]);

  // Use the global 'orders' for Status Summary cards so all active/cancelled orders are represented
  const statusCounts = useMemo(() => {
    const all = orders || [];
    return {
      new: all.filter(o => o.status === 'new-order').length,
      ongoing: all.filter(o => o.status === 'on-going').length,
      forRelease: all.filter(o => o.status === 'for-release').length,
      claimed: all.filter(o => o.status === 'claimed').length,
      cancelled: all.filter(o => o.status === 'cancelled' || (o.status as any) === 'canceled').length,
    };
  }, [orders]);

  /**
   * MEMO: overviewOrders
   */
  const overviewOrders = useMemo(() => {
    // [CRITICAL FIX] If a specific status is selected, show ALL orders for that status
    // so we don't 'lose' work-in-progress tasks due to the date filter.
    const source = selectedStatus ? (orders || []) : (analyticsOrders || []);
    if (!selectedStatus) return source;
    return source.filter(order => order.status === selectedStatus || (selectedStatus === 'cancelled' && (order.status === 'cancelled' || (order.status as any) === 'canceled')));
  }, [orders, analyticsOrders, selectedStatus]);

  const totalSales = useMemo(() => {
    return (analyticsOrders || [])
      .filter(isSalesEligible)
      .reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0);
  }, [analyticsOrders]);

  const totalRefunds = useMemo(() => {
    return totalRefundsIssued(analyticsOrders || []);
  }, [analyticsOrders]);

  const totalRetainedDepositsAmount = useMemo(() => {
    return totalRetainedDeposits(analyticsOrders || []);
  }, [analyticsOrders]);

  const netSales = useMemo(() => {
    return Math.max(0, totalSales - totalRefunds + totalRetainedDepositsAmount);
  }, [totalSales, totalRefunds, totalRetainedDepositsAmount]);

  const totalBalanceDue = useMemo(() => {
    return (analyticsOrders || [])
      .filter(isSalesEligible)
      .reduce((sum, order) => {
        const billed = Number(order.grandTotal) || 0;
        const isDP = String(order.paymentStatus || '').toLowerCase() === 'downpayment';
        const collected = (isDP && order.depositAmount != null && Number(order.depositAmount) > 0)
          ? Number(order.depositAmount)
          : collectedSales(order);
        return sum + Math.max(0, billed - collected);
      }, 0);
  }, [analyticsOrders]);

  const { inventoryData } = useInventory();
  
  const lowStockItems = useMemo(() => {
    // [STABILITY] Trigger alert if status is not 'In Stock' OR if quantity is critical (<= threshold)
    const filtered = (inventoryData || []).filter(item => {
      const threshold = (item.low_stock_threshold && item.low_stock_threshold > 0)
        ? item.low_stock_threshold
        : ((item.package_size && item.package_size > 0) ? item.package_size : 1);
      return item.isActive && (item.status !== 'In Stock' || Number(item.stock) <= threshold);
    });

    return filtered.sort((a, b) => {
      const presA = getInventoryPresentation(a);
      const presB = getInventoryPresentation(b);
      const stockA = Number(a.stock || 0);
      const stockB = Number(b.stock || 0);
      
      // "no stock on top"
      if (stockA <= 0 && stockB > 0) return -1;
      if (stockB <= 0 && stockA > 0) return 1;
      
      // "and the lowest stock remaining percent"
      return presA.percentageRemaining - presB.percentageRemaining;
    });
  }, [inventoryData]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter((exp) => isDateInRange(new Date(exp.date), profitRange, now, customStartDate, customEndDate));
  }, [expenses, profitRange, customStartDate, customEndDate]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [filteredExpenses]);

  /**
   * Service Volume by Type: pair counts and collected sales for the selected range.
   * Sales use cash received only (unpaid balance is excluded) and are split across
   * services so they cannot exceed period sales.
   */
  const serviceVolumeData = useMemo(() => {
    return serviceVolumeByCanonical(analyticsOrders || []);
  }, [analyticsOrders]);

  /**
   * MEMO: timeSeriesData
   * Prepares sequential data points for the TREND charts.
   * Adapts automatically based on profitRange (Hours for Daily, Days for Weekly, etc.).
   */
  const timeSeriesData = useMemo(
    () => buildOrderActivityTrends(orders ?? [], profitRange, customStartDate, customEndDate),
    [orders, profitRange, customStartDate, customEndDate],
  );

  const chartTitle = profitRange === 'Quarterly'
    ? 'ORDER ACTIVITY — QUARTERLY'
    : profitRange === 'Daily'
    ? 'ORDER ACTIVITY — DAILY'
    : profitRange === 'Weekly'
    ? 'ORDER ACTIVITY — WEEKLY'
    : profitRange === 'Monthly'
    ? 'ORDER ACTIVITY — MONTHLY'
    : profitRange === 'Annually'
    ? 'ORDER ACTIVITY — ANNUAL'
    : 'ORDER ACTIVITY TRENDS';

  const serviceVolumeTitle = profitRange === 'Quarterly'
    ? 'SERVICE VOLUME BY TYPE — QUARTERLY'
    : profitRange === 'Daily'
    ? 'SERVICE VOLUME BY TYPE — DAILY'
    : profitRange === 'Weekly'
    ? 'SERVICE VOLUME BY TYPE — WEEKLY'
    : profitRange === 'Monthly'
    ? 'SERVICE VOLUME BY TYPE — MONTHLY'
    : profitRange === 'Annually'
    ? 'SERVICE VOLUME BY TYPE — ANNUAL'
    : 'SERVICE VOLUME BY TYPE';

  const chartPeriodSubtitle = useMemo(
    () => getOrderActivityPeriodLabel(profitRange, customStartDate, customEndDate),
    [profitRange, customStartDate, customEndDate],
  );

  // Header right action: Navigation and contextual buttons
  useEffect(() => {
    if (!onSetHeaderActionRight) return;

    const rangeMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Select range"
            type="button"
          >
            <CalendarIcon className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline truncate mx-1 flex-1 text-center">{profitRange === 'Annually' ? 'Annual' : profitRange}</span>
            <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 min-w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Custom'].map((range) => (
            <DropdownMenuItem
              key={range}
              onClick={() => setProfitRange(range as typeof profitRange)}
              className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer transition-colors ${profitRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
            >
              {range === 'Annually' ? 'Annual' : range}
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-root-container">
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="space-y-4">
          {refreshing && (
            <div className="flex items-center gap-2 px-1 mb-2">
              <div className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cloud Sync Active</span>
            </div>
          )}

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

          {/* Status Summary - Always Visible */}
          <Card>
            <CardHeader className="text-center pt-5 pb-0 mb-0">
              <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Status Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0 pb-0 mb-0 -mt-5">
              <div className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
                {/* New Order */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'new-order' ? 'ring-2 ring-purple-600' : ''}`}
                  onClick={() => { setSelectedStatus('new-order'); setCurrentPage(1); }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <PlusCircle size={48} className="text-purple-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">New Order</p>
                    <p className="text-3xl font-black text-purple-600 tracking-tight leading-none">{statusCounts.new}</p>
                  </CardContent>
                </Card>
                {/* On-Going */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'on-going' ? 'ring-2 ring-blue-600' : ''}`}
                  onClick={() => { setSelectedStatus('on-going'); setCurrentPage(1); }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Clock7 size={48} className="text-blue-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">On-Going</p>
                    <p className="text-3xl font-black text-blue-600 tracking-tight leading-none">{statusCounts.ongoing}</p>
                  </CardContent>
                </Card>
                {/* For Release */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'for-release' ? 'ring-2 ring-orange-600' : ''}`}
                  onClick={() => { setSelectedStatus('for-release'); setCurrentPage(1); }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <PackageOpen size={48} className="text-orange-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">For Release</p>
                    <p className="text-3xl font-black text-orange-600 tracking-tight leading-none">{statusCounts.forRelease}</p>
                  </CardContent>
                </Card>
                {/* Claimed */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'claimed' ? 'ring-2 ring-gray-600' : ''}`}
                  onClick={() => { setSelectedStatus('claimed'); setCurrentPage(1); }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <ClipboardCheck size={48} className="text-gray-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Claimed</p>
                    <p className="text-3xl font-black text-gray-600 tracking-tight leading-none">{statusCounts.claimed}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Overview Summary Section - Always Shown */}
          {!selectedStatus && (
            <Card>
              <CardHeader className="pt-4 pb-0 mb-0 relative group">
                <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Overview Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-0 mb-0 -mt-5">
                <div className={`grid gap-2 ${role !== 'staff' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* Card 1: Total Active Orders */}
                  <Card 
                    role="button"
                    tabIndex={0}
                    aria-label="Navigate to active orders"
                    onClick={() => navigate('/total-orders', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'active' } })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/total-orders', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'active' } }); } }}
                    className={`border-none shadow-md bg-white overflow-hidden relative cursor-pointer hover:shadow-lg transition-all ${role === 'staff' ? 'col-span-1 md:col-span-2' : 'col-span-1'}`}
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                      <FileText size={42} className="text-yellow-600" />
                    </div>
                    <CardContent className="pt-4 pb-3 px-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Active Orders</p>
                      <p className="text-2xl font-black text-yellow-600 tracking-tight">{overviewOrders.filter(o => ['new-order', 'on-going', 'for-release'].includes(o.status)).length}</p>
                    </CardContent>
                  </Card>
                  {/* Assigned Orders Removed per user request */}
                  {role !== 'staff' && (
                    <>
                      {/* Card 2: Sales (Green) - Next to Active Orders */}
                      <Card 
                        role="button"
                        tabIndex={0}
                        aria-label="Navigate to total sales"
                        onClick={() => navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } })}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } }); } }}
                        className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-green-500 cursor-pointer hover:shadow-lg transition-all"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                          <TrendingUp size={42} className="text-green-600" />
                        </div>
                        <CardContent className="pt-4 pb-3 px-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{profitRange === 'Annually' ? 'Annual' : profitRange} Sales</p>
                          <p className="text-2xl font-black text-green-600 tracking-tight">{formatPeso(netSales)}</p>
                        </CardContent>
                      </Card>

                      {/* Card 3: Balance Due (Red) */}
                      <Card 
                        role="button"
                        tabIndex={0}
                        aria-label="Navigate to balance due sales"
                        onClick={() => navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'balance-due' } })}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'balance-due' } }); } }}
                        className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-red-500 cursor-pointer hover:shadow-lg transition-all"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                          <CircleAlert size={42} className="text-red-600" />
                        </div>
                        <CardContent className="pt-4 pb-3 px-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{profitRange === 'Annually' ? 'Annual' : profitRange} Balance Due</p>
                          <p className="text-2xl font-black text-red-600 tracking-tight">{'\u20B1'}{(totalBalanceDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </CardContent>
                      </Card>

                      {/* Card 4: Total Expenses (Orange) */}
                      <Card 
                        role="button"
                        tabIndex={0}
                        aria-label="Navigate to expenses report"
                        onClick={() => navigate('/expenses', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } })}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/expenses', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } }); } }}
                        className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-orange-500 cursor-pointer hover:shadow-lg transition-all"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                          <TrendingDown size={42} className="text-orange-600" />
                        </div>
                        <CardContent className="pt-4 pb-3 px-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{profitRange === 'Annually' ? 'Annual' : profitRange} Expenses</p>
                          <p className="text-2xl font-black text-orange-600 tracking-tight">{'\u20B1'}{(totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Table - Shown When Status Selected */}
          {selectedStatus && (
            <Card className="border-2 shadow-lg mt-2 gap-2">
              <CardHeader className="pt-5 pb-0 px-4">
                <div className="flex items-center justify-center">
                  <CardTitle className="text-center text-[15px] font-black text-gray-900 uppercase tracking-[0.1em] leading-tight p-0 m-0">
                    {(() => {
                      switch (selectedStatus) {
                        case 'new-order': return 'NEW ORDER';
                        case 'on-going': return 'ON-GOING';
                        case 'for-release': return 'FOR RELEASE';
                        case 'claimed': return 'CLAIMED';
                        case 'cancelled': return 'CANCELLED';
                        default: return 'STATUS';
                      }
                    })()}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Search and Filter Section */}
                <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 mb-4 items-center">
                  <Button
                    onClick={() => {
                      setSelectedStatus(null);
                      setCurrentPage(1);
                      setSearchQuery('');
                      setFilterService('all');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="bg-red-600 text-white hover:bg-red-700 h-9 px-3 md:px-4 flex-shrink-0 uppercase text-[11px] font-bold flex items-center gap-1.5"
                    size="sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden md:inline">Back</span>
                  </Button>
                  <div className="flex-1 min-w-[200px] relative group">
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-9 text-gray-500 group-focus-within:text-red-600 transition-colors"
                      onClick={() => (document.getElementById('statusTableSearch') as HTMLInputElement)?.focus()}
                      title="Focus search"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Input
                      id="statusTableSearch"
                      placeholder="Search order # or customer..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-9 h-9 text-[11px] border-gray-100 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-xl w-full transition-all"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className={`h-9 w-9 p-0 rounded-xl transition-colors flex-shrink-0 ${filterService !== 'all' || filterPriority !== 'all' || startDate || endDate
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
                    className="ml-auto bg-red-600 text-white hover:bg-red-700 h-9 px-3 md:px-4 flex-shrink-0 uppercase text-[11px] font-bold flex items-center gap-1.5"
                    size="sm"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span className="hidden md:inline">New Expense</span>
                  </Button>
                </div>

                {/* Filter Dialog */}
                <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Filters</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Service Type</label>
                        <Select value={filterService} onValueChange={setFilterService}>
                          <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                            <SelectValue placeholder="All Services" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700">All Services</SelectItem>
                            {baseServices.map(service => (
                              <SelectItem key={service.id} value={service.name} className="text-xs focus:bg-red-50 focus:text-red-700">
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Priority Level</label>
                        <Select value={filterPriority} onValueChange={setFilterPriority}>
                          <SelectTrigger className="h-9 text-xs border-gray-100 bg-gray-50/50">
                            <SelectValue placeholder="All Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-700">All Priority</SelectItem>
                            <SelectItem value="regular" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Regular</SelectItem>
                            <SelectItem value="rush" className="text-xs hover:bg-red-50 focus:bg-red-50 focus:text-red-700">Rush</SelectItem>
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
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <Button
                        variant="ghost"
                        className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-xl"
                        onClick={() => {
                          setFilterService('all');
                          setFilterPriority('all');
                          setStartDate('');
                          setEndDate('');
                          setCurrentPage(1);
                        }}>
                        Reset
                      </Button>
                      <Button className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-xl shadow-md uppercase tracking-wider transition-all" onClick={() => setIsFilterOpen(false)}>
                        Apply
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Orders Table */}
                <div>
                  {(() => {
                    let filtered = [...overviewOrders];

                    if (filterService !== 'all') {
                      filtered = filtered.filter(order => (order?.baseService || []).includes(filterService));
                    }

                    if (filterPriority !== 'all') {
                      filtered = filtered.filter(order => order?.priorityLevel === filterPriority);
                    }

                    if (startDate) {
                      const start = new Date(startDate);
                      filtered = filtered.filter(order => order?.createdAt && new Date(order.createdAt) >= start);
                    }
                    if (endDate) {
                      const end = new Date(endDate);
                      end.setHours(23, 59, 59, 999);
                      filtered = filtered.filter(order => order?.createdAt && new Date(order.createdAt) <= end);
                    }

                    if (searchQuery) {
                      const query = searchQuery.toLowerCase();
                      filtered = filtered.filter(order =>
                        (order?.customerName || '').toLowerCase().includes(query) ||
                        (order?.orderNumber || '').toLowerCase().includes(query)
                      );
                    }

                    filtered.sort((a, b) => {
                      const getTS = (ord: any) => {
                         if (!ord?.statusHistory?.length) return new Date(ord?.updatedAt || ord?.createdAt || 0).getTime();
                         const last = ord.statusHistory[ord.statusHistory.length - 1];
                         return new Date(last?.timestamp || 0).getTime();
                      };
                      
                      const timeA = getTS(a);
                      const timeB = getTS(b);

                      const validA = !isNaN(timeA) ? timeA : 0;
                      const validB = !isNaN(timeB) ? timeB : 0;

                      if (validA !== validB) return validB - validA;

                      const priorityOrder = { rush: 0, premium: 1, regular: 2 };
                      const priorityA = priorityOrder[a?.priorityLevel as keyof typeof priorityOrder] ?? 3;
                      const priorityB = priorityOrder[b?.priorityLevel as keyof typeof priorityOrder] ?? 3;
                      if (priorityA !== priorityB) return priorityA - priorityB;

                      return (b?.orderNumber || '').localeCompare(a?.orderNumber || '');
                    });

                    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
                    const startIdx = (currentPage - 1) * itemsPerPage;
                    const paginatedOrders = filtered.slice(startIdx, startIdx + itemsPerPage);

                    return (
                      <>
                        <div className="overflow-x-auto -mx-1 px-1 overflow-y-hidden no-scrollbar">
                          <table className="w-full table-fixed text-xs">
                            <colgroup>
                               <col className="w-[11%]" />
                               <col className="w-[13%]" />
                               <col className="w-[13%]" />
                               <col className="w-[5%]" />
                               <col className="w-[10%]" />
                               <col className="w-[12%]" />
                               <col className="w-[9%]" />
                               <col className="w-[12%]" />
                               <col className="w-[8%]" />
                               <col className="w-[7%]" />
                            </colgroup>
                            <thead className="bg-red-50/50 border-b border-red-100">
                              <tr>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Order #</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Customer</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px]">Services</th>
                                <th className="h-9 px-1 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">QTY</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Order Date</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">
                                  {selectedStatus === 'for-release' ? 'Release Date' : selectedStatus === 'claimed' ? 'Claimed Date' : selectedStatus === 'cancelled' ? 'Cancelled Date' : 'Estimated Date'}
                                </th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Priority</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Payment</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Total</th>
                                <th className="h-9 px-1 text-center font-black text-gray-700 uppercase tracking-wide text-[10px] whitespace-nowrap">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {paginatedOrders.length === 0 ? (
                                <tr>
                                  <td colSpan={10} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                      <ClipboardCheck size={48} className="text-gray-300" />
                                      <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                                        {(() => {
                                          if (searchQuery) return 'No matching orders found';
                                          switch (selectedStatus) {
                                            case 'new-order': return 'No new orders found';
                                            case 'on-going': return 'No ongoing orders found';
                                            case 'for-release': return 'No orders for release';
                                            case 'claimed': return 'No claimed orders found';
                                            case 'cancelled': return 'No cancelled orders found';
                                            default: return 'No orders found';
                                          }
                                        })()}
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                paginatedOrders.map((order) => (
                                  <tr
                                    key={order.id}
                                    className="border-b border-gray-100 hover:bg-gray-50/80 transition-all cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (order) setSelectedOrder({...order});
                                      setIsEditing(false);
                                    }}
                                  >
                                    <td className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-gray-800 max-w-0">
                                      <span className="block truncate w-full" title={order.orderNumber || String(order.id) || '-'}>
                                        {order.orderNumber || order.id || '-'}
                                      </span>
                                    </td>
                                    <td className="px-1.5 py-2.5 text-center max-w-0">
                                      <div className="flex flex-col items-center justify-center text-center w-full min-w-0">
                                        <div className="text-xs font-bold text-gray-900 leading-tight truncate w-full max-w-full" title={order.customerName || 'Walk-In'}>
                                          {order.customerName || 'Walk-In'}
                                        </div>
                                        {order.contactNumber && (
                                          <div className="text-[10px] text-gray-500 mt-0.5 truncate w-full max-w-full whitespace-nowrap" title={order.contactNumber}>
                                            {order.contactNumber}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-1.5 py-2 text-center max-w-0">
                                      {(() => {
                                        const servicesList = (Array.isArray(order.baseService)
                                          ? order.baseService
                                          : String(order.baseService || '').split(',')
                                        )
                                          .flatMap((s) => String(s || '').split(','))
                                          .map((s) => String(s || '').trim().replace(' (with basic cleaning)', ''))
                                          .filter(Boolean);
                                        return servicesList.length > 0 ? (
                                          <div className="flex flex-col items-center justify-center text-center text-[11px] font-semibold text-gray-800 leading-snug w-full min-w-0" title={servicesList.join(', ')}>
                                            {servicesList.slice(0, 3).map((srv, idx) => (
                                              <span key={idx} className="block text-[11px] font-semibold text-gray-800 leading-tight truncate w-full max-w-full">
                                                {srv}{idx < servicesList.length - 1 ? ',' : ''}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 italic font-normal text-center block">-</span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-1 py-2.5 text-center text-xs font-semibold text-gray-700 whitespace-nowrap max-w-0">
                                      <span className="block truncate">{order.quantity || 1} PR</span>
                                    </td>
                                    <td className="px-1.5 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap max-w-0">
                                      {(() => {
                                        const d = new Date(order.createdAt);
                                        if (isNaN(d.getTime())) return '-';
                                        return (
                                          <div className="inline-flex items-center justify-center gap-1 max-w-full">
                                            <CalendarIcon size={12} className="text-purple-600 shrink-0" />
                                            <span className="truncate">{dateFnsFormat(d, 'MM/dd/yy')}</span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-1.5 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap max-w-0">
                                        {(() => {
                                          if (selectedStatus === 'cancelled') {
                                            const cDate = order.cancelledAt || (order as any).updatedAt || order.createdAt;
                                            if (!cDate) return '-';
                                            const d = new Date(cDate);
                                            return (
                                              <div className="inline-flex items-center justify-center gap-1 max-w-full">
                                                <CalendarIcon size={12} className="text-rose-600 shrink-0" />
                                                <span className="truncate">{isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy')}</span>
                                              </div>
                                            );
                                          }
                                          if (selectedStatus === 'claimed') {
                                            const claimDate = order.actualCompletionDate || ((order as any).statusHistory?.find((s: any) => s.status === 'claimed')?.timestamp);
                                            if (!claimDate) return '-';
                                            const d = new Date(claimDate);
                                            const formattedDate = isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy');
                                            return (
                                              <div className="flex flex-col items-center w-full min-w-0">
                                                <div className="inline-flex items-center justify-center gap-1 max-w-full">
                                                  <CalendarIcon size={12} className="text-slate-500 shrink-0" />
                                                  <span className="truncate">{formattedDate}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-medium tracking-wider mt-0.5 whitespace-nowrap truncate w-full max-w-full" title={order.claimedBy || order.customerName || '-'}>
                                                  by {order.claimedBy || order.customerName || '-'}
                                                </span>
                                              </div>
                                            );
                                          }
                                          if (selectedStatus === 'for-release') {
                                            const released = order.actualReleaseDate
                                              || (order as any).statusHistory?.find((s: any) => s.status === 'for-release')?.timestamp
                                              || order.actualCompletionDate;
                                            if (!released) return '-';
                                            const d = new Date(released);
                                            if (isNaN(d.getTime())) return '-';
                                            return (
                                              <div className="inline-flex items-center justify-center gap-1 max-w-full">
                                                <CalendarIcon size={12} className="text-orange-600 shrink-0" />
                                                <span className="truncate">{dateFnsFormat(d, 'MM/dd/yy')}</span>
                                              </div>
                                            );
                                          }
                                          if (!order.predictedCompletionDate) return '-';
                                          const d = new Date(order.predictedCompletionDate);
                                          if (isNaN(d.getTime())) return '-';
                                          return (
                                            <div className="inline-flex items-center justify-center gap-1 max-w-full">
                                              <CalendarIcon size={12} className="text-emerald-600 shrink-0" />
                                              <span className="truncate">{dateFnsFormat(d, 'MM/dd/yy')}</span>
                                            </div>
                                          );
                                        })()}
                                    </td>
                                    <td className="px-1 py-2.5 text-center whitespace-nowrap max-w-0">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border whitespace-nowrap ${order.priorityLevel === 'rush'
                                        ? 'bg-red-50 text-red-700 border-red-100'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        }`}>
                                        {order.priorityLevel}
                                      </span>
                                    </td>
                                    <td className="px-1.5 py-2.5 whitespace-nowrap max-w-0">
                                      <div className="flex flex-col items-center justify-center text-center w-full min-w-0">
                                        {isCancelledOrder(order) ? (
                                          order.refundStatus === 'refunded' ? (
                                            <>
                                              <span className="text-[10px] font-bold text-rose-600 tracking-wider whitespace-nowrap truncate max-w-full">
                                                REFUNDED
                                              </span>
                                              <span className="text-[8.5px] text-rose-600 font-bold tracking-wider mt-0.5 whitespace-nowrap truncate max-w-full">
                                                Refund: {formatPeso(Number(order.refundAmount || order.grandTotal || 0))}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <span className="text-[10px] font-bold text-amber-700 tracking-wider whitespace-nowrap truncate max-w-full">
                                                NO REFUND
                                              </span>
                                              <span className="text-[8.5px] text-amber-700 font-bold tracking-wider mt-0.5 whitespace-nowrap truncate max-w-full">
                                                Retained: {formatPeso(Number(order.amountReceived || order.depositAmount || 0))}
                                              </span>
                                            </>
                                          )
                                        ) : (
                                          <>
                                            <span className={`text-[10px] font-bold tracking-wider whitespace-nowrap truncate max-w-full ${order.paymentStatus === 'fully-paid' ? 'text-green-600' :
                                                order.paymentStatus === 'downpayment' ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {order.paymentStatus === 'fully-paid' ? 'FULLY PAID' : order.paymentStatus === 'downpayment' ? 'DOWNPAYMENT' : order.paymentStatus ? order.paymentStatus.toUpperCase() : '-'}
                                            </span>
                                            {order.paymentMethod && (
                                                <>
                                                    <span className="text-[8.5px] text-gray-400 font-medium uppercase tracking-wider mt-0.5 whitespace-nowrap truncate max-w-full">
                                                      {order.paymentMethod}
                                                    </span>
                                                      {order.paymentStatus === 'downpayment' && (
                                                        <span className="text-[9px] text-red-500 font-medium tracking-wider mt-0.5 whitespace-nowrap truncate max-w-full">
                                                          BAL: {formatPeso(order.balance !== undefined && order.balance !== null && !isNaN(Number(order.balance)) ? Math.max(0, Number(order.balance)) : Math.max(0, (order.grandTotal || 0) - (order.depositAmount || (order.amountReceived && order.amountReceived < order.grandTotal ? order.amountReceived : 0))))}
                                                        </span>
                                                      )}
                                                </>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-1.5 py-2.5 text-center font-medium text-gray-900 whitespace-nowrap max-w-0">
                                      <span className="text-xs font-bold block truncate">
                                        {'\u20B1'}{(order.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                    <td className="px-1 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="outline" className="h-7 w-7 p-0 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-md inline-flex items-center justify-center" title="Actions">
                                            <MoreVertical className="h-3.5 w-3.5 text-red-500" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
                                          {order.status === 'new-order' && (
                                            <>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                updateOrder(order.id, { status: 'on-going', updatedAt: new Date() }, user.username);
                                                toast.success('Order moved to On-Going');
                                              }} className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100 font-bold mb-1">
                                                <ArrowRight className="h-4 w-4 mr-2 text-blue-600" />
                                                Move to On-Going
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                if (order) setSelectedOrder({...order});
                                                setIsEditing(true);
                                              }} className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold mb-1">
                                                <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                                Edit Order Detail
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                setCancelOrderModal(order);
                                              }} className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold mb-1">
                                                <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                                                Cancel Order
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {order.status === 'on-going' && (
                                            <>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                updateOrder(order.id, { status: 'for-release', updatedAt: new Date() }, user.username);
                                                toast.success('Order moved to For Release');
                                              }} className="border border-orange-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100 font-bold mb-1">
                                                <ArrowRight className="h-4 w-4 mr-2 text-orange-600" />
                                                Move to For Release
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                updateOrder(order.id, { status: 'new-order', updatedAt: new Date(), actualCompletionDate: undefined }, user.username);
                                                toast.success('Order reverted to new order');
                                              }} className="border border-purple-200 rounded-md px-2.5 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 focus:text-purple-700 focus:bg-purple-100 font-bold mb-1">
                                                <RotateCcw className="h-4 w-4 mr-2 text-purple-500" />
                                                Undo to New Order
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                if (order) setSelectedOrder({...order});
                                                setIsUpdatingStock(true);
                                              }} className="border border-emerald-200 rounded-md px-2.5 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 focus:text-emerald-800 focus:bg-emerald-100 font-bold mb-1">
                                                <Package className="h-4 w-4 mr-2 text-emerald-600" />
                                                Update Inventory
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                setCancelOrderModal(order);
                                              }} className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold mb-1">
                                                <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                                                Cancel Order
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {order.status === 'for-release' && (
                                            <>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                setProcessClaimOrder(order);
                                              }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-700 bg-gray-50 hover:bg-gray-100 focus:text-gray-800 focus:bg-gray-100 font-bold mb-1">
                                                <ArrowRight className="h-4 w-4 mr-2 text-gray-600" />
                                                Move to Claimed
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                updateOrder(order.id, { status: 'on-going', updatedAt: new Date(), actualCompletionDate: undefined }, user.username);
                                                toast.success('Order reverted to on going');
                                              }} className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100 font-bold mb-1">
                                                <RotateCcw className="h-4 w-4 mr-2 text-blue-500" />
                                                Undo to On-Going
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {order.status === 'claimed' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              const depositAmt = order.depositAmount || 0;
                                              const paymentUpdates = (depositAmt < order.grandTotal) ? {
                                                  paymentStatus: 'downpayment' as any,
                                                  amountReceived: depositAmt,
                                                  balance: order.grandTotal - depositAmt,
                                                  change: 0
                                              } : {};
                                              updateOrder(order.id, {
                                                status: 'for-release' as any,
                                                updatedAt: new Date(),
                                                actualCompletionDate: undefined,
                                                ...paymentUpdates
                                              }, user.username);
                                              toast.success('Order reverted to for release');
                                            }} className="border border-orange-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100 font-bold mb-1">
                                              <RotateCcw className="h-4 w-4 mr-2 text-orange-500" />
                                              Undo to For Release
                                            </DropdownMenuItem>
                                          )}
                                          {(order.status === 'cancelled' || (order.status as any) === 'canceled') && (
                                            <>
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const targetStage = order.cancellationStage || 'new-order';
                                                  updateOrder(order.id, {
                                                    status: targetStage as any,
                                                    cancellationStage: null as any,
                                                    refundStatus: null as any,
                                                    refundAmount: 0,
                                                    refundReason: null as any,
                                                    cancelledAt: null as any,
                                                    updatedAt: new Date()
                                                  }, user.username);
                                                  toast.success(`Order #${order.orderNumber} restored to ${targetStage.replace('-', ' ')}`);
                                                }}
                                                className="border border-purple-200 rounded-md px-2.5 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 focus:text-purple-700 focus:bg-purple-100 font-bold mb-1 cursor-pointer"
                                              >
                                                <RotateCcw className="h-4 w-4 mr-2 text-purple-500" />
                                                Undo Cancel Order
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                if (order) setSelectedOrder({...order});
                                                setIsEditing(false);
                                              }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-700 bg-gray-50 hover:bg-gray-100 focus:text-gray-800 focus:bg-gray-100 font-bold mb-1">
                                                <FileText className="h-4 w-4 mr-2 text-gray-600" />
                                                View Details
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-2 flex items-center justify-between pt-1.5 pb-1 border-t border-gray-50 px-3">
                          <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                            PAGE {currentPage} OF {totalPages}
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                                    variant={isActive ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(pageNum)}
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
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Details Modal */}
          <OrderDetailModal
            order={selectedOrder}
            open={!!selectedOrder && !isEditing && !isUpdatingStock}
            onOpenChange={(open: boolean) => { if (!open) setSelectedOrder(null); }}
          />

          {/* Other Modals */}
          <EditOrderModal order={selectedOrder} open={!!selectedOrder && isEditing} onOpenChange={(open) => !open && setIsEditing(false)} onSave={(id, updates) => { updateOrder(id, updates); setSelectedOrder((prev: any) => prev ? { ...prev, ...updates } : null); setIsEditing(false); }} user={user} />
          <StockUpdateModal
            order={selectedOrder}
            open={!!selectedOrder && isUpdatingStock}
            onOpenChange={(open) => !open && setIsUpdatingStock(false)}
            onSilentSave={(id, updates) => {
              // Background sync — does NOT close the modal
              updateOrder(id, updates);
              setSelectedOrder((prev: any) => prev ? { ...prev, ...updates } : null);
            }}
            onSave={(id, updates) => {
              // Final save — closes the modal
              updateOrder(id, updates);
              setSelectedOrder((prev: any) => prev ? { ...prev, ...updates } : null);
              setIsUpdatingStock(false);
            }}
          />
          <ProcessClaimModal order={processClaimOrder} open={!!processClaimOrder} onOpenChange={(open) => !open && setProcessClaimOrder(null)} onConfirm={(id, data) => { updateOrder(id, data, user.username); }} user={user} />

          {!selectedStatus && (
            <div className="space-y-4">
              {/* Service Volume & Activity Trends Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Service Volume Chart */}
                <Card className="border-none shadow-md bg-white overflow-hidden">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1.5 pt-3.5 px-4 sm:px-5 gap-2">
                    <div className="flex flex-col">
                      <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight">
                        {serviceVolumeTitle}
                      </CardTitle>
                      {chartPeriodSubtitle && (
                        <span className="text-[11px] font-bold text-red-600 mt-0.5 tracking-normal">
                          {chartPeriodSubtitle}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[8.5px] font-bold uppercase tracking-wider text-gray-500">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#A2C2B9]" /> BASIC CLEANING</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#93C5FD]" /> MINOR REGLUE</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#D69BE5]" /> FULL REGLUE</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F5CD93]" /> COLOR RENEWAL</div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-1 px-3 sm:px-4 pb-2.5">
                    <ResponsiveContainer width="100%" height={215}>
                       <BarChart data={serviceVolumeData} margin={{ top: 8, right: 10, left: -10, bottom: 25 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                         <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 9.5, fontWeight: 700, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false} 
                            dy={6} 
                            angle={-15}
                            textAnchor="end"
                         />
                         <YAxis 
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false} 
                         />
                         <Tooltip content={<ServiceTooltip isOwner={['owner', 'admin'].includes(role)} />} cursor={{fill: '#f8fafc'}} />
                         <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={48}>
                           {serviceVolumeData.map((_item, index) => (
                             <Cell key={`cell-${index}`} fill={['#A2C2B9', '#93C5FD', '#D69BE5', '#F5CD93'][index % 4]} />
                           ))}
                         </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Activity Trend Chart */}
                <Card className="border-none shadow-md bg-white overflow-hidden">
                   <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1.5 pt-3.5 px-4 sm:px-5 gap-2">
                     <div className="flex flex-col">
                       <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight">{chartTitle}</CardTitle>
                       {chartPeriodSubtitle && (
                         <span className="text-[11px] font-bold text-red-600 mt-0.5 tracking-normal">
                           {chartPeriodSubtitle}
                         </span>
                       )}
                     </div>
                     <div className="flex items-center gap-2.5 text-[8.5px] font-bold uppercase tracking-wider text-gray-500">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#A78BFA]" /> ORDERS CREATED</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F97316]" /> ORDERS RELEASED</div>
                     </div>
                   </CardHeader>
                   <CardContent className="pt-1 px-3 sm:px-4 pb-2.5">
                     <ResponsiveContainer width="100%" height={215}>
                       <LineChart data={timeSeriesData} margin={{ top: 8, right: 15, left: -10, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                         <XAxis 
                            dataKey="period" 
                            tick={{ fontSize: 9.5, fontWeight: 600, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false} 
                            dy={6} 
                         />
                         <YAxis 
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false} 
                         />
                         <Tooltip content={<TrendTooltip />} />
                         <Line type="monotone" dataKey="newOrders" stroke="#A78BFA" strokeWidth={2.5} dot={{ r: 3.5, fill: '#A78BFA', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                         <Line type="monotone" dataKey="releasedOrders" stroke="#F97316" strokeWidth={2.5} dot={{ r: 3.5, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                       </LineChart>
                     </ResponsiveContainer>
                   </CardContent>
                </Card>
              </div>

              {/* Stock Status Alerts - Compact bottom position */}
              <div className="grid grid-cols-1 gap-4">
                <Card className="border-none shadow-md bg-white gap-0">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 px-4 h-11 !py-0 !pt-0 !pb-0 m-0 space-y-0">
                    <CardTitle className="text-xs font-black uppercase text-gray-800 flex items-center gap-2 m-0 leading-none">
                       <Package size={14} className="text-red-500 shrink-0" /> Stock Status Alerts
                    </CardTitle>
                    <Badge className="bg-red-50 text-red-600 border-red-100 uppercase text-[9px] font-black leading-none shrink-0 py-1 px-2.5">{lowStockItems.length} Warnings</Badge>
                  </CardHeader>
                  <CardContent className="px-4 pt-2.5 pb-3.5">
                    {lowStockItems.length === 0 ? (
                      <div className="py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                         <ClipboardCheck className="mx-auto mb-2 text-emerald-400" size={24} />
                         <p className="text-xs font-black uppercase tracking-widest text-gray-400">All stock levels normal</p>
                      </div>
                    ) : (
                      <div className={`flex flex-col gap-2.5 ${lowStockItems.length > 3 ? 'max-h-[220px] overflow-y-auto pr-1 custom-scrollbar' : ''}`}>
                      {lowStockItems.map((item, idx) => {
                        const pres = getInventoryPresentation(item);
                        const isCritical = Number(item.stock || 0) <= 0;
                        const barColor = isCritical ? 'bg-red-500' : pres.percentageRemaining > 50 ? 'bg-blue-500' : 'bg-amber-400';
                        const textColor = isCritical ? 'text-red-600' : 'text-amber-600';

                        return (
                          <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-gray-50/60 border border-gray-100 hover:border-red-200 transition-all">
                            {/* Row 1: Name (left) + Status Badge (top-right) */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className={isCritical ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'} />
                                <span className="text-xs font-black text-gray-800 uppercase tracking-wide leading-none">{item.name}</span>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider leading-none shrink-0 ${isCritical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                                {isCritical ? 'No Stock' : 'Low Stock'}
                              </span>
                            </div>

                            {/* Row 2: Current Stock (left) + Package (right) */}
                            <div className="flex items-center justify-between gap-2 text-xs mt-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Stock:</span>
                                <span className="text-xs font-bold text-gray-900">{pres.currentQuantityLabel}</span>
                              </div>
                              {pres.isPackaged && (
                                <div className="flex items-center gap-1.5 text-right">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Package:</span>
                                  <span className="text-[11px] font-semibold text-gray-600">1 {pres.packageLabel}</span>
                                </div>
                              )}
                            </div>

                            {/* Row 3: Progress bar with % remaining inline */}
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${barColor}`}
                                  style={{ width: `${Math.min(pres.isPackaged ? pres.progressBarValue : 0, 100)}%` }}
                                />
                              </div>
                              {pres.isPackaged && (
                                <span className={`text-[10px] font-black shrink-0 ${textColor}`}>
                                  {pres.percentageRemaining}% remaining
                                </span>
                              )}
                              {!pres.isPackaged && (
                                <span className={`text-[9px] font-bold shrink-0 ${textColor}`}>
                                  {pres.currentQuantityLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <AddExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onAddExpense={addExpense} />

          {/* CANCEL ORDER / DYNAMIC REFUND POLICY CONFIRMATION MODAL */}
          <Dialog open={!!cancelOrderModal} onOpenChange={() => setCancelOrderModal(null)}>
            <DialogContent className="max-w-[460px] p-6 text-center rounded-2xl shadow-2xl border border-red-100 bg-white">
              {(() => {
                const isRefundAllowed = cancelOrderModal?.status === 'new-order';
                return (
                  <>
                    <DialogHeader className="flex flex-col items-center gap-2">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-1 border-4 ${isRefundAllowed ? 'bg-emerald-100 border-emerald-50 text-emerald-600' : 'bg-red-100 border-red-50 text-red-600'}`}>
                        {isRefundAllowed ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
                      </div>
                      <DialogTitle className="text-xl font-black text-gray-900 uppercase tracking-tight">
                        {isRefundAllowed ? "Confirm Cancellation & Refund" : "Confirm Order Cancellation"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">
                        Are you sure you want to cancel <span className="font-black text-red-600 text-sm">#{cancelOrderModal?.orderNumber}</span>?
                      </p>
                      {isRefundAllowed ? (
                        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-left flex items-start gap-3 shadow-sm">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-emerald-950 uppercase tracking-wide">Pre-Service Policy: Refund Allowed</p>
                            <p className="text-[11px] font-semibold text-emerald-800 mt-0.5 leading-normal">
                              Since this job order is in 'New Order' status and treatment has not commenced, canceling will issue a FULL REFUND of paid deposits (₱{(cancelOrderModal?.amountReceived || 0).toLocaleString()} paid).
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-rose-50 border-2 border-rose-200 rounded-xl text-left flex items-start gap-3 shadow-sm">
                          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-rose-900 uppercase tracking-wide">Strict Policy: No Refunds</p>
                            <p className="text-[11px] font-semibold text-rose-700 mt-0.5 leading-normal">
                              This job order is currently 'On-Going' (or active) and treatment has already commenced. Canceling at this stage forfeits all deposit amounts paid (₱{(cancelOrderModal?.amountReceived || 0).toLocaleString()}). Payment cannot be refunded once work has started.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        disabled={isCancelling}
                        className="flex-1 bg-gray-100 border-gray-200 text-gray-700 font-black uppercase text-xs h-10 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                        onClick={() => { if (!isCancelling) setCancelOrderModal(null); }}
                      >
                        Do Not Cancel
                      </Button>
                      <Button
                        disabled={isCancelling}
                        className={`flex-1 text-white font-black uppercase text-xs h-10 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 ${isRefundAllowed ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                        onClick={async () => {
                          if (cancelOrderModal && !isCancellingRef.current) {
                            isCancellingRef.current = true;
                            setIsCancelling(true);
                            const orderToCancel = cancelOrderModal;
                            try {
                              const isRefund = orderToCancel.status === 'new-order';
                              const depositAmt = orderToCancel.depositAmount || orderToCancel.amountReceived || 0;
                              await updateOrder(orderToCancel.id, {
                                status: 'cancelled',
                                cancellationStage: orderToCancel.status as any,
                                refundStatus: isRefund ? 'refunded' : 'no-refund',
                                refundAmount: isRefund ? depositAmt : 0,
                                refundReason: isRefund ? 'Order cancelled before service commenced (full refund)' : 'Order cancelled during service (deposit forfeited per policy)',
                                cancelledAt: new Date()
                              });
                              setCancelOrderModal(null);
                              if (isRefund) {
                                toast.success(`Order #${orderToCancel.orderNumber} cancelled. Full refund of ₱${depositAmt.toLocaleString()} issued since service had not commenced.`);
                              } else {
                                toast.error(`Order #${orderToCancel.orderNumber} cancelled. No refund issued per policy (service already commenced).`);
                              }
                            } finally {
                              isCancellingRef.current = false;
                              setIsCancelling(false);
                            }
                          }
                        }}
                      >
                        {isCancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {isCancelling ? "Processing..." : (isRefundAllowed ? "Yes, Cancel & Refund" : "Yes, Cancel (No Refund)")}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

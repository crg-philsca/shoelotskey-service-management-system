import { useEffect, useMemo, useState } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { cn } from '@/app/components/ui/utils';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import EditOrderModal from '@/app/components/EditOrderModal';
import StockUpdateModal from '@/app/components/StockUpdateModal';
import { Label } from '@/app/components/ui/label';
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
  User,
  Phone,
  Clock,
  Tag,
  MapPin,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import type { JobOrder } from '@/app/types';
import React from 'react';

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
  user: { username: string; role: 'owner' | 'staff'; token: string };
  onSetHeaderActionRight?: (action: ReactNode | null) => void;
}

export default function Dashboard(props: DashboardProps) {
  return (
    <DashboardErrorBoundary>
      <DashboardMain {...props} />
    </DashboardErrorBoundary>
  );
}

// [AESTHETIC] Custom Tooltip for Service Volume Chart
const ServiceTooltip = ({ active, payload }: any) => {
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
           <div className="flex justify-between text-[11px] font-bold">
             <span className="text-gray-400">Revenue:</span>
             <span className="text-emerald-600 font-black">{'\u20B1'}{Number(data.sales || 0).toLocaleString()}</span>
           </div>
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
            <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" /> Orders Created: {payload[0].value}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-[#34D399] uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-[#34D399]" /> Orders Released: {payload[1].value}
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
  const [profitRange, setProfitRange] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually'>('Daily');
  // STATE: Drill-down status filter
  // When a user clicks a status card (e.g., 'New Order'), this state is set
  // and the dashboard switches to show a detailed table for that status.
  const location = useLocation();
  const [selectedStatus, setSelectedStatus] = useState<'new-order' | 'on-going' | 'for-release' | 'claimed' | null>(() => {
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
    // Safety: check both Today and Yesterday for 'Daily' to catch timezone edge cases
    const todayStr = dateFnsFormat(now, 'yyyy-MM-dd');
    
    const isWithinRange = (order: JobOrder) => {
      if (!order) return false;
      const createdAt = new Date(order.createdAt || 0);
      const transactionDate = new Date(order.transactionDate || order.createdAt || 0);
      
      const isDateMatch = (d: Date) => {
        if (isNaN(d.getTime())) return false;
        const orderDateStr = dateFnsFormat(d, 'yyyy-MM-dd');
        const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
        // Ultra-inclusive: Today (local) OR within last 48 hours to bridge any server-db-browser timezone gaps
        return orderDateStr === todayStr || diffHours < 48;
      };

      if (profitRange === 'Daily') {
        return isDateMatch(transactionDate) || isDateMatch(createdAt);
      }
      
      const compareDate = isNaN(transactionDate.getTime()) ? createdAt : transactionDate;
      const diffDays = (now.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24);
      if (profitRange === 'Weekly') return diffDays <= 7.5;
      if (profitRange === 'Monthly') return diffDays <= 31.5;
      if (profitRange === 'Quarterly') return diffDays <= 93;
      return diffDays <= 367; // Annually
    };

    return (orders || []).filter(order => isWithinRange(order));
  }, [orders, profitRange]);

  // Use the range-filtered 'analyticsOrders' for Status Summary cards to respect date filters
  const statusCounts = useMemo(() => {
    const all = analyticsOrders || [];
    return {
      new: all.filter(o => o.status === 'new-order').length,
      ongoing: all.filter(o => o.status === 'on-going').length,
      forRelease: all.filter(o => o.status === 'for-release').length,
      claimed: all.filter(o => o.status === 'claimed').length,
    };
  }, [analyticsOrders]);

  /**
   * MEMO: overviewOrders
   */
  const overviewOrders = useMemo(() => {
    // [CRITICAL FIX] If a specific status is selected, show ALL orders for that status
    // so we don't 'lose' work-in-progress tasks due to the date filter.
    const source = selectedStatus ? (orders || []) : (analyticsOrders || []);
    if (!selectedStatus) return source;
    return source.filter(order => order.status === selectedStatus);
  }, [orders, analyticsOrders, selectedStatus]);

  const totalSales = useMemo(() => {
    return (analyticsOrders || []).reduce((sum, order) => sum + Math.min(order?.grandTotal || 0, order?.amountReceived || 0), 0);
  }, [analyticsOrders]);

  const totalPendingPayments = useMemo(() => {
    return (analyticsOrders || []).reduce((sum, order) => {
      if (order?.paymentStatus === 'fully-paid') return sum;
      return sum + ((order?.grandTotal || 0) - (order?.amountReceived || 0));
    }, 0);
  }, [analyticsOrders]);

  const { inventoryData } = useInventory();
  
  const lowStockItems = useMemo(() => {
    // [STABILITY] Trigger alert if status is not 'In Stock' OR if quantity is critical (<= package_size or 1)
    return (inventoryData || []).filter(item => {
      const limit = (item.package_size && item.package_size > 0) ? item.package_size : 1;
      return item.isActive && (item.status !== 'In Stock' || Number(item.stock) <= limit);
    });
  }, [inventoryData]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const isWithinRange = (dateValue: Date) => {
      const diffDays = (now.getTime() - dateValue.getTime()) / (1000 * 60 * 60 * 24);
      if (profitRange === 'Daily') {
        return diffDays <= 1.1;
      }
      if (profitRange === 'Weekly') return diffDays < 7;
      if (profitRange === 'Monthly') return diffDays < 30;
      if (profitRange === 'Quarterly') return diffDays < 90;
      return diffDays < 365; // Annually
    };

    return expenses.filter(exp => {
      const category = (exp.category || '').toLowerCase();
      const isDaily = category.includes('(daily)');
      const isWeekly = category.includes('(weekly)');
      const isMonthly = category.includes('(monthly)') || 
                        category.includes('water') || 
                        category.includes('electricity');

      if (isDaily && profitRange !== 'Daily') return false;
      if (isWeekly && profitRange !== 'Weekly') return false;
      if (isMonthly && (profitRange !== 'Monthly' && profitRange !== 'Quarterly' && profitRange !== 'Annually')) return false;

      return isWithinRange(new Date(exp.date));
    });
  }, [expenses, profitRange]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [filteredExpenses]);

  /**
   * MEMO: serviceVolumeData
   * Aggregates order data into service categories for the volume and sales charts.
   * Maps specific sub-services (like 'Minor Reglue (with cleaning)') into parent groups.
   */
  const serviceVolumeData = useMemo(() => {
    const basicCleaningBreakdown = {
      'Basic Cleaning': 0,
      'Unyellowing': 0,
      'Minor Retouch': 0,
      'Minor Restoration': 0,
    };
  
    const result = [
      { name: 'Basic Cleaning', value: 0, sales: 0, breakdown: basicCleaningBreakdown },
      { name: 'Minor Reglue', value: 0, sales: 0 },
      { name: 'Full Reglue', value: 0, sales: 0 },
      { name: 'Color Renewal', value: 0, sales: 0 },
    ];

    (analyticsOrders || []).forEach(order => {
      if (!order) return;
      const items = (order.items && order.items.length) ? order.items : [{
        baseService: Array.isArray(order.baseService) ? order.baseService : [order.baseService],
        addOns: order.addOns || []
      }];
  
      items.forEach(item => {
        if (!item) return;
        const itemBaseServices = Array.isArray(item.baseService) ? item.baseService : [item.baseService];
        const salesShare = ((order.grandTotal || 0) / (items.length || 1));
        const serviceCount = itemBaseServices.length || 1;
        
        itemBaseServices.forEach(baseService => {
          const serviceNameLower = String(baseService || '').toLowerCase();
          if (!serviceNameLower) return;
          
          if (serviceNameLower.includes('full reglue')) {
            result[2].value += 1;
            result[2].sales += salesShare / serviceCount;
          } else if (serviceNameLower.includes('minor reglue')) {
            result[1].value += 1;
            result[1].sales += salesShare / serviceCount;
          } else if (serviceNameLower.includes('color renewal') || serviceNameLower.includes('color') || serviceNameLower.includes('renewal')) {
            result[3].value += 1;
            result[3].sales += salesShare / serviceCount;
          } else if (serviceNameLower.includes('cleaning') || serviceNameLower.includes('unyellowing') || serviceNameLower.includes('retouch') || serviceNameLower.includes('restoration') || serviceNameLower.includes('basic')) {
            result[0].value += 1;
            result[0].sales += salesShare / serviceCount;
            
            if (serviceNameLower.includes('unyellowing')) basicCleaningBreakdown['Unyellowing'] += 1;
            else if (serviceNameLower.includes('retouch')) basicCleaningBreakdown['Minor Retouch'] += 1;
            else if (serviceNameLower.includes('restoration')) basicCleaningBreakdown['Minor Restoration'] += 1;
            else basicCleaningBreakdown['Basic Cleaning'] += 1;
          }
        });
      });
    });
  
    return result;
  }, [analyticsOrders]);

  /**
   * MEMO: timeSeriesData
   * Prepares sequential data points for the TREND charts.
   * Adapts automatically based on profitRange (Hours for Daily, Days for Weekly, etc.).
   */
  const timeSeriesData = useMemo(() => {
    const now = new Date();
    const source = analyticsOrders || [];

    if (profitRange === 'Daily') {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      return hours
        .map(hour => {
          const periodStart = new Date(now);
          periodStart.setHours(hour, 0, 0, 0);
          const periodEnd = new Date(now);
          periodEnd.setHours(hour + 1, 0, 0, 0);

          return {
            period: `${hour}:00`,
            newOrders: source.filter(order => {
              if (!order?.createdAt) return false;
              const orderTime = new Date(order.createdAt);
              return orderTime >= periodStart && orderTime < periodEnd;
            }).length,
            releasedOrders: source.filter(order => {
              if (!order?.actualCompletionDate) return false;
              const releaseTime = new Date(order.actualCompletionDate);
              return releaseTime >= periodStart && releaseTime < periodEnd;
            }).length,
          };
        })
        .filter((_, i) => i >= 8 && i <= 21);
    }

    if (profitRange === 'Weekly') {
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - i));
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return {
          period: date.toLocaleDateString('en-US', { weekday: 'short' }),
          newOrders: source.filter(order => {
            if (!order?.createdAt) return false;
            const orderTime = new Date(order.createdAt);
            return orderTime >= dayStart && orderTime <= dayEnd;
          }).length,
          releasedOrders: source.filter(order => {
            if (!order?.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= dayStart && releaseTime <= dayEnd;
          }).length,
        };
      });
    }

    // Monthly/Quarterly/Annually fallbacks
    const getSafeTimeSeries = (length: number, dayOffset: number, labelFn: (d: Date, i: number) => string) => {
      return Array.from({ length }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (dayOffset - i));
        const start = new Date(date); start.setHours(0,0,0,0);
        const end = new Date(date); end.setHours(23,59,59,999);
        return {
          period: labelFn(date, i),
          newOrders: source.filter(o => o?.createdAt && new Date(o.createdAt) >= start && new Date(o.createdAt) <= end).length,
          releasedOrders: source.filter(o => o?.actualCompletionDate && new Date(o.actualCompletionDate) >= start && new Date(o.actualCompletionDate) <= end).length,
        };
      });
    };

    if (profitRange === 'Monthly') return getSafeTimeSeries(30, 29, (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    if (profitRange === 'Quarterly') return getSafeTimeSeries(12, 84, (_, i) => `Wk ${i+1}`);

    return Array.from({ length: 12 }, (_, i) => {
      const ms = new Date(now);
      ms.setMonth(ms.getMonth() - (11 - i));
      ms.setDate(1); ms.setHours(0,0,0,0);
      const me = new Date(ms);
      me.setMonth(me.getMonth() + 1);
      me.setDate(0); me.setHours(23,59,59,999);
      return {
        period: ms.toLocaleDateString('en-US', { month: 'short' }),
        newOrders: source.filter(o => o?.createdAt && new Date(o.createdAt) >= ms && new Date(o.createdAt) <= me).length,
        releasedOrders: source.filter(o => o?.actualCompletionDate && new Date(o.actualCompletionDate) >= ms && new Date(o.actualCompletionDate) <= me).length,
      };
    });
  }, [analyticsOrders, profitRange]);

  const chartTitle = 'ORDER ACTIVITY TRENDS';

  // Header right action: Navigation and contextual buttons
  useEffect(() => {
    if (!onSetHeaderActionRight) return;

    if (!selectedStatus) {
      onSetHeaderActionRight(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-semibold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Select range"
                type="button"
              >
                <CalendarIcon className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline truncate mx-1 flex-1 text-center">{profitRange}</span>
                <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
              {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'].map((range) => (
                <DropdownMenuItem
                  key={range}
                  onClick={() => setProfitRange(range as typeof profitRange)}
                  className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer transition-colors ${profitRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
                >
                  {range}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
      );
    } else {
      // Status drill-down view: show only filter
      onSetHeaderActionRight(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-semibold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Select range"
              type="button"
            >
              <CalendarIcon className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline truncate mx-1 flex-1 text-center">{profitRange}</span>
              <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
            {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'].map((range) => (
              <DropdownMenuItem
                key={range}
                onClick={() => setProfitRange(range as typeof profitRange)}
                className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer ${profitRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
              >
                {range}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return () => onSetHeaderActionRight(null);
  }, [onSetHeaderActionRight, profitRange, selectedStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-root-container min-h-screen bg-gray-50/30">
      <div className="space-y-6 animate-in fade-in duration-700 p-4 sm:p-6 lg:p-8">
        <div className="space-y-4">
          {refreshing && (
            <div className="flex items-center gap-2 px-1 mb-2">
              <div className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cloud Sync Active</span>
            </div>
          )}

          {/* Status Summary - Always Visible */}
          <Card>
            <CardHeader className="text-center pt-5 pb-0 mb-0">
              <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Status Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0 pb-0 mb-0 -mt-5">
              <div className="grid w-full grid-cols-2 lg:grid-cols-4 gap-2">
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
              <CardHeader className="pt-5 pb-0 mb-0 relative group">
                <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Overview Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-0 mb-0 -mt-5">
                <div className={`grid gap-2 ${role === 'owner' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* Card 1: Total Active Orders */}
                  <Card className={`border-none shadow-md bg-white overflow-hidden relative ${role === 'staff' ? 'col-span-1 md:col-span-2' : 'col-span-1'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <FileText size={48} className="text-yellow-600" />
                    </div>
                    <CardContent className="pt-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Active Orders</p>
                      <p className="text-2xl font-black text-yellow-600 tracking-tight">{overviewOrders.filter(o => ['new-order', 'on-going', 'for-release'].includes(o.status)).length}</p>
                    </CardContent>
                  </Card>
                  {/* Assigned Orders Removed per user request */}
                  {role === 'owner' && (
                    <>
                      {/* Card 2: Pending Payments (Red) */}
                      <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-red-500">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <CircleAlert size={48} className="text-red-600" />
                        </div>
                        <CardContent className="pt-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{profitRange} Pending Payments</p>
                          <p className="text-2xl font-black text-red-600 tracking-tight">{'\u20B1'}{(totalPendingPayments || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </CardContent>
                      </Card>

                      {/* Card 3: Total Sales (Green) */}
                      <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-green-500">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <TrendingUp size={48} className="text-green-600" />
                        </div>
                        <CardContent className="pt-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{profitRange} Total Sales</p>
                          <p className="text-2xl font-black text-green-600 tracking-tight">{'\u20B1'}{(totalSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </CardContent>
                      </Card>

                      {/* Card 4: Total Expenses (Orange) */}
                      <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-orange-500">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <TrendingDown size={48} className="text-orange-600" />
                        </div>
                        <CardContent className="pt-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{profitRange} Total Expenses</p>
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
                    let filtered = (analyticsOrders || []).filter(order => order?.status === selectedStatus);

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
                        <div className="overflow-x-auto -mx-4 px-4 overflow-y-hidden no-scrollbar">
                          <table className="w-full min-w-[700px]">
                            <thead className="bg-red-50">
                              <tr>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Order #</th>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Customer Name</th>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Service Type</th>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Total Qty</th>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Order Date</th>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Release Date</th>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Priority Level</th>
                                {selectedStatus === 'claimed' && <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase hidden md:table-cell">Claimed By</th>}
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase hidden md:table-cell">Processed By</th>
                                <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {paginatedOrders.length === 0 ? (
                                <tr>
                                  <td colSpan={selectedStatus === 'claimed' ? 10 : 9} className="px-6 py-20 text-center">
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
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (order) setSelectedOrder({...order});
                                      setIsEditing(false);
                                    }}
                                  >
                                    <td className="px-3 py-3 text-xs font-medium text-center whitespace-nowrap">{order.orderNumber}</td>
                                    <td className="px-3 py-3 text-xs text-center">
                                      <div className="inline-block text-left w-full max-w-[150px]">
                                        {order.customerName || '-'}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-center">
                                      {Array.isArray(order.baseService)
                                        ? order.baseService.map(s => String(s || '').replace(' (with basic cleaning)', '')).join(', ')
                                        : String(order.baseService || '-').replace(' (with basic cleaning)', '')}
                                    </td>
                                    <td className="px-3 py-3 text-xs text-center text-gray-700">{order.quantity || 1} {(order.quantity || 1) === 1 ? 'Pair' : 'Pairs'}</td>
                                    <td className="px-3 py-3 text-xs text-center">
                                      {(() => {
                                        const d = new Date(order.createdAt);
                                        return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy');
                                      })()}
                                    </td>
                                    <td className="px-3 py-3 text-xs text-center">
                                       {(() => {
                                         if (!order.predictedCompletionDate) return '-';
                                         const d = new Date(order.predictedCompletionDate);
                                         return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy');
                                       })()}
                                    </td>
                                    <td className="px-3 py-3 text-xs text-center">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border whitespace-nowrap
                                             ${order.priorityLevel === 'rush' ? 'bg-red-50 text-red-700 border-red-100' :
                                          order.priorityLevel === 'premium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        }`}>
                                        {order.priorityLevel}
                                      </span>
                                    </td>
                                    {selectedStatus === 'claimed' && <td className="px-3 py-3 text-xs text-center hidden md:table-cell">{order.claimedBy || '-'}</td>}
                                    <td className="px-3 py-3 text-center text-xs hidden md:table-cell">{order.processedBy || '-'}</td>
                                    <td className="px-3 py-3 text-xs text-center" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="inline-flex items-center gap-0.5 h-7 px-1 text-xs border border-red-600 text-red-600 rounded bg-red-50 hover:bg-red-100 transition-colors">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
                                          {order.status === 'new-order' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              if (order) setSelectedOrder({...order});
                                              setIsEditing(true);
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 mb-1">
                                              <Edit className="h-4 w-4 mr-2" />
                                              Edit Order Detail
                                            </DropdownMenuItem>
                                          )}
                                          {order.status === 'on-going' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              if (order) setSelectedOrder({...order});
                                              setIsUpdatingStock(true);
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 focus:text-emerald-800 focus:bg-emerald-100 mb-1">
                                              <Package className="h-4 w-4 mr-2 text-emerald-600" />
                                              Update Stock Inventory
                                            </DropdownMenuItem>
                                          )}
                                          {order.status !== 'new-order' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              const prevStatus =
                                                order.status === 'on-going' ? 'new-order' :
                                                  order.status === 'for-release' ? 'on-going' :
                                                    order.status === 'claimed' ? 'for-release' : null;
                                              if (prevStatus) {
                                                updateOrder(order.id, {
                                                  status: prevStatus as any,
                                                  updatedAt: new Date(),
                                                  actualCompletionDate: undefined
                                                }, user.username);
                                                toast.success(`Order reverted to ${prevStatus.replace('-', ' ')}`);
                                              }
                                            }} className={cn(
                                              "border rounded-md px-2.5 py-1.5 mb-1 focus:outline-none",
                                              order.status === 'on-going' && "border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100 focus:text-purple-700 focus:bg-purple-100",
                                              order.status === 'for-release' && "border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100",
                                              order.status === 'claimed' && "border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100"
                                            )}>
                                              <RotateCcw className={cn(
                                                "h-4 w-4 mr-2",
                                                order.status === 'on-going' && "text-purple-500",
                                                order.status === 'for-release' && "text-blue-500",
                                                order.status === 'claimed' && "text-orange-500"
                                              )} />
                                              {order.status === 'on-going' ? 'Undo to New Order' : order.status === 'for-release' ? 'Undo to On-Going' : 'Undo to For Release'}
                                            </DropdownMenuItem>
                                          )}
                                          {order.status === 'new-order' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              updateOrder(order.id, { status: 'on-going', updatedAt: new Date() }, user.username);
                                              toast.success('Order moved to On-Going');
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100">
                                              <ArrowRight className="h-4 w-4 mr-2" />
                                              Move to On-Going
                                            </DropdownMenuItem>
                                          )}
                                          {order.status === 'on-going' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              updateOrder(order.id, { status: 'for-release', updatedAt: new Date() }, user.username);
                                              toast.success('Order moved to For Release');
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100">
                                              <ArrowRight className="h-4 w-4 mr-2" />
                                              Move to For Release
                                            </DropdownMenuItem>
                                          )}
                                          {order.status === 'for-release' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              setProcessClaimOrder(order);
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 focus:text-gray-700 focus:bg-gray-100">
                                              <ArrowRight className="h-4 w-4 mr-2" />
                                              Move to Claimed
                                            </DropdownMenuItem>
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
          <Dialog open={!!selectedOrder && !isEditing && !isUpdatingStock} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
            <DialogContent className="max-w-md bg-white">
              <DialogHeader className="border-b border-gray-100 pb-4">
                <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
                  Order #
                  <span className="bg-gray-100/80 px-3 py-1 rounded-full text-sm text-gray-700">{selectedOrder?.orderNumber}</span>
                </DialogTitle>
              </DialogHeader>

              {selectedOrder && (
                <div className="space-y-6 pt-2 max-h-[75vh] overflow-y-auto px-1 pr-2 pb-10">
                  {/* Customer Section */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                       <User size={16} className="text-red-500" />
                       <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Customer Details</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Customer Name</Label>
                        <p className="text-sm font-bold text-gray-800">{selectedOrder?.customerName || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Contact Number</Label>
                        <div className="flex items-center gap-2"><Phone size={12} className="text-gray-400" /><p className="text-sm font-bold text-gray-800">{selectedOrder?.contactNumber || '-'}</p></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/50">
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order Date</Label>
                        <div className="flex items-center gap-2"><CalendarIcon size={12} className="text-gray-400" />
                          <p className="text-sm font-bold text-gray-800">
                            {(() => {
                              const d = new Date(selectedOrder?.transactionDate as any || selectedOrder?.createdAt as any || 0);
                              return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy HH:mm');
                            })()}
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Predicted Release</Label>
                        <div className="flex items-center gap-2"><Clock size={12} className="text-gray-400" />
                          <p className="text-sm font-bold text-gray-800">
                            {(() => {
                              if (!selectedOrder?.predictedCompletionDate) return '-';
                              const d = new Date(selectedOrder.predictedCompletionDate as any);
                              return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy');
                            })()}
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Actual Claim Date</Label>
                        <div className="flex items-center gap-2"><ClipboardCheck size={12} className="text-green-500" />
                          <p className="text-sm font-bold text-green-700">
                            {(() => {
                              if (!selectedOrder?.actualCompletionDate) return '-';
                              const d = new Date(selectedOrder.actualCompletionDate as any);
                              return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy HH:mm');
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Shipping Preference */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-center gap-2 mb-2"><Truck size={16} className="text-red-500" /><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Shipping Details</h4></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Preference</Label><p className="text-sm font-bold text-gray-800 uppercase">{selectedOrder?.shippingPreference || 'Pickup'}</p></div>
                      {selectedOrder?.shippingPreference === 'delivery' && selectedOrder?.deliveryCourier && (
                        <div><Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Courier</Label><p className="text-sm font-bold text-gray-800">{selectedOrder.deliveryCourier}</p></div>
                      )}
                    </div>
                    {selectedOrder?.shippingPreference === 'delivery' && (
                      <div className="pt-2 border-t border-gray-200/50">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Address</Label>
                        <div className="flex items-start gap-2"><MapPin size={12} className="text-gray-400 mt-0.5" /><p className="text-sm font-medium text-gray-600">{selectedOrder?.deliveryAddress || 'No address provided'}</p></div>
                      </div>
                    )}
                  </div>

                  {/* Items loop */}
                  <div className="space-y-4">
                    {((selectedOrder?.items?.length ? selectedOrder.items : [selectedOrder]) || []).map((item: any, index: number) => (
                      <div key={index} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                        <div className="flex items-center gap-2 mb-2"><Tag size={16} className="text-red-500" /><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Item #{index + 1}</h4></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div><Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Brand</Label><p className="text-sm font-bold text-gray-800">{item?.brand || '-'}</p></div>
                          <div><Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Model</Label><p className="text-sm font-bold text-gray-800">{item?.shoeModel || '-'}</p></div>
                          <div><Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Material</Label><p className="text-sm font-bold text-gray-800">{item?.shoeMaterial || '-'}</p></div>
                          <div><Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Qty</Label><p className="text-sm font-bold text-gray-800">{item?.quantity || 1}</p></div>
                        </div>
                        <div className="pt-2 border-t border-gray-200/50">
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Base Service</Label>
                          <p className="text-sm font-bold text-gray-800">
                             {Array.isArray(item?.baseService) 
                               ? item.baseService.map((s: string) => String(s || '').replace(' (with basic cleaning)', '')).join(', ')
                               : String(item?.baseService || '-').replace(' (with basic cleaning)', '')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Materials Used section */}
                  {selectedOrder?.inventoryUsed && selectedOrder.inventoryUsed.length > 0 && (
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Package size={16} className="text-emerald-600" />
                        <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest">Materials / Supply Used</h4>
                      </div>
                      <div className="space-y-2">
                        {selectedOrder.inventoryUsed.map((used: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-medium text-slate-700">
                            <span>{used.name}</span>
                            <span className="font-bold text-slate-900 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                              {used.quantity} {used.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment section */}
                  <div className="bg-gray-100/30 p-4 rounded-xl border border-gray-100 space-y-2">
                    <div className="flex justify-between items-center"><span className="text-xs font-medium uppercase tracking-wide">Grand Total</span><span className="text-lg font-black text-red-600">₱{(selectedOrder?.grandTotal || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-medium uppercase tracking-wide">Paid</span><span className="text-sm font-bold text-green-600">₱{(selectedOrder?.amountReceived || 0).toFixed(2)}</span></div>
                    {((selectedOrder?.grandTotal || 0) - (selectedOrder?.amountReceived || 0)) > 0.01 && (
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200"><span className="text-xs font-black uppercase text-red-500">Balance</span><span className="text-sm font-black text-red-600">₱{Math.max(0, (selectedOrder?.grandTotal || 0) - (selectedOrder?.amountReceived || 0)).toFixed(2)}</span></div>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Other Modals */}
          <EditOrderModal order={selectedOrder} open={!!selectedOrder && isEditing} onOpenChange={(open) => !open && setIsEditing(false)} onSave={(id, updates) => { updateOrder(id, updates); setIsEditing(false); }} />
          <StockUpdateModal order={selectedOrder} open={!!selectedOrder && isUpdatingStock} onOpenChange={(open) => !open && setIsUpdatingStock(false)} onSave={(id, updates) => { updateOrder(id, updates); setIsUpdatingStock(false); }} />
          <ProcessClaimModal order={processClaimOrder} open={!!processClaimOrder} onOpenChange={(open) => !open && setProcessClaimOrder(null)} onConfirm={(id, data) => { updateOrder(id, data, user.username); setProcessClaimOrder(null); }} />

          {!selectedStatus && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {/* Service Volume Chart */}
                <Card className="border-none shadow-md bg-white overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
                    <CardTitle className="text-sm font-black uppercase tracking-tight text-gray-800">Service Volume by Type</CardTitle>
                    <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#A3C9C2]" /> BASIC CLEANING</div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#A78BFA]" /> FULL REGLUE</div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#C4B5FD]" /> MINOR REGLUE</div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" /> COLOR RENEWAL</div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 px-6 pb-8">
                    <ResponsiveContainer width="100%" height={300}>
                       <BarChart data={serviceVolumeData} margin={{ top: 5, right: 10, left: 10, bottom: 35 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                         <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false}
                            dy={10} 
                            angle={-20}
                            textAnchor="end"
                         />
                         <YAxis 
                            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false} 
                         />
                         <Tooltip content={<ServiceTooltip />} cursor={{fill: '#f8fafc'}} />
                         <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                           {serviceVolumeData.map((_item, index) => (
                             <Cell key={`cell-${index}`} fill={['#A3C9C2', '#C4B5FD', '#A78BFA', '#FBBF24'][index % 4]} />
                           ))}
                         </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Activity Trend Chart */}
                <Card className="border-none shadow-md bg-white overflow-hidden">
                   <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
                     <CardTitle className="text-sm font-black uppercase tracking-tight text-gray-800">{chartTitle}</CardTitle>
                     <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#A78BFA]" /> ORDERS CREATED</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#34D399]" /> ORDERS RELEASED</div>
                     </div>
                   </CardHeader>
                   <CardContent className="pt-4 px-6 pb-8">
                     <ResponsiveContainer width="100%" height={300}>
                       <LineChart data={timeSeriesData}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                         <XAxis 
                            dataKey="period" 
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false} 
                            dy={10}
                         />
                         <YAxis 
                            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={false} 
                         />
                         <Tooltip content={<TrendTooltip />} />
                         <Line type="monotone" dataKey="newOrders" stroke="#A78BFA" strokeWidth={3} dot={{ r: 4, fill: '#A78BFA', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                         <Line type="monotone" dataKey="releasedOrders" stroke="#34D399" strokeWidth={3} dot={{ r: 4, fill: '#34D399', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                       </LineChart>
                     </ResponsiveContainer>
                   </CardContent>
                </Card>

                {/* Low Stock Alerts */}
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-50 mb-4 py-4 px-6">
                    <CardTitle className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
                       <Package size={18} className="text-red-500" /> Stock Status Alerts
                    </CardTitle>
                    <Badge className="bg-red-50 text-red-600 border-red-100 uppercase text-[9px] font-black shadow-sm">{lowStockItems.length} Warnings</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 pb-6">
                    {lowStockItems.length === 0 ? (
                      <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                         <ClipboardCheck className="mx-auto mb-2 text-emerald-400" size={32} />
                         <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">All stock levels normal</p>
                      </div>
                    ) : (
                      lowStockItems.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 shadow-sm transition-all hover:border-red-200 hover:shadow-md group">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${item.status === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                              <AlertTriangle size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-gray-800 uppercase leading-none mb-1.5">{item.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-1.5 py-0.5 rounded">{item.category}</span>
                                <span className="text-[9px] font-bold text-gray-300 italic">Qty: {item.stock}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-gray-900 mb-1">
                              {item.stock} {item.package_size && item.package_size > 0 ? item.package_unit : item.unit}
                            </p>
                            {(() => {
                              const isCritical = Number(item.stock || 0) <= 0;
                              return (
                                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full shadow-sm ${isCritical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                                  {isCritical ? 'Critical' : 'Low Stock'}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <AddExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onAddExpense={addExpense} />
        </div>
      </div>
    </div>
  );
}

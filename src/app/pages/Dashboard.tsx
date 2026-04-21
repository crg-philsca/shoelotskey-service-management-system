import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
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
  Wallet,
  Tag,
  MapPin,
  Truck,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import type { JobOrder } from '@/app/types';

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

export default function Dashboard({ user, onSetHeaderActionRight }: DashboardProps) {
  const role = user.role;
  const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173'))
    ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:8000/api`
    : '/api';

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
    const isWithinRange = (createdAt: Date) => {
      const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (profitRange === 'Daily') {
        // Use a 24-hour window instead of strict midnight to fix Timezone/UTC issues
        return diffDays <= 1.1; 
      }
      if (profitRange === 'Weekly') return diffDays < 7;
      if (profitRange === 'Monthly') return diffDays < 30;
      if (profitRange === 'Quarterly') return diffDays < 90;
      return diffDays < 365; // Annually
    };

    return orders.filter(order => isWithinRange(new Date(order.createdAt)));
  }, [orders, profitRange]);

  // Use the raw 'orders' for Status Summary cards so nothing is hidden by the date filter
  const statusCounts = useMemo(() => {
    return {
      new: analyticsOrders.filter(o => o.status === 'new-order').length,
      ongoing: analyticsOrders.filter(o => o.status === 'on-going').length,
      forRelease: analyticsOrders.filter(o => o.status === 'for-release').length,
      claimed: analyticsOrders.filter(o => o.status === 'claimed').length,
    };
  }, [analyticsOrders]);

  /**
   * MEMO: overviewOrders
   * Filtered list of orders based on the current drill-down status (e.g., just 'New Orders').
   */
  const overviewOrders = useMemo(() => {
    // Detailed list view and Summary metrics now follow the Profit Range filter
    if (!selectedStatus) return analyticsOrders;
    return analyticsOrders.filter(order => order.status === selectedStatus);
  }, [analyticsOrders, selectedStatus]);

  const totalSales = useMemo(() => {
    return analyticsOrders.reduce((sum, order) => sum + (order.amountReceived || 0), 0);
  }, [analyticsOrders]);

  const totalPendingPayments = useMemo(() => {
    return analyticsOrders.reduce((sum, order) => {
      if (order.paymentStatus === 'fully-paid') return sum;
      return sum + (order.grandTotal - (order.amountReceived || 0));
    }, 0);
  }, [analyticsOrders]);

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

    analyticsOrders.forEach(order => {
      const items = order.items?.length ? order.items : [{
        baseService: Array.isArray(order.baseService) ? order.baseService : [order.baseService],
        addOns: order.addOns || []
      }];
  
      items.forEach(item => {
        const itemBaseServices = Array.isArray(item.baseService) ? item.baseService : [item.baseService];
        const primaryBase = (itemBaseServices[0] || 'Other').toLowerCase();
        const salesShare = (order.grandTotal / (items.length || 1));
        
        // Dynamic Grouping Logic
        if (primaryBase.includes('full reglue')) {
          result[2].value += 1;
          result[2].sales += salesShare;
        } else if (primaryBase.includes('minor reglue')) {
          result[1].value += 1;
          result[1].sales += salesShare;
        } else if (primaryBase.includes('color renewal') || primaryBase.includes('color') || primaryBase.includes('renewal')) {
          result[3].value += 1;
          result[3].sales += salesShare;
        } else if (primaryBase.includes('cleaning') || primaryBase.includes('unyellowing') || primaryBase.includes('retouch') || primaryBase.includes('restoration') || primaryBase.includes('basic')) {
          result[0].value += 1;
          result[0].sales += salesShare;
          
          // Breakdown logic maintenance
          if (primaryBase.includes('unyellowing')) basicCleaningBreakdown['Unyellowing'] += 1;
          else if (primaryBase.includes('retouch')) basicCleaningBreakdown['Minor Retouch'] += 1;
          else if (primaryBase.includes('restoration')) basicCleaningBreakdown['Minor Restoration'] += 1;
          else basicCleaningBreakdown['Basic Cleaning'] += 1;
        }
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
            newOrders: analyticsOrders.filter(order => {
              const orderTime = new Date(order.createdAt);
              return orderTime >= periodStart && orderTime < periodEnd;
            }).length,
            releasedOrders: analyticsOrders.filter(order => {
              if (!order.actualCompletionDate) return false;
              const releaseTime = new Date(order.actualCompletionDate);
              return releaseTime >= periodStart && releaseTime < periodEnd;
            }).length,
          };
        })
        .filter((_, i) => i >= 9 && i <= 21);
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
          newOrders: analyticsOrders.filter(order => {
            const orderTime = new Date(order.createdAt);
            return orderTime >= dayStart && orderTime <= dayEnd;
          }).length,
          releasedOrders: analyticsOrders.filter(order => {
            if (!order.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= dayStart && releaseTime <= dayEnd;
          }).length,
        };
      });
    }

    if (profitRange === 'Monthly') {
      return Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (29 - i));
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return {
          period: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          newOrders: analyticsOrders.filter(order => {
            const orderTime = new Date(order.createdAt);
            return orderTime >= dayStart && orderTime <= dayEnd;
          }).length,
          releasedOrders: analyticsOrders.filter(order => {
            if (!order.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= dayStart && releaseTime <= dayEnd;
          }).length,
        };
      });
    }

    if (profitRange === 'Quarterly') {
      return Array.from({ length: 12 }, (_, i) => {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (11 - i) * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        return {
          period: `Week ${i + 1}`,
          newOrders: analyticsOrders.filter(order => {
            const orderTime = new Date(order.createdAt);
            return orderTime >= weekStart && orderTime <= weekEnd;
          }).length,
          releasedOrders: analyticsOrders.filter(order => {
            if (!order.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= weekStart && releaseTime <= weekEnd;
          }).length,
        };
      });
    }

    return Array.from({ length: 12 }, (_, i) => {
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - (11 - i));
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      return {
        period: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        newOrders: analyticsOrders.filter(order => {
          const orderTime = new Date(order.createdAt);
          return orderTime >= monthStart && orderTime <= monthEnd;
        }).length,
        releasedOrders: analyticsOrders.filter(order => {
          if (!order.actualCompletionDate) return false;
          const releaseTime = new Date(order.actualCompletionDate);
          return releaseTime >= monthStart && releaseTime <= monthEnd;
        }).length,
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
    <>
      <div className="space-y-6 animate-in fade-in duration-700">
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
                <button 
                  onClick={async () => {
                    try { await axios.get(`${API_BASE_URL}/test-crash`); } catch(e) { /* Let global handler handle it */ }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-[10px] text-red-400 font-mono border border-red-200 px-1 rounded"
                >
                  SIMULATE_CRASH
                </button>
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
                        case 'new-order':
                          return 'NEW ORDER';
                        case 'on-going':
                          return 'ON-GOING';
                        case 'for-release':
                          return 'FOR RELEASE';
                        case 'claimed':
                          return 'CLAIMED';
                        default:
                          return 'STATUS';
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
                    let filtered = analyticsOrders.filter(order => order.status === selectedStatus);

                    if (filterService !== 'all') {
                      filtered = filtered.filter(order => order.baseService.includes(filterService));
                    }

                    // Filter by priority
                    if (filterPriority !== 'all') {
                      filtered = filtered.filter(order => order.priorityLevel === filterPriority);
                    }

                    // Filter by date range
                    if (startDate) {
                      const start = new Date(startDate);
                      filtered = filtered.filter(order => new Date(order.createdAt) >= start);
                    }
                    if (endDate) {
                      const end = new Date(endDate);
                      end.setHours(23, 59, 59, 999);
                      filtered = filtered.filter(order => new Date(order.createdAt) <= end);
                    }

                    // Filter by search query
                    if (searchQuery) {
                      const query = searchQuery.toLowerCase();
                      filtered = filtered.filter(order =>
                        order.customerName.toLowerCase().includes(query) ||
                        order.orderNumber.toLowerCase().includes(query)
                      );
                    }

                    /**
                     * SORTING LOGIC:
                     * 1. Status Recency: Orders with the most recent status update appear first.
                     * 2. Priority: If update times match, Rush/Premium orders take precedence.
                     * 3. Order Number: Final fallback to descending Order Number sequence.
                     */
                    filtered.sort((a, b) => {
                      const lastStatusTimeA = a.statusHistory?.length ? new Date(a.statusHistory[a.statusHistory.length - 1].timestamp).getTime() : 0;
                      const timeA = lastStatusTimeA || new Date(a.updatedAt || a.createdAt).getTime();

                      const lastStatusTimeB = b.statusHistory?.length ? new Date(b.statusHistory[b.statusHistory.length - 1].timestamp).getTime() : 0;
                      const timeB = lastStatusTimeB || new Date(b.updatedAt || b.createdAt).getTime();

                      const validA = !isNaN(timeA) ? timeA : 0;
                      const validB = !isNaN(timeB) ? timeB : 0;

                      if (validA !== validB) return validB - validA;

                      // Priority Level fallback (Rush first)
                      const priorityOrder = { rush: 0, premium: 1, regular: 2 };
                      const priorityA = priorityOrder[a.priorityLevel as keyof typeof priorityOrder] ?? 3;
                      const priorityB = priorityOrder[b.priorityLevel as keyof typeof priorityOrder] ?? 3;
                      if (priorityA !== priorityB) return priorityA - priorityB;

                      return b.orderNumber.localeCompare(a.orderNumber);
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
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setIsEditing(false);
                                    }}
                                  >
                                    <td className="px-3 py-3 text-xs font-medium text-center whitespace-nowrap">{order.orderNumber}</td>
                                    <td className="px-3 py-3 text-xs text-center">
                                      <div className="inline-block text-left w-full max-w-[150px]">
                                        {order.customerName}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-center">
                                      {Array.isArray(order.baseService)
                                        ? order.baseService.map(s => s.replace(' (with basic cleaning)', '')).join(', ')
                                        : String(order.baseService).replace(' (with basic cleaning)', '')}
                                    </td>
                                    <td className="px-3 py-3 text-xs text-center text-gray-700">{order.quantity || 1} {(order.quantity || 1) === 1 ? 'Pair' : 'Pair'}</td>
                                    <td className="px-3 py-3 text-xs text-center">{dateFnsFormat(new Date(order.createdAt), 'MM/dd/yy')}</td>
                                    <td className="px-3 py-3 text-xs text-center">
                                      {order.predictedCompletionDate ? dateFnsFormat(new Date(order.predictedCompletionDate), 'MM/dd/yy') : '-'}
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
                                              setSelectedOrder(order);
                                              setIsEditing(true);
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 mb-1">
                                              <Edit className="h-4 w-4 mr-2" />
                                              Edit Order Detail
                                            </DropdownMenuItem>
                                          )}

                                          {order.status === 'on-going' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedOrder(order);
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
                                              {order.status === 'on-going' ? 'Undo to New Order' :
                                                order.status === 'for-release' ? 'Undo to On-Going' :
                                                  'Undo to For Release'}
                                            </DropdownMenuItem>
                                          )}
  
                                          {selectedStatus === 'new-order' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              updateOrder(order.id, { status: 'on-going', updatedAt: new Date() }, user.username);
                                              toast.success('Order moved to On-Going');
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100">
                                              <ArrowRight className="h-4 w-4 mr-2" />
                                              Move to On-Going
                                            </DropdownMenuItem>
                                          )}
                                          {selectedStatus === 'on-going' && (
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              updateOrder(order.id, { status: 'for-release', updatedAt: new Date() }, user.username);
                                              toast.success('Order moved to For Release');
                                            }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100">
                                              <ArrowRight className="h-4 w-4 mr-2" />
                                              Move to For Release
                                            </DropdownMenuItem>
                                          )}
                                          {selectedStatus === 'for-release' && (
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


                        {/* Pagination */}
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
          <Dialog open={!!selectedOrder && !isEditing && !isUpdatingStock} onOpenChange={(open) => {
            if (!open) setSelectedOrder(null);
          }}
          >
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
                        <p className="text-sm font-bold text-gray-800">{selectedOrder.customerName}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Contact Number</Label>
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-gray-400" />
                          <p className="text-sm font-bold text-gray-800">{selectedOrder.contactNumber}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/50">
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order Date</Label>
                        <div className="flex items-center gap-2">
                          <CalendarIcon size={12} className="text-gray-400" />
                          <p className="text-sm font-bold text-gray-800">
                            {(() => {
                              const d = new Date(selectedOrder.transactionDate || selectedOrder.createdAt);
                              return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy HH:mm');
                            })()}
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Release Date</Label>
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-gray-400" />
                          <p className="text-sm font-bold text-gray-800">
                            {(() => {
                              if (!selectedOrder.predictedCompletionDate) return '-';
                              const d = new Date(selectedOrder.predictedCompletionDate);
                              return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy');
                            })()}
                            {['for-release', 'claimed'].includes(selectedOrder.status) && selectedOrder.releaseTime && (
                              <span className="text-xs text-gray-500 ml-1 font-normal">
                                @ {selectedOrder.releaseTime}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {selectedOrder.status === 'claimed' && selectedOrder.actualCompletionDate && (
                        <div>
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Actual Claim Date</Label>
                          <div className="flex items-center gap-2">
                            <ClipboardCheck size={12} className="text-green-500" />
                            <p className="text-sm font-bold text-green-700">
                              {dateFnsFormat(new Date(selectedOrder.actualCompletionDate), 'MM/dd/yy HH:mm')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shipping Preference */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck size={16} className="text-red-500" />
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Shipping Details</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Preference</Label>
                        <p className="text-sm font-bold text-gray-800 uppercase">{selectedOrder.shippingPreference || 'Pickup'}</p>
                      </div>
                      {selectedOrder.shippingPreference === 'delivery' && selectedOrder.deliveryCourier && (
                        <div>
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Courier</Label>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-800">{selectedOrder.deliveryCourier}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedOrder.shippingPreference === 'delivery' && (
                      <div className="pt-2 border-t border-gray-200/50">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Full Delivery Address</Label>
                        <div className="flex items-start gap-2">
                          <MapPin size={12} className="text-gray-400 mt-0.5" />
                          <p className="text-sm font-medium text-gray-600 leading-snug">{selectedOrder.deliveryAddress || 'No address provided'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Items Loop - Supporting both Dashboard list style and multi-item style if present */}
                  <div className="space-y-4">
                    {(selectedOrder.items?.length ? selectedOrder.items : [selectedOrder]).map((item: any, index: number) => (
                      <div key={index} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Tag size={16} className="text-red-500" />
                          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                            {(selectedOrder.items?.length || 0) > 1 ? `Item #${index + 1} Details` : 'Shoe & Service Details'}
                          </h4>
                        </div>

                        {/* Shoe Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Brand</Label>
                            <p className="text-sm font-bold text-gray-800">{item.brand || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Model</Label>
                            <p className="text-sm font-bold text-gray-800">{item.shoeModel || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Material</Label>
                            <p className="text-sm font-bold text-gray-800">{item.shoeMaterial || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Quantity</Label>
                            <p className="text-sm font-bold text-gray-800">{item.quantity || 1} {(item.quantity || 1) === 1 ? 'Pair' : 'Pairs'}</p>
                          </div>
                        </div>

                        {/* Shoe Condition */}
                        <div className="pt-2 border-t border-gray-200/50">
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Shoe Condition</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(item.condition || {}).map(([key, value]) => {
                              if (key === 'others' && value) return <span key={key} className="px-2 py-1 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-600 shadow-sm">Note: {String(value)}</span>;
                              if (value === true) {
                                const labels: Record<string, string> = {
                                    scratches: 'Scratches',
                                    yellowing: 'Yellowing',
                                    ripsHoles: 'Rips/Holes',
                                    deepStains: 'Deep Stains',
                                    soleSeparation: 'Sole Separation',
                                    wornOut: 'Faded/Worn'
                                };
                                const label = labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                return <span key={key} className="px-2 py-1 bg-red-50 border border-red-100 rounded-md text-[10px] font-bold text-red-600">{label}</span>;
                              }
                              return null;
                            })}
                            {Object.values(item.condition || {}).every(v => !v) && <p className="text-xs text-slate-400 italic">No conditions applied</p>}
                          </div>
                        </div>

                        {/* Service Details for this Item */}
                        <div className="pt-2 border-t border-gray-200/50">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Base Service</Label>
                              <p className="text-sm font-bold text-gray-800">
                                {Array.isArray(item.baseService)
                                  ? item.baseService.map((s: string) => s.replace(' (with basic cleaning)', '')).join(', ')
                                  : String(item.baseService).replace(' (with basic cleaning)', '')}
                              </p>
                            </div>

                            {item.addOns && item.addOns.length > 0 && (
                              <div>
                                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Add-ons</Label>
                                <div className="space-y-1">
                                  {item.addOns.map((addon: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                      <span className="font-medium text-gray-700">• {addon.name}</span>
                                      <span className="text-gray-500 text-xs font-bold">x{addon.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Status & Priority (Global) */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3 mt-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order Status</Label>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border
                            ${selectedStatus === 'new-order' || selectedOrder.status === 'new-order' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                            selectedOrder.status === 'on-going' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              selectedOrder.status === 'for-release' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                selectedOrder.status === 'claimed' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                                  'bg-red-50 text-red-700 border-red-100'
                          }`}>
                          {selectedOrder.status.replace('-', ' ')}
                        </span>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Priority Level</Label>
                        {selectedOrder.priorityLevel === 'rush' ? (
                          <span className="text-xs font-black text-red-600 uppercase">RUSH</span>
                        ) : (
                          <span className="text-xs font-bold text-gray-800 capitalize">{selectedOrder.priorityLevel}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Processed By</Label>
                        <p className="text-sm font-bold text-gray-700">{selectedOrder.processedBy || 'Current User'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Section */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet size={16} className="text-red-500" />
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Payment Details</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {selectedOrder.paymentMethod && (
                        <div>
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Method</Label>
                          <p className="text-sm font-bold text-gray-800 uppercase">
                            {selectedOrder.paymentMethod || '-'}
                          </p>
                        </div>
                      )}
                      <div>
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Payment Status</Label>
                        <span className={`text-sm font-black uppercase ${selectedOrder.paymentStatus === 'fully-paid' ? 'text-green-600' :
                          selectedOrder.paymentStatus === 'downpayment' ? 'text-yellow-600' : 'text-red-500'
                          }`}>
                          {selectedOrder.paymentStatus === 'fully-paid' ? 'Fully Paid' : selectedOrder.paymentStatus === 'downpayment' ? 'Downpayment' : selectedOrder.paymentStatus?.replace('-', ' ')?.replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      {['gcash', 'maya'].includes(selectedOrder.paymentMethod?.toLowerCase()) && (selectedOrder.paymentStatus === 'fully-paid' || selectedOrder.paymentStatus === 'downpayment') && (
                        <div className="col-span-2">
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Reference Number</Label>
                          <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">{selectedOrder.referenceNo || '-'}</p>
                        </div>
                      )}
                      {selectedOrder.paymentStatus && (
                        <>
                          <div>
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Amount Received</Label>
                            <p className="text-sm font-bold text-gray-800">₱{(selectedOrder.amountReceived || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          {selectedOrder.change !== undefined && selectedOrder.change > 0 && (
                            <div className="col-span-2 pt-2 border-t border-gray-100 mt-1">
                              <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Customer Change</Label>
                                <p className="text-sm font-bold text-green-600 underline decoration-dotted underline-offset-4">
                                  ₱{(selectedOrder.change || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {selectedOrder.paymentStatus !== 'fully-paid' && (
                        <div className="pt-2 border-t border-gray-200/50 col-span-2 flex justify-between items-center">
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Remaining Balance</Label>
                          <p className={`text-sm font-black ${((selectedOrder.grandTotal || 0) - (selectedOrder.amountReceived || 0)) > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                            ₱{Math.max(0, (selectedOrder.grandTotal || 0) - (selectedOrder.amountReceived || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-2 mt-2">
                    <div className="flex justify-between items-center text-gray-600/80">
                      <span className="text-xs font-medium uppercase tracking-wide">Total Quantity</span>
                      <span className="text-sm font-bold text-gray-800">{selectedOrder.quantity || 1} {(selectedOrder.quantity || 1) === 1 ? 'Pair' : 'Pairs'}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600/80">
                      <span className="text-xs font-medium uppercase tracking-wide">Base Service Fee</span>
                      <span className="text-sm font-bold text-gray-800">₱{(selectedOrder.baseServiceFee || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600/80">
                      <span className="text-xs font-medium uppercase tracking-wide">Add-ons Total</span>
                      <span className="text-sm font-bold text-gray-800">₱{(selectedOrder.addOnsTotal || 0).toFixed(2)}</span>
                    </div>
                    {selectedOrder.priorityLevel === 'rush' && (
                      <div className="flex justify-between items-center text-gray-600/80">
                        <span className="text-xs font-medium uppercase tracking-wide">Rush Fee</span>
                        <span className="text-sm font-bold text-gray-800">₱{(selectedOrder.grandTotal - ((selectedOrder.baseServiceFee || 0) + (selectedOrder.addOnsTotal || 0))).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-2">
                      <span className="text-base font-black text-gray-900 uppercase tracking-tight">Grand Total</span>
                      <span className="text-lg font-black text-red-600 tracking-tight">₱{(selectedOrder.grandTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog >

          {/* Edit Order Modal */}
          <EditOrderModal
            order={selectedOrder}
            open={!!selectedOrder && isEditing}
            onOpenChange={(open) => {
              if (!open) {
                setIsEditing(false);
              }
            }}
            onSave={(id, updates) => {
              updateOrder(id, updates);
              setIsEditing(false);
              toast.success('Order details updated');
            }}
          />

          <StockUpdateModal
            order={selectedOrder}
            open={!!selectedOrder && isUpdatingStock}
            onOpenChange={(open) => {
              if (!open) {
                setIsUpdatingStock(false);
              }
            }}
            onSave={(id, updates) => {
              updateOrder(id, updates);
              setIsUpdatingStock(false);
            }}
          />

          < ProcessClaimModal
            order={processClaimOrder}
            open={!!processClaimOrder}
            onOpenChange={(open) => !open && setProcessClaimOrder(null)}
            onConfirm={(id, data) => {
              updateOrder(id, data, user.username);
              toast.success('Order claimed successfully');
              setProcessClaimOrder(null);
            }}
          />

          {/* Charts and Recent Orders - Only Show When No Status Selected */}
          {
            !selectedStatus && (
              <>
                {/* Charts - Visible to all but revenue protected */}
                <div className="grid grid-cols-1 gap-6">
                    <Card>
                      <CardHeader className="flex flex-col md:flex-row items-center md:items-start justify-between mt-3 py-6 gap-4">
                        <CardTitle className="text-center md:text-left text-base font-black uppercase whitespace-nowrap tracking-tight">Service Volume by Type</CardTitle>
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center md:justify-end gap-x-6 gap-y-1.5 text-left md:text-right">
                          <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
                            <div className="w-2.5 h-2.5 bg-[#84b6af] rounded-full shrink-0"></div>
                            <span>BASIC CLEANING</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
                            <div className="w-2.5 h-2.5 bg-[#c084fc] rounded-full shrink-0"></div>
                            <span>FULL REGLUE</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
                            <div className="w-2.5 h-2.5 bg-[#a78bfa] rounded-full shrink-0"></div>
                            <span>MINOR REGLUE</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
                            <div className="w-2.5 h-2.5 bg-[#fbbf24] rounded-full shrink-0"></div>
                            <span>COLOR RENEWAL</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="mt-8 ml-0 mb-1">
                        {serviceVolumeData.length === 0 ? (
                          <p className="text-sm text-gray-500">No orders in the selected range.</p>
                        ) : (
                          <ResponsiveContainer width="90%" height={250}>
                            <BarChart data={serviceVolumeData} margin={{ left: 15, right: 5, bottom: 24 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis allowDecimals={false} />
                              <Tooltip
                                content={(props) => {
                                  if (!props.active || !props.payload || !props.payload.length) return null;
                                  const data = props.payload[0].payload as {
                                    name: string;
                                    value: number;
                                    sales: number;
                                    breakdown?: Record<string, number>
                                  };

                                  return (
                                    <div className="bg-white p-3 border rounded shadow-lg max-w-xs">
                                      <p className="font-semibold text-gray-900 mb-2">{data.name}</p>
                                      <p className="text-sm text-gray-600">Total Orders: {data.value}</p>
                                      {role === 'owner' && (
                                        <p className="text-sm text-gray-600 mb-2">Revenue: {'\u20B1'}{data.sales.toLocaleString()}</p>
                                      )}

                                      {/* Show breakdown for Basic Cleaning */}
                                      {data.name === 'Basic Cleaning' && data.breakdown && (
                                        <div className="border-t pt-2 mt-2">
                                          <p className="text-xs font-medium text-gray-700 mb-1">Service Breakdown:</p>
                                          <div className="space-y-1">
                                            <p className="text-xs text-gray-600">Basic Cleaning: {data.breakdown['Basic Cleaning'] || 0}</p>
                                            <p className="text-xs text-gray-600">Unyellowing: {data.breakdown['Unyellowing'] || 0}</p>
                                            <p className="text-xs text-gray-600">Minor Retouch: {data.breakdown['Minor Retouch'] || 0}</p>
                                            <p className="text-xs text-gray-600">Minor Restoration: {data.breakdown['Minor Restoration'] || 0}</p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Show breakdown for Color Renewal */}
                                      {data.name === 'Color Renewal' && data.breakdown && (
                                        <div className="border-t pt-2 mt-2">
                                          <p className="text-xs font-medium text-gray-700 mb-1">Service Breakdown:</p>
                                          <div className="space-y-1">
                                            <p className="text-xs text-gray-600">2 Colors: {data.breakdown['2 Colors'] || 0}</p>
                                            <p className="text-xs text-gray-600">3 Colors: {data.breakdown['3 Colors'] || 0}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }}
                              />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {serviceVolumeData.map((entry, index) => {
                                  let fillColor = '#dc2626'; // default red
                                  if (entry.name === 'Basic Cleaning') fillColor = '#0d948880'; // teal-700 with 50% opacity
                                  else if (entry.name === 'Minor Reglue') fillColor = '#6366f180'; // indigo-500 with 50% opacity
                                  else if (entry.name === 'Full Reglue') fillColor = '#c026d380'; // violet-600 with 50% opacity
                                  else if (entry.name === 'Color Renewal') fillColor = '#f59e0b80'; // amber-500 with 50% opacity
                                  return <Cell key={`cell-${index}`} fill={fillColor} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-col md:flex-row items-center md:items-start justify-between mt-3 py-6 gap-4">
                        <CardTitle className="text-center md:text-left text-base font-black uppercase whitespace-nowrap tracking-tight">{chartTitle}</CardTitle>
                        <div className="flex flex-row flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-1.5">
                          <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap mt-1">
                            <div className="w-2.5 h-2.5 bg-purple-500 rounded-full shrink-0"></div>
                            <span>Orders Created</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap mt-1">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full shrink-0"></div>
                            <span>Orders Released</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="mt-6 ml-6 mb-2 ">
                        <ResponsiveContainer width="90%" height={250}>
                          <LineChart data={timeSeriesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis />
                            <Tooltip
                              content={(props) => {
                                if (!props.active || !props.payload || !props.payload.length) return null;
                                const data = props.payload[0].payload as {
                                  period: string;
                                  newOrders: number;
                                  releasedOrders: number;
                                };

                                return (
                                  <div className="bg-white p-3 border rounded shadow-lg">
                                    <p className="font-semibold text-gray-900 mb-2">{data.period}</p>
                                    <div className="space-y-1">
                                      <p className="text-sm text-purple-600 font-bold">Orders Created: {data.newOrders}</p>
                                      <p className="text-sm text-green-600 font-bold">Orders Released: {data.releasedOrders}</p>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Line type="monotone" dataKey="newOrders" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="releasedOrders" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                {/* Staff performance Removed per user request */}

              </>
            )
          }

        </div >
      </div >

      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onAddExpense={addExpense}
      />
    </>
  );
}

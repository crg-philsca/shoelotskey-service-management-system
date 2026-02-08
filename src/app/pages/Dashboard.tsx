import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/app/components/ui/utils';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import EditOrderModal from '@/app/components/EditOrderModal';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { mockServices } from '@/app/lib/mockData';
import { useOrders } from '@/app/context/OrderContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import AddExpenseModal from '@/app/components/AddExpenseModal';
import {
  Search,
  MoreVertical,
  Calendar as CalendarIcon,
  TrendingUp,
  ChevronDown,
  Edit,
  ArrowRight,
  PlusCircle,
  X,
  Filter,
  RotateCcw,
  Clock7,
  PackageOpen,
  ClipboardCheck,
  FileText,
  CircleAlert,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import type { JobOrder } from '@/app/types';

// ... (keep commented code)

interface DashboardProps {
  user: { username: string; role: 'owner' | 'staff' };
  onSetHeaderActionRight?: (action: ReactNode | null) => void;
}

export default function Dashboard({ user, onSetHeaderActionRight }: DashboardProps) {
  const role = user.role;
  const { orders, updateOrder } = useOrders();
  const [isEditing, setIsEditing] = useState(false);
  const [profitRange, setProfitRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  // const [intakeDialogOpen, setIntakeDialogOpen] = useState(false);

  // Removed unused Service Intake Modal state and related variables
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
  const [currentPageAssigned, setCurrentPageAssigned] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryAssigned, setSearchQueryAssigned] = useState('');
  const [filterStatusAssigned] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Advanced Filter states
  const [filterServiceAssigned, setFilterServiceAssigned] = useState<string>('all');
  const [startDateAssigned, setStartDateAssigned] = useState<string>('');
  const [endDateAssigned, setEndDateAssigned] = useState<string>('');

  // Temp states for Filter Modal
  const [tempFilterService, setTempFilterService] = useState<string>('all');
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');
  const { addExpense } = useExpenses();
  const itemsPerPage = 10;

  const baseServices = mockServices.filter(s => s.category === 'base');

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const isWithinRange = (createdAt: Date) => {
      const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (profitRange === 'daily') return diffDays < 1;
      if (profitRange === 'weekly') return diffDays < 7;
      if (profitRange === 'monthly') return diffDays < 30;
      return diffDays < 365; // yearly
    };

    return orders.filter(order => isWithinRange(new Date(order.createdAt)));
  }, [profitRange, orders]);

  const overviewOrders = useMemo(() => {
    let orders = filteredOrders;
    if (selectedStatus) {
      orders = orders.filter(order => order.status === selectedStatus);
    }
    return orders;
  }, [filteredOrders, selectedStatus]);

  // Total Sales should be calculated from filtered orders (by date range) that are PAID
  const totalSales = filteredOrders.reduce((sum, order) => {
    if (order.paymentStatus !== 'paid') return sum;
    return sum + (order.amountReceived || 0);
  }, 0);

  // Pending Payments should be calculated from filtered orders (by date range) regardless of status
  const totalPendingPayments = filteredOrders.reduce((sum, order) => {
    // Pending Payments = balance due for unpaid or partially paid orders
    if (order.paymentStatus === 'unpaid') {
      return sum + order.grandTotal;
    } else if (order.paymentStatus === 'partial') {
      return sum + (order.grandTotal - (order.amountReceived || 0));
    }
    // For fully paid orders, no pending amount
    return sum;
  }, 0);

  const serviceVolumeData = useMemo(() => {
    // Groupings for the 4 bars, count all orders under each group (including all relevant sub-services)
    const groupings = {
      'Basic Cleaning': [
        'Basic Cleaning',
        'Unyellowing',
        'Minor Retouch',
        'Minor Restoration',
        'Counter',
      ],
      'Minor Reglue': ['Minor Reglue', 'Minor Reglue (with basic cleaning)'],
      'Full Reglue': ['Full Reglue', 'Full Reglue (with basic cleaning)'],
      'Color Renewal': ['Color Renewal', 'Color Renewal (with basic cleaning)', '2 Colors', '3 Colors'],
    };

    // Detailed breakdowns for specific services
    const basicCleaningBreakdown = {
      'Basic Cleaning': 0,
      'Unyellowing': 0,
      'Minor Retouch': 0,
      'Minor Restoration': 0,
    };

    const colorRenewalBreakdown = {
      '2 Colors': 0,
      '3 Colors': 0,
    };

    const result = [
      { name: 'Basic Cleaning', value: 0, sales: 0, breakdown: basicCleaningBreakdown },
      { name: 'Minor Reglue', value: 0, sales: 0 },
      { name: 'Full Reglue', value: 0, sales: 0 },
      { name: 'Color Renewal', value: 0, sales: 0, breakdown: colorRenewalBreakdown },
    ];

    filteredOrders.forEach(order => {
      // Count all orders under each group, including all relevant sub-services


      const baseServicesArr = order.baseService || [];
      baseServicesArr.forEach(base => {
        if (groupings['Basic Cleaning'].includes(base)) {
          result[0].value += 1;
          result[0].sales += (order.baseServiceFee / baseServicesArr.length) + (order.addOnsTotal / baseServicesArr.length); // Distribute sales? Or count per service?
          // "If they check Basic Cleaning and Unyellowing... Unit Total sums them up"
          // The dashboard aggregates "Sales by Category".
          // Simplest approach: Count +1 for each service category, distribute revenue or just add full revenue?
          // Safer: Add 1 to count. For revenue, it's tricky.
          // Let's assume we just count volume for now primarily, or spread revenue.
          // Spreading revenue evenly across base services:
          const feeShare = order.grandTotal / baseServicesArr.length;
          result[0].sales += feeShare;

          if (basicCleaningBreakdown.hasOwnProperty(base)) {
            basicCleaningBreakdown[base as keyof typeof basicCleaningBreakdown] += 1;
          }
        }
        if (groupings['Minor Reglue'].includes(base)) {
          result[1].value += 1;
          const feeShare = order.grandTotal / baseServicesArr.length;
          result[1].sales += feeShare;
        }
        if (groupings['Full Reglue'].includes(base)) {
          result[2].value += 1;
          const feeShare = order.grandTotal / baseServicesArr.length;
          result[2].sales += feeShare;
        }
        if (groupings['Color Renewal'].includes(base)) {
          result[3].value += 1;
          const feeShare = order.grandTotal / baseServicesArr.length;
          result[3].sales += feeShare;

          if (colorRenewalBreakdown.hasOwnProperty(base)) {
            colorRenewalBreakdown[base as keyof typeof colorRenewalBreakdown] += 1;
          }
        }
      });

      // Add-ons should be counted once or distributed?
      // Original logic: "Also check addons for Basic Cleaning services"
      // If we iterate baseServices, we might double count addons if we do it inside loop.
      // So addons loop should be OUTSIDE or strictly controlled.
      // The original logic tied addons to specific base service categories.
      // E.g. "if groupings['Basic Cleaning'].includes(base) ... check addons"
      // If a user has "Basic Cleaning" AND "Color Renewal", and "Unyellowing" addon.
      // Unyellowing is a Basic Cleaning addon.

      // Fixed logic:
      order.addOns.forEach(addon => {
        if (basicCleaningBreakdown.hasOwnProperty(addon.name)) {
          basicCleaningBreakdown[addon.name as keyof typeof basicCleaningBreakdown] += addon.quantity;
        }
        // Color Renewal addons?
        // The original code didn't seem to have a specific breakdown map for Color Renewal addons in the snippet shown,
        // but let's check lines 157-160 in original.
        // It checked "colorRenewalBreakdown" for BASE services.
      });
      order.addOns.forEach(addon => {
        if (colorRenewalBreakdown.hasOwnProperty(addon.name)) {
          colorRenewalBreakdown[addon.name as keyof typeof colorRenewalBreakdown] += addon.quantity;
        }
      });
    });

    return result;
  }, [filteredOrders]);

  const timeSeriesData = useMemo(() => {
    const now = new Date();

    if (profitRange === 'daily') {
      // Show hourly breakdown for the current day starting from 6 AM
      const hours = Array.from({ length: 24 }, (_, i) => i);
      return hours.map(hour => {
        const periodStart = new Date(now);
        periodStart.setHours(hour, 0, 0, 0);
        const periodEnd = new Date(now);
        periodEnd.setHours(hour + 1, 0, 0, 0);

        return {
          period: `${hour}:00`,
          newOrders: filteredOrders.filter(order => {
            const orderTime = new Date(order.createdAt);
            return orderTime >= periodStart && orderTime < periodEnd;
          }).length,
          releasedOrders: filteredOrders.filter(order => {
            // Check if the order was released in this hour
            if (!order.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= periodStart && releaseTime < periodEnd;
          }).length
        };
      }).filter((_, i) => i >= 9 && i <= 21); // Show only business hours (9 AM - 9 PM)
    } else if (profitRange === 'weekly') {
      // Show daily breakdown for the last 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - i)); // Start from 6 days ago to today
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return {
          period: date.toLocaleDateString('en-US', { weekday: 'short' }),
          newOrders: filteredOrders.filter(order => {
            const orderTime = new Date(order.createdAt);
            return orderTime >= dayStart && orderTime <= dayEnd;
          }).length,
          releasedOrders: filteredOrders.filter(order => {
            if (!order.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= dayStart && releaseTime <= dayEnd;
          }).length
        };
      });
    } else if (profitRange === 'monthly') {
      // Show weekly breakdown for the last 4 weeks
      return Array.from({ length: 4 }, (_, i) => {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (28 - (i * 7))); // Start from 28 days ago
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        return {
          period: `Week ${i + 1}`,
          newOrders: filteredOrders.filter(order => {
            const orderTime = new Date(order.createdAt);
            return orderTime >= weekStart && orderTime <= weekEnd;
          }).length,
          releasedOrders: filteredOrders.filter(order => {
            if (!order.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= weekStart && releaseTime <= weekEnd;
          }).length
        };
      });
    } else {
      // Show monthly breakdown for the last 12 months
      return Array.from({ length: 12 }, (_, i) => {
        const monthStart = new Date(now);
        monthStart.setMonth(monthStart.getMonth() - (11 - i)); // Start from 11 months ago
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);
        monthEnd.setHours(23, 59, 59, 999);

        return {
          period: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          newOrders: filteredOrders.filter(order => {
            const orderTime = new Date(order.createdAt);
            return orderTime >= monthStart && orderTime <= monthEnd;
          }).length,
          releasedOrders: filteredOrders.filter(order => {
            if (!order.actualCompletionDate) return false;
            const releaseTime = new Date(order.actualCompletionDate);
            return releaseTime >= monthStart && releaseTime <= monthEnd;
          }).length
        };
      });
    }
  }, [filteredOrders, profitRange]);

  const chartTitle = 'ORDER ACTIVITY TRENDS';

  // Header right action: Daily/Weekly/Monthly/Yearly filter + Add Expense (when not drilled down)
  useEffect(() => {
    if (!onSetHeaderActionRight) return;

    if (!selectedStatus) {
      // Main dashboard view: show Add Expense button + filter
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsExpenseModalOpen(true)}
            className="bg-white border-red-600 text-red-600 hover:bg-red-50 font-bold shadow-sm transition-all"
          >
            <PlusCircle className="h-5 w-4 mr-0" />
            New Expense
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-32 flex items-center justify-between rounded-md border border-red-600 bg-red-600 px-3 py-2 text-sm font-semibold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Select range"
                type="button"
              >
                <CalendarIcon className="h-4 w-4 mr-1" aria-hidden="true" />
                {profitRange}
                <ChevronDown className="ml-2 h-4 w-4 text-white" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 p-0 rounded-md border border-red-600 bg-white shadow-lg">
              {['daily', 'weekly', 'monthly', 'yearly'].map((range) => (
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
        </div>
      );
    } else {
      // Status drill-down view: show only filter
      onSetHeaderActionRight(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-32 flex items-center justify-between rounded-md border border-red-600 bg-red-600 px-3 py-2 text-sm font-semibold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Select range"
              type="button"
            >
              <CalendarIcon className="h-4 w-4 mr-1" aria-hidden="true" />
              {profitRange}
              <ChevronDown className="ml-2 h-4 w-4 text-white" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32 p-0 rounded-md border border-red-600 bg-white shadow-lg">
            {['daily', 'weekly', 'monthly', 'yearly'].map((range) => (
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

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">

          {/* Status Summary - Always Visible */}
          <Card>
            <CardHeader className="text-center pt-5 pb-0 mb-0">
              <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Status Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0 pb-0 mb-0 -mt-5">
              <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {/* New Order */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'new-order' ? 'ring-2 ring-purple-600' : ''}`}
                  onClick={() => setSelectedStatus('new-order')}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <PlusCircle size={48} className="text-purple-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">New Order</p>
                    <p className="text-3xl font-black text-purple-600 tracking-tight leading-none">{filteredOrders.filter(o => o.status === 'new-order').length}</p>
                  </CardContent>
                </Card>
                {/* On-Going */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'on-going' ? 'ring-2 ring-blue-600' : ''}`}
                  onClick={() => setSelectedStatus('on-going')}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Clock7 size={48} className="text-blue-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">On-Going</p>
                    <p className="text-3xl font-black text-blue-600 tracking-tight leading-none">{filteredOrders.filter(o => o.status === 'on-going').length}</p>
                  </CardContent>
                </Card>
                {/* For Release */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'for-release' ? 'ring-2 ring-orange-600' : ''}`}
                  onClick={() => setSelectedStatus('for-release')}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <PackageOpen size={48} className="text-orange-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">For Release</p>
                    <p className="text-3xl font-black text-orange-600 tracking-tight leading-none">{filteredOrders.filter(o => o.status === 'for-release').length}</p>
                  </CardContent>
                </Card>
                {/* Claimed */}
                <Card
                  className={`border-none shadow-md bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'claimed' ? 'ring-2 ring-gray-600' : ''}`}
                  onClick={() => setSelectedStatus('claimed')}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <ClipboardCheck size={48} className="text-gray-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Claimed</p>
                    <p className="text-3xl font-black text-gray-600 tracking-tight leading-none">{filteredOrders.filter(o => o.status === 'claimed').length}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Overview Summary Section - Always Shown */}
          {!selectedStatus && (
            <Card>
              <CardHeader className="pt-5 pb-0 mb-0">
                <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">Overview Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-0 mb-0 -mt-5">
                <div className={`grid gap-2 ${role === 'owner' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
                  {/* Card 1: Total Active Orders */}
                  <Card className="border-none shadow-md bg-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <FileText size={64} className="text-yellow-600" />
                    </div>
                    <CardContent className="pt-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Active Orders</p>
                      <p className="text-3xl font-black text-yellow-600 tracking-tight">{overviewOrders.filter(o => ['new-order', 'on-going', 'for-release'].includes(o.status)).length}</p>
                    </CardContent>
                  </Card>

                  {role === 'owner' && (
                    <>
                      {/* Card 2: Pending Payments (Light Red) */}
                      <Card className="border-none shadow-md bg-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <CircleAlert size={64} className="text-red-600" />
                        </div>
                        <CardContent className="pt-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Pending Payments</p>
                          <p className="text-3xl font-black text-red-600 tracking-tight">{'\u20B1'}{parseFloat(totalPendingPayments.toFixed(2)).toLocaleString()}</p>
                        </CardContent>
                      </Card>

                      {/* Card 3: Total Sales */}
                      <Card className="border-none shadow-md bg-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <TrendingUp size={64} className="text-green-600" />
                        </div>
                        <CardContent className="pt-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Total Sales</p>
                          <p className="text-3xl font-black text-green-600 tracking-tight">{'\u20B1'}{parseFloat(totalSales.toFixed(2)).toLocaleString()}</p>
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
                <div className="flex gap-4 mb-4 items-center">
                  <Button
                    onClick={() => {
                      setSelectedStatus(null);
                      setCurrentPage(1);
                      setSearchQuery('');
                      setFilterService('all');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="bg-red-600 text-white hover:bg-red-700 h-9 px-3 flex-shrink-0 uppercase"
                    size="sm"
                  >
                    Back
                  </Button>
                  <div className="flex-1 relative group">
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-9 w-9 text-gray-500 group-focus-within:text-red-600 transition-colors"
                      onClick={() => (document.getElementById('statusTableSearch') as HTMLInputElement)?.focus()}
                      title="Focus search"
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                    <Input
                      id="statusTableSearch"
                      placeholder="Search by order number or customer name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10 h-8 text-[11px] border-gray-100 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-lg w-full transition-all"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className={`h-9 w-9 p-0 rounded-lg transition-colors ${filterService !== 'all' || startDate || endDate
                      ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                      : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'
                      }`}
                    onClick={() => setIsFilterOpen(true)}
                    title="Open filters"
                  >
                    <Filter className="h-5 w-5" />
                  </Button>
                </div>

                {/* Filter Dialog */}
                <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center">Filters</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-center block">Service Type</label>
                        <Select value={filterService} onValueChange={setFilterService}>
                          <SelectTrigger className="text-center font-normal">
                            <SelectValue placeholder="Select service type..." className="font-normal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            {baseServices.map(service => (
                              <SelectItem key={service.id} value={service.name}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-center block">Start Date</label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-center"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-center block">End Date</label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="text-center"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <Button
                        variant="ghost"
                        className="flex-1 w-full bg-gray-200 text-gray-700 hover:bg-gray-800 hover:text-white font-bold h-10 transition-colors uppercase tracking-wider rounded-lg"
                        onClick={() => {
                          setFilterService('all');
                          setStartDate('');
                          setEndDate('');
                          setCurrentPage(1);
                        }}>
                        Reset
                      </Button>
                      <Button className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-lg shadow-md uppercase tracking-wider transition-all" onClick={() => setIsFilterOpen(false)}>
                        Apply
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Orders Table */}
                <div>
                  {(() => {
                    let filtered = filteredOrders.filter(order => order.status === selectedStatus);

                    // Filter by service
                    if (filterService !== 'all') {
                      filtered = filtered.filter(order => order.baseService.includes(filterService));
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

                    // Sort: Recently updated first (move next moves to top), then rush
                    filtered.sort((a, b) => {
                      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
                      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
                      if (timeA !== timeB) return timeB - timeA;
                      if (a.priorityLevel === 'rush' && b.priorityLevel !== 'rush') return -1;
                      if (a.priorityLevel !== 'rush' && b.priorityLevel === 'rush') return 1;
                      return b.orderNumber.localeCompare(a.orderNumber);
                    });

                    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
                    const startIdx = (currentPage - 1) * itemsPerPage;
                    const paginatedOrders = filtered.slice(startIdx, startIdx + itemsPerPage);

                    return (
                      <>
                        <table className="w-full">
                          <thead className="bg-red-50">
                            <tr>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Order #</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Customer Name</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Service Type</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Release Date</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Priority Level</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Processed By</th>
                              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {paginatedOrders.map((order) => (
                              <tr
                                key={order.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setIsEditing(false);
                                }}
                              >
                                <td className="px-4 py-3 text-sm font-medium text-center whitespace-nowrap">{order.orderNumber}</td>
                                <td className="px-4 py-3 text-sm text-center">
                                  <div className="inline-block text-left w-full max-w-[180px]">
                                    {order.customerName}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  {Array.isArray(order.baseService)
                                    ? order.baseService.map(s => s.replace(' (with basic cleaning)', '')).join(', ')
                                    : String(order.baseService).replace(' (with basic cleaning)', '')}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  {order.predictedCompletionDate ? new Date(order.predictedCompletionDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  {(() => {
                                    let badgeClass = '';
                                    if (order.priorityLevel === 'rush') {
                                      badgeClass = 'bg-red-100 text-red-700';
                                    } else if (order.priorityLevel === 'premium') {
                                      badgeClass = 'bg-amber-100 text-amber-700';
                                    } else if (order.priorityLevel === 'regular') {
                                      badgeClass = 'bg-green-100 text-green-700';
                                    } else {
                                      badgeClass = 'bg-gray-100 text-gray-700';
                                    }
                                    return (
                                      <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${badgeClass}`}>
                                        {order.priorityLevel}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">{order.processedBy || '-'}</td>
                                <td className="px-4 py-3 text-sm text-center" onClick={(e) => e.stopPropagation()}>
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
                                          updateOrder(order.id, { status: 'claimed', updatedAt: new Date(), actualCompletionDate: new Date() }, user.username);
                                          toast.success('Order moved to Claimed');
                                        }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 focus:text-gray-700 focus:bg-gray-100">
                                          <ArrowRight className="h-4 w-4 mr-2" />
                                          Move to Claimed
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>


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
          <Dialog open={!!selectedOrder && !isEditing} onOpenChange={(open) => {
            if (!open) setSelectedOrder(null);
          }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Order Details - {selectedOrder?.orderNumber}</DialogTitle>
              </DialogHeader>

              {selectedOrder && (
                <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto px-1 pr-2 no-scrollbar">
                  {/* Section: Customer Information */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Name</Label>
                        <p className="text-[14px] font-bold text-slate-900 leading-tight">{selectedOrder.customerName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Contact Number</Label>
                        <p className="text-[14px] font-bold text-slate-900 leading-tight">{selectedOrder.contactNumber}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-100" />

                  {/* Section: Shoe Details */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight">Shoe Details</h3>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Brand</Label>
                        <p className="text-[14px] font-bold text-slate-900">{selectedOrder.brand || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Material</Label>
                        <p className="text-[14px] font-bold text-slate-900">{selectedOrder.shoeMaterial || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Quantity</Label>
                        <p className="text-[14px] font-bold text-slate-900">{selectedOrder.quantity || 1} Pair(s)</p>
                      </div>
                    </div>

                    {/* Physical Condition */}
                    <div className="space-y-2 mt-2">
                      <Label className="text-xs font-medium text-slate-500">Physical Condition</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(selectedOrder.condition || {}).map(([key, value]) => {
                          if (key === 'others' && value) return <span key={key} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-md text-[11px] font-bold text-slate-600">Other: {value}</span>;
                          if (value === true) {
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            return <span key={key} className="px-2 py-1 bg-red-50 border border-red-100 rounded-md text-[11px] font-bold text-red-600">{label}</span>;
                          }
                          return null;
                        })}
                        {Object.values(selectedOrder.condition || {}).every(v => !v) && <p className="text-xs text-slate-400 italic">No issues reported</p>}
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-100" />

                  {/* Section: Services & Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-gray-900 tracking-tight">Services</h3>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-slate-500">Base Service</Label>
                          <p className="text-[14px] font-bold text-slate-900">{Array.isArray(selectedOrder.baseService) ? selectedOrder.baseService.join(', ') : selectedOrder.baseService}</p>
                        </div>
                        {selectedOrder.addOns.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-500">Add-ons</Label>
                            <div className="space-y-0.5">
                              {selectedOrder.addOns.map((addon, idx) => (
                                <p key={idx} className="text-[14px] font-bold text-slate-900">
                                  • {addon.name} {addon.quantity > 1 && <span className="text-slate-400 font-medium text-xs">({addon.quantity})</span>}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-gray-900 tracking-tight">Order Status</h3>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-slate-500">Priority</Label>
                          <p className="text-[14px] font-black text-red-600 uppercase tracking-tight">{selectedOrder.priorityLevel}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-slate-500">Assigned To</Label>
                          <p className="text-[14px] font-bold text-slate-900">{selectedOrder.assignedTo || 'Unassigned'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-100" />

                  {/* Section: Logistics */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight">Logistics</h3>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-500">Shipping Preference</Label>
                      <p className="text-[14px] font-bold text-slate-900 capitalize">{selectedOrder.shippingPreference || '-'}</p>
                    </div>
                  </div>

                  <div className="border-b border-slate-100" />

                  {/* Section: Payment Information */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight">Payment Details</h3>
                    <div className="grid grid-cols-2 gap-y-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Method</Label>
                        <p className="text-[14px] font-bold text-slate-900 uppercase">{selectedOrder.paymentMethod || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Status</Label>
                        <span className={`inline-block px-2 py-0.5 rounded text-[14px] font-black uppercase tracking-wider ${selectedOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          selectedOrder.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                          {selectedOrder.paymentStatus || 'unpaid'}
                        </span>
                      </div>
                      {['gcash', 'maya'].includes(selectedOrder.paymentMethod?.toLowerCase()) && (selectedOrder.paymentStatus === 'paid' || selectedOrder.paymentStatus === 'partial') && (
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs font-medium text-slate-500">Reference Number</Label>
                          <p className="text-[14px] font-bold text-slate-900 font-mono tracking-tight">{selectedOrder.referenceNo || '-'}</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Amount Received</Label>
                        <p className="text-[14px] font-bold text-slate-900">₱{(selectedOrder.amountReceived || 0).toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Change</Label>
                        <p className="text-[14px] font-bold text-slate-900">₱{(selectedOrder.change || 0).toFixed(2)}</p>
                      </div>
                      {(selectedOrder.paymentStatus === 'unpaid' || selectedOrder.paymentStatus === 'partial') && (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-slate-500">Remaining Balance</Label>
                          <p className="text-[14px] font-black uppercase tracking-wider text-red-600">
                            ₱{(selectedOrder.grandTotal - (selectedOrder.amountReceived || 0)).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section: Pricing Summary */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mt-2">
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-sm font-medium">Base Service Fee</span>
                        <span className="text-[14px] font-bold text-slate-900">₱{selectedOrder.baseServiceFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-sm font-medium">Add-ons Total</span>
                        <span className="text-[14px] font-bold text-slate-900">₱{selectedOrder.addOnsTotal.toFixed(2)}</span>
                      </div>
                      {selectedOrder.priorityLevel === 'rush' && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="text-sm font-medium">Rush Fee</span>
                          <span className="text-[14px] font-bold text-slate-900">₱{(selectedOrder.grandTotal - (selectedOrder.baseServiceFee + selectedOrder.addOnsTotal)).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                        <span className="text-lg font-black text-slate-900">Grand Total</span>
                        <span className="text-lg font-black text-red-600">₱{selectedOrder.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Order Modal */}
          <EditOrderModal
            order={selectedOrder}
            open={!!selectedOrder && isEditing}
            hideHistory={role === 'staff'}
            onOpenChange={(open) => {
              if (!open) {
                setIsEditing(false);
                // Optional: if cancel edit, go back to read-only? 
                // Logic: if open=false, setIsEditing(false). 
                // Since selectedOrder is still true, ReadOnly modal pops up (open={!!selectedOrder && !isEditing}).
                // This is desired behavior: Cancel Edit -> Show ReadOnly.
              }
            }}
            onSave={(id, updates) => {
              updateOrder(id, updates);
              setIsEditing(false);
              toast.success('Order details updated');
              // Stay in ReadOnly view after save
            }}
          />

          {/* Charts and Recent Orders - Only Show When No Status Selected */}
          {!selectedStatus && (
            <>
              {/* Charts - Owner Only */}
              {role === 'owner' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between mt-3 py-6 gap-2">
                      <CardTitle className="text-left text-base font-black uppercase whitespace-nowrap tracking-tight">Service Volume by Type</CardTitle>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 ml-auto text-left">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
                          <div className="w-2.5 h-2.5 bg-[#84b6af] rounded-full shrink-0"></div>
                          <span>BASIC CLEANING</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
                          <div className="w-2.5 h-2.5 bg-[#c084fc] rounded-full shrink-0"></div>
                          <span>FULL REGLUE</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
                          <div className="w-2.5 h-2.5 bg-[#a78bfa] rounded-full shrink-0"></div>
                          <span>MINOR REGLUE</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap">
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
                                    <p className="text-sm text-gray-600 mb-2">Total Amount: {'\u20B1'}{data.sales.toLocaleString()}</p>

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
                    <CardHeader className="flex flex-row items-start justify-between mt-3 py-6 gap-2">
                      <CardTitle className="text-left text-base font-black uppercase whitespace-nowrap tracking-tight">{chartTitle}</CardTitle>
                      <div className="flex flex-col items-start gap-1.5 ml-auto">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap mt-1">
                          <div className="w-2.5 h-2.5 bg-purple-500 rounded-full shrink-0"></div>
                          <span>NEW ORDERS</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap mt-1">
                          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full shrink-0"></div>
                          <span>RELEASE ORDERS</span>
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
                                    <p className="text-sm text-purple-600">New Orders: {data.newOrders}</p>
                                    <p className="text-sm text-orange-600">Release Orders: {data.releasedOrders}</p>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Line type="monotone" dataKey="newOrders" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="releasedOrders" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* My Assigned Orders - Staff Only */}
              {role === 'staff' && (
                <Card>
                  <CardHeader className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-3">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-left uppercase whitespace-nowrap font-black">
                        My Assigned Orders
                      </CardTitle>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-tight">
                        {orders.filter(o => o.assignedTo === user.username && o.status !== 'claimed').length} TASKS
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                      <div className="relative w-full md:w-[320px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="Search order # or customer..."
                          value={searchQueryAssigned}
                          onChange={(e) => {
                            setSearchQueryAssigned(e.target.value);
                            setCurrentPageAssigned(1);
                          }}
                          className="pl-8 h-9 text-xs border-gray-200 bg-gray-50/50"
                        />
                      </div>

                      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTempFilterService(filterServiceAssigned);
                            setTempStartDate(startDateAssigned);
                            setTempEndDate(endDateAssigned);
                            setIsFilterOpen(true);
                          }}
                          className={`h-9 w-9 p-0 flex items-center justify-center border-gray-200 transition-all rounded-lg ${filterServiceAssigned !== 'all' || startDateAssigned || endDateAssigned ? 'bg-red-50 text-red-600 border-red-200 shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          <Filter className="h-4 w-4" />
                        </Button>
                        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                          <DialogHeader className="bg-white px-8 py-6 border-b flex flex-row items-center justify-between sticky top-0 z-10">
                            <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight">Filters</DialogTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsFilterOpen(false)} className="h-8 w-8 rounded-full hover:bg-gray-100 p-0">
                              <X size={20} className="text-gray-400" />
                            </Button>
                          </DialogHeader>
                          <div className="p-10 space-y-10 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              <div className="flex flex-col gap-2.5">
                                <Label className="text-[13px] font-black text-[#374151] ml-1 uppercase tracking-wide">Service Type</Label>
                                <Select value={tempFilterService} onValueChange={setTempFilterService}>
                                  <SelectTrigger className="h-12 bg-white border-[#fecaca] hover:border-red-300 rounded-2xl px-5 text-sm font-bold text-gray-700 shadow-sm transition-all focus:ring-4 focus:ring-red-50">
                                    <SelectValue placeholder="All Services" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-1">
                                    <SelectItem value="all" className="font-bold text-gray-600 rounded-xl">All Services</SelectItem>
                                    {baseServices.map(s => (
                                      <SelectItem key={s.id} value={s.name} className="font-bold text-gray-600 rounded-xl">{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex flex-col gap-2.5">
                                <Label className="text-[13px] font-black text-[#374151] ml-1 uppercase tracking-wide">Start Date</Label>
                                <div className="relative group">
                                  <Input
                                    type="date"
                                    value={tempStartDate}
                                    onChange={(e) => setTempStartDate(e.target.value)}
                                    className="h-12 pl-5 pr-10 bg-white border-gray-100 rounded-2xl text-sm font-bold text-gray-700 shadow-sm transition-all focus:ring-4 focus:ring-red-50 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                  />
                                  <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none transition-colors group-hover:text-red-500" />
                                </div>
                              </div>
                              <div className="flex flex-col gap-2.5">
                                <Label className="text-[13px] font-black text-[#374151] ml-1 uppercase tracking-wide">End Date</Label>
                                <div className="relative group">
                                  <Input
                                    type="date"
                                    value={tempEndDate}
                                    onChange={(e) => setTempEndDate(e.target.value)}
                                    className="h-12 pl-5 pr-10 bg-white border-gray-100 rounded-2xl text-sm font-bold text-gray-700 shadow-sm transition-all focus:ring-4 focus:ring-red-50 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                  />
                                  <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none transition-colors group-hover:text-red-500" />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-4 pt-6">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setTempFilterService('all');
                                  setTempStartDate('');
                                  setTempEndDate('');
                                }}
                                className="h-11 px-8 min-w-[200px] bg-slate-100 hover:bg-slate-200 text-slate-700 border-none rounded-xl font-bold transition-all text-sm uppercase tracking-wider"
                              >
                                Reset
                              </Button>
                              <Button
                                onClick={() => {
                                  setFilterServiceAssigned(tempFilterService);
                                  setStartDateAssigned(tempStartDate);
                                  setEndDateAssigned(tempEndDate);
                                  setIsFilterOpen(false);
                                  setCurrentPageAssigned(1);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white border-none rounded-xl font-bold shadow-md active:scale-95 transition-all h-11 px-8 min-w-[200px] text-sm uppercase tracking-wider"
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Order #</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Customer Name</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Service Type</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Priority Level</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Status</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(() => {
                            const allAssigned = orders.filter(o => o.assignedTo === user.username && o.status !== 'claimed')
                              .filter(o => {
                                // Search filter
                                if (searchQueryAssigned) {
                                  const query = searchQueryAssigned.toLowerCase();
                                  if (!o.orderNumber.toLowerCase().includes(query) &&
                                    !o.customerName.toLowerCase().includes(query)) return false;
                                }
                                // Status filter
                                if (filterStatusAssigned !== 'all' && o.status !== filterStatusAssigned) return false;

                                // Service filter
                                if (filterServiceAssigned !== 'all' && !o.baseService.includes(filterServiceAssigned)) return false;

                                // Date range filter
                                if (startDateAssigned) {
                                  if (new Date(o.createdAt) < new Date(startDateAssigned)) return false;
                                }
                                if (endDateAssigned) {
                                  const endObj = new Date(endDateAssigned);
                                  endObj.setHours(23, 59, 59, 999);
                                  if (new Date(o.createdAt) > endObj) return false;
                                }

                                return true;
                              }).sort((a, b) => {
                                // Sort: Recently updated first, then priority
                                const priorityMap = { 'rush': 0, 'premium': 1, 'regular': 2 };
                                const aP = priorityMap[a.priorityLevel as keyof typeof priorityMap] ?? 3;
                                const bP = priorityMap[b.priorityLevel as keyof typeof priorityMap] ?? 3;

                                const timeA = new Date(a.updatedAt || a.createdAt).getTime();
                                const timeB = new Date(b.updatedAt || b.createdAt).getTime();

                                if (timeA !== timeB) return timeB - timeA;
                                if (aP !== bP) return aP - bP;
                                return b.orderNumber.localeCompare(a.orderNumber);
                              });

                            const itemsPerPageAssigned = 5;
                            const totalPagesAssigned = Math.ceil(allAssigned.length / itemsPerPageAssigned);
                            const startIndexAssigned = (currentPageAssigned - 1) * itemsPerPageAssigned;
                            const paginatedAssigned = allAssigned.slice(startIndexAssigned, startIndexAssigned + itemsPerPageAssigned);

                            if (allAssigned.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 italic">
                                    No active assigned orders found.
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <>
                                {paginatedAssigned.map((job) => (
                                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-center whitespace-nowrap">{job.orderNumber}</td>
                                    <td className="px-4 py-3 text-sm text-center font-medium">{job.customerName}</td>
                                    <td className="px-4 py-3 text-sm text-center truncate max-w-[150px]">
                                      {Array.isArray(job.baseService)
                                        ? job.baseService.map(s => s.replace(' (with basic cleaning)', '')).join(', ')
                                        : String(job.baseService).replace(' (with basic cleaning)', '')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center">
                                      {(() => {
                                        let badgeClass = '';
                                        if (job.priorityLevel === 'rush') {
                                          badgeClass = 'bg-red-100 text-red-700';
                                        } else if (job.priorityLevel === 'premium') {
                                          badgeClass = 'bg-amber-100 text-amber-700';
                                        } else if (job.priorityLevel === 'regular') {
                                          badgeClass = 'bg-green-100 text-green-700';
                                        } else {
                                          badgeClass = 'bg-gray-100 text-gray-700';
                                        }
                                        return (
                                          <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${badgeClass}`}>
                                            {job.priorityLevel}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center">
                                      {(() => {
                                        let statusClass = '';
                                        let text = job.status.replace('-', ' ');
                                        if (job.status === 'new-order') {
                                          statusClass = 'bg-purple-100 text-purple-700';
                                        } else if (job.status === 'on-going') {
                                          statusClass = 'bg-blue-100 text-blue-700';
                                        } else if (job.status === 'for-release') {
                                          statusClass = 'bg-orange-100 text-orange-700';
                                        } else if (job.status === 'claimed') {
                                          statusClass = 'bg-gray-100 text-gray-700';
                                        }
                                        return (
                                          <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${statusClass}`}>
                                            {text}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center align-middle">
                                      <div className="flex items-center justify-center">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-9 w-[68px] p-0 border border-red-500 rounded-lg bg-red-50/30 hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm group"
                                            >
                                              <MoreVertical size={16} className="text-red-500 fill-red-500" />
                                              <ChevronDown size={14} className="text-red-500 transition-transform group-data-[state=open]:rotate-180" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-[180px] p-1.5 rounded-2xl border-gray-100 shadow-2xl">
                                            {job.status === 'new-order' && (
                                              <DropdownMenuItem
                                                onClick={() => { setSelectedOrder(job); setIsEditing(true); }}
                                                className="h-11 gap-3 rounded-xl px-4 cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 transition-all font-bold mb-1.5"
                                              >
                                                <Edit size={16} className="text-amber-600" />
                                                <span>Edit Order Detail</span>
                                              </DropdownMenuItem>
                                            )}

                                            {job.status !== 'new-order' && (
                                              <DropdownMenuItem
                                                onClick={() => {
                                                  const prevStatus =
                                                    job.status === 'on-going' ? 'new-order' :
                                                      job.status === 'for-release' ? 'on-going' :
                                                        job.status === 'claimed' ? 'for-release' : null;
                                                  if (prevStatus) updateOrder(job.id, { status: prevStatus as any, actualCompletionDate: undefined });
                                                }}
                                                className={cn(
                                                  "h-11 gap-3 rounded-xl px-4 cursor-pointer transition-all font-bold mb-1.5",
                                                  job.status === 'on-going' && "bg-purple-50 hover:bg-purple-100 text-purple-700",
                                                  job.status === 'for-release' && "bg-blue-50 hover:bg-blue-100 text-blue-700",
                                                  job.status === 'claimed' && "bg-orange-50 hover:bg-orange-100 text-orange-700"
                                                )}
                                              >
                                                <RotateCcw size={16} className={cn(
                                                  job.status === 'on-going' && "text-purple-500",
                                                  job.status === 'for-release' && "text-blue-500",
                                                  job.status === 'claimed' && "text-orange-500"
                                                )} />
                                                <span>
                                                  {job.status === 'on-going' ? 'Undo to New Order' :
                                                    job.status === 'for-release' ? 'Undo to On-Going' :
                                                      'Undo to For Release'}
                                                </span>
                                              </DropdownMenuItem>
                                            )}

                                            {['new-order', 'on-going', 'for-release'].includes(job.status) && (
                                              <DropdownMenuItem
                                                onClick={() => {
                                                  const nextStatus =
                                                    job.status === 'new-order' ? 'on-going' :
                                                      job.status === 'on-going' ? 'for-release' :
                                                        job.status === 'for-release' ? 'claimed' : null;

                                                  if (nextStatus) {
                                                    updateOrder(job.id, {
                                                      status: nextStatus as any,
                                                      actualCompletionDate: nextStatus === 'claimed' ? new Date() : undefined
                                                    });
                                                  }
                                                }}
                                                className={cn(
                                                  "h-11 gap-3 rounded-xl px-4 cursor-pointer transition-all font-bold",
                                                  job.status === 'for-release'
                                                    ? "bg-gray-50 hover:bg-gray-100 text-gray-700"
                                                    : "bg-blue-50 hover:bg-blue-100 text-blue-800"
                                                )}
                                              >
                                                <ArrowRight size={16} className={job.status === 'for-release' ? "text-gray-500" : "text-blue-500"} />
                                                <span>
                                                  {job.status === 'new-order' ? 'Move to On-Going' :
                                                    job.status === 'on-going' ? 'Move to For Release' :
                                                      'Move to Claimed'}
                                                </span>
                                              </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator className="my-2 bg-gray-50" />
                                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-3 py-1 mb-1">Set Status</DropdownMenuLabel>

                                            <DropdownMenuItem
                                              onClick={() => updateOrder(job.id, { status: 'for-release', actualCompletionDate: undefined })}
                                              className="h-10 gap-2.5 rounded-lg px-4 cursor-pointer text-orange-600 hover:bg-orange-50 font-bold transition-all text-xs"
                                            >
                                              <div className="h-2 w-2 rounded-full bg-orange-500 shadow-sm shadow-orange-200" />
                                              <span>Set to For Release</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => updateOrder(job.id, { status: 'claimed', actualCompletionDate: new Date() })}
                                              className="h-10 gap-2.5 rounded-lg px-4 cursor-pointer text-green-600 hover:bg-green-50 font-bold transition-all text-xs"
                                            >
                                              <div className="h-2 w-2 rounded-full bg-green-500 shadow-sm shadow-green-200" />
                                              <span>Set to Claimed</span>
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {totalPagesAssigned > 1 && (
                                  <tr>
                                    <td colSpan={6} className="px-0 py-0 border-t border-gray-100">
                                      <div className="flex items-center justify-between pt-1.5 pb-1 border-t border-gray-50 px-3">
                                        <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                          PAGE {currentPageAssigned} OF {totalPagesAssigned}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Button
                                            variant="outline"
                                            onClick={() => setCurrentPageAssigned(Math.max(1, currentPageAssigned - 1))}
                                            disabled={currentPageAssigned === 1}
                                            className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPageAssigned === 1
                                              ? 'bg-slate-200 text-slate-500'
                                              : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                              }`}
                                          >
                                            <ChevronLeft className="h-4 w-4" />
                                          </Button>

                                          <div className="max-w-[140px] md:max-w-[300px] overflow-x-auto no-scrollbar py-0.5 px-0.5 flex items-center gap-1">
                                            {Array.from({ length: totalPagesAssigned }, (_, i) => {
                                              const pageNum = i + 1;
                                              const isActive = currentPageAssigned === pageNum;
                                              return (
                                                <Button
                                                  key={pageNum}
                                                  variant={isActive ? "default" : "outline"}
                                                  size="sm"
                                                  onClick={() => setCurrentPageAssigned(pageNum)}
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
                                            onClick={() => setCurrentPageAssigned(Math.min(totalPagesAssigned, currentPageAssigned + 1))}
                                            disabled={currentPageAssigned === totalPagesAssigned}
                                            className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPageAssigned === totalPagesAssigned
                                              ? 'bg-slate-200 text-slate-500'
                                              : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                                              }`}
                                          >
                                            <ChevronRight className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Jobs */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-left uppercase font-black">Recent Orders</CardTitle>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-black text-gray-700 uppercase">{profitRange}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Order #</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Customer Name</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Service Type</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Release Date</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Priority Level</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(() => {
                          // Sort by most recent orders first (based on createdAt date)
                          const sortedOrders = [...orders].sort((a, b) => {
                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                          });
                          return sortedOrders.slice(0, 5).map((job) => (
                            <tr key={job.id}>
                              <td className="px-4 py-3 text-sm font-medium text-center whitespace-nowrap">{job.orderNumber}</td>
                              <td className="px-4 py-3 text-sm text-center">{job.customerName}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                {Array.isArray(job.baseService)
                                  ? job.baseService.map(s => s.replace(' (with basic cleaning)', '')).join(', ')
                                  : String(job.baseService).replace(' (with basic cleaning)', '')}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {job.predictedCompletionDate ? new Date(job.predictedCompletionDate).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {(() => {
                                  let badgeClass = '';
                                  if (job.priorityLevel === 'rush') {
                                    badgeClass = 'bg-red-100 text-red-700';
                                  } else if (job.priorityLevel === 'premium') {
                                    badgeClass = 'bg-amber-100 text-amber-700';
                                  } else if (job.priorityLevel === 'regular') {
                                    badgeClass = 'bg-green-100 text-green-700';
                                  } else {
                                    badgeClass = 'bg-gray-100 text-gray-700';
                                  }
                                  return (
                                    <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${badgeClass}`}>
                                      {job.priorityLevel}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {(() => {
                                  let statusClass = '';
                                  let text = job.status.replace('-', ' ');
                                  if (job.status === 'new-order') {
                                    statusClass = 'bg-purple-100 text-purple-700';
                                  } else if (job.status === 'on-going') {
                                    statusClass = 'bg-blue-100 text-blue-700';
                                  } else if (job.status === 'for-release') {
                                    statusClass = 'bg-orange-100 text-orange-700';
                                  } else if (job.status === 'claimed') {
                                    statusClass = 'bg-gray-100 text-gray-700';
                                  }
                                  return (
                                    <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${statusClass}`}>
                                      {text}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

        </div>
      </div>

      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onAddExpense={addExpense}
      />
    </>
  );
}

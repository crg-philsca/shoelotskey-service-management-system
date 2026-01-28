import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
import { FileText, ChevronDown, ChevronLeft, ChevronRight, Filter, Search, MoreVertical, Edit, ArrowRight, Banknote, PlusCircle, Sparkles, PackageOpen, Clock7, ClipboardCheck, CircleAlert, X, Calendar as CalendarIcon } from 'lucide-react';
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
            Add Expense
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
                  className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer transition-colors ${profitRange === range ? 'bg-red-600 text-white' : 'bg-white text-red-700'} hover:bg-red-600 hover:text-white`}
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
                className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer transition-colors ${profitRange === range ? 'bg-red-600 text-white' : 'bg-white text-red-700'} hover:bg-red-600 hover:text-white`}
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
              <CardTitle className="text-center text-base font-semibold uppercase mb-0 pb-0">Status Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0 pb-0 mb-0 -mt-5">
              <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {/* New Order */}
                <div
                  className={`relative flex items-center rounded-xl border cursor-pointer transition px-4 py-2 sm:px-6 sm:py-2 ${selectedStatus === 'new-order' ? 'border-purple-600 bg-purple-100' : 'border-purple-200 bg-purple-50 hover:bg-purple-100'}`}
                  onClick={() => setSelectedStatus('new-order')}
                >
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white text-purple-600 border-2 border-purple-200 shadow-sm">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center mx-auto">
                    <div className="text-2xl font-extrabold text-purple-700 text-center">{filteredOrders.filter(o => o.status === 'new-order').length}</div>
                    <div className="text-xs font-medium text-purple-700 text-center uppercase">New Order</div>
                  </div>
                </div>
                {/* On-Going */}
                <div
                  className={`relative flex items-center rounded-xl border cursor-pointer transition px-4 py-2 sm:px-6 sm:py-2 ${selectedStatus === 'on-going' ? 'border-blue-600 bg-blue-100' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}
                  onClick={() => setSelectedStatus('on-going')}
                >
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white text-blue-600 border-2 border-blue-200 shadow-sm">
                    <div className="relative">
                      <Clock7 className="h-5 w-5" />
                      <div className="absolute top-0 -right-1 h-3 w-3 flex items-center justify-center bg-white rounded-full">
                        <Sparkles className="h-2 w-2" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center mx-auto">
                    <div className="text-2xl font-extrabold text-blue-700 text-center">{filteredOrders.filter(o => o.status === 'on-going').length}</div>
                    <div className="text-xs font-medium text-blue-700 text-center uppercase">On-Going</div>
                  </div>
                </div>
                {/* For Release */}
                <div
                  className={`relative flex items-center rounded-xl border cursor-pointer transition px-4 py-2 sm:px-6 sm:py-2 ${selectedStatus === 'for-release' ? 'border-orange-600 bg-orange-100' : 'border-orange-200 bg-orange-50 hover:bg-orange-100'}`}
                  onClick={() => setSelectedStatus('for-release')}
                >
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white text-orange-600 border-2 border-orange-200 shadow-sm">
                    <PackageOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center mx-auto">
                    <div className="text-2xl font-extrabold text-orange-700 text-center">{filteredOrders.filter(o => o.status === 'for-release').length}</div>
                    <div className="text-xs font-medium text-orange-700 text-center uppercase">For Release</div>
                  </div>
                </div>
                {/* Claimed */}
                <div
                  className={`relative flex items-center rounded-xl border cursor-pointer transition px-4 py-2 sm:px-6 sm:py-2 ${selectedStatus === 'claimed' ? 'border-gray-600 bg-gray-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                  onClick={() => setSelectedStatus('claimed')}
                >
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white text-gray-700 border-2 border-gray-200 shadow-sm">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center mx-auto">
                    <div className="text-2xl font-extrabold text-gray-700 text-center">{filteredOrders.filter(o => o.status === 'claimed').length}</div>
                    <div className="text-xs font-medium text-gray-700 text-center uppercase">Claimed</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overview Summary Section - Always Shown */}
          {!selectedStatus && (
            <Card>
              <CardHeader className="pt-5 pb-0 mb-0">
                <CardTitle className="text-center text-base font-semibold uppercase mb-0 pb-0">Overview Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-0 mb-0 -mt-5">
                <div className="space-y-2">
                  {/* Card 1: Total Active Orders - Full Width */}
                  <div className="relative flex items-center rounded-xl bg-yellow-50 text-yellow-700 shadow-sm border border-yellow-200 px-3 py-3 min-h-[60px]">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white text-yellow-600 border-2 border-yellow-200 shadow-sm flex-shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center mx-auto">
                      <p className="text-xl font-bold text-yellow-700 text-center">{overviewOrders.filter(o => ['new-order', 'on-going', 'for-release'].includes(o.status)).length}</p>
                      <p className="text-[10px] font-medium text-center uppercase leading-tight">Total Active Orders</p>
                    </div>
                  </div>

                  {role === 'owner' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {/* Card 2: Pending Payments (Light Red) */}
                      <div className="relative flex items-center rounded-xl bg-red-50 text-red-700 shadow-sm border border-red-200 px-3 py-3 min-h-[60px]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white text-red-600 border-2 border-red-200 shadow-sm flex-shrink-0">
                          <CircleAlert className="h-5 w-5" />
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center mx-auto">
                          <p className="text-xl font-bold text-red-700 text-center">{'\u20B1'}{parseFloat(totalPendingPayments.toFixed(2)).toLocaleString()}</p>
                          <p className="text-[10px] font-medium text-center uppercase leading-tight">Pending Payments</p>
                        </div>
                      </div>

                      {/* Card 2: Total Sales */}
                      <div className="relative flex items-center rounded-xl bg-[#ecfdf3] text-[#15803d] shadow-sm border border-[#bbf7d0] px-3 py-3 min-h-[60px]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white text-[#15803d] border-2 border-[#bbf7d0] shadow-sm flex-shrink-0">
                          < Banknote className="h-5 w-5" />
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center mx-auto">
                          <p className="text-xl font-bold text-[#15803d] text-center">{'\u20B1'}{parseFloat(totalSales.toFixed(2)).toLocaleString()}</p>
                          <p className="text-[10px] font-medium text-center uppercase leading-tight">Total Sales</p>
                        </div>
                      </div>
                    </div>
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
                  <CardTitle className="text-center text-lg leading-tight p-0 m-0">
                    {(() => {
                      switch (selectedStatus) {
                        case 'new-order':
                          return 'NEW ORDER TABLE';
                        case 'on-going':
                          return 'ON-GOING TABLE';
                        case 'for-release':
                          return 'FOR RELEASE TABLE';
                        case 'claimed':
                          return 'CLAIMED TABLE';
                        default:
                          return 'STATUS TABLE';
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
                  <div className="flex-1 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-9 w-9 text-gray-500"
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
                      className="pl-10 h-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() => setIsFilterOpen(true)}
                    title="Open filters"
                  >
                    <Filter className={`h-5 w-5 ${filterService !== 'all' || startDate || endDate ? 'text-red-600' : 'text-gray-500'}`} />
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

                    <div className="flex justify-between items-center pt-2">
                      <Button className="bg-gray-500 hover:bg-red-700 text-white" onClick={() => {
                        setFilterService('all');
                        setStartDate('');
                        setEndDate('');
                        setCurrentPage(1);
                      }}>
                        Reset
                      </Button>
                      <Button className="bg-red-600 hover:bg-red-700" onClick={() => setIsFilterOpen(false)}>
                        Apply
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Orders Table */}
                <div className="overflow-x-auto">
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

                    // Sort rush orders to the top
                    filtered.sort((a, b) => {
                      if (a.priorityLevel === 'rush' && b.priorityLevel !== 'rush') return -1;
                      if (a.priorityLevel !== 'rush' && b.priorityLevel === 'rush') return 1;
                      return 0;
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
                                <td className="px-4 py-3 text-sm font-medium text-center">{order.orderNumber}</td>
                                <td className="px-4 py-3 text-sm text-center">{order.customerName}</td>
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
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrder(order);
                                        setIsEditing(true);
                                      }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100">
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit Order
                                      </DropdownMenuItem>
                                      {selectedStatus === 'new-order' && (
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation();
                                          const prevStatus = order.status;
                                          updateOrder(order.id, { status: 'on-going', updatedAt: new Date() }, user.username);
                                          toast.success('Order moved to On-Going', {
                                            style: { background: '#f0fdf4', color: '#166534' },
                                            action: {
                                              label: 'Undo',
                                              onClick: () => updateOrder(order.id, { status: prevStatus, updatedAt: new Date() })
                                            },
                                            actionButtonStyle: { backgroundColor: '#dc2626', color: 'white' }
                                          });
                                        }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100">
                                          <ArrowRight className="h-4 w-4 mr-2" />
                                          On-Going
                                        </DropdownMenuItem>
                                      )}
                                      {selectedStatus === 'on-going' && (
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation();
                                          const prevStatus = order.status;
                                          updateOrder(order.id, { status: 'for-release', updatedAt: new Date() }, user.username);
                                          toast.success('Order moved to For Release', {
                                            style: { background: '#f0fdf4', color: '#166534' },
                                            action: {
                                              label: 'Undo',
                                              onClick: () => updateOrder(order.id, { status: prevStatus, updatedAt: new Date() })
                                            },
                                            actionButtonStyle: { backgroundColor: '#dc2626', color: 'white' }
                                          });
                                        }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100">
                                          <ArrowRight className="h-4 w-4 mr-2" />
                                          For Release
                                        </DropdownMenuItem>
                                      )}
                                      {selectedStatus === 'for-release' && (
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation();
                                          const prevStatus = order.status;
                                          updateOrder(order.id, { status: 'claimed', updatedAt: new Date(), actualCompletionDate: new Date() }, user.username);
                                          toast.success('Order moved to Claimed', {
                                            style: { background: '#f0fdf4', color: '#166534' },
                                            action: {
                                              label: 'Undo',
                                              onClick: () => updateOrder(order.id, { status: prevStatus, updatedAt: new Date(), actualCompletionDate: undefined })
                                            },
                                            actionButtonStyle: { backgroundColor: '#dc2626', color: 'white' }
                                          });
                                        }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 focus:text-gray-700 focus:bg-gray-100">
                                          <ArrowRight className="h-4 w-4 mr-2" />
                                          Claimed
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
                        <div className="mt-6 flex items-center">
                          <div className="text-sm text-gray-600 flex-shrink-0">
                            Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
                            {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} results
                          </div>
                          <div className="flex-1 flex justify-end">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`w-9 h-9 ${currentPage === 1 ? 'bg-gray-500 text-white border-gray-500 hover:bg-gray-500 hover:text-white' : ''}`}
                              >
                                &lt;
                              </Button>
                              <div className="flex items-center gap-1 overflow-x-auto max-w-[60vw] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-2">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                  <Button
                                    key={page}
                                    variant={currentPage === page ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 p-0 flex-shrink-0 ${currentPage === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                                  >
                                    {page}
                                  </Button>
                                ))}
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className={`w-9 h-9 ${currentPage === totalPages ? 'bg-gray-500 text-white border-gray-500 hover:bg-gray-500 hover:text-white' : ''}`}
                              >
                                &gt;
                              </Button>
                            </div>
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
                <div className="space-y-6">
                  {/* Customer Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-lg mb-3">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-gray-600">Name</Label>
                        <p className="font-medium">{selectedOrder.customerName}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">Contact Number</Label>
                        <p className="font-medium">{selectedOrder.contactNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Order Status */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-lg mb-3">Order Status</h3>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Status</Label>
                      <p className="font-medium capitalize">{selectedOrder.status.replace('-', ' ')}</p>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-lg mb-3">Services</h3>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm text-gray-600">Base Service</Label>
                        <p className="font-medium">{selectedOrder.baseService}</p>
                      </div>
                      {selectedOrder.addOns.length > 0 && (
                        <div>
                          <Label className="text-sm text-gray-600">Add-ons</Label>
                          <div className="space-y-1">
                            {selectedOrder.addOns.map((addon, idx) => (
                              <p key={idx} className="font-medium">
                                • {addon.name} {addon.quantity > 1 && <span className="text-gray-500 text-xs">(x{addon.quantity})</span>}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Pricing</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm text-gray-600">Base Service Fee</Label>
                        <p className="font-medium">{'\u20B1'}{selectedOrder.baseServiceFee.toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <Label className="text-sm text-gray-600">Add-ons Total</Label>
                        <p className="font-medium">{'\u20B1'}{selectedOrder.addOnsTotal.toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-semibold text-lg items-center">
                        <p>Grand Total</p>
                        <p>{'\u20B1'}{selectedOrder.grandTotal.toFixed(2)}</p>
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
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-left uppercase">Service Volume by Type</CardTitle>
                      <div className="flex items-center gap-4 mr-2">
                        {/* Multi-colored legend for each service type in 2 columns, reordered */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <div className="w-4 h-4 rounded" style={{ background: '#0d948880' }}></div>
                            <span>BASIC CLEANING</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <div className="w-4 h-4 rounded" style={{ background: '#c026d380' }}></div>
                            <span>FULL REGLUE</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <div className="w-4 h-4 rounded" style={{ background: '#6366f180' }}></div>
                            <span>MINOR REGLUE</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <div className="w-4 h-4 rounded" style={{ background: '#f59e0b80' }}></div>
                            <span>COLOR RENEWAL</span>
                          </div>
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
                              tick={{ fontSize: 13, fontWeight: 600 }}
                              interval={0}
                              tickMargin={8}
                              height={50}
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
                    <CardHeader className="flex flex-row items-center justify-between mt-3">
                      <CardTitle className="text-left">{chartTitle}</CardTitle>
                      <div className="flex items-center gap-4 mr-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                          <div className="w-4 h-4 bg-purple-500 rounded"></div>
                          <span>NEW ORDERS</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                          <div className="w-4 h-4 bg-orange-500 rounded"></div>
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

              {/* Assigned Orders Table */}
              <Card>
                <CardHeader className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-left uppercase whitespace-nowrap">
                      {role === 'owner' ? 'Assigned Orders Overview' : 'My Assigned Orders'}
                    </CardTitle>
                    {role === 'staff' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-tight">
                        {orders.filter(o => o.assignedTo === user.username && o.status !== 'claimed').length} TASKS
                      </span>
                    )}
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

                          <div className="flex items-center justify-between pt-6">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setTempFilterService('all');
                                setTempStartDate('');
                                setTempEndDate('');
                              }}
                              className="h-14 w-40 bg-[#64748b] hover:bg-[#475569] text-white border-none rounded-2xl font-black shadow-lg shadow-slate-100 hover:shadow-xl active:scale-95 transition-all text-lg uppercase tracking-wider"
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
                              className="h-14 w-40 bg-[#d94452] hover:bg-[#c13946] text-white border-none rounded-2xl font-black shadow-lg shadow-red-100 hover:shadow-xl active:scale-95 transition-all text-lg uppercase tracking-wider"
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
                          {role === 'owner' && <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Assigned To</th>}
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Priority Level</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(() => {
                          const allAssigned = (role === 'owner'
                            ? orders.filter(o => o.assignedTo && o.status !== 'claimed')
                            : orders.filter(o => o.assignedTo === user.username && o.status !== 'claimed'))
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
                              // Priority sorting: Rush=0, Premium=1, Regular=2
                              const priorityMap = { 'rush': 0, 'premium': 1, 'regular': 2 };
                              const aP = priorityMap[a.priorityLevel as keyof typeof priorityMap] ?? 3;
                              const bP = priorityMap[b.priorityLevel as keyof typeof priorityMap] ?? 3;

                              if (aP !== bP) return aP - bP;
                              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                            });

                          const itemsPerPageAssigned = 5;
                          const totalPagesAssigned = Math.ceil(allAssigned.length / itemsPerPageAssigned);
                          const startIndexAssigned = (currentPageAssigned - 1) * itemsPerPageAssigned;
                          const paginatedAssigned = allAssigned.slice(startIndexAssigned, startIndexAssigned + itemsPerPageAssigned);

                          if (allAssigned.length === 0) {
                            return (
                              <tr>
                                <td colSpan={role === 'owner' ? 7 : 6} className="px-4 py-8 text-center text-sm text-gray-500 italic">
                                  No active assigned orders found.
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <>
                              {paginatedAssigned.map((job) => (
                                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3 text-sm font-medium text-center">{job.orderNumber}</td>
                                  <td className="px-4 py-3 text-sm text-center font-medium">{job.customerName}</td>
                                  <td className="px-4 py-3 text-sm text-center truncate max-w-[150px]">
                                    {Array.isArray(job.baseService)
                                      ? job.baseService.map(s => s.replace(' (with basic cleaning)', '')).join(', ')
                                      : String(job.baseService).replace(' (with basic cleaning)', '')}
                                  </td>
                                  {role === 'owner' && (
                                    <td className="px-4 py-3 text-sm text-center font-semibold text-blue-600 uppercase">
                                      {job.assignedTo}
                                    </td>
                                  )}
                                  <td className="px-4 py-3 text-sm text-center">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${job.priorityLevel === 'rush' ? 'bg-red-100 text-red-700 shadow-sm' :
                                      job.priorityLevel === 'premium' ? 'bg-amber-100 text-amber-700 shadow-sm' :
                                        'bg-green-100 text-green-700 shadow-sm'
                                      }`}>
                                      {job.priorityLevel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-center">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${job.status === 'new-order' ? 'bg-purple-100 text-purple-700' :
                                      job.status === 'on-going' ? 'bg-blue-100 text-blue-700' :
                                        job.status === 'for-release' ? 'bg-orange-100 text-orange-700' :
                                          'bg-gray-100 text-gray-700'
                                      }`}>
                                      {job.status.replace('-', ' ')}
                                    </span>
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
                                          <DropdownMenuItem
                                            onClick={() => { setSelectedOrder(job); setIsEditing(true); }}
                                            className="h-11 gap-3 rounded-xl px-4 cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 transition-all font-bold mb-1.5"
                                          >
                                            <Edit size={16} className="text-amber-600" />
                                            <span>Edit Order</span>
                                          </DropdownMenuItem>

                                          <DropdownMenuItem
                                            onClick={() => updateOrder(job.id, { status: 'on-going' })}
                                            className="h-11 gap-3 rounded-xl px-4 cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-800 transition-all font-bold"
                                          >
                                            <ArrowRight size={16} className="text-blue-500" />
                                            <span>On-Going</span>
                                          </DropdownMenuItem>

                                          <DropdownMenuSeparator className="my-2 bg-gray-50" />
                                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-3 py-1 mb-1">Set Status</DropdownMenuLabel>

                                          <DropdownMenuItem
                                            onClick={() => updateOrder(job.id, { status: 'for-release' })}
                                            className="h-10 gap-2.5 rounded-lg px-4 cursor-pointer text-orange-600 hover:bg-orange-50 font-bold transition-all text-xs"
                                          >
                                            <div className="h-2 w-2 rounded-full bg-orange-500 shadow-sm shadow-orange-200" />
                                            <span>Set to For Release</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => updateOrder(job.id, { status: 'claimed' })}
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
                                  <td colSpan={role === 'owner' ? 7 : 6} className="px-4 py-4 border-t bg-gray-50/50">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Showing {startIndexAssigned + 1}-{Math.min(startIndexAssigned + itemsPerPageAssigned, allAssigned.length)} of {allAssigned.length}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setCurrentPageAssigned(prev => Math.max(1, prev - 1))}
                                          disabled={currentPageAssigned === 1}
                                          className="h-8 w-8 p-0 flex items-center justify-center bg-white text-gray-700 border-gray-200 hover:bg-gray-50 transition-colors"
                                        >
                                          <ChevronLeft className="h-4 w-4" />
                                        </Button>

                                        <div className="flex items-center gap-1">
                                          {Array.from({ length: Math.min(5, totalPagesAssigned) }, (_, i) => {
                                            let pageNum;
                                            if (totalPagesAssigned <= 5) {
                                              pageNum = i + 1;
                                            } else if (currentPageAssigned <= 3) {
                                              pageNum = i + 1;
                                            } else if (currentPageAssigned >= totalPagesAssigned - 2) {
                                              pageNum = totalPagesAssigned - 4 + i;
                                            } else {
                                              pageNum = currentPageAssigned - 2 + i;
                                            }

                                            return (
                                              <Button
                                                key={pageNum}
                                                variant={currentPageAssigned === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPageAssigned(pageNum)}
                                                className={`h-8 w-8 p-0 text-xs font-bold ${currentPageAssigned === pageNum ? "bg-red-600 hover:bg-red-700 text-white border-red-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                                              >
                                                {pageNum}
                                              </Button>
                                            );
                                          })}
                                        </div>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setCurrentPageAssigned(prev => Math.min(totalPagesAssigned, prev + 1))}
                                          disabled={currentPageAssigned === totalPagesAssigned}
                                          className="h-8 w-8 p-0 flex items-center justify-center bg-white text-gray-700 border-gray-200 hover:bg-gray-50 transition-colors"
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

              {/* Recent Jobs */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-left uppercase">Recent Orders</CardTitle>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-semibold text-gray-700 uppercase">{profitRange}</span>
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
                              <td className="px-4 py-3 text-sm font-medium text-center">{job.orderNumber}</td>
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

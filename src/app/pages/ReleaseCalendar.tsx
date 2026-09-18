import { Card, CardContent } from '@/app/components/ui/card';
import OrderDetailModal from '@/app/components/OrderDetailModal';
import { Calendar } from '@/app/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Label } from '@/app/components/ui/label';
import { useMemo, useState, useEffect } from 'react';
import { useServices } from '@/app/context/ServiceContext';
import { useOrders } from '@/app/context/OrderContext';
import { Calendar as CalendarIcon, Package, User, Wallet, ClipboardList, FileText, ChevronLeft, ChevronRight, Search, Filter, Clock, Truck, Store, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { JobOrder } from '@/app/types';
import { formatPeso } from '@/app/lib/utils';

interface ReleaseCalendarProps {
  onSetHeaderActionRight?: (node: React.ReactNode) => void;
  user: { token: string };
}

export default function ReleaseCalendar({ onSetHeaderActionRight, user }: ReleaseCalendarProps) {
  const navigate = useNavigate();
  const { services } = useServices();
  const { orders, loading } = useOrders();

  const toValidDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    let str = String(val).trim();
    if (!str) return null;
    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T');
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  /**
   * Release Calendar Authoritative Rule:
   * The release calendar maps orders strictly to their PROMISED expected completion date
   * (intake/received date + authoritative business rules service duration).
   * It never relies on when a status button was clicked in the past, preventing old or
   * delayed orders from jumping to subsequent months.
   */
  const getJobReleaseDate = (job: JobOrder): Date | null => {
    const predicted = toValidDate(job.predictedCompletionDate);
    if (predicted) return predicted;
    const actual = toValidDate(job.actualReleaseDate);
    if (actual) return actual;
    return null;
  };

  // Strictly active statuses only: New Order, On-Going, For Release
  // Explicitly excludes: CLAIMED and CANCELLED
  const ACTIVE_STATUSES = ['new-order', 'on-going', 'for-release'];

  const isJobOverdue = (job: JobOrder): boolean => {
    const statusLower = String(job.status || '').toLowerCase().trim();
    if (!ACTIVE_STATUSES.includes(statusLower)) return false;
    const targetDate = getJobReleaseDate(job);
    if (!targetDate || isNaN(targetDate.getTime())) return false;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    return targetMidnight.getTime() < startOfToday.getTime();
  };

  const getDaysOverdue = (job: JobOrder): number => {
    const targetDate = getJobReleaseDate(job);
    if (!targetDate || isNaN(targetDate.getTime())) return 0;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const diffMs = startOfToday.getTime() - targetMidnight.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Active overdue orders list sorted by days overdue (oldest first)
  const overdueOrders = useMemo(() => {
    return orders.filter(isJobOverdue).sort((a, b) => {
      const da = getJobReleaseDate(a)?.getTime() || 0;
      const db = getJobReleaseDate(b)?.getTime() || 0;
      return da - db;
    });
  }, [orders]);

  // Dedicated Overdue View Toggle from left banner button
  const [isOverdueView, setIsOverdueView] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('all-active');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  const isEffectiveOverdue = isOverdueView || filterStatus === 'overdue';

  const scheduledOrders = useMemo(() => {
    return orders.filter((job: JobOrder) => {
      const statusLower = String(job.status || '').toLowerCase().trim();
      // Exclude CLAIMED and CANCELLED; only active orders belong in the Release Calendar
      return ACTIVE_STATUSES.includes(statusLower);
    });
  }, [orders]);

  /**
   * MEMO: releaseDates
   * Identifies all unique dates where orders are scheduled for release.
   * Normalized to midnight for reliable matching with react-day-picker.
   */
  const releaseDates = useMemo(() => {
    const datesMap = new Map<string, Date>();
    scheduledOrders.forEach((job: JobOrder) => {
      const d = getJobReleaseDate(job);
      if (d && !isNaN(d.getTime())) {
        const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        datesMap.set(midnight.toDateString(), midnight);
      }
    });
    return Array.from(datesMap.values());
  }, [scheduledOrders]);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterServiceType, setFilterServiceType] = useState<string>('all');
  const [filterShippingPreference, setFilterShippingPreference] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
  const itemsPerPage = 6;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterPaymentStatus !== 'all') count++;
    if (filterPaymentMethod !== 'all') count++;
    if (filterStatus !== 'all-active') count++;
    if (filterShippingPreference !== 'all') count++;
    if (filterServiceType !== 'all') count++;
    if (filterPriority !== 'all') count++;
    return count;
  }, [filterPaymentStatus, filterPaymentMethod, filterStatus, filterShippingPreference, filterServiceType, filterPriority]);

  const isSameDay = (a: Date | null | undefined, b: Date | null | undefined): boolean => {
    if (!a || !b || isNaN(a.getTime()) || isNaN(b.getTime())) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate ?? date);
    if (newDate) {
      setMonth(newDate);
    }
    setIsOverdueView(false);
    if (filterStatus === 'overdue') {
      setFilterStatus('all-active');
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    // [OWASP A09] Security Audit Logging
    if (user.token) {
      console.log('[SECURITY] Release Calendar viewed by authenticated session');
    }
  }, [user.token]);

  /**
   * FILTER LOGIC: jobsOnDate
   * Dynamically filters orders based on the clicked calendar date (or overdue view)
   * and additional UI filters (Priority, Payment, Service Type).
   * ALL filters strictly apply to the chosen calendar date.
   */
  const jobsOnDate = scheduledOrders.filter((job: JobOrder) => {
    if (!isEffectiveOverdue) {
      if (!date) return false;
      const targetDate = getJobReleaseDate(job);
      if (!targetDate || isNaN(targetDate.getTime())) return false;
      const matchesDate = isSameDay(targetDate, date);
      if (!matchesDate) return false;
    } else {
      // Global overdue view strictly checks if job is overdue
      if (!isJobOverdue(job)) return false;
    }

    // Filter by Order Status (applied to the calendar date)
    if (filterStatus !== 'all-active' && filterStatus !== 'overdue') {
      const statusLower = String(job.status || '').toLowerCase().trim();
      if (statusLower !== filterStatus) {
        return false;
      }
    }

    // Filter by Priority
    if (filterPriority !== 'all' && job.priorityLevel !== filterPriority) return false;

    // Filter by Payment Status
    if (filterPaymentStatus !== 'all' && job.paymentStatus !== filterPaymentStatus) return false;

    // Filter by Payment Method
    if (filterPaymentMethod !== 'all' && job.paymentMethod !== filterPaymentMethod) return false;

    // Filter by Service Type
    if (filterServiceType !== 'all') {
      const services = Array.isArray(job.baseService) ? job.baseService : [job.baseService];
      if (!services.some((s: string) => s === filterServiceType)) return false;
    }

    // Filter by Shipping Preference
    if (filterShippingPreference !== 'all') {
      const isDel = String(job.shippingPreference || '').toLowerCase().trim() === 'delivery';
      if (filterShippingPreference === 'delivery' && !isDel) return false;
      if (filterShippingPreference === 'pickup' && isDel) return false;
    }

    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      job.orderNumber.toLowerCase().includes(searchLower) ||
      job.customerName.toLowerCase().includes(searchLower)
    );
  });

  const sortedJobsOnDate = [...jobsOnDate].sort((a: JobOrder, b: JobOrder) => {
    // Sort logic: Rush orders always appear at the top
    const priorityOrder: Record<string, number> = { rush: 0, premium: 1, regular: 2 };
    return (priorityOrder[a.priorityLevel] ?? 2) - (priorityOrder[b.priorityLevel] ?? 2);
  });

  const totalPages = Math.ceil(sortedJobsOnDate.length / itemsPerPage);
  const paginatedJobs = sortedJobsOnDate.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/claim-record')}
            className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-200 bg-white px-2 sm:px-3 py-2 text-sm font-bold uppercase text-red-600 shadow-sm transition hover:bg-red-50 hover:text-red-600 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <FileText className="h-4 w-4 sm:mr-2 shrink-0 text-red-600" />
            <span className="hidden sm:inline font-bold text-red-600">Claim Record</span>
          </Button>
          <Button
            onClick={() => navigate('/dashboard', { state: { status: 'for-release' } })}
            className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <ClipboardList className="h-4 w-4 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline font-bold">Release Table</span>
          </Button>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, navigate]);

  return (
    <div className="w-full max-w-[1560px] mx-auto space-y-2">
      <Card className="shadow-lg border-gray-200 overflow-hidden flex flex-col">
        <CardContent className="p-0 flex flex-col lg:flex-row flex-1">
          {/* Sidebar - Calendar */}
          <div className="w-full lg:w-[310px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/30 flex flex-col">
            <div className="px-4 py-2 border-b border-gray-200 flex items-center h-[46px]">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-1 bg-red-600 rounded-full"></div>
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.15em]">Select Release Date</h3>
              </div>
            </div>

            <div className="pt-2.5 px-3 pb-2.5 flex flex-col items-center">
              <div className="w-full max-w-[280px] flex items-center gap-2">
                <div className="relative group flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 group-focus-within:text-red-600 transition-colors" />
                  <Input
                    type="text"
                    placeholder="Search name or order #"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 bg-white border-gray-200 text-[10px] font-bold h-8 rounded-lg focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 placeholder:text-gray-400 tracking-wider transition-all shadow-sm w-full"
                  />
                </div>

                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`relative h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-all shadow-sm ${
                      activeFilterCount > 0
                        ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                        : 'border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 bg-white'
                    }`}>
                      <Filter className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-72 sm:w-80 p-4 shadow-xl border-gray-200 bg-white z-50 rounded-xl" 
                    align="start" 
                    side="bottom" 
                    sideOffset={6} 
                    collisionPadding={16}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <h4 className="font-bold text-sm">Filters</h4>
                      </div>

                      <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="payment-status" className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Payment Status</Label>
                            <Select value={filterPaymentStatus} onValueChange={(val) => { setFilterPaymentStatus(val); setCurrentPage(1); }}>
                              <SelectTrigger id="payment-status" className="h-8 text-xs font-medium">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">All</SelectItem>
                                <SelectItem value="fully-paid" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Fully Paid</SelectItem>
                                <SelectItem value="downpayment" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Downpayment</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="payment-method" className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Payment Method</Label>
                            <Select value={filterPaymentMethod} onValueChange={(val) => { setFilterPaymentMethod(val); setCurrentPage(1); }}>
                              <SelectTrigger id="payment-method" className="h-8 text-xs font-medium">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">All</SelectItem>
                                <SelectItem value="cash" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Cash</SelectItem>
                                <SelectItem value="gcash" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">G-Cash</SelectItem>
                                <SelectItem value="maya" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Maya</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="order-status" className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Order Status</Label>
                            <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}>
                              <SelectTrigger id="order-status" className="h-8 text-xs font-medium">
                                <SelectValue placeholder="All Active" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all-active" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">All Active</SelectItem>
                                <SelectItem value="new-order" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">New Order</SelectItem>
                                <SelectItem value="on-going" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">On-going</SelectItem>
                                <SelectItem value="for-release" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">For Release</SelectItem>
                                <SelectItem value="overdue" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Overdue</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="shipping-preference" className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Shipping Preference</Label>
                            <Select value={filterShippingPreference} onValueChange={(val) => { setFilterShippingPreference(val); setCurrentPage(1); }}>
                              <SelectTrigger id="shipping-preference" className="h-8 text-xs font-medium">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">All</SelectItem>
                                <SelectItem value="pickup" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Pickup</SelectItem>
                                <SelectItem value="delivery" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Delivery</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="service-type" className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Service Type</Label>
                            <Select value={filterServiceType} onValueChange={(val) => { setFilterServiceType(val); setCurrentPage(1); }}>
                              <SelectTrigger id="service-type" className="h-8 text-xs font-medium">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">All</SelectItem>
                                {services.filter(s => s.category === 'base' && s.active).map(service => (
                                  <SelectItem key={service.id} value={service.name} className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">
                                    {service.name.replace(' (with basic cleaning)', '')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="priority" className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Priority Level</Label>
                            <Select value={filterPriority} onValueChange={(val) => { setFilterPriority(val); setCurrentPage(1); }}>
                              <SelectTrigger id="priority" className="h-8 text-xs font-medium">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">All</SelectItem>
                                <SelectItem value="regular" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Regular</SelectItem>
                                <SelectItem value="rush" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Rush</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          className="flex-1 h-8 text-xs font-bold uppercase tracking-wider"
                          onClick={() => {
                            setFilterPaymentStatus('all');
                            setFilterPaymentMethod('all');
                            setFilterPriority('all');
                            setFilterServiceType('all');
                            setFilterShippingPreference('all');
                            setFilterStatus('all-active');
                            setCurrentPage(1);
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          className="flex-1 h-8 text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => setIsFilterOpen(false)}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex-1 px-4 pb-4 pt-0 flex flex-col justify-start items-center">
              <div className="w-full max-w-[280px] flex flex-col justify-start">
                {isEffectiveOverdue && overdueOrders.length > 0 && (
                  <div className="w-full mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 shadow-sm transition-all animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-rose-800 leading-tight">
                          {overdueOrders.length} Overdue {overdueOrders.length === 1 ? 'Order' : 'Orders'}
                        </p>
                        <p className="text-[9px] text-rose-600 font-medium truncate">
                          Past promised release date
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFilterStatus('all-active');
                        setIsOverdueView(false);
                        setCurrentPage(1);
                      }}
                      className="h-6 px-2 text-[9px] font-black uppercase tracking-wider rounded-md shrink-0 transition-colors border-rose-300 text-rose-700 hover:bg-rose-100 bg-white"
                      title="Clear overdue filter"
                    >
                      Clear Filter
                    </Button>
                  </div>
                )}
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateChange}
                  month={month}
                  onMonthChange={setMonth}
                  showOutsideDays={true}
                  fixedWeeks
                  modifiers={{ releaseDay: releaseDates as Date[] }}
                  modifiersClassNames={{
                    releaseDay:
                      'relative after:content-[""] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-0.5 after:h-[4px] after:w-[4px] after:rounded-full after:bg-red-600 font-bold text-red-700'
                  }}
                  classNames={{
                    head_cell: 'text-[10px] font-bold rounded-md w-9 text-gray-400 uppercase py-2',
                    caption_label: 'text-base font-black text-red-600 uppercase tracking-tight',
                    table: 'w-full border-collapse',
                    months: 'w-full',
                    cell: 'w-9 h-9 p-0 text-center',
                    day: 'h-8 w-8 p-0 font-bold transition-all hover:bg-red-50 hover:text-red-700 rounded-md flex items-center justify-center text-[10px] mx-auto',
                    day_selected: 'bg-red-600 text-white hover:bg-red-700 hover:text-white rounded-md shadow-sm',
                    day_today: 'bg-red-50 text-red-600 border border-red-200',
                    day_outside: 'text-gray-300 opacity-50 aria-selected:bg-gray-100/50 aria-selected:text-gray-500 aria-selected:opacity-30 after:!hidden !font-normal',
                    nav_button: 'hover:bg-red-50 text-red-600 rounded-full h-7 w-7 flex items-center justify-center transition-colors',
                  }}
                  className="p-0"
                />

                <div className="mt-2 p-2 bg-white rounded-xl border border-gray-200/80 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600"></div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Guide</span>
                  </div>
                  <p className="text-[10px] text-gray-600 font-medium leading-snug">
                    Dates with a <strong className="text-red-600 font-bold">dot</strong> indicate scheduled releases. Expected dates outlined in <strong className="text-rose-600 font-bold">red</strong> are overdue orders.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Orders List */}
          <div className="flex-1 flex flex-col bg-white min-w-0">
            <div className="px-3 sm:px-4 py-1.5 border-b border-gray-200 flex items-center justify-between relative bg-white/50 backdrop-blur-sm sticky top-0 z-10 h-[46px] gap-2">
              <div className="flex flex-col items-center text-center flex-1 min-w-0 px-1 sm:px-4">
                {isEffectiveOverdue ? (
                  <>
                    <h3 className="text-xs sm:text-sm md:text-base font-black text-rose-600 uppercase tracking-tight flex items-center justify-center gap-1.5 sm:gap-2 truncate max-w-full">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5] text-rose-600 shrink-0" />
                      <span className="truncate">OVERDUE / DELAYED RELEASES</span>
                    </h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-full">
                      Orders past their promised release date
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xs sm:text-sm md:text-base font-black text-red-600 uppercase tracking-tight flex items-center justify-center gap-1.5 sm:gap-2 truncate max-w-full">
                      <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5] shrink-0" />
                      <span className="truncate">
                        {date && !isNaN(date.getTime()) ? `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()} (${date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()})` : 'SELECT A DATE'}
                      </span>
                    </h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-full">Release Schedule Overview</p>
                  </>
                )}
              </div>
              <div className={`shrink-0 px-2 sm:px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                isEffectiveOverdue
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-red-50 text-red-600 border-red-100'
              }`}>
                <span className="text-[11px] font-black">{sortedJobsOnDate.length}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:inline">{sortedJobsOnDate.length === 1 ? 'Order' : 'Orders'}</span>
              </div>
            </div>

            {/* Orders container displaying 2 rows comfortably, fitted to 100% zoom */}
            <div className="flex-1 p-2.5 sm:p-3 pr-1 sm:pr-2 overflow-y-auto max-h-[460px] xl:max-h-[480px] flex flex-col custom-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : sortedJobsOnDate.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                    <Package size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 font-black uppercase tracking-widest text-xs sm:text-sm">
                      {searchTerm ? 'No matching orders' : isEffectiveOverdue ? 'No Overdue Orders' : 'No Releases Scheduled'}
                    </p>
                    <p className="text-[11px] text-gray-400 font-medium">
                      {searchTerm
                        ? `We couldn't find any orders matching "${searchTerm}".`
                        : isEffectiveOverdue
                          ? 'All active orders are on schedule!'
                          : 'Try selecting a date marked with a red indicator.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 align-start content-start">
                  {paginatedJobs.map(job => {
                    const isOverdue = isJobOverdue(job);
                    const daysOverdue = getDaysOverdue(job);
                    const servicesText = Array.isArray(job.baseService)
                      ? job.baseService.map((s: string) => s.replace(' (with basic cleaning)', '')).join(', ')
                      : String(job.baseService || '').replace(' (with basic cleaning)', '');
                    const shoeBrand = job.brand || (job.items?.[0]?.brand) || 'Shoes';
                    const shoeModel = job.shoeModel || (job.items?.[0]?.shoeModel) || '';
                    const shoeDesc = shoeModel && shoeModel !== 'Other' && shoeModel !== 'Unknown' 
                      ? `${shoeBrand} (${shoeModel})` 
                      : shoeBrand;
                    const balanceDue = job.balance != null && !isNaN(Number(job.balance)) 
                      ? Number(job.balance) 
                      : Math.max(0, (job.grandTotal || 0) - (job.depositAmount || (job.paymentStatus === 'fully-paid' ? job.grandTotal || 0 : 0)));

                    const intakeDate = toValidDate(job.createdAt);
                    const intakeDateStr = intakeDate && !isNaN(intakeDate.getTime())
                      ? intakeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '';
                    const intakeTimeStr = intakeDate && !isNaN(intakeDate.getTime())
                      ? intakeDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : '';
                    const intakeDisplay = intakeDateStr ? (intakeTimeStr ? `${intakeDateStr} • ${intakeTimeStr}` : intakeDateStr) : '';

                    const targetDate = getJobReleaseDate(job);
                    const targetDateStr = targetDate && !isNaN(targetDate.getTime())
                      ? targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '';
                    const explicitReleaseTime = (() => {
                      const rt = (job.releaseTime || (job as any).target_time || '').trim();
                      if (!rt) return '';
                      if (/^\d{1,2}:\d{2}$/.test(rt)) {
                        const parts = rt.split(':').map(Number);
                        if (!isNaN(parts[0]) && !isNaN(parts[1])) {
                          const d = new Date();
                          d.setHours(parts[0], parts[1], 0, 0);
                          return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        }
                      }
                      return rt;
                    })();
                    const expectedDisplay = targetDateStr ? (explicitReleaseTime ? `${targetDateStr} • ${explicitReleaseTime}` : targetDateStr) : '';

                    const isDelivery = String(job.shippingPreference || '').toLowerCase().trim() === 'delivery';
                    const shippingType = isDelivery ? 'Delivery' : 'Pickup';
                    const courierInfo = job.deliveryCourier ? ` • ${job.deliveryCourier}` : '';
                    const shippingDisplay = `${shippingType}${courierInfo}`;

                    return (
                    <div
                      key={job.id}
                      className={`group border rounded-xl p-2 sm:p-2.5 hover:shadow-md transition-all duration-200 bg-white relative overflow-hidden flex flex-col justify-between h-full ring-1 ring-transparent cursor-pointer ${
                        isOverdue 
                          ? 'border-rose-200 hover:border-rose-400 hover:ring-rose-50' 
                          : 'border-blue-200 hover:border-blue-400 hover:ring-blue-50'
                      }`}
                      onClick={() => setSelectedOrder(job)}
                    >
                      <div>
                        {/* Header: Order Number + Badges */}
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-xs sm:text-[13px] font-black tracking-tight truncate text-black" title={job.orderNumber}>
                            {job.orderNumber}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {job.priorityLevel === 'rush' && (
                              <span className="text-[9px] font-black text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
                                RUSH
                              </span>
                            )}
                            <span className="text-[9.5px] font-extrabold text-gray-600 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                              {job.quantity || 1} PR
                            </span>
                          </div>
                        </div>

                        {/* Content Body */}
                        <div className="space-y-1 pt-0.5">
                          {/* Customer Name (Full Width Unobstructed) */}
                          <div className="flex items-center gap-1.5 min-w-0 text-xs sm:text-[12.5px]">
                            <User size={13} className={isOverdue ? "text-red-500 shrink-0" : "text-blue-500 shrink-0"} />
                            <span className="font-bold text-gray-900 truncate block" title={job.customerName}>
                              {job.customerName}
                            </span>
                          </div>

                          {/* Contact Number on Left + Overdue Badge on Right */}
                          {(Boolean(job.contactNumber && job.contactNumber !== '-') || isOverdue) && (
                            <div className="flex items-center justify-between gap-1.5 min-w-0 text-[10px] pl-[18px] -mt-0.5">
                              <span className="text-gray-500 font-medium tracking-tight truncate" title={job.contactNumber || ''}>
                                {job.contactNumber && job.contactNumber !== '-' ? job.contactNumber : ''}
                              </span>
                              {isOverdue && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1 shadow-2xs ml-auto">
                                  <AlertCircle size={9} className="shrink-0 text-rose-600" />
                                  Overdue ({daysOverdue}d)
                                </span>
                              )}
                            </div>
                          )}

                          {/* Schedule: Received Date above Expected Date */}
                          <div className="space-y-1 pt-0.5">
                            {intakeDisplay && (
                              <div className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] text-purple-700 bg-purple-50/60 border border-purple-200/80 rounded-md px-2 py-0.5">
                                <CalendarIcon size={11} className="text-purple-600 shrink-0" />
                                <span className="truncate">
                                  Received: <span className="font-bold text-purple-900">{intakeDisplay}</span>
                                </span>
                              </div>
                            )}

                            {/* Expected Date (outlined in red if overdue, blue if normal) */}
                            <div className={`flex items-center gap-1.5 text-[10px] sm:text-[10.5px] rounded-md px-2 py-0.5 border ${
                              isOverdue 
                                ? 'text-rose-800 bg-rose-50/80 border-rose-300' 
                                : 'text-blue-800 bg-blue-50/70 border-blue-200'
                            }`}>
                              <Clock size={11} className={isOverdue ? 'text-rose-600 shrink-0' : 'text-blue-600 shrink-0'} />
                              <span className="font-bold truncate">
                                Expected: <span className="font-bold">{expectedDisplay || 'Standard Release'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Shoes & Services */}
                          <div className="flex items-start gap-1.5 text-xs pt-0.5">
                            <Package size={13} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1 leading-tight">
                              <p className="text-[11px] sm:text-xs font-bold text-gray-900 truncate" title={shoeDesc}>
                                {shoeDesc}
                              </p>
                              {servicesText && (
                                <p className="text-[10px] text-gray-500 truncate" title={servicesText}>
                                  {servicesText}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Payment & Balance */}
                          <div className="flex items-center justify-between gap-1.5 text-xs pt-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <Wallet size={13} className="text-blue-500 shrink-0" />
                              <span className={`text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider ${
                                job.paymentStatus === 'fully-paid' ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {job.paymentStatus === 'fully-paid' ? 'Fully Paid' : 'Downpayment'}
                              </span>
                            </div>
                            {job.paymentStatus === 'downpayment' && balanceDue > 0 && (
                              <span className="text-[9.5px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                                Bal: {formatPeso(balanceDue)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer: Shipping & Status */}
                      <div className="border-t border-gray-100 mt-1.5 pt-1 flex items-center justify-between gap-1 text-[10px]">
                        <span className="inline-flex items-center gap-1 text-gray-600 font-medium truncate" title={shippingDisplay}>
                          {isDelivery ? (
                            <Truck size={12} className="text-gray-400 shrink-0" />
                          ) : (
                            <Store size={12} className="text-gray-400 shrink-0" />
                          )}
                          <span className="truncate max-w-[120px]">{shippingDisplay}</span>
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider border shrink-0 ${
                          job.status === 'for-release' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : job.status === 'on-going' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {job.status === 'for-release' ? 'For Release' : job.status === 'on-going' ? 'On-going' : 'New Order'}
                        </span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {totalPages > 0 && (
              <div className="pt-2 pb-2 border-t border-gray-100 bg-white flex flex-wrap items-center justify-between px-3 sm:px-5 gap-2 shrink-0">
                <div className="text-[10px] sm:text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                  PAGE {currentPage} OF {totalPages}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-lg transition-all border ${currentPage === 1
                      ? 'bg-gray-50 text-gray-300 border-gray-100'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
                      }`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto max-w-[180px] sm:max-w-[360px] custom-scrollbar py-0.5 px-0.5">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={`h-7 w-7 sm:h-8 sm:w-8 p-0 text-[10px] sm:text-[11px] font-bold rounded-lg flex-shrink-0 transition-all ${currentPage === page
                          ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm'
                          : 'bg-white border-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                          }`}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-lg transition-all border ${currentPage === totalPages || totalPages === 0
                      ? 'bg-gray-50 text-gray-300 border-gray-100'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
                      }`}
                  >
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Order Modal */}
      <OrderDetailModal
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      />
    </div>
  );
}

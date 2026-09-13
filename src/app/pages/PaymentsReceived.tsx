import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrders } from '@/app/context/OrderContext';
import { formatPeso } from '@/app/lib/currency';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Calendar as CalendarIcon,
  ChevronDown,
  Wallet,
  Receipt,
  MoreVertical,
  Edit,
  Trash2,
  Clock3,
  Smartphone,
} from 'lucide-react';
import { format as dateFnsFormat } from 'date-fns';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import EditOrderModal from '@/app/components/EditOrderModal';
import OrderDetailModal from '@/app/components/OrderDetailModal';
import { toast } from 'sonner';
import type { JobOrder } from '@/app/types';
import {
  collectedSales,
  isCancelledOrder,
  isDateInRange,
  isSalesEligible,
  orderEventDate,
  type ReportRange,
} from '@/app/lib/salesAnalytics';

type PaymentsReceivedProps = {
  onSetHeaderActionRight?: (action: ReactNode | null) => void;
  user: { token: string; role: 'owner' | 'staff' | 'admin'; username: string };
};

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

export default function PaymentsReceived({ onSetHeaderActionRight, user }: PaymentsReceivedProps) {
  useEffect(() => {
    // [OWASP A09] Security Audit: Logging view access with token context
    if (user?.token) {
      console.log('[SECURITY] Payments Received accessed by authenticated session');
    }
  }, [user?.token]);

  const navigate = useNavigate();
  const location = useLocation();
  const { orders, updateOrder, deleteOrder } = useOrders();

  const [viewingOrder, setViewingOrder] = useState<JobOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<JobOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);

  const [timeframe, setTimeframe] = useState<ReportRange>(() => {
    return (location.state as any)?.dateRange || 'Daily';
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    return (location.state as any)?.customStartDate || '';
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return (location.state as any)?.customEndDate || '';
  });

  useEffect(() => {
    const state = location.state as any;
    if (state?.dateRange) {
      setTimeframe(state.dateRange);
    }
    if (state?.customStartDate !== undefined) {
      setCustomStartDate(state.customStartDate || '');
    }
    if (state?.customEndDate !== undefined) {
      setCustomEndDate(state.customEndDate || '');
    }
    if (state?.filterCard || state?.cardFilter) {
      setCardFilter(state.filterCard || state.cardFilter);
    }
  }, [location.state]);

  const [searchQuery, setSearchQuery] = useState('');
  const [cardFilter, setCardFilter] = useState<'all' | 'fully-paid' | 'downpayment' | 'cash' | 'digital'>(() => {
    return (location.state as any)?.filterCard || 'all';
  });
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Header Dropdown for Timeframe
  useEffect(() => {
    if (!onSetHeaderActionRight) return;

    const rangeMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Select range"
            className="w-10 h-10 sm:w-40 flex items-center justify-center sm:justify-between rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:border-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <CalendarIcon className="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline truncate mx-1 flex-1 text-center">
              {timeframe === 'Annually' ? 'Annual' : timeframe}
            </span>
            <ChevronDown className="hidden sm:block h-4 w-4 text-white shrink-0" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 min-w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden">
          {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Custom'].map((range) => (
            <DropdownMenuItem
              key={range}
              onClick={() => setTimeframe(range as typeof timeframe)}
              className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer ${
                timeframe === range
                  ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white'
                  : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'
              }`}
            >
              {range === 'Annually' ? 'Annual' : range}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    onSetHeaderActionRight(
      <div className="flex items-center gap-2">
        {timeframe === 'Custom' && (
          <div className="hidden lg:flex items-center gap-1">
            <input
              type="date"
              aria-label="Custom start date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-2 text-xs"
            />
            <span className="text-xs text-gray-500">–</span>
            <input
              type="date"
              aria-label="Custom end date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-2 text-xs"
            />
            <button
              type="button"
              className="h-10 px-2 text-sm font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                setCustomStartDate('');
                setCustomEndDate('');
                setTimeframe('Daily');
              }}
            >
              Clear
            </button>
          </div>
        )}
        {rangeMenu}
      </div>
    );

    return () => onSetHeaderActionRight(null);
  }, [onSetHeaderActionRight, timeframe, customStartDate, customEndDate]);

  // 1. Eligible orders within selected timeframe
  const periodOrders = useMemo(() => {
    const now = new Date();
    return (orders || [])
      .filter((order: JobOrder) => isSalesEligible(order) || (isCancelledOrder(order) && (order.refundStatus === 'refunded' || Number(order.refundAmount || 0) > 0 || Number(order.amountReceived || order.depositAmount || 0) > 0)))
      .filter((order: JobOrder) => isDateInRange(orderEventDate(order), timeframe, now, customStartDate, customEndDate));
  }, [orders, timeframe, customStartDate, customEndDate]);

  // 2. Base filtered orders (search, custom date filters)
  const baseFilteredOrders = useMemo(() => {
    let filtered = [...periodOrders];

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((order) => new Date(order.transactionDate || order.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((order) => new Date(order.transactionDate || order.createdAt) <= end);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order) =>
        order.customerName.toLowerCase().includes(query) ||
        order.orderNumber.toLowerCase().includes(query) ||
        Boolean((order as any).paymentReference && String((order as any).paymentReference).toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [periodOrders, startDate, endDate, searchQuery]);

  // 3. Payment Method breakdown calculation
  const paymentBreakdown = useMemo(() => {
    const counts: Record<string, number> = { cash: 0, gcash: 0, maya: 0 };

    baseFilteredOrders.forEach((order: JobOrder) => {
      const collected = collectedSales(order);
      if (collected <= 0) return;

      const initM = (order.initialPaymentMethod || '').toLowerCase();
      const finM = (order.finalPaymentMethod || '').toLowerCase();

      if (initM && finM && initM !== finM) {
        const dp = Math.min(collected, Number(order.depositAmount) || (order.paymentStatus === 'downpayment' ? collected : 0));
        const bal = Math.max(0, collected - dp);
        const kInit = counts[initM] !== undefined ? initM : 'cash';
        const kFin = counts[finM] !== undefined ? finM : 'cash';
        counts[kInit] = (counts[kInit] || 0) + dp;
        counts[kFin] = (counts[kFin] || 0) + bal;
      } else if (order.paymentHistory && order.paymentHistory.length > 1) {
        const histTotal = order.paymentHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        if (histTotal > 0) {
          order.paymentHistory.forEach((p) => {
            const rawM = (p.method || 'cash').toLowerCase();
            const key = counts[rawM] !== undefined ? rawM : 'cash';
            const share = (Number(p.amount) / histTotal) * collected;
            counts[key] = (counts[key] || 0) + share;
          });
        } else {
          const rawM = (order.paymentMethod || 'cash').toLowerCase();
          const key = counts[rawM] !== undefined ? rawM : 'cash';
          counts[key] = (counts[key] || 0) + collected;
        }
      } else {
        const rawM = (order.paymentMethod || 'cash').toLowerCase();
        const key = counts[rawM] !== undefined ? rawM : 'cash';
        counts[key] = (counts[key] || 0) + collected;
      }
    });

    const totalCollected = baseFilteredOrders.reduce((sum, o) => sum + collectedSales(o), 0);

    return {
      total: Math.round(totalCollected * 100) / 100,
      cash: Math.round((counts.cash || 0) * 100) / 100,
      gcash: Math.round((counts.gcash || 0) * 100) / 100,
      maya: Math.round((counts.maya || 0) * 100) / 100,
    };
  }, [baseFilteredOrders]);

  // 4. Executive breakdown stats for the 5 interactive cards
  const paymentStats = useMemo(() => {
    let fullyPaidTotal = 0;
    let downpaymentTotal = 0;

    baseFilteredOrders.forEach((order: JobOrder) => {
      const collected = collectedSales(order);
      if (collected <= 0) return;
      const status = String(order.paymentStatus || '').toLowerCase();
      const billed = Number(order.grandTotal) || 0;
      if (status === 'paid' || status === 'fully-paid' || (billed > 0 && collected >= billed)) {
        fullyPaidTotal += collected;
      } else {
        downpaymentTotal += collected;
      }
    });

    const digitalTotal = (paymentBreakdown.gcash || 0) + (paymentBreakdown.maya || 0);

    return {
      total: paymentBreakdown.total || 0,
      fullyPaid: Math.round(fullyPaidTotal * 100) / 100,
      downpayment: Math.round(downpaymentTotal * 100) / 100,
      cash: paymentBreakdown.cash || 0,
      digital: Math.round(digitalTotal * 100) / 100,
    };
  }, [baseFilteredOrders, paymentBreakdown]);

  // 5. Filter by active card filter & dropdown filter
  const filteredOrders = useMemo(() => {
    let list = [...baseFilteredOrders];

    if (cardFilter === 'fully-paid') {
      list = list.filter((order) => {
        const status = String(order.paymentStatus || '').toLowerCase();
        const billed = Number(order.grandTotal) || 0;
        const collected = collectedSales(order);
        return (status === 'paid' || status === 'fully-paid') || (billed > 0 && collected >= billed);
      });
    } else if (cardFilter === 'downpayment') {
      list = list.filter((order) => {
        const status = String(order.paymentStatus || '').toLowerCase();
        const billed = Number(order.grandTotal) || 0;
        const isCancelled = isCancelledOrder(order);
        const collected = isCancelled ? Number(order.amountReceived || order.depositAmount || 0) : collectedSales(order);
        return status === 'downpayment' || (collected > 0 && collected < billed);
      });
    } else if (cardFilter === 'cash') {
      list = list.filter((order) => {
        const method = (order.paymentMethod || '').toLowerCase();
        const initMethod = (order.initialPaymentMethod || '').toLowerCase();
        const finalMethod = (order.finalPaymentMethod || '').toLowerCase();
        const inHistory = order.paymentHistory?.some((p) => (p.method || '').toLowerCase() === 'cash');
        return method.includes('cash') || initMethod === 'cash' || finalMethod === 'cash' || Boolean(inHistory);
      });
    } else if (cardFilter === 'digital') {
      list = list.filter((order) => {
        const method = (order.paymentMethod || '').toLowerCase();
        const initMethod = (order.initialPaymentMethod || '').toLowerCase();
        const finalMethod = (order.finalPaymentMethod || '').toLowerCase();
        const inHistory = order.paymentHistory?.some((p) => {
          const m = (p.method || '').toLowerCase();
          return m === 'gcash' || m === 'maya';
        });
        return (
          method.includes('gcash') || method.includes('maya') ||
          initMethod === 'gcash' || initMethod === 'maya' ||
          finalMethod === 'gcash' || finalMethod === 'maya' ||
          Boolean(inHistory)
        );
      });
    }

    if (filterPaymentMethod !== 'all') {
      list = list.filter((order) => {
        const method = (order.paymentMethod || '').toLowerCase();
        const initMethod = (order.initialPaymentMethod || '').toLowerCase();
        const finalMethod = (order.finalPaymentMethod || '').toLowerCase();
        const inHistory = order.paymentHistory?.some((p) => (p.method || '').toLowerCase() === filterPaymentMethod);
        return (
          method.includes(filterPaymentMethod) ||
          initMethod === filterPaymentMethod ||
          finalMethod === filterPaymentMethod ||
          Boolean(inHistory)
        );
      });
    }

    // Sort descending by date
    list.sort((a, b) => {
      const timeA = new Date(a.transactionDate || a.createdAt).getTime();
      const timeB = new Date(b.transactionDate || b.createdAt).getTime();
      return timeB - timeA;
    });

    return list;
  }, [baseFilteredOrders, cardFilter, filterPaymentMethod]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 pb-10">
      {timeframe === 'Custom' && (
        <div className="flex flex-wrap items-end justify-center gap-2 rounded-xl border border-red-100 bg-red-50/60 p-3 lg:hidden">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Start date</span>
            <input
              type="date"
              aria-label="Custom start date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-2 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">End date</span>
            <input
              type="date"
              aria-label="Custom end date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-2 text-xs"
            />
          </label>
          <button
            type="button"
            className="h-10 px-3 text-sm font-bold uppercase text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              setCustomStartDate('');
              setCustomEndDate('');
              setTimeframe('Daily');
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* 5 Top Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Payments */}
        <Card
          role="button"
          tabIndex={0}
          aria-label="Filter by all payments"
          onClick={() => { setCardFilter(cardFilter === 'all' ? 'all' : 'all'); setCurrentPage(1); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCardFilter('all'); setCurrentPage(1); } }}
          className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-indigo-50 to-white hover:shadow-md ${
            cardFilter === 'all' ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-transparent hover:border-indigo-200'
          }`}
        >
          <CardContent className="pt-4 pb-3 px-3 sm:px-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                <Receipt className="h-3.5 w-3.5" />
              </div>
              <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Total Payments</p>
            </div>
            <p className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight">
              {formatPeso(paymentStats.total)}
            </p>
          </CardContent>
        </Card>

        {/* Fully Paid Received */}
        <Card
          role="button"
          tabIndex={0}
          aria-label="Filter by fully paid received"
          onClick={() => { setCardFilter(cardFilter === 'fully-paid' ? 'all' : 'fully-paid'); setCurrentPage(1); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCardFilter(cardFilter === 'fully-paid' ? 'all' : 'fully-paid'); setCurrentPage(1); } }}
          className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-emerald-50 to-white hover:shadow-md ${
            cardFilter === 'fully-paid' ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-transparent hover:border-emerald-200'
          }`}
        >
          <CardContent className="pt-4 pb-3 px-3 sm:px-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Fully Paid Payments</p>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
              {formatPeso(paymentStats.fullyPaid)}
            </p>
          </CardContent>
        </Card>

        {/* Downpayments Received */}
        <Card
          role="button"
          tabIndex={0}
          aria-label="Filter by downpayments received"
          onClick={() => { setCardFilter(cardFilter === 'downpayment' ? 'all' : 'downpayment'); setCurrentPage(1); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCardFilter(cardFilter === 'downpayment' ? 'all' : 'downpayment'); setCurrentPage(1); } }}
          className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-amber-50 to-white hover:shadow-md ${
            cardFilter === 'downpayment' ? 'border-amber-600 ring-2 ring-amber-600/20' : 'border-transparent hover:border-amber-200'
          }`}
        >
          <CardContent className="pt-4 pb-3 px-3 sm:px-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                <Clock3 className="h-3.5 w-3.5" />
              </div>
              <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Downpayments</p>
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight">
              {formatPeso(paymentStats.downpayment)}
            </p>
          </CardContent>
        </Card>

        {/* Cash Payments */}
        <Card
          role="button"
          tabIndex={0}
          aria-label="Filter by cash payments"
          onClick={() => { setCardFilter(cardFilter === 'cash' ? 'all' : 'cash'); setCurrentPage(1); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCardFilter(cardFilter === 'cash' ? 'all' : 'cash'); setCurrentPage(1); } }}
          className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-sky-50 to-white hover:shadow-md ${
            cardFilter === 'cash' ? 'border-sky-600 ring-2 ring-sky-600/20' : 'border-transparent hover:border-sky-200'
          }`}
        >
          <CardContent className="pt-4 pb-3 px-3 sm:px-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 shrink-0">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Cash Payments</p>
            </div>
            <p className="text-xl sm:text-2xl font-black text-sky-700 tracking-tight">
              {formatPeso(paymentStats.cash)}
            </p>
          </CardContent>
        </Card>

        {/* Digital Payments (GCash + Maya) */}
        <Card
          role="button"
          tabIndex={0}
          aria-label="Filter by digital payments"
          onClick={() => { setCardFilter(cardFilter === 'digital' ? 'all' : 'digital'); setCurrentPage(1); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCardFilter(cardFilter === 'digital' ? 'all' : 'digital'); setCurrentPage(1); } }}
          className={`border-2 shadow-sm transition-all cursor-pointer bg-gradient-to-br from-purple-50 to-white hover:shadow-md ${
            cardFilter === 'digital' ? 'border-purple-600 ring-2 ring-purple-600/20' : 'border-transparent hover:border-purple-200'
          }`}
        >
          <CardContent className="pt-4 pb-3 px-3 sm:px-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                <Smartphone className="h-3.5 w-3.5" />
              </div>
              <p className="text-[9.5px] 2xl:text-[10px] font-black uppercase tracking-tight text-gray-500 whitespace-nowrap">Digital Payments</p>
            </div>
            <p className="text-xl sm:text-2xl font-black text-purple-700 tracking-tight">
              {formatPeso(paymentStats.digital)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Ledger Table in Card */}
      <Card className="shadow-xl border-0">
        <CardHeader className="pb-2 pt-6">
          <div className="flex flex-col items-center gap-2">
            <CardTitle className="text-lg font-black uppercase tracking-tight text-gray-900">Payments Received</CardTitle>
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 w-full">
              <Button
                onClick={() => navigate('/sales-report', { state: { dateRange: timeframe, customStartDate, customEndDate } })}
                className="bg-red-600 text-white hover:bg-red-700 h-10 px-3 flex-shrink-0 uppercase text-[11px] font-bold flex items-center gap-2 rounded-xl shadow-sm"
                size="sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <div className="flex-1 min-w-[220px] relative group">
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 text-gray-500 group-focus-within:text-red-600"
                  onClick={() => (document.getElementById('paymentsSearch') as HTMLInputElement)?.focus()}
                  title="Focus search"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Input
                  id="paymentsSearch"
                  placeholder="Search order #, customer, or reference..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 h-10 text-sm border-gray-200 bg-gray-50/70 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-xl"
                />
              </div>

              <Button
                variant="outline"
                className={`h-10 w-10 p-0 rounded-xl transition-colors flex-shrink-0 ${
                  isFilterOpen || startDate || endDate || filterPaymentMethod !== 'all'
                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                    : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'
                }`}
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                title="Open filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Collapsible Filter Panel */}
          {isFilterOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-200/80 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                  Payment Method
                </label>
                <Select
                  value={filterPaymentMethod}
                  onValueChange={(val) => {
                    setFilterPaymentMethod(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="maya">Maya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                  From Date
                </label>
                <FormattedDateInput
                  value={startDate}
                  onChange={(val) => {
                    setStartDate(val);
                    setCurrentPage(1);
                  }}
                  className="h-9 text-xs bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                  To Date
                </label>
                <FormattedDateInput
                  value={endDate}
                  onChange={(val) => {
                    setEndDate(val);
                    setCurrentPage(1);
                  }}
                  className="h-9 text-xs bg-white"
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0 px-2 sm:px-4 md:px-6">
          <div className="overflow-x-auto w-full">
            <Table className="w-full table-fixed min-w-0 text-xs">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[17%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
              </colgroup>
              <TableHeader className="bg-red-50/50 border-b border-red-100">
                <TableRow className="border-b border-red-100 hover:bg-transparent">
                  <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Order #
                  </TableHead>
                  <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Customer
                  </TableHead>
                  <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Payment Date
                  </TableHead>
                  <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Payment Method
                  </TableHead>
                  <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Amount Received
                  </TableHead>
                  <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Payment Status
                  </TableHead>
                  <TableHead className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {paginatedOrders.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                        <Receipt size={48} className="text-gray-300" />
                        <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">No payment transactions found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order: JobOrder) => {
                    const isCancelled = isCancelledOrder(order);
                    const isDP = String(order.paymentStatus || '').toLowerCase() === 'downpayment';
                    const isPaid = String(order.paymentStatus || '').toLowerCase() === 'fully-paid';
                    const paidAmt = Number(order.amountReceived || order.depositAmount || 0);
                    const collected = isCancelled ? paidAmt : collectedSales(order);
                    const dateVal = order.transactionDate || order.createdAt;
                    const dateStr = dateVal ? dateFnsFormat(new Date(dateVal), 'MM/dd/yy hh:mm a') : '—';
                    let methodStr = (order.paymentMethod || 'cash').toUpperCase();
                    // Detect GCash/Maya from referenceNo when stored as CASH
                    if (methodStr === 'CASH' && order.referenceNo && order.referenceNo.trim()) {
                      const cleanRef = order.referenceNo.replace(/\D/g, '');
                      methodStr = cleanRef.length === 13 ? 'GCASH' : 'MAYA';
                    }
                    // Split combined methods (e.g. "GCASH, CASH" or "MAYA, CASH") into separate tokens
                    const methodTokens: string[] = methodStr
                      .split(/[,/]+/)
                      .map((m: string) => m.trim())
                      .filter(Boolean);

                    const getBadgeStyle = (m: string) => {
                      if (m === 'GCASH') return 'bg-teal-50 text-teal-700 border-teal-300';
                      if (m === 'MAYA') return 'bg-purple-50 text-purple-700 border-purple-300';
                      return 'bg-sky-50 text-sky-700 border-sky-300'; // CASH
                    };


                    return (
                      <TableRow
                        key={order.id}
                        onClick={() => setViewingOrder(order)}
                        className="border-b border-gray-100 hover:bg-gray-50/80 transition-all cursor-pointer"
                      >
                        <TableCell className="px-2 py-2 text-center text-xs font-black font-mono text-gray-900 whitespace-nowrap" title={order.orderNumber}>
                          {order.orderNumber}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center max-w-0">
                          <div className="flex flex-col items-center justify-center text-center w-full min-w-0">
                            <div className="text-xs font-bold text-gray-900 leading-tight truncate max-w-full" title={order.customerName}>
                              {order.customerName}
                            </div>
                            {order.contactNumber && (
                              <div className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap truncate max-w-full">{order.contactNumber}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1">
                            <CalendarIcon size={11} className="text-slate-400 shrink-0" />
                            <span className="whitespace-nowrap font-medium">{dateStr}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                            {methodTokens.map((m, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap ${getBadgeStyle(m)}`}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs font-bold text-emerald-700 text-center whitespace-nowrap">
                          <div>{formatPeso(collected)}</div>
                          {isCancelled && (
                            <div className="text-[9px] font-semibold text-gray-500">
                              {order.refundStatus === 'refunded' ? 'Refunded' : 'Retained'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center whitespace-nowrap">
                          {isCancelled ? (
                            order.refundStatus === 'refunded' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap bg-rose-50 text-rose-700 border-rose-300">
                                CANCELLED (REFUNDED)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap bg-amber-50 text-amber-700 border-amber-300">
                                CANCELLED (RETAINED)
                              </span>
                            )
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : isDP
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : 'bg-gray-50 text-gray-600 border-gray-300'
                              }`}
                            >
                              {isPaid ? 'Fully Paid' : isDP ? 'Downpayment' : order.paymentStatus || 'Pending'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="h-7 w-7 p-0 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-md inline-flex items-center justify-center"
                                title="Actions"
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 p-1.5 space-y-1">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(order);
                                  setIsEditing(true);
                                }}
                                className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                Edit Order Detail
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOrderToDelete(order);
                                }}
                                className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                                Delete Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Unified Pagination Bar matching TotalOrders / TotalSales */}
          <div className="mt-2 flex items-center justify-between pt-1.5 pb-1 border-t border-gray-50 px-3">
            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
              PAGE {currentPage} OF {totalPages}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${
                  currentPage === 1 ? 'bg-slate-200 text-slate-500' : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
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
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={`h-7 w-7 min-w-[28px] p-0 text-[10px] font-black rounded-lg transition-all ${
                        isActive
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
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${
                  currentPage === totalPages
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      {viewingOrder && (
        <OrderDetailModal
          open={Boolean(viewingOrder)}
          onOpenChange={(open) => {
            if (!open) setViewingOrder(null);
          }}
          order={viewingOrder}
          user={user}
        />
      )}

      {/* Edit Order Modal */}
      {selectedOrder && (
        <EditOrderModal
          open={isEditing}
          onOpenChange={(open) => {
            setIsEditing(open);
            if (!open) setSelectedOrder(null);
          }}
          order={selectedOrder}
          user={user}
          onSave={(id, updates) => {
            updateOrder(id, updates);
            setSelectedOrder((prev: any) => (prev ? { ...prev, ...updates } : null));
            setIsEditing(false);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && !isDeleting && setOrderToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black uppercase tracking-tight">Confirm Soft Delete</DialogTitle>
            <DialogDescription className="sr-only">Confirm soft deletion of the selected order</DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center gap-4">
            <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
              <Trash2 size={32} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">Are you sure you want to delete this order?</p>
              <p className="text-xs text-gray-500 mt-1">
                This action will remove <span className="font-black text-red-600">{orderToDelete?.orderNumber}</span> from the payments record. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1 bg-gray-100 font-bold uppercase text-[10px] tracking-widest h-10 rounded-xl"
              onClick={() => setOrderToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 bg-red-600 hover:bg-red-700 font-bold uppercase text-[10px] tracking-widest h-10 rounded-xl shadow-lg shadow-red-100 disabled:opacity-50"
              disabled={isDeleting}
              onClick={async () => {
                if (isDeletingRef.current || isDeleting) return;
                if (orderToDelete) {
                  isDeletingRef.current = true;
                  setIsDeleting(true);
                  try {
                    await deleteOrder(orderToDelete.id);
                    toast.success(`Order ${orderToDelete.orderNumber} deleted successfully`);
                    setOrderToDelete(null);
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to delete order');
                  } finally {
                    isDeletingRef.current = false;
                    setIsDeleting(false);
                  }
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

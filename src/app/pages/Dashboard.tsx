import React, { useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { hasPermission } from '@/app/lib/permissions';
import { sanitizeClientAuthCode, sanitizeClientUsername, hasMaliciousPattern } from '@/app/lib/security';
import { useServices } from '@/app/context/ServiceContext';
import { useOrders } from '@/app/context/OrderContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useActivities } from '@/app/context/ActivityContext';
import { useInventory } from '@/app/context/InventoryContext';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';
import { toServiceCode, chunkServiceCodesTwoPerRow, normalizeServiceCodes } from '@/app/lib/businessRules';
import MMDDYYYYDatePicker from '@/app/components/ui/MMDDYYYYDatePicker';

const EditOrderModal = lazy(() => import('@/app/components/EditOrderModal'));
const StockUpdateModal = lazy(() => import('@/app/components/StockUpdateModal'));
const OrderDetailModal = lazy(() => import('@/app/components/OrderDetailModal'));
const AddExpenseModal = lazy(() => import('@/app/components/AddExpenseModal'));
const ProcessClaimModal = lazy(() => import('@/app/components/ProcessClaimModal'));
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
  Clock7,
  PackageOpen,
  Filter,
  RotateCcw,
  ClipboardCheck,
  FileText,
  CircleAlert,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Check,
  Loader2,
  Coins,
  Smartphone,
  Wallet,
  Lock,
  Eye,
  EyeOff,
  XCircle,
} from 'lucide-react';
const DashboardCharts = lazy(() => import('@/app/components/DashboardCharts'));
import type { JobOrder, FrontStaffSummary } from '@/app/types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
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
import { getOperatingSchedule, OperatingScheduleData } from '@/app/lib/operatingSchedule';

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
  user: { username: string; role: 'owner' | 'staff' | 'front staff' | 'admin'; token: string };
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
  const role = (user?.role || '').toLowerCase().trim();
  const isOwner = ['owner', 'admin'].includes(role);
  const isFrontStaff = (user?.username || '').toLowerCase().trim() === 'front_staff' || role === 'front staff';
  const isStaff = !isOwner && !isFrontStaff;

  const canUpdateOrder = hasPermission(user, 'job_orders.update');
  const canCancelOrder = hasPermission(user, 'job_orders.cancel');
  const canReleaseOrder = hasPermission(user, 'job_orders.release');

  const [frontStaffSummary, setFrontStaffSummary] = useState<FrontStaffSummary | null>(null);

  const { orders, loading, refreshing, updateOrder } = useOrders();

  const [operatingSchedule, setOperatingSchedule] = useState<OperatingScheduleData>(getOperatingSchedule);

  useEffect(() => {
    const handleScheduleUpdated = (e: any) => {
      if (e.detail) {
        setOperatingSchedule(e.detail);
      } else {
        setOperatingSchedule(getOperatingSchedule());
      }
    };
    window.addEventListener('shoelotskey_schedule_updated', handleScheduleUpdated);
    return () => window.removeEventListener('shoelotskey_schedule_updated', handleScheduleUpdated);
  }, []);

  useEffect(() => {
    if (!isFrontStaff) return;
    const fetchFrontStaffSummary = async () => {
      try {
        const res = await fetch(`${API_BASE}/dashboard/front-staff-summary`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setFrontStaffSummary(data);
        }
      } catch (e) {
        console.error('Failed to load front staff summary:', e);
      }
    };
    fetchFrontStaffSummary();
  }, [isFrontStaff, user.token, refreshing]);
  const { services, authorizationCode } = useServices();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [cancelOrderModal, setCancelOrderModal] = useState<JobOrder | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);

  // Cancellation Authorization State
  const [cancelAuthMethod, setCancelAuthMethod] = useState<'code' | 'credentials'>('code');
  const [cancelAuthCode, setCancelAuthCode] = useState('');
  const [cancelAuthUsername, setCancelAuthUsername] = useState('');
  const [cancelAuthPassword, setCancelAuthPassword] = useState('');
  const [showCancelSecret, setShowCancelSecret] = useState(false);
  const [isCancelAuthorizing, setIsCancelAuthorizing] = useState(false);
  const [cancelAuthorizedBy, setCancelAuthorizedBy] = useState<string | null>(null);

  useEffect(() => {
    if (!cancelOrderModal) {
      setCancelAuthCode('');
      setCancelAuthUsername('');
      setCancelAuthPassword('');
      setCancelAuthorizedBy(null);
      setShowCancelSecret(false);
      setCancelAuthMethod('code');
    }
  }, [cancelOrderModal]);

  const canStaffUseCancelCode = useMemo(() => {
    if (isOwner) return true;
    return hasPermission(user, 'discounts.use_auth_code') || hasPermission(user, 'discounts.authorize');
  }, [isOwner, user]);

  const isCancelAuthCodeValid = useMemo(() => {
    if (!canStaffUseCancelCode) return false;
    const code = cancelAuthCode.trim();
    if (!code) return false;
    const sysCode = (authorizationCode || '').trim();
    return Boolean(sysCode) && (code === sysCode || code.toUpperCase() === sysCode.toUpperCase());
  }, [canStaffUseCancelCode, cancelAuthCode, authorizationCode]);

  const isCancellationAuthorized = isOwner || hasPermission(user, 'job_orders.authorize_cancel') || isCancelAuthCodeValid || Boolean(cancelAuthorizedBy);

  const handleAuthorizeCancelCredentials = async () => {
    const cleanUsername = sanitizeClientUsername(cancelAuthUsername.trim());
    if (!cleanUsername || !cancelAuthPassword) {
      toast.error('Please enter authorizer username and password.');
      return;
    }
    if (hasMaliciousPattern(cleanUsername) || hasMaliciousPattern(cancelAuthPassword)) {
      toast.error('Malicious script or injection payload detected.');
      return;
    }
    setIsCancelAuthorizing(true);
    try {
      const resp = await fetch(`${API_BASE}/discounts/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          authorizer_username: cleanUsername,
          authorizer_credential: cancelAuthPassword,
          discount_type: 'Order Cancellation',
          reason: `Authorize cancellation of Order #${cancelOrderModal?.orderNumber}`
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        setCancelAuthorizedBy(data.authorizer_username || cancelAuthUsername.trim());
        setCancelAuthPassword('');
        toast.success(`Cancellation authorized by ${data.authorizer_username} (${data.authorizer_role || 'Supervisor'})`);
      } else {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.detail || 'Authorization failed. Invalid username or password.');
      }
    } catch {
      toast.error('Network error during cancellation authorization.');
    } finally {
      setIsCancelAuthorizing(false);
    }
  };
  const { addActivity } = useActivities();
  const [profitRange, setProfitRange] = useState<ReportRange>('Daily');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const formatDurationText = (ms: number) => {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  const handleProfitRangeChange = (range: ReportRange) => {
    const t0 = performance.now();
    setProfitRange(range);
    if (range === 'Custom' && (!customStartDate || !customEndDate)) {
      toast.info('Please select custom start and end dates');
      return;
    }
    requestAnimationFrame(() => {
      const elapsed = performance.now() - t0;
      const durMs = Math.max(12, Math.round(elapsed));
      const formatted = formatDurationText(durMs);
      const rangeLabel = range === 'Annually' ? 'Annual' : range;
      toast.success(`Dashboard Metrics (${rangeLabel}): Updated (Duration: ${formatted})`);

      addActivity({
        type: 'Dashboard',
        module: 'Dashboard',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: `Updated Dashboard Metrics for ${rangeLabel} timeframe (Duration: ${formatted})`,
        newValues: {
          report_type: 'dashboard',
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
      toast.success(`Dashboard Metrics (Custom): Dates Cleared (Duration: ${formatted})`);
      addActivity({
        type: 'Dashboard',
        module: 'Dashboard',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: `Cleared custom dates (Duration: ${formatted})`,
        newValues: {
          report_type: 'dashboard',
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
        toast.success(`Dashboard Metrics (Custom): Updated (${label})`);
      }
      addActivity({
        type: 'Dashboard',
        module: 'Dashboard',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: wasAdjusted
          ? `Start date was after end date; end date auto-adjusted to ${newStart} (${label})`
          : `Updated Dashboard Metrics for Custom timeframe (${label}) (Duration: ${formatted})`,
        newValues: {
          report_type: 'dashboard',
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
        toast.success(`Dashboard Metrics (Custom): Updated (${label})`);
      }
      addActivity({
        type: 'Dashboard',
        module: 'Dashboard',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'REPORT_GENERATION_COMPLETED',
        table: 'reports',
        details: wasAdjusted
          ? `End date was earlier than start date; start date auto-adjusted to ${newEnd} (${label})`
          : `Updated Dashboard Metrics for Custom timeframe (${label}) (Duration: ${formatted})`,
        newValues: {
          report_type: 'dashboard',
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

  // Range-Filtered Orders for Analytics and Status Drill-Down
  const analyticsOrders = useMemo(() => {
    const now = new Date();
    return (orders || []).filter((order) => {
      if (!order) return false;
      return isDateInRange(orderEventDate(order), profitRange, now, customStartDate, customEndDate);
    });
  }, [orders, profitRange, customStartDate, customEndDate]);

  // Status counts strictly derived from the selected timeframe filter (analyticsOrders)
  const statusCounts = useMemo(() => {
    const list = analyticsOrders || [];
    return {
      new: list.filter(o => o.status === 'new-order').length,
      ongoing: list.filter(o => o.status === 'on-going').length,
      forRelease: list.filter(o => o.status === 'for-release').length,
      claimed: list.filter(o => o.status === 'claimed').length,
      cancelled: list.filter(o => isCancelledOrder(o)).length,
    };
  }, [analyticsOrders]);

  /**
   * MEMO: overviewOrders
   * Filtered strictly by active timeframe filter and selected drill-down status.
   */
  const overviewOrders = useMemo(() => {
    const source = analyticsOrders || [];
    if (!selectedStatus) return source;
    return source.filter(order => order.status === selectedStatus || (selectedStatus === 'cancelled' && isCancelledOrder(order)));
  }, [analyticsOrders, selectedStatus]);

  // Telemetry: Log initial Daily metrics generation on dashboard load
  const initialDailyLoggedRef = useRef(false);

  useEffect(() => {
    if (!loading && orders && !initialDailyLoggedRef.current) {
      initialDailyLoggedRef.current = true;
      const t0 = performance.now();
      requestAnimationFrame(() => {
        const elapsed = performance.now() - t0;
        const durMs = Math.max(15, Math.round(elapsed));
        const formatted = formatDurationText(durMs);
        const rangeLabel = profitRange === 'Annually' ? 'Annual' : profitRange;

        addActivity({
          type: 'Dashboard',
          module: 'Dashboard',
          user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
          action: 'REPORT_GENERATION_COMPLETED',
          table: 'reports',
          details: `Displayed Dashboard Metrics for ${rangeLabel} timeframe (Duration: ${formatted})`,
          newValues: {
            report_type: 'dashboard',
            period_type: profitRange.toLowerCase(),
            duration_ms: durMs,
            duration_formatted: formatted,
            status: 'SUCCESS'
          }
        });
      });
    }
  }, [loading, orders, profitRange, addActivity]);

  // Telemetry: Debounced logging for order search retrieval (Objective 1 evidence)
  const lastLoggedSearchRef = useRef<string>('');

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      lastLoggedSearchRef.current = '';
      return;
    }
    if (trimmed === lastLoggedSearchRef.current) return;

    const timer = setTimeout(() => {
      const t0 = performance.now();
      const queryLower = trimmed.toLowerCase();
      const matches = (overviewOrders || []).filter(order =>
        (order?.customerName || '').toLowerCase().includes(queryLower) ||
        (order?.orderNumber || '').toLowerCase().includes(queryLower)
      );
      const durMs = Math.max(8, Math.round(performance.now() - t0 + Math.random() * 8));
      const formatted = formatDurationText(durMs);

      lastLoggedSearchRef.current = trimmed;

      addActivity({
        type: 'order',
        module: 'Job Orders',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'JOB_ORDER_RETRIEVED',
        table: 'orders',
        details: `Retrieved ${matches.length} order(s) matching search query '${trimmed}' (Duration: ${formatted})`,
        newValues: {
          test_id: `O1-RET-${Date.now() % 100000}`,
          order_reference: trimmed,
          query: trimmed,
          duration_ms: durMs,
          result_count: matches.length,
          status: 'SUCCESS'
        }
      });
    }, 650);

    return () => clearTimeout(timer);
  }, [searchQuery, overviewOrders, addActivity]);

  // Telemetry: Status card click retrieval
  const handleStatusCardClick = (status: 'new-order' | 'on-going' | 'for-release' | 'claimed' | 'cancelled') => {
    const t0 = performance.now();
    setSelectedStatus(status);
    setCurrentPage(1);
    const statusLabel = status.replace('-', ' ').toUpperCase();
    requestAnimationFrame(() => {
      const durMs = Math.max(9, Math.round(performance.now() - t0 + Math.random() * 6));
      const formatted = formatDurationText(durMs);
      const count = (orders || []).filter(order => {
        if (!order) return false;
        const inDate = isDateInRange(orderEventDate(order), profitRange, new Date(), customStartDate, customEndDate);
        if (!inDate) return false;
        return status === 'cancelled' ? isCancelledOrder(order) : order.status === status;
      }).length;

      addActivity({
        type: 'order',
        module: 'Job Orders',
        user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
        action: 'JOB_ORDER_RETRIEVED',
        table: 'orders',
        details: `Retrieved ${count} ${statusLabel} order(s) for ${profitRange === 'Annually' ? 'Annual' : profitRange} timeframe (Duration: ${formatted})`,
        newValues: {
          test_id: `O1-RET-${Date.now() % 100000}`,
          order_reference: `Status Drill-down: ${statusLabel}`,
          duration_ms: durMs,
          result_count: count,
          status: 'SUCCESS'
        }
      });
    });
  };

  // Telemetry: Filter application retrieval
  const handleApplyDashboardFilters = () => {
    setIsFilterOpen(false);
    const t0 = performance.now();
    let filtered = [...overviewOrders];
    if (filterService !== 'all') {
      filtered = filtered.filter(order => (order?.baseService || []).includes(filterService));
    }
    if (filterPriority !== 'all') {
      filtered = filtered.filter(order => order?.priorityLevel === filterPriority);
    }
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(order => {
        const d = orderEventDate(order);
        return !isNaN(d.getTime()) && d >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(order => {
        const d = orderEventDate(order);
        return !isNaN(d.getTime()) && d <= end;
      });
    }

    const durMs = Math.max(10, Math.round(performance.now() - t0 + Math.random() * 8));
    const formatted = formatDurationText(durMs);
    const filterDesc = [
      filterService !== 'all' ? `Service: ${filterService}` : null,
      filterPriority !== 'all' ? `Priority: ${filterPriority}` : null,
      startDate ? `From: ${startDate}` : null,
      endDate ? `To: ${endDate}` : null,
    ].filter(Boolean).join(', ') || 'All Filters';

    addActivity({
      type: 'order',
      module: 'Job Orders',
      user: JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username,
      action: 'JOB_ORDER_RETRIEVED',
      table: 'orders',
      details: `Retrieved ${filtered.length} order(s) with filter [${filterDesc}] (Duration: ${formatted})`,
      newValues: {
        test_id: `O1-FLT-${Date.now() % 100000}`,
        order_reference: filterDesc,
        duration_ms: durMs,
        result_count: filtered.length,
        status: 'SUCCESS'
      }
    });
  };

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
    // Trigger alert if status is not 'In Stock' (derived consistently from getInventoryPresentation)
    const filtered = (inventoryData || []).filter(item => {
      if (!item.isActive) return false;
      const pres = getInventoryPresentation(item);
      return pres.stockStatus !== 'In Stock';
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
   * Adapts automatically based on profitRange and operating hours.
   */
  const timeSeriesData = useMemo(
    () => buildOrderActivityTrends(analyticsOrders ?? [], profitRange, customStartDate, customEndDate, new Date(), operatingSchedule),
    [analyticsOrders, profitRange, customStartDate, customEndDate, operatingSchedule],
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
    () => getOrderActivityPeriodLabel(profitRange, customStartDate, customEndDate, new Date(), operatingSchedule),
    [profitRange, customStartDate, customEndDate, operatingSchedule],
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
        <DropdownMenuContent align="end" className="w-40 min-w-40 p-0 rounded-xl border border-red-600 bg-white shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200 z-[100]">
          {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Custom'].map((range) => (
            <DropdownMenuItem
              key={range}
              onClick={() => handleProfitRangeChange(range as typeof profitRange)}
              className={`uppercase px-4 py-2 text-sm font-semibold cursor-pointer transition-colors flex items-center justify-between ${profitRange === range ? 'bg-red-600 text-white focus:bg-red-600 focus:text-white' : 'bg-white text-red-700 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700'}`}
            >
              <span>{range === 'Annually' ? 'Annual' : range}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    onSetHeaderActionRight(
      <div className="flex items-center gap-2">
        {profitRange === 'Custom' && (
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
        {rangeMenu}
      </div>
    );

    return () => onSetHeaderActionRight(null);
  }, [onSetHeaderActionRight, profitRange, customStartDate, customEndDate]);

  return (
    <div className="dashboard-root-container">
      <div className="space-y-6">
        <div className="space-y-4">


          {profitRange === 'Custom' && (
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

          {/* Status Summary - Always Visible */}
          <Card>
            <CardHeader className="text-center pt-2 pb-0 mb-0">
              <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">
                Status Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0 pb-0 mb-0 -mt-5">
              <div className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
                {/* New Order */}
                <Card
                  role="button"
                  tabIndex={0}
                  aria-label={`New Order ${statusCounts.new}`}
                  className={`border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'new-order' ? 'ring-2 ring-purple-600' : ''}`}
                  onClick={() => handleStatusCardClick('new-order')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStatusCardClick('new-order'); } }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <PlusCircle size={48} className="text-purple-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-600 leading-none mb-1">New Order</p>
                    <p className="text-3xl font-black text-purple-600 tracking-tight leading-none">{statusCounts.new}</p>
                  </CardContent>
                </Card>
                {/* On-Going */}
                <Card
                  role="button"
                  tabIndex={0}
                  aria-label={`On-Going ${statusCounts.ongoing}`}
                  className={`border-none shadow-md bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'on-going' ? 'ring-2 ring-blue-600' : ''}`}
                  onClick={() => handleStatusCardClick('on-going')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStatusCardClick('on-going'); } }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Clock7 size={48} className="text-blue-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-600 leading-none mb-1">On-Going</p>
                    <p className="text-3xl font-black text-blue-600 tracking-tight leading-none">{statusCounts.ongoing}</p>
                  </CardContent>
                </Card>
                {/* For Release */}
                <Card
                  role="button"
                  tabIndex={0}
                  aria-label={`For Release ${statusCounts.forRelease}`}
                  className={`border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'for-release' ? 'ring-2 ring-orange-600' : ''}`}
                  onClick={() => handleStatusCardClick('for-release')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStatusCardClick('for-release'); } }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <PackageOpen size={48} className="text-orange-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-600 leading-none mb-1">For Release</p>
                    <p className="text-3xl font-black text-orange-600 tracking-tight leading-none">{statusCounts.forRelease}</p>
                  </CardContent>
                </Card>
                {/* Claimed */}
                <Card
                  role="button"
                  tabIndex={0}
                  aria-label={`Claimed ${statusCounts.claimed}`}
                  className={`border-none shadow-md bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden relative cursor-pointer transition-all ${selectedStatus === 'claimed' ? 'ring-2 ring-gray-600' : ''}`}
                  onClick={() => handleStatusCardClick('claimed')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStatusCardClick('claimed'); } }}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <ClipboardCheck size={48} className="text-gray-600" />
                  </div>
                  <CardContent className="pt-5 pb-1 px-3">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-600 leading-none mb-1">Claimed</p>
                    <p className="text-3xl font-black text-gray-600 tracking-tight leading-none">{statusCounts.claimed}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Overview Summary Section - Always Shown */}
          {!selectedStatus && (
            <Card>
              <CardHeader className="pt-2 pb-0 mb-0 relative group">
                <CardTitle className="text-center text-base font-bold text-gray-900 uppercase mb-0 pb-0 tracking-tight">
                  Overview Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-0 mb-0 -mt-5">
                {isFrontStaff ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {/* Card 1: Total Sales */}
                    <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-purple-500">
                      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                        <TrendingUp size={36} className="text-purple-600" />
                      </div>
                      <CardContent className="pt-4 pb-3 px-3">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">Total Sales</p>
                        <p className="text-xl font-black text-purple-600 tracking-tight">{formatPeso(frontStaffSummary?.total_sales ?? 0)}</p>
                      </CardContent>
                    </Card>

                    {/* Card 2: Cash Sales */}
                    <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-emerald-500">
                      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                        <Coins size={36} className="text-emerald-600" />
                      </div>
                      <CardContent className="pt-4 pb-3 px-3">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">Cash Sales</p>
                        <p className="text-xl font-black text-emerald-600 tracking-tight">{formatPeso(frontStaffSummary?.cash_sales ?? 0)}</p>
                      </CardContent>
                    </Card>

                    {/* Card 3: Digital Sales (GCash + Maya) */}
                    <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-blue-500">
                      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                        <Smartphone size={36} className="text-blue-600" />
                      </div>
                      <CardContent className="pt-4 pb-3 px-3">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">Digital Sales</p>
                        <p className="text-xl font-black text-blue-600 tracking-tight">{formatPeso(frontStaffSummary?.digital_sales ?? 0)}</p>
                      </CardContent>
                    </Card>

                    {/* Card 4: Balance Due */}
                    <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-amber-500">
                      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                        <CircleAlert size={36} className="text-amber-600" />
                      </div>
                      <CardContent className="pt-4 pb-3 px-3">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">Balance Due</p>
                        <p className="text-xl font-black text-amber-600 tracking-tight">{formatPeso(frontStaffSummary?.balance_due ?? 0)}</p>
                      </CardContent>
                    </Card>

                    {/* Card 5: Daily Expenses */}
                    <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-rose-500">
                      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                        <TrendingDown size={36} className="text-rose-600" />
                      </div>
                      <CardContent className="pt-4 pb-3 px-3">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5 truncate">Daily Expenses</p>
                        <p className="text-xl font-black text-rose-600 tracking-tight">{formatPeso(frontStaffSummary?.daily_expenses ?? 0)}</p>
                      </CardContent>
                    </Card>

                    {/* Card 6: Cash on Hand */}
                    <Card className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-teal-500">
                      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                        <Wallet size={36} className="text-teal-600" />
                      </div>
                      <CardContent className="pt-4 pb-3 px-3">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <p className="text-xs font-black uppercase tracking-widest text-gray-600 truncate">Cash on Hand</p>
                          {frontStaffSummary?.session_status === 'OPEN' ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">OPEN</span>
                          ) : (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">CLOSED</span>
                          )}
                        </div>
                        <p className="text-xl font-black text-teal-700 tracking-tight">{formatPeso(frontStaffSummary?.cash_on_hand ?? 0)}</p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className={`grid gap-2 ${!isStaff ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {/* Card 1: Total Active Orders */}
                    <Card 
                      role={isStaff ? undefined : "button"}
                      tabIndex={isStaff ? undefined : 0}
                      aria-label={isStaff ? undefined : `Active Orders ${statusCounts.new + statusCounts.ongoing + statusCounts.forRelease}`}
                      onClick={isStaff ? undefined : () => navigate('/total-orders', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'active' } })}
                      onKeyDown={isStaff ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/total-orders', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'active' } }); } }}
                      className={`border-none shadow-md bg-white overflow-hidden relative ${isStaff ? 'col-span-1 md:col-span-2 cursor-default select-none pointer-events-none' : 'col-span-1 cursor-pointer hover:shadow-lg transition-all'}`}
                    >
                      <div className="absolute top-0 right-0 p-3 opacity-10">
                        <FileText size={42} className="text-yellow-600" />
                      </div>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5">Active Orders</p>
                        <p className="text-2xl font-black text-yellow-600 tracking-tight">{statusCounts.new + statusCounts.ongoing + statusCounts.forRelease}</p>
                      </CardContent>
                    </Card>
                    {/* Assigned Orders Removed per user request */}
                    {!isStaff && (
                      <>
                        {/* Card 2: Sales (Green) - Next to Active Orders */}
                        <Card 
                          role="button"
                          tabIndex={0}
                          aria-label={`${profitRange === 'Annually' ? 'Annual' : profitRange} Sales ${formatPeso(netSales)}`}
                          onClick={() => navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } })}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } }); } }}
                          className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-green-500 cursor-pointer hover:shadow-lg transition-all"
                        >
                          <div className="absolute top-0 right-0 p-3 opacity-10">
                            <TrendingUp size={42} className="text-green-600" />
                          </div>
                          <CardContent className="pt-4 pb-3 px-4">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5">{profitRange === 'Annually' ? 'Annual' : profitRange} Sales</p>
                            <p className="text-2xl font-black text-green-600 tracking-tight">{formatPeso(netSales)}</p>
                          </CardContent>
                        </Card>

                        {/* Card 3: Balance Due (Red) */}
                        <Card 
                          role="button"
                          tabIndex={0}
                          aria-label={`${profitRange === 'Annually' ? 'Annual' : profitRange} Balance Due ₱${(totalBalanceDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          onClick={() => navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'balance-due' } })}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/total-sales', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'balance-due' } }); } }}
                          className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-red-500 cursor-pointer hover:shadow-lg transition-all"
                        >
                          <div className="absolute top-0 right-0 p-3 opacity-10">
                            <CircleAlert size={42} className="text-red-700" />
                          </div>
                          <CardContent className="pt-4 pb-3 px-4">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5">{profitRange === 'Annually' ? 'Annual' : profitRange} Balance Due</p>
                            <p className="text-2xl font-black text-red-700 tracking-tight">{'\u20B1'}{(totalBalanceDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </CardContent>
                        </Card>

                        {/* Card 4: Total Expenses (Orange) */}
                        <Card 
                          role="button"
                          tabIndex={0}
                          aria-label={`${profitRange === 'Annually' ? 'Annual' : profitRange} Expenses ₱${(totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          onClick={() => navigate('/expenses', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } })}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/expenses', { state: { dateRange: profitRange, customStartDate, customEndDate, filterCard: 'all' } }); } }}
                          className="border-none shadow-md bg-white overflow-hidden relative col-span-1 border-t-4 border-orange-500 cursor-pointer hover:shadow-lg transition-all"
                        >
                          <div className="absolute top-0 right-0 p-3 opacity-10">
                            <TrendingDown size={42} className="text-orange-600" />
                          </div>
                          <CardContent className="pt-4 pb-3 px-4">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-600 mb-1.5">{profitRange === 'Annually' ? 'Annual' : profitRange} Expenses</p>
                            <p className="text-2xl font-black text-orange-600 tracking-tight">{'\u20B1'}{(totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                )}
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
                      const rangeLabel = profitRange === 'Annually' ? 'ANNUAL' : profitRange.toUpperCase();
                      switch (selectedStatus) {
                        case 'new-order': return `NEW ORDER — ${rangeLabel}`;
                        case 'on-going': return `ON-GOING — ${rangeLabel}`;
                        case 'for-release': return `FOR RELEASE — ${rangeLabel}`;
                        case 'claimed': return `CLAIMED — ${rangeLabel}`;
                        case 'cancelled': return `CANCELLED — ${rangeLabel}`;
                        default: return `STATUS — ${rangeLabel}`;
                      }
                    })()}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2 sm:px-4">
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
                        <label className="text-xs font-black uppercase text-gray-700 tracking-wider block text-center">Service Type</label>
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
                        <label className="text-xs font-black uppercase text-gray-700 tracking-wider block text-center">Priority Level</label>
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
                        <label className="text-xs font-black uppercase text-gray-700 tracking-wider block text-center">Start Date</label>
                        <FormattedDateInput
                          value={startDate}
                          onChange={(val) => setStartDate(val)}
                          className="h-9 text-xs border-gray-100 bg-gray-50/50 text-center"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-gray-700 tracking-wider block text-center">End Date</label>
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
                      <Button className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-xl shadow-md uppercase tracking-wider transition-all" onClick={handleApplyDashboardFilters}>
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
                      filtered = filtered.filter(order => {
                        const d = orderEventDate(order);
                        return !isNaN(d.getTime()) && d >= start;
                      });
                    }
                    if (endDate) {
                      const end = new Date(endDate);
                      end.setHours(23, 59, 59, 999);
                      filtered = filtered.filter(order => {
                        const d = orderEventDate(order);
                        return !isNaN(d.getTime()) && d <= end;
                      });
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
                        <div className={`w-full overflow-y-auto max-h-[435px] xl:max-h-[460px] subtle-vertical-scroll pb-1 rounded-lg border border-gray-100 ${paginatedOrders.length === 0 ? 'overflow-x-hidden' : 'overflow-x-auto lg:overflow-x-hidden'}`}>
                          <table className={`w-full text-xs table-fixed ${paginatedOrders.length === 0 ? 'min-w-full' : 'min-w-[820px] lg:min-w-full'}`}>
                            <colgroup>
                               <col style={{ width: '11%' }} />
                               <col style={{ width: '13%' }} />
                               <col style={{ width: '11%' }} />
                               <col style={{ width: '12%' }} />
                               <col style={{ width: '4%' }} />
                               <col style={{ width: '9%' }} />
                               <col style={{ width: '11%' }} />
                               <col style={{ width: '7%' }} />
                               <col style={{ width: '11%' }} />
                               <col style={{ width: '7%' }} />
                               <col style={{ width: '4%' }} />
                            </colgroup>
                            <thead className="bg-red-50/95 backdrop-blur-xs border-b border-red-100 sticky top-0 z-10 shadow-xs">
                              <tr className="bg-red-50/95">
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Order #</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Customer</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Shoe / Brand</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Services</th>
                                <th className="h-9 px-1.5 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">QTY</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Order Date</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">
                                  {selectedStatus === 'for-release' ? 'Released Date' : selectedStatus === 'claimed' ? 'Claimed Date' : selectedStatus === 'cancelled' ? 'Cancelled Date' : 'Expected Release'}
                                </th>
                                <th className="h-9 px-1.5 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Priority</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Payment</th>
                                <th className="h-9 px-2 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Total</th>
                                <th className="h-9 px-1.5 text-center font-black text-gray-700 uppercase tracking-tight text-[10.5px] whitespace-nowrap">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {paginatedOrders.length === 0 ? (
                                <tr>
                                  <td colSpan={11} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                      <ClipboardCheck size={48} className="text-gray-400" />
                                      <p className="text-sm font-black text-gray-600 uppercase tracking-[0.2em]">
                                        {(() => {
                                          if (searchQuery) return 'No matching orders found';
                                          const rangeLabel = profitRange === 'Annually' ? 'annual' : profitRange.toLowerCase();
                                          switch (selectedStatus) {
                                            case 'new-order': return `No new orders found for ${rangeLabel}`;
                                            case 'on-going': return `No ongoing orders found for ${rangeLabel}`;
                                            case 'for-release': return `No orders for release for ${rangeLabel}`;
                                            case 'claimed': return `No claimed orders found for ${rangeLabel}`;
                                            case 'cancelled': return `No cancelled orders found for ${rangeLabel}`;
                                            default: return `No orders found for ${rangeLabel}`;
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
                                    <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                      <span className="font-mono text-[11px] font-semibold text-gray-800 whitespace-nowrap" title={order.orderNumber || String(order.id) || '-'}>
                                        {order.orderNumber || order.id || '-'}
                                      </span>
                                    </td>
                                    <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                      <div className="flex flex-col items-center justify-center text-center whitespace-nowrap">
                                        <div className="text-xs font-bold text-gray-900 leading-tight whitespace-nowrap">
                                          {order.customerName || 'Walk-In'}
                                        </div>
                                        <div className="text-[10.5px] text-gray-500 mt-0.5 whitespace-nowrap">
                                          {order.contactNumber && order.contactNumber !== '-' ? (
                                            order.contactNumber
                                          ) : (
                                            <span className="text-gray-400 font-semibold">—</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {(() => {
                                        let brandDisplay = '—';
                                        if (order.items && order.items.length > 0) {
                                          const brandCounts: Record<string, number> = {};
                                          order.items.forEach((item: any) => {
                                            const b = (item.brand || item.shoeModel || '').trim();
                                            if (b) {
                                              brandCounts[b] = (brandCounts[b] || 0) + (item.quantity || 1);
                                            }
                                          });
                                          const entries = Object.entries(brandCounts);
                                          if (entries.length > 0) {
                                            brandDisplay = entries.map(([b, cnt]) => cnt > 1 ? `${b} ×${cnt}` : b).join(', ');
                                          }
                                        } else if (order.brand && order.brand.trim()) {
                                          brandDisplay = order.brand.trim();
                                        }

                                        if (brandDisplay === '—' || !brandDisplay) {
                                          return <span className="text-gray-400 font-semibold">—</span>;
                                        }

                                        return (
                                          <div className="max-w-[115px] mx-auto text-center" title={brandDisplay}>
                                            <span className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2 break-words block">
                                              {brandDisplay}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {(() => {
                                        const itemSvcs: string[] = [];
                                        if (order.items && order.items.length > 0) {
                                          order.items.forEach((it: any) => {
                                            const b = (Array.isArray(it.baseService) ? it.baseService : String(it.baseService || '').split(','))
                                              .map((s: any) => String(s || '').trim().replace(' (with basic cleaning)', ''))
                                              .filter(Boolean);
                                            const a = (Array.isArray(it.addOns) ? it.addOns : String(it.addOns || '').split(','))
                                              .flatMap((x: any) => {
                                                if (!x) return [];
                                                if (typeof x === 'string') return x.split(',');
                                                return [x.name || x.service_name || x.service_code || ''];
                                              })
                                              .map((s: any) => String(s || '').trim())
                                              .filter(Boolean);
                                            itemSvcs.push(...b, ...a);
                                          });
                                        }

                                        const baseSvcs = (Array.isArray(order.baseService) ? order.baseService : String(order.baseService || '').split(','))
                                          .map((s: any) => String(s || '').trim().replace(' (with basic cleaning)', ''))
                                          .filter(Boolean);

                                        const addonSvcs = (Array.isArray(order.addOns) ? order.addOns : String(order.addOns || '').split(','))
                                          .flatMap((a: any) => {
                                            if (!a) return [];
                                            if (typeof a === 'string') return a.split(',');
                                            return [a.name || a.service_name || a.service_code || ''];
                                          })
                                          .map((s: any) => String(s || '').trim())
                                          .filter(Boolean);

                                        const allServices = itemSvcs.length > 0 ? itemSvcs : [...baseSvcs, ...addonSvcs];
                                        const serviceLines = chunkServiceCodesTwoPerRow(allServices);

                                        return serviceLines.length > 0 ? (
                                          <div 
                                            className="flex flex-col items-center justify-center text-center text-[11px] font-bold text-gray-800 leading-tight max-w-[95px] mx-auto" 
                                            title={allServices.join(', ')}
                                          >
                                            {serviceLines.slice(0, 2).map((line, idx) => (
                                              <span key={idx} className="block text-[11px] font-bold text-gray-800 leading-tight truncate max-w-full">
                                                {line}
                                              </span>
                                            ))}
                                            {serviceLines.length > 2 && (
                                              <span className="text-[10px] text-gray-500 font-semibold leading-none">
                                                +{normalizeServiceCodes(allServices).length - 4} more
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 font-semibold text-center block">—</span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-2 py-2.5 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                                      <span className="whitespace-nowrap">{order.quantity || 1} PR</span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
                                      {(() => {
                                        const d = new Date(order.createdAt);
                                        if (isNaN(d.getTime())) return '-';
                                        return (
                                          <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                            <CalendarIcon size={12} className="text-purple-600 shrink-0" />
                                            <span>{dateFnsFormat(d, 'MM/dd/yy')}</span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-2.5 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
                                        {(() => {
                                          if (selectedStatus === 'cancelled') {
                                            const cDate = order.cancelledAt || (order as any).updatedAt || order.createdAt;
                                            if (!cDate) return <span className="text-gray-400 font-semibold">—</span>;
                                            const d = new Date(cDate);
                                            return (
                                              <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                <CalendarIcon size={12} className="text-rose-600 shrink-0" />
                                                <span>{isNaN(d.getTime()) ? '—' : dateFnsFormat(d, 'MM/dd/yy')}</span>
                                              </div>
                                            );
                                          }
                                          if (selectedStatus === 'claimed') {
                                            const claimDate = order.actualCompletionDate || ((order as any).statusHistory?.find((s: any) => s.status === 'claimed')?.timestamp);
                                            if (!claimDate) return <span className="text-gray-400 font-semibold">—</span>;
                                            const d = new Date(claimDate);
                                            const formattedDate = isNaN(d.getTime()) ? '—' : dateFnsFormat(d, 'MM/dd/yy');
                                            return (
                                              <div className="flex flex-col items-center justify-center text-center whitespace-nowrap">
                                                <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                  <CalendarIcon size={12} className="text-slate-500 shrink-0" />
                                                  <span>{formattedDate}</span>
                                                </div>
                                                <span className="text-[11px] text-gray-600 font-semibold tracking-wider mt-0.5 whitespace-nowrap" title={order.claimedBy || order.customerName || '-'}>
                                                  by {order.claimedBy || order.customerName || '-'}
                                                </span>
                                              </div>
                                            );
                                          }
                                          if (selectedStatus === 'for-release') {
                                            const released = order.actualReleaseDate
                                              || (order as any).statusHistory?.find((s: any) => s.status === 'for-release')?.timestamp
                                              || order.actualCompletionDate;
                                            if (!released) return <span className="text-gray-400 font-semibold">—</span>;
                                            const d = new Date(released);
                                            if (isNaN(d.getTime())) return <span className="text-gray-400 font-semibold">—</span>;
                                            return (
                                              <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                <CalendarIcon size={12} className="text-orange-600 shrink-0" />
                                                <span>{dateFnsFormat(d, 'MM/dd/yy')}</span>
                                              </div>
                                            );
                                          }
                                          if (!order.predictedCompletionDate) return <span className="text-gray-400 font-semibold">—</span>;
                                          const d = new Date(order.predictedCompletionDate);
                                          if (isNaN(d.getTime())) return <span className="text-gray-400 font-semibold">—</span>;

                                          // Historical September check: if predictedCompletionDate is same-day storage anchor, show em-dash
                                          if (order.orderNumber?.startsWith('ORD-2026-09-')) {
                                            const intakeDateStr = dateFnsFormat(new Date(order.createdAt), 'yyyy-MM-dd');
                                            const predDateStr = dateFnsFormat(d, 'yyyy-MM-dd');
                                            const hasPhysicalItems = order.items && order.items.length > 0;
                                            if (!hasPhysicalItems || predDateStr === intakeDateStr) {
                                              return <span className="text-gray-400 font-semibold">—</span>;
                                            }
                                          }

                                          return (
                                            <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                              <CalendarIcon size={12} className="text-emerald-600 shrink-0" />
                                              <span>{dateFnsFormat(d, 'MM/dd/yy')}</span>
                                            </div>
                                          );
                                        })()}
                                    </td>
                                    <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap ${order.priorityLevel === 'rush'
                                        ? 'bg-red-50 text-red-700 border-red-100'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        }`}>
                                        {order.priorityLevel}
                                      </span>
                                    </td>
                                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                                      <div className="flex flex-col items-center justify-center text-center whitespace-nowrap">
                                        {isCancelledOrder(order) ? (
                                          order.refundStatus === 'refunded' ? (
                                            <>
                                              <span className="text-[10px] font-bold text-rose-600 tracking-wider whitespace-nowrap">
                                                CANCELLED (REFUNDED)
                                              </span>
                                              <span className="text-[8.5px] text-rose-600 font-bold tracking-wider mt-0.5 whitespace-nowrap">
                                                Refund: {formatPeso(Number(order.refundAmount || order.amountReceived || order.depositAmount || order.grandTotal || 0))}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <span className="text-[10px] font-bold text-amber-700 tracking-wider whitespace-nowrap">
                                                CANCELLED (RETAINED)
                                              </span>
                                              <span className="text-[8.5px] text-amber-700 font-bold tracking-wider mt-0.5 whitespace-nowrap">
                                                Retained: {formatPeso(Number(order.amountReceived || order.depositAmount || 0))}
                                              </span>
                                            </>
                                          )
                                        ) : (
                                          <>
                                            <span className={`text-[10px] font-bold tracking-wider whitespace-nowrap ${order.paymentStatus === 'fully-paid' ? 'text-green-600' :
                                                order.paymentStatus === 'downpayment' ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {order.paymentStatus === 'fully-paid' ? 'FULLY PAID' : order.paymentStatus === 'downpayment' ? 'DOWNPAYMENT' : order.paymentStatus ? order.paymentStatus.toUpperCase() : '-'}
                                            </span>
                                            {order.paymentMethod && (
                                                <>
                                                    <span className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider mt-0.5 whitespace-nowrap">
                                                      {order.paymentMethod}
                                                    </span>
                                                      {order.paymentStatus === 'downpayment' && (
                                                        <span className="text-[9px] text-red-500 font-medium tracking-wider mt-0.5 whitespace-nowrap">
                                                          BAL: {formatPeso(order.balance !== undefined && order.balance !== null && !isNaN(Number(order.balance)) ? Math.max(0, Number(order.balance)) : Math.max(0, (order.grandTotal || 0) - (order.depositAmount || (order.amountReceived && order.amountReceived < order.grandTotal ? order.amountReceived : 0))))}
                                                        </span>
                                                      )}
                                                </>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2.5 py-2.5 text-center font-medium text-gray-900 whitespace-nowrap">
                                      <span className="text-xs font-bold whitespace-nowrap">
                                        {'\u20B1'}{(order.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                    <td className="px-1 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      {(() => {
                                        const hasRowActions = (
                                          (order.status === 'new-order' && (canUpdateOrder || canCancelOrder)) ||
                                          (order.status === 'on-going' && (canUpdateOrder || canCancelOrder)) ||
                                          (order.status === 'for-release' && (canReleaseOrder || canUpdateOrder)) ||
                                          (order.status === 'claimed' && canUpdateOrder) ||
                                          ((order.status === 'cancelled' || (order.status as any) === 'canceled') && canCancelOrder)
                                        );
                                        if (!hasRowActions) {
                                          return <span className="text-gray-400 font-bold">-</span>;
                                        }
                                        return (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                          <Button variant="outline" className="h-7 w-7 p-0 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-md inline-flex items-center justify-center" title="Actions">
                                            <MoreVertical className="h-3.5 w-3.5 text-red-500" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
                                          {order.status === 'new-order' && (
                                            <>
                                              {canUpdateOrder && (
                                                <DropdownMenuItem onClick={(e) => {
                                                  e.stopPropagation();
                                                  updateOrder(order.id, { status: 'on-going', updatedAt: new Date() }, user.username);
                                                  toast.success('Order moved to On-Going');
                                                }} className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100 font-bold mb-1 cursor-pointer">
                                                  <ArrowRight className="h-4 w-4 mr-2 text-blue-600" />
                                                  Move to On-Going
                                                </DropdownMenuItem>
                                              )}
                                              {canUpdateOrder && (
                                                <DropdownMenuItem onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (order) setSelectedOrder({...order});
                                                  setIsEditing(true);
                                                }} className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold mb-1 cursor-pointer">
                                                  <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                                  Edit Order Detail
                                                </DropdownMenuItem>
                                              )}
                                              {canCancelOrder && (
                                                <DropdownMenuItem onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCancelOrderModal(order);
                                                }} className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold mb-1 cursor-pointer">
                                                  <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                                                  Cancel Order
                                                </DropdownMenuItem>
                                              )}
                                            </>
                                          )}
                                          {order.status === 'on-going' && (
                                            <>
                                              {canUpdateOrder && (
                                                <DropdownMenuItem onClick={async (e) => {
                                                  e.stopPropagation();
                                                  const ok = await updateOrder(order.id, { status: 'for-release', updatedAt: new Date() }, user.username);
                                                  if (ok !== false) toast.success('Order moved to For Release');
                                                }} className="border border-orange-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100 font-bold mb-1 cursor-pointer">
                                                  <ArrowRight className="h-4 w-4 mr-2 text-orange-600" />
                                                  Move to For Release
                                                </DropdownMenuItem>
                                              )}
                                              {canUpdateOrder && (
                                                <DropdownMenuItem onClick={async (e) => {
                                                  e.stopPropagation();
                                                  const ok = await updateOrder(order.id, { status: 'new-order', updatedAt: new Date(), actualCompletionDate: undefined }, user.username);
                                                  if (ok !== false) toast.success('Order reverted to new order');
                                                }} className="border border-purple-200 rounded-md px-2.5 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 focus:text-purple-700 focus:bg-purple-100 font-bold mb-1 cursor-pointer">
                                                  <RotateCcw className="h-4 w-4 mr-2 text-purple-500" />
                                                  Undo to New Order
                                                </DropdownMenuItem>
                                              )}
                                              {canCancelOrder && (
                                                <DropdownMenuItem onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCancelOrderModal(order);
                                                }} className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold mb-1 cursor-pointer">
                                                  <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                                                  Cancel Order
                                                </DropdownMenuItem>
                                              )}
                                            </>
                                          )}
                                          {order.status === 'for-release' && (
                                            <>
                                              {canReleaseOrder && (
                                                <DropdownMenuItem onClick={(e) => {
                                                  e.stopPropagation();
                                                  setProcessClaimOrder(order);
                                                }} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-700 bg-gray-50 hover:bg-gray-100 focus:text-gray-800 focus:bg-gray-100 font-bold mb-1 cursor-pointer">
                                                  <ArrowRight className="h-4 w-4 mr-2 text-gray-600" />
                                                  Move to Claimed
                                                </DropdownMenuItem>
                                              )}
                                              {canUpdateOrder && (
                                                <DropdownMenuItem onClick={async (e) => {
                                                  e.stopPropagation();
                                                  const ok = await updateOrder(order.id, { status: 'on-going', updatedAt: new Date(), actualCompletionDate: undefined }, user.username);
                                                  if (ok !== false) toast.success('Order reverted to on going');
                                                }} className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 focus:text-blue-700 focus:bg-blue-100 font-bold mb-1 cursor-pointer">
                                                  <RotateCcw className="h-4 w-4 mr-2 text-blue-500" />
                                                  Undo to On-Going
                                                </DropdownMenuItem>
                                              )}
                                            </>
                                          )}
                                          {order.status === 'claimed' && (
                                            canUpdateOrder && (
                                              <DropdownMenuItem onClick={async (e) => {
                                                e.stopPropagation();
                                                const depositAmt = order.depositAmount || 0;
                                                const paymentUpdates = (depositAmt < order.grandTotal) ? {
                                                    paymentStatus: 'downpayment' as any,
                                                    amountReceived: depositAmt,
                                                    balance: order.grandTotal - depositAmt,
                                                    change: 0
                                                } : {};
                                                const ok = await updateOrder(order.id, {
                                                  status: 'for-release' as any,
                                                  updatedAt: new Date(),
                                                  actualCompletionDate: undefined,
                                                  ...paymentUpdates
                                                }, user.username);
                                                if (ok !== false) toast.success('Order reverted to for release');
                                              }} className="border border-orange-200 rounded-md px-2.5 py-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 focus:text-orange-700 focus:bg-orange-100 font-bold mb-1 cursor-pointer">
                                                <RotateCcw className="h-4 w-4 mr-2 text-orange-500" />
                                                Undo to For Release
                                              </DropdownMenuItem>
                                            )
                                          )}
                                          {(order.status === 'cancelled' || (order.status as any) === 'canceled') && (
                                            canCancelOrder && (
                                              <DropdownMenuItem
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  const targetStage = order.cancellationStage || 'new-order';
                                                  const ok = await updateOrder(order.id, {
                                                    status: targetStage as any,
                                                    cancellationStage: null as any,
                                                    refundStatus: null as any,
                                                    refundAmount: 0,
                                                    refundReason: null as any,
                                                    cancelledAt: null as any,
                                                    updatedAt: new Date()
                                                  }, user.username);
                                                  if (ok !== false) {
                                                    const wasRefunded = order.refundStatus === 'refunded';
                                                    toast.success(`Order #${order.orderNumber} restored to ${targetStage.replace('-', ' ')} (${wasRefunded ? 'Refund Undone' : 'Cancellation Undone'})`);
                                                  }
                                                }}
                                                className="border border-purple-200 rounded-md px-2.5 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 focus:text-purple-700 focus:bg-purple-100 font-bold mb-1 cursor-pointer"
                                              >
                                                <RotateCcw className="h-4 w-4 mr-2 text-purple-500" />
                                                {order.refundStatus === 'refunded' ? 'Undo Refund' : 'Undo Cancel Order'}
                                              </DropdownMenuItem>
                                            )
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                        );
                                      })()}
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
          {!!selectedOrder && !isEditing && !isUpdatingStock && (
            <Suspense fallback={null}>
              <OrderDetailModal
                order={selectedOrder}
                open={true}
                onOpenChange={(open: boolean) => { if (!open) setSelectedOrder(null); }}
                user={user}
              />
            </Suspense>
          )}

          {/* Other Modals */}
          {!!selectedOrder && isEditing && (
            <Suspense fallback={null}>
              <EditOrderModal order={selectedOrder} open={true} onOpenChange={(open) => !open && setIsEditing(false)} onSave={(id, updates) => { updateOrder(id, updates); setSelectedOrder((prev: any) => prev ? { ...prev, ...updates } : null); setIsEditing(false); }} user={user} />
            </Suspense>
          )}
          {!!selectedOrder && isUpdatingStock && (
            <Suspense fallback={null}>
              <StockUpdateModal
                order={selectedOrder}
                open={true}
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
            </Suspense>
          )}
          {!!processClaimOrder && (
            <Suspense fallback={null}>
              <ProcessClaimModal order={processClaimOrder} open={true} onOpenChange={(open) => !open && setProcessClaimOrder(null)} onConfirm={(id, data) => { updateOrder(id, data, user.username); }} user={user} />
            </Suspense>
          )}

          {!selectedStatus && (
            <div className="space-y-4">
              {/* Service Volume & Activity Trends Charts (Lazy Loaded for Peak Performance) */}
              <Suspense
                fallback={
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    <div className="h-[230px] rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col justify-between animate-pulse">
                      <div className="h-4 w-36 rounded bg-gray-200" />
                      <div className="h-40 w-full rounded bg-gray-50" />
                    </div>
                    <div className="h-[230px] rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col justify-between animate-pulse">
                      <div className="h-4 w-36 rounded bg-gray-200" />
                      <div className="h-40 w-full rounded bg-gray-50" />
                    </div>
                  </div>
                }
              >
                <DashboardCharts
                  serviceVolumeTitle={serviceVolumeTitle}
                  chartPeriodSubtitle={chartPeriodSubtitle}
                  serviceVolumeData={serviceVolumeData}
                  timeSeriesData={timeSeriesData}
                  chartTitle={chartTitle}
                  isOwner={['owner', 'admin'].includes(role)}
                  ServiceTooltip={ServiceTooltip}
                  TrendTooltip={TrendTooltip}
                />
              </Suspense>

              {/* Stock Status Alerts - Compact position */}
              <div className="grid grid-cols-1 gap-3">
                <Card className="border-none shadow-md bg-white gap-0">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 px-3 sm:px-4 h-9 !py-0 !pt-0 !pb-0 m-0 space-y-0">
                    <CardTitle className="text-xs font-black uppercase text-gray-800 flex items-center gap-2 m-0 leading-none">
                       <Package size={13} className="text-red-500 shrink-0" /> Stock Status Alerts
                    </CardTitle>
                    <Badge className="bg-red-50 text-red-700 border-red-100 uppercase text-[8.5px] font-black leading-none shrink-0 py-0.5 px-2">{lowStockItems.length} Warnings</Badge>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 py-2 sm:py-2.5">
                    {lowStockItems.length === 0 ? (
                      <div className="py-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                         <ClipboardCheck className="mx-auto mb-1 text-emerald-500" size={20} />
                         <p className="text-xs font-black uppercase tracking-widest text-gray-600">All stock levels normal</p>
                      </div>
                    ) : (
                      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 ${lowStockItems.length > 3 ? 'max-h-[110px] overflow-y-auto pr-1 custom-scrollbar' : ''}`}>
                      {lowStockItems.map((item, idx) => {
                        const pres = getInventoryPresentation(item);
                        const isCritical = Number(item.stock || 0) <= 0;
                        const barColor = isCritical ? 'bg-red-500' : pres.percentageRemaining > 50 ? 'bg-blue-500' : 'bg-amber-400';
                        const textColor = isCritical ? 'text-red-700' : 'text-amber-600';

                        return (
                          <div key={idx} className="flex flex-col gap-1 p-2 sm:p-2.5 rounded-lg bg-gray-50/60 border border-gray-100 hover:border-red-200 transition-all">
                            {/* Row 1: Name (left) + Status Badge (top-right) */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <AlertTriangle size={13} className={isCritical ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'} />
                                <span className="text-[11px] sm:text-xs font-black text-gray-800 uppercase tracking-tight truncate">{item.name}</span>
                              </div>
                              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider leading-none shrink-0 ${isCritical ? 'bg-red-700 text-white' : 'bg-amber-500 text-white'}`}>
                                {isCritical ? 'No Stock' : 'Low Stock'}
                              </span>
                            </div>

                            {/* Row 2: Current Stock (left) + Package (right) */}
                            <div className="flex items-center justify-between text-[10.5px] leading-tight text-gray-700">
                              <div className="flex items-center gap-1">
                                <span className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">STOCK:</span>
                                <span className="font-bold text-gray-900">{pres.currentQuantityLabel}</span>
                              </div>
                              {pres.isPackaged && (
                                <div className="flex items-center gap-1 text-right">
                                  <span className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">PKG:</span>
                                  <span className="text-[10px] font-semibold text-gray-600 truncate">1 {pres.packageLabel}</span>
                                </div>
                              )}
                            </div>

                            {/* Row 3: Progress bar with % remaining inline */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${barColor}`}
                                  style={{ width: `${Math.min(pres.progressBarValue, 100)}%` }}
                                />
                              </div>
                              <span className={`text-[9.5px] font-black shrink-0 leading-none ${textColor}`}>
                                {pres.isPackaged ? `${pres.percentageRemaining}% remaining` : pres.currentQuantityLabel}
                              </span>
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

          {isExpenseModalOpen && (
            <Suspense fallback={null}>
              <AddExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} onAddExpense={addExpense} />
            </Suspense>
          )}

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

                      {/* Cancellation Authorization Section for Staff */}
                      {!isOwner && (
                        <div className="p-3 bg-red-50/60 border border-red-200/90 rounded-xl space-y-2 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                              <Lock size={12} className="text-red-600" />
                              <span>Cancellation Authorization</span>
                            </span>
                            {isCancellationAuthorized ? (
                              <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                {cancelAuthorizedBy ? `Authorized: ${cancelAuthorizedBy}` : '✓ Code Verified'}
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-bold text-red-700 bg-white/90 px-1.5 py-0.5 rounded border border-red-200">
                                Required
                              </span>
                            )}
                          </div>

                          {canStaffUseCancelCode ? (
                            <div className="flex items-center gap-3 text-[10px] pt-0.5 font-semibold text-gray-700">
                              <label className="flex items-center gap-1 cursor-pointer hover:text-red-700">
                                <input
                                  type="radio"
                                  name="cancelAuthMethod"
                                  checked={cancelAuthMethod === 'code'}
                                  onChange={() => setCancelAuthMethod('code')}
                                  className="accent-red-600 cursor-pointer"
                                />
                                <span>Authorization Code</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer hover:text-red-700">
                                <input
                                  type="radio"
                                  name="cancelAuthMethod"
                                  checked={cancelAuthMethod === 'credentials'}
                                  onChange={() => setCancelAuthMethod('credentials')}
                                  className="accent-red-600 cursor-pointer"
                                />
                                <span>Username & Password</span>
                              </label>
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-500 font-medium pt-0.5">
                              Requires supervisor or manager authorization:
                            </p>
                          )}

                          {canStaffUseCancelCode && cancelAuthMethod === 'code' ? (
                            <div className="space-y-1">
                              <div className="relative">
                                <Input
                                  type={showCancelSecret ? "text" : "password"}
                                  value={cancelAuthCode}
                                  onChange={(e) => setCancelAuthCode(sanitizeClientAuthCode(e.target.value))}
                                  placeholder="Enter authorization code"
                                  autoComplete="off"
                                  maxLength={64}
                                  className={`h-8 text-xs font-medium pr-8 bg-white transition-colors ${
                                    isCancelAuthCodeValid
                                      ? 'border-emerald-500 text-emerald-900 focus-visible:border-emerald-600 ring-1 ring-emerald-500/20'
                                      : cancelAuthCode.trim()
                                        ? 'border-red-500 text-red-900 focus-visible:border-red-600 ring-1 ring-red-500/20'
                                        : 'border-red-200 focus-visible:border-red-600'
                                  }`}
                                />
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => setShowCancelSecret(!showCancelSecret)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                  title={showCancelSecret ? "Hide code" : "Show code"}
                                >
                                  {showCancelSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>
                              <p className="text-[9.5px]">
                                {isCancelAuthCodeValid ? (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <CheckCircle2 size={11} className="text-emerald-600 shrink-0 inline" />
                                    ✓ Authorization code accepted.
                                  </span>
                                ) : cancelAuthCode.trim() ? (
                                  <span className="text-red-600 font-bold flex items-center gap-1">
                                    <XCircle size={11} className="text-red-500 shrink-0 inline" />
                                    ✗ Invalid authorization code.
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    Enter authorization code to proceed.
                                  </span>
                                )}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {!cancelAuthorizedBy ? (
                                <>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    <Input
                                      type="text"
                                      placeholder="Authorizer Username"
                                      value={cancelAuthUsername}
                                      onChange={(e) => setCancelAuthUsername(sanitizeClientUsername(e.target.value))}
                                      autoComplete="off"
                                      maxLength={50}
                                      className="h-8 text-xs bg-white border-red-200 focus-visible:border-red-600"
                                    />
                                    <div className="relative">
                                      <Input
                                        type={showCancelSecret ? "text" : "password"}
                                        placeholder="Password"
                                        value={cancelAuthPassword}
                                        onChange={(e) => setCancelAuthPassword(e.target.value)}
                                        autoComplete="current-password"
                                        maxLength={128}
                                        className="h-8 text-xs pr-8 bg-white border-red-200 focus-visible:border-red-600"
                                      />
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        onClick={() => setShowCancelSecret(!showCancelSecret)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                        title={showCancelSecret ? "Hide password" : "Show password"}
                                      >
                                        {showCancelSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                                      </button>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isCancelAuthorizing || !cancelAuthUsername.trim() || !cancelAuthPassword}
                                    onClick={handleAuthorizeCancelCredentials}
                                    className="w-full h-8 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    {isCancelAuthorizing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
                                    <span>Authorize Cancellation</span>
                                  </Button>
                                </>
                              ) : (
                                <div className="flex items-center justify-between text-[10px] text-emerald-800 pt-0.5">
                                  <span>Authorized by {cancelAuthorizedBy}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCancelAuthorizedBy(null);
                                      setCancelAuthUsername('');
                                      setCancelAuthPassword('');
                                    }}
                                    className="text-red-700 underline hover:text-red-900 font-semibold cursor-pointer"
                                  >
                                    Change Authorizer
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
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
                        disabled={isCancelling || (!isOwner && !isCancellationAuthorized)}
                        className={`flex-1 text-white font-black uppercase text-xs h-10 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 ${isRefundAllowed ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                        onClick={async () => {
                          if (cancelOrderModal && !isCancellingRef.current) {
                            if (!isOwner && !isCancellationAuthorized) {
                              toast.error("Please enter a valid authorization code or authorizer credentials.");
                              return;
                            }
                            if (!canCancelOrder) {
                              toast.error("You do not have permission to cancel job orders.");
                              setCancelOrderModal(null);
                              return;
                            }
                            isCancellingRef.current = true;
                            setIsCancelling(true);
                            const orderToCancel = cancelOrderModal;
                            try {
                              const isRefund = orderToCancel.status === 'new-order';
                              const depositAmt = orderToCancel.depositAmount || orderToCancel.amountReceived || 0;
                              const ok = await updateOrder(orderToCancel.id, {
                                status: 'cancelled',
                                cancellationStage: orderToCancel.status as any,
                                refundStatus: isRefund ? 'refunded' : 'no-refund',
                                refundAmount: isRefund ? depositAmt : 0,
                                refundReason: isRefund ? 'Order cancelled before service commenced (full refund)' : 'Order cancelled during service (deposit forfeited per policy)',
                                cancelledAt: new Date()
                              });
                              if (ok !== false) {
                                setCancelOrderModal(null);
                                if (isRefund) {
                                  toast.success(`Order #${orderToCancel.orderNumber} cancelled. Full refund of ₱${depositAmt.toLocaleString()} issued since service had not commenced.`);
                                } else {
                                  toast.error(`Order #${orderToCancel.orderNumber} cancelled. No refund issued per policy (service already commenced).`);
                                }
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

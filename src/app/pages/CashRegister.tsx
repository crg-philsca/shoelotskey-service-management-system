import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/app/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import {
  Banknote,
  Coins,
  Lock,
  Unlock,
  Receipt,
  AlertCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Calendar as CalendarIcon,
  Wallet,
  Building2,
  UserCheck,
  TrendingDown,
  Info,
  Search,
  ShieldCheck,
  Check,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPeso } from '@/app/lib/currency';
import type { CashSession, CashSummary, CashTransaction } from '@/app/types';
import AddExpenseModal from '@/app/components/AddExpenseModal';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface CashRegisterProps {
  user: { username: string; role: string; token?: string };
  onSetHeaderActionRight?: (action: ReactNode | null) => void;
}

export default function CashRegister({ user, onSetHeaderActionRight }: CashRegisterProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<CashSession | null>(null);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);

  // Filter state for transaction log
  const [txFilter, setTxFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [txSearch, setTxSearch] = useState('');

  // Dialog states
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);

  // Form states for Opening Register
  const [openingFundInput, setOpeningFundInput] = useState('1000.00');
  const [openingSubmitting, setOpeningSubmitting] = useState(false);

  // Form states for Closing Register
  const [actualCashInput, setActualCashInput] = useState('');
  const [varianceReasonInput, setVarianceReasonInput] = useState('');
  const [closingSubmitting, setClosingSubmitting] = useState(false);

  // Form states for Owner Withdrawal
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBy, setWithdrawBy] = useState(user.username || 'Owner');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [withdrawDate, setWithdrawDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [withdrawTime, setWithdrawTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  const openWithdrawalModal = () => {
    setWithdrawAmount('');
    setWithdrawNotes('');
    setWithdrawBy(user.username || 'Owner');
    setWithdrawDate(new Date().toISOString().split('T')[0]);
    setWithdrawTime(new Date().toTimeString().slice(0, 5));
    setIsWithdrawalModalOpen(true);
  };

  // Fetch all register data from authoritative backend database
  const fetchRegisterData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setRefreshing(true);

    try {
      const headers = {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      };

      // 1. Current session
      const currRes = await fetch(`${API_BASE}/cash-register/current`, { headers });
      if (currRes.ok) {
        const currData = await currRes.json();
        setSession(currData.session || null);
      } else {
        setSession(null);
      }

      // 2. Summary
      const sumRes = await fetch(`${API_BASE}/cash-register/summary`, { headers });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      // 3. Transactions
      const txRes = await fetch(`${API_BASE}/cash-register/transactions`, { headers });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load Cash Register data:', err);
      toast.error('Failed to connect to Cash Register service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.token]);

  useEffect(() => {
    fetchRegisterData();
  }, [fetchRegisterData]);

  // Set header action right button
  useEffect(() => {
    if (!onSetHeaderActionRight) return;

    onSetHeaderActionRight(
      <Button
        variant="outline"
        size="sm"
        onClick={() => fetchRegisterData(true)}
        disabled={refreshing}
        className="h-9 px-3 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs shadow-xs gap-1.5"
      >
        <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${refreshing ? 'animate-spin text-red-600' : ''}`} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    );

    return () => onSetHeaderActionRight(null);
  }, [onSetHeaderActionRight, refreshing, fetchRegisterData]);

  // Handle Opening Register
  const handleOpenRegister = async () => {
    const amount = parseFloat(openingFundInput);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid beginning cash fund (PHP 0.00 or higher).');
      return;
    }

    setOpeningSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/cash-register/open`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opening_cash: amount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to open register.');
      }

      toast.success(`Cash Register opened with Beginning Fund of ${formatPeso(amount)}`);
      setIsOpenModalOpen(false);
      await fetchRegisterData(true);
    } catch (err: any) {
      toast.error(err.message || 'Error opening cash register.');
    } finally {
      setOpeningSubmitting(false);
    }
  };

  // Live Over/Short calculation for Closing Register
  const expectedCash = summary ? summary.expected_cash : 0;
  const actualCashNumeric = parseFloat(actualCashInput || '0');
  const variance = !isNaN(actualCashNumeric) ? actualCashNumeric - expectedCash : 0;
  const isTally = Math.abs(variance) < 0.005;
  const isOver = variance > 0.005;

  // Handle Closing Register
  const handleCloseRegister = async () => {
    if (!session || session.status !== 'OPEN') {
      toast.error('No active open session to close.');
      return;
    }

    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) {
      toast.error('Please enter the actual physical cash counted (PHP 0.00 or higher).');
      return;
    }

    if (!isTally && !varianceReasonInput.trim()) {
      toast.error('Variance Reason is mandatory when actual cash does not tally with expected cash.');
      return;
    }

    setClosingSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/cash-register/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.id,
          actual_cash: actual,
          variance_reason: varianceReasonInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to close register.');
      }

      const varianceType = data.over_short === 0 ? 'TALLY' : data.over_short > 0 ? 'OVER' : 'SHORT';
      toast.success(`Register closed successfully. Status: ${varianceType} (${formatPeso(data.over_short)})`);
      setIsCloseModalOpen(false);
      await fetchRegisterData(true);
    } catch (err: any) {
      toast.error(err.message || 'Error closing cash register.');
    } finally {
      setClosingSubmitting(false);
    }
  };

  // Handle Owner Withdrawal submission
  const handleOwnerWithdrawal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amt = parseFloat(withdrawAmount.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid withdrawal amount greater than ₱0.00.');
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'Owner Withdrawal',
          amount: amt,
          notes: `${withdrawNotes.trim() || 'Owner personal withdrawal'} || Withdrawn by: ${withdrawBy.trim() || user.username || 'Owner'}`,
          frequency: 'One-Time',
          date: withdrawDate && withdrawTime ? `${withdrawDate}T${withdrawTime}` : new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to record owner withdrawal.');
      }

      toast.success(`Owner withdrawal of ${formatPeso(amt)} recorded successfully.`);
      setIsWithdrawalModalOpen(false);
      setWithdrawAmount('');
      setWithdrawNotes('');
      await fetchRegisterData(true);
    } catch (err: any) {
      console.error('Owner withdrawal error:', err);
      toast.error(err.message || 'Error recording owner withdrawal.');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Handle Business Expense addition from modal
  const handleAddExpense = async (expensePayload: any) => {
    try {
      const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify(expensePayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to record expense.');
      }

      setIsExpenseModalOpen(false);
      await fetchRegisterData(true);
    } catch (err: any) {
      console.error('Expense submit error:', err);
      toast.error(err.message || 'Failed to record expense.');
      throw err;
    }
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (txFilter === 'INFLOW' && tx.cash_in <= 0) return false;
      if (txFilter === 'OUTFLOW' && tx.cash_out <= 0) return false;

      // Search filter
      if (txSearch.trim()) {
        const query = txSearch.toLowerCase();
        const matchesType = tx.transaction.toLowerCase().includes(query);
        const matchesDetails = tx.details.toLowerCase().includes(query);
        const matchesOrder = tx.order_id ? tx.order_id.toLowerCase().includes(query) : false;
        if (!matchesType && !matchesDetails && !matchesOrder) return false;
      }

      return true;
    });
  }, [transactions, txFilter, txSearch]);

  if (loading && !session && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-red-600 border-t-transparent"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Loading Cash Register...</p>
      </div>
    );
  }

  const isOpen = session?.status === 'OPEN';
  const isClosed = session?.status === 'CLOSED';

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 max-w-7xl mx-auto px-2 sm:px-4">
      {/* 1. EXECUTIVE COMMAND HEADER */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200/80 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Left: Branding & Session Status */}
          <div className="flex items-start sm:items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
              isOpen 
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/20' 
                : 'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-slate-900/20'
            }`}>
              <Banknote className="h-7 w-7" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight uppercase">
                  Daily Cash Register
                </h1>
                {isOpen ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    SHIFT ACTIVE / OPEN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
                    <Lock className="h-3 w-3 text-slate-500" />
                    REGISTER CLOSED
                  </span>
                )}
              </div>

              <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5 flex-wrap">
                <CalendarIcon className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <span>{currentDateFormatted}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-600 font-semibold">Business Date: {summary?.business_date || session?.business_date || 'Today'}</span>
              </p>

              {session && (
                <div className="text-[11px] text-gray-500 flex items-center gap-3 pt-1 flex-wrap font-medium">
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                    Opened by: <strong className="text-gray-800">{session.opened_by_name || 'Front Staff'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Started: <strong className="text-gray-800">
                      {session.opened_at ? new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </strong>
                  </span>
                  {isClosed && session.closed_at && (
                    <span className="flex items-center gap-1 text-slate-600">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      Closed at: <strong className="text-gray-800">
                        {new Date(session.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Primary Register & Deduction Actions */}
          <div className="flex items-center gap-2.5 flex-wrap self-stretch sm:self-auto shrink-0">
            {/* Expense Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExpenseModalOpen(true)}
              className="w-full sm:w-auto bg-white hover:bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300 font-bold uppercase text-xs tracking-wider px-4 py-2.5 h-11 rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all active:scale-98"
              title="Record Business Cash Expense"
            >
              <Receipt className="h-4 w-4 text-rose-600" />
              <span>Expense</span>
            </Button>

            {/* Owner Withdrawal Button */}
            <Button
              type="button"
              variant="outline"
              onClick={openWithdrawalModal}
              className="w-full sm:w-auto bg-white hover:bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300 font-bold uppercase text-xs tracking-wider px-4 py-2.5 h-11 rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all active:scale-98"
              title="Record Owner Cash Withdrawal"
            >
              <UserCheck className="h-4 w-4 text-amber-600" />
              <span>Owner Withdrawal</span>
            </Button>

            {/* Open / Close Register Button */}
            {!isOpen ? (
              <Button
                onClick={() => setIsOpenModalOpen(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-xs tracking-wider px-6 py-2.5 h-11 rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Unlock className="h-4 w-4" />
                Open Cash Register
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setActualCashInput((summary?.expected_cash || 0).toFixed(2));
                  setVarianceReasonInput('');
                  setIsCloseModalOpen(true);
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black uppercase text-xs tracking-wider px-6 py-2.5 h-11 rounded-xl shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Lock className="h-4 w-4" />
                Close Cash Register
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. AUDITED RECONCILIATION SUMMARY (WHEN PREVIOUS SESSION CLOSED TODAY) */}
      {isClosed && session && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                Latest Shift Reconciliation Audit
              </span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">
              Closed {session.closed_at ? new Date(session.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Beginning Cash</span>
              <span className="text-sm font-black text-gray-900">{formatPeso(session.opening_cash)}</span>
            </div>
            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Expected Cash</span>
              <span className="text-sm font-black text-gray-900">{formatPeso(session.expected_cash || 0)}</span>
            </div>
            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Actual Counted</span>
              <span className="text-sm font-black text-gray-900">{formatPeso(session.actual_cash || 0)}</span>
            </div>
            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Variance Status</span>
              <div>
                {session.over_short === 0 || !session.over_short ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-black text-[10px]">TALLY (₱0.00)</Badge>
                ) : session.over_short > 0 ? (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-black text-[10px]">OVER (+{formatPeso(session.over_short)})</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-300 font-black text-[10px]">SHORT ({formatPeso(session.over_short)})</Badge>
                )}
              </div>
            </div>
          </div>

          {session.variance_reason && (
            <div className="text-xs bg-amber-50/80 border border-amber-200 text-amber-900 p-3 rounded-xl font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Recorded Variance Reason:</strong> {session.variance_reason}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. FINANCIAL POSITION GRID: 3 COHESIVE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CARD 1: INFLOWS & PAYMENT SUMMARY */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-between hover:border-gray-300 transition-all">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Coins className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Payment Summary</h3>
                  <span className="text-[10px] text-gray-400 font-medium">Customer Inflows</span>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black text-[10px] uppercase">
                Daily Inflow
              </Badge>
            </div>

            <div className="space-y-3 pt-4">
              {/* Cash Sales Row */}
              <div className="flex justify-between items-center bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/60">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                  <Coins className="h-3.5 w-3.5 text-emerald-600" />
                  Cash Sales:
                </span>
                <span className="text-emerald-700 font-black text-sm">{formatPeso(summary?.cash_sales || 0)}</span>
              </div>

              {/* Digital Sales Breakdown */}
              <div className="space-y-2 px-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2 text-gray-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#007dfe]"></span>
                    GCash:
                  </span>
                  <span className="font-bold text-gray-800">{formatPeso(summary?.gcash_sales || 0)}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2 text-gray-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#00d68f]"></span>
                    Maya:
                  </span>
                  <span className="font-bold text-gray-800">{formatPeso(summary?.maya_sales || 0)}</span>
                </div>

                <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-dashed border-gray-200 text-blue-700">
                  <span>Digital Sales (GCash + Maya):</span>
                  <span>{formatPeso(summary?.digital_sales || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Total Daily Payments</span>
                <span className="text-xs text-gray-500 font-medium">Cash + Digital</span>
              </div>
              <span className="text-lg font-black text-indigo-700">{formatPeso(summary?.total_daily_payments || 0)}</span>
            </div>
          </div>
        </div>

        {/* CARD 2: OUTFLOWS & DEDUCTIONS */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-between hover:border-gray-300 transition-all">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Cash Out Summary</h3>
                  <span className="text-[10px] text-gray-400 font-medium">Drawer Deductions</span>
                </div>
              </div>
              <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-black text-[10px] uppercase">
                Deductions
              </Badge>
            </div>

            <div className="space-y-3 pt-4">
              {/* Business Expenses */}
              <div className="flex justify-between items-center bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/60">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-rose-600" />
                  Business Expenses (Cash):
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-rose-600 font-black text-sm">{formatPeso(summary?.business_expenses || 0)}</span>
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="p-1 rounded-md text-rose-600 hover:text-white hover:bg-rose-600 transition-colors"
                    title="Add Business Expense"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Owner Withdrawals */}
              <div className="space-y-2 px-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2 text-gray-600 font-medium">
                    <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                    Owner Withdrawals:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{formatPeso(summary?.owner_withdrawals || 0)}</span>
                    <button
                      type="button"
                      onClick={openWithdrawalModal}
                      className="p-1 rounded-md text-amber-700 hover:text-white hover:bg-amber-600 transition-colors"
                      title="Record Owner Withdrawal"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed italic pt-1">
                  * Note: Owner withdrawals reduce physical drawer cash, but are excluded from business operating expenses.
                </p>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="h-8 px-2 text-[11px] font-bold text-rose-700 bg-rose-50/60 hover:bg-rose-100 hover:text-rose-800 border-rose-200 rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                  >
                    <Receipt className="h-3.5 w-3.5 text-rose-600" />
                    <span>+ Expense</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openWithdrawalModal}
                    className="h-8 px-2 text-[11px] font-bold text-amber-800 bg-amber-50/60 hover:bg-amber-100 hover:text-amber-900 border-amber-200 rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                    <span>+ Withdrawal</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Total Cash Out</span>
                <span className="text-xs text-gray-500 font-medium">Total Physical Deductions</span>
              </div>
              <span className="text-lg font-black text-rose-600">{formatPeso(summary?.total_cash_out || 0)}</span>
            </div>
          </div>
        </div>

        {/* CARD 3: CASH POSITION (PHYSICAL DRAWER) */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-between hover:border-gray-300 transition-all">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Cash Position</h3>
                  <span className="text-[10px] text-gray-400 font-medium">Physical Cash Drawer</span>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black text-[10px] uppercase">
                Live Drawer
              </Badge>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex justify-between items-center bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-600">Beginning Cash Fund:</span>
                <span className="font-bold text-gray-900 text-xs">{formatPeso(summary?.beginning_cash || 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/60">
                <span className="text-xs font-semibold text-emerald-800">+ Cash Payments Received:</span>
                <span className="font-black text-emerald-700 text-xs">+{formatPeso(summary?.cash_sales || 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/60">
                <span className="text-xs font-semibold text-rose-800">- Total Cash Out:</span>
                <span className="font-black text-rose-600 text-xs">-{formatPeso(summary?.total_cash_out || 0)}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
            <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 block">
                  Expected Cash on Hand
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">Physical Drawer Total</span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-emerald-700">
                {formatPeso(summary?.expected_cash || 0)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 pt-1">
              <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>Digital sales ({formatPeso(summary?.digital_sales || 0)}) are stored electronically.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. AUDITED TRANSACTION LOG TABLE WITH SEARCH & FILTER */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-red-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-900">
                Daily Transaction Log
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {filteredTransactions.length} of {transactions.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Real-time audit log of beginning fund, customer payments, and authorized cash disbursements.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search transactions..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="h-9 pl-8 text-xs border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white"
              />
            </div>

            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setTxFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-colors ${txFilter === 'ALL' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTxFilter('INFLOW')}
                className={`px-2.5 py-1 rounded-md transition-colors ${txFilter === 'INFLOW' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Inflows
              </button>
              <button
                type="button"
                onClick={() => setTxFilter('OUTFLOW')}
                className={`px-2.5 py-1 rounded-md transition-colors ${txFilter === 'OUTFLOW' ? 'bg-white text-rose-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Outflows
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
                <TableHead className="text-[11px] font-black uppercase text-gray-600 py-3 pl-5">Time</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-gray-600 py-3">Transaction Type</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-gray-600 py-3">Details</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-gray-600 py-3 text-center">Order ID</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-gray-600 py-3 text-right">Cash In</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-gray-600 py-3 text-right pr-5">Cash Out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      No matching register transactions found
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                      Transactions recorded today will automatically appear here.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-gray-50/70 transition-colors border-b border-gray-50 text-xs">
                    <TableCell className="pl-5 py-3 font-semibold text-gray-600 whitespace-nowrap">
                      {tx.time}
                    </TableCell>
                    <TableCell className="py-3 font-bold text-gray-900 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {tx.transaction === 'Beginning Cash Fund' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
                            <Banknote className="h-3 w-3" />
                            BEGINNING FUND
                          </span>
                        ) : tx.transaction === 'Customer Order Payment' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                            <Coins className="h-3 w-3" />
                            ORDER PAYMENT
                          </span>
                        ) : tx.transaction === 'Business Operating Expense' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            <TrendingDown className="h-3 w-3" />
                            EXPENSE
                          </span>
                        ) : tx.transaction === 'Owner Cash Withdrawal' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            <UserCheck className="h-3 w-3" />
                            WITHDRAWAL
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-700 border border-gray-200">
                            {tx.transaction}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-gray-700 max-w-xs truncate font-medium">
                      {tx.details}
                    </TableCell>
                    <TableCell className="py-3 text-center whitespace-nowrap">
                      {tx.order_id && tx.order_id !== '-' ? (
                        <span className="inline-block px-2 py-0.5 rounded-md font-black text-[11px] bg-red-50 text-red-700 border border-red-200/80">
                          {tx.order_id}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right font-black text-emerald-600 whitespace-nowrap">
                      {tx.cash_in > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold">
                          <ArrowDownLeft className="h-3 w-3" />
                          {formatPeso(tx.cash_in)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right pr-5 font-black text-rose-600 whitespace-nowrap">
                      {tx.cash_out > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold">
                          <ArrowUpRight className="h-3 w-3" />
                          {formatPeso(tx.cash_out)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* DIALOG 1: OPEN CASH REGISTER */}
      <Dialog open={isOpenModalOpen} onOpenChange={setIsOpenModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl shadow-2xl p-6">
          <DialogHeader className="text-left space-y-1">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
              <Unlock className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-gray-900">
              Open Cash Register
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 font-medium">
              Specify the beginning cash fund placed in the physical drawer for today's shift ({currentDateFormatted}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label htmlFor="openingCashInput" className="text-xs font-black uppercase tracking-wider text-gray-700 block">
                Beginning Cash Fund (₱) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-gray-400">₱</span>
                <Input
                  id="openingCashInput"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="1000.00"
                  value={openingFundInput}
                  onChange={(e) => setOpeningFundInput(e.target.value)}
                  className="pl-8 h-11 text-base font-black text-gray-900 border-gray-300 rounded-xl focus-visible:ring-emerald-600 focus-visible:border-emerald-600"
                />
              </div>

              {/* Quick preset buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Presets:</span>
                {['500', '1000', '1500', '2000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOpeningFundInput(parseFloat(preset).toFixed(2))}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-gray-200 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 text-gray-700 hover:text-emerald-800 transition-colors"
                  >
                    ₱{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1 font-medium">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                Digital Sales Handling
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Payments received via GCash & Maya will be recorded in digital reports, but will not increase physical cash on hand.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpenModalOpen(false)}
              disabled={openingSubmitting}
              className="text-xs font-bold uppercase rounded-xl h-10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleOpenRegister}
              disabled={openingSubmitting}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase shadow-md flex items-center gap-1.5 rounded-xl h-10 px-5"
            >
              <Check className="h-4 w-4" />
              {openingSubmitting ? 'Opening...' : 'Confirm & Open Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: CLOSE CASH REGISTER */}
      <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl shadow-2xl p-6">
          <DialogHeader className="text-left space-y-1">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-1">
              <Lock className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-gray-900">
              Close Cash Register
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 font-medium">
              Count all physical bills and coins in the cash drawer and enter the actual counted total to balance the shift.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Server Expected Cash (Read-Only) */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                  Server Expected Cash
                </span>
                <span className="text-xs text-gray-400 font-medium">Authoritative Database Total</span>
              </div>
              <span className="text-xl font-black text-gray-900">
                {formatPeso(expectedCash)}
              </span>
            </div>

            {/* Actual Physical Cash Counted Input */}
            <div className="space-y-1.5">
              <label htmlFor="actualCashInput" className="text-xs font-black uppercase tracking-wider text-gray-700 block">
                Actual Cash Counted (₱) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-gray-400">₱</span>
                <Input
                  id="actualCashInput"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="pl-8 h-11 text-base font-black text-gray-900 border-gray-300 rounded-xl focus-visible:ring-red-600 focus-visible:border-red-600"
                />
              </div>
            </div>

            {/* Live Over/Short Preview */}
            <div className="p-3.5 rounded-xl border flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: isTally ? '#ecfdf5' : isOver ? '#eff6ff' : '#fff1f2',
                borderColor: isTally ? '#a7f3d0' : isOver ? '#bfdbfe' : '#fecdd3',
              }}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 block">
                  Variance Status
                </span>
                <span className="text-xs font-bold text-gray-800">
                  {isTally ? 'Physical cash matches expected cash perfectly' : isOver ? 'Surplus cash in drawer' : 'Cash shortage in drawer'}
                </span>
              </div>
              <div>
                {isTally ? (
                  <Badge className="bg-emerald-600 text-white font-black text-xs">TALLY (₱0.00)</Badge>
                ) : isOver ? (
                  <Badge className="bg-blue-600 text-white font-black text-xs">OVER (+{formatPeso(variance)})</Badge>
                ) : (
                  <Badge className="bg-rose-600 text-white font-black text-xs">SHORT ({formatPeso(variance)})</Badge>
                )}
              </div>
            </div>

            {/* Mandatory Variance Reason If Non-Zero */}
            {!isTally && (
              <div className="space-y-1.5 animate-in fade-in duration-300">
                <label htmlFor="varianceReasonInput" className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Variance Reason <span className="text-red-600">* Required</span>
                </label>
                <textarea
                  id="varianceReasonInput"
                  rows={2}
                  value={varianceReasonInput}
                  onChange={(e) => setVarianceReasonInput(e.target.value)}
                  placeholder="Explain why the drawer is over or short (e.g., Unclaimed change, coin shortage)..."
                  className="w-full text-xs p-2.5 rounded-xl border border-rose-300 bg-rose-50/30 text-gray-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCloseModalOpen(false)}
              disabled={closingSubmitting}
              className="text-xs font-bold uppercase rounded-xl h-10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCloseRegister}
              disabled={closingSubmitting || (!isTally && !varianceReasonInput.trim())}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black uppercase shadow-md flex items-center gap-1.5 rounded-xl h-10 px-5"
            >
              {closingSubmitting ? 'Auditing & Closing...' : 'Confirm & Close Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. OWNER WITHDRAWAL MODAL */}
      <Dialog open={isWithdrawalModalOpen} onOpenChange={setIsWithdrawalModalOpen}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl border-gray-100 shadow-2xl">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 bg-amber-50/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                <UserCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-black uppercase tracking-wider text-gray-900">
                  Record Owner Withdrawal
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 font-medium">
                  Physical cash disbursement from drawer for owner personal drawings.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleOwnerWithdrawal} className="p-5 space-y-4">
            {/* Drawer Context Alert */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-amber-700" /> Current Drawer Expected Cash
                </span>
                <span className="text-sm font-black text-amber-900">
                  {formatPeso(summary?.expected_cash || 0)}
                </span>
              </div>
              <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                Owner withdrawals reduce physical drawer cash, but are strictly excluded from business operating expenses in profit and sales reports.
              </p>
            </div>

            {/* Amount Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                Withdrawal Amount (PHP) <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₱</span>
                <Input
                  type="text"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) return;
                    setWithdrawAmount(val);
                  }}
                  className="pl-8 h-10 font-bold text-gray-900 text-sm bg-gray-50/50 border-gray-200 rounded-xl focus:bg-white"
                  autoFocus
                  required
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {[500, 1000, 2000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWithdrawAmount(preset.toFixed(2))}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-gray-200 bg-gray-50 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 text-gray-700 transition-colors"
                  >
                    +₱{preset.toLocaleString()}
                  </button>
                ))}
                {(summary?.expected_cash || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount((summary?.expected_cash || 0).toFixed(2))}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-amber-300 bg-amber-100/70 hover:bg-amber-200 text-amber-900 transition-colors"
                  >
                    All Cash
                  </button>
                )}
              </div>

              {/* Shortage Warning */}
              {parseFloat(withdrawAmount || '0') > (summary?.expected_cash || 0) && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 font-medium flex items-center gap-1.5 mt-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Warning: Withdrawal exceeds current drawer cash ({formatPeso(summary?.expected_cash || 0)}). This will record a negative cash drawer balance.</span>
                </div>
              )}
            </div>

            {/* Withdrawn By */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                Withdrawn By / Authorized By
              </label>
              <Input
                type="text"
                placeholder="Owner name..."
                value={withdrawBy}
                onChange={(e) => setWithdrawBy(e.target.value)}
                className="h-9 text-xs bg-gray-50/50 border-gray-200 rounded-xl"
              />
            </div>

            {/* Reason / Notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                Purpose / Memo
              </label>
              <Input
                type="text"
                placeholder="e.g., Personal drawings, Bank cash deposit, Emergency personal use"
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                className="h-9 text-xs bg-gray-50/50 border-gray-200 rounded-xl"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {['Personal Drawings', 'Bank Deposit', 'Emergency Cash', 'Owner Share'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setWithdrawNotes(tag)}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Date</label>
                <Input
                  type="date"
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  className="h-9 text-xs bg-gray-50/50 border-gray-200 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Time</label>
                <Input
                  type="time"
                  value={withdrawTime}
                  onChange={(e) => setWithdrawTime(e.target.value)}
                  className="h-9 text-xs bg-gray-50/50 border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-gray-100 flex flex-row gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWithdrawalModalOpen(false)}
                className="h-10 px-4 text-xs font-bold uppercase rounded-xl border-gray-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={withdrawSubmitting || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                className="h-10 px-5 text-xs font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md shadow-amber-600/20 disabled:opacity-50"
              >
                {withdrawSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Recording...
                  </span>
                ) : (
                  'Confirm Withdrawal'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. BUSINESS EXPENSE MODAL */}
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onAddExpense={handleAddExpense}
      />
    </div>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Receipt, Calendar, Tag, FileText, DollarSign, Clock, Pencil, Printer } from 'lucide-react';

interface ExpenseDetailModalProps {
  expense: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (expense: any) => void;
  user?: { token: string; role?: string };
}

export default function ExpenseDetailModal({
  expense,
  open,
  onOpenChange,
  onEdit,
}: ExpenseDetailModalProps) {
  if (!expense) return null;

  const formatDateDisplay = (dateVal: string | Date) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      return d.toLocaleDateString('en-US', options);
    } catch (e) {
      return String(dateVal);
    }
  };

  const amountFormatted = Number(expense.amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const frequencyDisplay = expense.frequency || (expense.category?.toUpperCase() === 'INVENTORY' ? 'Variable / Restock' : 'One-Time');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="bg-red-600 px-6 py-5 text-white">
          <DialogTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl text-white">
              <Receipt size={20} strokeWidth={2.5} />
            </div>
            Expense Record Details
          </DialogTitle>
          <p className="text-[11px] text-red-100 uppercase tracking-widest font-semibold mt-1">
            Reference ID #EXP-{expense.id || 'REF'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Main Amount Callout Card */}
          <div className="bg-gradient-to-br from-red-50/70 to-orange-50/30 rounded-2xl p-4 border border-red-100/60 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100/80 rounded-xl text-red-700">
                <DollarSign size={24} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Amount Paid</p>
                <p className="text-2xl font-black text-red-700 tracking-tight">₱{amountFormatted}</p>
              </div>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              {frequencyDisplay}
            </span>
          </div>

          {/* Details Grid */}
          <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-3.5">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2.5">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Calendar size={14} className="text-red-500" />
                Expense Date
              </span>
              <span className="text-xs font-extrabold text-gray-900">{formatDateDisplay(expense.date)}</span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2.5">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Tag size={14} className="text-red-500" />
                Category
              </span>
              <span className="text-xs font-extrabold text-gray-900">{expense.category || 'General'}</span>
            </div>

            <div className="flex items-center justify-between pb-1">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Clock size={14} className="text-red-500" />
                Frequency Type
              </span>
              <span className="text-xs font-extrabold text-gray-900">{frequencyDisplay}</span>
            </div>
          </div>

          {/* Notes / Description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-black uppercase text-gray-400 tracking-wider">
              <FileText size={14} className="text-red-500" />
              Description & Notes
            </label>
            <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 text-xs font-medium text-gray-700 min-h-[64px] leading-relaxed">
              {expense.notes || <span className="text-gray-400 italic">No description provided for this expense record.</span>}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-32 h-11 rounded-xl font-bold text-xs uppercase tracking-wider border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => window.print()}
              variant="outline"
              className="h-11 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5"
            >
              <Printer size={15} strokeWidth={2} /> Print
            </Button>
            {onEdit && (
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(expense);
                }}
                className="h-11 px-5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Pencil size={14} strokeWidth={2.5} /> Edit Expense
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

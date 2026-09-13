import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { ReceiptText, Calendar, Tag, FileText, Clock, Boxes } from 'lucide-react';
import { getExpenseGroup } from '@/app/lib/expenseCategories';

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
  const navigate = useNavigate();

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

  const rawFreq = expense.frequency || (expense.category?.toUpperCase() === 'INVENTORY' ? 'Restock' : 'One-Time');
  const frequencyDisplay = rawFreq.replace(/variable\s*\/\s*restock/i, 'Restock');

  // Check if this expense is linked to inventory or restocking
  const isInventoryRelated = 
    getExpenseGroup(expense.category) === 'Inventory Expenses' ||
    (expense.category || '').toLowerCase().includes('inventory') ||
    (expense.notes || '').toLowerCase().includes('restock') ||
    (expense.frequency || '').toLowerCase().includes('restock');

  // Parse notes to separate structured itemized breakdown from additional notes
  const parseNotesContent = (notesStr: string) => {
    if (!notesStr) return { breakdown: [] as { name: string; amount: string }[], remarks: '' };

    const breakdownHeaderRegex = /\[(.*?(?:BREAKDOWN|PAYROLL ALLOCATION))\]/i;
    const match = notesStr.match(breakdownHeaderRegex);

    if (!match || match.index === undefined) {
      return { breakdown: [], remarks: notesStr };
    }

    const afterHeader = notesStr.substring(match.index + match[0].length);
    const addNotesMatch = afterHeader.match(/\[ADDITIONAL NOTES\]/i);

    let breakdownBlock = '';
    let remarks = '';

    if (addNotesMatch && addNotesMatch.index !== undefined) {
      breakdownBlock = afterHeader.substring(0, addNotesMatch.index);
      remarks = afterHeader.substring(addNotesMatch.index + addNotesMatch[0].length).trim();
    } else {
      const lines = afterHeader.split('\n');
      const bullets: string[] = [];
      const others: string[] = [];
      let inBullets = true;
      for (const l of lines) {
        const tr = l.trim();
        if (!tr) continue;
        if (tr.startsWith('•') || tr.startsWith('-') || tr.startsWith('*')) {
          if (inBullets) bullets.push(tr);
          else others.push(l);
        } else {
          inBullets = false;
          others.push(l);
        }
      }
      breakdownBlock = bullets.join('\n');
      remarks = others.join('\n').trim();
    }

    const lines = breakdownBlock.split('\n');
    const breakdown: { name: string; amount: string }[] = [];
    for (const line of lines) {
      const tr = line.trim().replace(/^[•\-\*]\s*/, '');
      if (!tr) continue;
      const colonIdx = tr.indexOf(':');
      if (colonIdx > 0) {
        breakdown.push({
          name: tr.substring(0, colonIdx).trim(),
          amount: tr.substring(colonIdx + 1).trim()
        });
      } else {
        breakdown.push({ name: tr, amount: '' });
      }
    }

    return { breakdown, remarks };
  };

  const { breakdown, remarks } = parseNotesContent(expense.notes || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 flex flex-col max-h-[90vh]">
        {/* Header - uses ReceiptText with horizontal lines (NO dollar sign) */}
        <div className="bg-red-600 px-6 py-4 text-white shrink-0">
          <DialogTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl text-white">
              <ReceiptText size={20} strokeWidth={2.5} />
            </div>
            Expense Record Details
          </DialogTitle>
          <p className="text-[11px] text-red-100 uppercase tracking-widest font-semibold mt-0.5">
            Reference ID #EXP-{expense.id || 'REF'}
          </p>
        </div>

        {/* Content Body with scrollbar to prevent any cut off */}
        <div className="p-5 pt-4 pb-2 space-y-3 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          {/* Main Amount Callout Card */}
          <div className="bg-gradient-to-br from-red-50/70 to-orange-50/30 rounded-2xl p-3.5 border border-red-100/60 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100/80 rounded-xl text-red-700 flex items-center justify-center min-w-[44px] min-h-[44px]">
                <span className="text-2xl font-black leading-none tracking-tight">₱</span>
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
          <div className="bg-gray-50/70 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Calendar size={14} className="text-red-500" />
                Expense Date
              </span>
              <span className="text-xs font-extrabold text-gray-900">{formatDateDisplay(expense.date)}</span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Boxes size={14} className="text-red-500" />
                Expense Group
              </span>
              <span className="text-xs font-extrabold text-gray-900">
                {(() => {
                  const grp = getExpenseGroup(expense.category);
                  const color = grp === 'Inventory Expenses'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : grp === 'Operating Expenses'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-purple-50 text-purple-800 border-purple-200';
                  return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${color}`}>
                      {grp}
                    </span>
                  );
                })()}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Tag size={14} className="text-red-500" />
                Category
              </span>
              <span className="text-xs font-extrabold text-gray-900">{expense.category || 'General'}</span>
            </div>

            <div className="flex items-center justify-between pb-0.5">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Clock size={14} className="text-red-500" />
                Frequency Type
              </span>
              <span className="text-xs font-extrabold text-gray-900">{frequencyDisplay}</span>
            </div>
          </div>

          {/* Itemized Breakdown Card (If present in notes) */}
          {breakdown.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-1.5">
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                <Boxes size={13} className="text-amber-600" /> Itemized Breakdown
              </span>
              <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                {breakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-amber-100 shadow-2xs">
                    <span className="font-bold text-gray-800 truncate pr-2">{item.name}</span>
                    {item.amount && <span className="font-extrabold text-amber-900 shrink-0">{item.amount}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description & Additional Remarks */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400 tracking-wider">
              <FileText size={13} className="text-red-500" />
              {breakdown.length > 0 ? 'Remarks & Notes' : 'Description & Notes'}
            </label>
            <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3 text-xs font-medium text-gray-700 whitespace-pre-line leading-relaxed max-h-[90px] overflow-y-auto custom-scrollbar">
              {remarks || (breakdown.length === 0 && expense.notes) || (
                <span className="text-gray-400 italic">No additional description or remarks provided.</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions — reduced spacing, snug against notes, with Inventory link */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 max-w-[140px] h-10 rounded-xl font-bold text-xs uppercase tracking-wider border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            Close
          </Button>

          {isInventoryRelated && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                navigate('/inventory');
              }}
              className="flex-1 max-w-[160px] h-10 rounded-xl font-black text-xs uppercase tracking-wider border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center gap-1.5 shadow-2xs transition-all"
              title="View stock in Inventory"
            >
              <Boxes size={14} className="text-amber-600" />
              Inventory
            </Button>
          )}

          {onEdit && (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onEdit(expense);
              }}
              className="flex-1 max-w-[140px] h-10 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center"
            >
              Edit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

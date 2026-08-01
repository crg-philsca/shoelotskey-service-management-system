import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import {
  Package,
  Activity,
  Zap,
  Copy,
  Check,
  Info,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';
import { InventoryItem } from '@/app/types';
import { getInventoryPresentation } from '@/app/lib/inventoryPresentation';

interface InventoryDetailModalProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (item: InventoryItem) => void;
}

export default function InventoryDetailModal({
  item,
  open,
  onOpenChange,
  onEdit,
}: InventoryDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const pres = getInventoryPresentation(item);
  const formattedId = `INV-${item.id.toString().padStart(4, '0')}`;

  const handleCopyId = () => {
    navigator.clipboard.writeText(formattedId);
    setCopied(true);
    toast.success(`Item ID #${formattedId} copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = pres.stockStatus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden rounded-2xl max-h-[85vh] flex flex-col border-none shadow-2xl">
        {/* Header Bar with Copyable Inventory ID */}
        <DialogHeader className="p-4 border-b border-gray-100 bg-white flex flex-row items-center justify-between">
          <div className="w-8" /> {/* Spacer for centered symmetry */}
          <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2 text-slate-900">
            <span>Item #</span>
            <button
              onClick={handleCopyId}
              title="Click to copy Inventory ID"
              className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 group"
            >
              <span>{formattedId}</span>
              {copied ? (
                <Check size={13} className="text-emerald-600 shrink-0" />
              ) : (
                <Copy size={13} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
              )}
            </button>
          </DialogTitle>
          <div className="w-8" />
        </DialogHeader>

        {/* Scrollable Content Body - Cleanly Categorized Cards */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 scrollbar-thin">
          {/* Card 1: Overview & Status */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="grid grid-cols-2 gap-4 items-center pb-3 border-b border-slate-200/60">
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Stock Status
                </Label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                    status === 'In Stock'
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : status === 'Low Stock'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-red-50 text-red-700 border-red-100'
                  }`}
                >
                  {status}
                </span>
              </div>

              <div className="text-right">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Item Status
                </Label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                    item.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}
                >
                  {item.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Item Name
                </Label>
                <p className="text-sm font-black text-slate-900">{item.name}</p>
                <span className="inline-block mt-1 text-[10px] font-extrabold uppercase px-2 py-0.5 bg-gray-200/80 text-gray-700 rounded-md">
                  {item.category || 'Uncategorized'}
                </span>
              </div>
              <div className="text-right">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Unit Price
                </Label>
                <p className="text-base font-extrabold text-slate-900">
                  ₱{(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Current Stock & Packaging Analysis */}
          <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100/80 space-y-3">
            <div className="flex items-center gap-2 border-b border-blue-200/60 pb-2">
              <Package size={16} className="text-blue-600" />
              <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                Stock Level & Packaging
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5 block">
                  Current On-Hand
                </Label>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-slate-900">{(item.stock || 0).toLocaleString()}</span>
                  <span className="text-xs font-extrabold uppercase text-slate-500">{item.unit || 'units'}</span>
                </div>
              </div>
              <div className="text-right">
                <Label className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5 block">
                  Container Breakdown
                </Label>
                <p className="text-xs font-bold text-slate-800">
                  {pres.isPackaged ? pres.containersLabel : 'Bulk / Unpackaged'}
                </p>
                {pres.containersSubLabel && (
                  <span className="inline-block mt-0.5 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    {pres.containersSubLabel}
                  </span>
                )}
              </div>
            </div>

            {pres.isPackaged && (
              <div className="pt-2 border-t border-blue-100 text-xs text-blue-900 flex justify-between items-center">
                <span className="font-semibold text-blue-600">Package Standard:</span>
                <span className="font-bold">1 {item.package_unit || item.unit} = {item.package_size} {item.unit}</span>
              </div>
            )}
          </div>

          {/* Card 3: Depletion Forecast & Reorder Recommendations */}
          <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/80 space-y-3">
            <div className="flex items-center gap-2 border-b border-emerald-200/60 pb-2">
              <Activity size={16} className="text-emerald-600" />
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Depletion Forecast
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider mb-0.5 block">
                  Estimated Supply
                </Label>
                <p className="text-xs font-black text-slate-800">
                  {pres.daysRemainingLabel || 'No recent consumption data'}
                </p>
              </div>
              <div className="text-right">
                <Label className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider mb-0.5 block">
                  Low Stock Threshold
                </Label>
                <p className="text-xs font-extrabold text-slate-800">
                  {(item.low_stock_threshold ?? 0) > 0 ? `≤ ${(item.low_stock_threshold || 0).toLocaleString()} ${item.unit}` : 'Not configured'}
                </p>
              </div>
            </div>

            {pres.reorderRecommendation && (
              <div className="p-2 bg-white rounded-lg border border-emerald-100 flex items-start gap-2 mt-1 shadow-2xs">
                <Info size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-slate-700 leading-normal">
                  {pres.reorderRecommendation}
                </p>
              </div>
            )}
          </div>

          {/* Card 4: Automation & Service Integration */}
          <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-100/80 space-y-3">
            <div className="flex items-center gap-2 border-b border-purple-200/60 pb-2">
              <Zap size={16} className="text-purple-600" />
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                Auto-Deduct Settings
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Automatic Stock Deduction:</span>
                <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                  item.auto_deduct ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'
                }`}>
                  {item.auto_deduct ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {item.auto_deduct && (
                <>
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-slate-500">Trigger Event:</span>
                    <span className="font-bold text-slate-800 capitalize">{item.auto_deduct_trigger || 'Job Started'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Associated Service:</span>
                    <span className="font-bold text-slate-800">{item.trigger_service || 'All Services'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Deduction Rate:</span>
                    <span className="font-black text-purple-700">-{item.consumption_qty || 0} {item.consumption_unit || item.unit} per order</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
          {onEdit && (
            <Button
              variant="outline"
              className="flex-1 border-amber-400/80 text-amber-700 hover:bg-amber-50 font-bold text-xs py-2 h-10 rounded-xl flex items-center justify-center gap-2 transition-colors"
              onClick={() => {
                onOpenChange(false);
                onEdit(item);
              }}
            >
              <Edit size={14} />
              Edit Inventory Item
            </Button>
          )}
          <Button
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 h-10 rounded-xl transition-colors shadow-md"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

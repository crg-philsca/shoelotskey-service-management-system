import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Input } from '@/app/components/ui/input';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Wallet, Check } from 'lucide-react';
import { API_BASE } from '@/app/lib/apiBase';
import { toast } from 'sonner';

export type ReportType = 'Sales Report' | 'Expenses Report' | 'ROI Report';
export type ReportPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually' | 'Custom';
export type ExportActionType = 'pdf' | 'xlsx' | 'csv' | 'print';

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultReportType?: ReportType;
  defaultPeriod?: ReportPeriod;
  defaultStartDate?: string;
  defaultEndDate?: string;
  userToken: string;
  onPrintReport?: (reportType: ReportType, period: ReportPeriod, start?: string, end?: string) => void;
}

export default function GenerateReportModal({
  isOpen,
  onClose,
  defaultReportType = 'Sales Report',
  defaultPeriod = 'Daily',
  defaultStartDate = '',
  defaultEndDate = '',
  userToken,
  onPrintReport,
}: GenerateReportModalProps) {
  const [reportType, setReportType] = useState<ReportType>(defaultReportType);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>(defaultPeriod);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [selectedFormat, setSelectedFormat] = useState<ExportActionType>('xlsx');
  const [isGenerating, setIsGenerating] = useState<ExportActionType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronous ref lock against button spam / race conditions
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setReportType(defaultReportType);
      setReportPeriod(defaultPeriod);
      setStartDate(defaultStartDate);
      setEndDate(defaultEndDate);
      setErrorMessage(null);
      setIsGenerating(null);
      isGeneratingRef.current = false;
    }
  }, [isOpen, defaultReportType, defaultPeriod, defaultStartDate, defaultEndDate]);

  const validateDates = (): boolean => {
    setErrorMessage(null);
    if (reportPeriod === 'Custom') {
      if (!startDate || !endDate) {
        setErrorMessage('Both Start Date and End Date are required for a Custom date range.');
        return false;
      }
      if (startDate > endDate) {
        setErrorMessage('Start Date cannot be after End Date.');
        return false;
      }
    }
    return true;
  };

  const handleDownloadPDF = async () => {
    if (!validateDates() || isGeneratingRef.current || isGenerating) return;
    isGeneratingRef.current = true;
    setIsGenerating('pdf');
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        report_type: reportType,
        period_type: reportPeriod,
        ...(reportPeriod === 'Custom' && startDate ? { start_date: startDate } : {}),
        ...(reportPeriod === 'Custom' && endDate ? { end_date: endDate } : {}),
      });

      const response = await fetch(`${API_BASE}/reports/export-pdf?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to generate PDF.' }));
        throw new Error(errorData.detail || 'Unable to generate PDF report.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanType = reportType.toLowerCase().replace(/\s+/g, '_');
      a.download = `shoelotskey_${cleanType}_${reportPeriod.toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${reportType} (PDF) downloaded successfully.`);
      onClose();
    } catch (err: any) {
      console.error('[REPORT ERROR] PDF export failed:', err);
      setErrorMessage(err.message || 'Unable to generate PDF. Please try again.');
      toast.error(err.message || 'Report generation failed.');
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(null);
    }
  };

  const handleDownloadXLSX = async () => {
    if (!validateDates() || isGeneratingRef.current || isGenerating) return;
    isGeneratingRef.current = true;
    setIsGenerating('xlsx');
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        report_type: reportType,
        period_type: reportPeriod,
        ...(reportPeriod === 'Custom' && startDate ? { start_date: startDate } : {}),
        ...(reportPeriod === 'Custom' && endDate ? { end_date: endDate } : {}),
      });

      const response = await fetch(`${API_BASE}/reports/export-xlsx?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to generate Excel (.xlsx).' }));
        throw new Error(errorData.detail || 'Unable to generate Excel report.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanType = reportType.toLowerCase().replace(/\s+/g, '_');
      a.download = `shoelotskey_${cleanType}_${reportPeriod.toLowerCase()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${reportType} (Excel .xlsx) downloaded with active formulas.`);
      onClose();
    } catch (err: any) {
      console.error('[REPORT ERROR] Excel export failed:', err);
      setErrorMessage(err.message || 'Unable to generate Excel report. Please try again.');
      toast.error(err.message || 'Report generation failed.');
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(null);
    }
  };

  const handleDownloadCSV = async () => {
    if (!validateDates() || isGeneratingRef.current || isGenerating) return;
    isGeneratingRef.current = true;
    setIsGenerating('csv');
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        report_type: reportType,
        period_type: reportPeriod,
        ...(reportPeriod === 'Custom' && startDate ? { start_date: startDate } : {}),
        ...(reportPeriod === 'Custom' && endDate ? { end_date: endDate } : {}),
      });

      const response = await fetch(`${API_BASE}/reports/export-csv?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to generate CSV.' }));
        throw new Error(errorData.detail || 'Unable to generate CSV report.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanType = reportType.toLowerCase().replace(/\s+/g, '_');
      a.download = `shoelotskey_${cleanType}_${reportPeriod.toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${reportType} (CSV spreadsheet-friendly text) downloaded successfully.`);
      onClose();
    } catch (err: any) {
      console.error('[REPORT ERROR] CSV export failed:', err);
      setErrorMessage(err.message || 'Unable to generate CSV. Please try again.');
      toast.error(err.message || 'Report generation failed.');
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(null);
    }
  };

  const handlePrint = () => {
    if (!validateDates() || isGeneratingRef.current || isGenerating) return;
    isGeneratingRef.current = true;
    setIsGenerating('print');
    onClose();
    setTimeout(() => {
      try {
        if (onPrintReport) {
          onPrintReport(reportType, reportPeriod, startDate, endDate);
        }
      } catch (err: any) {
        console.error('[PRINT ERROR]', err);
      } finally {
        isGeneratingRef.current = false;
        setIsGenerating(null);
      }
    }, 150);
  };

  const executeAction = (action: ExportActionType) => {
    if (action === 'pdf') handleDownloadPDF();
    else if (action === 'xlsx') handleDownloadXLSX();
    else if (action === 'csv') handleDownloadCSV();
    else if (action === 'print') handlePrint();
  };

  const exportOptions: Array<{
    id: ExportActionType;
    emoji: string;
    label: string;
    sublabel: string;
    badge?: string;
    badgeColor?: string;
  }> = [
    {
      id: 'pdf',
      emoji: '📄',
      label: 'Download PDF',
      sublabel: 'Official signed document',
      badge: 'PDF',
      badgeColor: 'bg-red-100 text-red-700 border-red-200'
    },
    {
      id: 'xlsx',
      emoji: '📊',
      label: 'Download Excel (.xlsx)',
      sublabel: 'Official live Excel formulas',
      badge: 'Live Formulas',
      badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    },
    {
      id: 'csv',
      emoji: '📋',
      label: 'Download CSV',
      sublabel: 'Spreadsheet-friendly plain text',
      badge: 'CSV',
      badgeColor: 'bg-blue-100 text-blue-700 border-blue-200'
    },
    {
      id: 'print',
      emoji: '🖨️',
      label: 'Print Report',
      sublabel: 'Direct printer or paper output',
      badge: 'Print',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isGenerating && !isGeneratingRef.current) onClose(); }}>
      <DialogContent 
        closeClassName="top-4 right-4 bg-white/20 text-white hover:bg-white/30 border-white/30 hover:border-white/50 shadow-none"
        className="w-[calc(100vw-1.5rem)] sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-2xl flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 text-white shrink-0 pr-14">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm text-xl">
              📊
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase tracking-tight text-white m-0">
                Generate Report
              </DialogTitle>
              <DialogDescription className="text-xs text-red-100 font-medium mt-0.5">
                Export business performance records and financial analytics
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Report Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">
              Report Type
            </label>
            <Select value={reportType} onValueChange={(val) => setReportType(val as ReportType)}>
              <SelectTrigger className="w-full h-11 rounded-xl border border-gray-300 font-bold text-sm focus:ring-2 focus:ring-red-500">
                <SelectValue placeholder="Select Report Type" />
              </SelectTrigger>
              <SelectContent className="bg-white rounded-xl shadow-lg border border-gray-200">
                <SelectItem value="Sales Report" className="cursor-pointer font-bold text-sm py-2.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span>Sales Report</span>
                  </div>
                </SelectItem>
                <SelectItem value="Expenses Report" className="cursor-pointer font-bold text-sm py-2.5">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-orange-600" />
                    <span>Expenses Report</span>
                  </div>
                </SelectItem>
                <SelectItem value="ROI Report" className="cursor-pointer font-bold text-sm py-2.5">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-blue-600" />
                    <span>ROI Report</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Report Period Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">
              Report Period
            </label>
            <Select value={reportPeriod} onValueChange={(val) => setReportPeriod(val as ReportPeriod)}>
              <SelectTrigger className="w-full h-11 rounded-xl border border-gray-300 font-bold text-sm focus:ring-2 focus:ring-red-500">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent className="bg-white rounded-xl shadow-lg border border-gray-200">
                <SelectItem value="Daily" className="cursor-pointer font-bold text-sm">Daily</SelectItem>
                <SelectItem value="Weekly" className="cursor-pointer font-bold text-sm">Weekly</SelectItem>
                <SelectItem value="Monthly" className="cursor-pointer font-bold text-sm">Monthly</SelectItem>
                <SelectItem value="Quarterly" className="cursor-pointer font-bold text-sm">Quarterly</SelectItem>
                <SelectItem value="Annually" className="cursor-pointer font-bold text-sm">Annually</SelectItem>
                <SelectItem value="Custom" className="cursor-pointer font-bold text-sm">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {reportPeriod === 'Custom' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100 animate-in fade-in duration-300">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 text-xs font-semibold bg-white border-gray-300 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 text-xs font-semibold bg-white border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* EXPORT / GENERATE REPORT Options Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                EXPORT / GENERATE REPORT
              </label>
              <span className="text-[10px] font-bold text-slate-400">
                Select format or 1-click action
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {exportOptions.map((opt) => {
                const isSelected = selectedFormat === opt.id;
                const isLoadingThis = isGenerating === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedFormat(opt.id);
                    }}
                    onDoubleClick={() => {
                      executeAction(opt.id);
                    }}
                    disabled={isGenerating !== null}
                    className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-red-600 bg-red-50/40 shadow-xs ring-1 ring-red-500'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50'
                    } ${isGenerating !== null ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between w-full mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">{opt.emoji}</span>
                        <span className="text-xs font-bold text-slate-900 tracking-tight">
                          {opt.label}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="h-4 w-4 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-500 font-medium truncate pr-1">
                        {opt.sublabel}
                      </span>
                      {opt.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 ${opt.badgeColor}`}>
                          {opt.badge}
                        </span>
                      )}
                    </div>

                    {isLoadingThis && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-red-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Exporting...</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with Selected Format Action */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isGenerating !== null}
            className="w-1/3 h-11 rounded-xl font-bold text-xs uppercase tracking-wider border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={() => executeAction(selectedFormat)}
            disabled={isGenerating !== null}
            className="w-2/3 h-11 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            {isGenerating !== null ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-sm select-none">
                {exportOptions.find(o => o.id === selectedFormat)?.emoji || '⚡'}
              </span>
            )}
            <span>
              {isGenerating !== null
                ? 'Generating...'
                : exportOptions.find(o => o.id === selectedFormat)?.label || 'Generate Report'}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Card, CardContent } from '@/app/components/ui/card';
import { Calendar } from '@/app/components/ui/calendar';
import { useMemo, useState } from 'react';
import { mockJobOrders } from '@/app/lib/mockData';
import { Calendar as CalendarIcon, Package, User, CreditCard } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ClipboardList, FileText } from 'lucide-react';
import ClaimMonitoringModal from '@/app/components/ClaimMonitoringModal';

interface CalendarViewProps {
  onSetHeaderActionRight?: (node: React.ReactNode) => void;
}

export default function CalendarView({ onSetHeaderActionRight }: CalendarViewProps) {
  const navigate = useNavigate();
  const forReleaseOrders = mockJobOrders.filter(job => job.status === 'for-release');

  // Collect unique predicted completion dates for release orders so we can highlight them and default to the first one.
  const releaseDates = useMemo(() => {
    const dates = forReleaseOrders
      .map(job => job.predictedCompletionDate)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime());

    return Array.from(new Map(dates.map(d => [d.toDateString(), d])).values());
  }, [forReleaseOrders]);

  const [date, setDate] = useState<Date | undefined>(releaseDates[0] ?? new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [isClaimRecordOpen, setIsClaimRecordOpen] = useState(false);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate ?? date);
    setCurrentPage(1);
  };

  const jobsOnDate = forReleaseOrders.filter(job => {
    if (!date || !job.predictedCompletionDate) return false;
    return isSameDay(job.predictedCompletionDate, date);
  });

  const sortedJobsOnDate = [...jobsOnDate].sort((a, b) => {
    const priorityOrder = { rush: 0, premium: 1, regular: 2 };
    return (priorityOrder[a.priorityLevel] ?? 2) - (priorityOrder[b.priorityLevel] ?? 2);
  });

  const totalPages = Math.ceil(sortedJobsOnDate.length / itemsPerPage);
  const paginatedJobs = sortedJobsOnDate.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (onSetHeaderActionRight) {
      onSetHeaderActionRight(
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsClaimRecordOpen(true)}
            className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold h-9 px-4 shadow-sm transition-all"
          >
            <FileText className="h-4 w-4 mr-0" />
            Record Claim
          </Button>
          <Button
            onClick={() => navigate('/dashboard', { state: { status: 'for-release' } })}
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-4 shadow-sm transition-all"
          >
            <ClipboardList className="h-4 w-4 mr-0" />
            Release Table
          </Button>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, navigate]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Card className="shadow-lg border-gray-200 overflow-hidden min-h-[480px] flex flex-col">
        <CardContent className="p-0 flex flex-col lg:flex-row flex-1">
          {/* Sidebar - Calendar - Narrower now and aligned with main header */}
          <div className="w-full lg:w-[240px] border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/30 flex flex-col">
            {/* Aligned Sidebar Header */}
            <div className="p-4 border-b border-gray-200 flex items-center h-[65px]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-red-600 rounded-full"></div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Select Release Date</h3>
              </div>
            </div>

            <div className="flex-1 p-4 flex flex-col justify-center items-center">
              <div className="w-full max-w-[220px]">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateChange}
                  modifiers={{ releaseDay: releaseDates }}
                  modifiersClassNames={{
                    releaseDay:
                      'relative after:content-[""] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-red-600 font-bold text-red-700'
                  }}
                  classNames={{
                    head_cell: 'text-[10px] font-bold rounded-md w-8 text-gray-400 uppercase py-2',
                    caption_label: 'text-base font-black text-red-600 uppercase tracking-tight',
                    table: 'w-full border-collapse',
                    months: 'w-full',
                    day: 'h-8 w-8 p-0 font-bold transition-all hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center justify-center text-xs',
                    day_selected: 'bg-red-600 text-white hover:bg-red-700 hover:text-white rounded-md shadow-sm',
                    day_today: 'bg-red-50 text-red-600 border border-red-200',
                    nav_button: 'hover:bg-red-50 text-red-600 rounded-full h-7 w-7 flex items-center justify-center transition-colors',
                  }}
                  className="p-0"
                />

                <div className="mt-6 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600"></div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Guide</span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                    Dates marked with a <span className="text-red-600 font-bold">dot</span> signify releases.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Orders List - Wider now */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-4 border-b border-gray-200 flex items-center justify-center relative bg-white/50 backdrop-blur-sm sticky top-0 z-10 h-[56px]">
              <div className="flex flex-col items-center text-center">
                <h3 className="text-lg font-black text-red-600 uppercase tracking-tight flex items-center justify-center gap-3">
                  <CalendarIcon className="h-5 w-5 stroke-[2.5]" />
                  {date?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} ({date?.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()})
                </h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-[0.05em]">Release Schedule Overview</p>
              </div>
              <div className="hidden md:flex absolute right-4 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 items-center gap-2">
                <span className="text-[11px] font-black">{sortedJobsOnDate.length}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest">{sortedJobsOnDate.length === 1 ? 'Order' : 'Orders'}</span>
              </div>
            </div>

            <div className="flex-1 p-4 pr-4 overflow-y-scroll max-h-[440px] flex flex-col scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              {sortedJobsOnDate.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                    <Package size={40} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 font-black uppercase tracking-widest text-sm">No Orders Scheduled</p>
                    <p className="text-xs text-gray-400 font-medium">Try selecting a date marked with a red indicator.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 align-start content-start">
                    {paginatedJobs.map(job => (
                      <div key={job.id} className="group border border-red-100/60 rounded-2xl p-3 hover:border-red-300 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 bg-white relative overflow-hidden flex flex-col h-full ring-1 ring-transparent hover:ring-red-50">
                        {/* Order Number Header - Centered Value Only */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-gray-800 tracking-tight leading-none pt-1">{job.orderNumber}</span>
                        </div>

                        <div className="border-t border-gray-200 my-1.5"></div>

                        <div className="space-y-3 flex-1 flex flex-col justify-center py-1">
                          {/* Customer Info */}
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                              <User size={12} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Customer Name</p>
                              <p className="text-[11px] font-bold text-gray-700 leading-tight break-words">{job.customerName}</p>
                            </div>
                          </div>

                          {/* Service Type */}
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                              <Package size={12} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Service Type</p>
                              <p className="text-[11px] font-bold text-gray-600 leading-tight">
                                {Array.isArray(job.baseService)
                                  ? job.baseService.map(s => s.replace(' (with basic cleaning)', '')).join(', ')
                                  : String(job.baseService).replace(' (with basic cleaning)', '')}
                              </p>
                            </div>
                          </div>

                          {/* Payment Status row */}
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <CreditCard size={12} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Payment Status</p>
                              <p className={`text-[9px] font-black uppercase tracking-tight ${job.paymentStatus === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                                {job.paymentStatus}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 my-1.5"></div>

                        {/* Footer with Priority Badge */}
                        <div className="flex items-center justify-center pb-0.5">
                          {(() => {
                            let badgeClass = '';
                            if (job.priorityLevel === 'rush') {
                              badgeClass = 'bg-red-100 text-red-700 border-red-200';
                            } else if (job.priorityLevel === 'regular') {
                              badgeClass = 'bg-green-100 text-green-700 border-green-200';
                            } else {
                              badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
                            }
                            return (
                              <span className={`px-3 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${badgeClass}`}>
                                {job.priorityLevel}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Pagination - Always visible at bottom-right, matching dashboard style */}
            <div className="p-3 border-t border-gray-200 bg-white flex items-center justify-between mt-auto">
              <div className="text-xs text-gray-500 font-medium">
                Showing {sortedJobsOnDate.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, sortedJobsOnDate.length)} of {sortedJobsOnDate.length} releases
              </div>
              <div className="flex justify-end">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`w-8 h-8 ${currentPage === 1 ? 'bg-gray-400 text-white border-gray-400' : 'bg-white border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 shadow-sm'}`}
                  >
                    &lt;
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 p-0 text-[10px] font-bold transition-all ${currentPage === page ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 shadow-sm'}`}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`w-8 h-8 ${currentPage === totalPages || totalPages === 0 ? 'bg-gray-400 text-white border-gray-400' : 'bg-white border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 shadow-sm'}`}
                  >
                    &gt;
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      <ClaimMonitoringModal
        isOpen={isClaimRecordOpen}
        onClose={() => setIsClaimRecordOpen(false)}
      />
    </div >
  );
}


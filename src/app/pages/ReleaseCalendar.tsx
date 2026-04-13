import { Card, CardContent } from '@/app/components/ui/card';
import { Calendar } from '@/app/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Label } from '@/app/components/ui/label';
import { useMemo, useState, useEffect } from 'react';
import { useServices } from '@/app/context/ServiceContext';
import { useOrders } from '@/app/context/OrderContext';
import { Calendar as CalendarIcon, Package, User, Wallet, ClipboardList, FileText, ChevronLeft, ChevronRight, Search, Filter, Phone, MapPin, Tag, Clock, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { JobOrder } from '@/app/types';

interface ReleaseCalendarProps {
  onSetHeaderActionRight?: (node: React.ReactNode) => void;
  user: { token: string };
}

export default function ReleaseCalendar({ onSetHeaderActionRight, user }: ReleaseCalendarProps) {
  const navigate = useNavigate();
  const { services } = useServices();
  const { orders, loading } = useOrders();

  // FILTER: Only show orders ready for release
  const forReleaseOrders = orders.filter((job: JobOrder) => job.status === 'for-release');

  /**
   * MEMO: releaseDates
   * Identifies all unique dates where orders are scheduled for release.
   * This is used to add "dot indicators" to the calendar component.
   */
  const releaseDates = useMemo(() => {
    const dates = forReleaseOrders
      .map((job: JobOrder) => job.predictedCompletionDate)
      .filter((d: any): d is Date => Boolean(d))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    return Array.from(new Map(dates.map((d: Date) => [d.toDateString(), d])).values());
  }, [forReleaseOrders]);

  const [date, setDate] = useState<Date | undefined>(releaseDates[0] ?? new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterServiceType, setFilterServiceType] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);
  const itemsPerPage = 15;

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate ?? date);
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
   * Dynamically filters orders based on the clicked calendar date 
   * and additional UI filters (Priority, Payment, Service Type).
   */
  const jobsOnDate = forReleaseOrders.filter((job: JobOrder) => {
    if (!date || !job.predictedCompletionDate) return false;
    const matchesDate = isSameDay(job.predictedCompletionDate, date);
    if (!matchesDate) return false;

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
            variant="outline"
            className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-200 bg-white px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-red-600 shadow-none transition hover:bg-red-50 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
          >
            <FileText className="h-4 w-4 sm:mr-2 shrink-0 text-red-600" />
            <span className="hidden sm:inline">Claim Record</span>
          </Button>
          <Button
            onClick={() => navigate('/dashboard', { state: { status: 'for-release' } })}
            className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
          >
            <ClipboardList className="h-4 w-4 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline">Release Table</span>
          </Button>
        </div>
      );
    }
    return () => onSetHeaderActionRight?.(null);
  }, [onSetHeaderActionRight, navigate]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Card className="shadow-lg border-gray-200 overflow-hidden flex flex-col">
        <CardContent className="p-0 flex flex-col lg:flex-row flex-1">
          {/* Sidebar - Calendar */}
          <div className="w-full lg:w-[320px] border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/30 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center h-[56px]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-red-600 rounded-full"></div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Select Release Date</h3>
              </div>
            </div>

            <div className="pt-4 px-4 pb-4 flex flex-col items-center">
              <div className="w-full max-w-[280px] flex items-center gap-2">
                <div className="relative group flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 group-focus-within:text-red-600 transition-colors" />
                  <Input
                    type="text"
                    placeholder="Search orders"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 bg-white border-gray-200 text-[10px] font-bold h-8 rounded-lg focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 placeholder:text-gray-400 tracking-wider transition-all shadow-sm w-full"
                  />
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 w-8 p-0 flex items-center justify-center border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 bg-white focus:ring-red-600 focus:ring-offset-0 rounded-lg transition-all shadow-sm">
                      <Filter className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="end">
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
                                <SelectItem value="fully-paid" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Paid</SelectItem>
                                <SelectItem value="downpayment" className="text-xs focus:bg-red-50 focus:text-red-900 cursor-pointer">Unpaid</SelectItem>
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
                            setCurrentPage(1);
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          className="flex-1 h-8 text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => document.body.click()}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex-1 px-4 pb-4 pt-0 flex flex-col justify-center items-center">
              <div className="w-full max-w-[280px] flex flex-col justify-center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateChange}
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

          {/* Main Content - Orders List */}
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

            <div className="flex-1 p-4 pr-4 overflow-y-scroll min-h-[440px] max-h-[440px] flex flex-col scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              {loading ? (
                <div className="h-full flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
                </div>
              ) : sortedJobsOnDate.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                    <Package size={40} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 font-black uppercase tracking-widest text-sm">
                      {searchTerm ? 'No matching orders' : 'No Releases Scheduled'}
                    </p>
                    <p className="text-xs text-gray-400 font-medium">
                      {searchTerm
                        ? `We couldn't find any orders matching "${searchTerm}" for this date.`
                        : 'Try selecting a date marked with a red indicator.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 align-start content-start">
                  {paginatedJobs.map(job => (
                    <div
                      key={job.id}
                      className="group border border-red-100/60 rounded-2xl px-2 py-3 hover:border-red-300 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 bg-white relative overflow-hidden flex flex-col h-full ring-1 ring-transparent hover:ring-red-50 cursor-pointer"
                      onClick={() => setSelectedOrder(job)}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-black text-gray-800 tracking-tighter leading-none pt-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-0.5">{job.orderNumber}</span>
                      </div>

                      <div className="border-t border-gray-200 my-1.5"></div>

                      <div className="space-y-3 flex-1 flex flex-col justify-center py-1">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            <User size={12} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Customer Name</p>
                            <p className="text-[11px] font-bold text-gray-700 leading-tight break-words">{job.customerName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                            <Package size={12} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Service Type</p>
                            <p className="text-[11px] font-bold text-gray-600 leading-tight">
                              {Array.isArray(job.baseService)
                                ? job.baseService.map((s: string) => s.replace(' (with basic cleaning)', '')).join(', ')
                                : String(job.baseService).replace(' (with basic cleaning)', '')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Wallet size={12} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Payment Status</p>
                            <p className={`text-[9px] font-black uppercase tracking-tight ${job.paymentStatus === 'fully-paid' ? 'text-green-600' : 'text-red-500'}`}>
                              {job.paymentStatus === 'fully-paid' ? 'Fully Paid' : job.paymentStatus === 'downpayment' ? 'Downpayment' : job.paymentStatus.charAt(0).toUpperCase() + job.paymentStatus.slice(1)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 my-1.5"></div>

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
              )}
            </div>

            {totalPages > 0 && (
              <div className="pt-1.5 pb-1 border-t border-gray-100 bg-white flex items-center justify-between px-5">
                <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                  PAGE {currentPage} OF {totalPages}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`h-8 w-8 p-0 rounded-lg transition-all border ${currentPage === 1
                      ? 'bg-gray-50 text-gray-300 border-gray-100'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
                      }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 overflow-x-auto max-w-[400px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent py-0.5 pb-2 px-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 p-0 text-[11px] font-bold rounded-lg flex-shrink-0 transition-all ${currentPage === page
                            ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm'
                            : 'bg-white border-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                            }`}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`h-8 w-8 p-0 rounded-lg transition-all border ${currentPage === totalPages || totalPages === 0
                      ? 'bg-gray-50 text-gray-300 border-gray-100'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
                      }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Order Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="max-w-md bg-white">
              <DialogHeader className="border-b border-gray-100 pb-4">
                  <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
                      Order #
                      <span className="bg-gray-100/80 px-3 py-1 rounded-full text-sm text-gray-700">{selectedOrder?.orderNumber}</span>
                  </DialogTitle>
              </DialogHeader>

              {selectedOrder && (
                  <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto px-1 pr-2 no-scrollbar">
                      {/* Customer Section */}
                      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                              <User size={16} className="text-red-500" />
                              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Customer Details</h4>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Customer Name</Label>
                                  <p className="text-sm font-bold text-gray-800">{selectedOrder.customerName}</p>
                              </div>
                              <div>
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Contact Number</Label>
                                  <div className="flex items-center gap-2">
                                      <Phone size={12} className="text-gray-400" />
                                      <p className="text-sm font-bold text-gray-800">{selectedOrder.contactNumber}</p>
                                  </div>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/50">
                              <div>
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order Date</Label>
                                  <div className="flex items-center gap-2">
                                      <CalendarIcon size={12} className="text-gray-400" />
                                      <p className="text-sm font-bold text-gray-800">
                                          {(() => {
                                              const d = new Date(selectedOrder.transactionDate || selectedOrder.createdAt);
                                              return isNaN(d.getTime()) ? '-' : format(d, 'MM/dd/yy HH:mm');
                                          })()}
                                      </p>
                                  </div>
                              </div>
                              <div>
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Release Date</Label>
                                  <div className="flex items-center gap-2">
                                      <Clock size={12} className="text-gray-400" />
                                      <p className="text-sm font-bold text-gray-800">
                                          {(() => {
                                              if (!selectedOrder.predictedCompletionDate) return '-';
                                              const d = new Date(selectedOrder.predictedCompletionDate);
                                              return isNaN(d.getTime()) ? '-' : format(d, 'MM/dd/yy');
                                          })()}
                                          {['for-release', 'claimed'].includes(selectedOrder.status) && selectedOrder.releaseTime && (
                                              <span className="text-xs text-gray-500 ml-1 font-normal">
                                                  @ {selectedOrder.releaseTime}
                                              </span>
                                          )}
                                      </p>
                                  </div>
                              </div>
                          </div>

                          {/* Shipping Details */}
                          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3 mt-2">
                              <div className="flex items-center gap-2 mb-2">
                                  <Truck size={16} className="text-red-500" />
                                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Shipping Details</h4>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Preference</Label>
                                      <p className="text-sm font-bold text-gray-800 uppercase">{selectedOrder.shippingPreference || 'Pickup'}</p>
                                  </div>
                                  {selectedOrder.shippingPreference === 'delivery' && selectedOrder.deliveryCourier && (
                                      <div>
                                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Courier</Label>
                                          <div className="flex items-center gap-2">
                                              <p className="text-sm font-bold text-gray-800">{selectedOrder.deliveryCourier}</p>
                                          </div>
                                      </div>
                                  )}
                              </div>

                              {selectedOrder.shippingPreference === 'delivery' && (
                                  <div className="pt-2 border-t border-gray-200/50">
                                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Full Delivery Address</Label>
                                      <div className="flex items-start gap-2">
                                          <MapPin size={12} className="text-gray-400 mt-0.5" />
                                          <p className="text-sm font-medium text-gray-600 leading-snug">{selectedOrder.deliveryAddress || 'No address provided'}</p>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Items Loop */}
                      <div className="space-y-4">
                          {(selectedOrder.items?.length ? selectedOrder.items : [selectedOrder]).map((item: any, index: number) => (
                              <div key={index} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                                  <div className="flex items-center gap-2 mb-2">
                                      <Tag size={16} className="text-red-500" />
                                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                          {(selectedOrder.items?.length || 0) > 1 ? `Item #${index + 1} Details` : 'Shoe & Service Details'}
                                      </h4>
                                  </div>

                                  {/* Shoe Details */}
                                  <div className="grid grid-cols-3 gap-4">
                                      <div>
                                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Brand</Label>
                                          <p className="text-sm font-bold text-gray-800">{item.brand || '-'}</p>
                                      </div>
                                      <div>
                                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Material</Label>
                                          <p className="text-sm font-bold text-gray-800">{item.shoeMaterial || '-'}</p>
                                      </div>
                                      <div>
                                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Quantity</Label>
                                          <p className="text-sm font-bold text-gray-800">{item.quantity || 1} {(item.quantity || 1) === 1 ? 'Pair' : 'Pairs'}</p>
                                      </div>
                                  </div>

                                  {/* Shoe Condition */}
                                  <div className="pt-2 border-t border-gray-200/50">
                                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Shoe Condition</Label>
                                      <div className="flex flex-wrap gap-1.5">
                                          {Object.entries(item.condition || {}).map(([key, value]) => {
                                              if (key === 'others' && value) return <span key={key} className="px-2 py-1 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 shadow-sm">Note: {String(value)}</span>;
                                              if (value === true) {
                                                  const labels: Record<string, string> = {
                                                      scratches: 'Scratches',
                                                      yellowing: 'Yellowing',
                                                      ripsHoles: 'Rips/Holes',
                                                      deepStains: 'Deep Stains',
                                                      soleSeparation: 'Sole Separation',
                                                      wornOut: 'Faded/Worn'
                                                  };
                                                  const label = labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                                  return <span key={key} className="px-2 py-1 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600">{label}</span>;
                                              }
                                              return null;
                                          })}
                                          {Object.values(item.condition || {}).every(v => !v) && <p className="text-xs text-slate-400 italic">No conditions applied</p>}
                                      </div>
                                  </div>

                                  {/* Service Details for this Item */}
                                  <div className="pt-2 border-t border-gray-200/50">
                                      <div className="grid grid-cols-2 gap-4">
                                          <div>
                                              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Base Service</Label>
                                              <p className="text-sm font-bold text-gray-800">
                                                  {Array.isArray(item.baseService)
                                                      ? item.baseService.map((s: string) => s.replace(' (with basic cleaning)', '')).join(', ')
                                                      : String(item.baseService).replace(' (with basic cleaning)', '')}
                                              </p>
                                          </div>

                                          {item.addOns && item.addOns.length > 0 && (
                                              <div>
                                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Add-ons</Label>
                                                  <div className="space-y-1">
                                                      {item.addOns.map((addon: any, idx: number) => (
                                                          <div key={idx} className="flex items-center justify-between text-sm">
                                                              <span className="font-medium text-gray-700">• {addon.name}</span>
                                                              <span className="text-gray-500 text-xs font-bold">x{addon.quantity}</span>
                                                          </div>
                                                      ))}
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>

                      {/* Order Status & Metadata Summary */}
                      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4 mt-2">
                          <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-200/50">
                              <div>
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order Status</Label>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border
                                      ${selectedOrder.status === 'new-order' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                          selectedOrder.status === 'on-going' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                              selectedOrder.status === 'for-release' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                  selectedOrder.status === 'claimed' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                                                      'bg-red-50 text-red-700 border-red-100'
                                      }`}>
                                      {selectedOrder.status.replace('-', ' ')}
                                  </span>
                              </div>
                              <div className="text-right">
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Priority Level</Label>
                                  {selectedOrder.priorityLevel === 'rush' ? (
                                      <span className="text-xs font-black text-red-600 uppercase">RUSH</span>
                                  ) : (
                                      <span className="text-xs font-bold text-gray-800 capitalize">{selectedOrder.priorityLevel}</span>
                                  )}
                              </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 items-center">
                              <div>
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Order ID</Label>
                                  <p className="text-sm font-bold text-gray-700">#{selectedOrder.orderNumber}</p>
                              </div>
                              <div>
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Processed By</Label>
                                  <p className="text-sm font-bold text-gray-700">{selectedOrder.processedBy || 'Current User'}</p>
                              </div>
                              <div className="text-right">
                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Payment Status</Label>
                                  <span className={`text-sm font-black uppercase ${selectedOrder.paymentStatus === 'fully-paid' ? 'text-green-600' :
                                      selectedOrder.paymentStatus === 'downpayment' ? 'text-yellow-600' : 'text-red-500'
                                      }`}>
                                      {selectedOrder.paymentStatus === 'fully-paid' ? 'Fully Paid' : selectedOrder.paymentStatus === 'downpayment' ? 'Downpayment' : selectedOrder.paymentStatus?.replace('-', ' ')?.replace(/\b\w/g, l => l.toUpperCase())}
                                  </span>
                              </div>
                          </div>
                      </div>

                      {/* Payment Section */}
                      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                              <Wallet size={16} className="text-red-500" />
                              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Payment Details</h4>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              {selectedOrder.paymentMethod && selectedOrder.paymentStatus !== 'downpayment' && (
                                  <div>
                                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Method</Label>
                                      <p className="text-sm font-bold text-gray-800 uppercase">
                                          {selectedOrder.paymentMethod || '-'}
                                      </p>
                                  </div>
                              )}
                              {['gcash', 'maya'].includes(selectedOrder.paymentMethod?.toLowerCase()) && (selectedOrder.paymentStatus === 'fully-paid' || selectedOrder.paymentStatus === 'downpayment') && (
                                  <div className="col-span-2">
                                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Reference Number</Label>
                                      <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">{selectedOrder.referenceNo || '-'}</p>
                                  </div>
                              )}
                              {selectedOrder.paymentStatus && (
                                  <>
                                      <div>
                                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Amount Received</Label>
                                          <p className="text-sm font-bold text-gray-800">₱{(selectedOrder.amountReceived || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                      </div>
                                      {selectedOrder.change !== undefined && selectedOrder.change > 0 && (
                                          <div className="col-span-2 pt-2 border-t border-gray-100 mt-1">
                                              <div className="flex justify-between items-center">
                                                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Customer Change</Label>
                                                  <p className="text-sm font-bold text-green-600 underline decoration-dotted underline-offset-4">
                                                      ₱{(selectedOrder.change || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </p>
                                              </div>
                                          </div>
                                      )}
                                  </>
                              )}
                              {selectedOrder.paymentStatus !== 'fully-paid' && (
                                  <div className="pt-2 border-t border-gray-200/50 col-span-2 flex justify-between items-center">
                                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Remaining Balance</Label>
                                      <p className={`text-sm font-black ${((selectedOrder.grandTotal || 0) - (selectedOrder.amountReceived || 0)) > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                                          ₱{Math.max(0, (selectedOrder.grandTotal || 0) - (selectedOrder.amountReceived || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Pricing Summary */}
                      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-2 mt-2" style={{ marginBottom: '16px' }}>
                          <div className="flex justify-between items-center text-gray-600/80">
                              <span className="text-xs font-medium uppercase tracking-wide">Total Quantity</span>
                              <span className="text-sm font-bold text-gray-800">{selectedOrder.quantity || 1} {(selectedOrder.quantity || 1) === 1 ? 'Pair' : 'Pairs'}</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-600/80">
                              <span className="text-xs font-medium uppercase tracking-wide">Base Service Fee</span>
                              <span className="text-sm font-bold text-gray-800">₱{(selectedOrder.baseServiceFee || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-600/80">
                              <span className="text-xs font-medium uppercase tracking-wide">Add-ons Total</span>
                              <span className="text-sm font-bold text-gray-800">₱{(selectedOrder.addOnsTotal || 0).toFixed(2)}</span>
                          </div>
                          {selectedOrder.priorityLevel === 'rush' && (
                              <div className="flex justify-between items-center text-gray-600/80">
                                  <span className="text-xs font-medium uppercase tracking-wide">Rush Fee</span>
                                  <span className="text-sm font-bold text-gray-800">₱{(selectedOrder.grandTotal - ((selectedOrder.baseServiceFee || 0) + (selectedOrder.addOnsTotal || 0))).toFixed(2)}</span>
                              </div>
                          )}
                          <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-2">
                              <span className="text-base font-black text-gray-900 uppercase tracking-tight">Grand Total</span>
                              <span className="text-lg font-black text-red-600 tracking-tight">₱{(selectedOrder.grandTotal || 0).toFixed(2)}</span>
                          </div>
                      </div>

                  </div>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}

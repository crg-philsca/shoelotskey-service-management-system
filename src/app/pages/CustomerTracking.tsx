import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { 
  Package, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Phone, 
  AlertCircle,
  ExternalLink,
  CreditCard,
  Copy,
  Check,
  MessageSquare,
  ClipboardList,
  Clock,
  PackageCheck,
  HelpCircle,
  Info,
  RotateCw,
  QrCode
} from 'lucide-react';
import { format as dateFnsFormat } from 'date-fns';
import { API_BASE, STATIC_BASE } from '@/app/lib/apiBase';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/app/components/ui/dropdown-menu';

// Custom inline Shoe / Footwear Icon for the live tracking point & claimed stage
function ShoeIcon({ className = "w-4 h-4", size, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg 
      className={className} 
      width={size}
      height={size}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Sole */}
      <path d="M2.5 16.5h19a1.5 1.5 0 0 1 1.5 1.5v.5a1.5 1.5 0 0 1-1.5 1.5H3.5a1.5 1.5 0 0 1-1.5-1.5v-.5a1.5 1.5 0 0 1 .5-1.5z" fill="currentColor" fillOpacity="0.25" />
      {/* Upper shoe silhouette */}
      <path d="M3.5 16.5v-3a2.5 2.5 0 0 1 1.2-2.1l4.8-3a2 2 0 0 1 1.1-.4h3.6a2 2 0 0 1 1.7 1l2.3 3.5h2.3a2.5 2.5 0 0 1 2.5 2.5v1.5" />
      <path d="M10 10.5l1.5 3" />
      <path d="M13.5 10.5l1.5 3" />
    </svg>
  );
}

// Moving branded shoe animation from 404 / Page Not Found
function WalkingShoeIllustration({ className = "h-20 sm:h-28" }: { className?: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-2 select-none pointer-events-none">
      {/* Soft ambient glow spotlight behind shoe */}
      <div className="absolute w-48 sm:w-64 h-16 sm:h-20 bg-gradient-to-r from-red-500/10 via-orange-500/15 to-red-500/10 rounded-full blur-2xl -z-10" />
      <div className="animate-shoe-walk flex items-center justify-center">
        <img
          src="/static/branded_shoe_404.png?v=pristine_cutout"
          onError={(e) => {
            const t = e.target as HTMLImageElement;
            if (!t.dataset.retried) {
              t.dataset.retried = 'true';
              t.src = `${STATIC_BASE}/static/branded_shoe_404.png?v=pristine_cutout`;
            } else {
              t.src = '/logo.png';
            }
          }}
          alt="Shoelotskey Live Footwear Tracker"
          className={`${className} w-auto object-contain select-none`}
        />
      </div>
      {/* Floor contact shadow */}
      <div className="w-28 sm:w-36 h-2 bg-slate-400/25 rounded-full mx-auto blur-[2px] mt-1 animate-pulse" />
    </div>
  );
}

interface TrackingItem {
  id: number | string;
  brand: string;
  shoeModel: string;
  material?: string;
  color?: string;
  shoeSize?: string;
  quantity?: number;
  status: string;
  services: string[];
  conditions?: string[];
  notes?: string;
}

interface TrackingData {
  orderNumber: string;
  customerName: string;
  status: string;
  priority: string;
  createdAt: string | null;
  targetDate: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
  fulfillment: string;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  items: TrackingItem[];
  timeline: Array<{
    status: string;
    timestamp: string | null;
  }>;
}

export function CustomerTracking() {
  const [searchParams] = useSearchParams();
  const { orderNumber: pathOrderNumber } = useParams();

  const initialOrderQuery = pathOrderNumber || searchParams.get('order') || '';
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Normalize status strings from database, cache, or events to standard display format
  const mapStatusToPretty = (st?: string | null): string => {
    const s = (st || '').toLowerCase().trim();
    if (s === 'claimed' || s.startsWith('claim')) return 'Claimed';
    if (s === 'for-release' || s === 'for release' || s.includes('release') || s.includes('ready')) return 'For Release';
    if (s === 'on-going' || s === 'ongoing' || s.includes('going') || s.includes('progress') || s === 'in-progress') return 'On-Going';
    return 'New Order';
  };

  const fetchTracking = async (orderId: string, silent = false) => {
    const cleanId = orderId.trim().replace(/^#/, '');
    if (!cleanId) return;

    if (!silent) setLoading(true);
    setErrorMessage(null);

    try {
      // Find local cache match (useful for immediate 0ms sync when staff updates status)
      let localOrder: any = null;
      const rawCaches = [
        localStorage.getItem('jobOrders_v23_cache'),
        localStorage.getItem('shoelotskey_job_orders'),
        localStorage.getItem('jobOrders_cache'),
      ];

      for (const cacheStr of rawCaches) {
        if (!cacheStr) continue;
        try {
          const localOrders = JSON.parse(cacheStr);
          if (Array.isArray(localOrders)) {
            const found = localOrders.find((o: any) => 
              o.orderNumber?.toLowerCase() === cleanId.toLowerCase() ||
              String(o.id) === cleanId
            );
            if (found) {
              localOrder = found;
              break;
            }
          }
        } catch (_) {}
      }

      // 1. Try public backend tracking endpoint with cache-busting timestamp
      const ts = Date.now();
      const fetchOpts: RequestInit = {
        cache: 'no-store',
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      };

      let response: Response | null = null;
      try {
        response = await fetch(`${API_BASE}/orders/track/${encodeURIComponent(cleanId)}?_t=${ts}`, fetchOpts);
      } catch (netErr) {
        console.warn('[TRACKING] Network fetch failed, checking local cache:', netErr);
      }
      
      const isJson = response?.headers.get('content-type')?.includes('application/json');
      if (response && response.ok && isJson) {
        const data = await response.json();
        // If staff updated the order locally more recently than the server's last log, reflect latest state
        if (localOrder) {
          const localPretty = mapStatusToPretty(localOrder.status);
          const localUpdatedTime = localOrder.updatedAt ? new Date(localOrder.updatedAt).getTime() : 0;
          const serverUpdatedTime = data.updatedAt 
            ? new Date(data.updatedAt).getTime() 
            : (data.timeline && data.timeline.length > 0 ? new Date(data.timeline[data.timeline.length - 1].timestamp).getTime() : 0);
          
          if (localUpdatedTime > serverUpdatedTime && localPretty) {
            data.status = localPretty;
          }
        }
        setTrackingData(data);
        return;
      }

      // 2. Fallback check from localStorage (useful for offline local demo & immediate cross-tab POS sync)
      if (localOrder) {
        const match = localOrder;
        const grandTotal = Number(match.grandTotal || 0);
        const isClaimed = match.status === 'claimed';
        const effectivePaid = (match.paymentStatus === 'fully-paid' || isClaimed)
          ? grandTotal
          : Number(match.amountReceived || match.depositAmount || 0);
        const balanceDue = Math.max(0, grandTotal - effectivePaid);

        // Mask customer name
        const rawName = match.customerName || 'Customer';
        const parts = rawName.split(' ');
        const maskedName = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : rawName;

        const fallbackData: TrackingData = {
          orderNumber: match.orderNumber,
          customerName: maskedName,
          status: mapStatusToPretty(match.status),
          priority: match.priorityLevel || 'Regular',
          createdAt: match.createdAt || match.transactionDate || null,
          targetDate: match.predictedCompletionDate || match.targetDate || match.expected_at || null,
          claimedAt: match.claimedAt || null,
          releasedAt: match.actualReleaseDate || null,
          fulfillment: match.shippingPreference || 'Store Pickup',
          grandTotal,
          amountPaid: effectivePaid,
          balanceDue,
          paymentStatus: balanceDue <= 0 ? 'Fully Paid' : effectivePaid > 0 ? 'Partial' : 'Unpaid',
          items: (match.items || [match]).map((it: any, idx: number) => ({
            id: it.id || idx,
            brand: it.brand || 'Footwear',
            shoeModel: it.shoeModel || '',
            material: it.shoeMaterial || '',
            color: it.color || '',
            shoeSize: it.shoeSize || '',
            quantity: it.quantity || 1,
            status: it.status || match.status,
            services: Array.isArray(it.baseService) ? it.baseService : [it.baseService].filter(Boolean),
            conditions: it.condition ? Object.entries(it.condition).filter(([_, v]) => Boolean(v)).map(([k]) => k) : [],
            notes: it.item_notes || it.notes || ''
          })),
          timeline: Array.isArray(match.statusHistory) 
            ? match.statusHistory.map((h: any) => ({
                status: h.status,
                timestamp: h.timestamp
              }))
            : []
        };

        setTrackingData(fallbackData);
        return;
      }

      if (!silent) {
        setErrorMessage(`No order found matching "${cleanId}". Please verify your order number or contact our staff.`);
        setTrackingData(null);
      }
    } catch (err: any) {
      if (!silent) {
        setErrorMessage('Could not connect to tracking server. Please check your connection or contact our shop.');
        setTrackingData(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderQuery) {
      fetchTracking(initialOrderQuery);
    }
  }, [initialOrderQuery]);

  // Real-time live status synchronization:
  // 1. BroadcastChannel across all browser tabs & windows (0ms latency)
  // 2. Window CustomEvent within the same tab/window (0ms latency)
  // 3. Fast live polling every 2.5 seconds with cache-busting
  // 4. StorageEvent for cross-tab localStorage changes
  useEffect(() => {
    if (!trackingData?.orderNumber) return;
    const currentOrderClean = trackingData.orderNumber.toLowerCase().replace(/^#/, '');

    // Background live polling every 2.5s while actively viewing this order
    const interval = setInterval(() => {
      fetchTracking(trackingData.orderNumber, true);
    }, 2500);

    // BroadcastChannel for instant cross-tab updates
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('shoelotskey_orders_channel');
        bc.onmessage = (event) => {
          const { orderNumber, orderId, status } = event.data || {};
          const msgNum = (orderNumber || '').toLowerCase().replace(/^#/, '');
          const msgId = String(orderId || '').toLowerCase().replace(/^#/, '');
          if (msgNum === currentOrderClean || msgId === currentOrderClean) {
            if (status) {
              setTrackingData(prev => prev ? { ...prev, status: mapStatusToPretty(status) } : null);
            }
            fetchTracking(trackingData.orderNumber, true);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    // Window CustomEvent for instantaneous same-tab updates
    const handleCustomEvent = (e: any) => {
      const { orderNumber, orderId, status } = e.detail || {};
      const msgNum = (orderNumber || '').toLowerCase().replace(/^#/, '');
      const msgId = String(orderId || '').toLowerCase().replace(/^#/, '');
      if (msgNum === currentOrderClean || msgId === currentOrderClean) {
        if (status) {
          setTrackingData(prev => prev ? { ...prev, status: mapStatusToPretty(status) } : null);
        }
        fetchTracking(trackingData.orderNumber, true);
      }
    };
    window.addEventListener('shoelotskey:order-status-updated', handleCustomEvent);

    // Standard storage event fallback
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jobOrders_v23_cache' || e.key === 'shoelotskey_job_orders' || e.key === 'jobOrders_cache') {
        fetchTracking(trackingData.orderNumber, true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      window.removeEventListener('shoelotskey:order-status-updated', handleCustomEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [trackingData?.orderNumber]);

  const copyOrderNumber = () => {
    if (!trackingData?.orderNumber) return;
    navigator.clipboard.writeText(trackingData.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine active step (0: New Order, 1: On-Going, 2: For Release, 3: Claimed)
  const getActiveStep = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'claimed' || s === 'claim' || s.startsWith('claim')) return 3;
    if (s === 'for-release' || s === 'for release' || s.includes('release') || s.includes('ready')) return 2;
    if (s === 'on-going' || s === 'ongoing' || s.includes('going') || s.includes('progress') || s === 'in-progress') return 1;
    return 0; // 'new-order' / 'pending' / 'new order'
  };

  const activeStep = trackingData ? getActiveStep(trackingData.status) : 0;

  const steps = [
    { 
      title: 'New Order', 
      desc: 'Order received', 
      icon: ClipboardList,
      activeBg: 'bg-purple-600',
      activeRing: 'ring-purple-600/30',
      activeText: 'text-purple-700',
      doneBg: 'bg-purple-600 text-white border-2 border-white ring-2 ring-purple-600/30',
      pendingBg: 'bg-purple-50 text-purple-400 border-2 border-purple-200',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      lineColor: 'bg-purple-600'
    },
    { 
      title: 'On-Going', 
      desc: 'In progress', 
      icon: Clock,
      activeBg: 'bg-blue-600',
      activeRing: 'ring-blue-600/30',
      activeText: 'text-blue-700',
      doneBg: 'bg-blue-600 text-white border-2 border-white ring-2 ring-blue-600/30',
      pendingBg: 'bg-blue-50 text-blue-400 border-2 border-blue-200',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      lineColor: 'bg-blue-600'
    },
    { 
      title: 'For Release', 
      desc: 'Ready for pickup', 
      icon: PackageCheck,
      activeBg: 'bg-orange-500',
      activeRing: 'ring-orange-500/30',
      activeText: 'text-orange-600',
      doneBg: 'bg-orange-500 text-white border-2 border-white ring-2 ring-orange-500/30',
      pendingBg: 'bg-orange-50 text-orange-400 border-2 border-orange-200',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
      lineColor: 'bg-orange-500'
    },
    { 
      title: 'Claimed', 
      desc: 'Claimed & released', 
      icon: ShoeIcon,
      activeBg: 'bg-slate-700',
      activeRing: 'ring-slate-700/30',
      activeText: 'text-slate-800',
      doneBg: 'bg-slate-700 text-white border-2 border-white ring-2 ring-slate-700/30',
      pendingBg: 'bg-slate-100 text-slate-400 border-2 border-slate-300',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      lineColor: 'bg-slate-700'
    },
  ];

  const formatDisplayDate = (dStr?: string | null) => {
    if (!dStr) return '—';
    try {
      const dt = new Date(dStr);
      if (isNaN(dt.getTime())) return dStr;
      return dateFnsFormat(dt, 'EEEE, MMMM dd, yyyy');
    } catch {
      return dStr;
    }
  };

  return (
    <div 
      id="customer-tracking-page"
      className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-slate-50 text-slate-900 font-sans selection:bg-red-500 selection:text-white pb-28 scroll-smooth"
    >
      
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="w-full px-3.5 sm:px-6 md:px-8 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Logo & Brand Name (Pinned to Far Left on Desktop) */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl border border-red-200 bg-white p-1 shadow-xs ring-2 ring-red-500/10 flex items-center justify-center shrink-0">
              <img 
                src="/logo.png" 
                alt="Shoelotskey Logo" 
                className="h-full w-full object-contain" 
              />
            </div>
            <div className="min-w-0">
              <span className="font-black tracking-wide text-xs sm:text-sm md:text-base text-red-600 uppercase block leading-tight truncate">
                SHOELOTSKEY VILLAMOR-PASAY
              </span>
              <span className="text-[9px] sm:text-[11px] font-bold text-slate-900 uppercase tracking-wider block truncate">
                Shoe Care &amp; Restoration Services
              </span>
            </div>
          </div>

          {/* Right: Facebook & Contact Shop Actions (Pinned to Far Right on Desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Facebook Link */}
            <a 
              href="https://www.facebook.com/p/Shoelotskey-Villamor-Pasay-61578784589539/?_rdc=2&_rdr#" 
              target="_blank" 
              rel="noopener noreferrer"
              title="Visit Shoelotskey Villamor-Pasay Facebook Page"
              className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-blue-200 transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <svg className="w-3.5 h-3.5 fill-current text-blue-600 shrink-0" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="hidden xs:inline sm:inline">Facebook</span>
            </a>

            {/* Phone Call / Message Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  type="button"
                  title="Contact Shop (Call or Message)"
                  className="flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-white bg-red-50 hover:bg-red-600 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-red-200 hover:border-red-600 transition-all shadow-2xs cursor-pointer active:scale-95 group"
                >
                  <Phone size={14} className="text-red-600 group-hover:text-white transition-colors shrink-0" />
                  <span className="hidden xs:inline sm:inline font-black">Contact Shop</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 bg-white rounded-xl shadow-lg border border-red-100 z-50">
                <DropdownMenuItem asChild>
                  <a 
                    href="tel:09566327642"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-700 shrink-0">
                      <Phone size={13} />
                    </div>
                    <div>
                      <span className="block leading-tight font-black text-xs">Call 0956 632 7642</span>
                      <span className="text-[10px] text-slate-500 font-medium">Mon–Sat: 9:00 AM – 7:00 PM</span>
                    </div>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a 
                    href="sms:09566327642"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                      <MessageSquare size={13} />
                    </div>
                    <div>
                      <span className="block leading-tight font-black text-xs">Send SMS / Message</span>
                      <span className="text-[10px] text-slate-500 font-medium">Fast customer support</span>
                    </div>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl xl:max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-7 space-y-6">
        
        {/* If No Order Tracked: Direct QR Scanning Guidance (No Search Bar) */}
        {!trackingData && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-white via-slate-50 to-red-50/40 border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs relative overflow-hidden text-center">
              <div className="max-w-xl mx-auto space-y-4">
                {/* Moving Shoes Animation */}
                <WalkingShoeIllustration />

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Direct Footwear Tracking <span className="text-red-600">Portal</span>
                </h1>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Track your shoe restoration, basic cleaning, and reglue progress live from order received to final claim.
                </p>

                {/* Secure QR Guidance - Manual Search Disabled */}
                <div className="pt-2 pb-1 max-w-md mx-auto">
                  <div className="bg-white border-2 border-dashed border-red-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100 shadow-2xs">
                      <QrCode size={26} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                        Scan Your Claim Slip QR Code
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        To protect customer privacy and order security, manual searching is disabled. Please scan the QR code printed on your official Shoelotskey physical Claim Slip to view your live workshop status.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-2xs text-left">
                    <Info size={16} className="text-red-600 shrink-0" />
                    <span>Point your smartphone camera at the QR code on your physical claim receipt for instant access.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Loading State with Walking Shoes */}
        {loading && !trackingData && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs text-center space-y-3 animate-in fade-in duration-200">
            <WalkingShoeIllustration className="h-20 sm:h-24" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center justify-center gap-2">
                <RotateCw size={14} className="animate-spin text-red-600" />
                <span>Locating Your Footwear...</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Retrieving real-time workshop status for #{initialOrderQuery || 'your order'}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-900 shadow-2xs">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-rose-950">Order Not Found</h4>
              <p className="text-xs text-rose-700 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FINALIZED STATUS TRACKING VIEW (When Order is Loaded)    */}
        {/* ========================================================= */}
        {trackingData && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Top Walking Shoe Showcase & Live Status Header */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-red-50/40 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4 text-center relative overflow-hidden">
              <div className="max-w-xl mx-auto space-y-3">
                <WalkingShoeIllustration className={loading ? "h-20 sm:h-26 scale-105 transition-transform" : "h-18 sm:h-24"} />

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Direct Footwear Tracking <span className="text-red-600">Portal</span>
                </h1>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Track your shoe restoration, basic cleaning, and reglue progress live from order received to final claim.
                </p>

                {loading ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold animate-pulse shadow-2xs">
                    <RotateCw size={13} className="animate-spin text-red-600" />
                    <span>Refreshing Live Workshop Status for #{trackingData.orderNumber}...</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Tracking Active • Workshop Status Synced</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
                <div className="flex items-center gap-2 text-left">
                  <span className="text-xs font-black text-slate-900 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs flex items-center gap-2 font-mono">
                    <ShoeIcon className="w-3.5 h-3.5 text-red-600" />
                    <span>Order #{trackingData.orderNumber}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => trackingData?.orderNumber && fetchTracking(trackingData.orderNumber)}
                    disabled={loading}
                    title="Click to check latest status from shop"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 px-4 py-2 rounded-full shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <RotateCw size={13} className={loading ? "animate-spin text-red-600" : "text-slate-500"} />
                    <span>{loading ? "Refreshing..." : "Refresh Status"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Header Status Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                    ORDER TRACKING NUMBER
                  </span>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                      #{trackingData.orderNumber}
                    </h2>
                    <button
                      onClick={copyOrderNumber}
                      title="Copy Order Number"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Customer: <span className="font-bold text-slate-900">{trackingData.customerName}</span>
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs ${
                    activeStep === 3 
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : activeStep === 2
                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                      : activeStep === 1
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}>
                    <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                    {mapStatusToPretty(trackingData.status)}
                  </span>
                  <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                    {(trackingData.priority || 'REGULAR').toLowerCase().includes('regular') 
                      ? 'REGULAR' 
                      : (trackingData.priority || '').toUpperCase().includes('PRIORITY')
                      ? (trackingData.priority || '').toUpperCase()
                      : `${(trackingData.priority || '').toUpperCase()} PRIORITY`}
                  </span>
                </div>
              </div>

              {/* Visual 4-Stage Progress Stepper */}
              <div className="pt-7 sm:pt-8 pb-1">
                <div className="flex items-center justify-between mb-8 sm:mb-9">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Service Progress
                  </h3>
                  <span className="text-[10px] sm:text-[11px] font-black text-red-700 flex items-center gap-1.5 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 shadow-2xs">
                    <ShoeIcon className="w-3.5 h-3.5 text-red-600" />
                    <span>Live Tracking Point</span>
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 sm:gap-2 relative">
                  {/* Connecting background progress line */}
                  <div className="absolute top-4 xs:top-4.5 sm:top-5.5 left-[12.5%] right-[12.5%] h-1 sm:h-1.5 bg-slate-200 -z-0 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-700 rounded-full ${steps[activeStep]?.lineColor || 'bg-slate-400'}`}
                      style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
                    />
                  </div>

                  {steps.map((step, idx) => {
                    const isDone = idx < activeStep;
                    const isCurrent = idx === activeStep;
                    const StepIcon = step.icon;

                    return (
                      <div key={idx} className="flex flex-col items-center text-center z-10 px-0.5 sm:px-1 relative">
                        {/* Active Tracking Point Shoe Indicator */}
                        {isCurrent && (
                          <div className="absolute -top-7 sm:-top-8.5 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-20 pointer-events-none">
                            <div className="px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-md shadow-red-600/30 whitespace-nowrap border border-red-500 ring-2 ring-red-500/20">
                              <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                                <ShoeIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-600" />
                              </span>
                              <span className="font-black text-white">Footwear Here</span>
                            </div>
                            <div className="w-1.5 h-1.5 bg-red-600 rotate-45 -mt-0.75 border-r border-b border-red-500" />
                          </div>
                        )}

                        {/* Step circle: displays each stage's own icon (never replaces with check icon) */}
                        <div className={`w-8 h-8 xs:w-9 xs:h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-xs ${
                          isCurrent
                            ? `${step.activeBg} text-white border-2 border-white ring-3 sm:ring-4 ${step.activeRing} shadow-md scale-110`
                            : isDone 
                            ? step.doneBg 
                            : step.pendingBg
                        }`}>
                          <StepIcon 
                            className={`w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 ${isCurrent || isDone ? "text-white" : ""}`} 
                            size={18} 
                          />
                        </div>

                        <span className={`text-[9px] xs:text-[10px] sm:text-xs font-black mt-2 sm:mt-2.5 leading-tight text-center break-words ${
                          isCurrent ? step.activeText : isDone ? 'text-slate-900' : 'text-slate-400'
                        }`}>
                          {step.title}
                        </span>
                        <span className="text-[8px] sm:text-[9.5px] text-slate-400 mt-0.5 leading-snug text-center hidden sm:block">
                          {step.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Target Release Date Card */}
            <div className="bg-gradient-to-br from-red-50/90 via-white to-rose-50/50 border border-red-200 rounded-2xl p-5 sm:p-6 shadow-xs text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-widest text-red-700 bg-red-100/90 border border-red-200 px-3 py-1 rounded-full shadow-2xs">
                <Calendar size={13} className="text-red-600" />
                <span>Estimated Release Date (Ready for Pickup)</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {formatDisplayDate(trackingData.targetDate)}
              </p>
              <p className="text-xs text-slate-600 font-medium max-w-md mx-auto leading-relaxed">
                Please present Order <strong className="font-black text-red-600 font-mono bg-red-50 px-2 py-0.5 rounded border border-red-200">#{trackingData.orderNumber}</strong> or claim slip upon claiming your footwear at our shop.
              </p>
            </div>

            {/* Footwear & Services Details */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                    <Package size={14} />
                  </div>
                  <span>Deposited Footwear ({trackingData.items.length} {trackingData.items.length > 1 ? 'Pairs' : 'Pair'})</span>
                </h3>
                <span className="text-[10.5px] font-bold text-slate-500 uppercase">
                  Service Specifications
                </span>
              </div>

              <div className="space-y-3">
                {trackingData.items.map((item, idx) => {
                  const cleanVal = (val?: string) => {
                    if (!val) return '';
                    const trimmed = String(val).trim();
                    if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'other' || trimmed.toLowerCase() === 'none') return '';
                    return trimmed;
                  };

                  const brand = cleanVal(item.brand);
                  const model = cleanVal(item.shoeModel);
                  const material = cleanVal(item.material);
                  const color = cleanVal(item.color);
                  const size = cleanVal(item.shoeSize);

                  return (
                    <div key={item.id || idx} className="border border-slate-100 rounded-xl p-3.5 bg-slate-50/50 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-red-600 text-white font-black text-[10px] flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            {brand || 'Footwear'} {model ? `• ${model}` : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500 font-medium">
                          {material && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{material}</span>}
                          {color && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{color}</span>}
                          {size && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Size: {size}</span>}
                        </div>
                      </div>

                      {/* Services Chips */}
                      {item.services && item.services.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {item.services.map((srv, sIdx) => (
                            <span 
                              key={sIdx}
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-red-700 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-md"
                            >
                              <Sparkles size={11} className="text-red-500" />
                              <span>{srv}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Overview & Balance Due */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                    <CreditCard size={14} />
                  </div>
                  <span>Payment & Balance Overview</span>
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  trackingData.balanceDue <= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {trackingData.paymentStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                    Total Services & Products
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    ₱{trackingData.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                    Amount Paid
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-600">
                    ₱{trackingData.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                    Balance Due Upon Claim
                  </span>
                  <span className={`text-base sm:text-lg font-black ${
                    trackingData.balanceDue > 0 ? 'text-red-600' : 'text-slate-800'
                  }`}>
                    ₱{trackingData.balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* 4-Stage Workflow Overview */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                How We Care For Your Footwear
              </h2>
              <p className="text-xs text-slate-500">
                Every pair progresses through our 4-stage workshop service pipeline
              </p>
            </div>
            <span className="text-xs font-bold text-red-600 hidden sm:inline">
              4-Stage Progress
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Stage 1: New Order (Purple) */}
            <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ClipboardList size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">Stage 1</span>
                  <h3 className="text-xs font-black text-slate-900">New Order</h3>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Order received, photographed, and logged. Footwear condition and service requirements are cataloged.
              </p>
            </div>

            {/* Stage 2: On-Going (Blue) */}
            <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Clock size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">Stage 2</span>
                  <h3 className="text-xs font-black text-slate-900">On-Going</h3>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Under active cleaning, sole unyellowing, reglue curing, or leather conditioning by our technicians.
              </p>
            </div>

            {/* Stage 3: For Release (Orange) */}
            <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <PackageCheck size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">Stage 3</span>
                  <h3 className="text-xs font-black text-slate-900">For Release</h3>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Quality checked, deodorized, packaged in clean shoe bags, and ready for delivery or immediate pickup at the shop.
              </p>
            </div>

            {/* Stage 4: Claimed (Gray) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <ShoeIcon className="w-4 h-4 text-slate-700" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Stage 4</span>
                  <h3 className="text-xs font-black text-slate-900">Claimed</h3>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Successfully released to customer or authorized representative upon presentation of claim slip.
              </p>
            </div>
          </div>
        </div>

        {/* FAQs & Customer Tips */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <HelpCircle size={17} className="text-red-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              Pickup Guidelines & FAQs
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-slate-600">
            <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                What do I present when claiming?
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Present your physical Claim Slip or simply show this Order Tracking screen on your mobile phone at the counter.
              </p>
            </div>

            <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                Can a representative claim my shoes?
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Yes! You may send a representative with your Order # or a clear photo of your claim slip.
              </p>
            </div>

            <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                How will I know when they are ready?
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Once this tracker displays <strong className="text-orange-600">For Release</strong>, your footwear is inspected and ready for immediate counter pickup.
              </p>
            </div>

            <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                Have questions about your order?
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Call or message our shop anytime or reach out through our Facebook page.
              </p>
            </div>
          </div>
        </div>

        {/* Workshop Location & Contact */}
        <div className="bg-slate-100/80 border border-slate-200 rounded-3xl p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
            <MapPin size={15} className="text-red-600" />
            <span>Shoelotskey Villamor-Pasay</span>
          </div>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            6th 9th Street, Brgy. 183, Villamor, Pasay City, Philippines<br />
            Operating Hours: Monday – Saturday: 9:00 AM – 7:00 PM
          </p>
          
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs">
            <a 
              href="tel:09566327642" 
              title="Call Shop"
              className="inline-flex items-center gap-2 font-bold text-slate-800 hover:text-emerald-700 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <Phone size={14} className="text-emerald-600" />
              <span>Call Shop</span>
            </a>

            <a 
              href="sms:09566327642" 
              title="Send SMS / Message"
              className="inline-flex items-center gap-2 font-bold text-slate-800 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <MessageSquare size={14} className="text-blue-600" />
              <span>Send SMS / Message</span>
            </a>

            <a 
              href="https://www.facebook.com/p/Shoelotskey-Villamor-Pasay-61578784589539/?_rdc=2&_rdr#" 
              target="_blank" 
              rel="noopener noreferrer"
              title="Visit Shoelotskey Villamor-Pasay on Facebook"
              className="inline-flex items-center gap-2 font-bold text-blue-700 hover:text-blue-800 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50/50 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4 fill-current text-blue-600" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Shoelotskey Villamor-Pasay</span>
              <ExternalLink size={12} className="text-blue-500" />
            </a>
          </div>
        </div>

      </main>

    </div>
  );
}

export default CustomerTracking;

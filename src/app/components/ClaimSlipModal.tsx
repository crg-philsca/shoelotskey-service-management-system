import { useState, useEffect } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Printer, QrCode as QrIcon, FileText, CheckSquare, X } from 'lucide-react';
import { SignaturePadModal } from '@/app/components/SignaturePadModal';
import { useOrders } from '@/app/context/OrderContext';
import { useServices } from '@/app/context/ServiceContext';
import { saveOrderAttachments } from '@/app/lib/imageUtils';
import { toServiceCode } from '@/app/lib/businessRules';
import type { JobOrder } from '@/app/types';

const formatCurrency = (val: number | string | null | undefined): string => {
  const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const cleanShoeText = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Strip out any case-insensitive unknown, other, others, none, na, footwear
  str = str.replace(/\b(unknown|other|others|other\s*\(specify\)|n\/?a|none|footwear)\b/gi, '');
  // Strip leading/trailing bullets, dashes, spaces, colons, commas
  str = str.replace(/^[•·\-\s,:;]+|[•·\-\s,:;]+$/g, '').trim();
  return str;
};

interface ClaimSlipModalProps {
  order: JobOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
}

export function ClaimSlipModal({ order, open, onOpenChange, user }: ClaimSlipModalProps) {
  if (!order) return null;

  const { updateOrder } = useOrders();
  const { services: catalogServices = [] } = useServices();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'slip' | 'terms'>('slip');
  
  // Interactive Signatures State
  const [customerSig, setCustomerSig] = useState<string | null>(order.customerSignature || null);
  const [staffSig, setStaffSig] = useState<string | null>(order.staffSignature || null);
  const [activeSignRole, setActiveSignRole] = useState<'customer' | 'staff' | null>(null);

  // Synchronize signatures if order updates
  useEffect(() => {
    setCustomerSig(order.customerSignature || null);
    setStaffSig(order.staffSignature || null);
  }, [order.id, order.customerSignature, order.staffSignature]);

  // Generate Phone-Scannable QR Code for customer live order tracking
  useEffect(() => {
    if (!order?.orderNumber) return;
    
    const customBase = (import.meta as any).env?.VITE_TRACKING_BASE_URL;
    const devNetworkIp = typeof window !== 'undefined' ? localStorage.getItem('shoelotskey_dev_network_ip') : null;
    
    let origin = customBase || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!customBase && devNetworkIp && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      origin = origin.replace(/localhost|127\.0\.0\.1/, devNetworkIp);
    }

    const trackUrl = `${origin}/track?order=${encodeURIComponent(order.orderNumber)}`;

    QRCode.toDataURL(trackUrl, {
      margin: 0,
      width: 140,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate tracking QR code:', err));
  }, [order?.orderNumber]);

  const itemsToDisplay = order.items && order.items.length > 0 ? order.items : [order];

  const handlePrint = () => {
    document.body.classList.add('printing-claim-slip');
    const content = document.getElementById('claim-slip-print-content');
    if (content?.parentElement) {
      content.parentElement.scrollTop = 0;
    }
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-claim-slip');
    }, 1000);
  };

  const handleSaveSignature = async (sigDataUrl: string) => {
    if (!activeSignRole || !order) return;
    
    const cleanSig = sigDataUrl ? sigDataUrl.trim() : '';
    if (activeSignRole === 'customer') {
      setCustomerSig(cleanSig || null);
      if (order.orderNumber) {
        saveOrderAttachments(order.orderNumber, { customerSignature: cleanSig });
      }
      saveOrderAttachments(String(order.id), { customerSignature: cleanSig });
      try {
        await updateOrder(order.id, { customerSignature: cleanSig });
      } catch (err) {
        console.warn('Could not persist customer signature:', err);
      }
    } else {
      setStaffSig(cleanSig || null);
      if (order.orderNumber) {
        saveOrderAttachments(order.orderNumber, { staffSignature: cleanSig });
      }
      saveOrderAttachments(String(order.id), { staffSignature: cleanSig });
      try {
        await updateOrder(order.id, { staffSignature: cleanSig });
      } catch (err) {
        console.warn('Could not persist staff signature:', err);
      }
    }
    setActiveSignRole(null);
  };

  // Financial calculations
  const grandTotal = Number(order.grandTotal || 0);

  // Item price calculation helper matching JobOrderForm calculation
  const getItemCalculatedPrice = (item: any, _idx: number): number => {
    let baseSum = 0;
    const rawServices = Array.isArray(item.baseService)
      ? item.baseService
      : (item.baseService ? [item.baseService] : ((item as any).services ? (Array.isArray((item as any).services) ? (item as any).services : [(item as any).services]) : []));

    const histBase = item.historicalBasePrices || (item as any).historical_base_prices;
    const histAddOns = item.historicalAddOnPrices || (item as any).historical_add_on_prices;

    rawServices.forEach((s: any) => {
      const sName = typeof s === 'string' ? s : (s?.name || s?.service_name || '');
      if (!sName) return;
      if (Array.isArray(histBase)) {
        const found = histBase.find((h: any) => (h.name || '').toLowerCase() === sName.toLowerCase());
        if (found && Number(found.price) > 0) {
          baseSum += Number(found.price);
          return;
        }
      }
      const cat = catalogServices.find((c: any) => (c.name || '').toLowerCase() === sName.toLowerCase());
      if (cat && Number(cat.price) > 0) {
        baseSum += Number(cat.price);
      } else {
        const sLower = sName.toLowerCase();
        if (sLower.includes('full reglue') || (sLower.includes('reglue') && (sLower.includes('midsole') || sLower.includes('undersole')))) baseSum += 800;
        else if (sLower.includes('minor reglue') || sLower.includes('reglue')) baseSum += 450;
        else if (sLower.includes('color renewal') || sLower.includes('color restoration')) baseSum += 650;
        else if (sLower.includes('unyellow')) baseSum += 400;
        else baseSum += 450; // default Basic Cleaning
      }
    });

    let addOnSum = 0;
    const rawAddOns = Array.isArray(item.addOns)
      ? item.addOns
      : (item.addOns ? [item.addOns] : []);

    rawAddOns.forEach((a: any) => {
      const aName = typeof a === 'string' ? a : (a?.name || a?.service_name || '');
      const aQty = (typeof a === 'object' && a?.quantity) ? Number(a.quantity) : 1;
      if (!aName) return;
      if (Array.isArray(histAddOns)) {
        const found = histAddOns.find((h: any) => (h.name || '').toLowerCase() === aName.toLowerCase());
        if (found && Number(found.price) > 0) {
          addOnSum += Number(found.price) * aQty;
          return;
        }
      }
      const cat = catalogServices.find((c: any) => (c.name || '').toLowerCase() === aName.toLowerCase());
      if (cat && Number(cat.price) > 0) {
        addOnSum += Number(cat.price) * aQty;
      } else {
        const aLower = aName.toLowerCase();
        if (aLower.includes('minor reglue') || aLower.includes('reglue')) addOnSum += 250 * aQty;
        else if (aLower.includes('color renewal') || aLower.includes('color')) addOnSum += 250 * aQty;
        else if (aLower.includes('unyellow')) addOnSum += 250 * aQty;
        else if (aLower.includes('retouch')) addOnSum += 250 * aQty;
        else addOnSum += 150 * aQty;
      }
    });

    const computed = (baseSum + addOnSum) * (item.quantity || 1);
    if (computed > 0) return computed;
    const rawDirectPrice = Number((item as any).price || (item as any).cost || 0);
    if (rawDirectPrice > 0 && rawDirectPrice !== grandTotal / itemsToDisplay.length) return rawDirectPrice;
    return itemsToDisplay.length === 1 ? grandTotal : (grandTotal / itemsToDisplay.length);
  };

  // Financial totals & Discount breakdown matching JobOrderForm calculation
  const directDiscount = Number((order as any).discountAmount || (order as any).discount || 0);
  const recordedBase = Number((order as any).baseServiceFee || 0);
  const recordedAddOns = Number((order as any).addOnsTotal || 0);
  const recordedRush = Number((order as any).rushFee || 0);
  const recordedRetail = Number((order as any).retailTotal || 0);

  const itemsComputedTotal = itemsToDisplay.reduce((acc, it, i) => acc + getItemCalculatedPrice(it, i), 0);

  const grossSubtotal = (recordedBase + recordedAddOns > 0)
    ? (recordedBase + recordedAddOns + recordedRush + recordedRetail)
    : (itemsComputedTotal > grandTotal ? itemsComputedTotal : (directDiscount > 0 ? grandTotal + directDiscount : grandTotal));

  const discountAmount = directDiscount > 0
    ? directDiscount
    : (grossSubtotal > grandTotal ? Math.round((grossSubtotal - grandTotal) * 100) / 100 : 0);

  const discountPercent = (grossSubtotal > 0 && discountAmount > 0.01)
    ? Math.round((discountAmount / grossSubtotal) * 100)
    : 0;

  const isCompactMultiItem = itemsToDisplay.length > 4;
  const isMultiColumn = itemsToDisplay.length > 4;

  const getItemDetails = (item: any, idx: number) => {
    const rawServices = Array.isArray(item.baseService)
      ? item.baseService
      : (item.baseService ? [item.baseService] : ((item as any).services ? (Array.isArray((item as any).services) ? (item as any).services : [(item as any).services]) : []));

    const rawAddOns = Array.isArray(item.addOns)
      ? item.addOns
      : (item.addOns ? [item.addOns] : []);

    const serviceCodes: string[] = [];
    rawServices.forEach((s: any) => {
      const str = typeof s === 'string' ? s : (s?.name || s?.service_name || s?.service_code || '');
      if (str.includes(',')) {
        str.split(',').forEach((sub: string) => {
          const c = toServiceCode(sub.trim());
          if (c) serviceCodes.push(c);
        });
      } else {
        const c = toServiceCode(str);
        if (c) serviceCodes.push(c);
      }
    });

    const addOnCodes: string[] = [];
    rawAddOns.forEach((a: any) => {
      const str = typeof a === 'string' ? a : (a?.name || a?.service_name || a?.service_code || '');
      if (str.includes(',')) {
        str.split(',').forEach((sub: string) => {
          const c = toServiceCode(sub.trim());
          if (c) addOnCodes.push(c);
        });
      } else {
        const c = toServiceCode(str);
        if (c) addOnCodes.push(c);
      }
    });

    // Remove redundant base 'COR' if add-on already indicates multi-color Color Restoration (e.g. COR2 or COR3)
    let processedServiceCodes = [...serviceCodes];
    let processedAddOnCodes = [...addOnCodes];

    const hasMultiColorAddOn = processedAddOnCodes.some(c => c === 'COR2' || c === 'COR3');
    if (hasMultiColorAddOn && processedServiceCodes.includes('COR')) {
      processedServiceCodes = processedServiceCodes.filter(c => c !== 'COR');
      if (processedServiceCodes.length === 0) {
        const promoIdx = processedAddOnCodes.findIndex(c => c === 'COR2' || c === 'COR3');
        if (promoIdx !== -1) {
          processedServiceCodes.push(processedAddOnCodes[promoIdx]);
          processedAddOnCodes.splice(promoIdx, 1);
        }
      }
    }

    // Clean model description: omit 'other', 'unknown', 'footwear', etc.
    const rawBrand = item.brand || (item as any).brand_name;
    const rawModel = item.shoeModel || (item as any).model;
    const rawColor = item.color;
    const rawSize = item.shoeSize || (item as any).size;

    const cleanBrand = cleanShoeText(rawBrand);
    const cleanModel = cleanShoeText(rawModel);
    const cleanColor = cleanShoeText(rawColor);
    const cleanSize = cleanShoeText(rawSize).replace(/^(sz|size)[:\s]*/i, '');

    const descParts: string[] = [];
    if (cleanBrand) descParts.push(cleanBrand);
    if (cleanModel) descParts.push(cleanModel);
    if (cleanColor) descParts.push(`(${cleanColor})`);
    if (cleanSize) descParts.push(`Size: ${cleanSize}`);

    const titleText = descParts.length > 0 ? descParts.join(' ') : `Pair #${idx + 1}`;

    const condArr: string[] = [];
    if (item.condition && typeof item.condition === 'object') {
      if (item.condition.scratches) condArr.push('Scratches');
      if (item.condition.ripsHoles) condArr.push('Rips/Holes');
      if (item.condition.wornOut) condArr.push('Worn Out');
      if (item.condition.soleSeparation) condArr.push('Sole Sep');
      if (item.condition.yellowing) condArr.push('Yellowing');
      if (item.condition.deepStains) condArr.push('Deep Stains');
      const cleanOther = cleanShoeText(item.condition.others);
      if (cleanOther) condArr.push(cleanOther);
    }

    const rawNotes = (item as any).description || (item as any).notes || (item as any).item_notes;
    const cleanNotes = cleanShoeText(rawNotes);

    const itemPrice = getItemCalculatedPrice(item, idx);
    const baseCodeStr = processedServiceCodes.length > 0 
      ? processedServiceCodes.join(', ') 
      : (processedAddOnCodes.length > 0 ? '' : 'BC');
    const addOnCodeStr = processedAddOnCodes.length > 0 
      ? `${processedServiceCodes.length > 0 ? '+ ' : ''}${processedAddOnCodes.join(', ')}` 
      : '';

    return {
      titleText,
      condArr,
      cleanNotes,
      baseCodeStr,
      addOnCodeStr,
      itemPrice
    };
  };

  // Effective amount paid
  const isClaimed = order.status === 'claimed';
  const effectivePaid = (() => {
    if (order.paymentStatus === 'fully-paid' || isClaimed) return grandTotal;
    const dp = Number(order.depositAmount);
    if (Number.isFinite(dp) && dp > 0) return Math.min(grandTotal, dp);
    const recv = Number(order.amountReceived);
    if (Number.isFinite(recv) && recv > 0 && recv < grandTotal) return recv;
    if (Array.isArray(order.paymentHistory) && order.paymentHistory.length > 0) {
      return Math.min(grandTotal, order.paymentHistory.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));
    }
    return 0;
  })();

  const balanceDue = (order.paymentStatus === 'fully-paid' || isClaimed)
    ? 0
    : Math.max(0, grandTotal - effectivePaid);

  const formattedOrderDate = (() => {
    try {
      const d = new Date(order.transactionDate || order.createdAt || Date.now());
      return dateFnsFormat(d, 'MM/dd/yyyy h:mm a');
    } catch {
      return '-';
    }
  })();

  const formattedDateOnly = (() => {
    try {
      const d = new Date(order.transactionDate || order.createdAt || Date.now());
      return dateFnsFormat(d, 'MM/dd/yyyy');
    } catch {
      return '-';
    }
  })();

  const formattedReleaseDate = (() => {
    const raw = order.predictedCompletionDate || (order as any).expected_at || (order as any).releaseDate || (order as any).targetDate;
    if (!raw) return 'Pending Schedule';
    try {
      return dateFnsFormat(new Date(raw), 'MMMM dd, yyyy');
    } catch {
      return String(raw);
    }
  })();

  const staffName = order.processedBy || (order as any).receivedBy || user?.username || 'Yang';

  const renderTermsAndConditions = () => (
    <div className="claim-slip-half border border-black p-2.5 sm:p-3 bg-white text-black print:p-2.5 flex flex-col justify-between print:flex-1 print:min-h-0 print:overflow-hidden">
      <div className="text-center space-y-0.5 pb-0.5 sm:pb-1 border-b border-black shrink-0">
        <h2 className="text-sm sm:text-base font-black uppercase text-red-600 m-0 leading-tight tracking-wider">
          SHOELOTSKEY VILLAMOR-PASAY
        </h2>
        <h3 className="text-[11px] sm:text-xs font-black uppercase text-black m-0 leading-tight tracking-wider">
          SHOE JOB ORDER FORM
        </h3>
        <p className="text-[10px] sm:text-[10.5px] font-black uppercase text-black m-0 leading-tight tracking-wider">
          Service Terms and Conditions
        </p>
      </div>

      <ol className="list-decimal pl-4 sm:pl-5 text-black text-[9px] sm:text-[9.5px] leading-[1.24] font-medium print:text-[8.5px] print:leading-[1.2] my-1 flex-1 flex flex-col justify-between">
        <li>
          Shoelotskey is committed to handling every item we receive using the most suitable methods and choice of chemicals to be used based on our professional assessment and judgment of what best fits the nature and condition of each item.
        </li>
        <li>
          Shoelotskey will exert all reasonable efforts to maintain the highest level of quality in our cleaning service. However, we cannot be held liable for any color loss, fading, transfer discoloration, shrinkage (unpredictable changes in shape), stiffening, brittleness, or wrinkle formation during the drying process, as well as any other unforeseen issues that may arise. We will ensure that each item receives the highest level of care throughout the process.
        </li>
        <li>
          Shoelotskey does not guarantee the full removal of all stains. However, upon request, we can attempt to remove the stain at the customer&apos;s own risk. We will not be held responsible for any potential damages that may occur during this process.
        </li>
        <li>
          Shoelotskey shall not be held responsible for any inherent weaknesses or defects in materials that are not immediately visible before processing.
        </li>
        <li>
          Shoelotskey will notify you when your item is ready for collection. Items left unclaimed for more than <strong>45 days</strong> from the specified collection date will be considered abandoned and may be liquidated or donated to charity.
        </li>
        <li>
          Shoelotskey reserves the right to refuse service to any customer and/or decline to process any item at its discretion.
        </li>
        <li>
          Shoelotskey will not be held responsible for any personal property left with the sneakers (such as boxes, accessories, etc.) We kindly ask that customers check for any personal belongings before sending items to us.
        </li>
        <li>
          A <strong>50% down payment</strong> upon our receipt of your item is required and is non-refundable. The remaining 50% shall be paid upon the release of your item from our shop.
        </li>
        <li>
          By submitting shoes to Shoelotskey, the Customer acknowledges reading, understanding, and accepting these Terms and Conditions.
        </li>
        <li>
          Please ensure you pick up your shoes by the due date after you receive a text message. For shoes left uncollected after <strong>7 days</strong>, a daily storage fee of 10 pesos will be applied due to limited storage space in our shop.
        </li>
      </ol>

      <div className="pt-1 sm:pt-1.5 print:pt-1 flex justify-center pb-0.5 shrink-0">
        <div 
          onClick={() => setActiveSignRole('customer')}
          className="text-center w-60 sm:w-68 cursor-pointer group"
          title="Click to sign electronically"
        >
          {/* Signature Area above the line */}
          <div className="h-6 sm:h-7 flex items-end justify-center pb-0.5 group-hover:bg-slate-50 transition-colors">
            {customerSig ? (
              <img src={customerSig} alt="Customer Signature" className="max-h-6 sm:max-h-7 object-contain" />
            ) : (
              <span className="text-[7.5px] italic text-slate-400 print:hidden">Click to sign</span>
            )}
          </div>
          {/* Solid horizontal signature line */}
          <div className="w-full border-t border-black" />
          {/* Printed Name under the signature line */}
          <span className="text-[11px] sm:text-xs font-black text-black block uppercase tracking-wider pt-0.5 leading-tight">
            {order.customerName || '—'}
          </span>
          <span className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider block pt-0.5 leading-tight text-black">
            SIGNATURE OVER PRINTED NAME
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          showCloseButton={false}
          className="w-[calc(100vw-1.5rem)] sm:max-w-[760px] bg-white p-0 gap-0 overflow-hidden rounded-2xl max-h-[96vh] flex flex-col border border-slate-300 shadow-2xl print:static print:transform-none print:translate-x-0 print:translate-y-0 print:left-0 print:top-0 print:w-full print:max-w-full print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-none print:shadow-none print:bg-white print:rounded-none"
        >
          <DialogTitle className="sr-only">Official Job Order & Claim Slip</DialogTitle>
          <DialogDescription className="sr-only">Official Shoelotskey Shoe Job Order Form and Customer Claim Slip matching authentic paper layout</DialogDescription>

          {/* Modal Header Controls Bar (Hidden during printing) */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-200 print:hidden shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('slip')}
                className={`h-7 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'slip' ? 'bg-red-600 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText size={12} />
                <span>Front (Job Order & Claim Slip)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`h-7 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'terms' ? 'bg-red-600 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <CheckSquare size={12} />
                <span>Back (Terms & Conditions)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                title="Print responsive full-page slip on A4 or Letter paper"
                className="h-7 px-3.5 rounded-lg bg-black hover:bg-slate-800 text-white flex items-center gap-1.5 transition-all text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 shadow-xs shrink-0"
              >
                <Printer size={12} />
                <span>{activeTab === 'slip' ? 'Print Slip' : 'Print Terms'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                title="Close modal"
                className="h-7 w-7 rounded-lg bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs shrink-0"
              >
                <X size={14} />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>

          {/* Scrollable Printable Container */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 text-black text-xs bg-white print:p-0 print:m-0 print:overflow-visible">
            <div id="claim-slip-print-content" className="text-black bg-white flex flex-col w-full mx-auto print:min-h-0 print:h-full print:max-w-none print:w-full print:p-0">
              
              {activeTab === 'slip' ? (
                <>
                  {/* ======================================================================== */}
                  {/* UPPER HALF: SHOE JOB ORDER FORM (STORE / WORKSHOP COPY)                   */}
                  {/* ======================================================================== */}
                  <div className="claim-slip-half border border-black p-2 sm:p-2.5 print:p-2 bg-white flex flex-col justify-between print:overflow-hidden">
                    {/* Top Intake Header Block: Brand Header + Client & Order Info tightly coupled */}
                    <div className="space-y-1 sm:space-y-1.5 shrink-0">
                      {/* Brand Header */}
                      <div className="text-center space-y-0.5 print:space-y-0">
                        <div className="flex items-center justify-center gap-1.5">
                          <img src="/logo.png" alt="Shoelotskey" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
                          <h1 className="text-sm sm:text-base font-black uppercase text-red-600 tracking-wide m-0 leading-tight">
                            SHOELOTSKEY VILLAMOR-PASAY
                          </h1>
                        </div>
                        <p className="text-[9px] sm:text-[9.5px] font-black text-black uppercase tracking-tight leading-none">
                          Shoe Care & Restoration Services
                        </p>
                        <p className="text-[8px] sm:text-[8.5px] text-black font-semibold leading-tight">
                          6th 9th Street, Brgy. 183, Villamor, Pasay City • Mon–Sat: 9:00 AM – 7:00 PM
                        </p>
                        <p className="text-[8px] sm:text-[8.5px] text-black font-semibold leading-tight">
                          Contact: 0956 632 7642 • FB: Shoelotskey Villamor-Pasay
                        </p>
                        <h2 className="text-xs sm:text-[13px] font-black uppercase text-black tracking-wider pt-0.5 m-0 underline decoration-1 underline-offset-2">
                          SHOE JOB ORDER FORM
                        </h2>
                      </div>

                      {/* Client & Order Header Box */}
                      <div className="grid grid-cols-2 border border-black text-[9.5px] sm:text-[10px] leading-snug text-black">
                        <div className="border-r border-black p-1 sm:p-1.5 space-y-0.5">
                          <div><strong className="uppercase">CLIENT NAME:</strong> <span className="font-black text-xs sm:text-[12.5px] pl-1">{order.customerName || '—'}</span></div>
                          <div><strong className="uppercase">CONTACT NO:</strong> <span className="font-bold pl-1">{order.contactNumber || '—'}</span></div>
                        </div>
                        <div className="p-1 sm:p-1.5 space-y-0.5">
                          <div><strong className="uppercase">ORDER #:</strong> <span className="font-mono font-black text-xs sm:text-sm pl-1">{order.orderNumber.replace(/^#/, '')}</span></div>
                          <div><strong className="uppercase">DATE & TIME:</strong> <span className="font-semibold pl-1">{formattedOrderDate}</span></div>
                          <div><strong className="uppercase">BRANCH:</strong> <span className="font-bold pl-1">VILLAMOR</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Shoe and Service Details Table (balanced between Header and Signature) */}
                    <div className="border border-black bg-white shrink-0">
                      <div className="px-2 py-0.5 sm:py-1 font-black uppercase tracking-wider text-center border-b border-black text-[10.5px] sm:text-[11px] bg-slate-50">
                        SHOE AND SERVICE DETAILS
                      </div>
                      {isMultiColumn ? (
                        <div className="grid grid-cols-2 divide-x divide-black border-b border-black font-bold uppercase text-center text-[8.5px] sm:text-[9px] bg-slate-100/70">
                          <div className="grid grid-cols-12">
                            <div className="col-span-6 border-r border-black py-0.5 px-1 text-left">MODEL, DESCRIPTION, AND CONDITION</div>
                            <div className="col-span-3 border-r border-black py-0.5 px-0.5">SERVICE</div>
                            <div className="col-span-3 py-0.5 px-1">PRICE</div>
                          </div>
                          <div className="grid grid-cols-12">
                            <div className="col-span-6 border-r border-black py-0.5 px-1 text-left">MODEL, DESCRIPTION, AND CONDITION</div>
                            <div className="col-span-3 border-r border-black py-0.5 px-0.5">SERVICE</div>
                            <div className="col-span-3 py-0.5 px-1">PRICE</div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 border-b border-black font-bold uppercase text-center text-[9px] sm:text-[9.5px] bg-slate-100/60">
                          <div className="col-span-6 border-r border-black py-1 px-2 text-left">MODEL, DESCRIPTION, AND CONDITION</div>
                          <div className="col-span-4 border-r border-black py-1 px-1.5">SERVICE</div>
                          <div className="col-span-2 py-1 px-2">PRICE</div>
                        </div>
                      )}

                      {isMultiColumn ? (
                        <div className="divide-y divide-black/80">
                          {Array.from({ length: Math.ceil(itemsToDisplay.length / 2) }).map((_, rIdx) => {
                            const half = Math.ceil(itemsToDisplay.length / 2);
                            const leftIdx = rIdx;
                            const rightIdx = rIdx + half;
                            const leftItem = itemsToDisplay[leftIdx];
                            const rightItem = rightIdx < itemsToDisplay.length ? itemsToDisplay[rightIdx] : null;

                            const leftData = getItemDetails(leftItem, leftIdx);
                            const rightData = rightItem ? getItemDetails(rightItem, rightIdx) : null;

                            return (
                              <div key={rIdx} className="grid grid-cols-2 divide-x divide-black min-h-[24px] sm:min-h-[26px] items-stretch">
                                {/* Left Column Item */}
                                <div className="grid grid-cols-12 items-stretch h-full">
                                  <div className="col-span-6 border-r border-black py-0.5 px-1.5 flex flex-col justify-center overflow-hidden">
                                    <div className="font-bold text-[9px] sm:text-[9.5px] text-black truncate" title={`#${leftIdx + 1} ${leftData.titleText}`}>
                                      #{leftIdx + 1} {leftData.titleText}
                                    </div>
                                    {leftData.condArr.length > 0 && (
                                      <div className="text-[7.5px] sm:text-[8px] text-black font-medium leading-tight truncate">
                                        Cond: {leftData.condArr.join(', ')}
                                      </div>
                                    )}
                                    {leftData.cleanNotes && (
                                      <div className="text-[7px] sm:text-[7.5px] italic text-slate-700 leading-tight truncate">
                                        Note: {leftData.cleanNotes}
                                      </div>
                                    )}
                                  </div>
                                  <div className="col-span-3 border-r border-black py-0.5 px-0.5 flex items-center justify-center text-center">
                                    <div className="font-bold text-[9px] sm:text-[9.5px] text-black font-mono leading-tight flex items-center justify-center flex-wrap gap-x-1">
                                      <span>{leftData.baseCodeStr}</span>
                                      {leftData.addOnCodeStr && (
                                        <span className="text-slate-800 font-semibold text-[8px] sm:text-[8.5px]">
                                          {leftData.addOnCodeStr}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="col-span-3 py-0.5 px-1.5 text-right font-mono font-bold text-[9.5px] sm:text-[10px] text-black flex items-center justify-end">
                                    ₱{formatCurrency(leftData.itemPrice)}
                                  </div>
                                </div>

                                {/* Right Column Item */}
                                {rightData && rightItem ? (
                                  <div className="grid grid-cols-12 items-stretch h-full">
                                    <div className="col-span-6 border-r border-black py-0.5 px-1.5 flex flex-col justify-center overflow-hidden">
                                      <div className="font-bold text-[9px] sm:text-[9.5px] text-black truncate" title={`#${rightIdx + 1} ${rightData.titleText}`}>
                                        #{rightIdx + 1} {rightData.titleText}
                                      </div>
                                      {rightData.condArr.length > 0 && (
                                        <div className="text-[7.5px] sm:text-[8px] text-black font-medium leading-tight truncate">
                                          Cond: {rightData.condArr.join(', ')}
                                        </div>
                                      )}
                                      {rightData.cleanNotes && (
                                        <div className="text-[7px] sm:text-[7.5px] italic text-slate-700 leading-tight truncate">
                                          Note: {rightData.cleanNotes}
                                        </div>
                                      )}
                                    </div>
                                    <div className="col-span-3 border-r border-black py-0.5 px-0.5 flex items-center justify-center text-center">
                                      <div className="font-bold text-[9px] sm:text-[9.5px] text-black font-mono leading-tight flex items-center justify-center flex-wrap gap-x-1">
                                        <span>{rightData.baseCodeStr}</span>
                                        {rightData.addOnCodeStr && (
                                          <span className="text-slate-800 font-semibold text-[8px] sm:text-[8.5px]">
                                            {rightData.addOnCodeStr}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="col-span-3 py-0.5 px-1.5 text-right font-mono font-bold text-[9.5px] sm:text-[10px] text-black flex items-center justify-end">
                                      ₱{formatCurrency(rightData.itemPrice)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-12 h-full bg-slate-50/20">
                                    <div className="col-span-6 border-r border-black" />
                                    <div className="col-span-3 border-r border-black" />
                                    <div className="col-span-3" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="divide-y divide-black/80">
                          {itemsToDisplay.map((item, idx) => {
                            const { titleText, condArr, cleanNotes, baseCodeStr, addOnCodeStr, itemPrice } = getItemDetails(item, idx);
                            return (
                              <div key={idx} className={`grid grid-cols-12 ${isCompactMultiItem ? 'text-[9px] sm:text-[9.5px] min-h-[26px]' : 'text-[10px] sm:text-[10.5px] min-h-[28px] sm:min-h-[32px]'} items-stretch`}>
                                <div className={`col-span-6 border-r border-black ${isCompactMultiItem ? 'py-0.5 px-1' : 'p-1 sm:p-1.5'} flex flex-col justify-center`}>
                                  <div className={`font-bold ${isCompactMultiItem ? 'text-[10px] sm:text-[10.5px]' : 'text-[10.5px] sm:text-[11px]'} text-black`}>
                                    #{idx + 1} {titleText}
                                  </div>
                                  {condArr.length > 0 && (
                                    <div className={`${isCompactMultiItem ? 'text-[7.5px]' : 'text-[8px] sm:text-[8.5px]'} text-black font-medium pt-0.5 leading-tight`}>
                                      Condition: {condArr.join(', ')}
                                    </div>
                                  )}
                                  {cleanNotes && (
                                    <div className={`${isCompactMultiItem ? 'text-[7px]' : 'text-[7.5px] sm:text-[8px]'} italic text-slate-700 pt-0.5 leading-tight`}>
                                      Note: {cleanNotes}
                                    </div>
                                  )}
                                </div>
                                <div className={`col-span-4 border-r border-black ${isCompactMultiItem ? 'py-0.5 px-1' : 'p-1 sm:p-1.5'} flex items-center justify-center text-center`}>
                                  <div className={`font-bold ${isCompactMultiItem ? 'text-[9.5px]' : 'text-[10px] sm:text-[10.5px]'} text-black font-mono leading-tight flex items-center justify-center flex-wrap gap-x-1.5`}>
                                    <span>{baseCodeStr}</span>
                                    {addOnCodeStr && (
                                      <span className={`${isCompactMultiItem ? 'text-[8.5px]' : 'text-[9px] sm:text-[9.5px]'} text-slate-800 font-semibold`}>
                                        {addOnCodeStr}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className={`col-span-2 ${isCompactMultiItem ? 'py-0.5 px-1' : 'p-1 sm:p-1.5'} text-right font-mono font-bold ${isCompactMultiItem ? 'text-[10px] sm:text-[10.5px]' : 'text-[10.5px] sm:text-[11px]'} text-black flex items-center justify-end`}>
                                  ₱{formatCurrency(itemPrice)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Financial Totals Row with Subtotal and Discount when applicable */}
                      <div className="border-t border-black bg-slate-50 font-bold divide-y divide-black/30">
                        {discountAmount > 0.01 && (
                          <div className="grid grid-cols-12 py-0.5 px-2 text-[8.5px] sm:text-[9px] items-center">
                            <div className="col-span-5 text-right pr-2 text-slate-700 uppercase font-bold">
                              SUBTOTAL:
                            </div>
                            <div className="col-span-7 flex justify-between items-center font-mono">
                              <span className="text-slate-900 font-bold">₱{formatCurrency(grossSubtotal)}</span>
                              <span className="text-emerald-700 font-black font-sans text-[8.5px] sm:text-[9px]">
                                DISCOUNT {discountPercent > 0 ? `(${discountPercent}% OFF)` : ''}: <strong className="font-mono text-emerald-800">-₱{formatCurrency(discountAmount)}</strong>
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-12 py-1 px-2 text-[9.5px] sm:text-[10px] items-center">
                          <div className="col-span-5 text-right pr-2 font-black uppercase">
                            GRAND TOTAL:
                          </div>
                          <div className="col-span-7 flex justify-between items-center font-mono">
                            <span className="text-xs sm:text-[13px] font-black">₱{formatCurrency(grandTotal)}</span>
                            <span className="text-[9px] sm:text-[9.5px] font-bold font-sans">
                              DP: <strong className="font-mono font-black">₱{formatCurrency(effectivePaid)}</strong> | BAL: <strong className="font-mono text-red-600 font-black">₱{formatCurrency(balanceDue)}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Disclaimer & Signature Acknowledgement (Guaranteed fully visible) */}
                    <div className="space-y-1 sm:space-y-1.5 pt-1 pb-0.5 shrink-0">
                      <p className="text-[7.5px] sm:text-[8px] leading-tight italic text-slate-800 m-0">
                        I hereby acknowledge receipt of a copy of this service order and confirm the accuracy of the above-mentioned model, description, and condition of shoes surrendered to Shoelotskey for servicing. I agree to the total computed service amount stated herein.
                      </p>

                      <div className="flex justify-end pt-1">
                        <div 
                          onClick={() => setActiveSignRole('customer')}
                          className="text-center w-60 sm:w-68 cursor-pointer group"
                          title="Click to sign electronically"
                        >
                          {/* Signature Area above the line */}
                          <div className="h-6 sm:h-7 flex items-end justify-center pb-0.5 group-hover:bg-slate-50 transition-colors">
                            {customerSig ? (
                              <img src={customerSig} alt="Signature" className="max-h-6 sm:max-h-7 object-contain" />
                            ) : (
                              <span className="text-[7.5px] italic text-slate-400 print:hidden">Click to sign</span>
                            )}
                          </div>
                          {/* Solid horizontal signature line */}
                          <div className="w-full border-t border-black" />
                          {/* Printed Name under the signature line */}
                          <span className="text-xs sm:text-[13px] font-black text-black block uppercase tracking-wider pt-0.5 leading-tight">
                            {order.customerName || '—'}
                          </span>
                          {/* Label */}
                          <span className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider block pt-0.5 leading-tight text-black">
                            SIGNATURE OVER PRINTED NAME
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ======================================================================== */}
                  {/* PERFORATION / CUT-OFF DIVIDER                                            */}
                  {/* ======================================================================== */}
                  <div className="claim-slip-divider relative my-2 py-0.5 flex items-center justify-center break-inside-avoid print:my-0 print:py-0 shrink-0">
                    <div className="w-full border-t border-dashed border-black" />
                    <span className="absolute bg-white px-3 text-[7.5px] font-black uppercase tracking-widest text-black border border-black rounded-full flex items-center gap-1 shadow-2xs">
                      ✂ .................................... (CUT HERE) .................................... ✂
                    </span>
                  </div>

                  {/* ======================================================================== */}
                  {/* LOWER HALF: ACKNOWLEDGEMENT COPY FOR CUSTOMER (CLAIM SLIP)               */}
                  {/* ======================================================================== */}
                  <div className={`claim-slip-half border border-black ${isCompactMultiItem ? 'p-1.5 sm:p-2 print:p-1.5 space-y-0.5 sm:space-y-1 print:space-y-0.5' : 'p-2 sm:p-2.5 print:p-2 space-y-1 sm:space-y-1.5 print:space-y-0.5'} bg-white flex flex-col justify-between print:overflow-hidden`}>
                    {/* Top Date, Order No, and Title */}
                    <div className="flex items-center justify-between text-[11px] sm:text-xs border-b border-black pb-1 shrink-0">
                      <div>
                        <strong className="uppercase">DATE:</strong> <span className="font-bold">{formattedDateOnly}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[8px] italic block leading-none text-slate-600">(Please keep and present upon pick up)</span>
                        <span className="font-black uppercase tracking-wider text-[11px] sm:text-xs">ACKNOWLEDGEMENT COPY FOR CUSTOMER</span>
                      </div>
                      <div>
                        <strong className="uppercase">ORDER #:</strong> <span className="font-mono font-black text-xs sm:text-sm">{order.orderNumber.replace(/^#/, '')}</span>
                      </div>
                    </div>

                    {/* Shop Brand & Scannable QR Row */}
                    <div className="flex items-center justify-between gap-2 pt-0.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="Shoelotskey" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
                        <div>
                          <h3 className="text-sm sm:text-base font-black uppercase text-red-600 m-0 leading-tight tracking-wide">
                            SHOELOTSKEY VILLAMOR-PASAY
                          </h3>
                          <p className="text-[9px] sm:text-[9.5px] font-black text-black uppercase leading-tight">
                            Shoe Care & Restoration Services
                          </p>
                          <p className="text-[8px] sm:text-[8.5px] text-black font-semibold leading-tight">
                            6th 9th Street, Brgy. 183, Villamor, Pasay City • Mon–Sat: 9:00 AM – 7:00 PM
                          </p>
                          <p className="text-[8px] sm:text-[8.5px] text-black font-semibold leading-tight">
                            Contact: 0956 632 7642 • FB: Shoelotskey Villamor-Pasay
                          </p>
                        </div>
                      </div>

                      {/* Scannable Tracking QR */}
                      <div className="flex items-center gap-1.5 shrink-0 border border-black rounded p-1 bg-slate-50/50">
                        <div className="text-right">
                          <span className="text-[8px] font-black uppercase text-black block leading-none">SCAN TO TRACK</span>
                          <span className="text-[7.5px] text-slate-700 block leading-tight font-semibold">Live Status</span>
                        </div>
                        {qrCodeDataUrl ? (
                          <img 
                            src={qrCodeDataUrl} 
                            alt={`QR #${order.orderNumber}`} 
                            className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
                          />
                        ) : (
                          <div className="h-8 w-8 sm:h-9 sm:w-9 border border-black rounded flex items-center justify-center">
                            <QrIcon size={14} className="text-black" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Turnaround Guidelines (matching authentic sheet) */}
                    <div className="border border-black p-1.5 sm:p-2 text-[9px] sm:text-[9.5px] space-y-0.5 bg-slate-50/40 text-black leading-snug shrink-0">
                      <div>📌 <strong>CLEANING DAYS: 10 DAYS</strong></div>
                      <div>📌 <strong>CLEANING DAYS + ADDITIONAL SERVICES: 15-25 DAYS</strong> <em className="text-slate-800">(May exceed depending on condition of shoes.)</em></div>
                      <div>📌 <strong>You will receive a text notification when shoes are ready for pick up.</strong></div>
                    </div>

                    {/* Client Name, Signature & Release Date Table */}
                    <div className="border border-black text-[10.5px] sm:text-[11px] bg-white shrink-0">
                      <div className="grid grid-cols-12 border-b border-black font-bold uppercase text-center text-[9px] sm:text-[9.5px] bg-slate-50 items-stretch">
                        <div className="col-span-5 border-r border-black py-1 px-1.5 text-left">CLIENT NAME:</div>
                        <div className="col-span-3 border-r border-black py-1 px-1.5">SIGNATURE:</div>
                        <div className="col-span-4 py-1 px-1.5">RELEASE DATE</div>
                      </div>
                      <div className="grid grid-cols-12 text-[10.5px] sm:text-[11px] items-stretch text-center min-h-[30px] sm:min-h-[34px]">
                        <div className="col-span-5 border-r border-black px-1.5 py-1 text-left font-bold flex items-center">
                          {order.customerName || '—'}
                        </div>
                        <div 
                          onClick={() => setActiveSignRole('customer')}
                          className="col-span-3 border-r border-black px-1 py-0.5 flex items-center justify-center cursor-pointer"
                          title="Click to sign customer signature"
                        >
                          {customerSig ? (
                            <img src={customerSig} alt="Sig" className="max-h-5 sm:max-h-6 object-contain" />
                          ) : (
                            <span className="text-[8px] italic text-slate-400 print:hidden">Click to sign</span>
                          )}
                        </div>
                        <div className="col-span-4 px-1.5 py-1 font-black text-black flex items-center justify-center">
                          {formattedReleaseDate}
                        </div>
                      </div>
                    </div>

                    {/* Staff Info Box & Payment Breakdown */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10.5px] sm:text-[11px] items-stretch shrink-0">
                      {/* Left: Shoelotskey Staff Box */}
                      <div className="border border-black p-1.5 space-y-0.5 bg-white text-black leading-snug">
                        <div><strong>SHOELOTSKEY STAFF:</strong> <span className="font-bold uppercase pl-1">{staffName}</span></div>
                        <div><strong>BRANCH:</strong> <span className="font-semibold pl-1">VILLAMOR</span></div>
                        <div><strong>CONTACT NO:</strong> <span className="pl-1">0956 632 7642</span></div>
                      </div>

                      {/* Right: Payment Status */}
                      <div className="border border-black p-1.5 space-y-0.5 bg-white text-black leading-snug">
                        <div className="flex justify-between">
                          <span>TOTAL COMPUTED:</span>
                          <span className="font-mono font-bold">₱{formatCurrency(grandTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>DOWNPAYMENT / PAID:</span>
                          <span className="font-mono font-bold">₱{formatCurrency(effectivePaid)}</span>
                        </div>
                        <div className="border-t border-black pt-0.5 flex justify-between font-black">
                          <span>BALANCE DUE UPON CLAIM:</span>
                          <span className="font-mono text-red-600 font-bold">₱{formatCurrency(balanceDue)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Scripture Quote (matching authentic sheet) */}
                    <div className="text-center pt-0.5 border-t border-slate-300 shrink-0">
                      <p className="text-[8px] sm:text-[8.5px] italic text-slate-700 m-0 leading-normal">
                        &ldquo;Each of you should use whatever gift you have received to serve others, as faithful stewardess of God&apos;s grace in its various forms.&rdquo; &mdash; 1 Peter 4:10
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                /* ======================================================================== */
                /* BACK PAGE: 2 IDENTICAL SERVICE TERMS AND CONDITIONS (CUT IN HALF)         */
                /* ======================================================================== */
                <>
                  {/* UPPER HALF: TERMS & CONDITIONS (STORE / WORKSHOP COPY) */}
                  {renderTermsAndConditions()}

                  {/* PERFORATION / CUT-OFF DIVIDER */}
                  <div className="claim-slip-divider relative my-2 py-0.5 flex items-center justify-center break-inside-avoid print:my-0 print:py-0 shrink-0">
                    <div className="w-full border-t border-dashed border-black" />
                    <span className="absolute bg-white px-3 text-[7.5px] font-black uppercase tracking-widest text-black border border-black rounded-full flex items-center gap-1 shadow-2xs">
                      ✂ .................................... (CUT HERE) .................................... ✂
                    </span>
                  </div>

                  {/* LOWER HALF: IDENTICAL TERMS & CONDITIONS (CUSTOMER COPY) */}
                  {renderTermsAndConditions()}
                </>
              )}

            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interactive Electronic Signature Pad Modal */}
      <SignaturePadModal
        open={Boolean(activeSignRole)}
        onOpenChange={(open) => !open && setActiveSignRole(null)}
        onSave={handleSaveSignature}
        title={activeSignRole === 'customer' ? 'Customer E-Signature' : 'Staff In-Charge E-Signature'}
        initialSignature={activeSignRole === 'customer' ? (customerSig || undefined) : (staffSig || undefined)}
      />
    </>
  );
}

export default ClaimSlipModal;

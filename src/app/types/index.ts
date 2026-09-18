export type JobStatus = 'new-order' | 'on-going' | 'for-release' | 'claimed' | 'cancelled';
export type Priority = 'regular' | 'rush' | 'premium';
export type ShippingPreference = 'pickup' | 'delivery';
export type PaymentMethod = 'cash' | 'gcash' | 'maya';
export type PaymentStatus = 'fully-paid' | 'downpayment' | 'unpaid' | 'pending';

export interface ShoeEntry {
    id: number;
    shoeName: string;
    brand?: string;
    shoeModel?: string;
    shoeMaterial?: string;
    shoeSize?: string;
    description: string;
    quantity: number;
    condition?: any;
    baseService: string[];
    addOns: any[];
    inventoryUsed: any[];
    color?: string;
    priorityLevel?: Priority;
    rushReductionDays?: string | number;
    /**
     * Immutable pricing snapshot captured when the service was added to this shoe.
     * Used for historical financial integrity to prevent old prices from changing.
     */
    historicalBasePrices?: { name: string; price: number }[];
    /**
     * Immutable pricing snapshot captured when the add-on was added to this shoe.
     * Used for historical financial integrity to prevent old prices from changing.
     */
    historicalAddOnPrices?: { name: string; price: number }[];
    status?: JobStatus;
    actualReleaseDate?: Date | string | null;
    actualCompletionDate?: Date | string | null;
    releasedBy?: string;
    claimedBy?: string;
    beforeImage?: string;
    afterImage?: string;
}

export interface InventoryUsed {
  itemId: number;
  name: string;
  quantity: number;
  unit: string;
  price?: number;
  staffMember?: string;
  date?: string;
  time?: string;
  isRetail?: boolean;
  variant?: string;
}

export interface InventoryItem {
  id: number;
  inventory_number?: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  price: number;
  status: string;
  isActive: boolean;
  auto_deduct?: boolean;
  auto_deduct_trigger?: string;
  trigger_service?: string;
  consumption_qty?: number;
  consumption_unit?: string;
  package_size?: number;
  package_unit?: string;
  low_stock_threshold?: number;
  is_retail?: boolean;
  retail_price?: number;
}

export interface BaseJobOrderData {
  // Customer Information
  customerName: string;
  contactNumber: string;

  // Shoe Details
  brand: string;
  shoeModel: string;
  shoeMaterial: string;
  shoeSize?: string;
  color?: string;
  quantity: number;
  condition: {
    scratches: boolean;
    ripsHoles: boolean;
    wornOut: boolean;
    soleSeparation: boolean;
    yellowing: boolean;
    deepStains: boolean;
    others: string;
  };

  // Services
  baseService: string[];
  addOns: { name: string; quantity: number }[];
  /**
   * Immutable pricing snapshot captured when the service was added to this shoe.
   * Used for historical financial integrity to prevent old prices from changing.
   */
  historicalBasePrices?: { name: string; price: number }[];
  /**
   * Immutable pricing snapshot captured when the add-on was added to this shoe.
   * Used for historical financial integrity to prevent old prices from changing.
   */
  historicalAddOnPrices?: { name: string; price: number }[];
  priorityLevel: Priority;
  rushReductionDays?: number;

  // Pricing
  baseServiceFee: number;
  addOnsTotal: number;
  grandTotal: number;

  // Shipping
  shippingPreference: ShippingPreference;
  deliveryAddress?: string; // Composed address
  deliveryCourier?: string;
  province?: string;
  city?: string;
  barangay?: string;
  zipCode?: string;

  // Payment
  paymentMethod?: PaymentMethod | string;
  paymentStatus?: PaymentStatus;
  amountReceived?: number;
  change?: number;
  balance?: number;
  referenceNo?: string;
  depositAmount?: number;
  releaseTime?: string;
  refundAmount?: number;
  refundReason?: string;
  cancellationReason?: string;
  forfeitedDeposit?: number;
  initialPaymentMethod?: PaymentMethod | string;
  finalPaymentMethod?: PaymentMethod | string;
  claimReferenceNo?: string;
  paymentHistory?: PaymentRecord[];

  // Metadata
  transactionDate: Date;
  processedBy: string;
  beforeImage?: string;
  afterImage?: string;
}

export interface PaymentRecord {
  id: string;
  paymentType: 'downpayment' | 'final-payment' | 'full-payment' | 'additional-payment' | 'refund';
  method: PaymentMethod | string;
  amount: number;
  referenceNo?: string;
  date: Date | string;
  processedBy?: string;
  notes?: string;
}

export interface ShoeItem {
  id: string;
  brand: string;
  shoeModel: string;
  shoeMaterial: string;
  shoeSize?: string;
  color?: string;
  quantity: number;
  condition: {
    scratches: boolean;
    ripsHoles: boolean;
    wornOut: boolean;
    soleSeparation: boolean;
    yellowing: boolean;
    deepStains: boolean;
    others: string;
  };
  baseService: string[];
  addOns: { name: string; quantity: number }[];
  /**
   * Immutable pricing snapshot captured when the service was added to this shoe.
   * Used for historical financial integrity to prevent old prices from changing.
   */
  historicalBasePrices?: { name: string; price: number }[];
  /**
   * Immutable pricing snapshot captured when the add-on was added to this shoe.
   * Used for historical financial integrity to prevent old prices from changing.
   */
  historicalAddOnPrices?: { name: string; price: number }[];
  status?: JobStatus;
  actualReleaseDate?: Date | string | null;
  actualCompletionDate?: Date | string | null;
  releasedBy?: string;
  claimedBy?: string;
  inventoryUsed?: any[];
  beforeImage?: string;
  afterImage?: string;
}

export interface JobOrder extends BaseJobOrderData {
  id: string;
  orderNumber: string;
  status: JobStatus;
  assignedTo?: string;
  predictedCompletionDate?: Date;
  predictedAt?: Date;
  predictedDays?: number;
  estimatedDays?: number;
  actualReleaseDate?: Date | string | null;
  actualCompletionDate?: Date | string | null;
  claimedAt?: Date | string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: ShoeItem[];
  releaseTime?: string;
  claimedBy?: string;
  releasedBy?: string;
  customerSignature?: string;
  staffSignature?: string;
  statusHistory: Array<{
    status: JobStatus;
    timestamp: Date;
    user: string;
  }>;
  inventoryUsed?: InventoryUsed[];
  inventoryApplied?: boolean;
  cancellationStage?: 'new-order' | 'on-going' | string;
  cancellationReason?: string;
  refundStatus?: 'refunded' | 'no-refund' | string;
  refundAmount?: number;
  cancelledAt?: Date | string;
  preCancellationState?: PreCancellationPaymentState;
  orderDate?: string;
  orderTime?: string;
  formDurationSeconds?: number;
  formDurationFormatted?: string;
  efficiencyMetric?: string;
}

export interface PreCancellationPaymentState {
  status: JobStatus | string;
  paymentStatus: PaymentStatus | string;
  amountReceived: number;
  balance: number;
  depositAmount: number;
  paymentMethod?: PaymentMethod | string;
  initialPaymentMethod?: PaymentMethod | string;
  finalPaymentMethod?: PaymentMethod | string;
  referenceNo?: string;
  claimReferenceNo?: string;
  paymentHistory?: PaymentRecord[];
  actualReleaseDate?: Date | string | null;
  actualCompletionDate?: Date | string | null;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  category: 'base' | 'addon' | 'priority';
  active: boolean;
  description?: string;
  durationDays?: string | number;
  code?: string;
  sortOrder?: number;
  connectedAddons?: string[];
}

export interface User {
  id: string;
  username: string;
  role: 'owner' | 'staff' | 'front staff' | 'admin';
  email?: string;
  password?: string;
  active: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
}

export interface Shelf {
  id: string;
  row: number;
  column: number;
  occupied: boolean;
  jobOrderId?: string;
}

export interface CashSession {
  id: number;
  business_date: string;
  opening_cash: number;
  expected_cash?: number | null;
  actual_cash?: number | null;
  over_short?: number | null;
  status: 'OPEN' | 'CLOSED';
  opened_by: number;
  opened_by_name?: string;
  opened_at: string;
  closed_by?: number | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
  variance_reason?: string | null;
}

export interface CashSummary {
  session: CashSession | null;
  business_date: string;
  beginning_cash: number;
  cash_sales: number;
  gcash_sales: number;
  maya_sales: number;
  digital_sales: number;
  other_sales: number;
  total_daily_payments: number;
  business_expenses: number;
  owner_withdrawals: number;
  total_cash_out: number;
  expected_cash: number;
}

export interface CashTransaction {
  id: string;
  time: string;
  raw_time?: string;
  transaction: string;
  details: string;
  order_id: string;
  cash_in: number;
  cash_out: number;
  amount?: number;
  method?: string;
}

export interface FrontStaffSummary {
  total_sales: number;
  cash_sales: number;
  digital_sales: number;
  balance_due: number;
  daily_expenses: number;
  cash_on_hand: number;
  session_status: 'OPEN' | 'CLOSED' | 'NONE';
  business_date: string;
}


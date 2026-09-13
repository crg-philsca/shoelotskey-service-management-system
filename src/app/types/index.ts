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
  initialPaymentMethod?: PaymentMethod | string;
  finalPaymentMethod?: PaymentMethod | string;
  claimReferenceNo?: string;
  paymentHistory?: PaymentRecord[];

  // Metadata
  transactionDate: Date;
  processedBy: string;
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
  actualReleaseDate?: Date;
  actualCompletionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  items?: ShoeItem[];
  releaseTime?: string;
  claimedBy?: string;
  releasedBy?: string;
  statusHistory: Array<{
    status: JobStatus;
    timestamp: Date;
    user: string;
  }>;
  inventoryUsed?: InventoryUsed[];
  inventoryApplied?: boolean;
  cancellationStage?: 'new-order' | 'on-going';
  refundStatus?: 'refunded' | 'no-refund';
  cancelledAt?: Date | string;
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
  role: 'owner' | 'staff' | 'admin';
  email?: string;
  password?: string;
  active: boolean;
}

export interface Shelf {
  id: string;
  row: number;
  column: number;
  occupied: boolean;
  jobOrderId?: string;
}

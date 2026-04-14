export type JobStatus = 'new-order' | 'on-going' | 'for-release' | 'claimed';
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
    description: string;
    quantity: number;
    condition?: any;
    baseService: string[];
    addOns: any[];
    inventoryUsed: any[];
}

export interface InventoryUsed {
  itemId: number;
  name: string;
  quantity: number;
  unit: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  stock: number;
  unit: string;
  price: number;
  status: string;
  isActive: boolean;
}

export interface BaseJobOrderData {
  // Customer Information
  customerName: string;
  contactNumber: string;

  // Shoe Details
  brand: string;
  shoeModel: string;
  shoeMaterial: string;
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
  priorityLevel: Priority;

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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountReceived?: number;
  change?: number;
  referenceNo?: string;
  depositAmount?: number;
  releaseTime?: string;

  // Metadata
  transactionDate: Date;
  processedBy: string;
}

export interface ShoeItem {
  id: string;
  brand: string;
  shoeModel: string;
  shoeMaterial: string;
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
}

export interface JobOrder extends BaseJobOrderData {
  id: string;
  orderNumber: string;
  status: JobStatus;
  assignedTo?: string;
  predictedCompletionDate?: Date;
  actualCompletionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  items?: ShoeItem[];
  releaseTime?: string;
  claimedBy?: string;
  statusHistory: Array<{
    status: JobStatus;
    timestamp: Date;
    user: string;
  }>;
  inventoryUsed?: InventoryUsed[];
  inventoryApplied?: boolean;
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
}

export interface User {
  id: string;
  username: string;
  role: 'owner' | 'staff';
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

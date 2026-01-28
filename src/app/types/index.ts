export type JobStatus = 'new-order' | 'on-going' | 'for-release' | 'claimed';
export type Priority = 'regular' | 'rush' | 'premium';
export type ShippingPreference = 'pickup' | 'delivery';
export type PaymentMethod = 'cash' | 'gcash' | 'paymaya' | 'bank_transfer' | 'maya';
export type PaymentStatus = 'unpaid' | 'paid' | 'partial';

export interface ServiceIntakeData {
  // Customer Information
  customerName: string;
  contactNumber: string;

  // Shoe Details
  brand: string;
  shoeType: string;
  shoeMaterial: string;
  quantity: number;
  condition: {
    scratches: boolean;
    ripsHoles: boolean;
    wornOut: boolean;
    soleSeparation: boolean;
    yellowing: boolean;
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
  deliveryAddress?: string;

  // Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountReceived?: number;
  change?: number;

  // Storage
  shelfLocation?: string;

  // Metadata
  transactionDate: Date;
  processedBy: string;
}

export interface JobOrder extends ServiceIntakeData {
  id: string;
  orderNumber: string;
  status: JobStatus;
  assignedTo?: string;
  predictedCompletionDate?: Date;
  actualCompletionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  statusHistory: Array<{
    status: JobStatus;
    timestamp: Date;
    user: string;
  }>;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  category: 'base' | 'addon' | 'priority';
  active: boolean;
  description?: string;
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

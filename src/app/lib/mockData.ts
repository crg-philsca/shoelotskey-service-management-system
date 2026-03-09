import { Service, JobOrder, JobStatus, Shelf, Priority, PaymentMethod } from '@/app/types';

// Services based on the pricing image
export const mockServices: Service[] = [
  // Base Services
  { id: '1', name: 'Basic Cleaning', price: 325, category: 'base', active: true, description: 'Standard shoe cleaning service', durationDays: 10, code: 'BCN' },
  { id: '2', name: 'Minor Reglue', price: 125, category: 'base', active: true, description: 'Minor regluing', durationDays: 25, code: 'MRG' },
  { id: '3', name: 'Full Reglue', price: 250, category: 'base', active: true, description: 'Full regluing', durationDays: 25, code: 'FRG' },
  { id: '4', name: 'Color Renewal', price: 325, category: 'base', active: true, durationDays: 15, code: 'CR2' },

  // Add-ons
  { id: '6', name: 'Unyellowing', price: 125, category: 'addon', active: true, durationDays: 5, code: 'UNY' },
  { id: '12', name: 'White Paint', price: 150, category: 'addon', active: true, durationDays: 2, code: 'WPT' },
  { id: '7', name: 'Minor Retouch', price: 125, category: 'addon', active: true, durationDays: 5, code: 'MRT' },
  { id: '8', name: 'Add Glue Layer', price: 150, category: 'addon', active: true, durationDays: 1, code: 'AGL' },
  { id: '9', name: 'Minor Restoration', price: 225, category: 'addon', active: true, durationDays: 5, code: 'MRS' },
  { id: '10', name: '2 Colors', price: 375, category: 'addon', active: true, durationDays: 25, code: 'CR2' },
  { id: '11', name: '3 Colors', price: 475, category: 'addon', active: true, durationDays: 25, code: 'CR3' },
  { id: '17', name: 'Premium Glue', price: 1530, category: 'addon', active: true, durationDays: 25, code: 'PMG' },
  { id: '18', name: 'Midsole', price: 150, category: 'addon', active: true, durationDays: 25, code: 'FMG' },
  { id: '19', name: 'Undersole', price: 150, category: 'addon', active: true, durationDays: 25, code: 'FUG' },

  // Priority
  { id: '13', name: 'Rush Fee (Basic Cleaning)', price: 150, category: 'priority', active: true, durationDays: -9 },
  { id: '14', name: 'Rush Fee (Minor Reglue)', price: 250, category: 'priority', active: false, durationDays: -1 },
  { id: '16', name: 'Rush Fee (Full Reglue)', price: 250, category: 'priority', active: false, durationDays: -1 }
];

const customerNames = [
  'Juan dela Cruz', 'Maria Santos', 'Jose Rizal', 'Ana Garcia', 'Pedro Reyes', 'Sofia Moreno',
  'Miguel Torres', 'Isabella Lopez', 'Carlos Mendoza', 'Gabriela Silva', 'Antonio Vargas', 'Carmen Ruiz'
];

function generateMockOrders(): JobOrder[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const orderConfigs: { service: string; status: JobStatus; priority?: Priority; paymentMethod?: PaymentMethod }[] = [
    // Basic Cleaning (5)
    { service: 'Basic Cleaning', status: 'claimed', paymentMethod: 'cash' },
    { service: 'Basic Cleaning', status: 'claimed', priority: 'rush', paymentMethod: 'gcash' },
    { service: 'Basic Cleaning', status: 'for-release' },
    { service: 'Basic Cleaning', status: 'on-going' },
    { service: 'Basic Cleaning', status: 'new-order' },

    // Minor Reglue (4)
    { service: 'Minor Reglue', status: 'claimed', paymentMethod: 'maya' },
    { service: 'Minor Reglue', status: 'for-release', priority: 'rush' },
    { service: 'Minor Reglue', status: 'for-release' },
    { service: 'Minor Reglue', status: 'on-going' },

    // Full Reglue (3)
    { service: 'Full Reglue', status: 'claimed', paymentMethod: 'cash' },
    { service: 'Full Reglue', status: 'for-release', priority: 'rush' },
    { service: 'Full Reglue', status: 'on-going' },

    // Color Renewal (2)
    { service: 'Color Renewal', status: 'claimed', paymentMethod: 'gcash' },
    { service: 'Color Renewal', status: 'new-order', priority: 'rush' },
  ];

  return orderConfigs.map((config, i) => {
    const sequenceId = i + 1;
    const orderTime = new Date(today);
    orderTime.setHours(0, 1, 0, 0); // Start of day

    // Spread orders evenly up to 2.5 hours ago to ensure 'claims' (+2 hours) stay in the past relative to right now.
    // If it's very early morning, they will just be packed around midnight.
    const availableMs = Math.max(0, today.getTime() - orderTime.getTime() - (2.5 * 60 * 60 * 1000));
    const offset = (availableMs / 14) * i;
    orderTime.setTime(orderTime.getTime() + offset);

    const customerName = customerNames[i % customerNames.length];
    const baseService = mockServices.find(s => s.name === config.service)!;
    const isClaimed = config.status === 'claimed';
    const grandTotal = baseService.price + (config.priority === 'rush' ? 150 : 0);

    const baseDays = config.service === 'Basic Cleaning' ? 10 : 25;
    const isRushEligible = config.service === 'Basic Cleaning' || config.service.includes('Reglue');
    const finalDays = (config.priority === 'rush' && isRushEligible) ? baseDays - 1 : baseDays;

    // Simulate status movement events later in the day
    const statusHistory = [{ status: 'new-order' as JobStatus, timestamp: new Date(orderTime), user: 'staff' }];

    if (config.status !== 'new-order') {
      const ongoingTime = new Date(orderTime);
      ongoingTime.setMinutes(ongoingTime.getMinutes() + 15);
      statusHistory.push({ status: 'on-going', timestamp: ongoingTime, user: 'staff' });
    }

    if (['for-release', 'claimed'].includes(config.status)) {
      const releaseTime = new Date(orderTime);
      releaseTime.setMinutes(releaseTime.getMinutes() + 45);
      statusHistory.push({ status: 'for-release', timestamp: releaseTime, user: 'staff' });
    }

    if (config.status === 'claimed') {
      const claimTime = new Date(orderTime);
      claimTime.setHours(claimTime.getHours() + 2);
      statusHistory.push({ status: 'claimed', timestamp: claimTime, user: 'staff' });
    }

    const finalClaimDate = config.status === 'claimed' ? statusHistory.find(h => h.status === 'claimed')?.timestamp : undefined;

    return {
      id: `JO-TODAY-${sequenceId}`,
      orderNumber: `ORD-${year}-${month}-${day}-${String(sequenceId).padStart(3, '0')}`,
      customerName,
      contactNumber: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      brand: 'Nike',
      shoeModel: 'Sneakers',
      shoeMaterial: 'Leather',
      quantity: 1,
      condition: { scratches: false, ripsHoles: false, soleSeparation: false, yellowing: false, wornOut: false, deepStains: false, others: '' },
      baseService: [baseService.name],
      addOns: [],
      priorityLevel: config.priority || 'regular',
      baseServiceFee: baseService.price,
      addOnsTotal: 0,
      grandTotal,
      shippingPreference: 'pickup',
      paymentMethod: config.paymentMethod || 'cash',
      paymentStatus: isClaimed ? 'fully-paid' : (i % 3 === 0 ? 'fully-paid' : 'downpayment'),
      amountReceived: isClaimed || (i % 3 === 0) ? grandTotal : 0,
      transactionDate: orderTime,
      createdAt: orderTime,
      updatedAt: statusHistory[statusHistory.length - 1].timestamp,
      processedBy: 'staff',
      claimedBy: isClaimed ? customerName : undefined,
      status: config.status,
      assignedTo: 'staff',
      predictedCompletionDate: new Date(orderTime.getTime() + finalDays * 24 * 60 * 60 * 1000),
      actualCompletionDate: finalClaimDate,
      statusHistory,
    };
  });
}

export const mockJobOrders: JobOrder[] = generateMockOrders();

export const mockShelves: Shelf[] = Array.from({ length: 100 }, (_, i) => {
  const row = Math.floor(i / 20) + 1;
  const column = (i % 20) + 1;
  const activeOrders = mockJobOrders.filter(order => order.status !== 'claimed');
  const occupied = i < activeOrders.length;
  return { id: `R${row}-C${column}`, row, column, occupied, jobOrderId: occupied ? activeOrders[i].id : undefined };
});

export function getStatusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    'new-order': 'bg-purple-100 text-purple-800 border-purple-300',
    'on-going': 'bg-blue-100 text-blue-800 border-blue-300',
    'for-release': 'bg-orange-100 text-orange-800 border-orange-300',
    'claimed': 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return colors[status];
}

export function getPriorityBadgeColor(priority: string): string {
  return priority === 'rush' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white';
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}

export const mockExpenses: Expense[] = [
  { id: '1', category: 'Water', amount: 600, date: new Date().toISOString().split('T')[0] },
  { id: '2', category: 'Electricity', amount: 500, date: new Date().toISOString().split('T')[0] }
];

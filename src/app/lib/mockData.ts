import { Service, JobOrder, JobStatus, Shelf, Priority, PaymentMethod } from '@/app/types';

// Services based on the pricing image
export const mockServices: Service[] = [
  // Base Services
  { id: '1', name: 'Basic Cleaning', price: 325, category: 'base', active: true, description: 'Standard shoe cleaning service' },
  { id: '2', name: 'Minor Reglue', price: 125, category: 'base', active: true, description: 'Minor regluing' },
  { id: '3', name: 'Full Reglue', price: 250, category: 'base', active: true, description: 'Full regluing' },
  { id: '4', name: 'Color Renewal', price: 325, category: 'base', active: true },

  // Add-ons
  { id: '6', name: 'Unyellowing', price: 125, category: 'addon', active: true },
  { id: '12', name: 'White Paint', price: 150, category: 'addon', active: true },
  { id: '7', name: 'Minor Retouch', price: 125, category: 'addon', active: true },
  { id: '8', name: 'Another Layer', price: 150, category: 'addon', active: true },
  { id: '9', name: 'Minor Restoration', price: 225, category: 'addon', active: true },
  { id: '10', name: '2 Colors', price: 375, category: 'addon', active: true },
  { id: '11', name: '3 Colors', price: 475, category: 'addon', active: true },
  { id: '17', name: 'Premium Glue', price: 1530, category: 'addon', active: true },
  { id: '13', name: 'Rush Fee (Basic Cleaning)', price: 150, category: 'priority', active: true },
  { id: '14', name: 'Rush Fee (Minor Reglue)', price: 250, category: 'priority', active: true },
  { id: '15', name: 'Rush Fee (Full Reglue)', price: 250, category: 'priority', active: true },
  { id: '16', name: 'Premium Fee (Color Renewal)', price: 1000, category: 'priority', active: true },
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

    // Spreading intake from 09:00 to 18:00
    if (i === 0) {
      orderTime.setHours(9, 38, 0, 0);
    } else {
      const hour = 9 + Math.floor((i * 9) / 14);
      const minute = (i * 17) % 60;
      orderTime.setHours(hour, minute, 0, 0);
    }

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
      shoeType: 'Sneakers',
      shoeMaterial: 'Leather',
      quantity: 1,
      condition: { scratches: false, ripsHoles: false, soleSeparation: false, yellowing: false, wornOut: false, others: '' },
      baseService: [baseService.name],
      addOns: [],
      priorityLevel: config.priority || 'regular',
      baseServiceFee: baseService.price,
      addOnsTotal: 0,
      grandTotal,
      shippingPreference: 'pickup',
      paymentMethod: config.paymentMethod || 'cash',
      paymentStatus: isClaimed ? 'paid' : (i % 3 === 0 ? 'paid' : 'unpaid'),
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

import { Service, JobOrder, JobStatus, PaymentStatus, Shelf } from '@/app/types';

// Services based on the pricing image
export const mockServices: Service[] = [
  // Base Services
  { id: '1', name: 'Basic Cleaning', price: 325, category: 'base', active: true, description: 'Standard shoe cleaning service' },
  { id: '2', name: 'Minor Reglue (with basic cleaning)', price: 450, category: 'base', active: true, description: 'Minor regluing with basic cleaning' },
  { id: '3', name: 'Full Reglue (with basic cleaning)', price: 575, category: 'base', active: true, description: 'Full regluing with basic cleaning' },
  { id: '4', name: 'Color Renewal (with basic cleaning)', price: 325, category: 'base', active: true },

  // Add-ons
  { id: '6', name: 'Unyellowing', price: 125, category: 'addon', active: true },
  { id: '12', name: 'White Paint', price: 150, category: 'addon', active: true },
  { id: '7', name: 'Minor Retouch', price: 125, category: 'addon', active: true },
  { id: '8', name: 'Another Layer', price: 150, category: 'addon', active: true },
  { id: '9', name: 'Minor Restoration', price: 225, category: 'addon', active: true },
  { id: '10', name: '2 Colors', price: 375, category: 'addon', active: true },
  { id: '11', name: '3 Colors', price: 475, category: 'addon', active: true },
  { id: '13', name: 'Rush Fee (Basic Cleaning)', price: 150, category: 'priority', active: true },
  { id: '14', name: 'Rush Fee (Minor Reglue)', price: 250, category: 'priority', active: true },
  { id: '15', name: 'Rush Fee (Full Reglue)', price: 250, category: 'priority', active: true },
  { id: '16', name: 'Premium Fee (Color Renewal)', price: 1000, category: 'priority', active: true },
];

// Generate mock job orders
const customerNames = [
  'Juan dela Cruz', 'Maria Santos', 'Jose Rizal', 'Ana Garcia', 'Pedro Reyes', 'Sofia Moreno',
  'Miguel Torres', 'Isabella Lopez', 'Carlos Mendoza', 'Gabriela Silva', 'Antonio Vargas', 'Carmen Ruiz',
  'Roberto Castillo', 'Elena Morales', 'Fernando Alvarez', 'Rosa Delgado', 'Luis Ramirez', 'Patricia Gomez',
  'Diego Fernandez', 'Monica Herrera', 'Alejandro Jimenez', 'Laura Castro', 'Ricardo Ortega', 'Diana Soto',
  'Eduardo Chavez', 'Silvia Medina', 'Francisco Guerrero', 'Teresa Rios', 'Javier Morales', 'Beatriz Luna',
  'Manuel Vega', 'Adriana Flores', 'Pablo Aguilar', 'Natalia Moreno', 'Raul Navarro', 'Valentina Pena',
  'Oscar Dominguez', 'Camila Suarez', 'Victor Ruiz', 'Lucia Alvarez', 'Emilio Torres', 'Paula Mendoza',
  'Hugo Silva', 'Sara Vargas', 'Mario Castillo', 'Andrea Morales', 'Rafael Alvarez', 'Cristina Delgado',
  'Enrique Ramirez', 'Marina Gomez', 'Alberto Fernandez', 'Julia Herrera', 'Sergio Jimenez', 'Paula Castro'
];
const brands = ['Nike', 'Adidas', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 'Under Armour', 'Jordan', 'Asics', 'Fila', 'Skechers'];
const shoeTypes = ['Sneakers', 'Running Shoes', 'Basketball Shoes', 'Canvas Shoes', 'Boots', 'Sandals', 'Loafers', 'High-tops', 'Low-tops', 'Casual Shoes'];
const technicians = ['staff', 'staff1', 'staff2', 'technician'];
const staffUsers = ['owner', 'staff', 'staff1', 'staff2'];

export const mockJobOrders: JobOrder[] = (() => {
  const orders: JobOrder[] = [];
  const today = new Date();
  today.setHours(10, 0, 0, 0); // Set to 10 AM today for consistency

  const baseServices = mockServices.filter(s => s.category === 'base');
  const statuses: JobStatus[] = ['new-order', 'on-going', 'for-release', 'claimed'];
  const paymentMethods = ['cash', 'gcash', 'maya'];

  // Generate guaranteed TODAY orders with all combinations (4 services × 4 statuses × 3 payments = 48 orders)
  let todayOrderId = 1;
  baseServices.forEach((service) => {
    statuses.forEach((status) => {
      paymentMethods.forEach((paymentMethod) => {
        const grandTotal = service.price + Math.floor(Math.random() * 200);
        const paymentStatus: PaymentStatus = status === 'claimed' ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'unpaid');

        orders.push({
          id: `JO-TODAY-${String(todayOrderId++).padStart(3, '0')}`,
          orderNumber: `ORD-${new Date().getFullYear()}-${String(todayOrderId).padStart(4, '0')}`,
          customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
          contactNumber: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
          brand: brands[Math.floor(Math.random() * brands.length)],
          shoeType: shoeTypes[Math.floor(Math.random() * shoeTypes.length)],
          shoeMaterial: ['Leather', 'Synthetic', 'Canvas'][Math.floor(Math.random() * 3)],
          quantity: 1,
          condition: { scratches: true, ripsHoles: false, wornOut: true, soleSeparation: false, yellowing: true, others: '' },
          baseService: [service.name],
          addOns: [],
          priorityLevel: 'regular' as 'regular' | 'rush',
          baseServiceFee: service.price,
          addOnsTotal: 0,
          grandTotal,
          shippingPreference: 'pickup',
          paymentMethod: paymentMethod as 'cash' | 'gcash' | 'maya',
          paymentStatus,
          amountReceived: paymentStatus === 'paid' ? grandTotal : undefined,
          change: 0,
          shelfLocation: status !== 'claimed' ? `R1-C${todayOrderId}` : undefined,
          transactionDate: new Date(today),
          processedBy: staffUsers[0],
          status,
          assignedTo: todayOrderId < 6 ? 'staff' : (status !== 'new-order' || Math.random() > 0.4
            ? technicians[Math.floor(Math.random() * technicians.length)]
            : undefined),
          predictedCompletionDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
          actualCompletionDate: ['for-release', 'claimed'].includes(status) ? new Date(today) : undefined,
          createdAt: new Date(today),
          updatedAt: new Date(today),
          statusHistory: [{ status: 'new-order' as JobStatus, timestamp: new Date(today), user: staffUsers[0] }],
        });
      });
    });
  });

  // Continue with the rest of the year's orders
  return [...orders, ...Array.from({ length: 1000 }, (_, i) => {
    // Spread orders over the past year with more recent orders
    const daysAgo = Math.floor(Math.random() * Math.random() * 365); // Exponential distribution for more recent orders
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - daysAgo);
    createdDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);

    // Predicted completion date (3-7 days from creation)
    const predictedDate = new Date(createdDate);
    const processingDays = 3 + Math.floor(Math.random() * 5);
    predictedDate.setDate(predictedDate.getDate() + processingDays);

    // Select services with round-robin distribution to ensure all base services appear
    const baseServices = mockServices.filter(s => s.category === 'base'); // Get all 4 base services
    const baseService = baseServices[i % baseServices.length]; // Round-robin ensures even distribution
    const availableAddOns = mockServices.filter(s => s.category === 'addon');
    const addOns = availableAddOns.filter(() => Math.random() > 0.7); // 30% chance for each add-on
    const addOnsTotal = addOns.reduce((sum, addon) => sum + addon.price, 0);
    const grandTotal = baseService.price + addOnsTotal;

    // Status distribution (weighted towards completed statuses for older orders)
    let statusWeights: JobStatus[];
    if (daysAgo < 7) {
      statusWeights = ['new-order', 'new-order', 'on-going', 'on-going', 'on-going']; // More recent = more active
    } else if (daysAgo < 30) {
      statusWeights = ['on-going', 'for-release', 'for-release', 'claimed', 'claimed'];
    } else {
      statusWeights = ['for-release', 'claimed', 'claimed', 'claimed', 'claimed']; // Older = mostly completed
    }
    const status = statusWeights[Math.floor(Math.random() * statusWeights.length)];

    // Payment status (more likely to be paid for older orders)
    const paymentChance = daysAgo > 30 ? 0.9 : (daysAgo > 7 ? 0.7 : 0.4);
    const paymentStatus: PaymentStatus = Math.random() < paymentChance ? 'paid' : 'unpaid';

    // Amount received (if paid, might be partial or full)
    let amountReceived: number | undefined;
    let change: number | undefined;
    if (paymentStatus === 'paid') {
      const paymentAmount = Math.random() < 0.8 ? grandTotal : (grandTotal + Math.floor(Math.random() * 100)); // Sometimes overpay
      amountReceived = paymentAmount;
      change = Math.max(0, paymentAmount - grandTotal);
    }

    // Job ID generation (more realistic distribution)
    const year = createdDate.getFullYear();
    const month = String(createdDate.getMonth() + 1).padStart(2, '0');
    const day = String(createdDate.getDate()).padStart(2, '0');
    const sequence = String(i + 1).padStart(4, '0');

    // Group some orders together (multi-shoe orders)
    const isGrouped = Math.random() < 0.3; // 30% chance of being part of a group
    const groupSuffix = isGrouped ? String.fromCharCode(65 + (i % (2 + Math.floor(Math.random() * 3)))) : '';

    return {
      id: `JO-${year}${month}${day}-${sequence}${groupSuffix}`,
      orderNumber: `ORD-${year}-${sequence}`,
      customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
      contactNumber: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      brand: brands[Math.floor(Math.random() * brands.length)],
      shoeType: shoeTypes[Math.floor(Math.random() * shoeTypes.length)],
      shoeMaterial: ['Leather', 'Synthetic', 'Canvas', 'Mesh', 'Rubber', 'Textile', 'Suede', 'Knit', 'Patent Leather', 'Denim', 'Nubuck', 'Other'][Math.floor(Math.random() * 12)],
      quantity: 1 + Math.floor(Math.random() * 2), // 1-2 pairs per order
      condition: {
        scratches: Math.random() > 0.4,
        ripsHoles: Math.random() > 0.7,
        wornOut: Math.random() > 0.5,
        soleSeparation: Math.random() > 0.8,
        yellowing: Math.random() > 0.4,
        others: Math.random() > 0.9 ? ['Stains', 'Odor', 'Loose threads', 'Missing laces'][Math.floor(Math.random() * 4)] : '',
      },
      baseService: [baseService.name],
      addOns: addOns.map(a => ({ name: a.name, quantity: 1 })),
      priorityLevel: (Math.random() > 0.8 ? 'rush' : 'regular') as 'rush' | 'regular' | 'premium',
      baseServiceFee: baseService.price,
      addOnsTotal,
      grandTotal,
      shippingPreference: 'pickup' as 'pickup' | 'delivery',
      deliveryAddress: Math.random() > 0.6 ? undefined : `${Math.floor(Math.random() * 999) + 1} ${['Main St', 'Oak Ave', 'Pine Rd', 'Elm St', 'Maple Dr'][Math.floor(Math.random() * 5)]}, ${['Quezon City', 'Makati', 'Manila', 'Pasig', 'Taguig'][Math.floor(Math.random() * 5)]}, Metro Manila`,
      paymentMethod: (() => {
        const rand = Math.random();
        if (rand < 0.33) return 'cash';
        if (rand < 0.66) return 'gcash';
        return 'maya';
      })() as 'cash' | 'gcash' | 'maya',
      paymentStatus,
      amountReceived,
      change,
      shelfLocation: status !== 'claimed' ? `R${1 + Math.floor(Math.random() * 5)}-C${1 + Math.floor(Math.random() * 20)}` : undefined,
      transactionDate: createdDate,
      processedBy: staffUsers[Math.floor(Math.random() * staffUsers.length)],
      status,
      assignedTo: status !== 'new-order' || Math.random() > 0.3
        ? staffUsers[1 + Math.floor(Math.random() * (staffUsers.length - 1))] // Assign to staff1 or staff2
        : undefined,
      predictedCompletionDate: predictedDate,
      actualCompletionDate: ['for-release', 'claimed'].includes(status) ? new Date(createdDate.getTime() + (processingDays * 24 * 60 * 60 * 1000) + (Math.random() * 2 * 24 * 60 * 60 * 1000)) : undefined,
      createdAt: createdDate,
      updatedAt: new Date(createdDate.getTime() + Math.random() * (Date.now() - createdDate.getTime())),
      statusHistory: [
        {
          status: 'new-order' as JobStatus,
          timestamp: createdDate,
          user: staffUsers[Math.floor(Math.random() * staffUsers.length)],
        },
        ...(status !== 'new-order' ? [{
          status: status as JobStatus,
          timestamp: new Date(createdDate.getTime() + (1 + Math.random() * (Date.now() - createdDate.getTime()))),
          user: technicians[Math.floor(Math.random() * technicians.length)],
        }] : []),
      ],
    };
  })];
})();

// Generate shelf data (5 rows x 20 columns = 100 shelves)
// Rule: 1 Pair = 1 Job Order = 1 Shelf Slot
export const mockShelves: Shelf[] = Array.from({ length: 100 }, (_, i) => {
  const row = Math.floor(i / 20) + 1;
  const column = (i % 20) + 1;

  // Find active job orders (not claimed) to assign to shelves
  const activeOrders = mockJobOrders.filter(order => order.status !== 'claimed');
  const occupied = i < activeOrders.length;
  const jobOrderId = occupied ? activeOrders[i].id : undefined;

  return {
    id: `R${row}-C${column}`,
    row,
    column,
    occupied,
    jobOrderId,
  };
});

// Get status color
export function getStatusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    'new-order': 'bg-purple-100 text-purple-800 border-purple-300',
    'on-going': 'bg-blue-100 text-blue-800 border-blue-300',
    'for-release': 'bg-orange-100 text-orange-800 border-orange-300',
    'claimed': 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return colors[status];
}

// Get priority color
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

export const mockExpenses: Expense[] = (() => {
  const expenses: Expense[] = [];
  const categories = [
    { name: 'Water', avgAmount: 1500, frequency: 30 },
    { name: 'Internet', avgAmount: 2500, frequency: 30 },
    { name: 'Electricity', avgAmount: 3500, frequency: 30 },
    { name: 'Staff Salary', avgAmount: 12000, frequency: 15 },
    { name: 'Logistics', avgAmount: 800, frequency: 7 },
    { name: 'Cleaning Materials', avgAmount: 1200, frequency: 14 },
    { name: 'Food', avgAmount: 500, frequency: 3 },
    { name: 'Supplies', avgAmount: 2000, frequency: 20 },
    { name: 'Maintenance', avgAmount: 3000, frequency: 45 },
    { name: 'Rent', avgAmount: 15000, frequency: 30 },
  ];

  let id = 1;
  const today = new Date();

  // Generate expenses for the past year
  for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
    const expenseDate = new Date(today);
    expenseDate.setDate(expenseDate.getDate() - daysAgo);

    categories.forEach(category => {
      // Add expense based on frequency
      if (daysAgo % category.frequency === 0) {
        const variance = 0.8 + Math.random() * 0.4; // 80% to 120% of average
        const amount = Math.round(category.avgAmount * variance);

        expenses.push({
          id: String(id++),
          category: category.name,
          amount,
          date: expenseDate.toISOString().split('T')[0],
          notes: daysAgo === 0 ? 'Recent expense' : undefined,
        });
      }
    });
  }

  return expenses;
})();

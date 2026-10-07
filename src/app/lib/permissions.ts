/**
 * Granular Staff Permission Utilities
 * Shoelotskey Service Management System
 * 
 * Rules:
 * - Owner has full business access (always returns true).
 * - Admin has technical administrative access (always returns true for system operations).
 * - Staff and Front Staff permissions are evaluated against the authoritative permissions array.
 */

export const CANONICAL_PERMISSIONS = [
  // Job Orders
  { code: 'job_orders.view', name: 'View Job Orders', category: 'Job Orders', description: 'Allows Staff to view the Job Orders page and permitted Job Order details.' },
  { code: 'job_orders.create', name: 'Create Job Orders', category: 'Job Orders', description: 'Allows Staff to create new Job Orders.' },
  { code: 'job_orders.update', name: 'Update Job Orders', category: 'Job Orders', description: 'Allows Staff to edit permitted Job Order information and status.' },
  { code: 'job_orders.cancel', name: 'Cancel Job Orders', category: 'Job Orders', description: 'Allows Staff to initiate cancellation of an existing Job Order.' },
  { code: 'job_orders.authorize_cancel', name: 'Authorize Order Cancellations', category: 'Job Orders', description: 'Allows trusted Staff or supervisor to self-authorize order cancellations without secondary approval.' },
  { code: 'job_orders.release', name: 'Process Claim / Release', category: 'Job Orders', description: 'Allows Staff to process claim verification and mark orders as claimed/released.' },
  
  { code: 'payments.process', name: 'Process Payments', category: 'Payments & Discounts', description: 'Allows Staff to record/process customer payments.' },
  { code: 'discounts.apply', name: 'Allow Applying Discounts', category: 'Payments & Discounts', description: 'Allows Staff to view and select discounts on job orders.' },
  { code: 'discounts.authorize', name: 'Authorize Standard Discounts', category: 'Payments & Discounts', description: 'Allows this Staff member to authorize predefined system discounts when required.' },
  { code: 'discounts.use_auth_code', name: 'Use Authorization Code', category: 'Payments & Discounts', description: 'Allows this Staff member to use the store authorization code for discounts and cancellations.' },
  
  // Inventory
  { code: 'inventory.view', name: 'View Inventory', category: 'Inventory', description: 'Allows Staff to view inventory records, items, and stock information.' },
  { code: 'inventory.create_item', name: 'Add Item', category: 'Inventory', description: 'Allows creating new inventory catalog items.' },
  { code: 'inventory.add_stock', name: 'Add Stock', category: 'Inventory', description: 'Recording incoming purchase restocks.' },
  { code: 'inventory.use_stock', name: 'Use Stock', category: 'Inventory', description: 'Allows deducting supplies used on job orders.' },
  { code: 'inventory.adjust_balance', name: 'Adjust Balances', category: 'Inventory', description: 'Adjusting physical inventory counts and balances.' },
  { code: 'inventory.deactivate', name: 'Deactivate Inventory', category: 'Inventory', description: 'Allows Staff to deactivate/remove an eligible inventory item.' },
];

export const DEFAULT_STAFF_PERMISSIONS = [
  'job_orders.view',
  'job_orders.create',
  'job_orders.update',
  'job_orders.cancel',
  'job_orders.release',
  'payments.process',
  'discounts.apply',
  'inventory.view',
  'inventory.create_item',
  'inventory.add_stock',
  'inventory.use_stock',
  'inventory.adjust_balance',
];

export function hasPermission(
  user: { role?: string; permissions?: string[]; username?: string } | null | undefined,
  permissionCode: string
): boolean {
  if (!user) return false;

  const role = String(user.role || '').toLowerCase().trim();
  const username = String(user.username || '').toLowerCase().trim();

  // 1. Owner always has full business access
  if (role === 'owner' || username === 'owner') {
    return true;
  }

  // 2. Admin retains full administrative access
  if (role === 'admin' || username === 'admin') {
    return true;
  }

  // 3. For Staff or Front Staff, check the explicit permissions list
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  
  // Dependency enforcement:
  // If job_orders.view is missing, dependent actions are disabled
  if (['job_orders.update', 'job_orders.cancel', 'job_orders.authorize_cancel', 'job_orders.release'].includes(permissionCode)) {
    if (!permissions.includes('job_orders.view')) {
      return false;
    }
  }

  // If inventory.view is missing, dependent inventory actions are disabled
  const inventoryChildren = [
    'inventory.add', 'inventory.edit', 'inventory.deactivate',
    'inventory.create_item', 'inventory.add_stock', 'inventory.use_stock', 'inventory.adjust_balance'
  ];
  if (inventoryChildren.includes(permissionCode)) {
    if (!permissions.includes('inventory.view')) {
      return false;
    }
  }

  // Granular check: strictly check the specific permission code
  if (permissionCode === 'inventory.create_item') {
    return permissions.includes('inventory.create_item');
  }
  if (permissionCode === 'inventory.add_stock') {
    return permissions.includes('inventory.add_stock');
  }
  if (permissionCode === 'inventory.use_stock') {
    return permissions.includes('inventory.use_stock');
  }
  if (permissionCode === 'inventory.adjust_balance') {
    return permissions.includes('inventory.adjust_balance');
  }
  if (permissionCode === 'inventory.deactivate') {
    return permissions.includes('inventory.deactivate');
  }
  // Reverse mapping for legacy broad checks:
  if (permissionCode === 'inventory.add') {
    return permissions.includes('inventory.add') || permissions.includes('inventory.create_item') || permissions.includes('inventory.add_stock');
  }
  if (permissionCode === 'inventory.edit') {
    return permissions.includes('inventory.edit') || permissions.includes('inventory.use_stock') || permissions.includes('inventory.adjust_balance');
  }

  return permissions.includes(permissionCode);
}

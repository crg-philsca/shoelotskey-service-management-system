import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Eye, ShieldAlert, ShoppingCart, Package, Key, Printer, Tag, Users, Activity, FileText } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

import { useActivities, type ActivityLog } from '@/app/context/ActivityContext';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';

/**
 * COMPONENT: ActivityHistory
 * PURPOSE: Displays a list of system-wide activities (Audit Trail).
 * DATA SOURCE: ActivityContext (Synced with AuditLog backend table).
 */
function FormattedDateInput({ value, onChange, className, id }: { value: string; onChange: (val: string) => void; className?: string; id?: string }) {
    return (
        <Input
            id={id}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${className} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer relative pr-10`}
            style={{ textTransform: 'uppercase' }}
        />
    );
}

export default function ActivityHistory({ user }: { user: { token: string; role?: string } }) {
    useEffect(() => {
        // [OWASP A09] Security Audit: Logging view access with token context
        if (user.token) {
            console.log('[SECURITY] Activity History accessed by authenticated session');
        }
    }, [user.token]);

    const navigate = useNavigate();
    const { activities, refreshActivities } = useActivities();
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);

    // Always reload from server when opening Activity History so deletes/CRUD appear immediately.
    useEffect(() => {
        if (user.token) {
            void refreshActivities();
        }
    }, [user.token, refreshActivities]);

    // Dynamic user list from backend table
    const [userList, setUserList] = useState<{ username: string; role: string }[]>([
        { username: 'Owner', role: 'owner' }
    ]);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!user.token || user.role === 'staff') return;
            try {
                const res = await fetch(`${API_BASE}/users`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        const activeUsers = data
                            .filter((u: any) => u.is_active !== false)
                            .map((u: any) => ({
                                username: u.username,
                                role: u.role?.role_name || (u.username.toLowerCase() === 'owner' ? 'owner' : 'staff')
                            }));
                        // Preserve unique usernames and sort Owner first
                        const uniqueMap = new Map();
                        activeUsers.forEach((u: any) => uniqueMap.set(u.username.toLowerCase(), u));
                        if (!uniqueMap.has('owner')) {
                            uniqueMap.set('owner', { username: 'Owner', role: 'owner' });
                        }
                        const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
                            if (a.role === 'owner') return -1;
                            if (b.role === 'owner') return 1;
                            return a.username.localeCompare(b.username);
                        });
                        setUserList(sorted);
                    }
                }
            } catch (e) {
                console.warn('[SECURITY] Fallback to cached user list for audit filter');
                try {
                    const cache = localStorage.getItem('userManagement_cache');
                    if (cache) {
                        const parsed = JSON.parse(cache);
                        const activeUsers = parsed
                            .filter((u: any) => u.active !== false)
                            .map((u: any) => ({ username: u.username, role: u.role }));
                        setUserList(activeUsers.length > 0 ? activeUsers : [{ username: 'Owner', role: 'owner' }]);
                    }
                } catch (err) {}
            }
        };
        fetchUsers();
    }, [user.token, user.role]);

    // Predefined Module Filter Options
    const MODULE_OPTIONS = [
        { label: 'ALL TYPES & MODULES', value: 'all' },
        { label: 'System', value: 'System' },
        { label: 'Authentication', value: 'Authentication' },
        { label: 'Job Orders', value: 'Job Orders' },
        { label: 'Services', value: 'Services' },
        { label: 'Inventory', value: 'Inventory' },
        { label: 'Sales', value: 'Sales' },
        { label: 'Expenses', value: 'Expenses' },
        { label: 'Reports', value: 'Reports' },
        { label: 'User Management', value: 'User Management' },
        { label: 'Historical Records', value: 'Historical Records' },
        { label: 'Machine Learning', value: 'Machine Learning' }
    ];

    const getModuleBadge = (activity: ActivityLog) => {
        if (activity.module && activity.module !== 'System' && activity.module !== 'Orders') {
            if (activity.module === 'Orders') return 'Job Orders';
            return activity.module;
        }
        const type = (activity.type || '').toLowerCase();
        const action = (activity.action || '').toUpperCase();
        if (type === 'service' || activity.table === 'Services') return 'Services';
        if (type === 'inventory' || activity.table === 'Inventory') return 'Inventory';
        if (type === 'expense' || activity.table === 'Expenses') return 'Expenses';
        if (type === 'order' || activity.table === 'Orders' || activity.table === 'Job Orders') return 'Job Orders';
        if (
            action.includes('LOGIN') ||
            action.includes('LOGOUT') ||
            action.includes('LOGGED') ||
            action.includes('PASSWORD') ||
            action.includes('TIMEOUT') ||
            action.includes('SESSION')
        ) return 'Authentication';
        if (type === 'reports' || action === 'PRINT') return 'Reports';
        if (type === 'historical' || activity.module === 'Historical Records' || activity.table === 'Historical Records') return 'Historical Records';
        if (type === 'system' || activity.table === 'Users') return 'User Management';
        if (type === 'ml' || action.includes('PREDICT') || action.includes('TRAIN')) return 'Machine Learning';
        return activity.table || 'System';
    };

    const getBusinessActionTitle = (activity: ActivityLog) => {
        const action = activity.action.toUpperCase();
        const actionRaw = (activity.actionRaw || '').toUpperCase();
        const type = (activity.type || '').toLowerCase();
        const combined = `${actionRaw} ${action}`;
        const moduleName = String(activity.module || getModuleBadge(activity) || '').toUpperCase();
        const isOrder =
            type === 'order' ||
            activity.table === 'Orders' ||
            activity.table === 'Job Orders' ||
            moduleName === 'JOB ORDERS';
        const isService =
            type === 'service' || activity.table === 'Services' || activity.table === 'services' || moduleName === 'SERVICES';
        const isInventory =
            type === 'inventory' || activity.table === 'Inventory' || activity.table === 'inventory' || moduleName === 'INVENTORY';
        const isExpense =
            type === 'expense' || activity.table === 'Expenses' || activity.table === 'expenses' || moduleName === 'EXPENSES';
        const isUser =
            type === 'system' || activity.table === 'Users' || activity.table === 'users' || moduleName === 'USER MANAGEMENT';
        const isHistorical =
            moduleName === 'HISTORICAL RECORDS' ||
            activity.table === 'Historical Records' ||
            activity.table === 'historical_orders';

        // Cancel Order must never display as "Updated" or "Deleted"
        if (actionRaw === 'CANCEL' || action === 'CANCEL' || combined.includes('CANCEL')) {
            return 'Job Order Cancelled';
        }

        // Soft-delete / deactivate
        if (actionRaw === 'DEACTIVATE' || action.includes('DEACTIVATE')) {
            if (isInventory) return 'Inventory Deleted';
            if (isService) return 'Service Deactivated';
            if (isUser) return 'User Deactivated';
            if (isExpense) return 'Expense Deleted';
            if (isHistorical) return 'Historical Record Deleted';
            return 'Record Deactivated';
        }

        // Explicit DELETE
        if (action.includes('DELETE') || actionRaw.includes('DELETE')) {
            if (isInventory) return 'Inventory Deleted';
            if (isService) return 'Service Deleted';
            if (isOrder) return 'Job Order Deleted';
            if (isExpense) return 'Expense Deleted';
            if (isHistorical) return 'Historical Record Deleted';
            if (isUser) return 'User Deleted';
            return 'Record Deleted';
        }

        if (combined.includes('404')) return 'Page Not Found';
        if (combined.includes('SERVER_ERROR') || combined.includes('SERVER ERROR')) return 'Server Error';
        if (combined.includes('FAILED')) return 'Failed Login';
        if (combined.includes('TIMEOUT')) return 'Session Timeout';
        // LOGOUT before LOGIN — "LOGGED OUT" must not be classified as login.
        if (combined.includes('LOGOUT') || combined.includes('LOGGED OUT')) return 'User Logged Out';
        if (combined.includes('PASSWORD')) return 'Password Reset';
        if (combined.includes('LOGIN') || combined.includes('LOGGED IN')) return 'User Logged In';
        
        if (action.includes('RESTOCK') || actionRaw.includes('RESTOCK') || (activity.details || '').toLowerCase().includes('restock')) return 'Inventory Restocked';
        if (action.includes('DEDUCT') || actionRaw.includes('DEDUCT') || (activity.details || '').toLowerCase().includes('deduct')) return 'Inventory Deducted';
        if (action.includes('REACTIVATE') || actionRaw.includes('REACTIVATE') || (activity.details || '').toLowerCase().includes('reactivated')) return 'Inventory Reactivated';
        
        if (action.includes('PRINT') || type === 'reports') return 'Report Generated';

        if (isInventory) {
            if (action.includes('CREATE') || actionRaw.includes('CREATE')) return 'Inventory Added';
            return 'Inventory Updated';
        }
        if (isOrder) {
            if (action.includes('CREATE')) return 'New Job Order';
            if (activity.newValues?.status === 'claimed') return 'Order Claimed';
            if (activity.newValues?.status === 'for-release') return 'Order Ready For Release';
            return 'Job Order Updated';
        }
        if (isService) {
            if (action.includes('CREATE')) return 'Service Created';
            return 'Service Updated';
        }
        if (isExpense) {
            if (action.includes('CREATE')) return 'Expense Created';
            return 'Expense Updated';
        }
        if (isUser) {
            if (action.includes('CREATE')) return 'User Created';
            return 'User Updated';
        }
        if (isHistorical) {
            if (action.includes('CREATE')) return 'Historical Record Created';
            return 'Historical Record Updated';
        }

        return activity.action;
    };

    /** Normalize action tokens so "User Logged Out" and "LOGOUT" match the same checks. */
    const getActionTokens = (activity: ActivityLog) => {
        const raw = String(activity.actionRaw || '').toUpperCase();
        const action = String(activity.action || '').toUpperCase();
        const title = getBusinessActionTitle(activity).toUpperCase();
        return `${raw} ${action} ${title}`.replace(/[_-]+/g, ' ');
    };

    const isLogoutAction = (activity: ActivityLog) => {
        const t = getActionTokens(activity);
        return t.includes('LOGOUT') || t.includes('LOGGED OUT');
    };

    const isLoginAction = (activity: ActivityLog) => {
        if (isLogoutAction(activity)) return false;
        const t = getActionTokens(activity);
        return (t.includes('LOGIN') || t.includes('LOGGED IN')) && !t.includes('FAILED');
    };

    const getAffectedRecordLabel = (activity: ActivityLog) => {
        const moduleName = String(getModuleBadge(activity) || '').toUpperCase();
        const isAuth =
            moduleName === 'AUTHENTICATION' ||
            isLogoutAction(activity) ||
            isLoginAction(activity) ||
            getActionTokens(activity).includes('PASSWORD') ||
            getActionTokens(activity).includes('TIMEOUT');

        if (isAuth) {
            return (
                activity.oldValues?.username ||
                activity.newValues?.username ||
                activity.newValues?.username_attempted ||
                activity.user ||
                'N/A'
            );
        }

        return (
            activity.oldValues?.username ||
            activity.newValues?.username ||
            activity.oldValues?.order_number ||
            activity.newValues?.order_number ||
            activity.oldValues?.orderNumber ||
            activity.newValues?.orderNumber ||
            activity.oldValues?.order_id ||
            activity.newValues?.order_id ||
            activity.oldValues?.item_name ||
            activity.newValues?.item_name ||
            activity.oldValues?.itemName ||
            activity.newValues?.itemName ||
            activity.oldValues?.service_name ||
            activity.newValues?.service_name ||
            activity.oldValues?.customer_name ||
            activity.newValues?.customer_name ||
            activity.oldValues?.customerName ||
            activity.newValues?.customerName ||
            activity.oldValues?.description ||
            activity.newValues?.description ||
            (String(activity.newValues?.details || activity.details || '').match(/(?:on|item:?)\s*['"]?([^'"]+?)['"]?(?:\s*\(|\s*:|\s*updated|\s*$)/i)?.[1]) ||
            (String(activity.newValues?.details || activity.details || '').match(/(?:for|account for)\s+([A-Za-z0-9_.-]+)/i)?.[1]) ||
            activity.recordId ||
            'N/A'
        );
    };

    const getActionIcon = (title: string) => {
        const t = title.toUpperCase();
        if (t.includes('JOB ORDER') || t.includes('CLAIMED') || t.includes('RELEASE') || t.includes('CANCEL')) return <ShoppingCart className="w-3.5 h-3.5" />;
        if (t.includes('INVENTORY') || t.includes('RESTOCK') || t.includes('DEDUCT')) return <Package className="w-3.5 h-3.5" />;
        if (t.includes('LOGIN') || t.includes('LOGOUT') || t.includes('LOGGED') || t.includes('PASSWORD') || t.includes('SESSION')) return <Key className="w-3.5 h-3.5" />;
        if (t.includes('SERVER ERROR')) return <Activity className="w-3.5 h-3.5" />;
        if (t.includes('SERVICE')) return <Tag className="w-3.5 h-3.5" />;
        if (t.includes('EXPENSE')) return <Tag className="w-3.5 h-3.5" />;
        if (t.includes('REPORT')) return <Printer className="w-3.5 h-3.5" />;
        if (t.includes('USER')) return <Users className="w-3.5 h-3.5" />;
        return <Activity className="w-3.5 h-3.5" />;
    };

    const getActionBadge = (activity: ActivityLog) => {
        const actStr = getBusinessActionTitle(activity);
        const actUpper = actStr.toUpperCase();
        let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
        if (actUpper.includes('NEW') || actUpper.includes('CREATED') || actUpper.includes('ADDED') || actUpper.includes('REACTIVATED') || actUpper.includes('LOGGED IN') || actUpper.includes('RESTOCK')) {
            colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (actUpper.includes('UPDATE') || actUpper.includes('GENERATED') || actUpper.includes('EDIT')) {
            colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        } else if (actUpper.includes('DELETE') || actUpper.includes('OUT') || actUpper.includes('FAILED') || actUpper.includes('CANCEL') || actUpper.includes('DEDUCT')) {
            colorClass = "bg-rose-50 text-rose-700 border-rose-200";
        } else if (actUpper.includes('PASSWORD') || actUpper.includes('CLAIMED') || actUpper.includes('RELEASE')) {
            colorClass = "bg-purple-50 text-purple-700 border-purple-200";
        }
        return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-black uppercase border tracking-wide ${colorClass}`}>
                {getActionIcon(actStr)}
                {actStr}
            </span>
        );
    };

    // --- OWASP A01: Broken Access Control (Owner + Admin/Developer; Staff blocked) ---
    const canViewActivityHistory = ['owner', 'admin'].includes(user.role?.toLowerCase() || '');
    if (user.role && !canViewActivityHistory) {
        return (
            <div className="py-8 flex items-center justify-center min-h-[500px] animate-in fade-in duration-500">
                <Card className="border-2 border-red-200 shadow-xl max-w-md w-full bg-white rounded-2xl overflow-hidden text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-black">
                        <ShieldAlert size={36} />
                    </div>
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider mb-2">403 Unauthorized Access</h2>
                    <p className="text-xs font-medium text-gray-600 leading-relaxed mb-6">
                        Only Owner and Developer accounts have security clearance to inspect Activity History and Forensic Audit Logs. Staff accounts are explicitly restricted.
                    </p>
                    <Button
                        onClick={() => navigate('/dashboard')}
                        className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest w-full h-11 rounded-xl shadow-lg shadow-red-100"
                    >
                        Return to Dashboard
                    </Button>
                </Card>
            </div>
        );
    }

    // Deduplicate activities to guarantee no identical consecutive entries are displayed
    const dedupedActivities = useMemo(() => {
        const seen = new Set<string>();
        const res: ActivityLog[] = [];
        for (const a of activities) {
            const key = `${a.user || ''}_${a.actionRaw || a.action || ''}_${a.module || ''}_${a.table || ''}_${a.recordId || ''}_${a.timestamp || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                res.push(a);
            }
        }
        return res;
    }, [activities]);
    
    // Filtering logic
    const filteredActivities = dedupedActivities.filter((activity: ActivityLog) => {
        const actionRaw = String(activity.actionRaw || activity.action || '').toUpperCase();
        const moduleLabel = getModuleBadge(activity).toUpperCase();
        // Hide noisy routing 404s unless the user explicitly filters System or searches for them.
        const isRoutingNoise = actionRaw.includes('404') || moduleLabel === 'ROUTING';
        if (isRoutingNoise && selectedType !== 'System' && !searchTerm.trim()) {
            return false;
        }

        // Search Filter across username, full name, action, module, table, record id, details, role
        const searchStr = searchTerm.toLowerCase().trim();
        const mod = getModuleBadge(activity).toLowerCase();
        const role = (activity.role || (activity.user.toLowerCase() === 'owner' ? 'owner' : 'staff')).toLowerCase();
        const recId = String(activity.recordId || '').toLowerCase();
        const auditId = String(activity.id || '').toLowerCase();

        const valueBlob = [
            activity.oldValues?.username,
            activity.newValues?.username,
            activity.oldValues?.email,
            activity.newValues?.email,
            activity.oldValues?.details,
            activity.newValues?.details,
            activity.oldValues?.order_number,
            activity.newValues?.order_number,
            activity.oldValues?.item_name,
            activity.newValues?.item_name,
            activity.oldValues?.service_name,
            activity.newValues?.service_name,
            activity.oldValues?.customer_name,
            activity.newValues?.customer_name,
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesSearch = !searchStr || (
            (activity.user || '').toLowerCase().includes(searchStr) ||
            (activity.action || '').toLowerCase().includes(searchStr) ||
            (activity.table || '').toLowerCase().includes(searchStr) ||
            (activity.details || '').toLowerCase().includes(searchStr) ||
            (activity.timestamp || '').toLowerCase().includes(searchStr) ||
            mod.includes(searchStr) ||
            role.includes(searchStr) ||
            recId.includes(searchStr) ||
            auditId.includes(searchStr) ||
            valueBlob.includes(searchStr)
        );

        // User Filter
        const matchesUser = selectedUser === 'all' || activity.user.toLowerCase() === selectedUser.toLowerCase();

        // Type/Module Filter
        const activityMod = getModuleBadge(activity).toLowerCase();
        const selType = selectedType.toLowerCase();
        let matchesType = selectedType === 'all' || 
            activityMod === selType || 
            activity.type?.toLowerCase() === selType;
        if (!matchesType && selType === 'sales') {
            matchesType = activityMod === 'job orders' || activityMod === 'reports' || activity.table?.toLowerCase() === 'orders' || activity.type?.toLowerCase() === 'order';
        }

        // Date Range Filter
        let matchesDate = true;
        if (startDate || endDate) {
            const datePart = activity.timestamp.includes(',') ? activity.timestamp.split(',')[0].trim() : activity.timestamp.split(' ')[0].trim();
            const activityDate = new Date(datePart);
            
            if (startDate) {
                const start = new Date(startDate);
                if (activityDate < start) matchesDate = false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (activityDate > end) matchesDate = false;
            }
        }

        return matchesSearch && matchesUser && matchesType && matchesDate;
    });

    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedActivities = filteredActivities.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRowClick = (activity: ActivityLog) => {
        setSelectedLog(activity);
        setIsLogModalOpen(true);
    };

    const renderBusinessLayout = (log: ActivityLog) => {
        let oldVals = log.oldValues || {};
        let newVals = log.newValues || {};
        
        if (typeof oldVals === 'string') {
            try { oldVals = JSON.parse(oldVals); } catch(e) { oldVals = {}; }
        }
        if (typeof newVals === 'string') {
            try { newVals = JSON.parse(newVals); } catch(e) { newVals = {}; }
        }
        
        const actionStr = getBusinessActionTitle(log).toUpperCase();
        const module = getModuleBadge(log).toUpperCase();
        
        const ignoredKeys = new Set(['id', 'order_id', 'item_id', 'user_id', 'customer_id', 'created_at', 'updated_at', 'history', 'items', 'inventory_used', 'inventoryused', '_id', 'token', 'password', 'ordernumber', 'order_number', 'updater_id', 'updaterid', 'inventoryapplied', 'inventory_applied', 'last_modified', 'is_retail', 'isretail', 'sync_version', 'modifier', 'record_id', 'details', 'cancelled']);

        const mapBusinessLabel = (key: string) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'updater_id' || lowerKey === 'updaterid') return 'Updated By';
            if (lowerKey === 'base_price') return 'Service Price';
            if (lowerKey === 'is_active' || lowerKey === 'status' || lowerKey === 'was_active') return 'Status';
            if (lowerKey === 'soft_delete') return 'Soft Delete';
            if (lowerKey === 'removal_type') return 'Removal Type';
            if (lowerKey === 'status_after') return 'Status After';
            if (lowerKey === 'summary') return 'Summary';
            if (lowerKey === 'grand_total' || lowerKey === 'grandtotal') return 'Grand Total';
            if (lowerKey === 'stock_quantity' || lowerKey === 'stockquantity' || lowerKey === 'stock') return 'Stock Quantity';
            if (lowerKey === 'item_name' || lowerKey === 'itemname') return 'Item Name';
            if (lowerKey === 'inventory_number' || lowerKey === 'inventorynumber') return 'Inventory Number';
            if (lowerKey === 'unit_price' || lowerKey === 'unitprice') return 'Unit Price';
            if (lowerKey === 'retail_price' || lowerKey === 'retailprice') return 'Retail Price';
            if (lowerKey === 'is_retail' || lowerKey === 'isretail') return 'Retail Item';
            if (lowerKey === 'auto_deduct' || lowerKey === 'autodeduct') return 'Auto Deduct';
            if (lowerKey === 'auto_deduct_trigger' || lowerKey === 'autodeducttrigger') return 'Auto Deduct Trigger';
            if (lowerKey === 'trigger_service' || lowerKey === 'triggerservice') return 'Trigger Service';
            if (lowerKey === 'consumption_qty' || lowerKey === 'consumptionqty') return 'Consumption Qty';
            if (lowerKey === 'consumption_unit' || lowerKey === 'consumptionunit') return 'Consumption Unit';
            if (lowerKey === 'package_size' || lowerKey === 'packagesize') return 'Package Size';
            if (lowerKey === 'package_unit' || lowerKey === 'packageunit') return 'Package Unit';
            if (lowerKey === 'low_stock_threshold' || lowerKey === 'lowstockthreshold') return 'Low Stock Threshold';
            if (lowerKey === 'customer_name' || lowerKey === 'customername') return 'Customer Name';
            if (lowerKey === 'contact_number' || lowerKey === 'contactnumber') return 'Contact Number';
            if (lowerKey === 'delivery_address' || lowerKey === 'deliveryaddress') return 'Delivery Address';
            return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
        };

        const formatCurrency = (val: any) => {
            if (typeof val === 'number') return `₱${val.toFixed(2)}`;
            if (typeof val === 'string' && !isNaN(parseFloat(val))) return `₱${parseFloat(val).toFixed(2)}`;
            return val;
        };

        const humanizeReadableValue = (raw: string): string => {
            const trimmed = raw.trim();
            if (!trimmed) return 'None';
            const lower = trimmed.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
            const known: Record<string, string> = {
                'new order': 'New Order',
                'on going': 'On-going',
                'ongoing': 'On-going',
                'for release': 'For Release',
                'claimed': 'Claimed',
                'cancelled': 'Cancelled',
                'canceled': 'Cancelled',
                'regular': 'Regular',
                'rush': 'Rush',
                'pickup': 'Pickup',
                'delivery': 'Delivery',
                'cash': 'Cash',
                'gcash': 'GCash',
                'maya': 'Maya',
                'empty': 'None',
                'null': 'None',
                'none': 'None',
                'not set': 'None',
                'n/a': 'None',
                'na': 'None',
            };
            if (known[lower]) return known[lower];
            // Title-case slug-like values so they don't look like code
            if (/[_-]/.test(trimmed) || /^[a-z0-9]+(?:[\s_-][a-z0-9]+)+$/i.test(trimmed)) {
                return lower
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
            }
            return trimmed;
        };

        const mapBusinessValue = (key: string, val: any): string => {
            const lowerKey = key.toLowerCase();
            if (val === true || val === 'true') return 'Yes';
            if (val === false || val === 'false') return 'No';
            if (val === null || val === undefined || val === '') {
                // Status cleared reads more naturally than a technical placeholder
                if (lowerKey === 'status' || lowerKey === 'status_after' || lowerKey === 'statusafter') {
                    return 'Cleared';
                }
                return 'None';
            }
            if (typeof val === 'string' && ['empty', 'null', 'none', 'not set', 'n/a', 'na'].includes(val.trim().toLowerCase())) {
                if (lowerKey === 'status' || lowerKey === 'status_after' || lowerKey === 'statusafter') {
                    return 'Cleared';
                }
                return 'None';
            }

            if (lowerKey === 'is_active' || lowerKey === 'was_active') {
                if (val === true || val === 'true' || val === 1) return 'Active';
                if (val === false || val === 'false' || val === 0) return 'Inactive';
            }
            if (lowerKey === 'soft_delete') {
                return (val === true || val === 'true') ? 'Yes (kept in database)' : 'No';
            }
            if (Array.isArray(val)) {
                if (val.length === 0) return 'None';
                return val.map((entry) => {
                    if (entry == null) return 'None';
                    if (typeof entry === 'object') {
                        const label = entry.name || entry.item_name || entry.service_name || entry.label;
                        return label != null ? humanizeReadableValue(String(label)) : 'Details recorded';
                    }
                    return humanizeReadableValue(String(entry));
                }).join(', ');
            }
            if (typeof val === 'object') {
                const preferred =
                    val.name || val.item_name || val.service_name || val.username ||
                    val.customer_name || val.order_number || val.label || val.details;
                if (preferred != null && preferred !== '') return humanizeReadableValue(String(preferred));
                try {
                    const parts = Object.entries(val)
                        .filter(([k]) => !['id', 'password', 'token'].includes(String(k).toLowerCase()))
                        .map(([k, v]) => `${mapBusinessLabel(k)}: ${mapBusinessValue(k, v)}`);
                    return parts.length > 0 ? parts.join(' · ') : 'None';
                } catch {
                    return 'None';
                }
            }
            
            if (lowerKey.includes('price') || lowerKey.includes('total') || lowerKey.includes('amount') || lowerKey.includes('cost')) {
                return String(formatCurrency(val));
            }
            if (typeof val === 'number' || (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim()))) {
                const num = Number(val);
                if (Number.isFinite(num)) {
                    if (Number.isInteger(num)) {
                        return String(num);
                    }
                    return num.toFixed(2);
                }
            }
            if (typeof val === 'string') return humanizeReadableValue(val);
            return String(val);
        };

        const renderFieldList = (data: any, title: string) => {
            const keys = Object.keys(data).filter(k => !ignoredKeys.has(k.toLowerCase().replace(/[_-\s]/g, '')));
            if (keys.length === 0) return null;
            return (
                <div className="space-y-2.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">{title}</span>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2.5">
                        {keys.map(k => (
                            <div key={k} className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">{mapBusinessLabel(k)}</span>
                                <span className="font-black text-gray-900 text-[13px]">{mapBusinessValue(k, data[k])}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        };

        const renderDiffList = () => {
            const normMap: { [key: string]: { label: string; oldVal?: any; newVal?: any; missingInOld: boolean } } = {};

            Object.keys(oldVals).forEach(k => {
                const norm = k.toLowerCase().replace(/[_-\s]/g, '');
                if (!ignoredKeys.has(norm) && !ignoredKeys.has(k)) {
                    normMap[norm] = { label: k, oldVal: oldVals[k], missingInOld: false };
                }
            });

            Object.keys(newVals).forEach(k => {
                const norm = k.toLowerCase().replace(/[_-\s]/g, '');
                if (!ignoredKeys.has(norm) && !ignoredKeys.has(k)) {
                    if (!normMap[norm]) {
                        normMap[norm] = { label: k, missingInOld: true };
                    }
                    normMap[norm].newVal = newVals[k];
                    normMap[norm].label = k;
                }
            });

            const changedItems = Object.values(normMap).filter(item => {
                if (item.missingInOld) return false;
                
                const normalizeValue = (v: any) => {
                    if (v === undefined || v === null || v === '' || v === ' ') return null;
                    if (typeof v === 'boolean') return String(v);
                    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
                    if (typeof v === 'string') {
                        const trimmed = v.trim();
                        if (trimmed !== '' && !isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
                            return String(Number(trimmed));
                        }
                        return trimmed;
                    }
                    // JSON may revive Decimals as plain objects rarely; stringify as last resort
                    return v;
                };

                const normOld = normalizeValue(item.oldVal);
                const normNew = normalizeValue(item.newVal);

                if (normOld === null && normNew === null) return false;
                if (normOld === null || normNew === null) return true;
                // Numeric equality: "10" vs 10 vs "10.0"
                const oldNum = Number(normOld);
                const newNum = Number(normNew);
                if (
                    typeof normOld === 'string' && typeof normNew === 'string'
                    && normOld !== '' && normNew !== ''
                    && !isNaN(oldNum) && !isNaN(newNum)
                    && /^-?\d+(\.\d+)?$/.test(normOld) && /^-?\d+(\.\d+)?$/.test(normNew)
                ) {
                    return oldNum !== newNum;
                }
                return JSON.stringify(normOld) !== JSON.stringify(normNew);
            });

            if (changedItems.length === 0) {
                // Human banner / top-level details already cover empty-diff cases.
                if (typeof newVals.details === 'string' && newVals.details.trim()) {
                    return null;
                }
                if (log.details && !String(log.details).toLowerCase().includes('no field value')) {
                    return (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-3 space-y-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">What changed</span>
                            <span className="text-[13px] font-bold text-slate-800 leading-snug">{log.details}</span>
                            {(oldVals.item_name || newVals.item_name || oldVals.stock_quantity != null || newVals.stock_quantity != null) && (
                                <div className="pt-2 border-t border-slate-200 space-y-2">
                                    {(oldVals.item_name || newVals.item_name) && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Item Name</span>
                                            <span className="font-black text-gray-900 text-[13px]">{newVals.item_name || oldVals.item_name}</span>
                                        </div>
                                    )}
                                    {(oldVals.stock_quantity != null || newVals.stock_quantity != null) && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Stock Quantity</span>
                                            <div className="flex items-center gap-2 text-[13px] font-black">
                                                <span className="text-rose-700/80 line-through">{mapBusinessValue('stock_quantity', oldVals.stock_quantity)}</span>
                                                <span className="text-gray-300">→</span>
                                                <span className="text-emerald-700">{mapBusinessValue('stock_quantity', newVals.stock_quantity)}</span>
                                                {(newVals.unit || oldVals.unit) && (
                                                    <span className="text-gray-500 font-bold text-[11px]">{newVals.unit || oldVals.unit}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                }
                return (
                    <div className="bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200 text-center mt-3">
                        <span className="text-[11px] font-bold text-gray-500 italic">No user-visible business changes were made.</span>
                    </div>
                );
            }

            const sections = {
                'Inventory Information': [
                    'itemName', 'item_name', 'inventoryNumber', 'inventory_number',
                    'category', 'stockQuantity', 'stock_quantity', 'stock', 'unit',
                    'unitPrice', 'unit_price', 'retailPrice', 'retail_price', 'isRetail', 'is_retail',
                    'lowStockThreshold', 'low_stock_threshold', 'packageSize', 'package_size',
                    'packageUnit', 'package_unit', 'autoDeduct', 'auto_deduct',
                    'autoDeductTrigger', 'auto_deduct_trigger', 'triggerService', 'trigger_service',
                    'consumptionQty', 'consumption_qty', 'consumptionUnit', 'consumption_unit',
                    'status', 'is_active', 'isActive'
                ],
                'Order Information': ['status', 'priorityLevel', 'predictedCompletionDate', 'transactionDate', 'inventoryApplied'],
                'Shoe Information': ['brand', 'shoeModel', 'shoeMaterial', 'shoeSize', 'color', 'condition', 'quantity'],
                'Service Information': ['baseService', 'addOns'],
                'Customer Information': ['customerName', 'contactNumber'],
                'Delivery Information': ['shippingPreference', 'deliveryAddress', 'deliveryCourier', 'releaseTime', 'province', 'city', 'barangay', 'zipCode'],
                'Payment Information': ['grandTotal', 'amountReceived', 'balance', 'paymentMethod', 'paymentStatus', 'referenceNo', 'depositAmount']
            };

            const groupedChanges: { [key: string]: typeof changedItems } = {
                'Inventory Information': [],
                'Order Information': [],
                'Shoe Information': [],
                'Service Information': [],
                'Customer Information': [],
                'Delivery Information': [],
                'Payment Information': [],
                'Other Changes': []
            };

            changedItems.forEach(item => {
                let placed = false;
                for (const [section, keys] of Object.entries(sections)) {
                    if (keys.includes(item.label)) {
                        groupedChanges[section].push(item);
                        placed = true;
                        break;
                    }
                }
                if (!placed) groupedChanges['Other Changes'].push(item);
            });

            return (
                <div className="space-y-4 mt-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Business Changes</span>
                    
                    {Object.entries(groupedChanges).map(([sectionTitle, items]) => {
                        if (items.length === 0) return null;
                        return (
                            <div key={sectionTitle} className="space-y-2 mb-4">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1 block w-full">{sectionTitle}</span>
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-3 min-w-0 overflow-hidden">
                                    {items.map(({ label, oldVal, newVal }) => (
                                        <div key={label} className="flex flex-col gap-1 pb-2.5 border-b border-gray-100 last:border-0 last:pb-0 min-w-0">
                                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">{mapBusinessLabel(label)}</span>
                                            <div className="flex flex-col gap-0.5 mt-0.5 min-w-0">
                                                <span className="text-[13px] font-black text-rose-700/80 line-through decoration-rose-300 decoration-2 break-all break-words">
                                                    {mapBusinessValue(label, oldVal)}
                                                </span>
                                                <div className="flex items-center gap-2 text-[13px] font-black text-gray-900 min-w-0">
                                                    <span className="text-gray-300 shrink-0">↳</span>
                                                    <span className="text-emerald-700 break-all break-words">{mapBusinessValue(label, newVal)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        };

        // Humanized API summary (show if distinct from top-level log details to avoid duplication)
        const rawLogDetail = typeof log.details === 'string' ? log.details.trim() : '';
        const newValsDetail = (typeof newVals.details === 'string' && newVals.details.trim()) ? newVals.details.trim() : '';
        const humanSummary = (newValsDetail && newValsDetail !== rawLogDetail) ? newValsDetail : '';
        const humanBanner =
            humanSummary &&
            (actionStr.includes('UPDATE') || actionStr.includes('CREATED') || actionStr.includes('ADDED') || actionStr.includes('NEW'))
                ? (
                    <div className="mb-4 space-y-1.5">
                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">What Changed</span>
                        <div className="text-[13px] font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm leading-snug">
                            {humanSummary}
                        </div>
                    </div>
                )
                : null;

        // Event Specific Summaries
        let eventSummary = null;
        if (module === 'JOB ORDERS' && Object.keys(oldVals).length > 0 && Object.keys(newVals).length > 0 && newVals.status && oldVals.status !== newVals.status) {
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Status Changed</span>
                    <div className="flex items-center gap-2 text-[14px] font-black text-blue-700 bg-blue-50 p-2.5 rounded-xl border border-blue-100 shadow-sm">
                        <span className="text-gray-500 line-through decoration-gray-400 decoration-1 text-[13px]">{mapBusinessValue('status', oldVals.status)}</span>
                        <span className="text-gray-400">→</span>
                        <span>{mapBusinessValue('status', newVals.status)}</span>
                    </div>
                </div>
            );
        } else if (module === 'INVENTORY' && actionStr.includes('RESTOCK')) {
            const addedRaw = newVals.stock_added || newVals.quantity || newVals.amount || log.details.match(/(?:added|restocked)\s*(\d+(?:\.\d+)?)/i)?.[1] || 0;
            const addedNum = Number(addedRaw);
            const addedFormatted = Number.isFinite(addedNum) ? (Number.isInteger(addedNum) ? String(addedNum) : addedNum.toFixed(2)) : String(addedRaw);
            const itemName = newVals.item_name || newVals.name || oldVals.item_name || log.details.match(/(?:on|item:?)\s*['"]?([^'"]+?)['"]?/i)?.[1] || 'Inventory Item';
            const unit = newVals.unit || oldVals.unit || '';
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Restocked: {itemName}</span>
                    <div className="flex items-center gap-3 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                        <span className="text-[14px] font-black text-emerald-700">+{addedFormatted}{unit ? ` ${unit}` : ''}</span>
                        <div className="flex items-center gap-2 text-[12px] font-bold text-gray-600 border-l border-emerald-200 pl-3">
                            <span className="line-through text-gray-400">{mapBusinessValue('stock', oldVals.stock || oldVals.stock_quantity || 0)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-gray-800">{mapBusinessValue('stock', newVals.stock || newVals.stock_quantity || 0)}</span>
                        </div>
                    </div>
                </div>
            );
        } else if (module === 'INVENTORY' && (actionStr.includes('CONSUME') || actionStr.includes('DEDUCT') || log.details.toLowerCase().includes('deduct'))) {
            const usedRaw = newVals.quantity_used || newVals.amount || log.details.match(/(?:used|deducted)\s*(\d+(?:\.\d+)?)/i)?.[1] || 0;
            const usedNum = Number(usedRaw);
            const usedFormatted = Number.isFinite(usedNum) ? (Number.isInteger(usedNum) ? String(usedNum) : usedNum.toFixed(2)) : String(usedRaw);
            const itemName = newVals.item_name || newVals.name || oldVals.item_name || log.details.match(/(?:from|on|item:?)\s*['"]?([^'"]+?)['"]?/i)?.[1] || 'Inventory Item';
            const unit = newVals.unit || oldVals.unit || '';
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Material Deducted: {itemName}</span>
                    <div className="flex items-center gap-3 bg-rose-50 p-2.5 rounded-xl border border-rose-100 shadow-sm">
                        <span className="text-[14px] font-black text-rose-700">−{usedFormatted}{unit ? ` ${unit}` : ''}</span>
                        <div className="flex items-center gap-2 text-[12px] font-bold text-gray-600 border-l border-rose-200 pl-3">
                            <span className="line-through text-gray-400">{mapBusinessValue('stock', oldVals.stock || oldVals.stock_quantity || 0)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-gray-800">{mapBusinessValue('stock', newVals.stock || newVals.stock_quantity || 0)}</span>
                        </div>
                    </div>
                </div>
            );
        } else if (module === 'SERVICES' && Object.keys(oldVals).length > 0 && Object.keys(newVals).length > 0 && ((newVals.base_price && oldVals.base_price !== newVals.base_price) || (newVals.price && oldVals.price !== newVals.price))) {
            const oldP = oldVals.base_price || oldVals.price;
            const newP = newVals.base_price || newVals.price;
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Price Updated</span>
                    <div className="flex items-center gap-3 text-[14px] font-black text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                        <span className="text-gray-500 line-through decoration-gray-400 decoration-1 text-[13px]">{formatCurrency(oldP)}</span>
                        <span className="text-gray-400">→</span>
                        <span>{formatCurrency(newP)}</span>
                    </div>
                </div>
            );
        } else if ((module === 'USERS' || module === 'USER MANAGEMENT') && actionStr.includes('CREATE')) {
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Created Account</span>
                    <div className="flex flex-col gap-0.5 bg-purple-50 p-2.5 rounded-xl border border-purple-100 shadow-sm">
                        <span className="text-[13px] font-black text-gray-900">Username: {newVals.username || newVals.user || log.recordId}</span>
                        <span className="text-[12px] font-bold text-gray-600">Role: {newVals.role || 'Staff'}</span>
                    </div>
                </div>
            );
        } else if (module === 'REPORTS' || actionStr.includes('REPORT') || actionStr.includes('GENERATED')) {
            const reportName = log.details.replace(/Printed\s*/i, '').replace(/Generated\s*/i, '') || 'System Report';
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Report Generated</span>
                    <div className="flex items-center gap-2 text-[14px] font-black text-purple-700 bg-purple-50 p-2.5 rounded-xl border border-purple-100 shadow-sm">
                        <span>{reportName}</span>
                    </div>
                </div>
            );
        }

        // Layout Router
        if (module === 'AUTHENTICATION') {
            const tokens = getActionTokens(log);
            const logout = isLogoutAction(log);
            const loginOk = isLoginAction(log);
            const failed = tokens.includes('FAILED');
            const timedOut = tokens.includes('TIMEOUT');
            const passwordReset = tokens.includes('PASSWORD');

            if (failed) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Failed Login Attempt</span>
                        <div className="bg-red-50 p-3 rounded-xl border border-red-200 shadow-sm space-y-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Username</span>
                                <span className="font-black text-red-900 text-[13px]">{newVals.username_attempted || log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Status</span>
                                <span className="font-black text-[13px] text-red-700">Login failed</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Reason</span>
                                <span className="font-black text-red-700 text-[13px]">{newVals.reason === 'wrong_password' ? 'Incorrect Password' : newVals.reason === 'account_locked' ? 'Account Locked' : newVals.reason === 'account_deactivated' ? 'Account Deactivated' : newVals.reason === 'account_not_found' ? 'Account Not Found' : 'Incorrect Credentials'}</span>
                            </div>
                            {newVals.failed_attempts !== undefined && (
                                <div className="flex flex-col gap-0.5 mt-2">
                                    <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Failed Attempts</span>
                                    <span className="font-black text-red-900 text-[13px]">{newVals.failed_attempts} of 3</span>
                                </div>
                            )}
                            <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-red-200">
                                <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Result</span>
                                <span className="font-black text-[13px] text-red-900">{newVals.reason === 'account_locked' ? 'Account Locked' : newVals.reason === 'account_deactivated' ? 'Access Blocked' : 'Account still active'}</span>
                            </div>
                        </div>
                    </div>
                );
            }

            if (timedOut) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Session Expired</span>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm space-y-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-amber-600 uppercase text-[9px] tracking-widest">User</span>
                                <span className="font-black text-amber-900 text-[13px]">{log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <span className="font-extrabold text-amber-600 uppercase text-[9px] tracking-widest">Status</span>
                                <span className="font-black text-[13px] text-amber-700">Session timed out</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <span className="font-extrabold text-amber-600 uppercase text-[9px] tracking-widest">Reason</span>
                                <span className="font-black text-[13px] text-amber-700">Signed out automatically due to inactivity.</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-amber-200">
                                <span className="font-extrabold text-amber-600 uppercase text-[9px] tracking-widest">Next step</span>
                                <span className="font-black text-[13px] text-amber-900">Please log in again to continue.</span>
                            </div>
                        </div>
                    </div>
                );
            }

            if (passwordReset) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Password Reset</span>
                        <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 shadow-sm space-y-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-purple-600 uppercase text-[9px] tracking-widest">Username</span>
                                <span className="font-black text-purple-900 text-[13px]">{log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <span className="font-extrabold text-purple-600 uppercase text-[9px] tracking-widest">Status</span>
                                <span className="font-black text-[13px] text-purple-700">Password updated successfully</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-purple-200">
                                <span className="font-extrabold text-purple-600 uppercase text-[9px] tracking-widest">What happened</span>
                                <span className="font-bold text-[12px] text-purple-900">This account’s password was reset through the secure reset flow.</span>
                            </div>
                        </div>
                    </div>
                );
            }

            if (logout) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Session Details</span>
                        <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm space-y-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-rose-600 uppercase text-[9px] tracking-widest">Username</span>
                                <span className="font-black text-gray-900 text-[13px]">{log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <span className="font-extrabold text-rose-600 uppercase text-[9px] tracking-widest">Status</span>
                                <span className="font-black text-[13px] text-rose-700">Successful logout</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-rose-100">
                                <span className="font-extrabold text-rose-600 uppercase text-[9px] tracking-widest">What happened</span>
                                <span className="font-bold text-[12px] text-gray-800">
                                    {log.details && !String(log.details).toLowerCase().includes('sql')
                                        ? log.details
                                        : `${log.user} signed out of the system.`}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            }

            // Default auth success = login
            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Session Details</span>
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm space-y-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-emerald-600 uppercase text-[9px] tracking-widest">Username</span>
                            <span className="font-black text-gray-900 text-[13px]">{log.user}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-2">
                            <span className="font-extrabold text-emerald-600 uppercase text-[9px] tracking-widest">Status</span>
                            <span className="font-black text-[13px] text-emerald-600">
                                {loginOk ? 'Successful login' : 'Authentication event'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-emerald-100">
                            <span className="font-extrabold text-emerald-600 uppercase text-[9px] tracking-widest">What happened</span>
                            <span className="font-bold text-[12px] text-gray-800">
                                {log.details && !String(log.details).toLowerCase().includes('sql')
                                    ? log.details
                                    : `${log.user} signed in successfully.`}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        if (actionStr.includes('SERVER ERROR') || (log.actionRaw || '').toUpperCase() === 'SERVER_ERROR') {
            const rawError = oldVals.error || newVals.summary || log.details || '';
            const humanError = (() => {
                const text = String(rawError || '');
                const lower = text.toLowerCase();
                if (lower.includes('grand_total') && (lower.includes('not null') || lower.includes('empty'))) {
                    return 'Historical order could not be saved because Grand Total was empty. Enter a grand total and try again.';
                }
                if (lower.includes('not null constraint') || lower.includes('integrityerror') || lower.includes('[sql:')) {
                    return 'A database rule blocked this save. Check required fields and try again.';
                }
                if (lower.includes('sqlalchemy') || lower.includes('sqlite3') || lower.includes('psycopg')) {
                    return 'A database operation failed. Please verify the form values and try again.';
                }
                // Already humanized from API, or short enough to show
                const cleaned = text.replace(/\s+/g, ' ').trim();
                if (cleaned.length > 220) return `${cleaned.slice(0, 217)}…`;
                return cleaned || 'An unexpected server error occurred.';
            })();

            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Server Error Details</span>
                    <div className="bg-red-50 p-3 rounded-xl border border-red-200 shadow-sm space-y-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">What happened</span>
                            <span className="font-black text-red-900 text-[13px] leading-snug">{humanError}</span>
                        </div>
                        {(newVals.method || newVals.url) && (
                            <div className="flex flex-col gap-0.5 pt-2 border-t border-red-200">
                                <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Request</span>
                                <span className="font-bold text-red-800 text-[12px]">
                                    {[newVals.method, newVals.url].filter(Boolean).join(' ')}
                                </span>
                            </div>
                        )}
                        {(newVals.file || newVals.line) && (
                            <div className="flex flex-col gap-0.5 pt-2 border-t border-red-200">
                                <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Technical location</span>
                                <span className="font-bold text-red-800 text-[12px]">
                                    {newVals.file || 'unknown'}{newVals.line ? ` (line ${newVals.line})` : ''}
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col gap-0.5 pt-2 border-t border-red-200">
                            <span className="font-extrabold text-red-500 uppercase text-[9px] tracking-widest">Next step</span>
                            <span className="font-bold text-red-900 text-[12px]">
                                Fix the form values and retry. Raw database code is hidden from this view.
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        if (module === 'INVENTORY' && actionStr.includes('RESTOCK')) {
            const added = newVals.stock_added || newVals.quantity || newVals.amount || log.details.match(/added (\d+)/i)?.[1];
            const itemName = newVals.item_name || newVals.name || log.details.match(/Restocked\s*(.*?)\s*:/)?.[1] || 'Inventory Item';
            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Restock Details</span>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Item Restocked</span>
                            <span className="font-black text-gray-900 text-[13px]">{itemName}</span>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 flex items-center justify-between mt-2">
                            <span className="font-extrabold text-emerald-800 text-[11px] uppercase tracking-wider">Stock Added</span>
                            <span className="font-black text-emerald-700 text-base">+{added || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            );
        }

        // Inventory create / update / deduct / reactivate — always show human before→after fields
        if (module === 'INVENTORY' && (actionStr.includes('UPDATE') || actionStr.includes('ADDED') || actionStr.includes('CREATE') || actionStr.includes('DEDUCT') || actionStr.includes('REACTIVAT'))) {
            const itemName = newVals.item_name || oldVals.item_name || 'Inventory Item';
            const unit = newVals.unit || oldVals.unit || '';
            const invFields = [
                'item_name', 'inventory_number', 'category', 'stock_quantity', 'unit',
                'unit_price', 'status', 'low_stock_threshold', 'package_size', 'package_unit',
                'is_retail', 'retail_price', 'auto_deduct', 'auto_deduct_trigger', 'trigger_service',
                'consumption_qty', 'consumption_unit',
            ];
            const rows = invFields
                .map((key) => {
                    const oldV = oldVals[key];
                    const newV = newVals[key];
                    const hasOld = oldV !== undefined;
                    const hasNew = newV !== undefined;
                    if (!hasOld && !hasNew) return null;
                    const same =
                        oldV === newV
                        || (oldV != null && newV != null && String(oldV) === String(newV))
                        || (oldV != null && newV != null && !isNaN(Number(oldV)) && !isNaN(Number(newV)) && Number(oldV) === Number(newV));
                    if (hasOld && hasNew && same && key !== 'item_name' && key !== 'stock_quantity') return null;
                    return { key, oldV, newV, same: hasOld && hasNew && same };
                })
                .filter(Boolean) as { key: string; oldV: any; newV: any; same: boolean }[];

            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        {actionStr.includes('ADDED') || actionStr.includes('CREATE') ? 'Inventory Item Created' : 'Inventory Changes'}
                    </span>
                    {(typeof newVals.details === 'string' && newVals.details.trim()) && (
                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-[12px] font-bold text-amber-900">
                            {newVals.details}
                        </div>
                    )}
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Item</span>
                            <span className="font-black text-gray-900 text-[13px]">{itemName}</span>
                        </div>
                        {rows.filter((r) => r.key !== 'item_name').map(({ key, oldV, newV, same }) => (
                            <div key={key} className="flex flex-col gap-0.5 pt-2 border-t border-gray-100">
                                <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">{mapBusinessLabel(key)}</span>
                                {same || oldV === undefined ? (
                                    <span className="font-black text-gray-900 text-[13px]">
                                        {mapBusinessValue(key, newV)}
                                        {key === 'stock_quantity' && unit ? ` ${unit}` : ''}
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-2 text-[13px] font-black">
                                        <span className="text-rose-700/80 line-through decoration-rose-300">
                                            {mapBusinessValue(key, oldV)}
                                            {key === 'stock_quantity' && unit ? ` ${unit}` : ''}
                                        </span>
                                        <span className="text-gray-300">→</span>
                                        <span className="text-emerald-700">
                                            {mapBusinessValue(key, newV)}
                                            {key === 'stock_quantity' && unit ? ` ${unit}` : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {rows.length <= 1 && !(typeof newVals.details === 'string' && newVals.details.trim()) && log.details && (
                            <div className="pt-2 border-t border-gray-100 text-[12px] font-bold text-gray-700">{log.details}</div>
                        )}
                    </div>
                </div>
            );
        }

        if (actionStr.includes('DELETE') || actionStr.includes('DEACTIVAT') || actionStr.includes('CANCEL')) {
            const deletedVals = { ...oldVals };
            if (newVals?.is_active === false) deletedVals.status_after = 'Inactive (soft delete)';
            if (newVals?.soft_delete) deletedVals.removal_type = 'Removed from catalog (record kept for history)';
            if (newVals?.reason) deletedVals.reason = newVals.reason;
            if (newVals?.previous_status) deletedVals.previous_status = newVals.previous_status;
            if (newVals?.details && typeof newVals.details === 'string') deletedVals.summary = newVals.details;
            const title = actionStr.includes('CANCEL')
                ? 'Cancelled Order Details'
                : (newVals?.soft_delete || newVals?.is_active === false || actionStr.includes('DEACTIVAT')
                    ? 'Removed Record Details'
                    : 'Deleted Record Details');
            return (
                <div className="space-y-2.5 mt-2">
                    {(log.details || (typeof newVals.details === 'string' && newVals.details.trim())) && (
                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-[12px] font-bold text-rose-800">
                            {typeof newVals.details === 'string' && newVals.details.trim() ? newVals.details : log.details}
                        </div>
                    )}
                    {renderFieldList(deletedVals, title)}
                </div>
            );
        }

        if (module === 'REPORTS' || actionStr.includes('REPORT')) {
            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Report Details</span>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Generated Report</span>
                            <span className="font-black text-gray-900 text-[13px]">{log.details.replace(/Printed\s*/i, '').replace(/Generated\s*/i, '') || 'System Report'}</span>
                        </div>
                    </div>
                </div>
            );
        }

        if ((module === 'JOB ORDERS' || log.table === 'orders') && (actionStr.includes('NEW') || actionStr.includes('CREATE'))) {
            const customerName = newVals.customer_name || newVals.customerName || newVals.customer || '—';
            const contactNum = newVals.contact_number || newVals.contactNumber || '—';
            const orderNo = newVals.order_number || newVals.orderNumber || log.recordId || '—';
            const totalAmt = newVals.grand_total || newVals.grandTotal || 0;
            const downpay = newVals.downpayment || 0;
            const bal = newVals.balance !== undefined ? newVals.balance : (totalAmt - downpay);
            const payStatus = newVals.payment_status || newVals.paymentStatus || (bal <= 0 ? 'Fully Paid' : 'Downpayment');
            const prio = newVals.priority_level || newVals.priority || 'Regular';
            const releaseDt = newVals.promised_release_date || newVals.promisedReleaseDate || newVals.expected_at || '—';

            return (
                <div className="space-y-4 mt-2">
                    <div className="space-y-2.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Complete Order Specifications</span>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Order Number</span>
                                    <span className="font-black text-gray-900 text-[13px]">{orderNo}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Priority</span>
                                    <span className="font-black text-amber-600 uppercase text-[12px]">{prio}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Customer</span>
                                    <span className="font-black text-gray-900 text-[13px]">{customerName}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Contact Number</span>
                                    <span className="font-black text-gray-700 text-[12px]">{contactNum}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Grand Total</span>
                                    <span className="font-black text-emerald-600 text-[13px]">{formatCurrency(totalAmt)}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Downpayment</span>
                                    <span className="font-bold text-gray-700 text-[12px]">{formatCurrency(downpay)}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Balance</span>
                                    <span className={`font-black text-[12px] ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(bal)}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Payment Status</span>
                                    <span className="font-black text-gray-800 text-[12px] uppercase">{payStatus}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Promised Release</span>
                                    <span className="font-black text-blue-700 text-[12px]">{releaseDt}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {(newVals.shoes || newVals.services || newVals.items_count) && (
                        <div className="space-y-2.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Footwear & Service Details</span>
                            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2.5">
                                {newVals.shoes && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Shoe Items ({newVals.shoes_count || 1} Pair)</span>
                                        <span className="font-medium text-gray-800 text-[12px] leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">{newVals.shoes}</span>
                                    </div>
                                )}
                                {newVals.services && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Services Applied</span>
                                        <span className="font-black text-red-700 text-[12px]">{newVals.services}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        let mainContent = null;
        if (actionStr.includes('CREATE') || actionStr.includes('NEW') || actionStr.includes('ADDED') || (log.action && log.action.toUpperCase() === 'CREATE')) {
            mainContent = renderFieldList(newVals, 'Created Record Details');
        } else if (
            actionStr.includes('DELETE') ||
            actionStr.includes('DEACTIVAT') ||
            actionStr.includes('CANCEL') ||
            (log.action && ['DELETE', 'DEACTIVATE', 'CANCEL'].includes(log.action.toUpperCase().replace(/\s+/g, '_')))
        ) {
            const deletedVals = { ...oldVals };
            if (newVals?.details && typeof newVals.details === 'string') deletedVals.summary = newVals.details;
            if (newVals?.previous_status) deletedVals.previous_status = newVals.previous_status;
            mainContent = (
                <div className="space-y-2.5">
                    {(log.details || (typeof newVals.details === 'string' && newVals.details.trim())) && (
                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-[12px] font-bold text-rose-800">
                            {typeof newVals.details === 'string' && newVals.details.trim() ? newVals.details : log.details}
                        </div>
                    )}
                    {renderFieldList(deletedVals, actionStr.includes('CANCEL') ? 'Cancelled Order Details' : 'Deleted Record Details')}
                </div>
            );
        } else if (Object.keys(oldVals).length > 0 && Object.keys(newVals).length > 0) {
            mainContent = renderDiffList();
        } else if (Object.keys(newVals).length > 0) {
            mainContent = renderFieldList(newVals, 'Updated Values');
        } else if (log.details) {
            mainContent = (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Summary</span>
                    <span className="text-[13px] font-bold text-slate-800 leading-snug">{log.details}</span>
                </div>
            );
        }

        if (!eventSummary && !mainContent && !humanBanner) return null;

        return (
            <>
                {humanBanner}
                {eventSummary}
                {mainContent}
            </>
        );
    };

    return (
        <div className="py-2">
            <Card className="border-2 shadow-lg mt-2 gap-2 overflow-hidden">
                <CardHeader className="pt-5 pb-0 px-4">
                    <div className="flex items-center justify-center">
                        <CardTitle className="text-center text-[15px] font-black text-gray-900 uppercase tracking-[0.1em] leading-tight p-0 m-0">
                            Activity History Log
                        </CardTitle>
                    </div>
                </CardHeader>
                
                <CardContent className="pt-5">
                    {/* Search and Filter Section - DASHBOARD STYLE */}
                    <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 mb-4 items-center">
                        <Button 
                            onClick={() => navigate('/user-management')}
                            className="bg-red-600 text-white hover:bg-red-700 h-9 px-3 md:px-4 flex-shrink-0 uppercase text-[11px] font-bold flex items-center gap-1.5 rounded-xl shadow-md transition-all"
                            size="sm"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden md:inline">Back</span>
                        </Button>

                        <div className="flex-1 min-w-[200px] relative group">
                            <Button
                                type="button"
                                variant="ghost"
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-9 text-gray-500 group-focus-within:text-red-600 transition-colors"
                                onClick={() => (document.getElementById('activitySearch') as HTMLInputElement)?.focus()}
                                title="Focus search"
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                            <Input 
                                id="activitySearch"
                                placeholder="Search username, role, action, module, table, date..."
                                className="pl-9 h-9 text-xs border-gray-100 bg-gray-50/50 font-medium focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-xl w-full transition-all"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>

                        <Button 
                            variant="outline" 
                            className={`h-9 w-9 p-0 rounded-xl transition-all flex-shrink-0 flex items-center justify-center shadow-sm relative
                                ${selectedUser !== 'all' || selectedType !== 'all' || startDate || endDate 
                                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100' 
                                    : 'border-gray-200 text-gray-600 hover:border-red-600 hover:text-red-600 hover:bg-red-50'}`}
                            onClick={() => setIsFilterOpen(true)}
                            title="Open filters"
                            aria-label="Open filters"
                        >
                            <Filter className="h-4 w-4 stroke-[2.5]" />
                            {(selectedUser !== 'all' || selectedType !== 'all' || startDate || endDate) && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white animate-pulse" />
                            )}
                        </Button>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 overflow-y-hidden no-scrollbar">
                        <table className="w-full table-fixed min-w-[700px]">
                            <colgroup>
                                <col className="w-[22%]" />
                                <col className="w-[26%]" />
                                <col className="w-[18%]" />
                                <col className="w-[20%]" />
                                <col className="w-[14%]" />
                            </colgroup>
                            <thead className="bg-red-50 border-y border-red-100">
                                <tr>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">User / Role</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Action</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Module / Table</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Inspect</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {filteredActivities.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <ClipboardCheck size={48} className="text-gray-300" />
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                                                    {searchTerm || selectedUser !== 'all' || selectedType !== 'all' || startDate || endDate
                                                        ? 'No matching audit logs found'
                                                        : 'No activity logs found'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedActivities.map((activity: ActivityLog) => {
                                        const normalizeDate = (ts: string) => {
                                            if (!ts) return "";
                                            if (ts.length > 20 || isNaN(parseInt(ts.substring(0, 2)))) {
                                                try {
                                                    const d = new Date(ts);
                                                    if (!isNaN(d.getTime())) {
                                                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                                                        const dd = String(d.getDate()).padStart(2, '0');
                                                        const yyyy = d.getFullYear();
                                                        const hh = String(d.getHours()).padStart(2, '0');
                                                        const mins = String(d.getMinutes()).padStart(2, '0');
                                                        return `${mm}/${dd}/${yyyy}, ${hh}:${mins}`;
                                                    }
                                                } catch (e) { return ts; }
                                            }
                                            return ts;
                                        };

                                        const moduleName = getModuleBadge(activity);
                                        const roleName = activity.role || (activity.user.toLowerCase() === 'owner' ? 'owner' : 'staff');

                                        return (
                                            <tr 
                                                key={activity.id} 
                                                onClick={() => handleRowClick(activity)}
                                                className="hover:bg-red-50/40 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-4 py-3.5 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-0.5 text-center">
                                                        <span className="text-xs font-extrabold text-gray-900 uppercase tracking-tight block">
                                                            {activity.user}
                                                        </span>
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                                                            Role: {roleName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <div className="flex items-center justify-center text-center">
                                                        {getActionBadge(activity)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <Badge variant="outline" className={
                                                        `font-black uppercase text-[10px] tracking-wider px-2.5 py-0.5 rounded-md border 
                                                        ${moduleName === 'Services' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                                          moduleName === 'Inventory' ? 'border-purple-200 text-purple-700 bg-purple-50' :
                                                          moduleName === 'Expenses' ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                                          moduleName === 'User Management' || moduleName === 'Users' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                                                          moduleName === 'Authentication' ? 'border-cyan-200 text-cyan-700 bg-cyan-50' :
                                                          moduleName === 'Reports' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' :
                                                          moduleName === 'Machine Learning' ? 'border-pink-200 text-pink-700 bg-pink-50' :
                                                          'border-red-200 text-red-700 bg-red-50'}`
                                                    }>
                                                        {moduleName}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3.5 text-center text-xs text-gray-700 font-bold whitespace-nowrap">
                                                    {normalizeDate(activity.timestamp)}
                                                </td>
                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRowClick(activity);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-1.5 rounded-lg transition-all border border-red-200 shadow-xs hover:shadow-sm active:scale-95"
                                                    >
                                                        <Eye size={14} />
                                                        <span>Inspect</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination - EXACT DASHBOARD STYLE */}
                    <div className="mt-4 flex items-center justify-between pt-2 pb-2 border-t border-gray-100 px-2">
                        <div className="text-[11px] text-gray-600 font-bold uppercase tracking-wider">
                            PAGE {currentPage} OF {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`h-9 w-9 p-0 rounded-xl transition-all border border-gray-200 shadow-sm ${currentPage === 1
                                    ? 'bg-slate-100 text-slate-400 opacity-50'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <ChevronLeft className="h-4 w-4 stroke-[3]" />
                            </Button>

                            <div className="flex items-center gap-1.5">
                                {(() => {
                                    let start = Math.max(1, currentPage - 2);
                                    let end = Math.min(totalPages, start + 4);
                                    if (end - start < 4) {
                                        start = Math.max(1, end - 4);
                                    }
                                    const pages = [];
                                    for (let i = start; i <= end; i++) pages.push(i);
                                    
                                    return (
                                        <>
                                            {start > 1 && <span className="text-gray-400 px-1 font-black">...</span>}
                                            {pages.map(pageNum => {
                                                const isActive = currentPage === pageNum;
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={isActive ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => handlePageChange(pageNum)}
                                                        className={`h-9 w-9 min-w-[36px] p-0 text-[11px] font-black rounded-xl transition-all ${isActive
                                                            ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md shadow-red-100'
                                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-600'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                            {end < totalPages && <span className="text-gray-400 px-1 font-black">...</span>}
                                        </>
                                    );
                                })()}
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className={`h-9 w-9 p-0 rounded-xl transition-all border border-gray-200 shadow-sm ${currentPage === totalPages
                                    ? 'bg-slate-100 text-slate-400 opacity-50'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <ChevronRight className="h-4 w-4 stroke-[3]" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Filter Dialog */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="max-w-[440px] bg-white rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-[#D92D20] px-8 py-6">
                        <h2 className="text-white text-lg font-black uppercase tracking-[0.2em] flex items-center gap-3">
                            <Filter size={20} className="stroke-[3]" />
                            Filter Audit Logs
                        </h2>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">User / Staff Account</label>
                                <Select value={selectedUser} onValueChange={(val) => { setSelectedUser(val); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/50 font-bold text-gray-800 focus:ring-red-100">
                                        <SelectValue placeholder="All Users" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="font-extrabold text-xs uppercase">ALL USERS (OWNER & STAFF)</SelectItem>
                                        {userList.map(u => (
                                            <SelectItem key={u.username} value={u.username} className="font-bold uppercase text-xs">
                                                {u.username}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Type / System Module</label>
                                <Select value={selectedType} onValueChange={(val) => { setSelectedType(val); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/50 font-bold text-gray-800 focus:ring-red-100">
                                        <SelectValue placeholder="All Types & Modules" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MODULE_OPTIONS.map(mod => (
                                            <SelectItem key={mod.value} value={mod.value} className="font-bold uppercase text-xs">
                                                {mod.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2 mt-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Date Range</label>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="relative">
                                    <FormattedDateInput 
                                        value={startDate} 
                                        onChange={val => { setStartDate(val); setCurrentPage(1); }}
                                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 font-bold text-gray-800 focus:ring-red-100 text-[12px]"
                                    />
                                    <span className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-500 uppercase border border-gray-200 rounded z-10">Start Date</span>
                                </div>
                                <div className="relative">
                                    <FormattedDateInput 
                                        value={endDate} 
                                        onChange={val => { setEndDate(val); setCurrentPage(1); }}
                                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 font-bold text-gray-800 focus:ring-red-100 text-[12px]"
                                    />
                                    <span className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-500 uppercase border border-gray-200 rounded z-10">End Date</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setSelectedUser('all');
                                    setSelectedType('all');
                                    setStartDate('');
                                    setEndDate('');
                                    setCurrentPage(1);
                                    setIsFilterOpen(false);
                                }}
                                className="flex-1 h-12 rounded-xl border-gray-300 bg-gray-100 font-black text-gray-600 uppercase tracking-widest hover:bg-gray-200 active:scale-95 transition-all text-xs"
                            >
                                Reset
                            </Button>
                            <Button 
                                onClick={() => setIsFilterOpen(false)}
                                className="flex-1 h-12 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white font-black uppercase tracking-widest shadow-lg shadow-red-100 active:scale-95 transition-all text-xs"
                            >
                                Apply
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Audit Log Detail Modal */}
            <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
                <DialogContent className="max-w-[520px] bg-white rounded-2xl border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
                    {/* Header - RED STORED THEME */}
                    <div className="bg-[#D92D20] px-6 py-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 text-white">
                            <div className="p-1.5 bg-white/20 rounded-xl border border-white/20">
                                {getActionIcon(selectedLog ? getBusinessActionTitle(selectedLog) : '')}
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-100 block">Activity History Log</span>
                                <h2 className="text-white text-[15px] font-black uppercase tracking-widest m-0 leading-none">
                                    {selectedLog ? getBusinessActionTitle(selectedLog) : 'Audit Record'}
                                </h2>
                            </div>
                        </div>
                    </div>

                    {selectedLog && (
                        <>
                            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                                {/* Summary Banner */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 min-w-0">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-2">Activity Summary</span>
                                    <div className="grid grid-cols-2 gap-4 mt-1">
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Performed By</span>
                                            <span className="text-[13px] font-bold text-slate-800 leading-tight truncate">
                                                <span className="text-red-600 font-black">{selectedLog.user}</span> <span className="text-slate-500 font-medium">({(selectedLog.role || (selectedLog.user.toLowerCase() === 'owner' ? 'owner' : 'staff')).replace(/^\w/, (c) => c.toUpperCase())})</span>
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Date & Time</span>
                                            <span className="text-[13px] font-bold text-slate-800 leading-tight">
                                                {selectedLog.timestamp}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 mt-2 border-t border-slate-100 pt-3 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Action</span>
                                            <span className="text-[13px] font-black text-slate-800 leading-tight">
                                                {getBusinessActionTitle(selectedLog)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 mt-2 border-t border-slate-100 pt-3 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Affected Record</span>
                                            <span className="text-[13px] font-black text-slate-800 leading-tight break-all break-words">
                                                {getAffectedRecordLabel(selectedLog)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Activity Details & Notes INSIDE View Activity History Logs Modal */}
                                    {(() => {
                                        const rawDetails = selectedLog.details || 
                                            (selectedLog.newValues && typeof selectedLog.newValues === 'object' && selectedLog.newValues.details) || 
                                            (selectedLog.oldValues && typeof selectedLog.oldValues === 'object' && selectedLog.oldValues.details) || '';
                                        if (!rawDetails) return null;
                                        return (
                                            <div className="mt-1 pt-3 border-t border-slate-200 flex flex-col gap-1.5 min-w-0">
                                                <span className="font-extrabold text-slate-500 uppercase text-[9px] tracking-widest flex items-center gap-1.5">
                                                    <FileText size={12} className="text-red-500" /> Activity Details & Notes
                                                </span>
                                                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 leading-relaxed shadow-2xs break-all break-words">
                                                    {String(rawDetails)}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Changes Section */}
                                {renderBusinessLayout(selectedLog)}

                                {/* Technical Information Collapsible */}
                                <div className="pt-2">
                                    <details className="group [&_summary::-webkit-details-marker]:hidden bg-gray-50 rounded-xl border border-gray-100">
                                        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-700 transition-colors">
                                            <span className="transition group-open:rotate-90">
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </span>
                                            Technical Information (For IT Auditors)
                                        </summary>
                                        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gray-100">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-extrabold text-gray-400 uppercase">Target Table</span>
                                                <span className="text-[10px] font-bold text-gray-800">{selectedLog.table || 'System'}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-extrabold text-gray-400 uppercase">Reference ID</span>
                                                <span className="text-[10px] font-bold text-gray-800 break-all">{selectedLog.recordId || selectedLog.id || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-extrabold text-gray-400 uppercase">Audit ID</span>
                                                <span className="text-[10px] font-bold text-gray-800">{selectedLog.id}</span>
                                            </div>
                                            {selectedLog.details &&
                                             !selectedLog.details.includes('Updated item') &&
                                             !selectedLog.details.includes('Restocked') &&
                                             !/logged (in|out)|signed (in|out)|password|session timed|server error/i.test(selectedLog.details) && (
                                                <div className="pt-2 border-t border-gray-200/50 mt-2">
                                                    <span className="text-[9px] font-extrabold text-gray-400 uppercase block mb-1">Raw Trace</span>
                                                    <span className="text-[10px] font-medium text-gray-600 block leading-tight break-all break-words">{selectedLog.details}</span>
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                </div>
                            </div>

                            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                                <Button
                                    onClick={() => setIsLogModalOpen(false)}
                                    className="h-8 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-all"
                                >
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

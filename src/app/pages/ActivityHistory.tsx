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
import { parseDateFromOrderId } from '@/app/lib/orderNumber';
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
            void refreshActivities(1000);
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

    const isOwner = (() => {
        const role = (user.role || '').toLowerCase();
        if (role === 'owner') return true;
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            const r = (u.role || '').toLowerCase();
            const uname = (u.username || '').toLowerCase();
            return r === 'owner' || uname === 'owner';
        } catch {
            return false;
        }
    })();

    // Predefined Module Filter Options (Owner does not see developer/benchmark telemetry)
    const MODULE_OPTIONS = useMemo(() => [
        { label: 'ALL TYPES & MODULES', value: 'all' },
        { label: 'Dashboard', value: 'Dashboard' },
        { label: 'Job Order Form', value: 'Job Order Form' },
        { label: 'Release Calendar', value: 'Release Calendar' },
        { label: 'Sales Report', value: 'Sales Report' },
        { label: 'Inventory Management', value: 'Inventory Management' },
        { label: 'Service Management', value: 'Service Management' },
        { label: 'User Management', value: 'User Management' },
        { label: 'Authentication', value: 'Authentication' },
        { label: 'Cash Register', value: 'Cash Register' },
        { label: 'Expenses', value: 'Expenses' },
        { label: 'Historical Records', value: 'Historical Records' },
        ...(!isOwner ? [{ label: 'System Telemetry (Benchmarks)', value: 'System Telemetry' }] : []),
        { label: 'Machine Learning', value: 'Machine Learning' },
        { label: 'System', value: 'System' }
    ], [isOwner]);

    const getFormattedRole = (role?: string, username?: string): string => {
        const r = (role || '').toLowerCase();
        const u = (username || '').toLowerCase();
        if (r === 'admin' || u === 'admin' || r === 'system' || u === 'system') return 'System';
        if (r === 'owner' || u === 'owner') return 'Owner';
        if (r === 'staff' || u === 'staff') return 'Staff';
        if (r) return r.charAt(0).toUpperCase() + r.slice(1);
        return 'Staff';
    };

    const getModuleBadge = (activity: ActivityLog) => {
        const action = (activity.action || '').toUpperCase();
        const actionRaw = (activity.actionRaw || '').toUpperCase();
        const combined = `${actionRaw} ${action}`;

        // 1. Objective 1 performance benchmark / read telemetry
        if (actionRaw === 'JOB_ORDER_RETRIEVED' || action === 'JOB_ORDER_RETRIEVED' || combined.includes('RETRIEVED')) {
            return 'System Telemetry';
        }
        // 2. Dashboard actions & telemetry
        if (actionRaw.includes('DASHBOARD') || action.includes('DASHBOARD') || activity.module === 'Dashboard' || (activity.type || '').toLowerCase() === 'dashboard') {
            return 'Dashboard';
        }
        // 3. Release Calendar actions & date reschedules
        if (actionRaw.includes('CALENDAR') || action.includes('CALENDAR') || activity.module === 'Release Calendar' || (activity.details || '').toLowerCase().includes('rescheduled')) {
            return 'Release Calendar';
        }
        // 4. Staff permissions & users belong in User Management
        if (actionRaw.includes('PERMISSION') || action.includes('PERMISSION') || activity.table === 'user_permissions' || activity.table === 'users' || activity.type === 'system' || activity.module === 'User Management') {
            return 'User Management';
        }
        // 5. Cash register sessions
        if (activity.table === 'cash_sessions' || actionRaw === 'OPEN' || actionRaw === 'CLOSE' || actionRaw.includes('CASH')) {
            return 'Cash Register';
        }

        const desc = (activity.newValues?.description || '').toLowerCase();
        const det = (activity.details || '').toLowerCase();
        if (desc.includes('inventory restock') || det.includes('stock addition')) {
            return 'Inventory Management';
        }
        if (activity.module && activity.module !== 'System' && activity.module !== 'Orders') {
            if (activity.module === 'Orders' || activity.module === 'Job Orders') return 'Job Order Form';
            if (activity.module === 'Inventory') return 'Inventory Management';
            if (activity.module === 'Services') return 'Service Management';
            if (activity.module === 'Reports') return 'Sales Report';
            return activity.module;
        }
        const type = (activity.type || '').toLowerCase();
        const table = (activity.table || '').toLowerCase();
        if (type === 'service' || table === 'services' || activity.module === 'Services' || activity.module === 'Service Management') return 'Service Management';
        if (type === 'inventory' || table === 'inventory' || activity.module === 'Inventory' || activity.module === 'Inventory Management') return 'Inventory Management';
        if (type === 'expense' || table === 'expenses' || activity.module === 'Expenses') return 'Expenses';
        if (type === 'order' || table === 'orders' || activity.module === 'Job Orders' || activity.module === 'Job Order Form') return 'Job Order Form';
        if (
            action.includes('LOGIN') ||
            action.includes('LOGOUT') ||
            action.includes('LOGGED') ||
            action.includes('PASSWORD') ||
            action.includes('TIMEOUT') ||
            action.includes('SESSION')
        ) return 'Authentication';
        if (
            activity.type === 'reports' || 
            table === 'reports' || 
            actionRaw.includes('REPORT') || 
            action.includes('REPORT') ||
            action === 'PRINT' || 
            actionRaw === 'PRINT' || 
            actionRaw.startsWith('EXPORT') ||
            Boolean(activity.newValues?.report_type)
        ) {
            return 'Sales Report';
        }
        if (type === 'reports' || action === 'PRINT') return 'Sales Report';
        if (type === 'historical' || activity.module === 'Historical Records' || activity.table === 'Historical Records') return 'Historical Records';
        if (type === 'system' || activity.table === 'Users') return 'User Management';
        if (type === 'ml' || action.includes('PREDICT') || action.includes('TRAIN')) return 'Machine Learning';
        return activity.table || 'System';
    };

    const getBusinessActionTitle = (activity: ActivityLog) => {
        const action = (activity.action || '').toUpperCase();
        const actionRaw = (activity.actionRaw || '').toUpperCase();
        const type = (activity.type || '').toLowerCase();
        const combined = `${actionRaw} ${action}`.replace(/[_-]+/g, ' ');
        const moduleName = String(activity.module || getModuleBadge(activity) || '').toUpperCase();
        const tableLower = String(activity.table || '').toLowerCase();
        const detLower = (activity.details || '').toLowerCase();

        // 1. Staff Permissions
        if (actionRaw === 'STAFF_PERMISSION_UPDATED' || action.includes('STAFF_PERMISSION_UPDATED') || combined.includes('PERMISSION UPDATED')) {
            return 'Staff Permissions Updated';
        }
        if (actionRaw === 'STAFF_PERMISSION_RESET_DEFAULTS' || combined.includes('PERMISSION RESET')) {
            return 'Staff Permissions Reset to Defaults';
        }

        // 2. Telemetry & Query Benchmarks (Prevent mislabeling as Job Order Updated)
        if (actionRaw === 'JOB_ORDER_RETRIEVED' || action === 'JOB_ORDER_RETRIEVED' || combined.includes('RETRIEVED')) {
            return 'Record Retrieved';
        }

        // 3. Reports & Analytics (Check BEFORE generic entity fallbacks!)
        const isReport =
            type === 'reports' ||
            moduleName.includes('REPORT') ||
            tableLower.includes('report') ||
            Boolean(activity.newValues?.report_type);

        if (actionRaw.includes('EXPORT_CSV') || combined.includes('EXPORT CSV')) return 'Report Exported (CSV)';
        if (actionRaw.includes('EXPORT_XLSX') || combined.includes('EXPORT XLSX') || combined.includes('EXCEL')) return 'Report Exported (Excel)';
        if (actionRaw.includes('EXPORT_PDF') || combined.includes('EXPORT PDF')) return 'Report Exported (PDF)';
        if (actionRaw.includes('PRINT') || combined.includes('PRINT')) return 'Report Printed';
        if (actionRaw.includes('REPORT') || combined.includes('REPORT') || isReport) {
            if (actionRaw.includes('VIEW') || combined.includes('VIEW') || combined.includes('DISPLAY') || detLower.includes('displayed sales report') || detLower.includes('displayed')) {
                return 'Report Viewed';
            }
            return 'Report Generated';
        }

        // 4. Cash Register Sessions
        if (actionRaw === 'OPEN' || actionRaw === 'OPEN_SESSION' || (activity.table === 'cash_sessions' && action.includes('OPEN'))) {
            return 'Cash Register Opened';
        }
        if (actionRaw === 'CLOSE' || actionRaw === 'CLOSE_SESSION' || (activity.table === 'cash_sessions' && action.includes('CLOSE'))) {
            return 'Cash Register Closed';
        }

        // 5. Financial & Discounts
        if (actionRaw === 'DISCOUNT_AUTHORIZED' || combined.includes('DISCOUNT')) {
            return 'Discount Authorized';
        }

        // 6. Account Access Control & Security
        if (actionRaw === 'LOCK' || action.includes('LOCK_USER') || combined.includes('ACCOUNT LOCKED')) {
            return 'User Account Locked';
        }
        if (actionRaw === 'UNLOCK' || action.includes('UNLOCK_USER') || combined.includes('ACCOUNT UNLOCKED')) {
            return 'User Account Unlocked';
        }
        if (actionRaw === 'PASSWORD_RESET' || action.includes('PASSWORD_RESET') || combined.includes('PASSWORD RESET') || activity.newValues?.password_changed === true) {
            return 'Password Reset';
        }

        // 7. Inventory Adjustments & Restock
        if (actionRaw === 'SET_BALANCE' || combined.includes('SET BALANCE')) {
            return 'Inventory Balance Adjusted';
        }

        // 8. System Backups
        if (actionRaw === 'BACKUP_DOWNLOAD') return 'Backup Downloaded';
        if (actionRaw === 'BACKUP') return 'System Backup Created';
        if (actionRaw === 'BACKUP_FAILED') return 'System Backup Failed';

        // 9. Order Lifecycle - Cancel Order
        if (actionRaw === 'CANCEL' || action === 'CANCEL' || combined.includes('CANCEL')) {
            return 'Job Order Cancelled';
        }

        const isOrder =
            type === 'order' ||
            activity.table === 'Orders' ||
            activity.table === 'Job Orders' ||
            tableLower === 'orders' ||
            moduleName === 'JOB ORDERS';
        const isService =
            type === 'service' || activity.table === 'Services' || tableLower === 'services' || moduleName === 'SERVICES';
        const isInventory =
            type === 'inventory' || activity.table === 'Inventory' || tableLower === 'inventory' || moduleName === 'INVENTORY';
        const isExpense =
            type === 'expense' || activity.table === 'Expenses' || tableLower === 'expenses' || moduleName === 'EXPENSES';
        const isUser =
            activity.table === 'Users' ||
            tableLower === 'users' ||
            moduleName === 'USER MANAGEMENT' ||
            (type === 'system' && (activity.oldValues?.username || activity.newValues?.username) && !isReport);
        const isHistorical =
            moduleName === 'HISTORICAL RECORDS' ||
            activity.table === 'Historical Records' ||
            tableLower === 'historical_orders';

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
        if (combined.includes('SERVER ERROR')) return 'Server Error';
        if (combined.includes('FAILED')) return 'Failed Login';
        if (combined.includes('TIMEOUT')) return 'Session Timeout';
        // LOGOUT before LOGIN — "LOGGED OUT" must not be classified as login.
        if (combined.includes('LOGOUT') || combined.includes('LOGGED OUT')) return 'User Logged Out';
        if (combined.includes('LOGIN') || combined.includes('LOGGED IN')) return 'User Logged In';

        const descLower = (activity.newValues?.description || '').toLowerCase();
        if (
            action.includes('RESTOCK') || 
            actionRaw.includes('RESTOCK') || 
            detLower.includes('restock') || 
            detLower.includes('stock addition') ||
            descLower.includes('inventory restock')
        ) return 'Inventory Restocked';
        if (action.includes('DEDUCT') || actionRaw.includes('DEDUCT') || detLower.includes('deduct')) return 'Inventory Deducted';
        if (action.includes('REACTIVATE') || actionRaw.includes('REACTIVATE') || detLower.includes('reactivated')) return 'Inventory Reactivated';

        if (isInventory) {
            if (action.includes('CREATE') || actionRaw.includes('CREATE')) return 'Inventory Added';
            return 'Inventory Updated';
        }
        if (isOrder) {
            if (action.includes('CREATE') || action.includes('NEW') || actionRaw.includes('NEW') || actionRaw.includes('CREATE')) return 'Job Order Created';
            const orderStatus = String(activity.newValues?.status || activity.newValues?.new_status || '').toLowerCase();
            if (orderStatus === 'claimed') return 'Order Claimed';
            if (orderStatus === 'for-release' || orderStatus === 'for_release') return 'Order Ready For Release';
            if (orderStatus === 'on-going' || orderStatus === 'ongoing' || orderStatus === 'in-progress') return 'Order In Progress';
            if (activity.newValues?.payment_status === 'paid' && activity.oldValues?.payment_status !== 'paid') return 'Order Payment Received';
            return 'Job Order Updated';
        }
        if (isService) {
            if (action.includes('CREATE') || actionRaw.includes('CREATE')) return 'Service Created';
            return 'Service Updated';
        }
        if (isExpense) {
            if (action.includes('CREATE') || actionRaw.includes('CREATE')) return 'Expense Created';
            return 'Expense Updated';
        }
        if (isUser) {
            if (action.includes('CREATE') || actionRaw.includes('CREATE')) return 'User Created';
            if (activity.newValues?.is_active === false && activity.oldValues?.is_active === true) return 'User Deactivated';
            if (activity.newValues?.is_active === true && activity.oldValues?.is_active === false) return 'User Reactivated';
            if (activity.newValues?.role && activity.oldValues?.role && activity.newValues.role !== activity.oldValues.role) return 'User Role Updated';
            return 'User Updated';
        }
        if (isHistorical) {
            if (action.includes('CREATE') || actionRaw.includes('CREATE')) return 'Historical Record Created';
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
        // Priority 1: Direct target user from payload (Permission changes, User edits)
        const targetU = 
            activity.newValues?.target_user ||
            activity.oldValues?.target_user ||
            activity.newValues?.target_username ||
            activity.oldValues?.target_username;
        if (targetU) return String(targetU);

        const actionRaw = (activity.actionRaw || '').toUpperCase();
        const action = (activity.action || '').toUpperCase();
        const title = getBusinessActionTitle(activity).toUpperCase();

        // Priority 2: Query benchmarks / telemetry
        if (actionRaw === 'JOB_ORDER_RETRIEVED' || action === 'JOB_ORDER_RETRIEVED' || title.includes('BENCHMARK')) {
            return activity.newValues?.order_reference || 'All Orders';
        }

        // Priority 3: Cash Register Sessions
        if (activity.table === 'cash_sessions' || title.includes('CASH REGISTER')) {
            return activity.newValues?.session_id ? `Session #${activity.newValues.session_id}` : 'Cash Register';
        }

        // Priority 4: Discount Authorizations
        if (actionRaw === 'DISCOUNT_AUTHORIZED' || title.includes('DISCOUNT')) {
            return activity.newValues?.job_order || activity.newValues?.order_number || 'Job Order';
        }

        // Priority 5: Inventory balance adjustments
        if (actionRaw === 'SET_BALANCE' || title.includes('BALANCE ADJUSTED')) {
            return activity.newValues?.item_name || activity.oldValues?.item_name || 'Inventory Item';
        }

        // Priority 6: Authentication events
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
            (String(activity.newValues?.details || activity.details || '').match(/(?:for order:?|item:?)\s*['"]?([^'"]+?)['"]?(?:\s*\(|\s*:|\s*updated|\s*$)/i)?.[1]) ||
            (String(activity.newValues?.details || activity.details || '').match(/(?:account for)\s+([A-Za-z0-9_.-]+)/i)?.[1]) ||
            activity.recordId ||
            'N/A'
        );
    };

    const getActionIcon = (title: string) => {
        const t = title.toUpperCase();
        if (t.includes('JOB ORDER') || t.includes('CLAIMED') || t.includes('RELEASE') || t.includes('CANCEL')) return <ShoppingCart className="w-3.5 h-3.5" />;
        if (t.includes('INVENTORY') || t.includes('RESTOCK') || t.includes('DEDUCT') || t.includes('BALANCE')) return <Package className="w-3.5 h-3.5" />;
        if (t.includes('LOGIN') || t.includes('LOGOUT') || t.includes('LOGGED') || t.includes('PASSWORD') || t.includes('SESSION')) return <Key className="w-3.5 h-3.5" />;
        if (t.includes('PERMISSION')) return <Users className="w-3.5 h-3.5" />;
        if (t.includes('BENCHMARK') || t.includes('TELEMETRY')) return <Activity className="w-3.5 h-3.5" />;
        if (t.includes('CASH REGISTER')) return <ShoppingCart className="w-3.5 h-3.5" />;
        if (t.includes('DISCOUNT')) return <Tag className="w-3.5 h-3.5" />;
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
        if (actUpper.includes('PERMISSION')) {
            colorClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
        } else if (actUpper.includes('BENCHMARK') || actUpper.includes('TELEMETRY')) {
            colorClass = "bg-sky-50 text-sky-700 border-sky-200";
        } else if (actUpper.includes('CASH REGISTER')) {
            colorClass = actUpper.includes('OPEN') ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-300";
        } else if (actUpper.includes('DISCOUNT')) {
            colorClass = "bg-teal-50 text-teal-700 border-teal-200";
        } else if (actUpper.includes('BALANCE ADJUSTED')) {
            colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        } else if (actUpper.includes('NEW') || actUpper.includes('CREATED') || actUpper.includes('ADDED') || actUpper.includes('REACTIVATED') || actUpper.includes('LOGGED IN') || actUpper.includes('RESTOCK')) {
            colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (actUpper.includes('UPDATE') || actUpper.includes('GENERATED') || actUpper.includes('EDIT')) {
            colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        } else if (actUpper.includes('DELETE') || actUpper.includes('OUT') || actUpper.includes('FAILED') || actUpper.includes('CANCEL') || actUpper.includes('DEDUCT') || actUpper.includes('LOCKED')) {
            colorClass = "bg-rose-50 text-rose-700 border-rose-200";
        } else if (actUpper.includes('PASSWORD') || actUpper.includes('CLAIMED') || actUpper.includes('RELEASE') || actUpper.includes('UNLOCKED')) {
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
        const actionTitle = getBusinessActionTitle(activity).toUpperCase();
        const detailsLower = String(activity.details || '').toLowerCase();

        // 1. Hide system telemetry and server errors in Owner role
        if (isOwner) {
            const isServerError =
                actionRaw === 'SERVER_ERROR' ||
                actionRaw.includes('SERVER_ERROR') ||
                actionRaw.includes('SERVER ERROR') ||
                actionTitle.includes('SERVER ERROR') ||
                String(activity.action || '').toUpperCase().includes('SERVER ERROR') ||
                String(activity.table || '').toLowerCase() === 'backend_v2' ||
                detailsLower.startsWith('server error') ||
                detailsLower.includes('server error during');

            const isSystemTelemetry =
                moduleLabel === 'SYSTEM TELEMETRY' ||
                moduleLabel.includes('TELEMETRY') ||
                moduleLabel.includes('BENCHMARK') ||
                actionRaw === 'JOB_ORDER_RETRIEVED' ||
                actionRaw.includes('TELEMETRY') ||
                actionRaw.includes('BENCHMARK') ||
                actionTitle.includes('RECORD RETRIEVED') ||
                actionTitle.includes('BENCHMARK') ||
                actionTitle.includes('TELEMETRY') ||
                String(activity.module || '').toUpperCase() === 'SYSTEM TELEMETRY' ||
                String(activity.module || '').toUpperCase().includes('TELEMETRY') ||
                String(activity.module || '').toUpperCase().includes('BENCHMARK');

            if (isServerError || isSystemTelemetry) {
                return false;
            }
        }

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
        if (!matchesType && (selType === 'sales' || selType === 'sales report' || selType === 'reports')) {
            matchesType = activityMod.includes('report') || activityMod.includes('sales') || activity.table?.toLowerCase() === 'reports' || activity.type?.toLowerCase() === 'reports';
        }
        if (!matchesType && (selType === 'inventory' || selType === 'inventory management')) {
            matchesType = activityMod.includes('inventory') || activity.table?.toLowerCase() === 'inventory' || (activity.newValues?.description || '').toLowerCase().includes('inventory restock') || (activity.details || '').toLowerCase().includes('stock addition');
        }
        if (!matchesType && (selType === 'services' || selType === 'service management')) {
            matchesType = activityMod.includes('service') || activity.table?.toLowerCase() === 'services' || activity.type?.toLowerCase() === 'service';
        }
        if (!matchesType && (selType === 'job orders' || selType === 'job order form')) {
            matchesType = activityMod.includes('job order') || activityMod.includes('order') || activity.table?.toLowerCase() === 'orders' || activity.type?.toLowerCase() === 'order';
        }
        if (!matchesType && selType === 'release calendar') {
            matchesType = activityMod.includes('calendar') || (activity.details || '').toLowerCase().includes('rescheduled') || (activity.module || '').toLowerCase().includes('calendar');
        }
        if (!matchesType && selType === 'dashboard') {
            matchesType = activityMod.includes('dashboard') || (activity.module || '').toLowerCase().includes('dashboard') || (activity.type || '').toLowerCase() === 'dashboard';
        }
        if (!matchesType && selType === 'user management') {
            matchesType = activityMod.includes('user') || activity.table?.toLowerCase() === 'users' || activity.table?.toLowerCase() === 'user_permissions';
        }
        if (!matchesType && selType === 'expenses') {
            matchesType = activityMod === 'expenses' || activity.table?.toLowerCase() === 'expenses';
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

    const normalizeDate = (ts: string) => {
        if (!ts) return "";
        if (ts.length > 18 || isNaN(parseInt(ts.substring(0, 2))) || ts.includes('T')) {
            try {
                const d = new Date(ts);
                if (!isNaN(d.getTime())) {
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    let hours = d.getHours();
                    const mins = String(d.getMinutes()).padStart(2, '0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    const hh = String(hours).padStart(2, '0');
                    return `${mm}/${dd}/${yyyy}, ${hh}:${mins} ${ampm}`;
                }
            } catch { return ts; }
        }
        return ts;
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
        
        const ignoredKeys = new Set(['id', 'order_id', 'item_id', 'user_id', 'customer_id', 'created_at', 'updated_at', 'history', 'items', 'inventory_used', 'inventoryused', '_id', 'token', 'password', 'ordernumber', 'order_number', 'updater_id', 'updaterid', 'inventoryapplied', 'inventory_applied', 'last_modified', 'is_retail', 'isretail', 'sync_version', 'modifier', 'record_id', 'details', 'cancelled', 'permissions', 'added', 'removed', 'target_user', 'targetuser', 'target_username', 'restored_defaults', 'restoreddefaults', 'test_id', 'testid', 'duration_ms', 'durationms', 'result_count', 'resultcount']);

        const mapBusinessLabel = (key: string) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'password_changed' || lowerKey === 'passwordchanged') return 'Password Security';
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
            if (lowerKey === 'order_date' || lowerKey === 'orderdate') return 'Order Date';
            if (lowerKey === 'order_time' || lowerKey === 'ordertime') return 'Order Time';
            if (lowerKey === 'encoding_time' || lowerKey === 'encodingtime') return 'Intake Duration';
            if (lowerKey === 'encoding_seconds' || lowerKey === 'encodingseconds') return 'Intake Seconds';
            if (lowerKey === 'efficiency_vs_paper' || lowerKey === 'efficiencyvspaper') return 'Intake Duration';
            if (lowerKey === 'total_pairs' || lowerKey === 'totalpairs') return 'Total Pairs';
            if (lowerKey === 'duration_ms' || lowerKey === 'durationms') return 'Duration (ms)';
            if (lowerKey === 'duration_formatted' || lowerKey === 'durationformatted') return 'Duration';
            if (lowerKey === 'time_taken' || lowerKey === 'timetaken') return 'Time Taken';
            return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
        };

        const formatCurrency = (val: any) => {
            if (typeof val === 'number') return `₱${val.toFixed(2)}`;
            if (typeof val === 'string' && !isNaN(parseFloat(val))) return `₱${parseFloat(val).toFixed(2)}`;
            return val;
        };

        const formatIsoTimestamp = (raw: string): string | null => {
            if (!raw || typeof raw !== 'string') return null;
            const trimmed = raw.trim();
            // Match ISO timestamps or date strings like 2026-09-30T05:51:48.892908, 2026-09-30 05:51:48, 2026-09-30
            if (/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.test(trimmed)) {
                try {
                    const d = new Date(trimmed);
                    if (!isNaN(d.getTime())) {
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        if (trimmed.includes('T') || trimmed.includes(':') || (trimmed.includes(' ') && trimmed.length > 10)) {
                            let hours = d.getHours();
                            const minutes = String(d.getMinutes()).padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12;
                            hours = hours ? hours : 12;
                            const hh = String(hours).padStart(2, '0');
                            return `${mm}/${dd}/${yyyy}, ${hh}:${minutes} ${ampm}`;
                        }
                        return `${mm}/${dd}/${yyyy}`;
                    }
                } catch {
                    return null;
                }
            }
            return null;
        };

        const humanizeReadableValue = (raw: string): string => {
            const trimmed = raw.trim();
            if (!trimmed) return 'None';

            // Check if string is an ISO timestamp before stripping characters
            const isoFormatted = formatIsoTimestamp(trimmed);
            if (isoFormatted) return isoFormatted;

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
                'admin': 'System',
                'system': 'System',
                'owner': 'Owner',
                'staff': 'Staff',
                'empty': 'None',
                'null': 'None',
                'none': 'None',
                'not set': 'None',
                'n/a': 'None',
                'na': 'None',
                'in stock': 'In Stock',
                'low stock': 'Low Stock',
                'out of stock': 'Out of Stock',
                'active': 'Active',
                'inactive': 'Inactive',
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
            if (lowerKey === 'password_changed' || lowerKey === 'passwordchanged') {
                if (val === true || val === 'true' || val === 1) return 'Password Changed Successfully';
                if (val === false || val === 'false' || val === 0) return 'No Change';
                return 'Existing Password';
            }
            if (val === true || val === 'true') return 'Yes';
            if (val === false || val === 'false') return 'No';
            if (val === null || val === undefined || val === '') {
                if (lowerKey === 'status' || lowerKey === 'status_after' || lowerKey === 'statusafter') {
                    return 'Not Set';
                }
                return 'None';
            }
            if (typeof val === 'string' && ['empty', 'null', 'none', 'not set', 'n/a', 'na'].includes(val.trim().toLowerCase())) {
                if (lowerKey === 'status' || lowerKey === 'status_after' || lowerKey === 'statusafter') {
                    return 'Not Set';
                }
                return 'None';
            }

            if (lowerKey.includes('date') || lowerKey.includes('time') || lowerKey.includes('timestamp') || lowerKey.includes('created') || lowerKey.includes('updated') || lowerKey.includes('predicted') || lowerKey.includes('transaction')) {
                if (typeof val === 'string') {
                    const parsedDate = formatIsoTimestamp(val);
                    if (parsedDate) return parsedDate;
                }
            }

            if (lowerKey === 'role' || lowerKey === 'role_name' || lowerKey === 'rolename') {
                return getFormattedRole(String(val));
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
            
            if (lowerKey === 'duration_ms' || lowerKey === 'durationms') {
                const num = Number(val);
                if (Number.isFinite(num)) {
                    return `${num.toLocaleString('en-US')} ms`;
                }
                return String(val);
            }

            // Check if key represents a count / quantity rather than monetary amount:
            const isCountOrQuantity = 
                lowerKey.includes('pair') || 
                lowerKey.includes('qty') || 
                lowerKey.includes('quantity') || 
                lowerKey.includes('count') || 
                lowerKey.includes('item') || 
                lowerKey.includes('day') || 
                lowerKey.includes('shoe') ||
                lowerKey.includes('order');

            if (isCountOrQuantity) {
                const num = Number(val);
                if (Number.isFinite(num)) {
                    return String(Math.round(num));
                }
                return String(val);
            }
            
            if (lowerKey.includes('price') || lowerKey.includes('total') || lowerKey.includes('amount') || lowerKey.includes('cost') || lowerKey.includes('fee') || lowerKey.includes('balance') || lowerKey.includes('paid') || lowerKey.includes('revenue') || lowerKey.includes('sales') || lowerKey.includes('refund') || lowerKey.includes('downpayment') || lowerKey.includes('deposit')) {
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
                    // Filter out synthetic or no-op password_changed: false
                    if (norm === 'passwordchanged' && (newVals[k] === false || newVals[k] === 'false' || newVals[k] === 'No' || !newVals[k])) {
                        return;
                    }
                    if (!normMap[norm]) {
                        normMap[norm] = { label: k, missingInOld: true };
                    }
                    normMap[norm].newVal = newVals[k];
                    normMap[norm].label = k;
                }
            });

            const changedItems = Object.values(normMap).filter(item => {
                const norm = item.label.toLowerCase().replace(/[_-\s]/g, '');
                if (norm === 'passwordchanged') {
                    if (item.newVal !== true && item.newVal !== 'true' && item.newVal !== 'Yes') {
                        return false;
                    }
                }
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

                const normOld = item.missingInOld ? null : normalizeValue(item.oldVal);
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
                                        <div className="flex flex-col gap-1">
                                            <span className="font-extrabold text-slate-500 uppercase text-[9px] tracking-widest">Stock Quantity</span>
                                            <div className="grid grid-cols-2 gap-2 mt-0.5">
                                                <div className="bg-white border border-slate-200 rounded-lg p-2 flex flex-col gap-0.5">
                                                    <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Previous</span>
                                                    <span className="text-[12px] font-bold text-slate-700">
                                                        {mapBusinessValue('stock_quantity', oldVals.stock_quantity)}{oldVals.unit ? ` ${oldVals.unit}` : ''}
                                                    </span>
                                                </div>
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex flex-col gap-0.5">
                                                    <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-700">Updated</span>
                                                    <span className="text-[12px] font-black text-emerald-900">
                                                        {mapBusinessValue('stock_quantity', newVals.stock_quantity)}{newVals.unit ? ` ${newVals.unit}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                }
                return (
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center mt-3">
                        <span className="text-[11px] font-bold text-slate-600">Record saved with no field modifications.</span>
                    </div>
                );
            }

            const sections = {
                'User Information': [
                    'username', 'email', 'role', 'role_name', 'is_active', 'password_changed', 'passwordchanged'
                ],
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
                'Order Information': [
                    'status', 'priorityLevel', 'predictedCompletionDate', 'transactionDate', 'inventoryApplied',
                    'order_date', 'orderDate', 'order_time', 'orderTime',
                    'encoding_time', 'encoding_seconds', 'efficiency_vs_paper'
                ],
                'Shoe Information': ['brand', 'shoeModel', 'shoeMaterial', 'shoeSize', 'color', 'condition', 'quantity'],
                'Service Information': ['baseService', 'addOns'],
                'Customer Information': ['customerName', 'contactNumber'],
                'Delivery Information': ['shippingPreference', 'deliveryAddress', 'deliveryCourier', 'releaseTime', 'province', 'city', 'barangay', 'zipCode'],
                'Payment Information': ['grandTotal', 'amountReceived', 'balance', 'paymentMethod', 'paymentStatus', 'referenceNo', 'depositAmount']
            };

            const groupedChanges: { [key: string]: typeof changedItems } = {
                'User Information': [],
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
                <div className="space-y-3 mt-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Activity Changes & Audit Record</span>
                    
                    {Object.entries(groupedChanges).map(([sectionTitle, items]) => {
                        if (items.length === 0) return null;
                        return (
                            <div key={sectionTitle} className="space-y-2 mb-3">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 block w-full">{sectionTitle}</span>
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3 min-w-0">
                                    {items.map(({ label, oldVal, newVal }) => {
                                        const norm = label.toLowerCase().replace(/[_-\s]/g, '');
                                        if (norm === 'passwordchanged') {
                                            return (
                                                <div key={label} className="flex flex-col gap-1.5 pb-2.5 border-b border-slate-100 last:border-0 last:pb-0 min-w-0">
                                                    <span className="font-extrabold text-slate-600 uppercase text-[9.5px] tracking-wider">Password Security</span>
                                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between min-w-0 shadow-2xs">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                            <span className="text-[12px] font-black text-emerald-900 truncate">Password Changed Successfully</span>
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md shrink-0">Updated</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={label} className="flex flex-col gap-1.5 pb-2.5 border-b border-slate-100 last:border-0 last:pb-0 min-w-0">
                                                <span className="font-extrabold text-slate-600 uppercase text-[9.5px] tracking-wider">{mapBusinessLabel(label)}</span>
                                                <div className="grid grid-cols-2 gap-2 mt-0.5 min-w-0">
                                                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 flex flex-col gap-0.5 min-w-0">
                                                        <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Previous</span>
                                                        <span className="text-[12px] font-bold text-slate-700 break-words leading-tight">{mapBusinessValue(label, oldVal)}</span>
                                                    </div>
                                                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2 flex flex-col gap-0.5 min-w-0">
                                                        <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-700">Updated</span>
                                                        <span className="text-[12px] font-black text-emerald-900 break-words leading-tight">{mapBusinessValue(label, newVal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
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
        let humanSummary = (newValsDetail && newValsDetail !== rawLogDetail) ? newValsDetail : '';
        if (humanSummary) {
            humanSummary = humanSummary
                .replace(/Password Changed:\s*\(new\)\s*Yes/gi, 'Password Changed Successfully')
                .replace(/Password Changed:\s*Yes/gi, 'Password Changed Successfully')
                .replace(/Password Changed:\s*\(new\)\s*No/gi, 'Password: No Change')
                .replace(/Password Changed:\s*No/gi, 'Password: No Change');
        }
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
        if ((module.includes('JOB ORDER') || module === 'ORDERS') && Object.keys(oldVals).length > 0 && Object.keys(newVals).length > 0 && newVals.status && oldVals.status !== newVals.status) {
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Status Changed</span>
                    <div className="grid grid-cols-2 gap-2 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Previous Status</span>
                            <span className="text-[12px] font-bold text-slate-600">{mapBusinessValue('status', oldVals.status)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-blue-700">Updated Status</span>
                            <span className="text-[12px] font-black text-blue-900">{mapBusinessValue('status', newVals.status)}</span>
                        </div>
                    </div>
                </div>
            );
        } else if (module.includes('INVENTORY') && actionStr.includes('RESTOCK')) {
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
                            <span className="text-slate-500">From: {mapBusinessValue('stock', oldVals.stock || oldVals.stock_quantity || 0)}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-emerald-800 font-black">To: {mapBusinessValue('stock', newVals.stock || newVals.stock_quantity || 0)}</span>
                        </div>
                    </div>
                </div>
            );
        } else if (module.includes('INVENTORY') && (actionStr.includes('CONSUME') || actionStr.includes('DEDUCT') || log.details.toLowerCase().includes('deduct'))) {
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
                            <span className="text-slate-500">From: {mapBusinessValue('stock', oldVals.stock || oldVals.stock_quantity || 0)}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-rose-800 font-black">To: {mapBusinessValue('stock', newVals.stock || newVals.stock_quantity || 0)}</span>
                        </div>
                    </div>
                </div>
            );
        } else if (module.includes('SERVICE') && Object.keys(oldVals).length > 0 && Object.keys(newVals).length > 0 && ((newVals.base_price && oldVals.base_price !== newVals.base_price) || (newVals.price && oldVals.price !== newVals.price))) {
            const oldP = oldVals.base_price || oldVals.price;
            const newP = newVals.base_price || newVals.price;
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Price Updated</span>
                    <div className="grid grid-cols-2 gap-2 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Previous Price</span>
                            <span className="text-[12px] font-bold text-slate-600">{formatCurrency(oldP)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-700">Updated Price</span>
                            <span className="text-[12px] font-black text-emerald-900">{formatCurrency(newP)}</span>
                        </div>
                    </div>
                </div>
            );
        } else if ((module === 'USERS' || module.includes('USER')) && actionStr.includes('CREATE')) {
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Created Account</span>
                    <div className="flex flex-col gap-0.5 bg-purple-50 p-2.5 rounded-xl border border-purple-100 shadow-sm">
                        <span className="text-[13px] font-black text-gray-900">Username: {newVals.username || newVals.user || log.recordId}</span>
                        <span className="text-[12px] font-bold text-gray-600">Role: {getFormattedRole(newVals.role || 'Staff')}</span>
                    </div>
                </div>
            );
        } else if (module.includes('CALENDAR') || actionStr.includes('RESCHEDULE') || actionStr.includes('CALENDAR')) {
            const oldDate = oldVals.predicted_completion_date || oldVals.release_date || '';
            const newDate = newVals.predicted_completion_date || newVals.release_date || '';
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Release Schedule Changed</span>
                    <div className="grid grid-cols-2 gap-2 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 shadow-sm">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Previous Date</span>
                            <span className="text-[12px] font-bold text-slate-600">{oldDate ? formatIsoTimestamp(oldDate) || oldDate : '—'}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-indigo-700">New Date</span>
                            <span className="text-[12px] font-black text-indigo-900">{newDate ? formatIsoTimestamp(newDate) || newDate : log.details || 'Release Date Updated'}</span>
                        </div>
                    </div>
                </div>
            );
        } else if (module.includes('DASHBOARD')) {
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Dashboard Activity</span>
                    <div className="flex items-center gap-2 text-[13px] font-bold text-sky-800 bg-sky-50 p-2.5 rounded-xl border border-sky-100 shadow-sm">
                        <span>{log.details || 'Operational metrics and real-time KPI analytics inspected'}</span>
                    </div>
                </div>
            );
        } else if (module.includes('REPORT') || actionStr.includes('REPORT') || actionStr.includes('GENERATED')) {
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

        // 1. SPECIALIZED LAYOUT: Staff Permissions Update & Defaults Reset
        if (actionStr.includes('PERMISSION') || log.table === 'user_permissions') {
            const targetUser = newVals.target_user || oldVals.target_user || log.recordId || 'Staff';
            const addedList: string[] = Array.isArray(newVals.added) ? newVals.added : [];
            const removedList: string[] = Array.isArray(newVals.removed) ? newVals.removed : [];
            const isReset = actionStr.includes('RESET') || Boolean(newVals.restored_defaults);

            const PERMISSION_META: Record<string, { label: string; category: string; description: string }> = {
                'job_orders.view': { label: 'View Job Orders', category: 'Job Orders', description: 'Can view customer job orders and statuses' },
                'job_orders.create': { label: 'Create Job Orders', category: 'Job Orders', description: 'Can intake shoes and create new orders' },
                'job_orders.update': { label: 'Update Job Orders', category: 'Job Orders', description: 'Can update order status, items, and details' },
                'job_orders.cancel': { label: 'Cancel Job Orders', category: 'Job Orders', description: 'Can cancel job orders before completion' },
                'job_orders.release': { label: 'Release / Claim Orders', category: 'Job Orders', description: 'Can mark orders as claimed/released to customer' },
                'payments.process': { label: 'Process Payments', category: 'Financial', description: 'Can accept cash, GCash, and Maya payments' },
                'discounts.apply': { label: 'Apply Discounts', category: 'Financial', description: 'Can view and select discounts on job orders' },
                'discounts.authorize': { label: 'Authorize Discounts', category: 'Financial', description: 'Can grant custom or senior/PWD discounts' },
                'inventory.view': { label: 'View Inventory', category: 'Inventory', description: 'Can view raw materials, supplies, and stock levels' },
                'inventory.add': { label: 'Add New Inventory', category: 'Inventory', description: 'Can create new stock catalog items' },
                'inventory.edit': { label: 'Edit Inventory Items', category: 'Inventory', description: 'Can edit unit costs, stock counts, and specs' },
                'inventory.deactivate': { label: 'Deactivate / Delete Inventory', category: 'Inventory', description: 'Can soft-delete inventory catalog items' },
            };

            const formatPermBadge = (code: string) => {
                const meta = PERMISSION_META[code.trim()] || {
                    label: code.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    category: 'System'
                };
                return meta.label;
            };

            const permsDict = newVals.permissions || newVals.restored_defaults || {};

            return (
                <div className="space-y-3 mt-2">
                    {/* Target Staff Card */}
                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-indigo-600 uppercase text-[9px] tracking-widest">Target Staff Account</span>
                            <span className="font-black text-indigo-950 text-[14px]">{targetUser}</span>
                        </div>
                        <Badge className="bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wider px-2 py-0.5">
                            Role: Staff
                        </Badge>
                    </div>

                    {/* Reset to Defaults Notice */}
                    {isReset && (
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                            <span className="text-[12px] font-bold text-blue-900 leading-snug">
                                All staff permissions were restored to standard system defaults.
                            </span>
                        </div>
                    )}

                    {/* Revoked Permissions */}
                    {removedList.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                Access Revoked ({removedList.length})
                            </span>
                            <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/80 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {removedList.map((code) => (
                                        <span
                                            key={code}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100/90 text-rose-800 border border-rose-300 shadow-2xs"
                                        >
                                            <span className="text-rose-600 text-[11px]">✕</span>
                                            {formatPermBadge(code)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Granted Permissions */}
                    {addedList.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Access Granted ({addedList.length})
                            </span>
                            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {addedList.map((code) => (
                                        <span
                                            key={code}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-2xs"
                                        >
                                            <span className="text-emerald-600 text-[11px]">✓</span>
                                            {formatPermBadge(code)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Collapsible Full Active Matrix */}
                    {typeof permsDict === 'object' && Object.keys(permsDict).length > 0 && (
                        <details className="group [&_summary::-webkit-details-marker]:hidden bg-slate-50 rounded-xl border border-slate-200 mt-2">
                            <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-slate-900 transition-colors">
                                <span>Active Permission Matrix ({Object.values(permsDict).filter(Boolean).length} / {Object.keys(permsDict).length} Enabled)</span>
                                <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                            </summary>
                            <div className="p-3 border-t border-slate-200 space-y-2 bg-white rounded-b-xl">
                                {['Job Orders', 'Inventory', 'Financial'].map((cat) => {
                                    const catItems = Object.entries(PERMISSION_META).filter(([_, m]) => m.category === cat);
                                    if (catItems.length === 0) return null;
                                    return (
                                        <div key={cat} className="space-y-1">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">{cat}</span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {catItems.map(([code, meta]) => {
                                                    const isEnabled = Boolean(permsDict[code]);
                                                    return (
                                                        <div
                                                            key={code}
                                                            className={`flex items-center justify-between p-1.5 px-2.5 rounded-lg text-xs font-bold border ${isEnabled ? 'bg-emerald-50/50 border-emerald-200 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'}`}
                                                        >
                                                            <span className="text-[11px] truncate">{meta.label}</span>
                                                            <span className={`text-[10px] font-black shrink-0 ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                {isEnabled ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </details>
                    )}
                </div>
            );
        }

        // 2. SPECIALIZED LAYOUT: Objective 1 Read Telemetry & Query Benchmarks
        if (actionStr.includes('BENCHMARK') || (log.actionRaw || '').toUpperCase() === 'JOB_ORDER_RETRIEVED') {
            const testId = newVals.test_id || log.recordId || 'O1-RET-BENCHMARK';
            const scope = newVals.order_reference || 'All Orders';
            const durMs = Number(newVals.duration_ms || 0);
            const count = Number(newVals.result_count || 0);

            return (
                <div className="space-y-3 mt-2">
                    <div className="bg-sky-50/80 p-3.5 rounded-xl border border-sky-200 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                            <span className="font-extrabold text-sky-700 uppercase text-[9px] tracking-widest">Objective 1: Digital Retrieval Speed</span>
                            <Badge className="bg-sky-600 text-white font-black text-[9px] uppercase px-2 py-0.5">
                                {durMs < 500 ? '⚡ Ultra-Fast (<0.5s)' : 'Normal (<2s)'}
                            </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-sky-800 uppercase text-[9px] tracking-widest">Test Run ID</span>
                                <span className="font-black text-slate-900 text-[13px]">{testId}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-sky-800 uppercase text-[9px] tracking-widest">Query Target</span>
                                <span className="font-black text-slate-900 text-[13px]">{scope}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-sky-100">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-sky-800 uppercase text-[9px] tracking-widest">Response Latency</span>
                                <span className="font-black text-emerald-700 text-[15px]">{durMs.toFixed(2)} ms</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-sky-800 uppercase text-[9px] tracking-widest">Records Fetched</span>
                                <span className="font-black text-slate-900 text-[15px]">{count} record{count !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 leading-relaxed">
                        Automated telemetry logging for academic validation comparing computerized instant query retrieval against traditional manual filing systems (Objective 1).
                    </div>
                </div>
            );
        }

        // 3. SPECIALIZED LAYOUT: Discount Authorization
        if (actionStr.includes('DISCOUNT AUTHORIZED') || (log.actionRaw || '').toUpperCase() === 'DISCOUNT_AUTHORIZED') {
            const ordRef = newVals.job_order || newVals.order_number || log.recordId || 'Job Order';
            const authBy = newVals.authorized_by || log.user || 'Owner';
            const authRole = newVals.authorizer_role || 'Owner';
            const discAmt = Number(newVals.discount_amount || 0);
            const staff = newVals.processing_staff || log.user || 'Staff';
            const reason = newVals.reason || 'Authorized by supervisor';

            return (
                <div className="space-y-3 mt-2">
                    <div className="bg-teal-50/80 p-3.5 rounded-xl border border-teal-200 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                            <span className="font-extrabold text-teal-800 uppercase text-[9px] tracking-widest">Discount Authorization Card</span>
                            <Badge className="bg-teal-600 text-white font-black text-[9px] uppercase px-2 py-0.5">
                                Authorized
                            </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-teal-700 uppercase text-[9px] tracking-widest">Job Order</span>
                                <span className="font-black text-slate-900 text-[13px]">{ordRef}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-teal-700 uppercase text-[9px] tracking-widest">Discount Amount</span>
                                <span className="font-black text-emerald-700 text-[15px]">{formatCurrency(discAmt)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-teal-100">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-teal-700 uppercase text-[9px] tracking-widest">Authorized By</span>
                                <span className="font-black text-slate-900 text-[13px]">{authBy} <span className="text-teal-600 font-bold">({getFormattedRole(authRole, authBy)})</span></span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-teal-700 uppercase text-[9px] tracking-widest">Staff In Attendance</span>
                                <span className="font-black text-slate-900 text-[13px]">{staff}</span>
                            </div>
                        </div>
                        {reason && (
                            <div className="pt-2 border-t border-teal-100">
                                <span className="font-extrabold text-teal-700 uppercase text-[9px] tracking-widest block mb-0.5">Reason / Justification</span>
                                <span className="text-xs font-semibold text-slate-800">{reason}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // 4. SPECIALIZED LAYOUT: Cash Register (Open / Close)
        if (actionStr.includes('CASH REGISTER') || log.table === 'cash_sessions') {
            const isOpen = actionStr.includes('OPEN') || (newVals.status || '').toUpperCase() === 'OPEN';
            const sessionId = newVals.session_id || log.recordId || 'N/A';
            const openAmt = Number(newVals.opening_cash || 0);
            const expectedAmt = Number(newVals.expected_cash || 0);
            const actualAmt = Number(newVals.actual_cash || 0);
            const overShort = Number(newVals.over_short || 0);
            const varReason = newVals.variance_reason || '';

            return (
                <div className="space-y-3 mt-2">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-extrabold text-slate-500 uppercase text-[9px] tracking-widest">Register Session #{sessionId}</span>
                            <Badge className={`${isOpen ? 'bg-emerald-600' : 'bg-slate-700'} text-white font-black text-[9px] uppercase px-2 py-0.5`}>
                                {isOpen ? 'Register Opened' : 'Register Closed'}
                            </Badge>
                        </div>
                        {isOpen ? (
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Starting Float Cash</span>
                                <span className="font-black text-emerald-700 text-lg">{formatCurrency(openAmt)}</span>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Expected System Cash</span>
                                        <span className="font-black text-slate-900 text-[14px]">{formatCurrency(expectedAmt)}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Actual Counted Cash</span>
                                        <span className="font-black text-emerald-700 text-[14px]">{formatCurrency(actualAmt)}</span>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                                    <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Cash Discrepancy</span>
                                    <Badge className={`${overShort === 0 ? 'bg-emerald-100 text-emerald-800' : overShort > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'} font-black text-[11px]`}>
                                        {overShort === 0 ? 'Exact Match (₱0.00)' : `${overShort > 0 ? '+₱' : '-₱'}${Math.abs(overShort).toFixed(2)} (${overShort > 0 ? 'Over' : 'Short'})`}
                                    </Badge>
                                </div>
                                {varReason && (
                                    <div className="pt-2 border-t border-slate-200">
                                        <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest block mb-0.5">Variance Explanation</span>
                                        <span className="text-xs font-semibold text-slate-800">{varReason}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // 5. SPECIALIZED LAYOUT: Inventory Set Balance (Physical Reconciliation)
        if (actionStr.includes('BALANCE ADJUSTED') || (log.actionRaw || '').toUpperCase() === 'SET_BALANCE') {
            const itemName = newVals.item_name || oldVals.item_name || 'Inventory Item';
            const prevStock = Number(oldVals.stock_quantity ?? newVals.previous_stock ?? 0);
            const newStock = Number(newVals.stock_quantity ?? newVals.new_stock ?? 0);
            const diff = Number(newVals.difference ?? (newStock - prevStock));
            const unit = newVals.unit || oldVals.unit || '';
            const reason = newVals.reason || '';

            return (
                <div className="space-y-3 mt-2">
                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                            <span className="font-extrabold text-amber-800 uppercase text-[9px] tracking-widest">Physical Reconciliation</span>
                            <Badge className="bg-amber-600 text-white font-black text-[9px] uppercase px-2 py-0.5">
                                Count Adjusted
                            </Badge>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-amber-700 uppercase text-[9px] tracking-widest">Inventory Item</span>
                            <span className="font-black text-slate-900 text-[14px]">{itemName}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-100">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-amber-700 uppercase text-[9px] tracking-widest">Previous Stock</span>
                                <span className="font-bold text-slate-700 text-[13px]">{prevStock} {unit}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-amber-700 uppercase text-[9px] tracking-widest">Reconciled Count</span>
                                <span className="font-black text-emerald-700 text-[14px]">{newStock} {unit}</span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-amber-100 flex items-center justify-between">
                            <span className="font-extrabold text-amber-700 uppercase text-[9px] tracking-widest">Adjustment Difference</span>
                            <Badge className={`${diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} font-black text-[11px]`}>
                                {diff >= 0 ? `+${diff}` : diff} {unit}
                            </Badge>
                        </div>
                        {reason && (
                            <div className="pt-2 border-t border-amber-100">
                                <span className="font-extrabold text-amber-700 uppercase text-[9px] tracking-widest block mb-0.5">Reason</span>
                                <span className="text-xs font-semibold text-slate-800">{reason}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // 6. SPECIALIZED LAYOUT: Authentication
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
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Authentication Failure</span>
                        <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 shadow-sm space-y-2.5">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-red-600 uppercase text-[9px] tracking-widest">Attempted Account</span>
                                <span className="font-black text-red-950 text-[13px]">{newVals.username_attempted || log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 pt-2 border-t border-red-200">
                                <span className="font-extrabold text-red-600 uppercase text-[9px] tracking-widest">Failure Reason</span>
                                <span className="font-black text-red-700 text-[13px]">{newVals.reason === 'wrong_password' ? 'Incorrect Password' : newVals.reason === 'account_locked' ? 'Account Locked' : newVals.reason === 'account_deactivated' ? 'Account Deactivated' : newVals.reason === 'account_not_found' ? 'Account Not Found' : 'Incorrect Credentials'}</span>
                            </div>
                            {newVals.failed_attempts !== undefined && (
                                <div className="flex flex-col gap-0.5 pt-2 border-t border-red-200">
                                    <span className="font-extrabold text-red-600 uppercase text-[9px] tracking-widest">Consecutive Failed Attempts</span>
                                    <span className="font-black text-red-900 text-[13px]">{newVals.failed_attempts} of 3</span>
                                </div>
                            )}
                            <div className="flex flex-col gap-0.5 pt-2 border-t border-red-200">
                                <span className="font-extrabold text-red-600 uppercase text-[9px] tracking-widest">Security Action</span>
                                <span className="font-black text-[13px] text-red-900">{newVals.reason === 'account_locked' ? 'Account Automatically Locked' : newVals.reason === 'account_deactivated' ? 'Access Blocked' : 'Warning Recorded'}</span>
                            </div>
                        </div>
                    </div>
                );
            }

            if (timedOut) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Session Expiration</span>
                        <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 shadow-sm space-y-2.5">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-amber-700 uppercase text-[9px] tracking-widest">User Account</span>
                                <span className="font-black text-amber-950 text-[13px]">{log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 pt-2 border-t border-amber-200">
                                <span className="font-extrabold text-amber-700 uppercase text-[9px] tracking-widest">Expiration Reason</span>
                                <span className="font-bold text-[12px] text-amber-800">Automatic logout after period of system inactivity.</span>
                            </div>
                        </div>
                    </div>
                );
            }

            if (passwordReset) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Credential Update</span>
                        <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200 shadow-sm space-y-2.5">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-purple-700 uppercase text-[9px] tracking-widest">User Account</span>
                                <span className="font-black text-purple-950 text-[13px]">{log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 pt-2 border-t border-purple-200">
                                <span className="font-extrabold text-purple-700 uppercase text-[9px] tracking-widest">Security Status</span>
                                <span className="font-black text-[13px] text-purple-800">Password reset and encrypted successfully.</span>
                            </div>
                        </div>
                    </div>
                );
            }

            if (logout) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Session Details</span>
                        <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-sm space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-rose-600 uppercase text-[9px] tracking-widest">User Account</span>
                                    <span className="font-black text-gray-900 text-[13px]">{log.user}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-rose-600 uppercase text-[9px] tracking-widest">Role</span>
                                    <span className="font-bold text-gray-700 text-[12px]">{getFormattedRole(log.role, log.user)}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-rose-100">
                                <span className="font-extrabold text-rose-600 uppercase text-[9px] tracking-widest">Session Status</span>
                                <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-black text-[10px]">
                                    Session Terminated
                                </Badge>
                            </div>
                        </div>
                    </div>
                );
            }

            // Default auth success = login
            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Session Details</span>
                    <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-emerald-600 uppercase text-[9px] tracking-widest">User Account</span>
                                <span className="font-black text-gray-900 text-[13px]">{log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-emerald-600 uppercase text-[9px] tracking-widest">Role</span>
                                <span className="font-bold text-gray-700 text-[12px]">{getFormattedRole(log.role, log.user)}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                            <span className="font-extrabold text-emerald-600 uppercase text-[9px] tracking-widest">Session Status</span>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-black text-[10px]">
                                {loginOk ? 'Active Session' : 'Authentication Event'}
                            </Badge>
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

        if ((module === 'INVENTORY' || actionStr.includes('RESTOCK')) && (actionStr.includes('RESTOCK') || (log.details || '').toLowerCase().includes('stock addition') || (newVals.description || '').toLowerCase().includes('inventory restock'))) {
            const added = newVals.stock_added || newVals.quantity || (newVals.action === 'restock' ? newVals.amount : null) || (log.details || '').match(/(?:added|\+\s*)\s*(\d+(?:\.\d+)?)/i)?.[1];
            const itemName = newVals.item_name || newVals.name || oldVals.item_name || (log.details || '').match(/(?:on|item:?|for)\s*['"]?([^'"]+?)['"]?(?:\s*\(\+|\s*\(| stock|\s*:|$)/i)?.[1] || (newVals.description && newVals.description.includes('of ') ? newVals.description.split('of ').pop() : '') || 'Inventory Item';
            const unit = newVals.unit || oldVals.unit || '';
            const expenseAmt = newVals.expense_amount || (newVals.amount && (log.table === 'Expenses' || log.table === 'expenses' || String(newVals.details || '').includes('expense') || String(log.details || '').includes('expense') || String(log.details || '').includes('Stock Addition')) ? newVals.amount : null);
            const desc = newVals.description || newVals.reason || '';
            const oldStock = oldVals.stock ?? oldVals.stock_quantity;
            const newStock = newVals.stock ?? newVals.stock_quantity;
            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Restock Details</span>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Item Restocked</span>
                            <span className="font-black text-gray-900 text-[14px]">{itemName}</span>
                        </div>
                        {added && (
                            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 flex items-center justify-between">
                                <span className="font-extrabold text-emerald-800 text-[11px] uppercase tracking-wider">Stock Added</span>
                                <span className="font-black text-emerald-700 text-base">+{added}{unit ? ` ${unit}` : ''}</span>
                            </div>
                        )}
                        {oldStock !== undefined && newStock !== undefined && (
                            <div className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                                <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Stock Progression</span>
                                <span className="font-bold text-gray-700">From {oldStock} {unit} to <span className="font-black text-emerald-700">{newStock} {unit}</span></span>
                            </div>
                        )}
                        {expenseAmt && (
                            <div className="flex items-center justify-between py-2 px-3 bg-amber-50/70 rounded-lg border border-amber-100 text-xs">
                                <span className="font-extrabold text-amber-800 uppercase text-[9px] tracking-widest">Recorded Expense</span>
                                <span className="font-black text-amber-800 text-sm">₱{Number(expenseAmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {desc && (
                            <div className="pt-2 border-t border-gray-100">
                                <span className="font-extrabold text-gray-400 uppercase text-[9px] tracking-widest block mb-1">Notes / Description</span>
                                <p className="text-xs font-semibold text-gray-700">{desc}</p>
                            </div>
                        )}
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
                                    <div className="grid grid-cols-2 gap-2 mt-1 min-w-0">
                                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 flex flex-col gap-0.5 min-w-0">
                                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Previous</span>
                                            <span className="text-[12px] font-bold text-slate-700 break-words leading-snug">
                                                {mapBusinessValue(key, oldV)}
                                                {key === 'stock_quantity' && unit ? ` ${unit}` : ''}
                                            </span>
                                        </div>
                                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2 flex flex-col gap-0.5 min-w-0">
                                            <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-700">Updated</span>
                                            <span className="text-[12px] font-black text-emerald-900 break-words leading-snug">
                                                {mapBusinessValue(key, newV)}
                                                {key === 'stock_quantity' && unit ? ` ${unit}` : ''}
                                            </span>
                                        </div>
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

        if (module === 'REPORTS' || actionStr.includes('REPORT') || newVals.report_type) {
            const reportType = newVals.report_type === 'dashboard' ? 'Dashboard Metrics' : (newVals.report_type || 'Sales Report');
            const period = newVals.period_type ? (newVals.period_type.charAt(0).toUpperCase() + newVals.period_type.slice(1)) : 'Daily';
            const durMs = Number(newVals.duration_ms || 0);
            const status = newVals.status || 'SUCCESS';
            const method = newVals.payment_method;

            return (
                <div className="space-y-2.5 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Report Generation & Timing Details</span>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Report Type</span>
                                <span className="font-black text-gray-900 text-[13px] capitalize">{reportType}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Timeframe</span>
                                <Badge className="w-fit bg-red-50 text-red-700 border-red-200 font-black text-[10px] uppercase">
                                    {period}
                                </Badge>
                            </div>
                        </div>

                        {durMs > 0 && (
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Generation Speed</span>
                                    <span className="font-black text-emerald-700 text-[14px]">{durMs} ms</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Computation Status</span>
                                    <Badge className="w-fit bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                        {status}
                                    </Badge>
                                </div>
                            </div>
                        )}

                        {method && method !== 'all' && (
                            <div className="pt-2 border-t border-gray-100 flex flex-col gap-0.5">
                                <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Payment Method Filter</span>
                                <span className="font-bold text-gray-800 text-[12px] uppercase">{method}</span>
                            </div>
                        )}

                        <div className="pt-2 border-t border-gray-100">
                            <span className="font-extrabold text-gray-400 uppercase text-[9px] tracking-widest block mb-0.5">Audit Note</span>
                            <p className="text-xs font-semibold text-gray-700 leading-snug">{log.details || 'On-screen report metrics generated successfully.'}</p>
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
                            {(newVals.order_date || newVals.order_time || newVals.encoding_time || newVals.efficiency_vs_paper) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                                    {(newVals.order_date || newVals.order_time) && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-extrabold text-slate-500 uppercase text-[9px] tracking-widest">Date & Time Received</span>
                                            <span className="font-black text-slate-900 text-[12px]">
                                                {newVals.order_date || '—'} {newVals.order_time ? `@ ${newVals.order_time}` : ''}
                                            </span>
                                        </div>
                                    )}
                                    {(newVals.encoding_time || newVals.efficiency_vs_paper) && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-extrabold text-slate-500 uppercase text-[9px] tracking-widest">Intake Duration</span>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {(newVals.encoding_time || newVals.efficiency_vs_paper) && (
                                                    <span className="font-black text-emerald-700 text-[12px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                        {newVals.encoding_time || newVals.efficiency_vs_paper}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {(newVals.shoes || newVals.services || newVals.items_count || newVals.items || newVals.discount) && (
                        <div className="space-y-2.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Footwear & Service Details</span>
                            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2.5">
                                {(newVals.shoes || newVals.items) && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">
                                            Shoe Items ({newVals.shoes_count || newVals.items_count || 1} Pair{(newVals.shoes_count || newVals.items_count || 1) > 1 ? 's' : ''})
                                        </span>
                                        <div className="font-medium text-gray-800 text-[12px] leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100 whitespace-pre-line font-sans">
                                            {typeof newVals.shoes === 'string' ? newVals.shoes : (Array.isArray(newVals.items) ? newVals.items.map((it: any, i: number) => {
                                                const brand = it.brand || it.brand_name || '';
                                                const model = it.shoeModel || it.shoe_model || it.model || '';
                                                const size = it.shoeSize || it.shoe_size || it.size ? `Size: ${it.shoeSize || it.shoe_size || it.size}` : '';
                                                const color = it.color ? `Color: ${it.color}` : '';
                                                const srv = it.baseService || it.services ? `Services: ${Array.isArray(it.baseService || it.services) ? (it.baseService || it.services).join(', ') : it.baseService || it.services}` : '';
                                                return `Pair #${i + 1}: ${[brand, model, size, color, srv].filter(Boolean).join(' • ')}`;
                                            }).join('\n') : String(newVals.shoes || '—'))}
                                        </div>
                                    </div>
                                )}
                                {newVals.services && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Services Applied</span>
                                        <span className="font-black text-red-700 text-[12px]">{Array.isArray(newVals.services) ? newVals.services.join(', ') : newVals.services}</span>
                                    </div>
                                )}
                                {newVals.discount != null && Number(newVals.discount) > 0 && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Discount Applied</span>
                                        <span className="font-black text-emerald-700 text-[12px]">-₱{formatCurrency(newVals.discount)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {(newVals.shipping_preference || newVals.shippingPreference || newVals.delivery_address || newVals.deliveryAddress) && (
                        <div className="space-y-2.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Fulfillment Details</span>
                            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Fulfillment Type</span>
                                        <span className="font-black text-gray-800 text-[12px] uppercase">{newVals.shipping_preference || newVals.shippingPreference || 'Pickup'}</span>
                                    </div>
                                    {(newVals.delivery_courier || newVals.deliveryCourier) && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Courier</span>
                                            <span className="font-bold text-gray-700 text-[12px]">{newVals.delivery_courier || newVals.deliveryCourier}</span>
                                        </div>
                                    )}
                                </div>
                                {(newVals.delivery_address || newVals.deliveryAddress) && (
                                    <div className="flex flex-col gap-0.5 pt-1.5 border-t border-gray-100">
                                        <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Delivery Address</span>
                                        <span className="font-medium text-gray-700 text-[12px]">{newVals.delivery_address || newVals.deliveryAddress}</span>
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
                                placeholder="Search username, role, action, module, date..."
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
                            className={`relative h-9 w-9 p-0 rounded-xl transition-all flex-shrink-0 flex items-center justify-center shadow-sm
                                ${((selectedUser !== 'all' ? 1 : 0) + (selectedType !== 'all' ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)) > 0 
                                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100' 
                                    : 'border-gray-200 text-gray-600 hover:border-red-600 hover:text-red-600 hover:bg-red-50'}`}
                            onClick={() => setIsFilterOpen(true)}
                            title="Open filters"
                            aria-label="Open filters"
                        >
                            <Filter className="h-4 w-4 stroke-[2.5]" />
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
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Module</th>
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
                                        const moduleName = getModuleBadge(activity);
                                        const roleName = getFormattedRole(activity.role, activity.user);

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
                                                    <div className="flex flex-col items-center justify-center">
                                                        <Badge variant="outline" className={
                                                            `font-black uppercase text-[10px] tracking-wider px-2.5 py-0.5 rounded-md border 
                                                            ${moduleName === 'Service Management' || moduleName === 'Services' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                                              moduleName === 'Inventory Management' || moduleName === 'Inventory' ? 'border-purple-200 text-purple-700 bg-purple-50' :
                                                              moduleName === 'Expenses' ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                                              moduleName === 'User Management' || moduleName === 'Users' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                                                              moduleName === 'Authentication' ? 'border-cyan-200 text-cyan-700 bg-cyan-50' :
                                                              moduleName === 'Sales Report' || moduleName === 'Reports' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' :
                                                              moduleName === 'Machine Learning' ? 'border-pink-200 text-pink-700 bg-pink-50' :
                                                              moduleName === 'Dashboard' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                                                              moduleName === 'Release Calendar' ? 'border-teal-200 text-teal-700 bg-teal-50' :
                                                              moduleName === 'Job Order Form' || moduleName === 'Job Orders' ? 'border-red-200 text-red-700 bg-red-50' :
                                                              'border-slate-200 text-slate-700 bg-slate-50'}`
                                                        }>
                                                            {moduleName}
                                                        </Badge>
                                                    </div>
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
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Activity Summary</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-1">
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">User / Role</span>
                                            <span className="text-[13px] font-bold text-slate-800 leading-tight truncate">
                                                <span className="text-red-600 font-black">{selectedLog.user}</span> <span className="text-slate-500 font-medium">({getFormattedRole(selectedLog.role, selectedLog.user)})</span>
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Date & Time</span>
                                            <span className="text-[13px] font-bold text-slate-800 leading-tight">
                                                {normalizeDate(selectedLog.timestamp)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-2 border-t border-slate-100 pt-3 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Action</span>
                                            <span className="text-[13px] font-black text-slate-800 leading-tight">
                                                {getBusinessActionTitle(selectedLog)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-2 border-t border-slate-100 pt-3 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Module</span>
                                            <span className="text-[13px] font-black text-slate-800 leading-tight">
                                                {getModuleBadge(selectedLog)}
                                            </span>
                                        </div>
                                        <div className="col-span-2 flex flex-col gap-0.5 mt-1 border-t border-slate-100 pt-2 min-w-0">
                                            <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Affected Record</span>
                                            <span className="text-[13px] font-black text-slate-800 leading-tight break-all break-words">
                                                {getAffectedRecordLabel(selectedLog)}
                                            </span>
                                        </div>
                                        {(() => {
                                            const rawId = selectedLog.newValues?.order_number ||
                                                selectedLog.oldValues?.order_number ||
                                                selectedLog.newValues?.orderNumber ||
                                                selectedLog.oldValues?.orderNumber ||
                                                (String(selectedLog.recordId || '').startsWith('ORD-') ? String(selectedLog.recordId) : null) ||
                                                (String(selectedLog.details || '').match(/ORD-[A-Za-z0-9-]+/i)?.[0]) ||
                                                (String(getAffectedRecordLabel(selectedLog)).match(/ORD-[A-Za-z0-9-]+/i)?.[0]);
                                            if (!rawId) return null;
                                            const ordDt = parseDateFromOrderId(rawId);
                                            if (!ordDt || isNaN(ordDt.getTime())) return null;
                                            return (
                                                <div className="col-span-2 flex flex-col gap-1 mt-1 border-t border-slate-100 pt-2.5 min-w-0 bg-red-50/50 p-2.5 rounded-lg border border-red-100">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-extrabold text-red-600 uppercase text-[9px] tracking-widest">Original Order Date (Authoritative)</span>
                                                        <span className="font-mono text-xs font-black text-slate-700">{rawId}</span>
                                                    </div>
                                                    <span className="text-[13px] font-bold text-slate-900 leading-tight">
                                                        {ordDt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Activity Details & Notes INSIDE View Activity History Logs Modal */}
                                    {(() => {
                                        const rawDetails = selectedLog.details || 
                                            (selectedLog.newValues && typeof selectedLog.newValues === 'object' && selectedLog.newValues.details) || 
                                            (selectedLog.oldValues && typeof selectedLog.oldValues === 'object' && selectedLog.oldValues.details) || '';
                                        if (!rawDetails) return null;
                                        let cleanDetails = String(rawDetails);
                                        cleanDetails = cleanDetails
                                            .replace(/\(saved;\s*no field value changes detected\)/gi, '(Profile verified, no changes detected)')
                                            .replace(/Password Changed:\s*\(new\)\s*Yes/gi, 'Password Changed Successfully')
                                            .replace(/Password Changed:\s*Yes/gi, 'Password Changed Successfully')
                                            .replace(/Password Changed:\s*\(new\)\s*No/gi, 'Password: No Change')
                                            .replace(/Password Changed:\s*No/gi, 'Password: No Change');
                                        return (
                                            <div className="mt-1 pt-3 border-t border-slate-200 flex flex-col gap-1.5 min-w-0">
                                                <span className="font-extrabold text-slate-500 uppercase text-[9px] tracking-widest flex items-center gap-1.5">
                                                    <FileText size={12} className="text-red-500" /> Activity Details & Notes
                                                </span>
                                                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 leading-relaxed shadow-2xs break-words">
                                                    {cleanDetails}
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
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

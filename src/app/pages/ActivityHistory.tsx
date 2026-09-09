import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Eye, ShieldAlert, ShoppingCart, Package, Key, Printer, Tag, Users, Activity } from 'lucide-react';
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
        if (action.includes('LOGIN') || action.includes('LOGOUT') || action.includes('PASSWORD')) return 'Authentication';
        if (type === 'reports' || action === 'PRINT') return 'Reports';
        if (type === 'system' || activity.table === 'Users') return 'User Management';
        if (type === 'ml' || action.includes('PREDICT') || action.includes('TRAIN')) return 'Machine Learning';
        return activity.table || 'System';
    };

    const getBusinessActionTitle = (activity: ActivityLog) => {
        const action = activity.action.toUpperCase();
        const actionRaw = (activity.actionRaw || '').toUpperCase();
        const type = (activity.type || '').toLowerCase();
        
        // Priority 1: Explicit DELETE actions
        if (action.includes('DELETE') || actionRaw.includes('DELETE') || action.includes('DEACTIVATE')) {
            if (type === 'inventory' || activity.table === 'Inventory' || activity.table === 'inventory') return 'Inventory Deleted';
            if (type === 'service' || activity.table === 'Services' || activity.table === 'services') return 'Service Deleted';
            if (type === 'order' || activity.table === 'Orders' || activity.table === 'Job Orders') return 'Job Order Deleted';
            if (type === 'expense' || activity.table === 'Expenses' || activity.table === 'expenses') return 'Expense Deleted';
            if (activity.module === 'Historical Records' || activity.table === 'Historical Records') return 'Historical Record Deleted';
            if (type === 'system' || activity.table === 'Users' || activity.table === 'users') return 'User Deleted';
            return 'Record Deleted';
        }

        if (action.includes('404') || actionRaw.includes('404')) return 'Page Not Found';
        if (action.includes('FAILED') || actionRaw.includes('FAILED')) return 'Failed Login';
        if (action.includes('TIMEOUT') || actionRaw.includes('TIMEOUT')) return 'Session Timeout';
        if (action.includes('LOGIN')) return 'User Logged In';
        if (action.includes('LOGOUT')) return 'User Logged Out';
        
        if (action.includes('RESTOCK') || activity.details.toLowerCase().includes('restock')) return 'Inventory Restocked';
        
        if (action.includes('PRINT') || type === 'reports') return 'Report Generated';
        if (type === 'inventory' && (action.includes('DEDUCT') || action.includes('UPDATE'))) return 'Inventory Updated';
        if (type === 'inventory' && action.includes('CREATE')) return 'Inventory Added';
        if (type === 'order' || activity.table === 'Orders' || activity.table === 'Job Orders') {
            if (action.includes('CREATE')) return 'New Job Order';
            if (activity.newValues?.status === 'claimed') return 'Order Claimed';
            if (activity.newValues?.status === 'for-release') return 'Order Ready For Release';
            return 'Job Order Updated';
        }
        if (type === 'service' || activity.table === 'Services') {
            if (action.includes('CREATE')) return 'Service Created';
            return 'Service Updated';
        }
        if (type === 'system' || activity.table === 'Users') {
            if (action.includes('CREATE')) return 'User Created';
            return 'User Updated';
        }

        return activity.action;
    };

    const getActionIcon = (title: string) => {
        const t = title.toUpperCase();
        if (t.includes('JOB ORDER') || t.includes('CLAIMED') || t.includes('RELEASE')) return <ShoppingCart className="w-3.5 h-3.5" />;
        if (t.includes('INVENTORY') || t.includes('RESTOCK')) return <Package className="w-3.5 h-3.5" />;
        if (t.includes('LOGIN') || t.includes('LOGOUT') || t.includes('PASSWORD')) return <Key className="w-3.5 h-3.5" />;
        if (t.includes('SERVICE')) return <Tag className="w-3.5 h-3.5" />;
        if (t.includes('REPORT')) return <Printer className="w-3.5 h-3.5" />;
        if (t.includes('USER')) return <Users className="w-3.5 h-3.5" />;
        return <Activity className="w-3.5 h-3.5" />;
    };

    const getActionBadge = (activity: ActivityLog) => {
        const actStr = getBusinessActionTitle(activity);
        const actUpper = actStr.toUpperCase();
        let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
        if (actUpper.includes('NEW') || actUpper.includes('CREATED') || actUpper.includes('ADDED') || actUpper.includes('LOGGED IN')) {
            colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (actUpper.includes('UPDATE') || actUpper.includes('RESTOCK') || actUpper.includes('GENERATED') || actUpper.includes('EDIT')) {
            colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        } else if (actUpper.includes('DELETE') || actUpper.includes('OUT') || actUpper.includes('FAILED') || actUpper.includes('CANCEL')) {
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

    // Deduplicate activities to handle potential React Strict Mode double-logs
    // (Removed at user request: Audit trails should be append-only in the UI)
    
    // Filtering logic
    const filteredActivities = activities.filter(activity => {
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
        const matchesType = selectedType === 'all' || 
            activityMod === selectedType.toLowerCase() || 
            activity.type?.toLowerCase() === selectedType.toLowerCase();

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
        
        const ignoredKeys = new Set(['id', 'order_id', 'item_id', 'user_id', 'customer_id', 'created_at', 'updated_at', 'history', 'items', 'inventory_used', 'inventoryused', '_id', 'token', 'password', 'ordernumber', 'order_number', 'updater_id', 'updaterid', 'inventoryapplied', 'inventory_applied', 'last_modified', 'is_retail', 'isretail', 'sync_version', 'modifier', 'record_id']);

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

        const mapBusinessValue = (key: string, val: any): string => {
            if (val === true || val === 'true') return 'Yes';
            if (val === false || val === 'false') return 'No';
            if (val === null || val === undefined || val === '' || val === 'Empty') return '— Not Set';
            if (typeof val === 'string' && val.toLowerCase() === 'empty') return '— Not Set';

            const lowerKey = key.toLowerCase();
            if (lowerKey === 'is_active' || lowerKey === 'was_active') {
                if (val === true || val === 'true' || val === 1) return 'Active';
                if (val === false || val === 'false' || val === 0) return 'Inactive';
            }
            if (lowerKey === 'soft_delete') {
                return (val === true || val === 'true') ? 'Yes (kept in database)' : 'No';
            }
            if (Array.isArray(val)) {
                if (val.length === 0) return '— None';
                return val.map((entry) => {
                    if (entry == null) return '—';
                    if (typeof entry === 'object') {
                        return entry.name || entry.item_name || entry.service_name || entry.label || JSON.stringify(entry);
                    }
                    return String(entry);
                }).join(', ');
            }
            if (typeof val === 'object') {
                const preferred =
                    val.name || val.item_name || val.service_name || val.username ||
                    val.customer_name || val.order_number || val.label || val.details;
                if (preferred != null && preferred !== '') return String(preferred);
                try {
                    return Object.entries(val)
                        .filter(([k]) => !['id', 'password', 'token'].includes(String(k).toLowerCase()))
                        .map(([k, v]) => `${mapBusinessLabel(k)}: ${mapBusinessValue(k, v)}`)
                        .join(' · ');
                } catch {
                    return '—';
                }
            }
            
            if (lowerKey.includes('price') || lowerKey.includes('total') || lowerKey.includes('amount') || lowerKey.includes('cost')) {
                return String(formatCurrency(val));
            }
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
                    if (typeof v === 'string') return v.trim();
                    if (typeof v === 'number') return String(v);
                    if (typeof v === 'boolean') return String(v);
                    return v;
                };

                const normOld = normalizeValue(item.oldVal);
                const normNew = normalizeValue(item.newVal);

                if (normOld === null && normNew === null) return false;
                return JSON.stringify(normOld) !== JSON.stringify(normNew);
            });

            if (changedItems.length === 0) {
                return (
                    <div className="bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200 text-center mt-3">
                        <span className="text-[11px] font-bold text-gray-500 italic">No user-visible business changes were made.</span>
                    </div>
                );
            }

            const sections = {
                'Order Information': ['status', 'priorityLevel', 'predictedCompletionDate', 'transactionDate', 'inventoryApplied'],
                'Shoe Information': ['brand', 'shoeModel', 'shoeMaterial', 'shoeSize', 'color', 'condition', 'quantity'],
                'Service Information': ['baseService', 'addOns'],
                'Customer Information': ['customerName', 'contactNumber'],
                'Delivery Information': ['shippingPreference', 'deliveryAddress', 'deliveryCourier', 'releaseTime', 'province', 'city', 'barangay', 'zipCode'],
                'Payment Information': ['grandTotal', 'amountReceived', 'balance', 'paymentMethod', 'paymentStatus', 'referenceNo', 'depositAmount']
            };

            const groupedChanges: { [key: string]: typeof changedItems } = {
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
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                    {items.map(({ label, oldVal, newVal }) => (
                                        <div key={label} className="flex flex-col gap-1 pb-2.5 border-b border-gray-100 last:border-0 last:pb-0">
                                            <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">{mapBusinessLabel(label)}</span>
                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                <span className="text-[13px] font-black text-rose-700/80 line-through decoration-rose-300 decoration-2">
                                                    {mapBusinessValue(label, oldVal)}
                                                </span>
                                                <div className="flex items-center gap-2 text-[13px] font-black text-gray-900">
                                                    <span className="text-gray-300">↳</span>
                                                    <span className="text-emerald-700">{mapBusinessValue(label, newVal)}</span>
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
            const added = newVals.stock_added || newVals.quantity || log.details.match(/added (\d+)/i)?.[1] || 0;
            const itemName = newVals.item_name || newVals.name || log.details.match(/Restocked\s*(.*?)\s*:/)?.[1] || 'Inventory Item';
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Restocked: {itemName}</span>
                    <div className="flex items-center gap-3 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                        <span className="text-[14px] font-black text-emerald-700">+{added}</span>
                        <div className="flex items-center gap-2 text-[12px] font-bold text-gray-600 border-l border-emerald-200 pl-3">
                            <span className="line-through text-gray-400">{mapBusinessValue('stock', oldVals.stock || oldVals.stock_quantity || 0)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-gray-800">{mapBusinessValue('stock', newVals.stock || newVals.stock_quantity || 0)}</span>
                        </div>
                    </div>
                </div>
            );
        } else if (module === 'INVENTORY' && (actionStr.includes('CONSUME') || log.details.toLowerCase().includes('deduct'))) {
            const used = newVals.quantity_used || log.details.match(/deducted (\d+)/i)?.[1] || 0;
            const itemName = newVals.item_name || newVals.name || log.details.match(/from\s*(.*?)(\.|$)/i)?.[1] || 'Inventory Item';
            eventSummary = (
                <div className="mb-4 space-y-1.5">
                    <span className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Material Consumed: {itemName}</span>
                    <div className="flex items-center gap-3 bg-amber-50 p-2.5 rounded-xl border border-amber-100 shadow-sm">
                        <span className="text-[14px] font-black text-amber-700">−{used}</span>
                        <div className="flex items-center gap-2 text-[12px] font-bold text-gray-600 border-l border-amber-200 pl-3">
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
            if (actionStr.includes('FAILED')) {
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
                                <span className="font-black text-[13px] text-red-700">Failed</span>
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

            if (actionStr.includes('TIMEOUT')) {
                return (
                    <div className="space-y-2.5 mt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Session Expired</span>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm space-y-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-amber-600 uppercase text-[9px] tracking-widest">User</span>
                                <span className="font-black text-amber-900 text-[13px]">{log.user}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <span className="font-extrabold text-amber-600 uppercase text-[9px] tracking-widest">Reason</span>
                                <span className="font-black text-[13px] text-amber-700">Session timed out due to inactivity.</span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-amber-200">
                                <span className="font-extrabold text-amber-600 uppercase text-[9px] tracking-widest">Action Required</span>
                                <span className="font-black text-[13px] text-amber-900">Please log in again.</span>
                            </div>
                        </div>
                    </div>
                );
            }

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
                            <span className="font-black text-[13px] text-emerald-600">Successful {actionStr.includes('LOGOUT') ? 'Logout' : 'Login'}</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (module === 'INVENTORY' && actionStr.includes('RESTOCK')) {
            const added = newVals.stock_added || newVals.quantity || log.details.match(/added (\d+)/i)?.[1];
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

        if (actionStr.includes('DELETE') || actionStr.includes('DEACTIVAT')) {
            const deletedVals = { ...oldVals };
            if (newVals?.is_active === false) deletedVals.status_after = 'Inactive (soft delete)';
            if (newVals?.soft_delete) deletedVals.removal_type = 'Removed from catalog (record kept for history)';
            if (newVals?.reason) deletedVals.reason = newVals.reason;
            if (newVals?.details && typeof newVals.details === 'string') deletedVals.summary = newVals.details;
            const title = newVals?.soft_delete || newVals?.is_active === false || actionStr.includes('DEACTIVAT')
                ? 'Removed Record Details'
                : 'Deleted Record Details';
            return (
                <div className="space-y-2.5 mt-2">
                    {log.details && (
                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-[12px] font-bold text-rose-800">
                            {log.details}
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
        } else if (actionStr.includes('DELETE') || (log.action && log.action.toUpperCase() === 'DELETE')) {
            mainContent = renderFieldList(oldVals, 'Deleted Record Details');
        } else if (Object.keys(oldVals).length > 0 && Object.keys(newVals).length > 0) {
            mainContent = renderDiffList();
        } else if (Object.keys(newVals).length > 0) {
            mainContent = renderFieldList(newVals, 'Updated Values');
        }

        if (!eventSummary && !mainContent) return null;

        return (
            <>
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
                            className={`h-9 px-3 rounded-xl transition-all flex-shrink-0 font-bold text-xs flex items-center gap-1.5 shadow-sm
                                ${selectedUser !== 'all' || selectedType !== 'all' || startDate || endDate 
                                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100' 
                                    : 'border-gray-200 text-gray-600 hover:border-red-600 hover:text-red-600 hover:bg-red-50'}`}
                            onClick={() => setIsFilterOpen(true)}
                            title="Open filters"
                        >
                            <Filter className="h-4 w-4 stroke-[2.5]" />
                            <span>Filters</span>
                            {(selectedUser !== 'all' || selectedType !== 'all' || startDate || endDate) && (
                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            )}
                        </Button>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 overflow-y-hidden no-scrollbar">
                        <table className="w-full min-w-[700px]">
                            <thead className="bg-red-50 border-y border-red-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">User / Role</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Action</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Module / Table</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Details</th>
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
                                    paginatedActivities.map((activity) => {
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
                                                <td className="px-4 py-3.5 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-extrabold text-gray-900 uppercase tracking-tight block">
                                                            {activity.user}
                                                        </span>
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                                                            Role: {roleName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-left">
                                                    {getActionBadge(activity)}
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
                                                <td className="px-4 py-3.5 text-center">
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRowClick(activity);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all border border-red-200 shadow-xs"
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
                <DialogContent className="max-w-[500px] bg-white rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    {/* Header - RED STORED THEME */}
                    <div className="bg-[#D92D20] px-6 py-5 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white">
                            <div className="p-1.5 bg-white/20 rounded-xl border border-white/20">
                                {getActionIcon(selectedLog ? getBusinessActionTitle(selectedLog) : '')}
                            </div>
                            <h2 className="text-white text-[15px] font-black uppercase tracking-widest m-0 leading-none">
                                {selectedLog ? getBusinessActionTitle(selectedLog) : 'Audit Record'}
                            </h2>
                        </div>
                    </div>

                    {selectedLog && (
                        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            {/* Summary Banner */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-2">Activity Summary</span>
                                <div className="grid grid-cols-2 gap-4 mt-1">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Performed By</span>
                                        <span className="text-[13px] font-bold text-slate-800 leading-tight">
                                            <span className="text-red-600 font-black">{selectedLog.user}</span> <span className="text-slate-500 font-medium">({(selectedLog.role || (selectedLog.user.toLowerCase() === 'owner' ? 'owner' : 'staff')).replace(/^\w/, (c) => c.toUpperCase())})</span>
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Date & Time</span>
                                        <span className="text-[13px] font-bold text-slate-800 leading-tight">
                                            {selectedLog.timestamp}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 mt-2 border-t border-slate-100 pt-3">
                                        <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Action</span>
                                        <span className="text-[13px] font-black text-slate-800 leading-tight">
                                            {getBusinessActionTitle(selectedLog)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 mt-2 border-t border-slate-100 pt-3">
                                        <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest">Affected Record</span>
                                        <span className="text-[13px] font-black text-slate-800 leading-tight">
                                            {selectedLog.oldValues?.username || selectedLog.newValues?.username || selectedLog.oldValues?.order_number || selectedLog.newValues?.order_number || selectedLog.oldValues?.orderNumber || selectedLog.newValues?.orderNumber || selectedLog.oldValues?.item_name || selectedLog.newValues?.item_name || selectedLog.oldValues?.service_name || selectedLog.newValues?.service_name || (String(selectedLog.newValues?.details || selectedLog.details || '').match(/(?:for|account for)\s+([A-Za-z0-9_.-]+)/i)?.[1]) || selectedLog.recordId || 'N/A'}
                                        </span>
                                    </div>
                                </div>
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
                                            <span className="text-[10px] font-bold text-gray-800">{selectedLog.recordId || selectedLog.id || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-extrabold text-gray-400 uppercase">Audit ID</span>
                                            <span className="text-[10px] font-bold text-gray-800">{selectedLog.id}</span>
                                        </div>
                                        {selectedLog.details && 
                                         !selectedLog.details.includes('Updated item') && 
                                         !selectedLog.details.includes('Restocked') && 
                                         !selectedLog.details.includes('Logged in successfully') &&
                                         !selectedLog.details.includes('Logged out successfully') && (
                                            <div className="pt-2 border-t border-gray-200/50 mt-2">
                                                <span className="text-[9px] font-extrabold text-gray-400 uppercase block mb-1">Raw Trace</span>
                                                <span className="text-[10px] font-medium text-gray-600 block leading-tight">{selectedLog.details}</span>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Eye, Clock, User as UserIcon, ShieldAlert, Globe, ShieldCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

import { useActivities, type ActivityLog } from '@/app/context/ActivityContext';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173'))
    ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:8000/api`
    : '/api';

/**
 * COMPONENT: ActivityHistory
 * PURPOSE: Displays a list of system-wide activities (Audit Trail).
 * DATA SOURCE: ActivityContext (Synced with AuditLog backend table).
 */
function FormattedDateInput({ value, onChange, className, id }: { value: string; onChange: (val: string) => void; className?: string; id?: string }) {
    const toDisplay = (iso: string) => {
        if (!iso) return '';
        const parts = iso.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return iso;
    };

    const [localVal, setLocalVal] = useState(toDisplay(value));

    useEffect(() => {
        setLocalVal(toDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputVal = e.target.value;
        let digits = inputVal.replace(/[^0-9]/g, '');
        if (digits.length > 8) digits = digits.substring(0, 8);

        let formatted = digits;
        if (digits.length > 2) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2);
        }
        if (digits.length > 4) {
            formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4);
        }

        setLocalVal(formatted);

        if (digits.length === 8) {
            const mm = digits.substring(0, 2);
            const dd = digits.substring(2, 4);
            const yyyy = digits.substring(4, 8);
            const iso = `${yyyy}-${mm}-${dd}`;
            const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            if (!isNaN(dateObj.getTime())) {
                onChange(iso);
            }
        }
    };

    return (
        <Input
            id={id}
            type="text"
            placeholder="MM/DD/YYYY"
            value={localVal}
            onChange={handleChange}
            className={className}
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
    const { activities } = useActivities();
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

    const getActionBadge = (action: string) => {
        const act = action.toUpperCase();
        let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
        if (act.includes('CREATE') || act === 'LOGIN' || act === 'RESTORE' || act === 'APPROVE') {
            colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (act.includes('UPDATE') || act === 'PRINT') {
            colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        } else if (act.includes('DELETE') || act === 'LOGOUT' || act === 'LOGIN_FAILED' || act === 'CANCEL') {
            colorClass = "bg-rose-50 text-rose-700 border-rose-200";
        } else if (act.includes('PASSWORD') || act === 'PASSWORD_RESET') {
            colorClass = "bg-purple-50 text-purple-700 border-purple-200";
        }
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase border tracking-wide ${colorClass}`}>
                {action}
            </span>
        );
    };

    // --- OWASP A01: Broken Access Control (Enforce Owner ONLY) ---
    if (user.role && user.role !== 'owner') {
        return (
            <div className="py-8 flex items-center justify-center min-h-[500px] animate-in fade-in duration-500">
                <Card className="border-2 border-red-200 shadow-xl max-w-md w-full bg-white rounded-2xl overflow-hidden text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-black">
                        <ShieldAlert size={36} />
                    </div>
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider mb-2">403 Unauthorized Access</h2>
                    <p className="text-xs font-medium text-gray-600 leading-relaxed mb-6">
                        Only the Owner account has security clearance to inspect Activity History and Forensic Audit Logs. Staff accounts are explicitly restricted.
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

    // Filtering logic
    const filteredActivities = activities.filter(activity => {
        // Search Filter across username, full name, action, module, table, record id, details, role
        const searchStr = searchTerm.toLowerCase().trim();
        const mod = getModuleBadge(activity).toLowerCase();
        const role = (activity.role || (activity.user.toLowerCase() === 'owner' ? 'owner' : 'staff')).toLowerCase();
        const recId = String(activity.recordId || activity.id || '').toLowerCase();

        const matchesSearch = !searchStr || (
            activity.user.toLowerCase().includes(searchStr) ||
            activity.action.toLowerCase().includes(searchStr) ||
            (activity.table && activity.table.toLowerCase().includes(searchStr)) ||
            activity.details.toLowerCase().includes(searchStr) ||
            mod.includes(searchStr) ||
            role.includes(searchStr) ||
            recId.includes(searchStr)
        );

        // User Filter
        const matchesUser = selectedUser === 'all' || activity.user.toLowerCase() === selectedUser.toLowerCase();

        // Type/Module Filter
        const activityMod = getModuleBadge(activity).toLowerCase();
        const matchesType = selectedType === 'all' || 
            activityMod === selectedType.toLowerCase() || 
            activity.type?.toLowerCase() === selectedType.toLowerCase() ||
            (selectedType === 'User Management' && activity.type === 'system') ||
            (selectedType === 'Job Orders' && (activity.table === 'Orders' || activity.type === 'order'));

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

    const renderFormattedDiff = (log: ActivityLog) => {
        const oldVals = log.oldValues;
        const newVals = log.newValues;

        if (!oldVals && !newVals) {
            return (
                <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 text-center">
                    <span className="text-[11px] font-bold text-gray-500 italic">No field modifications recorded for this event</span>
                </div>
            );
        }

        // Handle CREATE (New record)
        if (!oldVals && newVals && typeof newVals === 'object') {
            return (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Data Created (Before vs After)
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 flex items-center justify-center">
                            <span className="text-xs font-black italic text-rose-500 uppercase tracking-wider">None (New Record)</span>
                        </div>
                        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 space-y-1.5">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block border-b border-emerald-200 pb-1 mb-1">
                                Created Record Values
                            </span>
                            {Object.entries(newVals).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-[11px]">
                                    <span className="font-extrabold text-emerald-900 uppercase text-[10px]">{k}:</span>
                                    <span className="font-mono font-bold text-emerald-950 bg-white px-1.5 py-0.5 rounded border border-emerald-100">{String(v ?? 'N/A')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        // Handle UPDATE (Both exist)
        if (oldVals && newVals && typeof oldVals === 'object' && typeof newVals === 'object') {
            const allKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]));
            const changedKeys = allKeys.filter(k => JSON.stringify(oldVals[k]) !== JSON.stringify(newVals[k]));

            if (changedKeys.length === 0) {
                return (
                    <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 text-center">
                        <span className="text-[11px] font-bold text-gray-500 italic">No specific property diff found (Timestamp or background metadata update)</span>
                    </div>
                );
            }

            return (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Changed Fields (Before vs After)
                    </span>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        {changedKeys.map(k => (
                            <div key={k} className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-slate-200/60 last:border-0 gap-2">
                                <span className="font-extrabold text-slate-700 uppercase text-xs tracking-wide">{k}</span>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="line-through font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                                        {String(oldVals[k] ?? 'Empty')}
                                    </span>
                                    <span className="text-gray-400 font-black">➔</span>
                                    <span className="font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                                        {String(newVals[k] ?? 'Empty')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Handle DELETE or fallback
        return (
            <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                    Data Changes (Before vs After)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100">
                        <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider block mb-1">
                            Previous Values (Old State)
                        </span>
                        {oldVals ? (
                            <pre className="text-[10px] font-mono text-rose-900 bg-white p-2 rounded border border-rose-100 overflow-x-auto whitespace-pre-wrap">
                                {typeof oldVals === 'object' ? JSON.stringify(oldVals, null, 2) : String(oldVals)}
                            </pre>
                        ) : (
                            <span className="text-[11px] italic text-rose-400">None</span>
                        )}
                    </div>
                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block mb-1">
                            Updated Values (New State)
                        </span>
                        {newVals ? (
                            <pre className="text-[10px] font-mono text-emerald-900 bg-white p-2 rounded border border-emerald-100 overflow-x-auto whitespace-pre-wrap">
                                {typeof newVals === 'object' ? JSON.stringify(newVals, null, 2) : String(newVals)}
                            </pre>
                        ) : (
                            <span className="text-[11px] italic text-emerald-600 font-black">None (Record Deleted)</span>
                        )}
                    </div>
                </div>
            </div>
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
                                placeholder="Search username, role, action, module, table, ID, or details..."
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
                                                    {getActionBadge(activity.action)}
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
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const pageNum = i + 1;
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
                                {totalPages > 5 && <span className="text-gray-400 px-1 font-black">...</span>}
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
                                                {u.username} ({u.role})
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

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Date Range</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <FormattedDateInput 
                                        value={startDate} 
                                        onChange={val => { setStartDate(val); setCurrentPage(1); }}
                                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 font-bold text-gray-800 focus:ring-red-100 text-[12px]"
                                    />
                                    <span className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-500 uppercase border border-gray-200 rounded">Start Date</span>
                                </div>
                                <div className="relative">
                                    <FormattedDateInput 
                                        value={endDate} 
                                        onChange={val => { setEndDate(val); setCurrentPage(1); }}
                                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 font-bold text-gray-800 focus:ring-red-100 text-[12px]"
                                    />
                                    <span className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-500 uppercase border border-gray-200 rounded">End Date</span>
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
                <DialogContent className="max-w-[620px] bg-white rounded-[1.5rem] border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-red-600 px-6 py-4 flex items-center">
                        <div className="flex items-center gap-2 text-white">
                            <ShieldCheck size={22} className="stroke-[2.5]" />
                            <h2 className="text-white text-sm font-black uppercase tracking-wider m-0">
                                Audit Record #{selectedLog?.id || ''}
                            </h2>
                        </div>
                    </div>

                    {selectedLog && (
                        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {/* Key Audit Attributes Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/80 p-4 rounded-xl border border-gray-200/80">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <UserIcon size={12} className="text-red-600" /> Performed By
                                    </span>
                                    <span className="text-xs font-black text-gray-900 uppercase block truncate">
                                        {selectedLog.user}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <ShieldCheck size={12} className="text-emerald-600" /> Role
                                    </span>
                                    <span className="text-xs font-black text-gray-900 uppercase block">
                                        {selectedLog.role || (selectedLog.user.toLowerCase() === 'owner' ? 'owner' : 'staff')}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Clock size={12} className="text-blue-600" /> Timestamp
                                    </span>
                                    <span className="text-xs font-bold text-gray-900 block">
                                        {selectedLog.timestamp}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Globe size={12} className="text-purple-600" /> IP Address
                                    </span>
                                    <span className="text-xs font-mono font-bold text-gray-800 block truncate">
                                        {selectedLog.ip_address || 'Local Session'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Module</span>
                                    <span className="text-xs font-black text-slate-800 uppercase block">{getModuleBadge(selectedLog)}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Target Table</span>
                                    <span className="text-xs font-black text-slate-800 uppercase block">{selectedLog.table || getModuleBadge(selectedLog)}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Record ID</span>
                                    <span className="text-xs font-mono font-black text-red-600 block">
                                        {(selectedLog.table?.toLowerCase() === 'authentication' || selectedLog.table?.toLowerCase() === 'system' || getModuleBadge(selectedLog).toLowerCase() === 'authentication' || getModuleBadge(selectedLog).toLowerCase() === 'system' || !selectedLog.recordId) ? 'N/A (System Event)' : `#${selectedLog.recordId}`}
                                    </span>
                                </div>
                            </div>

                            {/* Action Description */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1">
                                    Human-Readable Description
                                </span>
                                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 text-xs font-extrabold text-gray-800 leading-relaxed shadow-xs flex items-start gap-2.5">
                                    <div className="shrink-0 mt-0.5">
                                        {getActionBadge(selectedLog.action)}
                                    </div>
                                    <span className="py-0.5">{selectedLog.details}</span>
                                </div>
                            </div>

                            {/* Before vs After Diff Section */}
                            {renderFormattedDiff(selectedLog)}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

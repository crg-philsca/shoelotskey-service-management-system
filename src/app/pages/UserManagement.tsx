import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { PlusCircle, Edit, Trash, Search, Filter, ChevronLeft, ChevronRight, History as HistoryIcon, Activity, AlertTriangle, Lock, Unlock, MoreVertical, Loader2 } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import UserModal from '@/app/components/UserModal';
import { User } from '@/app/types';
import { toast } from 'sonner';
import { useActivities } from '@/app/context/ActivityContext';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';

const formatError = (errOrDetail: any, fallback: string = 'Operation failed'): string => {
  if (!errOrDetail) return fallback;
  const target = errOrDetail.detail || errOrDetail.message || errOrDetail.error || errOrDetail.msg || errOrDetail;
  if (typeof target === 'string') return target.replace(/^Value error,\s*/i, '');
  if (Array.isArray(target)) {
    return target
      .map((d: any) => {
        const str = typeof d === 'string' ? d : (d.msg || d.message || d.detail || JSON.stringify(d));
        return String(str).replace(/^Value error,\s*/i, '');
      })
      .join(' | ');
  }
  if (typeof target === 'object') {
    const str = target.msg || target.message || target.detail || JSON.stringify(target);
    return String(str).replace(/^Value error,\s*/i, '');
  }
  return String(target).replace(/^Value error,\s*/i, '');
};

const getRoleBadge = (roleName: string, isSystemAdmin?: boolean) => {
  if (isSystemAdmin || roleName?.toLowerCase() === 'admin') {
    return (
      <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2.5 py-0.5 shadow-none hover:bg-slate-100 whitespace-nowrap">
        SYSTEM
      </Badge>
    );
  }

  const normalized = (roleName || '').toLowerCase().replace(/_/g, ' ');
  switch (normalized) {
    case 'owner':
      return (
        <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2.5 py-0.5 shadow-none hover:bg-purple-50 whitespace-nowrap">
          OWNER
        </Badge>
      );
    case 'staff':
    case 'front staff':
      return (
        <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[9px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2.5 py-0.5 shadow-none hover:bg-sky-50 whitespace-nowrap">
          STAFF
        </Badge>
      );
    case 'manager':
      return (
        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[9px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2.5 py-0.5 shadow-none hover:bg-indigo-50 whitespace-nowrap">
          {roleName}
        </Badge>
      );
    case 'cashier':
      return (
        <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[9px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2.5 py-0.5 shadow-none hover:bg-teal-50 whitespace-nowrap">
          {roleName}
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2.5 py-0.5 shadow-none hover:bg-amber-50 whitespace-nowrap">
          {roleName}
        </Badge>
      );
  }
};

const parseUtcMs = (val: any) => {
  if (!val) return 0;
  let str = String(val).trim().replace(' ', 'T');
  if (!str.endsWith('Z') && !str.includes('+')) {
    const lastDash = str.lastIndexOf('-');
    if (lastDash <= 7) {
      str += 'Z';
    }
  }
  const t = new Date(str).getTime();
  return isNaN(t) ? 0 : t;
};

const getLockInfo = (user: User) => {
  // Admin account is permanently immune to lockouts
  const isSystemAdmin = (user.username || '').toLowerCase() === 'admin' || (user.role || '').toLowerCase() === 'admin';
  if (isSystemAdmin) {
    return { isLocked: false, isRestricted: false, minsRemaining: 0 };
  }

  const lockExpiryMs = user.lockedUntil ? parseUtcMs(user.lockedUntil) : 0;
  const nowMs = Date.now();
  const isRestricted = Boolean(
    lockExpiryMs > 0 && (new Date(lockExpiryMs).getUTCFullYear() >= 2099 || (lockExpiryMs - nowMs) > 365 * 24 * 3600 * 1000)
  );
  const msRemaining = (!isRestricted && lockExpiryMs > nowMs) ? Math.max(0, lockExpiryMs - nowMs) : 0;
  const minsRemaining = msRemaining > 0 ? Math.max(1, Math.ceil(msRemaining / 60000)) : 0;
  const isTempLocked = Boolean(
    !isRestricted && (
      (user.failedLoginAttempts !== undefined && user.failedLoginAttempts >= 3) || 
      msRemaining > 0
    )
  );
  const isLocked = isRestricted || isTempLocked;
  return { isLocked, isRestricted, minsRemaining };
};

const getStatusBadge = (
  active: boolean, 
  isLocked?: boolean, 
  onUnlock?: () => void, 
  canUnlock?: boolean, 
  minsRemaining?: number,
  isRestricted?: boolean
) => {
  if (isLocked) {
    if (isRestricted) {
      return (
        <Badge 
          onClick={canUnlock && onUnlock ? (e) => { e.stopPropagation(); onUnlock(); } : undefined}
          title={canUnlock ? "Account access restricted by administrator. Click or use Actions menu to unlock" : "Account access restricted by administrator"}
          className={`bg-rose-50 text-rose-700 border-rose-200 text-[9px] sm:text-[10px] font-black uppercase whitespace-nowrap shadow-none px-1.5 sm:px-2.5 py-0.5 inline-flex items-center gap-1 hover:bg-rose-50 ${canUnlock ? 'cursor-pointer hover:bg-rose-100 transition-colors' : ''}`}
        >
          <Lock size={10} className="text-rose-600 shrink-0" />
          <span>Restricted</span>
        </Badge>
      );
    }
    const minsText = minsRemaining && minsRemaining > 0 ? ` (${minsRemaining} min${minsRemaining === 1 ? '' : 's'})` : '';
    return (
      <Badge 
        onClick={canUnlock && onUnlock ? (e) => { e.stopPropagation(); onUnlock(); } : undefined}
        title={canUnlock ? `Account is locked${minsText}. Click or use Actions menu to unlock` : `Account is locked${minsText}`}
        className={`bg-amber-50 text-amber-700 border-amber-200 text-[9px] sm:text-[10px] font-black uppercase whitespace-nowrap shadow-none px-1.5 sm:px-2.5 py-0.5 inline-flex items-center gap-1 hover:bg-amber-50 ${canUnlock ? 'cursor-pointer hover:bg-amber-100 transition-colors' : ''}`}
      >
        <Lock size={10} className="text-amber-600 shrink-0" />
        <span>Locked{minsText}</span>
      </Badge>
    );
  }

  if (active) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] sm:text-[10px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1 sm:gap-1.5 shadow-none px-1.5 sm:px-2 py-0.5 hover:bg-emerald-50">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
        <span>Active</span>
      </Badge>
    );
  }

  return (
    <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] sm:text-[10px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1 sm:gap-1.5 shadow-none px-1.5 sm:px-2 py-0.5 hover:bg-rose-50">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 inline-block" />
      <span>Inactive</span>
    </Badge>
  );
};

export default function UserManagement({ onSetHeaderActionRight, user }: { onSetHeaderActionRight?: (action: React.ReactNode) => void, user: { id?: number; username?: string; role?: string; token: string } }) {
  const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const activeFilterCount = (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
    const itemsPerPage = 10;

    const [users, setUsers] = useState<User[]>(() => {
      if (typeof window === 'undefined') return [];
      const saved = localStorage.getItem('userManagement_cache');
      return saved ? JSON.parse(saved) : [];
    });
    const [loading, setLoading] = useState(users.length === 0);
    const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [serverError, setServerError] = useState<string>('');
    const { addActivity } = useActivities();
    const storedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}') : {};
    const currentUser = user?.username || storedUser.username || 'Owner';
    const currentUsername = currentUser.toLowerCase();
    const currentUserRole = (user?.role || storedUser.role || '').toLowerCase();
    const canUnlock = currentUserRole === 'owner' || 
                      currentUserRole === 'admin' || 
                      currentUsername === 'admin' || 
                      currentUsername === 'owner' || 
                      currentUsername === 'expert_owner';

    // Fetch users from API
    const fetchUsers = async () => {
      if (users.length === 0) {
        setLoading(true);
      }
      try {
        const response = await fetch(`${API_BASE}/users`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (response.ok) {
          const data = await response.json();
          const mappedUsers = data.map((u: any) => ({
            id: u.user_id.toString(),
            username: u.username,
            email: u.email,
            role: u.role?.role_name || 'staff',
            active: u.is_active,
            failedLoginAttempts: u.failed_login_attempts ?? u.failedLoginAttempts ?? 0,
            lockedUntil: u.locked_until || u.lockedUntil || null,
            permissions: u.permissions || [],
            permissions_summary: u.permissions_summary || ''
          }));
          setUsers(mappedUsers);
          localStorage.setItem('userManagement_cache', JSON.stringify(mappedUsers));
        } else {
          // Fallback to cache is already handled by initial state
          if (users.length === 0) toast.error('Failed to load users');
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Network error. Failed to load users.');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchUsers();
      const interval = setInterval(fetchUsers, 5000);
      const onFocus = () => fetchUsers();
      window.addEventListener('focus', onFocus);
      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', onFocus);
      };
    }, []);

    // Filter users based on search and filters
    const filteredUsers = useMemo(() => {
      return users.filter(user => {
        const matchesSearch = (user.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
        const normalizedUserRole = (user.role || '').toLowerCase().replace(/_/g, ' ');
        const matchesRole = roleFilter === 'all' || 
          user.role === roleFilter ||
          (roleFilter === 'staff' && normalizedUserRole === 'front staff');
        const { isLocked } = getLockInfo(user);
        const matchesStatus = statusFilter === 'all' || 
          (statusFilter === 'locked' ? isLocked :
           statusFilter === 'active' ? (user.active && !isLocked) :
           (!user.active && !isLocked));
        return matchesSearch && matchesRole && matchesStatus;
      });
    }, [users, searchQuery, roleFilter, statusFilter]);

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
    }, [currentPage, filteredUsers]);

    // Set header action on mount
    useEffect(() => {
      if (onSetHeaderActionRight) {
        onSetHeaderActionRight(
          <div className="flex items-center gap-2">
            <Button
              className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-200 bg-white px-2 sm:px-3 py-2 text-sm font-bold uppercase text-red-600 shadow-sm transition hover:bg-red-50 hover:text-red-600 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              title="View system activity logs"
              onClick={() => navigate('/activity-history')}
            >
              <HistoryIcon className="h-4 w-4 sm:mr-2 shrink-0 text-red-600" />
              <span className="hidden sm:inline font-bold text-red-600">View History</span>
            </Button>
            <Button
              className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              onClick={() => {
                setEditingUser(null);
                setServerError('');
                setUserModalOpen(true);
              }}
            >
              <PlusCircle className="sm:mr-2 h-4 w-4 shrink-0" />
              <span className="hidden sm:inline font-bold">New User</span>
            </Button>
          </div>
        );
      }
      return () => {
        if (onSetHeaderActionRight) onSetHeaderActionRight(null);
      };
    }, [onSetHeaderActionRight, navigate]);

    const handleResetFilters = () => {
      setRoleFilter('all');
      setStatusFilter('all');
      setCurrentPage(1);
    };

    const handleSaveUser = async (userData: Partial<User>) => {
      try {
        if (editingUser) {
          const response = await fetch(`${API_BASE}/users/${editingUser.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({
              username: userData.username,
              email: userData.email,
              password: userData.password,
              role_name: userData.role,
              is_active: userData.active
            })
          });

          if (response.ok) {
            if (userData.permissions && (userData.role === 'staff' || userData.role === 'front staff')) {
              try {
                const permRes = await fetch(`${API_BASE}/users/${editingUser.id}/permissions`, {
                  method: 'PUT',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                  },
                  body: JSON.stringify({ permissions: userData.permissions })
                });
                if (!permRes.ok) {
                  const permErr = await permRes.json().catch(() => ({}));
                  console.error('Failed to update user permissions:', permErr);
                  toast.error(permErr.detail || 'Could not update user permissions.');
                } else {
                  try {
                    const bc = new BroadcastChannel('shoelotskey_perms_channel');
                    bc.postMessage({ type: 'PERMISSIONS_UPDATED', userId: editingUser.id });
                    bc.close();
                  } catch (_) {}
                }
              } catch (pErr) {
                console.error('Network error updating permissions:', pErr);
              }
            }

            const changes: string[] = [];
            if (editingUser.username !== userData.username) changes.push(`Username: ${editingUser.username} -> ${userData.username}`);
            if (editingUser.email !== userData.email) changes.push(`Email: ${editingUser.email || 'N/A'} -> ${userData.email}`);
            if (editingUser.role !== userData.role) changes.push(`Role: ${editingUser.role} -> ${userData.role}`);
            if (editingUser.active !== userData.active) changes.push(`Status: ${editingUser.active ? 'Active' : 'Inactive'} -> ${userData.active ? 'Active' : 'Inactive'}`);
            const diffString = changes.length > 0 ? changes.join(' | ') : 'No properties changed';

            await fetchUsers();
            addActivity({
              user: currentUser,
              action: 'Update User',
              details: `Updated details for ${userData.username}. Changes: ${diffString}`,
              type: 'system',
              recordId: editingUser.id,
              newValues: { username: userData.username, email: userData.email, details: `Updated details for ${userData.username}. Changes: ${diffString}` }
            });
            toast.success('User updated successfully');
          } else {
            const err = await response.json().catch(() => ({}));
            const errorMsg = formatError(err.detail, 'Unknown error');
            setServerError(errorMsg);
            toast.error(`Update failed: ${errorMsg}`);
            return; // keep modal open if error
          }
        } else {
          const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({
              username: userData.username,
              email: userData.email,
              password: userData.password,
              role_name: userData.role,
              is_active: userData.active,
              permissions: userData.permissions
            })
          });

          if (response.ok) {
            const created = await response.json().catch(() => ({} as any));
            await fetchUsers();
            addActivity({
              user: currentUser,
              action: 'Create User',
              details: `Created new account for ${userData.username}`,
              type: 'system',
              recordId: created.user_id,
              newValues: { username: userData.username, email: userData.email, role: userData.role, details: `Created new account for ${userData.username}` }
            });
            toast.success('User created successfully');
          } else {
            const err = await response.json().catch(() => ({}));
            const errorMsg = formatError(err.detail, 'Unknown error');
            setServerError(errorMsg);
            toast.error(`Creation failed: ${errorMsg}`);
            return; // keep modal open if error
          }
        }
        setUserModalOpen(false);
        setServerError('');
      } catch (error) {
        console.error('Error saving user:', error);
        toast.error('Network error saving user.');
      }
    };

    const handleDeleteUser = (id: string) => {
      const uToDelete = users.find(u => u.id === id);
      const uName = (uToDelete?.username || '').toLowerCase().trim();
      if (['admin', 'owner', 'front_staff', 'staff'].includes(uName)) {
        toast.error('System accounts (admin, owner, staff, front_staff) cannot be deleted.');
        return;
      }
      if (uToDelete) {
        setDeleteTarget(uToDelete);
      }
    };

    const confirmDeleteUser = async () => {
      if (!deleteTarget) return;
      try {
        const response = await fetch(`${API_BASE}/users/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${user.token}` }
        });

        if (response.ok) {
          await fetchUsers();
          // P1-12 FIX: the backend soft-deactivates (instead of hard-deleting) any user
          // with historical transaction records (orders, expenses, status/inventory logs)
          // to preserve audit-trail identity, but still returns HTTP 200 either way.
          // Previously the UI always claimed "User deleted successfully" even when the
          // account was actually just deactivated — surface the backend's real message
          // so Owners understand which outcome occurred.
          const data = await response.json().catch(() => ({} as any));
          const wasDeactivated = !!data?.message?.toLowerCase().includes('deactivat');
          addActivity({
            user: currentUser,
            action: wasDeactivated ? 'Deactivate User' : 'Delete User',
            details: data?.message || `Deleted user account ${deleteTarget.username || deleteTarget.id}`,
            type: 'system'
          });
          toast.success(data?.message || 'User deleted successfully');
          setDeleteTarget(null);
        } else {
          const err = await response.json().catch(() => ({}));
          toast.error(`Deletion failed: ${formatError(err.detail, 'Unknown error')}`);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Network error deleting user.');
      }
    };

    const handleUnlockUser = async (targetUser: User) => {
      if (!canUnlock) {
        toast.error('Only Owner, Expert Owner, and Admin can unlock accounts.');
        return;
      }
      setActionLoadingUserId(targetUser.id);
      const toastId = toast.loading(`Unlocking account for ${targetUser.username}...`);
      try {
        const response = await fetch(`${API_BASE}/users/${targetUser.id}/unlock`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          toast.success(`Account for ${targetUser.username} unlocked successfully`, { id: toastId });
          await fetchUsers();
          addActivity({
            user: currentUser,
            action: 'Unlock User',
            details: `Unlocked user account ${targetUser.username} (cleared failed login attempts and lockout)`,
            type: 'system',
            recordId: targetUser.id
          });
        } else {
          const err = await response.json().catch(() => ({}));
          toast.error(`Failed to unlock account: ${formatError(err.detail, 'Unknown error')}`, { id: toastId });
        }
      } catch (error) {
        console.error('Error unlocking user:', error);
        toast.error('Network error unlocking user account', { id: toastId });
      } finally {
        setActionLoadingUserId(null);
      }
    };

    const handleLockUser = async (targetUser: User) => {
      if (!canUnlock) {
        toast.error('Only Owner, Expert Owner, and Admin can lock accounts.');
        return;
      }
      setActionLoadingUserId(targetUser.id);
      const toastId = toast.loading(`Restricting account access for ${targetUser.username}...`);
      try {
        const response = await fetch(`${API_BASE}/users/${targetUser.id}/lock`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          toast.success(`Account access for ${targetUser.username} restricted successfully`, { id: toastId });
          await fetchUsers();
          addActivity({
            user: currentUser,
            action: 'Lock User',
            details: `Restricted user account ${targetUser.username}`,
            type: 'system',
            recordId: targetUser.id
          });
        } else {
          const err = await response.json().catch(() => ({}));
          toast.error(`Failed to restrict account: ${formatError(err.detail, 'Unknown error')}`, { id: toastId });
        }
      } catch (error) {
        console.error('Error locking user:', error);
        toast.error('Network error restricting user account', { id: toastId });
      } finally {
        setActionLoadingUserId(null);
      }
    };

    const handleEditClick = (user: User) => {
      if (user.username?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'admin') {
        toast.error('System account cannot be modified.');
        return;
      }
      setEditingUser(user);
      setServerError('');
      setUserModalOpen(true);
    };

    return (
      <Card className="flex flex-col max-h-[calc(100vh-5.5rem)] shadow-md border-gray-100 subtle-vertical-scroll overflow-y-auto">
        <CardHeader className="pt-4 pb-0 px-6 shrink-0">
          <div className="flex items-center justify-center">
            <CardTitle className="text-center text-[15px] font-black text-gray-900 uppercase tracking-[0.1em] leading-tight p-0 -m-1">
              USER MANAGEMENT
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-2 flex-1 flex flex-col min-h-0 pb-2 px-4 sm:px-6">
          {/* Search and Filter Section */}
          <div className="flex gap-2 mb-3 items-center shrink-0">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-red-600 transition-colors" />
              <Input
                id="userSearch"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 h-8 text-[11px] border-gray-100 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-lg w-full transition-all"
              />
            </div>
            <Button
              variant="outline"
              className={`relative h-9 w-9 p-0 rounded-lg transition-colors ${activeFilterCount > 0
                ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100'
                : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'
                }`}
              onClick={() => setIsFilterOpen(true)}
              title="Open filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter Dialog */}
          <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader className="relative">
                <button 
                  onClick={() => (window as any).toggleActivityLog && (window as any).toggleActivityLog()}
                  className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-600 transition-colors"
                  title="Technical Audit Log"
                >
                  <Activity size={18} />
                </button>
                <DialogTitle className="text-center">Filters</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="locked">Locked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-4 flex w-full gap-3 sm:space-x-0">
                <Button
                  variant="outline"
                  onClick={handleResetFilters}
                  className="flex-1 h-9 font-bold text-xs border border-gray-300 bg-gray-200 hover:bg-gray-700 text-gray-700 hover:text-white transition-all uppercase tracking-widest"
                >
                  Reset
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-9 text-xs uppercase tracking-widest shadow-md"
                  onClick={() => setIsFilterOpen(false)}
                >
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* User List / Table Section - Responsive dual-mode layout */}
          <div className="overflow-x-hidden overflow-y-auto flex-1 w-full max-h-[435px] xl:max-h-[460px] subtle-vertical-scroll border border-gray-100 rounded-lg min-h-0 pb-1">
            
            {/* MOBILE VIEW (< 640px): Responsive user card list with full readable username, email, badges and actions */}
            <div className="block sm:hidden divide-y divide-gray-100">
              {loading ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                </div>
              ) : paginatedUsers.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No users found matching your criteria.
                </div>
              ) : (
                paginatedUsers.map((user) => {
                  const isSystemAdmin = user.username?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'admin';
                  const isProtectedDelete = ['admin', 'owner', 'front_staff', 'staff'].includes((user.username || '').toLowerCase().trim());
                  const { isLocked, isRestricted, minsRemaining } = getLockInfo(user);

                  return (
                    <div key={user.id} className="p-2.5 hover:bg-gray-50/80 transition-colors flex items-center justify-between gap-2">
                      {/* Username & Email */}
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-900 text-xs sm:text-sm truncate" title={user.username}>
                            {user.username}
                          </span>
                          {getRoleBadge(user.role, isSystemAdmin)}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5" title={user.email}>
                          {user.email || <span className="text-gray-400 italic">No email</span>}
                        </p>
                      </div>

                      {/* Status + Actions */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {getStatusBadge(user.active, isLocked, () => handleUnlockUser(user), canUnlock, minsRemaining, isRestricted)}
                        {isSystemAdmin ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled
                            className="h-8 w-8 p-0 rounded-md border border-gray-200 text-gray-300 bg-gray-50 opacity-40 cursor-not-allowed shadow-none inline-flex items-center justify-center" 
                            title="System account protected"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="outline" 
                                className="h-8 w-8 p-0 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-md inline-flex items-center justify-center" 
                                title="Actions"
                              >
                                <MoreVertical className="h-4 w-4 text-red-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1.5 space-y-1">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(user);
                                }}
                                className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                Edit User
                              </DropdownMenuItem>
                              {isLocked ? (
                                canUnlock && (
                                  <DropdownMenuItem
                                    disabled={actionLoadingUserId === user.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlockUser(user);
                                    }}
                                    className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:text-blue-800 focus:bg-blue-100 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {actionLoadingUserId === user.id ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                                    ) : (
                                      <Unlock className="h-4 w-4 mr-2 text-blue-600" />
                                    )}
                                    {actionLoadingUserId === user.id ? 'Unlocking...' : 'Unlock Account'}
                                  </DropdownMenuItem>
                                )
                              ) : (
                                canUnlock && !isSystemAdmin && (
                                  <DropdownMenuItem
                                    disabled={actionLoadingUserId === user.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLockUser(user);
                                    }}
                                    className="border border-orange-300 rounded-md px-2.5 py-1.5 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:text-orange-800 focus:bg-orange-100 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {actionLoadingUserId === user.id ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin text-orange-600" />
                                    ) : (
                                      <Lock className="h-4 w-4 mr-2 text-orange-600" />
                                    )}
                                    {actionLoadingUserId === user.id ? 'Restricting...' : 'Lock Account'}
                                  </DropdownMenuItem>
                                )
                              )}
                              {!isProtectedDelete && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUser(user.id);
                                  }}
                                  className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold cursor-pointer"
                                >
                                  <Trash className="h-4 w-4 mr-2 text-red-600" />
                                  Delete User
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP / TABLET VIEW (>= 640px): Standard 5-column table */}
            <table className="w-full table-fixed hidden sm:table">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-red-50/95 backdrop-blur-xs border-b border-red-100 sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap bg-red-50/95">Username</th>
                  <th className="px-3 py-2 text-left text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap bg-red-50/95">Email</th>
                  <th className="px-2 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap bg-red-50/95">Role</th>
                  <th className="px-2 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap bg-red-50/95">Status</th>
                  <th className="px-2 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-wider whitespace-nowrap bg-red-50/95">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => {
                    const isSystemAdmin = user.username?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'admin';
                    const isProtectedDelete = ['admin', 'owner', 'front_staff', 'staff'].includes((user.username || '').toLowerCase().trim());
                    const { isLocked, isRestricted, minsRemaining } = getLockInfo(user);
                    return (
                    <tr key={user.id} className="hover:bg-gray-50/80 transition-colors animate-in fade-in duration-500">
                      <td className="px-3 py-2 text-xs font-medium max-w-0">
                        <div className="flex items-center justify-start w-full min-w-0">
                          <span className="font-semibold text-gray-900 truncate block text-left w-full min-w-0" title={user.username}>{user.username}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-0">
                        <div className="flex items-center justify-start w-full min-w-0">
                          <span className="truncate block text-left w-full min-w-0 text-xs" title={user.email}>{user.email || <span className="text-gray-400 italic">—</span>}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center max-w-0">
                        <div className="flex items-center justify-center">
                          {getRoleBadge(user.role, isSystemAdmin)}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center max-w-0">
                        {getStatusBadge(user.active, isLocked, () => handleUnlockUser(user), canUnlock, minsRemaining, isRestricted)}
                      </td>
                      <td className="px-2 py-2 text-xs text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          {isSystemAdmin ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled
                              className="h-7 w-7 p-0 rounded-md border border-gray-200 text-gray-300 bg-gray-50 opacity-40 cursor-not-allowed shadow-none inline-flex items-center justify-center" 
                              title="System account protected"
                            >
                              <MoreVertical className="h-3.5 w-3.5 text-gray-400" />
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  className="h-7 w-7 p-0 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-md inline-flex items-center justify-center" 
                                  title="Actions"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 p-1.5 space-y-1">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(user);
                                  }}
                                  className="border border-yellow-200 rounded-md px-2.5 py-1.5 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:text-yellow-800 focus:bg-yellow-100 font-bold cursor-pointer"
                                >
                                  <Edit className="h-4 w-4 mr-2 text-yellow-600" />
                                  Edit User
                                </DropdownMenuItem>
                                {isLocked ? (
                                  canUnlock && (
                                    <DropdownMenuItem
                                      disabled={actionLoadingUserId === user.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnlockUser(user);
                                      }}
                                      className="border border-blue-200 rounded-md px-2.5 py-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:text-blue-800 focus:bg-blue-100 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {actionLoadingUserId === user.id ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                                      ) : (
                                        <Unlock className="h-4 w-4 mr-2 text-blue-600" />
                                      )}
                                      {actionLoadingUserId === user.id ? 'Unlocking...' : 'Unlock Account'}
                                    </DropdownMenuItem>
                                  )
                                ) : (
                                  canUnlock && !isSystemAdmin && (
                                    <DropdownMenuItem
                                      disabled={actionLoadingUserId === user.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLockUser(user);
                                      }}
                                      className="border border-orange-300 rounded-md px-2.5 py-1.5 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:text-orange-800 focus:bg-orange-100 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {actionLoadingUserId === user.id ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-orange-600" />
                                      ) : (
                                        <Lock className="h-4 w-4 mr-2 text-orange-600" />
                                      )}
                                      {actionLoadingUserId === user.id ? 'Restricting...' : 'Lock Account'}
                                    </DropdownMenuItem>
                                  )
                                )}
                                {!isProtectedDelete && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteUser(user.id);
                                    }}
                                    className="border border-red-200 rounded-md px-2.5 py-1.5 text-red-700 bg-red-50 hover:bg-red-100 focus:text-red-800 focus:bg-red-100 font-bold cursor-pointer"
                                  >
                                    <Trash className="h-4 w-4 mr-2 text-red-600" />
                                    Delete User
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border-t border-gray-100 pt-2 pb-1 px-3 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
              PAGE {currentPage} OF {totalPages || 1}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPage === 1
                  ? 'bg-slate-200 text-slate-500'
                  : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                  }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="max-w-[140px] md:max-w-[300px] overflow-x-auto no-scrollbar py-0.5 px-0.5 flex items-center gap-1">
                {Array.from({ length: totalPages || 1 }, (_, i) => {
                  const pageNum = i + 1;
                  const isActive = currentPage === pageNum;
                  return (
                    <Button
                      key={pageNum}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-7 w-7 min-w-[28px] p-0 text-[10px] font-black rounded-lg transition-all ${isActive
                        ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm shadow-red-200'
                        : 'bg-white border-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                        }`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.min(totalPages || 1, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`h-8 w-8 p-0 rounded-lg transition-all mt-0 border-none ${currentPage === (totalPages || 1)
                  ? 'bg-slate-200 text-slate-500'
                  : 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm'
                  }`}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
        <UserModal
          isOpen={userModalOpen}
          onClose={() => {
            setUserModalOpen(false);
            setServerError('');
          }}
          user={editingUser}
          onSave={handleSaveUser}
          serverError={serverError}
        />

        {/* CUSTOM PROFESSIONAL CONFIRMATION MODAL */}
        {deleteTarget && (
          <Dialog open onOpenChange={() => setDeleteTarget(null)}>
            <DialogContent className="max-w-sm rounded-2xl p-6 shadow-2xl border-0 bg-white">
              <DialogHeader>
                <DialogTitle className="font-black uppercase text-sm flex items-center gap-2 text-red-700 tracking-wider">
                  <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                  Confirm Account Deletion
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-gray-700 leading-relaxed py-2">
                Are you sure you want to permanently delete the user account <strong className="text-red-700 font-bold">"{deleteTarget.username}"</strong> ({(deleteTarget.role?.toLowerCase() === 'front staff' || deleteTarget.role?.toLowerCase() === 'front_staff') ? 'staff' : deleteTarget.role})? This action will instantly revoke access and cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100 w-full">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-100 justify-center">
                  Cancel
                </Button>
                <Button onClick={confirmDeleteUser} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5">
                  <Trash className="h-4 w-4" />
                  Confirm Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </Card>
    );
  }

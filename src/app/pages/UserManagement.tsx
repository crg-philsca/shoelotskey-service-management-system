import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { PlusCircle, Edit, Trash, Search, Filter, ChevronLeft, ChevronRight, History as HistoryIcon, Activity } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
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
const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:8000/api'
  : '/api';

export default function UserManagement({ onSetHeaderActionRight, user }: { onSetHeaderActionRight?: (action: React.ReactNode) => void, user: { token: string } }) {
  const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const itemsPerPage = 10;

    const [users, setUsers] = useState<User[]>(() => {
      if (typeof window === 'undefined') return [];
      const saved = localStorage.getItem('userManagement_cache');
      return saved ? JSON.parse(saved) : [];
    });
    const [loading, setLoading] = useState(users.length === 0);
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { addActivity } = useActivities();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{"username": "Owner"}').username;

    // Fetch users from API
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/users`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Map backend UserSchema to frontend User type
          const mappedUsers = data.map((u: any) => ({
            id: u.user_id.toString(),
            username: u.username,
            email: u.email,
            role: u.role?.role_name || 'staff',
            active: u.is_active
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
    }, []);

    // Filter users based on search and filters
    const filteredUsers = useMemo(() => {
      return users.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? user.active : !user.active);
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
              variant="outline"
              className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-200 bg-white px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-red-600 shadow-none transition hover:bg-red-50 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
              title="View system activity logs"
              onClick={() => navigate('/activity-history')}
            >
              <HistoryIcon className="h-4 w-4 sm:mr-2 shrink-0 text-red-600" />
              <span className="hidden sm:inline">View History</span>
            </Button>
            <Button
              className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
              onClick={() => {
                setEditingUser(null);
                setUserModalOpen(true);
              }}
            >
              <PlusCircle className="sm:mr-2 h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">New User</span>
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
              type: 'system'
            });
            toast.success('User updated successfully');
          } else {
            const err = await response.json();
            toast.error(`Update failed: ${err.detail || 'Unknown error'}`);
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
              is_active: userData.active
            })
          });

          if (response.ok) {
            await fetchUsers();
            addActivity({
              user: currentUser,
              action: 'Create User',
              details: `Created new account for ${userData.username}`,
              type: 'system'
            });
            toast.success('User created successfully');
          } else {
            const err = await response.json();
            toast.error(`Creation failed: ${err.detail || 'Unknown error'}`);
            return; // keep modal open if error
          }
        }
        setUserModalOpen(false);
      } catch (error) {
        console.error('Error saving user:', error);
        toast.error('Network error saving user.');
      }
    };

    const handleDeleteUser = async (id: string) => {
      if (confirm('Are you sure you want to delete this user?')) {
        try {
          const uToDelete = users.find(u => u.id === id);
          const response = await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${user.token}` }
          });

          if (response.ok) {
            await fetchUsers();
            addActivity({
              user: currentUser,
              action: 'Delete User',
              details: `Deleted user account ${uToDelete?.username || id}`,
              type: 'system'
            });
            toast.success('User deleted successfully');
          } else {
            const err = await response.json();
            toast.error(`Deletion failed: ${err.detail || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error deleting user:', error);
          toast.error('Network error deleting user.');
        }
      }
    };

    const handleEditClick = (user: User) => {
      setEditingUser(user);
      setUserModalOpen(true);
    };

    return (
      <Card>
        <CardHeader className="pt-5 pb-0 px-6">
          <div className="flex items-center justify-center">
            <CardTitle className="text-center text-[15px] font-black text-gray-900 uppercase tracking-[0.1em] leading-tight p-0 -m-1">
              USER MANAGEMENT
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-3">
          {/* Search and Filter Section */}
          <div className="flex gap-2 mb-5 items-center">
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
              className={`h-9 w-9 p-0 rounded-lg transition-colors ${roleFilter !== 'all' || statusFilter !== 'all'
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

          {/* Table Section */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-50 border-y border-red-100">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-800 uppercase tracking-widest">Username</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-800 uppercase tracking-widest">Email</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-800 uppercase tracking-widest">Role</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-800 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-800 uppercase tracking-widest">Actions</th>
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
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 animate-in fade-in duration-500">
                      <td className="px-4 py-3 text-sm font-medium">{user.username}</td>
                      <td className="px-4 py-3 text-sm">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-black uppercase">
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`
                          ${user.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}
                          text-[10px] font-black uppercase
                        `}>
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex justify-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg border border-amber-500 text-amber-600 hover:bg-amber-50 transition-colors bg-white shadow-none" 
                            onClick={() => handleEditClick(user)}
                          >
                            <Edit size={14} strokeWidth={2.5} />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 transition-colors bg-white shadow-none" 
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash size={14} strokeWidth={2.5} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border-t border-gray-100 pt-1.5 pb-1 px-3 flex items-center justify-between">
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
          onClose={() => setUserModalOpen(false)}
          user={editingUser}
          onSave={handleSaveUser}
        />
      </Card>
    );
  }

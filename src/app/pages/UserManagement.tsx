import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Plus, Edit, Trash, Search, Filter } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
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

export default function UserManagement({ onSetHeaderAction }: { onSetHeaderAction?: (action: React.ReactNode) => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const itemsPerPage = 10;

  const [users, setUsers] = useState<User[]>([
    { id: '1', username: 'owner', role: 'owner', email: 'owner@shoelotskey.com', active: true },
    { id: '2', username: 'staff1', role: 'staff', email: 'staff1@shoelotskey.com', active: true },
    { id: '3', username: 'staff2', role: 'staff', email: 'staff2@shoelotskey.com', active: true },
    { id: '4', username: 'technician', role: 'staff', email: 'tech@shoelotskey.com', active: false },
  ]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? user.active : !user.active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchQuery, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredUsers]);

  // Set header action on mount
  useEffect(() => {
    if (onSetHeaderAction) {
      onSetHeaderAction(
        <Button
          className="bg-red-600 hover:bg-red-700 font-bold"
          title="Create new user"
          onClick={() => {
            setEditingUser(null);
            setUserModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-0" />
          New User
        </Button>
      );
    }
    return () => {
      if (onSetHeaderAction) {
        onSetHeaderAction(null);
      }
    };
  }, [onSetHeaderAction]);

  const handleResetFilters = () => {
    setRoleFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleSaveUser = (userData: Partial<User>) => {
    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userData } as User : u));
      toast.success('User updated successfully');
    } else {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        username: userData.username || '',
        role: userData.role || 'staff',
        email: userData.email,
        active: userData.active ?? true,
        // password not stored in frontend list
      };
      setUsers(prev => [...prev, newUser]);
      toast.success('User created successfully');
    }
    setUserModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success('User deleted successfully');
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setUserModalOpen(true);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Search and Filter Section */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Button
              type="button"
              variant="ghost"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-9 w-9 text-gray-500"
              onClick={() => (document.getElementById('userSearch') as HTMLInputElement)?.focus()}
              title="Focus search"
            >
              <Search className="h-5 w-5" />
            </Button>
            <Input
              id="userSearch"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 h-9"
            />
          </div>
          <Button
            variant="outline"
            className="h-9 w-9"
            onClick={() => setIsFilterOpen(true)}
            title="Open filters"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>

        {/* Filter Dialog */}
        <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
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

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
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
            <thead className="bg-red-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{user.username}</td>
                  <td className="px-4 py-3 text-sm">{user.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge className={user.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                      {user.role === 'owner' ? 'Owner' : 'Staff'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge className={user.active ? 'bg-green-100 text-green-700' : 'bg-gray-400 text-white'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <Button size="sm" className="border border-yellow-500 text-yellow-700 bg-transparent hover:bg-yellow-50" onClick={() => handleEditClick(user)}>
                        <Edit size={16} />
                      </Button>
                      <Button size="sm" className="border border-red-600 text-red-600 bg-transparent hover:bg-red-50" onClick={() => handleDeleteUser(user.id)}>
                        <Trash size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} results
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`w-9 h-9 ${currentPage === 1 ? 'bg-gray-500 text-white border-gray-500 hover:bg-gray-500 hover:text-white' : ''}`}
            >
              &lt;
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 p-0 ${currentPage === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`w-9 h-9 ${currentPage === totalPages ? 'bg-gray-500 text-white border-gray-500 hover:bg-gray-500 hover:text-white' : ''}`}
            >
              &gt;
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

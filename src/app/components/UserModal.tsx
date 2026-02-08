import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { User } from '@/app/types';
import { Eye, EyeOff } from 'lucide-react';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onSave: (userData: Partial<User> & { password?: string }) => void;
}

export default function UserModal({ isOpen, onClose, user, onSave }: UserModalProps) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'owner' | 'staff'>('staff');
    const [active, setActive] = useState(true);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setEmail(user.email || '');
            setRole(user.role);
            setActive(user.active);
            setPassword(''); // Don't show password for edit
        } else {
            setUsername('');
            setEmail('');
            setRole('staff');
            setActive(true);
            setPassword('');
        }
    }, [user, isOpen]); // Reset when checking new vs edit

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            username,
            email,
            role,
            active,
            ...(password ? { password } : {}) // Only include password if set
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                        {user ? 'Edit User' : 'New User'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="username" className="text-xs font-bold uppercase tracking-widest text-gray-500">Username</Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-gray-500">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter email address"
                            className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600"
                            required
                        />
                    </div>

                    {(!user || password || true) && (
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-gray-500">{user ? 'New Password (Optional)' : 'Password'}</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={user ? "Leave blank to keep current" : "Enter password"}
                                    className="font-medium border-red-200 focus-visible:ring-0 focus-visible:border-red-600 pr-10"
                                    required={!user}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="role" className="text-xs font-bold uppercase tracking-widest text-gray-500">Role</Label>
                        <Select value={role} onValueChange={(value: 'owner' | 'staff') => setRole(value)}>
                            <SelectTrigger className="font-medium border-red-200 focus:ring-0 focus:border-red-600">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent className="bg-red-50">
                                <SelectItem value="staff">Staff</SelectItem>
                                <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="active" className="text-sm font-bold text-gray-700">Active Status</Label>
                        <Switch
                            id="active"
                            checked={active}
                            onCheckedChange={setActive}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    </div>

                    <DialogFooter className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 font-bold text-xs border border-gray-300 bg-gray-200 hover:bg-gray-700 text-gray-700 hover:text-white transition-all">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-9 text-xs uppercase tracking-widest">
                            {user ? 'Save' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

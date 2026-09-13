import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { User } from '@/app/types';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onSave: (userData: Partial<User> & { password?: string }) => void | Promise<void>;
    serverError?: string;
}

export default function UserModal({ isOpen, onClose, user, onSave, serverError }: UserModalProps) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'owner' | 'staff' | 'admin'>('staff');
    const [active, setActive] = useState(true);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

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
        setPasswordError('');
    }, [user, isOpen]); // Reset when checking new vs edit

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || isSubmittingRef.current) return;
        setPasswordError('');

        if (!user || password) {
            if (password.length < 4 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
                setPasswordError("Password must be at least 4 chars, 1 uppercase, 1 lowercase, and 1 number.");
                return;
            }
        }

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        try {
            await onSave({
                username,
                email,
                role,
                active,
                ...(password ? { password } : {})
            });
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                        {user ? 'Edit User' : 'New User'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Create or edit system account credentials</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {serverError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-xs text-red-600 font-bold text-center">{serverError}</p>
                        </div>
                    )}
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
                            {passwordError ? (
                                <p className="text-xs text-red-500 font-bold mt-1">{passwordError}</p>
                            ) : (
                                <p className="text-[10px] text-gray-500 mt-1 font-medium leading-tight">
                                    Must be at least 4 characters long, containing uppercase, lowercase, and a number.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="role" className="text-xs font-bold uppercase tracking-widest text-gray-500">Role</Label>
                        <Select value={role} onValueChange={(value: 'owner' | 'staff' | 'admin') => setRole(value)}>
                            <SelectTrigger className="font-medium border-red-200 focus:ring-0 focus:border-red-600">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
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
                        <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-9 text-xs uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5">
                            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            <span>{isSubmitting ? 'Saving...' : user ? 'Save' : 'Create'}</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

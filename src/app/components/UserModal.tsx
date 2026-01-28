import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { User } from '@/app/types';

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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{user ? 'Edit User' : 'New User'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter email address"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={role} onValueChange={(value: 'owner' | 'staff') => setRole(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(!user || password || true) && (
                        <div className="space-y-2">
                            <Label htmlFor="password">{user ? 'New Password (Optional)' : 'Password'}</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={user ? "Leave blank to keep current" : "Enter password"}
                                required={!user}
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="active" className="cursor-pointer">Active Status</Label>
                        <Switch
                            id="active"
                            checked={active}
                            onCheckedChange={setActive}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-red-600 hover:bg-red-700">
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

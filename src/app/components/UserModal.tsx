import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { User } from '@/app/types';
import { Eye, EyeOff, Loader2, ShieldCheck, KeyRound, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useServices } from '@/app/context/ServiceContext';
import { toast } from 'sonner';
import { sanitizeClientAuthCode, sanitizeClientUsername, hasMaliciousPattern } from '@/app/lib/security';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onSave: (userData: Partial<User> & { password?: string; permissions?: string[] }) => void | Promise<void>;
    serverError?: string;
}

const DEFAULT_STAFF_PERMS = [
    'job_orders.view',
    'job_orders.create',
    'job_orders.update',
    'job_orders.cancel',
    'job_orders.release',
    'payments.process',
    'discounts.apply',
    'discounts.use_auth_code',
    'inventory.view',
    'inventory.create_item',
    'inventory.add_stock',
    'inventory.use_stock',
    'inventory.adjust_balance',
];

const PERMISSION_GROUPS = [
    {
        title: 'Job Orders',
        items: [
            { code: 'job_orders.view', label: 'View Job Orders', desc: 'Allows viewing job orders and details' },
            { code: 'job_orders.create', label: 'Create Job Orders', desc: 'Allows creating new job orders' },
            { code: 'job_orders.update', label: 'Update Job Orders', desc: 'Allows editing job orders and updating status' },
            { code: 'job_orders.cancel', label: 'Cancel Job Orders', desc: 'Allows initiating order cancellations' },
            { code: 'job_orders.authorize_cancel', label: 'Authorize Order Cancellations', desc: 'Allows self-authorizing cancellations without supervisor credentials' },
            { code: 'job_orders.release', label: 'Process Claim / Release', desc: 'Allows verifying claim and releasing orders' },
        ]
    },
    {
        title: 'Payments & Discounts',
        items: [
            { code: 'payments.process', label: 'Process Payments', desc: 'Allows recording and processing customer payments' },
            { code: 'discounts.apply', label: 'Allow Applying Discounts', desc: 'Shows the discount selector on job orders (turn OFF to completely hide discounts)' },
            { code: 'discounts.authorize', label: 'Authorize Standard Discounts', desc: 'Allows this account to self-authorize discounts directly (no supervisor password or code needed)' },
            { code: 'discounts.use_auth_code', label: 'Use Authorization Code', desc: 'Allows entering the store master code to authorize discounts & cancellations' },
        ]
    },
    {
        title: 'Inventory & Stock Movement',
        items: [
            { code: 'inventory.view', label: 'View Inventory', desc: 'Allows viewing stock levels, catalog items, and supplies' },
            { code: 'inventory.create_item', label: 'Add Item', desc: 'Allows creating new inventory items' },
            { code: 'inventory.add_stock', label: 'Add Stock', desc: 'Recording incoming purchase restocks' },
            { code: 'inventory.use_stock', label: 'Use Stock', desc: 'Allows deducting supplies used on job orders' },
            { code: 'inventory.adjust_balance', label: 'Adjust Balances', desc: 'Adjusting physical inventory counts' },
            { code: 'inventory.deactivate', label: 'Deactivate Inventory', desc: 'Allows deactivating or archiving inventory records' },
        ]
    }
];

export default function UserModal({ isOpen, onClose, user, onSave, serverError }: UserModalProps) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'owner' | 'staff' | 'front staff' | 'admin'>('staff');
    const [active, setActive] = useState(true);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(DEFAULT_STAFF_PERMS);
    const [showPermissions, setShowPermissions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setEmail(user.email || '');
            setRole(user.role);
            setActive(user.active);
            setPassword(''); // Don't show password for edit
            if (user.permissions && Array.isArray(user.permissions)) {
                const allowedCodes = new Set(PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.code)));
                setSelectedPermissions(user.permissions.filter(p => allowedCodes.has(p)));
            } else {
                setSelectedPermissions(DEFAULT_STAFF_PERMS);
            }
        } else {
            setUsername('');
            setEmail('');
            setRole('staff');
            setActive(true);
            setPassword('');
            setSelectedPermissions(DEFAULT_STAFF_PERMS);
        }
        setShowPermissions(false);
        setPasswordError('');
    }, [user, isOpen]);

    const { authorizationCode, setAuthorizationCode } = useServices();
    const [storeAuthCode, setStoreAuthCode] = useState('');
    const [showAuthCodeSecret, setShowAuthCodeSecret] = useState(false);
    const [showOwnerAuthSection, setShowOwnerAuthSection] = useState(false);
    const [isSavingAuthCode, setIsSavingAuthCode] = useState(false);

    useEffect(() => {
        if (authorizationCode) {
            setStoreAuthCode(authorizationCode);
        }
    }, [authorizationCode]);

    const handleSaveStoreAuthCode = async () => {
        const clean = sanitizeClientAuthCode(storeAuthCode.trim());
        if (clean.length < 3) {
            toast.error("Master authorization code must be at least 3 characters.");
            return;
        }
        if (hasMaliciousPattern(clean)) {
            toast.error("Invalid characters or attack payload in authorization code.");
            return;
        }
        setIsSavingAuthCode(true);
        try {
            const ok = await setAuthorizationCode(clean);
            if (ok) {
                toast.success(`Master authorization code saved: ${clean}`);
            } else {
                toast.error("Failed to update authorization code on server.");
            }
        } finally {
            setIsSavingAuthCode(false);
        }
    };

    const togglePermission = (code: string) => {
        setSelectedPermissions(prev => {
            const next = new Set(prev);
            if (next.has(code)) {
                next.delete(code);
                // Dependencies: disabling view removes dependent actions
                if (code === 'job_orders.view') {
                    next.delete('job_orders.update');
                    next.delete('job_orders.cancel');
                    next.delete('job_orders.authorize_cancel');
                    next.delete('job_orders.release');
                }
                if (code === 'inventory.view') {
                    next.delete('inventory.add');
                    next.delete('inventory.edit');
                    next.delete('inventory.deactivate');
                    next.delete('inventory.create_item');
                    next.delete('inventory.add_stock');
                    next.delete('inventory.use_stock');
                    next.delete('inventory.adjust_balance');
                }
            } else {
                next.add(code);
                // Enabling action requires view
                if (['job_orders.update', 'job_orders.cancel', 'job_orders.authorize_cancel', 'job_orders.release'].includes(code)) {
                    next.add('job_orders.view');
                }
                if (['inventory.add', 'inventory.edit', 'inventory.deactivate', 'inventory.create_item', 'inventory.add_stock', 'inventory.use_stock', 'inventory.adjust_balance'].includes(code)) {
                    next.add('inventory.view');
                }
            }
            return Array.from(next);
        });
    };

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
            // Preserve backend 'front staff' role for front_staff if staff is selected
            let targetRole = role;
            if (role === 'staff' && (user?.role === 'front staff' || (user?.role as any) === 'front_staff' || user?.username?.toLowerCase() === 'front_staff')) {
                targetRole = 'front staff';
            }
            const allowedCodes = new Set(PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.code)));
            const cleanPermissions = selectedPermissions.filter(p => allowedCodes.has(p));
            await onSave({
                username,
                email,
                role: targetRole,
                active,
                ...(password ? { password } : {}),
                permissions: (targetRole === 'staff' || targetRole === 'front staff') ? cleanPermissions : []
            });
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const isStaffRole = role === 'staff' || role === 'front staff';
    const isAdminRole = role === 'admin';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b border-gray-100 shrink-0 bg-white sticky top-0 z-10">
                    <DialogTitle className="text-xl font-bold uppercase text-red-600 text-center">
                        {user ? 'Edit User' : 'New User'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Create or edit system account credentials</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 subtle-vertical-scroll">
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
                            onChange={(e) => setUsername(sanitizeClientUsername(e.target.value))}
                            placeholder="Enter username"
                            autoComplete="off"
                            maxLength={50}
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
                        <Select value={role === 'front staff' ? 'staff' : role} onValueChange={(value: 'owner' | 'staff') => setRole(value)}>
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
                    {role === 'owner' && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                            {/* Expandable Header Toggle Button matching Staff Permissions */}
                            <button
                                type="button"
                                onClick={() => setShowOwnerAuthSection(prev => !prev)}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50/90 hover:bg-gray-100/90 border border-gray-200/80 transition-all cursor-pointer group text-left"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
                                        <KeyRound className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-wider text-gray-900 group-hover:text-red-600 transition-colors">
                                            Master Authorization Code
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-medium">
                                            {showOwnerAuthSection ? "Click to collapse master code setup" : "Click to view and configure master code"}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-2xs">
                                        Owner Credential
                                    </span>
                                    {showOwnerAuthSection ? (
                                        <ChevronUp className="h-4 w-4 text-gray-500 group-hover:text-red-600 transition-colors" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-red-600 transition-colors" />
                                    )}
                                </div>
                            </button>

                            {/* Collapsible Content: Clean neutral card matching Staff Permissions */}
                            {showOwnerAuthSection && (
                                <div className="pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="rounded-xl border border-gray-200 bg-white shadow-2xs overflow-hidden p-3.5 space-y-2.5">
                                        <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                            Master security credential used across Discounts, Order Cancellations, and Inventory overrides.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <Input
                                                    type={showAuthCodeSecret ? "text" : "password"}
                                                    value={storeAuthCode}
                                                    onChange={(e) => setStoreAuthCode(sanitizeClientAuthCode(e.target.value))}
                                                    placeholder="Enter master code"
                                                    autoComplete="off"
                                                    maxLength={64}
                                                    className="h-8 text-xs font-mono font-bold tracking-wider pr-8 bg-white border-gray-200 focus-visible:border-gray-400 focus-visible:ring-1 focus-visible:ring-gray-300"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAuthCodeSecret(!showAuthCodeSecret)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                                    title={showAuthCodeSecret ? "Hide code" : "Show code"}
                                                >
                                                    {showAuthCodeSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={isSavingAuthCode || !storeAuthCode.trim()}
                                                onClick={handleSaveStoreAuthCode}
                                                className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer shrink-0 shadow-xs"
                                            >
                                                {isSavingAuthCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check size={14} />}
                                                <span className="ml-1">Save Code</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                                        {isAdminRole && (
                        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-900">
                                <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                                <span>Access Level: Admin — System Administrator</span>
                            </div>
                            <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                                Technical administrative privileges are protected. Technical capabilities are not exposed as configurable Staff permissions.
                            </p>
                        </div>
                    )}

                    {isStaffRole && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                            {/* Expandable Header Toggle Button */}
                            <button
                                type="button"
                                onClick={() => setShowPermissions(prev => !prev)}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50/90 hover:bg-gray-100/90 border border-gray-200/80 transition-all cursor-pointer group text-left"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
                                        <KeyRound className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-wider text-gray-900 group-hover:text-red-600 transition-colors">
                                            Staff Permissions
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-medium">
                                            {showPermissions ? 'Click to collapse access toggles' : 'Click to customize access & authorities'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-2xs">
                                        {selectedPermissions.filter(p => PERMISSION_GROUPS.some(g => g.items.some(i => i.code === p))).length} / {PERMISSION_GROUPS.reduce((acc, g) => acc + g.items.length, 0)} Enabled
                                    </span>
                                    {showPermissions ? (
                                        <ChevronUp className="h-4 w-4 text-gray-500 group-hover:text-red-600 transition-colors" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-red-600 transition-colors" />
                                    )}
                                </div>
                            </button>

                            {/* Collapsible Content: 1 Unified Scrollable Card */}
                            {showPermissions && (
                                <div className="pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 shadow-2xs overflow-hidden">
                                        {/* Card Sub-header with Restore Defaults */}
                                        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-100/80 border-b border-gray-200">
                                            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                                                Operational Authorities
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPermissions(DEFAULT_STAFF_PERMS)}
                                                className="text-[10px] font-bold text-red-600 hover:text-red-800 uppercase tracking-wider underline cursor-pointer transition-colors"
                                                title="Reset to standard defaults (9 enabled, discounts & deactivation disabled)"
                                            >
                                                Restore Defaults
                                            </button>
                                        </div>

                                        {/* Scrollable list inside the single card */}
                                        <div className="p-3 max-h-56 sm:max-h-64 overflow-y-auto subtle-vertical-scroll space-y-3.5">
                                            {PERMISSION_GROUPS.map((group, groupIdx) => (
                                                <div key={group.title} className={groupIdx > 0 ? "pt-3 border-t border-gray-200/70" : ""}>
                                                    <div className="text-[10.5px] font-black uppercase tracking-wider text-gray-600 mb-2 px-1">
                                                        {group.title}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {group.items.map((item) => {
                                                            const isEnabled = selectedPermissions.includes(item.code);
                                                            const isJobOrderChild = ['job_orders.update', 'job_orders.cancel', 'job_orders.authorize_cancel', 'job_orders.release'].includes(item.code);
                                                            const isInventoryChild = ['inventory.add', 'inventory.edit', 'inventory.deactivate', 'inventory.create_item', 'inventory.add_stock', 'inventory.use_stock', 'inventory.adjust_balance'].includes(item.code);
                                                            const isDisabledByParent = 
                                                                (isJobOrderChild && !selectedPermissions.includes('job_orders.view')) ||
                                                                (isInventoryChild && !selectedPermissions.includes('inventory.view'));

                                                            return (
                                                                <div 
                                                                    key={item.code} 
                                                                    className={`flex items-start justify-between gap-3 p-2 rounded-lg transition-colors bg-white border border-gray-200/60 shadow-2xs ${
                                                                        isDisabledByParent ? 'opacity-40 cursor-not-allowed' : 'hover:border-red-200'
                                                                    }`}
                                                                >
                                                                    <div className="flex-1 min-w-0 pr-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-xs font-bold text-gray-800">{item.label}</span>
                                                                        </div>
                                                                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{item.desc}</p>
                                                                    </div>
                                                                    <Switch
                                                                        checked={isEnabled}
                                                                        disabled={isDisabledByParent}
                                                                        onCheckedChange={() => togglePermission(item.code)}
                                                                        className="data-[state=checked]:bg-emerald-500 mt-0.5 shrink-0"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    </div>

                    <DialogFooter className="p-4 border-t border-gray-100 bg-gray-50/90 shrink-0 sticky bottom-0 z-10 flex gap-3 shadow-xs">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 font-bold text-xs border border-gray-300 bg-gray-200 hover:bg-gray-700 text-gray-700 hover:text-white transition-all cursor-pointer">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 h-9 text-xs uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer">
                            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            <span>{isSubmitting ? 'Saving...' : user ? 'Save Changes' : 'Create Staff'}</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

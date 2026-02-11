import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { toast } from 'sonner';
import {
    Eye, EyeOff, User, Mail, Camera,
    Shield, Briefcase, Calendar
} from 'lucide-react';

interface ProfileSettingsProps {
    user: { username: string; email?: string; role: 'owner' | 'staff' };
    onUpdateUser: (username: string, email: string) => void;
}

export default function ProfileSettings({ user, onUpdateUser }: ProfileSettingsProps) {

    const [username, setUsername] = useState(user.username);
    const [email, setEmail] = useState(user.email || '');

    // Security states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);


    const handleSaveProfile = () => {
        onUpdateUser(username, email);
        toast.success('Profile information updated successfully');
    };

    const handleUpdatePassword = () => {
        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        // In a real app, we'd verify currentPassword here
        toast.success('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleCancelProfile = () => {
        setUsername(user.username);
        setEmail(user.email || '');
    };

    const handleCancelPassword = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 md:px-8">


            <div className="space-y-6">
                {/* Employee Information Card */}
                <Card className="border shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-gray-500" />
                            Profile Information
                        </CardTitle>
                        <CardDescription>View and manage your personal details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            {/* Left: Avatar & Statics */}
                            <div className="flex flex-col items-center gap-4 w-full md:w-auto">
                                <div className="h-24 w-24 rounded-full bg-red-50 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden relative group">
                                    <User className="h-8 w-8 text-red-300" />
                                    {/* Camera overlay only visual here for now */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Camera className="h-6 w-6 text-gray-600" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">Status</p>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-green-50 text-green-700 mt-1">
                                        Active
                                    </span>
                                </div>
                            </div>

                            {/* Right: Form */}
                            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                {/* Editable Fields */}
                                <div className="space-y-2">
                                    <Label htmlFor="username">Username</Label>
                                    <Input
                                        id="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="bg-white border-gray-200 shadow-none focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10 bg-white border-gray-200 shadow-none focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500"
                                        />
                                    </div>
                                </div>

                                {/* Read-Only Organizational Fields */}
                                <div className="space-y-2">
                                    <Label className="text-gray-500">Role / Position</Label>
                                    <div className="flex items-center h-10 w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                        <Briefcase className="mr-2 h-4 w-4 opacity-50" />
                                        <span className="capitalize">{user.role}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-gray-500">Date Joined</Label>
                                    <div className="flex items-center h-10 w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                        <Calendar className="mr-2 h-4 w-4 opacity-50" />
                                        <span>Dec 17, 2025</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4 pt-6 pb-2">
                            <Button type="button" onClick={handleCancelProfile} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold uppercase tracking-wider">
                                Cancel
                            </Button>
                            <Button onClick={handleSaveProfile} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider">
                                Save
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Security Card */}
                <Card className="border shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-gray-500" />
                            Security Settings
                        </CardTitle>
                        <CardDescription>Manage your password details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Password Change */}
                        <div className="space-y-4">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="current-pass">Current Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="current-pass"
                                            type={showPassword ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="bg-white border border-gray-200 shadow-none focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-pass">New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="new-pass"
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="bg-white border border-gray-200 shadow-none focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-pass">Confirm New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirm-pass"
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="bg-white border border-gray-200 shadow-none focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-6 pb-2">
                                    <Button type="button" onClick={handleCancelPassword} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold uppercase tracking-wider">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleUpdatePassword} disabled={!currentPassword || !newPassword} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider">
                                        Update
                                    </Button>
                                </div>
                            </div>
                        </div>


                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

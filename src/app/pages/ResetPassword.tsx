import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/app/components/ui/card';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:8000/api'
  : '/api';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token'); // Get token from URL params

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast.error('Please enter a new password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!token) {
      toast.error('Invalid or missing reset token');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });

      if (response.ok) {
        toast.success('Password updated successfully!');
        setSubmitted(true);
        setTimeout(() => navigate('/'), 2000);
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to reset password');
      }
    } catch (err) {
      toast.error('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-r from-red-200 via-white to-red-200 overflow-y-auto">
      <div className="flex flex-col flex-grow items-center justify-center w-full py-8 px-2 sm:px-4 md:px-6 mt-10">
        <Card className="w-full max-w-xs sm:max-w-sm md:max-w-md shadow-2xl mx-auto">
          <CardHeader className="space-y-0 text-center pb-0 mb-0" style={{ marginBottom: '-4px', paddingBottom: 0 }}>
            <img
              src="/login.png"
              alt="Shoelotskey logo"
              className="h-24 xs:h-28 sm:h-32 md:h-36 w-auto object-contain mx-auto transform -translate-x-0.5"
              loading="lazy"
            />
            <CardDescription className="text-base xs:text-lg md:text-xl font-semibold text-black">
              RESET PASSWORD
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center text-green-700 font-medium mt-1 mb-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
                Password reset successful! Redirecting to login...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm sm:text-base"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm sm:text-base"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 cursor-pointer text-base mt-4">
                  {loading ? 'Resetting...' : 'Reset'}
                </Button>
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    className="text-sm text-black hover:text-red-600 hover:underline transition-colors font-normal cursor-pointer"
                    onClick={() => navigate('/')}
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}

          </CardContent>
        </Card>
      </div>
      <div className="flex-shrink-0">
        <p className="text-xs text-gray-700 text-center py-4">© 2026 Shoelotskey Villamor-Pasay • Developed by AGS AviaTech</p>
      </div>
    </div>
  );
}
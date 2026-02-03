import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { toast } from 'sonner';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onLogin: (username: string, role: 'owner' | 'staff') => void;
}

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate empty fields
    if (!username.trim()) {
      toast.error('Please enter your username', {
        style: { background: '#fef2f2', color: '#dc2626' }
      });
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter your password', {
        style: { background: '#fef2f2', color: '#dc2626' }
      });
      return;
    }

    // Mock login logic
    if (username === 'owner' && password === 'owner123') {
      toast.success('Welcome, Owner!', {
        style: { background: '#f0fdf4', color: '#166534' }
      });
      onLogin(username, 'owner');
    } else if (username === 'staff' && password === 'staff123') {
      toast.success('Welcome, Staff!', {
        style: { background: '#f0fdf4', color: '#166534' }
      });
      onLogin(username, 'staff');
    } else {
      toast.error('Invalid username or password. Try again.', {
        style: { background: '#fef2f2', color: '#dc2626' }
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-r from-red-200 via-white to-red-200 overflow-y-auto">
      {/* Main Content */}
      <div className="flex flex-col flex-grow items-center justify-center w-full py-8 px-2 sm:px-4 md:px-6 mt-8">
        {/* Login Card - Center */}
        <Card className="w-full max-w-xs sm:max-w-sm md:max-w-md shadow-2xl mx-auto">
          <CardHeader className="space-y-0 text-center pb-0 mb-0" style={{ marginBottom: '-4px', paddingBottom: 0 }}>
            <img
              src="/login.png"
              alt="Shoelotskey logo"
              className="h-32 xs:h-36 sm:h-40 md:h-48 w-auto object-contain mx-auto transform -translate-x-0.5"
              loading="lazy"
            />
            <CardDescription className="text-base xs:text-lg md:text-xl font-semibold text-black">

            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="username">Username / Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username or email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-white border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm sm:text-base"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-white border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm sm:text-base"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-row flex-nowrap items-center justify-between gap-2 mt-5 mb-5 overflow-x-auto w-full">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="cursor-pointer"
                  />
                  <Label htmlFor="remember" className="cursor-pointer font-normal">
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm text-black hover:text-red-600 hover:underline transition-colors font-normal hover:cursor-pointer"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 cursor-pointer text-base">
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0">
        <p className="text-xs text-gray-700 text-center py-4">© 2026 Shoelotskey Villamor-Pasay • Developed by AGS AviaTech</p>
      </div>
    </div>
  );
}

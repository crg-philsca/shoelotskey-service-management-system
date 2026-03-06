import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
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

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG] Login attempt started for:', username);
    setIsLoading(true);

    // SOLID: Validation Responsibility should be local to UI
    if (!username.trim()) {
      toast.error('Please enter your username');
      setIsLoading(false);
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter your password');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[DEBUG] Fetching from backend...');
      const response = await fetch('http://127.0.0.1:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      console.log('[DEBUG] Backend response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Login successful:', data.username);
        toast.success(`Welcome, ${data.username}!`);
        onLogin(data.username, data.role as 'owner' | 'staff');
      } else {
        const err = await response.json();
        console.warn('[DEBUG] Login failed:', err.detail);
        if (response.status === 403) {
          toast.error(err.detail, { duration: 5000 });
        } else {
          toast.error(err.detail || 'Invalid username or password');
        }
      }
    } catch (err) {
      console.error('[DEBUG] Connection error:', err);
      toast.error('Cannot connect to server. Check if backend is running (Terminal 2).');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-r from-red-200 via-white to-red-200 overflow-y-auto">
      {/* Main Content */}
      <div className="flex flex-col flex-grow items-center justify-center w-full py-8 px-2 sm:px-4 md:px-6 mt-8">
        <Card className="w-full max-w-xs sm:max-w-sm md:max-w-md shadow-2xl mx-auto">
          <CardHeader className="space-y-0 text-center pb-0 mb-0" style={{ marginBottom: '-4px', paddingBottom: 0 }}>
            <img
              src="/login.png"
              alt="Shoelotskey logo"
              className="h-32 xs:h-36 sm:h-40 md:h-48 w-auto object-contain mx-auto transform -translate-x-0.5"
              loading="lazy"
            />
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                  disabled={isLoading}
                  className="text-sm text-black hover:text-red-600 hover:underline transition-colors font-normal hover:cursor-pointer"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot password?
                </button>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 cursor-pointer text-base flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                ) : null}
                {isLoading ? 'Verifying...' : 'Login'}
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

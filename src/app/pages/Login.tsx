import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { toast } from 'sonner';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onLogin: (id: number, username: string, role: 'owner' | 'staff', token: string, rememberMe?: boolean) => void;
}


const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173'))
  ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:8000/api`
  : '/api';

const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const msg = sessionStorage.getItem('logout_message');
    if (msg) {
      sessionStorage.removeItem('logout_message');
      setTimeout(() => toast.error(msg, { duration: 6000 }), 150);
    }
  }, []);

  /**
   * HANDLER: handleSubmit
   * Logic: 1. Validate local UI state -> 2. POST to Auth API -> 3. Handle Session
   * SOLID: Single Responsibility - this handles UI login submission only.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // DEBUG: Log start of attempt for programmer visibility
    console.log('[AUTH_DEBUG] Login attempt initiated:', { username, timestamp: new Date().toISOString() });
    setIsLoading(true);

    // Helper to attempt offline login from cache
    const tryOfflineLogin = async () => {
      const offlineAuth = localStorage.getItem('shoelotskey_offline_auth');
      if (offlineAuth) {
        try {
          const parsed = JSON.parse(offlineAuth);
          const passwordHash = await hashPassword(password);
          if (parsed.username.toLowerCase() === username.trim().toLowerCase() && parsed._key === passwordHash) {
            toast.success(`Offline login successful! Operating from local cache.`);
            onLogin(parsed.user_id, parsed.username, parsed.role, parsed.access_token || '', rememberMe);
            return true;
          }
        } catch (e) {
          console.warn('[AUTH_OFFLINE] Error reading offline cache:', e);
        }
      }
      return false;
    };

    try {
      // 1. INPUT VALIDATION (Local Responsibility)
      if (!username.trim() || !password.trim()) {
        const missing = !username.trim() ? 'Username' : 'Password';
        console.warn(`[AUTH_DEBUG] Validation failed: Missing ${missing}`);
        toast.error(`Please enter your ${missing.toLowerCase()}`);
        setIsLoading(false);
        return;
      }

      // 2. BACKEND COMMUNICATION WITH TIMEOUT RESILIENCE
      console.log('[AUTH_DEBUG] Sending credentials to backend...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // 3. RESPONSE HANDLING
      console.log('[AUTH_DEBUG] Backend responded with status:', response.status);

      if (response.ok) {
        // SUCCESS: Parse user session data
        const data = await response.json();
        console.log('[AUTH_DEBUG] Auth Success. Payload:', data);

        toast.success(`Welcome back, ${data.username}!`);
        
        // Always securely cache hashed credentials for offline fallback & network loss during shifts
        try {
          const passwordHash = await hashPassword(password);
          localStorage.setItem('shoelotskey_offline_auth', JSON.stringify({
            ...data,
            _key: passwordHash,
            cachedAt: Date.now()
          }));
        } catch (e) {
          console.warn('[AUTH] Failed to cache offline credentials:', e);
        }

        // Pass to App-level state management with token (OWASP A01 Compliance)
        onLogin(data.user_id, data.username, data.role as 'owner' | 'staff', data.access_token, rememberMe);

      } else if (response.status >= 500) {
        // BACKEND EXCEPTION OR API GATEWAY FAILURE (500, 502, 503, 504)
        console.warn(`[AUTH] Backend exception (${response.status}). Attempting offline fallback...`);
        const offlineSuccess = await tryOfflineLogin();
        if (!offlineSuccess) {
          toast.error(`System Server Error (${response.status}): Unable to connect to authentication server.`);
        }
      } else {
        // FAIL: Handle specific status codes (e.g., 401 Unauthorized, 403 Forbidden)
        let errMsg = 'Invalid username or password';
        try {
          const errData = await response.json();
          errMsg = errData.detail || errMsg;
        } catch (e) {
          console.warn('[AUTH] Non-JSON error response received.');
        }

        if (response.status === 403 || response.status === 401) {
          localStorage.removeItem('shoelotskey_offline_auth');
        }

        if (response.status === 403) {
          toast.error(`Security Block: ${errMsg}`, { duration: 6000 });
        } else {
          toast.error(errMsg);
        }
      }
    } catch (err) {
      /**
       * CATCH: Network/Connection Exceptions or Timeout
       * Triggered if: Backend is offline, CORS issues, DNS failure, or 6s timeout exceeded.
       */
      console.warn('[AUTH] Network or timeout exception during login. Attempting offline fallback...');
      const offlineSuccess = await tryOfflineLogin();
      if (!offlineSuccess) {
        console.error('[AUTH_FATAL] Network/Server Exception:', err);
        toast.error('Service Unreachable: The system server is currently offline or timed out.');
      }
    } finally {
      // Cleanup UI state regardless of outcome
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
              src="/logo.png"
              alt="Shoelotskey logo"
              className="h-32 xs:h-36 sm:h-40 md:h-48 w-auto object-contain mx-auto transform -translate-x-0.5"
              fetchPriority="high"
              loading="eager"
              decoding="async"
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

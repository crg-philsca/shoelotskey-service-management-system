import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { Toaster } from '@/app/components/ui/sonner';
import { toast } from 'sonner';
import type { ErrorType } from '@/app/pages/ErrorPage';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';
import Login from '@/app/pages/Login';
import ForgotPassword from '@/app/pages/ForgotPassword';
import ResetPassword from '@/app/pages/ResetPassword';
import ErrorPage from '@/app/pages/ErrorPage';

import AuthenticatedApp from '@/app/AuthenticatedApp';
import PageLoader from '@/app/components/PageLoader';

// Lazy-loaded Public Tracking Pages
const CustomerTracking = lazy(() => import('@/app/pages/CustomerTracking'));

// --- OWASP A01: BROKEN ACCESS CONTROL (RBAC) ---

/**
 * ROOT COMPONENT: App
 * PURPOSE: Main entry point for the Shoelotskey SMS Frontend.
 * ARCHITECTURE: 
 * - Handles Client-side Routing (React Router)
 * - Manages Global User Auth State (Synced with Backend LoginRequest)
 * - Wraps application in Context Providers for 3NF Data (Orders, Services, Expenses, Activities)
 */
export default function App() {
  const [sysError, setSysError] = useState<ErrorType | null>(null);

  // Listen for global system errors dispatched from fetch interceptor
  useEffect(() => {
    const handleSysError = (e: any) => setSysError(e.detail);
    window.addEventListener('SHOELOTSKEY_SYS_ERROR', handleSysError);
    return () => window.removeEventListener('SHOELOTSKEY_SYS_ERROR', handleSysError);
  }, []);

  const isLoggingOutRef = useRef(false);

  // Listen for global auth expired events dispatched from fetch interceptor
  useEffect(() => {
    const handleAuthExpired = (e: any) => {
      // Only handle if there is an active session in storage
      const hasActiveSession = !!(localStorage.getItem('user') || sessionStorage.getItem('user'));
      if (!hasActiveSession) return;
      const msg = e.detail || 'Your session has expired. Please log in again.';
      handleLogout(msg);
    };
    window.addEventListener('SHOELOTSKEY_AUTH_EXPIRED', handleAuthExpired);
    return () => window.removeEventListener('SHOELOTSKEY_AUTH_EXPIRED', handleAuthExpired);
  }, []);

  const [user, setUser] = useState<{ id?: number; username: string; email?: string; role: 'owner' | 'staff' | 'front staff' | 'admin', token: string; permissions?: string[]; permissions_summary?: string } | null>(() => {
    // Check both localStorage and sessionStorage
    const saved = localStorage.getItem('user') || sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const handleLogin = (id: number, username: string, role: 'owner' | 'staff' | 'front staff' | 'admin', token: string, rememberMe: boolean = false, permissions?: string[], permissions_summary?: string) => {
    isLoggingOutRef.current = false;
    setSysError(null);
    const userData = { id, username, email: `${username}@shoelotskey.com`, role, token, rememberMe, permissions: permissions || [], permissions_summary };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = (customMessage?: any) => {
    if (isLoggingOutRef.current) return;

    setSysError(null);
    const saved = localStorage.getItem('user') || sessionStorage.getItem('user');
    let currentToken = user?.token;
    if (!currentToken && saved) {
      try {
        currentToken = JSON.parse(saved)?.token;
      } catch {}
    }

    // 1. Clear local browser credentials
    localStorage.removeItem('user');
    localStorage.removeItem('shoelotskey_offline_auth');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('shoelotskey_offline_auth');

    if (customMessage && typeof customMessage === 'string') {
      sessionStorage.setItem('logout_message', `error|${customMessage}`);
    } else {
      sessionStorage.setItem('logout_message', 'success|Logged out successfully!');
    }
    
    // 2. Clear user state (Redirects immediately to /login)
    setUser(null);

    // 3. Notify backend to revoke this specific session ID (single execution)
    if (currentToken) {
      isLoggingOutRef.current = true;
      fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      }).catch((err) => {
        console.warn('[SECURITY] Failed to record backend logout event:', err);
      }).finally(() => {
        setTimeout(() => {
          isLoggingOutRef.current = false;
        }, 1500);
      });
    }
  };

  // Cross-tab session synchronization (within same browser profile)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        if (!e.newValue) {
          // Logged out in another tab of this browser
          setUser(null);
          toast.info('Your session has ended. Please log in again.');
        } else {
          try {
            const newUser = JSON.parse(e.newValue);
            if (newUser?.token && newUser.token !== user?.token) {
              setUser(newUser);
            }
          } catch {
            setUser(null);
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user?.token]);

  // --- CONTINUOUS JWT & ACCOUNT LOCKOUT VALIDATION (OWASP A07 & ISO/IEC 25010 Security) ---
  useEffect(() => {
    if (!user?.token) return;

    // 1. Client-side expiration check (handles offline timeout immediately)
    try {
      const parts = user.token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          handleLogout('Your session has expired. Please log in again.');
          return;
        }
      }
    } catch (e) {
      handleLogout('Your session is invalid. Please log in again.');
      return;
    }

    // 2. Server-side session verification on startup and continuous heartbeat
    let isVerifying = false;
    const verifyActiveSession = async () => {
      if (isVerifying || !user?.token) return;
      isVerifying = true;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${API_BASE}/auth/verify-token`, {
          headers: { 'Authorization': `Bearer ${user.token}` },
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const reason = errData.detail || 'Your account access has been restricted or session has expired. Please log in again.';
          handleLogout(reason);
        } else if (res.ok) {
          const freshData = await res.json().catch(() => null);
          if (freshData && freshData.permissions) {
            setUser(prev => {
              if (!prev) return null;
              const hasDiff = JSON.stringify(prev.permissions) !== JSON.stringify(freshData.permissions);
              if (hasDiff) {
                const updated = { ...prev, permissions: freshData.permissions, permissions_summary: freshData.permissions_summary };
                localStorage.setItem('user', JSON.stringify(updated));
                sessionStorage.setItem('user', JSON.stringify(updated));
                return updated;
              }
              return prev;
            });
          }
        } else if (res.status >= 500) {
          console.warn(`[AUTH] Server exception (${res.status}) during session verification. Maintaining valid local JWT session.`);
        }
      } catch {
        // Server offline or network failure — operate from local cache
      } finally {
        isVerifying = false;
      }
    };

    let initialTimer: any;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = (window as any).requestIdleCallback(() => {
        verifyActiveSession();
      }, { timeout: 8000 });
      initialTimer = { cancel: () => (window as any).cancelIdleCallback(idleId) };
    } else {
      const timer = setTimeout(() => {
        verifyActiveSession();
      }, 8000);
      initialTimer = { cancel: () => clearTimeout(timer) };
    }

    // Periodic heartbeat (every 30s) + window focus check to verify account validity
    const heartbeatInterval = setInterval(verifyActiveSession, 30000);
    const onWindowFocus = () => verifyActiveSession();
    window.addEventListener('focus', onWindowFocus);

    let permsBc: BroadcastChannel | null = null;
    try {
      permsBc = new BroadcastChannel('shoelotskey_perms_channel');
      permsBc.onmessage = () => {
        verifyActiveSession();
      };
    } catch (_) {}

    return () => {
      initialTimer?.cancel();
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', onWindowFocus);
      if (permsBc) permsBc.close();
    };
  }, [user?.token]);

  // --- 30-MINUTE INACTIVITY TIMEOUT (OWASP A07) ---
  useEffect(() => {
    if (!user) return;
    
    let timeoutId: any;
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout('Your session has expired due to inactivity. Please log in again.');
      }, TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    
    resetTimer(); // Initial startup timer

    return () => {
      clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [user]);

  // Standalone public tracking routes are accessible to all customers unconditionally
  const isPublicTrackingRoute = 
    window.location.pathname.startsWith('/track') ||
    window.location.pathname.startsWith('/portal') ||
    window.location.pathname.startsWith('/customer-portal');

  if (isPublicTrackingRoute) {
    return (
      <BrowserRouter>
        <Suspense fallback={<PageLoader fullScreen />}>
          <Routes>
            <Route path="/track" element={<CustomerTracking />} />
            <Route path="/track/:orderNumber" element={<CustomerTracking />} />
            <Route path="/portal" element={<CustomerTracking />} />
            <Route path="/portal/:orderNumber" element={<CustomerTracking />} />
            <Route path="/customer-portal" element={<CustomerTracking />} />
            <Route path="*" element={<Navigate to="/track" replace />} />
          </Routes>
        </Suspense>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    );
  }

  if (sysError) {
    return (
      <BrowserRouter>
        <Suspense fallback={<PageLoader fullScreen />}>
          <ErrorPage 
            type={sysError} 
            onRetry={() => {
              setSysError(null);
              if (sysError === 'session') {
                window.location.href = '/login';
              } else {
                window.location.reload();
              }
            }} 
          />
        </Suspense>
      </BrowserRouter>
    );
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/track" element={<Suspense fallback={<PageLoader fullScreen />}><CustomerTracking /></Suspense>} />
          <Route path="/track/:orderNumber" element={<Suspense fallback={<PageLoader fullScreen />}><CustomerTracking /></Suspense>} />
          <Route path="/portal" element={<Suspense fallback={<PageLoader fullScreen />}><CustomerTracking /></Suspense>} />
          <Route path="/portal/:orderNumber" element={<Suspense fallback={<PageLoader fullScreen />}><CustomerTracking /></Suspense>} />
          <Route path="/customer-portal" element={<Suspense fallback={<PageLoader fullScreen />}><CustomerTracking /></Suspense>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/dashboard" element={<Navigate to="/login" replace />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AuthenticatedApp user={user} onLogout={handleLogout} />
      <Toaster position="top-center" richColors className="dashboard-toaster" />
    </BrowserRouter>
  );
}

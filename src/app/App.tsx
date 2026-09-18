import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense, useEffect } from 'react';
import { Toaster } from '@/app/components/ui/sonner';
import { toast } from 'sonner';
import Login from '@/app/pages/Login';
import ForgotPassword from '@/app/pages/ForgotPassword';
import ResetPassword from '@/app/pages/ResetPassword';
import Layout from '@/app/components/Layout';
import { OrderProvider } from '@/app/context/OrderContext';
import { ExpenseProvider } from '@/app/context/ExpenseContext';
import { ServiceProvider } from '@/app/context/ServiceContext';
import { ActivityProvider } from '@/app/context/ActivityContext';
import { InventoryProvider } from '@/app/context/InventoryContext';
import ActivityLogModal from '@/app/components/ActivityLogModal';
import ErrorPage, { ErrorType } from '@/app/pages/ErrorPage';
// P1-10 FIX: centralized API base resolution (see src/app/lib/apiBase.ts).
import { API_BASE } from '@/app/lib/apiBase';
// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('@/app/pages/Dashboard'));
const JobOrderForm = lazy(() => import('@/app/pages/JobOrderForm'));
const JobOrders = lazy(() => import('@/app/pages/JobOrders'));
const SalesReport = lazy(() => import('@/app/pages/SalesReport'));
const ServiceManagement = lazy(() => import('@/app/pages/ServiceManagement'));
const UserManagement = lazy(() => import('@/app/pages/UserManagement'));
const Inventory = lazy(() => import('@/app/pages/Inventory'));

const ReleaseCalendar = lazy(() => import('@/app/pages/ReleaseCalendar'));
const ClaimRecord = lazy(() => import('@/app/pages/ClaimRecord'));
const ActivityHistory = lazy(() => import('@/app/pages/ActivityHistory'));
const TotalSales = lazy(() => import('@/app/pages/TotalSales'));
const PaymentsReceived = lazy(() => import('@/app/pages/PaymentsReceived'));
const TotalOrders = lazy(() => import('@/app/pages/TotalOrders'));
const Expenses = lazy(() => import('@/app/pages/Expenses'));
const HistoricalRecords = lazy(() => import('@/app/pages/HistoricalRecords'));
const BackupRecovery = lazy(() => import('@/app/pages/BackupRecovery'));
const CustomerTracking = lazy(() => import('@/app/pages/CustomerTracking'));
const CashRegister = lazy(() => import('@/app/pages/CashRegister'));
const ResearchEvidence = lazy(() => import('@/app/pages/ResearchEvidence'));
const NotFound = lazy(() => import('@/app/pages/NotFound'));


// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
  </div>
);

// --- OWASP A01: BROKEN ACCESS CONTROL (RBAC) ---
const ProtectedRoute = ({
  children,
  allowedRoles,
  requiredUsername,
  user,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredUsername?: string;
  user: any;
}) => {
  if (!user) return <Navigate to="/login" replace />;
  const role = user.role?.toLowerCase() || '';
  const username = (user.username || '').toLowerCase().trim();

  if (requiredUsername && username !== requiredUsername.toLowerCase().trim()) {
    console.warn(`[SECURITY] Attempt to access ${window.location.pathname} by username ${user.username} (Forbidden)`);
    return <ErrorPage type="403" />;
  }

  if (allowedRoles) {
    const isFrontStaffFallback = allowedRoles.map(r => r.toLowerCase()).includes('front staff') && username === 'front_staff';
    const allowed = role === 'admin' || allowedRoles.some((r) => r.toLowerCase() === role) || isFrontStaffFallback;
    if (!allowed) {
      console.warn(`[SECURITY] Attempt to access ${window.location.pathname} by role ${user.role} (Forbidden)`);
      return <ErrorPage type="403" />;
    }
  }

  return <>{children}</>;
};


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

  // Listen for global auth expired events dispatched from fetch interceptor
  useEffect(() => {
    const handleAuthExpired = (e: any) => {
      const msg = e.detail || 'Your session has expired. Please log in again.';
      handleLogout(msg);
    };
    window.addEventListener('SHOELOTSKEY_AUTH_EXPIRED', handleAuthExpired);
    return () => window.removeEventListener('SHOELOTSKEY_AUTH_EXPIRED', handleAuthExpired);
  }, []);

  const [user, setUser] = useState<{ id?: number; username: string; email?: string; role: 'owner' | 'staff' | 'front staff' | 'admin', token: string } | null>(() => {
    // Check both localStorage and sessionStorage
    const saved = localStorage.getItem('user') || sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [headerActionRight, setHeaderActionRight] = useState<React.ReactNode>(null);
  const [headerCenter, setHeaderCenter] = useState<React.ReactNode>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Expose toggle to window for the Layout button
  useEffect(() => {
    (window as any).toggleActivityLog = () => setIsActivityModalOpen(prev => !prev);
    return () => { delete (window as any).toggleActivityLog; };
  }, []);

  const handleLogin = (id: number, username: string, role: 'owner' | 'staff' | 'front staff' | 'admin', token: string, rememberMe: boolean = false) => {
    setSysError(null);
    const userData = { id, username, email: `${username}@shoelotskey.com`, role, token, rememberMe };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = (customMessage?: any) => {
    setSysError(null);
    const currentToken = user?.token;

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

    // 3. Notify backend to revoke this specific session ID
    if (currentToken) {
      fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      }).catch((err) => {
        console.warn('[SECURITY] Failed to record backend logout event:', err);
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
        } else if (res.status >= 500) {
          console.warn(`[AUTH] Server exception (${res.status}) during session verification. Maintaining valid local JWT session.`);
        }
      } catch {
        // Server offline or network failure — operate from local cache
      } finally {
        isVerifying = false;
      }
    };

    verifyActiveSession();

    // Periodic heartbeat (every 30s) + window focus check to verify account validity
    const heartbeatInterval = setInterval(verifyActiveSession, 30000);
    const onWindowFocus = () => verifyActiveSession();
    window.addEventListener('focus', onWindowFocus);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', onWindowFocus);
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
        <Suspense fallback={<PageLoader />}>
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
      </BrowserRouter>
    );
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/track" element={<CustomerTracking />} />
            <Route path="/track/:orderNumber" element={<CustomerTracking />} />
            <Route path="/portal" element={<CustomerTracking />} />
            <Route path="/portal/:orderNumber" element={<CustomerTracking />} />
            <Route path="/customer-portal" element={<CustomerTracking />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/dashboard" element={<Navigate to="/login" replace />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    );
  }

  const allRoles = ['owner', 'staff', 'front staff', 'admin'];

  return (
    <BrowserRouter>
      <ActivityProvider user={user}>
        <OrderProvider user={user}>

          <ExpenseProvider user={user}>
            <InventoryProvider user={user}>
              <ServiceProvider user={user}>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Staff Protected Pages rendered inside Layout */}
                    <Route
                      path="/*"
                      element={
                        <Layout user={user} onLogout={handleLogout} headerAction={headerActionRight} headerCenter={headerCenter}>
                          <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/login" element={<Navigate to="/dashboard" replace />} />

                            <Route
                              path="/dashboard"
                              element={<ProtectedRoute allowedRoles={allRoles} user={user}><Dashboard user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>}
                            />
                            <Route path="/job-order-form" element={<ProtectedRoute allowedRoles={allRoles} user={user}><JobOrderForm user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/job-orders" element={<ProtectedRoute allowedRoles={allRoles} user={user}><JobOrders user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route
                              path="/cash-register"
                              element={<ProtectedRoute allowedRoles={['front staff', 'admin']} user={user}><CashRegister user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>}
                            />
                            <Route path="/release-calendar" element={<ProtectedRoute allowedRoles={allRoles} user={user}><ReleaseCalendar user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/claim-record" element={<ProtectedRoute allowedRoles={allRoles} user={user}><ClaimRecord user={user} /></ProtectedRoute>} />
                            <Route path="/activity-history" element={<ProtectedRoute allowedRoles={['owner', 'admin']} user={user}><ActivityHistory user={user} /></ProtectedRoute>} />
                            <Route path="/total-sales" element={<ProtectedRoute allowedRoles={['owner', 'admin']} user={user}><TotalSales user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/payments-received" element={<ProtectedRoute allowedRoles={['owner', 'admin']} user={user}><PaymentsReceived user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/payment-received" element={<Navigate to="/payments-received" replace />} />
                            <Route path="/payments" element={<Navigate to="/payments-received" replace />} />
                            <Route path="/total-orders" element={<ProtectedRoute allowedRoles={['owner', 'admin']} user={user}><TotalOrders user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/expenses" element={<ProtectedRoute allowedRoles={['owner', 'admin']} user={user}><Expenses user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/job-order-form/historical-records" element={<ProtectedRoute allowedRoles={['admin']} user={user}><HistoricalRecords user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/service-management/historical-records" element={<ProtectedRoute allowedRoles={['admin']} user={user}><HistoricalRecords user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                            <Route path="/ml-training" element={<ProtectedRoute allowedRoles={['admin']} user={user}><HistoricalRecords user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />

                            <Route 
                              path="/inventory" 
                              element={<ProtectedRoute allowedRoles={allRoles} user={user}><Inventory user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} 
                            />
                            <Route 
                              path="/sales-report" 
                              element={
                                <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                                  <SalesReport user={user} onSetHeaderActionRight={setHeaderActionRight} onSetHeaderCenter={setHeaderCenter} />
                                </ProtectedRoute>
                              } 
                            />
                            <Route 
                              path="/service-management" 
                              element={
                                <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                                  <ServiceManagement user={user} onSetHeaderActionRight={setHeaderActionRight} />
                                </ProtectedRoute>
                              } 
                            />
                            <Route 
                              path="/user-management" 
                              element={
                                <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                                  <UserManagement user={user} onSetHeaderActionRight={setHeaderActionRight} />
                                </ProtectedRoute>
                              } 
                            />
                            <Route 
                              path="/backup" 
                              element={
                                <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                                  <BackupRecovery user={user} />
                                </ProtectedRoute>
                              } 
                            />
                            <Route 
                              path="/research-evidence" 
                              element={
                                <ProtectedRoute allowedRoles={['admin']} user={user}>
                                  <ResearchEvidence user={user} />
                                </ProtectedRoute>
                              } 
                            />
                            <Route path="/404" element={<NotFound />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Layout>
                      }
                    />
                  </Routes>
                </Suspense>
              </ServiceProvider>
            </InventoryProvider>
          </ExpenseProvider>
        </OrderProvider>
      <ActivityLogModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} />
      </ActivityProvider>
      <Toaster position="top-center" richColors className="dashboard-toaster" />
    </BrowserRouter>
  );
}

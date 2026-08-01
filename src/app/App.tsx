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
const TotalOrders = lazy(() => import('@/app/pages/TotalOrders'));
const Expenses = lazy(() => import('@/app/pages/Expenses'));
// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173'))
  ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname}:8000/api`
  : '/api';

// --- OWASP A01: BROKEN ACCESS CONTROL (RBAC) ---
const ProtectedRoute = ({ children, allowedRoles, user }: { children: React.ReactNode, allowedRoles: string[], user: { role: string } | null }) => {
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    console.warn(`[SECURITY] Attempt to access ${window.location.pathname} by role ${user.role} (Forbidden)`);
    return <Navigate to="/dashboard" replace />;
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
  const [user, setUser] = useState<{ id?: number; username: string; email?: string; role: 'owner' | 'staff', token: string } | null>(() => {
    // Check both localStorage (Remember Me checked) and sessionStorage (Remember Me unchecked)
    const saved = localStorage.getItem('user') || sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [headerActionRight, setHeaderActionRight] = useState<React.ReactNode>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Expose toggle to window for the Layout button
  useEffect(() => {
    (window as any).toggleActivityLog = () => setIsActivityModalOpen(prev => !prev);
    return () => { delete (window as any).toggleActivityLog; };
  }, []);

  const handleLogin = (id: number, username: string, role: 'owner' | 'staff', token: string, rememberMe: boolean = false) => {
    const userData = { id, username, email: `${username}@shoelotskey.com`, role, token };
    setUser(userData);
    if (rememberMe) {
      localStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.removeItem('user');
    } else {
      sessionStorage.setItem('user', JSON.stringify(userData));
      localStorage.removeItem('user');
    }
  };

  const handleLogout = (customMessage?: any) => {
    const currentToken = user?.token;
    setUser(null); // Log out immediately on the very first click without network delay
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    localStorage.removeItem('shoelotskey_offline_auth');
    sessionStorage.removeItem('shoelotskey_offline_auth');
    
    if (customMessage && typeof customMessage === 'string') {
      setTimeout(() => toast.error(customMessage, { duration: 6000 }), 150);
    }

    if (currentToken) {
      fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      }).catch((err) => {
        console.warn('[SECURITY] Failed to record backend logout event:', err);
      });
    }
  };

  // --- STARTUP JWT VALIDATION (OWASP A07 & ISO/IEC 25010 Security) ---
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

    // 2. Server-side session verification on startup (with timeout resilience)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    fetch(`${API_BASE}/auth/verify-token`, {
      headers: { 'Authorization': `Bearer ${user.token}` },
      signal: controller.signal
    }).then(res => {
      clearTimeout(timer);
      if (res.status === 401 || res.status === 403) {
        handleLogout('Your session has expired. Please log in again.');
      } else if (res.status >= 500) {
        console.warn(`[AUTH] Server exception (${res.status}) during startup verification. Maintaining valid local JWT session.`);
      }
    }).catch(() => {
      clearTimeout(timer);
      console.warn('[AUTH] Server offline or network failure during startup token verification. Operating from local cache.');
    });
  }, []);

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

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
        <Toaster position="top-center" />
      </BrowserRouter>
    );
  }

  const allRoles = ['owner', 'staff'];

  return (
    <BrowserRouter>
      <ActivityProvider user={user}>
        <OrderProvider user={user}>

          <ExpenseProvider user={user}>
            <InventoryProvider user={user}>
              <ServiceProvider user={user}>
                <Layout user={user} onLogout={handleLogout} headerAction={headerActionRight}>
                  <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route
                      path="/dashboard"
                      element={<ProtectedRoute allowedRoles={allRoles} user={user}><Dashboard user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>}
                    />
                    <Route path="/job-order-form" element={<ProtectedRoute allowedRoles={allRoles} user={user}><JobOrderForm user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                    <Route path="/job-orders" element={<ProtectedRoute allowedRoles={allRoles} user={user}><JobOrders user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                    <Route path="/release-calendar" element={<ProtectedRoute allowedRoles={allRoles} user={user}><ReleaseCalendar user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                    <Route path="/claim-record" element={<ProtectedRoute allowedRoles={allRoles} user={user}><ClaimRecord user={user} /></ProtectedRoute>} />
                    <Route path="/activity-history" element={<ProtectedRoute allowedRoles={allRoles} user={user}><ActivityHistory user={user} /></ProtectedRoute>} />
                    <Route path="/total-sales" element={<ProtectedRoute allowedRoles={allRoles} user={user}><TotalSales user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                    <Route path="/total-orders" element={<ProtectedRoute allowedRoles={allRoles} user={user}><TotalOrders user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                    <Route path="/expenses" element={<ProtectedRoute allowedRoles={allRoles} user={user}><Expenses user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} />
                    <Route 
                      path="/inventory" 
                      element={<ProtectedRoute allowedRoles={allRoles} user={user}><Inventory user={user} onSetHeaderActionRight={setHeaderActionRight} /></ProtectedRoute>} 
                    />
                    <Route 
                      path="/sales-report" 
                      element={
                        <ProtectedRoute allowedRoles={['owner']} user={user}>
                          <SalesReport user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/service-management" 
                      element={
                        <ProtectedRoute allowedRoles={['owner']} user={user}>
                          <ServiceManagement user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/user-management" 
                      element={
                        <ProtectedRoute allowedRoles={['owner']} user={user}>
                          <UserManagement user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
                </Layout>
              </ServiceProvider>
            </InventoryProvider>
          </ExpenseProvider>
        </OrderProvider>
      <ActivityLogModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} />
      </ActivityProvider>
      <Toaster className="dashboard-toaster" />
    </BrowserRouter>
  );
}

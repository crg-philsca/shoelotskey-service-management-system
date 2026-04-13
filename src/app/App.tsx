import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense, useEffect } from 'react';
import { Toaster } from '@/app/components/ui/sonner';
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

    // Initialize from localStorage
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [headerActionRight, setHeaderActionRight] = useState<React.ReactNode>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Expose toggle to window for the Layout button
  useEffect(() => {
    (window as any).toggleActivityLog = () => setIsActivityModalOpen(prev => !prev);
    return () => { delete (window as any).toggleActivityLog; };
  }, []);

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const handleLogin = (id: number, username: string, role: 'owner' | 'staff', token: string) => {
    setUser({ id, username, email: `${username}@shoelotskey.com`, role, token });
  };


  const handleLogout = () => {
    setUser(null);
  };


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
                      element={<Dashboard user={user} onSetHeaderActionRight={setHeaderActionRight} />}
                    />
                    <Route path="/job-order-form" element={<JobOrderForm user={user} onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/job-orders" element={<JobOrders user={user} onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/release-calendar" element={<ReleaseCalendar user={user} onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/claim-record" element={<ClaimRecord user={user} />} />
                    <Route path="/activity-history" element={<ActivityHistory user={user} />} />
                    <Route path="/total-sales" element={<TotalSales user={user} onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/total-orders" element={<TotalOrders user={user} onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/expenses" element={<Expenses user={user} onSetHeaderActionRight={setHeaderActionRight} />} />
                    {user.role === 'owner' && (
                      <>
                        <Route 
                          path="/sales-report" 
                          element={
                            <ProtectedRoute allowedRoles={['owner']} user={user}>
                              <SalesReport user={user} onSetHeaderActionRight={setHeaderActionRight} />
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/inventory" 
                          element={
                            <ProtectedRoute allowedRoles={['owner']} user={user}>
                              <Inventory user={user} onSetHeaderActionRight={setHeaderActionRight} />
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
                      </>
                    )}
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

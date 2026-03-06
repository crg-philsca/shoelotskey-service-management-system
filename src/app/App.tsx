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

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('@/app/pages/Dashboard'));
const JobOrderForm = lazy(() => import('@/app/pages/JobOrderForm'));
const JobOrders = lazy(() => import('@/app/pages/JobOrders'));
const SalesReport = lazy(() => import('@/app/pages/SalesReport'));
const ServiceManagement = lazy(() => import('@/app/pages/ServiceManagement'));
const UserManagement = lazy(() => import('@/app/pages/UserManagement'));

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

export default function App() {
  const [user, setUser] = useState<{ username: string; email?: string; role: 'owner' | 'staff' } | null>(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [headerActionRight, setHeaderActionRight] = useState<React.ReactNode>(null);

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const handleLogin = (username: string, role: 'owner' | 'staff') => {
    setUser({ username, email: `${username}@shoelotskey.com`, role });
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
      <ActivityProvider>
        <OrderProvider>
          <ExpenseProvider>
            <ServiceProvider>
              <Layout user={user} onLogout={handleLogout} headerAction={headerActionRight}>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route
                      path="/dashboard"
                      element={<Dashboard user={user} onSetHeaderActionRight={setHeaderActionRight} />}
                    />
                    <Route path="/job-order-form" element={<JobOrderForm user={user} onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/job-orders" element={<JobOrders user={user} onSetHeaderAction={setHeaderActionRight} />} />
                    <Route path="/release-calendar" element={<ReleaseCalendar onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/claim-record" element={<ClaimRecord />} />
                    <Route path="/activity-history" element={<ActivityHistory />} />
                    <Route path="/total-sales" element={<TotalSales onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/total-orders" element={<TotalOrders onSetHeaderActionRight={setHeaderActionRight} />} />
                    <Route path="/expenses" element={<Expenses onSetHeaderActionRight={setHeaderActionRight} />} />
                    {user.role === 'owner' && (
                      <>
                        <Route path="/sales-report" element={<SalesReport onSetHeaderActionRight={setHeaderActionRight} />} />
                        <Route path="/service-management" element={<ServiceManagement onSetHeaderActionRight={setHeaderActionRight} />} />
                        <Route path="/user-management" element={<UserManagement onSetHeaderAction={setHeaderActionRight} />} />
                      </>
                    )}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ServiceProvider>
          </ExpenseProvider>
        </OrderProvider>
      </ActivityProvider>
      <Toaster className="dashboard-toaster" />
    </BrowserRouter>
  );
}

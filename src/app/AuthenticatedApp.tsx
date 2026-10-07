import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense, useEffect } from 'react';
import Layout from '@/app/components/Layout';
import { OrderProvider } from '@/app/context/OrderContext';
import { ExpenseProvider } from '@/app/context/ExpenseContext';
import { ServiceProvider } from '@/app/context/ServiceContext';
import { ActivityProvider } from '@/app/context/ActivityContext';
import { InventoryProvider } from '@/app/context/InventoryContext';
import Dashboard from '@/app/pages/Dashboard';
import ErrorPage from '@/app/pages/ErrorPage';
import PageLoader from '@/app/components/PageLoader';

// Lazy-loaded secondary pages (loaded on-demand when user navigates to them)
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
const CashRegister = lazy(() => import('@/app/pages/CashRegister'));
const ResearchEvidence = lazy(() => import('@/app/pages/ResearchEvidence'));
const NotFound = lazy(() => import('@/app/pages/NotFound'));
const ActivityLogModal = lazy(() => import('@/app/components/ActivityLogModal'));


// RBAC Protected Route Guard
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
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorPage type="403" />
      </Suspense>
    );
  }

  if (allowedRoles) {
    const isFrontStaffFallback = allowedRoles.map(r => r.toLowerCase()).includes('front staff') && username === 'front_staff';
    const allowed = role === 'admin' || allowedRoles.some((r) => r.toLowerCase() === role) || isFrontStaffFallback;
    if (!allowed) {
      console.warn(`[SECURITY] Attempt to access ${window.location.pathname} by role ${user.role} (Forbidden)`);
      return (
        <Suspense fallback={<PageLoader />}>
          <ErrorPage type="403" />
        </Suspense>
      );
    }
  }

  return <>{children}</>;
};

export interface AuthenticatedAppProps {
  user: {
    id?: number;
    username: string;
    email?: string;
    role: 'owner' | 'staff' | 'front staff' | 'admin';
    token: string;
    permissions?: string[];
    permissions_summary?: string;
  };
  onLogout: (customMessage?: any) => void;
}

export default function AuthenticatedApp({ user, onLogout }: AuthenticatedAppProps) {
  const [headerActionRight, setHeaderActionRight] = useState<React.ReactNode>(null);
  const [headerCenter, setHeaderCenter] = useState<React.ReactNode>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Expose toggle to window for the Layout button
  useEffect(() => {
    (window as any).toggleActivityLog = () => setIsActivityModalOpen(prev => !prev);
    return () => { delete (window as any).toggleActivityLog; };
  }, []);

  const allRoles = ['owner', 'staff', 'front staff', 'admin'];

  return (
    <ActivityProvider user={user}>
      <OrderProvider user={user}>
        <ExpenseProvider user={user}>
          <InventoryProvider user={user}>
            <ServiceProvider user={user}>
              <Layout user={user} onLogout={onLogout} headerAction={headerActionRight} headerCenter={headerCenter}>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/login" element={<Navigate to="/dashboard" replace />} />

                    {/* Dashboard is statically imported for instant, direct rendering */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={allRoles} user={user}>
                          <Dashboard user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />

                    {/* Secondary pages are lazy loaded on demand */}
                    <Route
                      path="/job-order-form"
                      element={
                        <ProtectedRoute allowedRoles={allRoles} user={user}>
                          <JobOrderForm user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/job-orders"
                      element={
                        <ProtectedRoute allowedRoles={allRoles} user={user}>
                          <JobOrders user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/cash-register"
                      element={
                        <ProtectedRoute allowedRoles={['front staff', 'admin']} user={user}>
                          <CashRegister user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/release-calendar"
                      element={
                        <ProtectedRoute allowedRoles={allRoles} user={user}>
                          <ReleaseCalendar user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/claim-record"
                      element={
                        <ProtectedRoute allowedRoles={allRoles} user={user}>
                          <ClaimRecord user={user} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/activity-history"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                          <ActivityHistory user={user} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/total-sales"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                          <TotalSales user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/payments-received"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                          <PaymentsReceived user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/payment-received" element={<Navigate to="/payments-received" replace />} />
                    <Route path="/payments" element={<Navigate to="/payments-received" replace />} />
                    <Route
                      path="/total-orders"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                          <TotalOrders user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/expenses"
                      element={
                        <ProtectedRoute allowedRoles={['owner', 'admin']} user={user}>
                          <Expenses user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/job-order-form/historical-records"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} user={user}>
                          <HistoricalRecords user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/service-management/historical-records"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} user={user}>
                          <HistoricalRecords user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ml-training"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} user={user}>
                          <HistoricalRecords user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/inventory"
                      element={
                        <ProtectedRoute allowedRoles={allRoles} user={user}>
                          <Inventory user={user} onSetHeaderActionRight={setHeaderActionRight} />
                        </ProtectedRoute>
                      }
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
                        <ProtectedRoute allowedRoles={['admin']} user={user}>
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
                </Suspense>
              </Layout>
            </ServiceProvider>
          </InventoryProvider>
        </ExpenseProvider>
      </OrderProvider>
      {isActivityModalOpen && (
        <Suspense fallback={null}>
          <ActivityLogModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} />
        </Suspense>
      )}
    </ActivityProvider>
  );
}

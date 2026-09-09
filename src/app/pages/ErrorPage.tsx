import React from 'react';
import {
  ShieldX,
  WifiOff,
  ServerCrash,
  TriangleAlert,
  Clock,
  RotateCcw,
  LayoutDashboard,
  LogIn,
} from 'lucide-react';
// P1-10 FIX: centralized API/static base resolution (see src/app/lib/apiBase.ts).
import { STATIC_BASE } from '@/app/lib/apiBase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorType =
  | '404'     // Page does not exist (unknown URL)
  | 'session' // JWT expired or inactivity timeout
  | '403'     // Authenticated but insufficient role (RBAC)
  | '500'     // Backend unhandled exception
  | 'network' // API unreachable / fetch failure
  | 'crash';  // React runtime error caught by GlobalErrorBoundary

export interface ErrorPageProps {
  type: ErrorType;
  onRetry?: () => void;       // Optional override for retry/reload action
  errorDetails?: string;      // Shown only in dev mode (localhost)
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-scenario configuration
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorConfig {
  icon: React.ReactNode;
  accentColor: string;
  iconColor: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryAction: () => void;
  secondaryLabel?: string;
  secondaryAction?: () => void;
  footer: string;
}

function buildConfig(type: ErrorType, onRetry?: () => void): ErrorConfig {
  const goLogin     = () => { window.location.href = '/login'; };
  const goDashboard = () => { window.location.href = '/dashboard'; };
  const reload      = () => { onRetry ? onRetry() : window.location.reload(); };

  switch (type) {

    case 'session':
      return {
        icon: <Clock className="w-10 h-10" />,
        accentColor: 'bg-amber-50',
        iconColor: 'text-amber-600',
        title: 'Session Expired',
        description:
          'The session ended due to inactivity. Please sign in again to continue.',
        primaryLabel: 'Sign In Again',
        primaryAction: goLogin,
        footer: 'Your security comes first.',
      };

    case '403':
      return {
        icon: <ShieldX className="w-10 h-10" />,
        accentColor: 'bg-red-50',
        iconColor: 'text-red-600',
        title: 'Access Restricted',
        description:
          'The account does not have permission to access this page. This area is restricted to authorized roles only.',
        primaryLabel: 'Back to Dashboard',
        primaryAction: goDashboard,
        footer: 'Need additional access? Contact the system administrator.',
      };

    case '500':
      return {
        icon: <ServerCrash className="w-10 h-10" />,
        accentColor: 'bg-rose-50',
        iconColor: 'text-rose-600',
        title: 'Something Went Wrong',
        description:
          'An unexpected error occurred while processing the request. Please try again. If the problem persists, contact the system administrator.',
        primaryLabel: 'Try Again',
        primaryAction: reload,
        secondaryLabel: 'Back to Dashboard',
        secondaryAction: goDashboard,
        footer: 'Our team is working to get things back on track.',
      };

    case 'network':
      return {
        icon: <WifiOff className="w-10 h-10" />,
        accentColor: 'bg-slate-100',
        iconColor: 'text-slate-500',
        title: 'Connection Lost',
        description:
          'Unable to reach the server. If offline mode is available, your work will continue using the local database and synchronize automatically when the connection is restored.',
        primaryLabel: 'Retry',
        primaryAction: reload,
        footer: 'The system is designed to recover. Please wait a moment.',
      };

    case 'crash':
      return {
        icon: <TriangleAlert className="w-10 h-10" />,
        accentColor: 'bg-orange-50',
        iconColor: 'text-orange-600',
        title: 'Something Went Wrong',
        description:
          'An unexpected error occurred in the application. The system intercepted the issue to prevent a blank screen. Please refresh or return to the dashboard.',
        primaryLabel: 'Refresh Page',
        primaryAction: reload,
        secondaryLabel: 'Back to Dashboard',
        secondaryAction: goDashboard,
        footer: 'The system intercepted this error to keep the application running.',
      };

    case '404':
    default:
      return {
        icon: null,
        accentColor: '',
        iconColor: '',
        title: 'Oops! Page needs a shine.',
        description:
          'The page you are looking for could not be found. It may have been moved, deleted, or the link may be incorrect.',
        primaryLabel: 'Back to Dashboard',
        primaryAction: goDashboard,
        footer: "Good shoes take you to great places... but this link doesn't!",
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ErrorPage: React.FC<ErrorPageProps> = ({ type, onRetry, errorDetails }) => {
  React.useEffect(() => {
    document.body.setAttribute('data-error-page', 'true');
    return () => document.body.removeAttribute('data-error-page');
  }, []);

  const config = buildConfig(type, onRetry);
  const isDev  =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // ── 404 — Shoe illustration layout ──────────────────────────────────────
  if (type === '404') {
    return (
      <div className="bg-white flex flex-col min-h-screen w-full font-sans animate-fadeIn">
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4 py-12">

          <div className="mb-8 animate-shoe-walk flex items-center justify-center">
            <img
              src="/static/branded_shoe_404.png"
              style={{ mixBlendMode: 'multiply' }}
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                if (!t.dataset.retried) {
                  t.dataset.retried = 'true';
                  // P1-10 FIX: use the centralized local-dev backend origin instead of a
                  // bare hardcoded localhost:8000 (harmless in prod either way since it
                  // already falls through to /logo.png, but keep the resolution logic
                  // in one place).
                  t.src = `${STATIC_BASE}/static/branded_shoe_404.png`;
                } else {
                  t.src = '/logo.png';
                }
              }}
              alt="Shoelotskey 404"
              className="h-64 w-auto mx-auto select-none block border-none outline-none"
            />
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            {config.title}
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-lg leading-relaxed font-medium">
            {config.description}
          </p>

          <button
            onClick={config.primaryAction}
            className="inline-flex items-center justify-center bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 px-10 rounded-2xl shadow-xl transform transition hover:-translate-y-1 active:scale-95 duration-200 uppercase tracking-widest text-sm"
          >
            <LayoutDashboard className="h-5 w-5 mr-3" />
            {config.primaryLabel}
          </button>

          <p className="mt-16 text-sm text-gray-400 italic font-medium">
            &quot;{config.footer}&quot;
          </p>
        </div>
      </div>
    );
  }

  // ── All other types — enterprise card layout ─────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 font-sans px-4 py-12 animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

        {/* Brand red top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#dc2626] via-[#ef4444] to-[#f97316]" />

        <div className="p-8 sm:p-10 text-center">

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className={`flex items-center justify-center w-20 h-20 rounded-2xl ${config.accentColor} ${config.iconColor}`}
            >
              {config.icon}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
            {config.title}
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-gray-500 leading-relaxed mb-8 max-w-sm mx-auto">
            {config.description}
          </p>

          {/* Dev-only error details */}
          {isDev && errorDetails && (
            <div className="mb-6 bg-gray-900 rounded-xl p-4 text-left text-xs font-mono text-rose-300 overflow-x-auto max-h-28 whitespace-pre-wrap border border-gray-800">
              {errorDetails}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {config.secondaryLabel && config.secondaryAction && (
              <button
                onClick={config.secondaryAction}
                className="inline-flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-semibold py-3 px-6 rounded-xl transition-all duration-200 text-sm"
              >
                <LayoutDashboard className="h-4 w-4" />
                {config.secondaryLabel}
              </button>
            )}

            <button
              onClick={config.primaryAction}
              className="inline-flex items-center justify-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transform transition-all duration-200 hover:-translate-y-0.5 active:scale-95 text-sm"
            >
              {(type === 'session') ? (
                <LogIn className="h-4 w-4" />
              ) : (type === 'network' || type === '500' || type === 'crash') ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <LayoutDashboard className="h-4 w-4" />
              )}
              {config.primaryLabel}
            </button>
          </div>

          {/* Footer */}
          <p className="mt-8 text-xs text-gray-400 italic">
            &quot;{config.footer}&quot;
          </p>
        </div>
      </div>

      {/* System branding */}
      <p className="mt-6 text-xs text-gray-400 font-medium tracking-widest uppercase">
        Shoelotskey Service Management System
      </p>
    </div>
  );
};

export default ErrorPage;

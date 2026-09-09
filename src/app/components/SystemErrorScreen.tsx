import React from 'react';
import { Button } from '@/app/components/ui/button';
import { AlertTriangle, Home, ArrowLeft, ShieldAlert, Wrench, RefreshCw, ServerOff, Terminal } from 'lucide-react';
// P1-10 FIX: centralized API/static base resolution (see src/app/lib/apiBase.ts).
import { STATIC_BASE } from '@/app/lib/apiBase';


export interface SystemErrorScreenProps {
  type?: '404' | 'error' | 'maintenance' | 'offline';
  title?: string;
  message?: string;
  errorCode?: string;
  errorDetails?: string;
  onRetry?: () => void;
}

const SystemErrorScreen: React.FC<SystemErrorScreenProps> = ({
  type = 'error',
  title,
  message,
  errorCode,
  errorDetails,
  onRetry
}) => {
  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/dashboard';
    }
  };

  const handleGoDashboard = () => {
    window.location.href = '/dashboard';
  };

  const handleReload = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  // [LEGACY 404 CONTAINERLESS PRESENTATION]
  // Render exact original 404 page content with bouncing 3D sneaker, without any container modification
  if (type === '404') {

    return (
      <div className="bg-white flex flex-col min-h-screen w-full font-sans animate-fadeIn">
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4 py-12">
          {/* Branded 3D Sneaker with Walking Animation & Seamless Multiply Blending */}
          <div className="mb-8 animate-shoe-walk flex items-center justify-center">
            <img 
              src="/static/branded_shoe_404.png" 
              style={{ mixBlendMode: 'multiply' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.retried) {
                  target.dataset.retried = "true";
                  // P1-10 FIX: use the centralized local-dev backend origin instead of a
                  // bare hardcoded localhost:8000.
                  target.src = `${STATIC_BASE}/static/branded_shoe_404.png`;
                } else {
                  target.src = "/logo.png";
                }
              }}
              alt="Shoelotskey 404" 
              className="h-64 w-auto mx-auto select-none block border-none outline-none" 
            />
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Oops! Page needs a shine.
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-lg leading-relaxed font-medium">
            We couldn't find the page you're looking for. It might have been moved, deleted, or perhaps it's just getting a basic cleaning. Let's get you back to the login page!
          </p>

          <div className="flex flex-col items-center">
            {/* Shoelotskey Brand Red Button as native anchor tag for bulletproof routing */}
            <a 
              href="/login"
              className="inline-flex items-center justify-center bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 px-10 rounded-2xl shadow-xl transform transition hover:-translate-y-1 active:scale-95 duration-200 uppercase tracking-widest text-sm no-underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Back to Login
            </a>
          </div>

          <p className="mt-16 text-sm text-gray-400 italic font-medium">
            &quot;Good shoes take you to great places... but this link doesn&apos;t!&quot;
          </p>
        </div>
      </div>
    );
  }

  // Configure appearance based on mode (for System Bugs, Offline, Maintenance states)
  const getConfig = () => {
    switch (type) {
      case 'maintenance':
        return {
          icon: <Wrench className="w-12 h-12 stroke-[1.75] text-amber-600 animate-pulse" />,
          defaultTitle: 'SYSTEM UNDER MAINTENANCE',
          badgeText: 'Scheduled Service & DB Sync',
          badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300',
          defaultMsg: "Shoelotskey Service Management System is undergoing routine architectural maintenance, ETL synchronization, or database optimization. Please stand by while the engine updates.",
          code: errorCode || 'SYS_MAINTENANCE_ACTIVE',
          status: 'Shoelotskey Engine | Maintenance Lock Active',
          primaryBtnText: 'Refresh Engine',
          primaryBtnAction: handleReload,
          primaryBtnIcon: <RefreshCw className="h-4 w-4 animate-spin-hover" />,
          secondaryBtnText: 'Dashboard',
          secondaryBtnAction: handleGoDashboard,
          secondaryBtnIcon: <Home className="h-4 w-4" />
        };
      case 'offline':
        return {
          icon: <ServerOff className="w-12 h-12 stroke-[1.75] text-rose-600 animate-bounce" />,
          defaultTitle: 'SYSTEM DOWN / UNREACHABLE',
          badgeText: 'Server Connection Interrupted',
          badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
          defaultMsg: "We lost connection with the Shoelotskey server cluster or database backend. The system is operating in failover defense mode to prevent data corruption.",
          code: errorCode || 'ERR_503_SERVICE_DOWN',
          status: 'Shoelotskey Engine | Connection Lost',
          primaryBtnText: 'Reconnect Now',
          primaryBtnAction: handleReload,
          primaryBtnIcon: <RefreshCw className="h-4 w-4" />,
          secondaryBtnText: 'Go Back',
          secondaryBtnAction: handleGoBack,
          secondaryBtnIcon: <ArrowLeft className="h-4 w-4" />
        };
      case 'error':
      default:
        return {
          icon: <ShieldAlert className="w-12 h-12 stroke-[1.75] text-red-600 animate-pulse" />,
          defaultTitle: 'SYSTEM EXCEPTION DETECTED',
          badgeText: 'Shoelotskey Diagnostic Defender Trap',
          badgeClass: 'bg-red-100 text-red-800 border border-red-300',
          defaultMsg: "An unexpected runtime exception or system bug occurred in this module. Instead of terminating to a blank page, our automated fault tolerance defender intercepted the execution.",
          code: errorCode || 'ERR_UI_COMPONENT_CRASH',
          status: 'Shoelotskey Engine | Interceptor Engaged',
          primaryBtnText: 'Re-Ignite Engine',
          primaryBtnAction: handleReload,
          primaryBtnIcon: <RefreshCw className="h-4 w-4" />,
          secondaryBtnText: 'Dashboard',
          secondaryBtnAction: handleGoDashboard,
          secondaryBtnIcon: <Home className="h-4 w-4" />
        };
    }
  };

  const config = getConfig();

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 w-full animate-fadeIn bg-slate-50/50 font-sans">
      <div className="max-w-xl w-full bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-12 shadow-2xl border border-gray-200/80 text-center relative overflow-hidden">
        {/* Top gradient decorative border */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-700 via-red-600 to-amber-500"></div>

        {/* Illuminated Emblem */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-2 bg-red-100 rounded-full blur-md opacity-70 animate-pulse"></div>
            <div className="relative bg-red-50 text-red-600 border border-red-200/80 p-5 rounded-2xl shadow-inner flex items-center justify-center">
              {config.icon}
            </div>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3 uppercase">
          {title || config.defaultTitle}
        </h1>

        <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-4 shadow-2xs ${config.badgeClass}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{config.badgeText}</span>
        </div>

        <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto mb-6 font-medium">
          {message || config.defaultMsg}
        </p>

        {/* System Diagnostic Terminal Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-8 text-left max-w-sm mx-auto shadow-inner text-gray-200">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 pb-2 border-b border-gray-800">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Terminal className="w-3.5 h-3.5" />
              Diagnostics Log
            </span>
            <span className="text-red-400 font-mono font-black">{config.code}</span>
          </div>
          <div className="text-[12px] text-gray-300 font-mono truncate py-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-ping" />
            <span className="truncate text-emerald-400">{config.status}</span>
          </div>
          {errorDetails && (
            <div className="mt-2 pt-2 border-t border-gray-800 text-[11px] font-mono text-rose-300 bg-gray-950/80 p-2 rounded-lg overflow-x-auto max-h-24 custom-scrollbar whitespace-pre-wrap">
              {errorDetails}
            </div>
          )}
        </div>

        {/* Symmetrical Elongated Centered Buttons */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-100 w-full max-w-md mx-auto">
          <Button 
            variant="outline" 
            onClick={config.secondaryBtnAction} 
            className="flex-1 h-12 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-100 hover:text-gray-900 justify-center gap-2 shadow-sm transition-all"
          >
            {config.secondaryBtnIcon}
            {config.secondaryBtnText}
          </Button>
          <Button 
            onClick={config.primaryBtnAction} 
            className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            {config.primaryBtnIcon}
            {config.primaryBtnText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SystemErrorScreen;

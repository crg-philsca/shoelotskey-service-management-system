import React, { useState, useEffect } from 'react';
import { STATIC_BASE } from '@/app/lib/apiBase';

interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  message = 'Loading...',
  fullScreen = false
}) => {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    // If stuck loading for over 4.5s (e.g. aborted chunk from rapid reload), offer quick recovery
    const timer = setTimeout(() => setShowReload(true), 4500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center select-none transition-opacity duration-200 ${
        fullScreen ? 'min-h-screen w-full bg-slate-50' : 'min-h-[60vh] w-full py-10'
      }`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center justify-center text-center">
        {/* 1. Prominent Shoelotskey Brand Logo */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
          <img
            src="/logo.webp"
            alt="Shoelotskey"
            width={176}
            height={176}
            className="w-full h-full object-contain pointer-events-none drop-shadow-md select-none"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* 2. Running Shoelotskey Sneaker Animation (Centered Hero Motion) */}
        <div className="relative flex flex-col items-center justify-center select-none pointer-events-none -mt-2">
          {/* Soft ambient spotlight glow */}
          <div className="absolute w-44 sm:w-56 h-12 bg-gradient-to-r from-red-500/10 via-orange-500/15 to-red-500/10 rounded-full blur-xl -z-10" />

          {/* Running sneaker with energetic stride */}
          <div className="animate-shoe-run flex items-center justify-center">
            <img
              src="/static/branded_shoe_404.png?v=pristine_cutout"
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                if (!t.dataset.retried) {
                  t.dataset.retried = 'true';
                  t.src = `${STATIC_BASE}/static/branded_shoe_404.png?v=pristine_cutout`;
                }
              }}
              alt="Shoelotskey running shoe"
              width={120}
              height={75}
              className="h-20 sm:h-24 w-auto object-contain select-none drop-shadow-md"
              loading="eager"
            />
          </div>

          {/* Contact floor shadow that pulses in sync with the stride */}
          <div className="w-28 sm:w-36 h-2 bg-slate-400/25 rounded-full mx-auto blur-[2px] mt-1 animate-shadow-pulse" />
        </div>

        {/* 3. Balanced Status Row: Spinner directly before loading text */}
        <div className="flex items-center justify-center gap-2 mt-4 text-slate-500">
          <div className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-600 rounded-full animate-spin shrink-0" />
          <span className="text-[11px] font-bold tracking-widest uppercase leading-none">
            {message}
          </span>
        </div>

        {/* 4. Anti-Stuck Safeguard: Quick reload button if loading takes unusually long */}
        {showReload && (
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Taking longer than usual? Click to refresh
          </button>
        )}
      </div>
    </div>
  );
};

export default PageLoader;


  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import GlobalErrorBoundary from "./app/components/GlobalErrorBoundary.tsx";
  import "./styles/index.css";

  // --- GLOBAL FETCH INTERCEPTOR (Error Integration) ---
  //
  // P1-11 FIX (HIGH-5): This previously dispatched SHOELOTSKEY_SYS_ERROR — which App.tsx
  // uses to unmount every route/context and render a single full-screen error page — on the
  // very FIRST 500 or network TypeError from *any* fetch call anywhere in the app. A single
  // transient blip on one background/non-critical request (a poll, a secondary widget load)
  // could blank every open module, not just the one that actually failed. Per-request error
  // handling (toasts, inline messages) already exists in most Contexts for localized
  // failures; this interceptor should only escalate to the full-screen error state for a
  // genuinely sustained/widespread outage, not a single flaky call. A short debounce window
  // requiring multiple qualifying failures in quick succession preserves the legitimate
  // "backend is actually down" detection while no longer blanking the app on one-off errors.
  // Prevent Vite dynamic chunk load failures from getting stuck on reload/refresh spam
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite Preload Error] Module chunk fetch aborted or failed during reload. Refreshing:', event);
    window.location.reload();
  });

  let isPageUnloading = false;
  window.addEventListener('beforeunload', () => {
    isPageUnloading = true;
  });

  const originalFetch = window.fetch;
  const SYS_ERROR_FAILURE_THRESHOLD = 3;
  const SYS_ERROR_WINDOW_MS = 8000;
  let recentFailureTimestamps: number[] = [];

  const reportPossibleSystemFailure = (detail: '500' | 'network') => {
    if (isPageUnloading) return;
    const now = Date.now();
    recentFailureTimestamps = recentFailureTimestamps.filter((t) => now - t < SYS_ERROR_WINDOW_MS);
    recentFailureTimestamps.push(now);
    if (recentFailureTimestamps.length >= SYS_ERROR_FAILURE_THRESHOLD) {
      recentFailureTimestamps = [];
      window.dispatchEvent(new CustomEvent('SHOELOTSKEY_SYS_ERROR', { detail }));
    }
  };

  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
    const isPublicTracking = window.location.pathname.startsWith('/track') || 
                             window.location.pathname.startsWith('/portal') ||
                             window.location.pathname.startsWith('/customer-portal');
    const isExcludedFromSystemError = 
      isPublicTracking ||
      url.includes('/orders/track') ||
      url.includes('/verify-token') || 
      url.includes('/health-check') || 
      url.includes('limit=1');

    try {
      const response = await originalFetch(...args);
      // Intercept 401 unauthenticated responses from protected APIs
      if (response.status === 401) {
        const isAuthEndpoint = 
          url.includes('/login') || 
          url.includes('/logout') || 
          url.includes('/forgot-password') || 
          url.includes('/reset-password') || 
          url.includes('/verify-token') || 
          url.includes('/predict') ||
          url.includes('/authorize') ||
          isPublicTracking;

        if (!isAuthEndpoint) {
          const hasActiveSession = !!(localStorage.getItem('user') || sessionStorage.getItem('user'));
          if (hasActiveSession) {
            window.dispatchEvent(new CustomEvent('SHOELOTSKEY_AUTH_EXPIRED', { detail: 'Your session has expired. Please log in again.' }));
          }
        }
      } else if (response.status >= 500 && !isExcludedFromSystemError) {
        reportPossibleSystemFailure('500');
      } else if (response.ok) {
        // A successful request proves the backend is currently reachable — clear any
        // partial failure streak so an isolated blip doesn't compound with a later one.
        recentFailureTimestamps = [];
      }
      return response;
    } catch (error: any) {
      // Aborted or cancelled requests (common when spamming reload or navigating) must NOT trigger system errors
      const isAbort = error?.name === 'AbortError' || error?.message?.includes('aborted');
      if (error instanceof TypeError && !isExcludedFromSystemError && !isPageUnloading && !isAbort) {
        reportPossibleSystemFailure('network');
      }
      throw error;
    }
  };

  createRoot(document.getElementById("root")!).render(
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
  
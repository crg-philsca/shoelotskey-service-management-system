
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
  const originalFetch = window.fetch;
  const SYS_ERROR_FAILURE_THRESHOLD = 3;
  const SYS_ERROR_WINDOW_MS = 8000;
  let recentFailureTimestamps: number[] = [];

  const reportPossibleSystemFailure = (detail: '500' | 'network') => {
    const now = Date.now();
    recentFailureTimestamps = recentFailureTimestamps.filter((t) => now - t < SYS_ERROR_WINDOW_MS);
    recentFailureTimestamps.push(now);
    if (recentFailureTimestamps.length >= SYS_ERROR_FAILURE_THRESHOLD) {
      recentFailureTimestamps = [];
      window.dispatchEvent(new CustomEvent('SHOELOTSKEY_SYS_ERROR', { detail }));
    }
  };

  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      // Only intercept global 500s. 401s are handled individually by App.tsx.
      if (response.status >= 500) {
        reportPossibleSystemFailure('500');
      } else if (response.ok) {
        // A successful request proves the backend is currently reachable — clear any
        // partial failure streak so an isolated blip doesn't compound with a later one.
        recentFailureTimestamps = [];
      }
      return response;
    } catch (error) {
      // TypeError on fetch usually means network offline / server completely unreachable
      if (error instanceof TypeError) {
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
  
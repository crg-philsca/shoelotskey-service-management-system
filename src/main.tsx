
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import GlobalErrorBoundary from "./app/components/GlobalErrorBoundary.tsx";
  import "./styles/index.css";

  // --- GLOBAL FETCH INTERCEPTOR (Error Integration) ---
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      // Only intercept global 500s. 401s are handled individually by App.tsx.
      if (response.status >= 500) {
        window.dispatchEvent(new CustomEvent('SHOELOTSKEY_SYS_ERROR', { detail: '500' }));
      }
      return response;
    } catch (error) {
      // TypeError on fetch usually means network offline / server completely unreachable
      if (error instanceof TypeError) {
        window.dispatchEvent(new CustomEvent('SHOELOTSKEY_SYS_ERROR', { detail: 'network' }));
      }
      throw error;
    }
  };

  createRoot(document.getElementById("root")!).render(
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
  
/**
 * Centralized API base URL resolution (P1-10 / HIGH-4 remediation).
 *
 * Previously, ~10 different files each independently re-implemented slightly different
 * versions of this same "is this localhost/LAN dev, or production" check (some missing the
 * LAN `192.x` branch, some missing the `:5173` Vite dev-server port check, and one file —
 * HistoricalValidationQueue.tsx — hardcoded `http://localhost:8000/api` unconditionally,
 * which would have failed outright in production). That duplication risked different pages
 * silently pointing at different backends.
 *
 * Resolution strategy (single source of truth):
 *  1. `VITE_API_URL` build-time env override, if explicitly set (e.g. a custom deployment).
 *  2. If the page is being served from localhost/127.0.0.1, the Vite dev server port
 *     (5173), or a LAN address (192.x — for testing from another device on the same
 *     network), point at the local FastAPI dev server on port 8000.
 *  3. Otherwise (production, e.g. the Heroku-served build), use a same-origin relative
 *     `/api` path — the FastAPI app serves both the API and the built SPA from one origin.
 */
export function resolveApiBase(): string {
    const envOverride = (import.meta as any)?.env?.VITE_API_URL;
    if (envOverride) return envOverride;

    // By default, use relative '/api'. In local development (port 5173 on localhost or LAN IP),
    // Vite's reverse proxy forwards all /api calls to http://127.0.0.1:8000.
    // This allows mobile phones and other devices on the LAN to communicate with the backend
    // on port 5173 without being blocked by Windows Firewall on port 8000.
    return '/api';
}

export const API_BASE = resolveApiBase();

/**
 * Same resolution as API_BASE, but without the trailing `/api` — for linking directly to
 * backend-served static assets (e.g. `/static/...` report archives, branded error images)
 * that are not under the `/api` prefix. In production this correctly resolves to a same-
 * origin relative path instead of a hardcoded `http://localhost:8000` that would 404/fail
 * to connect once deployed.
 */
export const STATIC_BASE = API_BASE.replace(/\/api$/, '');

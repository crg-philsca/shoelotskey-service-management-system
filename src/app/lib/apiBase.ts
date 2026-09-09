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

    if (typeof window !== 'undefined') {
        const { hostname, port, protocol } = window.location;
        const isLocalDev =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            /^517\d$/.test(port) ||
            hostname.startsWith('192.');
        if (isLocalDev) {
            const host = hostname === '127.0.0.1' ? 'localhost' : hostname;
            return `${protocol}//${host}:8000/api`;
        }
    }
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

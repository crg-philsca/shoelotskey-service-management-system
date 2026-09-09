# Shoelotskey Deployment Readiness Report (re-check)

**Date:** 2026-09-09 (evening re-check)  
**Verdict:** **CONDITIONALLY READY TO DEPLOY**  
**Branch:** `capstone-fixes` (large uncommitted working tree — must ship before Heroku)  
**Local backend (restarted this run):** `http://127.0.0.1:8000/` (SQLite)  
**Production URL:** `https://shoelotskey-villamor-pasay.app` — **not smoke-tested this run**

**Supersedes blockers in:** [deployment-readiness-report-2026-09-09.md](deployment-readiness-report-2026-09-09.md) (morning “NOT READY” security FAIL items)

---

## Executive summary

Prior deploy blockers (**open `/api/predict`**, **open `/api/services`**, **public `/historical_data` mount**, verbose public health diagnostics) are **fixed in code and verified live** after backend restart.

Core shop path (login → job orders → BR/ML estimate → inventory → sales) remains the intended production surface. Historical OCR / ML training stays **Admin-only** by design.

**Do not treat this as “push and forget.”** Ship the working tree, confirm Heroku config, then run a short post-deploy smoke on PostgreSQL.

| Use case | Ready? |
|---|---|
| Local demo of live operations | **Yes** |
| Production deploy of *current remediations* | **Yes, after commit/push + config** |
| Owner evaluation of Historical / OCR | **No** (Admin-only; intentional) |
| Present ML as high-accuracy predictor | **No** (advisory; R² ≈ 0.41, n ≈ 34) |
| Formal ISO/IEC 25010 / TAM on live host | **After** deploy smoke + questionnaire session |

---

## Verdict scorecard

| Area | Status | Evidence |
|---|---|---|
| Frontend production build | **PASS** | `npm run build` succeeded (~3m 27s) |
| Backend process model | **PASS** | `Procfile`: gunicorn + uvicorn worker, `--chdir backend` |
| Same-origin API in prod | **PASS** | `src/app/lib/apiBase.ts` → `/api` outside localhost |
| JWT secret required | **PASS** | `JWT_SECRET` required at import (`auth_utils.py`) |
| Prod DB fail-closed | **PASS** | No SQLite auth failover when `PORT` / production env set |
| Unauthenticated `/api/predict` | **PASS** | Live probe → **401** (was 200) |
| Unauthenticated `/api/services` | **PASS** | Live probe → **401** (was 200) |
| Unauthenticated `/api/lookups/statuses` | **PASS** | Live probe → **401** |
| Owner-only `/api/health` diagnostics | **PASS** | Live probe → **401**; public `/api/health-check` is dialed back |
| Public `/historical_data` file mount | **PASS** | Mount disabled unless `EXPOSE_HISTORICAL_STATIC=1` (non-prod). Paths fall through to SPA HTML, not CSV/images |
| Authenticated historical images | **PASS** | `/api/historical/image/...` remains Admin-gated |
| Owner Historical module | **N/A (by design)** | Route + APIs Admin-only |
| Deploy hygiene (commit / push) | **FAIL / pending** | ~96 dirty paths; remediations not on remote |
| Production smoke test | **NOT RUN** | Live Heroku not walked this run |
| ML evaluation honesty | **CONDITIONAL** | `completion_model.meta.json`: R² **0.41**, MAE **5.86**, n=**34** — disclose as advisory |
| Unit smoke (BR + discount totals) | **PASS** | `UNIT_SMOKE_PASS` |

---

## Security fixes applied this re-check

1. `POST /api/predict` → `Depends(get_current_user)`
2. `GET /api/services` → `Depends(get_current_user)`
3. `GET /api/lookups/statuses` → `Depends(get_current_user)`
4. `GET /api/health` → Owner-only diagnostics; public `GET /api/health-check` returns status + dialect label only (no DB file paths)
5. Removed public `StaticFiles` mount of `historical_data` in normal/prod boots; archives open via authenticated `/api/historical/image/...`
6. `OrderDetailModal` sends Bearer token on predict; `OrderContext` tolerates lean health-check payload

**Note:** Backend must be **restarted** after pull (uvicorn was not `--reload`). Stale process previously still served open predict/services.

---

## Pre-deploy checklist (required)

1. **Commit & push** remediations on `capstone-fixes` (exclude `.env`, `*.db*`, secrets, large OCR binaries if not needed on dyno).
2. Confirm Heroku config: `JWT_SECRET`, `DATABASE_URL` (Postgres), `ENV`/`PORT`, `FRONTEND_URL` if CORS needs production origin.
3. Deploy; wait for dyno boot; confirm logs show PostgreSQL (not SQLite fallback).
4. Post-deploy smoke (Owner + Staff):
   - Login / logout / session expiry
   - Create job order (BR date authoritative; ML banner advisory)
   - Inventory adjust + claim materials
   - Sales / expenses (Owner)
   - Unauthenticated `GET /api/services` and `POST /api/predict` → **401**
5. Do **not** set `EXPOSE_HISTORICAL_STATIC=1` on Heroku.

---

## Residual risks (non-blocking if disclosed)

| Risk | Mitigation |
|---|---|
| ML R² ~0.4 on small n | Keep Estimated Date = Business Rules; label ML as prediction |
| OCR backlog / Admin-only Historical | Out of Owner evaluation path |
| Account lockout during probing | Expected (rate limit); wait or unlock via DB |
| Large uncommitted tree | Must be versioned before claiming production parity |

---

## Final call

**Conditionally ready for deployment** once the working tree is committed/pushed and Heroku config + smoke pass. Security FAIL items from the morning report are closed on the restarted local API and production build succeeds.

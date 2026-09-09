# Shoelotskey Deployment Readiness Report

**Date:** 2026-09-09  
**Verdict:** **NOT READY TO DEPLOY**  
**Scope:** Production/Heroku deployment readiness (code + local live API + build verification)  
**Branch:** `capstone-fixes` (ahead of `origin/main` with large uncommitted working tree)  
**Local backend:** `http://127.0.0.1:8000/` (SQLite)  
**Production URL:** `https://shoelotskey-villamor-pasay.app` — **not smoke-tested this run**

**Related audits (not replaced):**

- [pre-evaluation-readiness-audit-2026-09-09.md](pre-evaluation-readiness-audit-2026-09-09.md)
- [qa-functional-readiness-report-2026-09-09.md](qa-functional-readiness-report-2026-09-09.md)
- [targeted-blocker-remediation-report-2026-09-09.md](targeted-blocker-remediation-report-2026-09-09.md)
- [system-readiness-audit.md](system-readiness-audit.md)

---

## Executive summary

Core shop operations work on localhost (login, job orders, dashboard, release calendar, inventory, sales print, users). The production deploy path (Procfile + Vite build + same-origin `/api` + PostgreSQL fail-closed auth) is structurally present.

**Do not deploy the current tree to production** until the critical security holes below are closed, required config is confirmed on the host, and a post-deploy smoke test passes on PostgreSQL.

| Use case | Ready? |
|---|---|
| Local demo of live operations | Yes (disclose demo data) |
| Production deploy of current local tree | **No** |
| Owner evaluation of Historical / OCR / ML | **No** (Admin-only; Owner 403) |
| Present ML as accurate predictor | **No** (R² negative; tiny n) |
| Formal ISO/IEC 25010 / TAM on live host | **No** until blockers fixed and deployed |

---

## Verdict scorecard

| Area | Status | Evidence |
|---|---|---|
| Frontend production build | **PASS** | `npm run build` succeeded (~4m 28s); SPA assets under `dist/` |
| Backend process model | **PASS** | `Procfile`: gunicorn + uvicorn worker, `--chdir backend` |
| Same-origin API in prod | **PASS** | [`src/app/lib/apiBase.ts`](../src/app/lib/apiBase.ts) uses `/api` outside localhost |
| JWT secret required | **PASS** | `JWT_SECRET` required at import ([`backend/auth_utils.py`](../backend/auth_utils.py)) |
| Prod DB fail-closed | **PASS** | No SQLite auth failover when `PORT` / production env set |
| Unauthenticated `/api/predict` | **FAIL** | Live probe: `POST` → **200** without token |
| Unauthenticated `/api/services` | **FAIL** | Live probe: `GET` → **200** (pricing catalog) |
| Public `/historical_data` static mount | **FAIL** | [`main.py`](../backend/main.py) mounts `StaticFiles` with no auth |
| Owner Historical access | **FAIL** | UI route Admin-only; historical APIs `require_role("admin")` |
| Deploy hygiene (commit / push) | **FAIL** | Large uncommitted remediations not on `origin/main` |
| Production smoke test | **NOT RUN** | Live Heroku not walked this run |
| ML evaluation honesty | **FAIL** | `completion_model.meta.json`: R² **−0.64**, n=11 |
| OCR backlog | **CONDITIONAL** | 712 / 725 still `PENDING_REVIEW` |
| Sample unit tests | **PASS** | Business-rule + OCR parser checks passed |

---

## 1. What was verified this run

### 1.1 Live API probes (localhost)

| Call | Result | Deploy impact |
|---|---|---|
| `GET /api/health-check` | 200 — SQLite path exposed | Medium info leak |
| `GET /api/services` (no auth) | **200** | High — catalog/pricing public |
| `POST /api/predict` (no auth) | **200** | Critical — free BR+ML inference |
| Backend online | Yes | Local only |

### 1.2 Build & tests

| Check | Result |
|---|---|
| `npm run build` | **PASS** |
| Business-rule / OCR unit smoke | **PASS** (`UNIT_TESTS_PASS`) |
| `pytest` in venv | Not installed (`No module named pytest`) — CI should pin a test runner if required |

### 1.3 Local data snapshot

| Entity | Count |
|---|---|
| Live orders | 63 (demo set) |
| Historical orders | 725 |
| OCR `PENDING_REVIEW` | 712 |
| OCR `VALIDATED` | 12 |
| OCR `CORRECTED` | 1 |
| Users | 8 |
| Services | 20 |
| Inventory | 9 |

### 1.4 Deploy packaging present

| Item | Status |
|---|---|
| `Procfile` | Present |
| `heroku-postbuild` → `vite build` | Present in `package.json` |
| SPA mount `/` + `/assets` from `dist/` | Present in `main.py` |
| `completion_model.pkl` / meta | Present locally |
| `backend/.env` | Present locally — **must never be committed** |

---

## 2. Deployment blockers (must fix before go-live)

### BLOCKER-1 — Public prediction endpoint (CRITICAL)

`POST /api/predict` has no `Depends(get_current_user)`. Anyone who can reach the host can run inference.

**Expected before deploy:** require authenticated Staff/Owner/Admin.

### BLOCKER-2 — Public historical file mount (CRITICAL)

```python
app.mount("/historical_data", StaticFiles(directory=hist_dir), name="historical_data")
```

Scanned job-order images/PDFs are reachable if paths are known. Authenticated image route exists (`/api/historical/image/...`) but the static mount bypasses it.

**Expected before deploy:** remove public mount or gate it behind auth; serve only via authenticated API.

### BLOCKER-3 — Public service catalog (HIGH)

`GET /api/services` returns active services and prices with no auth.

**Expected before deploy:** require authentication (or a deliberately public, non-sensitive subset).

### BLOCKER-4 — Uncommitted remediations (HIGH)

Working tree on `capstone-fixes` contains extensive local fixes (auth, ML split, OCR, API base, schemas, etc.) that are **not** on `origin/main`. Deploying from remote without committing/pushing ships the older production code and leaves local security/ops fixes behind.

**Expected before deploy:** review, commit (excluding secrets), push, then deploy that revision.

### BLOCKER-5 — Production config checklist incomplete (HIGH)

Before Heroku (or equivalent) release, confirm:

| Variable / setting | Required |
|---|---|
| `JWT_SECRET` | Yes — strong unique secret |
| `DATABASE_URL` | Yes — PostgreSQL |
| `FRONTEND_URL` | Yes — production origin for CORS + reset links |
| `PORT` | Set by platform (marks Production) |
| `MAILGUN_API_KEY` (or mail provider) | Yes if forgot-password must work |
| `PUBLIC_APP_URL` | Recommended |
| `GEMINI_API_KEY` | Only if cloud OCR is used in prod |
| Model artifacts in slug | `completion_model.pkl` (+ meta) must ship with release |

### BLOCKER-6 — Owner Historical / ML evaluation path (HIGH for panel)

Historical Records UI is `allowedRoles={['admin']}`; APIs use `require_role("admin")`. Owner gets 403. If the evaluation role is Owner, Historical/OCR/Analytics/ML demos fail after deploy.

**Choose one before evaluation deploy:** grant Owner historical access, or document that evaluation uses Admin.

---

## 3. High / medium risks (should fix; not always hard blockers)

| Issue | Severity | Notes |
|---|---|---|
| Owner can assign `admin` via user API | HIGH | Privilege escalation path |
| Health-check leaks DB filesystem path | MEDIUM | Strip path in Production |
| `GET /api/temp/debug_image` runs DDL | MEDIUM | Disable or remove in Production |
| Staff Expenses UI vs Owner-only APIs | MEDIUM | Route/button mismatch |
| Inventory comments vs code | MEDIUM | Docstrings say Owner-only; endpoints currently allow Staff |
| ML “accuracy” from R²×100 | HIGH for honesty | Current meta R² −0.64 → misleading % |
| OCR backlog 712 pending | MEDIUM | Analytics/ML train on tiny validated set |
| Production not smoke-tested | HIGH process | Must verify after deploy |

---

## 4. What is ready (local / packaging)

These items support a future deploy once blockers are cleared:

1. **Monolith hosting model** — FastAPI serves API + built SPA from one origin.
2. **Auth core** — login lockout path, JWT verify, logout, reset-token flow exist.
3. **RBAC for sensitive admin APIs** — users, expenses, activities Owner-gated (Admin bypass).
4. **Business-rule official dates** — `/api/predict` marks `authoritative: business_rule`; ML is separate preview.
5. **Prod DB policy** — Production does not provision SQLite fallback credentials.
6. **Frontend build** — production bundle builds cleanly.
7. **Same-origin client** — no hardcoded localhost API in production builds.

---

## 5. Pre-deploy checklist

Use this as a gate. All **Must** items must be Yes.

### Must (security & packaging)

- [ ] Authenticate `POST /api/predict`
- [ ] Remove or lock public `/historical_data` StaticFiles mount
- [ ] Authenticate `GET /api/services` (or sanitize public response)
- [ ] Confirm `JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL` on host
- [ ] Commit/push intended revision (no `.env`, no secrets)
- [ ] `heroku-postbuild` / Vite build succeeds in deploy pipeline
- [ ] Model files included in release slug if ML is demoed
- [ ] Disable debug/DDL endpoints in Production

### Should (evaluation / ops)

- [ ] Owner historical access decision documented and implemented
- [ ] ML UI does not show R² as “Prediction Accuracy %”
- [ ] OCR backlog labeled (n validated) or partially reviewed
- [ ] Demo live orders disclosed as demo data
- [ ] Mail provider verified for password reset

### Must after deploy (smoke)

- [ ] Owner login / Staff login on production URL
- [ ] Create job order → appears on Dashboard + Calendar
- [ ] Inventory read; Owner mutate
- [ ] Sales Report print path
- [ ] Unauth `POST /api/predict` returns **401**
- [ ] Unauth `GET /historical_data/...` returns **401/404** (not file)
- [ ] PostgreSQL connected (`health-check` / logs show PG, not SQLite)
- [ ] CORS allows only production frontend origin

---

## 6. Recommended release sequence

1. Fix BLOCKER-1 … BLOCKER-3 in code; decide BLOCKER-6 (Owner vs Admin historical).
2. Harden health-check + remove debug DDL endpoint for Production.
3. Commit reviewed changes (exclude `.env`, local DB WAL/SHM, secrets).
4. Push branch / merge to deploy branch.
5. Set Heroku config vars; deploy.
6. Run post-deploy smoke checklist (Section 5).
7. Only then mark **READY TO DEPLOY / LIVE**.

---

## 7. Final recommendation

| Decision | Recommendation |
|---|---|
| Deploy to production **now** | **No** |
| Continue local demo / development | **Yes** |
| Formal panel evaluation on production | **No** until blockers + smoke pass |
| Next action | Close critical auth/static leaks, then commit/push/deploy with config checklist |

**Overall:** **NOT READY TO DEPLOY.**

No application code was changed for this report. No commit, push, or production deploy was performed.

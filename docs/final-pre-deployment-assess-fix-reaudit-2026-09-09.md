# Final Pre-Deployment Assess + Fix + Re-Audit Report

**Date:** 2026-09-09  
**Branch:** `capstone-fixes` (working tree; HEAD `6dda508`)  
**Reference:** `origin/main` `95b3a45`  
**Production:** https://www.shoelotskey-villamor-pasay.app/  
**Actions forbidden here:** commit / push / deploy — **STOP after this report**

Phase 1 diagnostic: `docs/final-pre-deployment-phase1-diagnostic-2026-09-09.md`

---

## 1. Executive Summary

**Final gate: CONDITIONAL GO**

Older CRITICAL findings (unauthenticated predict/services/activities/bulk-import, public historical StaticFiles by default, JWT fallback, pass-the-hash, production SQLite failover) are **confirmed already fixed** in current local code and **re-probed live** (401 without auth).

This pass then fixed remaining **confirmed HIGH** gaps:

| Fix | Status |
|-----|--------|
| Disable OpenAPI in Production | Done |
| Block Owner→Admin privilege escalation | Done |
| Stop labeling R² as “Prediction Accuracy %” | Done |
| Honest ML target wording (order-to-claim) | Done |
| Inventory row locks (`with_for_update`) | Done |
| Hide 500 `debug_info` in Production | Done |
| Startup migrate `is_retail` / `retail_price` | Done |
| Auth-guard latent historical router | Done |

**Why not full GO:** large uncommitted working tree (not a deployable revision yet); residual MEDIUM items (customer uniqueness race, split inventory JSON SoT); ML metrics are honest but modest (R²≈0.20, n=35); production smoke after deploy still required; **do not deploy from this task**.

---

## 2. Current Git State

| Item | Value |
|------|--------|
| Branch | `capstone-fixes` (no upstream) |
| HEAD | `6dda508` |
| origin/main | `95b3a45` |
| Working tree | Many modified + untracked files (features/fixes not committed) |
| Remotes | GitHub `origin`, Heroku `heroku` |
| Do not commit | `.env`, `*.db-wal`, `*.db-shm`, local secrets |

---

## 3–5. Inventories (condensed)

**Modules:** Login/Reset, Dashboard, Job Orders, Release Calendar, Claim Record, Services, Inventory (+ retail fields), Sales/Expenses, Users, Activity History, Historical Records + OCR queue, ML predict/train, Analytics.

**Auth model:** Staff / Owner / Admin. Historical/OCR/train/export = **Admin**. Owner uses operational modules + live Job Order ML (`/api/predict`).

**Public API (intentional):** `/api/health-check`, `/api/login`, forgot/reset password flows, SPA routes.  
**Production OpenAPI:** disabled when `PORT` or `ENV=production`.

---

## 6–7. Security & OWASP (post-fix)

| OWASP | Result | Notes |
|-------|--------|-------|
| A01 Broken Access Control | PARTIAL→improved | Sensitive APIs auth’d; Owner cannot mint Admin; Historical admin-only by design |
| A02 Cryptographic Failures | PASS | bcrypt; JWT_SECRET required |
| A03 Injection | PASS (practiced) | Parameterized ORM; residual raw SQL migrations |
| A04 Insecure Design | PARTIAL | Split inventory JSON vs logs remains |
| A05 Misconfiguration | improved | Docs off in prod; hist static default off |
| A06 Vulnerable Components | NOT FULLY VERIFIED | No fresh npm/pip CVE scan this pass |
| A07 Auth Failures | PASS | Lockout, JWT expiry, no pass-the-hash |
| A08 Integrity | PARTIAL | Trusted local pickle artifacts; no request path |
| A09 Logging | PARTIAL | Audit from JWT; failures not always elevated |
| A10 SSRF | PASS | No user-driven fetch surface found |

### Live unauth probes (localhost, 2026-09-09)

| Endpoint | Result |
|----------|--------|
| `POST /api/predict` | **401** |
| `GET /api/services` | **401** |
| `POST /api/activities` | **401** |
| `POST /api/historical/bulk-import` | **401** |
| `POST /api/trigger-analytics-procedure` | **401** |
| `GET /api/historical/orders` | **401** |
| `GET /api/historical/image/...` | **401** |
| `/historical_data/...` | SPA HTML (not file dump) |
| `/docs` on Localhost | 200 (expected local) |

---

## 8. ISO/IEC 25010 Readiness (frozen instrument — unchanged)

| Characteristic | Readiness | Note |
|----------------|-----------|------|
| Functional Suitability | PARTIAL | Core CRUD present; residual integrity MEDIUM items |
| Performance Efficiency | PARTIAL | Not load-tested this pass |
| Compatibility | PARTIAL | Responsive not fully re-swept |
| Interaction Capability | PARTIAL | Needs evaluator walkthrough |
| Reliability | PARTIAL | Fail-closed DB/JWT; residual races mitigated not eliminated |
| Security | PARTIAL→improved | Critical open-API holes closed |
| Maintainability | PARTIAL | Large uncommitted tree |
| Flexibility | PARTIAL | — |
| Safety | PARTIAL | Safe failovers; ML cannot override BR date |

**Random Forest ISO items:** RF exists, predicts, integrated, BR authoritative, metrics now labeled honestly. Target is **order-to-claim turnaround**, disclosed in UI/meta.

---

## 9. TAM Readiness (frozen — unchanged)

| Construct | System support |
|-----------|----------------|
| Perceived Usefulness | Operational modules usable for Owner |
| Perceived Ease of Use | Needs Owner walkthrough |
| Behavioral Intention | Not claimable pre-survey |
| Actual System Use | Demo-ready for job orders/inventory/reports; Historical = Admin |

**Do not invent Attitude Toward Using.** Do not claim acceptance scores.

---

## 10. ML Readiness

| Check | Result |
|-------|--------|
| RF present & callable | PASS |
| `/api/predict` authenticated | PASS (live 401) |
| BR official / ML separate | PASS |
| No expected_at overwrite by invalid ML | PASS |
| Feature leakage | PASS |
| Validated-only train | PASS |
| Honest metrics UI | **FIXED** (Test R² + MAE; no accuracy %) |
| Target disclosure | **FIXED** (order-to-claim) |
| Remove ML? | **NO** |

Artifacts: `completion_model.pkl`, `historical_rf_model.pkl` (n=35, R²≈0.196, MAE≈7.6).

---

## 11. Historical OCR

Admin-gated queue/validate/reject/reocr; authenticated image route; no mass-validate performed. Canonical ORD IDs on finalize where implemented. Pending/validated counts must be demoed live for panel.

---

## 12. Database Integrity

| Item | Status |
|------|--------|
| Order delete cascades | PASS |
| Inventory concurrency | **FIXED** row locks (still clamps at 0 on order deduct) |
| Customer unique constraint | **REMAINING** MEDIUM |
| Retail columns migrate | **FIXED** in startup ALTER |
| Prod SQLite failover | PASS (fail-closed) |

---

## 13–15. Contract / Responsive / Buttons

Not fully re-swept end-to-end in this pass. Prior module work remains; recommend Owner+Admin smoke script before panel. **NOT VERIFIED** for complete button inventory at all three viewports.

---

## 16. Deployment Readiness

| Gate | Status |
|------|--------|
| Critical API auth | PASS (local code + live probe) |
| Prod OpenAPI disable | PASS (code; restart prod to apply) |
| JWT_SECRET / DATABASE_URL | Must be set on Heroku — verify at deploy time |
| PostgreSQL only in prod | PASS (code) |
| Model artifacts present | PASS locally |
| Secrets not committed | Verify before any commit |
| Build | NOT RE-RUN this pass |
| Deploy | **FORBIDDEN this task** |

---

## 17. Confirmed Fixes Made (Phase 10)

1. **H1** — `FastAPI(docs_url/redoc_url/openapi_url=None)` when `_IS_PRODUCTION`
2. **H2** — `assert_assignable_role()` on create/update user
3. **H3** — Historical ML card: Test R² + MAE; caption that R² ≠ accuracy %
4. **H4** — Target string in engine + both `.meta.json` files
5. **H5** — `lock_inventory_row` / `with_for_update` on deduct/adjust/auto-consume paths
6. **M1** — `debug_info` only when not Production
7. **M2** — `is_retail`, `retail_price` added to inventory startup ALTER
8. **M4** — `require_role("admin")` on unmounted `historical_processing` router endpoints

---

## 18. Before / After Evidence

| Finding | Before | After |
|---------|--------|-------|
| OpenAPI in prod | Always on | Off when PORT/ENV=production |
| Owner creates Admin | Allowed | 403 unless actor is Admin |
| “Prediction Accuracy” | R²×100 as % | Test R² + MAE + disclosure |
| ML target label | “service readiness” | order-to-claim turnaround |
| Inventory deduct | unlocked RMW | row lock |
| 500 debug leak | always file/line | prod stripped |
| Latent hist router | no auth | admin Depends |

---

## 19. Remaining Issues

| Sev | Issue |
|-----|--------|
| MED | Customer name+contact race (no unique constraint) |
| MED | Split Order/Item `inventory_used` JSON vs `InventoryLog` |
| MED | Misnamed `GET /api/temp/debug_image` DDL helper |
| MED | Small ML n / modest R² — disclose in demo |
| LOW | Dependency CVE scan not run |
| PROC | Working tree uncommitted; not a clean deploy revision |
| PROC | Full responsive + every-button sweep incomplete |

---

## 20. Final Gate

# **CONDITIONAL GO**

Safe to proceed toward production **only after**:

1. Commit a curated revision (no secrets/WAL/SHM) on `capstone-fixes`
2. Restart backend so Production OpenAPI disable + migrations apply
3. Verify Heroku `JWT_SECRET`, `DATABASE_URL` (Postgres), `FRONTEND_URL`
4. Production smoke: login Owner + Admin; Job Order BR+ML; one Historical Admin path; inventory adjust; no `/docs`
5. Panel script: Admin for Historical/OCR/ML analytics; Owner for TAM operational paths

**NO-GO** if deploying the current dirty tree blindly or claiming 85% ML accuracy.

---

## PRE-DEPLOYMENT RELEASE CHECKLIST

| Gate | Result |
|------|--------|
| Critical vulns closed (open predict/services/hist files) | **PASS** |
| No public sensitive historical files | **PASS** |
| Sensitive APIs authenticated | **PASS** |
| RBAC server-side | **PASS** (Admin historical policy documented) |
| No prod SQLite fallback | **PASS** |
| Production config complete | **NOT VERIFIED** (Heroku env at deploy) |
| ML functions honestly | **PASS** |
| Business-rule date authoritative | **PASS** |
| ML demonstrable | **PASS** |
| DB integrity acceptable | **PARTIAL** |
| Core CRUD | **PARTIAL** (prior work; not full retest) |
| Search/filter/buttons | **NOT VERIFIED** full sweep |
| Responsive 3 viewports | **NOT VERIFIED** |
| Build passes | **NOT VERIFIED** this pass |
| Intended revision known | **FAIL** until commit |
| No secrets exposed | **PASS** if `.env` stays untracked |
| Prod smoke plan ready | **PASS** (see §20) |

---

**STOP.** No commit, no push, no deploy from this task.

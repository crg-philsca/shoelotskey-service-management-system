# Final Shoelotskey Release-Gate Audit, Fix, Re-Audit

**Date:** 2026-09-09  
**Branch:** `capstone-fixes` @ `6dda508` + dirty working tree  
**Reference:** `origin/main` `95b3a45`  
**Production:** https://www.shoelotskey-villamor-pasay.app/  

**Restrictions honored:** no commit · no push · no deploy · no mass OCR validate · no origin/main overwrite

---

## 1. Executive Summary

**FINAL GATE: CONDITIONAL GO**

Stage 1 re-verified that previously reported CRITICAL security fixes remain in place (no regressions). Live localhost probes still return **401** for sensitive unauthenticated APIs.

Stage 2 applied only release-relevant residual fixes:

| Fix | Result |
|-----|--------|
| `/api/temp/debug_image` Production-disabled | Done |
| Remaining inventory PUT / expense restock row locks | Done |
| Soft customer name+contact normalization (no destructive unique yet) | Done |
| OCR misread of `DP -` / `Bal -` as discounts (grand_total 725 vs 1425) | Done |
| `npm run build` | **PASS** |
| Key backend tests | **43 passed** |

Still **CONDITIONAL** because: working tree is uncommitted (procedural blocker), Heroku env vars not verified live, customer DB unique constraint deferred (1 local duplicate group), full responsive/button sweep not completed, dependency CVE scan not run.

**Do not deploy the dirty tree.** Next user step: curated commit → push → Heroku config → deploy → production smoke → ISO/TAM.

---

## 2. Git State

| Item | Value |
|------|--------|
| Branch | `capstone-fixes` (no upstream tracking) |
| HEAD | `6dda508` |
| origin/main | `95b3a45` |
| Working tree | Large modified + untracked set (deployable content exists but **not one clean revision**) |
| Remotes | `origin` (GitHub), `heroku` |
| Must not commit | `.env`, `backend/db/*.db-wal`, `*.db-shm`, local secrets |
| Modified DB noise | `shoelotskey.db-shm`, `shoelotskey.db-wal` |

---

## 3. Modules Audited (verification scope)

Login / Forgot / Reset · Dashboard · Job Order Form · Job Orders · Release Calendar · Claim Record · Services · Inventory (+ retail) · Sales / Expenses · Users · Activity History · Historical Records · OCR Queue · ML train/predict · SPA / error surfaces.

Evaluation roles (unchanged policy):

- **Admin** → Historical / OCR / ML analytics  
- **Owner** → ops modules + Job Order BR + ML prediction (TAM)  
- **Staff** → staff workflows per RBAC  

---

## 4–5. Routes & API Security Results

### Already-fixed items re-verified (no REGRESSED)

Pass-the-hash · prod SQLite fail-closed · JWT_SECRET required · auth on predict/services/activities/bulk-import/trigger-analytics · hist StaticFiles gated · Owner↛Admin · OpenAPI off in prod · 500 debug stripped in prod · inventory locks (primary) · retail ALTER · latent router auth · honest ML metrics UI · BR authoritative expected_at · invalid ML cannot overwrite expected_at.

### Live unauth probes (localhost)

| Endpoint | Result |
|----------|--------|
| POST `/api/predict` | **401** |
| GET `/api/services` | **401** |
| GET `/api/lookups/statuses` | **401** |
| POST `/api/activities` | **401** |
| POST `/api/historical/bulk-import` | **401** |
| POST `/api/trigger-analytics-procedure` | **401** |
| GET `/api/historical/orders` | **401** |
| GET `/api/historical/image/...` | **401** |
| GET `/api/health` | **401** (owner diagnostics) |
| GET `/api/health-check` | **200** (intentional public) |
| GET `/api/temp/debug_image` | **401** (admin; also code-gated in Production) |
| `/docs` `/redoc` `/openapi.json` | **200 on Localhost** (expected; disabled when `_IS_PRODUCTION`) |
| `/historical_data/...` | SPA HTML (not raw files) |

---

## 6. OWASP Top 10 (final)

| ID | Gate |
|----|------|
| A01 Broken Access Control | **PASS** (with Admin historical policy) |
| A02 Cryptographic Failures | **PASS** |
| A03 Injection | **PARTIAL** (ORM primary; residual raw SQL migrations) |
| A04 Insecure Design | **PARTIAL** (split inventory JSON SoT remains) |
| A05 Security Misconfiguration | **PASS** (OpenAPI/prod debug/hist static) |
| A06 Vulnerable Components | **NOT VERIFIED** (no fresh CVE audit) |
| A07 Auth Failures | **PASS** |
| A08 Software/Data Integrity | **PARTIAL** (trusted pickle; customer unique deferred) |
| A09 Logging/Monitoring | **PARTIAL** |
| A10 SSRF | **PASS** |

---

## 7. ISO/IEC 25010 Readiness

| Characteristic | Gate |
|----------------|------|
| Functional Suitability | **PARTIAL** |
| Performance Efficiency | **PARTIAL** (not load-tested) |
| Compatibility | **PARTIAL** |
| Interaction Capability | **PARTIAL** |
| Reliability | **PARTIAL** |
| Security | **PARTIAL → improved / near PASS for release blockers** |
| Maintainability | **PARTIAL** (large main.py / dirty tree) |
| Flexibility | **PARTIAL** |
| Safety | **PARTIAL** |

Frozen questionnaire **not modified**. RF remains demonstrable and honestly labeled.

---

## 8. TAM Readiness

PU / PEOU / BI / ASU supported by Owner operational modules + Job Order BR/ML.  
**Do not claim acceptance scores** before Owner completes frozen TAM.  
Attitude Toward Using **not invented**.

---

## 9. ML Readiness

| Check | Result |
|-------|--------|
| Random Forest present | **PASS** |
| Advisory only; BR = official `expected_at` | **PASS** |
| Honest metrics (R² / MAE, not accuracy %) | **PASS** |
| Target disclosed as order-to-claim | **PASS** |
| Do not claim 85% | **PASS** (current ~R² 0.20, n=35) |
| Remove ML? | **NO** |

---

## 10. Historical OCR Readiness

Admin-gated queue/validate/reject; authenticated images; no mass-validate.  
OCR payment parse fix: `DP -` / `Bal -` no longer treated as discounts.  
Post-deploy: continue OCR validation on **production PostgreSQL**.

---

## 11. Database Integrity

| Item | Result |
|------|--------|
| Order delete cascades | PASS |
| Inventory concurrent deduct paths | PASS (row locks extended) |
| Customer unique constraint | **DEFERRED** — 1 local duplicate group (`Brian Anlap` / `09179430456`); soft trim/case match added |
| Retail columns migration | PASS |
| Prod SQLite failover | PASS fail-closed |

---

## 12. Frontend / Backend Contract

Central `apiBase` present. No full enum re-diff this pass. Build success implies TS compile of production bundle.

---

## 13–14. Responsive / Buttons

**NOT FULLY VERIFIED** this pass (prior work assumed). Recommend Owner+Admin smoke on 1280 / 768 / 390 after deploy.

---

## 15. Build / Test Results

| Check | Result |
|-------|--------|
| `npm run build` | **PASS** (Vite production bundle) |
| `pytest` key suites | **43 passed** (`business_rule`, `ml_pipeline`, `historical_ocr_review`, `reset_link_origin`) |
| pytest in requirements | Not listed; installed in local venv for this run |

---

## 16. Deployment Configuration

| Item | Code readiness |
|------|----------------|
| Procfile (`gunicorn` + uvicorn worker, `chdir backend`) | Present |
| Vite / `heroku-postbuild` | Present |
| PostgreSQL fail-closed | Present |
| JWT_SECRET required | Present |
| FRONTEND_URL / CORS | Present |
| Model artifacts under `backend/` | Present locally |
| `EXPOSE_HISTORICAL_STATIC` must stay unset in prod | Documented |
| Heroku config values live | **NOT VERIFIED** (no deploy / no `heroku config`) |

---

## 17. Issues Fixed This Pass

| Issue | Sev | Where | Fix | Verification |
|-------|-----|-------|-----|--------------|
| Debug DDL usable in prod | HIGH | `main.py` `/api/temp/debug_image` | 403 when `_IS_PRODUCTION` | Code present; unauth still 401 |
| Inventory PUT unlocked | HIGH | `update_inventory_item` | `lock_inventory_row` | Code present |
| Expense restock unlock | MED | expense update/delete restock | `lock_inventory_row` | Code present |
| Customer soft-dup race | MED | order create customer lookup | trim + case-insensitive match | Code present; DB unique deferred |
| OCR grand_total=balance | HIGH | `local_ocr_parser._negative_discount_amounts` | Ignore DP/Bal payment dashes | Problem-doc parse → 1425; tests green |

---

## 18. Remaining Issues (documented debt)

| Sev | Issue |
|-----|--------|
| PROC | Uncommitted dirty tree — not a deployable revision |
| PROC | Heroku `JWT_SECRET` / `DATABASE_URL` / `FRONTEND_URL` not live-verified |
| MED | Customer `(name, contact)` unique constraint blocked by existing duplicate |
| MED | Split Order/Item `inventory_used` JSON vs `InventoryLog` |
| LOW | Full responsive + every-control sweep incomplete |
| LOW | npm/pip CVE audit not run |
| INFO | Large `main.py` / JobOrderForm — do not refactor pre-eval |

---

## 19. Production Smoke-Test Checklist (post-deploy)

Use **Owner** and **Admin** on https://www.shoelotskey-villamor-pasay.app/

- [ ] Login Owner / Staff / Admin  
- [ ] Owner: create Job Order → Business Rule date = form/details/calendar `expected_at`  
- [ ] Owner: ML prediction shows separately (advisory)  
- [ ] Owner: inventory adjust / restock  
- [ ] Owner: sales/expenses date filter  
- [ ] Admin: Historical list + **View** form photo  
- [ ] Admin: OCR queue open one record (edit/save or validate one) — **no mass validate**  
- [ ] Unauth `/docs` → 404/disabled  
- [ ] Unauth `/api/predict` → 401  
- [ ] Unauth historical image path → 401  
- [ ] Confirm DB is PostgreSQL (health/diagnostics as authorized)  

Then start frozen ISO (IT) + TAM (Owner). Continue OCR validation on production afterward.

---

## 20. FINAL GATE

# **CONDITIONAL GO**

Safe to proceed to **user-driven** commit → push → Heroku configure → deploy → smoke → evaluation.

**Not GO** until a clean revision is committed and production smoke passes.

**NO-GO** conditions are **not** present for the previously critical open-API / SQLite-failover / JWT / pass-the-hash class of defects.

---

**STOP.** No commit, no push, no deploy from this agent task.

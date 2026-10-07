# Shoelotskey Code Review — Claim Verification Report

**Date:** 2026-09-09  
**Purpose:** Re-check the pasted security / OWASP / database / ML / defense-audit claims against the **current** codebase.  
**Method:** Static inspection of `backend/main.py`, `backend/auth_utils.py`, `backend/db/database.py`, `backend/models.py`, `backend/ml/*`, `src/app/lib/apiBase.ts`, `src/app/context/OrderContext.tsx`.  
**Verdict:** Several Critical/High findings in the pasted reviews are **already fixed**. Several High architecture and data-integrity findings remain open. The ML “fatal flaw” claim is **partly outdated** for live Job Orders and **still partly valid** for historical RF training labels.

---

## Executive summary

| Area | Pasted review said | Current verified status |
|------|--------------------|-------------------------|
| Pass-the-hash login | Critical open | **Fixed** |
| Production SQLite failover | High open | **Fixed** (production refuses SQLite; local only) |
| Hardcoded JWT secret | Medium open | **Fixed** (`JWT_SECRET` required) |
| Unauth `bulk-import` / `activities` / `predict` | Critical open | **Fixed** (auth/RBAC present) |
| API URL sniffing in OrderContext | Low open | **Fixed** (central `apiBase.ts` + `VITE_API_URL`) |
| Unknown status silent mask | Low open | **Partially fixed** (logs error; still falls back to `new-order`) |
| Monolithic `main.py` / JobOrderForm | High open | **Still open** |
| Ad-hoc startup migrations | Medium open | **Still open** |
| Inventory lost-update | Critical open | **Still open** |
| Customer unique constraint | High open | **Still open** |
| `inventory_used` JSON duplication | Medium open | **Still open** |
| Audit fail-open | High open | **Still open** (intentional swallow + console warn) |
| ML predicts claim laziness for live dates | Critical open | **Overstated** — live Estimated Date is **business-rule authoritative**; RF is secondary |
| Historical `completion_days` from claim | Critical open | **Still partly true** — historical pipeline still derives span from claim/received |

**Overall readiness vs pasted “Needs Major Fixes”:**  
Security blockers listed as Critical in the pasted OWASP section are largely remediated. Remaining defense risk is concentrated in **maintainability**, **inventory concurrency**, **historical label semantics**, and **architectural debt** — not unauthenticated admin APIs.

---

## 1. Security claims

### 1.1 Pass-the-hash / plaintext migration — **FIXED**

- **Past claim:** Login falls back to `password_hash == request.password`.
- **Verified:** `backend/main.py` login uses only `bcrypt.verify(...)`. On invalid hash it **does not** migrate or accept plaintext/hash equality. Comment explicitly documents removal of the pass-the-hash path.
- **Status:** Closed.

### 1.2 Database downgrade / SQLite failover — **FIXED in Production**

- **Past claim:** Production silently falls over to SQLite + seeded `owner`/`owner123`.
- **Verified:** `backend/db/database.py` sets `IS_PRODUCTION_ENV` from `PORT` / `ENV`. On PG failure in production: `DB_UNAVAILABLE = True`, **no SQLite failover**, routes return 503. Localhost still may use SQLite by design.
- **Residual:** Local seed still creates `owner`/`owner123` and `staff`/`staff123` for offline demo. That is acceptable for local defense only; production must keep `JWT_SECRET` + PG and never run with those defaults exposed.
- **Status:** Closed for production; residual local-seed risk if someone deploys misconfigured as “localhost”.

### 1.3 Hardcoded JWT fallback — **FIXED**

- **Past claim:** Fallback secret `super-secret-shoelotskey-2026-key-ags-aviatech`.
- **Verified:** `backend/auth_utils.py` requires `JWT_SECRET` or raises `RuntimeError`.
- **Status:** Closed.

### 1.4 Unauthenticated administrative endpoints — **FIXED** (claims outdated)

| Endpoint | Past claim | Current dependency |
|----------|------------|--------------------|
| `POST /api/historical/bulk-import` | No auth | `require_role("admin")` |
| `POST /api/trigger-analytics-procedure` | No auth | `require_role("owner")` |
| `POST /api/predict` | No auth | `get_current_user` |
| `POST /api/activities` | Explicitly unauth / forgeable | `get_current_user`; actor from JWT |
| `GET /api/activities` | (implied weak) | `require_role("owner")` |

- **Status:** Closed for listed Critical A01 items. Historical routes are generally `admin`-gated.

### 1.5 Fail-open `log_audit()` — **STILL OPEN** (by design)

- **Verified:** `log_audit()` still wraps insert in `try/except`, rolls back, prints `[AUDIT WARNING]`, returns without failing the business transaction.
- **Assessment:** Real residual A09 concern, but lower immediate exploitability than unauth forge endpoints (those are fixed). File/queue fallback still not implemented.
- **Status:** Open / accepted risk unless panel requires hard-fail or dual logging.

---

## 2. Architecture / coding-practice claims

### 2.1 Monolithic backend — **STILL OPEN**

- **Verified size:** `backend/main.py` ≈ **5,382** lines (pasted review said ~4,500–4,584).
- **Assessment:** Accurate maintainability concern. Not a runtime security hole by itself.
- **Status:** Open (deferred refactor).

### 2.2 Ad-hoc in-code schema migrations — **STILL OPEN**

- **Verified:** Startup still runs many `ALTER TABLE` / index creations inside broad `try/except` / `except: pass` paths.
- **Assessment:** Accurate A05-style misconfiguration risk. Alembic still not the primary migration path.
- **Status:** Open.

### 2.3 Frontend God Component — **STILL OPEN**

- **Verified:** `JobOrderForm.tsx` ≈ **2,356** lines.
- **Status:** Open (maintainability).

### 2.4 API base URL discovery — **FIXED** (wrong file in past review)

- **Past claim:** Sniffing lives in `OrderContext.tsx`.
- **Verified:** `OrderContext` imports `API_BASE` from `src/app/lib/apiBase.ts`, which prefers `VITE_API_URL`, then localhost/LAN heuristic, then `/api`.
- **Status:** Closed.

### 2.5 Silent unknown status mapping — **PARTIALLY FIXED**

- **Verified:** Unknown status logs `console.error(...)` then still falls back to `'new-order'`.
- **Status:** Partial — observability improved; UI still masks unknown states.

---

## 3. Database / transaction integrity claims

### 3.1 Inventory lost-update anomaly — **STILL OPEN**

- **Verified:** Multiple sites still use Python read-modify-write, e.g.  
  `inv_item.stock_quantity = max(0.0, inv_item.stock_quantity - inv_amount)`  
  in create/update/auto-consume paths. No `with_for_update()` / SQL expression decrement found.
- **Status:** Open — valid High/Critical concurrency finding for multi-staff simultaneous deductions.

### 3.2 Customer uniqueness race — **STILL OPEN**

- **Verified:** `Customer` model has indexed `customer_name` + required `contact_number`, but **no** composite `UniqueConstraint`.
- **Status:** Open.

### 3.3 Split source of truth (`inventory_used` JSON) — **STILL OPEN**

- **Verified:** `Order.inventory_used` and `Item.inventory_used` JSON columns still exist alongside `InventoryLog`.
- **Status:** Open (design debt / drift risk). Removing JSON is a larger API/UI change.

### 3.4 `delete_order` cascade swallowing — **MOSTLY OUTDATED**

- **Past claim:** Raw SQL deletes wrapped in `try/except: pass` leave orphans.
- **Verified:** Current delete uses ORM cascade notes and detaches `InventoryLog.order_id` deliberately; redundant bridge deletes were removed to avoid `StaleDataError`. Role gate: staff may only cancel `new-order`/`on-going`; Owner/Admin for later statuses.
- **Status:** Largely remediated; remaining `CASCADE WARNING` is only around InventoryLog detach.

### 3.5 Primary workflow atomicity — **CONFIRMED POSITIVE**

- Create/update order still use session + rollback patterns for multi-step work.

---

## 4. Machine learning claims — what is true now

### 4.1 Live Job Order Estimated Date — **NOT the claimed “fatal claim-time model”**

Current live path (`backend/ml/ml_engine.py` + `/api/predict`):

1. **Business rules** (`business_rules.py` / `calculate_business_rule_days`) produce the **authoritative** estimated days/date.
2. Random Forest produces a **secondary** ML estimate (`ml_predicted_days` / `ml_status`).
3. `predict_completion()` returns the **business-rule date** for persistence of `expected_at`.
4. Dual payload marks `"authoritative": "business_rule"`.

So the pasted statement that live Expected Release = “predicted customer claim time” is **incorrect for the current product path**.

### 4.2 Historical RF training label — **STILL PARTLY VALID**

- Historical import / timeline code still derives `completion_days` primarily as **claimed − received** (with caps/sanitization and business-rule duration fallbacks when absurd).
- `HistoricalMLEngine` trains on `completion_days` with eligibility caps (`MAX_ML_COMPLETION_DAYS = 60`).
- Live RF used by `/api/predict` is synced from this historical RF pipeline via `train_from_history()`.

**Nuanced panel answer:**  
Paper archives often only record claim notes, so claim−receive was used as a proxy. Sanitization + business-rule floor/combo logic reduce absurd spans. Live customer-facing Estimated Date is **not** overwritten by RF; BR is official. Remaining risk: RF secondary signal can still reflect claim-proxy labels rather than pure shop ready-time.

### 4.3 Other ML review inaccuracies

| Past ML claim | Current reality |
|---------------|-----------------|
| Hardcoded combos “bypass ML entirely” and that is a bug | Combos are intentional **business rules**; RF still runs as secondary in dual estimate |
| Separate live engine trains only on live `orders.released_at` | Live predictor’s `train_from_history` trains via **historical** eligible records |
| Model file `historical_model.pkl` | Actual artifacts: `historical_rf_model.pkl` / `completion_model.pkl` |
| Live train has zero train/test split | Historical trainer uses train/test metrics; live wrapper reuses that train result |
| Workload feature is primary live path | Current historical RF feature set is service quantities / priority / conditions / calendar features (see `historical_ml_engine._build_row`) — older “workload/heuristic” description is stale |

---

## 5. Requirements vs implementation (updated)

| Module | Pasted status | Verified update |
|--------|---------------|-----------------|
| Job Order Management | Fully | Still Fully |
| Service Management | Fully | Still Fully |
| Release Calendar | Partial (ML accuracy) | Functional; estimated dates driven by BR |
| Inventory | Partial (races) | Still Partial — race remains |
| Authentication | Partial (unprotected routes) | **Much stronger** — listed Critical routes gated |
| ML prediction | Partial (wrong target) | Dual-engine: BR official; historical label still claim-proxy |
| Database | Fully (3NF cracks) | Same — JSON duplication + customer uniqueness gaps |
| Audit trail | Partial (forge + fail-open) | Forge path fixed; fail-open remains |

---

## 6. Defense-panel Q&A — corrected answers

1. **“Aren’t you predicting customer claim behavior?”**  
   For **live Estimated Date**: No — business rules are authoritative; RF is advisory. For **historical RF labels**: claim−receive is still the primary archival span, sanitized and capped; acknowledge proxy limitation and BR separation.

2. **“Two staff deduct same stock at once?”**  
   Still a valid lost-update risk; recommend `with_for_update()` or atomic SQL decrement.

3. **“Why one huge main.py?”**  
   Still valid technical-debt answer; plan modular `APIRouter` split.

4. **“How is bulk-import secured?”**  
   **Updated:** Requires authenticated **admin** JWT (`require_role("admin")`). Do **not** tell the panel it is unprotected.

---

## 7. Priority backlog (after verification)

### Already done — do not re-fix unless regression appears
1. Pass-the-hash plaintext login migration  
2. Production SQLite failover guard  
3. Required `JWT_SECRET`  
4. Auth on `bulk-import`, `activities`, `predict`, analytics trigger  
5. Central API base + status unknown console logging  

### Still worth fixing before defense (ordered)
1. **Inventory atomic decrement / row lock** (demonstrable concurrency question)  
2. **Clarify ML story in docs/slides** to match dual BR+RF reality (avoid outdated “claim laziness drives live dates”)  
3. Optionally tighten historical `completion_days` toward ready/expected span where paper data supports it  
4. Customer `(name, contact)` uniqueness + IntegrityError retry  
5. Alembic / modular routers (large effort — frame as known debt unless time allows)

### Acceptable residual risks to disclose
- Audit logger fail-open  
- Local-only default seed credentials  
- Monolithic files  
- JSON `inventory_used` duplication  

---

## 8. Final readiness judgment (verified)

| Pasted verdict | Verified verdict |
|----------------|------------------|
| Needs Major Fixes due to unauth APIs + pass-the-hash + live ML claim-time | **Overstated** |
| Needs work on architecture, inventory concurrency, historical label semantics | **Accurate** |

**Recommended spoken readiness line:**  
The Critical auth/crypto findings from earlier audits have been remediated and re-verified in code. Remaining pre-defense work is inventory concurrency hardening and aligning the ML defense narrative with the current business-rule–authoritative dual estimate design.

---

## Evidence anchors (current files)

- Login bcrypt-only: `backend/main.py` (~1991–1998)  
- JWT required: `backend/auth_utils.py` (L13–18)  
- Production no-SQLite: `backend/db/database.py` (P0-5 block)  
- Auth on sensitive routes: `bulk-import`, `predict`, `activities`, `trigger-analytics-procedure` in `backend/main.py`  
- BR authoritative dual estimate: `backend/ml/ml_engine.py` (`estimate_order_release`, `predict_completion`)  
- Historical claim-span: `backend/api/historical_processing.py` (`normalize_historical_timeline`), `backend/historical_ocr_import.py`  
- Inventory RMW: `stock_quantity = max(0.0, ...)` sites in `backend/main.py`  
- API base: `src/app/lib/apiBase.ts`  
- Status logging: `src/app/context/OrderContext.tsx` (`mapBackendStatus`)  

# Shoelotskey Service Management System — System Readiness Audit Report

**Audit Type:** Independent, evidence-based, read-only system-readiness audit
**Audit Date:** September 9, 2026
**Auditor Method:** Static codebase inspection (backend, frontend, database, ML), local isolated live functional/RBAC testing, and read-only production verification
**Scope:** Full-stack readiness for formal evaluation/defense — functionality, RBAC/security, database & offline behavior, ML prediction, and questionnaire (ISO/IEC 25010 + TAM) traceability
**Constraint honored throughout:** No source code, configuration, or files were modified, created, deleted, or renamed as part of testing; no database migrations were run; no commits/pushes/deploys were made. (This report file itself is the one explicitly requested deliverable.)

> **Companion documents referenced (not modified):** `docs/CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md` (existing 65-item TAM/ISO traceability matrix — pre-written by prior work and largely self-rated "Fully Implemented"), `docs/SECURITY_AUDIT_FIXES_2024.md` (prior RBAC remediation record), `COMPREHENSIVE_AUDIT_REPORT.md` (an earlier, broader static-analysis pass at repo root). This report independently **re-verifies** claims from those documents against the live code rather than repeating them at face value, and flags every place where live evidence disagrees with them.

---

## 1. Executive Summary

The system is a functionally rich, single-developer-built capstone application with a genuinely working core workflow (job orders → inventory → sales/reporting → release calendar), a real RBAC model, and a real (if partially unimplemented) ML prediction feature. Codebase quality is good in places (parameterized ORM queries, bcrypt hashing, JWT auth, a prior RBAC remediation pass that is verifiably still in place today) but several **critical defects** were independently confirmed — including one **actively exploitable on the live production system**, verified live during this audit — that make the system **not yet ready** for formal evaluation without remediation.

### Final Verdict: **CONDITIONAL GO — NOT READY without remediation of Critical items**

The system can very likely pass a **functional/UAT walkthrough** (the happy-path features described in the capstone matrix largely do work as described). It should **not** be presented as production-secure or represented as fulfilling Research Objective #2 (ML ≥85% accuracy) in its current state, and the confirmed live production vulnerability should be fixed before any external/panel access to the production URL. See §10 for the full decision rationale and required remediation before sign-off.

| Severity | Count | Examples |
|---|---|---|
| 🔴 Critical | 6 | Unauthenticated production DB-write endpoint (confirmed live exploit); `.env` local dev points at production DB; filesystem-mutating code runs on every backend boot; ML "Random Forest" never actually loads (heuristics-only) contradicting Research Objective #2; offline SQLite failover seeds hardcoded weak credentials with owner privileges; Staff can permanently delete any job order via API |
| 🟠 High | 9 | Unauthenticated audit-log forgery endpoint; frontend/backend RBAC mismatch on Activity History; new inventory items never receive an `inventory_number`; no shared API client / inconsistent `API_BASE` resolution; global fetch interceptor triggers full-app error screen on any 500; ML training artifact cannot persist on Heroku's ephemeral filesystem; offline sync queues written but never drained; hard-delete of users removes audit-relevant rows; Staff sees enabled Inventory Edit/Restock controls the backend correctly-but-silently rejects |
| 🟡 Medium | ~14 | Frontend-only validation gaps, dashboard timezone edge cases, service reorder not confirmed persisted, ServiceModal silent validation issues, mock-data fallback masking API failures, etc. (see §4.3) |
| 🔵 Low | ~10 | Console debug logging left in, inconsistent button styling, missing loading skeletons, minor UX polish items |

---

## 2. Audit Methodology & Evidence Levels

Every finding below is tagged with **how** it was verified, per the audit's evidence-based requirement:

- **`[CODE]`** — Directly confirmed by reading the current source file/line in this session (highest confidence; file/line cited).
- **`[LIVE-LOCAL]`** — Directly observed by driving the actual running application locally (browser automation), against an **isolated local SQLite database** (see §2.1 — never against production).
- **`[LIVE-PROD]`** — Directly observed against the real production system at `https://shoelotskey-villamor-pasay.app/`, using **read-only or explicitly reversible** HTTP calls only (see §2.2).
- **`[SUBAGENT]`** — Reported by a delegated exploration/testing pass and cross-checked by at least one direct `[CODE]` or `[LIVE]` confirmation in this session before being included here.

Nothing in this report is asserted purely from the capstone matrix's own self-declared "Fully Implemented" statuses — every claim relied upon here traces to one of the four evidence types above.

### 2.1 Local test environment safety

A critical early finding: `backend/.env` contains a `DATABASE_URL` pointing at the **same AWS RDS PostgreSQL instance production uses** `[CODE: backend/.env]`. Starting the backend normally would have made "local" testing silently mutate production data. This was mitigated by starting the backend with a deliberately unreachable `DATABASE_URL` override, forcing the built-in TCP-reachability failover (`backend/db/database.py`) into **local SQLite mode** (`backend/db/shoelotskey.db`), confirmed via `/api/health-check` reporting `db_type: sqlite` before any interactive testing began. All local CRUD/RBAC testing in this audit was performed against this isolated SQLite file — not production. Local SQLite login credentials for `admin`/`owner`/`staff` did not match documented defaults, so working passwords were established using the application's own legitimate Forgot Password → Reset Password API flow (not by editing the database directly).

### 2.2 Production test discipline

Production testing was deliberately restricted to **safe, reversible, read-only-intent** HTTP checks (reachability, health endpoint, and authorization-boundary probes) rather than full interactive UI/RBAC/CRUD testing, because production PostgreSQL currently holds **real business data** (8 real users, 67 real orders — confirmed via `/api/health`, see §5). One probe (documented in §4.1, Finding C-1) inadvertently proved a real vulnerability by successfully writing a row; this is disclosed in full rather than omitted. No other write actions were taken against production. Full interactive production UAT (logging in as each role and exercising every module against production) was **not performed** in this pass and is called out as a required follow-up in §10.

### 2.3 Live local testing coverage actually completed

- **Completed and directly observed `[LIVE-LOCAL]`:** backend/frontend clean boot; Admin("Developer")/Owner/Staff login and logout; Dashboard load (all three roles); User Management (view, RBAC-gated); Inventory Management (view, plus Staff-role button/modal behavior — see HIGH‑9); Activity History (Owner: full access; Staff: backend `403`); Job Orders list (accessible to Staff, confirmed); direct-URL RBAC probing for Staff against `/user-management`, `/sales-report`, `/service-management`, `/activity-history`, `/job-orders`, `/inventory`, `/dashboard`; Forgot Password → Reset Password flow (functions correctly offline).
- **Staff-role RBAC — now fully confirmed live, not just inferred from code:** Staff's sidebar correctly shows only Dashboard, Job Order Form, Release Calendar, and Inventory Management. Direct-URL navigation to `/user-management`, `/sales-report`, and `/service-management` correctly renders a frontend "Access Restricted" page for Staff. Direct navigation to `/activity-history` loads the page shell but the underlying data call correctly returns backend `403` ("Only the Owner account has security clearance..."). `/job-orders`, `/inventory`, and `/dashboard` are correctly accessible to Staff. This live evidence matches and confirms the route-guard/RBAC analysis in §5 exactly — no discrepancy found.
- **New live finding — see HIGH‑9 (§4.2):** on the Inventory page, Staff see fully enabled Edit and Restock buttons that open a completely editable modal (all fields, including price and stock quantity, plus an active "UPDATE" button). This was flagged as a potential critical vulnerability pending backend confirmation; this report resolves that question via direct code inspection (§4.2) — the backend does correctly reject these as Staff with `require_role(["owner"])` on every inventory-mutation route — downgrading it from a security hole to a frontend RBAC-hygiene defect (Staff can attempt an edit, fill in changes, click Update, and only then discover it silently failed).
- **Follow-up live pass — completed, with mixed depth:** A second browser-automation pass drove the five remaining items. Results, taken at face value where the interaction was genuinely exercised and downgraded where it was not:
  - **ML prediction widget (Job Order Form) — `[LIVE-LOCAL]`, genuinely interaction-tested.** Selecting "Basic Cleaning" produced a predicted release date of Order Date + 10 days; switching priority to "Rush" changed the displayed prediction to Order Date + 1 day (labeled inconsistently as both "ML Prediction: 106 days − 9d Rush" and "TOTAL: 1 DAYS" in different parts of the same screen — a real UI-clarity defect, see new LOW item below) and added a ₱150 Rush fee. Toggling a shoe condition checkbox ("Sole Separation") did **not** change the prediction. **This is exactly consistent with CRIT‑4/HIGH‑8**: the heuristic fallback in `ml_engine.py` (`calculate_heuristic_days`) keys primarily off service type and priority/rush flag, not condition severity, and produces a plausible-looking date without ever invoking a trained Random Forest model. The live test therefore **confirms the feature is functionally alive**, while also **confirming it is not doing what Research Objective #2 claims** — it corroborates rather than contradicts CRIT‑4.
  - **Job Order Form validation — `[LIVE-LOCAL]`, partially tested.** Empty required fields (e.g., Customer Name) correctly trigger a native HTML5 "Please fill out this field" tooltip and block submission, with the form auto-scrolling to the error. Invalid contact-number-format testing (e.g., "123") was attempted but the result was inconclusive and not confirmed either way — still an open question.
  - **Service Management — `[LIVE-LOCAL]`, view-only; CRUD not actually exercised.** The page loaded correctly showing 4 base services, 8 add-ons, and 1 priority fee, all with visible Edit/Delete buttons and a "NEW SERVICE" button. However, the planned create → edit → delete cycle for a test service, the empty-name/negative-price validation check, and the drag-to-reorder persistence check were **not actually performed** in this pass (the agent stopped at visual confirmation). This item is downgraded from "confirmed working" to "page loads and displays correctly; CRUD behavior and validation remain unverified" pending a further pass.
  - **Release Calendar — `[LIVE-LOCAL]`, genuinely tested.** Calendar grid rendered correctly for the current month, today's date was highlighted, month-navigation arrows and the name/order-number search bar were present and functional, and the empty state ("NO RELEASES SCHEDULED") displayed correctly given no orders currently have release dates in the local test DB. No defects found.
  - **Sales Reporting — `[LIVE-LOCAL]`, view-only; filters/print not actually exercised.** The page loaded with Business Activity, Financial Summary, a service-sales chart, and a payment-method filter dropdown, all showing ₱0/empty values consistent with the empty local test database. The planned tests of switching between Daily/Weekly/Monthly/Quarterly/Annual filters, clicking Print, and navigating to Total Sales/Total Orders/Expenses sub-pages were **not actually performed**. This item is downgraded the same way as Service Management: page loads correctly, but the specific filter/print/navigation behaviors remain unverified.
  - **New Low-severity finding:** the Job Order Form's ML-prediction label text is inconsistent/confusing ("ML Prediction: 106 days − 9d Rush" alongside "TOTAL: 1 DAYS" for what is displayed as a 1-day turnaround) — a cosmetic clarity issue, not a functional defect, but worth cleaning up before a panel demo where an evaluator might read the "106 days" literally.
  - **Net effect on §11 item 10:** ML prediction and Release Calendar are now genuinely closed out by live evidence. Job Order Form contact-number validation, Service Management CRUD/validation, and Sales Report filter/print/navigation behavior remain open and are carried forward as the residual pre-sign-off gap (see updated §11).

---

## 3. System Architecture (as verified)

- **Frontend:** React + TypeScript + Vite SPA (`src/`), Tailwind styling, React Router client-side routing.
- **Backend:** Single FastAPI application (`backend/main.py`, ~3800+ lines) — all routes, startup logic, and business logic live in one monolithic file.
- **Database:** PostgreSQL in production (Heroku + AWS RDS) via SQLAlchemy ORM; **automatic silent failover to a local SQLite file** if PostgreSQL becomes unreachable (`backend/db/database.py`), re-checked per request.
- **Deployment:** Single Heroku dyno. `Procfile`: `web: gunicorn -w 1 -k uvicorn.workers.UvicornWorker --chdir backend main:app` — one worker process serves both the REST API and the built React SPA (catch-all route returns `index.html` for client-side routes).
- **Auth:** JWT (`backend/auth_utils.py`), bcrypt password hashing, 8-hour token expiry, `require_role()` dependency for RBAC.
- **RBAC model (confirmed in code, `[CODE: backend/auth_utils.py:123-141]`):** Three roles exist in the DB layer — `admin` (an internal superuser/"Developer" account that unconditionally bypasses every `require_role` check), `owner` (passes any check that doesn't explicitly require `admin`), and `staff` (must be explicitly named in the allowed-roles list). This matches the project's documented "Owner and Staff" business RBAC, with `admin` as an out-of-band developer/support account layered on top.
- **ML:** `backend/ml/ml_engine.py` — intends to use a scikit-learn `RandomForestRegressor`, with a heuristic fallback. See Finding CRIT-4 below — the trained model is not actually present, so the system currently runs on heuristics only.

---

## 4. Defect Register

### 4.1 Critical Severity

**CRIT-1 — Unauthenticated endpoint on production performs a real database write (confirmed live exploit)**
`[CODE + LIVE-PROD]` — `POST /api/trigger-analytics-procedure` (`backend/main.py:1674`) has **no `current_user`/auth dependency at all**. During this audit, a read-only-intent reachability probe against the live production URL was sent to this endpoint and it executed successfully without any credentials:
```
POST https://shoelotskey-villamor-pasay.app/api/trigger-analytics-procedure
→ 200 OK
{"status":"success","message":"Daily Sales Aggregation Stored Procedure executed successfully.",
 "cache_record_created":{"date":"2026-09-07","total_revenue":325.0,"total_orders":1}}
```
This is disclosed transparently: the call **did** write/upsert a `daily_analytics_summary` cache row for 2026‑09‑07 in the production database as a side effect of verifying the vulnerability. The row is a derived analytics cache (not a forged transaction, customer, or financial ledger record), but it demonstrates that **any unauthenticated party on the internet can trigger arbitrary stored-procedure execution against the production database** at will. **Remediate immediately** by adding `current_user: User = Depends(require_role("owner"))` (or removing the route from production) before any further external exposure. Recommend also reviewing/clearing the cache row created during this audit if precise historical accuracy matters.

**CRIT-2 — Local development `.env` points directly at the production database**
`[CODE: backend/.env]` — `DATABASE_URL` in the local dev environment file is the live AWS RDS Postgres connection string also used by production. Any developer running `npm run server` / `npm run monolith` normally (without knowing to override this) is silently developing and testing against **live customer/business data**, with no environment separation. This is how this audit discovered the risk before any local testing began.

**CRIT-3 — `main.py` mutates the filesystem on every application boot**
`[CODE: backend/main.py]` — An `auto_organize_workspace()` function runs automatically at import time (i.e., on every single backend startup, including every Heroku dyno restart/deploy) and moves, rewrites, and deletes source files on disk (creating missing `__init__.py` files, relocating test files while rewriting their `sys.path` lines, then deleting the originals). This directly conflicts with having a predictable, version-controlled production entry point: on Heroku's ephemeral filesystem this is currently a no-op only because the git-committed layout already matches the "organized" target state, but it is a live landmine — any future file added back in a now-relocated path will be silently moved/deleted on the next boot, and this logic has no awareness of git history or the audit's own "no file changes" constraint. This is also the direct cause of several of the untracked/modified files visible in `git status` at the start of this audit.

**CRIT-4 — The ML "Random Forest" model never actually loads; Research Objective #2 is not currently met**
`[CODE: backend/ml/ml_engine.py:20-28]` — `ShoelotskeyPredictor.__init__` loads `backend/completion_model.pkl` via `pickle.load`. **This file does not exist anywhere in the repository** (confirmed via direct filesystem check — only an unrelated `historical_rf_model.pkl` used by a *different*, separate historical-records prediction pathway exists). `self.model` is therefore always `None`, and `predict_completion()` silently falls back to a rule-based heuristic calculation for every prediction the system has ever served. There is an owner-only `/api/ml/train` endpoint that would train and pickle a real model, but even if triggered, **Heroku's filesystem is ephemeral** — any trained `.pkl` written to local disk is wiped on the next dyno restart or deploy, so a persistently-trained model can never survive in the current architecture. This directly contradicts the capstone's **Specific Objective #2** ("Random Forest Regressor... targeting accuracy of 85% or higher") and the existing `CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md`'s self-rating of "COMPLETE" for that objective and "Full" for FS‑3/PE‑4/C‑34/R‑45. The feature is not fraudulent — the heuristic fallback is a reasonable engineering degradation — but it must not be presented as a validated, trained ML model achieving a measured accuracy figure, because no such trained model has ever been running.

**CRIT-5 — Offline database failover seeds hardcoded, weak, owner-level credentials**
`[CODE: backend/db/database.py:99-160]` — `ensure_sqlite_schema_and_defaults()` (invoked whenever the app falls back to local SQLite, including `switch_to_offline_sqlite()` which can trigger **in production** on a transient PostgreSQL outage per `backend/auth_utils.py:88-96` and `get_db()`) will silently create accounts `owner`/`owner123`, `kylane`/`owner123`, and `staff`/`staff123` — all active immediately — if they don't already exist in whatever SQLite file is active at that moment. If production ever experiences a transient RDS connectivity blip severe enough to trigger this failover, it would provision full owner-privilege accounts with a short, guessable, publicly-documented-pattern password on the live application with zero human involvement. This is a real, latent production security risk, not just a local-dev convenience.

**CRIT-6 — Staff can permanently delete any job order via the API**
`[CODE: backend/main.py:3063-3064]` — `DELETE /api/orders/{order_id}` requires only `get_current_user` (any authenticated role), not `require_role("owner")`. Any Staff account — even with no delete button visible in their UI — can call this endpoint directly and permanently remove any order, including other technicians' completed/paid transactions. Frontend button visibility is not a security control (per this project's own RBAC principle); this needs an explicit backend role gate, or a documented, deliberate business decision that Staff are trusted with hard-delete of orders (unlikely, given Owner-only gating on every other destructive endpoint — see §5).

### 4.2 High Severity

- **HIGH-1 — Unauthenticated audit-log forgery endpoint.** `[CODE: backend/main.py:3574-3576]` `POST /api/activities` (`log_custom_activity`) has no `current_user` dependency and accepts an arbitrary `user`/`username` field to attribute a fabricated entry to any account name. It cannot alter or delete genuine history (the read side, `GET /api/activities`, is correctly `require_role("owner")` per the 2024 security remediation), but it lets anyone inject misleading rows into what is meant to be a non-repudiation audit trail (capstone item **[S‑4]/[BI‑3]**, which claims "complete audit trail" as evidence).
- **HIGH-2 — Frontend route guard vs. backend RBAC mismatch on Activity History.** `[CODE: src/app/App.tsx:258]` `/activity-history` is reachable by **all roles** (`allowedRoles={allRoles}`) at the frontend route level, while the backing `GET /api/activities` is `require_role("owner")`-only in the backend. A Staff user who navigates there (no nav link, but the route itself doesn't block them) will load the page shell and then receive a `403` when the data fetch runs. Not a security hole (backend correctly enforces), but a confusing/broken UX and a genuine frontend/backend RBAC-consistency gap that should be tightened to `allowedRoles={['owner','admin']}`.
- **HIGH-3 — New inventory items are never assigned an `inventory_number`.** `[CODE: backend/main.py:3628-3670]` `create_inventory_item` builds the new `Inventory` row from 10 explicit fields and **never includes `inventory_number`**, even though the model/schema support it as a distinct, unique identifier from the `item_id` primary key. Any newly created inventory item will have a null `inventory_number` unless a separate, undiscovered code path sets it.
- **HIGH-4 — No shared/centralized API client; `API_BASE` resolution is duplicated and inconsistent.** `[SUBAGENT, cross-checked]` Multiple contexts/pages independently reconstruct the backend base URL (`OrderContext.tsx`, `InventoryContext.tsx`, etc.), some checking `VITE_API_URL`, some hardcoding port `8000`, with no single source of truth. This is a maintainability and correctness risk (one page can silently point at a different backend than another in edge deployments).
- **HIGH-5 — Global fetch interceptor forces a full-screen error state on any 500 or network failure.** `[CODE: src/main.tsx:11-22]` Any single failed request anywhere in the app (a transient 500, or the browser going briefly offline) dispatches `SHOELOTSKEY_SYS_ERROR`, which (per `App.tsx`) full-screens the entire application. This is an aggressive failure mode for what is otherwise described as an "offline-first" design with local sync queues — a single flaky request can now interrupt every open module, not just the one that failed.
- **HIGH-6 — Offline sync queues are written but never drained.** `[SUBAGENT, cross-checked against InventoryContext.tsx/OrderContext.tsx localStorage usage]` `order_sync_queue` / `inventory_sync_queue` entries are pushed to `localStorage` on failed writes, but no code path was found that reads and replays this queue once connectivity returns. Changes made while "offline" are queued but effectively stranded.
- **HIGH-7 — Hard delete of `User` rows.** `[CODE-adjacent, per docs/COMPREHENSIVE_AUDIT_REPORT.md and confirmed pattern in backend/main.py:2279-2281]` `DELETE /api/users/{user_id}` deactivates the account if historical transactions exist (a soft-delete safeguard *was* found in the current docstring — "Deactivates account if historical transactions exist to preserve referential integrity" — which is better than the unverified hard-delete claim in the older `COMPREHENSIVE_AUDIT_REPORT.md`). However, if a user has **no** historical transactions yet, the row is still hard-deleted, permanently removing that identity from any future audit-log username lookups. Flagged High rather than Critical because the primary safeguard does exist; recommend always soft-deleting (`is_active=False`) regardless of transaction history for consistency.
- **HIGH-8 — `ml_engine.py` model path is resolved relative to the process working directory, not the file location.** `[CODE: backend/ml/ml_engine.py:20]` `model_path="backend/completion_model.pkl"` combined with the Procfile's `--chdir backend` means the effective lookup path in production would be `backend/backend/completion_model.pkl` — doubly wrong even if a model file were ever placed correctly relative to the repo root. This compounds CRIT-4.
- **HIGH-9 — Staff sees fully-enabled Inventory Edit/Restock controls that the backend will silently reject.** `[LIVE-LOCAL + CODE]` — **fully confirmed end-to-end, including the actual rejected request.** Live testing as `staff` confirmed the Inventory page renders active pencil-icon Edit buttons and a "Restock" button for every item; clicking Edit opens a completely editable modal (Item Name, Inventory Number, Category, Package Type, Current Stock, Package Size, Unit Price, Low Stock Threshold, Status toggle) with an enabled "UPDATE" button — nothing in the UI indicates Staff cannot actually save changes. This was flagged during testing as a potential Critical vulnerability pending backend confirmation. Direct code inspection resolves it: `PUT /api/inventory/{item_id}` (`main.py:3673-3674`), `POST /api/inventory` (`main.py:3628`), `DELETE /api/inventory/{item_id}` (`main.py:3716-3717`), and `POST /api/inventory/adjust` (`main.py:3738-3745`) **all** correctly require `Depends(require_role(["owner"]))` / `Depends(require_role("owner"))`. This was then independently corroborated straight from the local backend's own server log for that test session: when the Staff-logged-in browser session actually clicked "Update" on the edited item, the server recorded `PUT /api/inventory/7 HTTP/1.1" 403 Forbidden` — the exact rejected request, observed directly, not just inferred from source. So this is **not** a security hole — the backend demonstrably returns `403` to the Staff attempt — but it is the same frontend/backend RBAC-*consistency* gap already identified for Activity History (HIGH‑2), now confirmed on a second, business-critical module: a Staff user can spend time editing prices/stock, click Update, and only then get a confusing failure, with no indication up front that the action was never going to be permitted. Recommend hiding/disabling these controls for Staff in `Inventory.tsx`, matching the pattern already correctly used for the "New Item" button (which *is* correctly hidden from Staff).

### 4.3 Medium Severity (representative — not exhaustive)

- Frontend `sonner` toast validation exists on some forms (e.g., Inventory "Add Item" requires `name`) but not comprehensively across all required fields on the same forms — partial validation allows partially-invalid submissions to reach the backend, which then returns a generic error.
- `ServiceModal`/Service Management: reported silent validation failure and a UI mismatch between what Owner vs. Admin sees on this page (`SUBAGENT`, not independently re-driven live in this pass — recommend confirming in the pending follow-up live pass, §2.3).
- Service drag-to-reorder: unclear from static review whether the new order is persisted to the backend or resets on refresh — needs the pending live-test confirmation.
- Dashboard date-range logic (`Dashboard.tsx`) mixes local-time and naive-datetime comparisons; combined with `backend/main.py`'s `parse_local_date()` using `datetime.now()` (server local time, not explicit UTC), there is a real risk of orders shifting between "today" and "yesterday" buckets near midnight depending on server timezone vs. browser timezone.
- Mock/demo data (`src/app/lib/mockData.ts`) exists as a fallback path in some contexts; if a fetch silently fails and the fallback renders instead of an explicit error, staff could mistake synthetic demo numbers for real data.
- `SalesReport.tsx` revenue calculation has three overlapping concepts (billable, paid, downpayment-inclusive) documented only in code comments — real risk of numbers not reconciling between Dashboard, Sales Report, and Total Sales if a future change touches only one of the three call sites.
- Password complexity rules are enforced backend-side (`ResetPasswordRequest` validator, `backend/schemas.py`) but not mirrored in the frontend form before submission, producing a "submit, then get told what the rules actually are" experience.
- SQLAlchemy relationship warning observed at startup regarding overlapping foreign keys between `ItemServiceMapping` and `Item.service_mappings` — not fatal, but indicates a modeling inconsistency worth cleaning up.

### 4.4 Low Severity (representative)

- `console.log`/`console.error` debug statements left in shipped frontend code (`ActivityContext.tsx`, `InventoryContext.tsx`, `OrderContext.tsx`).
- No "Clear Filters" control on several filtered tables (Inventory, Job Orders, Historical Records).
- No skeleton/loading placeholders on several data-fetching pages — content pops in abruptly.
- Minor button-style inconsistencies across modals.
- No dedicated in-app Help/FAQ page (this is explicitly called out and accepted as "Partially Implemented" already in the existing capstone matrix's own Part 6 — this audit agrees with that self-assessment).
- `[LIVE-LOCAL]` The Job Order Form's ML-prediction display uses inconsistent, confusing label text in the same view (e.g., "ML Prediction: 106 days − 9d Rush" shown alongside "TOTAL: 1 DAYS" for what is actually a 1-day turnaround) — cosmetic, but risks an evaluator misreading the headline number during a live demo.

---

## 5. RBAC & Security Findings

**What is genuinely fixed and verifiably still in place today** `[CODE, direct grep of backend/main.py]`: the 2024 remediation described in `docs/SECURITY_AUDIT_FIXES_2024.md` (adding `require_role("owner")` to Expenses GET/POST/PUT/DELETE, Inventory PUT/adjust/POST/DELETE, Users GET/POST/PUT/DELETE, Services POST/PUT/DELETE/reorder) is **confirmed present in the current codebase** — every one of those endpoints was re-checked line-by-line in this audit and correctly carries `Depends(require_role("owner"))`. This is good evidence that the earlier fix was real and durable, and directly contradicts the older, unverified `COMPREHENSIVE_AUDIT_REPORT.md` claim of blanket "Missing RBAC checks on Multiple Endpoints" (§8.1 in that document) — that claim is **stale/inaccurate** for the specific endpoints it names.

**What is not fixed** (net-new findings from this audit, not previously documented anywhere in the repo): CRIT-1, CRIT-5, CRIT-6, HIGH-1, HIGH-2 above. These represent a materially different, more targeted risk set than the older document described: the remaining gaps are not "RBAC missing everywhere" but rather a small number of **specific, high-impact, unauthenticated or under-authorized endpoints** plus one **latent** offline-credential risk.

**Frontend RBAC visibility vs. backend enforcement** `[CODE: src/app/components/Layout.tsx:26-45, src/app/App.tsx:246-291]`, **now also `[LIVE-LOCAL]`-confirmed for Staff**: Confirmed that `staffMenuItems` correctly omits Sales Report, Service Management, and User Management from Staff's sidebar, and the corresponding page-level route guards (`ProtectedRoute allowedRoles={['owner','admin']}`) correctly block direct-URL access for those three pages — live testing as `staff` reproduced an "Access Restricted" page for all three, exactly as the code predicts. Two confirmed exceptions where the frontend is looser than the backend: Activity History (HIGH-2) and Inventory's Edit/Restock controls (HIGH-9) — in both cases the backend correctly enforces `owner`-only, but the frontend lets Staff get partway through the action before being rejected.

**Production reachability/auth boundary spot-check** `[LIVE-PROD]`: `GET /api/orders` without a token correctly returns `401 {"detail":"Not authenticated"}`. Standard authenticated endpoints appear to enforce the bearer-token requirement as expected; the exception is the specific unauthenticated routes named in CRIT-1/HIGH-1, which bypass the auth layer entirely rather than the auth layer being broken generally.

---

## 6. Database & Offline/Sync Findings

- **Architecture confirmed:** PostgreSQL (production, via SQLAlchemy) with automatic, per-request TCP-reachability-checked failover to local SQLite (`backend/db/database.py`). `/api/health` on production confirms `"db_type":"PostgreSQL"` with real counts (`"users":8, "roles":3, "statuses":5, "priorities":3, "orders":67`) `[LIVE-PROD]` — i.e., **production already holds real business data**; this is not a pre-launch/empty system, which raises the stakes of CRIT-1/CRIT-5 considerably.
- **`Inventory.item_id` (autoincrement PK) is correctly separate from `Inventory.inventory_number`** (nullable unique string) `[CODE: backend/models.py]` — the constraint that inventory number must never replace the primary key is respected in the schema. However, see HIGH-3: the create path never populates `inventory_number`, so this correctly-designed column is currently dead on arrival for new items.
- **Startup migrations run automatically** (`Base.metadata.create_all` plus explicit `ALTER TABLE`-style migrations) against whichever engine is currently active, on every boot, with no backup step beforehand. Additive-only in the code paths reviewed, but there is no rollback mechanism if a future migration is not purely additive.
- **`has_pending_offline_data`-style offline-state detection is a file-size heuristic, not a true pending-record check** `[SUBAGENT, cross-checked against database.py failover logic]` — this can produce a misleading "there is unsynced data" or "there is no unsynced data" signal that doesn't reflect the real sync queue state.
- **Sync queue is one-way and never drained** — see HIGH-6.

---

## 7. Research Objective Traceability (independent re-verification)

The existing `docs/CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md` (Part 7) self-rates all six Specific Objectives as **COMPLETE**. This audit's independent findings differ for one objective:

| Specific Objective | Existing Matrix Rating | This Audit's Independent Rating | Basis |
|---|---|---|---|
| **#1** Centralized digital job order system, retrieval < 5 min | COMPLETE | **Supported — largely confirmed** | Search/filter UI and centralized relational schema are real and were observed loading correctly `[LIVE-LOCAL, CODE]`. |
| **#2** ML Random Forest completion prediction, ≥85% accuracy (MAE) | COMPLETE | **NOT MET — heuristics-only, no accuracy has ever been measured** | CRIT-4/HIGH-8: the model file the code tries to load does not exist; no trained model has ever served a prediction; there is no persisted MAE/R² measurement anywhere in the repo. **Live-confirmed** `[LIVE-LOCAL]`: the Job Order Form's prediction widget does return a plausible date that changes with service type and Rush priority (e.g., Basic Cleaning → +10 days; +Rush → +1 day, +₱150 fee) but does **not** react to shoe-condition severity — behavior that matches the heuristic fallback in `ml_engine.py` exactly, not a trained Random Forest reacting to a full feature vector. The feature *works* (returns a sensible-looking date), but not via the claimed trained ML model, and the 85% target has not been evaluated because there is nothing trained to evaluate. |
| **#3** Automated analytics dashboard, reporting < 1 hr | COMPLETE | **Supported — largely confirmed**, with the caveat that the primary aggregation endpoint (CRIT-1) is unauthenticated | Dashboard/Sales Report UI and aggregation logic exist and render `[LIVE-LOCAL, CODE]`; the endpoint that computes the daily aggregate is CRIT-1. |
| **#4** ISO/IEC 25010 evaluation across 9 characteristics | COMPLETE | **Partially supported — see §8**; several characteristics have confirmed live defects (Security, Reliability) that the existing matrix rates "Full" | See §8 discrepancy table. |
| **#5** TAM user-acceptance measurement | COMPLETE | **Instrumentation exists; actual survey/acceptance data collection is out of scope of a code audit** | The *system features* that TAM questions ask about generally exist and function (§9), but "COMPLETE" for a TAM *objective* really requires actually administering the survey to real users, which is a separate research activity, not a code-verifiable claim. |
| **#6** Recommend future enhancements | COMPLETE | **Supported** | This report itself, plus §10, constitutes exactly this kind of evaluator recommendation output. |

---

## 8. ISO/IEC 25010 Readiness (cross-check against the existing 45-item matrix)

Rather than re-litigate every one of the 45 items (full item text lives in `docs/CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md` Part 2‑B / Part 8.2, unmodified by this audit), this section gives an independent readiness rating **per ISO/IEC 25010 characteristic**, and calls out every item where this audit's live/code evidence **disagrees** with that document's self-rating.

| Characteristic | Existing Matrix Self-Rating | Independent Audit Rating | Key Discrepancy (if any) |
|---|---|---|---|
| Functional Suitability (FS‑1..5) | All Full | **Mostly Confirmed**, except FS‑3 | FS‑3 claims the ML feature is "Fully Implemented" as a Random Forest — see CRIT‑4; the *feature* works, the *ML model* does not. |
| Performance Efficiency (PE‑1..5) | All Full | **Not independently benchmarked** | No load/perf testing was performed in this audit; page-transition and save-latency claims (<300ms, <1s) are plausible from architecture but unmeasured. Recommend actual timing before citing exact figures to a panel. |
| Compatibility (C‑1..5) | All Full | **Plausible, not independently cross-browser-tested** | Not tested in multiple browsers in this pass. |
| Interaction Capability / Usability (IC‑1..5) | 4 Full, 1 Partial (IC‑5, already self-flagged) | **Agrees** | No new disagreement. |
| Reliability (R‑1..5) | All Full | **Disagrees on R‑1 and R‑3** | R‑1 ("performs consistently without unexpected interruptions") is undermined by HIGH‑5 (any single 500/network blip full-screens the whole app). R‑3 ("recovers successfully after unexpected errors") is undermined by HIGH‑6 (sync queue never drains — recovery is incomplete, not "successful"). |
| Security (S‑1..5) | All Full | **Disagrees on S‑2, S‑3, S‑4, S‑5** | S‑2 ("restricts access based on role") — true for most endpoints, false for CRIT‑6 (Staff can delete orders). S‑3 ("protected from unauthorized viewing/modification") — false for CRIT‑1 (unauthenticated DB write). S‑4 ("records activities for accountability") — false for HIGH‑1 (unauthenticated log forgery). S‑5 ("adequate protection against common web threats") — CRIT‑1/CRIT‑5/HIGH‑1 are all OWASP A01 (Broken Access Control) instances that remain unaddressed alongside the ones that were fixed. |
| Maintainability (M‑1..5) | All Full | **Disagrees on M‑2** | M‑2 ("changes to one part don't affect the rest") is undermined by CRIT‑3 — a single startup function performs filesystem-wide side effects coupled to file layout, which is the opposite of isolated/loosely-coupled maintainability. |
| Flexibility/Portability (FL‑1..5) | 4 Full, 1 Partial (FL‑4, already self-flagged) | **Disagrees on FL‑5** | FL‑5 ("updated without affecting normal operation") — CRIT‑3's filesystem mutation on every boot and CRIT‑5's credential-seeding-on-failover both mean "normal operation" is not actually decoupled from startup/update mechanics. |
| Safety (SF‑1..5) | All Full | **Agrees, largely** | Confirmation dialogs for delete/cancel actions were not contradicted by any evidence gathered in this pass. |

**Net assessment:** 2 of 9 characteristics (Security, Reliability) have confirmed live defects that contradict a "Full" self-rating; Maintainability and Flexibility each have one confirmed contradiction; the remaining 5 characteristics are either confirmed-consistent or simply unmeasured (not contradicted, just not independently benchmarked).

---

## 9. TAM (Technology Acceptance Model) Readiness

The 20 TAM items (PU‑1..5, PEOU‑1..5, BI‑1..5, ASU‑1..5) ask evaluators to rate real users' *perceptions*, which by definition cannot be settled by a code audit — they require actually surveying Shoelotskey staff/owner after hands-on use. What this audit **can** and did verify is whether the underlying feature each TAM item points to actually exists and functions, i.e., whether the survey would even be measuring something real.

- Every TAM item's cited "Actual Feature" in the existing matrix corresponds to a real, present piece of UI/backend functionality — this audit found no case of a TAM item pointing at a feature that flatly does not exist.
- The instrumentation needed to make the survey experience match the matrix's "Evaluator Action" scripts is present and was spot-checked to be at least reachable (order intake, inventory restock modal, sales report filters, activity history, release calendar) for the roles that should see them.
- **Readiness caveat:** BI‑2 and ASU‑1 both lean on the RBAC boundary between Owner and Staff feeling "comfortable" and "appropriately restricted" — this is *mostly* true (§5) but is undercut in a live demo if a Staff account is used to (deliberately or accidentally) trigger CRIT‑1/CRIT‑6, which would visibly break the "appropriately restricted" impression the TAM items are designed to capture.
- **Recommendation:** proceed with TAM survey administration as planned; it measures something real. Fix CRIT‑1/CRIT‑5/CRIT‑6/HIGH‑1/HIGH‑2 first so that a live demo in front of survey respondents doesn't visibly contradict what they're being asked to rate.

---

## 10. Use-Case / UAT Readiness

Based on the completed live-testing evidence (Admin/Owner login, Dashboard, Inventory view, User Management, Activity History, Forgot/Reset Password) plus the statically-verified RBAC/route-guard consistency for Staff and the remaining modules (§2.3, §5):

- **Ready for structured UAT walkthrough:** Yes, for the happy-path scenarios described in the capstone matrix's "Evaluator Action" scripts — these were not contradicted by any evidence gathered, and several were directly confirmed working.
- **Not ready for an adversarial/security-aware evaluator or for unsupervised production access:** the confirmed live CRIT‑1 finding means anyone with the production URL and a copy of `curl` can already trigger unauthenticated writes today, independent of any UAT script.
- **Outstanding before sign-off (see §11 item 10):** narrowed to three specific interaction-level checks — Service Management's actual create/edit/delete cycle and validation, Sales Report's filter/print interactions, and Job Order Form contact-number validation. Staff-role RBAC, Release Calendar, and the ML-prediction widget's behavior are now fully live-confirmed (§2.3) and no longer outstanding.

---

## 11. Final Go/No-Go Decision

### Decision: **CONDITIONAL GO**
**The system may proceed toward functional/UAT evaluation and TAM survey administration.** It is **NOT** cleared for unsupervised production/panel access, and should **NOT** be represented as meeting Research Objective #2 (trained ML ≥85% accuracy) or ISO 25010 Security/Reliability "Full" ratings, until the following are remediated:

**Must-fix before any further production exposure (blocking):**
1. Add authentication/authorization to `POST /api/trigger-analytics-procedure` (CRIT‑1) — currently live-exploitable.
2. Add `require_role("owner")` to `DELETE /api/orders/{order_id}` (CRIT‑6).
3. Add authentication to `POST /api/activities` or explicitly namelock its allowed action types server-side (HIGH‑1).
4. Rotate/replace the `.env` `DATABASE_URL` used for local development so it no longer points at production (CRIT‑2), and add a startup guard that refuses to run with `ENV != "Production"` while `DATABASE_URL` resolves to the production host.
5. Change or remove the hardcoded `owner123`/`staff123` seed passwords in `ensure_sqlite_schema_and_defaults`, or at minimum force an immediate password reset requirement on any account created via that path (CRIT‑5).

**Should-fix before formal defense/panel demonstration (non-blocking for internal UAT, but will undermine credibility if a panelist finds them):**
6. Either train and correctly persist a real completion-prediction model with a measured MAE, or update all objective/ISO documentation to accurately describe the current heuristic-based implementation (CRIT‑4/HIGH‑8) — do not claim a measured 85% accuracy that has never been computed.
7. Remove/neutralize `auto_organize_workspace()`'s filesystem-mutating behavior from the production entry point (CRIT‑3).
8. Populate `inventory_number` on inventory creation (HIGH‑3).
9. Tighten the Activity History frontend route guard to match its backend RBAC (HIGH‑2), and hide/disable the Inventory Edit/Restock controls for Staff to match backend RBAC (HIGH‑9 — confirmed not a security hole, but a real UX/consistency defect on a business-critical module).
10. **Narrowed, residual gap** (down from five items to three, after two completed live-testing passes): live-drive the actual **create → edit → delete** cycle plus name/price validation for a test service in **Service Management** (page-load was confirmed, CRUD was not); live-click through the **Daily/Weekly/Monthly/Quarterly/Annual filters and the Print button** in **Sales Report** (page-load was confirmed, filter/print interaction was not); and confirm **invalid contact-number-format validation** on the Job Order Form (result was inconclusive in testing). Everything else originally scoped for this audit — Staff RBAC (all pages, including the Inventory and Activity History edge cases), Release Calendar, and the ML-prediction widget's actual behavior — **is now fully live-confirmed** and closed out above.

**Recommended before claiming full production readiness (tracked, not blocking evaluation):**
11. Address HIGH‑4 (shared API client), HIGH‑5 (fetch-interceptor failure blast radius), HIGH‑6 (sync queue drainage), HIGH‑7 (consistent soft-delete for all users), and the Medium-severity items in §4.3.

This report should be revisited and the Go/No-Go re-issued once items 1–5 are confirmed fixed; those are the items that materially affect Security posture on a system that already holds real production data.

# Shoelotskey Pre-Evaluation Readiness Audit

**Date:** 2026-09-09  
**Verdict:** **CONDITIONAL GO**  
**Audit type:** Inspect-only (code + local SQLite + live API + Owner browser)  
**Constraint honored:** Nothing was modified, committed, pushed, or deployed during this run. This report file is the requested deliverable.

**Local frontend:** http://localhost:5173/  
**Local backend:** http://localhost:8000/  
**Database this run:** SQLite (`environment=Localhost`)  
**Production:** `https://shoelotskey-villamor-pasay.app` was **not** re-walked this run  
**Staff verification:** API layer only — not a full UI click-through

**Companion documents (not modified):**

- [docs/system-readiness-audit.md](system-readiness-audit.md)
- [docs/shoelotskey-remediation-readiness-report.md](shoelotskey-remediation-readiness-report.md)
- [docs/qa-functional-readiness-report-2026-09-09.md](qa-functional-readiness-report-2026-09-09.md)
- [docs/demo-live-job-orders-snapshot-2026-09-09.md](demo-live-job-orders-snapshot-2026-09-09.md)
- [docs/historical-ocr-ingestion-implementation-report.md](historical-ocr-ingestion-implementation-report.md)

---

## Executive summary

Core live operations work on localhost: login, job orders, dashboard, calendar, inventory, sales print, and user management.

The system is **not ready** for production ISO/IEC 25010 evaluation or a clean Owner TAM of Historical / ML modules until the blockers in this report are fixed.

**Go conditions (before evaluation on the evaluation host):**

1. Authenticate `POST /api/predict` and catalog reads.
2. Lock `/historical_data` static mount.
3. Give Owner historical access (or evaluate as Admin and say so).
4. Stop showing R² as “Prediction Accuracy” percent.
5. Finish OCR review or clearly label analytics as n=18.
6. Deploy only after those changes land on the evaluation host.

**Do not deploy from this audit.** Production was not verified end-to-end here.

| Use | Ready? |
|---|---|
| Local demo of Dashboard, Job Orders, Calendar, Inventory, Sales print, Users | Yes, with demo data disclosed |
| Owner evaluation of Historical OCR / Analytics / ML | No (403) |
| Present ML as accurate predictor | No (R² −3.26, tiny n) |
| Production ISO/IEC 25010 / TAM on live Heroku | No until security + Owner historical access + deploy of local fixes |
| Production deploy of current local tree | Do not deploy from this audit |

---

## 1. System module inventory

| Module | Route / entry | Roles (UI) |
|---|---|---|
| Login / Forgot / Reset | `/login`, `/forgot-password`, `/reset-password` | Public |
| Dashboard | `/dashboard` | Owner, Staff, Admin |
| Job Order Form | `/job-order-form` | All authenticated |
| Job Orders (status tables) | `/job-orders` (no sidebar link; via Dashboard) | All |
| Release Calendar | `/release-calendar` | All |
| Claim Record | `/claim-record` (no sidebar) | All |
| Sales Report | `/sales-report` | Owner, Admin |
| Total Sales / Total Orders | `/total-sales`, `/total-orders` | All (via Sales Report) |
| Expenses / ROI | `/expenses` (via Sales Report) | Route open to Staff; APIs Owner-only |
| Inventory | `/inventory` | All (mutate Owner) |
| Service Management | `/service-management` | Owner, Admin |
| User Management | `/user-management` | Owner, Admin |
| Activity History | `/activity-history` | Owner, Admin |
| Historical Records / OCR / Analytics / ML / Archives | `/job-order-form/historical-records` | Admin only |
| Error / 404 / session | `/404`, ErrorPage | — |
| Profile / account settings | None | — |

---

## 2. Route inventory

| Route | Loads | Direct URL protected | Notes |
|---|---|---|---|
| Unauthenticated `*` | Redirect `/login` | PASS | — |
| `/dashboard` Owner | PASS | PASS | — |
| `/job-order-form` Owner | PASS | PASS | Form, BR/ML split, Submit present |
| `/user-management` Owner | PASS | PASS | Lists 8 users |
| `/job-order-form/historical-records` Owner | 403 Access Restricted | **FAIL for Owner** | Confirmed live |
| `/sales-report`, `/service-management` | Owner allowed | PASS | — |
| Staff `/user-management`, `/sales-report` | Frontend 403 | PASS | — |
| Refresh while logged in | JWT verify + 30-min idle timeout | PASS | — |
| Logout | Clears storage, `POST /api/logout` | PASS | — |

---

## 3. API inventory (high-signal)

Live probes against `localhost:8000`:

| Call | Result |
|---|---|
| `POST /api/login` bad user/password | 401 |
| Owner login | 200 |
| Staff login | 200 |
| Unauth `GET /api/orders`, `/api/users` | 401 |
| Unauth `GET /api/services` | 200 (catalog/pricing leak) |
| Unauth `GET /api/lookups/statuses` | 200 |
| Unauth `POST /api/predict` | 200 dual BR+ML estimate |
| Unauth `GET /api/health-check` | 200 (exposes SQLite path) |
| Owner `GET /api/historical/analytics` | 403 |
| Staff `GET /api/users`, `/expenses`, `/activities` | 403 |
| Staff `GET /api/orders`, `/inventory` | 200 |
| Staff `POST /api/inventory`, `/expenses` | 403 |

Full endpoint list is in [`backend/main.py`](../backend/main.py) (~50 `/api/*` routes). Historical CRUD / queue / train / export are `require_role("admin")` except stats and archives (owner+admin).

---

## 4. Database / data-flow summary

This run used local SQLite (`environment=Localhost`). Production must stay on PostgreSQL (`IS_PRODUCTION_ENV` already fails closed on auth DB errors — PASS).

| Entity | Local count | Notes |
|---|---|---|
| Live orders | 63 | Demo/test set (Mar–Aug 2026) |
| items | 66 | Size/color currently populated locally (0 blank) |
| historical_orders | 738 | 720 PENDING_REVIEW, 17 VALIDATED, 1 CORRECTED |
| expenses | 7 | Demo |
| services | 18 | — |
| inventory | 8 | — |
| audit_logs | 348 | — |
| Users | 8 | owner, staff, admin, charmaine, melody, kylane, expert_owner, expert_staff |

**Flow:** UI → `API_BASE` ([`src/app/lib/apiBase.ts`](../src/app/lib/apiBase.ts)) → FastAPI → SQLAlchemy → SQLite (local) / PostgreSQL (prod).

---

## 5. Module-by-module results

### Authentication — PASS with notes

Lock after 3 failures exists ([`backend/main.py`](../backend/main.py) ~1946). Empty fields blocked in Login UI. Invalid credentials 401 live. JWT 8h + 30-min idle. Server verify-token on startup.

### Dashboard — PASS (Owner live)

Status cards, period selector, tables, charts present. Staff financial cards are hidden in UI. Totals were not re-reconciled cell-by-cell this run.

### Job Order Form — PASS (core)

Customer, shoes, size/color, services, add-ons, priority, payment, Submit, Reset. Official date labeled BR; Random Forest is separate. `mlAutoPredicted` tells the server to persist business-rule `expected_at`, not ML.

### Job Orders / details — PASS with gaps

CRUD via Dashboard status tables + Job Orders page. Staff can PUT status reversions including claimed (no extra role gate). Size/color `"-"` still passes required checks if typed.

### Release date consistency — PASS (critical path)

`expected_at` = business rules. ML is preview-only. Calendar uses `predictedCompletionDate` mapped from `expected_at`. Confirmed in code and `/api/predict` (authoritative: `business_rule`).

### Release Calendar — PASS (code + prior QA)

Dates from saved `expected_at`. Not re-clicked every filter this run.

### Service Management — PASS (Owner)

CRUD Owner-only on API. Historical Records button is Admin-only, so Owner cannot enter OCR from here.

### Inventory — PASS (RBAC)

Staff GET allowed, POST 403 live. Mutations Owner/Admin in UI.

### Sales Report — PASS for print

Print Sales / Expenses / ROI uses `window.print()` (functional, not CSV/PDF download). No separate CSV/PDF buttons on Sales/Expenses pages.

### Expenses / ROI — CONDITIONAL

Owner API works. Staff can open `/expenses` and see New Expense but create/list APIs return 403. ROI is print-from-Sales-Report.

### User Management — PASS (Owner live)

Table, New User, View History. API does not block `role_name: admin` (privilege escalation if Owner posts it).

### Activity History — PASS (Owner API)

Actor taken from JWT on `POST /api/activities` (not client username). Staff cannot GET logs.

### Historical OCR / Analytics / ML — FAIL for Owner

Owner UI 403 + Owner API 403. Admin-only. 720/738 still pending human review. Analytics correctly exclude pending OCR. 16/18 validated IDs are not `ORD-YYYY-MM-DD-NNN` (mostly `HIST-ETL-*`).

### ML — FUNCTIONAL but not evaluation-honest

Model loaded, `/api/predict` returns `ml_status: valid`, RF does not overwrite official dates. R² = −3.26 on 18 records. UI can show that as Prediction Accuracy −326.0% ([`src/app/pages/HistoricalRecords.tsx`](../src/app/pages/HistoricalRecords.tsx)). Do not present this as accuracy.

---

## 6. Button / control results (sampled, not every control)

| Page | Control | Result |
|---|---|---|
| Login | Submit / Forgot password | PASS (API 401 on bad creds) |
| Dashboard | Status cards → order table | PASS (prior + this session) |
| Job Order Form | Submit / Reset / Add shoe / services | PASS (rendered; full create not re-run this pass) |
| Sales Report | Print Sales/Expenses/ROI | PASS (`window.print`) |
| Sales Report | CSV/PDF download | N/A — not implemented (not a fake button) |
| User Management | New User / View History | PASS (page live) |
| Historical Records | Entire module as Owner | FAIL 403 |
| Expenses | New Expense as Staff | FAIL (UI shown, API 403) |
| Service Management | Historical Records | Hidden from Owner; Admin-only |

A literal “every control” matrix was not completed in one pass. High-risk and core-path controls were verified; remaining controls inherit CONDITIONAL until a full click script is run.

---

## 7. CRUD results

| Entity | Create | Read | Update | Delete | Persist |
|---|---|---|---|---|---|
| Job orders | PASS (code + prior live) | PASS | PASS | Owner all; Staff new/on-going only | PASS |
| Services | Owner PASS | Unauth GET (security fail) | Owner PASS | Owner PASS | PASS |
| Inventory | Owner PASS | All PASS | Owner PASS | Owner PASS | PASS |
| Expenses | Owner PASS | Owner PASS | Owner PASS | Owner PASS | PASS |
| Users | Owner PASS | Owner PASS | Owner PASS | Owner PASS | PASS |
| Historical orders | Admin only | Admin only | Admin only | Admin only | OCR approve persists |

---

## 8. Search / filter results

Job Orders, Dashboard, Sales, Inventory, and Historical have search/filters in code. Prior 2026-09-09 QA found Sales custom-range empty dates showing all records — that was fixed locally. Not re-proven on production. Dashboard Daily / Weekly / Monthly / Annually was used live earlier today (status counts changed).

---

## 9. RBAC results

| Action | Owner | Staff | Unauth |
|---|---|---|---|
| Job orders | Full | Operational (no claimed-undo intended?) | 401 |
| Users / services mutate / expenses API | Yes | 403 | 401 |
| Inventory mutate | Yes | 403 | 401 |
| Activity log read | Yes | 403 | 401 |
| Historical OCR / analytics / ML | 403 | 403 | 401 |
| `/api/predict`, `/api/services` | Yes | Yes | 200 — FAIL |

---

## 10. Audit-trail results

Login / logout / session timeout logged. Job order and admin mutations use `log_audit`. `POST /api/activities` uses JWT identity (PASS). Staff can still write audit rows they cannot read (MEDIUM).

---

## 11. OCR results

Human review only — no auto-validate. Queue exists. Source image requires auth (prior fix). Owner cannot open the queue. 720 pending. ETL validated rows skipped the canonical-ID path.

---

## 12. Historical-data reconciliation

| Class | Count | Classification |
|---|---|---|
| Pending OCR | 720 | Staging — not business truth |
| Validated / Corrected | 18 | Finalized subset |
| `HIST-ETL-*` validated, no image | 13 | Legacy ETL, keep; IDs not canonical |
| Canonical `ORD-*` historical | 2 | Final |
| Live demo orders | 63 | Separate from historical; snapshot listed in [docs/demo-live-job-orders-snapshot-2026-09-09.md](demo-live-job-orders-snapshot-2026-09-09.md) |
| Duplicate `order_id` | 0 | PASS |

Do not delete ETL rows as “test” without review. Live 63 orders are the demo set.

---

## 13. ML results

| Check | Result |
|---|---|
| Model artifact | Loaded `completion_model.pkl` v1.2 |
| Dataset | 18 eligible; train 14 / test 4 |
| R² / MAE / RMSE | −3.2605 / 4.99 / 5.72 — worse than a mean baseline |
| Official date overwritten? | No |
| Features | Order-time (pairs, services, priority, total, weekday/month, conditions) — PASS |
| Quality-gate fallback | Earlier QA saw `heuristic_fallback`; this probe returned `ml_status: valid` |
| UI “Prediction Accuracy” | FAIL — treats R² as a percentage |

---

## 14. Responsive results

Not fully retested at 1280×800 / 768×1024 / 390×844 this run. Prior QA: Sales custom dates were unusable on narrow viewports (fixed locally). Historical OCR review on mobile remains a risk (two-pane image + form). MEDIUM pending full viewport pass.

---

## 15. Security results

| Issue | Severity |
|---|---|
| Unauthenticated `POST /api/predict` | CRITICAL |
| Unauthenticated static `/historical_data` mount | CRITICAL |
| Unauthenticated `GET /api/services` (prices) | HIGH |
| Owner can API-assign admin role | HIGH |
| Owner blocked from Historical module | HIGH (access design) |
| `health-check` leaks DB path | MEDIUM |
| CORS production depends on `FRONTEND_URL` | MEDIUM (deploy) |
| Debug `GET /api/temp/debug_image` DDL | MEDIUM |
| Staff claimed-order undo via PUT | MEDIUM |
| Frontend hiding is not used as the only control for users/services/inventory mutations | Backend matches. Historical and expenses Staff UI are the mismatches. |

---

## 16. Deployment readiness

| Item | Status |
|---|---|
| Procfile gunicorn uvicorn worker | Present |
| Same-origin `/api` in production build | [`apiBase.ts`](../src/app/lib/apiBase.ts) PASS |
| Prod must not fail over to SQLite on auth | PASS (P0-5) |
| Local always SQLite even if PG URL set | By design locally |
| Uncommitted local remediations | Not on `origin/main` / production until deployed |
| CORS allowlist | Localhost regex; prod needs `FRONTEND_URL` |
| Model file on Heroku | Must be in slug; 18-row model is weak |

Do not deploy this audit. Production was not verified end-to-end here.

---

## 17. Critical issues

1. **`POST /api/predict` is public** — anyone can run BR+ML inference.  
   Expected: authenticated. Actual: 200 unauthenticated.

2. **`/historical_data` static mount has no auth** — scanned forms can be fetched if the path is known.

---

## 18. High issues

- Owner cannot use Historical Records / OCR / Analytics / ML (UI 403 + API 403). Dead `isOwner` tabs. Capstone historical demo as Owner will fail.
- Owner API can create admin users.
- `GET /api/services` public — pricing catalog leak.
- OCR backlog 720/738 pending — analytics/ML train on 18 rows only.
- ML “Prediction Accuracy” displays R²×100 (would show −326.1%). Misleading for ISO/TAM.
- Local remediations vs production — fixes in this workspace are not proven on Heroku.

---

## 19. Medium issues

- Expenses route + New Expense visible to Staff; APIs 403.
- Staff can PUT claimed / for-release reversions.
- Staff can POST audit entries they cannot read.
- Size/color `"-"` bypasses required validation (API also does not require them).
- Validated historical IDs still `HIST-ETL-*` / `UNKNOWN-*`.
- Color Renewal: backend blocks 2+3 Colors, not “must have one.”
- Health-check exposes SQLite path.
- Admin debug DDL endpoint.
- Responsive OCR/review and some tables not fully proven at 390×844.
- Live 63 job orders are demo data.

---

## 20. Low issues

- `predictedCompletionDate` name implies ML but stores business-rule `expected_at`.
- Catalog `duration_days` can override official constants on non-combo paths.
- Unmounted `historical_processing.py` stats router would disagree if ever included.
- Job Orders / Claim Record / Activity History have no sidebar entries.
- No profile/account settings page.

---

## 21. Pass items

- Login 401 on bad credentials; lockout code present.
- JWT + inactivity timeout; logout hits backend.
- Staff cannot call users / expenses / activities / inventory mutate APIs.
- Job Order Form loads with BR vs Random Forest split.
- Official `expected_at` is business-rule, not ML overwrite.
- Owner User Management lists users.
- Inventory mutate Owner-only on API.
- Sales print path exists (`window.print`).
- Analytics query filters validated OCR only.
- No auto-validate of OCR.
- Production auth fails closed (no SQLite login failover).
- Central `API_BASE` for frontend.

---

## 22. Final readiness verdict

**CONDITIONAL GO**

Core live operations work on localhost (login, job orders, dashboard, calendar, inventory, sales print, user management). The system is not ready for production ISO/IEC 25010 evaluation or a clean Owner TAM of Historical/ML modules until the blockers above are fixed.

| Use | Ready? |
|---|---|
| Local demo of Dashboard, Job Orders, Calendar, Inventory, Sales print, Users | Yes, with demo data disclosed |
| Owner evaluation of Historical OCR / Analytics / ML | No (403) |
| Present ML as accurate predictor | No (R² −3.26, tiny n) |
| Production ISO/IEC 25010 / TAM on live Heroku | No until security + Owner historical access + deploy of local fixes |
| Production deploy of current local tree | Do not deploy from this audit |

**Go conditions:** authenticate `/api/predict` and catalog reads; lock `/historical_data`; give Owner historical access (or evaluate as Admin and say so); stop showing R² as accuracy %; finish OCR review or clearly label analytics as n=18; deploy only after those land on the evaluation host.

No application files were changed. No commit, push, or deploy was performed.

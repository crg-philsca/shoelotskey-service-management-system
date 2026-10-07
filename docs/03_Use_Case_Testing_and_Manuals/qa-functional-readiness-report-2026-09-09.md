# Shoelotskey Functional QA & Readiness Report

**Date:** 2026-09-09  
**Branch:** `capstone-fixes`  
**Scope:** Local inspect → start app → browser QA → targeted API/DB checks → fix discovered defects → retest  
**Local frontend:** http://localhost:5173/  
**Local backend:** http://127.0.0.1:8000/  
**Database this run:** SQLite (`environment=Localhost`, `db_type=SQLite`) — expected for localhost  
**Production deploy / git push:** **not performed**

**Baseline context only (not re-audited as a full rewrite):**

- [docs/shoelotskey-remediation-readiness-report.md](shoelotskey-remediation-readiness-report.md)
- [docs/historical-ocr-ingestion-implementation-report.md](historical-ocr-ingestion-implementation-report.md)
- [docs/system-readiness-audit.md](system-readiness-audit.md)

Historical OCR ingestion was treated as a **completed subsystem to verify**. Bulk OCR was **not** rebuilt or rerun.

---

## Executive summary

Local application QA was executed in a real browser against the running Vite frontend and FastAPI backend. Staff / Owner / Admin login, RBAC, dashboard, job-order create, sales/ROI date ranges, inventory/service leftovers from earlier QA, historical records, OCR validation queue, analytics, and ML status were observed live.

Three functional defects found during this run were fixed and retested:

1. OCR validation queue previously showed only a partial pending set (`limit=50`).
2. OCR source images failed authentication and fell back to a placeholder CDN.
3. Historical analytics included pending OCR orders.
4. Sales Report Custom range with empty dates showed **all** records, and the date inputs were hidden below the `sm`/`lg` breakpoint.

Security controls for the previously identified issues remain in place and were re-checked locally. No security control was removed to make a test pass.

The Random Forest model **is loaded** locally (`completion_model.pkl`, dataset size 14). Live `/api/predict` often still returns `heuristic_fallback` because of the quality gate. The job-order form preview date and the persisted `expected_at` still disagree.

**Is the system ready for formal evaluation?**

**CONDITIONAL GO** for a local evaluation walkthrough.

**Not READY** for production / deployed formal evaluation until the current local remediations are deployed to the evaluation host and the remaining blockers below are accepted or fixed.

---

## 1. Files inspected

Inspected before and during QA (not an exhaustive file list of the whole repo):

| Area | Files |
|---|---|
| Auth / RBAC | `backend/auth_utils.py`, `backend/main.py` (trigger-analytics, activities, DELETE order, users, inventory, historical queue/validate) |
| OCR status vocabulary | `backend/historical/ocr_status.py` |
| Historical UI | `src/app/pages/HistoricalValidationQueue.tsx`, `src/app/pages/HistoricalRecords.tsx` |
| Sales / ROI | `src/app/pages/SalesReport.tsx` |
| Routing / nav | `src/app/App.tsx`, `src/app/components/Layout.tsx` |
| ML artifacts | `backend/completion_model.meta.json`, `backend/completion_model.pkl` (existence + metadata) |
| API base | `src/app/lib/apiBase.ts` |
| TypeScript config | `tsconfig.json` (not changed this session; `tsc --noEmit` passed) |

---

## 2. Files changed during this session

| File | Change | Why |
|---|---|---|
| `src/app/pages/HistoricalValidationQueue.tsx` | Queue fetch `limit=800`; also loads `/historical/stats`; source image fetched with `Authorization` and shown as a blob URL | Queue previously represented ~57 of 723 pending items; `<img>` without JWT returned 401 and used `via.placeholder.com` |
| `backend/main.py` | `GET /api/historical/analytics` filters with `validated_filter_values()` | Pending OCR orders (`738`) were leaking into analytics totals and garbage months |
| `src/app/pages/SalesReport.tsx` | Custom range with empty dates returns no rows; Start / End / Clear controls visible on narrow viewports | Custom with empty dates showed all 67 orders; date inputs were `hidden sm:flex` and unusable at 613px |

Temporary QA probe scripts were created and deleted. `.env`, databases, and model artifacts were not committed.

---

## 3. Tests executed

| Kind | What | Result |
|---|---|---|
| Browser | Staff / Owner / Admin login, logout, protected routes | Executed |
| Browser | Dashboard, Job Order Form create, Release Calendar, Sales Report ranges, Historical Records / OCR / Analytics / ML Training | Executed |
| Browser | Network interruption + Retry | Executed |
| Browser | Desktop `1280×800` and narrow `613×429` | Executed |
| API | Unauth / Staff / Owner / Admin on security-sensitive endpoints | Executed |
| API | `/api/health`, `/api/login`, `/api/orders`, `/api/predict`, `/api/ml/status`, historical stats/analytics/queue | Executed |
| Database | SQLite counts, OCR statuses, confidence, engines, FK sanity, negative inventory probe | Executed |
| Quality | `npx tsc --noEmit` | Pass |
| Quality | `npm run build` | Pass (earlier this run) |
| Quality | `python -c "import main"` | Pass |
| Quality | ML unit tests **without retraining** (`test_ml_eligible_query_count`, `test_predict_returns_source`) | Pass |
| Quality | Full `pytest` suite | **Not run** (`pytest` not installed) |

---

## 4. Browser workflows tested

Minimum required path, actually walked:

**LOGIN → DASHBOARD → CREATE JOB ORDER → ML PREVIEW → RELEASE CALENDAR → SALES / ROI → EXPORT MENU → ADMIN HISTORICAL RECORDS / OCR / ANALYTICS / ML TRAINING → LOGOUT**

Repeated with appropriate **Staff**, **Owner**, and **Admin** sessions.

Earlier in the same QA run (before this continuation): Services create (**QA Test Polish**), Inventory restock (Cleaner jug + expense `QA-RESTOCK-001`), wrong-password / lockout, staff inventory mutation hiding.

---

## 5. Passed tests

### Authentication and RBAC

| Test | Evidence |
|---|---|
| Owner login | Dashboard loaded as Owner |
| Staff login | Dashboard loaded as Staff |
| Admin login | Dashboard loaded; Historical Records accessible |
| Logout | Returned to `/login` |
| Staff `/sales-report` | Access Restricted |
| Staff `/user-management` | Access Restricted |
| Staff `/job-order-form/historical-records` | Access Restricted |
| Owner `/job-order-form/historical-records` | Access Restricted (admin-only route) |
| Staff sidebar | Dashboard, Job Order Form, Release Calendar, Inventory, Logout only |
| Owner desktop sidebar | Also Sales, Service, Users |

API authorization (this run):

| Caller | Endpoint | Status |
|---|---|---|
| Unauth | `POST /api/trigger-analytics-procedure` | 401 |
| Staff | `POST /api/trigger-analytics-procedure` | 403 |
| Owner | `POST /api/trigger-analytics-procedure` | 200 |
| Unauth | `GET /api/activities` | 401 |
| Staff | `GET /api/activities` | 403 |
| Owner | `GET /api/activities` | 200 |
| Unauth | `DELETE /api/orders/830` | 401 |
| Staff | `DELETE /api/orders/795` (for-release) | **403** |
| Staff | `DELETE /api/orders/830` (new-order) | **200** — allowed by design |
| Unauth | `GET /api/historical/processing/queue` | 401 |
| Staff / Owner | queue | 403 (admin required) |
| Admin | queue `limit=1` | 200 |
| Unauth / Staff | validate POST | 401 / 403 |
| Unauth / Staff | inventory PUT | 401 / 403 |
| Unauth / Staff | users GET | 401 / 403 |
| Staff | users POST | 403 |
| Owner | users GET | 200 |
| Staff | expenses GET | 403 |
| Unauth | historical image | 401 |
| Admin | `/api/historical/analytics` | 200 — 15 finalized records |
| Admin | `/api/historical/stats` | 200 — 738 / 15 / 14 / 723 |

### Dashboard

- Owner Daily after regression create: New Order **3**, Daily Sales **₱662.50**, Daily Expenses **₱0.00**.
- Charts rendered. No NaN / Infinity observed.
- After backend outage, Retry restored the Staff dashboard without a crash.

### Job orders

- Required customer name enforced.
- Created **QA Regression Owner**, `0918-555-0101`, Nike / Air Max QA, Basic Cleaning ₱325, 50% downpayment ₱162.50.
- Saved as `order_id=830`, `ORD-2026-09-09-001`, status `new-order`, `grand_total=325.00`.
- **QA Test Polish** remained in the service list.

### Sales / expenses / ROI

| Range | Sales | Orders | Expenses | Notes |
|---|---|---|---|---|
| Daily | ₱500 | 2 | ₱0 | ROI **---%** (zero-expense path; not Infinity/NaN) |
| Weekly | ₱500 | 4 | ₱500 | Cards and report period updated |
| Monthly | ₱5,162.5 | 20 | ₱700 | Revenue ₱7,600 / profit ₱6,900 |
| Quarterly | ₱18,337.5 | 52 | ₱1,910 | Revenue ₱23,800 / profit ₱21,890 |
| Annually | ₱24,117.5 | 67 | ₱2,460 | Revenue ₱31,550 / profit ₱29,090 |
| Custom (empty dates, after fix) | ₱0 | 0 | ₱0 | Date inputs + Clear visible at 613px |
| Custom 2026-09-01 – 2026-09-09 | ₱500 | 4 | ₱500 | Revenue ₱1,325 / profit ₱825 / ROI **165.0%** |
| Clear | back to Daily | | | Worked |

ROI formula observed in UI: expenses > 0 → `(profit / expenses) * 100`; expenses = 0 → `---%`.

### Historical OCR / Records / Analytics

- Records tab: finalized HIST-ETL rows only; pagination pages **1** and **2**.
- OCR Validation: **Needs Human Review (1 of 725)**; source image loaded as blob **1392×1028**; confidence **50.0%**; extracted customer/item fields shown.
- Analytics: **15** orders, **₱18,872.00**, **59.9 days**, **48** pairs, most requested **Basic Cleaning**. Months **2024-08 / 2025-08 / 2025-10**. Pending OCR not included.
- ML Training tab: Ready, Random Forest Regressor, last trained **2026-09-09 03:49**, **15 Validated · 14 ML-Eligible**.

### Network / responsive / quality

- Backend stopped → Connection Lost + Retry. After restart, Retry recovered the dashboard.
- Narrow viewport (613×429): navigation hamburger, forms, sales cards usable.
- Desktop (1280×800): persistent owner/admin sidebar; OCR validation usable.
- `tsc --noEmit` exit 0. `tsconfig.json` was not modified.

---

## 6. Failed / incomplete tests

| ID | Test | Result |
|---|---|---|
| ML-1 | Form release date vs saved `expected_at` | Form showed **09/19/2026**; API saved **2026-09-28T06:21:00** |
| ML-2 | Live Random Forest path | `/api/predict` returned `source: heuristic_fallback` while `model_loaded: true` |
| CAL-1 | Predicted new-order date on Release Calendar | Calendar is for-release only; search “QA Regression” → no matching orders |
| EXP-1 | CSV / PDF file contents | CSV menu item clicked; file was **not** opened independently. PDF / native print dialog not completed |
| OCR-persist | Validate / Reject persist after refresh / relogin | **Not executed** — would mutate the historical archive |
| PYTEST | `python -m pytest tests/test_auth.py …` | Not run (`No module named pytest`) |

---

## 7. Bugs found

| ID | Issue | Severity | Status |
|---|---|---|---|
| OCR-1 | Queue UI used frontend `limit=50`, so hundreds of pending records were not represented | High | **Fixed** |
| OCR-2 | Source image request had no JWT → 401 → placeholder image | High | **Fixed** |
| ANA-1 | Analytics included PENDING_REVIEW orders (738, junk dates such as `6398-02`) | High | **Fixed** |
| RPT-1 | Custom range with empty dates returned every order; date pickers hidden on small screens | Medium | **Fixed** |
| ML-1 | Client heuristic preview date ≠ server-saved `expected_at` | Medium | **Open** |
| ML-2 | RF loaded but live predict often heuristic (quality gate, n=14) | Medium / expected | **Open** — honest, do not retrain on pending OCR |
| CAL-1 | Release Calendar omits predicted dates for `new-order` | Medium / existing design | **Open** |

---

## 8. Bugs fixed

1. **OCR queue completeness** — `HistoricalValidationQueue` now requests `?limit=800` and can show the pending total from `/historical/stats`. Browser: **1 of 725**.
2. **Authenticated source image** — fetch with `Authorization` + `encodeURIComponent`, display via `URL.createObjectURL`. Browser: real receipt blob 1392×1028, not `via.placeholder.com`.
3. **Analytics finalized-only** — `/api/historical/analytics` uses `validated_filter_values()`. Browser + API: **15** records, ₱18,872, no garbage month.
4. **Custom report range** — empty Custom no longer means “all time”; Start / End / Clear work on mobile/tablet-width. Browser: empty Custom ₱0; 2026-09-01–09 filtered to 4 orders; Clear returned to Daily.

---

## 9. Remaining blockers

1. **Not deployed.** Production / evaluation host was not updated. Do not claim production security from this local run.
2. **ML-1** form preview vs persisted release date will confuse evaluators if they compare the form to the saved order / calendar.
3. **ML-2** live RF path is rarely used with only 14 ML-eligible records.
4. **CAL-1** predicted new-order dates do not appear on the Release Calendar.
5. OCR Validate / Reject persistence after refresh/relogin was not proven in this run (intentionally not mutating the archive).
6. PDF export was not independently opened.

None of these are silent security holes on localhost. They are evaluation / honesty / completeness gaps.

---

## 10. Security issues remaining

**No previously identified critical local security issue was left silently unresolved.**

Still enforced and re-checked:

- `POST /api/trigger-analytics-procedure` — owner-only
- `GET /api/activities` — owner-only
- `DELETE /api/orders/{id}` — Staff limited to `new-order` / `on-going`; for-release/claimed → 403
- Historical queue / validate — admin-only
- Inventory mutations — elevated role
- User-management mutations — elevated role

Localhost SQLite is **intentional** via the P0-2/P0-5 localhost guard. Production must never silently fall back to SQLite; that was not re-tested on Heroku because deploy was forbidden.

Frontend “Access Restricted” is not treated as the only control. API 401/403 was verified.

---

## 11. OCR status

Measured on local SQLite **2026-09-09** (this run). Bulk OCR was not rerun.

| Metric | Count |
|---|---|
| Source files discovered / registered (prior verified) | 722 / 722 |
| `historical_images` | **725** (includes PDF page rows) |
| `historical_orders` | **738** |
| Gemini (`gemini-3.5-flash` + `gemini-vision-v1`) | **40** (12 + 28) |
| EasyOCR (`easyocr-v1`) | **5** |
| Tesseract (`tesseract-v1`) | **680** |
| Images with OCR confidence > 0 | **725** |
| Images with zero confidence | **0** (earlier snapshot reported 2; current DB is 0) |
| Image `PENDING_REVIEW` | **723** |
| Image `VALIDATED` | **2** |
| Order `PENDING_REVIEW` | **723** |
| Order `VALIDATED` | **15** |
| `REJECTED` | **0** |
| Images missing parent order FK | **0** |
| Newly ingested records auto-validated this run | **No** |

Canonical UI / workflow vocabulary: `PENDING_REVIEW`, `VALIDATED`, `REJECTED` (legacy aliases may exist internally).

---

## 12. ML status

From `backend/completion_model.meta.json`, `/api/ml/status`, `/api/predict`, and the ML Training tab.

| Field | Value |
|---|---|
| Model type | Random Forest Regressor |
| Model loaded | **true** |
| Version | 1.1 |
| Dataset size | **14** |
| Train / test | 11 / 3 |
| ML-eligible count | **14** (1 validated record missing critical fields) |
| R² | **0.7113** (Analytics UI labels this “Prediction Accuracy 71.1%”) |
| MAE | **1.09** |
| RMSE | **1.32** |
| Trained at | 2026-09-09 03:49 |
| Data source | VALIDATED + ML-eligible `historical_orders` only |
| Live `/api/predict` | `source: heuristic_fallback`, 16 days, predicted date 2026-09-25 |
| Form preview for Basic Cleaning | 09/19/2026 |
| Persisted `expected_at` for order 830 | 2026-09-28 |

No fabricated accuracy claim beyond the measured R² / MAE / RMSE. Model was **not** retrained on unvalidated OCR.

---

## 13. Build / type / test status

| Check | Status |
|---|---|
| `npx tsc --noEmit` | Pass (including after Sales Report and OCR UI edits) |
| `npm run build` | Pass (earlier this run) |
| Backend import (`import main`) | Pass |
| ML unit tests without retrain | Pass |
| Full pytest / lint suite | Not run (`pytest` missing) |
| `tsconfig.json` | Not changed; deprecated `baseUrl` already removed |

---

## 14. Exact URLs / routes tested

**Frontend**

- http://localhost:5173/login
- http://localhost:5173/dashboard
- http://localhost:5173/job-order-form
- http://localhost:5173/release-calendar
- http://localhost:5173/sales-report
- http://localhost:5173/user-management
- http://localhost:5173/job-order-form/historical-records

**Backend**

- http://127.0.0.1:8000/api/health
- http://127.0.0.1:8000/api/login
- http://127.0.0.1:8000/api/orders
- http://127.0.0.1:8000/api/predict
- http://127.0.0.1:8000/api/ml/status
- http://127.0.0.1:8000/api/trigger-analytics-procedure
- http://127.0.0.1:8000/api/activities
- http://127.0.0.1:8000/api/users
- http://127.0.0.1:8000/api/inventory/{id}
- http://127.0.0.1:8000/api/expenses
- http://127.0.0.1:8000/api/historical/processing/queue
- http://127.0.0.1:8000/api/historical/processing/validate/{id}
- http://127.0.0.1:8000/api/historical/analytics
- http://127.0.0.1:8000/api/historical/stats
- http://127.0.0.1:8000/api/historical/image/{filename}

---

## 15. Tests that could not be performed

- Opening the downloaded CSV or PDF in an external application
- Completing the native browser print dialog
- OCR approve / reject / field-correct persist after refresh and relogin (archive left untouched)
- Full pytest suite
- Production / Heroku deploy verification
- User Management create / edit / delete in the browser
- Staff `/activity-history` page (API 403 was checked)

---

## 16. Final readiness verdict

### CONDITIONAL GO

Use this verdict for a **local** Staff / Owner / Admin walkthrough of the current working tree.

Do **not** mark READY until:

1. The current remediations are deployed to the evaluation host (only when explicitly requested).
2. Production health shows PostgreSQL with **no** silent SQLite fallback.
3. Evaluators are briefed on, or the product fixes, the form-vs-saved release-date mismatch.
4. Optionally, one or two OCR records are human-validated so Validate → Records persist is proven in the browser (not bulk, not auto-validate).

### Identifiable local test data left in the database

Clean up only through the application or a controlled DB action. Do not destroy real historical OCR.

- Job order `830` / `ORD-2026-09-09-001` — customer **QA Regression Owner**
- Service **QA Test Polish** (₱99)
- Cleaner restock + expense reference `QA-RESTOCK-001`

### Deployment

**Do not push or deploy** until this report’s remaining critical/production blockers are accepted and an explicit deploy is requested.

# Final End-to-End Functionality QA Report

**System:** Shoelotskey Web-Based Service Management System  
**Date:** 9 September 2026  
**Environment:** Local Vite `http://localhost:5173/` + FastAPI `http://127.0.0.1:8000/` + SQLite `backend/db/shoelotskey.db`  
**Roles used:** Admin/Developer (`admin`), Owner (API), Staff (`staff`)  
**Scope:** End-to-end consistency — UI → API → database → audit trail → details/inspect → persistence — plus responsive behavior.  
**Not in scope:** Bulk OCR, mass validation, ML retraining, redesign, commit/push/deploy.

Verdict key: **PASS** = actually tested and confirmed · **FAIL** = tested and broken · **FIXED** = broken, corrected, and retested · **NOT TESTED** · **NOT APPLICABLE**

---

## Final readiness verdict

**Locally ready for evaluation of interactive, CRUD, RBAC, audit-inspect, search/filter, sales/export, OCR isolation, and ML date-consistency behavior.**

No unresolved *critical* functional defect remains in the modules retested this pass after the add-on catalog fix.

Remaining items are environmental or pre-existing data-integrity observations (concurrent Owner-session mutations, some older audit rows without `user_id`, live `/api/predict` quality-gate fallback, physical PDF file not captured by the embedded browser, `pytest` not a project dependency).

---

## 1. Complete module inventory

| Module | Route(s) | Sidebar (Admin/Owner) | Sidebar (Staff) |
|---|---|---|---|
| Login / Logout / Forgot / Reset | `/login`, `/forgot-password`, `/reset-password` | — | — |
| Dashboard | `/dashboard` | Yes | Yes |
| Job Order Form | `/job-order-form` | Yes | Yes |
| Job Orders list | `/job-orders` | No (URL only) | No (URL only) |
| Release Calendar | `/release-calendar` | Yes | Yes |
| Claim Record | `/claim-record` | No (URL / flow) | No |
| Sales Report | `/sales-report` | Yes | Hidden + Access Restricted |
| Total Sales / Total Orders / Expenses | `/total-sales`, `/total-orders`, `/expenses` | Via Sales Report | Hidden |
| Inventory | `/inventory` | Yes | Yes |
| Service Management | `/service-management` | Yes | Hidden + Access Restricted |
| User Management | `/user-management` | Yes | Hidden + Access Restricted |
| Activity History | `/activity-history` | Via User Management | Hidden + Access Restricted |
| Historical Records / OCR / Analytics / ML | `/job-order-form/historical-records` | Admin only | Access Restricted |
| Not Found | `*` | — | — |

Interactive control classes inventoried from source (`onClick`, `onSubmit`, buttons, links, search, filters, pagination, sort, modals, print/export, restock, status, validate/reject): Dashboard, Job Order Form, Release Calendar, Inventory, Service Management, User Management, Activity History, Sales Report / Total Sales / Total Orders / Expenses, Historical Records, Claim / Edit / Detail / Restock / Process Claim modals.

---

## 2. Interactive feature categories tested

| Category | Result | Evidence |
|---|---|---|
| Login / Logout | **PASS** | Admin session used throughout; Staff login on `:5173`; Logout returned to `/login` |
| Sidebar / hamburger | **PASS** | Desktop links; mobile sheet opens Dashboard…User Management + Logout |
| Search (Users) | **PASS** | `STAFF` → 1 row; `zzz-no-such-user` → empty; clear → full list; mobile `staff` reduced action buttons |
| Search (Activity) | **FIXED** | `qae2estaff01` initially missed target entity; after fetch `limit=2000` + old/new-value scan → 7 matching Inspect rows |
| Filters (Users / Activity / Sales range) | **PASS** | Role filter + Reset; Activity search; Daily ₱0 vs Annually ₱23,617.5 / 63 orders |
| Pagination | **PASS** | Activity History pages 1–5 of 19; User Management page 1 |
| Create / Edit / Delete users | **PASS** | QA user `qae2estaff01` (id 135) create/update/duplicate/cancel-delete/confirm-delete |
| Create / Cancel / Delete services | **PASS** | QA add-on create ₱99; Cancel did not persist; Confirm delete removed id 68 |
| Job Order create / status / calendar | **PASS** | Prior QA order `ORD-2026-09-09-001` date chain (later removed by concurrent Owner cleanup) |
| Inventory restock | **PASS** | Prior restock Cleaner 4800→8800 mL + expense + audit; negative stock PUT 400 |
| Sales range / ROI / CSV | **PASS** | Daily/Weekly/Annually labels and totals change; ROI 1442.1% not Infinity/NaN; CSV implementation generated `shoelotskey-report-*.csv` |
| Audit Inspect | **PASS** | Human-readable Record Deleted layout (actor, date, affected record, username/email/role) |
| Print / PDF | **NOT TESTED** (physical file) | Print DOM / html2pdf path exists; embedded browser did not produce a saved PDF file |
| Historical validate / reject | **NOT TESTED** this pass | Prior pass proved one persistent validation; this pass did not re-validate or reject (forbidden) |
| Job Orders page (`/job-orders`) | **NOT TESTED** | Routed but not in sidebar; not exercised this pass |

---

## 3. Responsive viewport results

| Viewport | Pages | Result |
|---|---|---|
| Desktop ~1280×800 | Dashboard, JO Form, Users, Services, Activity, Inventory, Sales, Calendar, Historical | **PASS** — nav, tables, modals, filters usable |
| Tablet ~768×1024 | User Management | **PASS** — desktop sidebar still shown (`md:`); search, New User, filters, actions visible |
| Mobile ~390×844 | Dashboard, User Management | **PASS** — hamburger/sheet works; Dashboard cards readable; search/New User/filters usable |
| Mobile action icons | User Management | **PASS** with limitation — unlabeled edit/delete icons are easy to mis-tap; opened Confirm Delete for real user `melody`; **Cancel** closed dialog and DB still had 6 users including `melody` |

No action was hidden solely by CSS on the pages exercised. Add-on list on Job Order Form was previously clipped at `max-h-[108px]`; height increased to `160px` so later catalog add-ons remain reachable.

---

## 4–6. CRUD, database alignment, search, filter, pagination

### User Management (`qae2estaff01`)

| Step | UI | API | Database | Audit | Persistence |
|---|---|---|---|---|---|
| Create | New user listed | 200, `user_id=135` | Row present | Admin CREATE | Survived refresh |
| Update email | Updated email shown | 200 | `qae2estaff01.updated@shoelotskey.test` | UPDATE | Survived refresh |
| Duplicate username | Toast “Username already exists”; modal stays | Rejected | No extra row | — | — |
| Empty create | HTML required blocks | No request | Unchanged | — | — |
| Delete Cancel | Dialog closes; row remains | — | Count still includes 135 | None | — |
| Delete Confirm | Row gone from list/search | Count 6, no 135 | `qae2estaff01 count 0` | DELETE recorded; Inspect target `qae2estaff01` | Still gone after refresh |

**Audit actor note:** The DELETE inspect for id 135 showed **Performed by: owner (Owner)** at 07:47 while this pass’s Confirm was clicked as Admin. Concurrent Owner-authenticated deletes of the same QA user (and of QA orders/expenses) were also logged. Backend `delete_user` writes `user=current_user` from JWT. Treat as **environment interference**, not a proven JWT-spoof. Newer JWT-backed logs include `user_id`.

### Services (`QA E2E Addon Clean`)

| Step | UI | API | Database | Audit | Persistence |
|---|---|---|---|---|---|
| Cancel create | Modal closed; catalog unchanged | 13 services, qa `[]` | No QA row | — | — |
| Create ₱99 add-on | Listed ACTIVE ₱99 | `service_id=68`, `base_price=99.00`, category addon | Same | CREATE (backend) | Present after navigation |
| Price on Job Order Form | After Basic Cleaning: addon listed; checking it set downpayment **₱212.00** (325+99)/2 | Matches catalog | Matches | N/A (unsaved form) | Cancelled; no order written |
| Delete Cancel | Still listed | Still 68 | Still 68 | — | — |
| Delete Confirm | Removed from catalog | 13 services, qa `[]` | No QA row | DELETE | Still gone |

### Job Orders (prior QA order in this overall pass)

| Check | Result |
|---|---|
| FORM release date = `/api/predict` date = `orders.expected_at` = list = Release Calendar | **PASS** — `2026-09-28` for `ORD-2026-09-09-001` / `order_id=828` |
| Status Move to On-Going | UI + DB `on-going`; `expected_at` unchanged |
| Later persistence | **FAIL (external)** — row disappeared via Owner DELETE (audit 261/267); not deleted by this QA operator’s Admin UI after verification |

### Inventory restock (prior in this overall pass)

UI 8,800 mL = API = DB 8800 = inventory log +4000 = expense 134 = audit restock. Negative PUT rejected 400. Expense 134 later Owner-deleted. End-of-pass Cleaner stock observed at **800 mL** on Staff dashboard (further concurrent mutation). Do not treat as this pass’s restock bug.

### Search / filter / pagination

- User search empty / exact / case / nonexistent / clear: **PASS**
- Activity search by target username: **FIXED** then **PASS**
- Sales Daily vs Weekly vs Annually: labels and totals change; Annually orders **63** = live `orders` count: **PASS**
- Activity pagination “PAGE 1 OF 19”: **PASS**
- Combined filter + pagination on every table: **NOT TESTED** exhaustively (Users + Activity + Sales covered)

---

## 7. Details / View / Inspect quality

| Surface | Result |
|---|---|
| Activity Inspect — User Deleted | **PASS** — “RECORD DELETED / PERFORMED BY owner (Owner) / AFFECTED RECORD qae2estaff01 / USERNAME / EMAIL / ROLE staff”. Technical JSON behind collapsed “Technical Information (For IT Auditors)” |
| Activity list titles | **PASS** — User Created / User Updated / User Logged In / Record Deleted (not raw `DELETE_USER`) |
| Order / Historical Records dates & currency | **PASS** (prior pass) — human-readable; some historical service chips concatenate visually |
| Raw JSON as the only inspect body | **FAIL** not observed on inspected entries |

---

## 8–9. Audit trail E2E and Activity History UI

Controlled actions that produced inspectable logs: login, create/update/delete QA user, create/delete QA service, prior JO create/status, prior restock.

| Check | Result |
|---|---|
| Actor from JWT not client `user` field | **PASS** — `POST /api/activities` uses `current_user` |
| Search / Inspect / pagination / refresh | **PASS** (search **FIXED**) |
| Filter by module/user/action/date | **NOT TESTED** individually beyond search + list module badges |
| Dual logging | Backend CREATE/UPDATE plus frontend `POST /api/activities` still occurs for some user actions |
| 23 older audits missing `user_id` | Pre-existing; newer JWT logs have `user_id` |
| Cannot falsely attribute via client payload | **PASS** (code + prior API check) |

---

## 10–13. Users, services, inventory, sales / expenses / ROI

Covered above. Additional Sales/ROI:

| Metric (Annually, UI 07:54) | Value |
|---|---|
| Sales | ₱23,617.5 |
| Orders | 63 |
| Expenses | ₱1,960 |
| Pending | ₱6,607.5 |
| Revenue | ₱30,225 |
| Net profit | ₱28,265 |
| ROI (print target) | **1442.1%** |
| Infinity / NaN | Absent |
| Zero-expense Daily/Weekly | Cards ₱0; ROI formula uses `---` when expenses are 0 |

Custom Start/End/Apply/Clear: **NOT TESTED** (menu opened; dates not applied).

---

## 14. Export results

| Export | Result | Honesty note |
|---|---|---|
| CSV | **PASS** | `Downloads/shoelotskey-report-Annually.csv` (and Daily/Monthly files) exist with period header, Sales Records, Expenses Records. Filename includes period. UI print-target for Annually listed **63** `ORD-` rows matching the 63-order card. An older CSV on disk still contained later-deleted QA orders — do not treat that stale file as the 07:54 UI dataset. |
| Print | **PASS** (DOM) | Print-only report includes period, sales rows, expenses, ROI summary |
| PDF | **NOT TESTED** | `html2pdf.js` + filename `shoelotskey-{type}-report-{period}.pdf` implemented; no physical PDF file captured in this browser |

---

## 15. OCR results

| Check | Result |
|---|---|
| Archive registration | **PASS** (completed work, re-verified earlier) — 722/722 sources, 725 images, ~722 PENDING_REVIEW |
| One validated record persistence | **PASS** (prior pass; not re-validated) |
| Records tab | **PASS** — validated rows human-readable |
| OCR Validation tab | **PASS** (view only) — “Needs Human Review”; no mass validate |
| Analytics totals | **PASS** — 16 historical orders / ₱21,332 / 15 ML training records; pending not in trusted totals |
| Reject / field correction this pass | **NOT TESTED** |
| Validated evidence record | Not deleted |

---

## 16. ML results

| Check | Result |
|---|---|
| PENDING_REVIEW excluded from training query | **PASS** — `test_ml_eligible_query_count` |
| Live `/api/predict` source | **PASS** — often `heuristic_fallback` (1–40 day quality gate); **not forced to Random Forest** |
| Form / API / DB / calendar date agreement | **PASS** on QA order 828 (`2026-09-28`) |
| `test_predict_returns_source` | **PASS** |
| `test_predict_date_matches_engine_for_basic_cleaning` | **PASS** |
| `test_train_and_reload_random_forest` | **NOT TESTED** (would retrain; forbidden) |
| Metadata `dataset_size` vs live eligible count | 14 vs 15 — last-train snapshot; not retrained |

---

## 17. Error-handling results

| Case | Result |
|---|---|
| Missing required user/service fields | **PASS** — HTML required / Create disabled without name+price |
| Duplicate username | **PASS** — error toast, no extra row |
| Negative inventory | **PASS** — HTTP 400 “Stock quantity cannot be negative.” |
| Unauthenticated API | **PASS** — 401 |
| Staff API to owner/admin routes | **PASS** — 403 (users, activities, historical queue, inventory PUT) |
| Delete confirmation Cancel | **PASS** — users, services; accidental `melody` delete |
| Stale / missing record | **NOT TESTED** systematically |
| Backend down / false success | **NOT TESTED** this pass (prior remediation existed) |
| Invalid ID | **NOT TESTED** this pass |

---

## 18. Role / RBAC results

| Role | UI visibility | Direct URL | API | DB protection |
|---|---|---|---|---|
| Admin | Full owner menu + Historical | Allowed | Admin bypasses `require_role` | Writes audited |
| Owner | Owner menu; no Historical | Historical 403 API (prior) | Owner-only routes 200 | — |
| Staff | Dashboard, Job Order Form, Release Calendar, Inventory only | `/sales-report`, `/user-management`, `/activity-history`, `/historical-records` → **Access Restricted** | 403 on users/activities/historical/expenses as previously measured | Mutations require JWT |

Staff browser login on a **second Vite origin** (`:5174`) failed `fetch` to `:8000` (CORS / isolated origin). Staff UI RBAC was completed on `:5173` after Admin logout.

---

## 19. Database integrity results

| Check | Result |
|---|---|
| Duplicate usernames | **PASS** — none |
| Duplicate order numbers | **PASS** — none |
| Negative stock | **PASS** — none |
| Users at end of pass | 6: kylane, admin, melody, charmaine, owner, staff |
| Orders | 63 |
| QA leftovers | User 135 gone; service 68 gone; no QA add-on |
| Orphan FKs | **PASS** at start-of-pass check |
| `user_id=67` identity | **Limitation** — observed as `melody` / `melodynotes@gmail.com`; this pass did not rename it |
| Concurrent Owner DELETEs of QA orders/expenses/users | **Limitation** — audit shows Owner actor; local DB is shared |
| Shoe Laces qty 0 | Operational (Critical), not a QA defect |

---

## 20. Responsive CRUD

| Action | Mobile/Tablet | Result |
|---|---|---|
| Search users | Mobile + tablet | **PASS** |
| Open New User | Visible | **PASS** (not fully submitted on mobile) |
| Delete confirmation Cancel | Mobile (accidental `melody`) | **PASS** |
| Job Order add-on after fix | Desktop (also the viewport that clipped add-ons) | **FIXED** |
| Full create/edit/delete on mobile | Users/services | **NOT TESTED** complete lifecycle (desktop covered) |

---

## 21. Final button sweep (representative)

Classifications are for controls actually clicked this overall pass, not a claim that every icon in the application was pressed.

**PASS:** Logout, sidebar links, New User, User search/filters, User edit/save, User delete Cancel/Confirm, Activity Inspect/search/pagination/Back, New Service, Service Cancel/Create/category/delete Cancel/Confirm, Basic Cleaning checkbox, QA add-on checkbox (after fix), JO Cancel, Sales range Daily/Weekly/Annually, Export CSV, Inventory restock (prior), Status Move to On-Going (prior), Calendar day (prior), Historical tabs view (prior), hamburger, mobile Close, Staff Access Restricted Back target.

**FIXED:** Activity search; Job Order unmatched catalog add-ons hidden; add-on list max height.

**NOT TESTED:** Every print submenu, every expense row action, Claim Record full path, `/job-orders` page, Custom sales dates, PDF file, OCR Reject, drag-reorder services, every dashboard chart control.

**NOT APPLICABLE:** Forced Random Forest usage; mass OCR.

No unexplained dead button was left on the pages that were fully loaded and clicked.

---

## 22. Exact build / test results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** — exit 0 |
| `npm run build` | **PASS** — exit 0, `✓ built in 2m 9s` (chunk-size warnings only; sonner dynamic/static import warning) |
| `python -c "import main"` | **PASS** — `import_ok`, SQLite |
| `test_ml_eligible_query_count` | **PASS** |
| `test_predict_returns_source` | **PASS** |
| `test_predict_date_matches_engine_for_basic_cleaning` | **PASS** |
| `test_train_and_reload_random_forest` | **NOT TESTED** (would retrain) |
| `pytest` as a project runner | **NOT APPLICABLE** — not listed in `requirements*.txt`; tests were invoked as Python callables |

---

## 23. Bugs discovered, root causes, fixes, retest

### 1. Activity History search missed the affected username — **FIXED**

- **Symptom:** Search `qae2estaff01` → “No matching audit logs found” while Inspect details contained that username.
- **Root cause:** `GET /api/activities` default `limit=100`; client search ignored `oldValues`/`newValues`; `resolve_details` omitted `new_values.details` / username.
- **Fix:** `backend/main.py` `resolve_details`; `ActivityContext` `?limit=2000`; `ActivityHistory` search + inspect affected-record; `UserManagement` `addActivity` `recordId` + structured `newValues`.
- **Retest:** Search `qae2estaff01` → multiple rows; Inspect Affected Record = `qae2estaff01`.

### 2. New Service Management add-ons never appeared on the Job Order Form — **FIXED**

- **Symptom:** `QA E2E Addon Clean` persisted (API id 68, DB ₱99) but Job Order Form add-on list omitted it.
- **Root cause:** Hardcoded pairing lists (`Unyellowing`/`White Paint`/… only). Unlisted catalog add-ons always `return false`.
- **Fix:** Shared `isAddonVisibleForBaseServices` in `src/app/lib/serviceCompatibility.ts` used by `JobOrderForm`, `ShoeItem`, `EditOrderModal`. Existing pairings unchanged; unmatched active add-ons show after a base service is selected. Add-on scroller `max-h` 108→160px.
- **Retest:** Select Basic Cleaning → QA add-on visible; check → downpayment **₱212.00**. `2 Colors` still hidden without Color Renewal.

### 3. Concurrent Owner-session deletions of QA data — **NOT a code fix**

- QA user 135, order 828, expense 134, and others were deleted under Owner JWT while Admin QA was running.
- Documented; QA records recreated only when needed and cleaned up.

---

## 24. Remaining limitations / tests not performed

1. Physical PDF file not captured; print/PDF marked honestly.
2. Custom sales date range not applied.
3. OCR Reject / correction / second validation not repeated.
4. ML not retrained; RF not forced.
5. `/job-orders` reachable by URL but not in sidebar — not exercised.
6. Staff session on Vite `:5174` could not `fetch` `:8000` (second-origin limitation).
7. Live uvicorn process may predate `resolve_details` until a manual restart; **frontend search already works**.
8. Shared local SQLite is not isolated; Owner/other processes can mutate data mid-QA.
9. `user_id=67` displayed as `melody` without this pass changing it.
10. Cleaner quantity drifted after the restock test (8800 → later 800 on Staff dashboard).
11. Some historical service labels concatenate in Records (OCR/display), not pending leak.
12. Older audit rows may lack `user_id`.
13. Full button sweep of every icon on every page was not literal; representative modules were.

---

## Persistence after refresh / relogin

| Record | After refresh | After relogin | After restart |
|---|---|---|---|
| QA user create/update | **PASS** | **PASS** (Admin stayed logged in) | N/A (user later deleted as designed) |
| QA user delete | Still absent | Still absent | N/A |
| QA service create | **PASS** | N/A | Deleted as designed |
| QA service delete | Still absent | — | — |
| Validated historical OCR (prior) | **PASS** | **PASS** | Not reprocessed |
| QA job order 828 | Removed by concurrent Owner DELETE | — | — |

---

## Cleanup

- Temporary QA user `qae2estaff01` deleted (confirmed DB count 0).
- Temporary QA service `QA E2E Addon Clean` deleted (API/DB empty).
- Temporary `backend/qa_e2e_*.py` helper scripts removed.
- No genuine historical/OCR validated evidence record was deleted.
- No commit, push, or deploy was performed.

---

## Acceptance criteria (honest)

| Criterion | Status |
|---|---|
| Visible buttons have real actions or legitimate disabled state (on exercised pages) | **PASS** |
| Search/filter change the dataset | **PASS** / Activity search **FIXED** |
| CRUD persists and UI matches DB | **PASS** for Users + Services; JO proven then externally deleted |
| Refresh does not revert successful changes | **PASS** |
| Delete removes the correct row; Cancel does not | **PASS** |
| Details/Inspect human-readable | **PASS** |
| Audit records real JWT actor | **PASS** (concurrent Owner deletes are real Owner JWTs) |
| Role UI + URL + API aligned | **PASS** |
| Responsive layouts remain functional | **PASS** |
| OCR validation persists; pending not in ML/analytics | **PASS** |
| ML dates consistent; RF not fabricated | **PASS** |
| Export verified honestly | CSV **PASS**; PDF file **NOT TESTED** |
| TypeScript + production build | **PASS** |
| Relevant ML tests (no retrain) | **PASS** |
| No unresolved critical local functional/data-integrity defect after fixes | **PASS** |

# Final System Evaluation Readiness Report — Shoelotskey

**Date:** 2026-09-09  
**Branch:** `capstone-fixes` @ `6dda508` + **dirty working tree**  
**Reference:** `origin/main` `95b3a45`  
**Production URL:** https://www.shoelotskey-villamor-pasay.app/  
**Restrictions honored:** no commit · no push · no deploy · frozen ISO/TAM wording unchanged · no mass OCR validate · RF not removed · BR not replaced by ML  

---

## A. Executive Summary

**FINAL DECISION: NO-GO**

Local remediation on `capstone-fixes` (dirty tree) implements the intended security/ML/OCR architecture and passes build + a 44-test backend subset. **Production does not currently run that secured revision.**

### Blocking findings (production live)

| Probe | Result | Severity |
|-------|--------|----------|
| `GET /api/services` (no auth) | **200** — full service catalog JSON returned | **CRITICAL** |
| `POST /api/predict` (no auth) | **200** — prediction returned (legacy single-date shape) | **CRITICAL** |
| `GET /docs` | **200** — Swagger UI HTML | **CRITICAL** |
| `GET /openapi.json` | **200** — full OpenAPI schema (~46KB) | **CRITICAL** |
| `GET /api/activities` (no auth) | **401** | OK |
| `GET /api/historical/orders` (no auth) | **401** | OK |
| HTTPS homepage | **200** over TLS (~1.4s) | OK transport |

### Blocking findings (release process)

| Issue | Severity |
|-------|----------|
| Working tree not a clean deployable revision (~104 dirty paths) | CRITICAL |
| Tracked `backend/db/shoelotskey.db-wal` / `.db-shm` still in Git index | CRITICAL |
| Local security fixes not on GitHub `main` | CRITICAL |
| Heroku GitHub auto-deploy + config vars | **NOT VERIFIED** (CLI not authenticated) |
| Exact production SHA vs `main` | **NOT VERIFIED** (behavior proves older/unsecured API surface) |

### What this means for ISO / TAM

- **ISO/IEC 25010:** This report completes a **statement-level implementation readiness matrix (45/45)**. It is **not** an IT Expert/IT Practitioner questionnaire score.
- **TAM:** This report completes a **system readiness matrix (20/20)**. It is **not** Owner/Staff acceptance. BI/ASU perceptual items cannot be “passed” by code inspection.

**Do not begin formal ISO/TAM respondent scoring on production until the secured revision is deployed and production smoke passes.**

---

## B. Current Git / Release State

| Item | Value |
|------|--------|
| Active branch | `capstone-fixes` (no upstream tracking) |
| HEAD commit | `6dda508` — “Backup current Antigravity working state - 2026-09-07” |
| `origin/main` | `95b3a45` |
| Ahead of `main` | 1 commit (`6dda508`) **plus large uncommitted delta** |
| Remotes | `origin` (GitHub), `heroku` |
| Dirty paths | ~104 (`git status --porcelain`) |
| GitHub branches (user-confirmed) | `main`, `backup/aug-1-baseline`, `capstone-baseline`, `current-antigravity-backup` — **no `capstone-fixes` on GitHub** |
| `gh` / `heroku` CLI | Installed but **not authenticated** this session |

### Required deployment sequence (unchanged)

```
CURATE TREE → EXCLUDE secrets/DB/WAL/SHM → COMMIT capstone-fixes → PUSH
→ REVIEW/MERGE TO main → VERIFY Heroku GitHub auto-deploy + config
→ AUTO DEPLOY → VERIFY deployed SHA → PRODUCTION SMOKE
→ OWNER+ADMIN VALIDATION → ISO evaluation → TAM evaluation
→ continue OCR validation → future ML retrain
```

**Do not push `capstone-fixes` directly to Heroku if GitHub `main` is the auto-deploy source.**

---

## C. Files Included (intended production commit set)

Stage **only** after curation (no `git add .`):

### Backend / ML / OCR
- `backend/main.py`, `backend/auth_utils.py`, `backend/models.py`, `backend/schemas.py`
- `backend/db/database.py`, `backend/db/sync_to_local.py`, `backend/safe_migrate.py`
- `backend/ml/` (`ml_engine.py`, `historical_ml_engine.py`, `business_rules.py`)
- `backend/historical/` (OCR engine/parser/status)
- `backend/api/historical_processing.py`, `backend/order_numbering.py`
- `backend/historical_ocr_import.py` (if part of supported Admin path)
- Model artifacts: `completion_model.pkl`, `completion_model.meta.json`, `historical_rf_model.pkl`, `historical_rf_model.meta.json`
- Tests: `backend/tests/test_business_rule_release.py`, `test_ml_pipeline.py`, `test_historical_ocr_review.py`, `test_reset_link_origin.py`, related auth tests
- `requirements.txt` / root dependency pins as needed

### Frontend
- `src/app/**` release changes (Job Order, Calendar, Inventory, Sales, Users, Activity History, Historical/OCR, contexts, `apiBase.ts`, `businessRules.ts`, etc.)
- `public/avatar.png` if intentionally branded
- `package.json`, `tsconfig.json`, styles as needed

### Documentation (optional for repo history)
- Selected `docs/*` readiness / methodology reports (including this file)

---

## D. Files Excluded (must never enter the production commit)

| Path / pattern | Reason |
|----------------|--------|
| `backend/.env`, `.env.*` | Secrets (`JWT_SECRET`, `MAILGUN_API_KEY`, `GEMINI_API_KEY`, …) |
| `*.db`, `qa_sandbox.db`, DB backups | Local data |
| `backend/db/shoelotskey.db-wal`, `.db-shm` | **Currently tracked — must `git rm --cached`** |
| `__pycache__/`, `.pytest_cache/`, `dist/` | Build/cache |
| `backend/_tmp_*.py`, temp debug scripts | Non-production |
| Mass OCR dumps / `historical_data/output/*` unless explicitly approved | Size + sensitivity |
| Private keys / `.pem` | Secrets |

**Verify before commit:**

```text
git ls-files | findstr /I ".env"
git ls-files | findstr /I ".db"
git ls-files | findstr /I "wal"
git ls-files | findstr /I "shm"
```

Current index still contains `backend/db/shoelotskey.db-wal` and `.db-shm` → **FAIL hygiene**.

---

## E. Deployment Architecture

| Layer | Design |
|-------|--------|
| Source of truth | GitHub `main` |
| Deploy target | Heroku app `shoelotskey-villamor-pasay` |
| Process | `Procfile`: `gunicorn` + `uvicorn.workers.UvicornWorker` (`chdir backend`) |
| Frontend | Vite production build served with FastAPI; `apiBase.ts` → same-origin `/api` in prod |
| Database | Production PostgreSQL via `DATABASE_URL`; local SQLite allowed only outside Production |
| Fail-closed | Code refuses SQLite fallback when `PORT`/`ENV=production` (`DB_UNAVAILABLE` → 503) |

---

## F. Heroku Configuration Verification

| Item | Status |
|------|--------|
| App exists (`shoelotskey-villamor-pasay`) | Assumed from domain + remote; **CLI login failed → NOT VERIFIED** |
| GitHub repo connected | **NOT VERIFIED** |
| Auto-deploy from `main` | **NOT VERIFIED** |
| `JWT_SECRET` | Code requires it; **Heroku value NOT VERIFIED** |
| `DATABASE_URL` PostgreSQL | **NOT VERIFIED** live |
| `FRONTEND_URL` | **NOT VERIFIED** live |
| Mail config | **NOT VERIFIED** live |
| `EXPOSE_HISTORICAL_STATIC` unset | **NOT VERIFIED** live (must remain unset) |
| OpenAPI disabled in prod | **FAIL on live site** (`/docs` + `/openapi.json` = 200) |

---

## G. PostgreSQL Verification

| Check | Local code | Production live |
|-------|------------|-----------------|
| Production refuses SQLite fallback | **PASS** (`database.py` P0-5) | **NOT VERIFIED** (needs Heroku `DATABASE_URL`) |
| Localhost uses isolated SQLite when remote URL blocked | **PASS** (observed `is_sqlite True`) | N/A |
| Migrations / additive schema | Present (`safe_migrate` / startup) | **NOT VERIFIED** on prod |

---

## H. Security Assessment (summary)

| Area | Local (dirty tree + localhost:8000) | Production |
|------|-------------------------------------|------------|
| Sensitive API auth | **PASS** (401 on predict/services/activities/historical/bulk-import/trigger) | **FAIL** (services + predict open) |
| OpenAPI surface | Expected open on localhost | **FAIL** (open on prod) |
| JWT_SECRET required | **PASS** (runtime raise if missing) | **NOT VERIFIED** |
| bcrypt / no pass-the-hash migrate | **PASS** | Assumed older binary |
| 3-fail / 15-min lockout | **PASS** (code) | **NOT VERIFIED** live |
| 30-min inactivity timeout | **PASS** (frontend `App.tsx` + backend SESSION_TIMEOUT path) | **NOT VERIFIED** live |
| Owner↛Admin | **PASS** (`assert_assignable_role`) | **NOT VERIFIED** |
| Historical Admin-only | **PASS** (code + localhost 401) | Partial (orders 401; other surfaces unknown) |

---

## I. Browser Inspection / Page Source Security

| Check | Result |
|-------|--------|
| Frontend must remain inspectable (expected) | Acknowledged — not treated as vulnerability by itself |
| Secrets in `src/` (`JWT_SECRET`, DB URL, Mailgun, Gemini) | **PASS** — none found |
| `vite.config.ts` `sourcemap: false` | **PASS** |
| `dangerouslySetInnerHTML` | Only chart theme helper (`chart.tsx`) — review OK / low risk |
| Frontend-only RBAC | **PARTIAL** — UI hides routes; **backend must enforce** (local yes; prod predict/services fail) |
| Privileges via Network tab alone | **FAIL on production** — unauthenticated `/api/services` and `/api/predict` succeed |

**Principle:** Frontend hiding is not security. Production currently violates the principle for public API surfaces that local code already fixed.

---

## J. Input Validation Assessment

| Input class | Server-side validation | Notes |
|-------------|------------------------|-------|
| Login username/password | Present + lockout | Local code PASS; live lockout NOT VERIFIED |
| Job order payload | Schema + business rules + service compatibility | Present |
| Payments / balances | Computed/validated in order flows | Present; full edge-case sweep PARTIAL |
| Inventory qty/price/retail | Schemas + retail rules | Present |
| Expenses | Owner-gated endpoints | Present |
| Roles | `assert_assignable_role` | Present |
| Historical/OCR corrections | Admin + review actions | Present |
| Image filenames | `basename` sanitization on historical image route | Present |
| ML predict body | Auth + estimate engine | Local PASS; **prod unauthenticated FAIL** |

Frontend validation alone is **not** counted as PASS for security-sensitive paths.

---

## K. Output Security Assessment

| Check | Local code | Production |
|-------|------------|------------|
| Global 500 strips debug in Production | **PASS** (`debug_info` only if not prod) | **NOT VERIFIED** (need intentional prod 500) |
| Secrets not returned in API JSON | Expected | OpenAPI exposure leaks endpoint surface |
| `/api/predict` response | Dual BR+ML fields when auth’d | Legacy unauth prediction (no dual BR fields) |

---

## L. Authentication Assessment

| Control | Evidence | Result |
|---------|----------|--------|
| JWT | `auth_utils.create_access_token` / Bearer | **PASS** (code) |
| bcrypt | login verify path; no plaintext migrate | **PASS** (code) |
| 3 attempts / 15-min lock | `failed_login_attempts >= 3` → `locked_until` | **PASS** (code) / live **NOT VERIFIED** |
| 30-min idle | `TIMEOUT_MS = 30 * 60 * 1000` + audit SESSION_TIMEOUT | **PASS** (code) |
| Hardcoded JWT fallback | Removed — env required | **PASS** |
| JWT in frontend | Not present | **PASS** |

---

## M. RBAC Assessment

| Actor | Expected | Local evidence | Prod |
|-------|----------|----------------|------|
| Unauthenticated | 401/403 on protected APIs | **PASS** | **FAIL** predict/services |
| Staff | Ops only; no Admin historical; no Owner-only expense/users | Code + UI menus | **NOT VERIFIED** live roles |
| Owner | Ops + users + sales/expenses + ML predict; not Admin historical | Code | **NOT VERIFIED** |
| Admin | Historical/OCR/analytics/train | `require_role("admin")` | Partial (orders 401) |
| Owner create Admin | Blocked | `assert_assignable_role` + UserModal staff/owner only | **NOT VERIFIED** |

Authenticated Owner/Admin/Staff smoke on localhost **not completed** this run (seed passwords rejected on local DB).

---

## N. OWASP Assessment

| Control | Status | Evidence |
|---------|--------|----------|
| A01 Broken Access Control | **FAIL** (prod) / **PASS** (local code) | Prod unauth services+predict |
| A02 Cryptographic Failures | **PARTIAL** | HTTPS prod OK; JWT/bcrypt code OK; Heroku secrets NOT VERIFIED |
| A03 Injection | **PASS** (code) | ORM primary; reviewed raw SQL mostly migrations/admin; test injection neutralized |
| A04 Insecure Design | **PARTIAL** | Soft customer unique deferred; dual DB sync complexity |
| A05 Security Misconfiguration | **FAIL** (prod) | OpenAPI/docs live; EXPOSE_HISTORICAL_STATIC Heroku NOT VERIFIED |
| A06 Vulnerable Components | **NOT VERIFIED** | No CVE scan this pass |
| A07 Identification/Auth Failures | **PARTIAL** | Lockout/JWT code PASS; prod open predict undermines auth boundary |
| A08 Software/Data Integrity | **FAIL** | Dirty tree; tracked WAL/SHM; prod ≠ secured revision |
| A09 Logging/Monitoring | **PASS** (local code) | Audit trail + Activity History refresh/readable inspect |
| A10 SSRF | **PASS** / residual **PARTIAL** | No new SSRF finding; file routes basename-gated |

---

## O. Random Forest ML Assessment

| Requirement | Result |
|-------------|--------|
| RF exists (`RandomForestRegressor`) | **PASS** |
| Model artifact loads (`completion_model.pkl`) | **PASS** (local) |
| Feature vector (18 features as listed) | **PASS** (matches meta + engine) |
| Material / workload **not** claimed as RF features | **PASS** (not in FEATURE_COLS) |
| Target = Claimed − Received / completion_days 1–60 | **PASS** (engine); meta label drift **PARTIAL** (“service readiness” string in `.meta.json`) |
| Eligibility VALIDATED/CORRECTED only | **PASS** |
| Advisory only; does not overwrite `expected_at` | **PASS** |
| Dual display BR vs ML | **PASS** (local API/UI) |
| Current metrics | MAE **7.61**, R² **0.1959**, RMSE **8.93**, n=35 (28/7) |
| “85% accuracy” / R²×100 | **Not claimed** — **PASS** honesty |
| Prod `/api/predict` | **FAIL** — unauthenticated + legacy response |

---

## P. Business Rules Assessment

| Requirement | Result |
|-------------|--------|
| BR = official operational date | **PASS** |
| Catalog durations + combo + rush | **PASS** (`ml/business_rules.py` + tests) |
| Form = API BR = `expected_at` = Details = Calendar | **PASS** (architecture + mapping) |
| ML cannot overwrite `expected_at` | **PASS** (`mlAutoPredicted` / estimate persist path) |
| Tests | `test_business_rule_release.py` included in **44 passed** |

---

## Q. OCR Security and Validation Assessment

| Requirement | Result |
|-------------|--------|
| Pipeline Original→OCR→Human Review→VALIDATED/CORRECTED→ML | **PASS** (code) |
| Admin-only queue/validate/reocr | **PASS** (code) |
| Authenticated image route + basename | **PASS** |
| Static historical mount disabled unless env (ignored in prod) | **PASS** (code) |
| No mass validate this pass | Honored |
| Prod OCR smoke | **NOT VERIFIED** (do not run until secured deploy) |

---

## R. ISO/IEC 25010 Detailed Matrix (45 statements)

**Legend:** PASS = implemented and evidenced working for the statement’s technical claim · PARTIAL = present but incomplete/limited evidence · FAIL = broken or contradicted · NOT VERIFIED = not measured this pass  

**Important:** These are **implementation readiness** ratings, **not** evaluator questionnaire scores.

### Functional Suitability

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| FS-1 | The system provides the necessary functions for managing job orders, customer information, inventory, reports, and release schedules. | Routes/modules: Job Orders, Inventory, Sales/Expenses, Release Calendar, Dashboard; APIs `/api/orders`, `/api/inventory`, expenses/sales pages | Code + prior UAT; not full prod smoke | **PARTIAL** | Prod missing secured revision | Deploy secured build; Owner smoke |
| FS-2 | Each system module produces the expected result based on the user's operation. | CRUD paths + tests; balance/stock logic present | Subset tests PASS; not every module live retested | **PARTIAL** | Incomplete live coverage | Owner/Admin smoke after deploy |
| FS-3 | The Machine Learning component uses a Random Forest Regressor to analyze job order data, identify service patterns, and generate a predicted release date for operational decision-making. | RF model, dual BR/ML API, Job Order UI advisory | Local model+tests; prod predict unauthenticated legacy | **PARTIAL** | Prod insecure/legacy predict | Deploy local dual-engine API |
| FS-4 | The system's data analytics functions provide information for monitoring sales, services, and business performance. | Dashboard KPIs; SalesReport periods Daily→Annually | Code inspection + period controls present | **PARTIAL** | Live timing/accuracy not remeasured | Prod smoke reports |
| FS-5 | The system supports the complete job order workflow, including New Order, On-Going, For Release, and Claimed statuses. | Status model + Dashboard/Claim/Calendar filters | Code verified; claim modal present | **PARTIAL** | Full transition live not re-run | Lifecycle smoke |

### Performance Efficiency

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| PE-1 | The system retrieves database records and loads pages within an acceptable response time. | SPA + API | Local health **92ms**; prod home **1428ms** | **PARTIAL** | Module page timings not fully measured | Timed navigation smoke |
| PE-2 | Job order processing and saving transactions are completed without noticeable delays. | Optimistic UI + FastAPI commit | Not timed this pass | **NOT VERIFIED** | — | Time create/update JO |
| PE-3 | Sales and expense reports can be generated for daily, weekly, monthly, quarterly, and annual periods within an acceptable response time. | `SalesReport.tsx` period chips include Daily/Weekly/Monthly/Quarterly/Annually | Control present; timing not measured | **PARTIAL** | Timing unknown | Time Annual report |
| PE-4 | The Machine Learning component generates a predicted release date from valid input data without noticeably delaying the transaction workflow. | `/api/predict` estimate | Local auth required; prod open but insecure | **PARTIAL** | Must not count unauth prod as success | Auth’d timed predict |
| PE-5 | Navigation between system modules occurs without noticeable delay, supporting efficient SPA routing. | React Router lazy routes | Not instrumented this pass | **NOT VERIFIED** | — | Click-through timing |

### Compatibility

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| CP-1 | The system operates properly and maintains its functional layout across commonly used web browsers. | Standard React/Vite stack | Multi-browser matrix not run | **NOT VERIFIED** | — | Chrome/Edge/Firefox check |
| CP-2 | Modifications made to existing records, such as job order status changes, are immediately reflected in all related system modules. | Shared OrderContext + Dashboard/Calendar | Code path present; live sync not retested | **PARTIAL** | — | Cross-module status change test |
| CP-3 | Information entered in one module is correctly synchronized across other system modules. | Contexts + API refresh | Soft-delete sync fixes present | **PARTIAL** | Historical dual-DB edge cases | Sync regression after deploy |
| CP-4 | The Machine Learning output is correctly integrated into the Job Order module to display the predicted release date. | JobOrderForm dual BR/ML; OrderDetailModal | Code PASS locally | **PARTIAL** | Prod API shape outdated | Deploy + form smoke |
| CP-5 | The system's data analytics functions retrieve and consolidate transaction data to display current operational metrics. | Dashboard + SalesReport aggregations | Code present | **PARTIAL** | Live totals not re-audited | Owner sales smoke |

### Interaction Capability

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| IC-1 | The system's menus, icons, and buttons are clearly labeled and easy to recognize. | Layout role menus; Shoelotskey styling | Visual prior; not full UX study | **PARTIAL** | Respondent judgment needed | Evaluator walkthrough |
| IC-2 | The system's job order, inventory, service, and user management features are easy to learn. | Guided forms/modals | Perception item | **PARTIAL** | Needs respondents | TAM/ISO evaluators |
| IC-3 | The system provides validation messages and confirmation prompts to help prevent input errors and unintended actions. | Toasts, required fields, delete confirm copy in Inventory | Code sample verified | **PARTIAL** | Not every control proven | Button audit after deploy |
| IC-4 | The layout and navigation make it easy to move between different modules. | Sidebar Layout | Present | **PARTIAL** | Responsive not fully certified | Responsive pass |
| IC-5 | Frequently used tasks can be completed with minimal steps. | JO form, claim, restock flows | Code present | **PARTIAL** | Task-time not measured | Timed common tasks |

### Reliability

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| RL-1 | The system performs consistently without unexpected interruptions during operation. | Local uvicorn stable | Prod OpenAPI/unauth APIs indicate insecure older build | **PARTIAL** | Prod not on secured revision | Deploy + soak |
| RL-2 | The system handles invalid or incomplete input without unexpected failure. | Validators + sanitized 500 | Local subset; prod error body not intentionally probed | **PARTIAL** | — | Invalid payload probes |
| RL-3 | Transactions are processed without data loss or unintended changes to existing records. | Soft-delete inventory; audit; ORM transactions | Sync revive fix present | **PARTIAL** | Customer soft-dup remains | Monitor after deploy |
| RL-4 | The system supports manual PostgreSQL database backups through the Heroku platform to facilitate data recovery. | Heroku PG capability (platform) | **NOT VERIFIED** (no Heroku access) | **NOT VERIFIED** | — | Confirm Heroku PG backups enabled |
| RL-5 | The Machine Learning component consistently generates a predicted release date when provided with a complete and valid job order input. | RF path + fallback messaging | Local tests; prod unauth legacy | **PARTIAL** | Auth’d consistency not timed | Auth’d repeated predict |

### Security

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| SEC-1 | The system uses JWT authentication with bcrypt password hashing, enforces a three-attempt login limit with a 15-minute lockout, and automatically terminates inactive sessions after 30 minutes, addressing OWASP A07. | Code paths present | Code review; live lockout NOT VERIFIED | **PARTIAL** | Prod auth boundary broken for predict/services | Deploy + lockout live test |
| SEC-2 | The system enforces RBAC for Staff and Owner roles and prevents direct access to unauthorized modules through URL requests, addressing OWASP A01. | `require_role` / ProtectedRoute | Local unauth PASS; prod services/predict FAIL | **FAIL** (prod) | Public catalog + predict | Deploy secured APIs |
| SEC-3 | The system uses parameterized queries and input validation to prevent SQL injection and invalid data submission, addressing OWASP A03. | SQLAlchemy ORM dominant | Code review + prior injection test pattern | **PASS** (local architecture) | Continual review of raw SQL | Keep ORM discipline |
| SEC-4 | The system records critical user activities and system events in audit logs… addressing OWASP A09. | `log_audit` + Activity History | Code + prior CRUD logging fixes | **PARTIAL** | Prod audit UI not smoked | Owner Activity History smoke |
| SEC-5 | The system uses HTTPS with SSL/TLS encryption… addressing OWASP A02. | Prod URL `https://` 200 | Live TLS probe | **PASS** | — | Maintain certs |

### Maintainability

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| MN-1 | The system provides clear error messages identifying the specific field and cause of invalid input to assist troubleshooting. | Field toasts/validation messages | Sampled | **PARTIAL** | Not all forms proven | Form invalid-input sweep |
| MN-2 | The system allows incorrect data entries to be corrected without affecting completed transaction records. | Edit order / soft-delete / historical soft rules | Code | **PARTIAL** | — | Edit-after-claim rules smoke |
| MN-3 | The system remains functional when existing records, services, or configurations are modified. | Soft-delete services when linked | Code | **PARTIAL** | — | Service edit smoke |
| MN-4 | The system logs administrative actions and critical errors to facilitate system monitoring and maintenance. | Audit + SERVER_ERROR logging | Code | **PASS** (local) | — | Confirm prod logs after deploy |
| MN-5 | The system's modules can be updated or modified without disrupting the job order workflow. | Modular React/FastAPI | Build PASS | **PARTIAL** | Dirty release process risk | Clean release discipline |

### Flexibility

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| FL-1 | The system supports different user roles, such as Staff and Owner, with appropriate access permissions and functions. | owner/staff/admin roles | Code | **PARTIAL** | Admin is Developer path; live role smoke missing | Role matrix smoke |
| FL-2 | The system supports different types of shoe services within the same workflow. | Service catalog + JO multi-service | Code + BR tests | **PASS** (local) | — | Keep catalog integrity |
| FL-3 | The system handles different customer transactions, such as single-service and multi-service orders within the same workflow. | Multi-item JO | Code | **PASS** (local architecture) | Live create not re-run | JO create smoke |
| FL-4 | The system accommodates different payment methods and payment statuses within the same transaction workflow. | Payment fields/status | Code | **PARTIAL** | Exhaustive method matrix not run | Payment edge cases |
| FL-5 | The system allows new services to be added without affecting existing transactions. | Soft-delete / historical price mapping patterns | Code | **PASS** (design) | — | Add-service smoke |

### Safety

| ID | Statement | Implementation Evidence | Test Performed | Result | Issue | Required Action |
|----|-----------|-------------------------|----------------|--------|-------|-----------------|
| SF-1 | The system helps prevent accidental loss or deletion of important records. | Soft-delete inventory/users/services when linked | Code | **PASS** (local design) | — | Confirm prod soft-delete |
| SF-2 | The system requires explicit user confirmation before executing critical data deletions or modifications. | Inventory delete confirmation UI present | Code sample | **PARTIAL** | Not every critical action audited | Confirm dialog audit |
| SF-3 | The system enforces mandatory field requirements before allowing a transaction to proceed. | Form required fields + server checks | Code | **PARTIAL** | — | Submit-empty tests |
| SF-4 | The system aborts transactions that violate defined business logic or validation rules. | HTTPException paths; BR conflicts | Tests subset | **PARTIAL** | — | Negative-path suite |
| SF-5 | The system prevents duplicate submissions during transaction processing. | Some optimistic/queue patterns | Not fully proven | **PARTIAL** | Double-submit not systematically tested | Idempotency/disable-button audit |

### ISO matrix counts (implementation readiness only)

| Result | Count |
|--------|-------|
| PASS | 7 |
| PARTIAL | 33 |
| FAIL | 1 (`SEC-2` against production) |
| NOT VERIFIED | 4 |
| **Total** | **45** |

**ISO questionnaire scoring:** NOT STARTED — requires IT Expert/IT Practitioner respondents after production readiness.

---

## S. TAM Detailed Matrix (20 statements)

**Legend:** READY = workflows exist to evaluate the statement · PARTIAL = workflow incomplete/limited · NOT VERIFIED = insufficient evidence  

**Separate:** System readiness ≠ respondent acceptance.

### Perceived Usefulness (PU)

| ID | Statement | Supported Workflow | Implementation Evidence | Readiness | Notes |
|----|-----------|--------------------|-------------------------|-----------|-------|
| PU-1 | The system helps complete work more quickly. | JO create, dashboard, calendar | Core ops modules | **READY** | Acceptance = respondents |
| PU-2 | The system makes it easier to manage customer records and job orders. | JO + customer capture | Order/customer models | **READY** | Soft-dup debt remains |
| PU-3 | The system helps track services and inventory more quickly. | Services + Inventory | Modules present | **READY** | — |
| PU-4 | The system provides useful information for monitoring sales and shop performance. | Dashboard + SalesReport | Analytics present | **READY** | — |
| PU-5 | The system reduces the need for paperwork and manual record-keeping. | Digital JO/claim/sales | Digitized workflows | **READY** | OCR still human-validated |

### Perceived Ease of Use (PEOU)

| ID | Statement | Supported Workflow | Implementation Evidence | Readiness | Notes |
|----|-----------|--------------------|-------------------------|-----------|-------|
| PEOU-1 | The menus, buttons, and labels are easy to understand. | Layout/nav | Labeled menus | **PARTIAL** | Needs UX respondent view + responsive |
| PEOU-2 | The system is easy to learn. | Role menus | Training still needed | **PARTIAL** | Perception |
| PEOU-3 | Adding and updating records in the system is easy. | CRUD forms/modals | Present | **READY** | — |
| PEOU-4 | Information in the system is easy to find. | Search/filters | Present across modules | **PARTIAL** | Full control audit incomplete |
| PEOU-5 | The system is easy to use. | End-to-end ops | Present | **PARTIAL** | Perception + responsive |

### Behavioral Intention (BI)

| ID | Statement | Supported Workflow | Implementation Evidence | Readiness | Notes |
|----|-----------|--------------------|-------------------------|-----------|-------|
| BI-1 | The system is worth using for daily work. | Daily ops path | Exists | **READY** (workflow) | **Not an acceptance PASS** |
| BI-2 | The system should be used as the main system in the shop. | Full ops coverage | Exists | **READY** (workflow) | Respondent only |
| BI-3 | The system is worth recommending to other staff. | Staff workflows | Exists | **READY** (workflow) | Respondent only |
| BI-4 | The system is better than the previous way of managing shop work. | Compare to paper | Digitized vs paper | **READY** (workflow) | Respondent only |
| BI-5 | The system should continue to be used at Shoelotskey. | Continuity | Exists | **READY** (workflow) | Respondent only |

### Actual System Use (ASU)

| ID | Statement | Supported Workflow | Implementation Evidence | Readiness | Notes |
|----|-----------|--------------------|-------------------------|-----------|-------|
| ASU-1 | The system is used during work tasks. | Ops modules | Capable | **PARTIAL** | Frequency not measured |
| ASU-2 | The system is used to record and manage customer job orders. | JO module | Capable | **READY** | Usage frequency = respondents/ops |
| ASU-3 | The system is used to check inventory, service status, and reports. | Inv/Dashboard/Sales | Capable | **READY** | — |
| ASU-4 | Work is completed using the system instead of paper records. | Digital JO/claim | Capable; OCR bridges paper | **PARTIAL** | Paper still source for historical |
| ASU-5 | The system is used regularly in shop operations. | Production app live | Homepage 200 | **PARTIAL** | Regularity NOT VERIFIED |

### TAM role mapping (policy)

| Role | Scope |
|------|-------|
| Owner | Operational system + Job Order + ML prediction (advisory) |
| Admin | Historical / OCR / analytics / ML training |
| Staff | Permitted operational workflows only |

### TAM counts (readiness only)

| Result | Count |
|--------|-------|
| READY | 13 |
| PARTIAL | 7 |
| NOT VERIFIED | 0 |
| **Total** | **20** |

**TAM acceptance scoring:** NOT STARTED — Owner/Staff respondents required. No Attitude Toward Using invented.

---

## T. Responsive Assessment

| Viewport | Result |
|----------|--------|
| 1280×800 | **NOT VERIFIED** this pass |
| 768×1024 | **NOT VERIFIED** this pass |
| 390×844 | **NOT VERIFIED** this pass |

Prior audits noted layout work exists; **no full responsive certification claimed**.

---

## U. Functional Button / Search / Filter Assessment

| Scope | Result |
|-------|--------|
| Exhaustive every-control audit | **NOT VERIFIED** (too large for this gate without dedicated UI pass) |
| Known working patterns | Search/filters exist on Activity History, Inventory, Sales periods, Dashboard status cards |
| Fake controls policy | No new decorative controls introduced this gate |

**Required before GO:** curated Owner/Admin UI smoke covering buttons/search/filters on listed modules.

---

## V. Testing Results

| Suite | Result |
|-------|--------|
| `npm run build` | **PASS** (prior same-day run; Vite production build) |
| `npx tsc --noEmit` | **PASS** (prior same-day run) |
| Backend subset (`test_business_rule_release`, `test_ml_pipeline`, `test_historical_ocr_review`, `test_reset_link_origin`, `test_auth`) | **44 passed** |
| Full backend suite | **NOT RUN** |
| Authenticated role smoke (local) | **NOT VERIFIED** (credentials ≠ seeds) |
| Production security probes | **Executed** — critical failures documented |

**Do not claim “all tests passed.”**

---

## W. Remaining Technical Debt

1. Production still serving unauthenticated `/api/services` + `/api/predict` and OpenAPI.
2. Dirty `capstone-fixes` tree; not on GitHub.
3. Tracked WAL/SHM must leave the index.
4. Soft customer uniqueness (local duplicate group remains).
5. `completion_model.meta.json` target label drift vs order-to-claim wording.
6. Dependency CVE scan not run.
7. Full responsive + exhaustive control audit not completed.
8. Heroku config / auto-deploy / exact SHA not CLI-verified.

---

## X. Manual Production Smoke Test

**Status: BLOCKED — do not run Owner/Admin evaluation smoke as “pass” while public APIs remain open.**

After secured deploy, required smoke:

### Owner
Login/Logout · timeout · Dashboard · Create JO · BR official date · ML secondary · Details · Calendar · Inventory · Sales · Expenses · Users · Activity History  

### Admin
Historical · Analytics · ML train/predict · OCR queue · source image/PDF · Edit/Validate/Reject/Re-OCR · audit  

### Negative
Staff↛Admin · Owner↛Historical Admin · unauth↛protected APIs (must be 401)

---

## Y. Final Deployment Decision

# NO-GO

### Why not CONDITIONAL GO
Production currently exposes **critical authentication and API documentation failures**. Release tree is **not clean**. Heroku configuration and deployed SHA are **not verified**. These are evaluation-critical blockers, not cosmetic debt.

### Minimum path to re-evaluate toward CONDITIONAL GO / GO
1. `git rm --cached` WAL/SHM; ensure `.gitignore` covers `*.db-wal` `*.db-shm`.
2. Curate commit on `capstone-fixes` (no secrets).
3. Push branch → PR → merge `main` (no force-push).
4. Verify Heroku GitHub auto-deploy ON for `main`.
5. Verify Heroku config keys present (no secret printing).
6. Confirm deployed SHA == `main`.
7. Re-probe: unauth `/api/services`, `/api/predict`, `/docs`, `/openapi.json` must **not** be 200.
8. Owner + Admin production smoke.
9. Then: ISO respondent evaluation · TAM respondent evaluation · continued OCR validation · future ML retrain.

---

## Final Report Summary (Section 65)

1. **Git status:** dirty `capstone-fixes` @ `6dda508` (~104 paths)  
2. **Commit status:** **not committed** (blocked)  
3. **GitHub main:** `95b3a45` (does not include local secured dirty tree)  
4. **Heroku auto-deploy:** **NOT VERIFIED**  
5. **Heroku configuration:** **NOT VERIFIED**  
6. **Exact deployed SHA:** **NOT VERIFIED** (behavior ≠ local secured API)  
7. **Security status:** local code hardened; **production FAIL**  
8. **Input security:** local architecture PASS/PARTIAL; prod predict/services open = FAIL  
9. **Output security:** OpenAPI exposed on prod = FAIL  
10. **Browser/source inspection:** no frontend secrets found; prod Network abuse possible = FAIL  
11. **OWASP:** A01/A05/A08 FAIL or PARTIAL due to prod + release hygiene  
12. **ML:** local RF advisory OK; metrics honest; prod predict insecure/legacy  
13. **Business Rules:** local authoritative architecture PASS  
14. **OCR:** Admin pipeline PASS (code); prod smoke blocked  
15. **ISO 45/45:** matrix complete — **7 PASS / 33 PARTIAL / 1 FAIL / 4 NOT VERIFIED** (implementation readiness only)  
16. **TAM 20/20:** readiness matrix complete — **13 READY / 7 PARTIAL** (no acceptance scores)  
17. **Build/test:** build/tsc prior PASS; backend subset **44 passed**  
18. **Remaining blockers:** prod open APIs/docs; dirty tree; tracked WAL/SHM; Heroku unverified  
19. **Required manual steps:** curate → commit → push → merge main → verify Heroku → redeploy → smoke → then ISO/TAM respondents  
20. **Final decision:** **NO-GO**

---

*End of report. No commit, push, or deploy performed.*

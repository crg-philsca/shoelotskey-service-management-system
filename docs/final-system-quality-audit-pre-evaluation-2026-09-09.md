# Final Pre-Evaluation + Pre-Deployment System Quality Audit

**Date:** 2026-09-09  
**System:** Shoelotskey Villamor-Pasay Service Management System  
**Branch:** `capstone-fixes` @ `6dda508` (+ dirty working tree)  
**origin/main:** `95b3a45`  
**Production:** https://www.shoelotskey-villamor-pasay.app/  
**Frozen instruments:** `docs/CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md` (statements not modified)

**Constraints honored:** no commit · no push · no deploy · no mass OCR · no questionnaire edits · no broad refactor  

**Automatic fix applied this pass:**  
- `.gitignore` now excludes `*.db-wal` / `*.db-shm`  
- Tracked WAL/SHM removed from git **index** (`git rm --cached`) — still must be included in a future curated commit  

---

## A. Executive Summary

| Gate | Result |
|------|--------|
| Critical open-API / JWT / SQLite-failover / pass-the-hash class | **PASS** (re-verified) |
| Production-oriented security hygiene | **PASS / PARTIAL** |
| Build (`tsc --noEmit`, `npm run build`) | **PASS** |
| Backend key tests | **44 passed** |
| Release hygiene (clean deployable revision) | **FAIL until curated commit** |
| Heroku live config | **NOT VERIFIED** |
| Formal ISO scores | **Technical readiness only — not evaluator scores** |
| Formal TAM acceptance | **NOT VERIFIED** (requires Owner + 2 Staff) |

### Final decision

# **CONDITIONAL GO**

**Meaning:** Technically close to evaluation readiness for IT Experts and Owner/Staff **after** clean commit → push → Heroku verify → deploy → production smoke.  

**Not** `GO FOR EVALUATION` or `GO FOR DEPLOYMENT` yet — procedural release blockers remain.

Do **not** claim: 100% secure, bug-free, enterprise-grade, fully WCAG-certified, 85% ML accuracy, or TAM acceptance.

---

## B. Architecture Assessment — **PARTIAL**

```
Browser (React/TS/Vite SPA)
   │  Bearer JWT
   ▼
FastAPI (backend/main.py + helpers)
   │
   ├─ auth_utils / RBAC
   ├─ models + SQLAlchemy
   ├─ ml/ (business_rules + RF engines)
   ├─ historical/ (OCR + review)
   └─ PostgreSQL (prod) | SQLite (local only)
```

**Strengths:** Clear presentation / API / persistence layers; ML separated from BR; Historical Admin-gated; central `apiBase`.  

**Weaknesses:** God-file `main.py` (~5k lines); large `JobOrderForm.tsx` (~2.2k lines); some duplicated pricing/BR awareness FE+BE; ad-hoc startup ALTER migrations.  

**Capstone-appropriate:** Yes. **Enterprise-pure:** No. **Release blocker:** No (debt).

---

## C. Code Quality / OOP / SOLID — **PARTIAL**

| Principle | Assessment |
|-----------|------------|
| SRP | Mixed in `main.py` / JobOrderForm — **PARTIAL** |
| OCP | Service catalog / RBAC deps allow extension — **PARTIAL** |
| LSP / ISP | Limited classical OOP surface — **N/A / PARTIAL** |
| DIP | FastAPI Depends helps — **PARTIAL** |
| DRY / KISS | Mostly OK; residual inventory JSON duplication — **PARTIAL** |
| Type safety | TS build PASS; Python typing uneven — **PARTIAL** |

**Large files:** `main.py` ~264KB / ~5068 lines; `JobOrderForm.tsx` ~144KB / ~2213 lines → **Technical debt, not release blocker**. Do not major-refactor pre-eval.

---

## D–I. Security Cluster

### Dashboard

| Area | Gate |
|------|------|
| Security (overall) | **PARTIAL → strong for release blockers** |
| Input Security | **PARTIAL** |
| Output Security | **PASS** (prod strips debug_info) |
| DevTools / Source | **PASS** (no secrets in FE scan) |
| Authentication | **PASS** |
| RBAC | **PASS** (Admin historical policy intentional) |

### Authentication evidence
- bcrypt verify only; no pass-the-hash (`main.py` login)  
- `JWT_SECRET` required (`auth_utils.py`)  
- Lockout after 3 fails / 15 minutes  
- JWT exp + client 30-minute inactivity logout (`App.tsx`)  
- JWT access token default 480 minutes server-side — inactivity is client-enforced  

### RBAC evidence
- `require_role` / `get_current_user` on sensitive routes  
- Owner cannot assign Admin (`assert_assignable_role`)  
- Historical/OCR/train Admin-only FE+BE aligned  
- Live unauth probes: predict/services/historical → **401**  

### DevTools / XSS
- No JWT_SECRET / DATABASE_URL / mail keys in `src/` scan  
- `dangerouslySetInnerHTML` only theme CSS in `chart.tsx` (not user HTML) — **acceptable**  
- Security remains server-side; minification is not a control  

### Files / OpenAPI
- Historical static not mounted in Production by default  
- `/historical_data/...` returns SPA HTML locally, not raw CSV binary dump  
- `/api/historical/image/...` → **401** unauth  
- OpenAPI disabled when `_IS_PRODUCTION`  
- `/api/temp/debug_image` Production-blocked + admin auth  

### OWASP Top 10 (practical)

| ID | Result |
|----|--------|
| A01 | **PASS** |
| A02 | **PASS** |
| A03 | **PARTIAL** (ORM dominant; residual raw SQL migrations) |
| A04 | **PARTIAL** |
| A05 | **PASS** |
| A06 | **PARTIAL** — `npm audit`: 2 moderate (dompurify, fflate); pip-audit **unavailable** this environment |
| A07 | **PASS** |
| A08 | **PARTIAL** |
| A09 | **PARTIAL** |
| A10 | **PASS** |

ASVS 5.0.0: used as verification *basis*, not full certification claim.

---

## J–K. Database / Integrity / Concurrency — **PARTIAL**

| Topic | Result |
|-------|--------|
| Prod PostgreSQL fail-closed | **PASS** |
| Inventory row locks | **PASS** (create/update/adjust/auto/PUT/expense restock) |
| Order delete cascades | **PASS** |
| Customer unique DB constraint | **DEFERRED** (1 local duplicate group); soft lookup improved |
| Split inventory JSON SoT | **P2 debt** |
| Payment math BR/OCR | **PARTIAL** (OCR DP/Bal discount bug fixed; dual totals still human-reviewed) |

---

## L–N. ML / Business Rules / OCR

### Business Rules — **PASS**
Authoritative `expected_at` / `business_rule_date`; ML does not overwrite.

### ML — **PASS (honest)**
| Item | Evidence |
|------|----------|
| Algorithm | RandomForestRegressor |
| n / split | 35 / 28 train / 7 test |
| Metrics | MAE 7.61 · R² 0.1959 · RMSE 8.93 |
| Target | Claimed − Received (disclosed) |
| Leakage | No claimed_date as feature |
| Auth | `/api/predict` authenticated |
| UI | BR vs ML separated; R² not sold as accuracy % |
| 85% claim | **FORBIDDEN / not supported** |

### OCR — **PARTIAL / READY for Admin workflow**
Admin queue → edit → validate/reject; no mass-validate; continue on **production PostgreSQL** after deploy.

---

## O–R. Frontend / Performance / A11y / Responsive

| Area | Gate |
|------|------|
| Frontend | **PARTIAL** (works; large forms; sonner dual import warning) |
| Performance | **PARTIAL / NOT VERIFIED** exact ms thresholds |
| Accessibility (WCAG 2.2 sanity) | **PARTIAL** — labels/buttons generally present; no formal audit/cert |
| Responsive | **PARTIAL / NOT VERIFIED** full 3-viewport re-sweep this pass |
| Cross-browser | **NOT VERIFIED** (Chrome assumed; Edge/Firefox not retested) |

---

## S–T. Dependencies / Build / Tests

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npm run build` | **PASS** (~2m14s) |
| pytest key suites | **44 passed** |
| `npm audit --omit=dev` | **2 moderate** (dompurify, fflate) — P2 |
| `pip-audit` | **NOT VERIFIED** (package install failed / no matching dist) |

---

## U. ISO/IEC 25010 — 45-Statement Matrix (exact frozen text)

Statuses = **technical readiness for expert evaluation**, not filled Likert scores.

### Functional Suitability

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| FS-1 | The system provides all the necessary functions for managing job orders, customer records, inventory, reports, and release schedules. | **PASS** | Modules/routes present |
| FS-2 | Each module performs its intended function correctly without producing incorrect results. | **PARTIAL** | Core CRUD OK; residual integrity debt |
| FS-3 | The machine learning feature provides service completion date predictions appropriate for the available job order information. | **PARTIAL** | RF works & advisory; target is claim-span; modest R²; not 85% |
| FS-4 | The data analytics dashboard provides the information needed for monitoring sales, services, and business performance. | **PASS** | Dashboard + sales modules |
| FS-5 | The available system functions support Shoelotskey's daily business operations efficiently. | **PASS** | Domain fields/workflows |

**FS: 3 PASS · 2 PARTIAL · 0 FAIL**

### Performance Efficiency

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| PE-1 | The system loads pages and modules within an acceptable response time. | **PARTIAL** | SPA OK; exact <300ms **NOT VERIFIED** |
| PE-2 | Job order processing and saving transactions are completed without noticeable delays. | **PARTIAL** | Architecture supports; <1s **NOT VERIFIED** timed |
| PE-3 | Reports and analytics are generated efficiently even with a large number of records. | **PARTIAL** | Aggregation exists; large-n timed test **NOT VERIFIED** |
| PE-4 | The machine learning prediction is generated within a reasonable amount of time. | **PARTIAL** | Pickled RF inference; <500ms **NOT VERIFIED** timed |
| PE-5 | The system maintains good performance while multiple modules are being used. | **PARTIAL** | Async/API; formal concurrency load **NOT VERIFIED** |

**PE: 0 PASS · 5 PARTIAL**

### Compatibility

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| C-1 | The system operates properly on commonly used web browsers. | **PARTIAL** | Modern stack; multi-browser retest **NOT VERIFIED** |
| C-2 | Information entered in one module is correctly reflected in related modules. | **PASS** | Restock↔expenses↔reports design |
| C-3 | The database exchanges information correctly with all system modules. | **PASS** | ORM + API |
| C-4 | The machine learning component integrates properly with the job order management module. | **PARTIAL** | Integrated as **advisory**; official date = BR (by design) |
| C-5 | The analytics dashboard accurately displays information gathered from the operational modules. | **PASS** | Live aggregations |

**C: 3 PASS · 2 PARTIAL**

### Interaction Capability

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| IC-1 | The menus, icons, and buttons are clearly labeled and easy to recognize. | **PASS** | Lucide + bold actions |
| IC-2 | I can easily learn how to perform job order, inventory, and customer management tasks. | **PASS** | Consistent layouts |
| IC-3 | The system helps users avoid mistakes by providing clear prompts and confirmation messages. | **PASS** | Confirm dialogs + sonner |
| IC-4 | The layout and navigation make it easy to move between different modules. | **PASS** | Persistent nav |
| IC-5 | The system provides helpful messages and guidance whenever users need assistance. | **PARTIAL** | Placeholders/toasts; no Help Center (matrix already notes) |

**IC: 4 PASS · 1 PARTIAL**

### Reliability

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| R-1 | The system performs consistently without unexpected interruptions during operation. | **PARTIAL** | Error boundaries; long soak **NOT VERIFIED** |
| R-2 | Customer, inventory, and transaction records remain accurate after being saved. | **PASS** | Transactions + audit |
| R-3 | The system can recover successfully after unexpected errors or interruptions. | **PARTIAL** | Rollback/offline patterns; full offline resilience limited in prod path |
| R-4 | The system continues to operate properly when processing multiple transactions. | **PARTIAL** | Row locks added; full race suite **NOT VERIFIED** |
| R-5 | The machine learning prediction and analytics functions remain dependable during repeated use. | **PASS** | Stateless RF load |

**R: 2 PASS · 3 PARTIAL**

### Security

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| S-1 | User authentication effectively prevents unauthorized access. | **PASS** | JWT + 401 probes |
| S-2 | The system restricts access to features based on user roles and permissions. | **PASS** | Backend RBAC + FE guards |
| S-3 | Customer, transaction, and inventory information are protected from unauthorized viewing or modification. | **PASS** | AuthZ + bcrypt |
| S-4 | The system records user activities to support accountability and transaction tracking. | **PASS** | `log_audit` / Activity History |
| S-5 | The system provides adequate protection against common security threats affecting web-based systems. | **PARTIAL** | Strong authZ/ORM; moderate npm vulns; no full ASVS claim |

**S: 4 PASS · 1 PARTIAL**

### Maintainability

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| M-1 | The system is easy to maintain and improve. | **PARTIAL** | Modular FE; oversized main.py |
| M-2 | Changes to one part of the system do not affect the rest of the system. | **PARTIAL** | Generally isolated; shared god-files risk |
| M-3 | Errors and system issues can be identified and analyzed efficiently. | **PASS** | Logs + HTTP codes; prod hides paths |
| M-4 | The system design supports future feature enhancements and updates. | **PASS** | Vite/FastAPI/SQLAlchemy extensible |
| M-5 | The system can be tested efficiently after updates or modifications. | **PASS** | pytest suites + API contracts |

**M: 3 PASS · 2 PARTIAL**

### Flexibility

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| FL-1 | The system can adapt to future changes in Shoelotskey's business processes. | **PASS** | Dynamic services/inventory |
| FL-2 | New services, reports, or features can be added without major changes to the system. | **PASS** | Catalog-driven |
| FL-3 | The system can support an increasing number of users, customers, and transaction records. | **PARTIAL** | Postgres capable; scale test **NOT VERIFIED** |
| FL-4 | The system can be installed and configured in similar business environments with minimal effort. | **PARTIAL** | Heroku/manual; no Docker turnkey (matrix notes) |
| FL-5 | The system can be updated without affecting its normal operation. | **PASS** | Stateless SPA + DB persistence |

**FL: 3 PASS · 2 PARTIAL**

### Safety

| ID | Exact statement | Status | Evidence |
|----|-----------------|--------|----------|
| SF-1 | The system helps prevent accidental loss or deletion of important records. | **PASS** | Confirmations / soft-delete patterns |
| SF-2 | The system shows a warning before important actions are performed. | **PASS** | Cancel/confirm modals |
| SF-3 | The system checks user input before processing transactions. | **PASS** | FE + Pydantic |
| SF-4 | The system modules work together without causing data errors. | **PARTIAL** | Mostly; inventory JSON SoT residual |
| SF-5 | The system helps ensure safe and reliable business operations during daily use. | **PASS** | RBAC + audit + BR authority |

**SF: 4 PASS · 1 PARTIAL**

### ISO TOTALS (technical readiness)

| Status | Count |
|--------|------:|
| **PASS** | **26** |
| **PARTIAL** | **19** |
| **FAIL** | **0** |
| **NOT VERIFIED** (as sole status) | **0** *(latency/browser items folded into PARTIAL)* |

| Characteristic | PASS/5 |
|----------------|--------|
| Functional Suitability | **3/5** |
| Performance Efficiency | **0/5** (all PARTIAL) |
| Compatibility | **3/5** |
| Interaction Capability | **4/5** |
| Reliability | **2/5** |
| Security | **4/5** |
| Maintainability | **3/5** |
| Flexibility | **3/5** |
| Safety | **4/5** |

---

## V. TAM — 20-Statement Readiness (exact frozen text)

**READY** = system supports the workflow so respondents can honestly answer.  
**Not** measured acceptance.

### PU — Perceived Usefulness

| ID | Exact statement | Readiness |
|----|-----------------|-----------|
| PU-1 | The system helps me finish my work faster. | **READY** |
| PU-2 | The system makes it easier to manage customer records and job orders. | **READY** |
| PU-3 | The system helps me keep track of inventory and services more easily. | **READY** |
| PU-4 | The reports help me understand sales and business performance. | **READY** |
| PU-5 | The system helps me do my work better. | **READY** |

### PEOU — Perceived Ease of Use

| ID | Exact statement | Readiness |
|----|-----------------|-----------|
| PEOU-1 | The menus, buttons, and labels are easy to understand. | **READY** |
| PEOU-2 | The system is easy to learn. | **READY** |
| PEOU-3 | It is easy to enter and update information in the system. | **READY** |
| PEOU-4 | It is easy to find the information I need. | **READY** |
| PEOU-5 | The system is easy to use. | **READY** |

### BI — Behavioral Intention

| ID | Exact statement | Readiness |
|----|-----------------|-----------|
| BI-1 | I am willing to use the system in my daily work. | **READY** (workflow support only) |
| BI-2 | I will continue using the system if it is officially used in the business. | **READY** |
| BI-3 | I would recommend the system to my co-workers. | **READY** |
| BI-4 | I would rather use this system than the old way of doing the work. | **READY** |
| BI-5 | I believe this system should continue to be used at Shoelotskey. | **READY** |

### ASU — Actual System Use

| ID | Exact statement | Readiness |
|----|-----------------|-----------|
| ASU-1 | I use the system whenever I perform my assigned tasks. | **PARTIAL** — needs real Owner/Staff usage period |
| ASU-2 | I use the system to record and manage customer job orders. | **READY** (capability) / actual use **NOT VERIFIED** |
| ASU-3 | I use the system to check inventory, service status, or reports when needed. | **READY** / actual use **NOT VERIFIED** |
| ASU-4 | I can complete my work using the system without going back to the old manual process. | **PARTIAL** — capability strong; respondent proof pending |
| ASU-5 | I use the system regularly to help me complete my daily work. | **NOT VERIFIED** — requires longitudinal respondent evidence |

**TAM totals (capability readiness):**  
**PU 5/5 READY · PEOU 5/5 READY · BI 5/5 READY · ASU ~2 READY / 2 PARTIAL / 1 NOT VERIFIED**  
→ **~17/20 READY**, **2 PARTIAL**, **1 NOT VERIFIED** (ASU especially needs real users)

---

## W. Findings & Fixes

### P0 — Release hygiene
| Finding | Action |
|---------|--------|
| `shoelotskey.db-wal` / `.db-shm` were **tracked** | **FIXED for future commit:** untracked via `git rm --cached` + `.gitignore` updated. Must be in next curated commit. |

### Already fixed (prior passes; re-verified)
Auth on sensitive APIs · no pass-the-hash · JWT required · prod SQLite fail-closed · OpenAPI off in prod · Owner↛Admin · inventory locks · ML honesty · BR authoritative · hist files protected · debug DDL prod-gated · OCR DP/Bal parse fix.

### P1/P2 remaining
| Sev | Item |
|-----|------|
| PROC/P0 residual | Dirty uncommitted tree — not a single deployable SHA yet |
| PROC | Heroku `JWT_SECRET` / Postgres `DATABASE_URL` / `FRONTEND_URL` live **NOT VERIFIED** |
| P2 | npm moderate vulns (dompurify, fflate) |
| P2 | Customer unique constraint deferred |
| P2 | Inventory JSON dual SoT |
| P3 | Large main.py / JobOrderForm |
| P3 | Full responsive/button/browser re-sweep incomplete |

---

## X. Remaining Technical Debt
Large routers/components · ad-hoc migrations · dual inventory snapshots · no Docker turnkey · modest ML n/metrics · Help Center absent.

---

## Y. Defense Q&A (evidence-based, brief)

| Likely question | Answer |
|-----------------|--------|
| Why RF + BR? | BR = official schedule; RF = advisory prediction from validated history |
| Why modest R² / small n? | 35 eligible Aug–intake records; disclosed honestly; not 85% |
| Why claim-span target? | Available ground truth = claimed − received; labeled as such |
| How is RBAC enforced? | FastAPI `require_role` / JWT; FE hide is UX only |
| What if Postgres fails? | Production fails closed — no SQLite failover |
| How are hist files protected? | No public StaticFiles in prod; authenticated image API |
| Can Owner create Admin? | No — `assert_assignable_role` |

---

## Z. Final Dashboard

| Dimension | Gate |
|-----------|------|
| Architecture | **PARTIAL** |
| Code Quality | **PARTIAL** |
| OOP/SOLID | **PARTIAL** |
| Security | **PARTIAL** (strong blockers closed) |
| Input Security | **PARTIAL** |
| Output Security | **PASS** |
| DevTools Security | **PASS** |
| Authentication | **PASS** |
| RBAC | **PASS** |
| Database | **PARTIAL** |
| Data Integrity | **PARTIAL** |
| Concurrency | **PARTIAL** |
| ML | **PASS** (honest) |
| Business Rules | **PASS** |
| OCR | **PARTIAL** |
| Frontend | **PARTIAL** |
| Performance | **PARTIAL** |
| Accessibility | **PARTIAL** |
| Responsive | **PARTIAL** |
| Dependencies | **PARTIAL** |
| Testing | **PASS** |

**ISO:** 26 PASS · 19 PARTIAL · 0 FAIL  
**TAM capability:** ~17 READY · 2 PARTIAL · 1 NOT VERIFIED  

---

## Deployment / Evaluation Checklist

- [x] Critical security class closed (code + local probes)  
- [x] Build + tsc PASS  
- [x] Key backend tests PASS (44)  
- [x] WAL/SHM untracked + gitignored *(pending commit)*  
- [ ] Clean curated commit (exclude `.env`, local DB, secrets)  
- [ ] Push `capstone-fixes` → review → merge `main`  
- [ ] Heroku config verified (JWT / Postgres / FRONTEND_URL; no `EXPOSE_HISTORICAL_STATIC`)  
- [ ] Deployed SHA matches intended revision  
- [ ] Production Owner smoke  
- [ ] Production Admin smoke  
- [ ] Then ISO expert session + Owner/Staff TAM  

---

## FINAL DECISION

# **CONDITIONAL GO**

Proceed to the **user-driven** sequence: curated commit → push → Heroku verify → deploy → production smoke → then hand to ISO Experts and Owner+2 Staff.

**Not yet:** `GO FOR EVALUATION` or `GO FOR DEPLOYMENT`.

**STOP.** No commit, push, or deploy performed beyond index hygiene for WAL/SHM.

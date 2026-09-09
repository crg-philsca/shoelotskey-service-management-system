# Final System Quality and Defense Readiness Report — Shoelotskey

**Date:** 2026-09-09  
**Branch:** `capstone-fixes` @ `6dda508` + **dirty working tree**  
**origin/main:** `95b3a45`  
**Production:** https://www.shoelotskey-villamor-pasay.app/  
**Remotes:** `origin` (GitHub), `heroku`  

**Restrictions honored:** no commit · no push · no deploy · frozen ISO/TAM unchanged · no mass OCR validate · RF not removed · BR not replaced · model `.pkl` not retrained for this audit  

**Companion docs:**  
- `docs/system-architecture-and-data-flow.md`  
- `docs/iso-25010-statement-traceability-matrix.md`  
- `docs/tam-readiness-traceability-matrix.md`  
- `docs/security-threat-and-risk-register.md`  
- `docs/panel-defense-question-bank.md`  
- `docs/ml-random-forest-methodology.md` (canonical ML)

---

## FINAL DECISION

# **CONDITIONAL GO**

**Meaning:** The **local secured release candidate** is architecturally and functionally ready to *prepare* for ISO/TAM **after** a curated commit → merge to `main` → Heroku deploy → production smoke.  

**It is NOT “GO FOR EVALUATION” on the current live production site**, and **NOT “GO FOR DEPLOYMENT”** until production smoke of the secured SHA passes.

**Critical live evidence (re-probed 2026-09-09):**  
Production `GET /api/services` → **200** (unauthenticated catalog)  
Production `POST /api/predict` → **200** (unauthenticated)  
Localhost `GET /api/services` → **401**  

Do **not** hand the current production URL to IT Experts or Owner/Staff for formal scoring until the secured revision is live.

---

## A. Executive Summary

Shoelotskey is a web-based shoe-service management system with Job Order lifecycle, inventory, calendar, sales/expenses, RBAC, audit trail, OCR historical ingestion, and a dual **Business Rules (official)** + **Random Forest (advisory)** release-date design.

Local remediation on `capstone-fixes` addresses prior Critical auth/crypto issues and locks ML methodology. Production still runs an older/unsecured API surface. Working tree is large and uncommitted; WAL/SHM deletion is staged. Backend subset tests: **15 passed** this pass (ML + BR + reset-link).

| Gate | Status |
|------|--------|
| Local security architecture | Strong / PASS with residual debt |
| Production security | **FAIL** (open services/predict) |
| Release cleanliness | **PARTIAL** (dirty tree; WAL/SHM staged remove) |
| ML methodology | **ML READY WITH DOCUMENTED LIMITATIONS** |
| ISO 45 readiness matrix | Complete (not respondent scores) |
| TAM 20 readiness matrix | Complete (not acceptance) |
| Full UI button/responsive certification | **NOT VERIFIED** |

---

## B. System Purpose

Operational digitization of Shoelotskey Villamor-Pasay shoe services: capture job orders, track status to claim, manage inventory/services, report sales/expenses, schedule releases, preserve historical paper via OCR, and support advisory ML completion estimates under Owner/Admin tools.

Research title alignment: web SMS + analytics + ML for predicted release support — with BR remaining operational authority.

---

## C. System Uniqueness (honest)

| Claimed differentiator | Type | Evidence | Strength | Limitation |
|------------------------|------|----------|----------|------------|
| Dual BR official + RF advisory dates | Business-rule + ML | Job Order UI; `/api/predict` dual payload | Safer ops than ML-only | Users must understand two dates |
| Human-validated OCR → ML eligibility | Process + data | PENDING_REVIEW gate; 35 eligible of 725 | Prevents OCR poison | Slow; small training set |
| Shoe-service combo duration rules | Domain rules | `business_rules.py` | Shop-accurate official dates | Must stay in sync with catalog |
| Integrated JO + inventory + calendar + sales | Functional integration | Modules/APIs | End-to-end shop workflow | Standard SMS pieces individually common |
| Role-separated Admin historical lab | RBAC | Admin-only Historical routes | Separates research data from daily ops | Admin ≠ Owner TAM path |

**Not unique alone:** generic CRUD, login, tables, filters, Heroku hosting.

---

## D. System Strengths

- Centralized Job Order workflow (new → ongoing → for-release → claimed)  
- Integrated inventory, services, release calendar, sales/expenses  
- Audit trail + Activity History (Owner)  
- JWT + bcrypt + lockout code paths  
- Production fail-closed vs SQLite (code)  
- Dual date architecture locked and documented  
- OCR quality gate before ML train  
- Canonical ML methodology with honest metrics  

---

## E. System Weaknesses / Gaps

| Item | Severity | Blocker? |
|------|----------|----------|
| Production unauth services/predict | **Critical** | **Yes** until deploy |
| Uncommitted dirty tree | High (process) | Yes for release |
| Monolithic `main.py` / large forms | Medium | Debt |
| Small ML sample / claim-span target | Medium | Documented limitation |
| Offline queue may toast “success” | Medium | Disclose / UX debt |
| Inventory concurrency residual | Medium | Debt |
| Exhaustive button/responsive/browser matrix | Medium | Pre-eval smoke needed |
| Dependency CVE scan | Medium | NOT VERIFIED |
| Heroku config/backups | Medium | NOT VERIFIED this session |

---

## F–G. Limitations (panel-safe)

- **Online-first** — not a full offline product  
- **No production SQLite failover**  
- **No automatic bidirectional SQLite↔PG sync as HA**  
- ML: 35 rows, August 2025, MAE 7.61, R² 0.1959 — not 85% accuracy  
- Material/workload/complexity **not** current RF features  
- OCR backlog (690 pending)  
- Single-shop capstone scope · Heroku dependency  

Acceptable for capstone if disclosed; not excuses for open production APIs.

---

## H. Technology Stack (defense)

| Tech | Why | Alternative | Limitation |
|------|-----|-------------|------------|
| React+TS+Vite | Complex SPA JO UX; typed FE | Angular/Vue | Bundle/source visible |
| FastAPI+Python | API + ML/OCR same language | Django/Flask | Monolith risk |
| SQLAlchemy | ORM safety | Raw SQL | Migrations ad-hoc |
| PostgreSQL | Prod concurrency/backup | MySQL | Ops cost |
| SQLite | Local continuity | — | Not prod SoT |
| scikit-learn RF | Nonlinear; simple deploy | XGBoost/linear | Needs more data |
| JWT+bcrypt | Stateless SPA auth | Sessions | Token theft risk |
| Heroku | Capstone deploy | VPS/Docker | Platform lock-in |

---

## I. Architecture

See `docs/system-architecture-and-data-flow.md`.  
Trust boundary: browser untrusted; backend authoritative.  
Large-file debt acknowledged; no major refactor this gate.

---

## J. Module-by-module (summary)

| Module | Role access | Status |
|--------|-------------|--------|
| Login / Forgot / Reset | Public | Implemented |
| Dashboard | Owner/Staff/Admin | Implemented |
| Job Order Form / Job Orders | All ops roles | Dual BR/ML |
| Release Calendar / Claim | Ops | Implemented |
| Services | Ops | Catalog |
| Inventory | Ops | Locks partial |
| Sales / Expenses / Totals | Ops | Implemented |
| User Management | Owner/Admin | Implemented |
| Activity History | Owner/Admin | Implemented |
| Historical Records / OCR / Archives / Analytics / ML | **Admin** | Quality-gated |
| Error / System error | All | Present |

Exhaustive every-button proof: **NOT VERIFIED** (requires Owner/Admin smoke after deploy).

---

## K–O. Navigation / Search / Filter / Button / Form

| Area | Result |
|------|--------|
| SPA ProtectedRoute + backend authz | Present; prod API gap |
| Search/filters | Exist on key modules; injection-safe via ORM paths | **PARTIAL** |
| Buttons | Core actions wired; exhaustive audit **NOT VERIFIED** |
| Forms | Required fields + server validation patterns | **PARTIAL** |

---

## P. Business Rules

Official operational release date. Persists to `expected_at`.  
Form = API BR = DB `expected_at` = Details/Calendar official path (design).  
ML must not overwrite — verified in local code/tests.

---

## Q. Machine Learning

Status: **ML READY WITH DOCUMENTED LIMITATIONS**  
18 features · claim−receive target · 35/28/7 · Aug 2025 · MAE 7.61 · R² 0.1959 · RMSE 8.93  
Material/workload/complexity = future only  
Do not retrain for deployment cleanup  

---

## R. OCR

Scans → OCR → PENDING_REVIEW → human validate → ML eligibility.  
No mass validation. Archives = source evidence.

---

## S. Synchronization

PostgreSQL = production source of truth.  
Cloud→SQLite = local mirror.  
Browser queues = client resilience.  
**NOT IMPLEMENTED:** full offline product / automatic prod dual-DB HA sync.

---

## T. Internet interruption

**PARTIAL.** Online-first. Failures should error or queue; disclose queued-success UX. Already-committed DB rows remain.  
Correct defense statement: online web app; connectivity required for critical commits; fail safely; do not falsely confirm uncommitted server state as final.

---

## U. Database failure

Production: refuse SQLite failover; **503**. Local: may switch SQLite. Recovery: restore PG; app resumes.

---

## V–AD. Security summary

See `docs/security-threat-and-risk-register.md`.  
Local unauth probes: services/predict **401**. Prod: **FAIL**.  
Auth lockout code present. IDOR matrix **NOT VERIFIED**.  
DevTools: expect clients can inspect SPA; server must reject forged roles/IDs.

---

## AE–AF. Data integrity / concurrency

ORM transactions on create paths. Inventory `with_for_update` on some updates. Residual race risk → documented debt. Customer soft uniqueness deferred.

---

## AG–AI. Privacy / Accessibility / Responsive

Privacy: role-gated modules; auth’d historical files.  
WCAG 2.2: practical review **PARTIAL / NOT VERIFIED** (no formal cert).  
Responsive 1280/768/390: **NOT VERIFIED** this master pass.

---

## AJ–AL. Performance / Scalability / Clean code

Performance: partial timings only.  
Scalability: adequate for single-shop capstone; watch audit log growth & OCR volume.  
SOLID/DRY: mixed; God files = debt, not blocker if disclosed.

---

## AM–AN. Dependencies / Backup

Supply-chain CVE: **NOT VERIFIED**.  
Heroku PG backups: **NOT VERIFIED** (CLI unauthenticated).

---

## AO–AP. ISO / TAM

| Instrument | Matrix | Formal scoring |
|------------|--------|----------------|
| ISO 45 | 7 PASS / 33 PARTIAL / 1 FAIL / 4 NV | NOT STARTED |
| TAM 20 | 13 READY / 7 PARTIAL | NOT STARTED |

See dedicated matrix docs.

---

## AQ. Defense questions

See `docs/panel-defense-question-bank.md` (≥60 Qs).

---

## AR. Risk register

See `docs/security-threat-and-risk-register.md`.

---

## AS. Release blockers

### P0 CRITICAL
1. Production unauthenticated `/api/services` and `/api/predict`  
2. Secured revision not on `main`/Heroku  

### P1 HIGH
3. Dirty uncommitted tree (process)  
4. Staged WAL/SHM removal must complete in curated commit  
5. Heroku config vars (`JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL`, mail, `EXPOSE_HISTORICAL_STATIC` off) **NOT VERIFIED**

### P2 MEDIUM
6. Offline queue success UX  
7. Residual concurrency / customer uniqueness  
8. Large-file maintainability  
9. Incomplete responsive/button certification  

### P3 LOW
10. Cosmetic / docs hygiene  

---

## AT. Required fixes before evaluation

**Must do (process):** curated commit of secured tree → push `capstone-fixes` → merge `main` → Heroku auto-deploy → re-probe prod APIs → Owner/Admin/Staff smoke → then ISO/TAM.

**Must not:** commit `.env`, local `.db`, WAL/SHM, secrets; retrain RF casually; change questionnaires; claim offline/auto-sync/85% accuracy.

**Optional low-risk (not required for this report’s stop):** clarify ErrorPage offline wording; queued-success toast copy.

**No code changes made in this master audit pass** (inspection/report only).

---

## AU. Deployment checklist (after audit)

1. Curate tree (no `git add .`)  
2. Ensure WAL/SHM untracked  
3. Exclude `.env` / secrets / local DB  
4. Review staged diff  
5. Commit on `capstone-fixes` (when user requests)  
6. Push branch  
7. PR/merge to `main`  
8. Verify Heroku GitHub auto-deploy on `main`  
9. Verify config vars  
10. Confirm deployed SHA  
11. Prod smoke: unauth APIs **401**; Owner/Admin/Staff paths  
12. Network fail-safe check  
13. Hand to IT Experts (ISO)  
14. Hand to Owner + 2 Staff (TAM)  
15. Continue OCR validation; future ML retrain only when approved  

---

## AV. Final Decision (exact)

**CONDITIONAL GO**

| Decision option | Applies? |
|-----------------|----------|
| NO-GO | Against **current production** for formal evaluation |
| **CONDITIONAL GO** | **Selected** — local candidate OK after secured deploy + smoke |
| GO FOR EVALUATION | **No** until production secured |
| GO FOR DEPLOYMENT | **No** — production smoke of secured SHA not done |

---

## Quality scoreboard (summary)

| Area | Status |
|------|--------|
| Architecture | PARTIAL (works; monolith debt) |
| Code quality / SOLID | PARTIAL |
| Maintainability | PARTIAL |
| Functionality | PARTIAL |
| Performance | PARTIAL / NV |
| Compatibility | PARTIAL / NV |
| Interaction | PARTIAL |
| Reliability | PARTIAL |
| Security | **FAIL prod / PASS local core** |
| Data integrity | PARTIAL |
| Privacy | PARTIAL |
| Resilience | PARTIAL |
| Synchronization | PARTIAL (honest limits) |
| Offline/network | PARTIAL / NOT full offline |
| ML | PASS w/ documented limits |
| OCR | PARTIAL (backlog) |
| Database | PARTIAL |
| Deployment | FAIL until secured SHA live |
| Accessibility | NOT VERIFIED |
| Responsive | NOT VERIFIED |
| Testing | PARTIAL (15 tests this pass; not full suite) |
| Documentation | PASS (methodology + matrices) |

---

## Absolute truth reminders

Do **not** claim: 100% secure · bug-free · fully compliant · enterprise-grade · offline-capable · automatic sync · 85% ML accuracy · perfect prediction · full ISO compliance · TAM acceptance.

**STOP.** No commit. No push. No deploy.

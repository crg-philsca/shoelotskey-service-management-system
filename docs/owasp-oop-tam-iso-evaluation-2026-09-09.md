# Shoelotskey Evaluation — OWASP Top 10, OOP, TAM, ISO/IEC 25010

**Date:** 2026-09-09  
**Verdict:** **NOT READY** for formal production ISO/IEC 25010 or Owner TAM of Historical/ML  
**Local core demo:** **CONDITIONAL GO** (disclose demo data + ML limits)  
**Constraint honored:** Inspect-only. Approved TAM/ISO questionnaire statements were **not** modified. No app code changed for this evaluation.

**Live probes:** `http://127.0.0.1:8000/` (SQLite)  
**Instrument:** [`docs/CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md`](CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md) (20 TAM + 45 ISO items, frozen)  
**Canvas:** open beside chat — evaluation scorecard

---

## Executive summary

Core live operations still work on localhost. The same evaluation blockers from earlier today remain open and were **re-confirmed live**:

| Probe | Result |
|---|---|
| Unauth `GET /api/services` | **200** (pricing catalog) |
| Unauth `POST /api/predict` | **200** (BR+ML estimate) |
| Unauth `GET /docs` | **200** (OpenAPI UI) |
| Unauth `GET /api/health-check` | **200** (DB path disclosure) |
| Historical UI/API | **Admin-only** (Owner walk fails) |
| ML meta | R² **−0.46**, dataset_size **13** |

| Lens | Score / verdict |
|---|---|
| OWASP Top 10 | **1 PASS / 7 PARTIAL / 2 FAIL** |
| OOP maturity | **62/100** (layered hybrid; not pure OOP) |
| TAM feature support | **CONDITIONAL** (core ready; Historical/ML not for Owner) |
| ISO/IEC 25010 | **NOT READY** as “Full” on evaluation host — Security is a **Gap** |

---

## 1. OWASP Top 10

| # | Category | Status | Evidence |
|---|---|---|---|
| A01 | Broken Access Control | **PARTIAL** | `require_role` + DB role check strong; unauth predict/services; Historical `admin` only (`App.tsx`, `main.py`) |
| A02 | Cryptographic Failures | **PARTIAL** | `JWT_SECRET` required; bcrypt; min password length 4; plaintext reset tokens |
| A03 | Injection | **PASS** | SQLAlchemy ORM / binds; no `eval`; limited XSS surface |
| A04 | Insecure Design | **PARTIAL** | Server business rules for release dates; order create can silently understock |
| A05 | Security Misconfiguration | **FAIL** | Open `/docs`, public `/historical_data` StaticFiles, verbose health, no security headers |
| A06 | Vulnerable Components | **PARTIAL** | npm lockfile; Python `>=` pins; no `npm audit`/`pip-audit` this run |
| A07 | Identification & Auth Failures | **PARTIAL** | Lockout + JWT verify + idle timeout; **no rate limit**; forgot-password email enumeration |
| A08 | Software & Data Integrity | **FAIL** | `pickle.load` of model files (`ml_engine.py` / `historical_ml_engine.py`) |
| A09 | Logging & Monitoring | **PARTIAL** | `audit_logs` + Activity History; silent audit write failures; no alerting |
| A10 | SSRF / Exception Handling | **PARTIAL** | No classic SSRF; 500 responses can leak file/line; predict errors to unauth callers |

### Highest-priority OWASP remediations

1. Authenticate `POST /api/predict` and catalog reads (or intentionally public + documented).
2. Unmount or auth-gate `/historical_data`.
3. Disable OpenAPI `/docs`/`/redoc`/`/openapi.json` in production.
4. Replace pickle model loading with safer serialization/signing.
5. Rate-limit auth endpoints; stop returning “Email not found”.
6. Strip `debug_info` / raw exceptions from client responses; scrub health payloads.

---

## 2. OOP principles

**Overall maturity: 62/100**

The stack is a **pragmatic hybrid** (procedural FastAPI routes + SQLAlchemy/Pydantic classes + React functional components). That is normal for this tech stack. Evaluation should judge **encapsulation, abstraction, SRP, and layering**, not whether every module is a classical class hierarchy.

| Principle | Rating | Notes |
|---|---|---|
| Encapsulation | PARTIAL | Models/schemas/engines; many routes take `Dict[str, Any]` |
| Abstraction | PARTIAL | DB → models → schemas → routes → contexts; incomplete service layer |
| Inheritance | WEAK | Framework bases (`Base`, `BaseModel`) only |
| Polymorphism | WEAK–PARTIAL | Predictor fallback / composition; no Strategy ABCs |
| Single Responsibility | WEAK | `main.py` ~5.3k lines / ~61 routes; large JobOrder/Historical pages |
| Layered SoC | PARTIAL+ | Real layered design; business logic still heavy in routes |
| Modularity / reuse | PARTIAL | ML/OCR/businessRules packages; FE/BE rule duplication risk |

**Defend as:** layered hybrid architecture with modular ML/OCR/auth.  
**Do not claim:** pure OOP, fully extracted OrderService layer, or that `InventoryRepository` represents the whole API.

---

## 3. TAM (Technology Acceptance Model)

**Instrument location:** `docs/CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md`  
**Frozen constructs:** PU-1…5, PEOU-1…5, BI-1…5, ASU-1…5 (**Attitude Toward Using is not in the approved instrument** — do not invent Attitude items).

| Construct | Readiness | Implementation alignment |
|---|---|---|
| Perceived Usefulness (PU) | **READY** (local) | Job orders, customers-in-form, inventory, services, sales/reports, dashboard |
| Perceived Ease of Use (PEOU) | **READY** (local) | Consistent SPA, filters, toasts; some sidebar/nav gaps |
| Attitude | **N/A** | Not surveyed in frozen instrument |
| Behavioral Intention (BI) | **CONDITIONAL** | Calendar, RBAC, Activity History exist; Owner Historical 403; ML honesty risk for “prefer vs old way” |
| Actual System Use (ASU) | **CONDITIONAL** | Core Staff/Owner workflows usable; Historical OCR/ML path Admin-only |

**Survey note:** TAM still requires administering the existing questionnaire to real users. This audit only verifies that features behind the items exist and work.

**Demo friction (do not rewrite questionnaire text):** matrix still maps `CustomerList.tsx` (file absent) — use Job Order customer search in the demo script.

---

## 4. ISO/IEC 25010

**Instrument:** same CAPSTONE matrix — **45 frozen items** across 9 characteristics. Matrix self-rates mostly “Fully Implemented” except **IC-5** and **FL-4** Partial. This re-evaluation rates by live/code evidence:

| Characteristic | Readiness | Gap vs “Full” |
|---|---|---|
| Functional Suitability | **PARTIAL** | Prediction path exists; RF quality does **not** support ≥85% accuracy claims |
| Performance Efficiency | **PARTIAL** | Architecture plausible; latency claims unmeasured |
| Compatibility | **PARTIAL** | Cross-module flows present; browsers not re-walked |
| Usability (Interaction Capability) | **PARTIAL** | IC-5 Partial (no Help/tour); nav gaps |
| Reliability | **PARTIAL** | Validation/JWT OK; offline recovery residual |
| Security | **GAP** | Live public predict, services, docs, historical static files |
| Maintainability | **PARTIAL** | Packages exist; `main.py` god module |
| Portability (Flexibility) | **PARTIAL** | FL-4 Partial; deploy tree not ready |
| Safety | **PARTIAL** | Confirmations/validation present; residual input holes |

---

## 5. Combined readiness

| Use | Ready? |
|---|---|
| Local demo of Dashboard, Job Orders, Calendar, Inventory, Sales, Users | **Yes** (disclose demo data) |
| Owner evaluation of Historical OCR / Analytics / ML | **No** (Admin-only) |
| Present ML as accurate ≥85% predictor | **No** (R² −0.46, n=13) |
| Formal ISO/IEC 25010 + TAM on production host | **No** |
| OOP/architecture defense as layered hybrid | **Yes** (disclose `main.py` liability) |

### Go conditions before formal evaluation

1. Authenticate `/api/predict` (+ catalog if not intentionally public).  
2. Lock `/historical_data` and disable public OpenAPI docs in production.  
3. Give Owner historical access **or** evaluate Historical as Admin and say so.  
4. Stop presenting R²×100 as “Prediction Accuracy”; disclose sample size.  
5. Deploy remediations to the evaluation host and smoke-test PostgreSQL.  
6. Then administer the **existing** CAPSTONE TAM/ISO items unchanged.

---

## Companions (unchanged)

- [`pre-evaluation-readiness-audit-2026-09-09.md`](pre-evaluation-readiness-audit-2026-09-09.md)
- [`deployment-readiness-report-2026-09-09.md`](deployment-readiness-report-2026-09-09.md)
- [`system-readiness-audit.md`](system-readiness-audit.md)
- [`CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md`](CAPSTONE_SYSTEM_AUDIT_AND_VALIDATION_MATRIX.md)

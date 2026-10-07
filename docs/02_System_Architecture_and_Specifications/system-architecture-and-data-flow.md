# System Architecture and Data Flow — Shoelotskey

**Date:** 2026-09-09  
**Scope:** Architecture evidence for defense (no secrets)  
**Stack:** React + TypeScript + Vite · FastAPI · SQLAlchemy · PostgreSQL (prod) / SQLite (local) · scikit-learn RF · Heroku  

---

## 1. High-level architecture

```text
                    ┌─────────────────────────────────────┐
                    │  Browser (SPA)                       │
                    │  React + TypeScript + Vite           │
                    │  JWT in memory/localStorage          │
                    └───────────────┬─────────────────────┘
                                    │ HTTPS / REST JSON
                                    ▼
                    ┌─────────────────────────────────────┐
                    │  FastAPI (backend/main.py + routers) │
                    │  Auth: JWT + bcrypt                  │
                    │  RBAC: get_current_user / require_role│
                    └───────────────┬─────────────────────┘
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
   Business Logic            Historical/OCR              ML Services
   Job Orders, Inv,          Validation Queue            business_rules.py
   Sales, Expenses,          Archives / Images           historical_ml_engine
   Users, Audit              bulk-import (admin)         ml_engine.py (dual)
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    ▼
                         SQLAlchemy ORM (models.py)
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
   Production: PostgreSQL (Heroku)              Local: SQLite shoelotskey.db
   Source of truth online                       Defense/local continuity only
```

**Heroku** serves built SPA (`dist/`) + FastAPI process. Config vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, mail, etc. (values never documented here).

---

## 2. Trust / security / data boundaries

| Boundary | What crosses | Control |
|----------|--------------|---------|
| Browser → API | JSON + Bearer JWT | HTTPS; backend authz authoritative |
| Staff/Owner/Admin | Role claims in JWT | `require_role`; Admin bypasses role checks as developer path |
| API → DB | ORM / limited raw SQL | Parameterized queries; prod no SQLite failover |
| API → Files | Historical images/PDFs | Auth’d fetch; `EXPOSE_HISTORICAL_STATIC` disabled in Production |
| ML | Features → pickle model | Auth’d `/api/predict`; RF never writes `expected_at` |
| Secrets | Env only | `JWT_SECRET` required; no hardcoded JWT fallback |

---

## 3. Dual release-date data flow (locked)

```text
Job Order Form
   │
   ├─► Business Rules ──► official days/date ──► expected_at (DB)
   │
   └─► Random Forest ──► advisory days/date ──► UI "ML PREDICTION" only
```

Formula (canonical):

- \(\hat{CompletionDays}=RF(ServiceQtys,Pairs,Priority,GrandTotal,Calendar,ConditionCounts)\)
- \(MLPredictedReleaseDate=DateReceived+\max(1,\mathrm{round}(\hat{CompletionDays}))\)
- \(OfficialReleaseDate=BusinessRules(\ldots)\)

---

## 4. OCR / historical pipeline

```text
Scans/PDFs (Archives)
 → OCR extraction
 → PENDING_REVIEW
 → Human OCR Validation (approve/correct/reject/re-OCR)
 → VALIDATED / CORRECTED
 → ML eligibility (completion_days 1–60)
 → RF train (Admin)
 → completion_model.pkl / historical_rf_model.pkl
```

---

## 5. Synchronization (honest)

| Mechanism | Direction | Production role |
|-----------|-----------|-----------------|
| Cloud → SQLite `sync_to_local` | PG → local mirror | Backup mirror for **local** continuity; not prod HA |
| Boot / sync-backup-to-cloud | SQLite → PG | Local recovery path; Owner API |
| Browser localStorage queues | UI → API retry | Client resilience; **not** full offline product |
| Production PG down | — | **503**; **no** SQLite API failover |

**Do not claim:** automatic SQLite↔PostgreSQL bidirectional production sync, or full offline capability.

---

## 6. Failure points

1. Network drop mid-submit → queue/optimistic UX (PARTIAL offline)  
2. PostgreSQL unavailable in Production → 503  
3. JWT missing/invalid → 401  
4. Role mismatch → 403 / frontend redirect  
5. ML model missing/invalid → BR still official; ML unavailable  
6. OCR noise → human gate prevents training poison  

---

## 7. Maintainability note

| File | Approx lines | Role |
|------|--------------|------|
| `backend/main.py` | ~5,000+ | App entry, many endpoints, boot/migrations |
| `JobOrderForm.tsx` | ~2,200 | Primary capture form |
| `HistoricalValidationQueue.tsx` | ~2,000 | OCR review UI |

Acceptable as **documented technical debt** for capstone; modular `APIRouter` split is future work, not a current release blocker.

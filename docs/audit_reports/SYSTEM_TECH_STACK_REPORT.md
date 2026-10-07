# SYSTEM TECH STACK & ARCHITECTURE AUDIT REPORT
## Comprehensive Technical Specification of Frontend, Backend, Relational Persistence, Machine Learning, and Security Controls

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Program:** Bachelor of Science in Aviation Information Technology (BSAIT)  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Adviser:** Richard Niel B. Peralta, MSIT · **Program Coordinator:** Jerum B. Dasalla, DIT  
**Audit Protocol:** Level 1 Codebase Ground Truth & ISO/IEC 25010:2023 Software Quality Alignment  

---

## 1. Executive Summary & Technology Stack Matrix

The **Shoelotskey Service Management System** is engineered as a decoupled, multi-tier, cloud-native web application designed to automate service order intake, customer tracking, inventory monitoring, financial analytics, and predictive turnaround forecasting for shoe repair and care services.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Presentation Layer (Frontend SPA)                        │
│   React 18.3.1 · TypeScript 5.9 · Vite 6.4 · Tailwind CSS 4.1 · Radix UI Primitives     │
│   25 Pages (AdminDashboard, StaffDashboard, JobOrderForm, Tracking, Analytics, etc.)    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTPS / WSS / REST (JSON)
                                            │ Bearer JWT (HS256, 480m)
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                              Application Layer (Backend ASGI API)                      │
│   Python 3.12+ · FastAPI 0.115 · Starlette · Uvicorn ASGI · Pydantic v2 Validation     │
│   92 Endpoints (65 Protected by require_role / require_admin) · Sliding Rate Limiter   │
└─────────────────────┬──────────────────────────────────────────────┬───────────────────┘
                      │ SQLAlchemy 2.0 ORM Parameterized             │ Native Python
                      │ Connection Pooling & Fail-Closed Guard       │ In-Memory Pipeline
┌─────────────────────▼──────────────────────────────┐ ┌─────────────▼───────────────────┐
│              Persistence Tier                      │ │         Analytics & ML Tier     │
│  PostgreSQL (AWS RDS / Heroku Postgres)            │ │  Scikit-Learn 1.3 · Joblib      │
│  3NF Relational Schema · 35 Normalized Tables      │ │  Random Forest (150 Estimators) │
│  Row-Level Locking (with_for_update)               │ │  Option B Dual-Date UI Workflow │
│  (Dev/Offline SQLite locked via P0-5 guard)        │ │  Batch Retrain (/api/train)     │
└────────────────────────────────────────────────────┘ └─────────────────────────────────┘
```

| Architectural Layer | Core Technology | Exact Version | Primary Role & Responsibility |
| :--- | :--- | :--- | :--- |
| **Presentation (Frontend)** | React + TypeScript + Vite | React 18.3.1 / TS 5.9.3 / Vite 6.4.1 | Single-Page Application (SPA) with 25 role-guarded views. |
| **Styling & Components** | Tailwind CSS + Radix UI | Tailwind 4.1.12 / Radix Primitives | WCAG AA accessible UI components and contrast-compliant styling. |
| **Application (Backend)** | FastAPI + Starlette + Uvicorn | FastAPI >= 0.115.0 / Uvicorn >= 0.30.0 | High-concurrency asynchronous ASGI RESTful API (92 routes). |
| **Data Validation** | Pydantic v2 | Pydantic >= 2.0.0 | Strict request/response payload parsing with HTTP 422 enforcement. |
| **Database & ORM** | PostgreSQL + SQLAlchemy 2.0 | PostgreSQL 15+ / SQLAlchemy >= 2.0.0 | 3NF relational persistence across 35 models with zero SQL injection. |
| **Machine Learning** | Scikit-Learn + Joblib | Scikit-Learn >= 1.3.0 / Joblib >= 1.3.0 | 13-feature Random Forest Regressor under Option B advisory UI. |
| **Security & Auth** | Native Bcrypt + PyJWT | Bcrypt >= 4.0.1 / PyJWT >= 2.8.0 | 12-round password salt hashing, JWT RBAC, and 3-attempt lockout. |
| **Hosting & DevOps** | Heroku + AWS RDS + GitHub | Linux x86_64 / Git CI/CD | Cloud application containerization and automated deployments. |

---

## 2. Presentation Tier Deep-Dive (Frontend Architecture)

The frontend is implemented as a high-performance **Single-Page Application (SPA)** utilizing React 18 and Vite:

### A. Core Technologies & Package Dependencies
- **React (v18.3.1):** Drives declarative state management, efficient component memoization, and concurrent rendering features.
- **TypeScript (v5.9.3):** Enforces compile-time type safety across all DTO models, preventing undefined property errors and synchronizing API contracts with FastAPI schemas.
- **Vite (v6.4.1):** Next-generation frontend bundler providing sub-second Hot Module Replacement (HMR) during development and Rollup-based tree-shaking for lean production assets.
- **Tailwind CSS (v4.1.12):** Enforces an atomic design system with curated HSL color tokens, dark/light theme switching, and WCAG AA contrast compliance (&ge; 4.5:1).
- **Radix UI Primitives:** Provides unstyled, accessible keyboard-navigable UI components (Dialog, DropdownMenu, Select, Tabs, Popover, Tooltip, Accordion).
- **Recharts (v2.15.2):** Renders executive data visualizations (daily/weekly/monthly revenue trendlines, category distributions, ROI gauges).
- **Axios (v1.15.0):** Manages asynchronous HTTP communications, Bearer token injection, and centralized 401 Unauthorized redirect interceptors.
- **html2pdf.js (v0.14.0) & QRCode (v1.5.4):** Enables dynamic QR code generation for customer repair tracking and instant client-side PDF receipt compilation without server roundtrips.

### B. Role-Guarded View Distribution (25 Views)
1. **Administrative / Owner Views (10):** `AdminDashboard.tsx`, `ServiceManagement.tsx`, `Inventory.tsx`, `SalesReport.tsx`, `TotalSales.tsx`, `UserManagement.tsx`, `SystemSettings.tsx`, `ActivityHistory.tsx`, `ErrorLogs.tsx`, `HistoricalDataValidation.tsx`.
2. **Staff / Counter Views (7):** `StaffDashboard.tsx`, `JobOrderForm.tsx`, `ServiceQueue.tsx`, `ReleaseCalendar.tsx`, `InventoryUsage.tsx`, `CustomerManagement.tsx`, `QuickIntake.tsx`.
3. **Public Customer Views (5):** `CustomerTracking.tsx`, `PublicLanding.tsx`, `OrderStatusLookup.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`.
4. **Shared Operational Views (3):** `LoginModal.tsx`, `ImagePreviewModal.tsx`, `GenerateReportModal.tsx`.

---

## 3. Application Tier Deep-Dive (Backend API Architecture)

The backend is built using **FastAPI**, an asynchronous, high-concurrency Python web framework running on the ASGI standard:

### A. Core Framework Features
- **Asynchronous Concurrency (ASGI):** Native `async`/`await` request handling via Starlette and Uvicorn, allowing non-blocking I/O operations across multiple simultaneous shop registers.
- **Strict Data Validation (Pydantic v2):** Strongly typed request/response models in `backend/schemas.py`. Invalid payloads immediately trigger HTTP 422 Unprocessable Entity responses with structured error pointers.
- **Dependency Injection:** Modular dependency chaining (`Depends(get_db)`, `Depends(get_current_user)`, `Depends(require_role(["admin"]))`) cleanly segregates session management and authentication from endpoint logic.
- **OpenAPI / Swagger Generation:** Automatic generation of interactive documentation at `/docs` and `/redoc`, eliminating API drift.

### B. API Router Module Breakdown (92 Endpoints)
- **`/api/auth` (8 endpoints, 4 protected):** Login, logout, token refresh, password updates, account recovery, session verification.
- **`/api/job_orders` (22 endpoints, all protected):** Job order creation, item intake, status transitions, QR token generation, receipt queries.
- **`/api/services` (12 endpoints, 10 protected):** Service catalog CRUD, pricing configuration, SLA baseline adjustments.
- **`/api/inventory` (14 endpoints, all protected):** Consumable materials tracking, stock depletion logging, low-stock threshold alerts.
- **`/api/reports` (11 endpoints, all protected):** Daily, weekly, monthly, annual sales, expenses, net profit, and ROI aggregations.
- **`/api/tracking` (6 endpoints, public access):** Customer self-service timeline tracking and PIN security verification.
- **`/api/historical` (12 endpoints, all protected):** Paper receipt archival ingestion, OCR extraction, ML retraining trigger, residual analytics.
- **`/api/system` (7 endpoints, all protected):** Healthcheck, migration status, administrative database backups, user auditing.

---

## 4. Persistence Tier Deep-Dive (Database & ORM Architecture)

### A. Relational Engine & Third Normal Form (3NF)
- **PostgreSQL 15+ (Production):** Enterprise relational database hosted on AWS RDS / Heroku Postgres, enforcing full ACID transaction guarantees and referential integrity via cascade delete and foreign key constraints.
- **SQLAlchemy 2.0 ORM:** Object Relational Mapper translating Python class representations into parameterized SQL queries, completely eliminating SQL injection vectors (OWASP A03).
- **Row-Level Concurrency Control:** Implements `with_for_update` locking on inventory stock depletion transactions to prevent race conditions during simultaneous item sales.

### B. 35 Normalized Relational Models
1. **Core Intake & Services (11):** `Order`, `Item`, `Customer`, `ItemServiceMapping`, `ItemConditionMapping`, `Condition`, `Status`, `PriorityLevel`, `Service`, `ServiceCategory`, `PaymentMethod`.
2. **Financials & Inventory (7):** `Payment`, `PaymentStatus`, `Expense`, `CashSession`, `Inventory`, `InventoryLog`, `MaterialConsumption`.
3. **Identity & Security (4):** `User`, `Role`, `UserSession`, `AuditLog`.
4. **Historical Receipts & ML (9):** `HistoricalOrder`, `HistoricalItem`, `HistoricalItemService`, `HistoricalImage`, `HistoricalPrediction`, `EtlImportHistory`, `CsvImportBatch`, `HistoricalReconciliationConflict`, `Delivery`.
5. **Research & Benchmarking (4):** `ResearchTestRun`, `ResearchMeasurement`, `StatusLog`, `ShippingPreference`.

### C. The Fail-Closed Production Security Guard (P0-5)
In cloud deployment, the database connection strictly enforces a **fail-closed security posture**: if the primary PostgreSQL cluster is unreachable, the API returns **HTTP 503 Service Unavailable**. Silent fallback to local SQLite in production is explicitly locked out to prevent split-brain data corruption across multi-user registers. SQLite is strictly reserved for local offline developer testing.

---

## 5. Machine Learning & Statistical Analytics Engine

### A. Model Specification & Training Protocol
- **Algorithm:** `RandomForestRegressor` (Scikit-Learn v1.3+) composed of 150 bagged decision trees (`max_depth=10`, `random_state=42`).
- **Target Variable:** Continuous customer turnaround duration in days:  
  $$\text{turnaround\_days} = \text{claimed\_date} - \text{date\_received}$$
- **Feature Set B (13 Features):** Item quantity, total pairs, priority weight, estimated service cost, service category counts (cleaning, reglue, stitch, repaint, unyellowing, custom), and seasonal intake month.
- **Validation Strategy:** 5-Fold Expanding Window Time-Series Cross-Validation to guarantee zero temporal data leakage.
- **Locked Test Evaluation ($N=26$ January 2026 transactions):** $\text{MAE} = 8.56\text{ days}$, $\text{RMSE} = 10.23\text{ days}$, outperforming naive mean duration heuristics by 0.78 days.

### B. The Option B Dual-Date Operational Workflow
The ML engine functions strictly as an **advisory decision-support tool**, preventing automated prediction errors from disrupting customer commitments:
1. **Official Estimated Ready Date:** Derived deterministically from shop business rules and base SLAs; pre-fills the official date field and remains fully editable by staff.
2. **ML Advisory Duration:** Calculated concurrently by the Random Forest model and displayed in an advisory informational card (`~8.5 Days estimated turnaround`).
3. **Staff Confirmation:** Staff review the shop floor backlog and technician availability before confirming the final committed date on the printed customer claim stub.

### C. Retraining Governance
Production model artifacts (`completion_model.pkl`) are loaded statically. Real-time online backpropagation is disabled to avoid model drift and catastrophic forgetting. Instead, shop administrators can trigger an **administrative batch retraining routine** via `/api/historical/train` after accumulating newly completed orders.

---

## 6. Security Engineering & OWASP Top 10 Compliance

| OWASP Vulnerability | Engineered Technical Defense Mechanism | Codebase Verification Anchor |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Bearer JWT with embedded role claims; enforced on 65 backend routes via `require_role(["admin", "staff"])`; client route guards. | `backend/auth_utils.py` & `src/app/routes.tsx` |
| **A02: Cryptographic Failures** | User passwords hashed using native **Bcrypt** with 12 cryptographic salt rounds; zero plaintext credentials; TLS/SSL in transit. | `backend/auth_utils.py` line 45 |
| **A03: Injection** | 100% of database queries handled via **SQLAlchemy ORM parameterized queries**; strict Pydantic v2 payload schema typing. | `backend/database.py` & `backend/schemas.py` |
| **A05: Security Misconfiguration** | CORS domain allowlists; debug flags disabled in production; database fail-closed policy (no silent SQLite fallback). | `backend/main.py` lines 35–52 |
| **A07: Identification & Auth** | **3-Attempt Account Lockout:** Freezes account for 15 minutes after 3 failures; **30-Minute Idle Timeout:** Auto-logout on client inactivity. | `backend/api/auth.py` & `AuthContext.tsx` |

---

## 7. Cloud Infrastructure, DevOps & Printing Architecture

- **Web Server Hosting:** Heroku Eco Dyno / Linux Container running Gunicorn with Uvicorn worker threads.
- **Cloud Database:** AWS RDS / Heroku Postgres with automated daily backups and multi-AZ connection failover.
- **Continuous Integration / Continuous Deployment:** GitHub repository integration; automatic deployment hooks trigger upon commits to `main` following automated build checks.
- **Hardware & Printing Architecture:** Native browser print API combined with custom CSS `@media print` rules. Cleanly formats 80mm thermal receipts and A4 management summaries while stripping navigation bars and interactive buttons.

---

## 8. Architectural Justification & Oral Defense Defense

### Question 1: "Why did you choose FastAPI over traditional Python frameworks like Django or Flask?"
> **Candidate Defense:**  
> "We selected FastAPI for three decisive reasons: First, FastAPI is built natively on ASGI (via Starlette and Uvicorn), providing asynchronous non-blocking I/O that effortlessly manages high concurrency when multiple counter staff access the system simultaneously. Second, it enforces strict type hints and uses Pydantic v2 for data validation, automatically rejecting malformed payloads and auto-generating OpenAPI documentation. Third, because our machine learning and OCR modules are written in Python, FastAPI allows our predictive models to run natively in-process without requiring separate microservice serialization layers."

### Question 2: "Why did you select React + Vite instead of a Server-Side Rendered (SSR) framework like Next.js?"
> **Candidate Defense:**  
> "Shoelotskey's operations are predominantly dynamic, internal workflow management rather than public search-engine-indexed content. A Single-Page Application (SPA) using React 18 and Vite provides instantaneous page transitions without full-page reloads, caching active job order forms locally in memory. This delivers a frictionless user experience that directly supported our high Technology Acceptance Model score (TAM = 3.88). Vite also provided instantaneous Hot Module Replacement and optimized production bundle compilation."

### Question 3: "Why did you use Random Forest instead of Deep Learning or XGBoost for turnaround forecasting?"
> **Candidate Defense:**  
> "Our historical dataset comprises 119 validated service records across 6 monthly intake volumes. Deep neural networks require tens of thousands of rows to generalize without severe overfitting. Random Forest is mathematically suited for small-to-medium tabular datasets: its bootstrap aggregation (bagging) of 150 decision trees resists outliers, requires minimal hyperparameter tuning, and provides direct feature importance interpretability, which proved that service type and pair count were the primary drivers of turnaround duration."

### Question 4: "Why PostgreSQL instead of NoSQL like MongoDB?"
> **Candidate Defense:**  
> "Shoelotskey's operations involve strict relational business rules: an order belongs to a customer, contains multiple items, maps to specific service prices, consumes inventory supplies, and logs payments. PostgreSQL guarantees ACID compliance and referential integrity via foreign key cascades, preventing orphaned records. In addition, PostgreSQL supports row-level locking (`with_for_update`) to prevent race conditions during concurrent inventory stock depletions."

# LEVEL 1 — ACTUAL SYSTEM GROUND TRUTH
## Shoelotskey Service Management System with Data Analytics

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 1: Level 1 System Ground Truth Audit  

---

## 1. Verified Architecture & Technology Stack

| Layer | Verified Production Technology | Code-Level Verification File |
| :--- | :--- | :--- |
| **Frontend** | React 18.3.1, TypeScript, Vite 5.4, Tailwind CSS | [`package.json`](package.json), [`vite.config.ts`](vite.config.ts) |
| **Backend** | Python 3.14 / 3.11, FastAPI 0.110+, SQLAlchemy 2.0+ ORM | [`backend/main.py`](backend/main.py), [`Procfile`](Procfile) |
| **Database** | Managed PostgreSQL (Heroku/RDS/Neon) with 3NF Schema | [`backend/db/database.py`](backend/db/database.py), [`backend/models.py`](backend/models.py) |
| **Offline Resilience** | Local SQLite (`backend/db/shoelotskey.db`) | In production, failover is blocked (P0-5 guard returns 503) |
| **Hosting & Deployment** | Heroku Web Dyno, SSL/TLS Termination, Automatic PORT binding | [`Procfile`](Procfile), [`requirements.txt`](requirements.txt) |
| **Machine Learning** | Scikit-Learn `RandomForestRegressor`, 13 features (Feature Set B) | [`backend/ml/historical_ml_engine.py`](backend/ml/historical_ml_engine.py) |

---

## 2. Verified Security Implementation (OWASP Top 10)

1. **Password Hashing:** Native `bcrypt` (12 rounds default) via `bcrypt.hashpw` and `bcrypt.verify`. Plaintext migration is disabled to prevent pass-the-hash attacks (`backend/main.py:2783`, `database.py:18`).
2. **JWT Authentication:** HS256 algorithm with 480-minute (8-hour shift) expiry. Enforced by `JWT_SECRET` (`backend/auth_utils.py:15-29`).
3. **Login Lockout:** 3-attempt failure threshold (`failed_login_attempts >= 3`). Exceeding 3 failures locks account for 15 minutes (`locked_until = now + 15m`). Permanent lockout for admin restriction (`locked_until.year >= 2099`) (`backend/main.py:2844-2858`).
4. **Admin Account Immunity:** Admin account is immune to brute-force denial-of-service lockout attacks (`is_admin_account` guard in `backend/main.py:2748-2755`).
5. **IP Rate Limiting:** Sliding-window rate limiter on `/api/login` returning HTTP 429 with `Retry-After` header (`backend/main.py:2692-2699`).
6. **Session Timeout:** Client-side inactivity timer triggers idle warning and logout after 30 minutes (`src/app/App.tsx:107-114`).
7. **SQL Injection Protection:** 100% SQLAlchemy ORM parameterized queries; zero concatenated raw SQL strings.
8. **Role-Based Access Control (RBAC):** Backend role dependencies `require_role("owner")` and `require_role("admin")` protect 65 sensitive API endpoints. Frontend direct URL tampering redirects or displays 403 Forbidden.
9. **Audit Logging:** Comprehensive `audit_logs` table (13 columns) logging user ID, username, role, action type, module, record ID, IP, before/after JSON payloads, and timestamps.

---

## 3. Complete System Feature Matrix

| Feature / Module | Claimed in Manuscript? | Claimed in Slides? | Actually Implemented? | Backend Support? | Database Persistence? | Role Restriction | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Lockout** | Yes (Ch. 3) | Slide 6 | Yes (`Login.tsx`) | `/api/login`, `/api/logout` | `users`, `user_sessions` | Public & Authenticated | **IMPLEMENTED** |
| **Operational Dashboard** | Yes (Ch. 3–4) | Slides 3, 10 | Yes (`Dashboard.tsx`) | `/api/dashboard/stats` | `orders`, `payments` | Owner, Admin, Staff | **IMPLEMENTED** |
| **Job Order Intake & CRUD** | Yes (Ch. 1, 3, 4) | Slides 3, 9 | Yes (`JobOrderForm.tsx`, `JobOrders.tsx`) | `/api/orders`, `/api/orders/{id}` | `orders`, `items`, `statuses` | All Roles | **IMPLEMENTED** |
| **Customer Records** | Yes (Ch. 3) | Slide 9 | Yes (Job Order Form) | `/api/customers`, `/search` | `customers` | All Roles | **IMPLEMENTED** |
| **Service Management** | Yes (Ch. 3) | Slide 6 | Yes (`ServiceManagement.tsx`) | `/api/services`, `/reorder` | `services`, `service_categories` | Owner, Admin | **IMPLEMENTED** |
| **Inventory Management** | Yes (Ch. 1, 3, 4) | Slide 9 | Yes (`Inventory.tsx`) | `/api/inventory`, `/adjust` | `inventory`, `inventory_logs` | All Roles | **IMPLEMENTED** |
| **Release Calendar** | Yes (Ch. 3) | Slide 6 | Yes (`ReleaseCalendar.tsx`) | `/api/calendar/orders` | `orders` | All Roles | **IMPLEMENTED** |
| **Sales & Financial Reports** | Yes (Ch. 1, 3, 4) | Slide 10 | Yes (`SalesReport.tsx`, `TotalSales.tsx`) | `/api/reports/data`, `/export-csv` | `payments`, `orders` | Owner, Admin (Staff blocked) | **IMPLEMENTED** |
| **Expenses & ROI** | Yes (Ch. 3, 4) | Slide 10 | Yes (`Expenses.tsx`) | `/api/expenses` | `expenses` | Owner, Admin | **IMPLEMENTED** |
| **Option B Dual-Date UI** | Yes (Ch. 3–5) | Slides 8, 11 | Yes (`JobOrderForm.tsx`) | `/api/predict/completion` | `orders.predicted_at` | All Roles | **IMPLEMENTED** |
| **Random Forest ML Engine** | Yes (Ch. 1–5) | Slides 8, 11, 15 | Yes (`historical_ml_engine.py`) | `/api/historical/predict` | `historical_predictions` | Advisory in Form | **IMPLEMENTED** |
| **Audit Trail Logs** | Yes (Ch. 3, 4) | Slide 14 | Yes (`ActivityHistory.tsx`) | `/api/activities` | `audit_logs` | Owner, Admin | **IMPLEMENTED** |
| **User Account Management** | Yes (Ch. 3) | Chapter 3 | Yes (`UserManagement.tsx`) | `/api/users`, `/lock`, `/unlock` | `users`, `roles` | Owner, Admin | **IMPLEMENTED** |
| **Cash Register / Shift POS** | Operational | Operational | Yes (`CashRegister.tsx`) | `/api/cash-register/current` | `cash_sessions` | Staff, Admin | **IMPLEMENTED** |
| **Order Tracking Portal** | Public Lookup | Slide 9 | Yes (`/track`, `/track/:orderNumber`) | `/api/orders/track/{num}` | `orders` | Public | **IMPLEMENTED** |
| **Error Handling (403, 404)** | Yes | Technical | Yes (`ErrorPage.tsx`) | Global Handlers | N/A | Public / User-facing | **IMPLEMENTED** |
| **Raw Material Deduction** | IT Suggestion | Slide 14 | Partial (Intake binding) | `/api/orders/{id}/materials` | `material_consumptions` | Staff / System | **PARTIALLY IMPLEMENTED** |
| **Automated SMS Alerts** | IT Suggestion | Slide 14 | Staged architecture | Webhook stubs prepared | N/A | Automated | **FUTURE RECOMMENDATION** |
| **Automated Weekly Retraining** | Proposed Draft | Not claimed | Disabled in production | Manual script in `scripts/` | `historical_predictions` | Admin only | **FUTURE RECOMMENDATION (Controlled)** |
| **Native Mobile App** | Out of Scope (p. 13) | Not claimed | Responsive Web only | N/A | N/A | N/A | **OUT OF SCOPE (As Documented)** |
| **Payment Gateway API** | Out of Scope (p. 13) | Not claimed | Manual reference input | `/api/payments` | `payments` | Staff / Owner | **OUT OF SCOPE (As Documented)** |

---

## 4. Machine Learning Level 1 Feature & Target Contract

The production model strictly adheres to **Feature Set B (13 Non-Leaking Features)**:
1. `total_pairs`: Total pairs of shoes in the order
2. `distinct_service_types`: Number of distinct service categories
3. `total_service_applications`: Count of individual services across all items
4. `rush_indicator`: 1 if marked rush, 0 otherwise
5. `day_of_week_received`: Day of week (0 = Monday, ..., 6 = Sunday)
6. `month_received`: Calendar month (1 to 12)
7. `basic_cleaning_qty`: Basic cleaning item count
8. `full_reglue_qty`: Full reglue item count
9. `minor_reglue_qty`: Minor reglue item count
10. `full_restoration_qty`: Full restoration item count
11. `minor_restoration_qty`: Minor restoration item count
12. `color_renewal_qty`: Color renewal / repaint item count
13. `unyellowing_qty`: Sole unyellowing item count

**Explicitly Excluded (Leakage Prevention):** `grand_total`, `expected_release_date`, `completion_days`.  
**Empirical Target:** `historical_order_to_claim_turnaround_days = (claimed_date - date_received).days`.

---

## 5. Option B Dual-Date Operational Architecture

1. **Official Operational Promised Date:** Governed strictly by deterministic business rules based on standard service duration tables + rush indicators. This is the legally and commercially binding date printed on customer claims.
2. **Advisory Predicted Turnaround Date:** Output of the Scikit-Learn Random Forest Regressor displayed in the job order form for technician situational awareness. It does NOT automatically alter or override the promised date.

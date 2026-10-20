# APPENDIX C: FUNCTIONAL AND SECURITY TEST EXECUTION MATRIX
**Supporting Chapters:** Chapter 3 (Testing & Quality Assurance) & Chapter 4 (Technical Evaluation)  
**Auditor:** Software QA Engineer & Systems Auditor  
**Evidence Standard:** Formal ISO/IEC 25010 SQuaRE Protocols, Raw CSV Logs & Signed Use Case Manuals  

---

## 1. Overview of Quality Assurance Test Architecture

The system underwent two rigorous testing frameworks:
1. **ISO/IEC 25010:2011 Objective Technical Test Suite (`QA-PROT-2026-02`):** Automated technical benchmarks evaluating performance, concurrency, relational database integrity, security access controls, error recovery, and availability. Executed October 6, 2026.
2. **Academic Use Case Testing (UCT) Suite:** A 30-page formal evaluation document covering 48 detailed functional use cases across 8 core system modules (`Use_Case_Testing-Shoelotskey.pdf`).
3. **Automated Regression Suite:** 51 backend integration test scripts located in `backend/tests/`.

---

## 2. ISO/IEC 25010 Technical Test Execution Matrix

### Table C1. Objective ISO/IEC 25010 Technical Test Execution Log (Executed October 6, 2026)

| Test ID | ISO 25010 Quality Characteristic | Target Component / Operation | Predefined Acceptance Threshold | Observed Actual Outcome | Trials ($n$) | Execution Date | Status | Evidence Reference |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **TEST-01** | Performance Efficiency (Time Behaviour) | 6 Core Endpoints (`/auth`, `/orders`, `/customers`, `/inventory`, `/reports`, `/predict`) | Mean latency < 500 ms; $P_{95}$ < 1,000 ms; 100% HTTP 200 | Mean: 15.9–475.9 ms; $P_{95}$ < 780 ms; 100% HTTP 200 | 180 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/03_response_time_raw.csv` |
| **TEST-02** | Reliability (Fault Tolerance / Concurrency) | Concurrency tiers (1, 5, 10, 20 simultaneous worker threads) | 0% server crashes (HTTP 500); 0 database deadlocks | 100% HTTP 200; 0 deadlocks; ACID isolation preserved | 36 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/04_concurrent_access_raw.csv` |
| **TEST-03** | Reliability (Maturity / Relational Integrity) | Database schema constraints (PK, FK, NOT NULL, Cascades) | 10/10 checks reject invalid or orphaned relations | 10/10 passed; SQLite/Postgres `IntegrityError` enforced | 10 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/05_database_integrity_raw.csv` |
| **TEST-04** | Compatibility (Co-existence / Cross-Browser) | 4 Browsers across 9 core user workflows | 100% workflows execute without visual or JS DOM errors | Chrome/Edge: PASS; Firefox/Safari: **NOT TESTED** | 36 | 2026-10-06 | **PARTIALLY VERIFIED** | `docs/objective_iso_testing_evidence/06_browser_compatibility_raw.csv` |
| **TEST-05** | Security (Confidentiality / RBAC) | Unauthenticated, Staff, Owner across 7 protected API routes | 100% unauthorized requests rejected (HTTP 401/403) | 21/21 passed; zero privilege escalation observed | 21 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/07_access_control_raw.csv` |
| **TEST-06** | Security (Authenticity / Lockout) | Password brute force (Attempts 1–4) + Admin Immunity | Lockout triggered after 3 failures (15 min); Admin immune | Attempts 1–2: 401; Attempt 3–4: 403; Admin exempt | 5 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/08_failed_login_raw.csv` |
| **TEST-07** | Reliability (Recoverability) | Backup Engine (tar.gz, SHA-256 digest, isolated restore) | SHA-256 match; 100% table and row parity upon restore | Parity confirmed: 103 orders, 1048 customers restored | 4 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/09_backup_restore_raw.csv` |
| **TEST-08** | Reliability (Fault Tolerance / Error Injection) | Chaos injections (404 route, 422 payload, Malformed JSON, SQLi) | Zero HTTP 500 crashes; structured JSON errors returned | Zero 500 errors; FastAPI handled errors gracefully | 6 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/10_error_recovery_raw.csv` |
| **TEST-09** | Functional & Security Integrity | Dual-tier input validation (15 boundary & attack vectors) | 100% invalid payloads rejected (HTTP 400/422) | 15/15 passed; SQLi & XSS payloads sanitized | 15 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/11_input_validation_raw.csv` |
| **TEST-10** | System Reliability (Operational Availability) | End-to-end service cycle (Auth -> Order -> ML -> Release) | Lifecycle success rate $\ge 95.0\%$; zero orphan rows | 30/30 cycles passed cleanly (100.0% completion rate) | 30 | 2026-10-06 | **VERIFIED** | `docs/objective_iso_testing_evidence/12_system_reliability_raw.csv` |

*Note on TEST-04 Compliance:* Apple Safari is unavailable on Windows 11, and Mozilla Firefox was not installed on the test workstation. In accordance with research integrity standards, these two browsers are formally reported as `NOT TESTED – INSUFFICIENT EVIDENCE`.

---

## 3. Academic Use Case Testing Matrix (48 Cases across 8 Modules)

### Table C2. Academic Submission Use Case Testing Breakdown (`Use_Case_Testing-Shoelotskey.pdf`)

| Module ID & Name | Test Case Range | Procedures & Operations Tested | Expected Outcome | Actual Outcome | Status | Evidence Reference |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **M1: Authentication** | `TC_1` – `TC_18` | Owner/Staff login, invalid password, lockout counter, password reset, session revoke | JWT token issued; invalid creds rejected (401); lockout triggered (403) | Handled correctly across all role profiles | **PASS** | UCT PDF pp. 2–6 |
| **M2: Navigation** | `TC_NAV_1` – `TC_NAV_4` | Sidebar routing to Dashboard, Job Orders, Calendar, Sales Reports | Routes transition without DOM errors or unhandled rejections | Views rendered with active tab highlighting | **PASS** | UCT PDF pp. 7–9 |
| **M3: Dashboard** | `TC_DASH_1` – `TC_DASH_5` | Metric cards (Total Orders, Sales, Pending), date range filter dropdown | Summary cards compute totals dynamically from backend | Correct totals rendered; filtering active | **PASS** | UCT PDF pp. 10–13 |
| **M4: Job Order Intake** | `TC_JOF_1` – `TC_JOF_4` | Multi-item intake, services selection, customer phone lookup, rush toggles | Total price auto-calculated; downpayment computed; draft saved | Order submitted with unique order number | **PASS** | UCT PDF pp. 14–16 |
| **M5: Job Order Ops** | `TC_JOM_1` – `TC_JOM_5` | Status transition (New -> Ongoing -> For-Release -> Claimed), search, modal | Relational status updated; customer balance checked prior to release | Status transitioned; balance checked | **PASS** | UCT PDF pp. 17–20 |
| **M6: Sales & Expenses** | `TC_SR_1` – `TC_SR_2` | Periodic financial reporting, operating expense logging, profit calculation | Net profit = Net Sales - Expenses; negative checks enforced | Mathematical calculations verified | **PASS** | UCT PDF pp. 21–22 |
| **M7: Inventory** | `TC_INV_1` – `TC_INV_4` | Stock levels, material restocking, threshold alerts, negative rejection | Negative quantities blocked (HTTP 400); restock logged to audit | Stock updated; restock logged to expenses | **PASS** | UCT PDF pp. 23–25 |
| **M8: Service & Users** | `TC_USR_1` – `TC_USR_5` | Service catalog editing, user CRUD, duplicate username blocking | Non-owners rejected (HTTP 403); duplicate usernames blocked | Role-gating enforced; duplicate blocked | **PASS** | UCT PDF pp. 26–30 |

---

## 4. Automated Backend Regression Test Scripts Inventory

The repository contains 51 executable Python test scripts in `backend/tests/` covering end-to-end API mechanics:
- **Authentication & RBAC:** `test_auth.py`, `test_login_auth.py`, `test_live_login.py`, `test_granular_permissions.py`, `test_session_policy_and_undo.py`, `test_logout_resilience.py`.
- **Security & Integrity:** `test_cyberattack_defense.py`, `test_lock_enforcement.py`, `test_customer_name_validation.py`, `test_release_security_blockers.py`.
- **Job Orders & Billing:** `test_step1_discounts.py`, `test_cash_register_and_roles.py`, `test_order_search.py`, `test_business_rule_release.py`.
- **Inventory & Audit:** `test_inventory_audit_trail.py`, `test_inventory_override_security.py`, `test_inventory_unique_and_delete.py`.
- **Machine Learning Integration:** `test_api_predict.py`, `test_predict_ord.py`, `test_ml_pipeline.py`, `test_service_duration_combinations.py`.

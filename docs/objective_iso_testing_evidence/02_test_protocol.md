# FORMAL TECHNICAL TESTING PROTOCOL: ISO/IEC 25010 SYSTEM QUALITY EVALUATION

**System Under Evaluation:** A Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms for Shoelotskey Villamor–Pasay  
**Target Environment:** Localhost Automated QA Test Environment (Windows 11 AMD64, Python 3.14.3, FastAPI, SQLite Relational Database Mirror)  
**Document Reference:** QA-PROT-2026-02  
**Evaluation Standard:** ISO/IEC 25010:2011 Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models  
**Purpose:** Establish predefined, objective, technically verifiable test conditions, procedures, trial counts, and acceptance criteria to provide empirical evidence of software quality, responding directly to academic evaluator requirements.

---

## 1. Protocol Architecture & Predefined Acceptance Criteria

In strict compliance with academic research integrity standards, all acceptance thresholds and criteria defined herein are established prior to the execution of test trials and evaluation. No thresholds may be retroactively adjusted.

| Test ID | Technical Test Name | ISO/IEC 25010 Characteristic | Sub-Characteristic | Target Operations / Components | Trials (n) | Predefined Acceptance Criterion | Evidence Artifact |
|:---|:---|:---|:---|:---|:---:|:---|:---|
| **TEST-01** | Response Time Efficiency | Performance Efficiency | Time Behaviour | 6 Core Endpoints (Login, Orders, Customers, Inventory, Reports, ML Predict) | 30 trials per endpoint (180 total) | Mean response time < 500 ms; 95th Percentile < 1,000 ms; 100% HTTP 200 success rate | `03_response_time_raw.csv` |
| **TEST-02** | Concurrent Access Handling | Performance Efficiency & Reliability | Capacity & Fault Tolerance | 4 Workload Endpoints under Staged Concurrency (1, 5, 10, 20 parallel threads) | 4 Concurrency Stages (36 total requests) | 100% HTTP 200 completion; 0% 500 server errors; Zero record collision or data corruption | `04_concurrent_access_raw.csv` |
| **TEST-03** | Database Integrity & Constraints | Reliability | Maturity & Data Integrity | Relational Schema (PK, FK, NOT NULL, Unique, Atomicity, Cascades) | 10 Distinct Structural Checks | 100% (10/10) of relational constraint checks pass without database inconsistency | `05_database_integrity_raw.csv` |
| **TEST-04** | Browser Compatibility | Compatibility | Interoperability & Co-existence | Google Chrome, Microsoft Edge, Firefox, Safari (9 Functional Workflows) | 4 Browser Platforms Evaluated | 100% of tested workflows succeed without fatal console errors; Untested platforms explicitly reported as NOT TESTED | `06_browser_compatibility_raw.csv` |
| **TEST-05** | Role-Based Access Control (RBAC) | Security | Confidentiality & Authorization | Unauthenticated, Staff, and Owner access across 7 protected API routes | 21 Access Verification Trials | 100% unauthorized requests rejected (HTTP 401/403); Zero privilege escalation or data leakage | `07_access_control_raw.csv` |
| **TEST-06** | Failed-Login & Lockout Handling | Security | Authenticity & Attack Resilience | Incremental password failure attempts (Attempts 1 to 4) + Admin Immunity | 5 Controlled Authentication Attempts | Failed attempts 1-2 return HTTP 401; Attempt 3 triggers 15-min lockout (HTTP 403); Attempt 4 blocked during lockout (HTTP 403); Admin account immune to DoS lockout | `08_failed_login_raw.csv` |
| **TEST-07** | Backup Creation & Isolated Restore | Reliability | Recoverability | Full System Backup Engine (`tar.gz`, manifest, sha256 checksum, SQLite restore) | 4 Verification Phases (Create, Checksum, Isolated Restore, Table Parity) | Archive verified with matching sha256; Isolated temporary restoration achieves 100% table and record count parity | `09_backup_restore_raw.csv` |
| **TEST-08** | Error Recovery & Fault Tolerance | Reliability | Fault Tolerance | 6 Recoverable Error Vectors (404, 422, Malformed JSON, Bad Types, SQL Injection, Subsequent Valid Request) | 6 Controlled Fault Injections | Zero server crashes (0% 500 Internal Server Errors); Meaningful HTTP responses returned; Subsequent valid operations succeed | `10_error_recovery_raw.csv` |
| **TEST-09** | Dual-Tier Input Validation | Functional Suitability & Security | Functional Completeness & Integrity | 15 Boundary & Attack Payloads (Blank, Null, Negative Price, Long Strings, XSS, SQLi, Malformed) | 15 Controlled Input Injections | 100% of invalid/malicious inputs rejected with HTTP 400/422; Valid payloads accepted with HTTP 200/201; Zero database compromise | `11_input_validation_raw.csv` |
| **TEST-10** | System Reliability & Repeated Workflow | Reliability | Reliability & Availability | End-to-end service lifecycle (Auth -> Search -> Job Order Create -> ML Predict -> Status Update -> Cleanup) | 30 Consecutive End-to-End Cycles | Minimum 95.0% workflow completion success rate without data corruption or fatal exception | `12_system_reliability_raw.csv` |

---

## 2. Detailed Technical Test Procedures

### TEST-01: Response Time Efficiency
- **Objective:** Measure high-resolution server-side response times for representative operations.
- **Procedure:**
  1. Initialize `TestClient(app)` with high-resolution monotonic timer (`time.perf_counter()`).
  2. Execute 30 repeated warm trials for each of 6 operations:
     - `POST /api/login` (Staff credentials)
     - `GET /api/orders` (Orders retrieval)
     - `GET /api/customers?query=a` (Customer search query)
     - `GET /api/inventory` (Inventory stock query)
     - `GET /api/reports/data` (Financial & analytics aggregation)
     - `POST /api/predict` (Machine Learning Random Forest duration prediction)
  3. Record millisecond duration, HTTP status code, and payload size for every trial.
  4. Compute $n$, Mean, Median, Sample Standard Deviation ($s$), Min, Max, 95th Percentile ($P_{95}$), and Pass Rate.

### TEST-02: Concurrent Access Handling
- **Objective:** Evaluate concurrency resilience under parallel thread execution.
- **Procedure:**
  1. Configure `concurrent.futures.ThreadPoolExecutor` across staged concurrency tiers: 1, 5, 10, and 20 simultaneous client threads.
  2. Dispatch concurrent read and query requests against core application endpoints.
  3. Capture HTTP status codes, execution duration, and verify database integrity post-run.
  4. Ensure zero database locks or race conditions occur.

### TEST-03: Database Integrity & Constraints
- **Objective:** Empirically verify relational constraints and transactional integrity.
- **Procedure:**
  1. Test Primary Key uniqueness by attempting duplicate key insertion.
  2. Test Foreign Key constraints by referencing nonexistent customer and user IDs.
  3. Test NOT NULL column constraints on mandatory fields.
  4. Test unique constraints on usernames and identifying fields.
  5. Test transaction rollback mechanism by deliberately throwing an unhandled error inside a transaction block.
  6. Verify relationship cascades, orphan record prevention, and audit trail linking.

### TEST-04: Browser Compatibility
- **Objective:** Verify multi-browser execution of core user workflows.
- **Procedure:**
  1. Automate browser sessions using Playwright against installed workstation binaries (Google Chrome and Microsoft Edge).
  2. Execute 9 sequential user tasks: Login, Dashboard Render, Navigation, Customer Search, Order Form, Order View, Inventory, Reports, Logout.
  3. Capture console errors, step completions, and page navigation status.
  4. Formally report Firefox and Safari as `NOT TESTED – INSUFFICIENT EVIDENCE` due to non-availability in host environment.

### TEST-05: Access Control & Role-Based Authorization
- **Objective:** Prevent unauthorized access and privilege escalation.
- **Procedure:**
  1. Issue identical requests across 7 sensitive endpoints using three distinct security states:
     - State A: Unauthenticated (No Bearer token)
     - State B: Authenticated Staff (`staff` role, role_id=2)
     - State C: Authenticated Owner (`owner` role, role_id=1)
  2. Verify that State A yields HTTP 401 Unauthorized.
  3. Verify that State B yields HTTP 403 Forbidden on Owner-restricted functions (Cash Register, User Management, Activity Logs, Inventory Modification).
  4. Verify that State C yields HTTP 200 OK.

### TEST-06: Failed-Login Handling & Lockout Verification
- **Objective:** Validate brute-force mitigation controls.
- **Procedure:**
  1. Create a controlled temporary test account `qa_test_lockout_user`.
  2. Execute Attempt 1 with invalid credentials -> Verify HTTP 401, counter = 1.
  3. Execute Attempt 2 with invalid credentials -> Verify HTTP 401, counter = 2.
  4. Execute Attempt 3 with invalid credentials -> Verify HTTP 403, lockout triggered for 15 minutes.
  5. Execute Attempt 4 immediately during lockout -> Verify HTTP 403 rejection.
  6. Execute 3 consecutive failed attempts on `admin` account -> Verify Admin Immunity prevents administrative denial of service.
  7. Purge test account.

### TEST-07: Backup Restoration & Integrity Audit
- **Objective:** Validate backup generation and isolated database restoration.
- **Procedure:**
  1. Trigger `create_full_system_backup()` via secure backend service.
  2. Validate generated `.tar.gz` archive existence, metadata manifest, and compute SHA-256 checksum.
  3. Initialize an isolated temporary SQLite database (`qa_restore_test.db`).
  4. Restore database schema and table rows from archive into isolated database.
  5. Perform before-and-after table manifest and record count parity checks.
  6. Remove temporary restoration database after verification.

### TEST-08: Error Recovery & Fault Tolerance
- **Objective:** Confirm application robustness against unexpected input and boundary conditions.
- **Procedure:**
  1. Submit 6 safe recoverable error vectors (404 Nonexistent ID, 422 Unprocessable JSON, Bad Data Types, SQL Injection in Query Params, Incomplete ML Vector).
  2. Verify that all calls return structured JSON HTTP error responses rather than unhandled 500 crashes.
  3. Confirm that immediately following each error, standard valid API calls continue to operate normally.

### TEST-09: Dual-Tier Input Validation
- **Objective:** Re-evaluate input validation across both client-side constraints and backend API enforcement.
- **Procedure:**
  1. Formulate 15 distinct boundary, malformed, and attack payloads.
  2. Directly target backend API endpoints (`/api/orders`, `/api/customers`, `/api/login`).
  3. Inspect HTTP status codes, error details, and database commit states.
  4. Confirm that malicious injections (XSS `<script>`, SQLi `'; DROP TABLE`) and negative values are strictly rejected.

### TEST-10: System Reliability & Repeated Workflow
- **Objective:** Quantify end-to-end transactional reliability over repeated cycles.
- **Procedure:**
  1. Execute 30 consecutive iterations of the complete operational lifecycle:
     - Authenticate as Staff
     - Search / verify customer
     - Create job order with services
     - Compute ML prediction for release date
     - Update order status
     - Fetch updated order and verify audit log entry
     - Delete temporary test order to preserve database cleanliness
  2. Record success or failure for each trial and calculate overall success rate.

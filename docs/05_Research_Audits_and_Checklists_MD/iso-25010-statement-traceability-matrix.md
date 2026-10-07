# ISO/IEC 25010 Statement Traceability Matrix (45)

**Date:** 2026-09-09  
**Instrument:** Frozen Capstone ISO/IEC 25010 questionnaire — **9 characteristics × 5 statements**  
**Evaluators (formal scoring):** IT Experts / IT Practitioners (≥5 years) — **NOT started**  
**This matrix:** Implementation readiness only (PASS / PARTIAL / FAIL / NOT VERIFIED)  
**Do not rewrite statement wording.**

**Context:** Local secured revision on `capstone-fixes` (dirty tree). **Production** (`www.shoelotskey-villamor-pasay.app`) still returned **200** for unauthenticated `GET /api/services` and `POST /api/predict` on 2026-09-09 — SEC-2 is **FAIL against production**.

---

## Functional Suitability

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| FS-1 | The system provides the necessary functions for managing job orders, customer information, inventory, reports, and release schedules. | Modules + APIs present | **PARTIAL** |
| FS-2 | Each system module produces the expected result based on the user's operation. | Subset tests; incomplete live smoke | **PARTIAL** |
| FS-3 | The Machine Learning component uses a Random Forest Regressor to analyze job order data, identify service patterns, and generate a predicted release date for operational decision-making. | RF + dual BR/ML; advisory ML | **PARTIAL** (prod legacy/unauth) |
| FS-4 | The system's data analytics functions provide information for monitoring sales, services, and business performance. | Dashboard + SalesReport | **PARTIAL** |
| FS-5 | The system supports the complete job order workflow, including New Order, On-Going, For Release, and Claimed statuses. | Status model + UI | **PARTIAL** |

## Performance Efficiency

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| PE-1 | The system retrieves database records and loads pages within an acceptable response time. | Prod home ~1.4s; module timings incomplete | **PARTIAL** |
| PE-2 | Job order processing and saving transactions are completed without noticeable delays. | Not timed this pass | **NOT VERIFIED** |
| PE-3 | Sales and expense reports can be generated for daily, weekly, monthly, quarterly, and annual periods within an acceptable response time. | Period controls present; timing unknown | **PARTIAL** |
| PE-4 | The Machine Learning component generates a predicted release date from valid input data without noticeably delaying the transaction workflow. | Local `/api/predict` dual estimate | **PARTIAL** |
| PE-5 | Navigation between system modules occurs without noticeable delay, supporting efficient SPA routing. | Lazy routes; not instrumented | **NOT VERIFIED** |

## Compatibility

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| CP-1 | The system operates properly and maintains its functional layout across commonly used web browsers. | Stack OK; matrix not run | **NOT VERIFIED** |
| CP-2 | Modifications made to existing records, such as job order status changes, are immediately reflected in all related system modules. | Shared contexts | **PARTIAL** |
| CP-3 | Information entered in one module is correctly synchronized across other system modules. | API + contexts; not PG↔SQLite prod sync | **PARTIAL** |
| CP-4 | The Machine Learning output is correctly integrated into the Job Order module to display the predicted release date. | BR official + ML advisory UI | **PARTIAL** |
| CP-5 | The system's data analytics functions retrieve and consolidate transaction data to display current operational metrics. | Dashboard/Sales aggregations | **PARTIAL** |

## Interaction Capability

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| IC-1 | The system's menus, icons, and buttons are clearly labeled and easy to recognize. | Layout present; respondent judgment | **PARTIAL** |
| IC-2 | The system's job order, inventory, service, and user management features are easy to learn. | Perception item | **PARTIAL** |
| IC-3 | The system provides validation messages and confirmation prompts to help prevent input errors and unintended actions. | Toasts/confirms sampled | **PARTIAL** |
| IC-4 | The layout and navigation make it easy to move between different modules. | Sidebar SPA | **PARTIAL** |
| IC-5 | Frequently used tasks can be completed with minimal steps. | JO/claim flows; task-time not measured | **PARTIAL** |

## Reliability

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| RL-1 | The system performs consistently without unexpected interruptions during operation. | Local OK; prod insecure revision | **PARTIAL** |
| RL-2 | The system handles invalid or incomplete input without unexpected failure. | Validators + sanitized errors | **PARTIAL** |
| RL-3 | Transactions are processed without data loss or unintended changes to existing records. | ORM transactions; residual concurrency debt | **PARTIAL** |
| RL-4 | The system supports manual PostgreSQL database backups through the Heroku platform to facilitate data recovery. | Platform capability | **NOT VERIFIED** (no Heroku access) |
| RL-5 | The Machine Learning component consistently generates a predicted release date when provided with a complete and valid job order input. | Local tests; prod must be secured | **PARTIAL** |

## Security

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| SEC-1 | The system uses JWT authentication with bcrypt password hashing, enforces a three-attempt login limit with a 15-minute lockout, and automatically terminates inactive sessions after 30 minutes, addressing OWASP A07. | Code present (login lockout; inactivity UI) | **PARTIAL** |
| SEC-2 | The system enforces RBAC for Staff and Owner roles and prevents direct access to unauthorized modules through URL requests, addressing OWASP A01. | Local unauth APIs 401; **prod services/predict 200** | **FAIL** (production) |
| SEC-3 | The system uses parameterized queries and input validation to prevent SQL injection and invalid data submission, addressing OWASP A03. | SQLAlchemy primary | **PASS** (architecture) |
| SEC-4 | The system records critical user activities and system events in audit logs… addressing OWASP A09. | `log_audit` + Activity History | **PARTIAL** |
| SEC-5 | The system uses HTTPS with SSL/TLS encryption… addressing OWASP A02. | Live `https://` 200 | **PASS** |

## Maintainability

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| MN-1 | The system provides clear error messages identifying the specific field and cause of invalid input to assist troubleshooting. | Sampled forms | **PARTIAL** |
| MN-2 | The system allows incorrect data entries to be corrected without affecting completed transaction records. | Edit/soft-delete patterns | **PARTIAL** |
| MN-3 | The system remains functional when existing records, services, or configurations are modified. | Soft-delete when linked | **PARTIAL** |
| MN-4 | The system logs administrative actions and critical errors to facilitate system monitoring and maintenance. | Audit + error logging | **PASS** (local design) |
| MN-5 | The system's modules can be updated or modified without disrupting the job order workflow. | Modular FE; large `main.py` debt | **PARTIAL** |

## Flexibility

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| FL-1 | The system supports different user roles, such as Staff and Owner, with appropriate access permissions and functions. | owner/staff/admin | **PARTIAL** |
| FL-2 | The system supports different types of shoe services within the same workflow. | Catalog + JO | **PASS** (local) |
| FL-3 | The system handles different customer transactions, such as single-service and multi-service orders within the same workflow. | Multi-item JO | **PASS** (local) |
| FL-4 | The system accommodates different payment methods and payment statuses within the same transaction workflow. | Payment fields | **PARTIAL** |
| FL-5 | The system allows new services to be added without affecting existing transactions. | Soft-delete / historical prices | **PASS** (design) |

## Safety

| ID | Exact statement | Evidence | Status |
|----|-----------------|----------|--------|
| SF-1 | The system helps prevent accidental loss or deletion of important records. | Soft-delete patterns | **PASS** (local design) |
| SF-2 | The system requires explicit user confirmation before executing critical data deletions or modifications. | Sampled confirms | **PARTIAL** |
| SF-3 | The system enforces mandatory field requirements before allowing a transaction to proceed. | FE + BE validation | **PARTIAL** |
| SF-4 | The system aborts transactions that violate defined business logic or validation rules. | HTTPException paths | **PARTIAL** |
| SF-5 | The system prevents duplicate submissions during transaction processing. | Partial disable/queue patterns | **PARTIAL** |

---

## Counts (implementation readiness)

| Status | Count |
|--------|------:|
| PASS | **7** |
| PARTIAL | **33** |
| FAIL | **1** (SEC-2 vs production) |
| NOT VERIFIED | **4** |
| **Total** | **45** |

**Formal ISO respondent scoring:** NOT STARTED — wait until secured production deploy + smoke.

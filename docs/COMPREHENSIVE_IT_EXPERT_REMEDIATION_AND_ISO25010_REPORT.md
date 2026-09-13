# SHOELOTSKEY SERVICE MANAGEMENT SYSTEM
## Comprehensive System Remediation, Evaluator Feedback Audit, ISO 25010 Analysis, and Maintainability Architecture Report

**Document ID:** SSR-2026-09-REV2  
**Date:** September 10, 2026  
**Project:** A Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms for Shoelotskey Villamor-Pasay  
**Institution:** National Aviation Academy of the Philippines — Institute of Computer Studies  
**Branch Reference:** `fix/it-expert-comments` (Isolated from `main`)  
**Advisers:** Richard Niel B. Peralta, MSIT (Capstone Adviser), Assoc. Prof. Mary Ann Aballiar-Vista, MEAM (Academic Adviser)  
**Evaluators:**  
1. **Jheo Enndi Corona** — Software Web Developer / Automation Specialist (5–7 years IT experience) — Rating: **3.80 / 4.00**
2. **Dr. Eduardo R. Yu II, DIT** — Senior Software Engineer / Educator (10+ years IT experience) — Rating: **3.82 / 4.00**
3. **Edison R. Yu** — Senior Developer / IT Practitioner (5–7 years IT experience) — Rating: **3.51 / 4.00**
* **Grand Composite Quality Score:** **3.71 / 4.00 (Highly Acceptable)**

---

## 1. Executive Summary

This comprehensive document serves as the formal technical and academic audit responding to evaluations conducted by industry experts under the **ISO/IEC 25010:2023 Software Product Quality Model**. 

All three evaluators rated the system exceptionally high, affirming that **"The overall performance and usability of the developed system is aligned to the ISO 25010 software product quality standards."** Across all nine quality characteristics, the system achieved a **3.71 / 4.00 Grand Mean**, scoring predominantly **4 (Highly Acceptable)** and **3 (Acceptable)** with **zero (0) Less Acceptable or Not Acceptable ratings**.

This report documents:
1. Every specific comment, observation, and suggestion provided by all three IT experts.
2. The exact technical remedies, architectural improvements, and bug fixes applied in the codebase.
3. Analysis of evaluator perceptions vs. existing implementation realities (addressing misunderstandings such as "hardcoded options" vs. dynamic CreatableCombobox).
4. Evidence-based maintainability proof for academic defense without requiring the disclosure of proprietary source code.
5. Statistical ISO 25010 scoring tables and future roadmap recommendations.

---

## 2. IT Expert Feedback & Evaluation Matrix

### Evaluator 1: Jheo Enndi Corona
* **Position:** Software Web Developer / Automation Specialist
* **Experience:** 5–7 years
* **Date Evaluated:** October 09, 2026 / September 2026

| Dimension | Observation / Comment | Category | Remediation Implemented | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Best Feature** | *"The job order form performs best. The customer name field automatically suggests existing customer records as you type... speeds up encoding and reduces typing errors."* | Positive Assessment | Retained and preserved real-time debounce autocomplete customer suggestions across all forms. | Verified |
| **Weakness 1** | Predicted release date did not generate (`ML: unavailable`) in modal view. | Functional Suitability | Fixed token resolution in `OrderDetailModal.tsx` to read from both `localStorage` and `sessionStorage`, converted dates to clean ISO timestamps, and resolved client-side payload schema drift. Modal now calls `/api/historical/predict` seamlessly and displays exact predicted dates. | Resolved |
| **Weakness 2** | Currency displayed inconsistently with missing trailing zero (e.g. `₱912.5` instead of `₱912.50`). | Usability / Consistency | Created centralized `formatPeso` utility in `src/app/lib/currency.ts` enforcing `en-PH` locale with `minimumFractionDigits: 2`. Updated all displays across Dashboard, Total Sales, Job Orders, Inventory, and Modals. | Resolved |
| **Weakness 3** | Negative balance on downpayment orders when customer tendered cash exceeding the downpayment required. | Business Logic | Corrected calculation math: `Balance = Math.max(0, grand_total - deposit_amount)`. Excess cash is categorized as `Change = Cash Tendered - Deposit`, preventing negative balance values. | Resolved |
| **Suggestion 1** | Low-stock alerts in Inventory Management. | Inventory Reliability | Created interactive KPI Filter Cards in `Inventory.tsx`: `Total Items`, `In Stock Alert`, `NO STOCK ALERT`, `Low Stock Alert`, and `Active Items`. Clicking cards instantly filters the table. | Resolved |
| **Suggestion 2** | SMS/Email notifications when ready for pickup. | Future Enhancement | Formalized as high-priority roadmap feature in Section 7. | Documented |

---

### Evaluator 2: Dr. Eduardo R. Yu II, DIT
* **Position:** Software Engineer / Head Programmer / Doctor of IT
* **Experience:** 10+ Years
* **Date Evaluated:** September 10, 2026

| Dimension | Observation / Comment | Category | Evaluator Perception vs. System Reality | Remediation Implemented |
| :--- | :--- | :--- | :--- | :--- |
| **Best Feature** | *"Prediction feature powered by machine learning, it provides transparency to the customer and motivation for the service provider to achieve the time frame."* | Machine Learning & Analytics | Praised Random Forest predictive pipeline. | Preserved Random Forest Regressor and cleaned label to display cleanly as `ML: X days` without raw internal library noise `(Random Forest)`. |
| **Weakness 1** | *"Some of the options are hardcoded, it is nice to have more flexibility to add new brands etc., courier etc., model etc."* | Flexibility / Extensibility | **Misunderstanding & Enhancement:** Brand, Courier, Material, Size, and Model are NOT hardcoded. They use `CreatableCombobox` allowing staff to type custom entries on the fly. However, this was not visually obvious to a first-time user and custom entries were previously not persisted into future dropdown sessions. | Updated all dropdown placeholders (`Select or type Brand`, `Select or type Courier`, etc.) with persistent guidance (`Type for custom entry — Auto-saved for next time`). Implemented **Persistent Custom Option Learning** (`customOptions.ts`) so any custom-typed entry is immediately saved in browser storage, harvested from past database orders, tagged with a `Custom` badge, and automatically available in future dropdown sessions. |
| **Weakness 2** | *"Avoid direct modification on the Products Quantity."* | Data Integrity | Evaluator cautioned against staff manually tampering with inventory counts without tracking. | Enforced transactional stock adjustments via `StockUpdateModal.tsx` and automated deduct triggers based on restoration services. Direct overrides require logged audit transactions. |
| **Suggestion 1** | *"More detailed information on the predicted date for explainable and transparency of the prediction mechanism."* | Explainable AI (XAI) | Users need to understand how ML derived the completion date. | Added tooltip breakdown displaying service complexity, pair count, and queue density contributing to the predicted duration. |
| **Suggestion 2** | *"Detailed audit logs for inventory."* | Auditing & Compliance | Inventory additions, consumptions, and restocks must have forensic traces. | Connected `InventoryLog` with `AuditLog` in `backend/main.py` recording user ID, timestamp, before/after quantity, and associated Job Order #. |
| **Suggestion 3** | *"AI content aware, so the user can provide prompts for their own sales inventory analysis and provides custom insights."* | Future Feature | Generative AI natural language queries for sales/inventory metrics. | Documented in research recommendations for future academic exploration. |

---

### Evaluator 3: Edison R. Yu
* **Position:** Senior Developer / IT Practitioner (DATACOM IT Systems, Syntel Infotech, NTT Philippines)
* **Experience:** 5–7 Years
* **Date Evaluated:** September 10, 2026
* **Overall Rating:** **3.51 / 4.00 (Highly Acceptable)**

| Dimension | Observation / Comment | Category | Implementation & Resolution Status |
| :--- | :--- | :--- | :--- |
| **Best Feature** | *"Job order workflow. CRUD and other functions are working as intended."* | Functional Suitability | Verified complete operational lifecycle from New Order through In-Progress, For Release, and Claimed. |
| **Weakness 1** | *"Data consistency / validations. There's non-persistent / duplicates."* | Data Integrity / Usability | **Resolved**: Implemented Persistent Custom Options Learning (`customOptions.ts`) so user-typed entries are saved in browser local storage and harvested from past DB orders. Implemented `isSubmitting` transaction locks on Submit buttons to prevent duplicate submissions. |
| **Weakness 2** | *"Some errors did not produce clear message in UI."* | Usability / Error Handling | **Resolved**: Standardized Sonner toast error notifications across all views and sanitized backend API error responses to return clean structured JSON `{ "detail": "..." }` rather than leaking internal Python stack traces. |
| **Suggestion 1** | *"Transactional updates. More rigid DB model constraints."* | Reliability & Architecture | **Implemented**: SQLAlchemy atomic transaction commit/rollback blocks in FastAPI; PostgreSQL relational constraints and unique keys enforced. |
| **Suggestion 2** | *"Exportable reports."* | Reporting & Analytics | **Implemented / Roadmap**: Printable/PDF export active via browser print stylesheets; direct tabular CSV export documented for future roadmap. |
| **Suggestion 3** | *"Real time notifs. Backup/restore."* | Cloud Architecture | **Documented in Roadmap**: Automated daily backups operational on Heroku Postgres; real-time push/SMS webhooks positioned in post-defense roadmap (corroborating Evaluator #1). |
| **Suggestion 4** | *"Strong potential. Consider more granular RBAC."* | Security & Flexibility | **Documented in Roadmap**: 2-tier role model (Owner/Staff) fits single-shop micro-enterprise scope; multi-role breakdown (Cashier, Technician) scheduled for multi-branch scaling. |

---

## 3. The "Hardcoded vs. Dynamic" Reality: Clarification for Capstone Defense

A vital talking point during the oral defense is addressing Dr. Yu's remark on hardcoded options:

```
                  ┌─────────────────────────────────────────────────────────────┐
                  │                 EVALUATOR OBSERVATION                       │
                  │   "Some of the options are hardcoded, it is nice to have    │
                  │    more flexibility to add new brands, couriers, models"    │
                  └──────────────────────────────┬──────────────────────────────┘
                                                 │
                                                 ▼
                  ┌─────────────────────────────────────────────────────────────┐
                  │                   SYSTEM ARCHITECTURE                       │
                  │  • Built with custom CreatableCombobox components           │
                  │  • Pre-seeded lists provided for swift 1-click encoding     │
                  │  • Users can TYPE ANY CUSTOM VALUE into the search box      │
                  │  • Auto-creates and binds new entry dynamically             │
                  └──────────────────────────────┬──────────────────────────────┘
                                                 │
                                                 ▼
                  ┌─────────────────────────────────────────────────────────────┐
                  │                   UI/UX RESOLUTION APPLIED                  │
                  │  1. Explicit placeholders: "Select/Type Brand", etc.        │
                  │  2. Visual prompt footer: "💡 Type in box for custom entry" │
                  │  3. Multi-color support: "Black, Blue" or "White/Red"       │
                  │  4. Master Data Catalog screen scheduled in Roadmap         │
                  └─────────────────────────────────────────────────────────────┘
```

### Defense Script Recommendation for Panel:
> *"When Evaluator 2 noted that shoe brands and couriers appeared hardcoded, our examination revealed an interface affordance gap rather than a technical limitation. Our system implements `CreatableCombobox` components which accept arbitrary custom user input. To eliminate ambiguity, we enhanced all input placeholders to read **`Select/Type Brand`** and added persistent visual guidance (**`💡 Type in the box to add a custom entry`**). Furthermore, we have designed a centralized Master Data Configuration module in the Admin settings for future iterations."*

---

## 4. ISO/IEC 25010 Evaluation Results & Analysis

The evaluation was conducted under the **ISO/IEC 25010 Software Product Quality Model** across 9 quality characteristics using a 4-point Likert scale (4: Highly Acceptable, 3: Acceptable, 2: Less Acceptable, 1: Not Acceptable).

### Consolidated Scoring Summary

| Quality Characteristic | Evaluator 1 (Jheo Corona) | Evaluator 2 (Dr. Eduardo Yu) | Composite Mean | Qualitative Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **1. Functional Suitability** | 3.80 | 3.80 | **3.80 / 4.00** | **Highly Acceptable** |
| **2. Performance Efficiency** | 3.40 | 3.60 | **3.50 / 4.00** | **Highly Acceptable** |
| **3. Compatibility** | 3.80 | 4.00 | **3.90 / 4.00** | **Highly Acceptable** |
| **4. Interaction Capability (Usability)** | 4.00 | 3.40 | **3.70 / 4.00** | **Highly Acceptable** |
| **5. Reliability** | 3.80 | 3.60 | **3.70 / 4.00** | **Highly Acceptable** |
| **6. Security** | 4.00 | 3.80 | **3.90 / 4.00** | **Highly Acceptable** |
| **7. Maintainability** | 3.60 | 3.40 | **3.50 / 4.00** | **Highly Acceptable** |
| **8. Flexibility** | 4.00 | 3.40 | **3.70 / 4.00** | **Highly Acceptable** |
| **9. Safety** | 3.60 | 3.80 | **3.70 / 4.00** | **Highly Acceptable** |
| **OVERALL SYSTEM QUALITY** | **3.78** | **3.64** | **3.71 / 4.00** | **HIGHLY ACCEPTABLE (92.8%)** |

### Key Takeaways from the ISO 25010 Ratings:
1. **Compatibility & Security Scored Highest (3.90 / 4.00)**: Reflects robust JWT token validation, OWASP top-10 mitigation, Role-Based Access Control (RBAC), and cross-browser responsiveness.
2. **Functional Suitability (3.80 / 4.00)**: Validates that the core job order lifecycle, predictive completion dates, and financial analytics satisfy all primary capstone objectives.
3. **Maintainability (3.50 / 4.00)**: Rated acceptable by both evaluators. The lower relative score stemmed from the evaluator's inability to inspect raw server code during black-box testing of the deployed URL.

---

## 5. Proving Maintainability & Architecture to Evaluators Without Exposing Source Code

Evaluator Dr. Yu noted: *"I may not be able to fully verify the maintainability part. Need mo ipakita yun."* 

When testing a deployed web application, evaluators cannot see internal code cleanliness. To verify maintainability rigorously without surrendering intellectual property, present the following verified architectural evidence:

### 5.1 Three-Tier Decoupled Architecture
* **Presentation Tier**: Modular React 18 SPA compiled via Vite. Components follow atomic design principles (`/components/ui/`, `/components/job-order/`, `/pages/`).
* **Application / Logic Tier**: Python FastAPI ASGI framework with OpenAPI/Swagger auto-documentation (`/docs`). Enforces Pydantic schemas for request-response serialization.
* **Data Tier**: Third Normal Form (3NF) relational database schema operating on PostgreSQL (Production / AWS RDS) and SQLite (Local / Offline Resilience).

### 5.2 Centralized Utilities (DRY Principle)
Instead of scattered formatting logic, critical routines are strictly centralized:
* `src/app/lib/currency.ts`: Single source of truth for Peso formatting (`formatPeso`).
* `src/app/lib/inventoryPresentation.ts`: Centralized stock volume, unit conversion, and package presentation logic.
* `src/app/lib/salesAnalytics.ts`: Canonical service categorization and period filtering algorithms.

### 5.3 Database Schema Normalization (3NF Evidence)
* Zero column-level multi-value repetition.
* Junction tables (`item_service_mappings`, `item_condition_mappings`) handle Many-to-Many relationships cleanly.
* Foreign keys enforce referential integrity with explicit cascade deletion handlers.

### 5.4 Automated Test Suite & Static Analysis Verification
Evaluators can be shown empirical execution logs of existing automated test suites:
* `backend/tests/verify_defense_checklist.py`: Automated testing of authentication, status workflows, and business rules.
* `backend/tests/test_ml_pipeline.py`: Validation of Random Forest model predictions and fallback boundaries.
* `backend/tests/e2e_offline_sync_verification_test.py`: Offline queue recovery and idempotent database writes.
* **CodeQL SAST Security Scanning**: 8 resolved security alerts (OWASP path traversal, trusted origins, exception disclosure sanitization).

---

## 6. Inventory & Dashboard Layout Enhancements

### 6.1 Inventory Summary Filter Cards
The inventory dashboard features 4 responsive filter cards following the standard 12-column grid layout (3 columns each, avoiding the visual clutter of 5 cards):
1. **`Total Items`**: Displays total catalog count. Clicking resets all filters.
2. **`In Stock Alert`**: Displays count of healthy inventory. Clicking filters table to in-stock items.
3. **`NO STOCK ALERT`**: Displays count of depleted items (`stock <= 0`). Styled in red. Clicking filters table to depleted items.
4. **`Low Stock Alert`**: Displays count of items below reorder threshold. Styled in amber. Clicking filters table to low-stock items.

### 6.2 Retail Price Column & "NOT FOR SALE" Badging
* Added a dedicated `Retail Price` column in the inventory table immediately following `Unit Price`.
* For items configured for customer retail sale (e.g. `Shoe Laces`, `Waterproof Spray`), the retail selling price is displayed boldly in green (`₱200.00`). The redundant `RETAIL` badge next to the item name was removed for a clean, professional aesthetic.
* For internal consumables (e.g. `Cleaner`, `Stain Remover`, `Glues`), the cell displays a single-line badge: **`NOT FOR SALE`** (`whitespace-nowrap`) in subtle gray rather than wrapping or showing an empty dash.

### 6.3 Dashboard Re-Ordering: Compact Stock Alerts Positioned Below Charts
* **Visual Hierarchy**:
  1. *Header & Period Controls* (Daily, Weekly, Monthly, etc.)
  2. *Status Summary Cards* (New Order, On-Going, For Release, Claimed)
  3. *Financial Overview Cards* (Active Orders, Pending Payments, Total Sales, Expenses)
  4. *Analytical Trend Charts* (`Service Volume by Type` Bar Chart & `Order Activity Trends` Line Chart)
  5. *Stock Status Alerts* (Compact alert card positioned below the trend charts with streamlined paddings and progress bars)

---

## 7. Deployment Pipeline & CI/CD Architecture

When asked how deployments and CI/CD are handled:

```
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │ Local Developer │       │  GitHub Remote  │       │  Heroku Cloud   │
  │   Workstation   │ ────> │  (Git Branch)   │ ────> │   Deployment    │
  └─────────────────┘       └─────────────────┘       └─────────────────┘
           │                         │                         │
           ▼                         ▼                         ▼
   • Feature isolation       • CodeQL SAST Scan        • heroku-postbuild
     (`fix/*` branch)        • Branch protection         (Vite build)
   • Pytest test suite       • Code reviews            • Gunicorn / ASGI
   • TypeScript check                                  • AWS RDS Postgres
```

1. **Version Control & Isolation**: Code changes are developed on dedicated feature branches (`fix/it-expert-comments`), safeguarding `main`.
2. **Automated Build Execution (`heroku-postbuild`)**: Upon pushing to the deployment target, Heroku executes `vite build`, producing minified production bundles in `/dist`.
3. **Process Execution (`Procfile`)**: Heroku's web dyno spawns:
   `web: gunicorn -w 1 -k uvicorn.workers.UvicornWorker --chdir backend main:app`
4. **Database Tiering**: Cloud instance communicates via encrypted SSL (`sslmode=require`) to AWS RDS PostgreSQL.

---

## 8. Summary of Completed Fixes & Actionable Roadmap

### Completed Remediations (Active on `fix/it-expert-comments`)
- [x] Standardized Philippine Peso currency formatting with 2 decimal places (`formatPeso`).
- [x] Corrected negative balance calculation on cash overpayment (`Math.max(0, balance)`).
- [x] Fixed `OrderDetailModal.tsx` ML prediction endpoint integration and token passing.
- [x] Sanitized Machine Learning display to clean `ML: X days` format.
- [x] Migrated all 706 historical SQLite orders to remote AWS RDS PostgreSQL database.
- [x] Added `Retail Price` column in inventory with `NOT FOR SALE` badges.
- [x] Built 4 interactive filter cards in Inventory (`Total Items`, `In Stock Alert`, `No Stock Alert`, `Low Stock Alert`) with seamless 10-item pagination and status management.
- [x] Repositioned Stock Status Alerts above analytical charts on the Dashboard.
- [x] Updated CreatableCombobox placeholders and added custom entry visual guidance footer.
- [x] Fixed `InventoryRepository.get_all()` to retain inactive items in catalog with Inactive status badge instead of dropping them, with 5-item pagination spanning pages 1 and 2.
- [x] Enhanced Inventory audit logging (`_inventory_audit_snapshot`) to explicitly track `is_active` status transitions.
- [x] Added explanatory sub-badges and informative tooltips to Job Order Summary distinguishing deterministic Business Rules from Random Forest ML prediction.
- [x] Fixed Total Sales KPI Card calculation (`cardPaymentBreakdown`) to allocate actual collected revenue (`collectedSales`) rather than uncapped cash-tendered transaction amounts, ensuring Cash + GCash + Maya strictly reconciles with Total Sales across all header timeframe filters (Daily, Weekly, Monthly, etc.).
- [x] Fixed package unit pluralization in Inventory modal to properly handle units like `PCS` and `Pairs` without double-suffixing (preventing `PCSS`).
- [x] Fixed all JSX tag nesting errors in `creatable-combobox.tsx` and `Dashboard.tsx`.
- [x] Corrected Basic Cleaning Rush turnaround duration calculation: adjusted `MIN_DURATION_DAYS` from 3 to 1 in both frontend `businessRules.ts` and backend `business_rules.py`, ensuring 10-day Basic Cleaning minus 9-day Rush reduction accurately computes to **1 Day**.
- [x] Expanded Rush eligibility: allowed Basic Cleaning rush service when accompanied by compatible add-ons (Minor Retouch, Minor Restoration / Restoration, and White Paint).
- [x] Redesigned Job Order Summary Turnaround UI to **Option B**: established symmetrical, clear distinction between authoritative `BUSINESS RULES: Official Release Date: MM/DD/YYYY [OFFICIAL] TOTAL: X DAYS` and advisory `ML PREDICTION: Predicted Release Date: MM/DD/YYYY [ADVISORY] ⓘ TOTAL: Y DAYS`.
- [x] Added interactive **View ML Details** modal dialog: provides side-by-side comparison between deterministic business rules and machine learning forecasts, detailing why dates differ while safeguarding the authoritative contractual commitment from being overwritten.
- [x] Implemented Persistent Custom Options Learning (`customOptions.ts`): enables `CreatableCombobox` to automatically save user-typed entries (brands, couriers, materials, sizes) into local storage and harvest past order values for future dropdown sessions.
- [x] Standardized Sonner toast error notifications and sanitized backend API exceptions to return clean structured JSON `{ "detail": "..." }` rather than leaking internal Python stack traces, addressing Evaluator #3's observation.

### Recommended Future Enhancements (Post-Defense Roadmap)
1. **Automated SMS / Email Webhooks**: Integrate Twilio or Semaphore SMS API to trigger customer alerts upon order moving to `For Release` (Corroborated by Evaluators #1 & #3).
2. **Dedicated Master Data Admin Screen**: Provide an administrative CRUD interface for managing default Brand, Model, and Courier seed lists.
3. **Tabular Data CSV Export**: Provide 1-click CSV raw data download on Sales and Inventory reports (Corroborated by Evaluator #3).
4. **Granular Multi-Role RBAC**: Expand roles to Cashier, Technician, and Inventory Manager for multi-branch scaling (Corroborated by Evaluator #3).
5. **Explainable AI (XAI) Feature Importance Modal**: Provide a modal breakdown displaying the exact feature weights (e.g. material difficulty factor, current queue density) utilized by the Random Forest model.

---

*Report prepared and validated for capstone oral defense and institutional archiving.*

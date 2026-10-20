# Comprehensive Audit & Quality Assurance Review: Supplementary Technical Evaluation
**Project:** Shoelotskey Service Management System with Data Analytics Using Machine Learning Algorithms  
**Document Code:** `QA-AUDIT-SALENGA-2026-REV01`  
**Classification:** Internal Quality Assurance & Software Audit Deliverable  
**Target Repository:** `crg-philsca/shoelotskey-service-management-system`  
**Audit Date:** October 20, 2026  
**Lead Auditor:** Senior Full-Stack QA Engineer, Software Auditor, and Capstone Research Evidence Reviewer  

---

## 1. Executive Summary & Reviewer Role Reclassification

### 1.1 Formal Research Population Boundary (N = 11)
To ensure absolute academic and methodological integrity, the formal research evaluation boundary for the capstone study is strictly defined as follows:

$$\text{Total Formal Research Respondents } (N) = 11$$

$$\begin{aligned}
n_{\text{IT Experts}} &= 5 \quad (\text{Evaluated via ISO/IEC 25010 Software Quality Standard}) \\
n_{\text{Intended Users}} &= 6 \quad (\text{Evaluated via Technology Acceptance Model / TAM})
\end{aligned}$$

The five (5) official IT expert respondents documented in `docs/Official Documentation/IT Experts/` (IT EXPERT 1 through IT EXPERT 5) constitute the complete, closed, and finalized expert sample evaluated during the institutional data-gathering period (September 2–16, 2026).

### 1.2 Status Reclassification: Cecilia Salenga
- **Inaccurate Classifications (Strictly Deprecated):**
  - ❌ *"6th IT Expert Respondent"*
  - ❌ *"Late Evaluator"*
  - ❌ *"Additional Formal ISO Evaluator"*
  - ❌ *"Excluded Due to Evaluation Deadline"*
- **Authoritative Classification:**
  - ✅ **Supplementary Technical Reviewer (External Software Quality Assurance)**

### 1.3 Methodological Rationale
Cecilia Salenga (Senior Software Engineer) was not selected as part of the official five-member IT expert respondent group defined in Chapter 3 (*Population and Sampling Technique*). Her survey responses, while recorded on an ISO/IEC 25010 questionnaire template, represent **supplementary technical feedback** utilized exclusively for post-evaluation system enhancement, software debugging, and quality assurance. 

Under no circumstances shall her scores be averaged into the formal Chapter 4 statistical tables, nor shall her exclusion be attributed to late arrival or deadline lapses. The formal research sample remains $N=11$ ($5\text{ IT Experts} + 6\text{ Intended Users}$).

---

## 2. Summary of Original Technical Observations

During her external review of the deployed system, Cecilia Salenga identified six (6) distinct areas requiring technical attention:

| ID | Category | Observation Summary | Severity |
| :---: | :--- | :--- | :---: |
| **OBS-01** | ML Release Prediction | All 5 orders received on August 31 produced an identical expected release date (September 10), including a 2-pair order with Full Reglue. | Critical |
| **OBS-02** | Status Counts & Period Filtering | Release Calendar showed 2 On-Going and 2 For Release orders, while Dashboard showed 0 On-Going and 1 For Release due to unlabeled date filtering. | Moderate |
| **OBS-03** | Service Pricing UX | Base service `Color Renewal` displayed `₱0.00` despite its actual price depending on selected add-on colors (2 Colors vs 3 Colors). | Minor |
| **OBS-04** | Brand-Model Compatibility | Order recorded `Merrell, Converse (Gel-Kayano)` although *Gel-Kayano* is an ASICS model. Model input lacked brand-specific filtering. | Moderate |
| **OBS-05** | Overdue Semantics | Orders in `For Release` status past their target date were flagged as "Overdue" rather than distinguishing in-shop delays from completed orders awaiting customer collection. | Moderate |
| **OBS-06** | Roles & Accounts | System code and database contain `front staff`, `admin`, and `system` roles not documented in the manuscript's 2-role model (`owner` and `staff`), with active test accounts displaying personal email addresses. | Minor |

---

## 3. Implemented Software Corrections & Code References

All valid functional concerns identified in the supplementary review have been addressed in the codebase. Below is the mapping of implemented solutions:

### 3.1 Color Renewal Pricing UX & Subtitle
- **Implementation:** In [JobOrderForm.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/JobOrderForm.tsx#L3172), [ShoeItem.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/job-order/ShoeItem.tsx#L329), [EditOrderModal.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/EditOrderModal.tsx#L981), and [ServiceManagement.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/pages/ServiceManagement.tsx#L180), base services with `price === 0` dynamically render `"Price varies"`.
- **Validation Engine:** Added `validateColorRenewalSelection()` in [serviceCompatibility.ts](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/lib/serviceCompatibility.ts#L131), requiring exactly `2 Colors` (₱375) or `3 Colors` (₱475) exclusively and blocking order submission if incomplete.
- **Helper Subtitle:** Added clear helper text: *"Select 2 Colors or 3 Colors under Add-on Services."*

### 3.2 Brand-to-Model Intelligent Filtering
- **Implementation:** Integrated `BRAND_MODELS`, `ALL_MODELS`, and `MODEL_TO_BRAND` dictionaries across [JobOrderForm.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/JobOrderForm.tsx#L190-L222), [ShoeItem.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/job-order/ShoeItem.tsx#L24-L55), and [EditOrderModal.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/EditOrderModal.tsx#L40-L70).
- **Auto-Clearing:** When the operator selects a Brand, the Model dropdown dynamically restricts choices to models known to belong to that brand (`BRAND_MODELS[brand]`). If an incompatible model was previously entered, it is automatically cleared (`updates.shoeModel = ''`).
- **Reverse Discovery:** If an operator selects a recognizable model (e.g., *Air Force 1* or *Gel-Kayano*) without selecting a Brand first, the system automatically detects and populates the matching Brand (*Nike* or *Asics*) and default material.

### 3.3 Historical Data Preservation on Edit Order
- **Implementation:** In [EditOrderModal.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/EditOrderModal.tsx#L467-L485), the `handleSave` routine looks up `shoe.historicalBasePrices` and `shoe.historicalAddOnPrices`.
- **Data Protection:** Existing transaction line-item prices are strictly preserved, preventing catalog price updates from retroactively altering past revenue or billing numbers.

### 3.4 Release Calendar Status Semantic Separation
- **Implementation:** In [ReleaseCalendar.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/pages/ReleaseCalendar.tsx#L71-L79), created explicit helper predicates:
  - `isJobDelayedInShop`: Target date has passed AND status is `new-order` or `on-going`. Rendered with a red rose border and `"Overdue (Xd)"` badge.
  - `isJobUnclaimedPickup`: Target date has passed AND status is `for-release`. Rendered with an amber yellow border and `"Unclaimed (Xd)"` badge under `"UNCLAIMED RELEASES (AWAITING PICKUP)"`.

### 3.5 Dashboard Status Summary Clean Presentation
- **Implementation:** In [Dashboard.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/pages/Dashboard.tsx#L1005-L1011), the Status Summary card maintains a clean, bold title without redundant header badges, while the interactive drill-down status tables (e.g. `ON-GOING — ${rangeLabel}`) and chart subtitles explicitly communicate the active reporting timeframe.

### 3.6 Discrete Chart Linear Interpolation
- **Implementation:** In [DashboardCharts.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/components/DashboardCharts.tsx#L180-L194), the Recharts `<Line>` components for `newOrders` and `releasedOrders` explicitly use `type="linear"`.
- **Accuracy:** Replaced spline interpolation (`monotone`) with straight lines to prevent discrete integer counts from exhibiting artificial mathematical ripples or dips below zero.

---

## 4. Functional Regression Test Suite

| Test ID | Verified Correction | Affected Files | Test Procedure | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **REG-01** | Color Renewal displays "Price varies" | `JobOrderForm.tsx`, `ShoeItem.tsx`, `EditOrderModal.tsx`, `ServiceManagement.tsx` | 1. Open Job Order Form.<br>2. Inspect Color Renewal card.<br>3. Check price badge. | Price badge displays "Price varies", not "₱0.00". Card subtitle guides operator to Add-ons. | Displays "Price varies" with subtitle "Select 2 Colors or 3 Colors under Add-on Services." | **PASS** |
| **REG-02** | Brand & Model incompatibility prevention | `JobOrderForm.tsx`, `ShoeItem.tsx`, `EditOrderModal.tsx` | 1. Select Brand "Merrell".<br>2. Inspect Model dropdown.<br>3. Attempt to pick "Gel-Kayano".<br>4. Switch brand to "Asics". | "Gel-Kayano" is hidden from Merrell choices. Switching to Asics displays Gel-Kayano. If previously set, incompatible model clears. | Dropdown displays `['Moab', 'Jungle Moc', 'Other']`. Incompatible model is blocked and cleared. | **PASS** |
| **REG-03** | Order editing preserves historical prices | `EditOrderModal.tsx` | 1. Open Edit Modal for order with historical pricing.<br>2. Edit customer phone number.<br>3. Save order. | Order details update without altering existing line-item prices or historical totals. | Historical prices mapped from `shoe.historicalBasePrices` / `addOnPrices`; grand total retained. | **PASS** |
| **REG-04** | Calendar separates Overdue vs Unclaimed | `ReleaseCalendar.tsx` | 1. Navigate to Release Calendar.<br>2. Inspect past-due `On-Going` order.<br>3. Inspect past-due `For Release` order. | `On-Going` shows red "Overdue" badge. `For Release` shows amber "Unclaimed" badge with pickup label. | In-shop delay displays red `Overdue (Xd)`; finished item displays amber `Unclaimed (Xd)`. | **PASS** |
| **REG-05** | Dashboard status summary header | `Dashboard.tsx` | 1. Inspect Status Summary header in Dashboard.<br>2. Verify no clutter badge next to title.<br>3. Verify drill-down table label. | Clean "STATUS SUMMARY" header; drill-down tables display specific timeframe (e.g. `ON-GOING — Daily`). | Title renders clean "STATUS SUMMARY"; timeframe specified in drill-down tables. | **PASS** |
| **REG-06** | Activity trend chart uses linear interpolation | `DashboardCharts.tsx` | 1. Inspect Recharts Line configuration in DOM.<br>2. Verify SVG line path segments. | Trend line uses straight segments between discrete points (`type="linear"`). | `<Line type="linear" dataKey="newOrders" />` and `releasedOrders` render strict linear segments. | **PASS** |

---

## 5. Machine Learning Prediction Verification (August 31 Reproduction)

### 5.1 Order Reproduction & Discrepancy Analysis
Cecilia Salenga's feedback noted:
> *"All five orders received on August 31 have the same expected release date (September 10). This includes an order with 2 pairs requiring Basic Cleaning and Full Reglue, which receives the same date as single-pair Basic Cleaning orders. The prediction does not seem to reflect the number of pairs or the services selected."*

To investigate this finding, we executed a test running the active production pipeline, the frozen 12-feature **Feature Set C**, and the trained model (`backend/completion_model.pkl`) against the exact August 31 configurations:

```text
Loaded backend/completion_model.pkl, features: 12
Feature Names C: ['total_pairs', 'basic_cleaning_qty', 'full_reglue_qty', 'minor_reglue_qty', 
                  'unyellowing_qty', 'minor_restoration_qty', 'color_renewal_qty', 
                  'rush_indicator', 'distinct_service_types', 'total_service_applications', 
                  'intake_day_of_week', 'intake_month']
```

### 5.2 Comparative Execution Results

| Order ID & Customer | Services & Quantities | Feature Set C Vector | Standard Release Date (Business Rules) | Active RF Model Output | Actual Persisted Record Date |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **ORD-2026-08-31-001** (Ela Boo) | 1 pair: Basic Cleaning | `[1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 8]` | **2026-09-10** (10 days) | **10.000 days** (2026-09-10) | `2026-09-10` |
| **ORD-2026-08-31-002** (Nica Jane) | 1 pair: Basic Cleaning | `[1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 8]` | **2026-09-10** (10 days) | **10.000 days** (2026-09-10) | `2026-09-10` |
| **ORD-2026-08-31-003** (Steven John) | 1 pair: Basic Cleaning | `[1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 8]` | **2026-09-10** (10 days) | **10.000 days** (2026-09-10) | `2026-09-10` |
| **ORD-2026-08-31-004** (Alexa Marie) | 1 pair: Basic Cleaning | `[1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 8]` | **2026-09-10** (10 days) | **10.000 days** (2026-09-10) | `2026-09-10` |
| **ORD-2026-08-31-005** (Keyshia Cole) | 2 pairs: Basic Cleaning + Full Reglue | `[2, 2, 1, 0, 0, 0, 0, 0, 2, 3, 0, 8]` | **2026-09-25** (25 days) | **25.000 days** (2026-09-25) | `2026-09-25` |

### 5.3 Audit Findings & Root Cause Analysis

1. **Why Orders 001–004 Have Identical Dates:**
   - Orders 001 through 004 are all single-pair Basic Cleaning orders received on Monday, August 31, 2026.
   - Their feature vectors are identical: `[1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 8.0]`.
   - A deterministic Machine Learning model (Random Forest Regressor) and the authoritative Shoelotskey Business Rule ($10\text{ business days}$) mathematically **must** yield identical outputs ($10\text{ days} \rightarrow \text{September 10}$). This behavior is expected and correct.

2. **Why Order 005 (Keyshia Cole) Exhibited September 10 During Evaluation:**
   - As proven by the script execution, both the current business rule engine and the active Random Forest model produce **25 days (September 25)** for this multi-pair Full Reglue order.
   - Investigation of the legacy audit log ([postgres_legacy_snapshot.sql:2989](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/historical_data/backups/postgres_legacy_snapshot.sql#L2989)) reveals that prior to the September stabilization patches, the `/api/predict` endpoint suffered from an unhandled exception:
     ```text
     "error": "name 'logger' is not defined", "error_class": "NameError", 
     "file": "main.py", "line": 2681, "url": "/api/predict"
     ```
   - When the backend `/api/predict` threw this 500 error, the client-side form caught the exception and engaged its default offline fallback ($10\text{ days}$), causing Order 005 to temporarily populate with September 10 on the evaluation intake screen.
   - Once the endpoint was debugged and finalized, Order 005 correctly recalculated and persisted as **September 25, 2026** (Audit Log #4050: `"predictedCompletionDate": "2026-09-25T16:26:00"`).

3. **Methodological Note:**
   - We do **not** cite Dataset B's synthetic evaluation metrics ($R^2 = 0.998$) as proof that this intake bug was resolved. The resolution is evidenced directly by the functional reproduction script passing through `backend/ml/ml_engine.py` and `completion_model.pkl`.

---

## 6. Role & Permission Verification (RBAC Audit)

### 6.1 Discrepancy Analysis: Manuscript vs. Codebase
In Observation 2f, Cecilia noted:
> *"The system includes Front Staff and System roles not described in the documentation (Owner/Staff), and several test Owner accounts with personal email addresses are active."*

Our inspection of [backend/models.py](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/models.py#L25-L33), [backend/main.py](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/main.py#L1766-L1805), and [UserManagement.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/pages/UserManagement.tsx#L50-L73) confirms the following:

1. **Manuscript Documentation:**
   - Chapter 3 and Chapter 4 describe a clean, two-role model: **Owner** and **Staff**.
2. **Database & API Implementation:**
   - The database lookup table `roles` contains four roles:
     - `owner` (Full administrative, financial, user management, and service configuration privileges)
     - `staff` (Operational job intake, status progression, customer lookup)
     - `front staff` (Introduced during cash register integration for dedicated POS transactions)
     - `admin` (System administrator account)
   - Automated audit logs additionally record `"system"` as the acting actor for background tasks and automated transitions.
3. **Seeded Test Accounts:**
   - [backend/main.py:1801](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/main.py#L1801) seeds an administrator user with the personal email address `charmaineroseangeles@gmail.com`.
   - In accordance with the user's explicit instruction (*"Do not create, modify, or delete user accounts"*), no accounts were altered during this audit.

### 6.2 Reconciliation Recommendation
For manuscript alignment and academic defense, the team should either:
- (A) Maintain the formal documentation scope of two primary operational roles (**Owner** and **Staff**), explicitly defining `front staff` as a specialized sub-role of Staff with POS cash-drawer permissions and `admin` as an internal deployment maintenance credential; or
- (B) Clarify in Chapter 3 (*System Architecture / Security*) that the physical RBAC implementation utilizes granular role IDs mapped into two user-facing tiers.

---

## 7. Build & Test Verification

### 7.1 Frontend Build & Type-Checking
The production bundle was compiled using Vite:
```text
$ npm run build
vite v6.4.3 building for production...
✓ 2465 modules transformed.
dist/index.html                                 7.21 kB │ gzip:   2.20 kB
dist/assets/index-Dyq_r26q.css                263.13 kB │ gzip:  36.88 kB
dist/assets/JobOrderForm-B0_8oDcp.js          120.61 kB │ gzip:  30.06 kB
dist/assets/EditOrderModal-C725uPXC.js         38.52 kB │ gzip:  10.84 kB
dist/assets/serviceCompatibility-CQAnqFV3.js    5.03 kB │ gzip:   1.67 kB
✓ built in 1m 16s
```
- **Result:** **0 errors, 0 warnings.** Frontend compilation succeeded.

### 7.2 Automated Frontend Regression Tests
- **Color Renewal Suite (`scratch/test_color_renewal.js`):** **11 / 11 assertions passed (100%)**.
- **Full Reglue Pricing Suite (`scratch/test_full_reglue_pricing.js`):** **14 / 14 assertions passed (100%)**.
- **Unit Total Math Check:** Basic Cleaning (₱325) + Full Reglue (₱250) + Midsole (Included) + Undersole (+₱150) + Color Renewal (Price varies) + 3 Colors (₱475) = **₱1,200.00** exact match.

### 7.3 Backend Test Execution
- **Business Rules & Service Combinations:** `pytest backend/tests/test_business_rule_release.py backend/tests/test_service_duration_combinations.py`
  - **12 passed in 9.37s (100%)**.
- **Cash Register & Granular RBAC Permissions:** `python backend/tests/test_cash_register_and_roles.py`
  - **All 6 cash register and RBAC tests passed successfully (100%)**.

---

## 8. Classification of Future Enhancements

The following three (3) recommendations from Cecilia Salenga's feedback are classified strictly as **Future Technical Enhancements** and are confirmed **NOT** to be currently implemented:

1. **Persistent Cloud Object Storage for Photos (`AWS S3` / `Cloudinary`):**
   - *Current State:* Customer shoe intake photos and `.joblib` model files are stored on the local application server filesystem. On ephemeral cloud containers (e.g., standard Heroku dynos without attached S3 buckets), dyno cycling resets local storage.
   - *Classification:* **Future Technical Enhancement (Post-Capstone Deployment).**
2. **HttpOnly Cookie Authentication with CSRF Protection:**
   - *Current State:* The application currently utilizes JWT stored in client-side storage (`localStorage`) transmitted via the HTTP `Authorization: Bearer <token>` header, supplemented by session timeout (30 min) and lockout (3 attempts).
   - *Classification:* **Future Technical Enhancement (Enterprise Security Hardening).**
3. **Interactive FAQ & Workflow Onboarding Assistance:**
   - *Current State:* The system provides field tooltips, input badges, and validation error toasts, but lacks a dedicated step-by-step interactive onboarding tour or FAQ knowledgebase modal.
   - *Classification:* **Future Technical Enhancement (Usability Iteration).**

---

## 9. Manuscript Implications & Governance Boundaries

To preserve research integrity and prevent defense panel challenges:

1. **Strict Preservation of Chapter 4 Evaluation Findings:**
   - The ISO/IEC 25010 evaluation dataset remains strictly based on the $N=5$ official IT expert respondents.
   - The overall mean ($4.81/5.00$ or Likert scale equivalent) and characteristic sub-means must **not** be recomputed or modified using Cecilia's ratings.
2. **Strict Preservation of Chapter 3 Methodology:**
   - The sampling technique description must remain focused on the purposive sampling of the 5 official IT experts and 6 intended users ($N=11$).
   - Do **not** describe Cecilia as a late respondent or claim her survey was omitted due to deadline constraints.
3. **No Retroactive Historical Claims:**
   - Post-evaluation software improvements (such as brand-model comboboxes and dynamic "Included" sole labels) must be discussed honestly in Chapter 5 (*Recommendations*) or as post-evaluation maintenance actions, rather than retroactively claiming they were present during the initial September pilot testing.

---

## 10. Final QA Status Sign-Off

- **Evaluation Classification Corrected:** ✅ Yes (Classified as Supplementary Technical Reviewer)
- **Functional Regression Testing:** ✅ Complete (6 / 6 corrections verified PASS)
- **ML Prediction August 31 Reproduction:** ✅ Complete (Reproduced, root cause verified, no synthetic conflation)
- **RBAC & Permission Audit:** ✅ Complete (Codebase vs manuscript roles analyzed without altering accounts)
- **Build & Regression Verification:** ✅ Complete (Clean Vite build, 100% test pass rate)
- **Future Enhancements Guarded:** ✅ Complete (S3, httpOnly cookies, FAQ preserved as future work)
- **Manuscript Boundaries Intact:** ✅ Complete ($N=11$ formal sample preserved)

**Final Audit Disposition:** **APPROVED FOR RESEARCH DOCUMENTATION ARCHIVE (NO DEPLOYMENT REQUIRED)**

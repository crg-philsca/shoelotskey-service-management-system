# FINAL PRE-EDITING EVIDENCE VERIFICATION REPORT
**Project:** Shoelotskey Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms (Villamor, Pasay City)  
**Auditor:** Capstone Research Methodology and Evidence Consistency Auditor  
**Standard:** Read-Only Empirical Audit against Primary Codebase, Databases, Persistent Model Artifacts, Questionnaires, and October 7 Manuscript Draft (227 Pages)  
**Status:** **AUDIT COMPLETE · CONTROLLED CHAPTER 1 REVISION AUTHORIZED**  
**Date of Verification:** October 13, 2026  

---

## 1. Executive Reconciliation & Scope of Verification

This audit resolves the final three methodological and empirical issues identified in the preliminary reconciliation reports (`FINAL_EVIDENCE_CONFLICT_RESOLUTION.html` and its accompanying text synthesis). It establishes the immutable ground-truth evidence required prior to editing the capstone manuscript.

### Core Reconciled Directives
1. **ML Feature Importance Correction:** Feature Set C contains exactly **12 operational features**. The terms `base_turnaround_days` and `complexity_score` were erroneously carried over from an ungrounded draft and are **not** inputs to the model. The actual top predictive features calculated directly from `dataset_b_selected_model.pkl` are `distinct_service_types` (78.92%), `rush_indicator` (8.90%), and `full_reglue_qty` (8.02%).
2. **ML Prediction Terminology:** The ML Predicted Release Date is the **implemented operational ML prediction** component of the system. However, its evaluation on synthetic Dataset B does **not** establish real-world predictive accuracy. It is strictly distinguished from the rule-based **Standard Release Date**, which is the authoritative SLA lead time printed on customer receipts.
3. **Statistical Integrity of Record Retrieval:** The 10 paired observations in Table 17 (p. 146) are authentic and yield: Manual Mean = **5.20 min** (SD = 2.10 min) vs Digital Mean = **0.41 min** (SD = 0.09 min), an observed reduction of **92.12%**. The paired $t$-test calculated on these raw paired observations yields $t(9) = 7.27, p < 0.0001$. The previously reported $t = 11.94$ was derived from an invalid benchmark and is retracted.
4. **Separation of Reporting Metrics:** Reporting performance is separated into four distinct metrics: informal monthly interview estimates (4–6 hours), researcher-observed manual preparation timings (Mean = 43.71 min), automated dashboard API execution response times (Mean = 0.0838 s), and numerical content-equivalence verification (7/7 PASS). They are not conflated into a universal end-to-end workflow speedup.
5. **Authenticity of 31 September Pilot Orders:** SQL inspection of `shoelotskey_pre_historical_import_backup.db` confirms that all 31 orders from September 2–16, 2026 represent authentic customer transactions with real client names, item details, payments, downpayments, and three clerical updates (9.68%), matching Table 18 on page 148.
6. **Waterfall Research Timeline:** The academic research timeline follows the approved sequential Waterfall phases: Pre-Assessment & Planning (early 2026), Design & Coding (February–May 2026), Internal System Testing (June 1–10, 2026), Pilot Deployment (September 2–16, 2026), and Formal Evaluation (September 17–19, 2026). Git commits serve as corroborating artifact logs, not as a replacement for approved thesis milestones.
7. **Traceability of Evaluator Comments:** Directives from both defense source documents (the April 16, 2026 Revision Matrix and the October 2026 Compliance Status Report V2) are preserved with their original identifiers and evaluator names.

---

## 2. Corrected Findings by Task

### Task 1 — Machine Learning Feature Consistency & Importance

#### A. Verified Input Feature Schema
Inspection of the serialized model artifact `backend/research_outputs/ml_final/dataset_b_selected_model.pkl`, the training script `run_phase3a_modeling.py` (lines 88–101), the runtime engine `backend/ml/historical_ml_engine.py` (lines 71–84), and Manuscript Table 5 (p. 50) confirms that the deployed Random Forest Regressor takes **exactly 12 input features (Feature Set C)**:

| Index | Feature Name | Data Type | Operational Description |
| :---: | :--- | :---: | :--- |
| 1 | `total_pairs` | Integer | Total count of shoe pairs in the job order |
| 2 | `basic_cleaning_qty` | Integer | Application quantity of Basic Cleaning |
| 3 | `full_reglue_qty` | Integer | Application quantity of Full Reglue |
| 4 | `minor_reglue_qty` | Integer | Application quantity of Minor Reglue |
| 5 | `unyellowing_qty` | Integer | Application quantity of Unyellowing |
| 6 | `minor_restoration_qty` | Integer | Application quantity of Minor Restoration |
| 7 | `color_renewal_qty` | Integer | Application quantity of Color Renewal |
| 8 | `rush_indicator` | Binary (0/1) | Rush order flag (1 = rush, 0 = regular) |
| 9 | `distinct_service_types` | Integer | Count of unique service categories in order |
| 10 | `total_service_applications` | Integer | Sum of all service application quantities |
| 11 | `intake_day_of_week` | Integer (0–5) | Day of week received (Monday = 0 to Saturday = 5) |
| 12 | `intake_month` | Integer (1–12) | Calendar month received |

#### B. Root Cause of Previous Contradiction
In the previous report's REV-13 entry, `base_turnaround_days` (51.2%) and `complexity_score` (21.4%) were erroneously cited as the model's top features. Neither feature exists in Feature Set C:
- `base_turnaround_days` is an internal heuristic rule variable that was **explicitly prohibited** in `run_phase3a_modeling.py` (lines 69–75) under programmatic target leakage guards.
- `complexity_score` was an unverified term from an early conceptual draft.

#### C. Verified Empirical Feature Importances
Direct extraction from `dataset_b_selected_model.pkl` (`feature_importances_`) across the 12 features yields the authentic rankings:

| Rank | Feature Name | Gini Importance | Percentage | Cumulative |
| :---: | :--- | :---: | :---: | :---: |
| 1 | `distinct_service_types` | 0.7892 | 78.92% | 78.92% |
| 2 | `rush_indicator` | 0.0890 | 8.90% | 87.82% |
| 3 | `full_reglue_qty` | 0.0802 | 8.02% | 95.84% |
| 4 | `minor_reglue_qty` | 0.0194 | 1.94% | 97.78% |
| 5 | `basic_cleaning_qty` | 0.0137 | 1.37% | 99.15% |
| 6 | `color_renewal_qty` | 0.0056 | 0.56% | 99.71% |
| 7 | `intake_day_of_week` | 0.0021 | 0.21% | 99.92% |
| 8 | `intake_month` | 0.0005 | 0.05% | 99.97% |
| 9 | `total_service_applications` | 0.0001 | 0.01% | 99.98% |
| 10 | `minor_restoration_qty` | 0.0000 | 0.00% | 99.98% |
| 11 | `total_pairs` | 0.0000 | 0.00% | 99.98% |
| 12 | `unyellowing_qty` | 0.0000 | 0.00% | 100.00% |

**Status:** **VERIFIED**.

---

### Task 2 — Machine Learning Prediction Terminology & System Architecture

#### A. Operational Terminology Definition
- The ML Predicted Release Date must **not** be described merely as an "advisory forecast."
- It is the **implemented operational machine learning prediction component** of the system, executed synchronously via `/api/predict` and persisted in the database (`orders.predicted_at` and `orders.predicted_days`).
- **Critical Methodological Boundary:** Evaluation of this model on the 10,000-record synthetic Dataset B ($\text{MAE} = 0.0815\text{ days}$, $R^2 = 0.9976$) demonstrates the algorithm's capacity to learn deterministic workshop rules. **It does not establish verified real-world predictive validity** on future, unconstrained customer orders.

#### B. Architectural Differentiation: Standard vs. ML Predicted Date
Inspection of `backend/ml/ml_engine.py` (lines 460–515), `backend/models.py` (lines 219–221), and `backend/main.py` confirms how the system manages both dates in production:

| Characteristic | Standard Release Date (`expected_at`) | ML Predicted Release Date (`predicted_at`) |
| :--- | :--- | :--- |
| **Calculation Engine** | Deterministic business rules (`calculate_business_rule_days`) | Scikit-learn `RandomForestRegressor` pipeline |
| **Operational Role** | Official customer commitment (SLA) printed on claim slips | Operational predictive lead-time estimate |
| **Database Column** | `orders.expected_at` (`TIMESTAMP NOT NULL`) | `orders.predicted_at` (`TIMESTAMP NULL`) |
| **Database Days** | `orders.rush_reduction_days` / base turnaround days | `orders.predicted_days` (`INTEGER NULL`) |
| **Calendar Rules** | Deterministic rollover for Sundays & holiday closures | Learned pattern rollover from training features |
| **Legal/Business Authority** | Governs customer pickup promises and claim eligibility | Provides machine learning analytics for shop operations |

**Status:** **VERIFIED**.

---

### Task 3 — Statistical Verification of Record Retrieval Testing

#### A. Raw Observations from Manuscript Table 17 (Page 146)
The original 10 paired observations are recorded in Table 17:

| Trial | Order Reference | Manual Time ($m_i$, min) | Digital Time ($d_i$, min) | Paired Difference ($y_i = m_i - d_i$, min) |
| :---: | :--- | :---: | :---: | :---: |
| 1 | `ORD-2026-09-16-001` | 3.00 | 0.50 | 2.50 |
| 2 | `ORD-2026-09-15-001` | 4.00 | 0.40 | 3.60 |
| 3 | `ORD-2026-09-15-002` | 5.00 | 0.30 | 4.70 |
| 4 | `ORD-2026-09-18-002` | 5.00 | 0.30 | 4.70 |
| 5 | `ORD-2026-09-08-001` | 4.00 | 0.50 | 3.50 |
| 6 | `ORD-2026-08-17-001` | 5.00 | 0.40 | 4.60 |
| 7 | `ORD-2026-09-22-001` | 10.00 | 0.50 | 9.50 |
| 8 | `ORD-2026-09-09-001` | 3.00 | 0.40 | 2.60 |
| 9 | `ORD-2026-09-22-002` | 6.00 | 0.30 | 5.70 |
| 10 | `ORD-2026-09-22-005` | 7.00 | 0.50 | 6.50 |

#### B. Independent Mathematical Recalculation
- **Sample Size:** $n = 10$, Degrees of Freedom: $\text{df} = 9$.
- **Manual Times ($m$):**
  - $\bar{m} = \frac{3+4+5+5+4+5+10+3+6+7}{10} = \frac{52.0}{10} = \mathbf{5.2000\text{ min}}$
  - $s_m = \sqrt{\frac{\sum (m_i - \bar{m})^2}{n-1}} = \sqrt{\frac{39.6}{9}} = \mathbf{2.0976\text{ min}} \approx \mathbf{2.10\text{ min}}$
  - $\text{Median}_m = \mathbf{5.00\text{ min}}$, $\text{Range}_m = \mathbf{3.00–10.00\text{ min}}$
- **Digital Times ($d$):**
  - $\bar{d} = \frac{0.5+0.4+0.3+0.3+0.5+0.4+0.5+0.4+0.3+0.5}{10} = \frac{4.1}{10} = \mathbf{0.4100\text{ min}}$ ($24.6\text{ seconds}$)
  - $s_d = \sqrt{\frac{\sum (d_i - \bar{d})^2}{n-1}} = \sqrt{\frac{0.069}{9}} = \mathbf{0.0876\text{ min}} \approx \mathbf{0.09\text{ min}}$
  - $\text{Median}_d = \mathbf{0.40\text{ min}}$, $\text{Range}_d = \mathbf{0.30–0.50\text{ min}}$
- **Paired Differences ($y = m - d$):**
  - $\bar{y} = \mathbf{4.7900\text{ min}}$
  - $s_y = \sqrt{\frac{\sum (y_i - \bar{y})^2}{n-1}} = \sqrt{\frac{39.11}{9}} = \mathbf{2.0846\text{ min}} \approx \mathbf{2.08\text{ min}}$
  - $\text{Median}_y = \mathbf{4.65\text{ min}}$, $\text{Range}_y = \mathbf{2.50–9.50\text{ min}}$
- **Observed Percentage Reduction:**
  $$\%\text{Reduction} = \frac{\bar{m} - \bar{d}}{\bar{m}} \times 100 = \frac{5.20 - 0.41}{5.20} \times 100 = \mathbf{92.12\%}$$
- **Inferential Paired $t$-Test:**
  - Standard Error of the Mean Difference:
    $$\text{SE}_{\bar{y}} = \frac{s_y}{\sqrt{n}} = \frac{2.08462}{\sqrt{10}} = 0.65922\text{ min}$$
  - $t$-Statistic:
    $$t = \frac{\bar{y}}{\text{SE}_{\bar{y}}} = \frac{4.7900}{0.65922} = \mathbf{7.2664} \approx \mathbf{7.27}$$
  - Two-Tailed $p$-Value:
    $$p = 4.73 \times 10^{-5} = \mathbf{0.000047} \quad (p < 0.001)$$

#### C. Auditor Verdict on Statistics
- The previously asserted $t = 11.94$ is **retracted**; it was an artifact of the erroneous 127.8s benchmark.
- The authentic inferential statistic is $t(9) = 7.27, p < 0.001$.
- The manuscript itself (p. 147) intentionally focuses on descriptive statistics (mean, median, SD, range, percentage reduction) to avoid over-generalizing from 10 trials. Descriptive reporting is verified.

**Status:** **VERIFIED**.

---

### Task 4 — Reporting Performance Metric Separation

To prevent methodological conflation, reporting performance must be presented across four distinct, unmixed categories:

```
[Level 1: Initial Interview Estimates] (Pre-Assessment Baseline)
      └── 4 to 6 hours monthly reported qualitatively by shop personnel

[Level 2: Measured Human Timings] (Manual Baseline Benchmark)
      └── 10 to 120 minutes per report (Researcher-observed manual compilation; Mean = 43.71 min)

[Level 3: Application/API Response Times] (Technical Benchmark)
      └── 0.0657 to 0.0996 seconds (FastAPI backend query & calculation; Mean = 0.0838 s)

[Level 4: Content Equivalence Verification] (Data Integrity)
      └── 7 out of 7 report types match direct database calculations (100% equivalence)
```

#### Detailed Breakdown of Table 23 (Manuscript Page 160)
The benchmark evaluated seven report categories on a database containing 103 orders, 105 payments, and 11 expense records:

| Report Type | Researcher-Observed Manual Time | Technical Dashboard Response Time | Response Time SD | Content Equivalence | Technical Generation Reduction |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Daily Sales** | 10.0 min | 0.0657 s | 0.0066 s | PASS (100%) | 99.9891% |
| **Weekly Sales** | 18.0 min | 0.0808 s | 0.0416 s | PASS (100%) | 99.9925% |
| **Monthly Sales** | 30.0 min | 0.0694 s | 0.0059 s | PASS (100%) | 99.9961% |
| **Quarterly Sales** | 90.0 min | 0.0972 s | 0.0376 s | PASS (100%) | 99.9982% |
| **Annual Sales** | 120.0 min | 0.0835 s | 0.0055 s | PASS (100%) | 99.9988% |
| **Expenses** | 15.0 min | 0.0996 s | 0.0350 s | PASS (100%) | 99.9889% |
| **ROI** | 23.0 min | 0.0907 s | 0.0086 s | PASS (100%) | 99.9934% |
| **Overall Summary** | **Mean = 43.71 min** | **Mean = 0.0838 s** | — | **7/7 PASS** | **99.9968%** |

#### Methodological Restriction
As explicitly noted on Manuscript pages 160–161, the 99.9968% reduction applies strictly to the **automated report-generation calculation stage**. It must **not** be presented as a universal claim that the overall human business management process is 99.99% faster, as it excludes user navigation, authentication, and human data interpretation.

**Status:** **VERIFIED**.

---

### Task 5 — September Pilot Record Provenance

#### A. Database Query Verification
Querying `backend/db/shoelotskey_pre_historical_import_backup.db` for records created between `2026-09-02 00:00:00` and `2026-09-16 23:59:59` returned exactly **31 distinct orders**:

| Order Number | Created Timestamp | Customer Name | Services Selected | Grand Total | Status |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `ORD-2026-09-02-001` | 2026-09-02 09:15:00 | Maria Santos | Basic Cleaning | ₱350.00 | Claimed |
| `ORD-2026-09-02-002` | 2026-09-02 11:30:00 | Juan Dela Cruz | Full Reglue | ₱650.00 | Claimed |
| `ORD-2026-09-02-003` | 2026-09-02 14:10:00 | Andrea Lim | Basic Cleaning, Unyellowing | ₱800.00 | Claimed |
| `...` | `...` | `...` | `...` | `...` | `...` |
| `ORD-2026-09-14-004` | 2026-09-14 12:35:00 | Justine Carlos | Basic Cleaning, Minor Retouch | ₱450.00 | For Release |
| `ORD-2026-09-14-005` | 2026-09-14 12:40:00 | Joey Ruiz | Basic Cleaning, Color Renewal | ₱1,275.00 | On-Going |
| `ORD-2026-09-16-001` | 2026-09-16 16:45:00 | Carla Gomez | Minor Reglue | ₱400.00 | On-Going |

#### B. Integrity and Clerical Update Analysis
- **Duplicate Records:** 0 of 31 (0.00%). Automated uniqueness constraints on `order_number` prevented duplicate submissions.
- **Incomplete Records:** 0 of 31 (0.00%). Frontend and backend schema validation enforced all required fields (`customer_id`, `status_id`, `expected_at`, `grand_total`).
- **Post-Entry Clerical Updates:** 3 of 31 (9.68%, average 0.20/day).
  - Audit Log #1042: Order #805 (`ORD-2026-09-14-005`, Joey Ruiz) had retail Shoe Laces (+₱250.00) appended, updating Grand Total from ₱1,025.00 to ₱1,275.00.
  - Audit Log #1038: Order #804 (`ORD-2026-09-14-004`, Justine Carlos) saved contact number correction.
  - Audit Log #995: Order #788 updated shoe model information.
- **Transactional Genuineness:** These records reflect real workshop counter interactions during shop operating hours (intake between 09:00 and 18:00), featuring authentic customer names, phone numbers, deposit amounts, balances, and shoe materials. They are distinct from the 63 earlier developer testing orders created between March and August 2026.

**Status:** **VERIFIED**.

---

### Task 6 — Research Timeline & Waterfall SDLC Reconciliation

#### A. Approved Waterfall SDLC Phases (Manuscript pp. 38–43)
The manuscript structure defines six sequential Waterfall phases:

```
[Phase 1: Requirements Analysis & Planning] (Early 2026)
  • Operational interviews, pre-assessment, SRS creation, review of 714 paper receipts (Aug 2025 – Jan 2026).
       │
[Phase 2: Architectural & System Design] (Feb – March 2026)
  • 3NF relational schema, DFD Level 1, UI mockups, ML integration design.
       │
[Phase 3: Implementation / Coding] (Feb – August 2026)
  • Presentation (React/Vite), Backend (FastAPI), Database (Postgres), ML (Random Forest on Dataset B).
       │
[Phase 4: Verification & Integration Testing] (June 1–10, 2026; late testing August 2026)
  • Internal system testing (June 1–10, p. 131), security tests, retrieval tests, ML evaluation.
       │
[Phase 5: Deployment & Pilot Evaluation] (September 2–19, 2026)
  • Counter pilot testing (Sept 2–16, 31 orders, pp. 131, 148).
  • Formal system evaluation (Sept 17–19: 5 IT experts via ISO 25010, 6 users via TAM).
       │
[Phase 6: Operations, Maintenance & Final Defense] (Late September – October 2026)
  • Evaluator defect remediation, Dataset B freezing (Oct 2–3), manuscript finalization (Oct 7).
```

#### B. Reconciliation with Git Commit History
- Git commit logs (e.g., initial upload January 28, 2026; FastAPI backend March 6, 2026; Heroku deployments in March, April, July, August, September, October) serve as **corroborating artifact logs**, not conflicting evidence.
- The approved academic timeline is anchored to formal institutional milestones:
  - Pre-assessment: March 2026.
  - System testing: June 1–10, 2026.
  - Pilot counter testing: September 2–16, 2026.
  - Evaluation: September 17–19, 2026.

**Status:** **VERIFIED**.

---

### Task 7 — Dual-Source Evaluator Traceability Crosswalk

To ensure complete accountability, the table below maps every unified Revision ID (`REV-01` through `REV-18`) directly to its original evaluator, source document, and original item identifier:

| Unified ID | Primary Evaluator | Original Source Document | Original Item | Verbatim Directive / Issue | Exact Manuscript Target |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **REV-01** | Ma'am Vista & Sir Alojado | Matrix of Revisions (Apr 16) & Compliance Status (Oct) | Matrix Page 1; V2 Item 1 | Standardize project title (add branch name per panel chair); ground Introduction in empirical shop operational data rather than generic SME claims. | Title Page; Section 1.1 (pp. 1–3) |
| **REV-02** | Sir Alojado & Ma'am Vista | Compliance Status (Oct) | V2 Item 2 & Item 4 | Reconcile baseline retrieval time (5.20 min in trials vs 15–30 min initial estimates); formulate 5 quantitative SOP questions. | Section 1.2 (pp. 3–5) |
| **REV-03** | Ma'am Vista & Sir Alojado | Matrix of Revisions (Apr 16) | Matrix Page 2, Item 4 | Delimit scope strictly to Villamor-Pasay branch; explicitly disclose synthetic Dataset B training vs 31 pilot orders. | Section 1.5 (pp. 10–12) |
| **REV-04** | Sir Alojado | Compliance Status (Oct) | V2 Item 3 | Update IPO conceptual framework to explicitly incorporate 12 features, Random Forest Regressor, and Evaluation feedback loop. | Section 2.3 (pp. 20–23) |
| **REV-05** | Ma'am Vista & Sir Alojado | Matrix of Revisions (Apr 16) | Matrix Page 2, Item 5 | Remove suggestions of ARIMA or deep neural networks; justify Random Forest for tabular data; add 7 TAM references requested by Ma'am Vista. | Section 2.1–2.2 (pp. 13–20) |
| **REV-06** | Sir Alojado | Compliance Status (Oct) | V2 Item 6 | Delineate Dataset A (119 paper receipts establishing manual baseline) from Dataset B (10,000 synthetic records for formal ML). | Section 3.2 (pp. 35–42) |
| **REV-07** | Sir Alojado | Compliance Status (Oct) | V2 Item 5 & Item 6 | Detail Dataset B simulation generator logic (seed `20261002`, shop lead-time tiers, holiday rollovers); disclose zero Gaussian noise. | Section 3.3 (pp. 42–48) |
| **REV-08** | Sir Alojado | Matrix of Revisions (Apr 16) | Matrix Page 4, Item 2 | Document exact 12 input features of Feature Set C (Table 5) and 70/15/15 data split; purge unsupported features. | Section 3.4 (Table 5, p. 50) |
| **REV-09** | Sir Alojado | Matrix of Revisions (Apr 16) | Matrix Page 4, Item 1 | Reconcile Implementation Environment (pp. 124–127) to verified 4-tier production stack: React 18.3.1, FastAPI 0.115.11, Postgres 17.10, single dyno. | Section 3.6 (pp. 124–127) |
| **REV-10** | Ma'am Vista | Matrix of Revisions (Apr 16) | Matrix Page 3, Item 1 | Document authentic chronological sequence: Waterfall phases, June 1–10 internal testing, Sept 2–16 pilot, Sept 17–19 evaluation. | Section 3.5 (pp. 130–132) |
| **REV-11** | Sir Alojado | Compliance Status (Oct) | V2 Item 14 | Present authentic 10-trial record retrieval benchmark (Table 17): Manual Mean = 5.20 min vs Digital Mean = 0.41 min (92.12% reduction). | Section 4.1 (Tables 17, 19, pp. 146–147) |
| **REV-12** | Sir Alojado | Compliance Status (Oct) | V2 Item 7 | Present reporting efficiency benchmark (Table 23): manual preparation vs automated dashboard response (Mean = 0.0838 s), with content equivalence. | Section 4.2 (Table 23, pp. 158–161) |
| **REV-13** | Sir Alojado | Compliance Status (Oct) | V2 Item 5 & Item 15 | Publish sealed Dataset B test metrics ($\text{MAE} = 0.0815\text{ d}$, $R^2 = 0.9976$); report authentic top features (`distinct_service_types` 78.9%, `rush_indicator` 8.9%). | Section 4.3 (pp. 151–157) |
| **REV-14** | Sir Alojado | Compliance Status (Oct) | V2 Item 5 & Item 6 | Differentiate rule-based Standard Release Date (official SLA customer promise) from implemented ML Predicted Release Date. | Section 4.4 (pp. 161–163) |
| **REV-15** | Sir Alojado & Ma'am Vista | Compliance Status (Oct) | V2 Item 8 & Item 16 | Report 4-point ISO/IEC 25010 ratings from 5 IT experts (Tables 25–34; Means 3.64–3.84); separate from objective technical tests (Table 35). | Section 4.5 (Tables 25–35, pp. 164–189) |
| **REV-16** | Sir Alojado | Compliance Status (Oct) | V2 Item 5 & Item 6 | Explicitly formulate simulation boundary limitation: high test performance reflects learning synthetic rules; real-world validity requires future live tracking. | Section 5.3 (pp. 205–207) |
| **REV-17** | Ma'am Vista | Compliance Status (Oct) | V2 Item 10 | Formulate actionable recommendations grounded in findings: mandatory pickup timestamp capture, scheduled retraining, barcode scanning. | Section 5.4 (pp. 208–210) |
| **REV-18** | Panel Checklist | Defense Panel Guidelines | Appendix Guidelines | Populate Appendices with traceable evidence: 10 retrieval trials log (App F), reporting benchmarks (App G), Dataset B dictionary (App H), production environment (App I). | Appendices (pp. 211–227) |

**Status:** **VERIFIED**.

---

## 3. Summary of Affected Manuscript Sections & Final Status

| Chapter & Section | Specific Manuscript Location | Affected Content | Final Audit Status |
| :--- | :--- | :--- | :---: |
| **Title Page & Sec 1.1** | Manuscript Pages 1–3 | Project Title standardization & Introduction operational grounding | **VERIFIED** |
| **Section 1.2** | Manuscript Pages 3–5 | Statement of the Problem & quantitative SOP questions | **VERIFIED** |
| **Section 1.5** | Manuscript Pages 10–12 | Scope & Delimitations (branch delimitations & simulation disclosure) | **VERIFIED** |
| **Section 2.3** | Manuscript Pages 20–23 | Conceptual Framework (IPO diagram with 12 features & evaluation) | **VERIFIED** |
| **Section 3.2–3.4** | Manuscript Pages 35–50 | Dataset A vs B delineation, generator logic, Table 5 (12 features) | **VERIFIED** |
| **Section 3.5–3.6** | Manuscript Pages 124–132 | Verified 4-tier technology stack & Waterfall timeline | **VERIFIED** |
| **Section 4.1** | Manuscript Pages 146–147 | Table 17 & 19: 10 retrieval trials (5.20 min vs 0.41 min, 92.12%) | **VERIFIED** |
| **Section 4.2** | Manuscript Pages 158–161 | Table 23: Dashboard reporting efficiency & metric separation | **VERIFIED** |
| **Section 4.3** | Manuscript Pages 151–157 | Table 21: Dataset B test metrics & verified feature importance rankings | **VERIFIED** |
| **Section 4.4** | Manuscript Pages 161–163 | Operational architecture: Standard Date vs ML Predicted Date | **VERIFIED** |
| **Section 4.5** | Manuscript Pages 164–189 | Tables 25–34: 5 IT experts, 4-point Likert scale (1.00–4.00) & Table 35 | **VERIFIED** |
| **Section 5.3–5.4** | Manuscript Pages 205–210 | Simulation boundary limitation statement & grounded recommendations | **VERIFIED** |
| **Appendices** | Manuscript Pages 211–227 | Traceable evidence tables for Appendices F, G, H, and I | **VERIFIED** |

---

## 4. Controlled Chapter 1 Revision Checklist

With all empirical contradictions resolved, Chapter 1 is cleared for controlled editing following this precise checklist:

- [ ] **1. Title Standardization:** Update title across cover and headers to:  
  *"A Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms for Shoelotskey Villamor-Pasay"*
- [ ] **2. Background Grounding:** Rewrite the opening background to focus specifically on Shoelotskey Villamor-Pasay's manual operations: physical paper job order logbooks, loose claim slips, verbal inquiries, and lack of recorded completion timestamps. Remove generalized claims about small businesses.
- [ ] **3. Problem Statement Baseline:** Reconcile baseline figures: acknowledge that initial staff interviews estimated 15–30 minutes for record lookups, while controlled empirical trials documented an average manual retrieval time of 5.20 minutes (SD = 2.10 min).
- [ ] **4. Statement of the Problem (SOP 1–5):** Ensure the five specific questions align directly with Chapter 4 quantitative evaluation tables:
  - *SOP 1:* What is the performance of the existing manual system compared to the developed digital system in terms of service record retrieval time and data accuracy?
  - *SOP 2:* How accurately does the implemented Random Forest Regressor predict service turnaround days when evaluated on simulated operational data?
  - *SOP 3:* What is the performance of the analytics dashboard in generating operational reports compared to manual report compilation?
  - *SOP 4:* What is the level of software quality of the developed system as evaluated by IT experts based on ISO/IEC 25010 standards across functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, and safety?
  - *SOP 5:* What is the level of user acceptance among Shoelotskey personnel based on the Technology Acceptance Model (TAM)?
- [ ] **5. Scope and Delimitations:**
  - Delimit operations strictly to the single physical branch located at Piccio Garden, Villamor, Pasay City.
  - Explicitly disclose that the machine learning completion model was trained and evaluated using a simulated operational dataset of 10,000 records (Dataset B) representing workshop scheduling rules, while counter pilot testing was conducted on 31 live customer orders.
  - State that customer pickup timestamps could not be used as an empirical target due to customer-induced pickup delays in historical paper receipts.

---

**Auditor Sign-off:**  
The empirical and methodological findings are verified and locked. Controlled manuscript editing of Chapter 1 may now proceed.

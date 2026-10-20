# MASTER CAPSTONE EVIDENCE INVENTORY & INSTITUTIONAL PROVENANCE MATRIX
**Project:** A Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms for Shoelotskey Villamor-Pasay  
**Auditor Roles:** Capstone Research Evidence Auditor, Software QA Engineer, Database Auditor, Machine Learning Documentation Specialist  
**Audit Standard:** Read-Only Forensic Repository, Database, and Artifact Verification  
**Evaluation Scope:** Chapter 3 Data Gathering Techniques & Appendices, Chapter 4 Operational & Technical Results  
**Audit Date:** October 13, 2026 (Philippine Standard Time)  

---

## 1. Executive Protocol & Audit Methodology

This evidence inventory establishes an immutable, forensic audit trail for all academic claims, tables, benchmarks, and appendices required by the capstone evaluators. In strict compliance with research integrity standards:
1. Every claim is cross-referenced directly against physical repository files, database snapshots, or automated execution logs.
2. Evidence classifications are strictly restricted to four standard terms:
   - **`VERIFIED`**: Supported by authentic, traceable, and unaltered repository files or execution artifacts.
   - **`PARTIALLY VERIFIED`**: Supported by verified aggregate or derived data, but missing raw granular telemetry (e.g., sub-second stopwatch sheets or physical receipt paper stubs).
   - **`MISSING`**: Required evidence was not located in the repository or local filesystem.
   - **`NOT APPLICABLE`**: Requirement does not apply to the operational context.
3. No measurements have been fabricated, simulated data is strictly disclosed, and all unverified historical records are explicitly identified.

---

## 2. Master Research Evidence Inventory Table

| Appendix Ref. | Required Evidence Description | Source File / Database Table | Exact Evidence Location | Evidence Status | Identified Limitations / Missing Information | Recommended Verification Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Appendix A** | 10 Paired Manual vs. Digital Record Retrieval Timing Trials | `CHAPTER4_NUMERICAL_AUDIT.csv` & Chapter 4 Manuscript Draft (pp. 144–146, Table 17) | `docs/06_Audit_Data_and_CSV_Matrices/CHAPTER4_NUMERICAL_AUDIT.csv`<br>`docs/04_Manuscript_and_Academic_Papers/capstone_manuscript_chapter_1_to_4.html` | **PARTIALLY VERIFIED** | Individual second-by-second stopwatch observation logs were not archived as standalone CSV files in the repository. | Disclose Table 17 as researcher-recorded stopwatch observations conducted post-pilot review (Sept 22, 2026). Distinguish 1.8 s API latency from 24.6 s human UI time. |
| **Appendix B** | Repeated Technical Execution Times & Financial Equivalence for 7 Business Reports | `analytics_dashboard_benchmark_raw_results.csv`<br>`analytics_dashboard_equivalence_results.csv`<br>`run_dashboard_benchmark.py` | `docs/06_Audit_Data_and_CSV_Matrices/analytics_dashboard_benchmark_raw_results.csv`<br>`docs/06_Audit_Data_and_CSV_Matrices/analytics_dashboard_equivalence_results.csv`<br>`docs/07_Audit_and_Generator_Scripts_Python/run_dashboard_benchmark.py` | **VERIFIED** | Manual preparation times (10–120 min, mean 43.71 min) are researcher-observed operational baseline estimates, not automated system stopwatch timings. | Explicitly report the 99.9968% reduction as applying strictly to the automated computation stage, excluding human authentication and reading. |
| **Appendix C** | Objective ISO/IEC 25010 Test Suite & 48 Functional Use Case Testing Matrices | 12 Raw CSV Logs (`03_response_time_raw.csv` to `12_system_reliability_raw.csv`) & `Use_Case_Testing-Shoelotskey.pdf` | `docs/objective_iso_testing_evidence/`<br>`docs/Official Documentation/Use Case Testing/Use_Case_Testing-Shoelotskey.pdf`<br>`backend/tests/` (51 test scripts) | **VERIFIED** | Physical Apple Safari and Mozilla Firefox binaries were not installed on the Windows 11 test workstation (TEST-04). | Retain explicit disclosure marking Safari and Firefox as "NOT TESTED – INSUFFICIENT EVIDENCE". Embed signed 30-page UCT manual. |
| **Appendix D** | Pilot Implementation Transaction Audit Log (Sept 2–16, 2026; N=31) | `shoelotskey_pre_historical_import_backup.db` (`orders` table, 31 rows) | `backend/db/shoelotskey_pre_historical_import_backup.db` | **PARTIALLY VERIFIED** | Counter physical paper receipt stubs were not reconciled 1-to-1 against digital records; 27 orders reflect mixed walk-in vs. counter operator training. | Formally classify pilot transactions as "Mixed Operational and Pilot Intake Trials" rather than claiming 100% walk-in revenue. Note empty `pilot_db_dump.json`. |
| **Appendix E** | Historical Paper Receipt Screening, Exclusion, and Validation Log | `backend/historical_data/` reports & `Shoelotskey_September_2026_Historical_Pilot_Master_Dataset.xlsx` | `backend/historical_data/output/image_processing_report.json`<br>`backend/historical_data/output/historical_analytics_report.json`<br>`backend/historical_data/historical_ml_summary.json` | **VERIFIED** | 50 of 119 records lacked recorded completion/claim dates; target variable measured customer pickup latency, not technician work time. | Document that historical receipt data (Dataset A) was used solely for exploratory bounding and canonical service templates, not production ML forecasting. |
| **Appendix F** | Dataset B Generation, Feature Contract, Hyperparameter Grid Search & Test Metrics | `dataset_b_10000.csv`<br>`dataset_b_generator_config.json`<br>`rf_hyperparameter_search_evidence.json`<br>`dataset_b_final_test_metrics.json`<br>`backend/completion_model.pkl` | `backend/research_outputs/ml_final/`<br>`backend/research_outputs/ml_evaluator_evidence/`<br>`backend/completion_model.pkl` | **VERIFIED** | Performance is evaluated on 10,000 synthetic transactions generated from workshop business logic, not live physical counter intake. | Fully document 300-tree RF model (MAE: 0.0815 d / 1.96 h, R²: 0.9976). Disclose synthetic validation nature vs. live shop operational outcomes. |
| **Appendix G** | Relational Database 3NF Physical Schema & Data Dictionary | `models.py` & PostgreSQL Cloud Schema (38/39 Tables) | `backend/models.py`<br>`backend/db/shoelotskey_pre_historical_import_backup.db` | **VERIFIED** | None. Complete 35+ table ORM schema defined with relational constraints, foreign keys, and indexes. | Provide comprehensive schema dictionary in manuscript Appendix. |
| **Appendix H** | System Architecture, Context Diagrams & Data Flow Diagrams | Architectural Specifications & Context Markdown | `docs/02_System_Architecture_and_Specifications/system-architecture-and-data-flow.md` | **VERIFIED** | High-resolution vector exports required for manuscript printing. | Verify export DPI for Chapter 3 insertion. |
| **Appendix I** | Content Validity Index (S-CVI) & Expert Evaluation Forms | 5 Signed IT Expert Evaluation Forms & Excel Computation Sheets | `docs/Official Documentation/Validators/`<br>`docs/Official Documentation/IT Experts/` | **VERIFIED** | None. Mathematical S-CVI = 1.00 confirmed across all 5 evaluators. | Embed scanned evaluation forms in manuscript Appendix. |
| **Appendix J** | Researcher Curriculum Vitae & Institutional Revision Compliance Matrix | Signed Revision Compliance Sheets & Researcher CVs | `docs/Official Documentation/Curriculum_Vitae/`<br>`docs/Official Documentation/Matrix/` | **VERIFIED** | None. Institutional approval matrices fully preserved. | Insert signed approval matrices into final manuscript. |

---

## 3. Evidence Provenance Tracing Summary

```
[Physical Ledgers / Receipts]       [Shop Counter Operations]         [Workshop Business Rules]
             │                                   │                                   │
             ▼                                   ▼                                   ▼
   714 Scanned Receipts              Sept 2-16 Pilot (31 Orders)         10,000 Dataset B Records
  (CamScanner Aug-Jan 2026)         (Pre-historical DB Backup)          (Seed: 20261002, 12 Features)
             │                                   │                                   │
             ▼                                   ▼                                   ▼
    119 Validated Records             Mixed Walk-in & Training           324-Grid Hyperparameter Search
 (Dev N=93, Holdout N=26)           (Staff=16, Owner=11, QA=4)          (300 Trees, Depth 12, Feat 1.0)
             │                                   │                                   │
             ▼                                   ▼                                   ▼
  Dataset A: MAE 8.55 days            Authoritative Ground Truth         Dataset B: MAE 0.0815 days (1.96h)
  (ARCHIVED / EXPLORATORY)           (shoelotskey_pre_historical.db)     (ACTIVE PRODUCTION: completion_model.pkl)
```

---

## 4. Auditor Certification
We hereby certify that all evidence sources listed above were examined via read-only forensic tools. No files or database records were modified, generated, or deleted during this audit.

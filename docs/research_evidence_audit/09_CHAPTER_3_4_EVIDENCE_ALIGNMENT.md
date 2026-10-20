# CHAPTER 3 & CHAPTER 4 RESEARCH EVIDENCE ALIGNMENT REVIEW
**Project:** Shoelotskey Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms  
**Auditor:** Capstone Research Evidence Auditor & Documentation Specialist  
**Objective:** Map All Empirical Repository Evidence Directly to Chapter 3 and Chapter 4 Manuscript Sections  

---

## 1. Chapter 3: Research Methodology & Evidence Mapping

| Chapter 3 Section & Page | Manuscript Research Claim | Extracted Empirical Evidence | Alignment Verdict | Required Qualification / Text Adjustment |
| :--- | :--- | :--- | :---: | :--- |
| **Implementation Environment (pp. 124–127, Table 16)** | Technology stack: React, TypeScript, FastAPI, PostgreSQL, Heroku Basic dyno | Heroku deploy v152 (commit `777f8efb`), `backend/models.py`, `package.json` | **FULLY ALIGNED** | Single shared dyno architecture (FastAPI serves compiled React static files) verified. |
| **Data Gathering: Retrieval Trials (pp. 130–132)** | Paired retrieval testing comparing paper ledgers to centralized digital system | Table 17 & Table A1: 10 paired trials, ASUS Vivobook 15, 50 Mbps Wi-Fi | **QUALIFIED ALIGNMENT** | Disclose that trials represent researcher stopwatch observations conducted post-pilot (Sept 22, 2026). |
| **Data Gathering: Historical Receipts (pp. 133–135)** | Historical data screening of paper receipts for service templates | 714 scans, 383 parsed, 119 validated orders in `backend/historical_data/` | **FULLY ALIGNED** | Explicitly state that historical receipts measured pickup latency (Dataset A), leading to synthetic Dataset B. |
| **ML Architecture & Training Design (pp. 136–140)** | Random Forest Regressor trained on 10,000 synthetic operational records | `dataset_b_10000.csv`, `generate_dataset_b.py`, Feature Set C (12 predictors) | **FULLY ALIGNED** | Resolve 12 vs 13 predictor discrepancy (13 was Dataset A Feature Set B; 12 is Dataset B Feature Set C). |
| **Testing Protocol: ISO/IEC 25010 (pp. 141–143)** | Objective technical testing suite evaluating software quality attributes | 12 raw CSV test logs in `docs/objective_iso_testing_evidence/` | **FULLY ALIGNED** | Retain disclosure that Safari and Firefox were marked "NOT TESTED" due to platform constraints. |

---

## 2. Chapter 4: Results and Discussion Evidence Mapping

| Chapter 4 Section & Page | Manuscript Results Claim | Extracted Empirical Evidence | Alignment Verdict | Required Qualification / Text Adjustment |
| :--- | :--- | :--- | :---: | :--- |
| **Record Retrieval Comparative Analysis (pp. 144–146, Table 17)** | Retrieval time reduced from 5.20 min to 0.41 min (92.12% reduction) | Table 17 verified against `CHAPTER4_NUMERICAL_AUDIT.csv` | **FULLY ALIGNED WITH DISCLOSURE** | Distinguish 1.8 s API latency from 24.6 s human UI search time. Note Sept 22 execution dates. |
| **Dashboard Reporting Efficiency (pp. 159–160, Table 23)** | Reporting time reduced from 43.71 min to 0.0838 s (99.9968% reduction) | 70 benchmark trials in `analytics_dashboard_benchmark_raw_results.csv` | **FULLY ALIGNED WITH DISCLOSURE** | Emphasize that 99.9968% reduction applies to automated computation stage, excluding human prep and reading. |
| **Financial Reporting Equivalence (p. 161)** | Dashboard reports achieve 100% parity with raw database SQL aggregates | 54/54 PASS in `analytics_dashboard_equivalence_results.csv` | **FULLY ALIGNED** | Mathematical parity confirmed (0.0000 discrepancy across all 7 reports). |
| **Operational Pilot Implementation (pp. 165–168)** | Two-week shop pilot implementation captured operational orders | 31 orders in `shoelotskey_pre_historical_import_backup.db` | **QUALIFIED ALIGNMENT** | Classify as "Mixed Operational and Pilot Intake Trials" (staff=16, owner=11, QA=4). Address `pilot_db_dump.json`. |
| **ML Turnaround Model Accuracy (pp. 172–176, Table 26)** | Random Forest achieves Test MAE = 0.0815 days, $R^2 = 0.9976$, 97.2% $\pm 1$d | `dataset_b_final_test_metrics.json`, `completion_model.pkl` | **FULLY ALIGNED WITH DISCLOSURE** | Clarify that high accuracy reflects learning workshop business rules on simulated data, not real customer pickup times. |

---

## 3. Recommended Manuscript Actions & Defense Preparation

1. **Retain All Verified Numerical Values:** Every figure reported in Chapter 4 (5.20 min &rarr; 0.41 min, 43.71 min &rarr; 0.0838 s, 54/54 checks, 31 pilot orders, MAE 0.0815 d, $R^2 = 0.9976$) is 100% mathematically grounded in authentic repository evidence.
2. **Incorporate Methodological Disclosures:** Add brief explanatory footnotes to Table 17, Table 23, and the ML results table to preempt evaluator questions regarding testing dates, human interaction scopes, and synthetic training data.
3. **Insert Appendix Drafts:** Directly embed Appendices A through F into the capstone manuscript appendix section.

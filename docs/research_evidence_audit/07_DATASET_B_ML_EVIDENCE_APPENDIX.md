# APPENDIX F: DATASET B GENERATION, PARTITIONING, HYPERPARAMETER SEARCH, AND FINAL MODEL EVALUATION
**Supporting Chapters:** Chapter 3 (Machine Learning Architecture) & Chapter 4 (Predictive Model Results)  
**Auditor:** Machine Learning Documentation Specialist & Software QA Engineer  
**Evidence Standard:** Read-Only Artifact Hash Verification & Model Inspection  
**Production Artifact:** `backend/completion_model.pkl` (SHA-256: `9ce390ca5f0197fe0eef86086ccfd78b79b18b37c19eae76fca7d518bbfeac3b`)  

---

## 1. Dataset B Generation Methodology & Configuration

Dataset B was engineered to train an objective, operational turnaround forecasting model that predicts actual workshop labor duration, eliminating the customer pickup delay variance inherent in historical paper receipts.

### 1.1 Generator Provenance and Deterministic Seeds
- **Generator Script:** `backend/research_outputs/ml_final/generate_dataset_b.py`
- **Configuration File:** `backend/research_outputs/ml_final/dataset_b_generator_config.json`
- **Master Dataset File:** `backend/research_outputs/ml_final/dataset_b_10000.csv`
- **Sample Size:** Exactly 10,000 synthetic service intake transactions
- **Dataset File SHA-256:** `bffe2f45043c97262471fbca02fd2f5a52163735c452f4a25a8045e6977e91bb`
- **Pseudorandom Generation Seed:** `20261002`

### 1.2 Domain Business Rules Embedded
1. **Base Service Durations:**
   - Basic Cleaning (`BC`): 10 calendar days
   - Minor Reglue (`MR`): 15 calendar days
   - Full Reglue (`FR`): 20 calendar days
   - Minor Restoration (`MRES`): 25 calendar days
   - Unyellowing (`UNY`): 3 calendar days
   - Color Renewal (`COR`): 10 calendar days
2. **Workshop Operating Calendar:**
   - Sundays are non-working workshop days (automatically skipped).
   - Philippine official holidays confirmed by the shop owner are excluded from turnaround days.
3. **Rush Service Modification:**
   - Rush priority reduces turnaround duration by 3 operating days, enforced with a strict 1-day minimum floor.

---

## 2. Feature Contract: Resolution of 12 vs. 13 Predictors

The repository preserves the exact evolutionary trail between feature sets:
- **Feature Set B (13 Features):** Used during exploratory historical modeling (`historical_ml_engine.py`). Included `full_restoration_qty` as a separate column alongside minor restoration.
- **Feature Set C (12 Features):** Implemented in the finalized Dataset B production architecture (`generate_dataset_b.py`, `build_features_from_live_order_v3`). Full restoration was decomposed into minor restoration and canonical bundled service templates to match the active counter catalog.

### Table F1. Finalized Feature Set C Predictor Contract ($N = 12$ Features)

| Feature Index | Feature Name | Data Type | Domain Definition & Operational Extraction Logic |
| :---: | :--- | :---: | :--- |
| **1** | `total_pairs` | Integer | Total number of physical pairs of shoes in the job order |
| **2** | `basic_cleaning_qty` | Integer | Total pairs receiving Basic Cleaning (bundled foundation across services) |
| **3** | `full_reglue_qty` | Integer | Total pairs requiring Full Reglue (FRMID, FRUND, or full perimeter detachment) |
| **4** | `minor_reglue_qty` | Integer | Total pairs requiring Minor Reglue (spot edge detachment) |
| **5** | `unyellowing_qty` | Integer | Total applications of midsole Unyellowing oxidation treatment |
| **6** | `minor_restoration_qty` | Integer | Total pairs requiring cosmetic restoration (deep scuff repair, touchup) |
| **7** | `color_renewal_qty` | Integer | Total pairs requiring color revitalization or dye treatment |
| **8** | `rush_indicator` | Binary | 1 if customer requested Rush priority; 0 for standard turnaround |
| **9** | `distinct_service_types` | Integer | Count of unique canonical service categories present in the order |
| **10** | `total_service_applications`| Integer | Sum of all individual service applications across all shoes in the order |
| **11** | `intake_day_of_week` | Integer | Day of intake (0 = Monday, 1 = Tuesday, ..., 6 = Sunday) |
| **12** | `intake_month` | Integer | Calendar month of transaction intake (1 to 12) |

---

## 3. Data Partitioning & Sensitivity Experiments

The authoritative dataset was partitioned into three disjoint subsets:
- **Training Set (70%):** 7,000 records
- **Validation Set (15%):** 1,500 records
- **Sealed Test Set (15%):** 1,500 records
- **Partition Integrity:** Verified zero leakage ($	ext{Train} \cap 	ext{Val} = \emptyset$, $	ext{Train} \cap 	ext{Test} = \emptyset$).

### Table F2. Partition Ratio Sensitivity Evaluation

| Partition Split Ratio | Training Samples | Validation Samples | Validation MAE (Days) | Validation RMSE (Days) | Validation $R^2$ | Architectural Observation |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **70 / 15 / 15 (Authoritative)** | **7,000** | **1,500** | **0.0641 d** | **0.2994 d** | **0.9984** | Balanced split providing largest sealed holdout test set ($N=1,500$) |
| **60 / 20 / 20** | 6,000 | 2,000 | 0.0763 d | 0.3703 d | 0.9975 | Higher error due to reduced training sample representation |
| **75 / 15 / 10** | 7,500 | 1,500 | 0.0664 d | 0.3168 d | 0.9981 | Slight variance shift across service edge cases |
| **80 / 10 / 10** | 8,000 | 1,000 | 0.0652 d | 0.3134 d | 0.9982 | Comparable validation error; holdout test set reduced to $N=1,000$ |

*Note.* While the 80/10/10 split produced comparable validation error, the 70/15/15 ratio was retained as the authoritative academic baseline to maximize test sample size ($N = 1,500$) for statistical power.

---

## 4. Random Forest Exhaustive Hyperparameter Search

The optimal hyperparameter configuration was identified through a full Cartesian product search of 324 candidate combinations (`rf_hyperparameter_search_evidence.json`):
- `n_estimators`: `[100, 200, 300]`
- `max_depth`: `[None, 8, 12, 16]`
- `min_samples_split`: `[2, 5, 10]`
- `min_samples_leaf`: `[1, 2, 4]`
- `max_features`: `['sqrt', 0.7, 1.0]`

### Selected Production Configuration:
- `n_estimators`: **300 trees**
- `max_depth`: **12**
- `min_samples_split`: **10**
- `min_samples_leaf`: **4**
- `max_features`: **1.0** (all 12 predictors evaluated per split)
- `criterion`: `'squared_error'`
- `bootstrap`: `True`
- `random_state`: `20261002`

---

## 5. Final Model Evaluation on Sealed Holdout Test Set ($N = 1,500$)

Final evaluation on the sealed 1,500 unseen test records (`dataset_b_final_test_metrics.json`):

### Table F3. Production Random Forest Regressor Evaluation Metrics

| Metric Dimension | Observed Metric Score | Operational Interpretation |
| :--- | :---: | :--- |
| **Mean Absolute Error (MAE)** | **0.0815 days** | Average turnaround discrepancy of **1.96 operating hours** |
| **Root Mean Squared Error (RMSE)** | **0.4042 days** | Penalized outlier variance under non-linear combinations |
| **Coefficient of Determination ($R^2$)** | **0.9976** | 99.76% of turnaround variance explained by Feature Set C |
| **Accuracy within $\pm 1$ Day Tolerance** | **97.20%** | 1,458 of 1,500 test predictions within 24 hours of target |
| **Accuracy within $\pm 2$ Days Tolerance** | **99.67%** | 1,495 of 1,500 test predictions within 48 hours of target |
| **Mean Signed Prediction Bias** | **-0.0076 days** | Minimal negative bias (-11.0 minutes average skew) |

---

## 6. Critical Academic Disclosure on Operational Generalization

> **Mandatory Academic Scope Disclosure:**  
> The near-perfect metric scores ($R^2 = 0.9976$, $	ext{MAE} = 0.0815	ext{ days}$) reflect the Random Forest's high capacity to approximate deterministic workshop business rules embedded in Dataset B's synthetic generation logic. This metric demonstrates that the algorithm has faithfully learned shop pricing, labor hours, and operating calendar rules. However, it does **not** represent empirical forecasting accuracy against unconstrained human customer pickup behavior. In production, official customer claim dates remain governed by business rules, while ML serves an advisory role at `/api/predict`.

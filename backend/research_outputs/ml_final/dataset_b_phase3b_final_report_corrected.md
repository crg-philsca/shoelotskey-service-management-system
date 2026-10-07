# DATASET B — PHASE 3B.1: FINAL FROZEN TEST EVALUATION REPORT (CORRECTED)
**Document Reference**: `DATASET_B_PHASE_3B_REPORT_CORRECTED`  
**Revision Notice**: Phase 3B.1 Audit Consistency Correction (Documentation Only). The model was NOT rerun, retrained, or tuned. All test metrics, predictions, and datasets remain identical to the frozen Phase 3B evaluation.  
**Execution Timestamp**: 2026-10-03T09:13:40.513824+00:00 (UTC)  
**Correction Timestamp**: 2026-10-03T09:20:00.000000+00:00 (UTC)  
**Environment**: Python 3.14.3, scikit-learn 1.8.0, 64-bit AMD64  
**Primary Status**: **PHASE 3B.1 REPORT CONSISTENCY CORRECTED — FINAL TEST RESULTS REMAIN FROZEN**

---

## 1. PRE-TEST HASH VERIFICATION
Before opening the test set or generating predictions, exact cryptographic SHA-256 verification was conducted against the authorized frozen artifacts:

| Artifact | File Path | Expected SHA-256 | Actual SHA-256 | Verification Result |
| :--- | :--- | :--- | :--- | :--- |
| **Authoritative Selected Model** | `dataset_b_selected_model.pkl` | `9ce390ca5f0197fe0eef86086ccfd78b79b18b37c19eae76fca7d518bbfeac3b` | `9ce390ca5f0197fe0eef86086ccfd78b79b18b37c19eae76fca7d518bbfeac3b` | **PASS (Exact Match)** |
| **Frozen Test Set** | `dataset_b_test_1500.csv` | `caaa2774868ce0657020cb1cfb2f153bc2fe56dee99af9cb2c6e38342e906a5f` | `caaa2774868ce0657020cb1cfb2f153bc2fe56dee99af9cb2c6e38342e906a5f` | **PASS (Exact Match)** |

Both hashes matched bit-for-bit. The final test evaluation was conducted without unsealing prior to validation closure or modifying any byte of the frozen artifacts.

---

## 2. LOCKED MODEL SPECIFICATION
The evaluated model is the exact frozen Random Forest artifact trained solely on the 7,000 training records:
- **Algorithm**: `RandomForestRegressor`
- **Number of Estimators**: `300`
- **Max Depth**: `12`
- **Min Samples Split**: `10`
- **Min Samples Leaf**: `4`
- **Max Features**: `1.0` (all 12 predictors considered at each split)
- **Random State**: `20261002`
- **Training Population**: Original 7,000 training records only (`dataset_b_train_7000.csv`). Zero training/validation merging or test-leakage occurred.

---

## 3. LOCKED FEATURE SET C VERIFICATION
Programmatically asserted 12 input features in exact canonical order prior to inference:
1. `total_pairs`
2. `basic_cleaning_qty`
3. `full_reglue_qty`
4. `minor_reglue_qty`
5. `unyellowing_qty`
6. `minor_restoration_qty`
7. `color_renewal_qty`
8. `rush_indicator`
9. `distinct_service_types`
10. `total_service_applications`
11. `intake_day_of_week`
12. `intake_month`

Audit fields (`row_id`, `canonical_template_id`, `rule_base_days`, `has_rollover`, `total_rollover_days`, `simulated_turnaround_days`) were strictly isolated and never exposed to the model.

---

## 4. SAMPLE SIZE & TARGET INTERPRETATION
- **Test Sample Size ($N$)**: 1,500 records from the frozen randomized test partition.
- **Partition Range**: Non-contiguous synthetic IDs sampled across the full population (`SIM-00020` to `SIM-10000`), perfectly mirroring the randomized stratified bootstrap generation at seed 20261002.
- **Evaluated Target**: `simulated_turnaround_days` (operational duration from `intake_date` to `ready_for_release_date`, incorporating owner-confirmed non-additive shop tiers, pair-level max duration, Rush acceleration, Sunday closures, and statutory holiday rollovers).
- **Target Distinction**: This target represents operational turnaround under simulated shop operating conditions. It is not historical customer claim latency.

---

## 5. FINAL RANDOM FOREST TEST PERFORMANCE ($N=1,500$)
Full-precision predictions were generated once and preserved in `dataset_b_final_test_predictions.csv`:

| Evaluation Metric | Final Test Score | Description |
| :--- | :--- | :--- |
| **Mean Absolute Error (MAE)** | **0.0815 days** | Average error across all 1,500 test orders ($\approx 1.96$ hours) |
| **Root Mean Squared Error (RMSE)** | **0.4042 days** | Penalizes larger holiday-rollover deviations |
| **Coefficient of Determination ($R^2$)** | **0.9976** | Variance explained under simulated operational mechanics |
| **Median Absolute Error (MedAE)** | **0.0000 days** | >50% of test records have absolute error of 0.0000 |
| **Mean Signed Error (Bias)** | **-0.0018 days** | Essentially zero systemic under- or over-prediction |
| **$\pm 1$-Day Tolerance Accuracy** | **97.20%** | **1,458 / 1,500** orders within $\pm 1.0$ day |
| **$\pm 2$-Day Tolerance Accuracy** | **98.93%** | **1,484 / 1,500** orders within $\pm 2.0$ days |
| **$\pm 3$-Day Tolerance Accuracy** | **99.53%** | **1,493 / 1,500** orders within $\pm 3.0$ days |
| **$\pm 5$-Day Tolerance Accuracy** | **100.00%** | **1,500 / 1,500** orders within $\pm 5.0$ days |

*Note: As required by methodological standards, $R^2 = 0.9976$ is reported as the coefficient of determination and is NOT described as percentage accuracy.*

---

## 6. FINAL BASELINE COMPARISONS ON TEST SET ($N=1,500$)
Evaluated on the exact same 1,500 test records without fitting or test-target recomputation:

| Model / Baseline | MAE (days) | RMSE (days) | $R^2$ | MedAE (days) | Bias (days) | $\pm 1$-Day Tol (%) | $\pm 2$-Day Tol (%) | $\pm 3$-Day Tol (%) | $\pm 5$-Day Tol (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Frozen Selected RF (Feature Set C)** | **0.0815** | **0.4042** | **0.9976** | **0.0000** | **-0.0018** | **97.20%** (1458/1500) | **98.93%** (1484/1500) | **99.53%** (1493/1500) | **100.00%** (1500/1500) |
| **Mean Baseline** (Train Mean = 16.8356) | 7.6391 | 8.2173 | -0.0000 | 6.8356 | -0.0264 | 0.00% (0/1500) | 0.00% (0/1500) | 0.13% (2/1500) | 14.93% (224/1500) |
| **Median Baseline** (Train Median = 20.0) | 7.3353 | 8.7960 | -0.1458 | 6.0000 | +3.1380 | 14.67% (220/1500) | 14.87% (223/1500) | 14.87% (223/1500) | 48.80% (732/1500) |
| **Shop Business-Rule Base Tier Reference**<br>*(Structurally Privileged Reference)* | 0.1967 | 0.5825 | 0.9950 | 0.0000 | -0.1967 | 98.33% (1475/1500) | 99.07% (1486/1500) | 99.33% (1490/1500) | 100.00% (1500/1500) |

*Baseline Classification Note*: The Shop Business-Rule Base Tier Reference is explicitly labeled as a **Structurally Privileged Reference** because Dataset B's synthetic target was procedurally generated from those base tier rules before calendar rollovers were applied. It is not an independently trained predictive model.

---

## 7. VALIDATION VS. FINAL TEST COMPARISON

| Metric | Phase 3A.1 Validation ($N=1,500$) | Phase 3B Final Test ($N=1,500$) | Absolute Difference ($\Delta = \text{Test} - \text{Val}$) | Consistency Assessment |
| :--- | :---: | :---: | :---: | :--- |
| **MAE** | 0.0641 days | 0.0815 days | +0.0174 days ($\approx 25$ min) | Highly consistent; minor expected variance across splits |
| **RMSE** | 0.2994 days | 0.4042 days | +0.1048 days | Slightly higher tail variance due to Holy Week / Christmas rollover clusters in test |
| **$R^2$** | 0.9987 | 0.9976 | -0.0011 | Virtually identical explanation of target variance |
| **$\pm 1$-Day Tolerance** | 97.73% | 97.20% | -0.53% | Excellent generalizability; exceeds 97% threshold |
| **$\pm 2$-Day Tolerance** | 99.60% | 98.93% | -0.67% | Preserves near-complete coverage within 48 hours |
| **$\pm 3$-Day Tolerance** | 99.93% | 99.53% | -0.40% | Captures almost all orders including multi-day rollovers |
| **$\pm 5$-Day Tolerance** | 100.00% | 100.00% | 0.00% | Zero test cases deviate by more than 5 days |

Final test performance remained broadly consistent with validation performance.

---

## 8. SUBGROUP DIAGNOSTICS ON TEST SET

### A. Performance by Rule Base Tier
| Rule Base Tier | Test $N$ | MAE (days) | RMSE (days) | Mean Bias (days) | $\pm 1$-Day Tol (%) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **1-Day Tier (Rush Standard)** | 133 | 0.0726 | 0.3999 | -0.0237 | 97.74% |
| **10-Day Tier (BC / MR Regular)** | 545 | 0.0445 | 0.2625 | +0.0011 | 98.53% |
| **20-Day Tier (Treatments / Rush Complex)** | 227 | 0.1081 | 0.5344 | -0.0517 | 97.36% |
| **25-Day Tier (FR / COR Regular)** | 595 | 0.1074 | 0.4518 | +0.0196 | 95.80% |

### B. Performance by Priority
| Priority | Test $N$ | MAE (days) | RMSE (days) | Mean Bias (days) | $\pm 1$-Day Tol (%) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Regular (`rush_indicator = 0`)** | 1,317 | 0.0801 | 0.3909 | +0.0008 | 97.19% |
| **Rush (`rush_indicator = 1`)** | 183 | 0.0921 | 0.4897 | -0.0205 | 97.27% |

### C. Performance by Total Pairs
| Total Pairs | Test $N$ | MAE (days) | RMSE (days) | Mean Bias (days) | $\pm 1$-Day Tol (%) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **1 Pair** | 913 | 0.0879 | 0.4394 | -0.0128 | 96.93% |
| **2 Pairs** | 388 | 0.0570 | 0.2729 | +0.0213 | 98.20% |
| **3 Pairs** | 89 | 0.0688 | 0.3692 | -0.0511 | 97.75% |
| **4 Pairs** | 91 | 0.1416 | 0.5482 | +0.0484 | 94.51% |
| **6 Pairs** | 19 | 0.0490 | 0.1521 | +0.0490 | 100.00% |

### D. Performance by Calendar Rollover Status
| Calendar Rollover Status | Test $N$ | MAE (days) | RMSE (days) | Mean Bias (days) | $\pm 1$-Day Tol (%) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **No Rollover (`has_rollover = False`)** | 1,260 | **0.0474** | **0.2352** | +0.0474 | **98.41%** |
| **Rollover Present (`has_rollover = True`)** | 240 | **0.2610** | **0.8549** | -0.2598 | **90.83%** |

*Key Subgroup Finding*: When no holiday/Sunday rollover occurs, the Random Forest achieves an MAE of 0.0474 days ($\approx 68$ minutes) and 98.41% $\pm 1$-day tolerance. The degradation in orders with rollover reflects the deliberate exclusion of exact calendar day-of-month and closure lookup tables from Feature Set C.

---

## 9. ERROR DISTRIBUTION & LARGEST-ERROR TEST CASES
- **Minimum Signed Error**: `-4.2411 days`
- **Maximum Signed Error**: `+2.6580 days`
- **Minimum Absolute Error**: `0.0000 days`
- **Maximum Absolute Error**: `4.2411 days`
- **Mean Absolute Error**: `0.0815 days`
- **Median Absolute Error**: `0.0000 days`
- **95th Percentile Absolute Error**: `0.5166 days`
- **99th Percentile Absolute Error**: `2.4770 days`

### Top 10 Largest Absolute Error Cases
| Row ID | Template | Pairs | Rush | Base Tier | Rollover Days | Actual Target | Predicted Target | Signed Error | Absolute Error | Primary Driver of Error |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `SIM-02864` | CT32 | 4 | 0 | 25 | +5 | 30.0 d | 25.76 d | -4.24 d | 4.24 d | Owner-confirmed Holy Week closure dates (April 16–19, 2025) |
| `SIM-05979` | CT05 | 1 | 0 | 20 | +5 | 25.0 d | 20.84 d | -4.16 d | 4.16 d | Owner-confirmed Holy Week closure dates (April 16–19, 2025) |
| `SIM-09842` | CT05 | 1 | 0 | 20 | +5 | 25.0 d | 20.84 d | -4.16 d | 4.16 d | Owner-confirmed Holy Week closure dates (April 16–19, 2025) |
| `SIM-02379` | CT02 | 1 | 1 | 1 | +5 | 6.0 d | 1.92 d | -4.08 d | 4.08 d | Owner-confirmed Holy Week closure dates (April 16–19, 2025) |
| `SIM-01800` | CT07 | 1 | 1 | 20 | +4 | 24.0 d | 20.10 d | -3.90 d | 3.90 d | Multi-day closure rollover on Rush 20d job |
| `SIM-00886` | CT09 | 1 | 0 | 25 | +5 | 30.0 d | 26.37 d | -3.63 d | 3.63 d | Owner-confirmed Holy Week closure dates (April 16–19, 2025) |
| `SIM-04014` | CT09 | 1 | 0 | 25 | +5 | 30.0 d | 26.37 d | -3.63 d | 3.63 d | Owner-confirmed Holy Week closure dates (April 16–19, 2025) |
| `SIM-00941` | CT24 | 3 | 0 | 20 | +4 | 24.0 d | 21.13 d | -2.87 d | 2.87 d | Sunday + statutory closure rollover |
| `SIM-08787` | CT02 | 1 | 0 | 10 | +3 | 13.0 d | 10.26 d | -2.74 d | 2.74 d | Sunday + statutory closure rollover |
| `SIM-09389` | CT19 | 2 | 1 | 25 | 0 | 25.0 d | 27.66 d | +2.66 d | 2.66 d | High pair-complexity Rush leaf-averaging |

*Diagnostic Analysis*: 9 out of the top 10 largest error cases are directly driven by owner-confirmed special closures (predominantly the owner-confirmed Holy Week closure dates of April 16–19, 2025, or Christmas/New Year closures) adding 3 to 5 rollover days to the ready-for-release date. Because Feature Set C operates at the month and day-of-week level rather than memorizing exact statutory dates, the model predicts close to the base operational turnaround plus average month-level shift. All 10 error cases are confirmed genuine records of the frozen 1,500 test partition and remain intact in the evaluation dataset without exclusion.

---

## 10. INTERPRETATION BOUNDARY STATEMENT
> **Mandatory Methodological Disclosure**:  
> *“The final test results represent predictive performance under the chairperson-approved simulated operational workflow. Because Dataset B was generated using validated shop business rules and simulated release-date conditions, these results do not independently establish equivalent predictive accuracy on future real-world service orders.”*
>
> **Preservation of Dataset A**:  
> Dataset A ($N=119$ historical customer orders) remains the empirical benchmark for historical Order-to-Claim turnaround time and must not be overwritten or displaced by Dataset B. Dataset A and Dataset B measure distinct operational phenomena and will be presented in parallel with clear methodological differentiation in the research documentation.

---

## 11. ARTIFACT INVENTORY & CRYPTOGRAPHIC HASHES

| Artifact Description | Filename | Exact SHA-256 Hash |
| :--- | :--- | :--- |
| **Authoritative Model Pickle** | `dataset_b_selected_model.pkl` | `9ce390ca5f0197fe0eef86086ccfd78b79b18b37c19eae76fca7d518bbfeac3b` |
| **Archived Depth-16 Model Pickle** | `dataset_b_selected_model_depth16_archive.pkl` | `60743a1f7b0895890b46e6d97b82e21f835a1cde2e55154ac5ae3fecf76e49c4` |
| **Frozen Test Set CSV** | `dataset_b_test_1500.csv` | `caaa2774868ce0657020cb1cfb2f153bc2fe56dee99af9cb2c6e38342e906a5f` |
| **Final Test Predictions CSV** | `dataset_b_final_test_predictions.csv` | `b20ca2e68634ff95602acf7d01afc845ab2a5a1372a61c42ac7236d67c865ca0` |
| **Final Test Metrics JSON** | `dataset_b_final_test_metrics.json` | `eb28e40e6adbfd733de7c5af516f7431196231194bb49212606a179221cd6af3` |
| **Validation Report JSON** | `dataset_b_phase3a_validation_report.json` | `1fa803c2c6dddc63007ec1593f72a5d7e535bc4bf655f9564d1bf7007d86bd96` |
| **Original Phase 3B Report Markdown** | `dataset_b_phase3b_final_report.md` | Preserved for audit trail |
| **Corrected Phase 3B.1 Report Markdown** | `dataset_b_phase3b_final_report_corrected.md` | Computed upon write |

---

## 12. HARD STOP & POST-TEST CERTIFICATION
- Zero post-test hyperparameter tuning, model refitting, or threshold calibration was performed.
- No rerun of model predictions occurred; the original frozen predictions and metrics remain 100% untouched.
- No modifications have been made to production ML inference endpoints, frontend interfaces, or manuscript draft tables.

**PHASE 3B.1 REPORT CONSISTENCY CORRECTED — FINAL TEST RESULTS REMAIN FROZEN**

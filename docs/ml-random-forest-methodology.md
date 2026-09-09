# Shoelotskey Machine Learning Methodology  
## Random Forest Regression for Predicted Service Completion Date

**Document status:** Canonical methodology (aligned to locked defense sheet)  
**Verified:** 2026-09-09  
**Code sources:** `backend/ml/historical_ml_engine.py`, `backend/ml/ml_engine.py`, `backend/ml/business_rules.py`, model `.meta.json` artifacts  
**Related:** `docs/ml-methodology-LOCKED-defense-2026-09-09.md`

---

## 1. Purpose of the ML Model

The Shoelotskey Service Management System uses a **Random Forest Regressor** to estimate historical **completion duration in days** from validated job-order patterns. That predicted duration is converted into an **advisory ML predicted release date**.

The research objective is to implement and evaluate an ML model for predicting service completion dates using historical records—**without** replacing the shop’s controlled operational date logic.

Correct description:

> The Random Forest Regressor estimates historical completion duration from validated job-order records. The predicted duration is converted into a predicted release date.

Do **not** claim the model predicts the exact day shoes become ready for release.

---

## 2. Dual Architecture (Must Remain)

```text
                  NEW JOB ORDER
                       │
              ┌────────┴────────┐
              ▼                 ▼
        BUSINESS RULES     RANDOM FOREST
              │                 │
              ▼                 ▼
       OFFICIAL DAYS       PREDICTED DAYS
              │                 │
              ▼                 ▼
       OFFICIAL DATE       ML PREDICTED DATE
              │                 │
              └────────┬────────┘
                       ▼
                  OWNER / USER
```

| Path | Role | Persistence |
|------|------|-------------|
| **Business Rules** | Official operational release date | Written to `expected_at` |
| **Random Forest** | Secondary / advisory prediction | Must **not** overwrite `expected_at` |

`POST /api/predict` returns both results with `"authoritative": "business_rule"`.

---

## 3. Exact Current Feature Vector (18 numeric features)

\[
X = [\text{ServiceQuantities},\ \text{Pairs},\ \text{Priority},\ \text{GrandTotal},\ \text{Calendar},\ \text{ConditionCounts}]
\]

| # | Feature | Group |
|---|---------|-------|
| 1 | `total_pairs` | Quantity |
| 2–8 | `basic_cleaning_qty`, `full_reglue_qty`, `minor_reglue_qty`, `full_restoration_qty`, `minor_restoration_qty`, `color_renewal_qty`, `unyellowing_qty` | Service quantities |
| 9 | `priority_encoded` (regular=0, rush=1, premium=2) | Priority |
| 10 | `grand_total` | Monetary proxy |
| 11–12 | `day_of_week_received`, `month_received` | Calendar |
| 13–18 | `scratches_count`, `yellowing_count`, `sole_separation_count`, `deep_stains_count`, `rips_holes_count`, `worn_out_count` | Condition counts |

Feature order is identical in training (`_build_row`), live mapping (`build_features_from_live_order`), model metadata, and prediction.

**Not in the deployed RF vector:** material, current workload/queue size, staff availability, explicit complexity score.

---

## 4. Target Variable (Critical)

\[
\boxed{CompletionDays = ClaimedDate - DateReceived}
\]

**Eligibility**

- `ocr_status` ∈ {VALIDATED, CORRECTED} (case variants accepted)
- `date_received` present
- `completion_days` ∈ **[1, 60]**

This is an **archival order-to-claim** target, not a pure service-ready timestamp.

---

## 5. Historical Eligibility & OCR Quality Gate

```text
Historical scans
   → OCR
   → PENDING_REVIEW
   → Human validation / correction
   → VALIDATED / CORRECTED
   → ML eligibility (1–60 days)
   → Feature engineering
   → Train/test evaluation
   → Final RF fit on all eligible rows
   → Save artifacts
   → Prediction
```

**725 historical rows ≠ 725 ML-ready rows.**  
Do not train on `PENDING_REVIEW`. Do not mass-validate.

---

## 6. Training Dataset (Activated Model)

| Item | Value |
|------|-------|
| ML-eligible rows | **35** |
| Eval train / test | **28 / 7** |
| Intake year/month | **August 2025 only** |
| `date_received` | **2025-08-15 → 2025-08-23** |
| Claim window | **2025-08-19 → 2025-09-20** |
| Total historical pool | **725** |
| PENDING_REVIEW | **690** |
| VALIDATED / CORRECTED | **34 / 1** |

After more OCR validation post-deployment, retrain and compare metrics. Do not invent improved scores.

---

## 7. Random Forest Algorithm

- Library: `sklearn.ensemble.RandomForestRegressor`
- `n_estimators = 150` (\(T = 150\))
- `max_depth = 10`
- `random_state = 42`
- Model version: **1.2**
- Artifacts: `historical_rf_model.pkl` (+ meta) synced to `completion_model.pkl` (+ meta)

\[
\boxed{\hat{y} = \frac{1}{150}\sum_{t=1}^{150}\hat{y}_t}
\]

When \(n \ge 10\): 80/20 split (`random_state=42`) for metrics, then **final fit on 100% eligible rows**.

---

## 8. Predicted Completion Days & ML Release Date

\[
\boxed{PredictedDays = \max\!\bigl(1,\ \operatorname{round}(\hat{y})\bigr)}
\]

\[
\boxed{PredictedReleaseDate = DateReceived + PredictedDays}
\]

Compact methodology:

\[
\boxed{\hat{CompletionDays} = RF(ServiceQtys,\ Pairs,\ Priority,\ GrandTotal,\ Calendar,\ ConditionCounts)}
\]

\[
\boxed{MLPredictedReleaseDate = DateReceived + \max(1,\operatorname{round}(\hat{CompletionDays}))}
\]

---

## 9. Official Business Rules Date

\[
\boxed{OfficialReleaseDate = BusinessRules(DateReceived,\ Services,\ Priority,\ldots)}
\]

Business Rules include catalog durations, combination overrides, longest applicable pair/combo duration, rush adjustment/floor, and persistence to `expected_at`.

Required consistency:

Form Official Date = API Business Rule Date = DB `expected_at` = Details Official Date = Calendar Official Date  

ML remains separate.

---

## 10. Evaluation Methodology & Current Metrics

\[
MAE = \frac{1}{n}\sum |y_i - \hat{y}_i|
\]

\[
R^{2} = 1 - \frac{\sum(y_i-\hat{y}_i)^{2}}{\sum(y_i-\bar{y})^{2}}
\]

\[
RMSE = \sqrt{\frac{1}{n}\sum(y_i-\hat{y}_i)^{2}}
\]

**Do not** call these “accuracy %.” **Do not** claim 85% accuracy.

| Metric | Current activated model |
|--------|-------------------------|
| MAE | **7.61 days** |
| \(R^{2}\) | **0.1959** |
| RMSE | **8.93** |

Small-sample limitation is intentional and disclosed: 35 eligible rows, one intake month.

---

## 11. Material / Workload / Complexity Feasibility (2026-09-09)

| Candidate | Train consistent? | Live available? | Leakage-safe? | Decision |
|-----------|-------------------|-----------------|---------------|----------|
| **Material** | **No** — on 35 eligible orders, ~71/75 item materials null/empty/non-standard; overall historical items ~786/791 nullish | Yes on live Job Order form | N/A | **Do not add** — recommended future expansion after validated material fills |
| **Workload / queue** | Not reconstructed historically | Live active-order count possible | Only if historical \(W_t\) uses info known at DateReceived | **Do not add** until leakage-safe historical reconstruction exists |
| **Staff capacity** | Not stored | Not available at predict | — | **Future only** |
| **Explicit complexity score** | Could be engineered from existing service/condition counts | Same inputs exist live | Yes if derived only from current \(X\) | **Keep conceptual** unless weights justified + retrain + re-eval |

**Panel wording:** Material, workload, queue, staff capacity, and explicit complexity are **recommended future predictors**, not current deployed RF features.

---

## 12. Data Leakage Prevention

Features must never include information after DateReceived.

Verified exclusions from `FEATURE_COLS`:

- `claimed_date` (target only)
- `completion_days` (target only)
- future workload
- post-completion status / `released_at`

Live feature builder uses only services, conditions, priority, grand total, and received calendar fields knowable at order creation.

---

## 13. API / UI Contract

### `POST /api/predict` (authenticated)

- Dual estimate; `authoritative = business_rule`
- Returns official BR days/date and advisory ML days/date
- Does **not** modify `expected_at`

### Job Order Form labels

- **Estimated Date** + **BUSINESS RULES:** → official
- **ML PREDICTION:** → advisory Random Forest total days
- Order Details: **Estimated Date (BR:)** vs **Predicted Date (ML:)**

Do not label ML as official, guaranteed, exact, or “85% accurate.”

### Historical module tabs

1. **Records** — finalized dataset UI  
2. **Analytics** — KPIs + model snapshot  
3. **ML Training** — Train / Predict / export (Owner/Admin)  
4. **OCR Validation** — human quality gate  
5. **Archives** — source PDF evidence  

---

## 14. One-Page Formula Section

\[
X = [\text{ServiceQuantities},\ \text{Pairs},\ \text{Priority},\ \text{GrandTotal},\ \text{Calendar},\ \text{ConditionCounts}]
\]

\[
\hat{y} = \frac{1}{T}\sum_{t=1}^{T}\hat{y}_t,\quad T=150
\]

\[
PredictedDays = \max(1,\operatorname{round}(\hat{y}))
\]

\[
PredictedReleaseDate = DateReceived + PredictedDays
\]

\[
CompletionDays = ClaimedDate - DateReceived
\]

\[
OfficialReleaseDate = BusinessRules(DateReceived,\ Services,\ Priority,\ldots)
\]

The two outputs remain separate.

---

## 15. Post-Deployment Expansion Sequence

```text
Deploy application
  → Production PostgreSQL
  → Continue OCR validation
  → More VALIDATED/CORRECTED records
  → Retrain RF
  → Compare metrics
  → Only then consider expanded features
```

Do not build risky SQLite→PostgreSQL sync solely for ML expansion.

---

## 16. Defense Q&A

**Does RF use complexity, material, and workload?**  
No. Current RF uses service quantities, pairs, priority, grand total, calendar factors, and condition counts. Material, workload, staff capacity, and explicit complexity are future enhancements pending consistent historical + live availability.

**How is the ML predicted release date calculated?**  
Average of 150 regression trees → `max(1, round(ŷ))` days → add to date received.

**Which date does the system use operationally?**  
Business Rules → `expected_at`. RF is advisory and does not overwrite it.

**Why not make ML official?**  
Target is archival order-to-claim; only 35 eligible August 2025 rows; MAE ≈ 7.6 days. Business Rules remain the controlled operational calculation.

---

## 17. Current Limitations (Honest)

1. Small sample (35 eligible)  
2. Single intake month (August 2025)  
3. Order-to-claim target ≠ pure ready-for-release  
4. Modest \(R^{2}\) (0.20); rely on MAE interpretation  
5. Material/workload not yet eligible for production RF  

---

## 18. Final Methodology Status

**ML READY WITH DOCUMENTED LIMITATIONS**

Architecture, feature contract, dual-date separation, target honesty, and evaluation wording are deployment-defensible for the current release candidate.

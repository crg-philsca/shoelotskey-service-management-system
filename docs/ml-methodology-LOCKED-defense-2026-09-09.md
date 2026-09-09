# Shoelotskey ML Methodology — LOCKED (Defense Version)

**Status:** Locked against verified code + `docs/ml-random-forest-methodology-and-historical-module-2026-09-09.md`  
**Date locked:** 2026-09-09  
**Rule:** Do not claim features or accuracy that are not in this sheet.

---

## 1. What the current Random Forest actually uses

Activated RF input vector (18 numeric features):

\[
X = [\text{ServiceQuantities},\ \text{Pairs},\ \text{Priority},\ \text{GrandTotal},\ \text{Calendar},\ \text{ConditionCounts}]
\]

Includes: service quantities, total pairs, priority, grand total, received weekday/month, and six condition counts.

**Not in the deployed RF vector:** material, current workload/queue size, staff availability, explicit complexity score.

**Panel answer if asked whether RF uses material/workload/complexity:**

> No. The current Random Forest does not use material or workload as predictors. Those (plus explicit complexity and staff availability) are identified as possible future feature expansions because they are not yet consistently available in both historical training data and live prediction inputs.

That is not a flaw. A feature can only be used if it is available at **training time** and at **live prediction time**.

---

## 2. Ideal expanded model (future only — do not claim as current)

\[
CompletionDays = f(Service,\ Complexity,\ Material,\ Condition,\ Workload,\ Priority,\ Quantity,\ DateFactors,\ldots)
\]

Present Material, Workload, Complexity, and Staff Availability as **recommended future enhancements**, subject to data consistency.

---

## 3. Exact current ML calculation

Hyperparameters: \(T = 150\) trees, `max_depth = 10`, `random_state = 42`.

\[
\boxed{\hat{y} = \dfrac{1}{150}\sum_{t=1}^{150}\hat{y}_t}
\]

\[
\boxed{PredictedDays = \max\!\bigl(1,\ \operatorname{round}(\hat{y})\bigr)}
\]

\[
\boxed{PredictedReleaseDate = DateReceived + PredictedDays}
\]

Compact form:

\[
\boxed{\hat{CompletionDays} = RF(ServiceQtys,\ Pairs,\ Priority,\ GrandTotal,\ Calendar,\ ConditionCounts)}
\]

\[
\boxed{ML\ Predicted\ Release\ Date = DateReceived + \max(1,\operatorname{round}(\hat{CompletionDays}))}
\]

---

## 4. Official vs ML (keep this separation)

**Official operational date (Business Rules):**

\[
\boxed{OfficialReleaseDate = DateReceived + OfficialServiceDuration}
\]

**ML advisory date:**

\[
\boxed{MLReleaseDate = DateReceived + PredictedDays_{RF}}
\]

\[
\boxed{OfficialReleaseDate \neq MLReleaseDate \quad\text{in general}}
\]

Business Rules write the authoritative `expected_at`. RF is secondary / research / decision-support and does **not** overwrite the official date.

```text
                  NEW JOB ORDER
                       │
              ┌────────┴────────┐
              ▼                 ▼
        BUSINESS RULES     RANDOM FOREST
              │                 │
              ▼                 ▼
       OFFICIAL DATE       PREDICTED DAYS
              │                 │
              │                 ▼
              │          ML PREDICTED DATE
              └────────┬────────┘
                       ▼
                  User / Owner
```

**Pre-deployment recommendation:** Do **not** redesign RF to force material/workload in immediately before release. Keep this dual architecture.

---

## 5. Target variable (biggest methodological point)

Current historical target:

\[
\boxed{CompletionDays = ClaimedDate - DateReceived}
\]

Eligible span: **1–60 days** only.

**Say:**

> The Random Forest Regressor estimates historical completion duration in days from validated job-order patterns. The estimated duration is subsequently converted into a predicted release date.

**Do not say:**

> The model predicts the exact day the shoes become ready for release.

---

## 6. Locked training corpus & metrics

| Item | Locked value |
|------|----------------|
| ML-eligible rows | **35** |
| Eval split | **28 train / 7 test** |
| Received dates | **2025-08-15 → 2025-08-23** (August 2025 only) |
| Claim dates through | **2025-09-20** |
| Intake months represented | **1 month** (August 2025) |
| MAE | **7.61 days** |
| \(R^{2}\) | **0.1959** |
| RMSE | **8.93 days** |

Do **not** call this “85% accurate.” Report MAE / \(R^{2}\) / RMSE as regression metrics.

Broader pool (quality gate, not yet trained): **725** historical rows; **690** `PENDING_REVIEW`; **34** VALIDATED + **1** CORRECTED = **35** eligible.

```text
Scans → OCR → PENDING_REVIEW → Human Validation
→ VALIDATED/CORRECTED → Eligibility (1–60 days)
→ Feature Engineering → RF Train/Eval → Final Model
→ Predicted Days → Predicted Release Date
```

---

## 7. Panel script (exact wording)

**“Does your Random Forest consider complexity, material, and workload?”**  
The current deployed Random Forest uses service quantities, number of pairs, priority, grand total, calendar factors, and shoe-condition counts. Material, current workload, staff availability, and an explicit complexity score are not currently included because those variables are not yet consistently available in both historical training records and live prediction inputs. They are identified as future model enhancements.

**“Then how does the model calculate the predicted release date?”**  
The Random Forest generates a predicted completion duration in days by averaging the predictions of 150 regression trees. The predicted duration is rounded to at least one day and added to the date received to produce the ML predicted release date.

**“Which date does the system actually use?”**  
The Business Rules date is the official operational release date stored as `expected_at`. The Random Forest date is advisory and does not overwrite the official date.

**“Why not just use ML for the official date?”**  
Because the current ML model is trained on an archival order-to-claim target and has only 35 eligible records from one intake month. Business Rules therefore remain the controlled operational calculation, while ML provides a separate research and decision-support prediction.

---

## 8. Bottom line (one sentence)

Current RF = service quantities, pairs, priority, grand total, calendar, condition counts → advisory predicted days/date; Business Rules remain the official release date; material/workload/complexity = future expansions only.

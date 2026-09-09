# Shoelotskey Machine Learning Report  
## Random Forest Regression for Predicted Service Completion Date  
### Plus Historical Module (Tabs, Training Data Span, and Operations)

**Date:** 2026-09-09  
**Status:** Verified against current code, model metadata, and local `historical_orders` data  
**Artifacts:** `backend/ml/historical_ml_engine.py`, `backend/completion_model.meta.json`, `backend/historical_rf_model.meta.json`, `src/app/pages/HistoricalRecords.tsx`, `src/app/pages/HistoricalValidationQueue.tsx`

---

## 1. Purpose of the ML Model

The Shoelotskey Service Management System uses a **Random Forest Regressor** to estimate the number of days associated with completing a shoe-service job from historical job-order patterns. That predicted duration is converted into a **predicted release date**.

The research objective is to implement and evaluate an ML model for predicting service completion dates using historical records.

The system does **not** use Random Forest as the sole operational commitment date. It uses a dual path:

| Path | Role | Formula (conceptual) |
|------|------|----------------------|
| **Business Rules** | Official Estimated / Expected Date | \(ReleaseDate_{official} = DateReceived + OfficialServiceDuration\) |
| **Random Forest** | Secondary / advisory ML date | \(ReleaseDate_{ML} = DateReceived + \hat{CompletionDays}_{RF}\) |

So:

\[
ReleaseDate_{Official} \neq ReleaseDate_{ML} \quad \text{(not necessarily equal)}
\]

This is intentional and safer for the capstone: ML does not silently overwrite the operational date.

---

## 2. What Should Affect the Prediction (Ideal Research View)

A stronger model can use variables such as:

| Factor | Example | Why it matters |
|--------|---------|----------------|
| Service type | Basic Cleaning, Unyellowing, Reglue | Different processing times |
| Number of services | 1–3+ | More work |
| Complexity | Basic / Moderate / Complex | Labor intensity |
| Shoe condition | Yellowing, sole separation, rips | Extra work |
| Material | Leather, suede, canvas | Handling / drying differences |
| Priority | Regular / Rush | Scheduling |
| Workload | Active / on-going jobs | Capacity pressure |
| Pairs / quantity | 1–N pairs | Throughput |
| Date factors | Weekday / month / season | Operational patterns |

Ideal conceptual model:

\[
CompletionDays = f(Service, Complexity, Material, Condition, Workload, Priority, Quantity, DateFactors, \ldots)
\]

Random Forest is appropriate because these relationships need not be linear; trees can learn interactions such as:

> Full Reglue + sole separation + multiple services + high queue pressure  
> vs.  
> Basic Cleaning + good condition + low queue.

---

## 3. Current Verified Implementation vs Ideal Expanded Model

### 3.1 CURRENT VERIFIED FEATURES (do claim these)

From `FEATURE_COLS` in `historical_ml_engine.py` (also stored in model `.meta.json`):

| Group | Features actually used |
|-------|------------------------|
| **Service / quantity** | `total_pairs`, `basic_cleaning_qty`, `full_reglue_qty`, `minor_reglue_qty`, `full_restoration_qty`, `minor_restoration_qty`, `color_renewal_qty`, `unyellowing_qty` |
| **Priority** | `priority_encoded` (regular=0, rush=1, premium=2) |
| **Monetary proxy** | `grand_total` |
| **Calendar** | `day_of_week_received`, `month_received` |
| **Condition counts** | `scratches_count`, `yellowing_count`, `sole_separation_count`, `deep_stains_count`, `rips_holes_count`, `worn_out_count` |

**Total input dimensionality:** 18 numeric features.

### 3.2 NOT in the current Random Forest inputs (do not claim as deployed)

| Factor | Status |
|--------|--------|
| Material (leather/suede/…) | Used in **business rules** heuristics; **not** in RF `FEATURE_COLS` |
| Current active workload / queue size | **Not** in current historical RF features |
| Explicit complexity score \(C = w_1S + w_2D + w_3Q\) | Conceptual only; not a stored RF feature |
| Staff available | Not implemented |

**Defense rule:** only claim material / workload as *recommended expansions* unless code and training rows both contain them at train time and prediction time.

---

## 4. Target Variable (Critical)

### Conceptual target used today

\[
\boxed{CompletionDays = ClaimedDate - ReceivedDate}
\]

for VALIDATED / CORRECTED historical rows with a realistic span.

Eligibility (`is_ml_eligible_order`):

- `ocr_status` ∈ {Validated, Corrected, VALIDATED, CORRECTED}
- `date_received` present
- `completion_days` ∈ **[1, 60]** (`MAX_ML_COMPLETION_DAYS = 60`)

Metadata string:

> `completion_days (order-to-claim turnaround; claimed_date − date_received)`

### Accurate panel wording

**Say:**  
The Random Forest estimates expected completion duration from historical job-order patterns; that duration is converted into a predicted release date.

**Do not say:**  
The Random Forest directly predicts the exact calendar day the shoes become ready for release inside the shop.

Paper archives often record claim notes more reliably than a pure “ready-for-pickup” timestamp, so order-to-claim is the current archival target, capped to reduce OCR date noise.

---

## 5. What Random Forest Actually Calculates

Each tree \(t\) produces a prediction \(\hat{y}_t\). With \(T\) trees:

\[
\boxed{\hat{y} = \frac{1}{T}\sum_{t=1}^{T}\hat{y}_t}
\]

Current training hyperparameters:

- Algorithm: `sklearn.ensemble.RandomForestRegressor`
- `n_estimators = 150` (so \(T = 150\))
- `max_depth = 10`
- `random_state = 42`
- Model version: **1.2**

Application rounding (historical predict endpoint):

\[
PredictedDays = \max\bigl(1,\ \mathrm{round}(\hat{y})\bigr)
\]

\[
\boxed{PredictedReleaseDate = DateReceived + PredictedDays}
\]

---

## 6. Evaluation Metrics (Regression — not “Accuracy %”)

When dataset size \(n \ge 10\), the engine:

1. Splits **80% train / 20% test** (`random_state=42`)
2. Fits an evaluation forest on the train split
3. Reports test metrics
4. Then **refits the final forest on 100% of eligible rows** for deployment

\[
\boxed{MAE = \frac{1}{n}\sum_{i=1}^{n}|y_i - \hat{y}_i|}
\]

\[
\boxed{R^{2} = 1 - \frac{\sum(y_i-\hat{y}_i)^{2}}{\sum(y_i-\bar{y})^{2}}}
\]

**Do not present \(R^{2}\) as “Prediction Accuracy %.”**  
MAE is the clearest day-error interpretation for the panel.

### Latest measured result (artifact metadata, trained 2026-09-09 22:33)

| Metric | Value |
|--------|-------|
| Dataset size (ML-eligible) | **35** |
| Train / test (eval split) | **28 / 7** |
| \(R^{2}\) | **0.1959** |
| MAE | **7.61 days** |
| RMSE | **8.93** |
| Max completion days filter | 60 |

Interpretation: on the held-out seventh of this small sample, predictions differ from the archival target by about **7.6 days on average**. \(R^{2} \approx 0.20\) means the model explains only a modest share of target variance — expected with a small, narrow-month sample.

---

## 7. Exact Training Records Used (Month / Year / Span)

Verified from local SQLite `historical_orders` for rows matching current ML eligibility (same rules as the engine), aligned with `dataset_size: 35` in the model metadata.

### 7.1 Counts in the database (2026-09-09)

| Population | Count |
|------------|------:|
| All `historical_orders` | **725** |
| `PENDING_REVIEW` (OCR queue) | **690** |
| `VALIDATED` | **34** |
| `CORRECTED` | **1** |
| **ML-eligible training rows** | **35** |

### 7.2 Calendar coverage of the **trained** set (35 eligible rows)

| Dimension | Value |
|-----------|-------|
| **Year** | **2025** |
| **Order / received month** | **August 2025 only** |
| Earliest `date_received` | **2025-08-15** |
| Latest `date_received` | **2025-08-23** |
| Received-date span | **8 days** (~0.3 month of intake dates) |
| Earliest `claimed_date` | **2025-08-19** |
| Latest `claimed_date` | **2025-09-20** |
| Claim window | Late August → mid-September 2025 |
| `completion_days` | min **3**, median **10**, mean **≈15.0**, max **30** |
| Priority mix | Regular **33**, Rush **2** |

**How many months for the current RF model?**  
Practically **one intake month: August 2025**. Claims extend into September 2025, but every eligible training order was **received in August 2025**.

### 7.3 Broader historical pool (not all used for training)

- OCR / imported pool is much larger (**725** rows), mostly still `PENDING_REVIEW`.
- Source scan folders under `historical_data/source/Digital Job Order Forms/` include month-named batches: **August, September, October, November, December, January** (paper archive months available for OCR).
- Raw `date_received` across all 725 rows is noisy (OCR artifacts exist, including impossible years); that is why only validated + capped rows enter training.

**Panel-safe sentence:**  
The currently activated Random Forest was trained on **35 human-validated historical orders received in August 2025** (15–23 Aug), with claim dates through 20 Sep 2025, using an 80/20 evaluation split (28/7) and final fit on all 35.

---

## 8. End-to-End ML Pipeline (As Implemented)

```text
Paper / scanned job orders (Archives + OCR source)
        ↓
OCR extraction → PENDING_REVIEW rows
        ↓
OCR Validation tab (human correct / approve / reject)
        ↓
VALIDATED / CORRECTED historical_orders
        ↓
ML eligibility filter (days 1–60, required dates)
        ↓
Feature engineering (_build_row → FEATURE_COLS)
        ↓
Train/test split (if n ≥ 10) + metrics
        ↓
RandomForestRegressor fit → historical_rf_model.pkl
        ↓
Sync copy → completion_model.pkl (live /api/predict secondary path)
        ↓
Predicted completion days → Predicted release date
```

Live Job Order form still computes **Business Rule** date as authoritative and may show RF as secondary (`BR:` / `ML:`).

---

## 9. How ML Works Inside the Historical Module

Page: **Historical Records** (`HistoricalRecords.tsx`)  
Introduced as a centralized repository for encoding old paper receipts, analytics, and ML training data.

Access notes:

- **Records / OCR Validation / Archives:** available to authenticated historical users (role checks on APIs).
- **Analytics** and **ML Training:** Owner/Admin UI tabs (`owner` / `admin`).
- Training / historical predict APIs use `require_role("admin")`.

### Tab map

| Tab | Purpose | Main actions / buttons |
|-----|---------|------------------------|
| **1. Records** | Finalized historical table (features + TOTAL DAYS target view) | Search, Priority filter, Sync filter, Export CSV, Import JSON, **+ New Historical Record**, View / Edit / Delete, original form preview |
| **2. Analytics** | Business aggregates + model snapshot | Date range, Priority filter, **Refresh**; cards for totals, revenue, avg completion, pairs, customers, top service; distribution tables; model training-record / last-trained chips |
| **3. ML Training** | Train, inspect, predict, export dataset | **Train Model**, **Predict**, Export `historical_dataset.csv`, dataset/model info cards, feature chips, ETL import history, recent predictions list |
| **4. OCR Validation** | Human review queue for OCR drafts | Side-by-side image + fields; **Save Corrections**; approve / reject / correct actions; **Re-OCR**; navigate pending queue |
| **5. Archives** | Original scanned monthly PDF batches | Grid of month/year PDFs; **Open PDF** via authenticated image/PDF fetch |

---

### 9.1 Records tab

**What it shows (matches your screenshot):** Order ID, Customer, Priority, Shoes, Services (e.g. `BC(325)`), Order Date, Expected Date, Claimed Date, **Total Days**, Grand Total, actions.

**Data source:** `GET /api/historical/orders?finalized_only=true` (paginated).

**Functions:**

- Encode / edit historical job orders manually.
- Import AI/JSON bulk extracts (`POST /api/historical/bulk-import`).
- Export ML-oriented CSV (`GET /api/historical/export-csv`).
- TOTAL DAYS column is the human-visible target related to `completion_days`.

Only rows that later become VALIDATED/CORRECTED with realistic days feed training—not every row visible after OCR.

---

### 9.2 Analytics tab

**Data source:** `GET /api/historical/analytics` (+ `GET /api/historical/model-info`).

**Functions:**

- Filter by start/end date and priority.
- Overview KPIs (orders, revenue, average completion time, pairs, customers, most-requested service).
- Service / brand style distributions.
- Lightweight model status (training records available, last trained).

This tab is **descriptive analytics**, not the training button itself.

---

### 9.3 ML Training tab

**Core buttons:**

1. **Train Model** → `POST /api/historical/train`  
   - Loads ML-eligible rows  
   - Builds feature matrix  
   - Evaluates (if \(n \ge 10\))  
   - Saves `historical_rf_model.pkl` + `.meta.json`  
   - Syncs to `completion_model.pkl` for live secondary prediction  
   - Toast shows \(R^{2}\), MAE, dataset size  

2. **Predict** → opens dialog → `POST /api/historical/predict`  
   - User enters pairs, service quantities, priority, date received, etc.  
   - Returns `predicted_completion_days` and `predicted_release_date`  

3. **Export CSV** → same historical dataset export used for offline inspection  

**Cards:**

- Total historical records vs validated vs ML-eligible  
- Algorithm: Random Forest Regression  
- Model Ready / Not Trained, last trained timestamp, version  
- Feature list (UI chips list core service/calendar features; condition features also exist in code even if some chips are abbreviated)  
- ETL import history (`/api/etl/import-history`)  
- Stored prediction history (`GET /api/historical/predictions`)

**Minimum to train:** 5 eligible records (`MIN_TRAINING_RECORDS`).

---

### 9.4 OCR Validation tab

Component: `HistoricalValidationQueue.tsx`.

**Flow:**

1. Load pending queue: `GET /api/historical/processing/queue`
2. Staff compares scanned image vs extracted fields
3. Actions via validate endpoints:
   - `approve` → finalize as validated training candidate
   - `reject` → remove from queue / reject path
   - `correct` / `save` → persist corrections; may stay in queue
4. **Re-OCR** → `POST /api/historical/processing/reocr/{image_id}` to re-run OCR for the current image
5. Confidence / missing-field warnings guide review

**Why this tab matters for ML:**  
Training deliberately ignores most of the 690 `PENDING_REVIEW` rows until a human validates them. That is the quality gate for the Random Forest.

---

### 9.5 Archives tab

**Data source:** `GET /api/historical/archives`  
**Open file:** authenticated fetch of `/api/historical/image/{filename}`

**Functions:**

- Browse monthly scanned PDF report batches from the historical source folder
- Open original paper-archive PDFs for audit / defense evidence

Archives are the **source evidence** layer; they are not themselves the feature matrix.

---

## 10. Dual Calculation Architecture (Defense Diagram)

```text
                 JOB ORDER / HISTORICAL FEATURES
                              │
               ┌──────────────┴──────────────┐
               ↓                             ↓
        BUSINESS RULES                 RANDOM FOREST
               │                             │
               ↓                             ↓
     OFFICIAL RELEASE DATE          PREDICTED DAYS ŷ
     (authoritative in live)                 │
                                             ↓
                                    ML PREDICTED DATE
                                    (advisory / research)
```

---

## 11. Recommended Capstone Claims vs Expansions

### Safe to claim now

- Random Forest Regressor estimates completion duration from historical validated orders  
- Features: service quantities, pairs, priority, grand total, weekday/month, condition counts  
- Official live Estimated Date = Business Rules; ML = secondary  
- Metrics reported as MAE / \(R^{2}\) / RMSE (not fake accuracy %)  
- Current activated model: **35 August 2025 validated orders**, MAE **7.61**, \(R^{2}\) **0.20**

### Frame as future / ideal work

- Add material encoding (one-hot) **if** consistently stored historically and at live create time  
- Add current active workload \(N_{active}\) **if** reconstructable historically without leakage and computable live  
- Explicit complexity score as engineered feature  
- Expand validated corpus beyond one intake month (validate more OCR months: Sep–Jan source folders)

### Methodological principle

> A feature is useful for live prediction only if the same information is available when a new Job Order is created.

---

## 12. Defense Q&A Quick Hits

**Q: What does RF predict?**  
Expected completion duration (days) from historical patterns; converted to a predicted release date.

**Q: What is the target?**  
Primarily archival \(ClaimedDate - ReceivedDate\), capped 1–60 days, on validated rows.

**Q: How many records / which months?**  
**35** eligible records, all **received in August 2025** (15–23 Aug); claims through **20 Sep 2025**. Evaluation split 28/7.

**Q: Does ML set the customer Estimated Date?**  
No. Business Rules are authoritative; RF is advisory.

**Q: Do you use material and workload?**  
Not in the current RF feature vector. Condition, services, priority, calendar, and pairs are used. Material/workload are recommended expansions.

**Q: Why is \(R^{2}\) low?**  
Small sample, narrow time window, claim-span noise, and high natural variance in turnaround. Report MAE honestly.

---

## 13. One-Page Summary for Manuscript / Slides

\[
\hat{CompletionDays} = RF(ServiceQtys,\ Pairs,\ Priority,\ GrandTotal,\ Calendar,\ ConditionCounts)
\]

\[
PredictedReleaseDate = DateReceived + \hat{CompletionDays}
\]

\[
OfficialReleaseDate = BusinessRules(DateReceived,\ Services,\ Priority,\ \ldots)
\]

**Training corpus (current activated model):** 35 validated historical orders, **August 2025** intake, evaluated 28/7, MAE 7.61 days, \(R^{2}\) 0.1959, 150 trees, max depth 10.

**Historical module roles:** Records (dataset UI) → OCR Validation (quality gate) → ML Training (fit/predict) → Analytics (KPIs) → Archives (source PDFs).

---

*If you want this turned into formal Chapter 3 / Chapter 4 manuscript wording with numbered equations only, say so and a publication-style section can be drafted from this verified report without inventing unimplemented features.*

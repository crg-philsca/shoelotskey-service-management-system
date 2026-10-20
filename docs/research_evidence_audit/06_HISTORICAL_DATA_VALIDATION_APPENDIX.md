# APPENDIX E: HISTORICAL PAPER RECEIPT SCREENING, EXCLUSION, AND VALIDATION LOG
**Supporting Chapters:** Chapter 3 (Data Gathering Procedures) & Chapter 4 (Exploratory Data Analysis)  
**Auditor:** Machine Learning Documentation Specialist & Historical Data Auditor  
**Evidence Standard:** Read-Only Physical Scan Ingestion & OCR Pipeline Audit  
**Artifact Directory:** `backend/historical_data/`  

---

## 1. Provenance of Historical Paper Records

Before the implementation of the centralized web-based management system, Shoelotskey recorded all service intake transactions manually on paper receipt books and clipboard ledgers.

### 1.1 Ingestion and OCR Pipeline Workflow
The historical data pipeline processed physical records according to the following audited sequence:
1. **Physical Scan Collection:** 716 raw scanned image files representing 714 paper receipt stubs from August 2025 through January 2026 were photographed via CamScanner (`backend/historical_data/source/`).
2. **Automated OCR Parsing:** Scanned images were processed using Tesseract OCR (`ocr_engine.py`, `local_ocr_parser.py`), yielding 383 parsed candidate order blocks (`historical_ml_summary.json`).
3. **Data Quality Screening & Exclusions:**
   - 336 candidate records were excluded due to illegible handwritten entries, missing service line items, torn receipt margins, or unrecorded customer pickup dates (`historical_invalid_records_report.json`).
   - 2 exact duplicate stubs were identified and removed (`historical_duplicates_report.json`).
4. **Validated Historical Sample ($N = 119$):** Exactly 119 records contained 100% complete, legible entries for:
   - Order intake date (`date_received`)
   - Specific footwear service applications (cleaning, reglue, restoration, unyellowing)
   - Billed total amount
   - Verified customer pickup date (`claimed_date`)

---

## 2. Temporal Partitioning of Dataset A

The 119 validated historical records were partitioned chronologically to evaluate baseline machine learning feasibility without look-ahead bias:
- **Development Partition ($N = 93$):** Transactions from August 1, 2025 to December 31, 2025, utilized for 5-fold expanding-window cross-validation.
- **Sealed Holdout Test Partition ($N = 26$):** Transactions from January 1, 2026 to January 31, 2026, held completely sealed for final evaluation.

### Table E1. Historical Receipt Processing Pipeline Counts

| Pipeline Processing Stage | Record Count | Exclusion / Inclusion Rationale | Evidence File Reference |
| :--- | :---: | :--- | :--- |
| **1. Discovered Source Scans** | 716 images (714 receipts) | Total physical stubs photographed via CamScanner (Aug 2025 – Jan 2026) | `image_processing_report.json` |
| **2. Candidate Parsed Records** | 383 records | Text blocks extracted via OCR containing basic order identifiers | `historical_ml_summary.json` |
| **3. Duplicate Stubs Removed** | 2 records | Multiple photographs of identical physical receipt stubs | `historical_duplicates_report.json` |
| **4. Incomplete / Rejected Records** | 336 records | Missing claim date (unclaimed shoes), illegible service description, missing price | `historical_invalid_records_report.json` |
| **5. Validated Historical Dataset (Dataset A)** | **119 records** | **100% complete intake, service, pricing, and claim date metadata** | `historical_training_dataset.csv` |
| **— Development Subset** | 93 records | Chronological development split (August – December 2025) | `02_development_cv_summary.csv` |
| **— Sealed Holdout Subset** | 26 records | Chronological evaluation holdout split (January 2026) | `03_locked_final_test_predictions.csv` |

---

## 3. Why Dataset A is Unsuitable for Production ML Forecasting

### 3.1 The Target Variable Confounding Problem
On physical receipt books, the only recorded completion timestamp was the moment the customer physically returned to the counter to pay their remaining balance and retrieve their footwear (`claimed_date`).
- **Empirical Reality:** Customers frequently left completed shoes in the shop for 30, 60, or even 90+ days following service completion due to personal scheduling or neglect.
- **Consequence:** The target variable measured *customer pickup latency* rather than *actual workshop turnaround duration*.

### 3.2 Machine Learning Baseline Performance on Dataset A
When evaluated with a default Random Forest Regressor (200 trees, Feature Set B with 13 features):
- **5-Fold Expanding Window CV:** Mean MAE = 8.1541 days, Mean RMSE = 10.3225 days, Mean $R^2 = 0.2679$.
- **Sealed Holdout Test Set ($N = 26$):** MAE = 8.5554 days ($pprox 205.3$ hours), RMSE = 10.2272 days, $R^2 = -0.0208$.

### 3.3 Constructive Research Role of Dataset A
While Dataset A was formally decommissioned for operational turnaround forecasting, it provided vital empirical foundation for:
1. Identifying the true empirical distribution of shop services (99% Basic Cleaning, 36.7% Reglue).
2. Deriving the 35 canonical workshop service templates used by the counter intake form.
3. Defining baseline labor duration bounds under standard workshop capacity.

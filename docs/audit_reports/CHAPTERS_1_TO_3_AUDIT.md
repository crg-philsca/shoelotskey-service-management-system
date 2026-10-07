# CHAPTERS 1 TO 3 MANUSCRIPT AUDIT REPORT
## Conceptual, Methodological, and Academic Foundation Verification

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 3: Chapters 1 to 3 Manuscript Audit  

---

## 1. Executive Summary & Defect Overview

| Audit Area | Original Manuscript Finding | Audited Reality & Resolution | Severity |
| :--- | :--- | :--- | :--- |
| **Figure 1 (Conceptual Framework, p. 9)** | Typo *"6. Transaction reocords"*; lists obsolete 2011 ISO (7 traits); claims real-time online ML feedback loop. | Correct typo; update to 9 ISO/IEC 25010:2023 characteristics; rewrite feedback narrative to describe administrative batch retraining. | **CRITICAL** |
| **Research Question 4 (p. 5)** | Lists only 7 characteristics; completely omits Compatibility and Safety; uses obsolete 2011 terms (Usability, Portability). | Update RQ4 to exact 9 ISO 25010:2023 characteristics: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, Safety. | **CRITICAL** |
| **Specific Objectives (pp. 10–11)** | Incomplete draft listing only 4 objectives; misses explicit TAM user acceptance and expert enhancement objectives. | Align Specific Objectives 1 to 6 to achieve exact 1:1 parity with Research Questions 1 to 6. | **MAJOR** |
| **ML Target Semantic Confusion** | Problem and objectives refer to *"service completion date estimation"*. | Historical records contained no technician completion timestamps; empirical target is `claimed_date - date_received` (turnaround duration). Harmonize terminology. | **CRITICAL** |
| **Continuous Learning Fallacy** | Conceptual Framework implies system automatically becomes smarter and continuously self-learns. | Production model is statically loaded from `completion_model.pkl`. Automatic retraining is disabled. Reword to controlled batch retraining. | **CRITICAL** |
| **Table 1 Cost Sum (pp. 52, 58)** | Typo: `1,500 + 2,200 + 1,000 +7 20 = ₱5,420`. Header: `Quantity/Assum ption`. | Replace with `₱1,500 + ₱2,200 + ₱1,000 + ₱720 = ₱5,420` and fix header to `Quantity / Assumption`. | **CRITICAL** |
| **Research Timeline Feasibility** | Early slide snippet claimed testing on June 1–10, 2025. | Anachronism from preliminary template. Actual system pilot testing occurred September 2–16, 2026. | **MAJOR** |

---

## 2. Research Timeline Feasibility Verification Table

See [`RESEARCH_TIMELINE_VERIFICATION.csv`](RESEARCH_TIMELINE_VERIFICATION.csv) for full 11-milestone matrix:
- **Baseline Observation & FGD:** March 12–15, 2025 (Authentic)
- **Historical Receipts Dataset:** August 2025 – January 2026 (6 monthly volumes, 714 receipts, 119 validated orders)
- **Architecture & DB Normalization:** April – July 2025
- **System Implementation:** July 2025 – August 2026
- **ML Cross-Validation:** August – December 2025 (93 records, 5-fold expanding window)
- **Locked Test Holdout:** January 2026 (26 records frozen)
- **Production Retraining:** Post-Evaluation (Sept 2026, 119 records)
- **Faculty Validity (CVI):** August 2026 (N=5, S-CVI = 1.00)
- **TAM User Pilot:** September 2–16, 2026 (N=6, 2-week pilot)
- **ISO/IEC 25010 Expert Eval:** September 9–19, 2026 (N=5 IT experts)
- **Flagged Anachronism:** June 1–10, 2025 testing claim in old slide draft corrected to September 2–16, 2026.

---

## 3. Copy-Ready Exact Replacement Cards for Chapters 1–3

### Card 1: Page 9 • Figure 1 Conceptual Framework
- **SEARCH FOR:**
  ```text
  INPUT: 6. Transaction reocords
  PROCESS: 7. ISO/IEC 25010: Functional suitability, usability, reliability, performance, security, maintainability, portability.
  FEEDBACK LOOP: The feedback loop allows the system to learn from its mistakes in real-time. If an ML prediction was wrong, the actual completion time is fed back in real-time to improve future accuracy.
  ```
- **REPLACE WITH:**
  ```text
  INPUT: 6. Transaction records
  PROCESS: 7. ISO/IEC 25010:2023: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, Safety. TAM: Perceived Usefulness, Perceived Ease of Use, Behavioral Intention to Use, Actual System Use.
  FEEDBACK LOOP: The conceptual framework incorporates a closed-loop historical data ingestion pipeline. As job orders are completed and claimed, their validated operational attributes are archived. The business owner can periodically trigger an administrative batch model retraining routine via /api/historical/train, enabling the Random Forest model to ingest newly validated empirical records and adjust to long-term shop trends over time.
  ```

### Card 2: Page 5 • Research Question 4
- **SEARCH FOR:**
  ```text
  4. To what extent does the developed system meet ISO/IEC 25010 software quality standards in terms of: 4.1 Functional suitability, 4.2 Performance efficiency, 4.3 Usability, 4.4 Reliability, 4.5 Security, 4.6 Maintainability, and 4.7 Portability?
  ```
- **REPLACE WITH:**
  ```text
  4. To what extent does the developed system comply with ISO/IEC 25010:2023 software product quality standards across the following characteristics: 4.1 Functional Suitability, 4.2 Performance Efficiency, 4.3 Compatibility, 4.4 Interaction Capability, 4.5 Reliability, 4.6 Security, 4.7 Maintainability, 4.8 Flexibility, and 4.9 Safety?
  ```

### Card 3: Pages 10–11 • Specific Objectives
- **REPLACE INCOMPLETE LIST WITH FULL 6 OBJECTIVES:**
  ```text
  1. Conduct a comparative analysis between the existing manual paper logbook and the developed digital system regarding record accessibility, retrieval time, and data accuracy.
  2. Train, evaluate, and integrate an advisory Random Forest machine learning turnaround estimation model using historical intake records based on regression metrics (MAE, RMSE, R²).
  3. Determine the impact of real-time analytics in the Sales Report Module on reporting efficiency by assessing generation time for sales, expense, and ROI reports.
  4. Evaluate the technical software product quality across 9 characteristics using ISO/IEC 25010:2023 with external IT expert evaluators.
  5. Measure operational end-user acceptance among management and staff using the Technology Acceptance Model (TAM) across PU, PEOU, BI, and ASU.
  6. Formulate evidence-based system enhancement recommendations based on qualitative evaluator feedback for future researchers.
  ```

### Card 4: Pages 52 & 58 • Table 1 Cost Computation
- **SEARCH FOR:**
  ```text
  1,500 + 2,200 + 1,000 +7 20 = ₱5,420
  Quantity/Assum ption
  ```
- **REPLACE WITH:**
  ```text
  ₱1,500 + ₱2,200 + ₱1,000 + ₱720 = ₱5,420
  Quantity / Assumption
  ```

# RESEARCH TRACEABILITY MATRIX
## End-to-End Alignment: Problem → RQs → Objectives → System → Method → Results → Conclusions → Presentation

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 2: Research Alignment & Traceability Audit  

---

## 1. Executive Traceability Matrix

| Research Dimension | Specific Objective | System Module | Methodology & Data Source | Chapter 4 Result | Chapter 5 Finding & Conclusion | Presentation Slide | Alignment Status & Identified Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dim 1: Manual vs. Digital Logbook** | **Objective 1:** Compare manual paper logbook vs. digital system (accessibility, retrieval time, accuracy). | Job Order Intake & Search (`JobOrderForm.tsx`, `JobOrders.tsx`). | 10 retrieval trials; 2-week daily observation of duplicate/incomplete records. | **Table 2:** Retrieval time down 92.12% (5.20m → 0.41m).<br>**Table 3:** Duplicate entries: 2–3/day → 0. | **Finding 1 & Conclusion 1:** Centralized digital database eliminated retrieval delays and duplicate encoding. | **Slides 3, 7, 9** | <span style="color:#065f46; font-weight:700;">ALIGNED</span><br>Minor: Fix punctuation on RQ1 in Ch. 1. |
| **Dim 2: ML Turnaround Prediction** | **Objective 2:** Evaluate ML model predicting turnaround duration and release dates using historical data. | Random Forest ML Engine (`historical_ml_engine.py`, Option B Dual-Date UI). | 119 validated orders (714 raw receipts); 93 dev (Aug–Dec 2025) for 5-fold expanding CV; 26 locked test (Jan 2026); 13 features; MAE, RMSE, R². | **Table 5:** 10 sample test rows.<br>**Table 6:** Locked test set: MAE = 8.50 d, RMSE = 10.11 d, R² = 0.129. Designated strictly ADVISORY. | **Finding 2 & Conclusion 2:** Advisory release date estimation under Option B; official release dates remain governed by business rules. | **Slides 3, 6, 8, 11, 15** | <span style="color:#92400e; font-weight:700;">PARTIAL / GAP</span><br>1. Ch. 1 uses "service completion time" instead of "turnaround duration".<br>2. Slide 11 calls N=26 a "10-record sample" → align to 26-record test set. |
| **Dim 3: Real-Time Analytics & Reporting** | **Objective 3:** Assess impact of real-time analytics in Sales Report Module on reporting efficiency (sales, expense, ROI). | Analytics Dashboard & Reports (`Dashboard.tsx`, `SalesReport.tsx`). | Timed generation of 7 report types (Daily, Weekly, Monthly, Quarterly, Annual, Expenses, ROI) + 3-item survey (N=6). | **Table 7:** Report generation down 99.98% (43.71 min → 0.43 sec).<br>**Table 8:** Dashboard Impact = 3.83/4.00 (Highly Acceptable). | **Finding 3 & Conclusion 3:** Reporting automation transformed administrative efficiency and financial visibility. | **Slides 3, 9, 10** | <span style="color:#065f46; font-weight:700;">ALIGNED</span><br>Confirm units (0.43 seconds vs minutes). |
| **Dim 4: Software Quality (ISO/IEC 25010)** | **Objective 4:** Evaluate system quality across 9 characteristics based on ISO/IEC 25010:2023. | Full system architecture (React SPA, FastAPI, PostgreSQL, Bcrypt, JWT, RBAC, Audit). | 45-item survey across 9 characteristics evaluated by 5 IT experts (4-point forced-choice scale). | **Tables 9–19 & 24:** Overall GWM = 3.71/4.00 (Highly Acceptable). Lowest: Functional & Safety (3.64); Highest: Flexibility (3.84). | **Finding 4 & Conclusion 4:** System conforms to all 9 ISO 25010:2023 quality dimensions. | **Slides 3, 7, 13** | <span style="color:#991b1b; font-weight:700;">CONTRADICTION</span><br>1. Narrative p. 127 claims Reliability is 3.76, while Table 13/24 prove 3.72 (SD 0.49).<br>2. Table numbers skip Tables 14 & 15.<br>3. Slide 7 has typo "ISO/EIC 25010". |
| **Dim 5: User Acceptance (TAM)** | **Objective 5:** Measure user acceptance among Shoelotskey personnel using TAM (PU, PEOU, BI, ASU). | All end-user operational workflows (Intake, Inventory, Calendar, Cash Register). | Total population census of shop personnel (N=6: 2 owners, 4 staff); 2-week pilot testing (Sept 2–16, 2026); 20 items. | **Tables 20–24:** PU = 4.00, PEOU = 3.89, BI = 3.61, ASU = 4.00. Overall TAM GWM = 3.88/4.00 (Highly Acceptable). | **Finding 5 & Conclusion 5:** High operational acceptance and full daily adoption by shop staff. | **Slides 3, 7, 12** | <span style="color:#065f46; font-weight:700;">ALIGNED</span><br>Ensure N=6 is clearly framed as 100% census. |
| **Dim 6: System Enhancements & Roadmap** | **Objective 6:** Recommend system enhancements based on IT expert qualitative recommendations. | Targeted enhancement architecture (dynamic dropdowns, inventory audit trail, SMS webhooks). | Frequency and percentage ranking of qualitative recommendations from Part III of IT expert evaluation forms. | **Table 25:** Dropdowns (60%, Rank 1), Inventory audit logs (40%, Rank 2), SMS alerts (40%, Rank 2), ML retraining (20%, Rank 4). | **Finding 6 & Recs 1–6:** 6 actionable, evidence-based recommendations for future research. | **Slides 3, 14, 15** | <span style="color:#92400e; font-weight:700;">CROSS-REF TYPO</span><br>Manuscript p. 144 erroneously refers to "Table 24" instead of "Table 25". |

---

## 2. Critical Cross-Chapter Inconsistencies to Reconcile

1. **Chapter 1 Terminology vs Empirical Ground Truth:**
   - *Problem:* Chapter 1 (Problem Statement, Project Purpose, Objectives) refers to *"service completion date estimation"*.
   - *Reality:* Historical paper receipts did not record technician completion timestamps; they recorded only `Date Received` and `Claimed Date`. The empirical ML target is `turnaround_duration = (claimed_date - date_received)`.
   - *Resolution:* Harmonize Chapter 1 wording to *"advisory predicted release date / order turnaround duration"*.
2. **Conceptual Framework "Continuous Learning" Fallacy:**
   - *Problem:* Conceptual Framework implies the system automatically becomes smarter and continuously self-learns.
   - *Reality:* The production model is statically loaded from `completion_model.pkl`. Automatic retraining is disabled to prevent model drift and data leakage.
   - *Resolution:* Reword framework to state that new validated digital records provide the foundation for future controlled model retraining and evaluation.
3. **Slide 11 vs Slide 15 Test Sample Contradiction:**
   - *Problem:* Slide 11 labels the evaluation results a "10-record test sample", while Slide 15 cites the exact same figures (MAE 8.50, RMSE 10.11, R² 0.129) as a "26-record test set".
   - *Reality:* The locked holdout dataset contains exactly 26 records (January 2026); 10 records was merely an illustrative preview table (Table 5).
   - *Resolution:* Label Slide 11 as "26-Record Locked Holdout Test Set (10 Representative Rows Displayed)".
4. **Reliability Dimension Narrative Contradiction:**
   - *Problem:* Narrative text on pages 127, 141, and 149 claims Reliability scored 3.76 with SD 0.31.
   - *Reality:* Raw evaluator sheets and Table 13 prove Reliability scored 3.72 with SD 0.49.
   - *Resolution:* Reconcile narrative text to 3.72 (SD 0.49).
5. **Table Sequence Jumps:**
   - *Problem:* Chapter 4 table numbering jumps from Table 13 directly to Table 16 (skipping 14 and 15), and text on p. 144 refers to Table 24 instead of Table 25.
   - *Resolution:* Fix table numbering and cross-references.

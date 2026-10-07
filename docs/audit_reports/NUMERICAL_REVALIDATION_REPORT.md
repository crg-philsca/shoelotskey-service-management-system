# COMPLETE NUMERICAL & EMPIRICAL REVALIDATION REPORT
## Forensic Recalculation of All Research Metrics

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 4: Numerical Revalidation Audit  

---

## 1. Authoritative Machine Learning Metrics (Holdout N = 26)

Evaluated directly from [`backend/research_outputs/ml_final/03_locked_final_test_predictions.csv`](backend/research_outputs/ml_final/03_locked_final_test_predictions.csv):

- **Mean Absolute Error (MAE):** **8.5554 days** (rounded to 8.56 d)
- **Root Mean Squared Error (RMSE):** **10.2272 days** (rounded to 10.23 d)
- **Coefficient of Determination (R²):** **-0.0208**
- **Median Absolute Error:** **7.7836 days**
- **Mean Signed Error:** **-4.6297 days** (indicates slight underprediction bias)
- **±1-Day Accuracy:** **11.54%** (3 of 26 orders)
- **±2-Day Accuracy:** **19.23%** (5 of 26 orders)
- **±3-Day Accuracy:** **23.08%** (6 of 26 orders)

### Baseline Comparison Proof:
- **RF vs. Mean Baseline (18.44 d):** Random Forest achieves **0.78 days error reduction** (8.56 d vs. 9.34 d).
- **RF vs. Median Baseline (16.00 d):** Random Forest achieves **0.41 days error reduction** (8.56 d vs. 8.96 d).

---

## 2. Software Quality Evaluation (ISO/IEC 25010:2023, N = 5 IT Experts)

Evaluated from raw expert sheets in [`docs/Official Documentation/IT Experts/`](docs/Official%20Documentation/IT%20Experts/):

1. **Flexibility:** 3.84 (SD = 0.37) — Rank 1
2. **Compatibility:** 3.76 (SD = 0.31) — Rank 2
3. **Reliability:** 3.72 (SD = 0.49) — Rank 3 *(Reconciled: narrative typo claiming 3.76 fixed to 3.72)*
4. **Interaction Capability:** 3.72 (SD = 0.45) — Rank 4
5. **Maintainability:** 3.72 (SD = 0.45) — Rank 5
6. **Performance Efficiency:** 3.68 (SD = 0.47) — Rank 6
7. **Security:** 3.68 (SD = 0.47) — Rank 7
8. **Functional Suitability:** 3.64 (SD = 0.48) — Rank 8
9. **Safety:** 3.64 (SD = 0.48) — Rank 9
- **Overall Grand Weighted Mean:** **3.71 / 4.00 (SD = 0.44)** &rarr; **Highly Acceptable**

---

## 3. Technology Acceptance Model (TAM, N = 6 Total Census)

Evaluated from raw scanned forms in [`docs/Official Documentation/TAM/TAM-Respondents-Result.pdf`](docs/Official%20Documentation/TAM/TAM-Respondents-Result.pdf):

- **Perceived Usefulness (PU, Items 1–4):** **4.00 / 4.00 (SD = 0.00)** &rarr; Strongly Agree
- **Actual System Use (ASU, Items 10–12):** **4.00 / 4.00 (SD = 0.00)** &rarr; Strongly Agree
- **Perceived Ease of Use (PEOU, Items 5–7):** **3.89 / 4.00 (SD = 0.31)** &rarr; Strongly Agree
- **Behavioral Intention (BI, Items 8–9):** **3.61 / 4.00 (SD = 0.52)** &rarr; Strongly Agree
- **Standard TAM Mean (Items 1–12):** **3.91 / 4.00 (SD = 0.28)** &rarr; Highly Acceptable
- **Dashboard Impact (System Items 13–15):** **3.83 / 4.00 (SD = 0.41)** &rarr; Highly Acceptable
- **Overall Composite Mean (All 15 Items):** **3.88 / 4.00 (SD = 0.25)** &rarr; **Highly Acceptable**

---

## 4. Operational Timing & Efficiency Mathematical Proofs

1. **Record Retrieval Reduction:**
   $$rac{5.20	ext{ min} - 0.41	ext{ min}}{5.20	ext{ min}} = rac{4.79}{5.20} = 92.115\% pprox \mathbf{92.12\%}$$
2. **Financial Report Generation Reduction:**
   $$rac{43.71	ext{ min} - 0.007167	ext{ min}}{43.71	ext{ min}} = rac{43.7028}{43.71} = 99.9836\% pprox \mathbf{99.98\%}$$
   *(Note: 0.43 seconds = 0.007167 minutes. Unit verification confirmed.)*

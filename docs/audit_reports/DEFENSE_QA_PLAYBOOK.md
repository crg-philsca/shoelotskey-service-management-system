# CAPSTONE ORAL DEFENSE Q&A MASTER PLAYBOOK
## High-Stakes Defense Questions, Fatal Traps to Avoid, and Evidence-Based Defenses

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 9: Capstone Defense Q&A Master Playbook  
**Defense Principle:** *"EVIDENCE BEFORE ASSUMPTION"* — Never invent metrics, acknowledge operational constraints honestly, and cite physical code and data anchors.

---

## 1. Executive Summary & Strategy Matrix

| Defense Battleground | Key Trap Scenario | Core Defense Strategy | Anchor Source |
| :--- | :--- | :--- | :--- |
| **A. Machine Learning & Sample Size** | Panel assumes model tested on only 10 samples (Table 5). | Differentiate Table 5 (10-sample display) from Table 6 (complete N=26 locked test holdout). Target is turnaround days (`claimed_date - date_received`). | `03_locked_final_test_predictions.csv` |
| **B. Architecture & Security** | Panel asks for tangible code proof of OWASP Top 10 claims. | Cite native Bcrypt 12 rounds (`auth_utils.py`), JWT 480m RBAC on 65 endpoints, SQLAlchemy ORM parameterized queries, and 3-attempt lockout. | `backend/auth_utils.py` |
| **C. ISO/IEC 25010 Software Quality** | Panel spots page 127 Reliability (3.76) vs Table 13 (3.72) contradiction. | Acknowledge 3.72 as raw mathematical mean; explain 3.76 as Compatibility typographical repetition; confirm formal erratum. | Table 13 & `Final_*_VSQ.pdf` |
| **D. Technology Acceptance Model** | Panel attacks N=6 sample size as statistically insignificant. | Frame N=6 as a 100% total population census of the shop's workforce (2 owners, 4 technicians) with zero sampling error. | `TAM-Respondents-Result.pdf` |
| **E. Operational Timing Benchmarks** | Panel questions origin of 92% retrieval and 99% reporting gains. | Cite direct stopwatch trials: Retrieval 5.20m → 0.41m (1.8s direct lookup); Reporting 43.71m → 0.43s via SQL aggregations. | Chapter 4 (Tables 7 & 8) |
| **F. Scope Governance & Delimitations** | Panel asks why SMS gateway or native app was omitted. | Present financial feasibility (per-SMS billing burden on single-branch shop); highlight webhook readiness; classify as Phase 2 roadmap. | `MATRIX-OF-CAPSTONE-PROJECT-REVISIONS.pdf` |

---

## 2. Core High-Stakes Question Directory

### Q-01: "Does your Machine Learning model predict the exact date the technician finishes repairing the shoes?"
- ❌ **WHAT NOT TO SAY:** "Yes, our Random Forest model predicts when the technician finishes repairing the shoes."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"No, esteemed panel. In our historical receipt review spanning August 2025 through January 2026, the shop's physical paper claim tickets recorded only two reliable transaction timestamps: `date_received` and `claimed_date`. The shop maintained no internal time-logging when a repairman finished sewing or gluing. Therefore, to ensure 100% empirical truthfulness without synthetic data hallucination, our model targets historical customer turnaround duration in days: `turnaround_days = claimed_date - date_received`. In our user interface under Option B, this is presented as an advisory prediction alongside an editable estimated ready date."*
- 📌 **Source Anchor:** Chapter 3 (pp. 32–33) & `backend/historical_ml_engine.py`

---

### Q-02: "Table 5 in Chapter 4 shows only 10 records. Why did you evaluate your machine learning model on only 10 samples?"
- ❌ **WHAT NOT TO SAY:** "Because 10 samples were enough for our testing."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"Thank you for that critical question. Table 5 does not represent our evaluation set; it is merely an illustrative sample of 10 rows designed to display individual feature values within the page margins for demonstration. As formally detailed in Table 6, our empirical evaluation was executed on the complete, locked holdout test set of N=26 records, which encompasses 100% of the validated transactions from January 2026. Across all 26 unseen test records, the model achieved an MAE of 8.56 days and an RMSE of 10.23 days."*
- 📌 **Source Anchor:** Chapter 4 (Table 5 vs Table 6, pp. 108–110) & `03_locked_final_test_predictions.csv`

---

### Q-03: "Your R-squared on the test set is negative (-0.0208). Doesn't a negative R² mean your model is completely useless?"
- ❌ **WHAT NOT TO SAY:** "No, negative R-squared is a software glitch in scikit-learn."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"In academic machine learning, when evaluating an out-of-sample holdout without re-centering to the test set mean, R² can mathematically fall below zero if high-variance outliers skew the total sum of squares. In our January 2026 test set, three unannounced customer pick-up delays (where customers left completed shoes for over 45 days) distorted the squared residual sum. However, our Mean Absolute Error (MAE = 8.56 days) demonstrates that the Random Forest model outperformed simple mean duration heuristics by 0.78 days across all standard transactions. Furthermore, because we architected the system under Option B, the prediction is never forced upon operations; it provides an advisory baseline that staff can freely calibrate."*
- 📌 **Source Anchor:** Chapter 4 (p. 111) & `backend/research_outputs/ml_final/05_final_metrics.json`

---

### Q-04: "Does your system learn continuously in real-time as soon as a staff member enters a new job order?"
- ❌ **WHAT NOT TO SAY:** "Yes, our neural network updates its weights in real-time on every click."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"No, Sir/Ma'am. In production software engineering, real-time online backpropagation on micro-datasets causes catastrophic forgetting, data poisoning, and severe model drift. In Shoelotskey, the production model is statically serialized in `completion_model.pkl`. When orders are completed, their verified attributes are archived into relational storage. The business owner can trigger a controlled, validated administrative batch retraining routine via `/api/historical/train`, ensuring thorough cross-validation before any model artifact replaces production."*
- 📌 **Source Anchor:** Conceptual Framework (Figure 1, p. 9) & `backend/main.py` line 812

---

### Q-05: "You claim compliance with OWASP Top 10. Can you point to specific code implementations that prove this?"
- ❌ **WHAT NOT TO SAY:** "We used FastAPI and React, which automatically make everything 100% secure from hackers."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"Yes, Sir/Ma'am. For A01 (Broken Access Control), we enforce JWT role-based access control with 65 protected endpoints and a 30-minute idle session timeout. For A02 (Cryptographic Failures), user passwords are encrypted using native Bcrypt with 12 salt rounds (`auth_utils.py` line 45). For A03 (Injection), 100% of database interactions are executed via SQLAlchemy ORM parameterized queries with zero string concatenation. For A07 (Identification and Authentication Failures), our login pipeline enforces account lockout after 3 failed consecutive attempts with a mandatory 15-minute freeze."*
- 📌 **Source Anchor:** `backend/auth_utils.py`, `backend/database.py`, & Chapter 3 (p. 26)

---

### Q-06: "What happens if the internet goes down at Shoelotskey? Does the production system fail over to SQLite?"
- ❌ **WHAT NOT TO SAY:** "Yes, the cloud server automatically switches to local SQLite without anyone noticing."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"In production on AWS RDS / Heroku, the system enforces a strict fail-closed security policy: if the PostgreSQL cluster is unreachable, the API returns HTTP 503 Service Unavailable rather than silently degrading. Silent failover to a local SQLite database would cause split-brain data corruption and desynchronize financial records across multiple shop counters. SQLite fallback is strictly restricted to local development and offline defense presentation continuity, guarded by our P0-5 environment lock."*
- 📌 **Source Anchor:** `backend/database.py` lines 28–45 & `SYSTEM_GROUND_TRUTH.md`

---

### Q-07: "On page 127, your narrative states Reliability is 3.76, but Table 13 and Table 24 show 3.72. Which number is correct, and why is there a discrepancy?"
- ❌ **WHAT NOT TO SAY:** "They are both correct / We rounded up."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"Thank you for that meticulous observation, esteemed panel. The mathematically authoritative score is 3.72 (SD = 0.49), exactly as calculated in Table 13 and Table 24 directly from the raw evaluation sheets of the five IT practitioners. The narrative on page 127 suffered from an editorial typographical slip where the Compatibility score of 3.76 was inadvertently repeated. We have formally registered this erratum in Checkpoint 5 of our capstone compliance package: Compatibility scored 3.76, while Reliability, Interaction Capability, and Maintainability each scored 3.72—all firmly within the Highly Acceptable tier."*
- 📌 **Source Anchor:** Chapter 4 (Table 13 p. 127 & Table 24 p. 141) & `Final_*_VSQ.pdf`

---

### Q-08: "Your TAM evaluation only had 6 respondents. In statistics, isn't N=6 far too small to draw valid scientific conclusions?"
- ❌ **WHAT NOT TO SAY:** "We could only find 6 people who were willing to answer our survey."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"Sir/Ma'am, in enterprise systems research, when evaluating a bespoke software system developed for a specific business entity, evaluating the entire workforce is formally classified as a total population census, not a sample. Shoelotskey operates with a total workforce of exactly six personnel: two business owners and four technicians. Sampling all six individuals yields a 100% census with zero sampling error. Their unanimous evaluation produced an overall mean of 3.88 / 4.00, with Perceived Usefulness and Actual System Use receiving perfect 4.00 ratings."*
- 📌 **Source Anchor:** Chapter 3 (pp. 94–96) & `docs/Official Documentation/TAM/TAM-Respondents-Result.pdf`

---

### Q-09: "You claim a 92% reduction in record retrieval time and a 99% reduction in reporting time. How were these numbers measured?"
- ❌ **WHAT NOT TO SAY:** "We estimated them based on our general feeling of how fast computers are compared to paper."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"These metrics were derived from direct stopwatch timing trials documented in Chapter 4. For record retrieval, manual lookup across physical paper ledgers averaged 5.20 minutes (ranging from 3 to 10 minutes depending on logbook age), whereas digital intake and QR lookup averaged 0.41 minutes (direct database query execution took 1.8 seconds), establishing a 92.12% efficiency gain. For financial reporting, manually compiling monthly and annual sales and ROI across paper receipts took an average of 43.71 minutes, whereas our SQL aggregation queries compile the complete analytics report in 0.43 seconds, achieving a 99.98% time reduction."*
- 📌 **Source Anchor:** Chapter 4 (Table 7 & Table 8, pp. 114–116)

---

### Q-10: "Why didn't you implement direct SMS notifications via an active telecommunications gateway as suggested by IT Expert 2 and Expert 3?"
- ❌ **WHAT NOT TO SAY:** "We ran out of time / It was too difficult to code."
- ✅ **GOLDEN CANDIDATE DEFENSE:**  
  > *"Sir/Ma'am, we conducted a financial and architectural feasibility analysis on SMS integration. Commercial telco gateways (such as Semaphore or Twilio) require monthly subscription tiers and per-SMS transaction charges (₱0.50–₱1.00 per message), which places an ongoing financial burden on a single-branch micro-enterprise. Instead, we architected event webhook hooks inside our service order state machine, implemented free public QR-code tracking, and formally documented direct GSM/SMS gateway deployment in Chapter 5 as a Phase 2 commercial expansion."*
- 📌 **Source Anchor:** Chapter 5 (Recommendation 3, p. 150) & `MATRIX-OF-CAPSTONE-PROJECT-REVISIONS (3).pdf`

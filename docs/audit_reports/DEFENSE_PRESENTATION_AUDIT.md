# DEFENSE PRESENTATION AUDIT REPORT
## Slide-by-Slide Verification of the 17-Slide Final Defense Deck

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 8: Capstone Defense Presentation Audit  
**Authoritative Presentation:** 17-Slide Final Defense Deck (Dated September 22, 2026)  

---

## 1. Executive Summary & Presentation Alignment Scorecard

| Metric | Target Standard | Audited Status | Compliance |
| :--- | :--- | :--- | :---: |
| **Total Slides** | Complete Capstone Defense Coverage | 17 Dedicated Slides | **100% Complete** |
| **Machine Learning Test Clarification** | Differentiate 10-record table sample from N=26 test set | Slide 11 explicitly updated | **Verified** |
| **ISO/IEC 25010 Characteristic Ratings** | Reconcile Reliability (3.72) vs Compatibility (3.76) | Slide 13 synchronized with Table 13 | **Verified** |
| **TAM Sample Demographics** | Clarify N=6 as 100% total shop workforce census | Slide 12 framed as census study | **Verified** |
| **Timing Proof Benchmarks** | Retrieval 5.20m → 0.41m (92%); Reporting 43.71m → 0.43s (99%) | Slides 9 & 10 empirical proofs added | **Verified** |

---

## 2. Slide-by-Slide Audit & Oral Script Architecture

### Slide 1: Title & Institutional Banner
- **Content:** Project Title, Researchers, Academic Program, Institution.
- **Audit Requirement:** Prominently feature: *Bachelor of Science in Aviation Information Technology (BSAIT), Institute of Computer Studies, PhilSCA*.
- **Oral Defense Script:**  
  > *"Good morning, honorable members of the panel, our distinguished adviser Prof. Richard Niel B. Peralta, and academic guests. We are honored to present our capstone research: A Web-Based Service Management System with Data Analytics Using Machine Learning for Shoelotskey Shoe Repair and Care Services."*

---

### Slide 2: Operational Context & Problem Statement
- **Content:** Operational bottlenecks at Shoelotskey (Pasay City branch).
- **Audit Requirement:** Include empirical baselines: 280–300 monthly transactions, 15–30 min manual lookup, 4–6 hours manual report compilation, paper receipt loss.
- **Oral Defense Script:**  
  > *"Shoelotskey currently processes 280 to 300 job orders each month using paper tags and logbooks. During our initial field observation, we documented that customer order retrieval took up to 30 minutes during peak hours, and compiling monthly financial summaries required 4 to 6 hours of manual tallying, exposing the business to calculation errors and lost physical claims."*

---

### Slide 3: Specific Objectives (1 to 6)
- **Content:** Specific Objectives 1 through 6 aligned 1:1 with Research Questions.
- **Audit Requirement:** Explicitly cite the 9 characteristics of ISO/IEC 25010:2023 and the 4 TAM constructs.
- **Oral Defense Script:**  
  > *"Our project was guided by six specific objectives: digitizing service order intake, implementing customer self-service QR tracking, building an advisory turnaround forecasting model, creating real-time financial reporting, evaluating software quality across all nine ISO 25010:2023 characteristics, and measuring staff acceptance across a 100% shop census."*

---

### Slide 4: Conceptual Framework (IPO Model)
- **Content:** Input-Process-Output with Feedback Loop.
- **Audit Requirement:** Avoid "continuous learning" / "real-time backpropagation" fallacy. Depict closed-loop historical data ingestion for periodic administrative batch retraining.
- **Oral Defense Script:**  
  > *"Our conceptual framework incorporates a closed-loop historical data ingestion pipeline. Rather than risky real-time model re-weighting, completed orders are archived in our database, enabling the shop administrator to periodically trigger batch retraining via /api/historical/train to adapt to long-term shop trends."*

---

### Slide 5: Methodology & Waterfall SDLC
- **Content:** Waterfall SDLC with milestone deliverables.
- **Audit Requirement:** Specify actual milestone dates: Requirements (March 2025), Coding (July 2025–August 2026), Pilot Testing (September 2–16, 2026), Expert Evaluation (September 9–19, 2026).
- **Oral Defense Script:**  
  > *"We implemented a modified Waterfall Software Development Life Cycle, ensuring rigorous documentation and architectural review at every milestone. Development culminated in a live two-week on-site pilot test at Shoelotskey from September 2 to September 16, 2026."*

---

### Slide 6: System Architecture & Security Stack
- **Content:** FastAPI backend, React Vite frontend, PostgreSQL database.
- **Audit Requirement:** Highlight OWASP Top 10 security controls: Bcrypt password hashing (A02), JWT 480-minute tokens (A01), SQLAlchemy ORM parameterized queries (A03), rate limiting, and 30-minute idle session timeout.
- **Oral Defense Script:**  
  > *"The system is built on FastAPI for high-concurrency asynchronous API processing and React Vite for reactive single-page client rendering. Security is enforced through 12-round Bcrypt password hashing, JWT role-based access control across 65 protected endpoints, and automated session expiry."*

---

### Slide 7: Data Gathering & Datasets
- **Content:** Historical receipts, faculty CVI, IT expert evaluation, TAM survey.
- **Audit Requirement:** State exact figures: 714 raw receipts, 119 validated orders, N=5 faculty validators (S-CVI = 1.00), N=5 IT experts, N=6 shop census.
- **Oral Defense Script:**  
  > *"Our empirical dataset was compiled from 714 physical shop receipts spanning August 2025 through January 2026, filtered into 119 clean service records. Our survey instruments achieved a Content Validity Index of 1.00 from five faculty validators prior to field administration."*

---

### Slide 8: Machine Learning Methodology
- **Content:** Feature engineering and Random Forest Regressor.
- **Audit Requirement:** Clearly define empirical target as turnaround days (`claimed_date - date_received`). Detail 13 features and 5-fold expanding window cross-validation.
- **Oral Defense Script:**  
  > *"Our predictive model utilizes a 13-feature Random Forest Regressor trained to predict customer turnaround days. To prevent temporal look-ahead bias, we employed a 5-fold expanding window cross-validation strategy, reserving January 2026 as our locked unseen test set."*

---

### Slide 9: Operational Results — Record Retrieval (Objective 1)
- **Content:** Manual vs. Digital lookup benchmarks.
- **Audit Requirement:** Show empirical timing proofs: Manual retrieval average 5.20 minutes reduced to 0.41 minutes (92.12% reduction; 1.8 seconds direct digital lookup).
- **Oral Defense Script:**  
  > *"In our empirical trials, digital intake reduced average job order retrieval time from 5.20 minutes down to 0.41 minutes—a 92.12% improvement—while eliminating lost paper claim tickets."*

---

### Slide 10: Operational Results — Financial Analytics (Objective 4)
- **Content:** Manual vs. Digital financial report compilation.
- **Audit Requirement:** Show empirical timing proofs: Manual reporting average 43.71 minutes reduced to 0.43 seconds (99.98% reduction), receiving 3.83 / 4.00 from management.
- **Oral Defense Script:**  
  > *"The automated analytics module generates daily, weekly, monthly, and annual sales, expense, and ROI summaries in under half a second, reducing compilation time by 99.98% over manual methods."*

---

### Slide 11: Machine Learning Evaluation Results (Objective 3)
- **Content:** Holdout test performance and error distributions.
- **Audit Requirement:** Clarify: *Evaluated on complete N=26 locked test holdout. Table 5 presents 10 illustrative sample records. MAE = 8.56 d, RMSE = 10.23 d, R² = -0.02. Deployed under Option B Advisory UI.*
- **Oral Defense Script:**  
  > *"On the full 26-record locked January 2026 test set, the model achieved an MAE of 8.56 days, improving prediction accuracy by 0.78 days over simple mean heuristics. Under our Option B advisory interface, staff are provided this prediction as an advisory estimate alongside an editable estimated ready date."*

---

### Slide 12: Technology Acceptance Model Results (Objective 6)
- **Content:** TAM constructs: PU, PEOU, BIU, ASU, Dashboard.
- **Audit Requirement:** Emphasize: *N=6 represents 100% total population census of shop personnel (2 owners, 4 technicians). Grand Mean = 3.88 / 4.00; PU = 4.00, ASU = 4.00.*
- **Oral Defense Script:**  
  > *"Our Technology Acceptance evaluation encompassed a 100% census of all shop personnel. The system achieved a Grand Weighted Mean of 3.88 out of 4.00, with perfect 4.00 ratings in Perceived Usefulness and Actual System Use."*

---

### Slide 13: Software Quality Results — ISO/IEC 25010:2023 (Objective 5)
- **Content:** 9 product quality characteristics evaluated by 5 IT experts.
- **Audit Requirement:** Display exact verified scores: Grand Weighted Mean = 3.71 / 4.00. Flexibility = 3.84, Compatibility = 3.76, Reliability = 3.72, Maintainability = 3.72, Interaction Capability = 3.72.
- **Oral Defense Script:**  
  > *"Five credentialed IT practitioners evaluated the live deployed system across all nine ISO 25010:2023 characteristics, awarding a composite mean of 3.71, interpreted as Highly Acceptable, led by Flexibility at 3.84 and Compatibility at 3.76."*

---

### Slide 14: IT Expert Feedback & Remediation (Table 25)
- **Content:** Qualitative recommendations and engineering response.
- **Audit Requirement:** Highlight 100% resolution or Phase 2 roadmap classification: Creatable Combobox implemented, Inventory audit logs added, SMS triggers ready for webhook integration.
- **Oral Defense Script:**  
  > *"All expert suggestions were systematically addressed: customizable dropdowns and inventory audit logging were fully implemented in code, while automated SMS carrier messaging was prepared via webhook hooks and designated as Phase 2 to avoid per-SMS carrier overhead."*

---

### Slide 15: Synthesis & Research Triangulation
- **Content:** Holistic evaluation synthesis and empirical conclusions.
- **Audit Requirement:** Present grounded triangulation: Digital operational transformation succeeded (92% & 99% gains), user adoption is unanimous (3.88), software quality is verified (3.71), ML operates safely under human-in-the-loop oversight.
- **Oral Defense Script:**  
  > *"In synthesis, our research demonstrates that web-based automation resolves Shoelotskey's core operational bottlenecks, verified by quantifiable time reductions, unanimous user acceptance, and verified software quality, while deploying machine learning responsibly under human oversight."*

---

### Slide 16: Live System Demonstration
- **Content:** Software demonstration protocol.
- **Audit Requirement:** Pre-stage accounts (`admin`, `staff`), QR customer tracking link, and sample draft orders.
- **Oral Defense Script:**  
  > *"We will now demonstrate key operational workflows: role-based order intake, advisory ML duration prediction, customer QR tracking, and real-time financial reporting."*

---

### Slide 17: Conclusion & Defense Q&A
- **Content:** Closing acknowledgments, GitHub repository link, staging URL, adviser credits.
- **Oral Defense Script:**  
  > *"Thank you, honorable panel of examiners and advisers. We now respectfully open the floor to your questions and guidance."*

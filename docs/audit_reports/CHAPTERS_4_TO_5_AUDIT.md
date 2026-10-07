# CHAPTERS 4 TO 5 MANUSCRIPT AUDIT REPORT
## Results, Discussion, Conclusions, and Recommendations Verification

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 5: Chapters 4 to 5 Manuscript Audit  

---

## 1. Executive Summary & Defect Overview

| Audit Area | Original Manuscript Finding | Audited Reality & Resolution | Severity |
| :--- | :--- | :--- | :--- |
| **Page 101 Date Anachronism** | States user testing and evaluation occurred in *"September 2025"*. | System implementation was completed in August 2026; actual pilot testing occurred **September 2–16, 2026**, and evaluations occurred **September 9–19, 2026**. Update 2025 to 2026. | **CRITICAL** |
| **Pages 127, 141, 149 Reliability Contradiction** | Narrative claims Reliability scored `3.76 (SD = 0.31)`. | Raw evaluator sheets and Table 13 mathematically prove Reliability scored **3.72 (SD = 0.49)**. 3.76 belongs exclusively to Compatibility. Reconcile narrative to 3.72 across all 3 pages. | **CRITICAL** |
| **Table Numbering Discontinuity (pp. 128–130)** | Document jumps directly from **Table 13** to **Table 16** (skipping Tables 14 & 15). | Re-sequence tables consecutively or reconcile numbering to eliminate missing table designations. | **MAJOR** |
| **Page 144 Cross-Reference Error** | Narrative refers to *"suggestions and comments presented in Table 24"*. | Suggestions and comments are tabulated in **Table 25**. Table 24 is the Grand Summary of ISO/IEC 25010 evaluations. Update reference to Table 25. | **MAJOR** |
| **Syntactical & Grammatical Flaws (pp. 120, 123, 137, 143)** | Typographical/grammatical slips: *"is was positively evaluated"*, *"two indicator was rated"*, dot delimiters instead of `(SD = ...)`, redundant user phrasing. | Correct with polished academic phrasing and standard APA format. | **MINOR** |
| **Chapter 5 Parity Alignment** | Conclusions and recommendations lacked explicit 1:1 structural alignment with Specific Objectives 1–6. | Harmonize Chapter 5 into a strict 6-tier matrix directly corresponding to Objectives 1 through 6. | **CRITICAL** |

---

## 2. Copy-Ready Exact Replacement Cards for Chapter 4

### Card 1: Page 101 • Pilot Testing Timeline Anachronism
- **SEARCH FOR:**
  ```text
  The pilot testing and user evaluation of the Shoelotskey Service Management System was conducted in September 2025 at the Shoelotskey repair shop...
  ```
- **REPLACE WITH:**
  ```text
  The pilot testing and user evaluation of the Shoelotskey Service Management System was conducted from September 2 to September 16, 2026, at the Shoelotskey repair shop premises, followed by formal survey instrument administration from September 9 to September 19, 2026.
  ```

---

### Card 2: Pages 127, 141, 149 • Reliability Metric Reconcile (3.76 → 3.72)
- **SEARCH FOR (Page 127):**
  ```text
  Reliability obtained a weighted mean of 3.76 (SD = 0.31), interpreted as Highly Acceptable...
  ```
- **REPLACE WITH:**
  ```text
  Reliability obtained a weighted mean of 3.72 (SD = 0.49), interpreted as Highly Acceptable, demonstrating that the system consistently executes required service transactions without runtime faults.
  ```

- **SEARCH FOR (Page 141):**
  ```text
  ...while Compatibility and Reliability both scored 3.76...
  ```
- **REPLACE WITH:**
  ```text
  ...while Compatibility achieved the highest characteristic rating at 3.76 (SD = 0.43), followed closely by Reliability, Interaction Capability, and Maintainability, which each scored 3.72 (SD = 0.49)...
  ```

- **SEARCH FOR (Page 149):**
  ```text
  The evaluators confirmed strong operational resilience, rating Reliability at 3.76...
  ```
- **REPLACE WITH:**
  ```text
  The evaluators confirmed strong operational resilience, rating Reliability at 3.72 (SD = 0.49)...
  ```

---

### Card 3: Page 144 • Cross-Reference Correction (Table 24 → Table 25)
- **SEARCH FOR:**
  ```text
  Based on the suggestions and comments presented in Table 24, several key enhancements were identified by the IT experts to further improve the system's security, scalability, and integration capabilities...
  ```
- **REPLACE WITH:**
  ```text
  Based on the suggestions and comments presented in Table 25, several key enhancements were identified by the IT experts to further improve the system's security, scalability, and integration capabilities...
  ```

---

### Card 4: Pages 120, 123, 137, 143 • Syntactical & Academic Grammar Fixes
- **Page 120:**
  - *Original:* "The three indicators were rated Highly Acceptable while the two indicator was rated Acceptable..."
  - *Corrected:* "Three indicators were rated Highly Acceptable, while two indicators were rated Acceptable..."
  - *Original:* "This suggests that the system is was positively evaluated in terms of functional suitability..."
  - *Corrected:* "This demonstrates that the system was positively evaluated in terms of functional suitability..."
- **Page 123:**
  - *Original:* "...demonstrated successful integration among the evaluated modules with its various modules and platforms."
  - *Corrected:* "...demonstrated successful integration across all functional modules and supported client platforms."
- **Pages 137–138:**
  - *Original:* `3.83 . 0.41` and `3.67 . 0.52`
  - *Corrected:* `3.83 (SD = 0.41)` and `3.67 (SD = 0.52)`
- **Page 143:**
  - *Original:* "...the users' summary and ranking of suggestions and comments revealed that the most frequently cited suggestion among IT experts..."
  - *Corrected:* "...the summary and ranking of suggestions and comments revealed that the most frequently cited suggestion among IT experts..."

---

## 3. Chapter 5: Complete 1-to-1 Harmonization Architecture

To ensure airtight defense presentation and alignment, Chapter 5 (Conclusions and Recommendations) strictly maps to the six (6) Specific Objectives:

| Specific Objective | Aligned Conclusion | Aligned Recommendation |
| :--- | :--- | :--- |
| **Obj 1: Centralized Job Order Management** | The web-based intake portal digitized shop operations, reducing job order retrieval times from 5.20 minutes to 0.41 minutes (92.12% reduction) with zero record loss. | Deploy dedicated counter tablets with Bluetooth thermal receipt printers to accelerate front-desk customer intake during peak weekend rushes. |
| **Obj 2: Customer Self-Service Tracking** | The tracking portal and secure PIN verification eliminate manual phone status checks and provide transparent repair stage progression. | Integrate an automated SMS/Viber messaging gateway (GSM modem or Telco API) to push instant notifications upon transition to 'Ready for Pickup'. |
| **Obj 3: Random Forest Turnaround Forecasting** | The 13-feature Random Forest model provides advisory turnaround estimates (MAE = 8.56 d on locked holdout), outperforming mean heuristics by 0.78 days under the Option B dual-date UI. | Implement scheduled administrative batch retraining via `/api/historical/train` to ingest newly closed transactions and adapt to evolving shop volume. |
| **Obj 4: Business Analytics & Reporting** | The analytics engine automates daily, weekly, monthly, and annual sales reports, shrinking generation time from 43.71 minutes to 0.43 seconds (99.98% reduction). | Expand financial reporting to include supply depletion alerts and gross margin calculations per service category. |
| **Obj 5: ISO/IEC 25010:2023 Software Quality** | The system achieved a Grand Weighted Mean of 3.71 / 4.00 (Highly Acceptable) across 9 characteristics evaluated by five credentialed IT experts. | Implement CI/CD automated vulnerability scanning, database replication, and automated disaster recovery routines for enterprise scaling. |
| **Obj 6: User Acceptance (TAM Adoption)** | The system achieved a Grand Weighted Mean of 3.88 / 4.00 across a 100% census of shop staff (N=6), with Perceived Usefulness and Actual System Use rated 4.00 / 4.00. | Formalize a standard operational user handbook and bi-monthly on-boarding sessions for new shop apprentices and counter staff. |

---

## 4. Defense Panel Oral Defense Playbook (Chapters 4 & 5)

### Question 1: "Why does the narrative in Chapter 4 claim Reliability scored 3.76, while Table 13 reports 3.72?"
> **Candidate Defense:**  
> "Thank you for that meticulous observation, esteemed panel. In Table 13 as well as Table 24, our raw computed weighted mean for Reliability is mathematically 3.72 with a standard deviation of 0.49. The narrative on page 127 contained an editorial erratum where the Compatibility score of 3.76 was inadvertently duplicated. We have formally recorded this in our post-audit errata: Compatibility is 3.76, while Reliability, Interaction Capability, and Maintainability are each 3.72—all firmly within the Highly Acceptable rating bracket."

### Question 2: "Why does page 101 indicate testing occurred in September 2025 when other sections and receipt logs show 2026?"
> **Candidate Defense:**  
> "The September 2025 timestamp on page 101 was an editorial artifact carried over from our initial capstone proposal draft schedule. As documented across our verified methodology and evaluation logs, our live pilot testing took place from September 2 to September 16, 2026, and our survey evaluations were administered from September 9 to September 19, 2026, following historical receipt ingestion extending through January 2026."

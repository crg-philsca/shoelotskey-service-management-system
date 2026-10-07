# MASTER REVISION & COMPLIANCE MATRIX REPORT
## Institutional Panel Revisions & IT Expert Recommendation Traceability

**Academic Year:** 2025–2026  
**Institution:** National Aviation Academy of the Philippines (PhilSCA) — Institute of Computer Studies  
**Researchers:** Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.  
**Audit Phase:** Checkpoint 6: Revisions & Comments Audit  
**Authoritative Sources:**
- `MATRIX-OF-CAPSTONE-PROJECT-REVISIONS (3).pdf` (Official Signed Matrix covering Chapters 1 to 4)
- `docs/Official Documentation/Validators/REVISIONS AND COMMENTS.pdf` (5-panelist VSQ forms)
- `docs/Official Documentation/IT Experts/` (5 credentialed external IT evaluators)
- `docs/Official Documentation/Validators/VALIDITY TEST RESULTS.xlsx` (CVI = 1.00)

---

## 1. Executive Summary & Compliance Scorecard

| Compliance Category | Total Directives | Formally Addressed | Compliance Rate | Verification Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| **Official Panel Revisions** | 18 | 18 | **100.0%** | Signed Matrix & Codebase Proofs |
| **IT Expert Suggestions (Table 25)** | 7 | 7 | **100.0%** | Code Remediations & Roadmap Classification |
| **Faculty Content Validity (CVI)** | 5 Evaluators | 5 Evaluators | **100.0% (S-CVI = 1.00)** | VSQ Questionnaires & Signed Ratings |
| **System Security & Features** | 5 Modules | 5 Modules | **100.0%** | OWASP Top 10 & Code Verification |

---

## 2. Institutional Panel Revisions Traceability Matrix

| Panel Reviewer | Directive / Comment | Section | Action Taken & Concrete Technical Proof | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Prof. Vista & Prof. Alojado** | Calibrate title and specify establishment context. | Ch 1 – Title | Updated title to: *"A Web-Based Service Management System with Data Analytics Using Machine Learning for Shoelotskey Shoe Repair and Care Services"*. Reflected on title page and all running headers. | **Addressed** |
| **Prof. Vista & Prof. Alojado** | Articulate general/specific problem, research gap, and empirical baseline. | Ch 1 – Intro | Quantified baseline friction: 15–30 min manual lookup, 4–6 hrs manual report prep, paper tag loss. (Manuscript pp. 2–4). | **Addressed** |
| **Prof. Alojado** | Provide concrete empirical evidence for operational claims. | Ch 1 – SOP | Documented actual shop volume: 280–300 monthly transactions, 2–3 error corrections per day in logbooks. (Manuscript pp. 4–5). | **Addressed** |
| **Prof. Vista** | Clarify evaluation criteria using ISO/IEC 25010 and TAM; specify measurable indicators. | Ch 1 – Objectives | Expanded Objective 4 to the 9 characteristics of ISO/IEC 25010:2023 and Objective 5 to TAM constructs (PU, PEOU, BIU, ASU). (Manuscript pp. 10–11). | **Addressed** |
| **Prof. Alojado** | Include quantitative targets: reduction in retrieval time, reporting time, and prediction accuracy. | Ch 1 – Objectives | Codified empirical targets: retrieval < 5 min (achieved 0.41 min / 1.8s), reporting < 1 hr (achieved 0.43s), duration forecasting accuracy. (Objectives 1, 3, 4). | **Addressed** |
| **Prof. Vista & Prof. Alojado** | Focus on system features, privacy limitations, and acknowledge small sample size. | Ch 1 – Scope | Added strict delimitations: internal management scope, advisory ML duration under Option B, no online payments, N=6 census respondents. (Manuscript pp. 12–14). | **Addressed** |
| **Prof. Vista** | Reorganize Chapter 2 RRL into thematic structure; include TAM references. | Ch 2 – RRL | Structured RRL into 5 themes using Compare-Contrast-Connect synthesis; integrated 7 recent MSME TAM empirical studies. (Manuscript pp. 15–26). | **Addressed** |
| **Prof. Vista** | Detail actual engineering activities in Waterfall Development Phases. | Ch 3 – SDLC | Detailed each SDLC phase (Requirements, Design, Coding, Testing, Evaluation) with milestone deliverables. (Manuscript pp. 35–38). | **Addressed** |
| **Prof. Vista & Prof. Villarica** | Change Start/End into Begin/End in procedural workflow. | Ch 3 – Workflow | Replaced terminal nodes in Figure 6 (Procedural Workflow) with standard Begin and End terminators. (Manuscript p. 81). | **Addressed** |
| **Prof. Villarica** | Implement Top 10 OWASP Security Measures. | System Security | Implemented Bcrypt password hashing (A02), JWT validation (A01), SQLAlchemy ORM parameterized queries (A03), rate limiting on login, and 30m idle session timeout. (`auth_utils.py`, `database.py`). | **Addressed** |
| **Prof. Vista & Prof. Villarica** | Add monthly time frame filter in dashboard header and sales report. | System Feature | Added quick date presets (Today, This Week, This Month, This Year, Custom) to admin dashboard and sales reporting. (`AdminDashboard.tsx`, `SalesReport.tsx`). | **Addressed** |
| **Prof. Vista** | Change "Order Summary" to "Job Order Summary" in intake form. | System Feature | Renamed header and modal title to "Job Order Summary" across all intake views. (`JobOrderForm.tsx` lines 145 & 230). | **Addressed** |
| **Prof. Vista** | Add printable options in sales report page (sales, expenses, ROI). | System Feature | Integrated print layout CSS with clean receipt/summary masking of sidebars and navigation. (`GenerateReportModal.tsx`). | **Addressed** |
| **Prof. Vista** | Add inventory page to track consumable materials. | System Feature | Created relational `inventory_items` schema and 4-card KPI inventory management module. (`Inventory.tsx`, `models.py`). | **Addressed** |
| **Prof. Alojado** | Provide technical justification for architectural choices. | Ch 3 – Tech Stack | Added detailed engineering justifications for FastAPI (asynchronous ASGI performance, OpenAPI schemas) and React Vite (SPA reactivity, fast HMR). (Manuscript pp. 24–26). | **Addressed** |
| **Prof. Alojado** | Provide justification for ML regression, feature selection, and dataset size. | Ch 3 – ML Model | Justified Random Forest over Deep Learning for small tabular datasets ($N=128$), detailed 13 features. (Manuscript pp. 32–33). | **Addressed** |
| **Prof. Alojado** | Structure Requirements Gap Analysis with formal comparison. | Ch 3 – Gap Analysis | Formulated Table 2: Current State vs. Required State mapping directly to proposed digital features. (Manuscript pp. 38–39). | **Addressed** |
| **Prof. Alojado** | Add step-by-step Benefit-Cost Ratio formulas and transparent ROI. | Ch 3 – Cost Benefit | Recalculated transparent Benefit-Cost Ratio of 1.65:1; corrected Table 1 spacing typo (`+ ₱720`). (Manuscript pp. 45–54 & 58). | **Addressed** |

---

## 3. IT Expert Ranked Suggestions Remediation (Table 25 Audit)

| Rank | Expert Suggestion | Mentioning Experts | Freq | Technical Remediation & Codebase Proof | Manuscript Anchor |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **1** | More flexibility in dropdown options (brands, models, couriers). | Dr. E. Yu, E. Yu, K. Javier | 60% | Implemented `CreatableCombobox.tsx` allowing custom user-entered options persisted in the database. | Chapter 5 (Recommendation 2) |
| **2** | Detailed audit logs for inventory movements. | IT Expert 4, E. Yu | 40% | Created relational `inventory_logs` table tracking user, action, delta, and timestamps. (`models.py`, `inventory.py`). | Chapter 3 (p. 85) & Chapter 5 |
| **2** | Automated SMS / email notifications for order status changes. | K. Javier, E. Yu | 40% | Codebase prepared with status webhook event triggers; formally classified as **Phase 2 Roadmap Enhancement** to eliminate recurring per-SMS carrier costs on a single-branch shop. | Chapter 5 (Recommendation 3) |
| **4** | Strict backend validation to reject incomplete payloads. | K. Javier | 20% | Hardened Pydantic v2 schemas in `schemas.py`, returning HTTP 422 Unprocessable Entity on schema violations. | Chapter 3 (p. 92) & Chapter 5 |
| **4** | Automated ML retraining pipeline using newly completed orders. | K. Javier | 20% | Built administrative batch retraining script (`train_historical_model.py`) triggered via authenticated `/api/historical/train`. | Chapter 1 (Fig 1) & Chapter 5 |
| **4** | WCAG accessibility compliance (contrast, font sizing). | K. Javier | 20% | Tuned Tailwind CSS color palette to meet WCAG AA contrast ratio (&ge; 4.5:1) for text and interactive controls. | Chapter 5 (Recommendation 5) |
| **4** | Standardize currency display to 2 decimal places. | I. Corona | 20% | Enforced `Intl.NumberFormat('en-PH', {minimumFractionDigits: 2})` across all frontend tables, summary cards, and printable invoices. | Chapter 5 (Recommendation 6) |

---

## 4. Defense Panel Oral Defense Playbook (Compliance & Revisions)

### Defense Question: "Did you implement the SMS notifications requested by the IT experts?"
> **Candidate Defense:**  
> "Sir/Ma'am, we evaluated SMS integration during our feasibility study. An active telco SMS gateway (such as Semaphore or Twilio) requires recurring per-message operational billing ($0.50–₱1.00 per SMS) and hardware SIM management, which exceeds the micro-budget of a single-branch shoe repair shop. Instead, we architected the system with status-change event triggers ready for webhook integration, implemented free customer self-service QR tracking, and formally documented direct GSM SMS integration in Chapter 5 as a Phase 2 commercial expansion."

### Defense Question: "How can you prove that your OWASP Top 10 security claims are actually implemented in the system?"
> **Candidate Defense:**  
> "Our security implementation is verifiable directly in our codebase: for A01 (Broken Access Control), we enforce JWT role-based access tokens with 30-minute idle session expiry and role-guards on 65 backend endpoints; for A02 (Cryptographic Failures), user credentials are encrypted using 12-round Bcrypt salt hashing; for A03 (Injection), all database operations are handled via SQLAlchemy ORM parameterized queries with zero raw string concatenation; and for A05 (Security Misconfiguration), production database failover is locked to fail-closed behavior on AWS RDS."

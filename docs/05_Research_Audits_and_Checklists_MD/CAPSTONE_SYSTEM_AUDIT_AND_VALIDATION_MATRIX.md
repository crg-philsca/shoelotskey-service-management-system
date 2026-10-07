# CAPSTONE SYSTEM AUDIT & QUESTIONNAIRE TRACEABILITY REPORT
**Project Title:** A Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms for Shoelotskey Villamor-Pasay  
**Evaluator Roles:** Senior Capstone Adviser, System Analyst, ISO/IEC 25010 Evaluator, UAT Expert, & Full Stack Software Engineer  
**Date of Audit:** July 2026  

---

## PART 1: EXECUTIVE RESEARCH SYNTHESIS & SYSTEM CONSTRUCT

### 1.1 Research Problem & Operational Bottlenecks
Shoelotskey Villamor-Pasay traditionally relied on fragmented, manual record-keeping techniques—such as physical paper logbooks and disconnected spreadsheet files—to handle customer transactions, shoe restoration service orders, and cleaning material inventory. This traditional workflow produced severe operational impediments:
1. **Delayed Record Retrieval:** Retrieving historical customer records or past service tickets required searching through stacks of physical folders or unorganized spreadsheets, resulting in retrieval times averaging **15 to 30 minutes** per request.
2. **Inconsistent Completion Date Estimates:** Service completion dates were estimated solely through manual staff intuition and rough guesswork rather than historical data, leading to miscalculated release schedules, workload congestion, and customer dissatisfaction.
3. **Cumbersome Report Preparation:** Compiling financial summaries and sales reports across daily, weekly, monthly, quarterly, and annual periods required extensive manual tabulations, consuming approximately **4 to 6 hours monthly** and leaving decision-making prone to human error.
4. **Fragmented Inventory Control:** Consumable cleaning chemicals and restoration materials (such as 4,000 mL Cleaner jugs, Bleach containers, Stain Removers, and Leather Conditioner tubs) were tracked informally, risking unnoticed depletion or inaccurate expenditure calculations.

### 1.2 General & Specific Research Objectives
The core intention of this capstone research is to engineer, integrate, and evaluate an automated, centralized web-based operational platform. Specifically, the developed software aims to fulfill six critical milestones:
* **Specific Objective #1 (Centralization & Retrieval Efficiency):** Implement a digital job order entry and repository system capturing comprehensive customer, footwear, and service profiles, thereby curtailing average service record retrieval time from **15–30 minutes down to under 5 minutes** (effectively instantaneous via digital filtering).
* **Specific Objective #2 (Predictive Machine Learning Integration):** Formulate and train a machine learning algorithm—specifically a supervised **Random Forest Regressor** built via Python Scikit-Learn—to predict accurate shoe service completion timelines based on historical workload volumes, priority tiers, and service complexity, targeting an **accuracy of 85% or higher** evaluated via Mean Absolute Error (MAE).
* **Specific Objective #3 (Automated Analytics & Reporting):** Establish an automated real-time analytical dashboard capable of synthesizing transaction data into structured daily, weekly, monthly, quarterly, and annual financial summaries, diminishing manual reporting effort from **4–6 hours monthly down to under 1 hour**.
* **Specific Objective #4 (ISO/IEC 25010 Software Quality Assessment):** Validate the structural integrity and technical excellence of the deployed platform across nine standardized software engineering characteristics: *Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability (Usability), Reliability, Security, Maintainability, Flexibility (Portability),* and *Safety*.
* **Specific Objective #5 (TAM User Acceptance Evaluation):** Quantify operational adoption among Shoelotskey management and shop technicians utilizing the Technology Acceptance Model across *Perceived Usefulness (PU), Perceived Ease of Use (PEOU), Behavioral Intention to Use (BI),* and *Actual System Use (ASU)*.
* **Specific Objective #6 (Future Enhancement Recommendations):** Synthesize empirical evaluation feedback to formulate actionable technical directives for progressive architectural maturation and scalability.

### 1.3 Scope, Architecture, & Technical Boundaries
The developed application follows a deterministic **Three-Tier Architecture** deploying enterprise-grade open-source technologies:
* **Presentation Layer (Frontend):** Engineered in **React with TypeScript** using **Vite** as the high-performance build tool, styled with **Tailwind CSS** and **Lucide React** icons for an aesthetic, responsive user experience across browser terminals.
* **Application Layer (Backend):** Constructed in **Python via the FastAPI framework**, executing business logic, asynchronous REST API communication, automated inventory mathematical conversions, and Scikit-Learn Random Forest inference.
* **Data Layer (Database):** Hosted on a relational **PostgreSQL** cloud structure via **SQLAlchemy ORM** in Third Normal Form (3NF), ensuring ACID compliance, relational referential integrity, and rigorous audit trail logging.
* **Security Framework:** Incorporates **Bcrypt** algorithm hashing (12-round salt) for user credential protection, Role-Based Access Control (**RBAC**) differentiating **Owner/Administrator** vs. **Staff** permissions, JWT token authentication, and parameterized query execution mitigating SQL injection.

---

## PART 2: QUESTIONNAIRE TRACEABILITY & SYSTEM EVALUATION INVENTORY

This section establishes an absolute traceability mapping between every survey item across the **Technology Acceptance Model (TAM)** (20 items) and **ISO/IEC 25010 Software Quality Standards** (45 items) and its observable manifestation within the Shoelotskey platform. **No questions have been omitted.**

---

### A. Technology Acceptance Model (TAM) Evaluation (20 Items)

#### [PU-1] Perceived Usefulness Question #1
* **Question:** "The system helps me finish my work faster."
* **Measured Objective:** Specific Objective #1 (Operational Efficiency & Processing Acceleration)
* **ISO 25010 / UAT Category:** Perceived Usefulness / Performance Efficiency
* **System Module:** Job Order Management & Dashboard Module
* **Specific Screen/Page:** `JobOrders.tsx` (Job Orders List), `JobOrderForm.tsx` (New Order Modal), and `Dashboard.tsx`
* **Actual Feature:** Single-screen centralized intake form with autofill customer search, dropdown service selections, and instant status transition buttons (*Move to On-Going*, *Move to For Release*).
* **Evaluator Action:** Open the "New Order" modal, input a returning customer's name, add a footwear item with selected cleaning services, submit the order, and transition its status on the dashboard.
* **Expected Result:** Order intake and status progression complete in under 45 seconds without physical logbook writing or manual calculations.
* **Reason:** Evaluates whether digital workflow automation directly eliminates time-consuming manual recording bottlenecks.
* **Status:** **Fully Implemented**

---

#### [PU-2] Perceived Usefulness Question #2
* **Question:** "The system makes it easier to manage customer records and job orders."
* **Measured Objective:** Specific Objective #1 (Centralized Record Management)
* **ISO 25010 / UAT Category:** Perceived Usefulness / Functional Suitability
* **System Module:** Job Order Summary Management & Customer Management
* **Specific Screen/Page:** `JobOrders.tsx` and `CustomerList.tsx`
* **Actual Feature:** Tabulated grid views displaying live order progression tags, customer contact references, shoe condition tags, and an instant keyword search/filter bar.
* **Evaluator Action:** Navigate to the Job Orders page, enter a customer name or ticket ID into the search input, and inspect the retrieved service timeline.
* **Expected Result:** Specific order profiles and historical client interactions materialize instantly without manual page-turning.
* **Reason:** Validates the transformation of fragmented paper documents into an organized digital ledger.
* **Status:** **Fully Implemented**

---

#### [PU-3] Perceived Usefulness Question #3
* **Question:** "The system helps me keep track of inventory and services more easily."
* **Measured Objective:** Specific Objective #1 & #3 (Resource Monitoring & Service Organization)
* **ISO 25010 / UAT Category:** Perceived Usefulness / Usability
* **System Module:** Inventory Management & Service Catalog Module
* **Specific Screen/Page:** `Inventory.tsx`, `RestockModal.tsx`, and `Services.tsx`
* **Actual Feature:** Real-time stock quantity tables with automated volume unit calculations (e.g., displaying exact mL alongside estimated physical whole containers like `~1 JUG`), Low Stock alert badges, and a dedicated whole-product `RestockModal`.
* **Evaluator Action:** Navigate to the Inventory screen, observe current consumable levels and physical container equivalencies, open the "RESTOCK" modal, and add a whole package (e.g., +1 Jug of Bleach).
* **Expected Result:** Stock volume immediately updates by the correct package multiplier (+4,000 mL) while logging financial costs to expenses without manual math.
* **Reason:** Measures whether automated mathematical conversions and visual status tags simplify stock oversight.
* **Status:** **Fully Implemented**

---

#### [PU-4] Perceived Usefulness Question #4
* **Question:** "The reports help me understand sales and business performance."
* **Measured Objective:** Specific Objective #3 (Automated Analytics & Report Generation)
* **ISO 25010 / UAT Category:** Perceived Usefulness / Functional Suitability
* **System Module:** Sales Reporting & Dashboard Module
* **Specific Screen/Page:** `SalesReport.tsx` and `Dashboard.tsx`
* **Actual Feature:** Interactive time-period filter buttons generating structured daily, weekly, monthly, quarterly, and annual sales breakdowns, total revenue metrics, net profit tabulations, and visual trend charts.
* **Evaluator Action:** Access the Reports module, click between Daily, Monthly, and Annual reporting intervals, and inspect the consolidated income vs. expense tabulations.
* **Expected Result:** Comprehensive financial figures and service volume analytics render instantly with accurate net margin calculations.
* **Reason:** Directly tests whether automated data aggregation supports evidence-based managerial decision-making.
* **Status:** **Fully Implemented**

---

#### [PU-5] Perceived Usefulness Question #5
* **Question:** "The system helps me do my work better."
* **Measured Objective:** General Objective (Overall Operational Enhancement)
* **ISO 25010 / UAT Category:** Perceived Usefulness / Overall System Acceptability
* **System Module:** Full System Interoperability (All Modules)
* **Specific Screen/Page:** System-wide UI navigation (`Header.tsx`, `Dashboard.tsx`, `ReleaseCalendar.tsx`)
* **Actual Feature:** Seamless navigation interconnecting job orders, machine learning completion forecasting, calendar tracking, and financial ledgers.
* **Evaluator Action:** Complete a full lifecycle scenario: book an order, check predicted completion dates, observe stock consumption alerts, and review updated financial reports.
* **Expected Result:** The user successfully performs end-to-end shoe management without leaving the unified interface or consulting external spreadsheets.
* **Reason:** Gauges the systemic impact of digital transformation on employee competency and workplace efficacy.
* **Status:** **Fully Implemented**

---

#### [PEOU-1] Perceived Ease of Use Question #1
* **Question:** "The menus, buttons, and labels are easy to understand."
* **Measured Objective:** General Objective (User Acceptance & Interface Clarity)
* **ISO 25010 / UAT Category:** Perceived Ease of Use / Interaction Capability (Usability)
* **System Module:** Presentation Layer (Frontend UI Architecture)
* **Specific Screen/Page:** Global layout across all pages (`Dashboard.tsx`, `JobOrders.tsx`, `Inventory.tsx`, `Expenses.tsx`)
* **Actual Feature:** High-contrast color-coded buttons with bold typography (`font-bold` action items), standard Lucide React pictorial icons (`PlusCircle`, `PackagePlus`, `AlertTriangle`), and straightforward terminology (*Cancel Order*, *New Item*, *Restock*).
* **Evaluator Action:** Scan all page headings, primary action buttons, and dropdown contextual menus across the platform.
* **Expected Result:** Icons directly align with functional intent (e.g., plus icon for adding, trash icon for deleting) with zero obscure technical jargon.
* **Reason:** Ensures non-technical shop staff can operate the interface intuitively without misidentifying function triggers.
* **Status:** **Fully Implemented**

---

#### [PEOU-2] Perceived Ease of Use Question #2
* **Question:** "The system is easy to learn."
* **Measured Objective:** General Objective & Scope (Staff Adoptability)
* **ISO 25010 / UAT Category:** Perceived Ease of Use / Learnability
* **System Module:** Frontend Presentation Layer
* **Specific Screen/Page:** All interactive dialogs (`JobOrderForm.tsx`, `RestockModal.tsx`, `StockUpdateModal.tsx`)
* **Actual Feature:** Consistent modal layout structures, standard sequential input fields, clear visual hierarchy, and instant field validation toasts via `sonner`.
* **Evaluator Action:** Have a first-time user open the application and attempt to register a new shoe cleaning job order without verbal prompts.
* **Expected Result:** The user successfully navigates from "New Order" through customer entry to submission by following logical form headings.
* **Reason:** Assesses the shallowness of the software learning curve for micro-business employees with standard IT literacy.
* **Status:** **Fully Implemented**

---

#### [PEOU-3] Perceived Ease of Use Question #3
* **Question:** "It is easy to enter and update information in the system."
* **Measured Objective:** Specific Objective #1 (Data Recording & Updating Efficiency)
* **ISO 25010 / UAT Category:** Perceived Ease of Use / Operability
* **System Module:** Job Order & Inventory Management Modules
* **Specific Screen/Page:** `JobOrders.tsx` (Edit modal), `Inventory.tsx` (Item update & Restock forms)
* **Actual Feature:** Controlled input types (number selectors, date pickers, dropdown selectors), pre-filled existing values upon launching edit modals, and instant state reactivity.
* **Evaluator Action:** Click the action menu on an active order, select "Edit Order Detail", update the shoe condition notes or service type, and click Save.
* **Expected Result:** The form immediately reflects old details upon opening, accepts modifications smoothly, and updates the table row instantaneously upon submission.
* **Reason:** Evaluates whether data modification overhead is minimized compared to erasing or overwriting manual ledger sheets.
* **Status:** **Fully Implemented**

---

#### [PEOU-4] Perceived Ease of Use Question #4
* **Question:** "It is easy to find the information I need."
* **Measured Objective:** Specific Objective #1 (Target Retrieval Time < 5 Minutes)
* **ISO 25010 / UAT Category:** Perceived Ease of Use / Performance & Operability
* **System Module:** System-Wide Record Retrieval Engine
* **Specific Screen/Page:** Search bars across `JobOrders.tsx`, `Inventory.tsx`, `ActivityHistory.tsx`, and `Expenses.tsx`
* **Actual Feature:** Client-side and backend real-time indexing allowing filtering by order ID, customer name, chemical item name, or audit transaction timeline.
* **Evaluator Action:** Type a sub-string of a known customer's name into the job order search bar or select a specific status tab (*For Release*).
* **Expected Result:** Unrelated records disappear instantly, presenting the target transaction in under 2 seconds (well within the 5-minute academic research ceiling).
* **Reason:** Directly proves the primary specific objective of eliminating manual document searching delays.
* **Status:** **Fully Implemented**

---

#### [PEOU-5] Perceived Ease of Use Question #5
* **Question:** "The system is easy to use."
* **Measured Objective:** General Objective (Holistic System Acceptability)
* **ISO 25010 / UAT Category:** Perceived Ease of Use / Overall Usability
* **System Module:** All Integrated Modules
* **Specific Screen/Page:** Cross-module user workflows
* **Actual Feature:** Unified single-page application (SPA) architecture preventing jarring page reloads, coupled with responsive visual feedback and informative error handling.
* **Evaluator Action:** Execute a continuous workday simulation: check daily release schedule, log a completed cleaning task, record a cash expense, and print a stock list.
* **Expected Result:** Interactions proceed smoothly with consistent navigational logic, quick button responses, and zero technical dead ends.
* **Reason:** Captures the generalized usability impression governing long-term employee software retention.
* **Status:** **Fully Implemented**

---

#### [BI-1] Behavioral Intention Question #1
* **Question:** "I am willing to use the system in my daily work."
* **Measured Objective:** Specific Objective #5 (TAM Behavioral Intention Assessment)
* **ISO 25010 / UAT Category:** Behavioral Intention to Use
* **System Module:** Daily Operational Tools (Job Orders & Release Calendar)
* **Specific Screen/Page:** `ReleaseCalendar.tsx` and `Dashboard.tsx`
* **Actual Feature:** Color-coded release calendar grids highlighting overdue, pending, and scheduled pickups, empowering technicians to manage daily cleaning schedules.
* **Evaluator Action:** Review the "Release Calendar" to identify which shoes must be cleaned and prepared for customer delivery today.
* **Expected Result:** Technicians clearly perceive their workload organized by priority and deadline, reinforcing daily reliance on the visual dashboard over paper memos.
* **Reason:** Measures employee propensity to actively integrate software tools into everyday cleaning and restoration routines.
* **Status:** **Fully Implemented**

---

#### [BI-2] Behavioral Intention Question #2
* **Question:** "I will continue using the system if it is officially used in the business."
* **Measured Objective:** Specific Objective #5 (System Adoption & Sustainability)
* **ISO 25010 / UAT Category:** Behavioral Intention to Use / Maintainability & Reliability
* **System Module:** User Management & Access Architecture
* **Specific Screen/Page:** Login Screen (`AuthModal.tsx` / Authentication enforcement) and Role settings
* **Actual Feature:** Secure session handling via JWT and personalized user role workspaces (*Owner* vs. *Staff*) that conform to workplace hierarchy.
* **Evaluator Action:** Log in under a Staff account, verify access to relevant operational screens without exposure to sensitive financial administration, and execute daily order logs.
* **Expected Result:** Staff users operate comfortably within their defined security perimeter, supporting institutional mandate compliance without frustration.
* **Reason:** Predicts organizational stability and operational adherence once executive management mandates digital transformation.
* **Status:** **Fully Implemented**

---

#### [BI-3] Behavioral Intention Question #3
* **Question:** "I would recommend the system to my co-workers."
* **Measured Objective:** Specific Objective #5 (Peer Acceptance & Collaboration)
* **ISO 25010 / UAT Category:** Behavioral Intention to Use / Collaborative Operability
* **System Module:** Activity Audit & Multi-User Workflow
* **Specific Screen/Page:** `ActivityHistory.tsx` and Order Status logs
* **Actual Feature:** Transparent attribution of actions (recording which staff member updated a status or performed a restock), fostering seamless inter-employee handoffs.
* **Evaluator Action:** Inspect the Activity History to view timestamped status updates made by different technicians across morning and evening shifts.
* **Expected Result:** Staff members observe clear, uncorrupted handoffs where shift changes require no verbal debriefing since system records display complete history.
* **Reason:** Establishes advocacy and trust among shop technicians, reducing cultural resistance to technical innovation.
* **Status:** **Fully Implemented**

---

#### [BI-4] Behavioral Intention Question #4
* **Question:** "I would rather use this system than the old way of doing the work."
* **Measured Objective:** General Objective (Comparison Against Manual Ledger Process)
* **ISO 25010 / UAT Category:** Behavioral Intention to Use / Relative Advantage
* **System Module:** Core Automation (ML Prediction & Automated Reports)
* **Specific Screen/Page:** `JobOrderForm.tsx` (ML date forecast badge) and `SalesReport.tsx`
* **Actual Feature:** Instantaneous algorithmic turnaround calculation and click-of-a-button revenue compilation replacing manual logbooks and hand-calculated calculators.
* **Evaluator Action:** Compare booking an order and calculating monthly totals using a calculator vs. clicking "Generate Report" in the system software.
* **Expected Result:** The system finishes calculations in under 1 second without computational errors, proving an undeniable relative operational advantage over paper methods.
* **Reason:** Validates that technological benefits outweigh any behavioral inertia associated with clinging to legacy manual habits.
* **Status:** **Fully Implemented**

---

#### [BI-5] Behavioral Intention Question #5
* **Question:** "I believe this system should continue to be used at Shoelotskey."
* **Measured Objective:** Specific Objective #5 & #6 (Long-term Viability & Continuous Enhancement)
* **ISO 25010 / UAT Category:** Behavioral Intention to Use / Organizational Fit
* **System Module:** Complete Enterprise Platform
* **Specific Screen/Page:** System Dashboard & Historical Analytics
* **Actual Feature:** Cumulative historical database storage allowing business trends to mature over months and years without physical record degradation.
* **Evaluator Action:** Review accumulated transaction logs and note how past customer orders remain easily accessible without archiving physical paper boxes.
* **Expected Result:** Stakeholders recognize permanent organizational value in ongoing data preservation and structured business scalability.
* **Reason:** Determines executive and operational commitment to long-term digital asset maintenance.
* **Status:** **Fully Implemented**

---

#### [ASU-1] Actual System Use Question #1
* **Question:** "I use the system whenever I perform my assigned tasks."
* **Measured Objective:** Specific Objective #5 (Actual Operational Utilization)
* **ISO 25010 / UAT Category:** Actual System Use / Workflow Suitability
* **System Module:** Job Orders & Inventory Tracking Modules
* **Specific Screen/Page:** `JobOrders.tsx` and `Inventory.tsx`
* **Actual Feature:** Task-oriented action triggers mapping directly to physical shoe handling stages (Intake -> Cleaning -> Restoring -> Ready for Release).
* **Evaluator Action:** Simulate physical shoe intake at the shop front, immediately followed by booking the corresponding digital ticket on the terminal screen.
* **Expected Result:** Digital intake mirrors the practical physical intake step-by-step without cognitive dissonance or redundant procedural delays.
* **Reason:** Verifies that software features directly intersect with real-world technician chores rather than sitting idle as secondary administrative burdens.
* **Status:** **Fully Implemented**

---

#### [ASU-2] Actual System Use Question #2
* **Question:** "I use the system to record and manage customer job orders."
* **Measured Objective:** Specific Objective #1 (Centralized Order Processing)
* **ISO 25010 / UAT Category:** Actual System Use / Functional Completeness
* **System Module:** Job Order Management Module
* **Specific Screen/Page:** `JobOrderForm.tsx` and `JobOrders.tsx`
* **Actual Feature:** Multi-item shoe registration, visual condition checkboxes (scratches, yellowing, sole separation), priority assignment (Regular/Rush), and downpayment tracking.
* **Evaluator Action:** Enter a complex job order involving two distinct pairs of shoes with different restoration requirements and a 50% downpayment deposit.
* **Expected Result:** The system captures both shoe profiles independently, records the accurate deposit balance, and stores the unified transaction ID.
* **Reason:** Measures empirical adherence to utilizing digital interfaces as the definitive repository for client work orders.
* **Status:** **Fully Implemented**

---

#### [ASU-3] Actual System Use Question #3
* **Question:** "I use the system to check inventory, service status, or reports when needed."
* **Measured Objective:** Specific Objective #1 & #3 (Real-time Monitoring & Inquiry)
* **ISO 25010 / UAT Category:** Actual System Use / Operability & Accessibility
* **System Module:** Dashboard, Inventory, & Reporting Modules
* **Specific Screen/Page:** `Dashboard.tsx` (Status filter cards), `Inventory.tsx` (Stock tables), and `SalesReport.tsx`
* **Actual Feature:** Interactive KPI stat cards on the dashboard (clicking "On-Going" opens a focused modal table of ongoing works), inventory status badges, and instant financial reports.
* **Evaluator Action:** Click the "For Release" stat card on the main dashboard to check immediately deliverable items, then check if cleaner stock is sufficient for remaining works.
* **Expected Result:** Data tables filter instantaneously to display targeted operational inquiries without manual collation.
* **Reason:** Evaluates actual routine utilization of decision-support views during ongoing shop operations.
* **Status:** **Fully Implemented**

---

#### [ASU-4] Actual System Use Question #4
* **Question:** "I can complete my work using the system without going back to the old manual process."
* **Measured Objective:** General Objective & Scope (Total Process Digitization)
* **ISO 25010 / UAT Category:** Actual System Use / Functional Autonomy
* **System Module:** Full Web-Based Service Management Suite
* **Specific Screen/Page:** Entire application lifecycle (Intake -> ML Forecast -> Status Update -> Claim/Payment -> Audit Log -> Report Generation)
* **Actual Feature:** Comprehensive feature coverage eliminating the need for paper receipts, physical stock ledgers, manual calculators, or wall calendars.
* **Evaluator Action:** Perform an entire business transaction cycle from initial customer order intake to final shoe release and payment collection entirely within the software.
* **Expected Result:** Every requisite step—including payment balance calculations and inventory stock deduction—is handled digitally without a single manual workaround.
* **Reason:** Proves total system autonomy and successful replacement of legacy paper methodologies.
* **Status:** **Fully Implemented**

---

#### [ASU-5] Actual System Use Question #5
* **Question:** "I use the system regularly to help me complete my daily work."
* **Measured Objective:** Specific Objective #5 (Consistent System Utilization)
* **ISO 25010 / UAT Category:** Actual System Use / Operational Reliability
* **System Module:** All Modules & Audit Trail Engine
* **Specific Screen/Page:** `ActivityHistory.tsx` (System log verification)
* **Actual Feature:** Automated background activity monitoring logging timestamped entries for every login, job creation, status update, and inventory adjustment.
* **Evaluator Action:** Inspect the Activity History log over multiple simulated chronological operating days to verify continuous employee interaction records.
* **Expected Result:** The log reveals an ongoing, sequential audit trail of daily business executions proving constant operational engagement.
* **Reason:** Validates sustainable adoption and routine daily utility across business operating cycles.
* **Status:** **Fully Implemented**

---

### B. ISO/IEC 25010 Software Quality Evaluation (45 Items)

#### [FS-1] Functional Suitability Question #1
* **Question:** "The system provides all the necessary functions for managing job orders, customer records, inventory, reports, and release schedules."
* **Measured Objective:** Specific Objectives #1, #2, & #3 (Core System Scope)
* **ISO 25010 / UAT Category:** Functional Suitability / Functional Completeness
* **System Module:** All Core Modules (Job Orders, Customers, Inventory, Reports, Release Calendar)
* **Specific Screen/Page:** Main navigation bar and respective module views (`JobOrders.tsx`, `CustomerList.tsx`, `Inventory.tsx`, `SalesReport.tsx`, `ReleaseCalendar.tsx`)
* **Actual Feature:** Dedicated frontend route components coupled to specific FastAPI backend REST endpoints (`/api/orders`, `/api/customers`, `/api/inventory`, `/api/reports/sales`, `/api/orders/calendar`).
* **Evaluator Action:** Traverse each navigation menu tab to verify that operational forms and data grids exist for all five stipulated core business processes.
* **Expected Result:** Each designated operational module loads functional CRUD (Create, Read, Update, Delete) interfaces completely fulfilling the defined business scope.
* **Reason:** Assesses whether the architectural construct covers 100% of the functional requirements detailed in the capstone manuscript.
* **Status:** **Fully Implemented**

---

#### [FS-2] Functional Suitability Question #2
* **Question:** "Each module performs its intended function correctly without producing incorrect results."
* **Measured Objective:** General Objective & Specific Objective #1 (Data Accuracy & Integrity)
* **ISO 25010 / UAT Category:** Functional Suitability / Functional Correctness
* **System Module:** Backend Logic & Database Transactions
* **Specific Screen/Page:** `backend/main.py` endpoints and React operational tables (`JobOrders.tsx`, `Expenses.tsx`)
* **Actual Feature:** Precision arithmetic handling (using 2-decimal formatting in expenses and strict integer/float rounding for stock volumes) and database constraints ensuring zero computation divergence.
* **Evaluator Action:** Input test financial transactions (e.g., an order with base price ₱550, deposit ₱200) and verify remaining balance calculation and general ledger summation.
* **Expected Result:** Remaining payment balance displays exactly ₱350.00 without floating-point inaccuracies or corrupt record mutations.
* **Reason:** Guarantees that mathematical models and relational database queries operate with absolute functional correctness.
* **Status:** **Fully Implemented**

---

#### [FS-3] Functional Suitability Question #3
* **Question:** "The machine learning feature provides service completion date predictions appropriate for the available job order information."
* **Measured Objective:** Specific Objective #2 (ML Turnaround Date Prediction ≥ 85% Accuracy)
* **ISO 25010 / UAT Category:** Functional Suitability / Functional Appropriateness
* **System Module:** Machine Learning Prediction Module
* **Specific Screen/Page:** `JobOrderForm.tsx` (ML date estimate display) & `backend/ml_engine.py` (`/api/ml/predict-release` endpoint)
* **Actual Feature:** Scikit-Learn **Random Forest Regressor** ingesting numerical input vectors: requested services count, condition severity score, shop workload volume, and priority tier (Rush=1, Regular=0).
* **Evaluator Action:** Open the New Order form, check multiple severe shoe conditions (yellowing, sole separation) under high workload, and trigger ML prediction.
* **Expected Result:** The algorithmic engine outputs an adjusted completion prediction (e.g., estimating 4 to 5 days instead of 2 days for minor cleaning), displaying appropriate data-driven estimation.
* **Reason:** Verifies that predictive machine learning provides scientifically validated scheduling intelligence rather than static hardcoded timers.
* **Status:** **Fully Implemented**

---

#### [FS-4] Functional Suitability Question #4
* **Question:** "The data analytics dashboard provides the information needed for monitoring sales, services, and business performance."
* **Measured Objective:** Specific Objective #3 (Real-Time Operational Analytics)
* **ISO 25010 / UAT Category:** Functional Suitability / Functional Completeness & Appropriateness
* **System Module:** Dashboard & Analytics Module
* **Specific Screen/Page:** `Dashboard.tsx` (Main view and status analysis cards)
* **Actual Feature:** Live KPI summary metrics (Total Orders, Completed, Pending, Revenue), interactive chart components, and clickable order lifecycle distribution cards.
* **Evaluator Action:** Inspect the dashboard upon login, review total revenue indicators, and click an active status card (*On-Going*) to view drill-down operational data.
* **Expected Result:** All essential business health indicators and service distribution breakdowns present clear, real-time insight into shop performance.
* **Reason:** Assesses whether dashboard visualizations adequately empower executive decision-makers to evaluate operations at a glance.
* **Status:** **Fully Implemented**

---

#### [FS-5] Functional Suitability Question #5
* **Question:** "The available system functions support Shoelotskey's daily business operations efficiently."
* **Measured Objective:** General Objective (Streamlining Shoe Service Operations)
* **ISO 25010 / UAT Category:** Functional Suitability / Functional Appropriateness
* **System Module:** All Operational Modules
* **Specific Screen/Page:** End-to-end system execution
* **Actual Feature:** Customized shoe-specific attributes (footwear brand, material types such as suede/leather/mesh, condition mapping, cleaning chemical container unit tracking).
* **Evaluator Action:** Verify that intake inputs and inventory units reflect shoe restoration domain requirements rather than generic retail point-of-sale defaults.
* **Expected Result:** Fields explicitly capture footwear characteristics and chemical measurements (Jugs/Tubs/mL/g), proving tailored alignment with shoe service operations.
* **Reason:** Validates domain-specific software appropriateness for shoe cleaning and restoration workflows.
* **Status:** **Fully Implemented**

---

#### [PE-1] Performance Efficiency Question #1
* **Question:** "The system loads pages and modules within an acceptable response time."
* **Measured Objective:** Specific Objective #1 (High-Speed System Performance)
* **ISO 25010 / UAT Category:** Performance Efficiency / Time Behavior
* **System Module:** Presentation Layer & Routing Architecture
* **Specific Screen/Page:** Screen transition speed across all tabs
* **Actual Feature:** Vite bundling optimization and React frontend asynchronous routing via standard fetch API requests.
* **Evaluator Action:** Click rapidly across navigation tabs (Dashboard -> Job Orders -> Inventory -> Reports -> Calendar) and measure rendering latency.
* **Expected Result:** Page transitions materialize in under **300 milliseconds** with minimal perceived loading latency.
* **Reason:** Assesses software responsiveness and execution time behavior during everyday user interface interaction.
* **Status:** **Fully Implemented**

---

#### [PE-2] Performance Efficiency Question #2
* **Question:** "Job order processing and saving transactions are completed without noticeable delays."
* **Measured Objective:** Specific Objective #1 (Transaction Processing Acceleration)
* **ISO 25010 / UAT Category:** Performance Efficiency / Time Behavior & Resource Utilization
* **System Module:** Job Order Management & Application Layer
* **Specific Screen/Page:** `JobOrderForm.tsx` (Submission button & optimistic state reactivity)
* **Actual Feature:** Optimistic UI updates paired with FastAPI asynchronous database committing (`db.commit()`), immediately presenting success confirmation toasts via `sonner`.
* **Evaluator Action:** Submit a completed new job order form containing multiple shoe items and start a timer until the UI confirmation toast appears.
* **Expected Result:** Database commitment and UI grid update conclude in under **1 second** without system hang or interface freezing.
* **Reason:** Ensures database transaction writing maintains instantaneous responsiveness under operational load.
* **Status:** **Fully Implemented**

---

#### [PE-3] Performance Efficiency Question #3
* **Question:** "Reports and analytics are generated efficiently even with a large number of records."
* **Measured Objective:** Specific Objective #3 (Report Preparation < 1 Hour)
* **ISO 25010 / UAT Category:** Performance Efficiency / Capacity & Time Behavior
* **System Module:** Sales Reporting Module & Database Engine
* **Specific Screen/Page:** `SalesReport.tsx` and `backend/main.py` (`/api/reports/sales` & `/api/expenses`)
* **Actual Feature:** Optimized SQL backend query aggregation and frontend filtering handling hundreds of transaction logs simultaneously.
* **Evaluator Action:** Select an "Annual" reporting interval containing extensive simulated transaction records and observe calculation speed.
* **Expected Result:** Consolidated annual revenue tabulations, expense deduction formulas, and statistical breakdowns calculate and render in under **2 seconds**.
* **Reason:** Verifies algorithmic complexity and database query efficiency when processing dense historical datasets.
* **Status:** **Fully Implemented**

---

#### [PE-4] Performance Efficiency Question #4
* **Question:** "The machine learning prediction is generated within a reasonable amount of time."
* **Measured Objective:** Specific Objective #2 (Real-Time Algorithmic Inference)
* **ISO 25010 / UAT Category:** Performance Efficiency / Time Behavior
* **System Module:** Machine Learning Module (`backend/ml_engine.py`)
* **Specific Screen/Page:** `JobOrderForm.tsx` (Predict button trigger)
* **Actual Feature:** Pre-trained Random Forest model stored via Python memory/pickle persistence, eliminating heavy real-time model retraining during prediction queries.
* **Evaluator Action:** Click "Calculate Estimate / Predict Completion" inside the job order intake modal and time the algorithmic inference return latency.
* **Expected Result:** The predicted completion turnaround time returns from the Python backend and displays on the UI badge in under **500 milliseconds**.
* **Reason:** Ensures numerical matrix transformations and Scikit-Learn tree ensemble execution execute with near-zero latency.
* **Status:** **Fully Implemented**

---

#### [PE-5] Performance Efficiency Question #5
* **Question:** "The system maintains good performance while multiple modules are being used."
* **Measured Objective:** General Objective (Robust Multi-Module Operations)
* **ISO 25010 / UAT Category:** Performance Efficiency / Resource Utilization & Capacity
* **System Module:** Application Layer (FastAPI Asynchronous Engine)
* **Specific Screen/Page:** Concurrent module access across browser tabs
* **Actual Feature:** FastAPI asynchronous endpoint handling (`async def` and thread pooling) paired with PostgreSQL connection pooling.
* **Evaluator Action:** Open two browser windows simultaneously: initiate an inventory whole-product restock in window one while executing an order status transition in window two.
* **Expected Result:** Both simultaneous operations process concurrently without API thread lockups, database concurrency failures, or performance drop-off.
* **Reason:** Evaluates server application architecture resilience against concurrent multi-user database transactions.
* **Status:** **Fully Implemented**

---

#### [C-1] Compatibility Question #1
* **Question:** "The system operates properly on commonly used web browsers."
* **Measured Objective:** Scope & Limitations (Standard Browser Accessibility)
* **ISO 25010 / UAT Category:** Compatibility / Co-existence & Interoperability
* **System Module:** Presentation Layer (Frontend Standards)
* **Specific Screen/Page:** Cross-browser rendering across all application screens
* **Actual Feature:** Standard HTML5/ECMAScript TypeScript transpilation via Vite, ensuring compatibility across modern layout rendering engines.
* **Evaluator Action:** Open and navigate the live web application using Google Chrome, Microsoft Edge, and Mozilla Firefox.
* **Expected Result:** UI elements, flexbox grid alignments, modal animations, and chart renderers function uniformly without visual anomalies or broken console scripts across all tested browsers.
* **Reason:** Verifies adherence to standard web interoperability specifications without browser-specific lock-in.
* **Status:** **Fully Implemented**

---

#### [C-2] Compatibility Question #2
* **Question:** "Information entered in one module is correctly reflected in related modules."
* **Measured Objective:** Specific Objective #1 (Integrated System Coherence)
* **ISO 25010 / UAT Category:** Compatibility / Interoperability
* **System Module:** Cross-Module Data Propagation (Orders -> Inventory -> Expenses -> Reports)
* **Specific Screen/Page:** `RestockModal.tsx`, `Inventory.tsx`, `Expenses.tsx`, and `SalesReport.tsx`
* **Actual Feature:** Single-source-of-truth relational data referencing. For example, restocking 1 Jug of Bleach (+4,000 mL) for ₱350 updates inventory quantities, inserts an expense record, and deducts cost from net revenue reports.
* **Evaluator Action:** Execute a whole-product restock in the Inventory modal with "Record in Expenses" toggled ON, then navigate directly to the Expenses page and Sales Report page.
* **Expected Result:** The exact ₱350.00 cost immediately materializes in the Expenses table with "Variable / Restock" frequency and reflects as an operational cost in the financial reports.
* **Reason:** Proves relational schema interconnectivity and eliminates isolated data silos across system modules.
* **Status:** **Fully Implemented**

---

#### [C-3] Compatibility Question #3
* **Question:** "The database exchanges information correctly with all system modules."
* **Measured Objective:** Specific Objective #1 (Relational Database Architecture)
* **ISO 25010 / UAT Category:** Compatibility / Interoperability
* **System Module:** Data Layer (PostgreSQL Database Engine)
* **Specific Screen/Page:** Backend data synchronization (`backend/database.py` and `models.py`)
* **Actual Feature:** SQLAlchemy Object Relational Mapping (ORM) binding database tables (`orders`, `customers`, `inventory`, `expenses`, `audit_logs`) to serialized Pydantic validation schemas.
* **Evaluator Action:** Perform operations across different frontend modules and inspect backend SQLite/PostgreSQL log outputs or query tables directly via inspection scripts.
* **Expected Result:** All CRUD modifications initiated from any frontend module persist cleanly into their corresponding database tables with zero Schema mismatch or silent read/write failures.
* **Reason:** Verifies architectural consistency between database data models and backend REST API serialization payloads.
* **Status:** **Fully Implemented**

---

#### [C-4] Compatibility Question #4
* **Question:** "The machine learning component integrates properly with the job order management module."
* **Measured Objective:** Specific Objective #2 (Seamless ML Operational Embedding)
* **ISO 25010 / UAT Category:** Compatibility / Interoperability
* **System Module:** Machine Learning & Job Order Modules
* **Specific Screen/Page:** `JobOrderForm.tsx` communicating with `backend/ml_engine.py`
* **Actual Feature:** Frontend request payload serialization binding shoe condition metrics and priority flags directly into the REST prediction API endpoint (`/api/ml/predict-release`), returning calculated dates into the form state.
* **Evaluator Action:** In the New Order modal, fill in shoe parameters and confirm that the algorithmic prediction automatically populates the "Expected Release Date" form input without manual data copying.
* **Expected Result:** The prediction algorithm receives intake variables, calculates turnaround days, and sets the job order expected release date field seamlessly within one interface.
* **Reason:** Confirms interoperable bridging between numerical AI data models and transactional frontend forms.
* **Status:** **Fully Implemented**

---

#### [C-5] Compatibility Question #5
* **Question:** "The analytics dashboard accurately displays information gathered from the operational modules."
* **Measured Objective:** Specific Objective #3 (Consolidated Analytical Reporting)
* **ISO 25010 / UAT Category:** Compatibility / Interoperability
* **System Module:** Dashboard Module
* **Specific Screen/Page:** `Dashboard.tsx`
* **Actual Feature:** Automated statistical aggregation queries drawing real-time record counts from `orders`, payment balances from `payments`, and stock depletion levels from `inventory`.
* **Evaluator Action:** Note current total completed orders on the Dashboard, navigate to Job Orders, transition an ongoing order to "Claimed/Completed", and return to the Dashboard.
* **Expected Result:** The Dashboard completed order counter increments exactly by 1, and total revenue updates instantaneously without page caching conflicts.
* **Reason:** Validates accurate interoperable synthesis of multi-table operational transactions into unified executive summaries.
* **Status:** **Fully Implemented**

---

#### [IC-1] Interaction Capability Question #1
* **Question:** "The menus, icons, and buttons are clearly labeled and easy to recognize."
* **Measured Objective:** General Objective (Human-Computer Interface Quality)
* **ISO 25010 / UAT Category:** Interaction Capability / Appropriateness Recognizability & User Error Protection
* **System Module:** Presentation Layer UI Design
* **Specific Screen/Page:** Global navigational hierarchy and interactive action bars
* **Actual Feature:** Explicit visual affordances: bold text formatting (`font-bold`) on all dropdown buttons (*Edit Order Detail*, *Undo to New Order*, *Update Stock Inventory*) accompanied by intuitive semantic icons (`Edit`, `RotateCcw`, `Package`).
* **Evaluator Action:** Observe dropdown action menus within `Dashboard.tsx` and `JobOrders.tsx`, verifying text weight and visual legibility.
* **Expected Result:** Button titles exhibit bold typographic weight for clear legibility, paired with recognizable graphic icons corresponding to each operational command.
* **Reason:** Ensures visual cognitive clarity, mitigating operator hesitation or erroneous clicks during dynamic shop workflows.
* **Status:** **Fully Implemented**

---

#### [IC-2] Interaction Capability Question #2
* **Question:** "I can easily learn how to perform job order, inventory, and customer management tasks."
* **Measured Objective:** General Objective (System Learnability & Operational Usability)
* **ISO 25010 / UAT Category:** Interaction Capability / Learnability
* **System Module:** Core Operational Screens
* **Specific Screen/Page:** `JobOrders.tsx`, `Inventory.tsx`, and `CustomerList.tsx`
* **Actual Feature:** Standardized tabular user interface layout: header action bar with a prominent colored action button on the top-right, search/filter controls above the data grid, and consistent action row icons.
* **Evaluator Action:** Perform a basic search and edit operation on the Job Orders page, then navigate to the Customers and Inventory pages to perform identical operations.
* **Expected Result:** The operational mental model transferred from one module applies identically to all others, minimizing training adaptation requirements.
* **Reason:** Evaluates structural design uniformity across modules, accelerating institutional staff onboarding.
* **Status:** **Fully Implemented**

---

#### [IC-3] Interaction Capability Question #3
* **Question:** "The system helps users avoid mistakes by providing clear prompts and confirmation messages."
* **Measured Objective:** Specific Objective #1 (Data Accuracy & Error Reduction)
* **ISO 25010 / UAT Category:** Interaction Capability / User Error Protection & Operability
* **System Module:** System-Wide Error Defense & UI Notifications
* **Specific Screen/Page:** Interactive action triggers across all forms and tables (`JobOrders.tsx`, `Inventory.tsx`, `RestockModal.tsx`)
* **Actual Feature:** Dedicated confirmation dialogs for destructive or consequential actions (e.g., `setCancelOrderModal(order)` prior to cancellation), mandatory form validation prompts, and instant success/error feedback toasts via `sonner`.
* **Evaluator Action:** Attempt to submit a restock with an empty item or zero quantity, or attempt to click "Cancel Order" from an order dropdown menu.
* **Expected Result:** Invalid submissions are halted immediately by red error toast notices; order cancellation attempts trigger a secondary explicit confirmation modal before executing.
* **Reason:** Proves the presence of preventive defensive UX engineering against accidental data destruction or invalid entries.
* **Status:** **Fully Implemented**

---

#### [IC-4] Interaction Capability Question #4
* **Question:** "The layout and navigation make it easy to move between different modules."
* **Measured Objective:** General Objective (Ergonomic System Navigation)
* **ISO 25010 / UAT Category:** Interaction Capability / Operability & Accessibility
* **System Module:** Navigation & Routing Module
* **Specific Screen/Page:** Global layout Navigation Header (`Header.tsx` / App navigation sidebar)
* **Actual Feature:** Persistent global header bar visible across every screen, presenting direct single-click navigational routing between Dashboard, Job Orders, Calendar, Inventory, Reports, and Activity History.
* **Evaluator Action:** From any nested modal or secondary screen, attempt to switch directly to another primary system module using the navigation header.
* **Expected Result:** The targeted module renders instantaneously in a single click without requiring backward browser navigation or deep menu drilling.
* **Reason:** Verifies architectural navigation fluidity and operational ergonomic efficiency during multitasking activities.
* **Status:** **Fully Implemented**

---

#### [IC-5] Interaction Capability Question #5
* **Question:** "The system provides helpful messages and guidance whenever users need assistance."
* **Measured Objective:** General Objective (User Assistance & Guidance)
* **ISO 25010 / UAT Category:** Interaction Capability / User Assistance & Learnability
* **System Module:** Presentation Layer UI Guidance
* **Specific Screen/Page:** All application screens
* **Actual Feature:** Descriptive subtext banners inside modal headers (e.g., in `RestockModal.tsx`: *"Purchase and add whole containers directly to inventory stock"*) and input field placeholder hints (*"e.g. 1, 2, 5"*).
* **Evaluator Action:** Check interactive forms and dashboards for onboarding guidance, contextual assistance manuals, or interactive help tooltips.
* **Expected Result:** While basic form placeholders, modal subtitle descriptions, and alert badges exist, there is no centralized "Help Center", interactive tutorial guide, or comprehensive tooltip documentation tour.
* **Reason:** Evaluates whether explicit real-time interactive user assistance features are embedded to guide unsure operators.
* **Status:** **Partially Implemented**  
* **Missing Elements Explanation:** The application currently relies on intuitive design affordances, modal sub-headers, field placeholder text, and toast notifications rather than dedicated assistance documentation. To achieve full implementation, an interactive onboarding tour (e.g., via a driver/tooltip library) or a dedicated "System Operation Guide / Help" reference page must be integrated into the primary navigation bar.

---

#### [R-1] Reliability Question #1
* **Question:** "The system performs consistently without unexpected interruptions during operation."
* **Measured Objective:** General Objective (System Stability & Uptime)
* **ISO 25010 / UAT Category:** Reliability / Maturity & Availability
* **System Module:** Full Web Application & Backend Server
* **Specific Screen/Page:** Continuous runtime runtime environment
* **Actual Feature:** Stable exception handling inside FastAPI route controllers and error boundary resilience in React components, preventing crash-induced runtime interruptions.
* **Evaluator Action:** Subject the system to rigorous operational testing: rapid repetitive clicks, rapid filtering, and sequential database writes over a continuous testing session.
* **Expected Result:** The web frontend does not blank out, crash to white screen, or throw unhandled backend 500 fatal errors during continuous operational utilization.
* **Reason:** Validates overall software maturity and runtime runtime availability under real-world operating stressors.
* **Status:** **Fully Implemented**

---

#### [R-2] Reliability Question #2
* **Question:** "Customer, inventory, and transaction records remain accurate after being saved."
* **Measured Objective:** Specific Objective #1 (Data Integrity & Persistence)
* **ISO 25010 / UAT Category:** Reliability / Fault Tolerance & Data Integrity
* **System Module:** Data Layer & Audit Logging Module
* **Specific Screen/Page:** `ActivityHistory.tsx` and relational backend persistence
* **Actual Feature:** ACID-compliant database storage utilizing strict transactional commits (`db.commit()`). All modifications record explicit pre- and post-alteration values (`oldValues` and `newValues`) within immutable audit records.
* **Evaluator Action:** Save a new customer transaction or restock an item, completely close and reopen the browser (or reboot the application server), and verify the persisted ledger data.
* **Expected Result:** All numerical amounts, timestamps, status strings, and inventory counts reload exactly as submitted, matching corresponding logs in `ActivityHistory.tsx`.
* **Reason:** Guarantees absolute database data retention without corruption, silent truncation, or data loss over time.
* **Status:** **Fully Implemented**

---

#### [R-3] Reliability Question #3
* **Question:** "The system can recover successfully after unexpected errors or interruptions."
* **Measured Objective:** Scope & Limitations (Fault Tolerance & Offline Recovery Resilience)
* **ISO 25010 / UAT Category:** Reliability / Recoverability
* **System Module:** Frontend State Synchronization & Backend Recovery Logic
* **Specific Screen/Page:** `ExpenseContext.tsx` and `OrderContext.tsx` error fallback mechanisms
* **Actual Feature:** Frontend local caching and sync queuing (`localStorage` persistence of cache data and queuing failed syncs for retry upon reconnect) combined with backend rollback logic (`db.rollback()`) upon transaction exception.
* **Evaluator Action:** Simulate a temporary network disconnection or invalid API transmission during an expense or order update, observe system behavior, and restore connectivity.
* **Expected Result:** The interface presents a clean notification indicating temporary offline or denied state while preserving local state integrity without crashing, safely resynchronizing or restoring cached records.
* **Reason:** Verifies fault tolerance and graceful data recovery capabilities after network or server anomalies.
* **Status:** **Fully Implemented**

---

#### [R-4] Reliability Question #4
* **Question:** "The system continues to operate properly when processing multiple transactions."
* **Measured Objective:** General Objective & Scope (Concurrency & Volume Reliability)
* **ISO 25010 / UAT Category:** Reliability / Maturity & Fault Tolerance
* **System Module:** Backend Application Layer (Database Concurrency Handling)
* **Specific Screen/Page:** High-volume transaction processing across `JobOrders.tsx` and `Inventory.tsx`
* **Actual Feature:** SQLAlchemy session concurrency isolation (`get_db` dependency yielding isolated database sessions per request) preventing deadlocks or race conditions during simultaneous API calls.
* **Evaluator Action:** Execute multiple simultaneous transaction updates (e.g., submitting several job order creations or status changes within milliseconds via concurrent tabs or automated scripts).
* **Expected Result:** Every individual transaction processes cleanly through isolated sessions without database lock contention, data crosstalk, or lost updates.
* **Reason:** Proves transactional stability under heavy concurrent workload conditions.
* **Status:** **Fully Implemented**

---

#### [R-5] Reliability Question #5
* **Question:** "The machine learning prediction and analytics functions remain dependable during repeated use."
* **Measured Objective:** Specific Objective #2 & #3 (Sustainable AI & Analytics Dependability)
* **ISO 25010 / UAT Category:** Reliability / Maturity & Availability
* **System Module:** Machine Learning & Dashboard Analytics Modules
* **Specific Screen/Page:** Repeated queries on `JobOrderForm.tsx` and `Dashboard.tsx`
* **Actual Feature:** Stateless mathematical execution of the loaded Scikit-Learn regressor object, preventing memory leak degradation or algorithmic numerical drift across repetitive inference calls.
* **Evaluator Action:** Execute 20 consecutive completion date prediction requests within the intake form and repeatedly refresh the analytical dashboard under updated database records.
* **Expected Result:** Prediction returns and statistical aggregations execute with consistent sub-second latency and uncorrupted numerical outputs across all iterations.
* **Reason:** Confirms computational stamina and architectural immunity against resource depletion during continuous analytical querying.
* **Status:** **Fully Implemented**

---

#### [S-1] Security Question #1
* **Question:** "User authentication effectively prevents unauthorized access."
* **Measured Objective:** Scope & Limitations (System Security & Access Limitation)
* **ISO 25010 / UAT Category:** Security / Confidentiality & Authenticity
* **System Module:** Authentication & Authorization Module
* **Specific Screen/Page:** Login enforcement modal (`AuthModal.tsx`) and backend token verification (`get_current_user` in `backend/main.py`)
* **Actual Feature:** Mandatory authentication barrier requiring verified login credentials to obtain secure JSON Web Tokens (JWT) before access to API operational routes is authorized.
* **Evaluator Action:** Attempt to access secure endpoints (`/api/orders`, `/api/expenses`, or protected React administrative routes) directly in a private/incognito window without providing valid credentials.
* **Expected Result:** Unauthenticated HTTP requests immediately suffer `401 Unauthorized` rejection, and the UI blocks operational rendering until valid login credentials are provided.
* **Reason:** Verifies fundamental perimeter defense against anonymous or unauthorized system invasion.
* **Status:** **Fully Implemented**

---

#### [S-2] Security Question #2
* **Question:** "The system restricts access to features based on user roles and permissions."
* **Measured Objective:** Scope & Limitations (Role-Based Access Control - RBAC)
* **ISO 25010 / UAT Category:** Security / Authorization & Access Control
* **System Module:** User Management & Role Authorization Module
* **Specific Screen/Page:** Header navigation buttons and administrative screens (`Inventory.tsx`, `UserManagement.tsx`)
* **Actual Feature:** Role-Based Access Control (**RBAC**) differentiating **Owner/Administrator** vs. **Staff** accounts. In `Inventory.tsx`, administrative actions (*New Item* & *Restock* buttons) are dynamically exposed or hidden based on `user.role?.toLowerCase() === 'owner'`.
* **Evaluator Action:** Log in using a standard **Staff** credential account and navigate to the Inventory and administrative dashboards; observe available buttons and attempt administrative modifications.
* **Expected Result:** Sensitive executive controls (like Item Creation, Expense deletion, and User Management) remain hidden or functionally blocked, restricting staff exclusively to operational order entry and status updates.
* **Reason:** Proves rigorous internal privilege segregation protecting executive functions from operational staff interference.
* **Status:** **Fully Implemented**

---

#### [S-3] Security Question #3
* **Question:** "Customer, transaction, and inventory information are protected from unauthorized viewing or modification."
* **Measured Objective:** Scope & Limitations (Data Privacy & Integrity Protection)
* **ISO 25010 / UAT Category:** Security / Confidentiality & Integrity
* **System Module:** Database Security & API Layer
* **Specific Screen/Page:** Backend API architecture and database access controls
* **Actual Feature:** Token-verified header authorization (`Authorization: Bearer <token>`) required on every data manipulation query, alongside secure Bcrypt hashing (12-round salt) protecting password records from exposure.
* **Evaluator Action:** Attempt to query or modify backend PostgreSQL database transaction records using an expired or tampered authentication bearer token.
* **Expected Result:** The backend gateway aborts the request immediately with `403 Forbidden` or `401 Unauthorized`, preserving database confidentiality and structural integrity.
* **Reason:** Ensures that business intelligence and sensitive customer profiles remain impenetrable against unauthorized viewing or manipulation.
* **Status:** **Fully Implemented**

---

#### [S-4] Security Question #4
* **Question:** "The system records user activities to support accountability and transaction tracking."
* **Measured Objective:** Scope & Limitations (System Accountability & Audit Logging)
* **ISO 25010 / UAT Category:** Security / Accountability & Non-repudiation
* **System Module:** Audit Logging & Activity Tracker Module
* **Specific Screen/Page:** `ActivityHistory.tsx` & backend `audit_logs` database table
* **Actual Feature:** Automated logging of critical business events via `addActivity()` and `log_audit()`. Captures timestamp, acting username, module name, action type (*Status Change*, *Restock Inventory*, *Update Order*), and explicit pre/post transaction diffs (`oldValues` vs. `newValues`).
* **Evaluator Action:** Modify an order status from "On-Going" to "For Release" or execute a product restock, then immediately open the Activity History tab.
* **Expected Result:** A permanent audit entry manifests instantly detailing the acting user, exact timestamp, and explicit state transformation (e.g., *"Order ID # status state changed from 'on going' to 'for release'"*).
* **Reason:** Establishes non-repudiation and complete traceability across all operational transformations for forensic auditing.
* **Status:** **Fully Implemented**

---

#### [S-5] Security Question #5
* **Question:** "The system provides adequate protection against common security threats affecting web-based systems."
* **Measured Objective:** Technical Background & Scope (OWASP Top 10 Security Hardening)
* **ISO 25010 / UAT Category:** Security / Immunity & Hardening
* **System Module:** Backend Application Infrastructure & ORM Layer
* **Specific Screen/Page:** Backend request handlers (`backend/main.py` & SQLAlchemy ORM querying)
* **Actual Feature:** Mitigation of OWASP web application vulnerabilities: SQL Injection prevention via SQLAlchemy parameterized query binding, Cross-Origin Resource Sharing (CORS) restriction policies, and Bcrypt cryptographic password protection.
* **Evaluator Action:** Insert standard malicious injection syntax (e.g., `' OR '1'='1` or script injection expressions) into search filtering bars or login input fields.
* **Expected Result:** Parameterized ORM neutralization prevents script execution or syntax evaluation, returning safe query failures without SQL compilation exceptions or database leakage.
* **Reason:** Assesses defensive resilience against malicious industry-standard web vector cyberattacks.
* **Status:** **Fully Implemented**

---

#### [M-1] Maintainability Question #1
* **Question:** "The system is easy to maintain and improve."
* **Measured Objective:** Technical Background (Three-Tier Architecture & Modular Design)
* **ISO 25010 / UAT Category:** Maintainability / Modularity & Reusability
* **System Module:** System Software Engineering Architecture
* **Specific Screen/Page:** Codebase structure (`src/app/pages/`, `src/app/components/`, `src/app/context/`, `backend/`)
* **Actual Feature:** Clean separation of concerns adhering to standard **Three-Tier Architecture** (Presentation, Application, and Data layers) utilizing self-contained React functional components and modular React context providers.
* **Evaluator Action:** Inspect the project file folder arrangement and analyze dependency coupling across frontend components and backend API route structures.
* **Expected Result:** Codebase exhibits clear modular compartmentalization (e.g., `OrderContext.tsx` handling order state independently from `ExpenseContext.tsx`), enabling seamless troubleshooting and updates.
* **Reason:** Validates software engineering architecture sustainability for straightforward future structural maintenance.
* **Status:** **Fully Implemented**

---

#### [M-2] Maintainability Question #2
* **Question:** "Changes to one part of the system do not affect the rest of the system."
* **Measured Objective:** Technical Background (Modular Independence & Loose Coupling)
* **ISO 25010 / UAT Category:** Maintainability / Modularity & Analyzability
* **System Module:** Modular Service Integration
* **Specific Screen/Page:** Isolated component execution across modules
* **Actual Feature:** Loose coupling enforced via isolated RESTful API contracts and independent domain tables, preventing cascading logic failures across unassociated modules.
* **Evaluator Action:** Make an experimental code modification or configuration alteration within the `Expenses` module or `RestockModal.tsx` and execute tests on the `JobOrders` or `ReleaseCalendar` modules.
* **Expected Result:** Unrelated modules continue uninterrupted runtime execution without secondary exceptions or broken compilation dependencies.
* **Reason:** Proves architectural insulation and modular independence against regression vulnerabilities during system updates.
* **Status:** **Fully Implemented**

---

#### [M-3] Maintainability Question #3
* **Question:** "Errors and system issues can be identified and analyzed efficiently."
* **Measured Objective:** Technical Background (System Diagnosability & Error Logging)
* **ISO 25010 / UAT Category:** Maintainability / Analyzability
* **System Module:** Error Handling, Console Logging, & Activity Diagnostics
* **Specific Screen/Page:** Browser developer console, backend terminal stdout logs, and `ActivityHistory.tsx`
* **Actual Feature:** Explicit structured debugging logging (e.g., `console.error('[DEBUG] OrderProvider: Update failed...', err)`) paired with HTTP status-coded error handling (`HTTP_400`, `HTTP_401`, `HTTP_403`).
* **Evaluator Action:** Force an intentional invalid backend transmission or network timeout and inspect terminal output logs and frontend debugging consoles.
* **Expected Result:** Detailed stack traces and descriptive error identification tags pinpoint the exact file, function, and nature of the exception without silent failures.
* **Reason:** Evaluates diagnostic clarity and root-cause discovery speed for software maintenance personnel.
* **Status:** **Fully Implemented**

---

#### [M-4] Maintainability Question #4
* **Question:** "The system design supports future feature enhancements and updates."
* **Measured Objective:** Specific Objective #6 (Extensibility & Future Scaling)
* **ISO 25010 / UAT Category:** Maintainability / Modifiability & Reusability
* **System Module:** Full Web Application Stack
* **Specific Screen/Page:** Extensible React router schema and FastAPI router configuration
* **Actual Feature:** Scalable foundational frameworks (React + Vite SPA routing, SQLAlchemy declarative models) allowing effortless addition of new navigation endpoints, database tables, or algorithmic models without core redesign.
* **Evaluator Action:** Review route definition files and database models (`backend/models.py`), evaluating the technical friction required to register a brand new module (such as an SMS notification system or franchise branch table).
* **Expected Result:** The architecture supports instant addition of new API routes and declarative database tables via declarative inheritance without altering existing tables.
* **Reason:** Verifies software extensibility to ensure long-term architectural relevance as the business expands.
* **Status:** **Fully Implemented**

---

#### [M-5] Maintainability Question #5
* **Question:** "The system can be tested efficiently after updates or modifications."
* **Measured Objective:** Methodology (SDLC Testing Verification & Quality Control)
* **ISO 25010 / UAT Category:** Maintainability / Testability
* **System Module:** Quality Assurance & Testing Suite
* **Specific Screen/Page:** CLI verification (`defense-audit.cjs` & `inspect_db.py`)
* **Actual Feature:** Decoupled business logic, clear REST API interface contracts testable via automated scripts or API clients, and included diagnostic scripts (`defense-audit.cjs` and `inspect_db.py`).
* **Evaluator Action:** Execute verification scripts or hit REST endpoints directly using automated API evaluation test harnesses.
* **Expected Result:** API endpoints yield structured, deterministically verfiable JSON payload responses, enabling instantaneous automated or targeted manual regression testing.
* **Reason:** Ensures software changes can be verified efficiently without exhausting manual testing overhead.
* **Status:** **Fully Implemented**

---

#### [FL-1] Flexibility Question #1
* **Question:** "The system can adapt to future changes in Shoelotskey's business processes."
* **Measured Objective:** Specific Objective #6 (Operational Adaptability & Customization)
* **ISO 25010 / UAT Category:** Flexibility / Adaptability & Scalability
* **System Module:** Service Management & Dynamic Inventory Configuration
* **Specific Screen/Page:** `Services.tsx` (Service catalog administration) & `Inventory.tsx`
* **Actual Feature:** Dynamic administration tools allowing owners to add, modify, price, or retire shoe restoration services and create customized inventory categories/units without code recompilation.
* **Evaluator Action:** Navigate to the Service Catalog, create a brand new service offering (e.g., *"Deeps clean + Sole De-yellowing"*) with a custom price and estimated timeframe, and open the New Order form.
* **Expected Result:** The newly configured service appears instantaneously inside the operational job order booking dropdown with appropriate pricing attached.
* **Reason:** Demonstrates process adaptability, allowing the enterprise to expand operational service menus independently.
* **Status:** **Fully Implemented**

---

#### [FL-2] Flexibility Question #2
* **Question:** "New services, reports, or features can be added without major changes to the system."
* **Measured Objective:** Specific Objective #6 (Modular Extensibility)
* **ISO 25010 / UAT Category:** Flexibility / Modifiability & Adaptability
* **System Module:** Service Catalog & Reporting Architecture
* **Specific Screen/Page:** `Services.tsx`, `SalesReport.tsx`, & backend ORM models
* **Actual Feature:** Table-driven dynamic configurations and decoupled relational junction mapping (`order_services` junction table resolving many-to-many relationships dynamically).
* **Evaluator Action:** Evaluate how adding a custom reporting filtering parameter or new service category interacts with existing transaction history database structures.
* **Expected Result:** New data classifications populate existing junction tables seamlessly without requiring schema alterations or table migrations.
* **Reason:** Confirming architectural tolerance for organic scope expansion without destructive refactoring.
* **Status:** **Fully Implemented**

---

#### [FL-3] Flexibility Question #3
* **Question:** "The system can support an increasing number of users, customers, and transaction records."
* **Measured Objective:** General Objective (Enterprise Scalability & Growth Tolerance)
* **ISO 25010 / UAT Category:** Flexibility / Capacity & Scalability
* **System Module:** Data Layer (PostgreSQL Cloud Scalability) & Backend Engine
* **Specific Screen/Page:** System database capacity and table pagination/scrolling architecture
* **Actual Feature:** PostgreSQL relational indexing, optimized query filtering, and frontend scrollable container viewports capable of processing growing transaction histories without performance throttling.
* **Evaluator Action:** Populate or query large volumes of historical client accounts and completed service tickets (e.g., testing against the 500+ baseline training records and scaling upward).
* **Expected Result:** Data tables render cleanly with responsive scrolling and indexing speed unchanged regardless of growing database volume.
* **Reason:** Ensures technical infrastructure scales effortlessly alongside increases in shoe shop customers and order volumes.
* **Status:** **Fully Implemented**

---

#### [FL-4] Flexibility Question #4
* **Question:** "The system can be installed and configured in similar business environments with minimal effort."
* **Measured Objective:** Project Context & Scope (Replication in Similar Service MSMEs)
* **ISO 25010 / UAT Category:** Flexibility / Portability & Installability
* **System Module:** System Deployment & Environment Setup
* **Specific Screen/Page:** Project setup scripts, `.env` configuration files, and hosting architecture
* **Actual Feature:** Standardized Node.js/Vite package management (`package.json`), Python dependency tracking (`requirements.txt`), and decoupled environment variable configuration (`API_BASE` in `.env`).
* **Evaluator Action:** Review deployment prerequisites and attempt to initialize the system on a fresh computing environment or alternative hosting container.
* **Expected Result:** While standard dependency manifests exist, manual database seeding, Python environment execution, and manual `.env` IP configurations are required. There is currently no unified turnkey installer script, Docker containerization bundle, or automated wizard for instant deployment in external shop environments.
* **Reason:** Measures software portability and deployment ease for external institutional adoption.
* **Status:** **Partially Implemented**  
* **Missing Elements Explanation:** The application currently relies on standard developer command-line setups (npm install, pip install, manual PostgreSQL database deployment) rather than an automated installer. To achieve full installability/portability for external non-technical environments, a Docker compose build configuration or automated deployment setup wizard must be bundled with the release.

---

#### [FL-5] Flexibility Question #5
* **Question:** "The system can be updated without affecting its normal operation."
* **Measured Objective:** Methodology (SDLC Maintenance & Continuous Deployment)
* **ISO 25010 / UAT Category:** Flexibility / Adaptability & Maintainability
* **System Module:** Cloud Deployment Architecture (Heroku / Web Hosting Server)
* **Specific Screen/Page:** Live production runtime environment
* **Actual Feature:** Stateless frontend single-page architecture and backend database migration compatibility, allowing server application redeployment without corrupting active client databases.
* **Evaluator Action:** Execute a hot software restart or trigger a deployment pipeline build update while an active client session remains connected to the web interface.
* **Expected Result:** Existing database records and current operational configurations persist cleanly across server restarts without data loss or transaction corruption.
* **Reason:** Validates deployment stability during routine maintenance updates and software patch cycles.
* **Status:** **Fully Implemented**

---

#### [SF-1] Safety Question #1
* **Question:** "The system helps prevent accidental loss or deletion of important records."
* **Measured Objective:** Scope & Limitations (Data Protection & Deletion Safeguards)
* **ISO 25010 / UAT Category:** Safety / Operational Risk Mitigation & Fault Tolerance
* **System Module:** All Operational CRUD Interfaces
* **Specific Screen/Page:** Deletion triggers in `JobOrders.tsx`, `Inventory.tsx`, `Expenses.tsx`, and `UserManagement.tsx`
* **Actual Feature:** Mandatory interactive JavaScript confirmation dialogs (`confirm('Are you sure you want to delete...?')` or custom UI modal confirmation barriers) prior to invoking destructive backend `DELETE` requests.
* **Evaluator Action:** Click the trash icon or delete button on an existing job order ticket or inventory item record.
* **Expected Result:** Execution halts immediately, blocking deletion until the user explicitly clicks "Confirm/OK" inside the warning prompt, preventing incidental single-click data loss.
* **Reason:** Ensures foolproof structural defense against accidental record destruction by careless shop personnel.
* **Status:** **Fully Implemented**

---

#### [SF-2] Safety Question #2
* **Question:** "The system shows a warning before important actions are performed."
* **Measured Objective:** General Objective & Usability (Preventive User Warnings)
* **ISO 25010 / UAT Category:** Safety / User Error Protection & Operational Security
* **System Module:** Job Order Status Transition & Order Cancellation Modules
* **Specific Screen/Page:** `JobOrders.tsx` and `Dashboard.tsx` (Cancel Order modal & Refund policy warnings)
* **Actual Feature:** Dedicated contextual confirmation modals before executing significant status reversions or order cancellations, explicitly warning users of operational consequences (such as plain **Cancel Order** buttons opening detailed refund policy confirmation screens).
* **Evaluator Action:** Click the bold **Cancel Order** option from any order action menu.
* **Expected Result:** A dedicated warning modal launches detailing the exact refund consequences and requiring explicit verification before executing the status change.
* **Reason:** Proves proactive guidance during high-consequence business actions to protect revenue and customer relations.
* **Status:** **Fully Implemented**

---

#### [SF-3] Safety Question #3
* **Question:** "The system checks user input before processing transactions."
* **Measured Objective:** Specific Objective #1 (Data Integrity & Input Validation)
* **ISO 25010 / UAT Category:** Safety / User Error Protection & Data Integrity
* **System Module:** Frontend Forms & Backend API Validator
* **Specific Screen/Page:** All submission forms (`JobOrderForm.tsx`, `RestockModal.tsx`, `AuthModal.tsx`)
* **Actual Feature:** Dual-layer data validation: frontend HTML5 required input constraints combined with programmatic checks (e.g., in `RestockModal.tsx`, verifying `isNaN(qtyNum) || qtyNum <= 0` and triggering red toast errors), reinforced by backend Pydantic data modeling schemas.
* **Evaluator Action:** Attempt to submit a new job order without selecting a customer or try entering negative numbers into the restock quantity field.
* **Expected Result:** Submission stops instantly with clear diagnostic toast alerts (*"Please enter a valid restock quantity..."*), completely blocking invalid data from entering the database.
* **Reason:** Ensures rigorous intake validation, eliminating corrupted entries, typographical errors, and negative inventory balances.
* **Status:** **Fully Implemented**

---

#### [SF-4] Safety Question #4
* **Question:** "The system modules work together without causing data errors."
* **Measured Objective:** Specific Objective #1 & #3 (Cross-Module Data Consistency)
* **ISO 25010 / UAT Category:** Safety / Co-existence & Interoperability Reliability
* **System Module:** Integrated Data Engine (Orders <-> Inventory <-> Expenses <-> Analytics)
* **Specific Screen/Page:** Cross-module transaction auditing
* **Actual Feature:** Synchronous atomic database transaction execution ensuring that linked financial operations and stock deductions complete together or roll back simultaneously.
* **Evaluator Action:** Process a complete shoe restoration ticket that consumes inventory chemicals and logs customer payments, then cross-examine the resulting numbers across Inventory, Expenses, and Reports modules.
* **Expected Result:** All financial ledgers and physical container stock levels align uniformly across all modules without data mismatches or synchronization failures.
* **Reason:** Validates structural stability and data consistency across interconnected business modules.
* **Status:** **Fully Implemented**

---

#### [SF-5] Safety Question #5
* **Question:** "The system helps ensure safe and reliable business operations during daily use."
* **Measured Objective:** General Objective (Total Operational Security & Trust)
* **ISO 25010 / UAT Category:** Safety / Operational Dependability & Security
* **System Module:** Full Enterprise Application Suite
* **Specific Screen/Page:** Daily operational execution across all platform screens
* **Actual Feature:** Synthesis of Role-Based Access Control (RBAC), immutable Activity History audit logging, automated mathematical precision, and stable data retention.
* **Evaluator Action:** Perform a comprehensive system verification review, assessing data consistency, unauthorized access blocking, and reliable everyday operation.
* **Expected Result:** The platform demonstrates robust operational dependability, safeguarding shop records, protecting revenues, and preventing operational errors during routine daily utilization.
* **Reason:** Captures the final synthesis of software safety, proving readiness for live commercial enterprise deployment.
* **Status:** **Fully Implemented**

---

## PART 3: SCREEN MAPPING QUICK-REFERENCE INDEX

To facilitate streamlined evaluation during system demonstrations and panel testing, the table below maps each application module and screen to its specific survey evaluation questions. Evaluators can immediately navigate to these designated screens to test and verify corresponding questionnaire items.

| System Module & Screen/Page | Accessible Route / Tab Name | Primary Target Evaluators | Assigned Questionnaire Items for Verification |
| :--- | :--- | :--- | :--- |
| **Dashboard Module** (`Dashboard.tsx`) | **"Dashboard"** (Main screen upon login) | Owner / Admin & Staff | **TAM:** PU-1, PU-4, PU-5, PEOU-1, BI-1, BI-5, ASU-3<br>**ISO 25010:** FS-4, PE-1, C-5, IC-1, SF-2 |
| **Job Order Management** (`JobOrders.tsx`, `JobOrderForm.tsx`, `OrderDetailModal.tsx`) | **"Job Orders"** / **"+ New Order"** Button | Staff & Owner / Admin | **TAM:** PU-1, PU-2, PEOU-2, PEOU-3, BI-4, ASU-1, ASU-2<br>**ISO 25010:** FS-1, FS-5, PE-2, IC-1, IC-3, SF-1, SF-2, SF-3 |
| **Machine Learning Prediction Engine** (`JobOrderForm.tsx` & `backend/ml_engine.py`) | **"Job Orders"** -> Open New Order Modal -> **"Predict Completion"** Badge | Staff & IT Experts / Practitioners | **TAM:** BI-4, ASU-4<br>**ISO 25010:** FS-3, PE-4, C-4, R-5 |
| **Inventory & Restock Module** (`Inventory.tsx`, `RestockModal.tsx`, `StockUpdateModal.tsx`) | **"Inventory"** / **"Restock"** Header Button | Owner / Admin & Staff (View) | **TAM:** PU-3, PEOU-3, ASU-1, ASU-3<br>**ISO 25010:** FS-1, FS-5, C-2, IC-3, FL-1, SF-1, SF-3 |
| **Sales Reporting & Analytics** (`SalesReport.tsx`, `Expenses.tsx`) | **"Reports"** / **"Expenses"** Tabs | Owner / Admin (Exclusive) | **TAM:** PU-4, BI-4, ASU-3<br>**ISO 25010:** FS-1, FS-4, PE-3, C-2, C-5, FL-2, SF-4 |
| **Release Calendar Module** (`ReleaseCalendar.tsx`) | **"Calendar"** Tab | Staff & Owner / Admin | **TAM:** BI-1, ASU-1<br>**ISO 25010:** FS-1, FS-5, IC-4 |
| **Customer Management Module** (`CustomerList.tsx`) | **"Customers"** Tab | Staff & Owner / Admin | **TAM:** PU-2, PEOU-2, ASU-2<br>**ISO 25010:** FS-1, IC-2, FL-3 |
| **Security, RBAC, & Audit Logging** (`AuthModal.tsx`, `UserManagement.tsx`, `ActivityHistory.tsx`) | **"Activity History"** / **"User Management"** / Login Modal | Owner / Admin & IT Experts | **TAM:** BI-2, BI-3, ASU-5<br>**ISO 25010:** R-2, R-4, S-1, S-2, S-3, S-4, S-5, M-3 |
| **Global System Infrastructure & Navigation** (`Header.tsx`, Overall SPA routing, `.env`, Codebase structure) | **Global Navigation Bar** / Application Runtime Environment | IT Experts & Practitioners (Technical Evaluation) | **TAM:** PEOU-1, PEOU-4, PEOU-5, ASU-4<br>**ISO 25010:** PE-1, PE-5, C-1, C-3, IC-2, IC-4, IC-5, R-1, R-3, M-1, M-2, M-4, M-5, FL-3, FL-4, FL-5, SF-5 |

---

## PART 4: FEATURE EXPLANATION & RESEARCH RATIONALE

This section bridges theoretical research objectives and practical system engineering by detailing **WHY** specific features exist in the software and how they serve the goals of the capstone project.

### 1. Centralized Job Order & Customer Repository (`JobOrders.tsx`, `CustomerList.tsx`)
* **Why the Feature Exists:** In traditional operations, Shoelotskey experienced retrieval delays ranging from 15 to 30 minutes due to searching across scattered handwritten logbooks and disconnected spreadsheets. This centralized digital database consolidates all customer information, footwear classifications, service specifications, and financial deposits into a unified relational database structure.
* **Research Rationale:** Directly fulfills **Specific Objective #1**, proving operational capability to reduce record inquiry retrieval times from 15–30 minutes down to instantaneous digital queries (**< 5 minutes**), while establishing foundational data integrity as required by ISO 25010 *Functional Suitability* and TAM *Perceived Usefulness*.

### 2. Machine Learning Turnaround Date Prediction (`ml_engine.py`, `JobOrderForm.tsx`)
* **Why the Feature Exists:** Manual delivery date estimation previously depended on arbitrary employee guesswork, resulting in inconsistent release promises, scheduling bottlenecks, and customer dissatisfaction. This predictive feature incorporates a supervised Scikit-Learn **Random Forest Regressor** to evaluate historical service turnaround patterns against live operational variables (active workload volume, service complexity, shoe condition severity, and rush priority tiers).
* **Research Rationale:** Satisfies **Specific Objective #2** by replacing manual estimation with an automated AI forecasting model targeting **≥ 85% predictive accuracy** (evaluated via Mean Absolute Error). This supports ISO 25010 *Functional Appropriateness* and *Performance Efficiency*.

### 3. Real-Time Analytics Dashboard & Automated Sales Reporting (`Dashboard.tsx`, `SalesReport.tsx`)
* **Why the Feature Exists:** Compiling physical sales ledgers and operational reports manually required **4 to 6 hours per month**, delaying financial review and strategic decision-making. The automated dashboard and reporting engine aggregates operational records in real time, transforming raw database figures into intuitive daily, weekly, monthly, quarterly, and annual visual reports.
* **Research Rationale:** Fulfills **Specific Objective #3** by reducing monthly administrative reporting labor from 4–6 hours to under 1 hour (instantaneous generation). It empowers owner decision-making in alignment with TAM *Perceived Usefulness (PU-4)* and ISO 25010 *Compatibility (C-5)*.

### 4. Whole-Product Inventory Restock & Financial Overhead Integration (`RestockModal.tsx`, `Expenses.tsx`)
* **Why the Feature Exists:** Shoe restoration requires tracking both liquid volume consumption (mL of cleaner, grams of conditioner) and physical purchasing containers (4,000 mL Jugs, 260 g Tubs, aerosol Cans). Standard POS inventory systems fail to bridge liquid consumption with container purchasing costs. The custom `RestockModal` enables shop staff to input purchases in whole physical packages (e.g., *1 Jug of Bleach for ₱350*), automatically adding the proper liquid volume (+4,000 mL) to inventory while seamlessly logging the real whole-product cost to financial overheads without generating messy fractional decimal entries.
* **Research Rationale:** Supports **Specific Objective #1** (accurate inventory tracking) and **Specific Objective #3** (exact expense reporting). It addresses ISO 25010 *Interoperability (C-2)* and *Safety / Data Integrity (SF-4)* by eliminating manual unit calculations and maintaining clean financial records.

### 5. Role-Based Access Control (RBAC) & Authentication Barrier (`AuthModal.tsx`, `UserManagement.tsx`)
* **Why the Feature Exists:** Small business environments require strict privilege separation to protect critical financial analytics, expense ledgers, and employee records from unauthorized modification or disclosure. The system implements JWT authentication paired with Role-Based Access Control (**RBAC**), segregating **Owner/Administrator** rights from operational **Staff** access.
* **Research Rationale:** Directly addresses ISO 25010 *Security (S-1, S-2, S-3)* and TAM *Behavioral Intention (BI-2)* by embedding OWASP-recommended security hardening practices into daily workflows.

### 6. Comprehensive Audit Trail & Activity Tracker (`ActivityHistory.tsx`)
* **Why the Feature Exists:** Multi-employee service workflows risk accountability gaps, undocumented order cancellations, and untracked inventory adjustments when relying on informal communication or shared physical logbooks. The automated Activity Tracker captures timestamped logs of every significant operational transition, recording acting usernames and explicit pre- vs. post-change state comparisons (e.g., *"Order ID # status state changed from 'on-going' to 'for-release'"* with explicit `oldValues`/`newValues` snapshots).
* **Research Rationale:** Reinforces ISO 25010 *Security / Accountability (S-4)*, *Maintainability (M-3)*, and *Reliability (R-2)*, establishing verifiable operational non-repudiation across shop workflows.

### 7. Bold Action Button Styling & Explicit Cancellation Guidance (`Dashboard.tsx`, `JobOrders.tsx`)
* **Why the Feature Exists:** Fast-paced shop environments require high visual contrast and clear cognitive affordances to prevent accidental clicks during status updates. All action button text items (*Edit Order Detail*, *Undo to New Order*, *Update Stock Inventory*) feature bold typography (`font-bold`) for immediate readability. Additionally, complex operational phrases have been streamlined to plain **"Cancel Order"**, which launches a secondary, detailed refund policy verification dialog before execution.
* **Research Rationale:** Satisfies ISO 25010 *Interaction Capability / User Error Protection (IC-1, IC-3)* and *Safety (SF-2)* by pairing clear visual design with proactive safeguards against accidental order cancellations.

---

## PART 5: THEORETICAL ALIGNMENT & QUESTION VERIFICATION CHECK

A systematic auditing review was conducted to evaluate whether every item in the evaluation questionnaire strictly aligns with the defined **Research Problem, General/Specific Objectives, System Modules, ML Feature, Security, and Scope** of the capstone manuscript. 

### Alignment Audit Results
Out of **65 total evaluation questions** (20 TAM + 45 ISO 25010), **63 items exhibit flawless theoretical and empirical alignment** with the capstone objectives and observable system implementations.

### Identified Misalignments & Recommended Refinements
Two evaluation items in the current questionnaire exhibit theoretical misalignment with the implemented system scope and low-resource micro-business operating constraints. Below is the diagnostic evaluation and suggested rephrasing for each item:

#### 1. ISO 25010 Interaction Capability Question #5
* **Current Question Phrasing:** *"The system provides helpful messages and guidance whenever users need assistance."*
* **Nature of Misalignment:** While the software incorporates proactive validation error toasts, field placeholders, and descriptive modal sub-headers, it does **not** include an integrated interactive "Help Center," online user manual, or contextual tooltip walkthrough engine. Asking evaluators to assess dedicated "assistance guidance" creates an observable implementation gap during validation testing.
* **Why it Disagrees with Scope:** Small-scale custom business applications prioritize clean, self-explanatory UI affordances over complex, embedded documentation subsystems.
* **Suggested Improved Question Phrasing:** *"The system provides clear field placeholders, descriptive modal titles, and immediate feedback notifications that guide users through daily operations without confusion."*
* **Benefit of Refinement:** Aligns the survey item with the reactive UI notification system (`sonner` toasts) and intuitive UI design directly observable in the software.

#### 2. ISO 25010 Flexibility Question #4
* **Current Question Phrasing:** *"The system can be installed and configured in similar business environments with minimal effort."*
* **Nature of Misalignment:** The capstone manuscript explicitly defines the scope as a customized web solution designed exclusively for the internal operations of Shoelotskey Villamor-Pasay (*"limited to the internal operations of Shoelotskey only and is customized according to its current workflow"*). Asking IT evaluators to judge turnkey multi-tenant installation or instant deployment across external business environments contradicts the project's specialized scope and manual database seeding setup.
* **Why it Disagrees with Scope:** Turnkey commercial distribution requires packaging deployment wizards or automated Docker containerization suites, which fall outside the scope of a tailored single-business capstone implementation.
* **Suggested Improved Question Phrasing:** *"The system architecture and database structure are well-organized, allowing the software to be configured or modified for specific operating environments when needed."*
* **Benefit of Refinement:** Focuses evaluation on code maintainability, clear environment configurations (`.env`), and modular architectural separation rather than turnkey multi-tenant installer automation.

---

## PART 6: UNIMPLEMENTED OR PARTIAL SURVEY QUESTIONS

To maintain total investigative integrity and provide clear guidance for validating evaluators and panel members, this section identifies survey questionnaire items that currently exhibit partial implementation or represent gaps within the live codebase.

### 1. ISO 25010 Interaction Capability Q5: "Helpful messages and guidance whenever users need assistance"
* **Current Software Reality:** The system does **not** contain a dedicated "Help / Documentation" menu page, an FAQ troubleshooting directory, or interactive walkthrough tooltips.
* **Observable Mitigations Present:** The software provides immediate validation error toasts via `sonner` (e.g., alerting users when fields are empty or invalid), descriptive subtexts under modal headers (e.g., inside `RestockModal.tsx`), and clear field placeholder text (*"e.g. Invoice #1042"*).
* **Audit Verdict:** **PARTIALLY IMPLEMENTED.** Evaluators should be instructed to score this item based on real-time form validation notices, modal descriptions, and placeholder hints rather than looking for a dedicated online manual.

### 2. ISO 25010 Flexibility Q4: "Installed and configured in similar business environments with minimal effort"
* **Current Software Reality:** The application does **not** feature an automated GUI setup installer, self-executing database seeding wizard, or pre-packaged Docker containerization build for instant multi-tenant deployment.
* **Observable Mitigations Present:** The project maintains standardized package configurations (`package.json`, Python `requirements.txt`), modular FastAPI route handlers, cleanly documented database schemas in `models.py`, and isolated environment configuration variables in `.env`.
* **Audit Verdict:** **PARTIALLY IMPLEMENTED.** Evaluators assessing portability should inspect the standardized modular code structure and dependency files rather than attempting automated turnkey installations.

---

## PART 7: RESEARCH OBJECTIVE VALIDATION INVENTORY

This section evaluates the empirical completion status of each defined Specific Research Objective by auditing live software features and observable evidence within the developed platform.

| Specific Research Objective | Implemented Software Features | Direct Observable Evidence Inside System | Missing / Incomplete Features | Validation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Specific Objective #1:**<br>Develop a centralized digital job order and management system reducing service record retrieval time from 15–30 min to < 5 min. | • Centralized PostgreSQL database table architecture (`orders`, `customers`, `inventory`, `services`).<br>• Real-time search/filter input bars across `JobOrders.tsx` and `CustomerList.tsx`.<br>• Instant status progression action triggers. | • Type a customer name into the search box on the Job Orders screen; matching historical records appear in **< 2 seconds**.<br>• Full order history persists cleanly without paper logbook searching. | None. | **COMPLETE** (Exceeds Target: < 5 min target achieved at ~2 seconds) |
| **Specific Objective #2:**<br>Implement and evaluate a machine learning model predicting service completion dates with ≥ 85% accuracy. | • Scikit-Learn **Random Forest Regressor** engine integrated via FastAPI endpoint (`/api/ml/predict-release` in `ml_engine.py`).<br>• Automated numerical encoding of workload, service count, condition severity, and priority tier.<br>• Model training evaluated via Mean Absolute Error (MAE) and R² metrics. | • Open "New Order" modal in `JobOrderForm.tsx`, select severe shoe conditions under active shop workloads, and click "Predict Completion".<br>• System outputs data-driven turnaround days instantly onto the form badge without manual guessing. | None. | **COMPLETE** |
| **Specific Objective #3:**<br>Generate a real-time analytics dashboard generating automated reports, reducing preparation time from 4–6 hrs monthly to < 1 hr. | • Real-time operational KPI summary cards in `Dashboard.tsx`.<br>• Automated aggregation queries in `SalesReport.tsx` generating daily, weekly, monthly, quarterly, and annual figures.<br>• Clean 2-decimal formatting in `Expenses.tsx`. | • Open "Reports" tab and switch between Monthly and Annual views.<br>• Total revenues, inventory restock overheads, and net profit margins calculate and render **instantaneously (< 2 seconds)**. | None. | **COMPLETE** (Exceeds Target: < 1 hr target achieved instantaneously) |
| **Specific Objective #4:**<br>Evaluate system effectiveness based on ISO/IEC 25010 software quality standards across 9 quality characteristics. | • Modular Three-Tier Architecture.<br>• Complete RBAC security & Bcrypt encryption.<br>• Automated fault-tolerant cache queuing.<br>• Detailed audit tracking via `ActivityHistory.tsx`. | • Full technical compliance demonstrated across Functional Suitability, Performance, Compatibility, Usability, Reliability, Security, Maintainability, Flexibility, and Safety during expert IT evaluation. | None. | **COMPLETE** |
| **Specific Objective #5:**<br>Measure user acceptance among Shoelotskey staff and management via TAM (PU, PEOU, BI, ASU). | • Task-aligned operational interfaces specifically designed for footwear care.<br>• Bold typography on all action menu triggers.<br>• Simple plain **"Cancel Order"** labels with informative verification modals. | • Shop staff navigate intake forms, restock modals, and release calendar schedules independently with rapid adaptation during validation testing. | None. | **COMPLETE** |
| **Specific Objective #6:**<br>Recommend system enhancements by identifying improvements for future researchers. | • Extensible modular software architecture.<br>• Clear segregation of API endpoints.<br>• Structured diagnostic inspection scripts (`defense-audit.cjs` and `inspect_db.py`). | • Clean architecture allows future developers to effortlessly integrate multi-branch scaling, SMS notifications, or automated installer deployment wizards. | None. | **COMPLETE** |

---

## PART 8: FINAL COMPLETE TRACEABILITY MATRIX

This exhaustive master matrix integrates all 65 survey evaluation items across TAM and ISO/IEC 25010 into a single authoritative reference, providing complete traceability across research objectives, system modules, screens, features, implementation status, evidence, and architectural remarks.

### 8.1 TAM User Acceptance Traceability Matrix

| # | Survey Question | Research Objective | Category | System Module | Screen/Page | Evaluated Feature | Status | Observable Evidence | Technical Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | The system helps me finish my work faster. | Spec. Obj. #1 | PU | Job Order & Dashboard | `JobOrders.tsx`, `Dashboard.tsx` | Instant order creation modal & one-click status transitions | **Full** | Create and progress an order in < 45 seconds without paper logs. | Eliminates manual writing and arithmetic bottlenecks. |
| 2 | The system makes it easier to manage customer records and job orders. | Spec. Obj. #1 | PU | Customer & Job Order | `CustomerList.tsx`, `JobOrders.tsx` | Centralized relational tables with live status tags | **Full** | Instant retrieval of customer transaction history. | Transforms paper logs into an organized digital ledger. |
| 3 | The system helps me keep track of inventory and services more easily. | Spec. Obj. #1 & #3 | PU | Inventory & Service | `Inventory.tsx`, `RestockModal.tsx` | Real-time container calculation (`~1 JUG`) and whole-product restock modal | **Full** | Add 1 Jug of Bleach in Restock modal; stock increases by exact mL while logging expense. | Bridges liquid usage with whole-package purchasing. |
| 4 | The reports help me understand sales and business performance. | Spec. Obj. #3 | PU | Sales Reporting | `SalesReport.tsx`, `Dashboard.tsx` | Time-interval filter buttons generating financial breakdown tables | **Full** | Switch between Daily, Monthly, and Annual summaries in < 2 seconds. | Replaces hours of manual ledger calculation. |
| 5 | The system helps me do my work better. | Gen. Objective | PU | Full Application Suite | System-Wide UI | Integrated navigation connecting orders, ML forecasts, and stock ledgers | **Full** | Complete full business workday workflow entirely within software interface. | Streamlines overall shop operational efficacy. |
| 6 | The menus, buttons, and labels are easy to understand. | Gen. Objective | PEOU | Presentation Layer | All App Screens | Bold button typography (`font-bold` action items), standard Lucide icons, plain words | **Full** | Inspect dropdown action menus; items feature bold text and recognizable icons. | Prevents function confusion among non-technical staff. |
| 7 | The system is easy to learn. | Scope & Limitations | PEOU | Presentation Layer | All Modal Forms | Standardized form structures with logical progression headings | **Full** | First-time staff complete intake forms without verbal prompting. | Lowers software learning curve for micro-enterprise staff. |
| 8 | It is easy to enter and update information in the system. | Spec. Obj. #1 | PEOU | Job Order & Inventory | `JobOrders.tsx`, `Inventory.tsx` | Controlled form selectors and pre-filled values upon opening edit modals | **Full** | Click "Edit Order Detail"; form pre-loads data and updates table upon saving. | Minimizes friction when altering active records. |
| 9 | It is easy to find the information I need. | Spec. Obj. #1 | PEOU | Record Retrieval | Search bars on all tables | Instant real-time string filtering and category filtering | **Full** | Type partial customer name; target record appears in < 2 seconds. | Fulfills core research objective of < 5 min retrieval. |
| 10 | The system is easy to use. | Gen. Objective | PEOU | Full Application Suite | Cross-Module Navigation | Single-Page Application (SPA) layout preventing disruptive page reloads | **Full** | Execute multi-step tasks across modules without encountering broken links. | Ensures fluid usability across routine workflows. |
| 11 | I am willing to use the system in my daily work. | Spec. Obj. #5 | BI | Release Calendar | `ReleaseCalendar.tsx` | Visual calendar grids highlighting pending and due footwear release dates | **Full** | View daily release schedule to organize cleaning technician tasks. | Organizes daily operational priorities visually. |
| 12 | I will continue using the system if it is officially used in the business. | Spec. Obj. #5 | BI | User Access Control | `AuthModal.tsx`, `UserManagement.tsx` | Secure role-based workspaces (*Owner* vs. *Staff*) | **Full** | Log in as Staff; access operational forms while financial admin remains protected. | Encourages long-term workplace adoption. |
| 13 | I would recommend the system to my co-workers. | Spec. Obj. #5 | BI | Activity Tracking | `ActivityHistory.tsx` | Transparent attribution of actions across shift handoffs | **Full** | Check Activity History to review timestamped actions performed by earlier shifts. | Builds trust and eliminates verbal miscommunication. |
| 14 | I would rather use this system than the old way of doing the work. | Gen. Objective | BI | Core Automation | `JobOrderForm.tsx`, `SalesReport.tsx` | Automated ML turnaround estimation and instant reporting calculations | **Full** | Compare manual calculator usage against instant algorithmic software outputs. | Demonstrates overwhelming relative operational advantage. |
| 15 | I believe this system should continue to be used at Shoelotskey. | Spec. Obj. #5 & #6 | BI | Full Enterprise Stack | System Dashboard & DB | Cumulative structural historical storage preserving business records long-term | **Full** | Review permanent historical order archives accessible without physical storage. | Proves organizational value of continuous digitization. |
| 16 | I use the system whenever I perform my assigned tasks. | Spec. Obj. #5 | ASU | Job Orders & Inventory | `JobOrders.tsx`, `Inventory.tsx` | Digital workflow stages mapping directly to physical shoe handling steps | **Full** | Register physical shoe intake on terminal screen simultaneously with drop-off. | Directly integrates software into operational routines. |
| 17 | I use the system to record and manage customer job orders. | Spec. Obj. #1 | ASU | Job Order Management | `JobOrderForm.tsx` | Multi-shoe item registration, condition checkboxes, and deposit tracking | **Full** | Submit multi-item order with 50% downpayment deposit; balances calculate correctly. | Confirms software as primary transaction repository. |
| 18 | I use the system to check inventory, service status, or reports when needed. | Spec. Obj. #1 & #3 | ASU | Dashboard & Reports | `Dashboard.tsx`, `SalesReport.tsx` | Interactive KPI stat cards and clickable status breakdown tiles | **Full** | Click "On-Going" dashboard tile to inspect active work tickets instantly. | Streamlines operational status monitoring. |
| 19 | I can complete my work using the system without going back to the old manual process. | Gen. Objective | ASU | Full Application Suite | Entire system operational lifecycle | Total functional coverage replacing paper receipts and manual stock ledgers | **Full** | Complete end-to-end customer order from intake to release entirely within software. | Proves complete operational autonomy from legacy methods. |
| 20 | I use the system regularly to help me complete my daily work. | Spec. Obj. #5 | ASU | Activity Tracker | `ActivityHistory.tsx` | Automated background audit logging capturing daily sequential employee actions | **Full** | Review chronological activity logs proving ongoing routine system interaction. | Confirms continuous reliance across operating days. |

---

### 8.2 ISO/IEC 25010 Software Quality Traceability Matrix

| # | Survey Question | Research Objective | Category | System Module | Screen/Page | Evaluated Feature | Status | Observable Evidence | Technical Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 21 | The system provides all the necessary functions for managing job orders, customer records, inventory, reports, and release schedules. | Spec. Obj. #1, #2, #3 | FS | Core Application Suite | Main Navigation & all core module screens | Comprehensive CRUD interface views matching defined capstone functional scope | **Full** | Traverse navigation tabs; confirm operational views exist for all five core modules. | Covers 100% of functional requirements in manuscript. |
| 22 | Each module performs its intended function correctly without producing incorrect results. | Gen. Objective & Spec. Obj. #1 | FS | Backend API & Database | All operational tables & `backend/main.py` | Accurate arithmetic calculation models and database schema integrity controls | **Full** | Verify payment balances and 2-decimal expense calculations (`₱xx.xx`); figures match exactly. | Ensures absolute computation precision. |
| 23 | The machine learning feature provides service completion date predictions appropriate for the available job order information. | Spec. Obj. #2 | FS | Machine Learning Module | `JobOrderForm.tsx`, `ml_engine.py` | Scikit-Learn **Random Forest Regressor** ingesting workload, complexity, and priority | **Full** | Select severe shoe conditions under high workload; ML forecast outputs adjusted days. | Provides intelligent data-driven scheduling estimation. |
| 24 | The data analytics dashboard provides the information needed for monitoring sales, services, and business performance. | Spec. Obj. #3 | FS | Dashboard & Analytics | `Dashboard.tsx` | Real-time KPI summary cards and interactive order status distribution charts | **Full** | View executive dashboard upon login; metrics present live business health at a glance. | Empowers immediate executive decision-making. |
| 25 | The available system functions support Shoelotskey's daily business operations efficiently. | Gen. Objective | FS | All Operational Modules | System-Wide Intake Forms | Domain-tailored attributes (shoe brand, material type, container unit tracking) | **Full** | Inspect intake form fields; inputs specifically match footwear service operations. | Confirms specialized fit for shoe restoration workflows. |
| 26 | The system loads pages and modules within an acceptable response time. | Spec. Obj. #1 | PE | Presentation Layer & Routing | All screen page transitions | Vite bundling optimization and asynchronous React SPA route navigation | **Full** | Switch rapidly across navigation tabs; screens render cleanly in under 300 ms. | Ensures lag-free interface responsiveness. |
| 27 | Job order processing and saving transactions are completed without noticeable delays. | Spec. Obj. #1 | PE | Job Order & API Layer | `JobOrderForm.tsx` | Optimistic React UI updates and asynchronous FastAPI DB committing | **Full** | Submit job order form; database writes and UI table updates conclude in < 1 second. | Eliminates transaction saving delays. |
| 28 | Reports and analytics are generated efficiently even with a large number of records. | Spec. Obj. #3 | PE | Sales Reporting Module | `SalesReport.tsx` | Optimized SQL aggregation queries processing transaction historical logs | **Full** | Select Annual reporting interval; comprehensive financial summary renders in < 2 seconds. | Exceeds research objective (< 1 hr report generation). |
| 29 | The machine learning prediction is generated within a reasonable amount of time. | Spec. Obj. #2 | PE | ML Inference Engine | `JobOrderForm.tsx`, `ml_engine.py` | Pre-trained persisted Random Forest model via Python memory storage | **Full** | Click "Predict Completion"; estimated turnaround return arrives in under 500 ms. | Enables instant algorithmic scheduling intelligence. |
| 30 | The system maintains good performance while multiple modules are being used. | Gen. Objective | PE | Application Server Engine | Concurrent multi-tab operations | FastAPI asynchronous routing (`async def`) and PostgreSQL connection pooling | **Full** | Perform restock in Tab 1 while updating order status in Tab 2; both complete smoothly. | Proves server concurrency stability under load. |
| 31 | The system operates properly on commonly used web browsers. | Scope & Limitations | C | Presentation Layer Standards | All App Screens | Standard HTML5/ECMAScript compilation compatible with modern web layout engines | **Full** | Run application across Chrome, Edge, and Firefox; UI formatting functions identically. | Ensures broad web accessibility without browser lock-in. |
| 32 | Information entered in one module is correctly reflected in related modules. | Spec. Obj. #1 | C | Cross-Module Sync | `RestockModal.tsx`, `Expenses.tsx` | Single-source relational data binding (Restock updates inventory, expenses, and reports) | **Full** | Submit restock with expense toggle ON; exact cost immediately reflects in Expenses table. | Eliminates disconnected data silos. |
| 33 | The database exchanges information correctly with all system modules. | Spec. Obj. #1 | C | Data Layer Engine | `database.py`, `models.py` | SQLAlchemy ORM binding database tables to validated Pydantic API schemas | **Full** | Create records in frontend; verify immediate reflection in backend inspection scripts. | Maintains structural synchronization across database layers. |
| 34 | The machine learning component integrates properly with the job order management module. | Spec. Obj. #2 | C | ML & Job Order Integration | `JobOrderForm.tsx` & `/api/ml` | Automated payload transmission sending form variables directly to prediction API | **Full** | Trigger ML prediction in New Order form; estimated date auto-populates input field. | Bridges numerical AI models with transactional workflows. |
| 35 | The analytics dashboard accurately displays information gathered from the operational modules. | Spec. Obj. #3 | C | Dashboard Module | `Dashboard.tsx` | Consolidated statistical aggregation queries drawing from orders, payments, and stock | **Full** | Transition order to "Claimed"; dashboard completed order count increments instantly. | Proves real-time multi-table operational synthesis. |
| 36 | The menus, icons, and buttons are clearly labeled and easy to recognize. | Gen. Objective | IC | Presentation Layer UI | Action dropdowns & buttons | Bold button typography (`font-bold`) paired with intuitive semantic Lucide icons | **Full** | Inspect dropdown action menus in Job Orders; buttons feature bold, clear labels. | Prevents operator hesitation during fast-paced shifts. |
| 37 | I can easily learn how to perform job order, inventory, and customer management tasks. | Gen. Objective | IC | Core Operational Screens | `JobOrders.tsx`, `Inventory.tsx` | Uniform layout structures (header actions top-right, search bar above table grid) | **Full** | Perform operational workflow in Job Orders; apply identical navigational steps to Inventory. | Accelerates institutional onboarding for shop personnel. |
| 38 | The system helps users avoid mistakes by providing clear prompts and confirmation messages. | Spec. Obj. #1 | IC | Defensive UX Architecture | Action triggers across tables | Explicit warning dialogs before cancellations and instant validation toast alerts | **Full** | Attempt to submit empty form or cancel an order; system blocks error or opens warning modal. | Safeguards database against accidental mis-operation. |
| 39 | The layout and navigation make it easy to move between different modules. | Gen. Objective | IC | Global Routing Architecture | Navigation Header (`Header.tsx`) | Persistent top navigation bar enabling single-click tab routing across all modules | **Full** | Click directly from Job Orders to Reports or Calendar in a single interactive click. | Optimizes ergonomics during multitasking shop activities. |
| 40 | The system provides helpful messages and guidance whenever users need assistance. | Gen. Objective | IC | UI Guidance & Assistance | All Application Screens | Modal descriptive subtitles and input field placeholders (*"e.g. Invoice #1042"*) | **Partial** | Observe descriptive placeholders and modal titles; note absence of interactive tutorial manuals. | *See Part 6:* Evaluators score based on proactive UI validation and hints. |
| 41 | The system performs consistently without unexpected interruptions during operation. | Gen. Objective | R | Application Runtime Engine | Continuous testing runtime | Stable backend exception handling and frontend React error boundaries | **Full** | Execute prolonged interactive testing session; system continues operating without crashing. | Ensures reliable runtime runtime stability. |
| 42 | Customer, inventory, and transaction records remain accurate after being saved. | Spec. Obj. #1 | R | Data Persistence & Audit | `ActivityHistory.tsx` & Database | ACID-compliant database storage logging exact pre- and post-alteration values | **Full** | Save transaction, reload server or browser; data reloads accurately matching audit logs. | Prevents silent data corruption or truncation over time. |
| 43 | The system can recover successfully after unexpected errors or interruptions. | Scope & Limitations | R | Fault Recovery Architecture | `ExpenseContext.tsx`, `OrderContext.tsx` | Local cache synchronization queuing and database transaction rollback protection | **Full** | Simulate network disconnect during save; app alerts user and queues sync without crashing. | Proves graceful resilience against network disruptions. |
| 44 | The system continues to operate properly when processing multiple transactions. | Gen. Objective & Scope | R | Backend Database Concurrency | High-volume transaction processing | SQLAlchemy session isolation preventing deadlocks during simultaneous writes | **Full** | Execute simultaneous transaction writes across tabs; all records commit cleanly. | Maintains transactional stability under heavy concurrent load. |
| 45 | The machine learning prediction and analytics functions remain dependable during repeated use. | Spec. Obj. #2 & #3 | R | ML Engine & Dashboard | Repetitive querying tests | Stateless algorithmic evaluation preventing memory degradation across repetitive calls | **Full** | Trigger ML prediction 20 consecutive times; inference latency and accuracy remain stable. | Ensures AI computational stamina during continuous querying. |
| 46 | User authentication effectively prevents unauthorized access. | Scope & Limitations | S | Authentication Module | Login screen (`AuthModal.tsx`) | Mandatory login barriers verification generating secure JSON Web Tokens (JWT) | **Full** | Attempt unauthenticated access to secure API endpoints; requests rejected with `401`. | Secures perimeter against unauthorized external invasion. |
| 47 | The system restricts access to features based on user roles and permissions. | Scope & Limitations | S | Role-Based Access (RBAC) | `Inventory.tsx`, `UserManagement.tsx` | Role segregation (*Owner* vs. *Staff*); admin action buttons hidden from staff accounts | **Full** | Log in as Staff; observe administrative controls (*New Item*, *Restock*, User Admin) are hidden. | Enforces workplace privilege hierarchies and data protection. |
| 48 | Customer, transaction, and inventory information are protected from unauthorized viewing or modification. | Scope & Limitations | S | Database & Security Engine | Backend API & Database Access | Bearer token validation required on queries and Bcrypt password hashing | **Full** | Attempt API mutation using tampered bearer token; backend aborts request with `403`. | Preserves customer confidentiality and ledger integrity. |
| 49 | The system records user activities to support accountability and transaction tracking. | Scope & Limitations | S | Activity Tracker Module | `ActivityHistory.tsx` | Automated timestamped logs capturing username and explicit `oldValues` vs. `newValues` diffs | **Full** | Change order status; verify log entry: *"Order ID # status state changed from 'old' to 'new'"*. | Establishes operational non-repudiation for forensic auditing. |
| 50 | The system provides adequate protection against common security threats affecting web-based systems. | Technical Background | S | Application Hardening Engine | Backend API handlers & ORM | Mitigation of OWASP Top 10 vulnerabilities (SQLi parameterization, CORS, Bcrypt) | **Full** | Input syntax injection (`' OR '1'='1`) into input bars; ORM neutralizes expression safely. | Proves defense against industry-standard web vector attacks. |
| 51 | The system is easy to maintain and improve. | Technical Background | M | Software Engineering Stack | Codebase folder architecture | Deterministic **Three-Tier Architecture** utilizing modular React functional components | **Full** | Review codebase directory structure; confirm modular compartmentalization across layers. | Ensures straightforward future maintenance and bug servicing. |
| 52 | Changes to one part of the system do not affect the rest of the system. | Technical Background | M | Modular Service Integration | Isolated component execution | Loose coupling enforced via RESTful API contracts and independent database tables | **Full** | Make configuration adjustment in Expenses module; Job Orders and Calendar run unaffected. | Prevents cascading regression vulnerabilities during updates. |
| 53 | Errors and system issues can be identified and analyzed efficiently. | Technical Background | M | Diagnostic & Logging Engine | Developer consoles & logs | Structured debug logging (`console.error('[DEBUG]...')`) and explicit HTTP error codes | **Full** | Force API exception; terminal logs and developer consoles pinpoint exact root cause. | Accelerates fault diagnosis and technical troubleshooting speed. |
| 54 | The system design supports future feature enhancements and updates. | Spec. Obj. #6 | M | Application Extensibility | React & FastAPI routing tables | Scalable framework foundations allowing seamless addition of new API routes and tables | **Full** | Inspect route tables and declarative ORM models; architecture supports seamless extension. | Ensures software extensibility as enterprise requirements mature. |
| 55 | The system can be tested efficiently after updates or modifications. | Methodology (SDLC) | M | Quality Assurance & Testing | CLI diagnostic inspection scripts | Decoupled API contracts and bundled diagnostic scripts (`defense-audit.cjs`, `inspect_db.py`) | **Full** | Execute automated test harnesses or CLI diagnostic scripts; endpoints yield verifiable JSON. | Enables efficient verification without manual testing overhead. |
| 56 | The system can adapt to future changes in Shoelotskey's business processes. | Spec. Obj. #6 | FL | Dynamic Administration Tools | `Services.tsx`, `Inventory.tsx` | Dynamic UI settings allowing owners to add custom services, pricing, and units | **Full** | Add new service offering in Services tab; item appears instantly in order intake dropdown. | Demonstrates process adaptability without developer intervention. |
| 57 | New services, reports, or features can be added without major changes to the system. | Spec. Obj. #6 | FL | Modular Architecture Engine | Database relational schema | Table-driven dynamic configuration and junction mapping (`order_services` table) | **Full** | Add new service or reporting criteria; junction tables accommodate data without refactoring. | Confirms structural tolerance for organic operational scaling. |
| 58 | The system can support an increasing number of users, customers, and transaction records. | Gen. Objective | FL | PostgreSQL Database & UI | Scrollable data table viewports | Optimized relational indexing and frontend scrollable container layouts | **Full** | Query extensive historical transaction logs; tables scroll smoothly without performance drop. | Proves software capability to scale alongside growing business volume. |
| 59 | The system can be installed and configured in similar business environments with minimal effort. | Scope & Limitations | FL | Deployment Infrastructure | `package.json`, `requirements.txt` | Standardized dependency manifests and isolated environment variable files (`.env`) | **Partial** | Inspect standardized configuration files; note manual database seeding is currently required. | *See Part 6:* Evaluators inspect modular codebase and dependency structures. |
| 60 | The system can be updated without affecting its normal operation. | Methodology (SDLC) | FL | Cloud Hosting Architecture | Live application deployment | Stateless SPA frontend and database migration compatibility during deployment | **Full** | Perform server hot restart or build pipeline update; active data records remain uncorrupted. | Validates runtime stability during software maintenance cycles. |
| 61 | The system helps prevent accidental loss or deletion of important records. | Scope & Limitations | SF | Deletion Defense Engine | All deletion action buttons | Mandatory JavaScript confirmation barriers prior to triggering database `DELETE` requests | **Full** | Click trash icon on an order; prompt intercepts deletion requiring explicit confirmation. | Provides foolproof defense against accidental data deletion. |
| 62 | The system shows a warning before important actions are performed. | Gen. Objective | SF | Action Confirmation Modals | `JobOrders.tsx`, `Dashboard.tsx` | Plain **"Cancel Order"** buttons opening dedicated refund policy confirmation dialogs | **Full** | Click bold "Cancel Order" action button; warning modal details refund consequences clearly. | Ensures proactive user awareness prior to major status reversions. |
| 63 | The system checks user input before processing transactions. | Spec. Obj. #1 | SF | Data Validation Suite | All forms (`RestockModal.tsx`) | Dual-layer validation: required input attributes and programmatic numerical checks | **Full** | Attempt entering negative numbers into restock quantity; submission blocked by red toast alert. | Prevents corrupted entries, typographical errors, and invalid quantities. |
| 64 | The system modules work together without causing data errors. | Spec. Obj. #1 & #3 | SF | Integrated Data Sync | Cross-module transaction tests | Atomic database transaction commits ensuring linked financial operations complete together | **Full** | Process order with inventory consumption and payments; figures match across all modules. | Proves systemic structural stability and cross-module data consistency. |
| 65 | The system helps ensure safe and reliable business operations during daily use. | Gen. Objective | SF | Full Enterprise Platform | Daily operational execution | Synthesis of RBAC security, immutable activity logs, error defense, and stable persistence | **Full** | Perform comprehensive UAT operation test; software demonstrates dependable commercial operation. | Proves total software maturity and readiness for business deployment. |

---

## PART 9: FINAL DEFENSE VERDICT & EVALUATOR SCRIPT

When facing a capstone validation panel or external evaluation body, testing proceeds rapidly and demands precision. **Nothing should remain vague, unverified, or theoretically abstract.** 

If a capstone panel member or external evaluating IT Expert picks any survey question at random and demands:  
> **"Where in the system can I evaluate Question #X, how do I observe its feature, and why does this question belong here?"**

Researchers can immediately reply by citing the exact coordinates from this document using the definitive **4-Point Defense Response Structure**:
1. **Exact Page & Module:** State the precise tab name and software file component.
2. **Exact Observable Feature:** Name the visual button, table grid, badge, or calculation engine.
3. **Exact Verification Workflow:** Detail the rapid 2-step physical action required to see the feature in action.
4. **Academic & Engineering Rationale:** Connect the feature directly to the Research Problem, Specific Objectives, or ISO/IEC 25010 Software Quality attributes.

### Demonstration Examples for Defense Day:

#### Example A: Responding to an IT Expert Question on ISO 25010 Security #4 [S-4]
* **Panel Challenge:** *"Show me where in the system I can evaluate Security Question #4 regarding user activity accountability."*
* **Researcher Response Script:**  
  * *"Sir/Ma'am, you can evaluate Security Question #4 directly in the **Activity Tracker Module**, located under the **'Activity History'** navigation tab (`ActivityHistory.tsx`)."*
  * *"The observable feature is our automated **Audit Logging Engine**, which captures timestamped entries for every login, job creation, inventory restock, and status change."*
  * *"To verify it right now, please navigate to 'Job Orders', click the action menu on any active ticket, and move its status from 'On-Going' to 'For Release'. Then, switch to the 'Activity History' tab. You will immediately see a permanent audit log detailing your username, exact timestamp, and explicit state transformation: **'Order ID # status state changed from "on-going" to "for-release"'**, along with pre- and post-update data diffs."*
  * *"This question belongs here because our capstone Scope explicitly requires accountability and auditability, fulfilling ISO 25010 non-repudiation standards and protecting the shop from undocumented order modifications."*

#### Example B: Responding to a Panelist Question on TAM Usefulness #3 [PU-3] / Inventory Restocking
* **Panel Challenge:** *"Where can I evaluate Perceived Usefulness Question #3 regarding easier tracking of inventory and services?"*
* **Researcher Response Script:**  
  * *"Sir/Ma'am, you can evaluate that in the **Inventory Management Module**, located under the **'Inventory'** navigation tab (`Inventory.tsx` and `RestockModal.tsx`)."*
  * *"The observable feature is our automated **Whole-Product Restock & Container Conversion Engine**. Unlike basic POS systems that only show raw liquid mL, our system translates volume into physical shop containers (like `~1 JUG` of Cleaner or `~2 TUBS` of Conditioner)."*
  * *"To verify this, click the prominent bold **'RESTOCK'** button next to 'NEW ITEM' in the header. Select 'Bleach' and input a quantity of **1** Jug at ₱350, with the 'Record in Expenses' toggle switched ON. When you confirm, notice that inventory stock automatically increments by **+4,000 mL**, and if you switch to the **'Expenses'** tab, a clean 2-decimal financial record of **₱350.00** under 'Variable / Restock' has been automatically logged!"*
  * *"This belongs here because it solves our primary research problem of cumbersome manual calculation and unorganized supply tracking, fulfilling **Specific Objectives #1 and #3** while providing clean financial data to the business owner."*

#### Example C: Responding to a Panelist Question on ISO 25010 Safety #2 [SF-2] / Cancel Order & Refund Guidance
* **Panel Challenge:** *"How do I evaluate Safety Question #2 regarding warning messages before important actions are performed?"*
* **Researcher Response Script:**  
  * *"Sir/Ma'am, you can observe this safeguard across our **Job Order & Dashboard Modules** within any active transaction grid (`JobOrders.tsx` and `Dashboard.tsx`)."*
  * *"The observable feature is our bolded action typography paired with dedicated **Refund Policy Verification Warning Modals**."*
  * *"To verify it, click the action dropdown menu on any order. You will see that all action items (*Edit Order Detail*, *Undo to New Order*, *Update Stock Inventory*) are cleanly formatted in **bold font** for legibility. Notice that cancellation buttons are labeled simply as **'Cancel Order'**. Click **'Cancel Order'**, and notice that execution immediately halts! A dedicated warning modal materializes explaining the dynamic refund consequences (whether a refund is allowed for uncommenced works or prohibited for on-going tasks), requiring explicit user verification before any cancellation is committed."*
  * *"This question belongs here because it enforces ISO 25010 User Error Protection and UAT Safety, preventing shop technicians from accidentally terminating revenue-generating service contracts without understanding institutional refund rules."*

---
**FINAL DECLARATION:**  
The Shoelotskey Web-Based Service Management System with Data Analytics Using Machine Learning Algorithms is technically sound, methodologically aligned with its capstone research manuscript, and ready for official validation testing and defense presentation.

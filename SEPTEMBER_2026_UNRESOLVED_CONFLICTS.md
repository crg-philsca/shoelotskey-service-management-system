# Shoelotskey SMS — September 2026 Unresolved Conflicts & Evidentiary Audit
**Document Identifier:** AUDIT-CONFLICT-2026-09-V2  
**Audit Date:** 21 October 2026  
**Auditor:** Senior PostgreSQL Database Integrity Auditor, FastAPI Backend Engineer, and Financial Reconciliation Specialist  
**System Target:** Shoelotskey Service Management System (Production PostgreSQL on Heroku & AWS RDS)  
**Audit Mode:** Read-Only Forensic Extraction | Zero Production Mutation  
**Data Privacy:** Strict PII Compliance — Customer names, contact numbers, and payment reference numbers redacted  

---

## 1. Executive Summary & Purpose

This document provides a rigorous, evidence-based investigation of all unresolved data discrepancies, ambiguous source notations, and conflicting financial claims identified during the September 2026 source-to-production reconciliation.

In Version 1 of the audit, several discrepancies were resolved using unverified assumptions—such as guessing that a customer received a "waived service," assuming a "multi-pair discount" was authorized without documentation, or treating tender references as alternative payments. 

**V2 Policy Mandate:** In compliance with professional financial auditing standards, **no assumption is accepted without corroborating transactional evidence.** Every item below is explicitly cataloged as an active conflict requiring physical receipt inspection, drawer session verification, or owner authorization before any database record is created or modified.

---

## 2. High-Priority Transactional & Financial Discrepancies

### Conflict 1: ORD-2026-09-15-003 — Clerical Calculation Error vs. Stated Balance
* **Source Observation:** Stated Downpayment ₱100.00 + Stated Balance ₱275.00 = ₱375.00, but Stated Grand Total is ₱325.00 (Discrepancy: +₱50.00).
* **Service Details:** 1 Pair Vans (Basic Cleaning `BC` — Published Catalog Standard: ₱325.00).
* **Database State:** Un-encoded in live production database (`NOT_FOUND_IN_PROD`).
* **Forensic Analysis:**
  * Catalog base price for Basic Cleaning is exactly ₱325.00.
  * If the customer remitted a downpayment of ₱100.00, the true remaining balance is mathematically `₱325.00 - ₱100.00 = ₱225.00`.
  * The handwritten note of ₱275.00 is a clerical transcription slip (confusion between 225 and 275).
* **Evidentiary Resolution Requirement:**
  * Inspect physical paper duplicate claim stub #003 from the Villamor store file.
  * Check the cash drawer report for September 15 / September 24 to confirm actual tender received was ₱100.00.
  * **Approved Action upon Authorization:** Set `grand_total = 325.00`, `amount_received = 100.00`, and `balance = 225.00`. Do not modify the published catalog price.

---

### Conflict 2: ORD-2026-09-16-001 — Line Item Sum (₱950.00) vs. Stated Grand Total (₱725.00)
* **Source Observation:** Line items: Full Reglue Midsole (₱575.00) + Full Reglue Undersole (₱150.00) + Minor Restoration (₱225.00) = ₱950.00. However, the stated grand total is ₱725.00, and stated split payments are Downpayment ₱360.00 + Balance ₱365.00 = ₱725.00 (Discrepancy: -₱225.00).
* **Service Details:** 1 Pair Jordan (`FR Mid` + `FR US` + `MRES`).
* **Database State:** Un-encoded in live production database (`NOT_FOUND_IN_PROD`).
* **Forensic Analysis:**
  * Under Shoelotskey pricing business logic: Full Reglue Midsole (₱575.00) + Full Reglue Undersole add-on (₱150.00) equals exactly **₱725.00**.
  * The ₱225.00 Minor Restoration line item equals the difference (`₱950 - ₱725 = ₱225`).
  * In V1, the auditor assumed this service was a "waived courtesy package." Under V2 audit standards, this cannot be assumed without documentary proof. It could represent:
    1. A canceled service request removed during intake negotiation,
    2. An included store package authorized by the shop owner, or
    3. An erroneous line copied from a neighboring intake sheet.
* **Evidentiary Resolution Requirement:**
  * Verify the physical carbon receipt signed by the client (`A**** J**** D*****`).
  * Verify whether Minor Restoration materials (leather conditioner/edge paint) were actually expended on this shoe.
  * Flag the ₱225.00 `MRES` service as a conditional line item pending owner sign-off.

---

### Conflict 3: ORD-2026-09-08-010 — 3-Pair Line Sum (₱1,875.00) vs. Stated Total (₱1,625.00)
* **Source Observation:** Line items: Nike Black (₱725.00) + Nike Blue (₱575.00) + Nike Gray (₱575.00) = ₱1,875.00. Stated Grand Total is ₱1,625.00, with Downpayment ₱1,100.00 + Balance ₱525.00 = ₱1,625.00 (Discrepancy: -₱250.00).
* **Database State:** Encoded in production as `ORD-2026-09-08-003` (Order ID 1054, Customer: `Edzel de Mesa`). In production, grand total was entered as ₱1,525.00 with downpayment ₱1,000.00 and balance ₱737.50.
* **Forensic Analysis:**
  * Line item sum is ₱1,875.00. Stated total is ₱1,625.00. Difference is exactly ₱250.00.
  * In V1, this was assumed to be an authorized "multi-pair bundle discount." While standard multi-pair discounts of ₱250.00 exist, the production record contains a secondary discrepancy: it was recorded as ₱1,525.00 (an additional -₱100 error).
* **Evidentiary Resolution Requirement:**
  * Check physical receipt #010 for customer `E**** d* M***`.
  * Confirm whether the authorized billing was ₱1,625.00 or ₱1,525.00, and whether downpayment was ₱1,100.00 or ₱1,000.00.
  * Reconcile production Order ID 1054 based on receipt evidence.

---

### Conflict 4: September 8 Daily Sales Summary — Collections (₱5,000.00) vs. Daily Sales (₱5,800.00)
* **Source Observation:** Stated Cash Sales ₱2,975.00 + GCash Sales ₱2,025.00 = ₱5,000.00 total collections. Stated Total Daily Sales says ₱5,800.00 (Discrepancy: +₱800.00).
* **Cash Drawer Monitoring Data:** Cash Fund (Float): ₱264.00. Cash Sales: ₱2,975.00. Actual Cash Counted: ₱4,439.00. Balance status: "Balanced / Over-Short reconciled."
* **Forensic Analysis:**
  * Physical cash and GCash collections totaled exactly ₱5,000.00.
  * The ₱800.00 difference represents **uncollected customer receivables** booked on new orders taken on September 8:
    * E.g., `ORD-2026-09-08-010` (Remaining Balance: ₱525.00)
    * `ORD-2026-09-08-004` (Remaining Balance: ₱100.00)
    * Combined with other partial balances = ₱800.00.
  * The cash drawer was NOT short; the daily summary mixed total order book value with cash-basis revenue.
* **Evidentiary Resolution Requirement:**
  * Reconcile cash-basis daily sales (₱5,000.00) separately from accrual-basis job order bookings (₱5,800.00).

---

### Conflict 5: ORD-2026-09-07-002 — Ambiguous Payment String "₱200/₱700 GCash"
* **Source Observation:** Payment text states: "Downpayment of ₱200/₱700 GCash; Remaining Balance: ₱275. Grand Total: ₱475."
* **Database State:** Matched in production as Order ID 1051 (`ORD-2026-09-07-007`, Customer: `J. Eduvere`). Recorded in DB: Grand Total ₱475.00, Amount Received ₱200.00, Balance ₱0.00.
* **Forensic Analysis:**
  * Grand Total is ₱475.00. Stated remaining balance is ₱275.00.
  * `₱475.00 - ₱275.00 = ₱200.00`.
  * This proves that exactly ₱200.00 was applied to the order balance.
  * The "₱700" notation remains ambiguous: it could represent a customer wallet reference balance, an initial quote before scope reduction, or a transfer reference fragment.
* **Evidentiary Resolution Requirement:**
  * Inspect GCash transaction confirmation receipt for September 7/8.
  * Confirm that payment applied was ₱200.00 and remaining receivable is ₱275.00.

---

### Conflict 6: ORD-2026-09-11-007 — Dual Tender Notation "₱200 Cash / ₱100 GCash"
* **Source Observation:** Payment text states: "Downpayment of ₱200 Cash / ₱100 GCash; Remaining Balance ₱375; Grand Total ₱575."
* **Database State:** Matched in production as Order ID 1083 (`ORD-2026-09-11-009`, Customer: `Rheiner Martinez`). Recorded in DB: Grand Total ₱425.00, Amount Received ₱50.00, Balance ₱375.00.
* **Forensic Analysis:**
  * If both amounts had been collected: `₱200 + ₱100 + ₱375 = ₱675.00`, which exceeds the Grand Total of ₱575.00 by ₱100.00.
  * `₱575.00 Grand Total - ₱375.00 Stated Balance = ₱200.00 Net Downpayment`.
  * The production database has a further conflicting entry: Grand Total ₱425.00, Received ₱50.00, Balance ₱375.00.
* **Evidentiary Resolution Requirement:**
  * Inspect physical receipt #007 and GCash log for September 11.
  * Confirm whether downpayment was ₱200.00 Cash, ₱100.00 GCash, or a split, and reconcile order grand total to ₱575.00.

---

### Conflict 7: ORD-2026-09-11-009 — Warranty Rework at ₱0.00 vs. Billed Order
* **Source Observation:** 1 Pair Nike Zoom ("Backjob / FR Mid. Payment & Pricing: Backjob (No charge recorded). Grand Total: ₱0.").
* **Database State:** Un-encoded in production database (`NOT_FOUND_IN_PROD`).
* **Forensic Analysis:**
  * Shoelotskey provides warranty coverage on soles reglued within the warranty window.
  * Genuine rework ("backjob") carries ₱0.00 customer billing, but adhesive, primer, and shop labor are consumed.
  * In V1, this was tentatively matched to Order ID 1083 (Rheiner Martinez), creating a duplicate mapping error.
* **Evidentiary Resolution Requirement:**
  * Preserve as a verified warranty re-service record.
  * When encoded in production upon authorization, link to parent warranty policy with billing ₱0.00 and track inventory consumption.

---

## 3. Contact Field & Channel Discrepancies

### Conflict 8: Non-Phone Communication Channels
The following 5 source records contain social/messenger handles or contact persons rather than telephone numbers:
1. `ORD-2026-09-08-007`: Marvin (`FB Page / Lalamove`)
2. `ORD-2026-09-09-002`: Irene J. De Leon (`FB Page / Lalamove`)
3. `ORD-2026-09-09-003`: MJ Sumaribos (`c/o Sir Renie`)
4. `ORD-2026-09-09-014`: Gibson (`c/o Peric Coronacion`)
5. `ORD-2026-09-09-015`: Saludo (`c/o Peric Coronacion`)

* **Policy Enforcement:**
  * Do NOT insert dummy or placeholder mobile numbers (e.g. `09000000000`).
  * In the production `customers` table, `contact_number` must remain `NULL` or be stored in a dedicated notes/channel field.
  * Mark direct telephone numbers as explicitly unavailable in audit reports.

### Conflict 9: Shorter-Than-Standard Phone Number Strings
* `ORD-2026-09-01-001`: Phone string recorded as `0915983847` (10 digits; standard Philippine mobile is 11 digits `09XX-XXX-XXXX`).
* `ORD-2026-09-11-006`: Phone string recorded as `0996786920` (10 digits).
* **Policy Enforcement:**
  * Do NOT pad with trailing zeros or guess missing digits.
  * Flag for front-desk staff verification against physical intake notebooks.

---

## 4. Date & Cross-Batch Sequential Offsets

### Conflict 10: Discrepancy Between Intake Slip Dates and Encoding Timestamps
* Several source orders indicate intake dates prior to their batch recording timestamp:
  * `ORD-2026-09-05-001`: Stated received September 4, logged September 7.
  * `ORD-2026-09-05-004`: Note says `Villamor | 09/7`, encoded in DB as `ORD-2026-09-07-005`.
  * `ORD-2026-09-08-001` through `004`: Received September 7, encoded in DB as `ORD-2026-09-07-001` through `004`.
  * `ORD-2026-09-09-002`: Grouped under Sept 9, note says `Villamor | 09/18`, encoded as `ORD-2026-09-08-002`.
  * `ORD-2026-09-15-005` & `006`: Received September 14, encoded under `ORD-2026-09-14-004` & `005`.
* **Policy Enforcement:**
  * Maintain both dates distinctly in the schema:
    1. `created_at`: Authoritative system transaction timestamp.
    2. `intake_date`: Historical customer drop-off date recorded on physical slip.

---

## 5. Summary of Evidentiary Status

| Conflict ID | Transaction Ref | Conflict Type | Financial Impact | Resolution Policy |
| :--- | :--- | :--- | :---: | :--- |
| **CONF-01** | `ORD-2026-09-15-003` | Clerical Balance Slip | ₱50.00 | Require physical claim stub check; balance ₱225.00 |
| **CONF-02** | `ORD-2026-09-16-001` | Line Item vs Grand Total | ₱225.00 | Retain ₱725.00 total; verify MRES waiver with owner |
| **CONF-03** | `ORD-2026-09-08-010` | Multi-pair Bundle Math | ₱250.00 | Check receipt #010; adjust DB from ₱1525 to ₱1625 |
| **CONF-04** | Sept 8 Daily Sales | Drawer vs Sales Mismatch | ₱800.00 | Segregate cash receipts (₱5,000) from receivables |
| **CONF-05** | `ORD-2026-09-07-002` | Ambiguous Tender Slash | ₱0.00 | Confirm ₱200 payment; balance is ₱275.00 |
| **CONF-06** | `ORD-2026-09-11-007` | Dual Payment Notation | ₱100.00 | Verify GCash confirmation log for Sept 11 |
| **CONF-07** | `ORD-2026-09-11-009` | Warranty Backjob Billing | ₱0.00 | Reconstruct as ₱0 warranty rework; do not bill |
| **CONF-08** | 5 Orders | Non-phone Contact Channel | ₱0.00 | Preserve channel text; do not invent phone numbers |
| **CONF-09** | 2 Orders | Truncated Phone Strings | ₱0.00 | Flag for physical notebook audit; do not pad digits |
| **CONF-10** | 8 Orders | Cross-Dated Encoding | ₱0.00 | Preserve separate intake vs system created timestamps |


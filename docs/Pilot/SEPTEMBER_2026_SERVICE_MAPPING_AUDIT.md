# Shoelotskey SMS — September 2026 Service Mapping & Catalog Relationship Audit
**Document Identifier:** AUDIT-SRV-2026-09-MAP  
**Audit Date:** October 21, 2026  
**Auditor:** Senior PostgreSQL Data Integrity Engineer & FastAPI Backend Developer  
**Scope:** Service Junction Mapping Integrity (`items`, `item_service_mapping`, `services`, `service_categories`)  
**Compliance Standard:** 3NF Database Relational Normalization | Multi-Item Separation of Concerns  
**Privacy Status:** PII Redacted (Customer names, phone numbers masked)

---

## 1. Executive Summary & Audit Scope

The Shoelotskey Service Management System employs a normalized 3NF schema where each job order (`orders`) can contain multiple physical shoes (`items`), and each shoe item is linked to one or more services via the `item_service_mapping` junction table with historical price snapshotting (`actual_price`).

This audit inspected:
1. **Catalog Abbreviation Translation:** Mapping colloquial and handwritten shop notations to authoritative production service IDs.
2. **The "Hollow Orders" Defect:** 47 orders in production imported via legacy batch routines that contain valid header financial records but zero attached `items` and zero `item_service_mapping` entries.
3. **Dual-Sole Pricing Business Logic:** Auditing combinations of Full Reglue Midsole (`FR Mid`) and Undersole (`FR US`).
4. **Color Renewal & Add-on Rules:** Validating pricing for 2 Colors vs 3 Colors and accompanying add-ons (Unyellowing, White Paint).
5. **Warranty Re-work Integrity:** Validating ₱0.00 backjob records.

---

## 2. Authoritative Service Catalog & Abbreviation Concordance

The table below establishes the authoritative mapping between intake shorthand notations and the production relational catalog:

| Shorthand / Notation | Production Service Name | Category | Base Catalog Price | Documented Business Logic & Rules |
| :---: | :--- | :---: | :---: | :--- |
| **BC** | Basic Cleaning | Base | ₱325.00 | Standard deep upper and outsole cleaning. Prerequisite for reglue and repainting. |
| **MR** | Minor Reglue | Base | ₱125.00 / ₱450.00 | Spot reglue for partial separation (toe cap, heel tab). Standalone job orders without cleaning bill at ₱450.00 minimum repair floor. |
| **FR** | Full Reglue | Base | ₱250.00 / ₱575.00 | Full sole de-bonding, surface cleaning, priming, and industrial adhesive curing. Complete service with cleaning bills at ₱575.00. |
| **FR Mid** | Full Reglue Midsole | Add-on / Loc | ₱150.00 / ₱575.00 | Full reglue localized to midsole layer. When chosen as primary, bills at ₱575.00. |
| **FR US** | Full Reglue Undersole | Add-on / Loc | ₱150.00 / ₱575.00 | Full reglue localized to outsole/undersole traction layer. |
| **FR Mid + FR US** | Dual-Sole Full Reglue | Base + Addon | **₱725.00** | Primary sole reglue (₱575.00) + secondary sole layer add-on (₱150.00). Total is exactly ₱725.00. |
| **MRES** | Minor Restoration | Base | ₱225.00 / ₱550.00 | Touch-up restoration, edge smoothing, minor leather reconditioning. Standalone package bills at ₱550.00. |
| **UNY** | Unyellowing | Add-on | ₱125.00 | Chemical oxidation reversal for yellowed rubber midsoles (hydrogen peroxide / UV treatment). |
| **WP** | White Paint | Add-on | ₱150.00 / ₱200.00 | Sole edge and upper paint touch-up. Standard ₱150.00; complex / double coat bills at ₱200.00. |
| **CR / Color Renewal** | Color Renewal | Base / Addon | ₱375.00 / ₱475.00 | Full color re-dye/re-paint. Option 1: 2 Colors = ₱375.00. Option 2: 3 Colors = ₱475.00. |
| **Push / Rush** | Rush Priority Fee | Priority | ₱150.00 | Expedited 24-to-48-hour turn-around surcharge. |
| **MK** | Minor Knit / Knee repair | Base / Custom | ₱450.00 | Upper fabric re-stitching and woven knit tear repair (e.g., Skechers knit runners). |
| **PR** | Premium Restoration | Base / Custom | ₱575.00 | Full material conditioning, deep cleaning, and localized re-pigmentation. |
| **Kush** | Cushioning / Insole repair | Add-on / Custom | ₱150.00 | Insole foam padding replacement or heel collar foam insert. |
| **Color Pen** | Detail Pen Retouch | Add-on / Custom | ₱375.00 | Fine-tip acrylic paint pen detailing on logo emblems and stitching lines. |
| **Limro** | Leather / Midsole Re-oil | Base / Custom | ₱575.00 | Specialized cleaning and leather nourishment treatment. |

---

## 3. Analysis of the "Hollow Orders" Defect in Production

### Root Cause Identification:
Forensic analysis of the production database revealed that out of 68 September orders:
* **21 orders** have complete shoe items and service junctions mapped in `items` and `item_service_mapping`.
* **47 orders** are **hollow records** (`items` count = 0, `item_service_mapping` count = 0).

These 47 hollow orders share a common audit signature:
1. `payments.reference_no` contains the pattern `BATCH-HIST-SEP2026-001-PAY-XXX`.
2. `orders.grand_total` and `orders.created_at` are populated correctly.
3. The migration script that executed `BATCH-HIST-SEP2026-001` failed to iterate through the nested `shoes` array in the intake payload, committing the parent order without inserting child item records.

### Sample Hollow Orders Requiring Item Reconstruction:

| Production Order ID | Order Number | Customer (Redacted) | Billed Amount | Source Shoe & Service Specification | Reconstruction Action Required |
| :---: | :---: | :---: | :---: | :--- | :--- |
| **1045** | ORD-2026-09-07-001 | B** C***** | ₱2,100.00 | 5 Pairs: Gucci (FR - ₱575), Clarks (BC - ₱325), Nike 6 (BC - ₱325), Nike 8 (BC - ₱325), Nike Brown (MRES - ₱550) | Insert 5 rows into `items`, insert 5 rows into `item_service_mapping` |
| **1046** | ORD-2026-09-07-002 | A******** G**** | ₱1,650.00 | 3 Pairs: Nike AF1 (MRES - ₱550), Nike SB (MRES - ₱550), Nike Renew (MRES - ₱550) | Insert 3 rows into `items`, insert 3 rows into `item_service_mapping` |
| **1047** | ORD-2026-09-07-003 | K*** G**** | ₱550.00 | 1 Pair: Lacoste (MRES - ₱550) | Insert 1 row into `items`, insert 1 row into `item_service_mapping` |
| **1048** | ORD-2026-09-07-004 | C*** | ₱325.00 | 1 Pair: Nike (BC - ₱325) | Insert 1 row into `items`, insert 1 row into `item_service_mapping` |
| **1050** | ORD-2026-09-07-006 | Z**** E**** | ₱1,200.00 | 3 Pairs: New Balance (MRES - ₱550), Merrell (MRES - ₱550), Hoka (MRES - ₱550) | Insert 3 rows into `items`, insert 3 rows into `item_service_mapping` |
| **1054** | ORD-2026-09-08-003 | E**** d* M*** | ₱1,525.00 | 3 Pairs: Nike Black (FR Mid+US - ₱725), Nike Blue (FR US - ₱575), Nike Gray (FR - ₱575) | Insert 3 rows into `items`, insert 4 rows into `item_service_mapping` |
| **1055** | ORD-2026-09-08-004 | D***** C****** | ₱1,250.00 | 2 Pairs: Converse (MRES Rush - ₱700), On Cloud (MRES - ₱550) | Insert 2 rows into `items`, insert 3 rows into `item_service_mapping` |
| **1063** | ORD-2026-09-09-005 | C**** P******* | ₱3,275.00 | 8 Pairs: MK, NB, Lacoste x2, Converse, On Cloud, NB, MK (5x BC @ ₱325, 3x MRES @ ₱550) | Insert 8 rows into `items`, insert 8 rows into `item_service_mapping` |
| **1069** | ORD-2026-09-09-011 | G***** | ₱3,125.00 | 4 Pairs: Nike Yellow (FR Premium - ₱1500), Anta (BC - ₱325), Nike (FR Mid+US - ₱725), Nike YG (FR - ₱575) | Insert 4 rows into `items`, insert 5 rows into `item_service_mapping` |
| **1086** | ORD-2026-09-12-002 | L***** A****** | ₱2,610.00 | 5 Pairs: Vomero (FR US - ₱575), Puma (FR Mid - ₱575), Vans (FR Mid - ₱575), NBA (BC - ₱325), XStep (MRES - ₱550) | Insert 5 rows into `items`, insert 5 rows into `item_service_mapping` |
| **1096** | ORD-2026-09-14-010 | K****** G********* | ₱2,900.00 | 6 Pairs: 2x Adidas (BC @ ₱325), 2x Nike (MRES @ ₱550), Adidas White (FR US - ₱575), Nike Black (FR Mid - ₱575) | Insert 6 rows into `items`, insert 6 rows into `item_service_mapping` |

---

## 4. Multi-Pair Association & Attribution Rules

A critical finding in pilot quality assurance is avoiding **global service duplication across multi-shoe orders**. 

When an order contains multiple pairs with distinct requirements, the relational schema must attach services to the specific `item_id` rather than broadcasting services across all shoes in the order:

* **Example 1: ORD-2026-09-08-004 / ID 1045 (5 Pairs, ₱2,100.00 total)**
  * Shoe 1: Gucci -> `Full Reglue` (₱575.00)
  * Shoe 2: Clarks -> `Basic Cleaning` (₱325.00)
  * Shoe 3: Nike Size 6 -> `Basic Cleaning` (₱325.00)
  * Shoe 4: Nike Size 8 -> `Basic Cleaning` (₱325.00)
  * Shoe 5: Nike Brown -> `Minor Restoration` (₱550.00)
  * *Audit Rule:* Never assign all 3 service types (`FR`, `BC`, `MRES`) to all 5 items. The sum of item actual prices must equal `₱575 + ₱325 + ₱325 + ₱325 + ₱550 = ₱2,100.00`.

* **Example 2: ORD-2026-09-04-003 (1 Pair, Multi-Service, ₱850.00 total)**
  * Shoe 1: Converse -> `Full Reglue Midsole` (₱575.00) + `Full Reglue Undersole` (₱150.00) + `Unyellowing` (₱125.00) = **₱850.00**.
  * *Audit Rule:* 3 junction records attached to single `item_id`.

---

## 5. Backjobs, Warranties, and Complimentary Services

### Case: ORD-2026-09-11-009 (Nike Zoom — Backjob / FR Mid — Grand Total: ₱0.00)
* **Integrity Validation:** 
  * The production schema enforces `grand_total >= 0`. A value of `0.00` is syntactically and legally valid.
  * In the service mapping, `item_service_mapping.actual_price` must be stored as `0.00` with notes indicating `Warranty Rework - Adhesion Failure within 30-day window`.
  * The system must record chemical/glue consumption in `material_consumptions` and `inventory_logs` to maintain accurate physical supply balances even when customer billing is ₱0.00.

---

## 6. Recommendations for Database Remediation

1. **Reconstruct Hollow Records via Idempotent Script:** Execute a prepared migration that populates the 47 hollow orders with their itemized shoe records and `item_service_mapping` rows based on the intake transcription evidence.
2. **Lock Price Snapshots:** Guarantee that `actual_price` reflects the pricing at order date, preserving multi-pair discounts and included sole rules.
3. **Audit Trail Verification:** Ensure each reconstructed item and service mapping logs a forensic entry in `audit_logs` under module `Job Orders` with action `RECONCILE_ITEM_SERVICE`.

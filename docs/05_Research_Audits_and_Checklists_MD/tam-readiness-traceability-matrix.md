# TAM Readiness Traceability Matrix (20)

**Date:** 2026-09-09  
**Instrument:** Frozen Capstone TAM — **PU, PEOU, BI, ASU** × 5 = **20 statements**  
**Formal respondents:** Owner + 2 Staff (**NOT started**)  
**This matrix:** System **readiness** for those statements to be evaluated — **not** acceptance scores  
**Attitude Toward Using:** **not** in the approved instrument — do not invent  

---

## Perceived Usefulness (PU)

| ID | Exact statement | Supporting workflow / screens | Readiness |
|----|-----------------|-------------------------------|-----------|
| PU-1 | The system helps complete work more quickly. | Dashboard, Job Order Form, Calendar | **READY** |
| PU-2 | The system makes it easier to manage customer records and job orders. | Job Order + customer capture | **READY** |
| PU-3 | The system helps track services and inventory more quickly. | Service Management + Inventory | **READY** |
| PU-4 | The system provides useful information for monitoring sales and shop performance. | Dashboard + Sales Report | **READY** |
| PU-5 | The system reduces the need for paperwork and manual record-keeping. | Digital JO / claim / sales; OCR for archives | **READY** |

## Perceived Ease of Use (PEOU)

| ID | Exact statement | Supporting workflow / screens | Readiness |
|----|-----------------|-------------------------------|-----------|
| PEOU-1 | The menus, buttons, and labels are easy to understand. | Layout sidebar / labeled actions | **PARTIAL** (respondent + responsive) |
| PEOU-2 | The system is easy to learn. | Role menus / guided forms | **PARTIAL** (perception) |
| PEOU-3 | Adding and updating records in the system is easy. | CRUD modals/forms | **READY** |
| PEOU-4 | Information in the system is easy to find. | Search/filters across modules | **PARTIAL** |
| PEOU-5 | The system is easy to use. | End-to-end ops | **PARTIAL** (perception) |

## Behavioral Intention (BI)

| ID | Exact statement | Supporting workflow | Readiness |
|----|-----------------|---------------------|-----------|
| BI-1 | The system is worth using for daily work. | Daily ops path exists | **READY** (workflow only) |
| BI-2 | The system should be used as the main system in the shop. | Ops coverage | **READY** (workflow only) |
| BI-3 | The system is worth recommending to other staff. | Staff workflows | **READY** (workflow only) |
| BI-4 | The system is better than the previous way of managing shop work. | Digitized vs paper | **READY** (workflow only) |
| BI-5 | The system should continue to be used at Shoelotskey. | Continuity path | **READY** (workflow only) |

> BI items are **respondent judgments**. Code readiness ≠ “pass.”

## Actual System Use (ASU)

| ID | Exact statement | Supporting workflow | Readiness |
|----|-----------------|---------------------|-----------|
| ASU-1 | The system is used during work tasks. | Ops modules capable | **PARTIAL** (frequency unmeasured) |
| ASU-2 | The system is used to record and manage customer job orders. | Job Order module | **READY** |
| ASU-3 | The system is used to check inventory, service status, and reports. | Inventory / Dashboard / Sales | **READY** |
| ASU-4 | Work is completed using the system instead of paper records. | Digital JO; paper still OCR source | **PARTIAL** |
| ASU-5 | The system is used regularly in shop operations. | Production app live | **PARTIAL** (regularity NOT VERIFIED) |

---

## Role mapping for TAM evaluation

| Role | Evaluate |
|------|----------|
| **Owner** | Operational system + Job Order + Business Rules date + **advisory** ML prediction |
| **Staff** (×2) | Permitted operational workflows only |
| **Admin** | Not a TAM end-user construct for shop acceptance; Admin evaluates Historical/OCR/ML tooling separately if needed |

---

## Counts (readiness only)

| Status | Count |
|--------|------:|
| READY | **13** |
| PARTIAL | **7** |
| NOT VERIFIED | **0** |
| **Total** | **20** |

**TAM acceptance scoring:** NOT STARTED — Owner + 2 Staff after secured production smoke.

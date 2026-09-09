# Demo live job orders snapshot

**Taken:** 9 September 2026 (local SQLite `backend/db/shoelotskey.db`)

Use this list at client turnover to remove **demo / testing job orders** without touching **historical (paper/OCR) records**.

Nothing in this file has been deleted. It is an inventory only.

## Keep vs remove

| Keep (do not wipe) | Remove at turnover (demo / live testing) |
| --- | --- |
| `historical_orders` — **738** paper/OCR records | `orders` — **63** live job orders listed below |
| `historical_items`, `historical_item_services`, `historical_predictions` | Related live rows: `items` (66), `payments` (63), `deliveries`, `status_log` |
| `historical_images` — **725** | Demo **expenses** (7 rows) if the client should start with a clean expense log |
| Historical OCR review queue / validation status | Live-only **customers** created for these 63 orders (**57** customer rows; **none** are also used by historical orders) |

Live job orders live in `orders`. Historical records live in `historical_orders`. They are not the same table. No live `order_number` overlaps a historical `order_id`.

Do **not** truncate `customers` as a whole. Historical orders also use that table (352 customers total). Only the 57 live-only customers below are safe to drop **after** the 63 live orders are gone.

Inventory stock may have been reduced by demo job orders and restocks. After deleting live orders, review inventory quantities separately; do not assume stock will reset itself.

## Live job order counts by status

| Status | Count |
| --- | ---: |
| new-order | 26 |
| on-going | 15 |
| for-release | 14 |
| claimed | 8 |
| **Total** | **63** |

Date span of these live orders: **17 March 2026 – 31 August 2026**.

## All 63 live job orders (safe to delete at turnover)

Database `order_id` | Order number | Customer | Status | Total | Created
--- | --- | --- | --- | ---: | ---
34 | ORD-2026-03-17-001 | John Doe | new-order | 450 | 2026-03-18
35 | ORD-2026-03-18-001 | Kylane | new-order | 325 | 2026-03-18
36 | ORD-2026-03-18-002 | Kylane Gravino | new-order | 575 | 2026-03-18
100 | ORD-2026-03-26-001 | Kylane Gravino | claimed | 450 | 2026-03-26
133 | ORD-2026-03-26-002 | Melody Sedanto | on-going | 450 | 2026-03-26
134 | ORD-2026-03-26-003 | Charmaine Angeles | new-order | 475 | 2026-03-26
135 | ORD-2026-03-26-004 | Kylane Angeles | new-order | 450 | 2026-03-26
166 | ORD-2026-04-07-001 | Charmaine Angeles | on-going | 325 | 2026-04-14
206 | ORD-2026-04-14-001 | Melody Sedanto | for-release | 600 | 2026-04-14
207 | ORD-2026-04-14-002 | Kylane Gravino | for-release | 725 | 2026-04-14
208 | ORD-2026-04-14-003 | Fhionna Faduga | on-going | 475 | 2026-04-14
209 | ORD-2026-04-14-004 | Vince Gipaya | new-order | 675 | 2026-04-14
232 | ORD-2026-04-22-001 | Sarah Mendez | new-order | 600 | 2026-04-22
233 | ORD-2026-04-22-002 | Sarah Mendez | new-order | 725 | 2026-04-21
234 | ORD-2026-04-22-003 | Kylane Gravino | new-order | 450 | 2026-04-21
562 | ORD-2026-07-06-001 | John Doe | new-order | 475 | 2026-07-05
563 | ORD-2026-07-06-002 | Charmaine Angeles | new-order | 1100 | 2026-07-06
564 | ORD-2026-07-06-003 | Kylane Gravino | new-order | 325 | 2026-07-06
565 | ORD-2026-07-06-004 | Melody Sedanto | new-order | 600 | 2026-07-06
595 | ORD-2026-07-06-005 | Kailane | on-going | 800 | 2026-07-06
596 | ORD-2026-07-06-006 | Grav | on-going | 575 | 2026-07-06
597 | ORD-2026-07-06-007 | Elaboo | for-release | 700 | 2026-07-06
598 | ORD-2026-07-06-008 | Bens | for-release | 325 | 2026-07-06
599 | ORD-2026-07-06-009 | Cham | claimed | 475 | 2026-07-06
600 | ORD-2026-07-06-010 | Enalyk | new-order | 550 | 2026-07-06
601 | ORD-2026-07-06-011 | Joy Dalipe | new-order | 575 | 2026-07-06
602 | ORD-2026-07-06-012 | Vincent | new-order | 575 | 2026-07-06
603 | ORD-2026-07-16-001 | Gravino Ky | new-order | 325 | 2026-07-16
604 | ORD-2026-07-16-002 | Melodee | on-going | 900 | 2026-07-16
628 | ORD-2026-07-30-001 | Ramil Dela Cruz | claimed | 450 | 2026-07-30
629 | ORD-2026-07-30-002 | Sarah Mendez | claimed | 475 | 2026-07-30
633 | ORD-2026-07-30-003 | John Doe | for-release | 325 | 2026-07-30
634 | ORD-2026-07-30-004 | Ky Gravino | for-release | 775 | 2026-07-30
635 | ORD-2026-07-30-005 | Cham Angeles | on-going | 325 | 2026-07-30
636 | ORD-2026-07-30-006 | Melodee Sedanto | for-release | 575 | 2026-07-30
637 | ORD-2026-07-30-007 | Ela Joy Villanueva | on-going | 325 | 2026-07-30
638 | ORD-2026-07-30-008 | Vincent Gipaya | for-release | 575 | 2026-07-30
639 | ORD-2026-07-30-009 | Fhio Faduga | for-release | 325 | 2026-07-30
640 | ORD-2026-07-30-010 | Maria Elena | new-order | 325 | 2026-07-30
641 | ORD-2026-07-30-011 | Christine Reyes | new-order | 325 | 2026-07-30
642 | ORD-2026-07-30-012 | Erick | new-order | 325 | 2026-07-30
643 | ORD-2026-07-30-013 | KY | new-order | 325 | 2026-07-30
661 | ORD-2026-07-31-001 | Ela | on-going | 625 | 2026-07-31
694 | ORD-2026-08-04-001 | Tricia | for-release | 450 | 2026-08-04
695 | ORD-2026-08-04-002 | Lhet Ambay | for-release | 325 | 2026-08-04
696 | ORD-2026-08-04-003 | Louis Andre | on-going | 575 | 2026-08-04
697 | ORD-2026-08-04-004 | Menx Lopes | claimed | 475 | 2026-08-04
727 | ORD-2026-08-11-001 | Alyssa Nerro | new-order | 325 | 2026-08-11
728 | ORD-2026-08-12-001 | Kysho | claimed | 325 | 2026-08-12
729 | ORD-2026-08-12-002 | Shenmae Narvaez | for-release | 450 | 2026-08-12
730 | ORD-2026-08-12-003 | Shawn Micheal | on-going | 325 | 2026-08-12
731 | ORD-2026-08-12-004 | Kaye Villanueva | on-going | 325 | 2026-08-12
732 | ORD-2026-08-12-005 | Judy Anne Santosi | new-order | 325 | 2026-08-12
733 | ORD-2026-08-12-006 | Anthony Marques | new-order | 450 | 2026-08-12
760 | ORD-2026-08-17-001 | Emmaunel Pascua | claimed | 325 | 2026-08-17
761 | ORD-2026-08-17-002 | Keysi Pearl | for-release | 450 | 2026-08-17
762 | ORD-2026-08-17-003 | Chin Angeles | on-going | 325 | 2026-08-17
763 | ORD-2026-08-17-004 | Georgette Mico | new-order | 450 | 2026-08-17
793 | ORD-2026-08-31-001 | Ela Boo | claimed | 325 | 2026-08-31
794 | ORD-2026-08-31-002 | Nica Jane | on-going | 325 | 2026-08-31
795 | ORD-2026-08-31-003 | Steven John Macaraeg | for-release | 325 | 2026-08-31
796 | ORD-2026-08-31-004 | Alexa Marie Dizon | on-going | 325 | 2026-08-31
797 | ORD-2026-08-31-005 | Keyshia Cole | new-order | 900 | 2026-08-31

Order numbers only:

`ORD-2026-03-17-001` through `ORD-2026-03-18-002`, `ORD-2026-03-26-001`–`004`, `ORD-2026-04-07-001`, `ORD-2026-04-14-001`–`004`, `ORD-2026-04-22-001`–`003`, `ORD-2026-07-06-001`–`012`, `ORD-2026-07-16-001`–`002`, `ORD-2026-07-30-001`–`013`, `ORD-2026-07-31-001`, `ORD-2026-08-04-001`–`004`, `ORD-2026-08-11-001`, `ORD-2026-08-12-001`–`006`, `ORD-2026-08-17-001`–`004`, `ORD-2026-08-31-001`–`005`.

Internal `order_id` values: 34, 35, 36, 100, 133–135, 166, 206–209, 232–234, 562–565, 595–604, 628–629, 633–643, 661, 694–697, 727–733, 760–763, 793–797.

## Historical data (must remain)

- **738** historical orders (`historical_orders`)
- **825** historical items
- **725** historical images
- OCR status at snapshot: 720 pending review, 17 validated, 1 corrected

Any job order created **after this snapshot** is not on the list above. Recapture live `orders` before a real wipe so new demo work is included and real client work is not.

## Demo expenses (optional wipe with live orders)

expense_id | Date | Amount | Description
--- | --- | ---: | ---
1 | 2026-03-26 | 250 | Lunch
34 | 2026-04-14 | 300 | Food (Daily) / Lunch
72 | 2026-07-30 | 250 | Food / Lunch
102 | 2026-08-01 | 480 | Restock: Stain Remover (+1 jug)
103 | 2026-08-01 | 480 | Restock: Stain Remover (+1 jug)
133 | 2026-08-12 | 200 | Food / Lunch
134 | 2026-09-09 | 300 | Restock: Shoe Laces (+2 Pcs)

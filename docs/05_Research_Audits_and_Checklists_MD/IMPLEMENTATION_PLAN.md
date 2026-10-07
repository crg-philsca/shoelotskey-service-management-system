# Project Implementation Plan & Architectural Guidelines

This document details the architectural decisions, component structure, and implementation guidelines for the Shoelotskey Service Management System.

---

## 1. Dual Turnaround System Architecture

The system uses a **two-tier turnaround estimation model**:

1. **Shoelotskey Business Rules Engine (Authoritative)**:
   - Evaluated synchronously on both frontend (`src/app/lib/businessRules.ts`) and backend (`backend/ml/business_rules.py`).
   - Determines the official customer-facing release date and promised completion turnaround.
   - **Concurrency Rule**:
     - Workshop restorative base services (such as `Minor Reglue` [25 days], `Major Reglue` [25 days], `Color Renewal` [25 days], `Leather Restoration` [25 days]) are handled concurrently on the technician bench.
     - $\text{Base Days} = \max(\text{Base Services})$, which standardizes to 25 days for restorative pairs.
     - Add-on services (e.g. `Unyellowing` [5 days]) are performed in sequence after base restoration.
     - $\text{Official Turnaround Days} = \max(\text{Base Services}) + \sum(\text{Add-On Services}) - \text{Rush Reduction}$.
   - **Guarantees**:
     - Base restorative combinations (e.g., `Minor Reglue` + `Color Renewal`) NEVER evaluate to 50 days; they evaluate to 25 days (or 30 days if paired with `Unyellowing`).

2. **Machine Learning Random Forest Model (Advisory)**:
   - Trained on historical job orders (`backend/ml/models/rf_model.joblib`).
   - Takes shoe characteristics, material condition, service mix, technician workload, and historical completion times into account to output an advisory duration estimate.
   - **Loading & State Rules**:
     - During model inference, UI must NEVER show placeholder values or stuck numbers (e.g., stuck `ML: 10 days 🔄`).
     - In `OrderDetailModal.tsx`, `if (predictionLoading)` takes strict precedence, rendering an animated `Loader2` spinner.
     - In `JobOrderForm.tsx`, the ML Prediction Details dialog renders `Calculating…` and spinners for both `Predicted Duration` and `Predicted Release Date` alongside `Model Status`.
   - **Performance Optimization**:
     - Because the backend connects to an AWS RDS PostgreSQL instance in `us-east-1` (~300ms roundtrip per query from local environments), sequential catalog lookups are shielded with an in-memory cache:
       - `_CATALOG_CACHE`: 5-minute TTL cache of all services and conditions.
       - Token cache: 120-second TTL in `backend/auth_utils.py`.
       - Payload memoization: `_PREDICT_MEMO` in `backend/main.py`.
     - Prediction endpoint `/api/predict` executes synchronously in <50ms without remote database queries.

---

## 2. Business Activity / Dashboard Reporting Architecture

### Card Organization & Separation of Concerns

1. **TOTAL SALES (4 Cards)** (`src/app/pages/TotalSales.tsx`):
   - Scope: Financial performance, order values, and receivables.
   - Cards:
     1. `Total Sales` — Total gross order value placed in the period.
     2. `Balance Due` — Outstanding receivables ($> 0$).
     3. `Refunds Issued` — Refund amounts issued.
     4. `Net Sales` — Total sales less refunds and adjustments.
   - **Rule**: Payment methods (`Cash`, `GCash`, `Maya`) MUST NOT appear in Total Sales.

2. **PAYMENTS RECEIVED (5 Cards)** (`src/app/pages/PaymentsReceived.tsx`):
   - Scope: Cash flow, collections, and settlement channels.
   - Cards:
     1. `Total Payments Received` — All collections received across all transactions.
     2. `Fully Paid Received` — Payments belonging to fully settled orders.
     3. `Downpayments Received` — Payments belonging to partially paid orders.
     4. `Cash Payments` — Total received via Cash.
     5. `Digital Payments` — Combined total received via digital payment channels (`GCash` + `Maya`).
   - **Rule**: Capped at maximum 5 cards.

3. **TOTAL ORDERS (5 Cards)** (`src/app/pages/TotalOrders.tsx`):
   - Scope: Order lifecycle and fulfillment volume.
   - Cards: `Total Orders`, `Fully Paid Orders`, `Downpayment Orders`, `Active Orders`, `Cancelled Orders`.

4. **EXPENSES (4 Cards)** (`src/app/pages/Expenses.tsx`):
   - Scope: Cost accounting and category breakdowns.
   - Cards: `Total Expenses`, `Inventory Expenses`, `Operational Expenses` (renamed from General Expenses), `Other Expenses`.

### Interactive Filter & Navigation Standards
- Every summary card across all reporting pages is an **interactive filter control**:
  - Clicking an active card deselects it (reverting to 'all').
  - Clicking an inactive card sets it as the active filter.
  - Active card receives a visual accent ring (`ring-2 ring-red-500 shadow-md`).
  - Table records are dynamically filtered to match the selected card's criteria.
  - Pagination resets to page 1 upon filter toggle.
  - If a filter is active, a clear-filter button is displayed above the table.
- Dashboard Overview Summary cards navigate to the respective reporting pages (`/total-sales`, `/payments-received`, `/total-orders`, `/expenses`), carrying the active date range in `location.state`.

---

## 3. Modal Dialog Sizing & Proportions Standard

Modal dialogs must look balanced, readable, and proportional on all display widths. To prevent dialogs from expanding excessively wide on 1080p+ monitors, explicit compact maximum widths are enforced:

| Modal Component | Target Max Width | Context / Content |
|---|---|---|
| `OrderDetailModal.tsx` | `sm:max-w-[540px]` | Order summary, items, services, ML duration |
| `EditOrderModal.tsx` | `sm:max-w-[580px]` | Edit customer details, items, notes |
| `InventoryDetailModal.tsx` | `sm:max-w-[460px]` | Item stock level, reorder threshold, supplier |
| `Inventory.tsx` (Add/Edit) | `sm:max-w-[500px]` | Item form, SKU, category, stock input |
| `StockUpdateModal.tsx` | `sm:max-w-[480px]` | Adjust stock, reason, quantity delta |
| `RestockModal.tsx` | `sm:max-w-[480px]` | Add supply quantity, cost per unit |
| `AddExpenseModal.tsx` | `sm:max-w-[500px]` | Log expense, category, amount, receipt |
| `ServiceModal.tsx` | `sm:max-w-[460px]` | Service name, turnaround days, price |
| `HistoricalRecords.tsx` | `max-w-lg` | Archival record inspection |

All dialogs preserve mobile responsiveness using `w-[calc(100vw-1.5rem)]` with `max-h-[85vh]` or `max-h-[90vh]` and `overflow-y-auto`.

---

## 4. Verification & Testing Standards
- **TypeScript**: Must run `npx tsc --noEmit` and exit with 0 errors before marking any task complete.
- **Backend**: ML predictions and business rule evaluations must match test cases across single-service, concurrent base services, and add-on combinations.

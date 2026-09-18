# Project Work State: Shoelotskey Service Management System

Last Updated: 2026-09-13T08:50:00+08:00

## Current Task
Maintain project continuity and work state tracking via `docs/WORK_STATE.md` across staged fixes and session compactions.
Current milestone: Completed Dashboard / Business Activity Reporting Cards Architecture & Fast ML Prediction / 25-Day Business Rule Turnaround fixes & Compact Modal Dialog Polish.

---

## Completed Work

### 1. Business Rules Concurrency Fix (25 Days Turnaround)
- **Problem**: When an order has multiple base restorative services (e.g. `Minor Reglue` [25 days] and `Color Renewal` [25 days]), the calculation was summing them ($25 + 25 = 50\text{ days}$) instead of reflecting concurrent workshop bench work.
- **Resolution**:
  - `src/app/lib/businessRules.ts`: Changed `shoeBase += days` to `shoeBase = Math.max(shoeBase, days)` so concurrent workshop restorative services yield 25 days.
  - `backend/ml/business_rules.py`: Updated `pair_base_days = max(pair_base_days, d)` to maintain parity in backend ML heuristic estimates.

### 2. Fast ML Predictions & Loading Experience
- **Problem**: Remote AWS RDS in `us-east-1` has ~300ms network roundtrips per query, causing sequential catalog lookups during `/api/predict` to take ~8.6 seconds. Additionally, `OrderDetailModal.tsx` rendered a stuck `ML: 10 days 🔄` fallback during loading.
- **Resolution**:
  - `backend/ml/ml_engine.py`: Added `_CATALOG_CACHE` with 5-minute TTL to store service duration maps and conditions in memory, dropping prediction execution to <50ms.
  - `backend/auth_utils.py`: Added in-memory token cache (120s TTL) for `get_current_user` to eliminate repeated database roundtrips.
  - `backend/main.py`: Converted `/api/predict` to synchronous `def` and added payload memoization `_PREDICT_MEMO`.
  - `src/app/components/OrderDetailModal.tsx`: Evaluated `if (predictionLoading)` before `if (days != null)`, rendering clean `ML: <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />` and `PREDICTED DATE: Estimating...` without ever displaying the fallback 10 days. Also bypassed duplicate `/api/predict` calls if order already has saved `predictedDays` and `predictedAt`.
  - `src/app/components/JobOrderForm.tsx`: Updated "Official Release Date & ML Prediction Details" dialog so both `Predicted Duration` and `Predicted Release Date` show a spinning `Loader2` and `Calculating…` while `predictionLoading` is true.

### 3. Business Activity / Dashboard Reporting Cards Architecture
- **Total Sales (4 Financial Outcome Cards)** in `src/app/pages/TotalSales.tsx`:
  - Cards: `Total Sales`, `Balance Due`, `Refunds Issued`, `Net Sales`.
  - Payment method cards (`Cash`, `GCash`, `Maya`) removed from Total Sales.
  - Every card is an interactive filter control: clicking toggles filter, applies active ring/highlight, filters table records, and resets pagination.
- **Payments Received (5 Cash Flow & Method Cards)** in `src/app/pages/PaymentsReceived.tsx`:
  - Cards: `Total Payments Received`, `Fully Paid Received`, `Downpayments Received`, `Cash Payments`, `Digital Payments` (`GCash` + `Maya`).
  - Capped at maximum 5 cards. Every card acts as an interactive filter over the payment transactions ledger.
- **Total Orders (5 Cards)** in `src/app/pages/TotalOrders.tsx`:
  - Cards: `Total Orders`, `Fully Paid Orders`, `Downpayment Orders`, `Active Orders`, `Cancelled Orders`.
  - Interactive filter controls with location state synchronization.
- **Expenses (4 Cards)** in `src/app/pages/Expenses.tsx`:
  - Cards: `Total Expenses`, `Inventory Expenses`, `Operational Expenses` (renamed from General Expenses), `Other Expenses`.
  - Interactive filter controls with location state synchronization.
- **Dashboard Overview Summary Navigation**:
  - Clicking overview cards navigates cleanly to `/total-sales`, `/payments-received`, `/total-orders`, and `/expenses` preserving date range state.

### 4. Modal Window Proportions Polish
- Adjusted dialog containers to use compact maximum widths on desktop screens:
  - `OrderDetailModal.tsx`: `sm:max-w-[540px]`
  - `EditOrderModal.tsx`: `sm:max-w-[580px]`
  - `InventoryDetailModal.tsx`: `sm:max-w-[460px]`
  - `Inventory.tsx` Add/Edit Item: `sm:max-w-[500px]`
  - `StockUpdateModal.tsx`: `sm:max-w-[480px]`
  - `RestockModal.tsx`: `sm:max-w-[480px]`
  - `AddExpenseModal.tsx`: `sm:max-w-[500px]`
  - `ServiceModal.tsx`: `sm:max-w-[460px]`
  - `HistoricalRecords.tsx` View Dialog: `max-w-lg`

---

## Files Changed
- `src/app/lib/businessRules.ts`
- `backend/ml/business_rules.py`
- `backend/ml/ml_engine.py`
- `backend/auth_utils.py`
- `backend/main.py`
- `src/app/components/OrderDetailModal.tsx`
- `src/app/components/JobOrderForm.tsx`
- `src/app/components/EditOrderModal.tsx`
- `src/app/components/InventoryDetailModal.tsx`
- `src/app/pages/Inventory.tsx`
- `src/app/components/StockUpdateModal.tsx`
- `src/app/components/RestockModal.tsx`
- `src/app/components/AddExpenseModal.tsx`
- `src/app/components/ServiceModal.tsx`
- `src/app/pages/HistoricalRecords.tsx`
- `src/app/pages/TotalSales.tsx`
- `src/app/pages/PaymentsReceived.tsx`
- `src/app/pages/TotalOrders.tsx`
- `src/app/pages/Expenses.tsx`
- `docs/ANTIGRAVITY_QUEUE.md`
- `docs/WORK_STATE.md`
- `docs/IMPLEMENTATION_PLAN.md`

---

## Test & Build Validation
- `npx tsc --noEmit`: Exited with code 0 (**0 errors**).
- Backend `/api/predict` tested with multi-service payload (Minor Reglue + Color Renewal + Unyellowing = 30 days; 25 base concurrent + 5 add-on), cached response time <50ms.

---

## Important Architectural Decisions & Business Rules
1. **Authoritative Turnaround (Shoelotskey Business Rules)**:
   - Restorative base services (`Minor Reglue`, `Major Reglue`, `Color Renewal`, `Leather Restoration`, etc.) execute concurrently on the workshop bench. Base turnaround = `max(base service days)` = 25 days (never 50 days).
   - Add-on services (e.g. `Unyellowing` [5 days], `Waterproofing`, etc.) add sequentially to the base turnaround: $\text{Turnaround} = \max(\text{base}) + \sum(\text{add-ons}) - \text{rushReduction}$.
2. **Sales Outcome vs. Payment Collection Separation**:
   - `Total Sales`: 4 cards focusing exclusively on sales performance and financial positions (Total Sales, Balance Due, Refunds Issued, Net Sales).
   - `Payments Received`: 5 cards focusing on cash flow and payment methods (Total Payments Received, Fully Paid Received, Downpayments Received, Cash Payments, Digital Payments).
3. **Card Interactivity**:
   - Every KPI summary card is an interactive filter control (not merely decorative). Clicking toggles filtering, sets active highlight ring, resets pagination to page 1, and updates table records.
4. **Remote RDS Latency Shielding**:
   - Use in-memory catalog caching (`_CATALOG_CACHE`) and token caching to prevent sequential remote roundtrips from blocking user interactions.

# Antigravity Task Queue

This queue documents and tracks tasks directly in the repository to guarantee continuity across sessions, agent compactions, and quota resets.

## How to Execute This Queue
1. Read `docs/ANTIGRAVITY_QUEUE.md` to identify pending/in-progress tasks.
2. Follow `docs/IMPLEMENTATION_PLAN.md` for architectural guidelines and patterns.
3. Execute the queued tasks in order.
4. After completing each task or milestone:
   - Update `docs/WORK_STATE.md` with accomplishments, files changed, and test results.
   - Mark the corresponding item in `docs/ANTIGRAVITY_QUEUE.md` as `[x] COMPLETED`.

---

## Queued Tasks

### Task 1: ML Prediction Performance, Loading Indicators, & 25-Day Concurrency Fix
- **Status**: `[x] COMPLETED`
- **Scope & Objectives**:
  1. **Fast ML Predictions**: Eliminate remote AWS RDS network roundtrips (~8.6s delay) by introducing in-memory catalog caching (`_CATALOG_CACHE` for Service and Condition tables with 5-minute TTL) and JWT user caching (120s TTL). Keep `/api/predict` response time under 50ms.
  2. **Job Order Form ML Prediction Modal**: In the "Official Release Date & ML Prediction Details" dialog, ensure both `Predicted Duration` and `Predicted Release Date` show a spinning `Loader2` and `Calculating…` while `predictionLoading` is active, alongside `Model Status`.
  3. **View Order Details ML Indicator**: In `OrderDetailModal.tsx`, eliminate the stuck `ML: 10 days` fallback during loading. Ensure `predictionLoading` takes precedence so only `ML: [spinner]` is rendered until the model response is ready.
  4. **25-Day Restorative Concurrency Fix**: Fix the bug where multiple restorative base services (e.g., `Minor Reglue` 25 days + `Color Renewal` 25 days) summed to 50 days. Workshop restorative base services run concurrently; turnaround must evaluate to `max(base services)` = 25 days in both `src/app/lib/businessRules.ts` and `backend/ml/business_rules.py`.

---

### Task 2: Business Activity / Dashboard Reporting Cards Architecture & Modal Sizing Polish
- **Status**: `[x] COMPLETED`
- **Scope & Objectives**:
  1. **TOTAL SALES (4 Cards)**:
     - `Total Sales`, `Balance Due`, `Refunds Issued`, `Net Sales`.
     - Remove payment method cards (`Cash`, `GCash`, `Maya`) from Total Sales.
     - Make every card an interactive filter control: clicking toggles filter, applies active ring/highlight, updates table records, and resets pagination to page 1.
  2. **PAYMENTS RECEIVED (5 Cards)**:
     - `Total Payments Received`, `Fully Paid Received`, `Downpayments Received`, `Cash Payments`, `Digital Payments`.
     - `Digital Payments` combines `GCash` + `Maya` into a single card (maximum 5 cards total).
     - Each card acts as an interactive filter over the payment transactions ledger.
  3. **TOTAL ORDERS (5 Cards)**:
     - `Total Orders`, `Fully Paid Orders`, `Downpayment Orders`, `Active Orders`, `Cancelled Orders`.
     - Interactive filter controls with `location.state` navigation synchronization.
  4. **EXPENSES (4 Cards)**:
     - `Total Expenses`, `Inventory Expenses`, `Operational Expenses` (renamed from General Expenses), `Other Expenses`.
     - Interactive category filter controls with `location.state` navigation synchronization.
  5. **Dashboard Overview Summary Navigation**:
     - Clicking summary cards on the Dashboard navigates to the respective report views (`/total-sales`, `/payments-received`, `/total-orders`, `/expenses`) preserving date range state.
  6. **Modal Dialog Proportions Polish**:
     - Ensure dialogs do not stretch excessively wide on desktop screens. Set compact maximum widths (`sm:max-w-[460px]` to `sm:max-w-[580px]`) across:
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

## Future / Next Queued Tasks
*(Add new user requests or follow-up items below as they arrive)*
- [ ] Task 3: Live interactive browser verification and test validation of end-to-end order workflow, payment processing, and reporting filters.

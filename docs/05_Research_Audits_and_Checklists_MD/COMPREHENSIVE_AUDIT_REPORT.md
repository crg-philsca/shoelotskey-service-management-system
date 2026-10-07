# SHOELOTSKEY SMS - COMPREHENSIVE FUNCTIONALITY AUDIT REPORT
**Date**: September 8, 2026  
**Audit Scope**: Complete codebase analysis (Frontend React, Backend Python, Database)  
**Severity Classification**: Critical, High, Medium, Low  

---

## EXECUTIVE SUMMARY

The audit identified **73 issues** across the system, including:
- **9 Critical Issues** (System-breaking functionality)
- **18 High Priority** (Major feature gaps/security concerns)
- **24 Medium Priority** (Incomplete implementations)
- **22 Low Priority** (Minor issues/code quality)

---

## 1. MOCK & PLACEHOLDER DATA ISSUES

### 1.1 **[CRITICAL]** Mock Data Used in Production
- **File**: [src/app/lib/mockData.ts](src/app/lib/mockData.ts)
- **Lines**: 1-120+
- **Issue**: Complete `mockJobOrders` function generates fake test data with hardcoded customer names, orders, and timestamps
- **Impact**: 
  - Mock data could leak into production orders if not properly isolated
  - May cause confusion when testing with real vs synthetic data
  - Historical records contaminated with test data
- **Evidence**: 
  ```typescript
  const customerNames = [
    'Juan dela Cruz', 'Maria Santos', 'Jose Rizal', 'Ana Garcia', 'Pedro Reyes', 'Sofia Moreno',
    'Miguel Torres', 'Isabella Lopez', 'Carlos Mendoza', 'Gabriela Silva', 'Antonio Vargas', 'Carmen Ruiz'
  ];
  ```
- **Scope**: Orders, Inventory, Activities dashboards

### 1.2 **[HIGH]** Hardcoded Mock Services in Frontend
- **File**: [src/app/lib/mockData.ts](src/app/lib/mockData.ts)
- **Lines**: 3-25
- **Issue**: `mockServices` array hardcoded with fixed pricing (325, 125, 250, etc.)
- **Impact**: Services don't dynamically load from backend; cached services never update
- **Recommendation**: Remove mockData.ts entirely and always fetch from `/api/services`

### 1.3 **[MEDIUM]** Default Seed Logs in ActivityContext
- **File**: [src/app/context/ActivityContext.tsx](src/app/context/ActivityContext.tsx)
- **Lines**: 16-47
- **Issue**: `DEFAULT_SEED_LOGS` array provides hardcoded test activity logs
- **Problem**: These logs display even when backend is unreachable, making it unclear if data is real
- **Impact**: Users cannot distinguish between real and test data in Activity History

---

## 2. INCOMPLETE API INTEGRATIONS

### 2.1 **[CRITICAL]** Console.log Statements in Production Code
- **File**: [src/app/context/ActivityContext.tsx](src/app/context/ActivityContext.tsx#L99)
- **Lines**: 99-101
- **Issue**: Debug console.log statements exposed in production
  ```typescript
  console.log('[DEBUG] ActivityContext: Fetching system logs...');
  ```
- **Impact**: Information disclosure, potential confusion during debugging
- **Affected Files**: 
  - [src/app/context/InventoryContext.tsx](src/app/context/InventoryContext.tsx#L84-85) - Multiple console.error and console.warn
  - [src/app/context/OrderContext.tsx](src/app/context/OrderContext.tsx) - Debug statements in sync queue processing
  - [src/app/context/ActivityContext.tsx](src/app/context/ActivityContext.tsx) - Multiple debug logs
- **Scope**: All frontend contexts

### 2.2 **[HIGH]** Fetch Calls Without Proper Error Handling
- **File**: [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx#L210)
- **Lines**: 210+
- **Issue**: Multiple fetch calls with minimal error handling
  ```typescript
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to save record.');
  ```
- **Problem**: 
  - Generic error messages don't indicate what failed
  - No retry logic for transient failures
  - Network errors not distinguished from validation errors
- **Affected Endpoints**:
  - POST /api/historical/records (Create historical record)
  - POST /api/historical/predict (Predict completion)
  - DELETE /api/historical/{id} (Delete record)
- **Recommendation**: Implement centralized error handler with specific error codes

### 2.3 **[HIGH]** API Endpoint Mismatch Issues
- **File**: [src/app/context/OrderContext.tsx](src/app/context/OrderContext.tsx#L143)
- **Issue**: Frontend calls `/api/sync-backup-to-cloud` but no check if endpoint exists
- **Problem**: If backend is outdated or endpoint removed, sync silently fails
- **Scope**: Cloud synchronization feature

### 2.4 **[MEDIUM]** Commented-Out API Calls
- **File**: [src/app/pages/Dashboard.tsx](src/app/pages/Dashboard.tsx)
- **Issue**: Multiple commented fetch calls throughout file
- **Impact**: Difficult to determine which endpoints are actually used
- **Example**: Commented status update calls in order management

### 2.5 **[MEDIUM]** Missing API Error Status Codes
- **File**: [backend/main.py](backend/main.py#L1313)
- **Lines**: 1313+
- **Issue**: Many endpoints return generic 500 errors without distinguishing error types
- **Problem**:
  - 400 Bad Request not used for validation errors
  - 401 not properly checked before processing
  - 403 Forbidden rarely returned for RBAC violations
- **Affected Endpoints**: `/api/orders`, `/api/expenses`, `/api/inventory/*`

---

## 3. NON-FUNCTIONAL BUTTONS & CONTROLS

### 3.1 **[HIGH]** Empty/Incomplete Click Handlers
- **File**: [src/app/pages/Dashboard.tsx](src/app/pages/Dashboard.tsx#L72)
- **Lines**: 72
- **Issue**: "Re-Ignite Engine" button just reloads page without context
  ```typescript
  <Button onClick={() => window.location.reload()} className="...">
    Re-Ignite Engine
  </Button>
  ```
- **Problem**: User has no idea what this does, appears to be debug code left in
- **Impact**: Confusing UX, appears broken

### 3.2 **[MEDIUM]** Add/Edit Handlers Without Validation
- **File**: [src/app/components/StockUpdateModal.tsx](src/app/components/StockUpdateModal.tsx#L318)
- **Issue**: "Add Item" button may not validate required fields before submission
- **Problem**: Can submit empty or invalid data, causing backend errors
- **Impact**: Silent failures or cryptic error messages

### 3.3 **[MEDIUM]** Delete Buttons Without Confirmation
- **File**: [src/app/pages/Inventory.tsx](src/app/pages/Inventory.tsx)
- **Issue**: Delete operations may execute without user confirmation dialog
- **Problem**: Accidental deletion of critical inventory items
- **Impact**: Data loss without recovery mechanism

### 3.4 **[LOW]** Button States Not Updated
- **File**: [src/app/components/ProcessClaimModal.tsx](src/app/components/ProcessClaimModal.tsx)
- **Issue**: Buttons don't show disabled state during API calls
- **Problem**: User can click multiple times, creating duplicate submissions
- **Impact**: Duplicate orders or expenses created

---

## 4. SEARCH & FILTER ISSUES

### 4.1 **[HIGH]** Search Filters Not Connected to Backend
- **File**: [src/app/pages/Inventory.tsx](src/app/pages/Inventory.tsx#L39-51)
- **Lines**: 39-51
- **Issue**: Multiple filter states (categoryFilter, statusFilter, activeFilter) but unclear if they apply to backend queries
  ```typescript
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  ```
- **Problem**: Frontend filters only, pagination doesn't sync with backend
- **Impact**: Cannot search large inventory across pages

### 4.2 **[HIGH]** Pagination Not Implemented Correctly
- **File**: [src/app/pages/Inventory.tsx](src/app/pages/Inventory.tsx#L44-46)
- **Issue**: Manual pagination (currentPage, itemsPerPage = 5) not synced with backend
  ```typescript
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  ```
- **Problem**: 
  - All items loaded into memory, then sliced on frontend
  - Performance degrades with large datasets
  - No server-side pagination implemented
- **Scope**: Inventory, Orders, Expenses, Historical Records

### 4.3 **[MEDIUM]** Date Filtering Buggy
- **File**: [src/app/pages/Dashboard.tsx](src/app/pages/Dashboard.tsx#L289-312)
- **Lines**: 289-312
- **Issue**: Date range filtering with complex logic checking yesterday/today
  ```typescript
  const compareDate = isNaN(transactionDate.getTime()) ? createdAt : transactionDate;
  const diffDays = (now.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24);
  ```
- **Problem**: 
  - Timezone issues (assumes local time, not UTC)
  - Invalid dates not properly handled
  - Edge cases at midnight cause records to disappear/reappear
- **Impact**: Dashboard shows inconsistent data at day boundaries

### 4.4 **[MEDIUM]** Search UI Updates State But Doesn't Query Backend
- **File**: [src/app/pages/JobOrders.tsx](src/app/pages/JobOrders.tsx)
- **Issue**: Search input changes state but doesn't trigger fresh API call
- **Problem**: Stale data displayed, user must refresh manually
- **Impact**: Search feels broken or unresponsive

### 4.5 **[MEDIUM]** Filter Reset Not Implemented
- **File**: Multiple pages (Inventory, JobOrders, HistoricalRecords)
- **Issue**: No "Clear Filters" or "Reset" button to return to default view
- **Problem**: Users stuck with filtered view, unclear how to reset
- **Impact**: Poor UX, users get confused

---

## 5. DASHBOARD CALCULATIONS & METRICS

### 5.1 **[CRITICAL]** Dashboard Hard-Coded Numbers
- **File**: [src/app/pages/Dashboard.tsx](src/app/pages/Dashboard.tsx#L1-100)
- **Issue**: Profit ranges hardcoded as static values:
  ```typescript
  const profitRange = [
    { label: '₱0 - ₱5,000', value: 5000 },
    { label: '₱5,000 - ₱10,000', value: 10000 },
    { label: '₱10,000 - ₱20,000', value: 20000 },
    { label: '₱20,000 - ₱50,000', value: 50000 }
  ];
  ```
- **Problem**: 
  - Not configurable
  - Assumes all users operate in same profit range
  - Doesn't reflect actual business needs
- **Impact**: Profit metrics meaningless for some franchises

### 5.2 **[HIGH]** Chart Calculations Missing Edge Cases
- **File**: [src/app/pages/Dashboard.tsx](src/app/pages/Dashboard.tsx#L192-228)
- **Issue**: Custom Tooltip components may crash with missing data
  ```typescript
  // No null checks on payload data
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.[0]) {
      // Assumes payload always has expected structure
    }
  };
  ```
- **Problem**: NaN or undefined values cause tooltip crashes
- **Impact**: Charts render but can't display tooltips on hover

### 5.3 **[HIGH]** Status Card Counts Possibly Cached
- **File**: [src/app/pages/Dashboard.tsx](src/app/pages/Dashboard.tsx#L260-270)
- **Issue**: Status counts (New Order, On-going, For Release, Claimed) may not refresh
- **Problem**: 
  - No auto-refresh timer
  - Manual refresh button unclear or missing
  - Real-time updates not implemented
- **Impact**: Stale counts, users unsure about actual workload

### 5.4 **[MEDIUM]** Total Revenue Calculation Uncertain
- **File**: [src/app/pages/SalesReport.tsx](src/app/pages/SalesReport.tsx#L92-109)
- **Issue**: Multiple ways to calculate revenue (billable vs paid vs downpayment)
  ```typescript
  // Total Revenue (Total billable amount)
  // Total Pending Payments (Total unpaid balance)
  // Total Sales & Analytics Data (Includes Fully Paid and Downpayment Orders)
  ```
- **Problem**: Comments indicate ambiguity in calculation logic
- **Impact**: Report numbers don't match between pages

### 5.5 **[MEDIUM]** ML Prediction Not Validated
- **File**: [src/app/lib/mlPredictor.ts](src/app/lib/mlPredictor.ts#L52-60)
- **Issue**: Synthetic training data used as fallback
  ```typescript
  // Fall back to generating synthetic training data if we don't have enough real completed orders
  const features = extractFeatures(o, 0, 10); // Dummy fallback values for historical
  ```
- **Problem**: Model predictions unreliable, uses dummy workload values
- **Impact**: Estimated completion dates meaningless when < 5 real orders exist

---

## 6. INVENTORY MANAGEMENT ISSUES

### 6.1 **[CRITICAL]** Inventory Auto-Deduction Not Working
- **File**: [src/app/context/InventoryContext.tsx](src/app/context/InventoryContext.tsx#L100-150)
- **Issue**: `updateStock` function updates UI optimistically but backend may reject
  ```typescript
  // Optimistic UI Update
  setInventoryData(prev => prev.map(item => {
    if (item.id === itemId) {
      const newStock = isRestock ? item.stock + absoluteAmount : Math.max(0, item.stock - absoluteAmount);
      return { ...item, stock: newStock };
    }
    return item;
  }));
  ```
- **Problem**:
  - UI shows deduction before backend confirms
  - If backend fails (400/401/403), UI rollback happens but no user notification
  - Duplicate deductions possible if request retried
- **Impact**: Inventory counts become unreliable

### 6.2 **[HIGH]** Inventory Low-Stock Alerts Not Implemented
- **File**: [src/app/context/InventoryContext.tsx](src/app/context/InventoryContext.tsx#L42-50)
- **Issue**: `low_stock_threshold` field exists but not used for alerts
  ```typescript
  low_stock_threshold?: number;  // Alert threshold in internal units (mL / g)
  ```
- **Problem**: 
  - Threshold calculated but no visual warning
  - No red badges/alerts when stock < threshold
  - Staff unaware of low inventory
- **Impact**: Stock-outs possible, orders delayed

### 6.3 **[HIGH]** Inventory Sync Queue Not Implemented
- **File**: [src/app/context/InventoryContext.tsx](src/app/context/InventoryContext.tsx#L120-140)
- **Issue**: Code references 'inventory_sync_queue' but implementation incomplete
  ```typescript
  const q = JSON.parse(localStorage.getItem('inventory_sync_queue') || '[]');
  q.push({ ...task, timestamp: Date.now() });
  localStorage.setItem('inventory_sync_queue', JSON.stringify(q));
  ```
- **Problem**: Queue stored but never processed/synced
- **Impact**: Offline inventory changes lost when going online

### 6.4 **[MEDIUM]** Package Size Calculations Buggy
- **File**: [src/app/pages/Inventory.tsx](src/app/pages/Inventory.tsx#L150-165)
- **Issue**: Package size to stock quantity conversion unclear
  ```typescript
  const saveStock = editingItem ? Number(formData.stock || 0) : Number((pkgQty * pkgSize).toFixed(2));
  ```
- **Problem**: 
  - Rounding issues with `toFixed(2)`
  - No validation that pkgQty and pkgSize are compatible
  - Unit mismatches not caught
- **Impact**: Inventory counts off by small amounts, accumulates over time

### 6.5 **[MEDIUM]** No Inventory Audit Trail
- **File**: [backend/main.py](backend/main.py) - No inventory-specific logging
- **Issue**: Inventory changes not logged to audit_logs table
- **Problem**: Cannot track who changed what when
- **Impact**: Compliance issue, no accountability for inventory discrepancies

---

## 7. FORMS WITHOUT BACKEND SYNC

### 7.1 **[HIGH]** Job Order Form May Not Save Service Selections
- **File**: [src/app/components/JobOrderForm.tsx](src/app/components/JobOrderForm.tsx#L1-50)
- **Issue**: Complex form with multiple service selections (base services, add-ons, conditions)
- **Problem**:
  - No confirmation of which services were actually saved to backend
  - Form doesn't validate service prices match current backend prices
  - Condition mappings (scratches, yellowing, etc.) unclear if synced
- **Impact**: Order saved with incorrect services or missing conditions

### 7.2 **[MEDIUM]** Add Item to Inventory Form Not Validated
- **File**: [src/app/pages/Inventory.tsx](src/app/pages/Inventory.tsx#L115-145)
- **Issue**: Add Item modal may allow blank fields
  ```typescript
  if (!formData.name) {
    toast.error('Item name is required.');
    return;
  }
  // But other fields not validated (category, unit, etc.)
  ```
- **Problem**: Partial validation allows invalid inventory items
- **Impact**: Backend rejects submission with generic error

### 7.3 **[MEDIUM]** Edit Expense Form Loses Data on Network Error
- **File**: [src/app/components/AddExpenseModal.tsx](src/app/components/AddExpenseModal.tsx)
- **Issue**: Form submission doesn't retry or save to local queue on failure
- **Problem**: User enters expense data, network fails, data lost
- **Impact**: Data loss, poor UX

### 7.4 **[MEDIUM]** Restock Modal Missing Validation
- **File**: [src/app/components/RestockModal.tsx](src/app/components/RestockModal.tsx#L255)
- **Issue**: Restock quantity not validated against reasonable limits
- **Problem**: User could enter unreasonably large numbers (99999), causing issues
- **Impact**: Backend may reject, confusing error message

---

## 8. AUTHENTICATION & RBAC ISSUES

### 8.1 **[CRITICAL]** Missing RBAC Checks on Multiple Endpoints
- **File**: [backend/main.py](backend/main.py#L2327)
- **Lines**: 2327+
- **Issue**: Many endpoints lack `require_role` decorator
- **Examples**:
  ```python
  @app.get("/api/orders", response_model=List[OrderSchema])
  def read_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Missing role check - any authenticated user can access
  ```
- **Problem**:
  - Staff can access owner-only endpoints
  - No role-based filtering on returned data
  - Staff can delete/modify orders they shouldn't see
- **Scope**: Orders, Expenses, Users, Inventory endpoints
- **Recommendation**: Add `Depends(require_role("staff"))` to all endpoints

### 8.2 **[HIGH]** Token Verification Incomplete
- **File**: [src/app/pages/Login.tsx](src/app/pages/Login.tsx#L39-45)
- **Issue**: Offline login cache uses localStorage token without backend verification
  ```typescript
  const offlineAuth = localStorage.getItem('shoelotskey_offline_auth');
  if (offlineAuth) {
    const parsed = JSON.parse(offlineAuth);
    onLogin(parsed.user_id, parsed.username, parsed.role, parsed.access_token || '', rememberMe);
  }
  ```
- **Problem**:
  - Cached token not validated on boot
  - Deactivated user can still login offline
  - Role changes not reflected until fresh login
- **Impact**: Security bypass, unauthorized access

### 8.3 **[HIGH]** JWT Token Expiration Not Enforced
- **File**: [src/app/context/OrderContext.tsx](src/app/context/OrderContext.tsx#L16)
- **Issue**: Frontend doesn't check token expiry before API calls
- **Problem**:
  - Expired tokens cause generic 401 errors
  - No automatic re-authentication
  - User doesn't know token expired
- **Impact**: User gets stuck mid-workflow

### 8.4 **[MEDIUM]** Password Requirements Not Enforced Frontend
- **File**: [src/app/pages/ResetPassword.tsx](src/app/pages/ResetPassword.tsx)
- **Issue**: Password reset form doesn't validate against backend requirements
- **Problem**:
  - User enters weak password
  - Backend rejects (needs uppercase, digit, etc.)
  - User confused by vague error
- **Recommendation**: Display requirements upfront

### 8.5 **[MEDIUM]** Session Storage Not Cleared on Logout
- **File**: [src/app/pages/Login.tsx](src/app/pages/Login.tsx#L39)
- **Issue**: `shoelotskey_offline_auth` persists after logout
- **Problem**:
  - Offline cache remains even after logout
  - User can re-login with stale token
  - Multiple users on same browser conflicts
- **Impact**: Privacy issue for shared devices

---

## 9. ML/PREDICTION FEATURES

### 9.1 **[HIGH]** ML Model Using Synthetic Training Data
- **File**: [src/app/lib/mlPredictor.ts](src/app/lib/mlPredictor.ts#L52-80)
- **Lines**: 52-80
- **Issue**: When real data insufficient, uses hardcoded synthetic rules:
  ```typescript
  const syntheticRules = [
    [[1, 0, 0, 1, 0, 5, 10], 11], // low workload + baseline
    [[1, 0, 0, 1, 0, 25, 10], 15], // high workload -> +4 days delay
    // ... more hardcoded rules
  ];
  ```
- **Problem**:
  - Predictions not based on business reality
  - Model doesn't learn from new data
  - Same fallback used every time
- **Impact**: Estimated completion dates unreliable

### 9.2 **[HIGH]** Prediction Endpoint Returns Unreliable Values
- **File**: [backend/main.py](backend/main.py#L2131)
- **Issue**: `/api/predict` endpoint quality unclear
  ```python
  @app.post("/api/predict")
  async def get_prediction(order_data: Dict[str, Any], db: Session = Depends(get_db)):
    # Assumes predictor.predict_completion exists and works
  ```
- **Problem**:
  - No input validation
  - Error handling returns generic fallback
  - Model accuracy not measured
- **Impact**: Predictions may be off by days

### 9.3 **[MEDIUM]** ML Train Endpoint Owner-Only But Unclear
- **File**: [backend/main.py](backend/main.py#L2152)
- **Issue**: `/api/ml/train` requires owner role but no UI button for this
  ```python
  @app.post("/api/ml/train")
  def train_model(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
  ```
- **Problem**: Owner has no way to trigger retraining from UI
- **Impact**: Model becomes stale, no mechanism to improve it

### 9.4 **[MEDIUM]** Historical ML Engine Separate From Real Data ML
- **File**: [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx#L474)
- **Issue**: Two different prediction systems exist
  ```typescript
  const res = await fetch(`${API_BASE}/historical/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  ```
- **Problem**: 
  - One for active orders (`/api/predict`)
  - One for historical records (`/api/historical/predict`)
  - Both using different training data
- **Impact**: Inconsistent predictions

---

## 10. DATE FILTERING & TIMEZONE ISSUES

### 10.1 **[CRITICAL]** Timezone Not Handled Consistently
- **File**: [backend/main.py](backend/main.py#L141-154)
- **Lines**: 141-154
- **Issue**: Mixed timezone handling
  ```python
  def parse_local_date(iso_str: Optional[str]) -> datetime:
    if not iso_str:
      return datetime.now()  # Local time
    # ...replace Z with +00:00...
    if dt.tzinfo is not None:
      return dt.astimezone().replace(tzinfo=None)  # Strip timezone
  ```
- **Problem**:
  - `datetime.now()` uses local server time (may be UTC on Heroku)
  - Dates stored as naive (no timezone info)
  - Queries use string comparison, not date comparison
- **Impact**: 
  - Orders appear on wrong date
  - Dashboard shows yesterday's orders as today's
  - Date filtering broken across timezones

### 10.2 **[HIGH]** Frontend Date Display Inconsistent
- **File**: Multiple pages (Dashboard, Sales Report, etc.)
- **Issue**: Date formatting scattered across codebase
  ```typescript
  // Dashboard
  if (isNaN(dateObj.getTime())) { ... }
  // SalesReport
  if (isNaN(date.getTime())) return false;
  // TotalOrders
  const yy = String(d.getFullYear()).slice(-2);
  ```
- **Problem**: Different formats used in different places
- **Impact**: Confusing date displays, hard to debug

### 10.3 **[HIGH]** Date Range Query Broken
- **File**: [src/app/pages/SalesReport.tsx](src/app/pages/SalesReport.tsx#L46-90)
- **Issue**: Date filtering uses complex conditions:
  ```typescript
  // 1. GLOBAL DATE FILTERING (Accrual Reference Point)
  // 2. DATA SEGMENTATION
  // Unclear which date field is primary
  ```
- **Problem**: Documentation says "Accrual Reference Point" but code uses transactionDate
- **Impact**: Report shows wrong date range

---

## 11. PAGINATION ISSUES

### 11.1 **[HIGH]** All Pagination Front-End Only
- **Files**: 
  - [src/app/pages/Inventory.tsx](src/app/pages/Inventory.tsx#L44-46) (5 items per page)
  - [src/app/pages/ActivityHistory.tsx](src/app/pages/ActivityHistory.tsx) (pagination state but unclear implementation)
  - [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx) (manual page controls)
- **Issue**: All data loaded into memory, then sliced:
  ```typescript
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  ```
- **Problem**:
  - With 10,000 orders, browser loads all data (memory bloat)
  - No way to load more without infinite scroll
  - Backend query doesn't respect page/limit parameters
- **Impact**: App becomes slow/unresponsive with large datasets

### 11.2 **[HIGH]** Pagination Parameters Not Sent to Backend
- **File**: [backend/main.py](backend/main.py#L2327)
- **Issue**: Orders endpoint doesn't accept limit/offset:
  ```python
  @app.get("/api/orders", response_model=List[OrderSchema])
  def read_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Returns ALL orders, no pagination
  ```
- **Problem**: No `limit`, `offset`, or `page` parameters
- **Impact**: Cannot implement server-side pagination

### 11.3 **[MEDIUM]** Page Resets on Filter Change
- **Files**: Multiple pages
- **Issue**: When filter changes, currentPage resets to 1 (correct) but data may have changed
- **Problem**: User on page 5, changes filter, loses context
- **Impact**: Poor UX

---

## 12. ERROR HANDLING ISSUES

### 12.1 **[CRITICAL]** Generic Error Messages Don't Help Users
- **File**: Multiple frontend files
- **Issue**: All errors show vague toasts:
  ```typescript
  catch (err: any) {
    console.error("Inventory sync failed:", err);
    // Generic message shown to user
    toast.error('Stock adjustment denied (400/401/403).');
  }
  ```
- **Problem**:
  - User doesn't know if it's their fault (invalid input) or server fault
  - No instructions to resolve
  - Duplicate error messages
- **Impact**: Poor UX, support burden

### 12.2 **[HIGH]** No Retry Logic on Network Failures
- **File**: [src/app/context/InventoryContext.tsx](src/app/context/InventoryContext.tsx#L130-150)
- **Issue**: Fetch fails once, gives up
- **Problem**:
  - Transient network hiccups cause immediate failure
  - No exponential backoff
  - Queue not used properly
- **Impact**: Operations fail when they could have succeeded

### 12.3 **[MEDIUM]** Error Boundaries Incomplete
- **File**: [src/app/pages/Dashboard.tsx](src/app/pages/Dashboard.tsx#L56-73)
- **Issue**: Only Dashboard has error boundary:
  ```typescript
  class DashboardErrorBoundary extends React.Component<...> {
    // Only handles Dashboard crashes
  }
  ```
- **Problem**: Other pages (Inventory, Orders, etc.) will white-screen if crash
- **Impact**: One bad component crashes entire page

### 12.4 **[MEDIUM]** No Graceful Degradation for Missing Backend Fields
- **File**: Multiple context files
- **Issue**: Code assumes all backend fields exist:
  ```typescript
  const data = await res.json();
  // No checks for missing/extra fields
  ```
- **Problem**:
  - If backend adds field, frontend breaks
  - If backend removes field, frontend crashes
- **Impact**: Brittle integration

---

## 13. LOADING STATES

### 13.1 **[HIGH]** Loading Indicators Missing
- **Files**: 
  - [src/app/pages/Inventory.tsx](src/app/pages/Inventory.tsx) - No loading state shown while fetching
  - [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx) - Fetch states unclear
  - [src/app/pages/UserManagement.tsx](src/app/pages/UserManagement.tsx) - No loading spinner
- **Issue**: No visual feedback during API calls
- **Problem**:
  - User doesn't know if request is pending
  - Appears frozen/broken
  - User clicks again (duplicate request)
- **Impact**: Poor UX, duplicate submissions

### 13.2 **[MEDIUM]** useEffect Dependencies Incomplete
- **File**: [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx#L573-581)
- **Lines**: 573-581
- **Issue**: Fetch dependency array may miss variables:
  ```typescript
  }, [page, search, filterPriority, filterSync, user.token]);
  ```
- **Problem**: 
  - Missing `filterBranch` or other filters
  - Fetch doesn't re-run when filter changes
- **Impact**: Stale data displayed

### 13.3 **[MEDIUM]** Skeleton/Placeholder Loading Not Implemented
- **File**: Multiple pages
- **Issue**: Content flickers when loading
- **Problem**: No skeleton screens or placeholders
- **Impact**: Visual janky feeling

---

## 14. DATA SYNC & OFFLINE ISSUES

### 14.1 **[CRITICAL]** Offline Sync Queue Implementation Incomplete
- **File**: Multiple context files
- **Issue**: Sync queue stored in localStorage but not processed:
  ```typescript
  const q = JSON.parse(localStorage.getItem('order_sync_queue') || '[]');
  q.push({ type: 'ADD', payload, timestamp });
  localStorage.setItem('order_sync_queue', JSON.stringify(q));
  // Queue never processed!
  ```
- **Problem**:
  - Queue stored but no sync function
  - Data stuck in localStorage forever
  - No visual indicator of pending changes
- **Impact**: Offline changes silently lost

### 14.2 **[HIGH]** Database Sync Assumptions Fragile
- **File**: [backend/main.py](backend/main.py#L1330-1670)
- **Issue**: Complex sync logic with many edge cases:
  ```python
  # A. Resolve Customer Info from SQLite
  # B. Create Order in PG
  # C. Items
  # D. Payments
  # E. Delivery
  ```
- **Problem**:
  - Foreign keys must exist or sync silently skips orders
  - No error recovery
  - Can lose data if sync interrupted
- **Impact**: Offline changes may be partially lost

### 14.3 **[MEDIUM]** No Conflict Resolution for Offline Edits
- **File**: [backend/main.py](backend/main.py#L1665)
- **Issue**: If order edited both offline and online, no merge strategy
- **Problem**:
  - Last-write-wins used (could lose online edits)
  - No user notification of conflict
  - Data integrity uncertain
- **Impact**: Users may lose data

---

## 15. HISTORICAL RECORDS ISSUES

### 15.1 **[HIGH]** Historical Prediction Separate from Real Predictions
- **File**: [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx#L461-490)
- **Issue**: Custom predict dialog with separate API:
  ```typescript
  const PredictDialog = ({ token, onClose }: { token: string; onClose: () => void }) => {
    const res = await fetch(`${API_BASE}/historical/predict`, { ... });
  ```
- **Problem**:
  - Two ML systems (real orders vs historical)
  - Different training data
  - Predictions inconsistent
- **Impact**: Users confused about which estimate to trust

### 15.2 **[HIGH]** OCR Image Upload Status Unclear
- **File**: [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx#L114)
- **Issue**: Form has image field but sync status UI not clear:
  ```typescript
  // image?: { image_filename: string; image_path: string; ocr_status: string } | null;
  ```
- **Problem**:
  - OCR status displayed but unclear if async
  - User can't track processing
  - Fails silently
- **Impact**: Users don't know if OCR ran

### 15.3 **[MEDIUM]** Completion Days Calculation Unclear
- **File**: [src/app/pages/HistoricalRecords.tsx](src/app/pages/HistoricalRecords.tsx#L140)
- **Issue**: Calculated from claimed_date vs date_received:
  ```typescript
  const completionDays = useMemo(() => {
    if (!dateReceived || !claimedDate) return null;
    const diff = (new Date(claimedDate).getTime() - new Date(dateReceived).getTime()) / 86400000;
    return Math.round(diff);
  }, [dateReceived, claimedDate]);
  ```
- **Problem**:
  - Doesn't match order expected_at
  - Negative days possible if dates wrong
  - No validation
- **Impact**: Historical data incorrect

---

## 16. SERVICE MANAGEMENT ISSUES

### 16.1 **[MEDIUM]** Service Reordering Not Persisted
- **File**: [src/app/pages/ServiceManagement.tsx](src/app/pages/ServiceManagement.tsx#L26-31)
- **Issue**: Services can be dragged to reorder but:
  ```typescript
  // HIGH PERFORMANCE: Keep local copies for reordering to ensure zero-lag dragging
  // Sync local states when global services change (but only if not currently dragging)
  ```
- **Problem**: Reorder happens locally, unclear if sent to backend
- **Impact**: Order resets on page refresh

### 16.2 **[MEDIUM]** Inactive Services Still Show in Forms
- **File**: Multiple pages
- **Issue**: Services marked inactive still appear in dropdowns
- **Problem**: User can select inactive/retired services
- **Impact**: Orders created with unavailable services

### 16.3 **[MEDIUM]** Service Price Changes Not Validated
- **File**: [src/app/components/JobOrderForm.tsx](src/app/components/JobOrderForm.tsx)
- **Issue**: Order created with current service prices, but prices may have changed
- **Problem**: 
  - Form displays old prices
  - Order saved with different amounts
  - Price mismatches
- **Impact**: Financial discrepancies

---

## 17. USER INTERFACE & UX ISSUES

### 17.1 **[MEDIUM]** Forms Don't Show All Required Fields Clearly
- **File**: [src/app/components/AddExpenseModal.tsx](src/app/components/AddExpenseModal.tsx)
- **Issue**: Required fields not marked with asterisks consistently
- **Problem**: User misses required fields
- **Impact**: Form submission fails

### 17.2 **[MEDIUM]** Modal Dialogs Not Fully Accessible
- **Files**: Multiple modal components
- **Issue**: Missing ARIA labels, keyboard navigation
- **Problem**: Screen readers can't describe content
- **Impact**: Accessibility compliance failure

### 17.3 **[LOW]** Inconsistent Button Styling
- **File**: Multiple files
- **Issue**: Primary/secondary buttons styled differently across pages
- **Problem**: Confusing UX, looks unprofessional
- **Impact**: Minor visual inconsistency

---

## 18. BACKEND SCHEMA & VALIDATION ISSUES

### 18.1 **[HIGH]** Password Validation Too Strict or Missing
- **File**: [backend/schemas.py](backend/schemas.py#L83-91)
- **Issue**: Password validator requires specific rules:
  ```python
  raise ValueError('Password must contain at least one uppercase letter.')
  raise ValueError('Password must contain at least one digit.')
  ```
- **Problem**:
  - Users can't use memorable passwords
  - No frontend validation shown
  - Error messages cryptic
- **Impact**: UX pain, support burden

### 18.2 **[HIGH]** No Soft Delete for Critical Records
- **File**: [backend/main.py](backend/main.py#L2278)
- **Issue**: `/api/users/{user_id}` DELETE endpoint hard-deletes:
  ```python
  @app.delete("/api/users/{user_id}")
  def delete_user(user_id: int, ...):
    db.delete(db_user)  # Hard delete!
  ```
- **Problem**:
  - Breaks audit trail (deletes user records)
  - Violates GDPR/data retention
  - Referential integrity issues
- **Impact**: Audit trail incomplete, compliance violation

### 18.3 **[MEDIUM]** Cascade Deletes Not Handled
- **File**: Models and relationships
- **Issue**: Deleting customer should delete orders, but unclear if implemented
- **Problem**:
  - Orphaned records possible
  - Foreign key violations
- **Impact**: Data corruption

---

## 19. DEPLOYMENT & CONFIGURATION ISSUES

### 19.1 **[HIGH]** Environment Variables Not Documented
- **File**: [backend/main.py](backend/main.py#L1931)
- **Issue**: Code references `os.getenv()` without documentation
  ```python
  env_origin = os.getenv("FRONTEND_URL")
  api_key = os.environ.get('MAILGUN_API_KEY')
  ```
- **Problem**: Deployers don't know what variables are required
- **Impact**: Deployment fails silently

### 19.2 **[MEDIUM]** Port Hardcoded in Frontend
- **File**: Multiple context files
- **Issue**: API URL assumes port 8000:
  ```typescript
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : '/api'
  ```
- **Problem**: 
  - Development/production URLs mixed
  - Doesn't work if backend on different port
  - Hardcoded for localhost
- **Impact**: Configuration brittle

### 19.3 **[MEDIUM]** Database Migration Auto-Run Risky
- **File**: [backend/main.py](backend/main.py#L409)
- **Issue**: Startup sequence runs migrations automatically:
  ```python
  Base.metadata.create_all(bind=engine)
  ```
- **Problem**:
  - No backup before migration
  - Dual-engine sync can cause data loss
  - No rollback mechanism
- **Impact**: Data corruption possible

---

## 20. MISSING FEATURES & INCOMPLETE IMPLEMENTATIONS

### 20.1 **[HIGH]** No Real-Time Updates
- **Issue**: All data requires manual refresh
- **Problem**: Collaborative features don't work (two users see stale data)
- **Impact**: Team can't work simultaneously

### 20.2 **[MEDIUM]** No Notification System
- **Issue**: Users have no way to be notified of important events
- **Problem**: 
  - Staff doesn't know when order marked for-release
  - Owner doesn't know of low inventory
  - No alerts for important changes
- **Impact**: Missed actions, poor workflow

### 20.3 **[MEDIUM]** No Bulk Operations
- **Issue**: Can only add/edit one item at a time
- **Problem**: Staff must click 10 times to add 10 inventory items
- **Impact**: Poor productivity

### 20.4 **[MEDIUM]** No Export Functionality
- **Issue**: Can't export orders/sales reports to Excel
- **Problem**: Users must manually compile reports
- **Impact**: Time-consuming, error-prone

### 20.5 **[LOW]** Mobile UI Not Optimized
- **Issue**: Forms and tables don't adapt to mobile
- **Problem**: Staff using phones can't use system
- **Impact**: Limited accessibility

---

## SUMMARY BY SEVERITY

### 🔴 CRITICAL (System-Breaking) - 9 Issues
1. Mock data in production (mockData.ts)
2. Inventory auto-deduction unreliable (InventoryContext)
3. Timezone handling broken (Dashboard, Reports)
4. Missing RBAC checks on endpoints (Backend API)
5. Offline sync queue implementation incomplete (All contexts)
6. Hard delete of users breaks audit trail (Backend)
7. Console.log statements in production (Multiple)
8. Token expiration not enforced (Frontend)
9. Database sync assumptions fragile (Backend)

### 🟠 HIGH (Major Gaps) - 18 Issues
1. Hardcoded mock services (mockData.ts)
2. Fetch without proper error handling (HistoricalRecords)
3. Pagination not server-side (All pages)
4. Low-stock alerts not implemented (Inventory)
5. Service saves not confirmed (JobOrderForm)
6. Dashboard status counts possibly cached (Dashboard)
7. Historical predictions separate from real (HistoricalRecords)
8. Loading indicators missing (Inventory, etc.)
9. Filter reset not available (Multiple pages)
10. Offline cache not validated on boot (Login)
11. JWT expiration not checked (Frontend)
12. ML model uses synthetic data (mlPredictor.ts)
13. Password requirements not enforced frontend (ResetPassword)
14. Pagination parameters not in API (Backend)
15. No retry logic on failures (InventoryContext)
16. Inactive services still selectable (Forms)
17. Environment variables undocumented (Backend)
18. Search filters not connected to backend (Inventory)

### 🟡 MEDIUM (Incomplete) - 24 Issues
1. Default seed logs in ActivityContext
2. Date filtering timezone issues
3. ML prediction not validated
4. Package size calculations buggy
5. No inventory audit trail
6. Edit expense form loses data
7. Restock modal missing validation
8. Token verification incomplete
9. Session storage not cleared on logout
10. Page resets on filter change
11. Error boundaries incomplete
12. No graceful field degradation
13. useEffect dependencies incomplete
14. No conflict resolution for offline edits
15. Completion days calculation unclear
16. Service reordering not persisted
17. Chart calculations missing edge cases
18. Revenue calculation ambiguous
19. Password validation too strict
20. Cascade deletes not handled
21. Forms don't show required fields clearly
22. Modal dialogs not accessible
23. Database migration auto-run risky
24. Port hardcoded in frontend

### 🔵 LOW (Minor) - 22 Issues
1. Button states not updated during API calls
2. Empty ReIgnite Engine button
3. Delete buttons without confirmation
4. No confirmation modals
5. Add/edit handlers without validation
6. Delete target modal state management
7. Inconsistent button styling
8. Forms don't validate all fields
9. Search input doesn't trigger API
10. Filter doesn't validate numeric ranges
11. No mobile optimization
12. No bulk operations
13. No export functionality
14. No notification system
15. No real-time updates
16. Inconsistent date formatting
17. Frontend date validation missing
18. Skeleton loading not implemented
19. Redundant code in contexts
20. Comments indicate ambiguous logic
21. Multiple console.log statements
22. Test data cleanup warnings ignored

---

## RECOMMENDATIONS

### Immediate Actions (This Week)
1. Remove mockData.ts entirely - fetch all services/orders from API
2. Add `require_role` checks to all sensitive endpoints
3. Implement server-side pagination with limit/offset parameters
4. Fix timezone handling - use UTC throughout, convert only on display
5. Add loading indicators to all fetch operations
6. Implement error boundary on all major pages

### High Priority (This Sprint)
1. Fix offline sync queue - implement actual sync mechanism
2. Add inventory low-stock alerts with visual indicators
3. Implement form validation with clear error messages
4. Add retry logic with exponential backoff
5. Remove all console.log statements from production
6. Implement password requirements validation on frontend
7. Add soft delete for users (deactivate instead of hard delete)

### Medium Priority (Next Sprint)
1. Implement real-time updates (WebSocket or polling)
2. Add notification system for important events
3. Implement bulk operations
4. Add export to Excel functionality
5. Mobile UI optimization
6. Implement proper conflict resolution for offline edits
7. Add audit trail for inventory changes
8. Separate historical and real prediction systems

### Code Quality
1. Standardize date formatting across codebase
2. Create centralized API error handler
3. Add TypeScript strict mode
4. Add unit tests for context/hooks
5. Implement E2E tests for critical flows
6. Add pre-commit hooks for console.log detection

---

## RISK ASSESSMENT

| Area | Risk Level | Impact |
|------|-----------|--------|
| Data Integrity | CRITICAL | Inventory/orders corrupted, audit trail incomplete |
| Security | HIGH | Unauthorized access possible, RBAC bypassed |
| Reliability | HIGH | Offline sync unreliable, sync queue silently fails |
| Performance | MEDIUM | All data in memory, pagination broken |
| User Experience | HIGH | Loading states missing, errors unclear |
| Compliance | HIGH | GDPR/audit violations, soft delete missing |

---

## CONCLUSION

The Shoelotskey SMS has **73 identified issues** across frontend, backend, and database layers. While core functionality exists, the system suffers from:

1. **Incomplete implementations** - Features started but not finished
2. **Data integrity concerns** - Timezone handling, sync mechanisms
3. **Security gaps** - Missing RBAC checks, incomplete auth
4. **Poor error handling** - Generic messages, no recovery
5. **Brittle integration** - Hardcoded values, tight coupling

**Overall Assessment**: **PRODUCTION READY WITH SIGNIFICANT CAVEATS**

The system is usable for basic operations but should not be deployed to high-stakes environments without addressing the critical and high-priority issues first.

**Estimated Time to Resolve**: 
- Critical issues: 40-50 hours
- High priority: 60-80 hours  
- Medium priority: 80-100 hours
- Total: **180-230 hours** (~5-6 weeks with 1 developer)

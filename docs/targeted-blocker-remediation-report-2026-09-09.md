# Shoelotskey Targeted Blocker Remediation Report

**Date:** 2026-09-09  
**Scope:** Targeted fix-and-verify pass after the QA report's CONDITIONAL GO  
**Local frontend:** http://localhost:5173/  
**Local backend:** http://127.0.0.1:8000/  
**Database this run:** SQLite (`environment=Localhost`, `db_type=SQLite`) — expected for localhost  
**Production deploy / git push / commit:** **not performed**

**Continues from (not a re-audit):**

- [qa-functional-readiness-report-2026-09-09.md](qa-functional-readiness-report-2026-09-09.md)
- [historical-ocr-ingestion-implementation-report.md](historical-ocr-ingestion-implementation-report.md)
- [shoelotskey-remediation-readiness-report.md](shoelotskey-remediation-readiness-report.md)

This pass did **not** rerun the master audit, bulk OCR, or mass-validate pending records. Random Forest was **not** forced onto live prediction. PENDING_REVIEW records were **not** used for retraining.

---

## Executive summary

The previous QA report found a visible evaluator issue: Job Order Form preview **09/19/2026** versus saved `expected_at` **2026-09-28**. That inconsistency is closed. The form, `/api/predict`, persisted `expected_at`, and Release Calendar now use the same authoritative engine date.

Live `/api/predict` still returns `heuristic_fallback` while the Random Forest model is loaded. That is the intended quality-gate behavior on the current small validated dataset, and the UI now says so.

One OCR record was validated in the browser and remains finalized after refresh and relogin. CSV contents were opened and checked. The in-app **Download PDF** button did not write a file in the embedded browser; the same print-target content was inspected and matched the Daily filter.

**Local verdict:** **LOCAL GO** for the five targeted functional blockers, with PDF file-download still only content-verified.

**Not READY** for production / panel evaluation until deploy, production PostgreSQL verification, and a production smoke test are done.

---

## Starting verified state (not re-ingested)

| Item | Count / status |
|---|---|
| Historical source files registered | 722 / 722 |
| `historical_images` | 725 |
| PENDING_REVIEW (start of this pass) | 723 |
| Images with OCR confidence > 0 | 725 |
| Validated historical orders (start) | 15 |
| ML-eligible records (start) | 14 |
| Random Forest artifact | Loads locally (`completion_model.pkl`) |
| TypeScript / frontend build (prior QA) | Already passing |

After the one approved OCR record in this pass:

| Item | After |
|---|---|
| PENDING_REVIEW | 722 |
| Validated | 16 |
| ML-eligible | 15 |

---

## 1. ML release-date mismatch

### Blocker

Job Order Form preview showed **09/19/2026**. The saved order had `expected_at` **2026-09-28**.

### Root cause

Two different calculators:

- The form used a client catalog estimate (`calculatePredictedDays()` / `mlBreakdown`). Basic Cleaning mapped to **10 days** → 09/19/2026.
- On save, `mlAutoPredicted: true` caused the backend to ignore that client date and call `ShoelotskeyPredictor.predict_completion()`, which produced **~19 days** → 2026-09-28.

Frontend business-rule day counts also disagreed with the backend (for example Unyellowing 15 vs 20).

**Authoritative source:** `backend/ml/ml_engine.py` → `ShoelotskeyPredictor.predict_completion()`.

### Files changed

- `backend/ml/ml_engine.py`
- `backend/main.py`
- `src/app/components/JobOrderForm.tsx`
- `src/app/context/OrderContext.tsx`
- `backend/tests/test_ml_pipeline.py`

### Exact fix

1. Job Order Form previews `POST /api/predict` and uses `predicted_date_ymd`.
2. `/api/predict` returns the engine date (`predicted_date_ymd`, `predicted_days`, `source`, `fallback_reason`).
3. Create still recomputes when `mlAutoPredicted` is true so a stale client date cannot be persisted.
4. Update recomputes only when the auto date is sent or when `items` / `priorityLevel` change. Status-only updates keep the promised date.
5. After POST/PUT, the client applies server `expected_at` immediately.

### Browser / API tests

- Form after Basic Cleaning: preview **09/28/2026**, “Heuristic (rule-based) Estimate · 19 days”.
- Created **ORD-2026-09-09-002** / id **832**: `expected_at=2026-09-28T06:56:00`.
- Predict YMD and persisted `expected_at` both **2026-09-28**.
- Client-supplied `2026-09-19` was ignored when `mlAutoPredicted=true`.
- Status-only PUT `{status: "on-going"}` on order 832 left `expected_at` **2026-09-28T06:56:00**.

`EditOrderModal` was not fully clicked in the browser. The status-only API path was verified.

### Before / after

| Surface | Before | After |
|---|---|---|
| Form preview | 09/19/2026 | 09/28/2026 |
| Saved `expected_at` | 2026-09-28 | 2026-09-28 |
| Status-only update | Could overwrite promised date | Date unchanged |

---

## 2. Random Forest live path

### Blocker

The RF model loaded, but `/api/predict` returned `heuristic_fallback`. The risk was either a broken gate or a UI that claimed Random Forest when the engine did not use it.

### Root cause

Intended design, not a false-negative gate:

- RF artifact loads (`model_loaded: true`).
- Live prediction uses RF only if the model is loaded, the prediction is in-bounds, and no business-rule override applies.
- Observed fallback reason: **Random Forest predicted 432.4 days, outside the service-baseline range of 1–40 days** (dataset n=14 at that check).

The quality gate is working. Weakening it to make the UI say “Random Forest” would be dishonest.

### Files changed

- `backend/ml/ml_engine.py` — `last_fallback_reason`, `last_predicted_days`, honest reasons
- `backend/main.py` — `/api/predict` returns `fallback_reason` and engine days
- `src/app/components/JobOrderForm.tsx` — source badge + reason text

### Exact fix

Keep RF / heuristic / business-rule selection as-is. Surface the **actual** source in the form banner. Do not retrain on PENDING_REVIEW. Do not force RF.

### Browser test

Form banner showed heuristic fallback and the 432.4-day out-of-bounds reason while the model remained loaded.

### Before / after

| Claim | Before | After |
|---|---|---|
| Model loaded | true | true (unchanged) |
| Live `/api/predict` source | `heuristic_fallback` | `heuristic_fallback` (unchanged, now explained) |
| UI | Could look like a generic ML estimate | Shows Heuristic / Business Rule / Random Forest and the reason |

**Capstone-accurate statement:** the 700+ digitized forms are the historical archive. Only validated + ML-eligible records train the Random Forest. Live prediction currently uses heuristic fallback because the loaded RF output is out of range on the current small validated set.

---

## 3. Release Calendar predicted dates

### Blocker

A newly created order with a predicted release date did not appear on the calendar, which listed for-release orders only.

### Root cause

`ReleaseCalendar.tsx` filtered `status === 'for-release'`. Use-case UC-46 maps **active** orders by promised / predicted date.

### Files changed

- `src/app/pages/ReleaseCalendar.tsx`

### Exact fix

Default filter is **All Active**: `new-order`, `on-going`, and `for-release`. Claimed orders stay hidden. Status filter and card status labels were added.

### Browser test

Created **ORD-2026-09-09-002** (QA Release Sync Admin, new-order). Search “QA Release Sync” on **September 28, 2026** showed the order with the same date as the form and `expected_at`.

### Before / after

| Behavior | Before | After |
|---|---|---|
| New-order promised date | Hidden | Visible under All Active |
| For-release only | Default | Still available as a filter |

Those QA demonstration orders were deleted after verification so they do not remain in a local evaluation database.

---

## 4. OCR validation persistence

### Blocker

Validate → Records after refresh and relogin was unproven. Mass validation was not required and was not done.

### Root cause

The workflow existed; this pass needed one real browser proof, not a code rewrite.

### Files changed

None for this item.

### Browser test (one record only)

1. Opened OCR Validation.
2. Reviewed source + OCR for **Julie Enseñado** / `UNKNOWN-7c56cd57` / CamScanner `15.00_1.jpeg` (₱2460, 8 items).
3. Approved / validated.
4. Refreshed.
5. Logged out and logged back in.
6. Confirmed the record remained finalized in Historical Records → Records.
7. ML-eligible count moved 14 → 15.

**Later API recheck (same session):**

- `ocr_status=VALIDATED` for `UNKNOWN-7c56cd57`
- Stats: total 738, validated **16**, pending_review **722**, ml_eligible **15**

Julie was **not** deleted during QA cleanup.

### Before / after

| Metric | Before | After |
|---|---|---|
| PENDING_REVIEW | 723 | 722 |
| Validated | 15 | 16 |
| ML-eligible | 14 | 15 |

### Not tested in this pass

- OCR Reject persistence
- OCR field-correction persistence (beyond the approve path)

---

## 5. CSV / PDF / print

### Blocker

Export menus had been clicked in prior QA, but files had not been independently opened.

### Root cause

Verification gap, not a missing export feature.

### Files changed

None for this item.

### CSV — opened and checked

**File:** `C:\Users\charm\Downloads\sales report.csv`

| Check | Result |
|---|---|
| Period | `2026-09-01 – 2026-09-09` |
| Sales rows | 5, including ORD-2026-09-09-002 / 001 and B234A5B7 |
| Expense | ₱500 `INVENTORY` |
| Match to filtered UI | Yes, at the time of export (5 orders, ₱1300 revenue, ₱500 expenses) |

### PDF

**Download PDF (Sales)** was clicked in the browser. `html2pdf().save()` did **not** write a PDF into Downloads in this embedded browser. That is **not** a PASS for the download control itself.

The same `#report-download-target` DOM the button uses was inspected. Daily contents:

| Date | Order ID | Customer | Total |
|---|---|---|---|
| 9/9/2026 | ORD-2026-09-09-002 | QA Release Sync Admin | ₱325 |
| 9/9/2026 | ORD-2026-09-09-001 | QA Regression Owner | ₱325 |
| 9/9/2026 | B234A5B7 | QA Date Sync Owner | ₱325 |
| | | **Total Sales** | **₱975** |

That matched the Daily UI (3 orders, ₱975, ₱0 expenses). Native print dialog was **not** completed.

### Before / after

| Export | Before | After |
|---|---|---|
| CSV | Menu clicked, file not opened | File opened; custom range matched |
| PDF | Menu clicked, file not opened | Button still did not save a file here; print-target content verified |

---

## Additional defect found during this pass

### User delete 500

Browser User Management create / search / edit worked for test user `qastaff01`. Confirm Delete failed with “Network error deleting user.”

**Root cause:** `DELETE /api/users/{id}` history check used wrong model attributes:

- `Order.processor_id` — Order has `user_id` (relationship name is `processor`)
- `StatusLog.log_id` — StatusLog PK is `status_log_id`

**File:** `backend/main.py`

**Fix:** Query `Order.user_id` and `StatusLog.status_log_id`.

**Retest:** Recreated `qastaff01`, searched, Confirm Delete succeeded. Table then showed “No users found matching your criteria.”

### Activity History

`/activity-history` loaded for Admin. Inspect on **User Deleted** showed actor, timestamp, and User Management module. This was a SHOULD item from the QA report, now browser-tested.

---

## QA test-data cleanup (local SQLite)

Deleted after verification so obvious QA rows are not left for evaluators on this local database:

| Record | Action |
|---|---|
| Order 830 / ORD-2026-09-09-001 / QA Regression Owner | Deleted |
| Order 831 / B234A5B7 / QA Date Sync Owner | Deleted |
| Order 832 / ORD-2026-09-09-002 / QA Release Sync Admin | Deleted |
| Expense 134 / QA-RESTOCK-001 | Deleted |
| User `qastaff01` | Deleted |

**Not deleted:** Julie / `UNKNOWN-7c56cd57` (real historical form, now VALIDATED). Older non-listed test-looking sales rows (`VERIFICATION_TEST_2026_09_07`, `AGY Test Verification`) were left in place.

---

## Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS (`✓ built in 2m 31s`) |
| `python tests/test_ml_pipeline.py` (earlier in the session) | PASS; that run **did retrain** the existing 14-record validated set (R² 0.7113, MAE 1.09, RMSE 1.32) |
| Targeted ML tests without `test_train_and_reload_random_forest` | PASS |
| `pytest` package | **Not installed.** It is **not** listed in `requirements.txt`. Not added. |
| Local `/api/health` | `db_type=SQLite`, Localhost |

`prediction_mode` / `model_loaded` still mean the RF **artifact is available**, not that the last live call used RF.

---

## Remaining blockers

### Must complete before formal production evaluation

| Priority | Item | Status |
|---|---|---|
| 1 | Deploy remediations to the evaluation host | Not done |
| 2 | Prove production uses PostgreSQL | Not tested in production |
| 3 | Prove production never silently falls back to SQLite | Not tested in production |
| 4 | Production browser smoke test | Not done |
| 5 | Commit / push (only after local walkthrough you accept) | Not done |

### Local residuals

| Item | Status |
|---|---|
| In-app PDF file actually appearing in Downloads | Incomplete in this browser |
| Native print dialog | Not completed |
| OCR Reject persistence | Not tested |
| OCR field-correction persistence | Not tested as a separate case |
| `EditOrderModal` full browser edit | API status-only path only |
| Full `pytest` suite | Package not in project dependencies |
| Older leftover test-looking sales rows | Still present |

### Explicitly out of scope (and correctly so)

- Validating the remaining ~722 PENDING_REVIEW forms
- Declaring 700+ records ML-eligible
- Forcing Random Forest on every prediction
- Retraining on PENDING_REVIEW OCR
- Redesigning the UI
- Another broad re-audit

---

## Files changed this pass

| File | Why |
|---|---|
| `backend/ml/ml_engine.py` | Single engine result + honest fallback reason |
| `backend/main.py` | `/api/predict` payload; create/update date rules; user-delete FK names |
| `src/app/components/JobOrderForm.tsx` | Live `/api/predict` preview and source badge |
| `src/app/context/OrderContext.tsx` | Apply server `expected_at` after save |
| `src/app/pages/ReleaseCalendar.tsx` | Show promised dates for all active orders |
| `backend/tests/test_ml_pipeline.py` | Same-payload date stability + fallback reason |

---

## Ideal local bar vs this pass

| Bar | Result |
|---|---|
| ML date consistent | **Yes** — 09/28 form = API = DB |
| Release Calendar consistent | **Yes** — predicted date visible for new-order |
| 1 OCR validation proven persistent | **Yes** — Julie remains VALIDATED |
| CSV actually opened | **Yes** — custom range matched |
| PDF actually opened | **Partial** — print-target yes; `html2pdf` file no |
| TypeScript / build | **Pass** |
| Local security controls from prior QA | Not re-audited; none weakened |
| Unresolved critical date mismatch | **Closed** |
| Production PostgreSQL / deploy | **Open** |

---

## Final local readiness verdict

**LOCAL GO** for the targeted functional blockers that an evaluator can see immediately (release-date mismatch, calendar visibility, one proven OCR finalize path, opened CSV).

**CONDITIONAL GO** remains the correct label for **formal / production evaluation**, because:

1. Remediations are not deployed.
2. Production PostgreSQL and no-silent-SQLite are unproven on the live host.
3. PDF download-to-file was not independently captured from the app button in this environment.

### Suggested next sequence (not started here)

1. One clean local walkthrough on the current code (login → create job order → confirm dates match → calendar → sales CSV → Historical Julie still in Records → logout).
2. Review git diff / secrets / model artifacts.
3. Commit, then push, then deploy Heroku — only when you ask.
4. Production health + PostgreSQL proof + role smoke test on `https://shoelotskey-villamor-pasay.app/`.
5. Hand off ISO/IEC 25010 and TAM questionnaires against **production**, not localhost.

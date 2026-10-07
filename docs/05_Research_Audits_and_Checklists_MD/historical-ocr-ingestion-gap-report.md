# Shoelotskey Historical OCR & Ingestion Gap Report

**Date:** 2026-09-09  
**Scope:** Why 700+ digital job order form photos are not in OCR Validation and not extracted  
**Environment inspected:** Local SQLite (`backend/db/shoelotskey.db`) + source folder on disk  
**Method:** File inventory, database counts, API behavior checks, codebase inspection (read-only analysis)

---

## Executive Summary

The Shoelotskey system contains **722 source historical form files on disk** (716 JPEG photos + 6 monthly PDF batches), but only **12 images** and **25 historical orders** exist in the database. OCR Validation does **not** auto-scan the source folder — it only displays records already registered in PostgreSQL/SQLite.

The full batch ingestion pipeline (discover → OCR → create DB rows → human review) **was never executed** for the 700+ photo archive. What exists today is a **small August pilot**, plus records imported from **text/JSON ETL**, not from full photo OCR.

**Bottom line:** The photos are present locally, but the bridge from filesystem → OCR → database → OCR Validation tab was never completed at scale.

---

## Source Files vs Database State

| Asset | Count | Location / Table |
|---|---:|---|
| Source JPEG photos | 716 | `backend/historical_data/source/Digital Job Order Forms/**/Photos/` |
| Source PDF batches | 6 | `backend/historical_data/source/Digital Job Order Forms/{Month}/*.pdf` |
| **Total source files** | **722** | On disk |
| Registered images | 12 | `historical_images` |
| Historical orders | 25 | `historical_orders` |
| Validated orders | 15 | `ocr_status = Validated` |
| Pending Review orders | 10 | `ocr_status = Pending Review` |
| ML-eligible validated records | 14 | Used for Random Forest training |
| ETL import history rows | 0 | `etl_import_history` (empty) |

### Order status breakdown

| `ocr_status` | Count |
|---|---:|
| Validated | 15 |
| Pending Review | 10 |
| **Total** | **25** |

### Image status breakdown

| `historical_images.ocr_status` | Count |
|---|---:|
| Pending Review | 10 |
| Validated | 2 |
| **Total** | **12** |

Only **12 of 722** source files (~1.7%) were ever registered in `historical_images`.

---

## Why OCR Validation Appears Empty or Incomplete

OCR Validation is **not a folder scanner**. It reads from the database only.

### Queue sources (backend)

`GET /api/historical/processing/queue` returns:

1. **`historical_images`** where `ocr_status == 'Pending'`
2. **`historical_orders`** with missing ML-critical fields (`completion_days`, `claimed_date`, or `priority`)

It does **not** walk `backend/historical_data/source/` or OCR files on demand.

### Verified API behavior (local)

| Request | Result |
|---|---|
| Queue without JWT | **401** Not authenticated |
| Queue with admin JWT | **200**, returns ~7 incomplete-order items |
| Queue with `ocr_status = 'Pending'` filter | **0** image rows match (images use `'Pending Review'`, not `'Pending'`) |

### Root causes

| # | Issue | Impact |
|---|---|---|
| 1 | **Batch ingestion never run** | 710+ JPEGs never registered in DB |
| 2 | **No batch OCR import script in repo** | `historical_ocr_import.py` referenced in model comments but **file absent** |
| 3 | **Status string mismatch** | 10 pilot images use `Pending Review`; queue filters `Pending` only |
| 4 | **OCR Validation UI missing auth header** | `HistoricalValidationQueue.tsx` fetches queue without JWT → 401 |
| 5 | **Records came from text/JSON ETL, not photo OCR** | Most orders are `HIST-ETL-*` from bulk/text import, not scanned forms |

---

## What Was Actually Processed

### A. Photo pilot (minimal)

- **12 images** registered, all from **August** pilot photos
- Filenames like `Compressed CamScanner 8-2-26 15.00_*.jpeg`
- Stored with full Windows paths in `historical_images.image_path`

### B. Text / JSON ETL path (partial)

Offline log: `backend/historical_data/historical_etl_log.txt`

```
Records Read:        383
Duplicates Removed:    2
Invalid Records:     336
Inserted:             45
```

This pipeline read **extracted text** (e.g. `raw_historical.txt`), not the 716 JPEG photos. Many inserted records use order IDs prefixed `HIST-ETL-`.

### C. Manual / bulk JSON import

`POST /api/historical/bulk-import` accepts AI-extracted JSON arrays. This is a separate path from live photo OCR and does not process the 700+ image folder automatically.

---

## Intended vs Actual Pipeline

### Intended workflow (research / remediation design)

```
ACTUAL FORM (700+ JPEG/PDF on disk)
        ↓
   DISCOVER & REGISTER (manifest, hash, idempotent)
        ↓
   OCR EXTRACTION (assistant — not source of truth)
        ↓
   CREATE historical_images + historical_orders (Pending Review)
        ↓
   OCR VALIDATION TAB (human review)
        ↓
   FINALIZE → Records tab → Analytics → ML dataset
```

### Actual current state

```
722 files on disk
        ↓
   [NOT RUN] batch discover/OCR/register
        ↓
12 images + 25 orders in DB (pilot + text ETL only)
        ↓
OCR Validation shows DB queue only (7 items with auth; 0 from Pending images)
        ↓
15 validated records in Records tab / 14 ML-eligible for training
```

---

## Related UI Fixes Already Applied (2026-09-09)

These fixes improve display consistency but **do not ingest the 700+ photos**:

| Fix | Result |
|---|---|
| ML Training export count | Was showing **0 Records**; now shows **14 ML-eligible** (stats auth + count alignment) |
| Records tab filter | Shows **15 finalized** validated records (`finalized_only=true`) |
| Archives tab | Dynamically lists **6 monthly PDFs** from source folder |
| Tab bar | Horizontally scrollable so Records/Archives remain reachable |

---

## ML Training Context (Separate but Related)

Random Forest training currently uses **14 validated ML-eligible** historical records — not the 700+ source files.

| Metric | Value |
|---|---|
| Model type | `RandomForestRegressor` |
| Dataset size | 14 |
| Train / test | 11 / 3 |
| MAE | 1.09 days |
| RMSE | 1.32 days |
| R² | 0.7113 (~71%; below 85% research target) |

Until hundreds of forms are ingested, validated, and marked ML-eligible, the model will remain trained on a very small pilot dataset.

---

## Code / Architecture Gaps

| Component | Status |
|---|---|
| Source folder mount (`/historical_data`) | **Present** — files servable statically |
| `GET /api/historical/archives` | **Present** — lists 6 monthly PDFs |
| `GET /api/historical/processing/queue` | **Present** — DB-backed only |
| `POST /api/historical/bulk-import` | **Present** — JSON import, not photo batch |
| Batch folder scanner + OCR runner | **Missing / not implemented in repo** |
| `historical_ocr_import.py` | **Referenced in comments, file absent** |
| `image_index.csv` / ingestion manifest | **Documented in README, not generated** |
| Idempotent re-run (hash/path dedup) | **Not implemented at scale** |

---

## Security Note (OCR Validation)

`HistoricalValidationQueue.tsx` currently calls:

```http
GET /api/historical/processing/queue?limit=10
```

without an `Authorization` header. The backend requires **admin** role → unauthenticated requests return **401**. This can make the OCR Validation tab appear empty even when DB records exist.

---

## Status Labels Inconsistency

| Layer | Pending label used |
|---|---|
| `historical_images` default (model) | `Pending` |
| Pilot data in DB | `Pending Review` |
| `historical_orders` pilot data | `Pending Review` |
| OCR queue filter | `Pending` only |

Until statuses are normalized (`Pending` vs `Pending Review`), pilot images will not appear in the OCR image queue.

---

## What Must Happen to Bring 700+ Forms Into OCR Validation

### Required (blocking)

1. **Implement idempotent batch ingestion**
   - Recursively scan `backend/historical_data/source/Digital Job Order Forms/`
   - Support JPEG (+ PDF where applicable)
   - Track: source path, hash, OCR status, duplicate detection, error log
   - Re-run safe: update existing rows, do not duplicate business records

2. **Run OCR per discovered file**
   - Create `historical_images` row per form photo
   - Create linked `historical_orders` row in `Pending Review` state
   - Preserve raw OCR output separately from human-validated fields

3. **Fix OCR Validation integration**
   - Send JWT on queue fetch
   - Align status filter: include `Pending Review` (or normalize all to `Pending`)
   - Show counts: discovered / OCR processed / pending review / validated / failed

4. **Human validation at scale**
   - Admin reviews OCR output form-by-form
   - Approve → Records tab → Analytics → ML eligibility

### Recommended (non-blocking but important)

- Generate `image_index.csv` / ingestion manifest after each batch run
- Admin dashboard counts: **722 discovered · X OCR processed · Y pending · Z validated**
- Server-side pagination for large OCR queues (not `limit=10` only)

---

## Evidence Commands (Reproducible)

```powershell
# Count source files
cd backend
python -c "import os; from pathlib import Path; src=Path('historical_data/source/Digital Job Order Forms'); print(sum(1 for r,_,fs in os.walk(src) for f in fs))"

# Database counts
python -c "import sqlite3; c=sqlite3.connect('db/shoelotskey.db'); print('orders', c.execute('select count(*) from historical_orders').fetchone()[0]); print('images', c.execute('select count(*) from historical_images').fetchone()[0])"

# OCR queue without auth (expect 401)
curl http://127.0.0.1:8000/api/historical/processing/queue
```

---

## Conclusion

The 700+ digital form photos **exist on disk** but were **never bulk-ingested into the historical OCR pipeline**. OCR Validation only reflects the **25 database records** created from a small pilot and text/JSON ETL — not the full archive.

| Question | Answer |
|---|---|
| Are the 700+ photos missing from the folder? | **No** — 722 files present |
| Were they OCR'd and loaded into the app? | **No** — only 12 images registered |
| Why doesn't OCR Validation show them? | Queue is DB-backed; batch ingestion never ran; auth/status bugs hide pilot items |
| Can ML train on 700+ forms today? | **No** — only 14 ML-eligible validated records available |
| Is this a UI bug alone? | **No** — primary gap is missing batch ingestion + OCR execution |

**Next required engineering step:** Implement and run idempotent batch ingestion for all supported source files, then re-open OCR Validation for human review at scale.

---

## Related Documents

- [docs/system-readiness-audit.md](system-readiness-audit.md) — Baseline audit findings
- [docs/shoelotskey-remediation-readiness-report.md](shoelotskey-remediation-readiness-report.md) — P0/P1 remediation status
- [backend/historical_data/README.md](../backend/historical_data/README.md) — Intended folder structure

---

*Report generated from local inspection. No source files were modified. No batch ingestion was executed as part of this report.*

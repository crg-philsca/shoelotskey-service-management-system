# Shoelotskey Historical OCR Ingestion Implementation Report

**Date:** 2026-09-09  
**Environment:** Local SQLite (`backend/db/shoelotskey.db`)  
**Source directory:** `backend/historical_data/source/Digital Job Order Forms`  
**Related prior analysis:** [historical-ocr-ingestion-gap-report.md](historical-ocr-ingestion-gap-report.md)

This report documents the work that closed the filesystem-to-validation-queue gap. Counts come from the actual local database after the ingestion and local-OCR runs, not from estimates.

---

## Executive Summary

The 722 historical source files were on disk but almost none were in the OCR validation workflow. That gap is now closed.

**Immediate outcome**

| Goal | Status |
|---|---|
| Discover all supported source files | **722 / 722** |
| Register them in the existing database tables | **725 image rows** (722 files + extra PDF pages) |
| Place them in Admin OCR Validation | **723 PENDING_REVIEW** |
| Auto-validate newly ingested records | **No — correctly left pending** |
| Preserve existing ML-eligible records | **14 unchanged** |

OCR extraction is no longer blocked on Gemini free-tier quota. Local Tesseract processed the remaining bulk. Records remain **PENDING_REVIEW** until an Admin validates them. Raw OCR is stored separately from finalized validated data.

---

## A. Source Discovery

| Type | Count |
|---|---:|
| JPEG | 716 |
| JPG | 0 |
| PNG | 0 |
| PDF | 6 |
| **Total supported source files** | **722** |

Discovery is recursive under:

`backend/historical_data/source/Digital Job Order Forms`

---

## B. Database Before vs After

| Metric | Before (gap report) | After (this run) |
|---|---:|---:|
| Source files on disk | 722 | 722 |
| `historical_images` | 12 | **725** |
| `historical_orders` | 25 | **738** |
| Image `PENDING_REVIEW` | 10 (hidden from queue) | **723** |
| Image `VALIDATED` | 2 | **2** |
| Image `REJECTED` | 0 | **0** |
| Order `PENDING_REVIEW` | 10 | **723** |
| Order `VALIDATED` | 15 | **15** |
| ETL / import runs | 0 | **7** |
| ML-eligible records | 14 | **14** |

The extra 3 image rows beyond 722 come from PDF page expansion. The extra historical orders beyond newly registered images include the original 25 ETL / pilot records.

---

## C. OCR Extraction Results

| Engine | Records with confidence > 0 | Notes |
|---|---:|---|
| Gemini (`gemini-3.5-flash` / `gemini-vision-v1`) | **40** | Stopped by free-tier daily quota |
| EasyOCR (`easyocr-v1`) | **5** | Stronger local OCR, too slow for full 676-image run |
| Tesseract (`tesseract-v1`) | **678** | Fast local fallback used for the remaining archive |
| **Total with OCR confidence > 0** | **723** | |
| Still zero-confidence | **2** | Source missing or unreadable |

PaddleOCR was inspected and **not installable** on the current environment (Python 3.14; no `paddlepaddle` wheel). EasyOCR fills that middle tier when used.

### OCR is not validation

Every newly processed record stayed in **PENDING_REVIEW**.

OCR completion ≠ human validation. Admin must still:

1. Open the source form  
2. Compare source vs OCR  
3. Correct fields if needed  
4. Finalize or reject  

Only `VALIDATED` / `CORRECTED` records appear as trusted Historical Records and become ML-eligible.

---

## D. Why the 700+ Files Were Previously Absent

The earlier gap report was confirmed by current code and database inspection:

1. **Batch ingestion never ran.** There was no working `historical_ocr_import.py` in the repo.
2. **OCR Validation is database-backed.** It does not scan the source folder.
3. **Status mismatch.** Pilot data used `Pending Review`; the queue filtered `Pending` only, so **0 image rows** appeared.
4. **Missing JWT.** `HistoricalValidationQueue.tsx` called the queue without an Authorization header → **401**.
5. Existing orders were mostly **text/JSON ETL** (`HIST-ETL-*`) plus a 12-image August pilot — not the 716 JPEG archive.

---

## E. Pipeline Implemented

```
722 source files
      ↓
Recursive discovery + SHA-256 hash + manifest
      ↓
Gemini (when quota available)
      ↓
EasyOCR (local, if selected)
      ↓
Tesseract (fast local fallback)
      ↓
historical_images + historical_orders
      ↓
PENDING_REVIEW
      ↓
Admin → Historical Records → OCR Validation
      ↓
Human correction / approve / reject
      ↓
VALIDATED → Records tab → Analytics → ML-eligible
```

Rules enforced:

- Original source files are never modified.
- Re-runs are idempotent (hash / path / filename identity).
- Existing Gemini OCR with confidence > 0 is not overwritten by weaker local OCR.
- Missing values are left null; nothing is invented.
- Newly extracted records are **never** auto-marked VALIDATED.
- Existing 14 ML-eligible records were not used as proof that the archive was processed, and they were not retrained over.

---

## F. Fixes Applied Beyond Ingestion

### Status vocabulary

Authoritative persisted values:

- `PENDING_REVIEW`
- `VALIDATED`
- `CORRECTED`
- `REJECTED`

Legacy labels (`Pending`, `Pending Review`, `Validated`, `Corrected`, `Rejected`) are still accepted by queue, stats, Records filters, and ML eligibility so existing data is not lost.

### OCR Validation authentication

The frontend now sends the Admin JWT on:

- `GET /api/historical/processing/queue`
- `POST /api/historical/processing/validate/{id}`
- `POST /api/historical/processing/validate-order/{id}`

Backend still enforces Admin-only authorization. Unauthenticated requests remain 401.

### Missing validate-by-image endpoint

`POST /api/historical/processing/validate/{historical_image_id}` is now implemented in `backend/main.py` so Approve / Correct / Reject persist both image and order status.

### TypeScript `baseUrl` deprecation

`tsconfig.json` no longer uses deprecated `baseUrl`. Path aliases now use TS 6-compatible relative paths:

```json
"paths": {
  "@/*": ["./src/*"],
  "@": ["./src"]
}
```

Vite `@` alias is unchanged. `tsc --noEmit` completes without the TS 7.0 `baseUrl` deprecation error.

---

## G. Why Agent / Prompt Runs Felt Slow

The long waits were OCR batch jobs, not database registration.

| Work | Typical cost | Effect on Agent |
|---|---|---|
| Register 722 files without OCR | ~14 seconds | Fast |
| Gemini per image | ~20–40 seconds + quota | Stops after ~20–40/day on free tier |
| EasyOCR first load | several minutes (model download) | Looks hung |
| EasyOCR per image | ~25–130 seconds | Too slow for 676 images |
| Tesseract per image | ~2–3 seconds | Used for the remaining archive |

Python also buffered stdout, so progress looked frozen. Batch logging now flushes immediately (`python -u` / `flush=True`).

Recommended future command:

```powershell
cd backend
python -u historical_ocr_import.py --local-fallback --engine tesseract --no-normalize
```

---

## H. Files Changed

| File | Change |
|---|---|
| `backend/historical/ocr_status.py` | Canonical status vocabulary + legacy aliases |
| `backend/historical/ocr_engine.py` | Gemini + local fallback orchestration, PDF page rendering |
| `backend/historical/local_ocr.py` | EasyOCR / Tesseract runners |
| `backend/historical/local_ocr_parser.py` | Heuristic field parser for ML-relevant fields |
| `backend/historical_ocr_import.py` | Idempotent discover / register / retry / local fallback |
| `backend/main.py` | Queue filter, stats, image validate endpoint |
| `backend/api/historical_processing.py` | Status-consistent queue / validate / stats |
| `backend/ml/historical_ml_engine.py` | Accept `VALIDATED` / `CORRECTED` |
| `src/app/pages/HistoricalValidationQueue.tsx` | JWT on all API calls |
| `src/app/pages/HistoricalRecords.tsx` | Pass authenticated `user` into the queue |
| `tsconfig.json` | Remove deprecated `baseUrl` |
| `requirements.txt` | `pymupdf`, `pytesseract`, `easyocr` |

Artifacts written by the run:

- `backend/historical_data/output/image_index.csv`
- `backend/historical_data/output/image_processing_report.json`
- `backend/historical_data/output/local_tesseract_run.log`

---

## I. Tests Performed

| Test | Result |
|---|---|
| Recursive discovery of 722 files | Pass |
| Idempotent re-run (hash/path skip) | 17 pilot duplicates skipped; no uncontrolled duplicates |
| Legacy status normalization | 37 rows mapped to canonical labels |
| Queue filter now matches `PENDING_REVIEW` | 723 pending images visible (was 0) |
| Gemini OCR on handwritten / multi-item pilot | Confidence ~0.95 |
| EasyOCR on 5 zero-confidence images | Confidence ~0.61 |
| Tesseract bulk run | 678 records extracted |
| PDF discovery (6 monthly PDFs) | Registered via existing PyMuPDF page flow |
| Auth: queue without JWT | 401 (backend still enforced) |
| No auto-validation | VALIDATED image count still 2 |
| ML-eligible count | Still 14; no RF retraining from pending OCR |

---

## J. Remaining Blockers

1. **Human validation at scale.** 723 records are in the Admin queue. Do **not** try to validate all of them today. Validate the highest-quality / ML-relevant forms first.
2. **Local OCR quality.** Tesseract/EasyOCR extract useful structure (control no., dates, service codes, totals) but handwriting remains noisy. Admin correction is required before treating fields as business truth.
3. **2 remaining zero-confidence images.** Inspect those source paths if they still need a retry.
4. **Gemini free-tier quota.** Optional later upgrade for higher-quality extraction. Multiple API keys in the same project do not bypass project-level limits.
5. **PaddleOCR unavailable** on Python 3.14 in this environment.
6. **ML training dataset is still 14 records.** Do not retrain Random Forest from pending or raw OCR. Sequence remains:

```
SOURCE → OCR → PENDING_REVIEW → HUMAN VALIDATION → VALIDATED → ML ELIGIBLE → TRAINING
```

7. **Not deployed / not pushed.** Local implementation only, per instruction.

---

## K. Recommended Next Step for Evaluation

Do not wait for more Gemini calls and do not mass-validate 723 records.

1. Open **Admin → Historical Records → OCR Validation**.
2. Review a small set of high-confidence / complete forms (claimed date + services + priority + pairs).
3. Finalize those into **VALIDATED**.
4. Confirm they appear on the **Records** tab after refresh.
5. Retrain Random Forest only after additional **human-validated, ML-eligible** records exist.

That is the academically defensible path: a working ingestion + validation pipeline today, and a larger training set later from real validated history rather than from raw OCR.

---

*Generated from local inspection and the completed ingestion/OCR runs. Original historical source files were not modified. No records were auto-validated. No deployment or GitHub push was performed.*

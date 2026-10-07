# Heroku Slug-Size Remediation Report

**Date:** 2026-09-09  
**App:** `shoelotskey-villamor-pasay`  
**Branch:** `capstone-fixes` (local fix only — **not committed / not pushed / not deployed**)  
**Failed build symptom:** `Compiled slug size: 3.6G is too large (max is 1000M)`

---

## A. Original slug failure

Vite frontend build **succeeded**. Python `pip install -r requirements.txt` **succeeded**, then Heroku compression failed:

```text
Compiled slug size: 3.6G is too large (max is 1000M).
Push failed
```

Current live release remains older (`v126` ≈ `95b3a45`); add-on releases `v127–v129` did not ship the secured `main` revision.

---

## B. Root cause

Production `requirements.txt` included:

```text
easyocr>=1.7.0
```

On Linux/Heroku this resolves to **PyTorch + large NVIDIA/CUDA wheels**, which alone exceed the 1 GB slug limit.

---

## C. Dependency chain (from failed build log)

```text
easyocr
  → torch (~555 MB wheel)
  → torchvision
  → nvidia-cudnn / nvidia-cublas / nvidia-cuda-* / nvidia-nccl / …
  → triton, cuda-toolkit bindings, …
  → slug ≈ 3.6 GB compressed
```

Production dyno is **CPU-only**. CUDA packages are not required.

---

## D. OCR architecture (code evidence)

| Tier | Module | Production role |
|------|--------|-----------------|
| **Primary** | `backend/historical/ocr_engine.py` (Gemini / `google-genai`) | **Required on Heroku** — Admin re-OCR / import path |
| Optional local | `backend/historical/local_ocr.py` EasyOCR | Local/dev only when installed |
| Optional local | `pytesseract` + system Tesseract binary | Local/dev if binary present |
| Parser / review | `local_ocr_parser.py`, validation queue APIs | Unchanged — Admin review/validate/reject |

`easyocr_available()` / `tesseract_available()` already **no-op** when packages/binaries are missing. Removing EasyOCR from the production install does **not** remove the OCR workflow; Gemini remains primary.

---

## E. CPU / GPU decision

- **GPU/CUDA:** not required (`easyocr.Reader(..., gpu=False)` already).
- **Production:** Gemini CPU API path only (plus thin optional pytesseract wrapper without shipping Tesseract binary unless Aptfile is added later).
- **Local:** optional `requirements-ocr-local.txt` for EasyOCR experimentation.

---

## F. Packages removed / reduced (production)

| Change | Action |
|--------|--------|
| `easyocr>=1.7.0` | **Removed** from `requirements.txt` |
| Transitive `torch` / `torchvision` / NVIDIA CUDA | **No longer installed** on Heroku |
| OpenCV / scikit-image / etc. pulled only by EasyOCR | **No longer installed** |

---

## G. Packages retained (production)

FastAPI stack, SQLAlchemy, psycopg, pandas, scikit-learn, numpy, bcrypt, PyJWT, `google-genai`, Pillow, PyMuPDF, `pytesseract` (wrapper only).

New file: `requirements-ocr-local.txt` — EasyOCR for **local** installs only.

New file: `.slugignore` — excludes docs, tests, OCR ETL `output/`, local DB/secrets noise from the slug (does **not** strip required `historical_data` source images used by Admin image view).

---

## H. Local verification

| Check | Result |
|-------|--------|
| Key backend tests | **48 passed** |
| `npm run build` | **PASS** (~4m) |
| Clean disposable venv `pip install -r requirements.txt` | **Blocked this session** by PyPI network timeouts/resets — size measured from existing local venv instead |
| Existing local `venv` site-packages (already without torch/easyocr) | **~456 MB** |
| Tracked `backend/historical_data` (mostly source JPEGs) | **~381 MB** |
| `torch` / `easyocr` in slimmed requirements | **Absent** |

**Estimated Heroku compressed slug (after fix):** well under **1000 MB** (prior successful deploys of this app ran without EasyOCR; removing ~2.5+ GB of CUDA/torch restores that class of footprint). Exact MB will be confirmed on the next Heroku build log after commit/push (out of scope for this report).

---

## I. Build verification

- Frontend production build: **PASS**
- TypeScript: covered by Vite production build success (no separate `tsc` failure observed)
- Do **not** treat npm audit moderate findings as this release blocker

---

## J. OCR verification

- Code path: Gemini primary unchanged; local EasyOCR optional.
- Admin queue / validate / reject / re-OCR endpoints unchanged.
- **Production needs `GEMINI_API_KEY`** (and model name if customized). Confirm that config **name** exists on Heroku (do not paste values). It was **not** listed in the redacted config dump shared earlier — set it if missing or OCR re-run will fail closed to empty/local-unavailable.
- Also confirm **`FRONTEND_URL`** exists for CORS/reset-link origin (also missing from the shared name list).

---

## K. ML verification

**UNCHANGED** by this remediation:

- Random Forest artifacts / methodology not modified for slug fix
- Business Rules remain authoritative for `expected_at`
- ML remains advisory

(Note: working tree may show unrelated local `.pkl`/meta modifications from earlier training — they are **not** part of this slug fix and were not committed.)

---

## L. Estimated slug size

| State | Size |
|-------|------|
| Failed build | **3.6 GB** compressed |
| After removing EasyOCR/CUDA (estimate) | **Comfortably &lt; 1000 MB** (target: substantial margin; confirm on next Heroku build) |

---

## M. Remaining risks

1. **`GEMINI_API_KEY` / `FRONTEND_URL` must be present** on Heroku (names only — never paste secrets in chat).
2. **Secrets were exposed in a terminal paste** (DATABASE_URL, JWT_SECRET, Mailgun, New Relic, Rollbar). **Rotate those values** in Heroku after deploy hygiene; treat the paste as compromised.
3. Tracked historical JPEGs (~381 MB) remain in the slug for Admin image serving — acceptable for now; long-term object storage would shrink further.
4. Without EasyOCR on Heroku, if Gemini quota is exhausted, local fallback is limited unless a Tesseract **binary** is added via Apt buildpack later (optional follow-up — not required for slug fix).
5. Do not upgrade dyno/stack or install `heroku-builds` plugin to “solve” slug size.

---

## Files changed (local only)

- `requirements.txt` — drop EasyOCR
- `requirements-ocr-local.txt` — optional local EasyOCR
- `.slugignore` — exclude non-runtime bulk
- `backend/historical/local_ocr.py` — clarify optional/local role
- `backend/historical/ocr_engine.py` — docstring update

---

## Final status

# SLUG SIZE FIXED LOCALLY

| Item | Result |
|------|--------|
| Old slug | 3.6 GB |
| New estimated size | &lt; 1000 MB (confirm on next Heroku build) |
| OCR workflow code | PASS (Gemini primary retained) |
| Frontend build | PASS |
| Tests | 48 passed |
| ML | UNCHANGED |
| Business Rules | UNCHANGED |
| Git | **Not committed** (per instructions) |

**Next (when you authorize commit):** curated commit → push `capstone-fixes` → merge/update `main` → Heroku auto-deploy → confirm compressed slug in build log → production security probes → Owner/Admin smoke → ISO/TAM.

# Release Blocker Remediation Report — Shoelotskey

**Date:** 2026-09-09  
**Branch:** `capstone-fixes` @ `6dda508` + dirty working tree  
**Reference:** `origin/main` `95b3a45`  
**Restrictions honored:** no commit · no push · no deploy · no broad refactor · no ISO/TAM questionnaire edits · no OCR mass validate · BR/RF architecture preserved  

---

## Final status

# BLOCKERS FIXED LOCALLY

Local secured revision is ready for curated commit review,  
but has **NOT** been committed, pushed, or deployed.

**Production remains NO-GO until the secured revision reaches GitHub `main` and Heroku.**

---

## A. Confirmed blocker

| Production probe | Observed | Severity |
|------------------|----------|----------|
| `GET /api/services` unauthenticated | **200** (full catalog) | CRITICAL |
| `POST /api/predict` unauthenticated | **200** (legacy prediction) | CRITICAL |
| `GET /docs` | **200** | CRITICAL |
| `GET /openapi.json` | **200** | CRITICAL |

---

## B. Root cause

| Question | Finding |
|----------|---------|
| Are local security fixes committed? | **No** — uncommitted on dirty `capstone-fixes` |
| Are they only local? | **Yes** (plus WAL/SHM hygiene already staged) |
| Is `origin/main` secured? | **No** |
| Why is production open? | Production serves **`origin/main`-class code** |

Evidence from `git show origin/main:backend/main.py`:

```text
@app.post("/api/predict")
async def get_prediction(order_data: Dict[str, Any], db: Session = Depends(get_db)):
# ← no get_current_user

@app.get("/api/services")
def get_catalog(db: Session = Depends(get_db)):
# ← no get_current_user
```

No production `docs_url=None` / `openapi_url=None` gating on `origin/main`.

Local dirty tree already required auth; production never received that revision.

**Do not weaken local security to match production.**

---

## C. Files changed (this remediation pass)

| File | Change |
|------|--------|
| `backend/main.py` | Hardened `_IS_PRODUCTION` (`PORT` \| `DYNO` \| `ENV`); defense-in-depth middleware blocks `/docs`, `/redoc`, `/openapi.json` in Production |
| `backend/auth_utils.py` | Aligned Production detection with `DYNO` + `ENV=production\|prod` |
| `.gitignore` | Ensure `*.db-wal`, `*.db-shm`, `*.sqlite`, `.pytest_cache/` ignored |
| `backend/tests/test_release_security_blockers.py` | **New** focused unauth + OpenAPI config regression tests |
| `backend/db/shoelotskey.db-wal` / `.db-shm` | **Removed from Git index** (`git rm --cached`, staged deletion only) |

Local DB files remain on disk (not destroyed).

---

## D. Security correction

| Control | Local result |
|---------|--------------|
| `/api/services` requires `get_current_user` | **PASS** |
| `/api/predict` requires `get_current_user` | **PASS** |
| ML advisory; BR authoritative `expected_at` | **PASS** (unchanged architecture) |
| Production OpenAPI disabled when `_IS_PRODUCTION` | **PASS** (code + middleware) |
| Local `/docs` + `/openapi.json` retained | **PASS** (intended for localhost) |
| Duplicate/legacy unauth routes in local tree | **PASS** — none found |

Unauthenticated localhost probes (running server):

| Endpoint | Result |
|----------|--------|
| `GET /api/services` | **401** |
| `POST /api/predict` | **401** |
| `GET /api/activities` | **401** |
| `GET /api/historical/orders` | **401** |
| `GET /api/historical/image/...` | **401** |
| `POST /api/historical/bulk-import` | **401** |
| `POST /api/trigger-analytics-procedure` | **401** |
| `GET /docs` (localhost) | **200** (expected) |
| `GET /openapi.json` (localhost) | **200** (expected) |

Imported app check: `_IS_PRODUCTION=False`, `docs_url=/docs`, both route sources contain `get_current_user`.

---

## E. Tests performed

1. Live localhost unauthenticated HTTP probes (above)  
2. `pytest tests/test_release_security_blockers.py tests/test_ml_pipeline.py tests/test_business_rule_release.py`  
3. `npx tsc --noEmit`  
4. `npm run build`  
5. Source comparison: local vs `origin/main` for services/predict/OpenAPI  

Note: `tests/test_auth.py` is a standalone script (imports `database` via ad-hoc path) and is not a reliable pytest module; auth gate coverage is provided by `test_release_security_blockers.py`.

---

## F. Test results

| Check | Result |
|-------|--------|
| Focused pytest subset | **14 passed** |
| TypeScript `tsc --noEmit` | **PASS** (exit 0 with build job) |
| `npm run build` | **PASS** (~2m 26s) |
| Production live re-probe after deploy | **NOT VERIFIED** (no deploy) |

---

## G. Git hygiene

| Check | Result |
|-------|--------|
| `git ls-files` for `.env` | **PASS** — not tracked |
| Tracked `*.db-wal` / `*.db-shm` | **PASS** — untracked after staged `git rm --cached` |
| `.gitignore` covers env/db/wal/shm | **PASS** |
| Staged now | Only `D backend/db/shoelotskey.db-shm` and `D ...db-wal` |
| Blind `git add .` | **Not used** |
| Commit | **Not performed** |

Working tree remains dirty with the full secured application delta (intentional until curated commit).

---

## H. Remaining blockers (release / production — not local code)

These are **outside** local code correctness and still block GO:

1. **Curated commit** of secured tree on `capstone-fixes` (exclude secrets/DB/temp)  
2. **Push** `capstone-fixes` to GitHub  
3. **Merge to `main`**  
4. **Verify Heroku GitHub auto-deploy** for `main`  
5. **Verify Heroku config** (`JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL`, no `EXPOSE_HISTORICAL_STATIC`)  
6. **Re-probe production** until unauth services/predict/docs/openapi are **not** 200  
7. Owner + Admin production smoke  
8. Only then ISO/TAM respondents  

Production is **not** claimed fixed.

---

## I. Local release ready for commit?

| Question | Answer |
|----------|--------|
| Local security blockers fixed? | **YES** |
| Ready for curated commit review? | **YES** |
| Committed / pushed / deployed? | **NO** |
| Safe to give production URL to ISO/TAM respondents? | **NO** |

---

## Business Rules / ML (unchanged)

| Item | Status |
|------|--------|
| Official release = Business Rules → `expected_at` | Preserved |
| RF advisory only | Preserved |
| Feature vector / metrics / no retrain | Preserved (35 rows; MAE 7.61; R² 0.1959; RMSE 8.93) |
| No 85% accuracy claim | Honored |

---

*End of remediation report. Stopped without commit/push/deploy.*

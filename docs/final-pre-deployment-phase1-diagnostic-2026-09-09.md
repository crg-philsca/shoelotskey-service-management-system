# Final Pre-Deployment — Phase 1 Diagnostic (Inspect-Only)

**Date:** 2026-09-09  
**Branch:** `capstone-fixes` @ `6dda508` (+ large uncommitted working tree)  
**Reference:** `origin/main` @ `95b3a45`  
**Rule:** No code/DB changes during this phase. Fixes follow in Phase 10.

---

## 1. Executive verdict (pre-fix)

**NO-GO for deploy until Phase 10 HIGH items are closed and re-audited.**

Prior CRITICAL open-API findings from older reports are **mostly already fixed in current local code**. Remaining release blockers are honesty/RBAC/hardening gaps, not the classic unauthenticated predict/services holes.

---

## 2. Git state

| Item | Value |
|------|--------|
| Branch | `capstone-fixes` (no upstream tracking) |
| HEAD commit | `6dda508` Backup Antigravity state |
| origin/main | `95b3a45` (different line; local work is **ahead in content via uncommitted changes**, not commits) |
| Remotes | `origin` (GitHub), `heroku` |
| Secrets risk | `.env` appears untracked (`??` / local); do **not** commit `.env`, `*.db-wal`, `*.db-shm` |

---

## 3. Already fixed (do not re-fix)

| Prior blocker | Current evidence | Status |
|---------------|------------------|--------|
| Unauth `POST /api/predict` | `Depends(get_current_user)` | FIXED |
| Unauth `GET /api/services` | `Depends(get_current_user)` | FIXED |
| Unauth `POST /api/activities` + forged username | Auth + actor from JWT | FIXED |
| Unauth historical bulk-import | `require_role("admin")` on live `main.py` route | FIXED |
| Unauth analytics trigger | `require_role("owner")` | FIXED |
| Public `/historical_data` StaticFiles | Mount only if `EXPOSE_HISTORICAL_STATIC` and not Production | FIXED (default) |
| Hardcoded JWT fallback | Missing secret → boot `RuntimeError` | FIXED |
| Pass-the-hash / plaintext login | bcrypt only | FIXED |
| Production SQLite failover | Fail-closed in Production | FIXED |
| Owner UI vs API historical mismatch | Both admin-only (aligned) | FIXED (consistent) |
| Auth lockout + JWT expiry | Present | FIXED |

---

## 4. Confirmed findings to fix (Phase 10)

### CRITICAL / HIGH

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| H1 | HIGH | OpenAPI `/docs` `/redoc` `/openapi.json` enabled in Production | `main.py` FastAPI() defaults; no prod disable |
| H2 | HIGH | Owner can create/promote `admin` (privilege escalation) | `create_user` / `update_user` accept any role |
| H3 | HIGH | ML UI labels R²×100 as “Prediction Accuracy” | `HistoricalRecords.tsx` ~1566–1568 |
| H4 | HIGH | ML target honesty: trains on claim−received but metadata says “service readiness” | `historical_ml_engine` + `.meta.json` |
| H5 | HIGH | Inventory stock deduction is non-atomic RMW | `main.py` create/update/adjust paths |

### MEDIUM

| ID | Severity | Finding |
|----|----------|---------|
| M1 | MEDIUM | 500 responses always include `debug_info` file/line |
| M2 | MEDIUM | `is_retail` / `retail_price` not in startup ALTER; local-only migrate script |
| M3 | MEDIUM | Customer name+contact no unique constraint (race duplicates) |
| M4 | MEDIUM | Latent unauth routes in unmounted `api/historical_processing.py` router |
| M5 | MEDIUM | Misnamed `GET /api/temp/debug_image` runs DDL |
| M6 | MEDIUM | Split inventory SoT (`Order`/`Item` JSON vs `InventoryLog`) |

### Documented policy (not a hole)

| ID | Finding | Decision |
|----|---------|----------|
| P1 | Historical / OCR / train / export = **Admin only** | **Intended evaluation role for Historical/OCR analytics = Admin.** Owner uses Job Order Form ML (`/api/predict`) + operational TAM modules. FE+BE already aligned. Do not weaken to Staff. |

---

## 5. ML readiness (Phase 1)

| Check | Result |
|-------|--------|
| Random Forest present | YES (`completion_model.pkl`, `historical_rf_model.pkl`) |
| Live predict authenticated | YES |
| BR official vs ML separate | YES — ML does not overwrite `expected_at` |
| Feature leakage | PASS (order-time features) |
| Train on validated only | PASS |
| Metrics honesty | FAIL (UI accuracy misuse); true R² ≈ 0.20 on n=35 |
| Capstone target wording | PARTIAL — actual target is order-to-claim span |

**Do not remove ML.** Fix labeling and keep RF demonstrable.

---

## 6. Next step

Phase 10: fix H1–H5 and M1–M2 (safe). Leave M3/M6 as documented residual unless low-risk. Then Phase 11 full re-audit + final GO gate.

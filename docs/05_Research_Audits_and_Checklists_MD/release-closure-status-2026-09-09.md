# Release Closure Status — 2026-09-09

**Objective:** Release closure for formal ISO/TAM evaluation — **not** chasing ISO PARTIALs.

## Completed this session

| Step | Result |
|------|--------|
| Local security re-verify | Unauth `/api/predict`, `/api/services`, lookups → **401** |
| Key tests | **48 passed** (security blockers, BR, ML, OCR review, reset-link) |
| Curated commit | `3850109` on `capstone-fixes` |
| Secrets / DB hygiene | No tracked `.env`; **removed** tracked `shoelotskey.db-wal` / `.db-shm` |
| Excluded from commit | `backend/.env`, local DB, OCR `historical_data/output/*`, `inspect_users.py`, plan scratch |
| Push `capstone-fixes` | Done → `origin/capstone-fixes` |
| Merge + push `main` | Done → `origin/main` = **`3850109`** |

## Production deploy verification (blocking FINAL GO)

Probed ~2 minutes after `main` push — host still serving **unsecured** surface:

| Probe | Status after push |
|-------|-------------------|
| `GET /api/services` (no auth) | **200** (still open) |
| `POST /api/predict` (no auth) | **200** (still open) |
| `GET /docs` | **200** (still open) |
| `GET /openapi.json` | **200** (still open) |

**Interpretation:** GitHub `main` has the secured revision, but Heroku has **not** yet been verified as running `3850109`. Likely causes: auto-deploy not connected to `main`, deploy still building, or deploy failed.

### Owner action required (CLI not authenticated in this session)

1. Heroku Dashboard → App `shoelotskey-villamor-pasay` → Deploy → confirm GitHub connected to **`main`** + automatic deploys enabled  
2. Confirm latest deploy SHA / release = `3850109` (or trigger Manual Deploy of `main`)  
3. Config vars present (confirm names; do not paste secrets into chat/docs): `JWT_SECRET`, `DATABASE_URL` (Postgres), `FRONTEND_URL`, plus mail/OCR keys if used  
4. Ensure `EXPOSE_HISTORICAL_STATIC` is **unset** in production  
5. Re-probe until: unauth predict/services → **401**, `/docs` + `/openapi.json` disabled/404  
6. Owner + Admin smoke (`docs/final-release-gate-audit-2026-09-09.md` §19)  
7. Then hand frozen ISO to IT Experts and frozen TAM to Owner + 2 Staff  

## Explicit non-goals (do not “fix”)

- Do not chase 19 ISO PARTIAL labels into app rewrites  
- Do not distort RF to manufacture 85% accuracy  
- Do not invent TAM Attitude items; BI/ASU need real respondents  
- Do not refactor large `main.py` / JobOrderForm pre-evaluation unless a real P0/P1 risk appears  

## Gate

**CONDITIONAL GO** — clean release is on GitHub `main` (`3850109`).  
**FINAL GO** only after production SHA + config verified, security probes pass on the live host, and Owner/Admin smoke completes.

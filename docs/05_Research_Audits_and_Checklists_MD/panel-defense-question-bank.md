# Panel Defense Question Bank — Shoelotskey

**Date:** 2026-09-09  
**Rule:** Answer only what the system actually does. State limitations honestly.  
**Locked ML wording:** RF estimates historical completion duration from validated patterns; duration → advisory ML date; Business Rules → official `expected_at`.

---

## How to answer (every time)

1. What the system does  
2. Why the design was chosen  
3. Evidence  
4. Limitation  
5. Future improvement (optional)

---

## A. Architecture & uniqueness (1–10)

| # | Question | Best answer (evidence-based) | Follow-up |
|---|----------|------------------------------|-----------|
| 1 | What is unique about Shoelotskey? | Integrated shoe-service SMS: JO lifecycle + inventory + calendar + sales/expenses + audit + OCR historical gate + dual BR/ML dates — not a generic POS. | What is *not* unique? |
| 2 | Is this just a CRUD app? | Core is CRUD + workflow, but uniqueness is **domain rules** (service combos, BR official dates) + **validated historical ML** + OCR quality gate. | Show a combo rule. |
| 3 | Why SPA + REST? | Clear client/server boundary; Heroku can serve build + API; JWT fits SPA. | Why not SSR? |
| 4 | Why FastAPI? | Typed Python APIs, async-friendly, fits ML/OCR in same language as training. | Why not Django? |
| 5 | Why React + TypeScript? | Component UI for complex JO form; TS reduces contract drift with APIs. | Why not Angular? |
| 6 | Why PostgreSQL in production? | Concurrent multi-user shop data, backups, Heroku PG. | Why SQLite locally? |
| 7 | Why SQLite locally? | Offline/defense continuity for development only; prod refuses SQLite failover. | Does prod use SQLite? |
| 8 | Why Heroku? | Fits student/capstone deploy (buildpacks, PG addon, GitHub auto-deploy). | Limitation? |
| 9 | Where are trust boundaries? | Browser untrusted; API authz authoritative; DB behind ORM; files auth’d. | Can user edit JS? |
| 10 | Why is `main.py` large? | Capstone delivery speed; documented debt; not a security claim. | Refactor plans? |

## B. Security & cyber (11–25)

| # | Question | Best answer | Follow-up |
|---|----------|-------------|-----------|
| 11 | How do you stop Staff opening Admin pages? | Frontend route guards **and** backend `require_role`. | Change localStorage role? |
| 12 | What if they change the API body? | Server validates JWT + role + business rules; rejects unauthorized. | Show 401/403. |
| 13 | Can someone view source? | Yes — SPA is delivered to browser. Security ≠ obscurity; secrets must not ship. | Secrets in bundle? |
| 14 | How prevent SQL injection? | SQLAlchemy parameterized ORM; validate inputs. | Any raw SQL? |
| 15 | How prevent XSS? | React default escaping; avoid unsafe HTML. | Audit remaining sinks. |
| 16 | Login lockout? | 3 failed attempts → 15-minute lock. | Brute force still possible? |
| 17 | Session timeout? | ~30-minute inactivity logout on client + JWT expiry. | Absolute session max? |
| 18 | Password storage? | bcrypt hashes; no plaintext login migration. | Pass-the-hash? |
| 19 | Historical images public? | No — auth’d fetch; production must keep static expose off. | Path traversal? |
| 20 | What is OWASP 2025 A03 supply chain? | Dependency risk; we pin deps; **full CVE scan NOT VERIFIED** this audit. | npm audit? |
| 21 | Exception handling? | Prod returns safe errors; PG outage → 503 (no SQLite downgrade). | Local offline? |
| 22 | Audit logs? | Who/what/when/module via `log_audit` + Activity History (Owner). | Fail-open? |
| 23 | IDOR? | Object access should require auth; **exhaustive IDOR NOT VERIFIED**. | Test order IDs. |
| 24 | CSRF? | Bearer JWT in header reduces classic cookie CSRF; still validate origins where cookies used. | Cookies? |
| 25 | Insider threat? | RBAC + audit; Admin path for historical only. | Separation of duties? |

## C. Sync / offline / failure (26–35)

| # | Question | Best answer | Follow-up |
|---|----------|-------------|-----------|
| 26 | Does the system work offline? | **Not as a full offline product.** Primarily online. Local may use SQLite continuity; production does not. | PWA? |
| 27 | What if internet drops mid Job Order? | Request fails or client **queues** change; may show queued success — not server-confirmed. Already committed records remain. | Duplicate on reconnect? |
| 28 | Does SQLite auto-sync to PostgreSQL? | **No automatic production bidirectional sync.** Cloud→local mirror for local backup; optional push endpoints for recovery. | Source of truth? |
| 29 | What if PostgreSQL is down? | Production: **503 / fail closed**. No silent SQLite admin DB. | Backup? |
| 30 | What if Heroku is down? | App unavailable until platform recovers; data in PG if intact. | RTO? |
| 31 | Two staff update same stock? | Risk of race; some paths use row locks (`with_for_update`); residual concurrency debt. | Demo race. |
| 32 | False success offline? | Create can toast success when queued — limitation to disclose. | Fix UX? |
| 33 | Cached data? | SPA may hold context/localStorage; refresh after reconnect. | Stale UI? |
| 34 | Retry behavior? | Online event / queue flush attempts; not guaranteed complete sync. | Conflicts? |
| 35 | Is ErrorPage offline copy accurate? | Treat carefully — prefer fail-safe wording above. | Update copy? |

## D. ML / OCR / BR (36–50)

| # | Question | Best answer | Follow-up |
|---|----------|-------------|-----------|
| 36 | What does ML predict? | Historical **completion duration** (days) from validated patterns → advisory release date. | Exact ready day? |
| 37 | Official date source? | **Business Rules** → `expected_at`. | ML overwrite? |
| 38 | Why not ML as official? | Small sample (35), claim-span target, MAE ~7.6; BR is controlled ops. | When switch? |
| 39 | Why Random Forest? | Nonlinear interactions among services/conditions; ensemble average of trees. | vs XGBoost? |
| 40 | Features used? | 18: service qtys, pairs, priority, grand total, calendar, condition counts. | Material? |
| 41 | Why no material/workload? | Not consistently available in validated historical + live parity; future expansion. | Add now? |
| 42 | Target variable? | `ClaimedDate − DateReceived` (1–60 days). | Leakage? |
| 43 | Training size? | 35 eligible; 28/7; August 2025 intake. | Why small? |
| 44 | Metrics? | MAE 7.61, R² 0.1959, RMSE 8.93 — **not** 85% accuracy. | Improve how? |
| 45 | OCR role? | Quality gate; PENDING_REVIEW → human → VALIDATED before ML. | Auto-train all 725? |
| 46 | 725 records? | Most still pending; only eligible validated rows train. | Mass validate? |
| 47 | Formula trees? | \(\hat y=(1/150)\sum \hat y_t\); then `max(1,round)`. | Depth? |
| 48 | Combo rules? | BR service combination overrides / longest duration / rush floor. | Examples. |
| 49 | Dual UI labels? | BUSINESS RULES vs ML PREDICTION on Job Order Form. | Details modal? |
| 50 | Retrain before deploy? | **No** unless intentional ML change approved; `.pkl` left unchanged for cleanup. | When retrain? |

## E. ISO / TAM / evaluation (51–60)

| # | Question | Best answer | Follow-up |
|---|----------|-------------|-----------|
| 51 | Who evaluates ISO? | IT Experts / Practitioners ≥5 years; 45 statements. | Your score? |
| 52 | Who evaluates TAM? | Owner + 2 Staff; 20 statements. | Attitude construct? |
| 53 | Why ISO ≠ TAM? | Product quality vs acceptance/use perception. | Overlap? |
| 54 | Are you ISO compliant? | We prepared **traceability**; compliance is **evaluator judgment** after use. | Fake scores? |
| 55 | Are you TAM accepted? | **Not yet** — readiness ≠ acceptance. | When? |
| 56 | What if evaluators find defects? | Log, triage severity, fix, re-smoke, re-evaluate as needed. | Blockers? |
| 57 | Current readiness decision? | **CONDITIONAL GO** — deploy secured revision first; prod still has open APIs. | GO? |
| 58 | Weaknesses? | Monolith files; small ML set; OCR backlog; residual concurrency; prod lagging local security. | Hide? |
| 59 | Limitations? | Online-first; claim-based ML target; single shop; Heroku dependency. | Acceptable? |
| 60 | Next improvements? | Deploy secured build; OCR validate more months; optional material/workload after data quality; modularize routers. | Timeline? |

## F. Trick questions (short)

| Trick | Answer |
|-------|--------|
| Excel vs system? | Concurrent multi-user + RBAC + audit + calendar + dual estimate + OCR/ML — Excel cannot safely do this for the shop. |
| Innovation? | Domain BR + advisory RF + human-validated historical OCR pipeline integrated into one SMS. |
| 100% secure? | **No.** Controls reduce risk; continuous verification required. |
| Bug free? | **No.** Known debt documented. |
| Offline capable? | **Not fully.** Online-first; safe fail / optional queue. |
| Auto sync all data? | **No** production bidirectional auto-sync claim. |
| Exact ready date from ML? | **No** — duration from claim-span patterns; BR is official. |

---

**Minimum 60 questions covered.** Expand during rehearsal with live demos of Job Order BR/ML labels, lockout message, and 401 on local unauth APIs.

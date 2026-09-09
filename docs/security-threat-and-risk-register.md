# Security Threat and Risk Register — Shoelotskey

**Date:** 2026-09-09  
**Frameworks referenced:** OWASP Top 10:2025 · NIST CSF 2.0 (risk view only — **not certified**)  
**No secrets in this document.**

---

## 1. Assets

Customer PII · Job orders · Payments/sales/expenses · Inventory · Historical scans/OCR · ML models · User accounts · Audit logs · DB · Env secrets · Production availability  

## 2. Actors

Unauthenticated internet user · Staff · Owner · Admin · Compromised browser · Malicious insider · Bot · Stolen JWT · Attacker with API access  

---

## 3. OWASP Top 10:2025 (implementation + live probe)

| ID | Category | Result | Evidence / notes |
|----|----------|--------|------------------|
| A01 | Broken Access Control | **FAIL (prod) / PASS (local)** | Prod: unauth `GET /api/services` **200**, `POST /api/predict` **200**. Local: both **401**. |
| A02 | Security Misconfiguration | **PARTIAL** | OpenAPI off in prod code; local docs open. Hist static gated. Dirty deploy tree. |
| A03 | Software Supply Chain Failures | **NOT VERIFIED** | No fresh npm/pip CVE audit this pass. |
| A04 | Cryptographic Failures | **PASS (local design)** | JWT_SECRET required; bcrypt; HTTPS on prod URL. |
| A05 | Injection | **PARTIAL** | ORM primary; residual raw SQL migrations at boot. |
| A06 | Insecure Design | **PARTIAL** | Dual BR/ML good; inventory JSON duplication; queue “success” UX. |
| A07 | Authentication Failures | **PARTIAL** | 3 fails / 15-min lockout in code; inactivity timeout in UI; live lockout not re-proven. |
| A08 | Software/Data Integrity Failures | **PARTIAL** | Trusted pickle models; customer unique deferred. |
| A09 | Security Logging and Alerting Failures | **PARTIAL** | Audit exists; fail-open `log_audit`; no SIEM. |
| A10 | Mishandling of Exceptional Conditions | **PARTIAL** | Prod PG→503; local SQLite fallback; FE may toast success on offline queue. |

---

## 4. NIST CSF 2.0 view (practical, not certification)

| Function | Status | Notes |
|----------|--------|-------|
| **Identify** | PARTIAL | Assets known; formal asset inventory limited |
| **Protect** | PARTIAL | Auth/RBAC/TLS present locally; **prod API auth gap** |
| **Detect** | PARTIAL | Audit logs; limited alerting |
| **Respond** | PARTIAL | Safe HTTP errors; no formal IR runbook evidenced |
| **Recover** | PARTIAL | Heroku PG backups **NOT VERIFIED**; local sync mirror exists |

---

## 5. Risk register

| Risk | Likelihood | Impact | Level | Current control | Residual | Mitigation |
|------|------------|--------|-------|-----------------|----------|------------|
| Unauth API on production (catalog/predict) | **High (verified)** | High | **Critical** | Fixed in local tree, **not deployed** | High until deploy | Curated commit → main → Heroku smoke |
| Stolen JWT | Med | High | High | Expiry + HTTPS | Med | Short TTL; logout; HTTPS only |
| Privilege escalation Staff→Admin | Low–Med | High | High | Backend `require_role` | Med | Keep Admin historical-only; never trust FE role |
| SQL injection | Low | High | Med | ORM | Low–Med | Avoid new raw SQL |
| XSS stored/reflected | Med | Med | Med | React escaping | Med | Continual review of `dangerouslySetInnerHTML` |
| Inventory race / lost update | Med | Med | Med | `with_for_update` on some paths | Med | Extend locking; monitor stock |
| Offline queue false success | Med | Med | Med | Client queue | Med | UX: “queued, pending sync” |
| OCR/ML data poison | Med | Med | Med | Human validation gate | Med | Keep no mass-validate |
| ML over-trust | Med | Med | Med | BR authoritative | Low | Defense wording locked |
| Secret leak in git | Low–Med | Critical | High | `.gitignore`; WAL/SHM staged delete | Med | Curated commit; never `git add .` |
| Heroku/PG outage | Low | High | Med | 503 fail-closed | Med | Confirm backups |
| Dependency CVE | Unknown | Var | Med | Pins in lockfiles | Unknown | Run audit before release |
| Insider misuse | Low | High | Med | RBAC + audit | Med | Least privilege |
| Path traversal historical files | Low–Med | High | Med | Auth’d image routes | Med | Keep static expose off in prod |

---

## 6. Authentication / authorization summary

| Control | Status |
|---------|--------|
| JWT + bcrypt | Implemented (local) |
| 3 attempts / 15-min lockout | Implemented in login code |
| 30-min inactivity | Frontend session policy (code) |
| Unauth protected APIs (local) | **401** for services/predict |
| Unauth protected APIs (prod) | **FAIL** — services/predict open |
| Historical Admin gate | Present in SPA + API role checks |
| IDOR exhaustive matrix | **NOT VERIFIED** this pass |

---

## 7. Defense-safe security statements

- “Security decisions are enforced on the **server**. Changing JavaScript or Network tab payloads does not grant Owner/Admin rights if the JWT lacks the role.”
- “We do **not** claim the system is 100% secure or formally OWASP/NIST certified.”
- “Current production must be updated to the secured revision before formal evaluation.”

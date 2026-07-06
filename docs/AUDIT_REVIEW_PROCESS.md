# Audit Review Process

**Cornea Clinic EMR — VisionEMR**  
**Version:** 1.0 (Project 9)  
**Effective:** 2026-07-06

---

## Purpose

Define how audit logs are reviewed to detect unauthorised access, data integrity issues, and compliance gaps.

---

## Data sources

| Source | Access |
|--------|--------|
| Cloud `audit_logs` | Clinic UI → Audit Trail tab; API `GET /api/v1/audit-logs` |
| Admin audit API | `GET /api/v1/admin/audit-logs` (requires `audit:read`) |
| Local device audit | IndexedDB `audit_logs` store (pre-sync) |
| Failed logins | `GET /api/v1/admin/security/status` |

Retention: **7 years** cloud (`docs/DATA_RETENTION_POLICY.md`).

---

## Weekly review (clinic manager or delegate)

**Duration:** 15 minutes

1. Run `npm run medicolegal:audit-review` (or review Audit Trail tab filters).
2. Check **failed logins** — spike > 20/week → investigate IP and accounts.
3. Sample **delete** and **merge** actions — confirm authorised users.
4. Note any anomalies in governance log (spreadsheet or ticket).

---

## Monthly review (CMIO + IT)

1. Export audit sample (`medicolegal:audit-review --limit=100 --json`).
2. Cross-check with **user role changes** (`admin/users` actions).
3. Verify **backup drill** and **security verification** ran (`verify:backup-dr`, `verify:security`).
4. Update `docs/governance-reports/` archive.

---

## Quarterly review (Governance Committee)

1. Present audit trends, incidents, and pen-test status.
2. Re-approve retention and consent policies.
3. Role review — least privilege for production accounts.
4. Sign minutes; file with clinical governance records.

---

## Escalation

| Finding | Action |
|---------|--------|
| Suspected unauthorised access | P1 incident — `docs/INCIDENT_RESPONSE.md` |
| Bulk export / research download | Verify user role and approval |
| Repeated failed admin login | Disable account; password reset |
| Missing audit entries after known change | Open dev ticket; check API logs |

---

## Automated tooling

```powershell
# Sample audit log review
npm run medicolegal:audit-review

# Full medicolegal verification
npm run verify:medicolegal

# Security posture (failed logins, sessions)
npm run security:auth-sessions
```

---

## Related

- `docs/CLINICAL_GOVERNANCE.md`
- `docs/DATA_RETENTION_POLICY.md`
- `apps/clinic/cornea-audit-trail.js`

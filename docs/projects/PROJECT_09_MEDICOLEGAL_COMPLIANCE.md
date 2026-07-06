# Project 9 — Medicolegal Compliance

**Status:** Complete  
**Scope:** Data retention policy, consent management, governance documents, audit review process.

---

## What shipped

### Governance documents
| Document | Purpose |
|----------|---------|
| `docs/DATA_RETENTION_POLICY.md` | Clinical records, audit logs, backups, media retention |
| `docs/CONSENT_MANAGEMENT.md` | Laser, surgical, teaching, and research consent |
| `docs/CLINICAL_GOVERNANCE.md` | Roles, change control, sign-off checklist |
| `docs/AUDIT_REVIEW_PROCESS.md` | Weekly/monthly/quarterly audit review cadence |

### Verification & review
| Component | Purpose |
|-----------|---------|
| `scripts/verify-medicolegal-compliance.mjs` | Eleven checks (M1–M11); writes `docs/governance-reports/latest.json` |
| `scripts/lib/medicolegal-compliance-checks.mjs` | Shared helpers (tested) |
| `scripts/review-audit-logs.mjs` | Sample audit log review with findings |

### npm scripts
```powershell
npm run verify:medicolegal           # full P9 verification + JSON report
npm run test:medicolegal-compliance    # static check unit tests
npm run medicolegal:audit-review       # live audit sample (needs credentials)
```

---

## Checks (M1–M11)

| ID | Check |
|----|-------|
| M1 | All four governance documents with required sections |
| M-retention … M-audit-review | Individual doc validation |
| M5 | Verification script (`verify:medicolegal`) |
| M6 | Consent modules (laser + teaching) |
| M7 | Audit logging API + clinic UI |
| M8 | Audit review script |
| M9 | Governance links to `INCIDENT_RESPONSE.md` |
| M10 | This project doc |
| M11 | Live audit log sample (needs credentials) |

---

## Operator workflow

1. **Annual:** Governance Committee approves retention and consent policies
2. **Weekly:** `npm run medicolegal:audit-review` (15 min)
3. **Monthly:** Archive governance report; cross-check with `verify:security`
4. **Quarterly:** Role review + policy re-sign per `AUDIT_REVIEW_PROCESS.md`

```powershell
$env:STAGING_E2E_EMAIL = "admin@example.com"
$env:STAGING_E2E_PASSWORD = "your-password"
npm run medicolegal:audit-review
```

---

## Institutional sign-off (operator)

Policies are **documented and verifiable** in-repo. Formal approval requires:

- [ ] Clinical Governance Committee minutes
- [ ] Medical Director / CMIO signature on retention policy
- [ ] Privacy officer review of consent management

---

## Rollback

Remove governance docs and scripts; no application code changes.

---

## Readiness impact

Estimated **+4% governance readiness** — formal retention, consent, governance, and audit review process with automated verification.

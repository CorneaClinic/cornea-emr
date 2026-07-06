# Clinical Governance

**Cornea Clinic EMR — VisionEMR**  
**Version:** 1.0 (Project 9)  
**Effective:** 2026-07-06

---

## Purpose

Define clinical governance structure, responsibilities, and change control for the Cornea EMR platform.

---

## Roles

| Role | Responsibilities |
|------|------------------|
| **Medical Director / CMIO** | Clinical safety sign-off; prioritise production readiness roadmap |
| **Lead cornea consultant** | Workflow validation; registry data quality |
| **Clinic manager** | Operator procedures; backup drills; user access requests |
| **IT / dev lead** | Deployments, security hardening, incident response |
| **Reception** | Patient registration; duplicate checks; no clinical edits |

RBAC enforced in API (`requirePermission`); receptionist role blocked from admin and research export.

---

## Change control

1. **Production readiness projects (P1–P12)** — sequential delivery per `docs/PRODUCTION_READINESS_ROADMAP.md`.
2. **No new clinical modules** until ≥90% readiness and Project 12 audit.
3. **Hotfixes** — branch from `main`, CI green, clinic or API deploy per `docs/DEPLOY_ROLLBACK.md`.
4. **Configuration changes** (WAF, DO env) — document in runbooks; smoke test after change.

---

## Sign-off

### Production pilot (conditional go-live)

- [ ] Medical Director — clinical workflows acceptable for pilot
- [ ] CMIO — data safety and audit trail adequate
- [ ] Clinic manager — backup/DR and operator runbooks trained
- [ ] IT lead — security checklist (`npm run verify:security`) green
- [ ] Governance Committee — retention and consent policies approved

### Annual review

- Data retention policy (`docs/DATA_RETENTION_POLICY.md`)
- Consent management (`docs/CONSENT_MANAGEMENT.md`)
- Pen-test / ASVS status (`docs/PENTEST_REMEDIATION.md`)

---

## Incident and safety

- **Clinical safety events:** document in incident log; review at weekly governance meeting.
- **Technical incidents:** follow `docs/INCIDENT_RESPONSE.md` severity guide (P1–P3).
- **Escalation:** P1 within 1 hour to Medical Director + IT lead.

---

## Verification

```powershell
npm run verify:medicolegal
npm run verify:gates
npm run verify:security
```

Reports: `docs/governance-reports/latest.json`

---

## Related

- `docs/PRODUCTION_READINESS_ROADMAP.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/SECURITY_BASELINE.md`
- `docs/AUDIT_REVIEW_PROCESS.md`

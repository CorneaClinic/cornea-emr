# Go-Live Deployment Checklist

**Cornea Clinic EMR - production release gate**

Use this checklist before every go-live window and major production release.

---

## Change metadata

- Release ID:
- Date/time window:
- Release owner:
- Clinical approver:
- Rollback commit / deployment reference:

---

## Pre-deployment gates

- [ ] CI green on target commit.
- [ ] `npm run verify:production` PASS.
- [ ] `npm run verify:clinical` PASS.
- [ ] `npm run verify:medicolegal` PASS.
- [ ] `npm run verify:go-live` PASS.
- [ ] Required release notes shared with clinic leadership.

---

## Backup and recovery readiness

- [ ] Latest database backup completed and verified.
- [ ] Off-site backup copy confirmed.
- [ ] Restore drill status within expected policy window.
- [ ] Rollback path reviewed (`docs/DEPLOY_ROLLBACK.md`).

---

## Deployment execution

- [ ] Deployment started during approved window.
- [ ] API deployment health confirms success.
- [ ] Clinic UI deployment confirms success (if applicable).
- [ ] No blocking migration/runtime errors.

---

## Post-deployment smoke checks

- [ ] Cloud login succeeds.
- [ ] Patient search and chart open succeed.
- [ ] Registration/check-in flow succeeds.
- [ ] One clinician workflow save + sync succeeds.
- [ ] Audit log entry appears for test action.

---

## Downtime / incident readiness

- [ ] Team can access `docs/DOWNTIME_SOP.md`.
- [ ] Escalation contacts validated.
- [ ] Incident response path confirmed (`docs/INCIDENT_RESPONSE.md`).

---

## Go / no-go sign-off

- [ ] Technical sign-off complete.
- [ ] Clinical sign-off complete.
- [ ] Operations sign-off complete.
- [ ] Governance sign-off complete.

Decision: **GO / CONDITIONAL GO / NO GO**

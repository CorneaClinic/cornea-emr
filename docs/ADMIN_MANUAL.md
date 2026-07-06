# Admin Manual (Go-Live)

**Cornea Clinic EMR — Admin Operations**

---

## Purpose

This manual defines daily admin responsibilities for production operations, user governance, and audit readiness.

---

## Daily tasks

1. Confirm API health (`/health/live`) and clinic reachability.
2. Review sync warnings and failed login spikes.
3. Verify backup status and off-site copy completion.
4. Confirm no unresolved P1/P2 incidents.

---

## User and role governance

- Create user accounts only on written approval from clinic leadership.
- Enforce least privilege (reception, clinician, admin).
- Review role and permission changes weekly.
- Disable inactive accounts within 24 hours of separation.

---

## Security and compliance checks

- Run `npm run verify:security` weekly.
- Run `npm run verify:medicolegal` monthly.
- Review `docs/governance-reports/latest.json` and archive monthly snapshots.
- Validate incident runbook alignment in `docs/INCIDENT_RESPONSE.md`.

---

## Deployment controls

- Deploy only after CI green and checklist completion.
- Record deployment window, approver, and rollback point.
- Use `docs/GO_LIVE_DEPLOYMENT_CHECKLIST.md` for every production change.
- If post-deploy smoke fails, execute rollback per `docs/DEPLOY_ROLLBACK.md`.

---

## Escalation

- **P1:** call clinic lead + dev/ops immediately.
- **P2:** same-day action with written incident note.
- **P3:** queue next business day with owner and due date.

---

## Evidence retention

Keep for audit:

- Deployment checklist records
- Incident timelines and root-cause notes
- Weekly security and medicolegal verification outputs

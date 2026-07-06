# Pilot Weekly Checklist

**Cornea Clinic EMR — operator weekly review**

Complete once per week during the 90-day pilot.

---

## Week metadata

- Pilot week number (1–13):
- Review date:
- Review owner:
- Attendees:

---

## Platform health

- [ ] `npm run health:production` PASS.
- [ ] `npm run verify:production` PASS.
- [ ] `npm run verify:clinical` PASS.
- [ ] `npm run verify:security` PASS.
- [ ] `npm run verify:medicolegal` PASS.
- [ ] `npm run verify:go-live` PASS.
- [ ] `npm run verify:pilot` PASS.

---

## Safety monitoring

- [ ] Review `docs/PILOT_SAFETY_MONITORING.md` thresholds.
- [ ] Run `npm run pilot:weekly-review` and archive output.
- [ ] Confirm no unresolved P1 incidents.
- [ ] Confirm duplicate-patient escalations reviewed.
- [ ] Confirm consent exceptions reviewed.

---

## Clinical operations

- [ ] Reception workflow issues logged and assigned.
- [ ] Clinician chart/sync issues logged and assigned.
- [ ] Downtime or reconciliation events reviewed.
- [ ] Training gaps identified and scheduled.

---

## Governance evidence

- [ ] Audit review completed (`npm run medicolegal:audit-review` when credentials available).
- [ ] Backup/DR status reviewed (`npm run verify:backup-dr`).
- [ ] Deployment changes recorded with rollback reference.

---

## Weekly decision

- [ ] Continue pilot
- [ ] Corrective action required
- [ ] Escalate to clinical governance

Notes and action owners:

# Clinician Manual (Go-Live)

**Cornea Clinic EMR — Clinical Operations**

---

## Purpose

This manual defines clinician workflows for safe production usage during and after go-live.

---

## Start-of-day checks

1. Sign in and confirm patient lookup, appointments, and chart open.
2. Validate one test chart load for slit-lamp and topography views.
3. Confirm media capture/import panel availability.
4. Report issues before first patient if any module is unavailable.

---

## During clinic

- Use verified workflows only (P8 validated pathways).
- Confirm patient identity before chart actions.
- Complete consent capture where required (laser/teaching/research).
- Save chart updates and confirm sync indicator before closing encounter.

---

## Safety and quality guardrails

- Do not bypass critical warnings without clinical justification.
- If duplicate patient suspicion appears, stop and escalate to admin.
- For sync conflicts, re-open latest chart state and re-enter clinically relevant updates.

---

## Downtime protocol

If cloud operations are degraded:

1. Follow `docs/DOWNTIME_SOP.md`.
2. Use approved downtime documentation process.
3. Reconcile notes after service restoration.

---

## End-of-day checks

1. Confirm no pending critical sync errors.
2. Verify urgent follow-ups and reminders are saved.
3. Escalate unresolved clinical data issues before handover.

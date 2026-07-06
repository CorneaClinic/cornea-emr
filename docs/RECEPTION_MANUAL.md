# Reception Manual (Go-Live)

**Cornea Clinic EMR — Front Desk Workflow**

---

## Purpose

This manual defines reception workflows for registration, appointment handling, and escalation.

---

## Opening checklist

1. Sign in and verify appointment board loads.
2. Confirm patient search and registration form availability.
3. Test one check-in/check-out flow on a demo patient.

---

## Registration and appointments

- Search patient before creating a new record.
- Verify name, DOB, phone, and identifier fields.
- Escalate potential duplicates to admin before proceeding.
- Confirm appointment status changes are saved.

---

## Communication standards

- Record no-show, reschedule, and cancellation reasons accurately.
- Use reminder workflows as configured.
- Avoid free-text shortcuts that reduce audit clarity.

---

## Downtime handling

- Follow `docs/DOWNTIME_SOP.md` for manual registration and queueing.
- Keep chronological paper/electronic downtime log.
- On recovery, enter data in order and mark source as downtime reconciliation.

---

## Escalation triggers

- Cannot register/check-in any patient for >10 minutes.
- Repeated login failures for multiple staff.
- Encounter handoff mismatch between reception and clinician queues.

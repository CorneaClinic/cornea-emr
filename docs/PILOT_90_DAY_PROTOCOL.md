# 90-Day Pilot Protocol

**Cornea Clinic EMR — controlled production pilot**

---

## Purpose

This protocol defines a 90-day controlled pilot for tertiary cornea clinic operations before unrestricted expansion.

---

## Pilot scope

- **Duration:** 90 calendar days from pilot start date.
- **Sites:** Primary cornea clinic production environment.
- **Users:** Trained admin, clinician, and reception staff only.
- **Workflows:** All P8-validated cornea workflows; no new clinical modules during pilot.

---

## Phases

| Phase | Days | Focus |
|-------|------|-------|
| Phase 1 — Stabilization | 1–14 | Daily monitoring, rapid issue triage, workflow confidence |
| Phase 2 — Steady operations | 15–60 | Weekly governance review, safety trend analysis |
| Phase 3 — Expansion readiness | 61–90 | Success metrics review, expansion decision |

---

## Governance roles

| Role | Responsibility |
|------|----------------|
| Clinical lead | Patient safety decisions, workflow exceptions |
| Operations lead | Weekly checklist execution, incident coordination |
| Technical lead | Platform health, deployment controls, rollback |
| Governance lead | Medicolegal and audit evidence review |

---

## Weekly cadence

1. Run `npm run pilot:weekly-review`.
2. Complete `docs/PILOT_WEEKLY_CHECKLIST.md`.
3. Review safety signals in `docs/PILOT_SAFETY_MONITORING.md`.
4. Record open risks and owners in pilot log.

---

## Escalation

- **P1 safety or availability events:** immediate pause on workflow expansion; follow `docs/INCIDENT_RESPONSE.md`.
- **Repeated P2 issues:** convene pilot review within 24 hours.
- **Metric miss for 2 consecutive weeks:** trigger corrective action plan.

---

## Pilot exit

At day 90 (or earlier if criteria met), evaluate:

- `docs/PILOT_SUCCESS_METRICS.md`
- `docs/PILOT_EXPANSION_CRITERIA.md`

Decision: **Expand / Extend pilot / Roll back scope**

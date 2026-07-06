# Pilot Success Metrics

**Cornea Clinic EMR — 90-day pilot KPIs**

---

## Purpose

Define measurable success criteria for pilot completion and expansion readiness.

---

## Technical metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Platform availability | ≥99.0% clinic/API uptime | `health:production` + incident log |
| Verification suite | 100% PASS on weekly run | `verify:production`, `verify:clinical`, `verify:security`, `verify:medicolegal`, `verify:go-live`, `verify:pilot` |
| Backup verification | PASS each week | `verify:backup-dr` |
| Critical incidents (P1) | 0 unresolved at week close | Incident log |

---

## Clinical operations metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Workflow completion | ≥95% encounters without blocking EMR defect | Weekly ops review |
| Duplicate-patient near-miss handling | 100% escalations reviewed within 24h | Reception/admin log |
| Consent compliance | 100% required consents captured before procedure | Clinical audit sample |
| Downtime reconciliation | 100% downtime records reconciled within 24h of restore | Downtime SOP log |

---

## Training and adoption metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Role competency sign-off | 100% pilot users signed off | Training records |
| Repeat training interventions | ≤10% users requiring remediation | Training tracker |
| Unresolved support tickets >7 days | 0 critical tickets | Support log |

---

## Pilot success gate

Pilot is successful when all targets are met for **4 consecutive weeks** in Phase 3 (days 61–90), with no RED safety status.

See expansion decision criteria in `docs/PILOT_EXPANSION_CRITERIA.md`.

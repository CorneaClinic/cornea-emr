# Go-Live Training Guide

**Cornea Clinic EMR - role-based onboarding and competency checklist**

---

## Purpose

This guide defines a repeatable training path for admin, clinician, and reception staff before unrestricted production usage.

---

## Training model

1. **Orientation (all roles)** - platform scope, security posture, medicolegal expectations.
2. **Role workflow walkthrough** - use role-specific manuals in live clinic URL with a trainer.
3. **Supervised simulation** - complete assigned workflow set on non-production test patients.
4. **Competency sign-off** - trainer confirms readiness; unresolved gaps get remediation plan.

---

## Required reading by role

| Role | Required manual | Related runbook |
|------|------------------|-----------------|
| Admin | `docs/ADMIN_MANUAL.md` | `docs/INCIDENT_RESPONSE.md` |
| Clinician | `docs/CLINICIAN_MANUAL.md` | `docs/DOWNTIME_SOP.md` |
| Reception | `docs/RECEPTION_MANUAL.md` | `docs/DOWNTIME_SOP.md` |

---

## Session plan (recommended)

| Session | Duration | Audience | Outcomes |
|---------|----------|----------|----------|
| S1: Core platform | 60 min | All | Login, role boundaries, escalation paths |
| S2: Reception flow | 45 min | Reception/Admin | Registration, duplicates, check-in/out |
| S3: Clinical flow | 60 min | Clinicians/Admin | Charting, consent, media, sync |
| S4: Downtime + incident | 45 min | All | Downtime SOP and incident escalation drill |
| S5: Go-live rehearsal | 60 min | All | End-to-end mock clinic day |

---

## Competency checklist

- [ ] User can sign in, navigate, and complete role workflows without guidance.
- [ ] User can describe duplicate-patient and consent escalation paths.
- [ ] User can follow downtime fallback and reconciliation process.
- [ ] User can identify where to report incidents and urgency level (P1/P2/P3).
- [ ] Trainer signs completion with date and role.

---

## Evidence retention

Keep for governance review:

- Attendance sheet (name, role, date, trainer)
- Competency checklist completion
- Open issue/remediation tracker from rehearsal

Archive alongside go-live evidence package and reference in project documentation.

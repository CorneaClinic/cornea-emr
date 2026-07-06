# Downtime SOP

**Cornea Clinic EMR - planned and unplanned downtime operations**

---

## Purpose

This SOP standardizes safe patient operations when the cloud clinic or API is unavailable, and defines reconciliation after restoration.

---

## Downtime trigger criteria

Activate downtime workflow when any of the following persists beyond 10 minutes:

- No user can log in to cloud mode.
- Registration or charting is unavailable for all users.
- Sync failures block clinical documentation continuity.

Escalate per `docs/INCIDENT_RESPONSE.md`.

---

## Immediate actions (first 10 minutes)

1. Declare downtime and assign incident owner.
2. Inform clinicians and reception to switch to approved downtime capture.
3. Start chronological downtime log with timestamp, affected modules, and owner.
4. Confirm whether offline mode is usable on local devices.

---

## Role responsibilities

### Reception

- Continue registration/check-in using downtime forms.
- Maintain queue order and unique temporary identifiers.
- Hand off paper/electronic downtime notes to clinicians with timestamps.

### Clinician

- Document encounters using downtime template.
- Mark high-risk patients and urgent follow-up explicitly.
- Preserve consent evidence for laser/teaching/research cases.

### Admin

- Coordinate status updates every 30 minutes.
- Track incident timeline and communications.
- Prepare reconciliation owner list before restoration.

---

## Restoration and reconciliation

When service is restored:

1. Confirm platform stability for at least 10 minutes.
2. Re-enter downtime records in chronological order.
3. Tag each reconciled entry as downtime-derived source.
4. Validate critical encounters, medications, and procedural notes.
5. Record reconciliation completion and unresolved issues.

---

## Post-incident review

- Log root cause and timeline in incident report.
- Record patient safety impact and mitigations.
- Update training material and this SOP if gaps are identified.
- Archive evidence for governance review.

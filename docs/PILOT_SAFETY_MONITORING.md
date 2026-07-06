# Pilot Safety Monitoring

**Cornea Clinic EMR — patient safety and operational risk signals**

---

## Purpose

Define safety signals, thresholds, and escalation during the 90-day pilot.

---

## Safety signals

| Signal | Source | Review frequency |
|--------|--------|------------------|
| Login/auth failures | Audit logs, `medicolegal:audit-review` | Weekly |
| Duplicate patient alerts | Registration workflow escalations | Weekly |
| Sync conflicts / data loss reports | Incident log + clinician reports | Weekly |
| Chart overwrite incidents | Registry concurrency audit | Weekly |
| Downtime events | `DOWNTIME_SOP` reconciliation log | Weekly |
| Backup/DR failures | `verify:backup-dr` | Weekly |

---

## Thresholds

| Level | Condition | Action |
|-------|-----------|--------|
| Green | No P1; ≤1 P2 open | Continue pilot |
| Amber | 2+ P2 in same domain OR metric miss 1 week | Corrective action plan within 48h |
| Red | Any P1 OR repeated Amber for 2 weeks | Pause expansion; governance review within 24h |

---

## Monitoring workflow

1. Run `npm run pilot:weekly-review`.
2. Compare findings against thresholds above.
3. Log decision and owner in weekly checklist.
4. Escalate per `docs/INCIDENT_RESPONSE.md` when RED.

---

## Evidence retention

Archive weekly review output and incident notes for pilot close-out and Project 12 audit.

# Eye Bank Traceability (Project 10)

Extends corneal tissue inventory with donor traceability, serology, quarantine workflow, chain-of-custody, cold-chain logging, and regulatory CSV export.

## Features

| Area | Capability |
|------|------------|
| Donor traceability | De-identified donor ID, lot/batch, tissue laterality |
| Serology | HIV, HBV, HCV, Syphilis, CMV (Negative / Positive / Pending / Not done) |
| Quarantine | Status: Quarantine · Cleared · Released · Failed |
| Chain of custody | Received → Quarantine → Released → Reserved → Transferred → Shipped → Implanted → Discarded |
| Cold chain | Storage checks, transfers, out-of-range alarms (2–8 °C target) |
| Export | Per-tissue CSV audit packet for regulatory review |
| Allocation | Links reserved tissue to KP patient in traceability packet |

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/eye-bank/overview` | Clinic-wide tissue + quarantine stats |
| GET | `/api/v1/eye-bank/tissues/:id/traceability` | Full packet (tissue + custody + cold chain + allocation) |
| GET | `/api/v1/eye-bank/tissues/:id/traceability/export.csv` | Regulatory export |
| GET/POST | `/api/v1/eye-bank/tissues/:id/custody-events` | Chain of custody |
| GET/POST | `/api/v1/eye-bank/tissues/:id/cold-chain-events` | Temperature logs |
| PATCH | `/api/v1/eye-bank/tissues/:id/quarantine` | Serology + quarantine update |

Migration: `019_eye_bank_traceability.sql`

## Clinic UI

1. **Keratoplasty → Tissue inventory** — register tissue with traceability fields in the tissue modal
2. **View tissue** — serology/quarantine summary + custody and cold-chain timelines
3. **Custody event** / **Temp check** buttons — log transfers and storage readings
4. **Export CSV** — download traceability packet (cloud) or local summary (offline)

## IndexedDB stores

- `kpCustodyEvents` — local custody log per tissue
- `kpColdChainEvents` — local cold-chain log per tissue

Events sync to cloud when the tissue has a `uuid` and the user is signed in.

## Permissions

`kp:read` for view/export; `kp:write` for custody, cold chain, and quarantine updates.

## Verify production

```bash
curl -s -o /dev/null -w "%{http_code}" https://corneaclinic-2zfpt.ondigitalocean.app/api/v1/eye-bank/overview
```

`401` = route live (auth required).

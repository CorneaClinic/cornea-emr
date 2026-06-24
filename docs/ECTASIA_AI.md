# Topography-Integrated Ectasia AI (Project 9)

Enhances the **AI Laser Refractive Planner** and **KC registry** with topography-weighted ectasia scoring, CXL recommendations, and procedure ranking informed by institute CXL outcomes.

## Data sources

| Source | Metrics used |
|--------|----------------|
| Pentacam import (Project 4) | Kmax, Kmean, BAD-D, thinnest pachymetry, posterior elevation |
| Laser refractive work-up | Topography tab + corneal fields + RSB/PTA from planning |
| KC registry topography | Latest OD/OS readings per patient |
| KC/CXL outcomes (Project 2) | CXL stability rate adjusts procedure ranking |

## Scoring model (`ectasia-v1-topography`)

Composite score **0–100** from per-eye factors:

- BAD-D thresholds (1.0 / 1.3 / 1.6 / 2.0)
- Kmax (45 / 47 / 48 D)
- Thinnest pachymetry (<500 / <480 / <450 µm)
- Topographic progression (suspect / confirmed)
- Age &lt; 30, family history KC
- Refractive context: RSB, PTA%

**Risk tiers:** Low · Borderline · Moderate · High · Contraindicated

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/ectasia-ai/analyze` | Full analysis + registry-adjusted procedure ranking |
| `GET` | `/api/v1/ectasia-ai/registry-insights` | Clinic topography/CXL aggregate stats |

Body example:

```json
{
  "od": { "badD": 1.4, "kmax": 46.2, "thinnestPachy": 495 },
  "os": { "badD": 0.9, "kmax": 43.1, "thinnestPachy": 520 },
  "shared": { "age": 28, "familyKc": true, "residualStromalBed": 280, "ptaPercent": 38 }
}
```

## Clinic UI

### Laser refractive module

AI planner panel includes **Topography Ectasia AI** subsection. Local scoring is immediate; cloud mode re-fetches with registry insights.

### KC registry

Patient detail shows ectasia AI panel when topography readings exist. **Re-analyze** refreshes after new Pentacam import.

## Permissions

`kc:read` or `visits:read` for analyze; registry insights also allows `research:read`.

## Note

This is **rule-based clinical decision support** calibrated to topography literature — not a validated ML classifier. Surgeon retains final decision.

# Changelog — Laser Refractive Surgery Work-up Module

## Summary

Adds a comprehensive **Laser Refractive Surgery Work-up** module to the Cornea Clinic EMR. Supports LASIK, Femto LASIK, SMILE, PRK, LASEK, TransPRK, PTK, topography/wavefront-guided treatments, ICL screening, and RLE screening.

All existing functionality is preserved. The module is optional (hidden by default), stored in a new JSON field, and fully backward compatible.

---

## New Files

| File | Purpose |
|------|---------|
| `cornea-laser-refractive-taxonomy.js` | Tab definitions, field schemas, risk/planning calculations, safety rules |
| `cornea-laser-refractive-advisor.js` | Rule-based AI Surgical Advisor (decision support only) |
| `cornea-laser-refractive.js` | 13-tab work-up UI, sync, read-only, print, export |

---

## Modified Files

| File | Changes |
|------|---------|
| `Cornea.html` | Optional section `#section-laser-refractive`, launch button in Vision & Refraction, CSS (`.lr-*`, `.section-theme-refractive`), script tags |
| `js/init.js` | `CorneaLaserRefractive.init()` |
| `js/patient-form.js` | Sync, populate, read-only at correct DOM position |
| `js/visits.js` | Save/clear/reset hooks |
| `js/printing.js` | Visit summary block + AI print section |
| `cornea-section-attribution.js` | Section key `laser_refractive` |

---

## Module Tabs (13)

1. **Patient Assessment** — occupation, visual demands, medical history, expectations, dominant eye
2. **Refraction** — UCVA, BCVA, manifest/cycloplegic/auto refraction, stability
3. **Corneal Evaluation** — K readings, pachymetry, HVID, KC/PMD, scarring
4. **Tear Film & Ocular Surface** — TBUT, Schirmer, MGD, blepharitis, staining
5. **Topography & Tomography** — Pentacam/Galilei/Orbscan/Sirius, BAD-D, ABCD, cone data, image import
6. **Aberrometry** — HOAs, coma, trefoil, spherical aberration, RMS, pupil sizes
7. **Risk Assessment** — auto-computed keratoconus, ectasia, dry eye, glare, regression, healing risks
8. **Surgical Planning** — procedure suitability matrix, RSB, PTA, ablation depth, safety margin
9. **AI Surgical Advisor** — best/alternative procedure, contraindications, pre-op optimization (accept/modify/reject)
10. **Consent** — procedure-specific checklist, risks discussed, signed consent record
11. **Surgery Record** — date, procedure, platform, surgeon, flap/cap/ablation details
12. **Follow-up** — quick templates (Day 1 → Year 1), UCVA, healing, complications
13. **Outcomes** — efficacy/safety index, predictability, satisfaction, night vision

---

## Risk Assessment Engine

Automatically evaluates and classifies:

- Keratoconus / PMD (contraindicated)
- Thin cornea, low RSB, high PTA / BAD-D (ectasia risk)
- Dry eye, autoimmune disease, pregnancy (defer / caution)
- Unstable refraction, high myopia/hyperopia
- Previous surgery, large mesopic pupil (night glare)

Output levels: **Low risk**, **Moderate risk**, **High risk**, **Contraindicated**

Safety alerts displayed prominently at top of module.

---

## Surgical Planning Calculations

- Residual stromal bed (RSB)
- Percentage tissue altered (PTA)
- Estimated ablation depth
- Flap/cap thickness inputs
- Optical zone / transition zone
- Procedure suitability table for all supported modalities

---

## AI Surgical Advisor

- Analyzes full work-up data
- Suggests best and alternative procedures
- Flags contraindications and required investigations
- Recommends dry eye optimization and crosslinking consideration
- Accept / Modify / Reject workflow — never auto-applies to record
- Print block labeled **AI Clinical Decision Support** vs **Clinician Final Decision**

---

## Data Model

**Field:** `laserRefractiveJSON` on visit record (optional)

```json
{
  "version": 1,
  "activeTab": "assessment",
  "workup": { "assessment": {}, "refraction": {}, "..." },
  "computed": { "risk": "Moderate risk", "planning": {} },
  "history": [],
  "updatedAt": "..."
}
```

Records without this field are unaffected. No IndexedDB schema migration required.

---

## UX Features

- One-click **Normal pre-op** and **Dry eye work-up** templates
- **Copy OD → OS** on bilateral tabs
- Progress indicator (1–13) + tab navigation
- Auto-save (300 ms debounce)
- Image import (Pentacam, topography, aberrometry, etc.)
- Mobile-responsive chip/grid layout
- Export JSON for research

---

## Printing

Module print buttons: Work-up summary, Surgical plan, Consent, Operative note, Follow-up, Outcomes

Visit summary (`generateSummary`) includes laser work-up block when data present.

---

## Usage

1. Open patient visit → **Vision & Refraction**
2. Click **Laser Work-up** button
3. Complete tabs; review Risk Assessment and AI Advisor
4. Document consent and surgery as applicable
5. Save visit — data persists in `laserRefractiveJSON`

---

## Validation Checklist

- [x] Existing EMR sections unchanged
- [x] Prior records without `laserRefractiveJSON` load normally
- [x] Document view shows section after Contact Lens (correct order)
- [x] Visit summary printing includes laser block
- [x] Mobile-responsive layout
- [x] AI recommendations require clinician action
- [x] Contact lens and scleral wizard modules unchanged

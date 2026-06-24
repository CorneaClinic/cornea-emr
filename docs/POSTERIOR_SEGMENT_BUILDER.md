# Posterior Segment Examination Builder (Project 7)

Taxonomy-driven fundus examination builder mirroring the anterior segment slit-lamp pattern.

## Structures (clinical order)

1. Media / Vitreous  
2. Optic Disc  
3. Vessels  
4. Background / Peripheral Retina  
5. Macula / Fovea  

## Legacy compatibility

Structured state syncs to existing visit fields:

| Structure | OD field | OS field |
|-----------|----------|----------|
| Media | `mediaRE` | `mediaLE` |
| Disc | `discRE` | `discLE` |
| Vessels | `vesselRE` | `vesselLE` |
| Retina | `retinaRE` | `retinaLE` |
| Macula | `fovealRE` | `fovealLE` |

Optional structured blob: `posteriorSegmentJSON` (analytics / export).

## Clinic UI

Patient Form → **Fundus Examination** — card-based builder with:

- All Normal / Previous Visit / Compare / Export JSON  
- Clinical templates (diabetic screen, CMV suspicion, post-operative)  
- Per-eye normal/abnormal, finding chips, free text  

Printing uses legacy fields via `printing.js` (unchanged).

## Files

| File | Role |
|------|------|
| `cornea-posterior-segment-taxonomy.js` | Findings taxonomy & templates |
| `cornea-posterior-segment.js` | Builder UI & legacy sync |

*Master Development Plan — Phase 3, Project 7.*

# Changelog — AI Laser Refractive Surgery Planner

## Summary

Upgrades the Laser Refractive Surgery Work-up Module with a comprehensive **AI Laser Refractive Surgery Planner** — a persistent clinical decision support dashboard visible across all 13 tabs. All existing module functionality is preserved; records without AI data remain fully compatible.

**Principle:** The AI explains its reasoning. The surgeon accepts, modifies, or rejects each recommendation. The AI never makes the final decision or auto-modifies records.

---

## Enhanced File

| File | Changes |
|------|---------|
| `cornea-laser-refractive-advisor.js` | Full planner engine: ectasia/dry eye analysis, procedure ranking, night vision, surgical planning, follow-up trends, patient counseling, safety score, learning system |
| `cornea-laser-refractive.js` | Persistent planner sidebar, live refresh, keyboard shortcuts, AI print reports, research log on save |
| `Cornea.html` | Two-column `.lr-module-layout`, planner CSS, collapse/print rules |

---

## AI Planner Dashboard

Persistent left panel (stacks above tabs on mobile) showing:

| Element | Description |
|---------|-------------|
| Traffic light | Green = Suitable · Yellow = Borderline · Red = Contraindicated |
| Safety score | 0–100 composite score |
| Confidence | High / Medium / Low |
| Best procedure | Ranked #1 recommendation |
| Alternatives | #2 and #3 ranked procedures |
| Contraindications | KC, PMD, pregnancy, unstable Rx, severe dry eye, etc. |
| Major risk factors | Top warnings |
| Clinical reasoning | Narrative explanation (pachymetry, RSB, PTA, BAD-D, etc.) |
| Ectasia / dry eye | Separate risk tiers with recommendations |
| Night vision | Glare risk and optical zone guidance |
| Follow-up trend | Improved / Stable / Worsened (when visits recorded) |
| Learning hints | Prior successful procedures from localStorage |

---

## Analysis Domains

### Inputs analyzed
Patient assessment, refraction, cornea, topography/tomography, ocular surface, aberrometry — all fields from existing work-up tabs.

### Calculations
- Residual stromal bed (RSB)
- Percentage tissue altered (PTA)
- Predicted ablation depth
- Predicted postoperative K
- Flap/cap thickness, optical zone, transition zone
- Safety margin status

### Ectasia risk
Low / Moderate / High / Contraindicated — based on pachymetry, BAD-D, PTA, RSB, KC/PMD, family history, progression.

### Dry eye risk
Suitable / Proceed with caution / Treat first / Contraindicated — based on TBUT, Schirmer, MGD, blepharitis, autoimmune disease.

### Procedure ranking
LASIK, Femto LASIK, SMILE, PRK, TransPRK, PTK, ICL, RLE, Crosslinking plus PRK, No surgery — ranked with reasons.

### Night vision
Glare/halos risk from mesopic pupil, HOAs, night driving habits; optical zone recommendations.

### Surgical planning recommendations
Flap/cap thickness, OZ, transition zone, wavefront/topography-guided flags, crosslinking consideration, dry eye pre-treatment.

### Follow-up AI
Compares postoperative visits for UCVA, regression, dry eye, complications; suggests interventions.

### Patient counseling (AI draft)
Benefits, risks, alternatives, enhancement rates — surgeon reviews before sharing.

---

## Clinician Workflow

- **Accept** (✓) — one click; Ctrl+A on first pending recommendation
- **Modify** (✎) — optional note prompt
- **Reject** (✗) — one click; Ctrl+R
- Collapse/expand planner panel
- Live updates as work-up data is entered (350 ms debounce)

---

## Printing (AI vs Surgeon)

New print buttons:
- **AI work-up** — full AI clinical decision support summary
- **AI surgical plan** — RSB, PTA, ablation, recommended parameters
- **AI risk report** — ectasia and dry eye analysis
- **Patient counseling** — patient-friendly draft

All reports clearly separate:
- **AI Clinical Decision Support**
- **Surgeon Final Decision**

Existing work-up, plan, consent, operative, follow-up, and outcomes prints unchanged.

---

## Research & Learning

Stored in `workup.aiAdvisor`:
- `decisions` — accept/modify/reject per recommendation ID
- `log` — audit trail + full report snapshots on save
- `lastReport` — latest analysis

LocalStorage `corneaLrAiLearning` — successful accepted procedures (never auto-applied).

Export JSON includes full AI state for registry/research.

---

## Backward Compatibility

- Records without `aiAdvisor` load with defaults
- Existing 13 tabs, risk panel, planning calculations unchanged
- `laserRefractiveJSON` schema extended, not replaced
- No IndexedDB migration

---

## Validation Checklist

- [x] All 13 tabs preserved
- [x] Existing risk/planning taxonomy calculations used
- [x] Prior records load without error
- [x] AI never auto-modifies work-up data
- [x] Print: AI work-up, plan, risk, counseling + visit summary
- [x] Mobile: planner stacks above main content
- [x] Contact lens and scleral modules unchanged

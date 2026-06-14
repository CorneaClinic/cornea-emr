# Changelog — AI Scleral Lens Advisor

## Summary

Adds a rule-based **AI Scleral Lens Advisor** clinical decision support panel to the existing 13-step Scleral Lens Fitting Wizard. All prior wizard functionality, steps, and patient records remain unchanged and backward compatible.

**Important:** The AI Advisor does **not** replace clinician judgment. Recommendations require explicit accept, modify, or reject actions and are never auto-applied to the record.

---

## New Files

| File | Purpose |
|------|---------|
| `cornea-scleral-lens-advisor.js` | Rule-based expert system: analysis engine, panel UI, print block, learning log, research decision log |

---

## Modified Files

| File | Changes |
|------|---------|
| `Cornea.html` | AI advisor CSS (`.sl-ai-*`, two-column `.sl-wizard-layout`, mobile stack, print hide); script tag for advisor |
| `cornea-scleral-lens.js` | `aiAdvisor` state in JSON; advisor column in wizard layout; live refresh on data entry; accept/modify/reject workflow; AI summary print; research log on save |
| `js/printing.js` | Visit summary print includes AI Clinical Decision Support block (separate from clinician final decision) |

---

## AI Advisor Features

### Panel (visible on all 13 wizard steps)

- Current fitting status banner (green / yellow / red)
- Overall score: Excellent, Good, Acceptable with modification, Needs modification, Poor fit
- Confidence level and suggested next step
- Top three problems and top three recommendations
- Suggested follow-up interval
- Safety alerts (urgent referral situations)
- Initial trial lens suggestion (diameter, sag, landing zone, material, design, power estimate)
- Central clearance classification (too low → too high) with reasoning
- Limbal clearance analysis (all quadrants)
- Landing zone analysis (compression, impingement, edge lift, seal off, asymmetry)
- Lens decentration and movement analysis
- Over-refraction analysis (sphere, cylinder, VA)
- Complication detection with suggested solutions
- Diagnosis-specific guidance (Keratoconus, Post PKP/DALK, severe dry eye, neurotrophic, etc.)
- Follow-up comparison when visit history exists
- Learning hints from prior successful fittings (`localStorage`: `corneaSlAiLearning`)

### Clinician Workflow

- **Accept** — one click (Ctrl+A shortcut on first pending recommendation)
- **Modify** — optional note prompt
- **Reject** — one click (Ctrl+R shortcut)
- Collapse/expand panel for compact clinic workflow
- Mobile: advisor stacks above wizard on narrow screens

### Explanation Mode

Each recommendation includes:

- Finding
- Interpretation
- Clinical reasoning
- Suggested modification
- Expected benefit
- Confidence level

### Research Mode

Stored in `scleralLensJSON.aiAdvisor`:

- `decisions` — clinician accept/modify/reject per recommendation ID
- `log` — timestamped decision audit trail + save snapshots
- `lastReport` — latest analysis snapshot
- `collapsed` — UI preference

Export JSON includes full AI advisor state for future analysis.

### Printing

- **Fitting report** — includes AI block + clinician final decision section
- **AI summary** — dedicated print button
- **Visit summary** (`printing.js`) — AI block appended to scleral lens section
- Sections clearly labeled: *AI Clinical Decision Support* vs *Clinician Final Decision*

---

## Data Model (backward compatible)

Existing `scleralLensJSON` records without `aiAdvisor` load normally; defaults are applied on first open:

```json
{
  "aiAdvisor": {
    "decisions": {},
    "log": [],
    "collapsed": false,
    "lastReport": null
  }
}
```

No IndexedDB schema changes. No existing fields removed.

---

## Validation Checklist

- [x] All 13 wizard steps preserved
- [x] Existing taxonomy recommendations panel retained
- [x] Prior records without `aiAdvisor` load without error
- [x] AI never auto-modifies fit parameters or visit records
- [x] Print: fitting report, AI summary, visit summary
- [x] Mobile responsive layout (stacked advisor)
- [x] Contact lens module unchanged

---

## Usage

1. Open **Vision & Refraction** → **Contact Lens** → **Scleral Lens Fitting Wizard**
2. AI Advisor panel appears on the left (top on mobile)
3. Enter fitting data as usual; advisor updates automatically
4. Review recommendations; Accept / Modify / Reject each item
5. Print fitting report or AI summary as needed
6. Save visit — AI decisions and report snapshot persist in `scleralLensJSON`

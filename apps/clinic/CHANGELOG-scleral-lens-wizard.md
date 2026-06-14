# Scleral Lens Fitting Wizard — Changelog

## Overview

Adds a **13-step Scleral Lens Fitting Wizard** nested inside the existing Contact Lens section. Shown on demand via button; does not remove or replace any contact lens features.

## New files

| File | Purpose |
|------|---------|
| `cornea-scleral-lens-taxonomy.js` | Steps, indications, clearance bands, templates, safety rules, recommendation engine |
| `cornea-scleral-lens.js` | Wizard UI, progress bar, auto-save, printing, export, history |

## Modified files

| File | Change |
|------|--------|
| `Cornea.html` | Wizard panel + button inside Contact Lens card, CSS, script tags |
| `js/init.js` | `CorneaScleralLens.init()` |
| `js/patient-form.js` | Sync, populate, read-only |
| `js/visits.js` | Save, reset hooks |
| `js/printing.js` | Scleral block in clinical summary |
| `cornea-contact-lens.js` | Open CL section when scleral data exists on load |

## Wizard steps (13)

1. Patient Selection — multi-select indications  
2. Pre-fitting Assessment — OD/OS + one-click normal  
3. Trial Lens Selection — manufacturer, sag, diameter, etc.  
4. Lens Insertion — checklist + photo/drawing notes  
5. Central Clearance — micron buttons, color-coded (low/ideal/high), OCT/manual  
6. Limbal Clearance — quadrant assessment  
7. Landing Zone — quadrant findings + auto recommendations  
8. Lens Movement — movement + decentration  
9. Over Refraction — OD/OS, calculate final power  
10. Final Lens Design — auto-generated from trial + OR + clearance  
11. Complication Check — chips + suggested solutions  
12. Patient Education — checklist  
13. Follow-up — intervals + tracking + visit comparison table  

## UX

- **Progress bar** with ✓ on completed steps; click any step to jump back  
- **Previous / Next** navigation  
- **Auto-save** to `scleralLensJSON` (300 ms debounce)  
- **Specialist shortcuts** (Keratoconus, Post PKP, GVHD, etc.)  
- **Copy OD → OS**, one-click normal pre-fit  
- **Smart recommendations** from clearance, limbal, landing, movement, complications  
- **Photos** — slit lamp, fluorescein, OCT, topography (local data URLs)  
- **Print** — fitting report, order form, instructions, follow-up sheet  
- **Export JSON** for research  

## Data model

- **Field:** `scleralLensJSON` on visit record (optional, backward compatible)  
- Existing `contactLensJSON` unchanged  

## Show on demand

1. Vision & Refraction → **Contact Lens** (opens CL section)  
2. Inside CL section → **Scleral Lens Wizard** (opens 13-step wizard)  
3. Records with scleral data auto-open both sections on load  

## Backward compatibility

- No IndexedDB migration  
- Records without `scleralLensJSON` unaffected  
- All contact lens tabs and features preserved  

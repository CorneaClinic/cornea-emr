# Contact Lens Fitting & Follow-up Module — Changelog

## Overview

Adds a comprehensive **Contact Lens** section to the patient visit form with 10 internal tabs, structured JSON storage, clinical safety alerts, printing, export, and full backward compatibility with existing records.

## New files

| File | Purpose |
|------|---------|
| `cornea-contact-lens-taxonomy.js` | Indications, lens types, complications, templates, safety rules, field schemas |
| `cornea-contact-lens.js` | UI builder, state sync, read-only view, printing, inventory, history |

## Modified files

| File | Change |
|------|--------|
| `Cornea.html` | Contact Lens form-card section, CSS theme (`.section-theme-contactlens`), module styles, script tags |
| `js/init.js` | `CorneaContactLens.init()` on load |
| `js/patient-form.js` | Populate, collect, read-only, theme mapping |
| `js/visits.js` | Pre-save sync, `applyBeforeSave`, reset on clear |
| `js/printing.js` | Sync + Contact Lens block in clinical summary |
| `cornea-section-attribution.js` | `'Contact Lens': 'contact_lens'` |

## Data model

- **Visit field:** `contactLensJSON` (hidden input, auto-collected with all other form fields)
- **Clinic inventory:** `localStorage` key `corneaClInventory` (trial/stock lenses, expiry alerts)
- **Shape:**
  ```json
  {
    "version": 1,
    "activeTab": "indication",
    "fit": { "indication": [], "prefitting": {}, "lensSelection": {}, "trial": {}, "finalRx": {}, "dispensing": {}, "followUp": {}, "complications": [] },
    "history": [{ "date": "...", "indication": [], "lensType": "", "snapshot": {} }]
  }
  ```

## 10 tabs

1. **Indication** — multi-select chips (keratoconus, post-PKP, ortho-K, etc.)
2. **Pre-fitting Assessment** — OD/OS fields, tear film, topography, dry eye
3. **Lens Selection** — lens type, parameters, replacement/wearing schedule
4. **Trial Lens Assessment** — movement, centration, fluorescein pattern, VA with trial
5. **Final Prescription** — OD/OS final params + print prescription
6. **Dispensing** — training checklist, solutions prescribed
7. **Follow-up** — one-click intervals (1 day – 12 months), compare fields
8. **Complications** — one-click complication chips
9. **Lens Inventory** — clinic stock with expiry/low-stock alerts
10. **History** — visit snapshots, load previous fitting, JSON export

## UX features

- Specialist one-click templates (Keratoconus RGP, scleral, bandage CL, etc.)
- Copy OD → OS on all dual-eye tabs
- Copy previous visit from history
- Clinical safety alerts (poor tear film, graft rejection, hypoxia risk, etc.)
- Print: prescription, clinical summary, patient instructions, follow-up schedule
- Export structured JSON for research/audit
- Collapsible section (inherits form-section-collapse)
- Teal section theme in form and document view

## Backward compatibility

- No IndexedDB schema version change — `contactLensJSON` is optional on existing records
- Records without the field load with empty Contact Lens state
- All existing sections, fields, and workflows unchanged
- Print CSS expands collapsed sections as before

## Integration points

- Save: `CorneaContactLens.syncToHiddenField()` + `applyBeforeSave()` appends history snapshot
- Load: `CorneaContactLens.onFormPopulated(data)`
- Clear: `CorneaContactLens.reset()`
- Document view: `CorneaContactLens.formatReadOnly(data)`
- Patient flow station `contact_lens` already exists in flow subnav

## Future expansion

- Cloud sync of `contactLensJSON` via existing visit API (field travels with visit payload)
- Favourites/recent Rx localStorage keys defined in taxonomy for later UI
- Referral letter PDF template hook via `printSummary()`

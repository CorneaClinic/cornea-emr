# Topography CSV import (Pentacam + Sirius)

Import device CSV exports into the **KC & CXL registry** and/or the **Laser refractive work-up** without manual entry.

## Supported devices

| Device | Export | Parser |
|--------|--------|--------|
| **Pentacam** | `chamber.csv`, `BAD.CSV`, custom CSV | `parsePentacamCsv()` |
| **Sirius / CSO Phoenix** | Indices export (comma, semicolon, or tab) | `parseSiriusCsv()` |
| Auto-detect | Headers with ISV, IVA, CKI, Scheimpflug, etc. | `parseTopographyCsv()` |

## Column mapping (auto-detected)

| Common header | EMR field |
|---------------|-----------|
| `k_max_front_d`, `Kmax`, `K Max` | Kmax (D) |
| `Km`, `Kmean`, `k_mean` | Kmean (D) |
| `pachy_min`, `Pachymin`, `Thin Pach`, `spessore_minimo` | Thinnest pachymetry (µm) |
| `bad_d`, `final_d`, `BAD-D`, `CKI` (Sirius) | BAD-D / screening index |
| `ISV`, `IVA`, `IHA`, `IHD` (Sirius) | Stored in topography notes |
| `Eye`, `R`/`L`, `OD`/`OS` | Eye |
| `Date`, `Exam date` | Capture date |

**Wide format** (e.g. `kmax_od`, `kmax_os`) is supported — one CSV row can produce OD + OS readings.

## Clinic UI

### KC registry

1. **KC & CXL** → select a patient → **Import Pentacam CSV** or **Import Sirius CSV**
2. Select file → review preview table
3. Optionally tick **Also apply to current visit laser refractive work-up**
4. **Import selected**

### Laser refractive (visit form)

1. Open patient visit → **Laser Refractive Surgery** → **Topography** tab
2. **Import Pentacam CSV** or **Import Sirius CSV**
3. **Import selected** — fills topography + corneal Kmax/pachymetry fields

## Cloud sync

KC imports use the same topography API as manual entry (`POST /api/v1/kc-registry/:id/topography`). Cloud sign-in required for multi-device sync.

## Files

| File | Role |
|------|------|
| `apps/clinic/cornea-pentacam-import.js` | Pentacam + Sirius CSV parsers (`CorneaTopographyImport`) |
| `apps/clinic/cornea-kc-cxl.js` | KC import modal + save |
| `apps/clinic/cornea-laser-refractive.js` | Laser work-up apply |
| `apps/clinic/tests/topography-import.test.mjs` | Parser unit tests (CI) |

## Tests

```bash
npm run test:topography-import
```

## Future (Phase 4+)

- Galilei dedicated parser
- Folder watch on clinic PC
- Server-side parse API + audit log
- Auto-match patient by MRN / name from CSV

---

*Phase 4 P3 — Sirius CSV import (July 2026). Pentacam since Project 4.*

# Pentacam CSV Import (Project 4)

Import Pentacam export files into the **KC & CXL registry** and/or the **Laser refractive work-up** without manual entry.

## Supported files

| Source | Notes |
|--------|--------|
| `chamber.csv` / `chamber-load.csv` | Pentacam patient database export (comma or semicolon) |
| `BAD.CSV` | Belin/Ambrósio deviation export |
| Custom CSV | Headers matched by aliases (Kmax, pachy_min, BAD-D, etc.) |

## Column mapping (auto-detected)

| Pentacam / common header | EMR field |
|--------------------------|-----------|
| `k_max_front_d`, `Kmax`, `K Max` | Kmax (D) |
| `Km`, `Kmean`, `k_mean` | Kmean (D) |
| `pachy_min`, `Pachymin` | Thinnest pachymetry (µm) |
| `bad_d`, `final_d`, `BAD-D` | BAD-D |
| `Eye`, `R`/`L`, `OD`/`OS` | Eye |
| `Date`, `Exam date` | Capture date |

**Wide format** (e.g. `kmax_od`, `kmax_os`) is supported — one CSV row can produce OD + OS readings.

## Clinic UI

### KC registry

1. **KC & CXL** → open a patient → **Import Pentacam CSV**
2. Select file → review preview table
3. Optionally tick **Also apply to current visit laser refractive work-up**
4. **Import selected**

### Laser refractive (visit form)

1. Open patient visit → **Laser Refractive Surgery** section → **Topography** tab
2. **Import Pentacam CSV**
3. **Import selected** — fills topography + corneal Kmax/pachymetry fields

## Cloud sync

KC imports use the same topography API as manual entry (`POST /api/v1/kc-registry/:id/topography`). Cloud sign-in required for multi-device sync.

## Files

| File | Role |
|------|------|
| `apps/clinic/cornea-pentacam-import.js` | CSV parser + field mapping |
| `apps/clinic/cornea-kc-cxl.js` | KC import modal + save |
| `apps/clinic/cornea-laser-refractive.js` | Laser work-up apply |

## Future (Phase 2+)

- Galilei / Sirius parsers
- Folder watch on clinic PC
- Server-side parse API + audit log
- Auto-match patient by MRN / name from CSV

---

*Master Development Plan — Phase 2, Project 4 (first device: Pentacam).*

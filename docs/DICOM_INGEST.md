# DICOM ingest (Phase 4 P6 prototype)

Import ophthalmic **DICOM Part 10** (`.dcm`) studies into the cloud clinical media library — topography, tomography, OCT, slit lamp, and related modalities.

## API endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/v1/dicom/parse` | `media:read` | Parse upload; return tags + suggested category (no storage) |
| `POST` | `/api/v1/dicom/ingest` | `media:write` | Parse + store `.dcm` linked to patient or visit |

Multipart field: **`file`** (`.dcm` buffer).

### Ingest form fields

| Field | Required | Notes |
|-------|----------|-------|
| `entityType` | Yes | `patient` or `visit` |
| `entityId` | Yes | Patient or visit UUID |
| `category` | No | Defaults from modality/description heuristics |
| `eye` | No | `OD` / `OS` / `OU`; auto from DICOM laterality when omitted |
| `label` | No | Display label in media library |
| `allowDuplicate` | No | `true` to skip checksum dedup |

## Parsed metadata

| DICOM tag | Mapped field |
|-----------|--------------|
| Patient Name (0010,0010) | `patientName` (PN → given family) |
| Patient ID (0010,0020) | `patientId` |
| Modality (0008,0060) | `modality` |
| Study / Series Description | Category suggestion + label |
| Laterality (0020,0060) | Eye (`OD`/`OS`/`OU`) |
| Study Date/Time | `capturedAt` |
| UIDs | Stored in asset `metadata.dicom` |

### Category heuristics

| Signal | Suggested category |
|--------|-------------------|
| Modality OCT / “anterior segment” | `as_oct` |
| Pentacam / topography text | `topography` |
| Sirius / tomography text | `tomography` |
| Slit lamp / OP | `slit_lamp` |
| Specular / confocal keywords | `specular` / `confocal` |
| Default | `other` |

## Clinic UI

**Clinical Media** tab → **DICOM ingest (prototype)** → **Import DICOM**.

1. Select `.dcm` file → preview parsed metadata  
2. Link to patient MRN/UUID or visit UUID  
3. Confirm category and eye → ingest to media library  

Requires cloud sign-in and `media:write` permission.

## Storage

- MIME type: `application/dicom`
- Original file retained in configured media storage (`local` dev / S3-compatible prod)
- Linked via `media_asset_links` with `moduleName: dicom_ingest`

See also: [CLINICAL_MEDIA_PLATFORM.md](./CLINICAL_MEDIA_PLATFORM.md)

## Verification

- Unit: `apps/api/tests/dicom.test.js`
- E2E: `e2e/dicom.spec.js` (parse, ingest, auth, UI smoke)
- Fixture: `e2e/fixtures/minimal-dicom.js` (synthetic Part 10 for CI)

## Production smoke

1. Sign in → **Clinical Media** → **Import DICOM**
2. Upload a real Pentacam/OCT `.dcm` from your device export folder
3. Link to an existing patient UUID or visit
4. Confirm asset appears in the media library timeline

**Note:** Full PACS worklist / C-STORE SCP integration is out of scope for this prototype; ingest is manual upload via the clinic UI or API.

## Limitations (prototype)

- Single-instance upload (not multi-frame series batching)
- No DICOM viewer — file stored for audit and future viewer integration
- No automatic patient matching from DICOM Patient ID (operator links manually)
- Compressed transfer syntaxes depend on `dicom-parser` support

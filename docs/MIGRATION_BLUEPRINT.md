# Cornea Clinic — Cloud EMR Migration Blueprint

> Saved from the migration analysis report.  
> Source: `Cornea.html` + `clinic-server.js`  
> Last updated: 2026-06-06

---

**Source analyzed:** `Cornea.html` (~8,011 lines, single-file SPA) + `clinic-server.js` (static file server + WHO ICD-11 proxy)  
**Current architecture:** Browser-only EMR with **IndexedDB** persistence, no authentication, no backend API for clinical data.

---

## 1. Every Form and Field Currently Present

### 1.1 Application Shell (Navigation Tabs)

| Tab ID | Purpose |
|--------|---------|
| `dashboardTab` | Stats, recent activity, quick actions |
| `formTab` | Read-only visit view + entry point for New/Edit visit modal |
| `recordsTab` | Searchable list of all saved visits |
| `keratoplastyTab` | Keratoplasty register (4 sub-panels) |
| `databaseTab` | Export/import/clear + ICD settings display |

---

### 1.2 Patient Visit Form (`#patientForm` — opened in `#emrPatientModal`)

Data is collected as a **flat JSON object**: each input `id` becomes a property; radio groups use `name` as the property key.

#### Section 1 — Patient Information
| Field ID / Name | Type | Notes |
|-----------------|------|-------|
| `currentRecordId` | hidden | IndexedDB record key when editing |
| `patientId` | text | Required; triggers visit history + autofill |
| `fullName` | text | Required |
| `dob` | date | Required; auto-calculates `age` |
| `age` | number | Read-only, computed |
| `sex` | radio | `Male` / `Female` (required) |
| `phone` | tel | |
| `visitDate` | date | Defaults to today |
| `address` | textarea | |

#### Section 2 — Clinical History
| Field ID | Type |
|----------|------|
| `chiefComplaint` | textarea |
| `durationSymptoms` | text |
| `previousTreatments` | text |
| `ocularHistory` | textarea |
| `systemicHistory` | textarea |
| `currentMedication` | textarea |
| `familyHistory` | textarea |

#### Section 3 — Vision & Refraction (from `Refraction record.docx`)

**General**
| Field ID / Name | Type | Values / Notes |
|-----------------|------|----------------|
| `refractionVisionChart` | radio | Number chart / Letter chart / E chart |
| `refractionOccupation` | text | |
| `refractionComplaints` | textarea | |

**Present Glasses (PG) Power**
| Field ID | Type |
|----------|------|
| `pgDvReSph`, `pgDvReCyl`, `pgDvReAxis`, `pgDvReVa`, `pgDvReSpecCond` | text |
| `pgDvLeSph`, `pgDvLeCyl`, `pgDvLeAxis`, `pgDvLeVa`, `pgDvLeSpecCond` | text |
| `pgNvReAdd`, `pgNvLeAdd` | text |
| `pgDuration`, `pgGlassType`, `pgLens`, `pgFrame`, `pgDboc` | text |
| `pgMpdRe`, `pgMpdLe` | text |

**Retinoscopy**
| Field ID / Name | Type |
|-----------------|------|
| `refractionRetinoType` | radio | Dynamic / Cyclo |
| `refractionRetinoWd` | text | Working distance |
| `retinoReSph`, `retinoReCyl`, `retinoReAxis` | text |
| `retinoLeSph`, `retinoLeCyl`, `retinoLeAxis` | text |

**Subjective Refraction**
| Field ID | Type | Legacy role |
|----------|------|-------------|
| `visionREUCVA`, `visionLEUCVA` | text | DV VA unaided |
| `subDvReSph`, `subDvReCyl`, `subDvReAxis`, `subDvReVaPh` | text | |
| `visionREBCVA`, `visionLEBCVA` | text | DV VA |
| `subDvLeSph`, `subDvLeCyl`, `subDvLeAxis`, `subDvLeVaPh` | text | |
| `subNvReVaUa`, `subNvReSph`, `subNvReCyl`, `subNvReAxis`, `subNvReVa`, `subNvReVaPh` | text | NV RE |
| `subNvLeVaUa`, `subNvLeSph`, `subNvLeCyl`, `subNvLeAxis`, `subNvLeVa`, `subNvLeVaPh` | text | NV LE |

**Refraction footer**
| Field ID / Name | Type |
|-----------------|------|
| `refractionJcc` | radio | Yes / No |
| `refractionDuoChrome` | radio | Done / Not done |
| `refractionMhPresent` | radio | Yes / No |
| `refractionCycloNeeded` | radio | Yes / No |
| `refractionComfortablePg` | radio | Yes / No |
| `refractionWantsSpectacles` | radio | Yes / No |
| `refractionSignature` | text | |
| `refractionTime` | time | |
| `refractionAdvise` | textarea | Legacy field `distantRemarks` migrated on load |

#### Section 4 — Investigations & Vitals
| Field ID | Type |
|----------|------|
| `iopRE`, `iopLE` | text |
| `bp` | text |
| `sugar` | text |

#### Section 5 — Anterior Segment Examination
| Field ID | Structure | Notes |
|----------|-----------|-------|
| `lidRE`, `lidLE` | text + autocomplete | ~200+ built-in lid condition strings |
| `conjRE`, `conjLE` | text | |
| `corneaRE`, `corneaLE` | text | |
| `acRE`, `acLE` | text | |
| `irisRE`, `irisLE` | text | |
| `pupilRE`, `pupilLE` | text | |
| `lensRE`, `lensLE` | text | |
| `movementRE`, `movementLE` | text | |
| `reflexRE`, `reflexLE` | text | |
| `globeRE`, `globeLE` | text | |
| `fundusUndRE`, `fundusUndLE` | text | Undilated fundus |
| `remarksAntRE`, `remarksAntLE` | textarea | |

**Actions:** Set Normal Findings, Pull Previous Visit (anterior segment only)

#### Section 5A — Anterior Segment Drawing
| Field ID | Type | Content |
|----------|------|---------|
| `anteriorDrawingJSON` | hidden | SVG draw-layer HTML + zoom/pan/marker state |
| `anteriorDrawingImage` | hidden | Base64 PNG data URL (2× scale, ~2800×1800) |
| `anteriorDrawingPreview` | display div | Inline preview |

**Drawing Studio modal** (`#anteriorDrawingModal`): full SVG canvas editor; tools for pen, shapes, text, export JSON/PNG/SVG; base image from `Anterior segment sketch.png`.

#### Section 6 — Fundus Examination
| Field ID | Type |
|----------|------|
| `mediaRE`, `mediaLE` | text |
| `discRE`, `discLE` | text |
| `vesselRE`, `vesselLE` | text |
| `retinaRE`, `retinaLE` | text |
| `fovealRE`, `fovealLE` | text |
| `fundusRemarksRE`, `fundusRemarksLE` | textarea |

#### Section 7 — Diagnosis & Plan
| Field ID | Type | Notes |
|----------|------|-------|
| `diagnosis` | textarea | ICD-11 autocomplete (WHO API via proxy) |
| `diagnosisIcdStatus` | status text | UI only, not persisted |
| `opinionReferral` | textarea | |
| `specialRemarks` | textarea | |
| `advise` | textarea | General advice |

#### Section 8 — Medical Advice (dynamic table → JSON)
Stored in `medicalAdviceJSON` as array of objects:

| JSON key | UI control |
|----------|------------|
| `eye` | select: RE / LE / BE / OU |
| `drugName` | text |
| `route` | select: Topical, Oral, IM, IV, SC, Periocular, Other |
| `duration` | text |
| `frequency` | text |
| `form` | select: Drops, Ointment, Gel, Tablet, Capsule, Injection, Other |
| `instruction` | textarea |

#### Section 9 — Follow Up
| Field ID / Name | Type | Notes |
|-----------------|------|-------|
| `followUpDate` | hidden | Computed ISO date |
| `followUpInterval` | hidden | e.g. `3d`, `1m`, `custom` |
| `followUpCustomDate` | date | |
| `followUpDateDisplay` | text readonly | |
| `followUpPlace` | text | |
| `followUpPurpose` | text | |
| `followUpSeverity` | hidden | severe / moderate / mild (button group) |
| `followUpRemarks` | textarea | |

**Form actions:** Clear Form, Save to Database

---

### 1.3 Records Tab UI
| Field ID | Purpose |
|----------|---------|
| `searchInput` | Client-side filter on `#recordsBody` rows |

---

### 1.4 Database Tab UI
| Field ID | Purpose |
|----------|---------|
| `importFile` | File input for JSON import |
| `icdReadOnlyView` | Display-only ICD credential status |

---

### 1.5 ICD Settings Modal (`#icdSettingsModal`)
| Field ID | Type |
|----------|------|
| `icdApiClientId` | text |
| `icdApiClientSecret` | password |

---

### 1.6 Keratoplasty Patient Modal (`#kpPatientModal`)
| Field ID | Type | Notes |
|----------|------|-------|
| `kpRecordId` | hidden | IndexedDB key |
| `kpPatientId` | text readonly | Auto: `KP-P-####` |
| `kpFullName` | text | Required |
| `kpAge` | number | |
| `kpGender` | select | Male / Female / Other |
| `kpPhone` | tel | |
| `kpAddress` | text | |
| `kpEye` | select | OD / OS / OU |
| `kpDiagnosis` | select | Keratoconus, corneal scar, etc. |
| `kpProcedure` | select | PKP, DSAEK, DMEK, DALK, TPK, etc. |
| `kpPrognosis` | select | Good / Fair / Poor / Nil |
| `kpUrgency` | select | Emergency / Urgent / Elective |
| `kpCornealSize` | number | mm |
| `kpDonorAgePref` | text | |
| `kpEndothelialReq` | number | |
| `kpInfection` | select | Yes / No |
| `kpVisualAxis` | select | Yes / No |
| `kpStatus` | select | Waiting / Matched / Scheduled / Completed / Cancelled |
| `kpRegDate` | date | |
| `kpSurgeryDate` | date | |
| `kpNotes` | textarea | |

**Filter controls (UI only):** `kpFilterProcedure`, `kpFilterUrgency`, `kpFilterStatus`, `kpFilterPrognosis`, `kpPatientSearch`

---

### 1.7 Keratoplasty Tissue Modal (`#kpTissueModal`)
| Field ID | Type | Notes |
|----------|------|-------|
| `kpTissueRecordId` | hidden | |
| `kpTissueId` | text readonly | Auto: `KP-T-####` |
| `kpDonorAge` | number | |
| `kpDonorGender` | select | |
| `kpDeathToPreservation` | number | hours |
| `kpPreservationDate` | date | |
| `kpExpiryDate` | date | |
| `kpSpecular` | number | |
| `kpEdema` | select | None / Mild / Moderate / Severe |
| `kpClarity` | select | Clear / Mild haze / Hazy / Opaque |
| `kpInfectionRisk` | select | Low / Moderate / High |
| `kpOpticalGrade` | text readonly | Auto-calculated |
| `kpTherapeuticGrade` | text readonly | Auto-calculated |
| `kpTissueStatus` | select | Available / Reserved / Ordered / Used / Expired / Discarded |
| `kpStorageMedium` | text | |
| `kpStorageLocation` | text | |
| `kpEyeBank` | text | |

**Runtime-only tissue field (not in form):** `kpReservedFor` (set when reserving tissue)

**Filter controls:** `kpTissueFilterStatus`, `kpTissueSearch`

---

### 1.8 Keratoplasty Matching Panel
| Field ID | Type |
|----------|------|
| `kpMatchPatientSelect` | select |
| `kpMatchCompatibleOnly` | checkbox |
| `kpMatchAvailableOnly` | checkbox |

---

### 1.9 Visit History Sidebar (Form Tab)
| Element ID | Purpose |
|------------|---------|
| `visitHistorySidebar` | Previous visits for same `patientId` |
| `visitHistoryList` | Visit list |
| `visitHistoryDetail` | Selected visit summary |
| `visitHistoryPatientLabel` | Header |
| `visitHistoryCount` | Count badge |

---

## 2. Every Place Where Data Is Stored

### 2.1 IndexedDB — `CorneaClinicDB` (version 3)

| Object Store | Key | Indexes | Record shape |
|--------------|-----|---------|--------------|
| `patients` | `id` (auto-increment) | `fullName`, `phone`, `visitDate`, `patientId` | **Flat visit document**: all form fields + `lastModified` + optional `id` |
| `kpPatients` | `id` (auto-increment) | `kpPatientId` (unique), `kpStatus` | Keratoplasty patient register row |
| `kpTissues` | `id` (auto-increment) | `kpTissueId` (unique), `kpTissueStatus` | Tissue inventory row + `kpReservedFor` |

**Patient visit document includes embedded blobs:**
- `medicalAdviceJSON` — JSON string array
- `anteriorDrawingJSON` — JSON string (SVG layer HTML)
- `anteriorDrawingImage` — Base64 PNG data URL (potentially multi-MB)

**Computed at save time (not separate stores):**
- `lastModified` ISO timestamp on all three stores

---

### 2.2 localStorage

| Key | Content |
|-----|---------|
| `corneaClinic_icdClientId` | WHO ICD-11 API client ID |
| `corneaClinic_icdClientSecret` | WHO ICD-11 API client secret |

---

### 2.3 In-Memory (JavaScript globals — lost on refresh)

| Variable | Purpose |
|----------|---------|
| `window.db` | IndexedDB connection |
| `window._currentViewRecordId` | Active visit record ID |
| `window._patientVisitsCache` | Visits for current `patientId` |
| `_lastAutofillPatientId` | Autofill dedup |
| `_kpPatientsCache`, `_kpTissuesCache` | Keratoplasty table data |
| `window._kpSelectedPatientId`, `window._kpSelectedTissueId` | KP read-only selection |
| `drawingState` | Drawing studio session state |
| `drawingState.sketchDataUrl` | Cached base sketch as data URL |
| `_icdTokenCache` | WHO API token + expiry |
| `_icdProxyOk` | Proxy availability flag |
| `_lidAllOptions` | Built lid condition string list |
| `_icdSearchSeq` | ICD autocomplete request sequencing |

---

### 2.4 Server-Side (clinic-server.js only)

| Storage | Content |
|---------|---------|
| In-memory `tokenByClient` Map | WHO ICD OAuth tokens keyed by clientId |
| Filesystem | Static serve: `Cornea.html`, `Anterior segment sketch.png`, etc. |

**No clinical data is persisted on the server today.**

---

### 2.5 External Files (not in DB)

| File | Role |
|------|------|
| `Anterior segment sketch.png` | Drawing studio background (loaded at runtime, cached to data URL) |
| Exported JSON (`CorneaClinic_Export_*.json`) | Manual backup of `patients` store only |
| Exported CSV (keratoplasty) | Generated client-side download |
| Drawing exports (JSON/PNG/SVG) | Client-side download only |

---

## 3. Browser Storage Dependencies

| Mechanism | Used? | Details |
|-----------|-------|---------|
| **IndexedDB** | **Yes — primary** | All clinical + keratoplasty data |
| **localStorage** | **Yes** | ICD API credentials only |
| **sessionStorage** | No | |
| **Cookies** | No | |
| **Cache API** | No | |
| **File System Access API** | No | Uses `<input type="file">` + download links |
| **Service Workers / PWA** | No | |

**Additional browser dependencies:**
- `fetch()` to local ICD proxy (`/icd/ping`, `/icd/token`, `/icd/search`)
- Canvas 2D API (drawing PNG rasterization)
- SVG DOM + `XMLSerializer`
- `window.open()` + `document.write()` for print windows
- `Blob`, `URL.createObjectURL`, `FileReader`
- Font Awesome + Google Fonts CDN

---

## 4. Features That Will Break When Moving to a Server Database

### 4.1 Critical — Core persistence
| Feature | Why it breaks |
|---------|---------------|
| Save/load patient visits | Entirely IndexedDB `put`/`get`; no API |
| Patient records list | `getAll()` + cursor on local store |
| Dashboard stats | Aggregates local `patients` store |
| Edit/delete visit | Direct IndexedDB by local auto-increment `id` |
| Visit history sidebar | IndexedDB index on `patientId` |
| Patient ID autofill | Queries prior visits from local DB |
| Pull previous anterior segment | Copies fields from last local visit |
| Keratoplasty CRUD | Separate IndexedDB stores, no server sync |
| Tissue reservation / matching | Client-side cache + local `put` updates |

### 4.2 Data model / multi-user issues
| Issue | Impact |
|-------|--------|
| **No authentication or authorization** | All users would share one browser DB today |
| **Visit = flat document with duplicated demographics** | No master patient entity; cloud needs patient/encounter split |
| **Local auto-increment IDs** | Collisions across devices/users; not globally unique |
| **`patientId` is user-typed text** | No UUID enforcement; duplicate risk on import |
| **No audit trail** | No created_by, updated_by, version history |
| **No concurrent edit control** | Last write wins locally; multi-user edits will conflict |
| **No tenant/clinic isolation** | Required for cloud multi-user EMR |

### 4.3 Large binary in JSON columns
| Feature | Risk |
|---------|------|
| `anteriorDrawingImage` as Base64 in visit record | DB bloat, slow API payloads, JSON column limits |
| `anteriorDrawingJSON` as inline SVG HTML string | Should move to object storage + structured annotation model |
| Full visit export as one JSON blob | Needs file storage + normalized tables |

### 4.4 Backup / import / export
| Feature | Breaks because |
|---------|----------------|
| Export database | Only exports `patients`; excludes keratoplasty stores |
| Import database | Strips `id`, re-`add`s locally; no merge strategy for cloud |
| Clear all data | Only clears `patients` store |
| Keratoplasty CSV export | Client-generated; needs server-side reporting |

### 4.5 External integrations
| Feature | Issue |
|---------|-------|
| ICD-11 lookup | Credentials in **localStorage**; sent from browser to proxy; needs server-side secret vault |
| ICD proxy requirement | App expects `http://127.0.0.1:8080`; breaks on `file://` |
| WHO token cache | Per-browser memory; should be server-side |

### 4.6 UI / client assumptions
| Feature | Issue |
|---------|-------|
| Records search | DOM text filter only; won't scale |
| Abnormal finding highlighting | Client-side rules vs stored normal values |
| Lid autocomplete | Hardcoded JS array; should be reference data API |
| Drawing sketch PNG | Relative file path; needs CDN/object storage URL |
| Print / preview | Builds HTML from **current form DOM**, not from stored server record unless loaded first |
| Read-only view | Rendered client-side from in-memory/form data |

### 4.7 Operational
| Gap | Notes |
|-----|-------|
| No offline sync queue | Fully offline today; cloud needs explicit offline strategy if required |
| No encryption at rest | Browser DB is unencrypted |
| No HIPAA-style access logging | Not implemented |
| Keratoplasty matching engine | Business logic in browser; must move to server for consistency |

---

## 5. Proposed PostgreSQL Database Schema

Design principles: **multi-tenant**, **master patient + encounters**, **normalized clinical sections**, **object storage for drawings**, **audit columns on all clinical tables**.

```sql
-- ============ TENANCY & AUTH ============
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email         TEXT NOT NULL,
  password_hash TEXT,                    -- or external IdP subject
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','doctor','refractionist','nurse','clerk')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PATIENTS ============
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  mrn             TEXT NOT NULL,              -- maps to patientId
  full_name       TEXT NOT NULL,
  dob             DATE,
  sex             TEXT CHECK (sex IN ('Male','Female','Other')),
  phone           TEXT,
  address         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, mrn)
);

-- ============ ENCOUNTERS (VISITS) ============
CREATE TABLE encounters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  visit_date      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','cancelled')),
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE encounter_clinical_history (
  encounter_id        UUID PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
  chief_complaint     TEXT,
  duration_symptoms   TEXT,
  previous_treatments TEXT,
  ocular_history      TEXT,
  systemic_history    TEXT,
  current_medication  TEXT,
  family_history      TEXT
);

-- ============ REFRACTION ============
CREATE TABLE encounter_refraction (
  encounter_id              UUID PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
  vision_chart              TEXT,
  occupation                TEXT,
  complaints                TEXT,
  pg_duration               TEXT,
  pg_glass_type             TEXT,
  pg_lens                   TEXT,
  pg_frame                  TEXT,
  pg_dboc                   TEXT,
  pg_mpd_re                 TEXT,
  pg_mpd_le                 TEXT,
  retino_type               TEXT,
  retino_working_distance   TEXT,
  jcc                       TEXT,
  duo_chrome                TEXT,
  mh_present                TEXT,
  cyclo_needed              TEXT,
  comfortable_pg            TEXT,
  wants_spectacles          TEXT,
  signature                 TEXT,
  refraction_time           TIME,
  advise                    TEXT
);

CREATE TABLE refraction_pg_power (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  distance_type TEXT NOT NULL CHECK (distance_type IN ('DV','NV')),
  eye         TEXT NOT NULL CHECK (eye IN ('RE','LE')),
  sphere      TEXT,
  cylinder    TEXT,
  axis        TEXT,
  va_with_pg  TEXT,
  spec_condition TEXT,
  nv_add      TEXT
);

CREATE TABLE refraction_retinoscopy (
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  eye          TEXT NOT NULL CHECK (eye IN ('RE','LE')),
  sphere       TEXT,
  cylinder     TEXT,
  axis         TEXT,
  PRIMARY KEY (encounter_id, eye)
);

CREATE TABLE refraction_subjective (
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  distance_type TEXT NOT NULL CHECK (distance_type IN ('DV','NV')),
  eye          TEXT NOT NULL CHECK (eye IN ('RE','LE')),
  va_unaided   TEXT,
  sphere       TEXT,
  cylinder     TEXT,
  axis         TEXT,
  va           TEXT,
  va_with_ph   TEXT,
  PRIMARY KEY (encounter_id, distance_type, eye)
);

-- ============ VITALS ============
CREATE TABLE encounter_vitals (
  encounter_id UUID PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
  iop_re       TEXT,
  iop_le       TEXT,
  bp           TEXT,
  blood_sugar  TEXT
);

-- ============ EXAM FINDINGS (RE/LE) ============
CREATE TABLE encounter_exam_findings (
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  section      TEXT NOT NULL CHECK (section IN ('anterior','fundus')),
  structure    TEXT NOT NULL,
  eye          TEXT NOT NULL CHECK (eye IN ('RE','LE')),
  finding      TEXT,
  remarks      TEXT,
  PRIMARY KEY (encounter_id, section, structure, eye)
);

-- ============ ANTERIOR DRAWING ============
CREATE TABLE encounter_drawings (
  encounter_id     UUID PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
  annotation_json  JSONB NOT NULL DEFAULT '{}',   -- drawLayer, zoom, pan, markers
  preview_png_url  TEXT,                          -- S3/GCS path
  svg_export_url   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ DIAGNOSIS & PLAN ============
CREATE TABLE encounter_plan (
  encounter_id     UUID PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
  diagnosis_text   TEXT,
  icd11_code       TEXT,
  icd11_title      TEXT,
  opinion_referral TEXT,
  special_remarks  TEXT,
  advise           TEXT
);

CREATE TABLE encounter_medications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  sort_order   INT NOT NULL DEFAULT 0,
  eye          TEXT,
  drug_name    TEXT,
  route        TEXT,
  duration     TEXT,
  frequency    TEXT,
  form         TEXT,
  instruction  TEXT
);

CREATE TABLE encounter_follow_up (
  encounter_id   UUID PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
  follow_up_date DATE,
  interval_code  TEXT,
  place          TEXT,
  purpose        TEXT,
  severity       TEXT CHECK (severity IN ('severe','moderate','mild')),
  remarks        TEXT
);

-- ============ KERATOPLASTY ============
CREATE TABLE kp_patients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  kp_patient_id    TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  age              INT,
  gender           TEXT,
  phone            TEXT,
  address          TEXT,
  eye              TEXT,
  diagnosis        TEXT,
  procedure        TEXT,
  prognosis        TEXT,
  urgency          TEXT,
  corneal_size_mm  NUMERIC(4,1),
  donor_age_pref   TEXT,
  endothelial_req  INT,
  infection        TEXT,
  visual_axis      TEXT,
  status           TEXT NOT NULL,
  reg_date         DATE,
  surgery_date     DATE,
  notes            TEXT,
  recommended_tissue_id UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kp_patient_id)
);

CREATE TABLE kp_tissues (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id),
  kp_tissue_id         TEXT NOT NULL,
  donor_age            INT,
  donor_gender         TEXT,
  death_to_preservation_hrs NUMERIC(6,1),
  preservation_date    DATE,
  expiry_date          DATE,
  specular_count       INT,
  edema                TEXT,
  clarity              TEXT,
  infection_risk       TEXT,
  optical_grade        TEXT,
  therapeutic_grade    TEXT,
  tissue_status        TEXT NOT NULL,
  storage_medium       TEXT,
  storage_location     TEXT,
  eye_bank             TEXT,
  reserved_for_kp_patient_id TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kp_tissue_id)
);

CREATE TABLE kp_match_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kp_patient_id   UUID NOT NULL REFERENCES kp_patients(id),
  kp_tissue_id    UUID NOT NULL REFERENCES kp_tissues(id),
  score           INT,
  compatible      BOOLEAN,
  checklist       JSONB,
  warnings        JSONB,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ REFERENCE / CONFIG ============
CREATE TABLE lid_conditions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),  -- NULL = system default
  label           TEXT NOT NULL,
  category        TEXT
);

CREATE TABLE icd_api_credentials (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  client_id       TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id         UUID,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,
  diff            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_encounters_patient_date ON encounters(patient_id, visit_date DESC);
CREATE INDEX idx_patients_org_mrn ON patients(organization_id, mrn);
CREATE INDEX idx_kp_patients_status ON kp_patients(organization_id, status);
CREATE INDEX idx_kp_tissues_status ON kp_tissues(organization_id, tissue_status);
```

---

## 6. Proposed API Endpoints

Base: `/api/v1` — all routes require auth except `/auth/*` and health check. Tenant scoped by JWT `organization_id`.

### Auth & Users
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | Email/password → JWT |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Current user profile |
| GET | `/users` | List org users (admin) |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Update role/status |

### Patients
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/patients` | Search/list (q, page, limit) |
| POST | `/patients` | Create master patient |
| GET | `/patients/:id` | Patient demographics |
| PATCH | `/patients/:id` | Update demographics |
| GET | `/patients/:id/encounters` | Visit history (replaces visit sidebar) |
| GET | `/patients/by-mrn/:mrn` | Lookup by MRN |

### Encounters (Patient Visits)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/encounters` | Create visit shell |
| GET | `/encounters/:id` | Full encounter (all sections) |
| PATCH | `/encounters/:id` | Partial update (section-based) |
| POST | `/encounters/:id/finalize` | Lock visit |
| DELETE | `/encounters/:id` | Soft-delete |
| GET | `/encounters/:id/summary` | Print/preview HTML or PDF |
| POST | `/encounters/:id/clone-from/:sourceId` | Pull previous anterior segment |

### Encounter Sub-resources
| Method | Endpoint | Purpose |
|--------|----------|---------|
| PUT | `/encounters/:id/clinical-history` | Section 2 |
| PUT | `/encounters/:id/refraction` | Full refraction block |
| PUT | `/encounters/:id/vitals` | IOP/BP/sugar |
| PUT | `/encounters/:id/exam-findings` | Anterior + fundus grid |
| PUT | `/encounters/:id/plan` | Diagnosis & advice |
| PUT | `/encounters/:id/medications` | Replace medication rows |
| PUT | `/encounters/:id/follow-up` | Follow-up block |

### Drawings
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/encounters/:id/drawing` | Annotation JSON + signed PNG URL |
| PUT | `/encounters/:id/drawing` | Save annotation JSON |
| POST | `/encounters/:id/drawing/preview` | Upload PNG (multipart) → object storage |
| GET | `/assets/anterior-segment-sketch` | Base sketch template URL |

### Dashboard & Records
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard/stats` | Totals, today visits, sex ratio, recent activity |
| GET | `/encounters` | Paginated visit list (records tab) |

### ICD-11 (server-side proxy)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/icd/ping` | Health |
| GET | `/icd/search?q=` | Autocomplete (server holds WHO credentials) |
| PUT | `/settings/icd-credentials` | Admin: store org WHO keys |
| DELETE | `/settings/icd-credentials` | Clear keys |

### Keratoplasty
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/keratoplasty/overview` | Stats + alerts |
| GET/POST | `/keratoplasty/patients` | List / create |
| GET/PATCH/DELETE | `/keratoplasty/patients/:id` | CRUD |
| GET/POST | `/keratoplasty/tissues` | List / create |
| GET/PATCH/DELETE | `/keratoplasty/tissues/:id` | CRUD |
| POST | `/keratoplasty/match` | Run matching engine for patient |
| POST | `/keratoplasty/reservations` | Reserve tissue for patient |
| GET | `/keratoplasty/export/patients.csv` | CSV export |
| GET | `/keratoplasty/export/tissues.csv` | CSV export |
| GET | `/keratoplasty/match-report/:patientId` | Printable match report |

### Reference Data
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/reference/lid-conditions` | Autocomplete source |
| GET | `/reference/normal-findings` | Anterior/fundus normals |

### Admin / Migration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/admin/import/legacy-json` | One-time IndexedDB export import |
| GET | `/admin/export/encounters.json` | Full backup |
| GET | `/health` | Service health |

---

## 7. Proposed Project Folder Structure

```
cornea-emr/
├── apps/
│   ├── web/                          # React/Vue/Next frontend (split from Cornea.html)
│   │   ├── public/
│   │   │   └── assets/
│   │   │       └── anterior-segment-sketch.png
│   │   ├── src/
│   │   │   ├── app/                  # Router, providers, layout
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── patients/
│   │   │   │   ├── encounters/
│   │   │   │   │   ├── forms/        # Patient, refraction, exam, plan sections
│   │   │   │   │   ├── drawing-studio/
│   │   │   │   │   └── read-only/
│   │   │   │   ├── records/
│   │   │   │   ├── keratoplasty/
│   │   │   │   └── settings/
│   │   │   ├── components/           # Shared UI (tables, modals, badges)
│   │   │   ├── hooks/
│   │   │   ├── api/                  # Typed API client
│   │   │   ├── stores/               # Client state (not clinical persistence)
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── api/                          # Node.js / NestJS / Fastify backend
│       ├── src/
│       │   ├── main.ts
│       │   ├── config/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── organizations/
│       │   │   ├── patients/
│       │   │   ├── encounters/
│       │   │   ├── drawings/
│       │   │   ├── keratoplasty/
│       │   │   ├── icd/
│       │   │   ├── reference/
│       │   │   └── admin/
│       │   ├── db/
│       │   │   ├── migrations/
│       │   │   └── seeds/
│       │   └── common/               # DTOs, guards, audit middleware
│       └── package.json
│
├── packages/
│   ├── shared-types/                 # Encounter, Refraction, KP types (TS + JSON Schema)
│   ├── clinical-rules/               # Normal findings, KP matching protocol (shared)
│   └── ui-tokens/                    # Design system variables (from current CSS)
│
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.web
│   │   └── docker-compose.yml        # api + web + postgres + redis + minio
│   ├── terraform/                    # Cloud deployment (optional)
│   └── k8s/
│
├── scripts/
│   ├── migrate-indexeddb-export.ts   # Legacy JSON → Postgres import
│   └── seed-reference-data.sql
│
├── docs/
│   ├── api.openapi.yaml
│   ├── data-model.md
│   └── migration-from-local.md
│
├── legacy/
│   ├── Cornea.html                   # Archived single-file app
│   ├── clinic-server.js
│   └── start-clinic.bat
│
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
│
├── package.json                      # Monorepo root (pnpm/turbo)
└── README.md
```

---

**Summary:** The application today is a rich single-user ophthalmology EMR with ~**120+ persisted visit fields**, dynamic medications, SVG drawing artifacts, keratoplasty register, and WHO ICD lookup — all anchored on **IndexedDB** with **no server-side clinical persistence**. A cloud migration requires splitting **patients vs encounters**, moving **drawings and secrets** off the browser, replacing **local CRUD** with authenticated REST APIs, and porting **keratoplasty matching** and **ICD proxy** logic to the backend.
/**
 * One-off generator: Cornea Clinic EMR Project Status Audit → .docx
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} = require('docx');

const OUT = path.join(__dirname, '..', 'Cornea-Clinic-EMR-Project-Status-Audit.docx');

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, size: 22 })],
  });
}

function boldP(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: label, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 180 }, children: [new TextRun(text)] });
}

function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 140 }, children: [new TextRun(text)] });
}

function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [new TextRun(text)] });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function table(headers, rows) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const headerCells = headers.map(
    (h) =>
      new TableCell({
        borders,
        shading: { fill: 'E8EEF4', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })],
      })
  );
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders,
              children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 20 })] })],
            })
        ),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...dataRows],
  });
}

const doc = new Document({
  creator: 'Cornea Clinic EMR Audit',
  title: 'Cornea Clinic EMR — Project Status Audit',
  description: 'Complete project status audit — read-only inspection',
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({ text: 'Cornea Clinic EMR', bold: true, size: 36 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: 'Project Status Audit', bold: true, size: 32 })],
        }),
        boldP('Audit date: ', '11 June 2026'),
        boldP('Scope: ', 'Read-only inspection of Cornea Clinic file/ (primary EMR) and cornea-emr/ (backend API)'),
        boldP('Method: ', 'File inventory, module review, storage/auth/sync analysis, changelog verification'),
        p('No code was modified during this audit.', { spacing: { after: 300 } }),

        h1('Executive Summary'),
        p('The Cornea Clinic EMR is a specialty ophthalmology / cornea clinic application delivered primarily as a single-page offline-first web app (Cornea.html + ~40 JavaScript modules). It supports full visit documentation, advanced cornea workflows (anterior segment builder, contact lens, scleral wizard, laser refractive work-up), keratoplast/eye-bank register, patient flow, and clinical image management.'),
        p('A separate Node.js/PostgreSQL API (cornea-emr v0.2.0) provides optional cloud sync, media storage, audit logs, and user administration. The frontend can run fully offline via IndexedDB.'),
        p('Overall maturity: ~68% of a production tertiary cornea-centre EMR vision.'),

        table(
          ['Dimension', 'Score /10', 'Progress'],
          [
            ['Clinical functionality', '7.5', '75%'],
            ['Cornea specialty depth', '8.5', '85%'],
            ['User experience', '7.0', '70%'],
            ['Code quality / maintainability', '5.5', '55%'],
            ['Security', '6.0', '60%'],
            ['Research capability', '4.5', '45%'],
            ['AI capability (rule-based CDS)', '6.5', '65%'],
            ['Scalability / enterprise readiness', '5.0', '50%'],
            ['Overall maturity', '6.8', '68%'],
          ]
        ),
        p(''),
        p('Strengths: Deep cornea-specific modules, offline resilience, backward-compatible JSON extensions, rule-based AI advisors with clinician override, keratoplast/tissue matching, rich printing.'),
        p('Gaps: Monolithic HTML/CSS, limited automated testing, no analytics/registry dashboard, no device/DICOM integration, research export only (no statistics engine), partial cloud/backend integration.'),

        h1('Part 1 — Project Summary'),
        table(
          ['Item', 'Detail'],
          [
            ['Project name', 'Cornea Clinic EMR / Cornea Clinic Management System'],
            ['Application type', 'Browser-based EMR (SPA-style), offline-capable PWA-like'],
            ['Architecture', 'Frontend: Vanilla JS + inline CSS in Cornea.html. Backend (optional): Express API + PostgreSQL. Sync: IndexedDB ↔ API queue'],
            ['Storage', 'IndexedDB (CorneaClinicDB v6), localStorage, optional PostgreSQL + file storage'],
            ['External dependencies', 'Google Fonts, Font Awesome CDN, WHO ICD-11 API, optional Cornea EMR REST API'],
            ['Approx. code size', '~58 files, ~20,000–25,000 lines JS + HTML (Cornea.html ~4,985 lines)'],
            ['Main modules', 'Patient form, anterior segment builder, contact lens, scleral wizard, laser work-up, keratoplast, patient flow, visit media, audit, auth/sync'],
          ]
        ),
        p(''),
        h2('Major JavaScript components'),
        table(
          ['File', 'Role', '~Lines'],
          [
            ['Cornea.html', 'Shell UI, CSS, all form sections', '~4,985'],
            ['cornea-anterior-segment.js', 'Slit-lamp builder', '~880'],
            ['cornea-contact-lens.js', '10-tab CL module', '~1,025'],
            ['cornea-scleral-lens.js', '13-step wizard', '~715'],
            ['cornea-scleral-lens-advisor.js', 'AI scleral advisor', '~464'],
            ['cornea-laser-refractive.js', '13-tab laser work-up', '~680'],
            ['cornea-laser-refractive-advisor.js', 'AI refractive planner', '~370'],
            ['cornea-visit-media.js', 'Documents & images', '~1,026'],
            ['cornea-visual-acuity.js', 'VA / refraction tables', '~730'],
            ['js/keratoplast.js', 'KP register, tissue, matching', '~1,100'],
            ['cornea-sync-client.js', 'Cloud sync queue', '~868'],
            ['cornea-api-adapter.js', 'Cloud login, API bridge', '~780'],
            ['cornea-offline-auth.js', 'Local users, roles, PBKDF2', '~785'],
            ['js/patient-form.js', 'Form collect, read-only view', '~705'],
            ['js/anterior-drawing.js', 'SVG drawing studio', '~880'],
            ['cornea-audit-trail.js', 'Local audit log', '~459'],
            ['cornea-patient-flow.js', 'Clinic station queue', '~471'],
          ]
        ),
        p(''),
        h2('Major CSS'),
        bullet('Inline in Cornea.html: ~2,500+ lines (variables, layout, themes, module styles)'),
        bullet('Theme system: section-theme-* (patient, vision, anterior, contact lens, refractive, keratoplast, audit, etc.)'),
        bullet('Module styles: .cl-*, .sl-*, .lr-*, .asb-*, .kp-*, .flow-*, .emr-ro-*'),
        h2('Major HTML sections (patient form)'),
        bullet('Patient Information'),
        bullet('Clinical History'),
        bullet('Vision & Refraction (+ optional Contact Lens, Laser Work-up)'),
        bullet('Investigations & Vitals'),
        bullet('Anterior Segment Examination (builder)'),
        bullet('Anterior Segment Drawing'),
        bullet('Fundus Examination'),
        bullet('Diagnosis & Management Plan (+ Medical Advice)'),
        bullet('Documents & Clinical Images'),
        bullet('Follow Up'),
        p('App tabs: Dashboard · Patient Form · Records · Patient Flow · Keratoplast · Database'),

        h1('Part 2 — Implemented Modules'),
        table(
          ['Module', 'Status', 'Completion', 'Notes'],
          [
            ['Patient registration / visits', 'Complete', '95%', 'IndexedDB, autofill, visit history sidebar'],
            ['Clinical history', 'Complete', '90%', 'Standard form fields'],
            ['Visual acuity', 'Complete', '90%', 'cornea-visual-acuity.js, collapsible tables'],
            ['Refraction', 'Complete', '85%', 'Manifest, cycloplegic, VA charts'],
            ['Investigations & vitals', 'Complete', '80%', 'IOP, BP, sugar'],
            ['Anterior segment (legacy + builder)', 'Complete', '90%', 'Taxonomy-driven slit-lamp builder'],
            ['Slit-lamp builder', 'Complete', '85%', 'OD/OS, templates, favorites, export'],
            ['Anterior segment drawing', 'Complete', '80%', 'SVG studio, PNG export'],
            ['Fundus examination', 'Partial', '70%', 'Legacy text fields; no dedicated builder'],
            ['Diagnosis & ICD-11', 'Complete', '85%', 'WHO API autocomplete'],
            ['Medical advice / Rx rows', 'Complete', '80%', 'Structured prescription table'],
            ['Follow-up', 'Complete', '85%', 'Intervals, severity, print'],
            ['Contact lens (10 tabs)', 'Complete', '80%', 'Optional section, inventory in localStorage'],
            ['Scleral lens wizard (13 steps)', 'Complete', '85%', 'Optional, auto-save, print'],
            ['AI scleral advisor', 'Partial', '75%', 'Rule-based CDS; accept/reject/modify'],
            ['Laser refractive work-up (13 tabs)', 'Complete', '80%', 'Risk/planning calculations'],
            ['AI refractive planner', 'Partial', '75%', 'Rule-based; persistent sidebar'],
            ['Keratoplast register', 'Complete', '75%', 'Patients, waiting list, procedures'],
            ['Eye bank / tissue inventory', 'Complete', '70%', 'Tissue CRUD, expiry alerts, matching engine'],
            ['Dashboard', 'Partial', '60%', 'Basic counts; no analytics charts'],
            ['Patient flow / stations', 'Complete', '75%', '11 stations incl. Pentacam, LASIK work-up'],
            ['Clinical images & documents', 'Complete', '75%', 'Upload, modal preview, cloud sync'],
            ['Database export/import', 'Complete', '85%', 'Full bundle + legacy JSON'],
            ['User management', 'Complete', '80%', '6 offline roles + cloud admin API'],
            ['Audit trail', 'Partial', '75%', 'Local IndexedDB; cloud audit via API'],
            ['Section attribution', 'Complete', '70%', 'Per-section edit metadata'],
            ['Collapsible form sections', 'Complete', '90%', 'Session persistence'],
            ['Cloud sync', 'Partial', '65%', 'Queue-based; requires API deployment'],
            ['Research / registries', 'Partial', '40%', 'JSON export only'],
            ['Prescriptions API (backend)', 'Prototype', '30%', 'API routes exist; not wired in frontend'],
            ['Automated testing', 'Partial', '25%', 'API vitest only; no frontend tests'],
            ['Appointments / billing', 'Not implemented', '0%', '—'],
            ['DICOM / device integration', 'Not implemented', '0%', 'Manual image upload only'],
          ]
        ),

        h1('Part 3 — Ophthalmology Features'),
        table(
          ['Feature', 'Status', 'Implementation'],
          [
            ['Visual acuity', 'Yes', 'Distance/near, pinhole, charts, OD/OS tables'],
            ['Refraction', 'Yes', 'Manifest, cycloplegic, auto-Rx, vertex, add'],
            ['Anterior segment', 'Yes', 'Full taxonomy: lids, conjunctiva, cornea, AC, iris, lens'],
            ['Cornea', 'Yes', 'KC, graft, ulcer, dystrophy, neovascularization, etc.'],
            ['Anterior chamber', 'Yes', 'In anterior builder taxonomy'],
            ['Iris', 'Yes', 'In anterior builder taxonomy'],
            ['Pupil', 'Yes', 'In anterior builder + aberrometry (laser module)'],
            ['Lens', 'Yes', 'Cataract grades, IOL status in builder'],
            ['Contact lenses', 'Yes', 'Full fitting module + scleral wizard'],
            ['Scleral lenses', 'Yes', '13-step wizard + AI advisor'],
            ['Keratoplast', 'Yes', 'Dedicated register tab'],
            ['Eye bank', 'Yes', 'Tissue inventory within keratoplast module'],
            ['Clinical drawings', 'Yes', 'Anterior segment SVG studio'],
            ['Image management', 'Yes', 'Slit lamp, topography, AS-OCT, PDF documents'],
            ['AI decision support', 'Yes', 'Scleral + laser rule-based advisors'],
            ['Surgical planning', 'Yes', 'Laser module: RSB, PTA, procedure ranking'],
            ['Follow-up', 'Yes', 'Visit-level + module-specific (CL, scleral, laser)'],
            ['Fundus', 'Partial', 'Text fields only; no structured posterior builder'],
            ['Glaucoma / VF', 'No', 'Not implemented'],
            ['Retina / OCT posterior', 'No', 'Not implemented'],
            ['Cataract surgery module', 'No', 'Not implemented'],
            ['Corneal crosslinking registry', 'No', 'Mentioned in AI suggestions only'],
          ]
        ),

        h1('Part 4 — AI Modules'),
        table(
          ['AI Feature', 'Status', 'Type', 'Capabilities'],
          [
            ['AI Scleral Lens Advisor', 'Implemented', 'Rule-based expert system', 'Clearance tiers, limbal/landing/decentration, OR, complications, diagnosis-specific, safety alerts, trial lens suggestion, accept/reject/modify, learning (localStorage)'],
            ['AI Laser Refractive Planner', 'Implemented', 'Rule-based expert system', 'Ectasia/dry eye risk, procedure ranking, RSB/PTA, night vision, surgical plan, patient counseling draft, safety score, follow-up trend, accept/reject/modify'],
            ['Machine learning / LLM', 'Not implemented', '—', 'No neural models or external AI APIs'],
            ['Image AI (topography analysis)', 'Not implemented', '—', 'Manual data entry only'],
            ['Predictive outcomes ML', 'Planned / absent', '—', 'Outcome fields exist; no predictive models'],
          ]
        ),
        p('Important: All AI is clinical decision support — transparent rules, clinician override, never auto-writes clinical data.'),

        h1('Part 5 — Database'),
        h2('IndexedDB (CorneaClinicDB v6)'),
        table(
          ['Store', 'Purpose'],
          [
            ['patients', 'Visit records (flat JSON fields + embedded JSON blobs)'],
            ['kpPatients', 'Keratoplast waiting-list patients'],
            ['kpTissues', 'Corneal tissue inventory'],
            ['users', 'Local offline accounts (hashed passwords)'],
            ['sync_queue', 'Pending cloud mutations'],
            ['sync_meta', 'Device ID, pull cursor'],
            ['sync_logs', 'Sync history'],
            ['audit_logs', 'Local audit trail'],
          ]
        ),
        p(''),
        h2('localStorage keys (selected)'),
        table(
          ['Key', 'Purpose'],
          [
            ['corneaSlAiLearning', 'Scleral AI successful fittings'],
            ['corneaLrAiLearning', 'Laser AI successful procedures'],
            ['corneaClInventory', 'Contact lens inventory'],
            ['corneaEmr_apiToken', 'Cloud auth token'],
            ['corneaOfflineSession', 'Local session'],
            ['Anterior segment favorites/recent', 'Builder UX'],
          ]
        ),
        p(''),
        h2('Visit record JSON fields (optional, backward compatible)'),
        bullet('contactLensJSON, scleralLensJSON, laserRefractiveJSON'),
        bullet('anteriorSegmentJSON, medicalAdviceJSON'),
        bullet('visitMediaJSON, sectionAttribution'),
        bullet('anteriorDrawingImage (base64)'),
        bullet('Standard flat fields (examination, refraction, etc.)'),
        h2('Backups'),
        bullet('Export full DB bundle (cornea-migration-tool.js) — Yes'),
        bullet('Import with validation — Yes'),
        bullet('No scheduled automatic backup'),
        bullet('Cloud backup depends on PostgreSQL deployment'),
        h2('Weaknesses'),
        bullet('Large base64 images in visit records can bloat IndexedDB'),
        bullet('No schema versioning for embedded JSON modules beyond version: 1'),
        bullet('No encryption at rest for local IndexedDB'),
        bullet('Sync conflict resolution is queue-based, not CRDT'),
        bullet('Single-browser, single-device model for offline auth'),

        h1('Part 6 — User Interface'),
        table(
          ['UI Element', 'Status'],
          [
            ['Dashboard', 'Basic stats + recent activity'],
            ['Sidebar navigation', '6 main tabs + quick actions'],
            ['Responsive design', 'Partial — mobile sidebar, stacked AI panels'],
            ['Mobile compatibility', 'Usable; dense tabs/chips on small screens'],
            ['Print compatibility', 'Strong — @media print, summary reports'],
            ['Modals', 'Patient form modal, document preview, KP modals, drawing studio'],
            ['Search', 'Records list only; no global patient search'],
            ['Autocomplete', 'Lids, diagnosis ICD-11, anterior findings'],
            ['Quick actions', 'Dashboard shortcuts, normal findings, templates'],
            ['Wizard interfaces', 'Scleral (13 steps), Laser (13 tabs), CL subnav'],
            ['Collapsible sections', 'Per-card expand/collapse + toolbar'],
            ['Themed read-only view', 'Document view with section-theme-*'],
            ['Patient flow board', 'Station-based queue'],
          ]
        ),

        h1('Part 7 — Security'),
        table(
          ['Area', 'Status', 'Detail'],
          [
            ['Authentication', 'Yes', 'Cloud JWT + offline PBKDF2 (120k iterations)'],
            ['Authorization', 'Yes', '6 roles, section access, permission checks on save/delete/export'],
            ['Session timeout', 'Yes', '30 min offline inactivity'],
            ['Input validation', 'Partial', 'Minimal client-side; relies on clinician'],
            ['File validation', 'Partial', '25 MB limit on media; type by accept attribute'],
            ['Audit logs', 'Yes', 'Local append-only + cloud audit API'],
            ['Encryption', 'Partial', 'HTTPS for cloud; local data unencrypted'],
            ['Backup safety', 'Partial', 'Export is plaintext JSON'],
            ['XSS mitigation', 'Yes', 'escapeHtml() used widely'],
            ['CSRF', 'Partial', 'Token-based API; local app less relevant'],
          ]
        ),
        h2('Potential vulnerabilities'),
        bullet('ICD client credentials in localStorage (documented in UI)'),
        bullet('No Content Security Policy headers (static file)'),
        bullet('Exported JSON contains full PHI unencrypted'),
        bullet('Shared workstation session if user does not lock/logout'),
        bullet('Cloud/offline auth duality may confuse permission enforcement'),

        h1('Part 8 — Code Quality'),
        table(
          ['Issue', 'Severity', 'Detail'],
          [
            ['Monolithic HTML', 'High', '~5k lines UI + CSS in one file'],
            ['Duplicate CSS', 'Low', '.section-theme-refractive declared twice'],
            ['Build/patch scripts', 'Medium', 'build-phase*.js, patch-*.js indicate incomplete extraction'],
            ['Duplicate escapeHtml', 'Low', 'Repeated in many modules'],
            ['Large functions', 'Medium', 'buildPanels(), renderPatientReadOnly(), keratoplast.js'],
            ['Global namespace', 'Medium', 'window.* pattern throughout'],
            ['No frontend tests', 'High', 'Zero automated UI/module tests'],
            ['Event listener duplication', 'Low', 'Mitigated in AI panels with bind-once flags'],
            ['Memory (images)', 'Medium', 'Base64 in records; blob URLs in media preview'],
            ['Technical debt', 'Medium', 'Legacy + new anterior builder dual sync'],
          ]
        ),

        h1('Part 9 — Research Capabilities'),
        table(
          ['Capability', 'Status'],
          [
            ['Structured JSON modules', 'Yes'],
            ['Per-module JSON export', 'Yes — all major modules'],
            ['Full database export', 'Yes — migration bundle'],
            ['AI decision logging', 'Yes — aiAdvisor.log on save'],
            ['Keratoplast CSV export', 'Yes — patients + tissues'],
            ['Registries dashboard', 'No'],
            ['Outcome statistics', 'No aggregation engine'],
            ['Cohort queries', 'Not implemented'],
            ['Teaching cases', 'Not implemented'],
            ['De-identification tools', 'Not implemented'],
            ['Publication-ready analytics', 'Not implemented'],
          ]
        ),

        h1('Part 10 — Missing Modules (Tertiary Cornea Centre)'),
        h2('Critical'),
        bullet('Corneal crosslinking / ectasia registry with longitudinal topography'),
        bullet('Structured graft survival & rejection tracking (linked to KP register)'),
        bullet('Device integration (Pentacam, OCT, specular) — auto-import, not manual'),
        bullet('Enterprise multi-user concurrent access with record locking'),
        h2('High priority'),
        bullet('Analytics / research dashboard (cohorts, outcomes, AI decision vs surgeon)'),
        bullet('Posterior segment structured examination module'),
        bullet('Operating theatre / surgical log integration'),
        bullet('Appointment scheduling & wait-list management'),
        bullet('CXL / therapeutic procedure workflows'),
        h2('Medium priority'),
        bullet('Cataract / RLE surgical module (frontend; screening exists in laser module)'),
        bullet('Glaucoma monitoring'),
        bullet('Telemedicine / remote review'),
        bullet('HL7 FHIR export'),
        bullet('Automated backup scheduling'),
        h2('Low priority'),
        bullet('Billing / insurance'),
        bullet('SMS/email patient reminders'),
        bullet('Multi-language support'),
        bullet('Native mobile app'),

        h1('Part 11 — Project Roadmap'),
        p('Estimated overall completion: 68%'),
        p('Estimated remaining work: ~32% (12–18 months for tertiary-centre production readiness with 2–3 developers)'),
        h2('Phase 1 — Stabilisation (0–3 months)'),
        bullet('Split Cornea.html into CSS/modules'),
        bullet('Frontend unit tests for storage + JSON parsers'),
        bullet('Image storage strategy (blob store vs inline base64)'),
        bullet('Fix duplicate CSS, document all JSON schemas'),
        bullet('End-to-end sync testing with deployed API'),
        p('Dependencies: None. Target completion after phase: 75%'),
        h2('Phase 2 — Clinical depth (3–9 months)'),
        bullet('CXL / ectasia registry'),
        bullet('Graft outcome linkage (KP ↔ visit records)'),
        bullet('Posterior segment builder'),
        bullet('Research dashboard (export aggregation, basic stats)'),
        bullet('Pentacam/OCT import pipeline (folder watch or API)'),
        p('Dependencies: Phase 1 storage refactor. Target completion after phase: 82%'),
        h2('Phase 3 — Enterprise & research (9–15 months)'),
        bullet('Full cloud-primary deployment path'),
        bullet('Role-based analytics & registry reports'),
        bullet('Record locking / multi-clinician workflow'),
        bullet('De-identified research export'),
        bullet('FHIR/CSV registry formats'),
        p('Dependencies: PostgreSQL production, Phase 2 data model. Target completion after phase: 90%'),
        h2('Phase 4 — Advanced (15+ months)'),
        bullet('Validated ML models (ectasia prediction) — separate from rule CDS'),
        bullet('DICOM integration'),
        bullet('Theatre integration'),
        bullet('Multi-site deployment'),
        p('Target completion after phase: 95%+'),

        h1('Part 12 — Bug Report'),
        h2('Critical'),
        p('None confirmed without runtime testing; IndexedDB size exhaustion from embedded images is a potential critical production risk.'),
        h2('Major'),
        bullet('Large monolith increases regression risk on any edit'),
        bullet('No automated frontend tests — module integration breaks may go undetected'),
        bullet('Cloud/offline dual mode — permission and sync edge cases possible'),
        h2('Minor'),
        bullet('Duplicate .section-theme-refractive CSS rule'),
        bullet('Keratoplast tab hidden in print CSS for form tab (intentional but may confuse)'),
        bullet('Some laser module chip collection paths are complex (assessment vs shared fields)'),
        h2('Potential / incomplete'),
        bullet('AI follow-up comparison requires manual visit entry — not auto-linked across visits'),
        bullet('Scleral AI learning uses localStorage only (not per-clinician on cloud)'),
        bullet('Fundus pull previous depends on legacy field names'),
        bullet('build-phase*.js scripts may be stale relative to current Cornea.html'),
        h2('Broken features'),
        p('None identified statically; requires manual QA on all 13 laser tabs, scleral wizard, cloud sync.'),

        h1('Part 13 — Performance Report'),
        table(
          ['Area', 'Rating', 'Notes'],
          [
            ['Initial load', 'Moderate', '~5k line HTML + 30+ script tags; no bundling/minification'],
            ['Storage efficiency', 'Poor–Moderate', 'Base64 images in visit JSON'],
            ['Image handling', 'Good', 'Blob URLs for preview; 25 MB cap'],
            ['Database efficiency', 'Good', 'Indexed indices on key fields; getAll for dashboard'],
            ['Autocomplete', 'Good', 'Debounced ICD search'],
            ['Mobile performance', 'Moderate', 'Sticky AI panels, many DOM nodes on open modules'],
            ['Print performance', 'Good', 'Dedicated print CSS, modal-free summary'],
          ]
        ),

        h1('Part 14 — Compatibility'),
        table(
          ['Check', 'Status'],
          [
            ['Existing patient records', 'Flat fields preserved; optional JSON modules ignored if absent'],
            ['IndexedDB v6 migration', 'Upgrade path in storage.js'],
            ['Module JSON versioning', 'version: 1 on CL, scleral, laser'],
            ['Backward compatibility', 'Strong — new fields optional'],
            ['Cross-module', 'Hooks in init.js, patient-form.js, visits.js, printing.js'],
            ['Cloud sync compatibility', 'Requires API v0.2.0 + migration export format'],
            ['Browser support', 'Modern browsers with IndexedDB + Web Crypto'],
          ]
        ),

        h1('Part 15 — Technical Metrics (Approximate)'),
        table(
          ['Metric', 'Value'],
          [
            ['Total files (Cornea Clinic file/)', '58'],
            ['Lines of code (JS + HTML)', '~20,000–25,000'],
            ['JavaScript modules', '~40 application + ~8 build/patch'],
            ['CSS class rules (in HTML)', '~800+'],
            ['addEventListener usages', '~150+ across modules'],
            ['IndexedDB object stores', '8'],
            ['localStorage keys', '~10+ application keys'],
            ['Form sections', '10 (+ 2 optional)'],
            ['App-level tabs', '6'],
            ['Changelog documents', '6'],
            ['Backend API (cornea-emr)', 'v0.2.0, PostgreSQL, 13+ migrations'],
          ]
        ),

        h1('Part 16 — Clinical Readiness (Score /10)'),
        table(
          ['Setting', 'Score', 'Rationale'],
          [
            ['General ophthalmology clinic', '7', 'Strong anterior segment; weak fundus/posterior'],
            ['Cornea clinic', '8.5', 'Core strength — builder, CL, scleral, drawings'],
            ['Contact lens clinic', '8', 'Full module + scleral wizard'],
            ['Refractive surgery', '7.5', '13-tab work-up + AI planner; no OR integration'],
            ['Eye bank', '7', 'Tissue inventory + matching; not full regulatory suite'],
            ['Keratoplast programme', '7.5', 'Register, urgency, matching, CSV export'],
            ['Research', '4.5', 'Export only; no analytics'],
            ['Teaching', '6', 'Rich UI; no case library'],
            ['Tertiary referral centre', '6.5', 'Deep specialty; missing enterprise, registries, devices'],
          ]
        ),

        h1('Part 17 — Overall Scores'),
        table(
          ['Category', 'Score /10'],
          [
            ['Clinical functionality', '7.5'],
            ['Code quality', '5.5'],
            ['User experience', '7.0'],
            ['Performance', '6.0'],
            ['Security', '6.0'],
            ['Research capability', '4.5'],
            ['AI capability', '6.5'],
            ['Maintainability', '5.5'],
            ['Scalability', '5.0'],
            ['Overall maturity', '6.8'],
          ]
        ),

        h1('Part 18 — Next Five Highest-Value Improvements'),
        table(
          ['Rank', 'Improvement', 'Clinical impact', 'Effort', 'Safety', 'Research', 'Scalability'],
          [
            ['1', 'Externalise images from visit JSON (IndexedDB blob store or cloud media only)', 'Medium', 'Medium', 'High', 'Medium', 'High'],
            ['2', 'Research/analytics dashboard over exported JSON + AI decision logs', 'High', 'Medium', 'Low', 'High', 'Medium'],
            ['3', 'CXL / ectasia longitudinal registry linked to topography fields', 'High', 'High', 'High', 'High', 'Medium'],
            ['4', 'Modularise Cornea.html + frontend tests for storage/JSON modules', 'Medium', 'Medium', 'Medium', 'Low', 'High'],
            ['5', 'Production cloud sync hardening (conflict rules, media sync, backup policy)', 'Medium', 'High', 'Medium', 'Medium', 'High'],
          ]
        ),

        h1('Development Roadmap (Summary)'),
        p('NOW (68%) → Phase 1 Stabilise (75%) → Phase 2 Clinical (82%) → Phase 3 Enterprise (90%+)'),
        bullet('Phase 1: Image storage, HTML split, frontend tests, sync QA'),
        bullet('Phase 2: CXL registry, graft outcomes, research dashboard, device import'),
        bullet('Phase 3: Multi-site, FHIR export, record locking'),
        p('Current state: Rich cornea EMR, rule-based AI CDS, offline-first'),

        h1('Appendix — File Inventory Summary'),
        p('Primary application path: c:\\Users\\Hp\\Documents\\trae_projects\\Cornea Clinic file\\'),
        p('Backend path: c:\\Users\\Hp\\Documents\\trae_projects\\cornea-emr\\apps\\api\\ (optional)'),
        h2('Changelogs documenting recent work'),
        bullet('CHANGELOG-contact-lens-module.md'),
        bullet('CHANGELOG-scleral-lens-wizard.md'),
        bullet('CHANGELOG-scleral-lens-ai-advisor.md'),
        bullet('CHANGELOG-laser-refractive-module.md'),
        bullet('CHANGELOG-laser-refractive-ai-planner.md'),
        bullet('CHANGELOG-anterior-segment-builder.md'),
        p(''),
        p('This audit is based on static code inspection. Runtime QA, load testing, and security penetration testing were not performed. No code was modified during this audit.', {
          spacing: { before: 400 },
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log('Created:', OUT);
  console.log('Size:', buffer.length, 'bytes');
});

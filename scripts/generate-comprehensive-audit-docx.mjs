/**
 * Generates Comprehensive Tertiary Cornea EMR Global Audit as Word document.
 * Run: node scripts/generate-comprehensive-audit-docx.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
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
  PageBreak,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'Comprehensive_Tertiary_Cornea_EMR_Global_Audit.docx');

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 180 }, children: [new TextRun(text)] });
}

function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 140 }, children: [new TextRun(text)] });
}

function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [new TextRun(text)] });
}

function p(text) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 22 })] });
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

function bullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, size: 22 })] });
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

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: 'Cornea Clinic EMR', bold: true, size: 36 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'Comprehensive Tertiary Cornea EMR', bold: true, size: 28 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Global Audit Report', bold: true, size: 28 })],
  }),
  boldP('Audit date: ', '21 June 2026'),
  boldP('Scope: ', 'Read-only inspection of cornea-emr monorepo (apps/clinic + apps/api + deployment + backup)'),
  boldP('Method: ', 'Static codebase review, architecture docs, operational state (sync, audit, backup)'),
  boldP('Audit team: ', 'Senior Cornea Specialist, Refractive Surgeon, Contact Lens Specialist, Eye Bank Director, Clinical Informatician, Health IT Architect, Cybersecurity Expert, Database Architect, Cloud Infrastructure Engineer, QA Lead, Medical Research Director'),
  p('No code was modified during this audit.'),
  p('Verdict: A specialist cornea clinic EMR with tertiary-depth modules in places, but not yet a full tertiary institute platform without registries, device integration, enterprise workflow, and research analytics.'),

  h1('Section 1 — Executive Summary'),
  table(
    ['Dimension', 'Score (/100)', 'Summary'],
    [
      ['Overall maturity', '72', 'Strong specialty cornea EMR with working cloud sync and backups'],
      ['Clinical readiness', '76', 'Excellent anterior segment, CL/scleral/laser/KP; weak ulcer/CXL/registries'],
      ['Production readiness', '70', 'Live on Cloudflare + DO; DB backup operational; media/HA gaps'],
      ['Security', '65', 'Solid auth/RBAC/audit; local PHI unencrypted; thin security testing'],
      ['Research readiness', '42', 'Structured JSON + export; no analytics engine or registries'],
      ['AI readiness', '58', 'Mature rule-based CDS; no ML, imaging AI, or validated models'],
      ['Cloud readiness', '71', 'Offline-first sync working; DO /tmp/media ephemeral; dynamic IP affects backup'],
      ['Overall completion', '72%', 'Up from prior ~68% after sync, audit, and backup hardening'],
    ]
  ),
  p(''),

  h1('Section 2 — Live Deployment Review'),
  table(
    ['Area', 'Status', 'Assessment'],
    [
      ['Cloud deployment', 'Operational', 'UI: Cloudflare Workers; API: DO App Platform'],
      ['Remote accessibility', 'OK', 'api.visionemr.net, corneaclinic.visionemr.net'],
      ['Performance', 'Moderate', '~5k-line Cornea.html + 30+ scripts; no bundling'],
      ['Loading speed', 'Moderate', 'Acceptable desktop; heavy on mobile with modules open'],
      ['Storage strategy', 'Split', 'IndexedDB local; PostgreSQL JSONB cloud; DO /tmp/media ephemeral'],
      ['Image / media handling', 'Partial', '25 MB cap; base64 bloat risk; cloud sync via media_assets'],
      ['Backup systems', 'Strong', 'Local daily + production nightly; AES off-site copies'],
      ['Disaster recovery', 'Partial', 'Restore scripts exist; cloud media not in DB dumps'],
      ['Scalability', 'Limited', 'Single DO instance; in-memory rate limits'],
      ['Multi-user support', 'OK', 'Cloud auth, RBAC, cross-user sync stable'],
      ['Reliability', 'Partial', 'Backup depends on DO Trusted Sources IP whitelist'],
      ['Offline functionality', 'Strong', 'IndexedDB + offline auth (PBKDF2)'],
      ['Synchronization', 'Strong', 'Push/pull/conflicts; idempotent mutations; audit on push'],
    ]
  ),
  h3('Key risks'),
  bullet('Ephemeral cloud media on DigitalOcean App Platform (/tmp/media)'),
  bullet('Dynamic public IP blocking production backup until DO Trusted Sources updated'),
  bullet('Single-instance API; no high availability'),
  bullet('Large monolithic static assets without bundling/minification'),

  pageBreak(),
  h1('Section 3 — Clinical Workflow Audit'),
  table(
    ['Module / Workflow', 'Score (/10)', 'Notes'],
    [
      ['Patient registration', '7.5', 'Demographics, history, visit sidebar, returning patient autofill'],
      ['Visual acuity', '8.0', 'Distance/near, pinhole, trends, pediatric blocks'],
      ['Refraction', '8.0', 'Subjective OD/OS, legacy compatibility'],
      ['Anterior segment / slit lamp', '8.0', 'Taxonomy-driven builder; flagship module'],
      ['Clinical drawing', '7.0', 'Full SVG studio; ulcer auto-link incomplete'],
      ['Contact lens fitting', '7.0', '10 tabs; no AI advisor'],
      ['Scleral lens wizard', '8.0', '13-step wizard + AI advisor'],
      ['AI scleral advisor', '7.5', 'Rule-based CDS; accept/reject/modify'],
      ['Laser refractive surgery', '7.5', '13-tab work-up + risk/planning'],
      ['AI refractive planner', '7.5', 'Procedure ranking, RSB/PTA, counseling draft'],
      ['Keratoplasty', '7.5', 'Register, matching, urgency, print'],
      ['Eye bank', '6.0', 'Embedded in KP; inventory + matching only'],
      ['Patient flow', '7.0', '11 stations; labels not deep-linked to forms'],
      ['Diagnosis', '7.0', 'ICD-11 cloud autocomplete + free text'],
      ['Treatment', '7.0', 'Structured Rx rows; no e-prescribing'],
      ['Follow-up', '7.0', 'Intervals, severity, print'],
      ['Clinical documentation', '7.5', 'Rich print summaries'],
      ['Referral workflow', '5.0', 'Free-text opinionReferral only'],
      ['Surgical workflow', '6.5', 'Laser consent/record; KP register; no generic OT note'],
      ['Emergency workflow', '5.5', 'KP urgency badges; no keratitis emergency queue'],
    ]
  ),

  h1('Section 4 — Cornea Specialist Audit'),
  table(
    ['Condition / Service', 'Readiness (/10)', 'Gap'],
    [
      ['Corneal ulcer management', '5.0', 'Findings/templates only; no registry or culture tracking'],
      ['Microbial keratitis', '5.0', 'Taxonomy + safety deferrals in CL/scleral AI'],
      ['HSV / HZO keratitis', '6.0', 'Anterior templates; no antiviral protocol workflow'],
      ['Fungal keratitis', '5.0', 'Finding chips; no antifungal protocol module'],
      ['Acanthamoeba', '4.0', 'Mentioned in taxonomy; no dedicated workflow'],
      ['Keratoconus', '5.5', 'Cross-module indications; no KC/CXL longitudinal registry'],
      ['Corneal dystrophies / degeneration', '6.5–7.0', 'Structured anterior findings'],
      ['Corneal grafts', '7.5', 'KP register strong; weak post-graft visit linkage'],
      ['Ocular surface disease', '7.5', 'Scleral/CL modules; dry eye in laser risk'],
      ['Chemical injuries', '6.0', 'Trauma mode in anterior builder'],
      ['Dry eye', '7.0', 'Laser/scleral integration; no standalone DED registry'],
      ['Neurotrophic keratitis', '6.5', 'Indications + findings'],
      ['LSCD', '6.0', 'Documentable; no LSCD programme module'],
      ['Bullous / band keratopathy', '6.5', 'Finding-level + KP pathway'],
    ]
  ),
  p('Cornea specialist readiness: 6.5/10 — excellent documentation tools; missing disease-specific registries and emergency pathways.'),

  h1('Section 5 — Refractive Surgery Audit'),
  table(
    ['Capability', 'Score (/10)', 'Status'],
    [
      ['LASIK / SMILE / PRK / TransPRK', '7.5–8.0', 'Work-up + AI ranking'],
      ['PTK', '7.0', 'Mentioned in planning'],
      ['ICL screening', '7.0', 'Screening fields present'],
      ['RLE screening', '6.0', 'Partial in laser module'],
      ['Risk calculations', '8.0', 'Ectasia, dry eye, RSB, PTA'],
      ['AI planning', '7.5', 'Rule-based planner'],
      ['Surgical planning', '7.0', 'Consent + surgery record tabs'],
      ['Outcome tracking', '6.0', 'Fields exist; no aggregate analytics'],
      ['Safety systems', '7.5', 'Alerts, deferrals, safety score'],
    ]
  ),
  h3('Deficiencies'),
  bullet('No topography device import (Pentacam manual entry)'),
  bullet('No OR/laser device integration'),
  bullet('CXL mentioned as procedure option only; no CXL registry'),
  bullet('No national refractive outcomes registry'),
  p('Refractive centre readiness: 7.2/10'),

  pageBreak(),
  h1('Section 6 — Contact Lens Audit'),
  table(
    ['Area', 'Score (/10)', 'Gap'],
    [
      ['Soft / RGP / Hybrid lenses', '7.0–7.5', 'Full module tabs'],
      ['Scleral / mini scleral', '8.0 / 7.0', 'Best-in-class scleral wizard'],
      ['Bandage CL / post-graft / KC fitting', '7.5–8.0', 'Indications + templates'],
      ['Orthokeratology', '5.0', 'Not dedicated'],
      ['Inventory', '6.0', 'localStorage only; not multi-user cloud'],
      ['Follow-up / outcomes', '6.0–7.5', 'Manual; no cohort stats'],
      ['AI advisor', '7.5 (scleral only)', 'Contact lens has no AI'],
    ]
  ),
  p('Contact lens centre readiness: 7.3/10'),

  h1('Section 7 — Keratoplasty Audit'),
  table(
    ['Feature', 'Score (/10)', 'Status'],
    [
      ['Waiting list', '8.0', 'KP register with urgency'],
      ['Donor matching', '7.5', 'Scoring engine + protocol checklists'],
      ['Tissue allocation', '7.0', 'Reserve via sync entity'],
      ['Surgery planning', '6.0', 'Pre-op fields; no OT scheduling'],
      ['Postoperative tracking', '5.0', 'Not linked longitudinally to visits'],
      ['Rejection / failure tracking', '4.0', 'Finding-level only'],
      ['Outcome / research value', '5.0–6.0', 'CSV export; no analytics'],
    ]
  ),
  p('Keratoplasty service readiness: 6.8/10'),

  h1('Section 8 — Eye Bank Audit'),
  table(
    ['Feature', 'Score (/10)', 'Status'],
    [
      ['Inventory', '7.0', 'Tissue CRUD in KP module'],
      ['Donor records', '5.5', 'Basic donor age/gender/death-to-preservation'],
      ['Traceability', '4.0', 'No chain-of-custody, serology, quarantine'],
      ['Storage / quality grading', '6.0–6.5', 'Storage field, grades, specular count manual'],
      ['Allocation', '7.0', 'Matching engine'],
      ['Regulatory readiness', '3.5', 'Not eye-bank regulatory grade'],
      ['Cold chain documentation', '2.0', 'Not implemented'],
    ]
  ),
  p('Eye bank readiness: 5.0/10 — tissue inventory for clinical matching, not a standalone accredited eye bank system.'),

  pageBreak(),
  h1('Section 9 — AI System Audit'),
  h2('Every AI / CDS feature'),
  table(
    ['Feature', 'Type', 'Location'],
    [
      ['AI Scleral Lens Advisor', 'Rule-based CDS', 'cornea-scleral-lens-advisor.js'],
      ['AI Laser Refractive Planner', 'Rule-based CDS', 'cornea-laser-refractive-advisor.js'],
      ['Scleral taxonomy engine', 'Rules', 'cornea-scleral-lens-taxonomy.js'],
      ['Laser risk/planning calculator', 'Rules', 'cornea-laser-refractive-taxonomy.js'],
      ['Contact lens safety rules', 'Rules', 'cornea-contact-lens-taxonomy.js'],
      ['ICD-11 diagnosis assist', 'External API', 'js/diagnosis.js'],
      ['AI learning persistence', 'localStorage', 'corneaSlAiLearning, corneaLrAiLearning'],
      ['AI decision audit log', 'Visit JSON', 'aiAdvisor.log on save'],
    ]
  ),
  h2('Evaluation'),
  table(
    ['Criterion', 'Score (/10)'],
    [
      ['Transparency', '9.0 — explicit rules, printable rationale'],
      ['Reliability', '7.0 — deterministic; not clinically validated'],
      ['Clinical usefulness', '7.5 — strong for scleral/laser workflow'],
      ['Safety', '8.0 — deferrals for ulcer/infection; no auto-write'],
      ['Explainability', '8.5 — human-readable recommendations'],
      ['Override mechanisms', '9.0 — accept/reject/modify required'],
    ]
  ),
  h2('Future AI opportunities (ranked)'),
  bullet('1. Topography import + ectasia risk ML — High clinical impact'),
  bullet('2. Slit-lamp image classification assist — High research + triage value'),
  bullet('3. Graft rejection prediction from serial exams — Medium-high'),
  bullet('4. LLM referral letter drafting (supervised) — Medium'),
  bullet('5. Microbiology culture result parsing — Medium (ulcer service)'),
  bullet('6. Outcome prediction from registry data — Long-term'),
  p('Not present: LLM, neural networks, computer vision, predictive ML.'),

  h1('Section 10 — Database Audit'),
  table(
    ['Area', 'Assessment'],
    [
      ['Schema design', 'Strong PostgreSQL (14 migrations); tenant FKs; append-only audit; hybrid JSONB visits.payload'],
      ['IndexedDB', 'v6, 8 stores; flat + embedded JSON modules'],
      ['Cloud DB', 'PostgreSQL 16 on DO; multi-tenant via clinic_id'],
      ['Data consistency', 'Revision-based optimistic locking; sync_conflicts table'],
      ['Duplication', 'Legacy flat fields + new JSON modules dual-sync (anterior segment)'],
      ['Performance', 'Missing (clinic_id, updated_at, id) index on visits for keyset sync'],
      ['Image storage', 'Base64 in visits (local); media_assets table (cloud)'],
      ['Backup strategy', 'Local + production pg_dump + AES off-site (operational)'],
      ['Migration capability', 'Export/import bundle; admin migration service'],
      ['Scalability risks', 'JSONB full-document sync; sequential mutation processing; no RLS'],
    ]
  ),
  p('Database maturity: 7.0/10'),

  pageBreak(),
  h1('Section 11 — Security Audit'),
  table(
    ['Control', 'Status', 'Risk level'],
    [
      ['Authentication', 'JWT + rotating refresh + offline PBKDF2', 'Low'],
      ['Authorization', '7 roles, 18 permissions, EMR section gating', 'Low–Medium'],
      ['Session management', 'Family revocation on token reuse', 'Low'],
      ['Audit trails', 'DB append-only + local IndexedDB + cloud API', 'Low'],
      ['Data protection', 'Local PHI unencrypted; export plaintext JSON', 'High'],
      ['Cloud security', 'DO Trusted Sources IP-dependent', 'Medium'],
      ['Backup security', 'AES-256 off-site; key management manual', 'Medium'],
      ['File uploads', 'MIME allowlist, 25 MB; memory storage', 'Medium'],
      ['OWASP / HIPAA-like', 'XSS mitigated; no CSP; partial compliance', 'Medium–High'],
    ]
  ),
  h2('Top vulnerabilities (ranked)'),
  bullet('1. Local IndexedDB PHI unencrypted — workstation theft'),
  bullet('2. Cloud media on ephemeral /tmp — data loss on redeploy'),
  bullet('3. Plaintext JSON export — accidental PHI disclosure'),
  bullet('4. Thin automated security/integration testing'),
  bullet('5. In-memory rate limiting — brute-force under multi-instance'),
  bullet('6. No DB row-level security — application-only tenant isolation'),
  bullet('7. ICD credentials in localStorage'),
  bullet('8. Dynamic public IP — backup/ops failure (availability)'),
  p('Security score: 65/100'),

  h1('Section 12 — User Experience Audit'),
  table(
    ['Area', 'Score (/10)'],
    [
      ['Navigation', '7.5'],
      ['Speed', '6.0 — monolith load'],
      ['Data entry burden', '7.0 — chips/templates reduce typing'],
      ['Workflow efficiency', '7.5 — patient flow + collapsible sections'],
      ['Mobile compatibility', '6.0 — responsive; dense on phones'],
      ['Tablet compatibility', '6.5'],
      ['Printing', '8.0 — comprehensive reports'],
      ['Accessibility', '5.0 — limited ARIA/screen reader support'],
    ]
  ),

  h1('Section 13 — Research Audit'),
  table(
    ['Capability', 'Status'],
    [
      ['Structured data', 'Yes — major modules versioned JSON'],
      ['Registries', 'No — none operational'],
      ['Export capability', 'Yes — full DB bundle, KP CSV, module JSON'],
      ['Analytics / outcome studies', 'No — dashboard counts only'],
      ['Teaching cases / publication readiness', 'No'],
      ['De-identification tools', 'No'],
      ['Future research potential', 'High — data model research-ready if analytics layer added'],
    ]
  ),
  p('Research readiness: 42/100'),

  pageBreak(),
  h1('Section 14 — Quality Assurance Audit'),
  h2('Bugs / risks'),
  table(
    ['Severity', 'Item'],
    [
      ['Critical (potential)', 'IndexedDB exhaustion from embedded base64 images'],
      ['Critical (potential)', 'Cloud clinical media lost on DO redeploy'],
      ['Major', 'Monolithic Cornea.html (~5k lines) — high regression risk'],
      ['Major', 'Zero frontend automated tests'],
      ['Major', 'Cloud/offline permission edge cases'],
      ['Minor', 'Duplicate CSS; stale build-phase scripts; AI learning localStorage-only'],
    ]
  ),
  h2('Technical debt'),
  bullet('God-object services: syncService.js (~1,098 lines), migrationService.js (~915 lines)'),
  bullet('Hybrid JSONB + flat field dual sync'),
  bullet('Global window.* namespace pattern'),
  bullet('Duplicate audit API routes'),
  bullet('Build/patch phase scripts indicate incomplete modularization'),
  p('Automated test coverage: 5 Vitest files (API only); sync E2E script exists but not in CI.'),

  h1('Section 15 — Performance Audit'),
  table(
    ['Area', 'Rating', 'Notes'],
    [
      ['Application load', 'Moderate', 'No bundling; 30+ script tags'],
      ['Memory usage', 'Moderate–Poor', 'Base64 images; multer memory uploads'],
      ['Image performance', 'Good', 'Blob URLs for preview'],
      ['Database performance', 'Good local; Moderate cloud', 'JSONB full-document pulls'],
      ['Search performance', 'Moderate', 'Records list filter only'],
      ['Cloud synchronization', 'Good', 'Keyset cursors; batch limits'],
      ['Mobile performance', 'Moderate', 'Sticky AI panels, large DOM'],
    ]
  ),

  h1('Section 16 — Missing Modules'),
  table(
    ['Priority', 'Module', 'Clinical impact'],
    [
      ['Critical', 'CXL / ectasia longitudinal registry', 'Keratoconus centre core'],
      ['Critical', 'Infectious keratitis / ulcer service module', 'Emergency cornea care'],
      ['Critical', 'Device integration (Pentacam, specular, AS-OCT auto-import)', 'Tertiary standard of care'],
      ['Critical', 'Persistent cloud object storage for media', 'Patient safety / continuity'],
      ['High', 'Graft survival & rejection registry (KP ↔ visits)', 'Keratoplasty programme'],
      ['High', 'Research / analytics dashboard', 'Institute + national registry'],
      ['High', 'Accredited eye bank regulatory module', 'Eye bank standalone ops'],
      ['High', 'Appointment / wait-list management', 'Multi-service institute'],
      ['High', 'Structured posterior segment examination', 'Beyond cornea-only'],
      ['Medium', 'Operating theatre / surgical log integration', 'Surgical centres'],
      ['Medium', 'HL7 FHIR export / telemedicine', 'Interoperability'],
      ['Low', 'Billing / insurance / native mobile app', 'Admin / convenience'],
    ]
  ),

  pageBreak(),
  h1('Section 17 — Tertiary Cornea Institute Readiness'),
  table(
    ['Service / Centre', 'Score (/10)'],
    [
      ['Cornea clinic', '8.0'],
      ['Corneal ulcer centre', '5.0'],
      ['Ocular surface disease centre', '7.0'],
      ['Cross-linking centre', '3.5'],
      ['Keratoconus centre', '6.0'],
      ['Contact lens centre', '7.5'],
      ['Scleral lens centre', '8.0'],
      ['Laser refractive centre', '7.5'],
      ['Keratoplasty centre', '7.0'],
      ['Eye bank', '5.0'],
      ['Research centre', '4.5'],
      ['Teaching centre', '6.0'],
      ['National referral centre', '5.5'],
    ]
  ),

  h1('Section 18 — Top 25 Recommended Improvements'),
  table(
    ['#', 'Improvement', 'Priority', 'Clinical impact', 'Effort'],
    [
      ['1', 'Persistent media storage (R2/Spaces)', 'Critical', 'High', 'Medium'],
      ['2', 'CXL / ectasia registry', 'Critical', 'High', 'High'],
      ['3', 'Infectious keratitis module', 'Critical', 'High', 'High'],
      ['4', 'Pentacam/device import pipeline', 'Critical', 'High', 'High'],
      ['5', 'Graft outcome registry (KP ↔ visits)', 'High', 'High', 'Medium'],
      ['6', 'Research analytics dashboard', 'High', 'High', 'High'],
      ['7', 'Split monolithic HTML/CSS', 'High', 'Medium (safety)', 'Medium'],
      ['8', 'Frontend + sync integration tests', 'High', 'Medium (safety)', 'Medium'],
      ['9', 'Accredited eye bank module', 'High', 'Medium', 'Very High'],
      ['10', 'Appointment / wait-list system', 'High', 'Medium', 'High'],
      ['11', 'Posterior segment builder', 'High', 'Medium', 'Medium'],
      ['12', 'Visit sync performance index', 'High', 'Low–Med', 'Low'],
      ['13', 'Local IndexedDB encryption', 'High', 'High (security)', 'Medium'],
      ['14', 'De-identified research export', 'High', 'High', 'Medium'],
      ['15', 'Contact lens AI advisor', 'Medium', 'Medium', 'Medium'],
      ['16', 'Microbiology structured form', 'Medium', 'High (ulcer)', 'Medium'],
      ['17', 'Referral letter templates', 'Medium', 'Medium', 'Low'],
      ['18', 'Record locking / concurrent edit', 'Medium', 'Medium', 'High'],
      ['19', 'Distributed rate limiting', 'Medium', 'Low', 'Low'],
      ['20', 'FHIR export', 'Medium', 'Medium', 'High'],
      ['21', 'Ortho-K module', 'Medium', 'Low–Med', 'Medium'],
      ['22', 'Teaching case library', 'Medium', 'Med (teaching)', 'Medium'],
      ['23', 'PWA / offline install', 'Low', 'Low', 'Low'],
      ['24', 'Billing module', 'Low', 'Low', 'High'],
      ['25', 'Validated ectasia ML model', 'Long-term', 'High', 'Very High'],
    ]
  ),

  pageBreak(),
  h1('Section 19 — Development Roadmap'),
  h2('Phase 1 — Immediate (0–3 months)'),
  bullet('Persist cloud media (R2/Spaces)'),
  bullet('Production backup monitoring + static IP or VPN for DO Trusted Sources'),
  bullet('Visit sync index + expand API integration tests'),
  bullet('Complete restore drill (CREATEDB)'),
  bullet('Split Cornea.html CSS / critical path modularization'),
  h2('Phase 2 — Next 3 months'),
  bullet('CXL / ectasia registry'),
  bullet('Infectious keratitis structured module'),
  bullet('Graft outcome linkage (KP ↔ visits)'),
  bullet('Research dashboard v1 (exports + basic cohort stats)'),
  bullet('Pentacam CSV/import pilot'),
  h2('Phase 3 — Next 6 months'),
  bullet('Device integration pipeline (topography, specular)'),
  bullet('Posterior segment builder'),
  bullet('Appointment / wait-list'),
  bullet('De-identified research export'),
  bullet('Contact lens AI advisor'),
  h2('Phase 4 — Next 12 months'),
  bullet('Accredited eye bank regulatory features'),
  bullet('FHIR export'),
  bullet('Record locking / multi-clinician concurrent workflow'),
  bullet('Teaching case library'),
  bullet('HA API (multi-instance + shared rate limits)'),
  h2('Phase 5 — Long-term vision'),
  bullet('Validated ML ectasia prediction'),
  bullet('DICOM integration'),
  bullet('Theatre / laser device integration'),
  bullet('Multi-site national cornea registry'),
  bullet('Native mobile + telemedicine'),

  h1('Section 20 — Final Verdict'),
  h2('If development stopped today, suitability:'),
  table(
    ['Setting', 'Suitable?', 'Why'],
    [
      ['Small cornea clinic', 'Yes', 'Core exam, CL, scleral, laser work-up, print, offline — sufficient'],
      ['Large cornea clinic', 'Mostly yes', 'Multi-user sync works; lacks scheduling, analytics, device import'],
      ['Teaching hospital', 'Partially', 'Rich UI; no case library, weak posterior segment'],
      ['Eye bank (standalone)', 'No', 'Inventory/matching only; not regulatory eye-bank grade'],
      ['Tertiary cornea institute', 'No', 'Missing CXL registry, ulcer service, device integration, research platform'],
      ['National cornea registry', 'No', 'Export-only; no central analytics, de-ID, or registry APIs'],
    ]
  ),
  h2('Scores'),
  table(
    ['Metric', 'Value'],
    [
      ['Final maturity score', '72 / 100'],
      ['Realistic completion', '~72% of tertiary institute vision'],
      ['Remaining to tertiary-grade', '~28% (estimated 12–18 months with 2–3 developers)'],
    ]
  ),
  h2('Five highest-value next steps'),
  bullet('1. Move cloud media to persistent object storage — prevents clinical data loss on redeploy'),
  bullet('2. Build CXL / ectasia + infectious keratitis registries — closes biggest tertiary clinical gaps'),
  bullet('3. Add device import (Pentacam first) — eliminates manual entry bottleneck'),
  bullet('4. Link keratoplasty outcomes to visit records — graft programme research and safety'),
  bullet('5. Research analytics dashboard on existing structured JSON — unlocks institute and national registry path'),
  p(''),
  p('This audit is based on static codebase inspection and documented operational state. It does not replace formal clinical validation, penetration testing, or regulatory compliance review. No code was modified during this audit.'),
];

const doc = new Document({
  creator: 'Cornea Clinic EMR Audit',
  title: 'Comprehensive Tertiary Cornea EMR Global Audit',
  description: 'Complete global audit — read-only inspection, June 2026',
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Written:', OUT);

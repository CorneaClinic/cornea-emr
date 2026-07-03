/**
 * VisionEMR Master Development Plan v2.0 — Word document generator.
 * Run: npm run plan:docx
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
const OUT = path.join(__dirname, '..', 'docs', 'VisionEMR_Master_Development_Plan_v2.docx');

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
  // Title page
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: 'VisionEMR', bold: true, size: 40 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'MASTER DEVELOPMENT PLAN', bold: true, size: 32 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Tertiary Cornea Institute Platform', bold: true, size: 28 })],
  }),
  boldP('Document version: ', '2.0'),
  boldP('Plan date: ', '2 July 2026'),
  boldP('Based on: ', 'Comprehensive Tertiary Cornea EMR Global Audit (July 2026)'),
  boldP('Production: ', 'https://corneaclinic.visionemr.net/Cornea'),
  boldP('Status: ', 'Authoritative strategic blueprint — no implementation in this document'),
  p('Executive premise: VisionEMR is approximately 84% complete as a tertiary cornea EMR. The remaining work is stabilize, unify, scale, and extend into a national cornea institute ecosystem.'),
  p('This document is the single authoritative blueprint for all future VisionEMR development.'),

  pageBreak(),

  // PART 1
  h1('PART 1 — VISION'),
  h2('1.1 Long-term vision statement'),
  p('VisionEMR will become the world\'s leading Cornea Institute Information System — a unified, offline-capable, research-ready digital ecosystem supporting every cornea service line from first consultation to national blindness prevention programmes.'),
  p('VisionEMR is: a clinical operating system for cornea institutes; a longitudinal registry platform; a research and publication engine; a teaching and competency platform; a national interoperability hub for Tele-Cornea and public health integration.'),
  h2('1.2 Service ecosystem supported'),
  table(
    ['Service domain', 'VisionEMR role'],
    [
      ['Cornea Clinics', 'Core visit workflow, structured examination, diagnosis, treatment, follow-up'],
      ['Corneal Ulcer Centres', 'Emergency pathways, microbiology tracking, serial photography, healing timelines'],
      ['Keratoconus Centres', 'Longitudinal KC registry, progression monitoring, Pentacam integration'],
      ['Cross-Linking Centres', 'CXL protocol tracking, outcomes, ectasia decision support'],
      ['Ocular Surface Disease Centres', 'Dry eye/OSD clinic module, treatment ladders, QoL tracking'],
      ['Contact Lens Centres', 'Full fitting workflows, inventory, outcomes'],
      ['Scleral Lens Centres', '13-step wizard, AI advisor, safety rules'],
      ['Laser Refractive Surgery Centres', 'Work-up, AI planner, consent, surgery record'],
      ['Corneal Transplant Centres', 'KP register, matching engine, graft outcomes, rejection tracking'],
      ['Eye Banks', 'Donor traceability, serology, quarantine, chain-of-custody, allocation audit'],
      ['Research Units', 'Cohort builder, survival analytics, multi-format export, publication support'],
      ['Teaching Hospitals', 'Teaching cases, grand rounds, competency tracking, image/video libraries'],
      ['National Tele-Cornea Networks', 'Referral prioritization, async consult, multi-site coordination'],
      ['National Corneal Blindness Programmes', 'Population KPIs, screening linkage, FHIR reporting to MoH'],
    ]
  ),

  pageBreak(),

  // PART 2
  h1('PART 2 — CURRENT MATURITY'),
  p('Assessment date: 2 July 2026. Live production verified; 35/35 API unit tests; stabilization gates G1–G7 snapshot logged.'),
  table(
    ['Dimension', 'Completion', 'Score (/100)', 'Assessment'],
    [
      ['Clinical maturity', '86%', '86', 'Strong visit workflow, 15 EMR sections, subspecialty registries operational'],
      ['Technical maturity', '78%', '78', 'Offline-first sync, PostgreSQL, S3 media; registry sync fragmentation remains'],
      ['Research maturity', '72%', '72', 'Research analytics dashboard, cohort export, graft survival; no warehouse or de-ID pipeline'],
      ['Security maturity', '74%', '74', 'JWT/RBAC/audit solid; G6/G7 open; offline encryption and pen-test pending'],
      ['AI maturity', '55%', '55', 'Strong rule-based CDS; no validated ML or imaging AI'],
      ['Cloud maturity', '80%', '80', 'Cloudflare UI + DO API + S3; single-instance API; no HA cluster'],
      ['Enterprise maturity', '68%', '68', 'Multi-user RBAC, record locks; no LDAP/SSO, no SOC integration'],
      ['National deployment readiness', '48%', '48', 'FHIR route exists; no multi-tenant national hub or MoH connectors'],
    ]
  ),
  p('Overall platform completion: ~84% of tertiary cornea institute vision.'),
  h2('Stabilization gate status'),
  table(
    ['Gate', 'Status'],
    [
      ['G1 Data safety', 'PARTIAL'],
      ['G2 Media durability', 'PASS'],
      ['G3 Auth hardening', 'PARTIAL'],
      ['G4 Regression safety', 'PARTIAL'],
      ['G5 Sync reliability', 'PARTIAL'],
      ['G6 Security baseline', 'OPEN'],
      ['G7 Observability', 'OPEN'],
    ]
  ),
  h2('Major assets already built'),
  bullet('14-section patient form with opinion/referral, section nav, new-visit pre-fill'),
  bullet('Registries: KC/CXL, keratitis/ulcer, KP graft outcomes, dry eye OSD'),
  bullet('Keratoplasty register, OR scheduling, appointments & recall, eye bank traceability'),
  bullet('S3-backed clinical media library (G2 PASS), research analytics, ectasia AI v2'),
  bullet('FHIR export route, DICOM route, ICD-11 proxy, audit trail, record edit locks'),
  bullet('23 SQL migrations, 32 API route modules, ~165 endpoints, 6 Playwright E2E specs'),

  pageBreak(),

  // PART 3
  h1('PART 3 — PROJECT PRINCIPLES'),
  table(
    ['#', 'Principle', 'Definition'],
    [
      ['P1', 'Offline-first', 'Every critical clinical workflow MUST function without network; sync is asynchronous'],
      ['P2', 'Cloud synchronized', 'PostgreSQL is authoritative; local IndexedDB is replica + outbound queue'],
      ['P3', 'Patient safety first', 'No feature ships if it risks data loss, silent failure, or unvalidated clinical guidance'],
      ['P4', 'No breaking changes', 'Legacy visit JSON shape MUST round-trip; migrations are additive'],
      ['P5', 'Backward compatibility', 'Existing clinics continue operating during upgrades; feature flags for new modules'],
      ['P6', 'Structured clinical data', 'Prefer versioned JSON modules + registry tables over free text'],
      ['P7', 'Research-ready architecture', 'Every registry field maps to exportable, analyzable schema'],
      ['P8', 'Security by design', 'Tenant isolation, RBAC, audit, encryption-at-rest roadmap, least privilege'],
      ['P9', 'Scalable architecture', 'Stateless API, object storage, Redis rate limits, horizontal scaling path'],
      ['P10', 'Transparent AI', 'All CDS shows rationale; human override mandatory; no black-box auto-write'],
      ['P11', 'Explainable CDS', 'Rule provenance documented; ML models require validation dossier before clinical use'],
      ['P12', 'Unified sync policy', 'Every registry declares offline/online behaviour explicitly'],
      ['P13', 'Test before release', 'Playwright + Vitest gates block merge; clinical validation for CDS changes'],
      ['P14', 'Operational observability', 'Health, backup, sync, and error alerts are production requirements'],
      ['P15', 'National interoperability', 'FHIR-first export; terminologies mapped (ICD-11 today; SNOMED/LOINC roadmap)'],
    ]
  ),

  pageBreak(),

  // PART 4
  h1('PART 4 — TARGET ARCHITECTURE'),
  h2('4.1 Layer specifications'),
  table(
    ['Layer', 'Current state', 'Target state'],
    [
      ['Frontend', 'Vanilla JS PWA, Cornea.html + ~40 modules, IndexedDB v10', 'Modular ES modules; lazy-loaded panels; mobile visit summary'],
      ['Backend', 'Express 4, 32 route modules, single DO instance', 'Stateless API cluster; domain services; event bus for audit/analytics'],
      ['Database', 'PostgreSQL, 23 migrations, JSONB visits + registry tables', 'Research warehouse replica; RLS optional; indexing for scale'],
      ['Cloud', 'Cloudflare Pages/Workers + DO App Platform', 'Staging mirror; multi-region DR plan; CDN for media thumbnails'],
      ['Media storage', 'S3 (Spaces) — G2 PASS', 'Versioning; lifecycle policies; DICOM object store partition'],
      ['AI services', 'Rule-based CDS in clinic JS + ectasia API', 'Separated AI service; model registry; validation pipeline'],
      ['Device integration', 'Pentacam CSV import', 'DICOM + vendor SDK adapters (Pentacam, Sirius, specular, AS-OCT)'],
      ['FHIR', 'Export route prototype', 'R4 Bundle export: Patient, Encounter, Condition, Observation, Procedure'],
      ['DICOM', 'Route stub', 'C-STORE ingest, WADO-RS retrieval, study linkage to visit'],
      ['Authentication', 'JWT + refresh + offline PBKDF2', 'OIDC/LDAP SSO; MFA; device trust'],
      ['API', 'REST /api/v1', 'Versioned REST + optional GraphQL for analytics; OpenAPI spec published'],
      ['Analytics', 'Research analytics service', 'Real-time KPI dashboard + batch warehouse'],
      ['Research warehouse', 'None', 'ETL from registries; de-identified views; cohort materialized tables'],
      ['Telemedicine', 'None', 'Async consult queue, secure messaging, referral packet, video optional'],
    ]
  ),
  h2('4.2 Logical architecture flow'),
  p('Clinic PWA (IndexedDB) → Cloudflare CDN → VisionEMR API → PostgreSQL + Redis + S3. Integration Gateway connects FHIR, HL7, DICOM, devices, MoH, hospital LDAP/OIDC. Analytics API feeds Research Warehouse. AI/CDS and Tele-Cornea services sit alongside Sync Engine.'),

  pageBreak(),

  // PART 5
  h1('PART 5 — MASTER MODULE MAP'),
  p('Priority: P0 = stabilization blocker · P1 = institute essential · P2 = tertiary differentiator · P3 = national scale'),
  table(
    ['Module', 'Current', 'Target', 'Priority', 'Order'],
    [
      ['Patient Administration', '90%', '95%', 'P1', '1'],
      ['Clinical Workflow', '85%', '95%', 'P1', '2'],
      ['Clinical Media (S3)', '85%', '92%', 'P0', '3'],
      ['Quality Assurance / CI', '65%', '90%', 'P0', '4'],
      ['Corneal Ulcer Service', '78%', '92%', 'P1', '6'],
      ['Appointments & Recall', '75%', '90%', 'P1', '8'],
      ['Dry Eye / OSD', '72%', '88%', 'P1', '9'],
      ['Analytics / Dashboard KPIs', '70%', '90%', 'P1', '10'],
      ['Research Platform', '72%', '90%', 'P1', '11'],
      ['Posterior Segment', '82%', '90%', 'P2', '12'],
      ['AI Surgical Planner', '78%', '90%', 'P1', '14'],
      ['Eye Bank (accreditation)', '72%', '90%', 'P2', '16'],
      ['Teaching Platform', '15%', '85%', 'P2', '18'],
      ['Telemedicine', '5%', '80%', 'P2', '20'],
      ['National Tele-Cornea', '5%', '85%', 'P3', '22'],
      ['Visual Acuity / Refraction', '88–90%', '95%', 'P2', '—'],
      ['Anterior Segment', '92%', '95%', 'P2', '—'],
      ['Contact Lens / Scleral Lens', '82–88%', '90–92%', 'P1/P2', '—'],
      ['Laser Refractive Surgery', '85%', '92%', 'P1', '—'],
      ['KC / CXL Registry', '82–85%', '90–92%', 'P1', '—'],
      ['Keratoplasty', '85%', '92%', 'P1', '—'],
      ['Administration / RBAC', '88%', '95%', 'P1', '—'],
    ]
  ),
  h2('Suggested implementation order (remaining work)'),
  bullet('Phase 1: Stabilization → Sync unification → Redis/alerts → Password-reset E2E'),
  bullet('Phase 2: Registry sync matrix → Analytics v2 → Device import v2 → Posterior polish'),
  bullet('Phase 3: Teaching platform → Eye bank accreditation → AI validation pipeline'),
  bullet('Phase 4: Research warehouse → De-ID export → SPSS/R/Python connectors'),
  bullet('Phase 5: Tele-Cornea hub → National FHIR gateway → MoH integration'),

  pageBreak(),

  // PART 6
  h1('PART 6 — MASTER REGISTRY FRAMEWORK'),
  h2('6.1 Registry design principles'),
  bullet('Enrolment criteria — explicit inclusion/exclusion'),
  bullet('Longitudinal timeline — events ordered chronologically'),
  bullet('Structured outcomes — primary endpoints defined upfront'),
  bullet('Media linkage — photos/topography tied to registry events'),
  bullet('Sync policy — queued offline OR documented online-only'),
  bullet('Export schema — CSV + FHIR Observation/Condition mapping'),
  bullet('RBAC — dedicated read/write permissions'),
  h2('6.2 Registry map'),
  table(
    ['Registry', 'Status', 'Sync', 'Priority'],
    [
      ['Keratoconus', 'Operational', 'Direct REST → unify', 'P1'],
      ['Cross-Linking', 'In KC module', 'Direct REST → unify', 'P1'],
      ['Microbial Keratitis', 'Operational', 'Direct REST → unify', 'P1'],
      ['HSV Keratitis', 'Partial (visit taxonomy)', 'Via visit', 'P2'],
      ['HZO Keratitis', 'Partial (visit taxonomy)', 'Via visit', 'P2'],
      ['Dry Eye', 'Module 021 operational', 'Direct REST', 'P1'],
      ['Neurotrophic Keratitis', 'Partial', 'Via anterior findings', 'P2'],
      ['Corneal Dystrophies', 'Partial', 'Via ICD + anterior', 'P2'],
      ['Corneal Degenerations', 'Partial', 'Via anterior', 'P3'],
      ['Chemical Injury', 'Partial (trauma mode)', 'Via visit', 'P2'],
      ['Corneal Transplant', 'KP + graft outcomes', 'Queued (KP)', 'P1'],
      ['Eye Bank', 'Traceability operational', 'Direct REST', 'P1'],
      ['Contact Lens outcomes', 'Partial (visit JSON)', 'Visit only', 'P2'],
      ['Laser Refractive outcomes', 'Partial (visit JSON)', 'Visit only', 'P2'],
      ['Research cohorts', 'Operational', 'Cloud-only', 'P1'],
    ]
  ),

  pageBreak(),

  // PART 7
  h1('PART 7 — AI MASTER PLAN'),
  h2('7.1 Three-tier AI maturity model'),
  table(
    ['Tier', 'Description', 'Timeline'],
    [
      ['T1 — Rule-based CDS', 'Transparent rules, printable rationale', 'Current (2026)'],
      ['T2 — Registry-informed CDS', 'Rules adjusted by institute outcome data', '2026–2027 (ectasia v2 started)'],
      ['T3 — Validated ML/CV', 'Models with clinical validation dossier', '2028–2030'],
    ]
  ),
  h2('7.2 AI system roadmap'),
  table(
    ['AI System', 'Current', 'Target', 'Validation requirements'],
    [
      ['AI Scleral Lens Advisor', 'T1 — 85%', 'T2 by 2027', 'Prospective agreement study vs senior fitter'],
      ['AI Refractive Planner', 'T1 — 82%', 'T2 by 2027', 'Retrospective ranking accuracy audit'],
      ['AI Keratoconus Advisor', 'T1 — 70%', 'T2 by 2028', 'Progression prediction vs observed'],
      ['AI Corneal Ulcer Advisor', 'None — 10%', 'T1 by 2028', 'Infectious disease consultant review'],
      ['AI Dry Eye Advisor', 'None — 5%', 'T1 by 2028', 'OSD specialist validation'],
      ['AI Graft Rejection Advisor', 'None — 5%', 'T2 by 2029', 'KP consultant + biostatistician'],
      ['AI Surgical Planner', 'T1 — 75%', 'T2 by 2028', 'M&M committee approval'],
      ['AI Referral Prioritization', 'None — 5%', 'T1 by 2029', 'Triage nurse + consultant calibration'],
      ['AI Image Analysis', 'None — 0%', 'T3 by 2030', 'IRB-approved training set; sensitivity/specificity thresholds'],
      ['AI Research Assistant', 'None — 0%', 'T1 by 2029', 'Supervised; no PHI to external LLM'],
    ]
  ),
  h2('7.3 AI governance'),
  bullet('All AI outputs require explicit clinician action (accept/reject/modify)'),
  bullet('AI decision log stored in visit JSON (aiAdvisor.log)'),
  bullet('ML models require: training data provenance, bias assessment, version pinning, rollback plan'),
  bullet('No autonomous treatment recommendations without regulatory review'),

  pageBreak(),

  // PART 8
  h1('PART 8 — RESEARCH MASTER PLAN'),
  table(
    ['Capability', 'Current', 'Target'],
    [
      ['Prospective registries', 'Structured enrolment', 'Auto-enrol rules + protocol versioning'],
      ['Retrospective studies', 'Cohort builder', 'SQL/warehouse queries + saved study definitions'],
      ['Automatic cohort generation', 'Manual filters', 'Saved queries, scheduled refresh'],
      ['Publication support', 'None', 'Table 1 generator, CONSORT/STROBE checklists'],
      ['Outcome analytics', 'Basic stats', 'Multivariable-ready datasets'],
      ['Kaplan-Meier survival', 'Graft survival', 'Generalized to CXL, keratitis healing'],
      ['CSV export', 'Yes', 'Yes'],
      ['Excel export', 'Manual import', 'Native .xlsx'],
      ['SPSS / R / Python', 'None', '.sav / API / parquet export'],
      ['FHIR', 'Route exists', 'ResearchStudy + Observation bundles'],
    ]
  ),
  h2('Research phases'),
  table(
    ['Phase', 'Deliverable', 'Effort'],
    [
      ['R1', 'Analytics v2 — saved cohorts, Excel export', '3 months'],
      ['R2', 'De-identification pipeline + IRB consent tracking', '4 months'],
      ['R3', 'Research warehouse (read replica + ETL)', '6 months'],
      ['R4', 'SPSS/R/Python export + publication table generator', '4 months'],
      ['R5', 'Multi-centre research federation', '12 months'],
    ]
  ),

  pageBreak(),

  // PART 9
  h1('PART 9 — TEACHING MASTER PLAN'),
  p('Current state: ~15% complete. Teaching assets exist only as incidental clinical media (teaching_case category).'),
  table(
    ['Component', 'Target capability', 'Priority'],
    [
      ['Teaching files', 'Anonymized case library linked to media', 'P1'],
      ['Case discussions', 'Threaded comments, consultant attribution', 'P1'],
      ['Grand rounds', 'Case sets, presentation mode, export slides', 'P2'],
      ['Image library', 'Tagged, searchable, consent-tracked', 'P1'],
      ['Video library', 'Procedure videos, linked to competency', 'P2'],
      ['Quizzes', 'MCQ from case findings; auto-scoped', 'P2'],
      ['Competency tracking', 'Resident/fellow procedure log vs targets', 'P1'],
      ['Role-based views', 'Student / resident / fellow / faculty dashboards', 'P1'],
    ]
  ),
  p('Dependencies: De-identification service (Research R2); Clinical media platform (existing); RBAC extension for teaching roles; Consent tracking on media assets.'),

  pageBreak(),

  // PART 10
  h1('PART 10 — NATIONAL DEPLOYMENT STRATEGY'),
  table(
    ['Level', 'Scope', 'VisionEMR readiness'],
    [
      ['L1 — Single clinic', 'One cornea clinic', 'Ready now'],
      ['L2 — Hospital', 'Multi-department hospital', '68% — needs G6/G7, SSO'],
      ['L3 — Regional network', '5–20 sites', '55% — tenant model exists; hub needed'],
      ['L4 — National Tele-Cornea', 'Country-wide referral network', '35% — foundational routes only'],
      ['L5 — MoH integration', 'National blindness programme', '25% — strategic build'],
    ]
  ),
  h2('Phased rollout timeline'),
  bullet('2026 H1: L1 production hardening'),
  bullet('2026 H2: L2 hospital SSO + HA'),
  bullet('2027: L3 regional network pilot'),
  bullet('2028: L4 Tele-Cornea MVP'),
  bullet('2029: L5 MoH FHIR reporting'),
  bullet('2030: Full national platform'),

  pageBreak(),

  // PART 11
  h1('PART 11 — SECURITY MASTER PLAN'),
  table(
    ['Domain', 'Current', 'Target (2027)', 'Target (2030)'],
    [
      ['Encryption at rest', 'DB encrypted; local IDB plain', 'IDB encryption; export encryption', 'Full disk + field-level PHI'],
      ['Encryption in transit', 'TLS everywhere', 'TLS 1.3 enforced', 'mTLS service mesh'],
      ['Zero Trust', 'JWT + RBAC', 'Device posture; MFA', 'Continuous verification'],
      ['Audit logs', 'Append-only DB + API', 'Immutable log stream; 7-year retention', 'SIEM integration'],
      ['Disaster recovery', 'Backups + partial drill', 'Monthly restore drill; RTO < 4h', 'Multi-region DR'],
      ['Pen testing', 'Scheduled Q3 2026', 'Annual third-party + remediation', 'Continuous security testing'],
      ['Monitoring', 'G7 OPEN', 'Health/backup/sync alerts', 'SOC integration'],
    ]
  ),
  h2('Security phase plan'),
  table(
    ['Phase', 'Deliverables', 'Gate'],
    [
      ['S1 (0–3 mo)', 'Redis rate limiting, password-reset E2E, RBAC review', 'G6'],
      ['S2 (3–6 mo)', 'Pen-test + remediation, IDB encryption design', 'G6 complete'],
      ['S3 (6–12 mo)', 'OIDC/LDAP SSO, MFA, alert drill', 'G7'],
      ['S4 (12–24 mo)', 'SIEM, immutable audit, DR automation', 'Enterprise'],
      ['S5 (24–36 mo)', 'Zero Trust, field-level encryption, SOC', 'National'],
    ]
  ),

  pageBreak(),

  // PART 12
  h1('PART 12 — INTEROPERABILITY'),
  table(
    ['Standard', 'Current', 'Target', 'Priority'],
    [
      ['FHIR R4', 'Export route', 'Patient, Encounter, Condition, Observation, Procedure', 'P1'],
      ['HL7 v2', 'None', 'ADT/ORU messages for hospital PAS', 'P2'],
      ['DICOM', 'Route stub', 'C-STORE ingest, WADO-RS, study-visit linkage', 'P1'],
      ['ICD-11', 'WHO proxy operational', 'Maintain; offline cache', '—'],
      ['SNOMED CT', 'Partial via anterior taxonomy', 'Formal mapping table; FHIR CodeSystem', 'P2'],
      ['LOINC', 'None', 'Lab/microbiology results in keratitis registry', 'P2'],
      ['openEHR', 'None', 'Evaluate for national EHR alignment', 'P3'],
      ['Medical devices', 'Pentacam CSV', 'DICOM + vendor SDK', 'P1'],
    ]
  ),

  pageBreak(),

  // PART 13
  h1('PART 13 — QUALITY ASSURANCE'),
  table(
    ['Layer', 'Current', 'Target'],
    [
      ['Unit tests', '35 Vitest (API)', '100+ covering all route modules'],
      ['Integration tests', 'Sync matrix partial', 'Full registry sync matrix'],
      ['E2E (Playwright)', '6 specs', '20+ covering all EMR sections'],
      ['Script-load guard', 'CI duplicate-global scan', 'Mandatory on every PR'],
      ['Clinical validation', 'Ad hoc', 'Formal protocol for CDS changes'],
      ['Performance testing', 'None', 'LCP < 2.5s; API p95 < 200ms'],
      ['Load testing', 'None', '50 concurrent users baseline'],
      ['UAT', 'Manual smoke', 'Structured UAT per release'],
      ['Release management', 'Manual deploy', 'Staging → production with rollback'],
    ]
  ),
  h2('Release gates (must pass before production)'),
  bullet('1. Vitest green'),
  bullet('2. Playwright green on staging'),
  bullet('3. global-debug 21/21'),
  bullet('4. Production health check script'),
  bullet('5. No open Critical/High security findings'),
  bullet('6. Clinical sign-off for CDS changes'),
  bullet('7. Migration dry-run on staging DB'),

  pageBreak(),

  // PART 14
  h1('PART 14 — MASTER DEVELOPMENT PHASES'),
  table(
    ['Phase', 'Timeline', 'Objectives', 'Effort', 'Clinical impact', 'Research impact'],
    [
      ['Phase 1: Production Stabilization', 'Months 0–4', 'Close G1–G7 gates; zero silent module failures', '2 devs × 4 mo', 'High', 'Medium'],
      ['Phase 2: Enterprise Reliability', 'Months 4–10', 'Unified offline sync; HA readiness; SSO; performance at scale', '2–3 devs × 6 mo', 'High', 'Medium'],
      ['Phase 3: Advanced Cornea Institute', 'Months 10–18', 'DICOM; device pipeline; eye bank accreditation; AI T2', '3 devs × 8 mo', 'Very high', 'High'],
      ['Phase 4: Research Platform', 'Months 18–28', 'Warehouse; de-ID; SPSS/R/Python; publication tools', '2 devs + biostat × 10 mo', 'Medium', 'Very high'],
      ['Phase 5: Teaching Platform', 'Months 28–36', 'Case library; grand rounds; competency tracking', '2 devs × 8 mo', 'Medium', 'Medium'],
      ['Phase 6: National Tele-Cornea', 'Months 36–48', 'Referral hub; async consult; multi-site admin', '3–4 devs × 12 mo', 'Very high', 'High'],
      ['Phase 7: National Blindness Platform', 'Months 48–66', 'MoH FHIR reporting; population KPIs; screening linkage', '4 devs + gov liaison × 18 mo', 'Transformative', 'Transformative'],
    ]
  ),
  h2('Phase 1 deliverables'),
  bullet('Redis rate limiting; alerting; password-reset E2E; full restore drill'),
  bullet('Registry sync matrix documentation; Playwright CI blocking merge'),
  h2('Phase 2 deliverables'),
  bullet('Registry queue unification; staging environment; OIDC/LDAP; pagination; IDB encryption; pen-test remediation'),
  h2('Phase 3 deliverables'),
  bullet('DICOM ingest MVP; Pentacam/Sirius pipeline v2; eye bank regulatory workflow; HSV/HZO sub-registries; AI validation pipeline'),
  h2('Phase 4 deliverables'),
  bullet('Research warehouse; de-ID pipeline; SPSS/R/Python export; saved cohorts; IRB consent tracking'),
  h2('Phase 5 deliverables'),
  bullet('Teaching case library; anonymization wizard; grand rounds mode; competency tracking; quiz engine'),
  h2('Phase 6 deliverables'),
  bullet('Tele-Cornea hub; referral prioritization AI (T1); secure messaging; FHIR referral bundles'),
  h2('Phase 7 deliverables'),
  bullet('MoH FHIR reporting; screening programme linkage; population dashboards; national graft waiting list'),

  pageBreak(),

  // PART 15
  h1('PART 15 — TECHNICAL DEBT'),
  table(
    ['Category', 'Item', 'Severity', 'Remediation', 'Phase'],
    [
      ['Architecture', 'Monolithic Cornea.html (~5,750 lines)', 'High', 'ES module migration / code splitting', 'P2'],
      ['Architecture', 'Global window.* namespace pattern', 'High', 'IIFE wrap or ES modules + CI collision guard', 'P1'],
      ['Architecture', 'Registry sync fragmentation', 'Critical', 'Unified sync policy + queue extension', 'P1'],
      ['Architecture', 'Hybrid JSONB + flat field dual sync', 'Medium', 'Deprecation plan with migration', 'P3'],
      ['Security', 'Unencrypted IndexedDB PHI', 'Critical', 'IDB encryption module', 'P2'],
      ['Security', 'In-memory rate limiter', 'Critical', 'Redis (G6)', 'P1'],
      ['Testing', 'No frontend unit tests', 'High', 'Component test framework', 'P2'],
      ['Testing', 'Incomplete API route coverage', 'Medium', 'Vitest for dry eye, OR, eye bank, DICOM', 'P2'],
      ['Performance', '40+ sequential script tags', 'High', 'Lazy load + bundle', 'P2'],
      ['Performance', 'Client loads all visits into IDB', 'Medium', 'Archive policy + server pagination', 'P2'],
      ['Documentation', 'Ops runbooks incomplete', 'Medium', 'Incident, deploy, restore runbooks', 'P1'],
    ]
  ),

  pageBreak(),

  // PART 16
  h1('PART 16 — RISK REGISTER'),
  table(
    ['ID', 'Risk', 'Category', 'Likelihood', 'Impact', 'Mitigation'],
    [
      ['R1', 'Registry offline edit lost on reconnect', 'Technical', 'Medium', 'High', 'G5 sync matrix; unified queue (Phase 2)'],
      ['R2', 'Script-load collision disables module', 'Technical', 'Medium', 'Critical', 'CI duplicate-global scan; IIFE migration'],
      ['R3', 'API brute-force / abuse', 'Security', 'Medium', 'High', 'Redis rate limiting (G6)'],
      ['R4', 'Backup restore untested', 'Operational', 'Medium', 'Critical', 'Monthly pg_restore drill (G1)'],
      ['R5', 'CDS recommendation error', 'Clinical', 'Low', 'Critical', 'Human override mandatory; validation protocol'],
      ['R6', 'Pen-test finds critical vuln', 'Security', 'Medium', 'High', 'Q3 2026 assessment + remediation sprint'],
      ['R7', 'Multi-user edit conflict', 'Clinical', 'Medium', 'Medium', 'Record locks (exists); conflict UI (Phase 2)'],
      ['R8', 'Device import mapping error', 'Clinical', 'Medium', 'High', 'Review-before-commit UI; validation rules'],
      ['R9', 'De-ID failure in research export', 'Research', 'Low', 'Critical', 'Automated PHI scanner; manual approval gate'],
      ['R10', 'National deployment data residency', 'Business', 'Medium', 'High', 'Jurisdiction config; legal review per country'],
      ['R11', 'Feature creep before stabilization', 'Business', 'High', 'High', 'Enforce G1–G7 gate before Phase 3+ features'],
      ['R12', 'Key person dependency (ops)', 'Operational', 'Medium', 'Medium', 'Runbooks; cross-train; automated monitoring'],
      ['R13', 'ML model bias / invalid output', 'Clinical', 'Low', 'Critical', 'Tier 3 validation dossier; no auto-write'],
      ['R14', 'MoH integration scope creep', 'Business', 'Medium', 'Medium', 'Phased FHIR; fixed reporting schema'],
      ['R15', 'IndexedDB exhaustion (large media)', 'Technical', 'Medium', 'Medium', 'S3-first media; IDB size caps'],
    ]
  ),

  pageBreak(),

  // PART 17
  h1('PART 17 — SUCCESS METRICS'),
  h2('Operational KPIs'),
  table(
    ['KPI', 'Baseline (Jul 2026)', 'Year 1', 'Year 3', 'Year 5'],
    [
      ['System uptime (API)', '~99% (informal)', '99.5%', '99.9%', '99.95%'],
      ['Unplanned module outages', '2 critical (2026)', '0', '0', '0'],
      ['Backup success rate', 'Daily (recent)', '100% / 30 days', '100% / 365 days', '100%'],
      ['Production readiness score', '78', '≥ 90', '≥ 95', '≥ 98'],
    ]
  ),
  h2('Clinical KPIs'),
  table(
    ['KPI', 'Baseline', 'Year 1', 'Year 3', 'Year 5'],
    [
      ['Clinical documentation completeness', '~85%', '90%', '95%', '98%'],
      ['Registry enrolment rate (eligible)', 'Partial', '70%', '85%', '95%'],
      ['Graft survival tracking completeness', '~60%', '80%', '90%', '95%'],
      ['Referral response time', 'New module', 'Baseline', '−30%', '−50%'],
    ]
  ),
  h2('Research KPIs'),
  table(
    ['KPI', 'Baseline', 'Year 3', 'Year 5'],
    [
      ['Research publications supported', '0 platform-attributed', '5+', '20+'],
      ['Cohort export time', 'Manual hours', '< 5 min', '< 1 min'],
      ['De-identified datasets generated', '0', '10+', '50+'],
      ['Multi-centre studies enabled', '0', '2', '10+'],
    ]
  ),

  pageBreak(),

  // PART 18
  h1('PART 18 — FIVE-YEAR ROADMAP'),
  table(
    ['Year', 'Theme', 'Key milestones', 'Completion est.'],
    [
      ['Year 1 (2026–27)', 'Production stabilization + enterprise reliability', 'G1–G7 PASS; Redis; alerts; sync unification; SSO; pen-test', '88%'],
      ['Year 2 (2027–28)', 'Cornea Institute Platform', 'DICOM; device pipeline; eye bank accreditation; AI T2; teaching MVP', '92%'],
      ['Year 3 (2028–29)', 'Regional deployment', 'Research warehouse; de-ID; 5-site network; publication tools', '95%'],
      ['Year 4 (2029–30)', 'National Tele-Cornea Network', '50+ sites; referral AI; FHIR national gateway; ML pilot', '97%'],
      ['Year 5 (2030–31)', 'National Eye Health Platform', 'MoH integration; population analytics; openEHR eval', '99%'],
    ]
  ),
  h2('Critical path'),
  bullet('Phase 1 (Stabilization G1–G7) → Phase 2 (Enterprise Reliability) → Phase 3 (Advanced Institute)'),
  bullet('Phase 3 → Phase 4 (Research) and Phase 5 (Teaching) → Phase 6 (Tele-Cornea) → Phase 7 (National Blindness)'),
  bullet('Within Phase 1: Redis G6 + Alerting G7 are immediate blockers'),
  bullet('Within Phase 2: Sync unification unlocks reliable registry data for research'),
  bullet('Within Phase 3: DICOM + devices unlock AI T2 and tertiary differentiation'),

  pageBreak(),

  // PART 19
  h1('PART 19 — FINAL EXECUTIVE RECOMMENDATIONS'),
  h2('19.1 Prioritization framework'),
  p('All recommendations scored on five dimensions (1–10), weighted: Clinical impact 30%, Patient safety 25%, Research value 20%, Long-term scalability 15%, Development effort inverse 10%.'),
  h2('19.2 Top 20 strategic priorities'),
  table(
    ['Rank', 'Priority', 'Clinical', 'Safety', 'Research', 'Scale'],
    [
      ['1', 'Complete G1–G7 stabilization gates', '8', '10', '6', '9'],
      ['2', 'Unified registry offline sync (G5)', '9', '9', '8', '8'],
      ['3', 'Redis global rate limiting (G6)', '5', '10', '3', '9'],
      ['4', 'Production alerting & observability (G7)', '7', '9', '5', '9'],
      ['5', 'Monthly backup restore drill (G1)', '6', '10', '6', '8'],
      ['6', 'Playwright CI blocking on main (G4)', '8', '9', '5', '8'],
      ['7', 'DICOM + topography device integration', '10', '7', '9', '8'],
      ['8', 'Research warehouse + de-ID pipeline', '6', '8', '10', '9'],
      ['9', 'Teaching case library + anonymization', '7', '8', '8', '7'],
      ['10', 'Eye bank accreditation workflow', '9', '9', '8', '6'],
      ['11', 'OIDC/LDAP SSO for hospital deployment', '6', '8', '4', '10'],
      ['12', 'FHIR R4 full export (national bridge)', '7', '7', '9', '10'],
      ['13', 'IndexedDB PHI encryption', '6', '10', '5', '7'],
      ['14', 'AI validation pipeline (T2 → T3)', '9', '9', '9', '7'],
      ['15', 'Tele-Cornea referral hub', '10', '8', '9', '10'],
      ['16', 'CL + laser outcomes registries', '8', '7', '9', '7'],
      ['17', 'HSV/HZO/neurotrophic sub-registries', '8', '8', '8', '6'],
      ['18', 'ES module / code-split frontend', '6', '8', '4', '9'],
      ['19', 'Pen-test Q3 2026 + remediation', '5', '10', '4', '8'],
      ['20', 'MoH population health reporting', '9', '8', '10', '10'],
    ]
  ),
  h2('19.3 Top 10 technical priorities'),
  bullet('1. G1–G7 stabilization completion'),
  bullet('2. Registry sync unification'),
  bullet('3. Redis rate limiting'),
  bullet('4. Alerting / observability'),
  bullet('5. Staging environment mirroring production'),
  bullet('6. Frontend ES module migration'),
  bullet('7. API test coverage expansion'),
  bullet('8. Load/performance baseline'),
  bullet('9. OpenAPI specification'),
  bullet('10. Research warehouse ETL'),
  h2('19.4 Top 10 clinical priorities'),
  bullet('1. DICOM + device import pipeline'),
  bullet('2. Eye bank accreditation workflow'),
  bullet('3. HSV/HZO/neurotrophic structured registries'),
  bullet('4. CL + laser outcomes registries'),
  bullet('5. Keratitis workflow deepening (culture tracking)'),
  bullet('6. Dry eye programme quality metrics'),
  bullet('7. Posterior segment template expansion'),
  bullet('8. OR scheduling ↔ visit linkage'),
  bullet('9. Referral prioritization (Tele-Cornea prep)'),
  bullet('10. Mobile-optimized visit summary'),
  h2('19.5 Top 10 research priorities'),
  bullet('1. Research warehouse'),
  bullet('2. De-identification pipeline'),
  bullet('3. SPSS/R/Python export'),
  bullet('4. Saved cohort definitions'),
  bullet('5. Publication table generator'),
  bullet('6. IRB consent tracking'),
  bullet('7. Multi-centre federation'),
  bullet('8. Kaplan-Meier generalization (CXL, keratitis)'),
  bullet('9. FHIR ResearchStudy bundles'),
  bullet('10. Automated cohort refresh'),
  h2('19.6 Top 10 security priorities'),
  bullet('1. Redis rate limiting (G6)'),
  bullet('2. Pen-test Q3 2026'),
  bullet('3. IndexedDB encryption'),
  bullet('4. Password-reset E2E verification (G3)'),
  bullet('5. RBAC least-privilege review'),
  bullet('6. Alerting on auth anomalies'),
  bullet('7. Immutable audit log stream'),
  bullet('8. OIDC/LDAP SSO + MFA'),
  bullet('9. SIEM integration'),
  bullet('10. DR automation (RTO < 4h)'),
  h2('19.7 Top 10 AI priorities'),
  bullet('1. AI governance framework (mandatory override, logging)'),
  bullet('2. Ectasia AI T2 — registry-informed ranking'),
  bullet('3. Scleral advisor outcome calibration'),
  bullet('4. Keratitis treatment protocol advisor (T1)'),
  bullet('5. Graft rejection risk advisor (T2)'),
  bullet('6. Referral prioritization AI (T1)'),
  bullet('7. Device-fed topography pipeline (ML prerequisite)'),
  bullet('8. Slit-lamp image analysis pilot (T3)'),
  bullet('9. AI validation dossier template'),
  bullet('10. Supervised research assistant (de-ID metadata only)'),
  h2('19.8 Final verdict'),
  table(
    ['Stakeholder', 'Key message'],
    [
      ['Executive leadership', 'Invest in stabilization first; 16% remaining work is high-leverage'],
      ['Hospital administration', 'Platform is 84% complete; SSO and HA are the hospital gate'],
      ['Investors', 'Differentiated registry depth + offline-first moat; national scale in 5 years'],
      ['Government', 'FHIR-first path to MoH; Tele-Cornea addresses access equity'],
      ['Development team', 'Phase 1 gates are non-negotiable before new features'],
      ['Clinical team', 'Opinion/referral, registries, and AI CDS are strengths to extend'],
      ['Research collaborators', 'Warehouse + de-ID unlock multi-centre studies in Year 3'],
    ]
  ),
  p('VisionEMR is ready to serve as a production tertiary cornea clinic EMR today (Level 1). With Phase 1 stabilization complete, it becomes a hospital-grade cornea institute platform (Level 2) within 12 months. Phases 3–5 establish research and teaching leadership. Phases 6–7 position VisionEMR as a national cornea health system — the world\'s leading Cornea Institute Information System.'),
  p(''),
  p('Document control: VisionEMR Master Development Plan v2.0 | Next review: January 2027 | Supersedes: Master Development Plan v1.0 (June 2026)'),
  p('Related documents: PRODUCTION_STABILIZATION_ROADMAP.md, Comprehensive Global Audit July 2026'),
  p('This Master Development Plan is a strategic document only. No code was modified.'),
];

const doc = new Document({
  creator: 'VisionEMR',
  title: 'VisionEMR Master Development Plan v2.0',
  description: 'Tertiary Cornea Institute Platform — authoritative strategic blueprint, July 2026',
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Written:', OUT);

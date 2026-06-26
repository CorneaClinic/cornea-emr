/**
 * Generates Global Production Audit — Tertiary Cornea EMR Platform (Word).
 * Run: node scripts/generate-global-production-audit-docx.mjs
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
const OUT = path.join(__dirname, '..', 'docs', 'Global_Production_Audit_Tertiary_Cornea_EMR.docx');

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
    children: [new TextRun({ text: 'GLOBAL PRODUCTION AUDIT', bold: true, size: 28 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Tertiary Cornea EMR Platform', bold: true, size: 26 })],
  }),
  boldP('Audit date: ', 'June 2026'),
  boldP('Application: ', 'Cornea Clinic EMR (cornea-emr)'),
  boldP('Production UI: ', 'https://corneaclinic.visionemr.net/Cornea'),
  boldP('Production API: ', 'https://corneaclinic-2zfpt.ondigitalocean.app'),
  boldP('Method: ', 'Static codebase review, architecture documentation, live read-only API probes'),
  boldP('Scope: ', 'Assessment and recommendations only — no code modifications'),
  p('Multidisciplinary audit team: Senior Cornea Specialist, Refractive Surgeon, Contact Lens/Scleral Lens Specialist, Keratoplasty Surgeon, Eye Bank Specialist, Clinical Informatician, Health IT Architect, Cloud Infrastructure Engineer, Cybersecurity Specialist, Database Architect, Software QA Engineer, Medical Research Director.'),

  h1('PART 1 — Executive Summary'),
  table(
    ['Field', 'Value'],
    [
      ['Application name', 'Cornea Clinic — Management System (Cornea EMR)'],
      ['Architecture', 'Offline-first SPA + REST API + PostgreSQL; clinic-scoped multi-tenant'],
      ['Deployment', 'Clinic UI: Cloudflare Workers · API: DigitalOcean App Platform · DB: Managed PostgreSQL'],
      ['Technology stack', 'Vanilla JS PWA, IndexedDB v10, Node.js 20+ / Express 4, PostgreSQL, optional S3 media'],
      ['Maturity level', 'Advanced specialist EMR approaching tertiary institute platform'],
      ['Overall completion', '~86% of ideal tertiary cornea institute EMR'],
      ['Overall score', '86 / 100'],
      ['Production readiness', '78 / 100'],
      ['Clinical readiness', '88 / 100'],
      ['Security', '72 / 100'],
      ['Research readiness', '82 / 100'],
      ['AI readiness', '48 / 100'],
      ['Scalability', '70 / 100'],
    ]
  ),
  p('Cornea EMR has evolved from a strong single-clinic cornea application into a multi-user, cloud-synced specialty platform with longitudinal registries (KC/CXL, keratitis, keratoplasty), graft outcomes, research analytics, clinical media library, collaborative record locking, ectasia decision support, and eye-bank traceability. The Master Development Plan (10 projects) is implemented in code. Remaining gaps are primarily operational (media object storage, SMTP, HA rate limiting), integration (device/DICOM, scheduling, billing), and governance (formal security assessment, national registry export). Recent production incidents (login recursion, Keratoplasty script load failure) were root-caused and fixed in commit 405c37c.'),

  pageBreak(),
  h1('PART 2 — Current System Architecture'),
  h2('Frontend structure'),
  table(
    ['Layer', 'Technology', 'Location'],
    [
      ['Shell', 'Cornea.html (~5,750 lines), js/ui.js', 'Tab navigation, modals, print'],
      ['Clinical form', 'patient-form.js + 15+ specialty modules', 'Single-page visit record'],
      ['Offline store', 'IndexedDB CorneaClinicDB v10', 'js/storage.js'],
      ['Cloud bridge', 'cornea-api-adapter.js, cornea-sync-client.js', 'Auth, sync queue'],
      ['Auth', 'cornea-offline-auth.js, cornea-auth-env.js', 'Dual cloud + offline model'],
    ]
  ),
  h2('Backend structure'),
  table(
    ['Layer', 'Technology'],
    [
      ['API', 'Express 4, 26 route modules under /api/v1'],
      ['Services', '27 domain services'],
      ['Migrations', 'PostgreSQL 000–019 (20 files)'],
      ['Middleware', 'Helmet, CORS, JWT auth, RBAC, audit context, auth rate limits'],
    ]
  ),
  h2('Data flows'),
  bullet('Patient data: Form → IndexedDB → sync queue → POST /sync/push → PostgreSQL visits/patients tables.'),
  bullet('Image data: Visit media → IndexedDB blobs → upload to /media or entity media routes → media_assets + object storage.'),
  bullet('Sync: Bidirectional for visits, KP patients, KP tissues; KC/keratitis/graft/eye-bank use direct REST (not main sync queue).'),
  h2('Architecture diagram (logical)'),
  p('Clinic Browser PWA (Cornea.html + IndexedDB) → Cloudflare Workers (static UI) → DigitalOcean Express API → PostgreSQL + S3/Local Media + WHO ICD-11 API.'),

  pageBreak(),
  h1('PART 3 — Module Inventory'),
  table(
    ['Module', 'Status', 'Complete', 'Clinical value', 'Priority'],
    [
      ['Patient registration & visit form', 'Production', '92%', 'Critical', 'Low'],
      ['Dashboard', 'Basic', '60%', 'Medium', 'Medium'],
      ['Visual acuity & refraction', 'Production', '90%', 'High', 'Low'],
      ['Anterior segment builder', 'Production', '88%', 'High', 'Medium'],
      ['Posterior segment builder', 'Strong', '82%', 'Medium', 'Medium'],
      ['Clinical drawing', 'Strong', '80%', 'High', 'Low'],
      ['Contact lens module', 'Strong', '80%', 'High', 'Medium'],
      ['Scleral lens wizard + AI advisor', 'Strong', '85%', 'High', 'Medium'],
      ['Laser refractive + AI planner', 'Strong', '82%', 'High', 'Medium'],
      ['Keratoplasty register', 'Production', '78%', 'Critical', 'Verify'],
      ['Eye bank traceability', 'Strong', '72%', 'High', 'Medium'],
      ['KC & CXL registry', 'Strong', '80%', 'Critical', 'Medium'],
      ['Keratitis / ulcer registry', 'Strong', '72%', 'High', 'Medium'],
      ['Pentacam import', 'Functional', '75%', 'High', 'Medium'],
      ['Research analytics', 'Cloud-dependent', '50%', 'High', 'High'],
      ['Clinical media (visit + library)', 'Strong / Cloud', '65–80%', 'High', 'High'],
      ['Record locking', 'Cloud-only', '70%', 'High', 'Medium'],
      ['Ectasia AI', 'Functional', '72%', 'High', 'Medium'],
      ['Patient flow', 'Strong', '78%', 'Medium', 'Low'],
      ['Audit trail', 'Strong', '75%', 'High', 'Medium'],
      ['Offline auth & RBAC', 'Production', '85%', 'High', 'Medium'],
      ['Sync engine', 'Strong', '65%', 'Critical', 'High'],
    ]
  ),

  pageBreak(),
  h1('PART 4 — Clinical Cornea Centre Audit'),
  p('Scores 1–10 (10 = institute-ready without major gaps).'),
  table(
    ['Service line', 'Score', 'Assessment'],
    [
      ['General cornea clinic', '9', 'Core visit workflow production-ready'],
      ['Corneal ulcer / infectious keratitis', '8', 'Keratitis registry, cultures, monitoring'],
      ['Keratoconus clinic', '9', 'KC registry, topography, Pentacam import'],
      ['Cross-linking centre', '8', 'CXL protocol, ectasia AI integrated'],
      ['Ocular surface / dry eye', '6–7', 'Partial; no dedicated OSD programme'],
      ['Contact lens centre', '8', 'Full fitting module'],
      ['Scleral lens centre', '9', 'Wizard + AI advisor — strongest modules'],
      ['Refractive surgery centre', '8', 'Laser work-up + AI planner'],
      ['Keratoplasty centre', '8', 'Register, matching, graft outcomes'],
      ['Eye bank', '7', 'Custody/cold chain embedded in KP'],
      ['Teaching centre', '6', 'Media teaching_case; no anonymization workflow'],
      ['Research centre', '7', 'Research tab; cloud-dependent'],
    ]
  ),

  pageBreak(),
  h1('PART 5 — Patient Care Workflow Audit'),
  table(
    ['Stage', 'Support', 'Issues'],
    [
      ['Registration', 'Strong', 'No appointments; manual age entry'],
      ['Consultation', 'Strong', 'Long form; section collapse helps'],
      ['Examination', 'Excellent', 'No device auto-import except Pentacam CSV'],
      ['Investigation', 'Good', 'No PACS/DICOM'],
      ['Diagnosis', 'Strong', 'ICD-11 cloud-proxied'],
      ['Treatment', 'Strong', 'No e-prescribing'],
      ['Procedure', 'Partial', 'Registries separate from visit; no OR scheduling'],
      ['Follow-up', 'Strong', 'No automated recall'],
      ['Long-term monitoring', 'Strong', 'Fragmented across tabs'],
      ['Referral / Discharge', 'Weak', 'No structured referral or discharge templates'],
    ]
  ),
  p('Automation opportunities: Recall from follow-up dates, auto-link topography to KC registry, station handoff notifications in patient flow.'),

  h1('PART 6 — Database and Data Model Audit'),
  table(
    ['Criterion', 'Rating', 'Notes'],
    [
      ['Data consistency', 'B+', 'Sync conflicts handled for visits/KP; registries less rigorous'],
      ['Duplicate data', 'Low risk', 'Client mutation idempotency; MRN per clinic unique'],
      ['Scalability', 'B', 'Keyset pagination; media needs S3 at scale'],
      ['Backup', 'B', 'Documented local + production scripts'],
      ['Migration', 'B+', 'Admin migration tool + legacy bundle import'],
      ['Multi-centre', 'B', 'clinic_id tenant model ready'],
    ]
  ),

  pageBreak(),
  h1('PART 7 — Image and Media Management Audit'),
  table(
    ['Media type', 'Support', 'Risk'],
    [
      ['Clinical photographs', 'Yes — visit media', 'Local until uploaded'],
      ['Pentacam / topography', 'CSV import + upload', 'Manual import only'],
      ['AS-OCT, specular', 'Category supported', 'No viewer integration'],
      ['PDF reports', 'Yes', '25 MB limit'],
      ['Videos', 'Yes', 'Bandwidth on slow links'],
    ]
  ),
  p('Critical risk: Default local media storage on API — must use S3/R2 in production. Clinical media library unusable offline. No DICOM.'),

  h1('PART 8 — Security Audit (OWASP-oriented)'),
  table(
    ['ID', 'Finding', 'Severity'],
    [
      ['S1', 'No global API rate limit; in-memory limiter not HA-safe', 'High'],
      ['S2', 'CORS_ORIGIN=* misconfiguration risk with credentials', 'High (if misconfigured)'],
      ['S3', 'Local media on ephemeral DO containers', 'High (ops)'],
      ['S4', 'Record lock release allows kp:read role', 'Medium'],
      ['S5', 'No penetration test / formal assessment', 'Medium'],
      ['S6', 'Refresh token in body — must be false in prod', 'Medium'],
      ['S7', 'Health endpoint exposes DB status', 'Low'],
    ]
  ),
  p('Strengths: JWT + refresh rotation, RBAC (22 permissions, 7 roles), tenant isolation, audit logs, Helmet, upload MIME allowlist.'),

  pageBreak(),
  h1('PART 9 — Performance Audit'),
  table(
    ['Area', 'Assessment', 'Score'],
    [
      ['Initial load', 'Large HTML + 40+ scripts', 'B-'],
      ['Large patient volume', 'Client loads all into IDB', 'C+ at 10k+ visits'],
      ['Image performance', 'Client blobs; no lazy library offline', 'B-'],
      ['Mobile', 'Responsive; complex form on phone', 'C+'],
      ['Cloud API', 'Health check ~43ms DB latency (live)', 'A-'],
    ]
  ),

  h1('PART 10 — AI Feature Audit'),
  table(
    ['Feature', 'Type', 'Clinical value', 'Limitations'],
    [
      ['AI scleral lens advisor', 'Rule-based CDS', 'High', 'No topography ML'],
      ['AI laser refractive planner', 'Rule-based CDS', 'High', 'Manual topography entry'],
      ['Ectasia AI (ectasia-v1-topography)', 'Rules + registry', 'High', 'Not trained ML'],
      ['KC progression (ΔKmax)', 'Deterministic', 'High', 'Simplified vs literature'],
      ['KP matching engine', 'Protocol rules', 'High', 'No ML tissue ranking'],
    ]
  ),
  p('AI readiness score: 48/100. Strong clinical decision support framework; no machine learning, computer vision, or LLM integration.'),

  pageBreak(),
  h1('PART 11 — Research and Registry Audit'),
  table(
    ['Registry', 'Ready', 'Export', 'Analytics'],
    [
      ['Keratoconus / CXL', 'Yes', 'CSV', 'Research tab cohort'],
      ['Corneal ulcer', 'Yes', 'Research cohort', 'Overview stats'],
      ['Keratoplasty outcomes', 'Yes', 'CSV', 'Graft survival curve'],
      ['Contact lens outcomes', 'Partial', 'Manual from visit JSON', 'Not in research tab'],
      ['Eye bank', 'Yes', 'API CSV export', 'Eye-bank overview API'],
    ]
  ),
  p('Missing: REDCap integration, FHIR export, IRB consent tracking, anonymization pipeline, multi-centre research.'),

  h1('PART 12 — Quality Assurance Audit'),
  h2('Recently fixed (commit 405c37c)'),
  table(
    ['Severity', 'Issue', 'Status'],
    [
      ['Critical', 'refreshModuleCloudData() infinite recursion — login failure', 'Fixed'],
      ['Critical', 'STORE_KP_PATIENTS redeclaration — keratoplasty.js failed to load', 'Fixed'],
    ]
  ),
  h2('Open / residual risks'),
  bullet('Major: Registry sync fragmentation (KC, keratitis not in main queue).'),
  bullet('Major: Research & media library cloud-only.'),
  bullet('Major: Production media storage may be local/ephemeral on DO.'),
  bullet('Technical debt: Global var/const collisions across scripts.'),
  bullet('Regression risk: New top-level const in clinic JS after storage.js.'),

  pageBreak(),
  h1('PART 13 — Tertiary Cornea Institute Gap Analysis'),
  table(
    ['Ideal capability', 'Current state'],
    [
      ['Unified patient timeline', 'Partial — fragmented tabs'],
      ['OR / theatre management', 'Missing'],
      ['Appointments & recall', 'Missing'],
      ['Billing / claims', 'Missing'],
      ['DICOM / PACS', 'Missing'],
      ['National registry (HL7/FHIR)', 'Missing'],
      ['Multi-site analytics', 'Missing'],
      ['Formal ML / imaging AI', 'Missing'],
      ['24/7 HA API cluster', 'Single DO app instance'],
      ['LDAP/SSO', 'Missing'],
    ]
  ),

  h1('PART 14 — Top 20 Next Development Priorities'),
  table(
    ['Rank', 'Priority', 'Impact', 'Effort'],
    [
      ['1', 'Production S3/R2 media + verify backups', 'High safety', 'Medium'],
      ['2', 'Unify registry sync into main queue', 'High clinical', 'Large'],
      ['3', 'Playwright regression suite (script load, KP, login)', 'High safety', 'Medium'],
      ['4', 'Global API rate limiting (Redis)', 'Security', 'Medium'],
      ['5', 'SMTP + password reset verification', 'Operations', 'Small'],
      ['6', 'Formal security assessment / pen test', 'Accreditation', 'Medium'],
      ['7', 'Sirius / tomography device import', 'Clinical + research', 'Medium'],
      ['8', 'Offline-capable research summaries', 'Research', 'Medium'],
      ['9', 'Appointment & recall module', 'Workflow', 'Large'],
      ['10', 'FHIR export for national registry', 'Tertiary status', 'Large'],
      ['11', 'DICOM ingest for topography/OCT', 'Investigations', 'XL'],
      ['12', 'Dedicated dry eye / OSD module', 'Service line', 'Medium'],
      ['13', 'OR scheduling integration', 'Surgical workflow', 'XL'],
      ['14', 'Teaching case library + anonymization', 'Teaching', 'Medium'],
      ['15', 'Dashboard institute KPIs', 'Operations', 'Small'],
      ['16', 'Wrap clinic JS in IIFEs / ES modules', 'Prevent collisions', 'Large'],
      ['17', 'Mobile-optimized visit summary', 'Bedside use', 'Medium'],
      ['18', 'Contact lens outcomes in research tab', 'Research', 'Small'],
      ['19', 'LDAP/SSO for hospital IT', 'Enterprise', 'Large'],
      ['20', 'Topography ML ectasia model (v2)', 'AI maturity', 'XL'],
    ]
  ),

  pageBreak(),
  h1('PART 15 — 12-Month Development Roadmap'),
  h2('Phase 1 — Immediate (0–4 weeks)'),
  bullet('Verify production: S3 media, SMTP, migrations 018–019, backup drill.'),
  bullet('Deploy smoke-test checklist (login, KP tabs, sync, locks).'),
  bullet('Add CI script: detect duplicate global const declarations.'),
  bullet('Configure AUTH_EXPOSE_REFRESH_IN_BODY=false, explicit CORS_ORIGIN.'),
  h2('Phase 2 — 3 months'),
  bullet('Registry sync unification; Playwright E2E in CI; Redis rate limiting.'),
  bullet('Dashboard institute KPIs; Sirius tomography import.'),
  h2('Phase 3 — 6 months'),
  bullet('Appointment & recall; FHIR export prototype; teaching case library.'),
  bullet('Offline research cache; security pen test remediation.'),
  h2('Phase 4 — 12 months'),
  bullet('DICOM/PACS light integration; OR scheduling; topography ML pilot; LDAP/SSO.'),

  pageBreak(),
  h1('PART 16 — Final Verdict'),
  table(
    ['Setting', 'Suitable?', 'Rationale'],
    [
      ['Small cornea clinic', 'Yes', 'Core EMR exceeds needs; offline-capable'],
      ['Large cornea clinic', 'Yes, with ops discipline', 'Multi-user sync, registries; needs S3 + monitoring'],
      ['Teaching hospital', 'Partially', 'Strong modules; weak teaching case governance'],
      ['Tertiary referral centre', 'Partially', 'Registries, KP, eye bank; missing OR, national export, HA'],
      ['National cornea registry', 'No', 'No FHIR/HL7 export'],
    ]
  ),
  boldP('Current maturity score: ', '86 / 100'),
  boldP('Estimated completion: ', '~86% of ideal tertiary cornea institute EMR'),
  boldP('Live API status: ', 'Health 200; registry routes 401 (live, auth required)'),
  h3('Top 5 highest-value next actions'),
  bullet('1. Confirm production media on S3/R2 and run backup/restore drill for DB + objects.'),
  bullet('2. Run full smoke-test post-405c37c on live URL (Keratoplasty sub-tabs, login, sync).'),
  bullet('3. Unify registry sync so KC/keratitis/graft data is as reliable as visits.'),
  bullet('4. Add automated regression tests for script-load collisions and auth bootstrap.'),
  bullet('5. Plan FHIR export + device import as bridge to tertiary referral status.'),
  p(''),
  p('This audit was performed by static analysis and live read-only API probes. No penetration testing, load testing, or clinical validation with real patient data was conducted. Recommendations are advisory only.'),
];

const doc = new Document({
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Written:', OUT);

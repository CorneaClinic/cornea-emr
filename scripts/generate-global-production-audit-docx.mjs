/**
 * Generates Comprehensive Tertiary Cornea EMR Global Audit (Word).
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
const OUT = path.join(__dirname, '..', 'docs', 'Comprehensive_Tertiary_Cornea_EMR_Global_Audit_July_2026.docx');

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
    children: [new TextRun({ text: 'COMPREHENSIVE TERTIARY CORNEA EMR', bold: true, size: 28 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Global Audit Report', bold: true, size: 26 })],
  }),
  boldP('Audit date: ', '2 July 2026'),
  boldP('Repository: ', 'cornea-emr'),
  boldP('Production UI: ', 'https://corneaclinic.visionemr.net/Cornea'),
  boldP('Production API: ', 'https://corneaclinic-2zfpt.ondigitalocean.app'),
  boldP('Scope: ', 'Full-platform assessment at tertiary cornea service level'),
  boldP('Method: ', 'Static codebase review, architecture documentation, live production health checks, unit test run, Phase 0 gate snapshot'),
  boldP('Live verification: ', 'Production health check PASSED; unit tests 35/35; Phase 0 gate snapshot logged 2 July 2026'),
  p('Multidisciplinary audit team: Senior Cornea Specialist, Refractive Surgeon, Contact Lens/Scleral Lens Specialist, Keratoplasty Surgeon, Eye Bank Specialist, Clinical Informatician, Health IT Architect, Cloud Infrastructure Engineer, Cybersecurity Specialist, Database Architect, Software QA Engineer, Medical Research Director.'),

  h1('1. Executive Summary'),
  table(
    ['Dimension', 'Score', 'Verdict'],
    [
      ['Clinical breadth (tertiary cornea)', '86 / 100', 'Strong — visit workflow, subspecialty registries, transplant, research, OR, dry eye'],
      ['Production readiness', '78 / 100', 'Operational but not fully stabilized — ops gates G6/G7 open'],
      ['Security posture', '74 / 100', 'JWT + RBAC solid; rate limiting, offline encryption, pen-test pending'],
      ['Offline / sync', '70 / 100', 'Visits/KP queue works; registries mostly direct REST'],
      ['Test & regression safety', '72 / 100', 'API unit coverage good; e2e partial; module gaps in newer features'],
      ['Weighted global (tertiary EMR)', '~81 / 100', 'Slight improvement from recent UX; stabilization unchanged'],
    ]
  ),
  p('Bottom line: This is a credible tertiary cornea EMR with breadth beyond typical clinic systems (keratoplasty register, KC/CXL, keratitis service, eye bank traceability, research analytics, OR scheduling, dry eye OSD). Production is live and healthy, but the platform has not yet exited stabilization per docs/PRODUCTION_STABILIZATION_ROADMAP.md. Reliability and ops maturity lag clinical feature depth.'),
  p('Policy tension: Roadmap declares a clinical feature freeze until Phase 3 exit gates; code already ships Phase 4 modules (dashboard KPIs, FHIR export, appointments, DICOM hooks, dry eye, OR, ectasia AI v2). Stabilization should take priority over further clinical expansion.'),

  pageBreak(),
  h1('2. Live Production Status (Verified 2 July 2026)'),
  table(
    ['Check', 'Status'],
    [
      ['API reachable + DB', 'PASS'],
      ['Clinic UI loads', 'PASS'],
      ['Backup log fresh (<48h)', 'PASS'],
      ['global-debug suite', '21/21 PASS'],
      ['Vitest (apps/api/tests/)', '35/35 PASS'],
      ['Phase 0.2 smoke (last operator run)', 'PASS (26 Jun 2026)'],
    ]
  ),
  h2('Stabilization Gates'),
  table(
    ['Gate', 'Status', 'Notes'],
    [
      ['G1 Data safety', 'PARTIAL', 'Backups running; restore drill catalog-only (full pg_restore needs local PG)'],
      ['G2 Media durability', 'PASS', 'MEDIA_STORAGE_PROVIDER=s3 on DigitalOcean'],
      ['G3 Auth hardening', 'PARTIAL', 'CORS/SMTP configured; password-reset E2E pending operator'],
      ['G4 Regression safety', 'PARTIAL', 'Playwright + CI added; depends on green e2e-playwright job'],
      ['G5 Sync reliability', 'PARTIAL', 'Visits/media smoke OK; registry sync matrix incomplete'],
      ['G6 Security baseline', 'OPEN', 'Redis global rate limiting not deployed'],
      ['G7 Observability', 'OPEN', 'Health/backup/sync failure alerting not configured'],
    ]
  ),
  p('Exit criterion for production stabilized: All gates G1–G7 PASS. Current state: 2 PASS, 4 PARTIAL, 2 OPEN.'),

  pageBreak(),
  h1('3. Platform Architecture'),
  p('Clinic SPA (Cloudflare Pages) — Cornea.html + ~40 JS modules — IndexedDB offline queue, JWT auth, section-level RBAC — REST + sync push/pull — API (DigitalOcean App Platform) — Node/Express, 32 route modules, ~165 endpoints, PostgreSQL, S3 media — PostgreSQL (23 migrations), S3 (Spaces), scheduled encrypted backups.'),
  table(
    ['Layer', 'Count / Detail'],
    [
      ['EMR UI sections (RBAC)', '15 (emr-sections.js)'],
      ['SQL migrations', '23 (000–022)'],
      ['API route modules', '32'],
      ['Patient form clinical sections', '14 (incl. optional CL/refractive, opinion/referral)'],
      ['E2E specs', '6 Playwright'],
      ['API unit tests', '35 Vitest'],
    ]
  ),

  pageBreak(),
  h1('4. Clinical Capability Matrix (Tertiary Cornea)'),
  h2('4.1 Core Visit Workflow — Strong (90%)'),
  table(
    ['Capability', 'Status', 'Evidence'],
    [
      ['Demographics + history', 'Yes', 'patient-form.js, migrations 003'],
      ['Visual acuity / refraction', 'Yes', 'Vision section'],
      ['Vitals', 'Yes', 'Dedicated section'],
      ['Anterior segment (structured)', 'Yes', 'Cornea-specific fields'],
      ['Anterior segment drawing', 'Yes', 'drawing.js, canvas module'],
      ['Fundus', 'Yes', 'Section present'],
      ['ICD diagnosis + status', 'Yes', 'Fixed read-only skip bug (recent)'],
      ['Opinion & referral (threaded)', 'Yes', 'cornea-opinion-referral.js'],
      ['Documents / prescriptions', 'Yes', 'Printing, prescriptions API'],
      ['Follow-up planning', 'Yes', 'Cleared on new-visit pre-fill'],
      ['Contact lens work-up', 'Yes', 'Optional section + nav reveal'],
      ['Laser refractive work-up', 'Yes', 'Optional section + nav reveal'],
      ['Section navigation + full-screen modal', 'Yes', 'Recent UX improvements'],
      ['New visit from prior (carry-forward)', 'Yes', 'stripRecordForNewVisit'],
      ['Section attribution (who edited what)', 'Yes', 'cornea-section-attribution.js'],
      ['Record edit locks (cloud)', 'Yes', 'Migration 018'],
    ]
  ),
  h3('Gaps'),
  bullet('No native structured tomography import UI (DICOM route exists but integration depth unclear)'),
  bullet('No built-in IOL calculator'),
  bullet('Limited biometry device integration'),

  h2('4.2 Subspecialty Registries — Strong (85%)'),
  table(
    ['Module', 'API + DB', 'Offline Sync', 'Notes'],
    [
      ['Keratoplasty register', 'Yes', 'Queued', 'Tissue inventory, matching, outcomes'],
      ['KC & CXL registry', 'Yes', 'Direct REST', '15 KC endpoints'],
      ['Keratitis & ulcer service', 'Yes', 'Direct REST', 'Migration 017'],
      ['Eye bank traceability', 'Yes', 'Direct REST', 'Migration 019'],
      ['Dry eye / OSD clinic', 'Yes', 'Direct REST', 'Migration 021'],
      ['KP graft outcomes', 'Yes', 'Partial', 'Research linkage'],
    ]
  ),

  h2('4.3 Tertiary Service Operations — Good (80%)'),
  table(
    ['Capability', 'Status'],
    [
      ['Patient flow (stations)', 'Yes'],
      ['Appointments & recall', 'Yes (migration 020)'],
      ['OR scheduling', 'Yes (migration 022)'],
      ['Clinical media library', 'Yes — S3-backed'],
      ['Research & outcomes analytics', 'Yes'],
      ['Dashboard KPIs', 'Yes'],
      ['FHIR export', 'Route present'],
      ['DICOM', 'Route present; depth TBD'],
      ['Ectasia AI v2', 'Route present; clinical validation TBD'],
    ]
  ),

  h2('4.4 Admin & Governance — Strong (88%)'),
  table(
    ['Capability', 'Status'],
    [
      ['Role-based access (6+ roles)', 'Yes'],
      ['Per-user EMR section overrides', 'Yes — Migration 013'],
      ['Audit trail (who changed records)', 'Yes — Migration 006'],
      ['User admin', 'Yes'],
      ['Database export/import', 'Yes — Admin-only'],
    ]
  ),

  pageBreak(),
  h1('5. Security & Compliance'),
  h2('Strengths'),
  bullet('JWT access + refresh rotation; session table (migration 007)'),
  bullet('Granular permissions (permissions.js) aligned to clinical modules'),
  bullet('Audit logging for record changes'),
  bullet('CORS tightened for production clinic origin'),
  bullet('Media on S3, not ephemeral container disk'),
  bullet('AUTH_EXPOSE_REFRESH_IN_BODY hardening path documented'),

  h2('Gaps & Risks'),
  table(
    ['Risk', 'Severity', 'Detail'],
    [
      ['No Redis rate limiting (G6)', 'High', 'Brute-force / abuse exposure on public API'],
      ['Offline IndexedDB not encrypted', 'High', 'PHI on clinic workstations if device lost'],
      ['Password-reset E2E unverified (G3)', 'Medium', 'SMTP configured but operator test pending'],
      ['Pen-test not completed', 'Medium', 'Scheduled Q3 2026 per roadmap'],
      ['/health may expose DB metadata', 'Low', 'Restrict or redact'],
      ['Record-lock release RBAC', 'Low', 'Could tighten to kp:write only'],
    ]
  ),
  p('Compliance posture: Suitable for clinic-operated deployment with local DPA and access controls; not yet at enterprise certification level (no formal SOC2/HIPAA attestation in repo).'),

  pageBreak(),
  h1('6. Offline Sync & Data Integrity'),
  table(
    ['Data Type', 'Sync Path', 'Conflict Handling'],
    [
      ['Patient visits', 'IndexedDB queue → /sync/push', 'Server-wins with timestamps'],
      ['Keratoplasty entities', 'Queued sync', 'Verified in smoke'],
      ['KC / keratitis / dry eye / OR', 'Direct REST when online', 'No unified offline queue'],
      ['Clinical media', 'Upload queue + S3', 'Retry on reconnect'],
      ['Record locks', 'Real-time API', 'Prevents concurrent edit'],
    ]
  ),
  p('Risk: Registry modules used offline may show stale data or fail silently. G5 requires a documented sync test matrix across all registries.'),

  h1('7. Testing & Quality Assurance'),
  table(
    ['Suite', 'Coverage', 'Gap'],
    [
      ['API Vitest (35 tests)', 'Auth, sync, visits, permissions, locks', 'Dry eye, OR, eye bank, DICOM untested'],
      ['Playwright (6 specs)', 'Login, script load, KP panels, sync smoke', 'Opinion/referral, new visit pre-fill, appointments'],
      ['global-debug (21)', 'Static analysis / wiring', 'Does not replace clinical E2E'],
      ['Production health script', 'API, UI, backup freshness', 'No synthetic visit save'],
    ]
  ),
  p('Historical incidents (roadmap): Login recursion and Keratoplasty script collision caused silent module failure — regression tests now exist but must stay green in CI (G4).'),

  pageBreak(),
  h1('8. Recent Delivery (Since Last Formal Audit)'),
  p('Commits deployed on main improve clinical UX without new backend modules:'),
  bullet('1. SomeyeTech branding (favicon, footer)'),
  bullet('2. Patient form section sidebar (scroll spy, optional-section reveal)'),
  bullet('3. Full-screen patient modal'),
  bullet('4. Opinion & referral section + diagnosis document-view fix'),
  bullet('5. New visit pre-fill from prior record'),
  p('These raise visit workflow maturity but do not close stabilization gates.'),

  h1('9. Prioritized Recommendations'),
  h2('P0 — Next 2 Weeks (Stabilization)'),
  bullet('1. G6: Deploy Redis (REDIS_URL) + enable global rate limiter on DigitalOcean'),
  bullet('2. G3: Operator password-reset E2E with real mailbox; log result'),
  bullet('3. G1: Full pg_restore drill on staging clone; schedule monthly recurrence'),
  bullet('4. G7: Wire alerts (health fail, backup gap >24h, sync push error spike)'),

  h2('P1 — Weeks 2–8 (Reliability)'),
  bullet('5. G5: Registry sync matrix — document online-only vs queued; add KC/keratitis offline policy'),
  bullet('6. G4: Keep Playwright CI green on every main merge; add script-load guard for new globals'),
  bullet('7. RBAC review for production users (least privilege)'),
  bullet('8. E2E for: new visit pre-fill, opinion/referral save, record lock'),

  h2('P2 — Months 2–6 (Tertiary Depth, Post-Stabilization)'),
  bullet('9. DICOM/topography ingest validation with real device exports'),
  bullet('10. Offline IndexedDB encryption for clinic workstations'),
  bullet('11. Pen-test (Q3 2026) with remediation sprint'),
  bullet('12. API tests for dry eye, OR, eye bank routes'),
  bullet('13. FHIR export validation against a test FHIR server'),

  h2('Defer Until Phase 3 Exit'),
  bullet('New clinical modules (AI v3, additional registries)'),
  bullet('Major UI rewrites unrelated to stabilization'),

  pageBreak(),
  h1('10. Scoring Summary'),
  table(
    ['Area', 'Score', 'Trend'],
    [
      ['Tertiary clinical breadth', '86', 'Up (opinion/referral, visit UX)'],
      ['Visit workflow completeness', '90', 'Up'],
      ['Registry / subspecialty depth', '85', 'Stable'],
      ['Production ops maturity', '78', 'Stable (G2 pass; G6/G7 open)'],
      ['Security', '74', 'Stable'],
      ['Sync / offline', '70', 'Stable'],
      ['Test coverage', '72', 'Up (CI e2e added)'],
      ['Weighted global (tertiary EMR)', '~81 / 100', 'Slight improvement'],
    ]
  ),

  h1('11. Conclusion'),
  p('Cornea EMR at tertiary level is clinically credible and production-live, with uncommon depth in keratoplasty, KC/CXL, keratitis, eye bank, and research analytics. The limiting factor is operational stabilization, not missing core cornea documentation fields.'),
  p('Exit criterion for production stabilized: All gates G1–G7 PASS per docs/PRODUCTION_STABILIZATION_ROADMAP.md. Current state: 2 PASS, 4 PARTIAL, 2 OPEN.'),
  p(''),
  p('This audit was performed by static analysis, live production health checks, and automated test runs. It does not replace formal clinical validation, penetration testing, or regulatory compliance review. Recommendations are advisory only.'),
];

const doc = new Document({
  creator: 'Cornea Clinic EMR Audit',
  title: 'Comprehensive Tertiary Cornea EMR Global Audit — July 2026',
  description: 'Full-platform tertiary cornea EMR global audit — July 2026',
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Written:', OUT);

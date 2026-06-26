/**
 * Generates Production Stabilization Roadmap as Word document.
 * Run: node scripts/generate-production-stabilization-roadmap-docx.mjs
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
const OUT = path.join(__dirname, '..', 'docs', 'Production_Stabilization_Roadmap.docx');

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
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Production Stabilization Roadmap', bold: true, size: 28 })],
  }),
  boldP('Based on: ', 'Global Production Audit (June 2026)'),
  boldP('Principle: ', 'Stabilize production before adding new clinical features'),
  p('The platform scores 86/100 on clinical breadth but 78/100 on production readiness. Recent critical incidents (login recursion, Keratoplasty script load failure) demonstrate that reliability gaps can disable entire modules silently.'),

  h1('Three-layer approach'),
  table(
    ['Layer', 'Focus', 'Target window'],
    [
      ['1 — Safety', 'PHI protection, backups, auth, media durability', 'Weeks 0–4'],
      ['2 — Reliability', 'Sync integrity, regression tests, monitoring, runbooks', 'Weeks 4–12'],
      ['3 — Scalability', 'Object storage, rate limits, performance, multi-user load', 'Months 3–6'],
    ]
  ),
  p('Clinical feature freeze: No new modules (appointments, DICOM, FHIR, new registries, AI v2) until Phase 3 exit gates are met. Bug fixes and security patches remain in scope at all times.'),

  h1('Stabilization gates (G1–G7)'),
  p('Production is stabilized when all gates pass:'),
  table(
    ['Gate', 'Criterion', 'Verification'],
    [
      ['G1 — Data safety', 'DB + media backed up; restore drill within 30 days', 'backup-restore-drill.ps1 log'],
      ['G2 — Media durability', 'MEDIA_STORAGE_PROVIDER=s3 on production', 'Upload + retrieve test'],
      ['G3 — Auth hardening', 'AUTH_EXPOSE_REFRESH_IN_BODY=false, explicit CORS, SMTP', 'Password-reset email test'],
      ['G4 — Regression safety', 'Playwright CI: login, KP tabs, script load, sync', 'CI green on main'],
      ['G5 — Sync reliability', 'Unified or verified sync for all registries', 'Sync test matrix pass'],
      ['G6 — Security baseline', 'Global rate limiting; pen-test scoped', 'Redis limiter active'],
      ['G7 — Observability', 'Health, backup, sync failure alerts', 'Alert drill passed'],
    ]
  ),

  pageBreak(),
  h1('Phase 0 — Immediate hardening (Days 0–14)'),
  h2('0.1 Production configuration audit'),
  table(
    ['Task', 'Effort'],
    [
      ['Confirm NODE_ENV=production on DigitalOcean API', '1 h'],
      ['Set AUTH_EXPOSE_REFRESH_IN_BODY=false', '30 m'],
      ['Set explicit CORS_ORIGIN (not *)', '30 m'],
      ['Verify migrations 000–019 on production DB', '2 h'],
      ['Document DO env vars in secure runbook', '2 h'],
    ]
  ),
  h2('0.2 Live smoke test'),
  bullet('Cloud login completes; modal dismisses without refresh'),
  bullet('Keratoplasty: all four sub-tabs switch'),
  bullet('Visit save → sync push succeeds'),
  bullet('Record lock acquire/release'),
  bullet('KC registry read/write'),
  bullet('Media upload on test visit'),
  h2('0.3 Backup and recovery'),
  bullet('Schedule production DB backup (CorneaEMR-ProductionBackup)'),
  bullet('Run backup-restore-drill.ps1 with row-count verification'),
  bullet('Store backup-encryption.key off-site'),
  bullet('Review backup logs weekly'),

  pageBreak(),
  h1('Phase 1 — Safety (Weeks 2–4)'),
  h2('1.1 Object storage for clinical media (critical)'),
  p('Risk: local media on ephemeral DO containers loses images on redeploy.'),
  bullet('Provision S3-compatible bucket (DO Spaces or Cloudflare R2)'),
  bullet('Set MEDIA_STORAGE_PROVIDER=s3 on production API'),
  bullet('Run media migration CLI to backfill existing assets'),
  bullet('Verify signed URL upload/download from clinic UI'),
  bullet('Include object storage in backup strategy'),
  h2('1.2 SMTP and account recovery'),
  bullet('Configure production SMTP; run test:smtp'),
  bullet('End-to-end password reset test'),
  h2('1.3 Security quick wins'),
  bullet('Tighten record-lock release to kp:write only'),
  bullet('Restrict public /health DB details'),
  bullet('Review RBAC for production users'),
  h2('1.4 Prevent script-load regressions'),
  bullet('CI scan for duplicate top-level declarations vs storage.js'),
  bullet('Fail PR on collision; document contributor rule'),

  pageBreak(),
  h1('Phase 2 — Reliability (Weeks 4–12)'),
  h2('2.1 Unified registry sync'),
  p('KC, keratitis, graft, and eye-bank use direct REST while visits use the main sync queue — offline edits are inconsistent.'),
  bullet('Inventory all registry write paths'),
  bullet('Extend sync queue OR document explicit offline policy per registry'),
  bullet('Document conflict rules in SYNC_ARCHITECTURE.md'),
  bullet('Integration test: offline edit → reconnect → data consistent'),
  h2('2.2 Playwright regression suite'),
  table(
    ['Test', 'Covers'],
    [
      ['Script load', 'No SyntaxError; switchKpPanel defined'],
      ['Login bootstrap', 'No recursion; modal closes'],
      ['KP panel switch', 'All four sub-panels'],
      ['Sync smoke', 'Push/pull on staging'],
      ['Auth 401', 'Registry routes require token'],
    ]
  ),
  h2('2.3 Operational runbooks'),
  bullet('Incident response: login down, sync stuck, API 5xx'),
  bullet('Deployment rollback: Clinic (Wrangler) + API (DO)'),
  bullet('Backup restore from BACKUP_RECOVERY.md'),
  h2('2.4 Monitoring and alerts'),
  bullet('API /health non-200 or DB latency > 2s'),
  bullet('Missed backup scheduled run'),
  bullet('Sync queue backlog threshold'),
  bullet('API 5xx error spike'),

  pageBreak(),
  h1('Phase 3 — Scalability (Months 3–6)'),
  h2('3.1 API rate limiting'),
  bullet('Deploy Redis for global rate limits (replaces in-memory limiter)'),
  bullet('Per-IP and per-user limits on auth and sync'),
  bullet('Document horizontal scaling path for DO App Platform'),
  h2('3.2 Performance'),
  bullet('Defer non-critical scripts; measure LCP'),
  bullet('Server-side pagination for patient search'),
  bullet('Archive old visits in IndexedDB'),
  bullet('Lazy-load clinical library thumbnails'),
  h2('3.3 Codebase hardening'),
  bullet('Wrap clinic JS in IIFEs or ES modules'),
  bullet('Centralize store keys in storage.js only'),
  bullet('Staging environment mirroring production'),
  h2('3.4 Formal security assessment'),
  bullet('OWASP scope: auth, sync, upload, tenant isolation'),
  bullet('Remediate findings before feature freeze lift'),

  pageBreak(),
  h1('Phase 4 — Feature readiness (after G1–G7)'),
  table(
    ['Priority', 'Feature', 'Rationale'],
    [
      ['P1', 'Dashboard institute KPIs', 'Ops visibility; small effort'],
      ['P2', 'Offline research summaries', 'Reliability extension'],
      ['P3', 'Sirius / tomography import', 'Builds on stable media'],
      ['P4', 'FHIR export prototype', 'Tertiary bridge'],
      ['P5', 'Appointments & recall', 'Needs stable sync'],
      ['P6', 'DICOM / PACS', 'Depends on media + performance'],
      ['P7', 'New clinical modules', 'Deferred until platform proven'],
    ]
  ),

  h1('Deferred clinical backlog (freeze list)'),
  bullet('Appointment & recall module'),
  bullet('DICOM ingest'),
  bullet('Dry eye / OSD module'),
  bullet('OR scheduling'),
  bullet('Teaching case library'),
  bullet('FHIR / national registry'),
  bullet('LDAP/SSO'),
  bullet('Topography ML v2'),
  bullet('Mobile visit summary'),

  h1('Success metrics (6-month targets)'),
  table(
    ['Metric', 'Baseline', 'Target'],
    [
      ['Production readiness', '78', '≥ 90'],
      ['Security', '72', '≥ 85'],
      ['Scalability', '70', '≥ 80'],
      ['Script-load outages', '2 critical in 2026', '0'],
      ['Restore drill', 'Ad hoc', 'Monthly, logged'],
    ]
  ),

  h1('Quick start (this week)'),
  bullet('1. Run live smoke test checklist'),
  bullet('2. Execute backup-restore-drill.ps1'),
  bullet('3. Audit DO env: MEDIA_STORAGE_PROVIDER and SMTP'),
  bullet('4. Add CI duplicate-global scan'),
  bullet('5. Schedule S3 migration window'),

  p(''),
  p('Revisit gate status monthly. Lift the clinical feature freeze only when G1–G7 are demonstrably met.'),
];

const doc = new Document({ sections: [{ properties: {}, children }] });
const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Written:', OUT);

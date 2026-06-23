/**
 * Generates Master Development Plan — Tertiary Cornea Institute Platform as Word document.
 * Run: node scripts/generate-master-development-plan-docx.mjs
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
const OUT = path.join(__dirname, '..', 'docs', 'Master_Development_Plan_Tertiary_Cornea_Institute.docx');

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

function projectBlock(num, title, phase, what, fields) {
  return [
    h2(`Project ${num}: ${title}`),
    boldP('Phase: ', phase),
    boldP('What: ', what),
    p(''),
    table(
      ['Field', 'Detail'],
      [
        ['Clinical justification', fields.clinical],
        ['Research value', fields.research],
        ['Complexity', fields.complexity],
        ['Dependencies', fields.dependencies],
        ['Impact score', fields.impact],
      ]
    ),
    h3('Why selected'),
    p(fields.why),
    p(''),
  ];
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
    children: [new TextRun({ text: 'Master Development Plan', bold: true, size: 28 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Tertiary Cornea Institute Platform', bold: true, size: 26 })],
  }),
  boldP('Plan date: ', '21 June 2026'),
  boldP('Based on: ', 'Comprehensive Tertiary Cornea EMR Global Audit (June 2026)'),
  boldP('Goal: ', 'Transform a strong specialist cornea clinic EMR (~72% complete) into a tertiary cornea institute platform'),
  boldP('Scope: ', '10 highest-value projects only — no billing, scheduling-only, or low-impact admin features'),
  p(''),

  h1('Prioritization Framework'),
  p('Each project was scored on five dimensions (1–10), then weighted:'),
  table(
    ['Dimension', 'Weight', 'Rationale'],
    [
      ['Clinical impact', '30%', 'Core mission of a tertiary cornea institute'],
      ['Patient safety', '25%', 'Non-negotiable for live clinical use'],
      ['Research value', '20%', 'Required for institute + national referral status'],
      ['Development effort', '15%', 'Inverse — faster wins where impact is high'],
      ['Long-term scalability', '10%', 'Multi-user, multi-service, registry-ready architecture'],
    ]
  ),
  p(''),
  h3('Existing strengths leveraged'),
  bullet('Cloud synchronization'),
  bullet('Keratoplasty register'),
  bullet('Contact lens module'),
  bullet('Scleral lens wizard + AI Scleral Advisor'),
  bullet('Laser Refractive Surgery module + AI Refractive Planner'),
  bullet('Structured anterior segment builder'),
  p(''),
  h3('Why these 10 projects'),
  p('The audit identified the largest gaps blocking tertiary status: data loss risk (cloud media), missing disease registries (CXL, keratitis), manual device entry, disconnected graft outcomes, and no research layer. Admin features (billing, SMS, native apps) were excluded.'),

  h1('Roadmap Overview'),
  table(
    ['Phase', 'Timeline', 'Projects', 'Theme'],
    [
      ['Phase 1', 'Immediate (0–3 months)', '2', 'Stop clinical data loss; launch KC/CXL programme'],
      ['Phase 2', '3 months', '3', 'Emergency cornea + device integration + graft outcomes'],
      ['Phase 3', '6 months', '3', 'Research platform + complete examination + multi-user scale'],
      ['Phase 4', '12 months', '2', 'Advanced AI + accredited eye bank operations'],
    ]
  ),

  pageBreak(),
  h1('Phase 1 — Immediate (0–3 months)'),

  ...projectBlock(
    1,
    'Persistent Cloud Clinical Media Platform',
    'Phase 1 — Immediate',
    'Replace DigitalOcean /tmp/media with durable object storage (Cloudflare R2 or DO Spaces). Migrate upload, sync, and restore paths for slit-lamp photos, topography, AS-OCT, PDFs, and drawings.',
    {
      clinical: 'Live patient images and documents are clinical records. Ephemeral storage risks permanent loss on redeploy — unacceptable at tertiary level.',
      research: 'Enables longitudinal imaging studies and teaching case libraries later.',
      complexity: 'Medium — API storage layer + migration of existing assets + sync client updates',
      dependencies: 'Cloud storage bucket, signed URL strategy, media_assets schema (already exists)',
      impact: '9.5 / 10',
      why: 'Highest patient-safety ROI with moderate effort. Unblocks every imaging-dependent module and registry.',
    }
  ),

  ...projectBlock(
    2,
    'CXL & Keratoconus Longitudinal Registry',
    'Phase 1 — Immediate',
    'Dedicated registry module: KC diagnosis timeline, topography serial entry/import hooks, CXL protocol (epi-on/off, energy, riboflavin), post-CXL Kmax/Kmean tracking, progression flags, links to scleral/laser modules.',
    {
      clinical: 'Audit scored Cross-linking Centre at 3.5/10 — the largest single-service gap. CXL is mentioned in laser AI only; no programme tracking exists.',
      research: 'Very high — ectasia progression, CXL efficacy, and KC natural history are core institute research outputs.',
      complexity: 'Medium–High — new JSON module + cloud sync entity + dashboard views',
      dependencies: 'Project 1 (imaging); builds on existing laser/scleral KC data',
      impact: '9.0 / 10',
      why: 'Transforms keratoconus documented in visits into a Keratoconus Centre with longitudinal care and research capability.',
    }
  ),

  pageBreak(),
  h1('Phase 2 — 3 months'),

  ...projectBlock(
    3,
    'Infectious Keratitis & Corneal Ulcer Service Module',
    'Phase 2 — 3 months',
    'Structured ulcer workflow: presentation scoring, culture/smear tracking, organism type, antimicrobial protocol, daily photo series, healing timeline, emergency queue integration with patient flow.',
    {
      clinical: 'Corneal Ulcer Centre scored 5.0/10. Ulcers are only anterior-segment findings today — no staging, microbiology, or treatment protocol module.',
      research: 'High — microbial keratitis outcomes, resistance patterns, treatment response studies.',
      complexity: 'High — new clinical taxonomy + workflow + lab fields + print templates',
      dependencies: 'Project 1 (serial photography); anterior segment builder (existing)',
      impact: '9.0 / 10',
      why: 'Essential for tertiary emergency cornea and national referral acceptance. Direct patient-safety impact through structured treatment tracking.',
    }
  ),

  ...projectBlock(
    4,
    'Pentacam & Diagnostic Device Import Pipeline',
    'Phase 2 — 3 months',
    'Import Pentacam CSV/export (first device), map to KC/CXL registry and laser work-up. Foundation for specular + AS-OCT later. Auto-populate Kmax, pachymetry, indices.',
    {
      clinical: 'Manual topography entry is the main bottleneck in laser refractive and KC modules. Tertiary institutes expect device-connected workflows.',
      research: 'Very high — enables large-scale ectasia-risk and CXL outcome datasets without transcription error.',
      complexity: 'High — parsers, validation, mapping layer, UI review before commit',
      dependencies: 'Project 2 (CXL registry); laser refractive module (existing)',
      impact: '8.5 / 10',
      why: 'Multiplies value of existing AI Refractive Planner and new CXL registry. Eliminates highest-friction data entry across two flagship modules.',
    }
  ),

  ...projectBlock(
    5,
    'Keratoplasty Graft Outcomes & Rejection Registry',
    'Phase 2 — 3 months',
    'Link KP register patients to visit records. Structured post-graft exams: endothelial count trend, rejection episodes, graft clarity, IOP, medications, failure/re-graft events.',
    {
      clinical: 'KP register is strong (7.5/10) but post-op tracking scored 5.0/10. Graft survival monitoring is core keratoplasty programme requirement.',
      research: 'Very high — graft survival, rejection risk factors, endothelial cell loss — publishable registry data.',
      complexity: 'Medium — schema extension + visit linkage UI + outcome forms',
      dependencies: 'Existing KP register + sync; anterior segment builder; Project 1 for post-op photos',
      impact: '8.5 / 10',
      why: 'Leverages existing keratoplasty strength rather than building from scratch. Closes the graft programme\'s biggest clinical gap.',
    }
  ),

  pageBreak(),
  h1('Phase 3 — 6 months'),

  ...projectBlock(
    6,
    'Cornea Research Analytics & Outcomes Dashboard',
    'Phase 3 — 6 months',
    'Institute dashboard: cohort builder (KC, CXL, keratitis, KP, refractive), outcome summaries, export to CSV/Excel, basic statistics (Kaplan-Meier for graft survival, progression rates).',
    {
      clinical: 'Supports quality improvement — rejection rates, CXL failure, keratitis healing times.',
      research: 'Critical — Research Centre scored 4.5/10. Transforms export-only data into an analytics platform.',
      complexity: 'High — aggregation queries on JSONB + registry tables + UI',
      dependencies: 'Projects 2, 3, 4, 5 (structured registries must exist first)',
      impact: '8.0 / 10',
      why: 'Unlocks tertiary Research Unit and path toward national registry. Depends on registries from Phases 1–2.',
    }
  ),

  ...projectBlock(
    7,
    'Structured Posterior Segment Examination Module',
    'Phase 3 — 6 months',
    'Taxonomy-driven posterior segment builder (disc, macula, vessels, periphery) mirroring anterior segment pattern. Links to visit media and print.',
    {
      clinical: 'Fundus is legacy free-text (5.0/10). Tertiary cornea institutes still document posterior findings (CMV retinitis, diabetic screening, post-graft fundus).',
      research: 'Medium — enables combined anterior/posterior outcome studies.',
      complexity: 'Medium — reuse anterior builder architecture',
      dependencies: 'Anterior segment builder pattern (existing); Project 1 for fundus images',
      impact: '7.0 / 10',
      why: 'Completes the clinical record beyond cornea-only anterior work. Reuses proven builder pattern — good effort/impact ratio.',
    }
  ),

  ...projectBlock(
    8,
    'Multi-Clinician Record Locking & Concurrent Edit Safety',
    'Phase 3 — 6 months',
    'Optimistic locking UI, record-in-use warnings, conflict resolution for simultaneous edits, section-level attribution enhancement.',
    {
      clinical: 'Tertiary institutes run concurrent consultants, fellows, and technicians. Sync conflicts today are backend-only — users need visible safety.',
      research: 'Low–Medium — protects data integrity for research datasets.',
      complexity: 'Medium–High — sync protocol + UI + offline/online edge cases',
      dependencies: 'Existing sync infrastructure (stable); audit trail (existing)',
      impact: '7.5 / 10',
      why: 'Patient safety and scalability for multi-user tertiary workflow without rebuilding sync from scratch.',
    }
  ),

  pageBreak(),
  h1('Phase 4 — 12 months'),

  ...projectBlock(
    9,
    'Topography-Integrated Ectasia AI & Advanced Refractive Decision Support',
    'Phase 4 — 12 months',
    'Extend AI Refractive Planner with imported topography metrics: enhanced ectasia scoring, CXL recommendation refinement, procedure ranking validated against registry outcomes (Projects 2 + 4 data).',
    {
      clinical: 'Current AI is rule-based and manual-entry limited. Device-fed AI is the natural evolution of existing AI Refractive Planner strength.',
      research: 'Very high — AI vs surgeon decisions, outcome correlation, model validation papers.',
      complexity: 'Very High — ML pipeline, validation cohort, regulatory considerations for CDS',
      dependencies: 'Projects 2, 4, 6 (registry data + topography import + analytics)',
      impact: '8.0 / 10',
      why: 'Builds on flagship laser + AI strength rather than new greenfield AI. Becomes defensible tertiary differentiator after data foundation exists.',
    }
  ),

  ...projectBlock(
    10,
    'Accredited Eye Bank Operations & Traceability Module',
    'Phase 4 — 12 months',
    'Expand KP tissue inventory into full eye-bank workflow: donor ID, serology, quarantine, chain-of-custody, cold-chain events, regulatory export, allocation audit trail.',
    {
      clinical: 'Eye Bank scored 5.0/10 — inventory only. Tertiary institutes with in-house or affiliated eye banks need traceability for graft safety.',
      research: 'High — donor tissue quality vs outcome linkage (with Project 5).',
      complexity: 'Very High — regulatory domain, workflow depth, compliance documentation',
      dependencies: 'Project 5 (graft outcomes); existing KP tissue module',
      impact: '7.5 / 10',
      why: 'Completes the Eye Bank + Keratoplasty service line using existing tissue inventory as foundation. Deferred to Phase 4 due to complexity and regulatory scope.',
    }
  ),

  pageBreak(),
  h1('Summary Matrix'),
  table(
    ['#', 'Project', 'Phase', 'Impact', 'Complexity', 'Primary driver'],
    [
      ['1', 'Persistent Cloud Media Platform', '1', '9.5', 'Medium', 'Patient safety'],
      ['2', 'CXL & KC Longitudinal Registry', '1', '9.0', 'Med–High', 'Clinical + research'],
      ['3', 'Infectious Keratitis Service Module', '2', '9.0', 'High', 'Clinical + safety'],
      ['4', 'Pentacam / Device Import Pipeline', '2', '8.5', 'High', 'Scalability + clinical'],
      ['5', 'KP Graft Outcomes Registry', '2', '8.5', 'Medium', 'Clinical + research'],
      ['6', 'Research Analytics Dashboard', '3', '8.0', 'High', 'Research'],
      ['7', 'Posterior Segment Builder', '3', '7.0', 'Medium', 'Clinical completeness'],
      ['8', 'Multi-clinician Record Locking', '3', '7.5', 'Med–High', 'Safety + scale'],
      ['9', 'Topography-Integrated Ectasia AI', '4', '8.0', 'Very High', 'Clinical + research'],
      ['10', 'Eye Bank Traceability Module', '4', '7.5', 'Very High', 'Institute completeness'],
    ]
  ),

  h1('Deliberately Excluded'),
  table(
    ['Excluded', 'Reason'],
    [
      ['Billing / insurance', 'Low tertiary clinical impact'],
      ['Appointment scheduling alone', 'Admin; not institute differentiator'],
      ['Native mobile app', 'Responsive web sufficient; high effort'],
      ['PWA / cosmetic UX', 'Low impact vs registries'],
      ['FHIR export (standalone)', 'Covered later via Project 6 export layer if needed'],
      ['Code refactor / split HTML', 'Important technically but not in top 10 clinical projects'],
    ]
  ),

  h1('Expected Institute Readiness After Full Plan'),
  table(
    ['Centre', 'Current (/10)', 'After plan (est.)'],
    [
      ['Keratoconus / CXL Centre', '3.5–6.0', '8.5'],
      ['Corneal Ulcer Centre', '5.0', '8.0'],
      ['Keratoplasty Centre', '7.0', '8.5'],
      ['Laser Refractive Centre', '7.5', '8.5'],
      ['Research Centre', '4.5', '8.0'],
      ['Eye Bank', '5.0', '7.5'],
      ['Overall tertiary readiness (avg.)', '~5.5', '~8.0'],
    ]
  ),
  p('Estimated completion after all 10 projects: ~88–90% of tertiary institute vision (up from ~72% today).'),

  h1('Critical Path'),
  bullet('Project 1 (Media) must start first — every imaging-dependent registry depends on durable storage.'),
  bullet('Project 1 → Project 2 (CXL Registry) → Project 4 (Pentacam Import) → Project 9 (Ectasia AI)'),
  bullet('Project 1 → Project 3 (Keratitis Module)'),
  bullet('Project 5 (Graft Outcomes) → Project 10 (Eye Bank) → Project 6 (Analytics Dashboard)'),
  bullet('Project 7 (Posterior Segment) — parallel after Phase 1'),
  bullet('Project 8 (Record Locking) — parallel in Phase 3'),
  p(''),
  p('To regenerate this document: node scripts/generate-master-development-plan-docx.mjs'),
];

const doc = new Document({
  creator: 'Cornea Clinic EMR',
  title: 'Master Development Plan — Tertiary Cornea Institute Platform',
  description: 'Prioritized 10-project roadmap based on Comprehensive Global Audit, June 2026',
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Written:', OUT);

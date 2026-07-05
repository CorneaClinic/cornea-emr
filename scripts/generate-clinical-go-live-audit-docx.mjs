/**
 * Generates Clinical Go-Live Readiness Report (Word).
 * Run: node scripts/generate-clinical-go-live-audit-docx.mjs
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
const OUT = path.join(__dirname, '..', 'docs', 'Clinical_Go_Live_Readiness_Report_July_2026.docx');

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
    children: [new TextRun({ text: 'VisionEMR', bold: true, size: 36 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'CLINICAL GO-LIVE READINESS REPORT', bold: true, size: 28 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Tertiary Cornea Institute Platform', bold: true, size: 24 })],
  }),
  boldP('Audit date: ', '4 July 2026'),
  boldP('Audit type: ', 'Independent Clinical Safety Review Board (read-only)'),
  boldP('Repository: ', 'cornea-emr'),
  boldP('Clinic: ', 'https://corneaclinic.visionemr.net/Cornea'),
  boldP('API: ', 'https://corneaclinic-2zfpt.ondigitalocean.app'),
  boldP('Methods: ', 'Codebase inspection, documentation review, live production health checks, automated verification (stabilize:check 10/10, global-debug 21/21)'),
  p('Review board: Chief Medical Information Officer, Senior Cornea Specialist, Hospital Medical Director, Clinical Risk Manager, Health Informatics Expert, Cybersecurity Specialist, Software QA Lead, Cloud Infrastructure Engineer, Database Architect, Hospital IT Administrator, Eye Bank Director, Clinical Research Director.'),
  p('No code was modified during this audit.'),

  pageBreak(),
  h1('PART 1 — Executive Go-Live Decision'),
  h2('Decision: CONDITIONAL GO'),
  p('The platform is clinically capable for real cornea subspecialty care in a controlled pilot, but is not yet cleared for unrestricted hospital-wide go-live until mandatory operational, security, and governance items are closed.'),
  h3('Overall Readiness Score: 76 / 100'),
  table(
    ['Strength', 'Evidence'],
    [
      ['Broad tertiary cornea coverage', '11 subspecialty workflows implemented (UI + API)'],
      ['Cloud production live', 'API ready, DB connected, S3 media, SMTP configured'],
      ['Strong core sync model', 'PostgreSQL source of truth; revision-based conflict detection for visits/KP'],
      ['Security Wave 0–1 closed', 'No hardcoded credentials; RBAC, audit, rate limits, WAF on clinic UI'],
      ['Automated regression', 'CI green on main; 15 Playwright spec files; sync matrix tests'],
    ]
  ),
  h3('Conditions / blockers'),
  table(
    ['Item', 'Why it matters'],
    [
      ['Stabilization gates G1–G7 not all PASS', 'Roadmap requires full PASS before production exit'],
      ['Formal vendor pen-test postponed', 'Unknown auth/upload/edge vulnerabilities'],
      ['Unencrypted offline IndexedDB', 'PHI on device if stolen or shared workstation'],
      ['Registry modules: online-only writes, no record locks', 'Concurrent edit risk outside core visits'],
      ['Backup RPO target (5 min) vs daily script cadence', 'Medicolegal recovery gap if DO snapshots not verified'],
      ['No formal clinical governance sign-off', 'CDS, consent, retention policies not institutionally approved'],
    ]
  ),

  pageBreak(),
  h1('PART 2 — Patient Safety Review'),
  table(
    ['Capability', 'Status', 'Findings'],
    [
      ['Patient registration', 'PASS', 'Required fields: ID, name, age, sex; age validation'],
      ['Patient identification', 'PARTIAL', 'MRN unique in DB; no real-time duplicate alert at registration'],
      ['Duplicate patient prevention', 'PARTIAL', 'Migration tool detects dupes; no proactive merge at front desk'],
      ['Clinical documentation', 'PASS', 'Structured anterior/posterior segment builders, VA, vitals, diagnosis'],
      ['Diagnosis', 'PASS', 'ICD cloud search; offline text fallback'],
      ['Treatment plans', 'PASS', 'Visit payload + specialty modules'],
      ['Medication documentation', 'PASS', 'Visit form medications section'],
      ['Prescriptions', 'PARTIAL', 'API routes exist; printing depends on browser setup'],
      ['Procedures', 'PASS', 'OR schedule, CXL, KP modules'],
      ['Follow-up', 'PASS', 'Follow-up plans + appointments/recall'],
      ['Clinical media', 'PASS', 'Upload with checksum dedup; S3 in production'],
      ['Referrals', 'PASS', 'Opinion & referral module in visit'],
      ['Discharge', 'PARTIAL', 'Mobile visit summary; no dedicated discharge template'],
    ]
  ),
  boldP('Patient Safety Score: ', '72 / 100'),
  h3('Key patient safety risks'),
  bullet('Duplicate patient records (High) — unique MRN only if enforced; manual ID entry errors possible'),
  bullet('Registry concurrent overwrite (Medium) — KC/keratitis/dry eye: last-write-wins on some paths'),
  bullet('Offline PHI on device (High) — IndexedDB not encrypted'),
  bullet('Wrong-patient selection (Medium) — no barcode/wristband integration'),
  bullet('AI ectasia guidance (Low–Medium) — rule-based CDS; requires clinician judgment'),

  pageBreak(),
  h1('PART 3 — Cornea Clinical Workflow Validation'),
  table(
    ['Workflow', 'Verdict', 'Primary limitation'],
    [
      ['Cornea clinic (core)', 'Ready with limitations', 'Production gates; media DR'],
      ['Contact lens', 'Ready with limitations', 'Embedded in visit; no standalone registry'],
      ['Scleral lens', 'Ready with limitations', '13-step wizard; visit-embedded only'],
      ['Laser refractive', 'Ready with limitations', 'Consent capture; ectasia AI rule-based; CSV topo only'],
      ['Corneal ulcer (keratitis)', 'Ready with limitations', 'Cloud writes blocked offline'],
      ['Dry eye / OSD', 'Ready with limitations', 'No case update API (MVP); online-only writes'],
      ['Keratoconus', 'Ready with limitations', 'Full registry; online-only in cloud mode'],
      ['Cross-linking (CXL)', 'Ready with limitations', 'Sub-module of KC; eye + date required'],
      ['Keratoplasty', 'Ready with limitations', 'Strong sync; CI mitigates script-load regression'],
      ['Eye bank traceability', 'Ready with limitations', 'Custody writes online-only; split from KP sync'],
      ['Opinion & referral', 'Ready', 'Visit-scoped; no inter-site routing API'],
    ]
  ),
  boldP('Clinical Readiness Score: ', '82 / 100'),

  pageBreak(),
  h1('PART 4 — Data Safety'),
  table(
    ['Area', 'Status'],
    [
      ['Patient records', 'PASS — PostgreSQL, tenant-scoped, revision locking'],
      ['Clinical notes', 'PASS — visit JSONB + sync queue'],
      ['Images', 'PASS — S3/Spaces production; SHA-256 dedup'],
      ['Clinical drawings', 'PASS'],
      ['Prescriptions', 'PASS'],
      ['Registries', 'PARTIAL — direct REST; mixed offline policy'],
      ['Backups', 'PARTIAL — daily encrypted scripts + DO managed'],
      ['Restore process', 'PARTIAL — drill scripts exist; G1 not fully PASS'],
      ['Synchronization', 'PASS — idempotent push; 409 conflicts logged'],
      ['Data integrity', 'PARTIAL — strong for sync-queue entities; weaker for registries'],
    ]
  ),
  h3('Data loss risks'),
  bullet('Unsynced local edits before crash (Medium) — queue retries max 8'),
  bullet('Media not in DB backup (Medium) — verify S3 bucket versioning'),
  bullet('Registry edit during outage (Low) — writes blocked safely'),
  bullet('Backup encryption key on same PC (Medium) — off-site key separation documented'),

  pageBreak(),
  h1('PART 5 — Multi-User Safety'),
  table(
    ['Control', 'Status', 'Notes'],
    [
      ['Concurrent editing', 'PARTIAL', 'Record locks on visits/KP (5 min TTL)'],
      ['Record locking', 'PARTIAL', 'Force-lock available to any writer (not admin-only)'],
      ['Conflict handling', 'PARTIAL', 'Server wins for sync queue; registry varies'],
      ['Offline synchronization', 'PASS', 'Queue drain on reconnect'],
      ['Audit logs', 'PASS', 'Append-only; auth + mutations'],
      ['User permissions', 'PASS', 'RBAC enforced server-side'],
      ['Role restrictions', 'PASS', 'Receptionist blocked from admin/research export (CI)'],
    ]
  ),
  p('Gap: Registry modules (KC, keratitis, dry eye, eye bank) lack record locks.'),

  pageBreak(),
  h1('PART 6 — Security Review'),
  table(
    ['Control', 'Status', 'Live verification'],
    [
      ['Authentication', 'PASS', 'JWT 15m + httpOnly refresh; lockout'],
      ['Authorization', 'PASS', 'requirePermission on routes'],
      ['Password policies', 'PASS', '12+ chars, complexity; bcrypt'],
      ['Session handling', 'PASS', 'Rotation + family revocation'],
      ['Audit trail', 'PASS', 'Immutable audit_logs'],
      ['Encryption in transit', 'PASS', 'HTTPS, TLS DB, SMTP TLS'],
      ['Cloud security', 'PARTIAL', 'Clinic WAF signed off; API on DO without custom zone WAF'],
      ['API security', 'PASS', 'Helmet, CORS allowlist, rate limits'],
      ['File upload safety', 'PARTIAL', 'MIME allowlist; no virus scan hook active'],
      ['Rate limiting', 'PARTIAL', 'Redis when configured; in-memory fallback'],
    ]
  ),
  boldP('Security Readiness Score: ', '74 / 100'),
  h3('Vulnerabilities affecting full production clearance'),
  bullet('Formal pen-test not executed — governance blocker'),
  bullet('Unencrypted IndexedDB — conditional (device policy)'),
  bullet('API hostname without custom WAF — conditional'),
  bullet('No upload virus scanning — conditional (institutional policy)'),

  pageBreak(),
  h1('PART 7 — Performance'),
  table(
    ['Test area', 'Assessment', 'Notes'],
    [
      ['Large patient volume', 'PARTIAL', 'Pagination exists; no 10k+ load test documented'],
      ['Large image uploads', 'PASS', '25 MB / 100 MB video limits; S3 streaming'],
      ['Long clinic sessions', 'PARTIAL', '15m token refresh; session renewal works'],
      ['Offline mode', 'PASS', 'Core visits queue locally'],
      ['Synchronization', 'PASS', 'Batch 25, background drain'],
      ['Recovery after connection loss', 'PASS', 'online event re-drains queue'],
      ['Recovery after browser restart', 'PARTIAL', 'Token in localStorage; refresh cookie httpOnly'],
      ['Registry offline block', 'PASS', 'Explicit banner; no silent data loss'],
    ]
  ),
  p('Not load-tested in this audit — recommend pilot monitoring.'),

  pageBreak(),
  h1('PART 8 — Failure Scenarios'),
  table(
    ['Failure', 'Care continues?', 'Safe?'],
    [
      ['Internet disconnects', 'Yes — offline visits/KP', 'Yes (queued)'],
      ['Cloud API unavailable', 'Yes — Continue offline', 'Yes with local-only caveat'],
      ['Database unavailable', 'No — cloud mode blocked', 'Offline fallback if previously enabled'],
      ['Server restarts', 'Yes — DO auto-restart', 'Minimal downtime'],
      ['Browser crashes', 'Partial — unsynced queue may persist', 'Re-open and sync'],
      ['Power failure', 'Partial — IndexedDB survives', 'Risk if sync pending'],
      ['User closes browser', 'Partial', 'Refresh token cookie may restore session'],
      ['Large sync conflict', 'Manual — user must refresh', 'Server wins; no merge UI'],
      ['Media upload fails', 'Partial — retry queue', 'Duplicate detection helps'],
    ]
  ),
  boldP('Operational Readiness Score: ', '68 / 100'),

  pageBreak(),
  h1('PART 9 — Clinical Documentation'),
  table(
    ['Requirement', 'Status'],
    [
      ['Mandatory fields (core)', 'PASS — ID, name, age, sex'],
      ['Structured documentation', 'PASS — segment builders, specialty JSON'],
      ['Clinical drawings', 'PASS'],
      ['Image storage', 'PASS — S3 production'],
      ['Investigation storage', 'PASS — DICOM ingest'],
      ['Referral letters', 'PASS — print from opinion/referral'],
      ['Prescription printing', 'PARTIAL'],
      ['Operation notes', 'PARTIAL — OR schedule; no full op-note template'],
      ['Follow-up plans', 'PASS'],
    ]
  ),

  pageBreak(),
  h1('PART 10 — Legal and Medicolegal Review'),
  table(
    ['Requirement', 'Status'],
    [
      ['Audit trail', 'PASS'],
      ['User attribution', 'PASS'],
      ['Timestamps', 'PASS'],
      ['Record locking', 'PARTIAL — visits/KP only'],
      ['Change history', 'PARTIAL — audit diff; not field-level for all entities'],
      ['Consent recording', 'PARTIAL — laser refractive consent module; not global'],
      ['Clinical accountability', 'PASS — RBAC + audit'],
      ['Data retention policy', 'FAIL — not formally documented/approved'],
    ]
  ),
  p('Medicolegal readiness: PARTIAL — requires institutional policy alignment.'),

  pageBreak(),
  h1('PART 11 — Backup and Disaster Recovery'),
  table(
    ['Item', 'Status'],
    [
      ['Automatic backups', 'PARTIAL — daily scripts + DO managed'],
      ['Restore procedures', 'PASS — documented runbooks'],
      ['Backup frequency', 'PARTIAL — daily (~24h RPO vs 5 min target)'],
      ['Media backups', 'PARTIAL — S3 separate from DB dumps'],
      ['Recovery time (RTO)', 'PARTIAL — target ≤4h documented, not proven'],
      ['Recovery point (RPO)', 'PARTIAL'],
      ['Disaster recovery plan', 'PARTIAL — BACKUP_RECOVERY.md, INCIDENT_RESPONSE.md'],
    ]
  ),
  p('Mandatory: Monthly restore drill logged; verify S3 versioning; confirm G1 PASS.'),

  pageBreak(),
  h1('PART 12 — User Acceptance'),
  table(
    ['Dimension', 'Assessment'],
    [
      ['Ease of use', 'Good — familiar tabbed EMR; large single-page app'],
      ['Workflow efficiency', 'Good — specialty modules integrated'],
      ['Documentation speed', 'Good — structured builders reduce typing'],
      ['Click count', 'Moderate — multi-tab navigation'],
      ['Navigation', 'Moderate — dense UI; training required'],
      ['Training requirements', '2–5 days recommended per role'],
      ['Common error risks', 'Duplicate save (mitigated); wrong patient; offline/registry confusion'],
    ]
  ),

  pageBreak(),
  h1('PART 13 — Production Readiness Checklist'),
  table(
    ['Item', 'Result'],
    [
      ['Patient registration', 'PASS'],
      ['Cloud synchronization', 'PASS'],
      ['Image uploads', 'PASS'],
      ['Printing', 'PARTIAL'],
      ['Authentication', 'PASS'],
      ['Role permissions', 'PASS'],
      ['Offline mode', 'PARTIAL'],
      ['Media storage (S3)', 'PASS'],
      ['Backups', 'PARTIAL'],
      ['Audit logs', 'PASS'],
      ['Research / analytics', 'PASS'],
      ['Clinical media / teaching', 'PASS'],
      ['Appointments / recall', 'PASS'],
      ['Record locking', 'PARTIAL'],
      ['Duplicate patient prevention', 'PARTIAL'],
      ['Pen-test', 'FAIL (postponed)'],
      ['Stabilization gates G1–G7', 'PARTIAL'],
      ['SSO / LDAP', 'PASS (disabled by default)'],
      ['Mobile visit summary', 'PASS'],
      ['FHIR export', 'PASS'],
      ['DICOM ingest', 'PASS'],
      ['Ectasia AI CDS', 'PARTIAL'],
      ['Consent management', 'PARTIAL'],
      ['Data retention policy', 'FAIL'],
      ['IndexedDB encryption', 'FAIL'],
      ['Virus scan on uploads', 'FAIL'],
      ['Production operator smoke (8 items)', 'PARTIAL'],
    ]
  ),

  pageBreak(),
  h1('PART 14 — Go-Live Risks (Ranked)'),
  table(
    ['#', 'Risk', 'Rank', 'Clinical impact', 'Likelihood', 'Est. time'],
    [
      ['1', 'Unencrypted offline PHI', 'Critical', 'Breach on lost device', 'Medium', '4–8 weeks'],
      ['2', 'Formal pen-test not done', 'Critical', 'Unknown exploit', 'Low–Medium', '4–6 weeks'],
      ['3', 'Duplicate patient at registration', 'High', 'Wrong chart', 'Medium', '1–2 weeks'],
      ['4', 'Registry concurrent edit', 'High', 'Lost assessment data', 'Medium', '2–3 weeks'],
      ['5', 'Backup RPO not proven', 'High', 'Data loss in disaster', 'Low', '1 week (ops)'],
      ['6', 'Media not in DB backup', 'High', 'Lost imaging', 'Low', '1 week'],
      ['7', 'Force-lock without admin gate', 'Medium', 'Unauthorized override', 'Low', '2 days'],
      ['8', 'No virus scan on uploads', 'Medium', 'Malware in media store', 'Low', '1 week'],
      ['9', 'API without custom WAF', 'Medium', 'DDoS/abuse', 'Low', '1–2 weeks'],
      ['10', 'Dry eye case update missing', 'Medium', 'Data correction friction', 'Medium', '1 week'],
      ['11', 'No data retention policy', 'Medium', 'Legal exposure', 'Medium', '2–4 weeks'],
      ['12', 'Ectasia AI without sign-off', 'Medium', 'Over-reliance on CDS', 'Low', '1 week'],
      ['13', 'Training gaps', 'Low', 'Slow adoption', 'High', 'Ongoing'],
    ]
  ),

  pageBreak(),
  h1('PART 15 — Recommended Go-Live Strategy'),
  h2('Recommendation: Pilot deployment — single cornea department, 2–3 consultants, 90 days'),
  h3('Why not whole hospital or national?'),
  bullet('Tertiary cornea-specific design; not full hospital EMR'),
  bullet('Stabilization gates and pen-test incomplete'),
  bullet('Registry offline policy requires trained users'),
  bullet('Pilot allows monitored rollout with weekly governance review'),
  h3('Pilot scope'),
  bullet('Cloud-primary workflow (not offline-first as default)'),
  bullet('One clinic site — corneaclinic.visionemr.net production stack'),
  bullet('Named super-users + record-lock training'),
  bullet('Exclude research export and admin until role review complete'),
  bullet('Parallel paper for critical prescriptions until printing validated'),

  pageBreak(),
  h1('PART 16 — First 90 Days Monitoring Plan'),
  h2('Weekly metrics'),
  table(
    ['Metric', 'Target', 'Owner'],
    [
      ['System uptime', '≥99.5%', 'IT'],
      ['API /health/ready', '100% green', 'Ops'],
      ['Critical bugs', '0 open >48h', 'Dev'],
      ['Sync failures', '<2/week', 'Clinical informatics'],
      ['Backup success', '7/7 daily logs', 'Ops'],
      ['Restore drill', '1/month PASS', 'Ops'],
      ['Patient safety incidents', '0 EMR-related', 'Risk manager'],
    ]
  ),
  h2('Weekly review checklist'),
  bullet('Production health check (npm run health:production)'),
  bullet('Backup log <48h old'),
  bullet('No unresolved sync conflicts >24h'),
  bullet('Audit log sample review (10 random mutations)'),
  bullet('User-reported issues triaged'),
  bullet('Gate status updated in stabilization log'),
  bullet('Pen-test / remediation tracker review'),
  h2('Day 30 / 60 / 90 gates'),
  table(
    ['Milestone', 'Exit criteria'],
    [
      ['Day 30', 'Operator smoke 8/8 PASS; zero critical bugs'],
      ['Day 60', 'Monthly restore drill PASS; role review complete'],
      ['Day 90', 'Pen-test scheduled or Wave 3 complete; pilot sign-off for expansion'],
    ]
  ),

  pageBreak(),
  h1('PART 17 — Final Verdict'),
  h2('Decision: CONDITIONAL GO'),
  table(
    ['Dimension', 'Score'],
    [
      ['Overall readiness', '76%'],
      ['Patient safety', '72%'],
      ['Clinical readiness', '82%'],
      ['Technical readiness', '74%'],
      ['Operational readiness', '68%'],
      ['Security readiness', '74%'],
      ['Research readiness', '65%'],
    ]
  ),
  h3('Mandatory requirements before unrestricted real-patient deployment'),
  bullet('Complete stabilization gates G1–G7 to PASS'),
  bullet('Execute formal penetration test or documented ASVS Level 2 equivalent'),
  bullet('Institutional clinical governance sign-off (CMIO + Medical Director)'),
  bullet('Duplicate patient prevention at registration (MRN check before save)'),
  bullet('Data retention and consent policies approved by Clinical Governance Committee'),
  bullet('Monthly restore drill logged with row-count verification'),
  bullet('S3/media backup strategy documented and tested'),
  bullet('Device policy for clinic workstations OR IndexedDB encryption roadmap committed'),
  bullet('Production operator smoke checklist — all 8 items signed off'),
  bullet('Pilot 90-day review with zero unresolved critical safety issues'),
  h3('Family member records question'),
  p('Would you allow your own family member\'s medical records to be managed in this EMR today?'),
  p('Answer: Yes — but only in cloud mode, at this institute, with trained clinicians, during a supervised pilot.'),
  p('Justification: Production-grade architecture for cornea care with live API, S3 media, authentication, audit trails, and comprehensive subspecialty modules. Not acceptable for offline-only use on shared devices (unencrypted IndexedDB). Not acceptable for hospital-wide rollout until pen-test and backup drills complete. Acceptable for cornea care at Cornea Clinic with cloud sign-in and institutional oversight during the 90-day pilot.'),
  h3('Board recommendation'),
  p('Approve a 90-day cornea department pilot (CONDITIONAL GO) with mandatory requirements tracked weekly by Clinical Governance. Defer hospital-wide and national deployment until overall readiness reaches ≥85% and all Critical/High risks are mitigated or formally accepted with signed risk registers.'),
  p('This report is based on repository state at commit 054b40e, live production checks on 4 July 2026, and documented audit scores. It does not replace institutional clinical governance approval or regulatory certification.'),
];

const doc = new Document({
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buffer);
console.log('Written:', OUT);

/**
 * Generates Cornea Clinic Project Status Report as Word document.
 * Run: node scripts/generate-audit-docx.mjs
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
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'Cornea_Clinic_Project_Status_Report.docx');

const STATUS = {
  complete: '✅ Complete',
  partial: '🟡 Partial',
  missing: '❌ Missing',
  broken: '❌ Broken',
};

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60 } });
}

function tableRow(cells, header = false) {
  return new TableRow({
    children: cells.map((text) =>
      new TableCell({
        width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
        shading: header ? { fill: 'E8F1FB', type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: header })] })],
      })
    ),
  });
}

function featureTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableRow(['Feature', 'Status', 'Notes'], true),
      ...rows.map((r) => tableRow(r)),
    ],
  });
}

const doc = new Document({
  creator: 'Cornea Clinic Audit',
  title: 'Cornea Clinic EMR — Project Status Report',
  description: 'Complete project audit report',
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'Cornea Clinic EMR', bold: true, size: 36 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: 'Project Status Report', bold: true, size: 28 }),
          ],
        }),
        para('Audit date: 29 May 2026'),
        para('Scope: cornea-emr/ (backend) + Cornea Clinic file/ (frontend)'),
        para('Method: Read-only repository analysis — no code modified'),

        heading('Executive Summary'),
        para('The project is a local-first ophthalmology EMR with an emerging PostgreSQL-backed cloud layer. The frontend (Cornea.html, ~8,400 lines) is mature for offline clinical use. The backend (apps/api v0.2.0) provides auth, clinical CRUD, sync, migration, keratoplasty registry, and local media storage.'),
        para('Overall maturity: Strong for single-clinic offline use; partial for multi-user cloud sync and production deployment.'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow(['Layer', 'Status'], true),
            tableRow(['Frontend (local EMR)', STATUS.complete]),
            tableRow(['Backend API foundation', STATUS.complete]),
            tableRow(['Frontend ↔ Backend integration', STATUS.partial]),
            tableRow(['Production deployment', STATUS.partial]),
            tableRow(['Architecture spec (PRODUCTION_ARCHITECTURE.md)', STATUS.missing]),
          ],
        }),

        heading('1. Features Fully Implemented'),
        heading('Frontend (Cornea Clinic file/)', HeadingLevel.HEADING_2),
        featureTable([
          ['Patient visit form (all clinical sections)', STATUS.complete, 'Demographics, history, refraction, vitals, anterior segment, fundus, diagnosis, medical advice, follow-up'],
          ['IndexedDB offline storage', STATUS.complete, 'CorneaClinicDB v4 — patients, kpPatients, kpTissues'],
          ['Dashboard & patient records list', STATUS.complete, 'Stats, search, view/edit/delete'],
          ['Read-only EMR view + visit history sidebar', STATUS.complete, 'renderPatientReadOnly, refreshPatientVisitHistory'],
          ['Anterior segment drawing studio', STATUS.complete, 'SVG editor, embedded sketch, JSON + PNG save'],
          ['Keratoplasty patient register', STATUS.complete, 'CRUD, filters, CSV export'],
          ['Corneal tissue inventory', STATUS.complete, 'CRUD, grading, expiry highlighting, CSV export'],
          ['Tissue matching engine (client-side)', STATUS.complete, 'Protocol scoring, checklist, reserve → Matched'],
          ['ICD-11 diagnosis autocomplete (via local proxy)', STATUS.complete, 'clinic-server.js :8080, WHO MMS releases'],
          ['Lid condition autocomplete', STATUS.complete, 'Built-in clinical list'],
          ['Full IndexedDB export (checksum bundle)', STATUS.complete, 'cornea-migration-tool.js → exportDatabase()'],
          ['Migration wizard UI', STATUS.complete, 'migrate.html — analyze/import to PostgreSQL'],
          ['Medical advice table + follow-up', STATUS.complete, 'Included in form and read-only view'],
          ['Visit media attachments (local)', STATUS.complete, 'cornea-visit-media.js — slit lamp, topography, OCT, PDF'],
        ]),

        heading('Backend (cornea-emr/apps/api/)', HeadingLevel.HEADING_2),
        featureTable([
          ['Express app shell + middleware', STATUS.complete, 'helmet, CORS, pino, request ID, error handling'],
          ['Health checks (live + ready)', STATUS.complete, 'routes/health.js'],
          ['JWT auth (login, refresh, logout, me)', STATUS.complete, 'authService.js, routes/auth.js'],
          ['Refresh token rotation (DB-backed)', STATUS.complete, '007_auth_sessions.sql, session families'],
          ['RBAC (6 roles, permission middleware)', STATUS.complete, 'core/permissions.js, authorize.js'],
          ['Patients CRUD', STATUS.complete, 'routes/patients.js, patientService.js'],
          ['Visits CRUD + finalize/cancel', STATUS.complete, 'routes/visits.js, visitService.js'],
          ['Prescriptions (per-visit + bulk)', STATUS.complete, 'routes/prescriptions.js'],
          ['Follow-ups', STATUS.complete, 'routes/followups.js'],
          ['Anterior drawing metadata API', STATUS.complete, 'routes/drawing.js, drawingService.js'],
          ['Keratoplasty patients CRUD + overview', STATUS.complete, 'routes/keratoplasty-patients.js'],
          ['Corneal tissues CRUD + reserve/release', STATUS.complete, 'routes/corneal-tissues.js'],
          ['Media upload/download (local disk)', STATUS.complete, 'fileStorageService.js, 009_media_assets.sql'],
          ['Entity-scoped media (visits, KP, tissues)', STATUS.complete, 'routes/entityMedia.js'],
          ['Sync push (visits, KP patients/tissues, reserve)', STATUS.complete, 'routes/sync.js, syncService.js'],
          ['Sync pull (cursor-based delta)', STATUS.complete, '008_sync_infrastructure.sql'],
          ['Sync conflict registry', STATUS.complete, 'sync_conflicts table'],
          ['Audit log writes', STATUS.complete, '006_audit_logs.sql'],
          ['IndexedDB → PostgreSQL migration', STATUS.complete, 'migrationService.js, CLI, admin API'],
          ['DB migrations (000–009)', STATUS.complete, 'Foundation through media assets'],
          ['Seed (clinic + admin)', STATUS.complete, 'seed-cli.js'],
          ['Docker image (API)', STATUS.complete, 'apps/api/Dockerfile — Node 22 Alpine, non-root'],
        ]),

        heading('2. Features Partially Implemented'),
        heading('Frontend', HeadingLevel.HEADING_2),
        featureTable([
          ['Cloud sync integration', STATUS.partial, 'Hardcoded credentials; silent fallback to local'],
          ['Cloud login / settings UI', STATUS.partial, 'No login screen in Cornea.html; migrate.html has admin login only'],
          ['Visit media cloud upload', STATUS.partial, 'Needs visit uuid + API token; base64 in IndexedDB until synced'],
          ['Database tab import', STATUS.partial, 'Accepts flat visit array only; rejects migration bundle format'],
          ['Database tab export', STATUS.partial, 'Full bundle via CorneaMigration; fallback to visits-only'],
          ['Clear all data', STATUS.partial, 'Clears patients only; KP + sync stores remain'],
          ['Print / clinical summary', STATUS.partial, 'Omits anterior drawing and visit media'],
          ['Sync conflict resolution UI', STATUS.partial, 'Badge shows conflicts; no resolver UI'],
          ['Sync deletion handling', STATUS.partial, 'applyDeletion() handles visits only, not KP entities'],
          ['ICD integration', STATUS.partial, 'Works via clinic-server.js; fails on file://; credentials in localStorage'],
          ['Cloud boot configuration', STATUS.partial, 'Hardcoded admin@corneaclinic.local / admin123 in Cornea.html'],
        ]),

        heading('Backend', HeadingLevel.HEADING_2),
        featureTable([
          ['Offline sync (pull scope)', STATUS.partial, 'Pull covers visits, KP — not patients, prescriptions, followups, drawings, media'],
          ['Conflict resolution API', STATUS.partial, 'resolve-conflict marks status only; does not merge payloads'],
          ['Sync pull data mapping', STATUS.partial, 'Bug: visitToLegacyRecord(row, row) — patient fields incorrect on pull'],
          ['Password reset', STATUS.partial, 'Token generated; logged in dev; no email delivery'],
          ['Migration import', STATUS.partial, 'Visits + KP data; embedded images/drawings not migrated to media_assets'],
          ['Media storage', STATUS.partial, 'Local filesystem only; no S3/object storage'],
          ['Drawing storage', STATUS.partial, 'API supports media-linked drawings; sync does not propagate media'],
          ['Docker deployment', STATUS.partial, 'Missing JWT_SECRET, media volume, auto-migrate on start'],
          ['Environment configuration', STATUS.partial, '.env.example documented; production secrets/TLS not guided'],
          ['Verification tooling', STATUS.partial, 'api:verify references missing verify script; verify-api.js targets legacy API'],
          ['Legacy code coexistence', STATUS.partial, 'legacy/ modules exist but not mounted; schema incompatible with v1'],
        ]),

        heading('Cross-cutting', HeadingLevel.HEADING_2),
        featureTable([
          ['Frontend ↔ Backend adapter', STATUS.partial, 'Active adapter uses accessToken + sync; legacy duplicate outdated'],
          ['Dual database strategy', STATUS.partial, 'cornea_emr (legacy) vs cornea_emr_v1 (v1) — manual separation required'],
        ]),

        heading('3. Features Planned but Not Implemented'),
        para('From docs/PRODUCTION_ARCHITECTURE.md and permission definitions:'),
        featureTable([
          ['Modular PWA (replace monolithic HTML)', STATUS.missing, 'Spec only'],
          ['Service worker / offline caching', STATUS.missing, 'Spec only'],
          ['Multi-clinic / organization selector', STATUS.missing, 'Single clinic in seed'],
          ['User management API (USERS_MANAGE)', STATUS.missing, 'Permission defined, no routes'],
          ['Clinic settings API (CLINIC_SETTINGS)', STATUS.missing, 'Permission defined, no routes'],
          ['Export management API (EXPORT_MANAGE)', STATUS.missing, 'Permission defined, no routes'],
          ['ICD-11 server proxy (v1 API)', STATUS.missing, 'Legacy icd.js not mounted; no icd_credentials in v1 schema'],
          ['ICD credentials server-side', STATUS.missing, 'Frontend stores WHO keys in localStorage'],
          ['Backend tissue matching engine', STATUS.missing, 'Matching is client-only in Cornea.html'],
          ['Tissue expiry automation (cron/job)', STATUS.missing, 'Manual status only'],
          ['Tissue delete endpoint', STATUS.missing, 'Create/update/reserve/release only'],
          ['Audit log read API', STATUS.missing, 'Writes only; sync logs require AUDIT_READ'],
          ['Redis caching', STATUS.missing, 'Spec optional component'],
          ['CDN for static assets', STATUS.missing, 'Spec only'],
          ['Load balancer / TLS termination', STATUS.missing, 'No reverse proxy config'],
          ['Email delivery (password reset)', STATUS.missing, 'Dev log only'],
          ['MFA / account lockout', STATUS.missing, '—'],
          ['Login rate limiting', STATUS.missing, '—'],
          ['Automated test suite', STATUS.missing, 'No project tests under apps/api/src'],
          ['CI/CD pipeline', STATUS.missing, '—'],
          ['Conflict merge UI', STATUS.missing, 'Architecture requires user notification'],
          ['Images out of JSONB (full migration)', STATUS.missing, 'Drawings/media still inline in visit payload locally'],
          ['Embedded DB script (db:embedded)', STATUS.missing, 'Referenced in root package.json, not in apps/api'],
        ]),

        heading('4. Broken or Incomplete Workflows'),
        featureTable([
          ['Database tab import of migration bundle', STATUS.broken, 'importDatabase() requires Array; bundle is object'],
          ['Sync pull → visit patient fields', STATUS.broken, 'visitToLegacyRecord(row, row) passes visit row as patient'],
          ['npm run api:verify', STATUS.broken, 'verify script missing from apps/api/package.json'],
          ['scripts/verify-api.js against v1 API', STATUS.broken, 'Targets legacy /encounters, expects data.token'],
          ['cornea-emr/legacy/cornea-api-adapter.js', STATUS.broken, 'Outdated duplicate; not used by active frontend'],
          ['Docker docker compose up (full stack)', STATUS.partial, 'No migrate/seed on start; JWT_SECRET not set; empty DB'],
          ['Password reset (production)', STATUS.partial, 'Token never emailed'],
          ['Conflict resolution end-to-end', STATUS.partial, 'Server marks resolved; client has no merge/re-push UI'],
          ['Cloud sync when API unavailable', STATUS.partial, 'Silent local fallback — queue never drains'],
          ['ICD via file://', STATUS.broken, 'Requires clinic-server.js at http://127.0.0.1:8080'],
          ['Clear all data', STATUS.partial, 'KP and sync data survive'],
          ['Print report with drawings/media', STATUS.partial, 'generateSummary() excludes these sections'],
          ['Legacy + v1 schema on same database', STATUS.broken, 'Migration 002 blocks if legacy tables exist'],
        ]),

        heading('5. Technical Debt'),
        featureTable([
          ['Monolithic 8,400-line HTML file', 'High', 'Cornea.html'],
          ['Monkey-patched global functions for cloud mode', 'High', 'cornea-api-adapter.js'],
          ['Duplicate outdated API adapter', 'Medium', 'cornea-emr/legacy/cornea-api-adapter.js'],
          ['Legacy API modules unmounted but present', 'Medium', 'apps/api/src/legacy/'],
          ['Full visit documents in JSONB (visits.payload)', 'Medium', '003_patients_visits.sql'],
          ['Base64 images/drawings in IndexedDB records', 'Medium', 'anteriorDrawingImage, visitMediaJSON'],
          ['Timestamp-based sync cursors', 'Medium', 'syncService.js — reorder risk under concurrency'],
          ['Unbounded growth tables', 'Medium', 'client_mutations, sync_logs, audit_logs'],
          ['No automated tests', 'High', 'Entire backend'],
          ['Documentation lag (migration docs say 008; 009 exists)', 'Low', 'docs/MIGRATION_TOOL.md'],
          ['Two frontend deployment paths (file:// vs :8080)', 'Medium', 'clinic-server.js vs direct open'],
          ['Hardcoded cloud credentials in boot script', 'High', 'Cornea.html DOMContentLoaded'],
          ['start-clinic.bat assumes sibling cornea-emr path', 'Low', 'Relative path dependency'],
        ]),

        heading('6. Security Concerns'),
        featureTable([
          ['Default credentials in source', 'Critical', 'admin@corneaclinic.local / admin123 hardcoded in Cornea.html'],
          ['Default JWT secret in .env.example', 'Critical', 'change-me-in-production-use-long-random-string'],
          ['Default seed password', 'High', 'SEED_ADMIN_PASSWORD=admin123'],
          ['WHO ICD credentials in browser localStorage', 'High', 'Client-side secret storage'],
          ['CORS_ORIGIN=* with credentials', 'High', 'docker-compose.yml, .env.example'],
          ['Refresh token in JSON response body', 'Medium', 'XSS could steal token alongside HttpOnly cookie'],
          ['Access tokens not invalidated on logout', 'Medium', 'Valid until expiry (~15 min) after logout'],
          ['No login rate limiting', 'Medium', 'Brute-force on /api/v1/auth/login'],
          ['No MFA', 'Medium', '—'],
          ['Postgres exposed on 5432 with default password', 'High', 'docker-compose.yml — cornea_dev'],
          ['Password reset token logged to console (dev)', 'Low', 'authService.js'],
          ['ICD proxy CORS *', 'Low', 'clinic-server.js'],
          ['Local media served through authenticated API only', 'Low (Positive)', 'No public URLs'],
          ['Path traversal protection in file storage', 'Low (Positive)', 'fileStorageService.js'],
          ['Audit immutability trigger', 'Low (Positive)', '001_clinical_functions.sql'],
          ['Clinic suspension check on auth', 'Low (Positive)', 'authenticate.js'],
        ]),

        heading('7. Scalability Concerns'),
        featureTable([
          ['Local filesystem media storage', 'High', 'Cannot scale horizontally; no shared volume in Docker'],
          ['Single Postgres instance', 'Medium', 'No read replicas, partitioning, or connection pooling proxy'],
          ['JSONB visit payloads', 'Medium', 'Large rows; search indexed but storage grows quickly'],
          ['IndexedDB quota (client)', 'Medium', 'PNG + base64 media on visit records'],
          ['Sync push one-by-one (not batched transaction)', 'Medium', 'Max 100 mutations per request'],
          ['No background job infrastructure', 'Medium', 'Expiry, email, cleanup require external cron'],
          ['No caching layer', 'Low', 'Every request hits Postgres'],
          ['No metrics/tracing', 'Low', 'Pino logs only'],
          ['Monolithic frontend delivery', 'Low', 'Full HTML reload; no code splitting'],
          ['client_mutations / sync_logs unbounded', 'Medium', 'No retention/archival policy'],
        ]),

        heading('8. Deployment Readiness Assessment'),
        heading('Local development — ✅ Ready (with manual steps)', HeadingLevel.HEADING_2),
        bullet('Start PostgreSQL: docker compose up postgres or local install'),
        bullet('Run migrations + seed: npm run migrate + npm run seed'),
        bullet('Start API (:3000): npm run dev'),
        bullet('Start clinic server (:8080): node clinic-server.js or start-clinic.bat'),
        bullet('Open app: http://127.0.0.1:8080/Cornea.html'),

        heading('Docker full stack — 🟡 Partial', HeadingLevel.HEADING_2),
        featureTable([
          ['Postgres container', STATUS.complete, 'With persistent volume'],
          ['API container', STATUS.complete, 'Builds and healthchecks'],
          ['Auto-migrate on container start', STATUS.missing, '—'],
          ['JWT_SECRET in compose', STATUS.missing, 'Fails in NODE_ENV=production'],
          ['Media storage volume', STATUS.missing, '—'],
          ['API + Postgres only (no frontend container)', STATUS.partial, 'Frontend served separately'],
        ]),

        heading('Production — ❌ Not ready', HeadingLevel.HEADING_2),
        featureTable([
          ['Strong secrets management', STATUS.missing, '—'],
          ['TLS / reverse proxy', STATUS.missing, '—'],
          ['Object storage (S3/GCS)', STATUS.missing, '—'],
          ['Email service', STATUS.missing, '—'],
          ['Monitoring / alerting', STATUS.missing, '—'],
          ['Automated backups', STATUS.missing, '—'],
          ['Test coverage', STATUS.missing, '—'],
          ['Rate limiting / WAF', STATUS.missing, '—'],
          ['Multi-instance deployment guide', STATUS.missing, '—'],
          ['ICD proxy on backend (secrets server-side)', STATUS.missing, '—'],
          ['User onboarding / admin UI', STATUS.missing, '—'],
        ]),
        para('Deployment readiness score: 4/10 — Suitable for pilot/local clinic use; not for internet-facing production without significant hardening.'),

        heading('9. Module-by-Module Classification'),
        heading('Frontend', HeadingLevel.HEADING_2),
        featureTable([
          ['Patient EMR form', STATUS.complete, '—'],
          ['Dashboard & records', STATUS.complete, '—'],
          ['Anterior drawing studio', STATUS.complete, '—'],
          ['Visit media (local)', STATUS.complete, '—'],
          ['Visit media (cloud)', STATUS.partial, '—'],
          ['Keratoplasty module', STATUS.complete, '—'],
          ['Corneal tissue registry', STATUS.complete, '—'],
          ['Tissue matching (client)', STATUS.complete, '—'],
          ['ICD integration', STATUS.partial, '—'],
          ['IndexedDB offline', STATUS.complete, '—'],
          ['Cloud sync client', STATUS.partial, '—'],
          ['API adapter', STATUS.partial, '—'],
          ['Migration tool (export)', STATUS.complete, '—'],
          ['Migration tool (import via migrate.html)', STATUS.complete, '—'],
          ['Database tab import/export', STATUS.partial, '—'],
          ['Auth / login UI', STATUS.missing, '—'],
          ['Print / summary', STATUS.partial, '—'],
          ['clinic-server.js', STATUS.complete, '—'],
        ]),

        heading('Backend', HeadingLevel.HEADING_2),
        featureTable([
          ['Authentication', STATUS.complete, '—'],
          ['Authorization (RBAC)', STATUS.complete, '—'],
          ['Patients API', STATUS.complete, '—'],
          ['Visits API', STATUS.complete, '—'],
          ['Prescriptions API', STATUS.complete, '—'],
          ['Follow-ups API', STATUS.complete, '—'],
          ['Drawing API', STATUS.complete, '—'],
          ['Media storage API', STATUS.complete, '—'],
          ['Keratoplasty API', STATUS.complete, '—'],
          ['Corneal tissue API', STATUS.partial, 'No delete'],
          ['Sync (push/pull)', STATUS.partial, '—'],
          ['Migration / import API', STATUS.partial, '—'],
          ['ICD API (v1)', STATUS.missing, '—'],
          ['User management API', STATUS.missing, '—'],
          ['Audit read API', STATUS.missing, '—'],
          ['Tissue matching API', STATUS.missing, '—'],
          ['Database migrations', STATUS.complete, '—'],
          ['Legacy API (legacy/)', STATUS.missing, 'Unmounted'],
        ]),

        heading('Infrastructure', HeadingLevel.HEADING_2),
        featureTable([
          ['docker-compose.yml', STATUS.partial, '—'],
          ['Dockerfile', STATUS.complete, '—'],
          ['.env.example', STATUS.complete, '—'],
          ['start-clinic.bat', STATUS.partial, '—'],
          ['PRODUCTION_ARCHITECTURE.md', STATUS.missing, 'Spec only, not built'],
          ['MIGRATION_TOOL.md', STATUS.partial, '—'],
          ['SYNC_ARCHITECTURE.md', STATUS.partial, '—'],
          ['CI/CD', STATUS.missing, '—'],
          ['Automated tests', STATUS.missing, '—'],
        ]),

        heading('10. Priority Recommendations'),
        bullet('1. Fix sync pull mapper bug (visitToLegacyRecord(row, row)).'),
        bullet('2. Add login/settings UI; remove hardcoded credentials.'),
        bullet('3. Align Database tab import with migration bundle format.'),
        bullet('4. Port ICD proxy to v1 API with server-side credential storage.'),
        bullet('5. Harden Docker compose (secrets, media volume, migrate entrypoint).'),
        bullet('6. Implement conflict resolution UI and payload merge.'),
        bullet('7. Extend sync pull to media/drawings or document intentional scope.'),
        bullet('8. Add automated tests and fix api:verify tooling.'),
        bullet('9. Migrate inline images to media_assets during import/sync.'),
        bullet('10. Remove or update cornea-emr/legacy/cornea-api-adapter.js duplicate.'),

        new Paragraph({
          spacing: { before: 400 },
          children: [new TextRun({ text: 'End of audit report. No code was modified during this analysis.', italics: true })],
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Saved:', OUT);

#!/usr/bin/env node
/**
 * Generate OWASP Top 10 (2021) control mapping for Cornea EMR.
 * Usage: node scripts/generate-owasp-top10-report.mjs [--json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'security-reports');

const jsonOut = process.argv.includes('--json');

const controls = [
  {
    id: 'A01',
    name: 'Broken Access Control',
    status: 'mitigated',
    evidence: [
      'RBAC via requirePermission middleware',
      'Clinic-scoped queries (tenant isolation)',
      'tests/security-pentest.test.js tenant tests'
    ],
    gaps: ['Formal vendor pen-test on sync/push paths pending']
  },
  {
    id: 'A02',
    name: 'Cryptographic Failures',
    status: 'mitigated',
    evidence: [
      'HTTPS/TLS on clinic + API (Cloudflare)',
      'bcrypt password hashing',
      'JWT_SECRET strength validation in production',
      'SECRETS_ENCRYPTION_KEY for sensitive fields'
    ],
    gaps: ['Rotate secrets on schedule (ops)']
  },
  {
    id: 'A03',
    name: 'Injection',
    status: 'mitigated',
    evidence: [
      'Parameterized PostgreSQL queries',
      'Input validation via ValidationError helpers',
      'Helmet CSP on API'
    ],
    gaps: []
  },
  {
    id: 'A04',
    name: 'Insecure Design',
    status: 'partial',
    evidence: [
      'Offline-first sync with conflict resolution',
      'Record lock service (P4)',
      'Rate limits on auth + API'
    ],
    gaps: ['Staging mirror for safe pre-release testing']
  },
  {
    id: 'A05',
    name: 'Security Misconfiguration',
    status: 'partial',
    evidence: [
      'Production CORS allowlist enforced at startup',
      'env.js production guards',
      'npm run pentest:self-check'
    ],
    gaps: ['Quarterly role review (ops)', 'MEDIA_VIRUS_SCAN_HOOK_URL optional until scanner deployed']
  },
  {
    id: 'A06',
    name: 'Vulnerable and Outdated Components',
    status: 'partial',
    evidence: ['npm audit in CI', 'Dependabot recommended'],
    gaps: ['Track CVE response SLA']
  },
  {
    id: 'A07',
    name: 'Identification and Authentication Failures',
    status: 'mitigated',
    evidence: [
      'Session families + refresh rotation',
      'Login rate limits (IP + email)',
      'Password policy validation',
      'GET /api/v1/admin/security/status session counts'
    ],
    gaps: ['Optional jti binding on logout (Wave 3)']
  },
  {
    id: 'A08',
    name: 'Software and Data Integrity Failures',
    status: 'partial',
    evidence: [
      'SHA-256 checksum dedup on media uploads',
      'MIME allowlist + size limits',
      'Virus scan hook (MEDIA_VIRUS_SCAN_HOOK_URL)'
    ],
    gaps: ['Wire external scanner in production when available']
  },
  {
    id: 'A09',
    name: 'Security Logging and Monitoring Failures',
    status: 'mitigated',
    evidence: [
      'audit_logs table + auditMutation',
      'Failed login tracking (security status API)',
      'Pino structured logging',
      'backup/DR verification (P5)'
    ],
    gaps: ['Centralized log aggregation (ops)']
  },
  {
    id: 'A10',
    name: 'Server-Side Request Forgery (SSRF)',
    status: 'mitigated',
    evidence: [
      'No user-controlled outbound fetch in API',
      'Virus scan hook URL is operator-configured only'
    ],
    gaps: []
  }
];

function summarize() {
  const counts = { mitigated: 0, partial: 0, open: 0 };
  for (const c of controls) counts[c.status] = (counts[c.status] || 0) + 1;
  return counts;
}

async function main() {
  const counts = summarize();
  const report = {
    generatedAt: new Date().toISOString(),
    framework: 'OWASP Top 10 (2021)',
    project: 'Cornea EMR — Project 6',
    summary: counts,
    overallStatus: counts.open > 0 ? 'NEEDS_WORK' : counts.partial > 0 ? 'PARTIAL' : 'PASS',
    controls,
    references: [
      'docs/PENTEST_ASVS_CHECKLIST.md',
      'docs/PENTEST_REMEDIATION.md',
      'docs/SECURITY_BASELINE.md',
      'npm run verify:security'
    ]
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(REPORT_DIR, 'owasp-top10-latest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, `owasp-top10-${stamp}.json`), JSON.stringify(report, null, 2));

  const md = [
    '# OWASP Top 10 (2021) — Cornea EMR',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `**Overall:** ${report.overallStatus} — mitigated ${counts.mitigated}, partial ${counts.partial}, open ${counts.open || 0}`,
    '',
    '| ID | Risk | Status | Key evidence |',
    '|----|------|--------|--------------|',
    ...controls.map(
      (c) =>
        `| ${c.id} | ${c.name} | ${c.status} | ${c.evidence[0] || '—'}${c.gaps.length ? `; gap: ${c.gaps[0]}` : ''} |`
    ),
    '',
    '## Operator next steps',
    '',
    '1. `npm run verify:security` — automated P6 checks',
    '2. `npm run pentest:self-check` — static remediation scan',
    '3. `npm run security:auth-sessions` — session posture (needs credentials)',
    '4. Reactivate vendor per `docs/PENTEST_ENGAGEMENT.md` when ready',
    ''
  ].join('\n');

  fs.writeFileSync(path.join(REPORT_DIR, 'owasp-top10-latest.md'), md);

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n=== OWASP Top 10 report ===\n');
    console.log(`Status: ${report.overallStatus}`);
    console.log(`Mitigated: ${counts.mitigated} | Partial: ${counts.partial} | Open: ${counts.open || 0}`);
    console.log(`\nWritten:`);
    console.log(`  docs/security-reports/owasp-top10-latest.json`);
    console.log(`  docs/security-reports/owasp-top10-latest.md\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

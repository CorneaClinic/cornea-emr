#!/usr/bin/env node
/**
 * Basic clinic accessibility checks (Project 7).
 * Usage: node scripts/production-a11y-check.mjs [--json]
 */
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkClinicA11yStatic,
  checkClinicA11yLive,
  analyzeClinicA11y,
  readRepoFile
} from './lib/production-validation-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLINIC = (process.env.CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(/\/$/, '');
const jsonOut = process.argv.includes('--json');

async function main() {
  console.log(`=== Clinic accessibility baseline ===\n`);

  const staticResult = checkClinicA11yStatic(ROOT);
  const liveResult = await checkClinicA11yLive(CLINIC);
  const html = readRepoFile(ROOT, 'apps/clinic/Cornea.html');
  const adapter = readRepoFile(ROOT, 'apps/clinic/cornea-api-adapter.js');
  const analysis = analyzeClinicA11y(html, adapter);

  const report = {
    clinic: CLINIC,
    static: staticResult,
    live: liveResult,
    findings: analysis.findings,
    ok: staticResult.ok && liveResult.ok
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Static (repo): ${staticResult.ok ? 'PASS' : 'FAIL'} — ${staticResult.reason}`);
    console.log(`Live shell:    ${liveResult.ok ? 'PASS' : 'FAIL'} — ${liveResult.reason}`);
    if (!report.ok) {
      console.log('\nIssues:');
      for (const f of analysis.findings) console.log(`  - ${f}`);
    }
    console.log('');
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

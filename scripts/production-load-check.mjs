#!/usr/bin/env node
/**
 * Light production API load baseline (Project 7).
 * Usage: node scripts/production-load-check.mjs [--json] [--requests=20]
 */
import { runLoadBaseline } from './lib/production-validation-checks.mjs';

const API = (process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const jsonOut = process.argv.includes('--json');
const reqArg = process.argv.find((a) => a.startsWith('--requests='));
const requests = reqArg ? parseInt(reqArg.split('=')[1], 10) : 20;
const p95Max = parseInt(process.env.LOAD_P95_MAX_MS || '3000', 10);

async function main() {
  console.log(`=== Production load baseline ===\nAPI: ${API}\nRequests: ${requests}\n`);

  const result = await runLoadBaseline(API, { requests, p95MaxMs: p95Max });
  const { metrics } = result;

  if (jsonOut) {
    console.log(JSON.stringify({ api: API, ...result }, null, 2));
  } else {
    console.log(`Min:  ${metrics.min}ms`);
    console.log(`Avg:  ${metrics.avg}ms`);
    console.log(`P95:  ${metrics.p95}ms`);
    console.log(`Max:  ${metrics.max}ms`);
    console.log(`Failures: ${metrics.failures}/${metrics.requests}`);
    console.log(`\nResult: ${result.ok ? 'PASS' : 'FAIL'} — ${result.reason}\n`);
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

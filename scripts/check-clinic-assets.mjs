/**
 * Fail deploy/CI if critical clinic JS assets are missing or would be served as HTML.
 * Usage: node scripts/check-clinic-assets.mjs [baseUrl]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clinicRoot = path.join(__dirname, '..', 'apps', 'clinic');

const CRITICAL = [
  'js/sidebar-nav.js',
  'js/role-dashboard.js',
  'js/ui.js',
  'js/dashboard.js',
  'js/csp-actions.js',
  'cornea-section-access.js',
  'cornea-api-adapter.js',
  'cornea-admin-users.js',
  'cornea-bootstrap.js',
  'Cornea.html'
];

let failed = false;

for (const rel of CRITICAL) {
  const full = path.join(clinicRoot, rel);
  if (!fs.existsSync(full)) {
    console.error(`[MISSING] ${rel}`);
    failed = true;
    continue;
  }
  const size = fs.statSync(full).size;
  if (size < 200) {
    console.error(`[TOO SMALL] ${rel} (${size} bytes)`);
    failed = true;
    continue;
  }
  if (rel.endsWith('.js')) {
    const head = fs.readFileSync(full, 'utf8').slice(0, 40);
    if (head.includes('<!DOCTYPE') || head.includes('<html')) {
      console.error(`[HTML STUB] ${rel}`);
      failed = true;
      continue;
    }
  }
  console.log(`[OK] ${rel} (${size} bytes)`);
}

const base = process.argv[2];
if (base) {
  for (const rel of CRITICAL.filter((r) => r.endsWith('.js'))) {
    const url = `${base.replace(/\/$/, '')}/${rel}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[REMOTE ${res.status}] ${url}`);
        failed = true;
      } else if (text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html')) {
        console.error(`[REMOTE HTML FALLBACK] ${url}`);
        failed = true;
      } else {
        console.log(`[REMOTE OK] ${rel} (${text.length} bytes)`);
      }
    } catch (err) {
      console.error(`[REMOTE ERR] ${url}: ${err.message}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('Clinic asset check failed.');
  process.exit(1);
}
console.log('Clinic asset check passed.');

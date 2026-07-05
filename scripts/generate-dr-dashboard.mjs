#!/usr/bin/env node
/**
 * Generate HTML DR dashboard from backups/dr-reports/latest.json
 * Usage: node scripts/generate-dr-dashboard.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'backups', 'dr-reports', 'latest.json');
const OUT = path.join(ROOT, 'backups', 'dr-reports', 'index.html');

if (!fs.existsSync(REPORT)) {
  console.error('No report found. Run: npm run verify:backup-dr');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(REPORT, 'utf8'));

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const rows = (data.checks || [])
  .map((c) => {
    const cls = c.ok ? 'ok' : c.skipped ? 'skip' : 'fail';
    const label = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
    return `<tr class="${cls}"><td>${esc(c.id)}</td><td>${esc(c.name)}</td><td><strong>${label}</strong></td><td>${esc(c.reason)}</td></tr>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Cornea EMR — Backup &amp; DR Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f1419; color: #e6edf3; }
    h1 { font-size: 1.4rem; }
    .status { font-size: 1.1rem; padding: 0.5rem 1rem; border-radius: 6px; display: inline-block; margin: 1rem 0; }
    .status.PASS { background: #1a3d2e; color: #3fb950; }
    .status.PARTIAL { background: #3d2e1a; color: #d29922; }
    .status.FAIL { background: #3d1a1a; color: #f85149; }
    table { border-collapse: collapse; width: 100%; max-width: 960px; }
    th, td { border: 1px solid #30363d; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #161b22; }
    tr.ok td:nth-child(3) { color: #3fb950; }
    tr.fail td:nth-child(3) { color: #f85149; }
    tr.skip td:nth-child(3) { color: #8b949e; }
    .meta { color: #8b949e; font-size: 0.9rem; }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <h1>Cornea EMR — Backup &amp; DR Dashboard</h1>
  <p class="meta">Generated ${esc(data.generatedAt)} · Project 5</p>
  <div class="status ${esc(data.status)}">Overall: ${esc(data.status)}</div>
  ${data.latestDump ? `<p class="meta">Latest dump: ${esc(data.latestDump.name)} (${data.latestDump.size} bytes)</p>` : ''}
  <table>
    <thead><tr><th>ID</th><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="meta">Refresh: <code>npm run verify:backup-dr</code> then <code>npm run dr:dashboard</code> · Docs: <a href="../../docs/BACKUP_RECOVERY.md">BACKUP_RECOVERY.md</a></p>
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${OUT}`);

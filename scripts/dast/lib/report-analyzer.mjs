/**
 * Enrich ZAP alerts with explanations and proposed fixes; write JSON + Markdown.
 */
import fs from 'node:fs';
import path from 'node:path';
import { suggestFix } from './fix-suggestions.mjs';

const RISK_ORDER = { High: 0, Medium: 1, Low: 2, Informational: 3 };

export function analyzeAlerts(alerts, meta = {}) {
  const enriched = (alerts || []).map((alert) => {
    const guidance = suggestFix(alert);
    return {
      alert: alert.alert,
      risk: alert.risk,
      confidence: alert.confidence,
      url: alert.url,
      param: alert.param,
      evidence: alert.evidence,
      cweid: alert.cweid,
      wascid: alert.wascid,
      ...guidance,
      proposedFixSafe: Boolean(guidance.proposedFix)
    };
  });

  enriched.sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9));

  const summary = {
    generatedAt: new Date().toISOString(),
    total: enriched.length,
    byRisk: enriched.reduce((acc, a) => {
      acc[a.risk] = (acc[a.risk] || 0) + 1;
      return acc;
    }, {}),
    ...meta
  };

  return { summary, alerts: enriched };
}

export function toMarkdown(report) {
  const lines = [
    '# Cornea EMR — OWASP ZAP DAST Report',
    '',
    `**Generated:** ${report.summary.generatedAt}`,
    `**Target clinic:** ${report.summary.clinicUrl || '—'}`,
    `**Target API:** ${report.summary.apiUrl || '—'}`,
    `**Role:** ${report.summary.role || 'all'}`,
    `**Scan mode:** ${report.summary.scanMode || 'passive+active'}`,
    '',
    '## Summary',
    '',
    `| Risk | Count |`,
    `|------|-------|`,
    ...Object.entries(report.summary.byRisk || {}).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Findings',
    ''
  ];

  if (!report.alerts.length) {
    lines.push('_No alerts recorded._');
    return lines.join('\n');
  }

  for (const a of report.alerts) {
    lines.push(`### ${a.risk}: ${a.alert}`);
    lines.push('');
    lines.push(`- **URL:** ${a.url || '—'}`);
    if (a.param) lines.push(`- **Parameter:** ${a.param}`);
    lines.push(`- **CWE:** ${a.cweid || a.cwe || '—'}`);
    lines.push('');
    lines.push('**Explanation:** ' + a.explanation);
    if (a.proposedFix) {
      lines.push('');
      lines.push('**Proposed fix (review before applying):**');
      lines.push(`- File: \`${a.proposedFix.file}\``);
      lines.push(`- ${a.proposedFix.summary}`);
      lines.push('```');
      lines.push(a.proposedFix.snippet);
      lines.push('```');
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function writeReports(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = report.summary.generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `dast-${stamp}.json`);
  const mdPath = path.join(outDir, 'dast-latest.md');
  const jsonLatest = path.join(outDir, 'dast-latest.json');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(jsonLatest, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, toMarkdown(report), 'utf8');

  return { jsonPath, mdPath, jsonLatest };
}

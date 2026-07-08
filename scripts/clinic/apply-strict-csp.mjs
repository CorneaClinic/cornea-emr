#!/usr/bin/env node
/**
 * One-time codemod: extract inline CSS/JS and replace onclick with data-csp-action.
 * Run: node scripts/clinic/apply-strict-csp.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLINIC = path.resolve(__dirname, '../../apps/clinic');

const COMPLEX_ONCLICK_MAP = {
  "document.getElementById('importFile').click()": {
    action: 'openImportFilePicker',
    args: []
  }
};

/** @param {string} argsStr */
function parseOnclickArgs(argsStr) {
  const trimmed = String(argsStr || '').trim();
  if (!trimmed) return [];

  /** @type {string[]} */
  const parts = [];
  let current = '';
  let quote = '';
  let depth = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (quote) {
      current += ch;
      if (ch === quote && trimmed[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '\'' || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  return parts.map((token) => {
    if (!token) return '';
    if (/^'.*'$/.test(token) || /^".*"$/.test(token)) {
      return token.slice(1, -1);
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    return { __expr: token };
  });
}

/** @param {string} onclickValue */
function onclickToDataAttrs(onclickValue) {
  const raw = String(onclickValue || '').trim();
  if (!raw) return null;
  if (COMPLEX_ONCLICK_MAP[raw]) return COMPLEX_ONCLICK_MAP[raw];

  const match = raw.match(/^([\w.]+)\(([\s\S]*)\)$/);
  if (!match) {
    if (/^[\w.]+$/.test(raw)) {
      return { action: raw, args: [] };
    }
    throw new Error(`Unsupported onclick: ${raw}`);
  }
  const action = match[1];
  const args = parseOnclickArgs(match[2]);
  return { action, args };
}

/** @param {string} html */
function stripOnclick(html) {
  return html.replace(/\s+onclick="([^"]*)"/g, (_full, onclickValue) => {
    const parsed = onclickToDataAttrs(onclickValue);
    if (!parsed) {
      throw new Error(`Unsupported onclick: ${onclickValue}`);
    }
    const argsJson = JSON.stringify(parsed.args).replace(/'/g, '&#39;');
    return ` data-csp-action="${parsed.action}" data-csp-args='${argsJson}'`;
  });
}

/** @param {string} filePath */
function extractInlineStyles(filePath) {
  const rel = path.relative(CLINIC, filePath).replace(/\\/g, '/');
  let html = fs.readFileSync(filePath, 'utf8');
  if (!html.includes('<style>')) return false;

  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const base = path.basename(filePath, '.html');
  const cssRel = base === 'Cornea'
    ? 'assets/cornea-app.css'
    : `assets/pages/${base}.css`;

  const cssPath = path.join(CLINIC, cssRel);
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  fs.writeFileSync(cssPath, styleMatch[1].trim() + '\n', 'utf8');
  html = html.replace(
    /<style>[\s\S]*?<\/style>/,
    `<link rel="stylesheet" href="${cssRel}">`
  );
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  styles → ${cssRel} (${rel})`);
  return true;
}

/** @param {string} filePath */
function extractInlineBootScript(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(CLINIC, filePath).replace(/\\/g, '/');
  const base = path.basename(filePath, '.html');

  if (base === 'Cornea') {
    const scriptMatch = html.match(/<script>\s*\n(document\.addEventListener\('DOMContentLoaded',[\s\S]*?)<\/script>\s*<\/body>/);
    if (!scriptMatch) return false;
    const jsPath = path.join(CLINIC, 'cornea-bootstrap.js');
    fs.writeFileSync(jsPath, `${scriptMatch[1].trim()}\n`, 'utf8');
    html = html.replace(
      /<script>\s*\ndocument\.addEventListener\('DOMContentLoaded',[\s\S]*?<\/script>\s*(?=<\/body>)/,
      '<script src="cornea-bootstrap.js"></script>\n'
    );
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`  boot script → cornea-bootstrap.js (${rel})`);
    return true;
  }

  if (base === 'index') {
    html = html.replace(
      /<script>location\.replace\('Cornea\.html'\);<\/script>/,
      '<script src="js/index-redirect.js"></script>'
    );
    fs.writeFileSync(path.join(CLINIC, 'js/index-redirect.js'), "location.replace('Cornea.html');\n", 'utf8');
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`  redirect script → js/index-redirect.js (${rel})`);
    return true;
  }

  const inlineMatch = html.match(/<script>\s*\n([\s\S]*?)<\/script>\s*<\/body>/);
  if (!inlineMatch || inlineMatch[1].includes('src=')) return false;
  const jsRel = `js/pages/${base}.js`;
  fs.mkdirSync(path.dirname(path.join(CLINIC, jsRel)), { recursive: true });
  fs.writeFileSync(path.join(CLINIC, jsRel), `${inlineMatch[1].trim()}\n`, 'utf8');
  html = html.replace(/<script>\s*\n[\s\S]*?<\/script>\s*(?=<\/body>)/, `<script src="${jsRel}"></script>\n`);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  inline script → ${jsRel} (${rel})`);
  return true;
}

/** @param {string} filePath */
function migrateHtmlFile(filePath) {
  const rel = path.relative(CLINIC, filePath);
  console.log(`\n${rel}`);
  extractInlineStyles(filePath);
  let html = fs.readFileSync(filePath, 'utf8');
  const onclickCount = (html.match(/onclick="/g) || []).length;
  if (onclickCount) {
    html = stripOnclick(html);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`  onclick → data-csp-action (${onclickCount})`);
  }
  extractInlineBootScript(filePath);
}

/** @param {string} filePath */
function ensureCspActionsScript(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('data-csp-action=') && !html.includes('js/csp-actions.js')) {
    html = html.replace(
      /<body([^>]*)>/i,
      (match) => `${match}\n<script src="js/csp-helpers.js"></script>\n<script src="js/csp-actions.js"></script>`
    );
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('  added csp helper scripts');
    return;
  }
  if (html.includes('js/csp-actions.js')) return;
}

function migrateInlineStyleAttributes() {
  const utilCssPath = path.join(CLINIC, 'assets/csp-inline-utilities.css');
  const htmlPath = path.join(CLINIC, 'Cornea.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
  const unique = [...new Set(styles)];

  const classMap = new Map();
  const rules = [];
  unique.forEach((styleText, index) => {
    const className = `u-csp-${index + 1}`;
    classMap.set(styleText, className);
    rules.push(`.${className}{${styleText}}`);
  });

  fs.writeFileSync(utilCssPath, `${rules.join('\n')}\n`, 'utf8');
  for (const [styleText, className] of classMap) {
    const escaped = styleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(` style="${escaped}"`, 'g'), ` class="${className}"`);
  }
  html = html.replace(
    /<link rel="stylesheet" href="assets\/cornea-app\.css">/,
    '<link rel="stylesheet" href="assets/cornea-app.css">\n    <link rel="stylesheet" href="assets/csp-inline-utilities.css">'
  );
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`\nCornea.html inline style= → ${unique.length} utility classes`);
}

const htmlFiles = fs
  .readdirSync(CLINIC)
  .filter((name) => name.endsWith('.html'))
  .map((name) => path.join(CLINIC, name));

console.log('Applying strict CSP codemod…');
for (const file of htmlFiles) {
  migrateHtmlFile(file);
  ensureCspActionsScript(file);
}
migrateInlineStyleAttributes();
console.log('\nDone.');

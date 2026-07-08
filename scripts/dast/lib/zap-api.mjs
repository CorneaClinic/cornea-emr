/**
 * Minimal OWASP ZAP JSON API client.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ZAP_PORT = 8090;

export function findJavaBinDir() {
  if (process.env.JAVA_HOME) {
    const bin = path.join(process.env.JAVA_HOME, 'bin');
    if (fs.existsSync(path.join(bin, 'java.exe')) || fs.existsSync(path.join(bin, 'java'))) {
      return bin;
    }
  }

  const roots = [
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Java',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium')
  ];

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const bin = path.join(root, entry.name, 'bin');
      if (fs.existsSync(path.join(bin, 'java.exe')) || fs.existsSync(path.join(bin, 'java'))) {
        return bin;
      }
    }
  }

  return null;
}

export function zapRuntimeEnv() {
  const env = { ...process.env };
  const javaBin = findJavaBinDir();
  if (javaBin) {
    env.JAVA_HOME = path.dirname(javaBin);
    env.PATH = `${javaBin};${env.PATH || ''}`;
  }
  return { env, javaBin };
}

export function findZapExecutable() {
  if (process.env.ZAP_PATH && fs.existsSync(process.env.ZAP_PATH)) {
    return process.env.ZAP_PATH;
  }
  const candidates = [
    'C:\\Program Files\\ZAP\\Zed Attack Proxy\\zap.bat',
    'C:\\Program Files\\ZAP\\Zed Attack Proxy\\zap.sh',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ZAP', 'Zed Attack Proxy', 'zap.bat'),
    '/usr/share/zaproxy/zap.sh',
    '/Applications/ZAP.app/Contents/Java/zap.sh'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

export function zapApiBase(port = Number(process.env.ZAP_PORT || DEFAULT_ZAP_PORT)) {
  return `http://127.0.0.1:${port}`;
}

export async function waitForZap(port = Number(process.env.ZAP_PORT || DEFAULT_ZAP_PORT), timeoutMs = 120_000) {
  const base = zapApiBase(port);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/JSON/core/view/version/`);
      if (res.ok) {
        const json = await res.json();
        return { base, version: json.version };
      }
    } catch {
      /* retry */
    }
    await sleep(1500);
  }
  throw new Error(`ZAP daemon not reachable at ${base} after ${timeoutMs}ms`);
}

export async function zapGet(base, component, action, params = {}) {
  const qs = new URLSearchParams({ ...params });
  const url = `${base}/JSON/${component}/${action}/?${qs}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ZAP ${component}/${action} HTTP ${res.status}: ${json.error || JSON.stringify(json)}`);
  }
  if (json.error) throw new Error(`ZAP ${component}/${action}: ${json.error}`);
  return json;
}

export function findZapJar(zapDir) {
  const files = fs.readdirSync(zapDir);
  const jar = files.find((name) => /^zap-.*\.jar$/i.test(name));
  if (!jar) {
    throw new Error(`No zap-*.jar found in ${zapDir}`);
  }
  return path.join(zapDir, jar);
}

export async function startZapDaemon(port = Number(process.env.ZAP_PORT || DEFAULT_ZAP_PORT)) {
  try {
    const existing = await waitForZap(port, 3_000);
    console.log(`ZAP already running (${existing.version}) at ${existing.base}`);
    return { child: null, ...existing };
  } catch {
    /* start new daemon */
  }

  const exe = findZapExecutable();
  if (!exe) {
    throw new Error(
      'OWASP ZAP not found. Install via https://www.zaproxy.org/download/ ' +
        'or set ZAP_PATH to zap.bat/zap.sh.'
    );
  }

  const { env, javaBin } = zapRuntimeEnv();
  if (!javaBin) {
    throw new Error(
      'Java runtime not found for ZAP. Install Eclipse Temurin 17 (winget install EclipseAdoptium.Temurin.17.JRE) ' +
        'or set JAVA_HOME, then restart the terminal.'
    );
  }

  const zapDir = path.dirname(exe);
  const javaExe = path.join(javaBin, fs.existsSync(path.join(javaBin, 'java.exe')) ? 'java.exe' : 'java');
  const zapJar = findZapJar(zapDir);
  const zapHome =
    process.env.ZAP_HOME ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..', 'docs', 'dast-reports', '.zap-home');
  fs.mkdirSync(zapHome, { recursive: true });

  // Remove a stale home lock left by a previously killed daemon (safe: we verified no ZAP is running above).
  const homeLock = path.join(zapHome, '.homelock');
  if (fs.existsSync(homeLock)) {
    try {
      fs.rmSync(homeLock, { force: true });
    } catch {
      /* ignore */
    }
  }

  const args = [
    '-Xmx512m',
    '-jar',
    zapJar,
    '-daemon',
    '-port', String(port),
    '-dir', zapHome,
    '-config', 'api.disablekey=true',
    '-config', 'api.addrs.addr.name=.*',
    '-config', 'api.addrs.addr.regex=true'
  ];

  const child = spawn(javaExe, args, {
    detached: true,
    stdio: 'ignore',
    shell: false,
    env,
    cwd: zapDir
  });
  child.unref();

  const info = await waitForZap(port);
  return { child, ...info };
}

export async function shutdownZap(base) {
  try {
    await zapGet(base, 'core', 'action/shutdown');
  } catch {
    /* ignore */
  }
}

export async function newSession(base, name) {
  await zapGet(base, 'core', 'action/newSession', { name, overwrite: 'true' });
}

export async function includeInContext(base, contextName, regex) {
  await zapGet(base, 'context', 'action/includeInContext', {
    contextName,
    regex
  });
}

export async function createContext(base, contextName) {
  const res = await zapGet(base, 'context', 'action/newContext', { contextName });
  return res.contextId;
}

async function addReplacerRule(base, description, matchString, replacement) {
  try {
    await zapGet(base, 'replacer', 'action/removeRule', { description });
  } catch {
    /* rule may not exist */
  }
  await zapGet(base, 'replacer', 'action/addRule', {
    description,
    enabled: 'true',
    matchType: 'REQ_HEADER',
    matchRegex: 'false',
    matchString,
    replacement,
    initiators: ''
  });
}

export async function setBearerReplacer(base, token, _apiOrigin, deviceId = 'dast-zap-scanner') {
  await addReplacerRule(base, 'DAST Bearer token', 'Authorization', `Bearer ${token}`);
  await addReplacerRule(base, 'DAST Device header', 'X-Device-Id', deviceId);
}

export async function excludeFromSpider(base, regex) {
  await zapGet(base, 'spider', 'action/excludeFromScan', { regex });
}

export async function accessUrl(base, url) {
  await zapGet(base, 'core', 'action/accessUrl', { url, followRedirects: 'true' });
}

export async function spiderScan(base, url, maxChildren = 80) {
  const res = await zapGet(base, 'spider', 'action/scan', {
    url,
    maxChildren: String(maxChildren),
    recurse: 'true',
    contextName: '',
    subtreeOnly: 'false'
  });
  const id = res.scan;
  await waitSpiderComplete(base, id);
  return id;
}

async function waitSpiderComplete(base, scanId, timeoutMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await zapGet(base, 'spider', 'view/status', { scanId });
    if (String(st.status) === '100') return;
    await sleep(2000);
  }
  throw new Error('Spider scan timed out');
}

export async function ajaxSpiderScan(base, url) {
  await zapGet(base, 'ajaxSpider', 'action/setOptionMaxDuration', { Integer: '10' });
  await zapGet(base, 'ajaxSpider', 'action/scan', { url, inScope: 'true' });
  const start = Date.now();
  while (Date.now() - start < 600_000) {
    const st = await zapGet(base, 'ajaxSpider', 'view/status');
    if (String(st.status) === 'stopped') return;
    await sleep(3000);
  }
  throw new Error('Ajax spider timed out');
}

export async function waitPassiveScan(base, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await zapGet(base, 'pscan', 'view/recordsToScan');
    if (Number(st.recordsToScan) === 0) return;
    await sleep(2000);
  }
}

export async function activeScan(base, url, policy = 'Low') {
  try {
    await zapGet(base, 'ascan', 'action/setOptionAttackPolicy', { String: policy });
  } catch {
    /* policy may not exist on all builds */
  }
  const res = await zapGet(base, 'ascan', 'action/scan', {
    url,
    recurse: 'true',
    inScopeOnly: 'true'
  });
  const id = res.scan;
  await waitActiveComplete(base, id);
  return id;
}

async function waitActiveComplete(base, scanId, timeoutMs = 900_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await zapGet(base, 'ascan', 'view/status', { scanId });
    if (String(st.status) === '100') return;
    await sleep(3000);
  }
  throw new Error('Active scan timed out');
}

export async function importOpenApi(base, specUrl) {
  await zapGet(base, 'openapi', 'action/importUrl', { url: specUrl });
}

export async function getAlerts(base) {
  const res = await zapGet(base, 'core', 'view/alerts', { baseurl: '', start: '0', count: '5000' });
  return res.alerts || [];
}

export async function generateHtmlReport(base, reportDir, fileName = 'dast-latest.html') {
  fs.mkdirSync(reportDir, { recursive: true });
  // ZAP 2.17 report add-on: reports/action/generate
  await zapGet(base, 'reports', 'action/generate', {
    title: 'Cornea EMR DAST',
    template: 'traditional-html-plus',
    reportDir,
    reportFileName: fileName,
    display: 'false'
  });
  return path.join(reportDir, fileName);
}

export async function generateReport(base, outPath, format = 'HTML') {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  const res = await zapGet(base, 'core', 'action/generateReport', {
    title: 'Cornea EMR DAST',
    template: 'traditional-html-plus',
    reportdir: dir,
    reportfilename: path.basename(outPath),
    reportFileName: path.basename(outPath),
    reportFormat: format
  });
  return res;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

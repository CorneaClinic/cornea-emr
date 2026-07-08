/**
 * Map ZAP alert names / CWE IDs to plain-language explanations and safe code-fix hints.
 */

const FIX_CATALOG = [
  {
    match: /content security policy|csp/i,
    cwe: 'CWE-693',
    explain:
      'The response is missing or has a weak Content-Security-Policy. Browsers rely on CSP to limit XSS blast radius.',
    fix: {
      file: 'apps/api/src/app.js',
      summary: 'Helmet CSP is enabled but may need tuning for clinic static assets.',
      snippet: "app.use(helmet({ contentSecurityPolicy: /* review directives */ }));"
    }
  },
  {
    match: /x-frame-options|clickjacking/i,
    cwe: 'CWE-1021',
    explain: 'Pages may be embeddable in iframes on hostile sites (clickjacking).',
    fix: {
      file: 'apps/api/src/app.js',
      summary: 'Helmet sets X-Frame-Options by default; verify clinic static Worker headers too.',
      snippet: "helmet({ frameguard: { action: 'deny' } })"
    }
  },
  {
    match: /strict-transport-security|hsts/i,
    cwe: 'CWE-319',
    explain: 'HSTS is missing or too short, allowing SSL-stripping on first visit.',
    fix: {
      file: 'apps/api/src/app.js',
      summary: 'Enable HSTS in production via Helmet when TLS terminates at the edge.',
      snippet: "helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } })"
    }
  },
  {
    match: /x-content-type-options/i,
    cwe: 'CWE-693',
    explain: 'MIME sniffing may cause browsers to misinterpret file types.',
    fix: {
      file: 'apps/api/src/app.js',
      summary: 'Helmet nosniff is already wired; confirm on clinic CDN/Worker responses.',
      snippet: "helmet({ noSniff: true })"
    }
  },
  {
    match: /cookie.*secure|cookie without secure/i,
    cwe: 'CWE-614',
    explain: 'Session cookies may be sent over plaintext HTTP.',
    fix: {
      file: 'apps/api/src/routes/auth.js',
      summary: 'Set Secure + HttpOnly + SameSite on auth cookies in production.',
      snippet: "res.cookie('refreshToken', token, { httpOnly: true, secure: true, sameSite: 'strict' })"
    }
  },
  {
    match: /sql injection/i,
    cwe: 'CWE-89',
    explain: 'Input may reach SQL without parameterization.',
    fix: {
      file: 'apps/api/src/services/',
      summary: 'Use parameterized queries ($1, $2) everywhere; never concatenate user input into SQL.',
      snippet: 'await db.query(`SELECT * FROM visits WHERE id = $1`, [id])'
    }
  },
  {
    match: /cross site scripting|xss/i,
    cwe: 'CWE-79',
    explain: 'User-controlled data may render or execute in the browser without encoding.',
    fix: {
      file: 'apps/clinic/js/',
      summary: 'Use escapeHtml() for dynamic DOM; avoid innerHTML with raw record fields.',
      snippet: 'row.innerHTML = escapeHtml(record.fullName)'
    }
  },
  {
    match: /path traversal|directory browsing/i,
    cwe: 'CWE-22',
    explain: 'File paths from user input may escape intended directories.',
    fix: {
      file: 'apps/api/src/routes/media.js',
      summary: 'Validate media keys against clinic scope; reject .. segments.',
      snippet: 'if (filename.includes("..")) throw new BadRequestError("Invalid path")'
    }
  },
  {
    match: /information disclosure|server leaks|x-powered-by/i,
    cwe: 'CWE-200',
    explain: 'Responses expose stack or server versions useful to attackers.',
    fix: {
      file: 'apps/api/src/app.js',
      summary: 'app.disable("x-powered-by") is set; scrub error messages in production.',
      snippet: "app.disable('x-powered-by')"
    }
  },
  {
    match: /csrf/i,
    cwe: 'CWE-352',
    explain: 'State-changing requests may be forged from another origin.',
    fix: {
      file: 'apps/api/src/app.js',
      summary: 'API uses Bearer tokens + CORS allowlist; ensure mutations reject missing auth.',
      snippet: 'cors({ origin: corsOrigins, credentials: true })'
    }
  }
];

export function suggestFix(alert) {
  const hay = `${alert.alert || ''} ${alert.name || ''} ${alert.desc || ''} ${alert.cweid || ''}`;
  for (const entry of FIX_CATALOG) {
    if (entry.match.test(hay) || (entry.cwe && String(alert.cweid || '').includes(entry.cwe.replace('CWE-', '')))) {
      return {
        cwe: entry.cwe,
        explanation: entry.explain,
        proposedFix: entry.fix
      };
    }
  }
  return {
    cwe: alert.cweid ? `CWE-${alert.cweid}` : '—',
    explanation: alert.desc || alert.alert || 'Review manually in ZAP and map to OWASP ASVS control.',
    proposedFix: null
  };
}

export { FIX_CATALOG };

/**
 * Block DAST scans against production hosts (active scans may mutate data).
 */

const PRODUCTION_HOST_PATTERNS = [
  /corneaclinic\.visionemr\.net/i,
  /corneaclinic-2zfpt\.ondigitalocean\.app/i,
  /ondigitalocean\.app/i,
  /visionemr\.net/i
];

const SAFE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^clinic\.local$/i,
  /\.local$/i,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /staging/i,
  /-e2e/i
];

export function parseTargetUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('DAST target URL is required');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid DAST target URL: ${raw}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`DAST only supports http/https targets, got ${url.protocol}`);
  }
  return url;
}

export function isProductionHost(hostname) {
  const host = (hostname || '').toLowerCase();
  return PRODUCTION_HOST_PATTERNS.some((re) => re.test(host));
}

export function isLikelySafeHost(hostname) {
  const host = (hostname || '').toLowerCase();
  if (isProductionHost(host)) return false;
  return SAFE_HOST_PATTERNS.some((re) => re.test(host));
}

/**
 * @param {{ clinicUrl: string, apiUrl: string, allowProductionPassive?: boolean, activeScan?: boolean }} opts
 */
export function assertSafeDastTargets(opts) {
  const clinic = parseTargetUrl(opts.clinicUrl);
  const api = parseTargetUrl(opts.apiUrl);
  const active = opts.activeScan !== false;

  if (active) {
    if (isProductionHost(clinic.hostname) || isProductionHost(api.hostname)) {
      throw new Error(
        'Active DAST is blocked against production hosts. ' +
          'Use local stack (127.0.0.1:8080 / :3000) or set DAST_ACTIVE_SCAN=false for passive-only.'
      );
    }
    if (!isLikelySafeHost(clinic.hostname) || !isLikelySafeHost(api.hostname)) {
      throw new Error(
        `Active DAST requires a local/staging target. Got clinic=${clinic.hostname} api=${api.hostname}`
      );
    }
  } else if (!opts.allowProductionPassive) {
    if (isProductionHost(clinic.hostname) || isProductionHost(api.hostname)) {
      throw new Error(
        'Passive DAST against production is disabled by default. ' +
          'Set DAST_ALLOW_PRODUCTION_PASSIVE=1 only for read-only baseline checks.'
      );
    }
  }

  return { clinic, api };
}

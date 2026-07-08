/**
 * Shared Content-Security-Policy builder for clinic static hosting.
 * Used by clinic-server.js (local) and clinic-worker.js (Cloudflare).
 */

const CLINIC_CONNECT_SRC = [
  "'self'",
  'http://127.0.0.1:*',
  'http://localhost:*',
  'https://corneaclinic-2zfpt.ondigitalocean.app',
  'https://api.visionemr.net'
];

const PRODUCTION_CONNECT_SRC = [
  "'self'",
  'https://corneaclinic-2zfpt.ondigitalocean.app',
  'https://api.visionemr.net'
];

/**
 * @param {string} nonce
 * @param {{ production?: boolean }} [options]
 */
function buildStrictCsp(nonce, options = {}) {
  const connectSrc = (options.production ? PRODUCTION_CONNECT_SRC : CLINIC_CONNECT_SRC).join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'none'",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; ');
}

/**
 * @param {string} html
 * @param {string} nonce
 */
function injectHtmlNonces(html, nonce) {
  let out = html.replace(/\snonce="[^"]*"/g, '');
  out = out.replace(/<script(\s[^>]*)?>/gi, (match) => {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(match)) return match;
    if (/src\s*=/.test(match)) return match.replace('<script', `<script nonce="${nonce}"`);
    return match.replace('<script', `<script nonce="${nonce}"`);
  });
  out = out.replace(/<style(\s[^>]*)?>/gi, (match) =>
    match.replace('<style', `<style nonce="${nonce}"`)
  );
  return out;
}

module.exports = {
  CLINIC_CONNECT_SRC,
  PRODUCTION_CONNECT_SRC,
  buildStrictCsp,
  injectHtmlNonces
};

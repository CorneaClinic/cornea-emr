import { env } from '../config/env.js';
import { ROLES } from '../core/permissions.js';

/**
 * @returns {boolean}
 */
export function isOidcConfigured() {
  const c = env.sso;
  return c.oidcEnabled
    && Boolean(c.oidcIssuer && c.oidcClientId && c.oidcClientSecret && c.oidcRedirectUri);
}

/**
 * @returns {boolean}
 */
export function isLdapConfigured() {
  const c = env.sso;
  return c.ldapEnabled
    && Boolean(c.ldapUrl && c.ldapBindDn && c.ldapBindPassword && c.ldapSearchBase);
}

/**
 * Public SSO config for clinic UI (no secrets).
 */
export function getPublicSsoConfig() {
  const apiBase = env.auth.appPublicUrl.replace(/\/$/, '');
  return {
    oidc: isOidcConfigured()
      ? {
          enabled: true,
          loginUrl: `${apiBase}/api/v1/auth/sso/oidc/login`,
          issuer: env.sso.oidcIssuer
        }
      : { enabled: false },
    ldap: isLdapConfigured()
      ? { enabled: true, loginUrl: `${apiBase}/api/v1/auth/sso/ldap/login` }
      : { enabled: false }
  };
}

/**
 * @param {string} role
 */
export function resolveSsoDefaultRole(role) {
  const r = String(role || env.sso.defaultRole || 'ophthalmologist').trim();
  return ROLES.includes(r) ? r : 'ophthalmologist';
}

/**
 * Escape LDAP filter value (RFC 4515).
 * @param {string} value
 */
export function escapeLdapFilter(value) {
  return String(value)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

/**
 * @param {string} template
 * @param {string} email
 */
export function buildLdapSearchFilter(template, email) {
  const escaped = escapeLdapFilter(email.trim().toLowerCase());
  return String(template || '(mail={{email}})').replace(/\{\{email\}\}/g, escaped);
}

/**
 * @param {string} returnUrl
 */
export function sanitizeReturnUrl(returnUrl) {
  const clinic = env.auth.clinicPublicUrl.replace(/\/$/, '');
  if (!returnUrl) return `${clinic}/Cornea.html`;
  try {
    const u = new URL(returnUrl);
    const clinicOrigin = new URL(clinic).origin;
    if (u.origin === clinicOrigin) return u.toString();
  } catch {
    /* fall through */
  }
  return `${clinic}/Cornea.html`;
}

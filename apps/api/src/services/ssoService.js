import { env } from '../config/env.js';
import { issueAuthTokens } from './authService.js';
import { authenticateLdapUser } from './ldapService.js';
import {
  buildOidcAuthorizationUrl,
  exchangeOidcCode,
  verifyOidcState
} from './oidcService.js';
import { resolveSsoUser } from './ssoUserService.js';
import { getPublicSsoConfig, sanitizeReturnUrl } from './ssoConfig.js';

export { getPublicSsoConfig };

/**
 * @param {import('express').Request} req
 * @param {string} email
 * @param {string} password
 */
export async function loginViaLdap({ req, email, password }) {
  const ldapUser = await authenticateLdapUser(email, password);
  const user = await resolveSsoUser({
    provider: 'ldap',
    subject: ldapUser.dn,
    email: ldapUser.email,
    fullName: ldapUser.fullName
  });
  return issueAuthTokens({
    req,
    user,
    auditAction: 'login',
    auditDiff: { method: 'ldap' }
  });
}

/**
 * @param {string} [returnUrl]
 */
export async function startOidcLogin(returnUrl) {
  const safeReturn = sanitizeReturnUrl(returnUrl);
  return buildOidcAuthorizationUrl(safeReturn);
}

/**
 * Build clinic callback redirect URL with tokens.
 * @param {object} authResult
 */
export function buildSsoCallbackRedirect(authResult) {
  const callback = new URL(`${env.auth.clinicPublicUrl.replace(/\/$/, '')}/sso-callback.html`);
  callback.searchParams.set('accessToken', authResult.accessToken);
  callback.searchParams.set('expiresIn', authResult.expiresIn);
  callback.searchParams.set('user', Buffer.from(JSON.stringify(authResult.user)).toString('base64url'));
  if (env.auth.exposeRefreshTokenInBody) {
    callback.searchParams.set('refreshToken', authResult.refreshToken);
  }
  return callback.toString();
}

/**
 * @param {import('express').Request} req
 * @param {string} code
 * @param {string} state
 */
export async function completeOidcLogin({ req, code, state }) {
  const payload = verifyOidcState(state);
  const profile = await exchangeOidcCode(code);
  if (!profile.subject || !profile.email) {
    throw new Error('OIDC profile missing sub or email');
  }

  const user = await resolveSsoUser({
    provider: 'oidc',
    subject: profile.subject,
    email: profile.email,
    fullName: profile.fullName
  });

  const authResult = await issueAuthTokens({
    req,
    user,
    auditAction: 'login',
    auditDiff: { method: 'oidc', returnUrl: payload.returnUrl }
  });

  return {
    authResult,
    returnUrl: sanitizeReturnUrl(payload.returnUrl)
  };
}

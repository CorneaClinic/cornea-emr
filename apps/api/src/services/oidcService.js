import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { isOidcConfigured } from './ssoConfig.js';

/** @type {{ doc: Record<string, string>, fetchedAt: number } | null} */
let discoveryCache = null;

const DISCOVERY_TTL_MS = 60 * 60 * 1000;

/**
 * @param {string} issuer
 */
async function fetchDiscovery(issuer) {
  const now = Date.now();
  if (discoveryCache && now - discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
    return discoveryCache.doc;
  }
  const base = issuer.replace(/\/$/, '');
  const res = await fetch(`${base}/.well-known/openid-configuration`);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status})`);
  }
  const doc = await res.json();
  discoveryCache = { doc, fetchedAt: now };
  return doc;
}

/**
 * @param {string} returnUrl
 */
export async function buildOidcAuthorizationUrl(returnUrl) {
  if (!isOidcConfigured()) {
    throw new Error('OIDC SSO is not configured');
  }
  const discovery = await fetchDiscovery(env.sso.oidcIssuer);
  const authorizationEndpoint = discovery.authorization_endpoint;
  if (!authorizationEndpoint) {
    throw new Error('OIDC discovery missing authorization_endpoint');
  }

  const nonce = crypto.randomUUID();
  const state = jwt.sign(
    { returnUrl, nonce, typ: 'oidc' },
    env.auth.jwtSecret,
    { expiresIn: '10m' }
  );

  const params = new URLSearchParams({
    client_id: env.sso.oidcClientId,
    response_type: 'code',
    scope: env.sso.oidcScopes,
    redirect_uri: env.sso.oidcRedirectUri,
    state,
    nonce
  });

  return `${authorizationEndpoint}?${params.toString()}`;
}

/**
 * @param {string} state
 */
export function verifyOidcState(state) {
  const payload = jwt.verify(state, env.auth.jwtSecret);
  if (payload.typ !== 'oidc') {
    throw new Error('Invalid OIDC state');
  }
  return payload;
}

/**
 * @param {string} code
 */
export async function exchangeOidcCode(code) {
  const discovery = await fetchDiscovery(env.sso.oidcIssuer);
  const tokenEndpoint = discovery.token_endpoint;
  if (!tokenEndpoint) {
    throw new Error('OIDC discovery missing token_endpoint');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.sso.oidcRedirectUri,
    client_id: env.sso.oidcClientId,
    client_secret: env.sso.oidcClientSecret
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    throw new Error(`OIDC token exchange failed (${res.status})`);
  }

  const tokens = await res.json();
  if (!tokens.access_token) {
    throw new Error('OIDC token response missing access_token');
  }

  const userinfoEndpoint = discovery.userinfo_endpoint;
  if (!userinfoEndpoint) {
    throw new Error('OIDC discovery missing userinfo_endpoint');
  }

  const profileRes = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!profileRes.ok) {
    throw new Error(`OIDC userinfo failed (${profileRes.status})`);
  }

  const profile = await profileRes.json();
  return {
    subject: String(profile.sub || ''),
    email: String(profile.email || profile.preferred_username || '').trim().toLowerCase(),
    fullName: String(profile.name || profile.given_name || profile.email || 'SSO User').trim()
  };
}

/** Reset discovery cache (tests). */
export function resetOidcDiscoveryCache() {
  discoveryCache = null;
}

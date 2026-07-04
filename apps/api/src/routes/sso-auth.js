import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { env } from '../config/env.js';
import {
  createRateLimiter,
  clientIpKey,
  loginEmailKey
} from '../core/middleware/rateLimit.js';
import {
  getPublicSsoConfig,
  loginViaLdap,
  startOidcLogin,
  completeOidcLogin,
  buildSsoCallbackRedirect
} from '../services/ssoService.js';
import { isLdapConfigured, isOidcConfigured } from '../services/ssoConfig.js';

const router = Router();

const loginIpLimiter = createRateLimiter({
  windowMs: env.rateLimit.loginWindowMs,
  max: env.rateLimit.loginMaxPerIp,
  keyGenerator: clientIpKey,
  namespace: 'sso-login-ip'
});

const loginEmailLimiter = createRateLimiter({
  windowMs: env.rateLimit.loginWindowMs,
  max: env.rateLimit.loginMaxPerEmail,
  keyGenerator: loginEmailKey,
  namespace: 'sso-login-email'
});

/** GET /api/v1/auth/sso/config — public SSO capabilities */
router.get('/config', asyncHandler(async (_req, res) => {
  res.json({ data: getPublicSsoConfig() });
}));

/** GET /api/v1/auth/sso/oidc/login — redirect to identity provider */
router.get('/oidc/login', loginIpLimiter, asyncHandler(async (req, res) => {
  if (!isOidcConfigured()) {
    res.status(404).json({ error: { message: 'OIDC SSO is not enabled' } });
    return;
  }
  const returnUrl = typeof req.query.returnUrl === 'string' ? req.query.returnUrl : undefined;
  const url = await startOidcLogin(returnUrl);
  res.redirect(url);
}));

/** GET /api/v1/auth/sso/oidc/callback — OIDC authorization code callback */
router.get('/oidc/callback', loginIpLimiter, asyncHandler(async (req, res) => {
  if (!isOidcConfigured()) {
    res.status(404).json({ error: { message: 'OIDC SSO is not enabled' } });
    return;
  }
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) {
    res.status(400).json({ error: { message: 'Missing OIDC code or state' } });
    return;
  }

  const { authResult } = await completeOidcLogin({ req, code, state });

  res.cookie(env.auth.refreshCookieName, authResult.refreshToken, {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: env.auth.cookieSameSite,
    maxAge: env.auth.refreshExpiresMs,
    path: '/api/v1/auth'
  });

  res.redirect(buildSsoCallbackRedirect(authResult));
}));

/** POST /api/v1/auth/sso/ldap/login — LDAP bind authentication */
router.post('/ldap/login', loginIpLimiter, loginEmailLimiter, asyncHandler(async (req, res) => {
  if (!isLdapConfigured()) {
    res.status(404).json({ error: { message: 'LDAP SSO is not enabled' } });
    return;
  }
  const { email, password } = req.body || {};
  const result = await loginViaLdap({ req, email, password });

  res.cookie(env.auth.refreshCookieName, result.refreshToken, {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: env.auth.cookieSameSite,
    maxAge: env.auth.refreshExpiresMs,
    path: '/api/v1/auth'
  });

  const body = {
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    user: result.user
  };
  if (env.auth.exposeRefreshTokenInBody) {
    body.refreshToken = result.refreshToken;
  }
  res.json(body);
}));

export default router;

import { Router } from 'express';
import { env } from '../config/env.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { auditContextMiddleware } from '../services/auditService.js';
import {
  createRateLimiter,
  clientIpKey,
  loginEmailKey
} from '../core/middleware/rateLimit.js';
import {
  login,
  logout,
  refreshSession,
  getProfile,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset
} from '../services/authService.js';

const router = Router();

router.use(auditContextMiddleware);

const loginIpLimiter = createRateLimiter({
  windowMs: env.rateLimit.loginWindowMs,
  max: env.rateLimit.loginMaxPerIp,
  keyGenerator: clientIpKey,
  namespace: 'login-ip'
});

const loginEmailLimiter = createRateLimiter({
  windowMs: env.rateLimit.loginWindowMs,
  max: env.rateLimit.loginMaxPerEmail,
  keyGenerator: loginEmailKey,
  namespace: 'login-email'
});

const resetIpLimiter = createRateLimiter({
  windowMs: env.rateLimit.resetWindowMs,
  max: env.rateLimit.resetMaxPerIp,
  keyGenerator: clientIpKey,
  namespace: 'reset-ip'
});

/**
 * @param {import('express').Response} res
 * @param {string} refreshToken
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie(env.auth.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: env.auth.cookieSameSite,
    maxAge: env.auth.refreshExpiresMs,
    path: '/api/v1/auth'
  });
}

/**
 * @param {import('express').Response} res
 */
function clearRefreshCookie(res) {
  res.clearCookie(env.auth.refreshCookieName, {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: env.auth.cookieSameSite,
    path: '/api/v1/auth'
  });
}

/**
 * @param {import('express').Request} req
 */
function readRefreshToken(req) {
  return req.body?.refreshToken
    || req.cookies?.[env.auth.refreshCookieName]
    || null;
}

/**
 * @param {import('express').Response} res
 * @param {object} result
 */
function sendAuthResponse(res, result) {
  setRefreshCookie(res, result.refreshToken);
  const body = {
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    user: result.user
  };
  if (env.auth.exposeRefreshTokenInBody) {
    body.refreshToken = result.refreshToken;
  }
  res.json(body);
}

/** POST /api/v1/auth/login */
router.post('/login', loginIpLimiter, loginEmailLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const result = await login({ req, email, password });
    sendAuthResponse(res, result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/refresh */
router.post('/refresh', loginIpLimiter, async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);
    const result = await refreshSession({ req, refreshToken });
    sendAuthResponse(res, result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/logout */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);
    await logout({
      req,
      refreshToken,
      sessionFamilyId: req.user.sessionFamilyId,
      userId: req.user.sub,
      clinicId: req.user.clinicId
    });
    clearRefreshCookie(res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/auth/me */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await getProfile(req.user.sub);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/change-password */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = await changePassword({
      req,
      userId: req.user.sub,
      currentPassword,
      newPassword
    });
    clearRefreshCookie(res);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/password-reset/request */
router.post('/password-reset/request', resetIpLimiter, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const result = await requestPasswordReset({ req, email });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/password-reset/confirm */
router.post('/password-reset/confirm', resetIpLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    const result = await confirmPasswordReset({ req, token, newPassword });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

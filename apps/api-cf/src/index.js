/**
 * Proxy all HTTP traffic to a singleton Express API Container.
 * Fresh Cloudflare stack — no DigitalOcean dependency.
 */
import { Container, getContainer } from '@cloudflare/containers';

/**
 * @typedef {object} Env
 * @property {DurableObjectNamespace} API_CONTAINER
 * @property {string} [DATABASE_URL]
 * @property {string} [JWT_SECRET]
 * @property {string} [SECRETS_ENCRYPTION_KEY]
 * @property {string} [CORS_ORIGIN]
 * @property {string} [APP_PUBLIC_URL]
 * @property {string} [CLINIC_PUBLIC_URL]
 * @property {string} [MEDIA_STORAGE_PROVIDER]
 * @property {string} [MEDIA_S3_BUCKET]
 * @property {string} [MEDIA_S3_ENDPOINT]
 * @property {string} [MEDIA_S3_REGION]
 * @property {string} [MEDIA_S3_ACCESS_KEY_ID]
 * @property {string} [MEDIA_S3_SECRET_ACCESS_KEY]
 * @property {string} [MEDIA_S3_FORCE_PATH_STYLE]
 * @property {string} [AUTH_COOKIE_SECURE]
 * @property {string} [AUTH_COOKIE_SAME_SITE]
 * @property {string} [AUTH_EXPOSE_REFRESH_IN_BODY]
 * @property {string} [REDIS_URL]
 * @property {string} [SEED_ADMIN_EMAIL]
 * @property {string} [SEED_ADMIN_PASSWORD]
 * @property {string} [ALLOW_PRODUCTION_SEED]
 * @property {string} [SMTP_HOST]
 * @property {string} [SMTP_PORT]
 * @property {string} [SMTP_USER]
 * @property {string} [SMTP_PASS]
 * @property {string} [SMTP_FROM]
 */

const PASS_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SECRETS_ENCRYPTION_KEY',
  'CORS_ORIGIN',
  'APP_PUBLIC_URL',
  'CLINIC_PUBLIC_URL',
  'MEDIA_S3_BUCKET',
  'MEDIA_S3_ENDPOINT',
  'MEDIA_S3_ACCESS_KEY_ID',
  'MEDIA_S3_SECRET_ACCESS_KEY',
  'REDIS_URL',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
  'ALLOW_PRODUCTION_SEED',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'MEDIA_STORAGE_PROVIDER',
  'MEDIA_S3_FORCE_PATH_STYLE',
  'MEDIA_S3_REGION',
  'AUTH_COOKIE_SECURE',
  'AUTH_COOKIE_SAME_SITE',
  'AUTH_EXPOSE_REFRESH_IN_BODY',
  'DB_CONNECTION_TIMEOUT_MS'
];

/**
 * @param {Env} e
 * @returns {Record<string, string>}
 */
function buildContainerEnv(e) {
  /** @type {Record<string, string>} */
  const out = {
    NODE_ENV: 'production',
    PORT: '3000',
    API_VERSION: '0.3.0-cf',
    AUTH_COOKIE_SECURE: e.AUTH_COOKIE_SECURE || 'true',
    AUTH_COOKIE_SAME_SITE: e.AUTH_COOKIE_SAME_SITE || 'none',
    AUTH_EXPOSE_REFRESH_IN_BODY: e.AUTH_EXPOSE_REFRESH_IN_BODY || 'false',
    DB_CONNECTION_TIMEOUT_MS: e.DB_CONNECTION_TIMEOUT_MS || '90000',
    MEDIA_STORAGE_PROVIDER: e.MEDIA_STORAGE_PROVIDER || 's3',
    MEDIA_S3_FORCE_PATH_STYLE: e.MEDIA_S3_FORCE_PATH_STYLE || 'true',
    MEDIA_S3_REGION: e.MEDIA_S3_REGION || 'auto'
  };
  for (const key of PASS_KEYS) {
    if (e[key]) out[key] = e[key];
  }
  return out;
}

export class CorneaApiContainer extends Container {
  defaultPort = 3000;
  /** Long enough for sync long-poll (~30s) + idle clinic sessions */
  sleepAfter = '45m';
  enableInternet = true;

  /**
   * @param {DurableObjectState} ctx
   * @param {Env} env
   */
  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = buildContainerEnv(env);
  }

  onStart() {
    console.log('[CorneaApiContainer] started');
  }

  onStop() {
    console.log('[CorneaApiContainer] stopped');
  }

  onError(err) {
    console.error('[CorneaApiContainer] error', err);
  }
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' && request.method === 'GET') {
      return Response.json({
        ok: true,
        service: 'cornea-emr-api-cf',
        hint: 'API proxied to Container — try /health/live'
      });
    }
    const container = getContainer(env.API_CONTAINER, 'cornea-api-singleton');
    return container.fetch(request);
  }
};

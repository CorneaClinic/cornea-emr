import dotenv from 'dotenv';
import { join } from 'path';
import { validateJwtSecretStrength } from '../core/password-policy.js';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function optional(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return String(value).trim();
}

function parseIntEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return n;
}

const NODE_ENV = optional('NODE_ENV', 'development');
const validEnv = ['development', 'test', 'production'];
if (!validEnv.includes(NODE_ENV)) {
  throw new Error(`NODE_ENV must be one of: ${validEnv.join(', ')}`);
}

const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';

const jwtSecret = optional('JWT_SECRET', isProduction ? '' : 'dev-only-change-me-in-production');
if (!jwtSecret) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

if (isProduction) {
  validateJwtSecretStrength(jwtSecret);
} else if (jwtSecret !== 'dev-only-change-me-in-production') {
  try {
    validateJwtSecretStrength(jwtSecret);
  } catch (_) {
    // Allow weaker secrets in local development only
  }
}

const corsOrigin = optional('CORS_ORIGIN', isDevelopment ? 'http://127.0.0.1:8080,http://localhost:8080' : '');
if (isProduction && (!corsOrigin || corsOrigin === '*')) {
  throw new Error('CORS_ORIGIN must be an explicit allowlist in production (comma-separated origins)');
}

function firstCorsOrigin(origins) {
  const first = String(origins || '').split(',').map((o) => o.trim()).filter(Boolean)[0];
  return first || '';
}

const appPublicUrl = optional('APP_PUBLIC_URL', 'http://127.0.0.1:3000');
const clinicPublicUrl = optional('CLINIC_PUBLIC_URL', '') || firstCorsOrigin(corsOrigin) || appPublicUrl;

const seedAdminPassword = optional('SEED_ADMIN_PASSWORD', isDevelopment ? '' : '');
if (!isDevelopment && process.argv.some((a) => a.includes('seed-cli'))) {
  // validated at seed runtime
}

const secretsEncryptionKey = optional('SECRETS_ENCRYPTION_KEY', jwtSecret);

/**
 * SSL for managed PostgreSQL (DigitalOcean, etc.). Local dev typically has no sslmode.
 * @param {string} databaseUrl
 * @returns {true | { rejectUnauthorized: boolean } | undefined}
 */
function resolveDatabaseSsl(databaseUrl) {
  if (optional('DATABASE_SSL', '').toLowerCase() === 'false') return undefined;

  const urlWantsSsl = /[?&]sslmode=(require|verify-full|verify-ca|prefer)/i.test(databaseUrl);
  const managedCloud = /ondigitalocean\.com/i.test(databaseUrl);
  const useSsl = optional('DATABASE_SSL', '').toLowerCase() === 'true' || urlWantsSsl || managedCloud;

  if (!useSsl) return undefined;

  // Cloud managed DBs (DO App Platform, etc.) use sslmode=require with a CA Node may not trust.
  const strictVerify = optional(
    'DATABASE_SSL_REJECT_UNAUTHORIZED',
    (managedCloud || urlWantsSsl) ? 'false' : 'true'
  ) === 'true';
  return strictVerify ? true : { rejectUnauthorized: false };
}

/** Remove sslmode from URL so pg Pool ssl.rejectUnauthorized is not overridden. */
function stripSslParamsFromDatabaseUrl(databaseUrl) {
  try {
    const normalized = databaseUrl.replace(/^postgres:/, 'postgresql:');
    const url = new URL(normalized);
    for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(key);
    }
    const out = url.toString().replace(/^postgresql:/, 'postgres:');
    return out.replace(/\?$/, '');
  } catch {
    return databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, '$1')
      .replace(/([?&])sslrootcert=[^&]*/gi, '$1')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '');
  }
}

const databaseUrl = required('DATABASE_URL');
const databaseSsl = resolveDatabaseSsl(databaseUrl);
const databaseConnectionUrl = databaseSsl &&
  typeof databaseSsl === 'object' &&
  databaseSsl.rejectUnauthorized === false
  ? stripSslParamsFromDatabaseUrl(databaseUrl)
  : databaseUrl;

export const env = Object.freeze({
  nodeEnv: NODE_ENV,
  isProduction,
  isDevelopment,
  port: parseIntEnv('PORT', 3000),
  apiVersion: optional('API_VERSION', '0.2.0'),
  databaseUrl,
  databaseConnectionUrl,
  db: Object.freeze({
    poolMax: parseIntEnv('DB_POOL_MAX', 20),
    idleTimeoutMs: parseIntEnv('DB_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMs: parseIntEnv('DB_CONNECTION_TIMEOUT_MS', 5000),
    ssl: databaseSsl
  }),
  corsOrigin,
  logLevel: optional('LOG_LEVEL', NODE_ENV === 'development' ? 'debug' : 'info'),
  auth: Object.freeze({
    jwtSecret,
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
    refreshExpiresMs: parseDurationMs(optional('JWT_REFRESH_EXPIRES_IN', '7d')),
    passwordResetExpiresMs: parseDurationMs(optional('PASSWORD_RESET_EXPIRES_IN', '1h')),
    bcryptRounds: parseIntEnv('BCRYPT_ROUNDS', 12),
    refreshCookieName: optional('AUTH_REFRESH_COOKIE_NAME', 'cornea_refresh_token'),
    cookieSecure: optional('AUTH_COOKIE_SECURE', isProduction ? 'true' : 'false') === 'true',
    cookieSameSite: optional('AUTH_COOKIE_SAME_SITE', 'lax'),
    appPublicUrl,
    clinicPublicUrl,
    maxFailedAttempts: parseIntEnv('AUTH_MAX_FAILED_ATTEMPTS', 10),
    lockoutMinutes: parseIntEnv('AUTH_LOCKOUT_MINUTES', 30),
    exposeRefreshTokenInBody: optional('AUTH_EXPOSE_REFRESH_IN_BODY', isDevelopment ? 'true' : 'false') === 'true'
  }),
  rateLimit: Object.freeze({
    loginWindowMs: parseIntEnv('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000),
    loginMaxPerIp: parseIntEnv('RATE_LIMIT_LOGIN_MAX_PER_IP', isTest ? 500 : 20),
    loginMaxPerEmail: parseIntEnv('RATE_LIMIT_LOGIN_MAX_PER_EMAIL', isTest ? 500 : 10),
    resetWindowMs: parseIntEnv('RATE_LIMIT_RESET_WINDOW_MS', 60 * 60 * 1000),
    resetMaxPerIp: parseIntEnv('RATE_LIMIT_RESET_MAX_PER_IP', 10),
    apiWindowMs: parseIntEnv('RATE_LIMIT_API_WINDOW_MS', 60 * 1000),
    apiMaxPerIp: parseIntEnv('RATE_LIMIT_API_MAX_PER_IP', 300)
  }),
  redis: Object.freeze({
    url: optional('REDIS_URL', ''),
    connectTimeoutMs: parseIntEnv('REDIS_CONNECT_TIMEOUT_MS', 5000)
  }),
  seed: Object.freeze({
    clinicName: optional('SEED_CLINIC_NAME', 'Cornea Clinic'),
    clinicSlug: optional('SEED_CLINIC_SLUG', 'cornea-clinic'),
    adminEmail: optional('SEED_ADMIN_EMAIL', 'admin@corneaclinic.local'),
    adminPassword: seedAdminPassword,
    adminName: optional('SEED_ADMIN_NAME', 'System Administrator'),
    allowProduction: optional('ALLOW_PRODUCTION_SEED', 'false') === 'true'
  }),
  secrets: Object.freeze({
    encryptionKey: secretsEncryptionKey
  }),
  media: Object.freeze({
    storageProvider: optional('MEDIA_STORAGE_PROVIDER', 'local').toLowerCase(),
    storagePath: optional('MEDIA_STORAGE_PATH', join(process.cwd(), 'data', 'media')),
    maxFileBytes: parseIntEnv('MEDIA_MAX_FILE_BYTES', 25 * 1024 * 1024),
    maxVideoBytes: parseIntEnv('MEDIA_MAX_VIDEO_BYTES', 100 * 1024 * 1024),
    signedUrlTtlSeconds: parseIntEnv('MEDIA_SIGNED_URL_TTL_SECONDS', 900),
    virusScanHookUrl: optional('MEDIA_VIRUS_SCAN_HOOK_URL', ''),
    categories: Object.freeze(
      optional(
        'MEDIA_CATEGORIES',
        'slit_lamp,corneal_topography,topography,tomography,as_oct,specular,confocal,anterior_drawing,corneal_drawing,operative_photo,video,pdf_report,donor_cornea,referral,teaching_case,research,other'
      ).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    ),
    allowedMimeTypes: Object.freeze(
      optional(
        'MEDIA_ALLOWED_MIME_TYPES',
        'image/png,image/jpeg,image/webp,image/svg+xml,image/tiff,application/pdf,application/dicom,video/mp4,video/webm'
      ).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    ),
    s3: Object.freeze({
      bucket: optional('MEDIA_S3_BUCKET', ''),
      region: optional('MEDIA_S3_REGION', 'auto'),
      endpoint: optional('MEDIA_S3_ENDPOINT', ''),
      accessKeyId: optional('MEDIA_S3_ACCESS_KEY_ID', ''),
      secretAccessKey: optional('MEDIA_S3_SECRET_ACCESS_KEY', ''),
      forcePathStyle: optional('MEDIA_S3_FORCE_PATH_STYLE', 'true') === 'true'
    })
  }),
  smtp: Object.freeze({
    host: optional('SMTP_HOST', ''),
    port: parseIntEnv('SMTP_PORT', 587),
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('SMTP_FROM', ''),
    secure: optional('SMTP_SECURE', 'false') === 'true',
    get enabled() {
      return Boolean(this.host && this.from);
    }
  }),
  sso: Object.freeze({
    oidcEnabled: optional('SSO_OIDC_ENABLED', 'false') === 'true',
    oidcIssuer: optional('SSO_OIDC_ISSUER', ''),
    oidcClientId: optional('SSO_OIDC_CLIENT_ID', ''),
    oidcClientSecret: optional('SSO_OIDC_CLIENT_SECRET', ''),
    oidcRedirectUri: optional('SSO_OIDC_REDIRECT_URI', ''),
    oidcScopes: optional('SSO_OIDC_SCOPES', 'openid email profile'),
    ldapEnabled: optional('SSO_LDAP_ENABLED', 'false') === 'true',
    ldapUrl: optional('SSO_LDAP_URL', ''),
    ldapBindDn: optional('SSO_LDAP_BIND_DN', ''),
    ldapBindPassword: optional('SSO_LDAP_BIND_PASSWORD', ''),
    ldapSearchBase: optional('SSO_LDAP_SEARCH_BASE', ''),
    ldapSearchFilter: optional('SSO_LDAP_SEARCH_FILTER', '(mail={{email}})'),
    ldapTlsRejectUnauthorized: optional('SSO_LDAP_TLS_REJECT_UNAUTHORIZED', 'true') === 'true',
    defaultRole: optional('SSO_DEFAULT_ROLE', 'ophthalmologist'),
    autoProvision: optional('SSO_AUTO_PROVISION', 'false') === 'true',
    defaultClinicId: optional('SSO_DEFAULT_CLINIC_ID', '')
  })
});

/**
 * Parse simple duration strings (e.g. 15m, 7d, 1h) to milliseconds.
 * @param {string} value
 */
function parseDurationMs(value) {
  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration format: ${value}`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

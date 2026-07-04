import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  escapeLdapFilter,
  buildLdapSearchFilter,
  resolveSsoDefaultRole,
  getPublicSsoConfig
} from '../src/services/ssoConfig.js';

describe('SSO config helpers (backlog B4)', () => {
  it('escapes LDAP filter metacharacters', () => {
    expect(escapeLdapFilter('user*@clinic.com')).toBe('user\\2a@clinic.com');
    expect(escapeLdapFilter('(admin)')).toBe('\\28admin\\29');
  });

  it('builds LDAP search filter from email template', () => {
    const filter = buildLdapSearchFilter('(mail={{email}})', 'User@Clinic.COM');
    expect(filter).toBe('(mail=user@clinic.com)');
  });

  it('resolves default SSO role to a valid role', () => {
    expect(resolveSsoDefaultRole('admin')).toBe('admin');
    expect(resolveSsoDefaultRole('not-a-role')).toBe('ophthalmologist');
  });

  it('returns public config with SSO disabled by default in test env', () => {
    const config = getPublicSsoConfig();
    expect(config.oidc.enabled).toBe(false);
    expect(config.ldap.enabled).toBe(false);
  });
});

describe('GET /api/v1/auth/sso/config', () => {
  it('returns public SSO capabilities', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/sso/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.oidc).toBeDefined();
    expect(res.body.data.ldap).toBeDefined();
  });
});

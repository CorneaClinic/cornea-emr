import { test, expect } from '@playwright/test';
import { loadCredentials } from './helpers.js';

test.describe('API auth', () => {
  test('registry routes return 401 without token', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${creds.apiUrl}/api/v1/keratitis-registry/overview`);
    expect(res.status()).toBe(401);
  });

  test('registry routes accept authenticated token', async ({ request }) => {
    const creds = loadCredentials();
    const login = await request.post(`${creds.apiUrl}/api/v1/auth/login`, {
      data: { email: creds.email, password: creds.password }
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    const token = body.accessToken;
    expect(token).toBeTruthy();

    const res = await request.get(`${creds.apiUrl}/api/v1/keratitis-registry/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
  });
});

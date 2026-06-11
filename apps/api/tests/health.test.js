import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /health/live', () => {
  it('returns 200 with ok:true', async () => {
    const app = createApp();
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('cornea-emr-api');
  });
});

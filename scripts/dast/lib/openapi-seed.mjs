/**
 * OpenAPI 3 seed for ZAP API import (read-heavy + safe probe endpoints).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildOpenApiSpec(apiOrigin) {
  const server = apiOrigin.replace(/\/$/, '');
  const paths = {
    '/health/live': { get: { summary: 'Liveness' } },
    '/health': { get: { summary: 'Health with DB' } },
    '/api/v1/auth/me': { get: { summary: 'Current user profile', security: [{ bearer: [] }] } },
    '/api/v1/dashboard/kpis': { get: { summary: 'Institute KPIs', security: [{ bearer: [] }] } },
    '/api/v1/patients': {
      get: { summary: 'List patients', security: [{ bearer: [] }] }
    },
    '/api/v1/visits': {
      get: { summary: 'List visits', security: [{ bearer: [] }] }
    },
    '/api/v1/appointments/day/{date}': {
      get: {
        summary: 'Day schedule',
        security: [{ bearer: [] }],
        parameters: [{ name: 'date', in: 'path', schema: { type: 'string' } }]
      }
    },
    '/api/v1/keratoplasty-patients': {
      get: { summary: 'KP patients', security: [{ bearer: [] }] }
    },
    '/api/v1/corneal-tissues': {
      get: { summary: 'Tissue inventory', security: [{ bearer: [] }] }
    },
    '/api/v1/kc-registry': {
      get: { summary: 'KC registry patients', security: [{ bearer: [] }] }
    },
    '/api/v1/kc-registry/overview': {
      get: { summary: 'KC registry overview', security: [{ bearer: [] }] }
    },
    '/api/v1/keratitis-registry': {
      get: { summary: 'Keratitis cases', security: [{ bearer: [] }] }
    },
    '/api/v1/dry-eye-registry': {
      get: { summary: 'Dry eye registry', security: [{ bearer: [] }] }
    },
    '/api/v1/research-analytics/overview': {
      get: { summary: 'Research overview', security: [{ bearer: [] }] }
    },
    '/api/v1/admin/security/status': {
      get: { summary: 'Admin security status', security: [{ bearer: [] }] }
    },
    '/api/v1/media-library': {
      get: { summary: 'Teaching media library', security: [{ bearer: [] }] }
    }
  };

  return {
    openapi: '3.0.3',
    info: {
      title: 'Cornea EMR DAST seed',
      version: '1.0.0',
      description: 'Generated for OWASP ZAP OpenAPI import during DAST runs.'
    },
    servers: [{ url: server }],
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    paths
  };
}

export function writeOpenApiSeed(apiOrigin, outDir) {
  const spec = buildOpenApiSpec(apiOrigin);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'openapi-dast-seed.json');
  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2), 'utf8');
  return jsonPath;
}

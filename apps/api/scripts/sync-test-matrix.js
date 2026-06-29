/**
 * G5 sync reliability matrix — visits/KP via sync queue; KC/keratitis via REST.
 *
 * Usage (API running): cd apps/api && npm run verify:sync-matrix
 */
import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const API = (process.env.API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TEST_EMAIL = 'e2e-sync-matrix@corneaclinic.local';
const TEST_MRN_PREFIX = 'E2E-MATRIX-';
const DEVICE_ID = 'e2e-sync-matrix-device';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

let passed = 0;
let failed = 0;
let token = '';

function ok(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function uuid() {
  return crypto.randomUUID();
}

async function http(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': DEVICE_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function push(mutations) {
  const { status, body } = await http('POST', '/api/v1/sync/push', {
    deviceId: DEVICE_ID,
    mutations
  });
  if (status !== 200) {
    throw new Error(`push failed (${status}): ${JSON.stringify(body)}`);
  }
  return body.data.results;
}

async function setupUser(clinicId) {
  const password = crypto.randomBytes(18).toString('base64url');
  const hash = await bcrypt.hash(password, 10);
  const existing = await db.query(
    `SELECT id FROM users WHERE clinic_id = $1 AND email = $2`,
    [clinicId, TEST_EMAIL]
  );
  if (existing.rows.length) {
    await db.query(
      `
        UPDATE users
           SET password_hash = $2, role = 'admin', is_active = true,
               failed_login_count = 0, locked_until = NULL,
               must_change_password = false
         WHERE id = $1
      `,
      [existing.rows[0].id, hash]
    );
  } else {
    await db.query(
      `
        INSERT INTO users (clinic_id, email, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, 'E2E Sync Matrix (temporary)', 'admin', true)
      `,
      [clinicId, TEST_EMAIL, hash]
    );
  }
  return password;
}

async function cleanup(clinicId) {
  await db.query(
    `DELETE FROM keratitis_cultures WHERE clinic_id = $1 AND case_id IN
       (SELECT id FROM keratitis_ulcer_cases WHERE clinic_id = $1 AND case_id LIKE 'E2E-MAT-%')`,
    [clinicId]
  );
  await db.query(
    `DELETE FROM keratitis_assessments WHERE clinic_id = $1 AND case_id IN
       (SELECT id FROM keratitis_ulcer_cases WHERE clinic_id = $1 AND case_id LIKE 'E2E-MAT-%')`,
    [clinicId]
  );
  await db.query(
    `DELETE FROM keratitis_ulcer_cases WHERE clinic_id = $1 AND case_id LIKE 'E2E-MAT-%'`,
    [clinicId]
  );
  await db.query(
    `DELETE FROM kc_registry_patients WHERE clinic_id = $1 AND kc_registry_id LIKE 'E2E-MAT-%'`,
    [clinicId]
  );
  await db.query(
    `DELETE FROM keratoplasty_tissues WHERE clinic_id = $1 AND kp_tissue_id LIKE 'E2E-MAT-%'`,
    [clinicId]
  );
  await db.query(
    `DELETE FROM keratoplasty_patients WHERE clinic_id = $1 AND kp_patient_id LIKE 'E2E-MAT-%'`,
    [clinicId]
  );
  await db.query(
    `DELETE FROM visits WHERE clinic_id = $1 AND patient_id IN
       (SELECT id FROM patients WHERE clinic_id = $1 AND mrn LIKE $2)`,
    [clinicId, `${TEST_MRN_PREFIX}%`]
  );
  await db.query(
    `DELETE FROM patients WHERE clinic_id = $1 AND mrn LIKE $2`,
    [clinicId, `${TEST_MRN_PREFIX}%`]
  );
  await db.query(`DELETE FROM client_mutations WHERE clinic_id = $1 AND device_id = $2`, [
    clinicId,
    DEVICE_ID
  ]);
}

async function main() {
  console.log(`\nG5 sync test matrix against ${API}\n`);

  const health = await fetch(`${API}/health/live`).catch(() => null);
  if (!health?.ok) {
    console.error('API is not reachable — start it first (cd apps/api && npm run dev)');
    process.exit(1);
  }

  await db.connect();
  const clinic = await db.query(`SELECT id FROM clinics LIMIT 1`);
  if (!clinic.rows.length) throw new Error('No clinic found');
  const clinicId = clinic.rows[0].id;

  await cleanup(clinicId);
  const password = await setupUser(clinicId);

  try {
    const login = await http('POST', '/api/v1/auth/login', {
      email: TEST_EMAIL,
      password
    });
    ok('auth login', login.status === 200 && !!login.body.accessToken);
    token = login.body.accessToken;

    // --- Sync queue: visit -------------------------------------------------
    const [visitResult] = await push([
      {
        mutationId: uuid(),
        entityType: 'visit',
        operation: 'upsert',
        localId: 770001,
        baseRevision: 0,
        payload: {
          id: 770001,
          patientId: `${TEST_MRN_PREFIX}001`,
          fullName: 'Matrix Visit Test',
          sex: 'Other',
          visitDate: new Date().toISOString().slice(0, 10),
          chiefComplaint: 'G5 matrix — safe to delete'
        }
      }
    ]);
    ok('sync visit upsert', visitResult?.status === 'ok' && !!visitResult?.entityId);

    // --- Sync queue: kp_patient --------------------------------------------
    const [kpResult] = await push([
      {
        mutationId: uuid(),
        entityType: 'kp_patient',
        operation: 'upsert',
        localId: 770002,
        baseRevision: 0,
        payload: {
          id: 770002,
          kpPatientId: 'E2E-MAT-KP-001',
          kpFullName: 'Matrix KP Patient',
          kpEye: 'OD',
          kpDiagnosis: 'Fuchs endothelial dystrophy',
          kpStatus: 'Waiting'
        }
      }
    ]);
    ok('sync kp_patient upsert', kpResult?.status === 'ok' && !!kpResult?.entityId);

    // --- Sync queue: kp_tissue ---------------------------------------------
    const [tissueResult] = await push([
      {
        mutationId: uuid(),
        entityType: 'kp_tissue',
        operation: 'upsert',
        localId: 770003,
        baseRevision: 0,
        payload: {
          id: 770003,
          kpTissueId: 'E2E-MAT-T-001',
          kpTissueStatus: 'Available',
          kpQuarantineStatus: 'Cleared',
          kpEyeBank: 'Matrix Eye Bank'
        }
      }
    ]);
    ok('sync kp_tissue upsert', tissueResult?.status === 'ok' && !!tissueResult?.entityId);

    // --- REST: KC registry -------------------------------------------------
    const kcCreate = await http('POST', '/api/v1/kc-registry', {
      fullName: 'Matrix KC Patient',
      kcRegistryId: 'E2E-MAT-KC-001',
      eyeInvolvement: 'OD',
      diagnosis: 'Keratoconus',
      status: 'Active'
    });
    ok('kc registry create', kcCreate.status === 201 && !!kcCreate.body?.data?.id);
    const kcId = kcCreate.body?.data?.id;

    const kcGet = await http('GET', `/api/v1/kc-registry/${kcId}`);
    ok('kc registry read', kcGet.status === 200 && kcGet.body?.data?.fullName === 'Matrix KC Patient');

    if (kcId) {
      const kcDel = await http('DELETE', `/api/v1/kc-registry/${kcId}`);
      ok('kc registry delete', kcDel.status === 200);
    }

    // --- REST: keratitis registry ------------------------------------------
    const kerCreate = await http('POST', '/api/v1/keratitis-registry', {
      fullName: 'Matrix Keratitis Case',
      caseId: 'E2E-MAT-KER-001',
      eye: 'OS',
      presentationDate: new Date().toISOString().slice(0, 10),
      status: 'Active'
    });
    ok('keratitis registry create', kerCreate.status === 201 && !!kerCreate.body?.data?.id);
    const kerId = kerCreate.body?.data?.id;

    const kerGet = await http('GET', `/api/v1/keratitis-registry/${kerId}`);
    ok(
      'keratitis registry read',
      kerGet.status === 200 && kerGet.body?.data?.fullName === 'Matrix Keratitis Case'
    );
  } finally {
    console.log('\nCleanup:');
    await cleanup(clinicId);
    await db.query(
      `UPDATE users SET is_active = false WHERE clinic_id = $1 AND email = $2`,
      [clinicId, TEST_EMAIL]
    );
    await db.end();
  }

  console.log(`\nMatrix result: ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});

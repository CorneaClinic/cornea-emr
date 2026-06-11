import { query, withTransaction } from '../db/pool.js';
import { ConflictError, ValidationError } from '../core/errors.js';
import { requireUuid, parsePagination, buildPaginationMeta } from '../core/validation.js';
import {
  extractPatientFromPayload,
  stripPatientFromPayload,
  visitToLegacyRecord,
  mapKpPatientToLegacy,
  mapKpTissueToLegacy,
  legacyKpPatientToRow,
  legacyKpTissueToRow
} from './sync-mappers.js';
import { auditMutation } from './auditService.js';

const PULL_LIMIT_MAX = 500;

/**
 * @param {object} params
 */
async function writeSyncLog({ clinicId, userId, deviceId, direction, level, message, details }) {
  await query(
    `
      INSERT INTO sync_logs (clinic_id, user_id, device_id, direction, level, message, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [clinicId, userId, deviceId, direction, level, message, details ?? null]
  );
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {Record<string, unknown>} demographics
 */
async function upsertPatientRow(client, clinicId, demographics) {
  const { rows } = await client.query(
    `
      INSERT INTO patients (clinic_id, mrn, full_name, dob, sex, phone, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (clinic_id, mrn) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        dob = EXCLUDED.dob,
        sex = EXCLUDED.sex,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        revision = patients.revision + 1
      RETURNING *
    `,
    [
      clinicId,
      demographics.mrn,
      demographics.fullName,
      demographics.dob,
      demographics.sex,
      demographics.phone,
      demographics.address
    ]
  );
  return rows[0];
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {string} userId
 * @param {object} mutation
 */
async function applyVisitMutation(client, clinicId, userId, mutation) {
  const { operation, payload, baseRevision, localId, entityId } = mutation;

  if (operation === 'delete') {
    let visitId = entityId;
    if (!visitId && localId != null) {
      const found = await client.query(
        `SELECT id FROM visits WHERE clinic_id = $1 AND legacy_local_id = $2`,
        [clinicId, localId]
      );
      visitId = found.rows[0]?.id;
    }
    if (!visitId) {
      return { entityId: String(localId || ''), revision: null, skipped: true };
    }

    await client.query(
      `
        UPDATE visits
           SET status = 'cancelled', updated_by = $3, revision = revision + 1
         WHERE id = $1 AND clinic_id = $2 AND status != 'cancelled'
      `,
      [visitId, clinicId, userId]
    );

    return { entityId: visitId, revision: null, localId };
  }

  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Visit payload is required');
  }

  const demographics = extractPatientFromPayload(payload);
  const patient = await upsertPatientRow(client, clinicId, demographics);
  const clinicalPayload = stripPatientFromPayload(payload);
  const visitDate = payload.visitDate || new Date().toISOString().slice(0, 10);
  const legacyLocalId = localId != null ? Number(localId) : (payload.id != null ? Number(payload.id) : null);

  let existing = null;
  if (entityId) {
    const byUuid = await client.query(
      `SELECT * FROM visits WHERE id = $1 AND clinic_id = $2`,
      [entityId, clinicId]
    );
    existing = byUuid.rows[0];
  }
  if (!existing && legacyLocalId != null) {
    const byLegacy = await client.query(
      `SELECT * FROM visits WHERE clinic_id = $1 AND legacy_local_id = $2`,
      [clinicId, legacyLocalId]
    );
    existing = byLegacy.rows[0];
  }

  if (existing && baseRevision != null && Number(baseRevision) !== Number(existing.revision)) {
    const serverState = visitToLegacyRecord(patient, existing);
    throw new ConflictError('Visit revision conflict', {
      entityType: 'visit',
      entityId: existing.id,
      expectedRevision: baseRevision,
      serverRevision: existing.revision,
      serverState
    });
  }

  let visitRow;
  if (existing) {
    const updated = await client.query(
      `
        UPDATE visits
           SET patient_id = $3,
               visit_date = $4,
               payload = $5,
               updated_by = $6,
               revision = revision + 1,
               legacy_local_id = COALESCE(legacy_local_id, $7)
         WHERE id = $1 AND clinic_id = $2
        RETURNING *
      `,
      [
        existing.id,
        clinicId,
        patient.id,
        visitDate,
        clinicalPayload,
        userId,
        legacyLocalId
      ]
    );
    visitRow = updated.rows[0];
  } else {
    let resolvedLegacyId = legacyLocalId;
    if (resolvedLegacyId == null || Number.isNaN(resolvedLegacyId)) {
      const maxRes = await client.query(
        `SELECT COALESCE(MAX(legacy_local_id), 0) + 1 AS next_id FROM visits WHERE clinic_id = $1`,
        [clinicId]
      );
      resolvedLegacyId = maxRes.rows[0].next_id;
    }

    const inserted = await client.query(
      `
        INSERT INTO visits (
          clinic_id, patient_id, visit_date, status, payload,
          legacy_local_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, 'finalized', $4, $5, $6, $6)
        RETURNING *
      `,
      [clinicId, patient.id, visitDate, clinicalPayload, resolvedLegacyId, userId]
    );
    visitRow = inserted.rows[0];
  }

  const legacy = visitToLegacyRecord(patient, visitRow);
  return {
    entityId: visitRow.id,
    localId: visitRow.legacy_local_id,
    revision: visitRow.revision,
    serverState: legacy
  };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {object} mutation
 */
async function applyKpPatientMutation(client, clinicId, mutation) {
  const { operation, payload, baseRevision, entityId, localId } = mutation;

  if (operation === 'delete') {
    let id = entityId;
    if (!id && localId != null) {
      const found = await client.query(
        `SELECT id FROM keratoplasty_patients WHERE clinic_id = $1 AND legacy_local_id = $2`,
        [clinicId, localId]
      );
      id = found.rows[0]?.id;
    }
    if (id) {
      await client.query(
        `DELETE FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2`,
        [id, clinicId]
      );
    }
    return { entityId: id || String(localId || ''), revision: null, localId };
  }

  const row = legacyKpPatientToRow(payload, clinicId);
  if (!row.full_name) {
    throw new ValidationError('kpFullName is required');
  }

  let existing = null;
  if (entityId) {
    const res = await client.query(
      `SELECT * FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2`,
      [entityId, clinicId]
    );
    existing = res.rows[0];
  }
  if (!existing && localId != null) {
    const res = await client.query(
      `SELECT * FROM keratoplasty_patients WHERE clinic_id = $1 AND legacy_local_id = $2`,
      [clinicId, localId]
    );
    existing = res.rows[0];
  }

  if (existing && baseRevision != null && Number(baseRevision) !== Number(existing.revision)) {
    throw new ConflictError('Keratoplasty patient revision conflict', {
      entityType: 'kp_patient',
      entityId: existing.id,
      expectedRevision: baseRevision,
      serverRevision: existing.revision,
      serverState: mapKpPatientToLegacy(existing)
    });
  }

  if (!row.kp_patient_id) {
    const last = await client.query(
      `SELECT kp_patient_id FROM keratoplasty_patients WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [clinicId]
    );
    const prev = last.rows[0]?.kp_patient_id || 'KP-P-0000';
    const num = parseInt(String(prev).replace(/\D/g, ''), 10) || 0;
    row.kp_patient_id = `KP-P-${String(num + 1).padStart(4, '0')}`;
  }

  let saved;
  if (existing) {
    const updated = await client.query(
      `
        UPDATE keratoplasty_patients SET
          kp_patient_id = $3, full_name = $4, age = $5, gender = $6, phone = $7, address = $8,
          eye = $9, diagnosis = $10, procedure = $11, prognosis = $12, urgency = $13,
          corneal_size_mm = $14, donor_age_pref = $15, endothelial_req = $16, infection = $17,
          visual_axis = $18, status = $19, reg_date = $20, surgery_date = $21, notes = $22,
          legacy_local_id = COALESCE(legacy_local_id, $23), revision = revision + 1
        WHERE id = $1 AND clinic_id = $2
        RETURNING *
      `,
      [
        existing.id, clinicId, row.kp_patient_id, row.full_name, row.age, row.gender,
        row.phone, row.address, row.eye, row.diagnosis, row.procedure, row.prognosis,
        row.urgency, row.corneal_size_mm, row.donor_age_pref, row.endothelial_req,
        row.infection, row.visual_axis, row.status, row.reg_date, row.surgery_date,
        row.notes, row.legacy_local_id
      ]
    );
    saved = updated.rows[0];
  } else {
    const inserted = await client.query(
      `
        INSERT INTO keratoplasty_patients (
          clinic_id, kp_patient_id, full_name, age, gender, phone, address, eye, diagnosis,
          procedure, prognosis, urgency, corneal_size_mm, donor_age_pref, endothelial_req,
          infection, visual_axis, status, reg_date, surgery_date, notes, legacy_local_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING *
      `,
      [
        clinicId, row.kp_patient_id, row.full_name, row.age, row.gender, row.phone,
        row.address, row.eye, row.diagnosis, row.procedure, row.prognosis, row.urgency,
        row.corneal_size_mm, row.donor_age_pref, row.endothelial_req, row.infection,
        row.visual_axis, row.status, row.reg_date, row.surgery_date, row.notes, row.legacy_local_id
      ]
    );
    saved = inserted.rows[0];
  }

  return {
    entityId: saved.id,
    localId: saved.legacy_local_id,
    revision: saved.revision,
    serverState: mapKpPatientToLegacy(saved)
  };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {object} mutation
 */
async function applyKpTissueMutation(client, clinicId, mutation) {
  const { operation, payload, baseRevision, entityId, localId } = mutation;

  if (operation === 'delete') {
    let id = entityId;
    if (!id && localId != null) {
      const found = await client.query(
        `SELECT id FROM corneal_tissues WHERE clinic_id = $1 AND legacy_local_id = $2`,
        [clinicId, localId]
      );
      id = found.rows[0]?.id;
    }
    if (id) {
      await client.query(`DELETE FROM corneal_tissues WHERE id = $1 AND clinic_id = $2`, [id, clinicId]);
    }
    return { entityId: id || String(localId || ''), revision: null, localId };
  }

  const row = legacyKpTissueToRow(payload, clinicId);

  let existing = null;
  if (entityId) {
    const res = await client.query(
      `SELECT * FROM corneal_tissues WHERE id = $1 AND clinic_id = $2`,
      [entityId, clinicId]
    );
    existing = res.rows[0];
  }
  if (!existing && localId != null) {
    const res = await client.query(
      `SELECT * FROM corneal_tissues WHERE clinic_id = $1 AND legacy_local_id = $2`,
      [clinicId, localId]
    );
    existing = res.rows[0];
  }

  if (existing && baseRevision != null && Number(baseRevision) !== Number(existing.revision)) {
    throw new ConflictError('Corneal tissue revision conflict', {
      entityType: 'kp_tissue',
      entityId: existing.id,
      expectedRevision: baseRevision,
      serverRevision: existing.revision,
      serverState: mapKpTissueToLegacy(existing)
    });
  }

  if (!row.kp_tissue_id) {
    const last = await client.query(
      `SELECT kp_tissue_id FROM corneal_tissues WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [clinicId]
    );
    const prev = last.rows[0]?.kp_tissue_id || 'KP-T-0000';
    const num = parseInt(String(prev).replace(/\D/g, ''), 10) || 0;
    row.kp_tissue_id = `KP-T-${String(num + 1).padStart(4, '0')}`;
  }

  let saved;
  if (existing) {
    const updated = await client.query(
      `
        UPDATE corneal_tissues SET
          kp_tissue_id = $3, donor_age = $4, donor_gender = $5, death_to_preservation_hrs = $6,
          preservation_date = $7, expiry_date = $8, specular_count = $9, edema = $10,
          clarity = $11, infection_risk = $12, optical_grade = $13, therapeutic_grade = $14,
          tissue_status = $15, storage_medium = $16, storage_location = $17, eye_bank = $18,
          legacy_local_id = COALESCE(legacy_local_id, $19), revision = revision + 1
        WHERE id = $1 AND clinic_id = $2
        RETURNING *
      `,
      [
        existing.id, clinicId, row.kp_tissue_id, row.donor_age, row.donor_gender,
        row.death_to_preservation_hrs, row.preservation_date, row.expiry_date,
        row.specular_count, row.edema, row.clarity, row.infection_risk, row.optical_grade,
        row.therapeutic_grade, row.tissue_status, row.storage_medium, row.storage_location,
        row.eye_bank, row.legacy_local_id
      ]
    );
    saved = updated.rows[0];
  } else {
    const inserted = await client.query(
      `
        INSERT INTO corneal_tissues (
          clinic_id, kp_tissue_id, donor_age, donor_gender, death_to_preservation_hrs,
          preservation_date, expiry_date, specular_count, edema, clarity, infection_risk,
          optical_grade, therapeutic_grade, tissue_status, storage_medium, storage_location,
          eye_bank, legacy_local_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING *
      `,
      [
        clinicId, row.kp_tissue_id, row.donor_age, row.donor_gender,
        row.death_to_preservation_hrs, row.preservation_date, row.expiry_date,
        row.specular_count, row.edema, row.clarity, row.infection_risk, row.optical_grade,
        row.therapeutic_grade, row.tissue_status, row.storage_medium, row.storage_location,
        row.eye_bank, row.legacy_local_id
      ]
    );
    saved = inserted.rows[0];
  }

  return {
    entityId: saved.id,
    localId: saved.legacy_local_id,
    revision: saved.revision,
    serverState: mapKpTissueToLegacy(saved)
  };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {object} mutation
 */
async function applyKpReserveMutation(client, clinicId, mutation) {
  const { payload } = mutation;
  const patientId = payload?.kpPatientUuid || payload?.patientUuid;
  const tissueId = payload?.kpTissueUuid || payload?.tissueUuid;
  requireUuid(patientId, 'kpPatientUuid');
  requireUuid(tissueId, 'kpTissueUuid');

  const p = await client.query(
    `SELECT * FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
    [patientId, clinicId]
  );
  const t = await client.query(
    `SELECT * FROM corneal_tissues WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
    [tissueId, clinicId]
  );

  if (!p.rows[0] || !t.rows[0]) {
    throw new ValidationError('Keratoplasty patient or tissue not found');
  }
  if (t.rows[0].tissue_status !== 'Available') {
    throw new ConflictError('Tissue is not available for reservation', {
      tissueStatus: t.rows[0].tissue_status
    });
  }

  await client.query(
    `
      UPDATE corneal_tissues
         SET tissue_status = 'Reserved',
             reserved_kp_patient_id = $2,
             reserved_for_kp_patient_id = $3,
             revision = revision + 1
       WHERE id = $1
    `,
    [tissueId, p.rows[0].id, p.rows[0].kp_patient_id]
  );

  await client.query(
    `
      UPDATE keratoplasty_patients
         SET status = 'Matched',
             recommended_tissue_id = $2,
             revision = revision + 1
       WHERE id = $1
    `,
    [patientId, tissueId]
  );

  return {
    entityId: tissueId,
    revision: t.rows[0].revision + 1,
    serverState: { tissueId, patientId }
  };
}

/**
 * @param {import('express').Request} req
 * @param {object} body
 */
export async function pushMutations(req, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const deviceId = String(body.deviceId || req.headers['x-device-id'] || 'unknown').trim();
  const mutations = body.mutations;

  if (!Array.isArray(mutations) || !mutations.length) {
    throw new ValidationError('mutations array is required');
  }
  if (mutations.length > 100) {
    throw new ValidationError('Maximum 100 mutations per push batch');
  }

  const results = [];

  for (const raw of mutations) {
    const mutationId = raw.mutationId || raw.mutation_id;
    if (!mutationId) {
      results.push({ status: 'error', error: 'mutationId is required' });
      continue;
    }

    const cached = await query(
      `SELECT status, result FROM client_mutations WHERE mutation_id = $1 AND clinic_id = $2`,
      [mutationId, clinicId]
    );
    if (cached.rows[0]) {
      results.push({ mutationId, status: 'ok', replay: true, ...cached.rows[0].result });
      continue;
    }

    try {
      const outcome = await withTransaction(async (client) => {
        let applied;
        switch (raw.entityType) {
          case 'visit':
            applied = await applyVisitMutation(client, clinicId, userId, raw);
            break;
          case 'kp_patient':
            applied = await applyKpPatientMutation(client, clinicId, raw);
            break;
          case 'kp_tissue':
            applied = await applyKpTissueMutation(client, clinicId, raw);
            break;
          case 'kp_reserve':
            applied = await applyKpReserveMutation(client, clinicId, raw);
            break;
          default:
            throw new ValidationError(`Unsupported entityType: ${raw.entityType}`);
        }
        return applied;
      });

      const resultPayload = {
        mutationId,
        status: 'ok',
        entityType: raw.entityType,
        entityId: outcome.entityId,
        localId: outcome.localId,
        revision: outcome.revision,
        serverState: outcome.serverState
      };

      await query(
        `
          INSERT INTO client_mutations (
            mutation_id, clinic_id, user_id, device_id,
            entity_type, entity_id, operation, status, result
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'applied', $8)
        `,
        [
          mutationId,
          clinicId,
          userId,
          deviceId,
          raw.entityType,
          String(outcome.entityId || ''),
          raw.operation,
          resultPayload
        ]
      );

      results.push(resultPayload);
    } catch (err) {
      if (err instanceof ConflictError) {
        const conflictResult = {
          mutationId,
          status: 'conflict',
          entityType: raw.entityType,
          error: err.message,
          details: err.details
        };

        await query(
          `
            INSERT INTO client_mutations (
              mutation_id, clinic_id, user_id, device_id,
              entity_type, entity_id, operation, status, result
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'conflict', $8)
          `,
          [
            mutationId,
            clinicId,
            userId,
            deviceId,
            raw.entityType,
            String(raw.entityId || raw.localId || ''),
            raw.operation,
            conflictResult
          ]
        );

        await query(
          `
            INSERT INTO sync_conflicts (
              clinic_id, user_id, device_id, entity_type, entity_id,
              client_mutation_id, client_revision, server_revision,
              client_state, server_state
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            clinicId,
            userId,
            deviceId,
            raw.entityType,
            String(err.details?.entityId || raw.entityId || raw.localId || ''),
            mutationId,
            raw.baseRevision ?? null,
            err.details?.serverRevision ?? null,
            raw.payload ?? null,
            err.details?.serverState ?? null
          ]
        );

        results.push(conflictResult);
        continue;
      }

      results.push({
        mutationId,
        status: 'error',
        error: err.message || 'Push failed'
      });
    }
  }

  await query(
    `
      INSERT INTO sync_cursors (clinic_id, user_id, device_id, last_push_at, updated_at)
      VALUES ($1, $2, $3, now(), now())
      ON CONFLICT (clinic_id, user_id, device_id) DO UPDATE SET
        last_push_at = now(),
        updated_at = now()
    `,
    [clinicId, userId, deviceId]
  );

  await writeSyncLog({
    clinicId,
    userId,
    deviceId,
    direction: 'push',
    level: 'info',
    message: `Processed ${mutations.length} mutation(s)`,
    details: {
      ok: results.filter((r) => r.status === 'ok').length,
      conflicts: results.filter((r) => r.status === 'conflict').length,
      errors: results.filter((r) => r.status === 'error').length
    }
  });

  if (req.audit?.log) {
    await req.audit.log({
      entityType: 'sync',
      entityId: deviceId,
      action: 'push',
      diff: { count: mutations.length }
    });
  }

  return { results, serverTime: new Date().toISOString() };
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const EPOCH_TS = '1970-01-01T00:00:00.000000Z';
const PULL_CURSOR_VERSION = 2;
const PULL_ENTITY_TYPES = ['visit', 'kp_patient', 'kp_tissue'];

/**
 * Parse a pull cursor. v2 cursors carry a per-table (timestamp, id) keyset
 * boundary so pagination never skips rows — even when many rows share the
 * same updated_at (bulk writes in one transaction). Legacy cursors (plain
 * ISO timestamp) are upgraded by applying the timestamp to every table.
 * @param {string} cursorToken
 */
function parsePullCursor(cursorToken) {
  const fresh = () => ({ ts: EPOCH_TS, id: ZERO_UUID });
  const bounds = {
    visit: fresh(),
    kp_patient: fresh(),
    kp_tissue: fresh()
  };

  if (!cursorToken || cursorToken === '0') return bounds;

  if (cursorToken.startsWith('{')) {
    try {
      const parsed = JSON.parse(cursorToken);
      if (parsed?.v === PULL_CURSOR_VERSION) {
        for (const type of PULL_ENTITY_TYPES) {
          if (typeof parsed[type]?.ts === 'string' && typeof parsed[type]?.id === 'string') {
            bounds[type] = { ts: parsed[type].ts, id: parsed[type].id };
          }
        }
        return bounds;
      }
    } catch (_) {
      // fall through to legacy handling
    }
  }

  const legacy = new Date(cursorToken);
  if (!Number.isNaN(legacy.getTime())) {
    const ts = legacy.toISOString();
    for (const type of PULL_ENTITY_TYPES) {
      bounds[type] = { ts, id: ZERO_UUID };
    }
  }
  return bounds;
}

/**
 * @param {Record<string, { ts: string, id: string }>} bounds
 */
function serializePullCursor(bounds) {
  return JSON.stringify({
    v: PULL_CURSOR_VERSION,
    visit: bounds.visit,
    kp_patient: bounds.kp_patient,
    kp_tissue: bounds.kp_tissue
  });
}

// Microsecond-precision text timestamp for exact cursor round-trips
// (JS Date truncates to milliseconds, which would re-deliver or skip rows).
const CURSOR_TS_VISIT = `to_char(v.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const CURSOR_TS_PLAIN = `to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/**
 * @param {string} clinicId
 * @param {string} cursorToken
 * @param {number} limit
 */
async function collectChangesSince(clinicId, cursorToken, limit) {
  const bounds = parsePullCursor(cursorToken);
  const entries = [];
  let overflow = false;

  const visits = await query(
    `
      SELECT v.*, p.mrn, p.full_name, p.dob, p.sex, p.phone, p.address,
             ${CURSOR_TS_VISIT} AS cursor_ts
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
       WHERE v.clinic_id = $1
         AND (v.updated_at, v.id) > ($2::timestamptz, $3::uuid)
       ORDER BY v.updated_at ASC, v.id ASC
       LIMIT $4
    `,
    [clinicId, bounds.visit.ts, bounds.visit.id, limit + 1]
  );

  const visitRows = visits.rows.slice(0, limit);
  if (visits.rows.length > limit) overflow = true;

  for (const row of visitRows) {
    const patient = {
      mrn: row.mrn,
      full_name: row.full_name,
      dob: row.dob,
      sex: row.sex,
      phone: row.phone,
      address: row.address
    };
    const tombstone = row.status === 'cancelled';
    entries.push({
      entityType: 'visit',
      cursorTs: row.cursor_ts,
      rowId: row.id,
      tombstone,
      change: tombstone
        ? {
            entityType: 'visit',
            entityId: row.id,
            localId: row.legacy_local_id
          }
        : {
            entityType: 'visit',
            operation: 'upsert',
            entityId: row.id,
            localId: row.legacy_local_id,
            revision: row.revision,
            updatedAt: row.updated_at,
            data: visitToLegacyRecord(patient, row)
          }
    });
  }

  const kpPatients = await query(
    `
      SELECT *, ${CURSOR_TS_PLAIN} AS cursor_ts
        FROM keratoplasty_patients
       WHERE clinic_id = $1
         AND (updated_at, id) > ($2::timestamptz, $3::uuid)
       ORDER BY updated_at ASC, id ASC
       LIMIT $4
    `,
    [clinicId, bounds.kp_patient.ts, bounds.kp_patient.id, limit + 1]
  );

  const kpPatientRows = kpPatients.rows.slice(0, limit);
  if (kpPatients.rows.length > limit) overflow = true;

  for (const row of kpPatientRows) {
    entries.push({
      entityType: 'kp_patient',
      cursorTs: row.cursor_ts,
      rowId: row.id,
      tombstone: false,
      change: {
        entityType: 'kp_patient',
        operation: 'upsert',
        entityId: row.id,
        localId: row.legacy_local_id,
        revision: row.revision,
        updatedAt: row.updated_at,
        data: mapKpPatientToLegacy(row)
      }
    });
  }

  const kpTissues = await query(
    `
      SELECT *, ${CURSOR_TS_PLAIN} AS cursor_ts
        FROM corneal_tissues
       WHERE clinic_id = $1
         AND (updated_at, id) > ($2::timestamptz, $3::uuid)
       ORDER BY updated_at ASC, id ASC
       LIMIT $4
    `,
    [clinicId, bounds.kp_tissue.ts, bounds.kp_tissue.id, limit + 1]
  );

  const kpTissueRows = kpTissues.rows.slice(0, limit);
  if (kpTissues.rows.length > limit) overflow = true;

  for (const row of kpTissueRows) {
    entries.push({
      entityType: 'kp_tissue',
      cursorTs: row.cursor_ts,
      rowId: row.id,
      tombstone: false,
      change: {
        entityType: 'kp_tissue',
        operation: 'upsert',
        entityId: row.id,
        localId: row.legacy_local_id,
        revision: row.revision,
        updatedAt: row.updated_at,
        data: mapKpTissueToLegacy(row)
      }
    });
  }

  entries.sort((a, b) => {
    if (a.cursorTs !== b.cursorTs) return a.cursorTs < b.cursorTs ? -1 : 1;
    if (a.rowId !== b.rowId) return a.rowId < b.rowId ? -1 : 1;
    return 0;
  });

  // The cursor must only advance past rows actually included in this page —
  // computing it before slicing would silently skip the sliced-off rows.
  const page = entries.slice(0, limit);
  const hasMore = overflow || entries.length > limit;

  const nextBounds = {
    visit: { ...bounds.visit },
    kp_patient: { ...bounds.kp_patient },
    kp_tissue: { ...bounds.kp_tissue }
  };
  for (const entry of page) {
    nextBounds[entry.entityType] = { ts: entry.cursorTs, id: entry.rowId };
  }

  return {
    changes: page.filter((e) => !e.tombstone).map((e) => e.change),
    deleted: page.filter((e) => e.tombstone).map((e) => e.change),
    nextCursor: serializePullCursor(nextBounds),
    hasMore
  };
}

/**
 * @param {import('express').Request} req
 * @param {Record<string, unknown>} queryParams
 */
export async function pullChanges(req, queryParams) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const deviceId = String(queryParams.deviceId || req.headers['x-device-id'] || 'unknown').trim();
  const limit = Math.min(
    PULL_LIMIT_MAX,
    Math.max(1, parseInt(String(queryParams.limit || PULL_LIMIT_MAX), 10) || PULL_LIMIT_MAX)
  );
  const cursor = String(queryParams.cursor || '0');

  const { changes, deleted, nextCursor, hasMore } = await collectChangesSince(clinicId, cursor, limit);

  await query(
    `
      INSERT INTO sync_cursors (clinic_id, user_id, device_id, cursor_token, last_pull_at, updated_at)
      VALUES ($1, $2, $3, $4, now(), now())
      ON CONFLICT (clinic_id, user_id, device_id) DO UPDATE SET
        cursor_token = EXCLUDED.cursor_token,
        last_pull_at = now(),
        updated_at = now()
    `,
    [clinicId, userId, deviceId, nextCursor]
  );

  await writeSyncLog({
    clinicId,
    userId,
    deviceId,
    direction: 'pull',
    level: 'info',
    message: `Pulled ${changes.length} change(s)`,
    details: { deleted: deleted.length, cursor: nextCursor }
  });

  return {
    cursor: nextCursor,
    changes,
    deleted,
    hasMore,
    serverTime: new Date().toISOString()
  };
}

/**
 * @param {string} clinicId
 * @param {string} userId
 * @param {string} deviceId
 */
export async function getSyncStatus(clinicId, userId, deviceId) {
  const conflicts = await query(
    `
      SELECT id, entity_type, entity_id, client_mutation_id, server_revision, created_at
        FROM sync_conflicts
       WHERE clinic_id = $1 AND status = 'open'
       ORDER BY created_at DESC
       LIMIT 50
    `,
    [clinicId]
  );

  const cursor = await query(
    `
      SELECT cursor_token, last_pull_at, last_push_at, updated_at
        FROM sync_cursors
       WHERE clinic_id = $1 AND user_id = $2 AND device_id = $3
    `,
    [clinicId, userId, deviceId]
  );

  return {
    openConflicts: conflicts.rows.length,
    conflicts: conflicts.rows,
    cursor: cursor.rows[0] || null,
    serverTime: new Date().toISOString()
  };
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listSyncLogs(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams, { defaultLimit: 50 });
  const params = [clinicId];

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM sync_logs WHERE clinic_id = $1`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT id, direction, level, message, details, device_id, created_at
        FROM sync_logs
       WHERE clinic_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3
    `,
    params
  );

  return {
    data: rows,
    pagination: buildPaginationMeta(countResult.rows[0].total, page, limit)
  };
}

/**
 * @param {import('express').Request} req
 * @param {object} body
 */
export async function resolveConflict(req, body) {
  const clinicId = req.user.clinicId;
  const conflictId = body.conflictId;
  const resolution = body.resolution;

  requireUuid(conflictId, 'conflictId');
  if (!['server', 'client', 'dismiss'].includes(resolution)) {
    throw new ValidationError('resolution must be server, client, or dismiss');
  }

  const statusMap = {
    server: 'resolved_server',
    client: 'resolved_client',
    dismiss: 'dismissed'
  };

  const { rows } = await query(
    `
      UPDATE sync_conflicts
         SET status = $3, resolved_at = now()
       WHERE id = $1 AND clinic_id = $2 AND status = 'open'
      RETURNING *
    `,
    [conflictId, clinicId, statusMap[resolution]]
  );

  if (!rows[0]) {
    throw new ValidationError('Conflict not found or already resolved');
  }

  await writeSyncLog({
    clinicId,
    userId: req.user.sub,
    deviceId: body.deviceId || null,
    direction: 'conflict',
    level: 'info',
    message: `Conflict resolved (${resolution})`,
    details: { conflictId, entityType: rows[0].entity_type }
  });

  return { success: true, conflict: rows[0] };
}

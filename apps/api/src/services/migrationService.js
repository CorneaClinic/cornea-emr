import crypto from 'crypto';
import { query, withTransaction } from '../db/pool.js';
import {
  extractPatientFromPayload,
  stripPatientFromPayload,
  legacyKpPatientToRow,
  legacyKpTissueToRow
} from './sync-mappers.js';

const EXPORT_VERSION = '1.0';

/**
 * Normalize export input — full bundle or legacy visits array.
 * @param {unknown} raw
 */
export function normalizeExportBundle(raw) {
  if (Array.isArray(raw)) {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      source: 'legacy-array',
      dbVersion: null,
      patients: raw,
      kpPatients: [],
      kpTissues: []
    };
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Export must be a JSON object or array of visit records');
  }

  const bundle = /** @type {Record<string, unknown>} */ (raw);

  if (Array.isArray(bundle.patients)) {
    return {
      version: String(bundle.version || EXPORT_VERSION),
      exportedAt: bundle.exportedAt || bundle.exported_at || new Date().toISOString(),
      source: String(bundle.source || 'CorneaClinicDB'),
      dbVersion: bundle.dbVersion ?? bundle.db_version ?? null,
      checksums: bundle.checksums || null,
      patients: bundle.patients,
      kpPatients: Array.isArray(bundle.kpPatients) ? bundle.kpPatients : [],
      kpTissues: Array.isArray(bundle.kpTissues) ? bundle.kpTissues : []
    };
  }

  throw new Error('Export bundle must include a "patients" array');
}

/**
 * @param {unknown} value
 */
function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * @param {ReturnType<typeof normalizeExportBundle>} bundle
 */
export function computeBundleChecksums(bundle) {
  return {
    patients: sha256(bundle.patients),
    kpPatients: sha256(bundle.kpPatients),
    kpTissues: sha256(bundle.kpTissues),
    bundle: sha256({
      patients: bundle.patients,
      kpPatients: bundle.kpPatients,
      kpTissues: bundle.kpTissues
    })
  };
}

/**
 * @param {ReturnType<typeof normalizeExportBundle>} bundle
 */
export function validateExportBundle(bundle) {
  const errors = [];
  const warnings = [];

  if (!bundle.patients.length && !bundle.kpPatients.length && !bundle.kpTissues.length) {
    warnings.push('Export bundle is empty');
  }

  for (const [index, record] of bundle.patients.entries()) {
    if (!record || typeof record !== 'object') {
      errors.push({ entity: 'visit', index, reason: 'Invalid record object' });
      continue;
    }
    if (!String(record.patientId || '').trim()) {
      errors.push({
        entity: 'visit',
        index,
        localId: record.id,
        reason: 'Missing patientId (MRN)'
      });
    }
  }

  if (bundle.checksums) {
    const computed = computeBundleChecksums(bundle);
    for (const key of ['patients', 'kpPatients', 'kpTissues', 'bundle']) {
      if (bundle.checksums[key] && bundle.checksums[key] !== computed[key]) {
        errors.push({
          entity: 'checksum',
          field: key,
          reason: 'Checksum mismatch — export may be corrupted'
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * @param {ReturnType<typeof normalizeExportBundle>} bundle
 */
export function detectDuplicatesInExport(bundle) {
  const withinExport = [];

  const visitLocalIds = new Map();
  const visitUuids = new Map();
  const visitComposite = new Map();

  for (const record of bundle.patients) {
    if (record.id != null) {
      const key = String(record.id);
      if (visitLocalIds.has(key)) {
        withinExport.push({
          entity: 'visit',
          type: 'duplicate_local_id',
          value: key,
          indices: [visitLocalIds.get(key), record]
        });
      } else {
        visitLocalIds.set(key, record);
      }
    }

    if (record.uuid) {
      const key = String(record.uuid);
      if (visitUuids.has(key)) {
        withinExport.push({
          entity: 'visit',
          type: 'duplicate_uuid',
          value: key
        });
      } else {
        visitUuids.set(key, record);
      }
    }

    const composite = `${record.patientId}|${record.visitDate || ''}|${record.fullName || ''}`;
    if (visitComposite.has(composite)) {
      withinExport.push({
        entity: 'visit',
        type: 'duplicate_mrn_date_name',
        value: composite,
        localIds: [visitComposite.get(composite)?.id, record.id]
      });
    } else {
      visitComposite.set(composite, record);
    }
  }

  const kpPatientIds = new Map();
  for (const record of bundle.kpPatients) {
    if (!record.kpPatientId) continue;
    const key = String(record.kpPatientId);
    if (kpPatientIds.has(key)) {
      withinExport.push({
        entity: 'kp_patient',
        type: 'duplicate_kp_patient_id',
        value: key
      });
    } else {
      kpPatientIds.set(key, record);
    }
  }

  const kpTissueIds = new Map();
  for (const record of bundle.kpTissues) {
    if (!record.kpTissueId) continue;
    const key = String(record.kpTissueId);
    if (kpTissueIds.has(key)) {
      withinExport.push({
        entity: 'kp_tissue',
        type: 'duplicate_kp_tissue_id',
        value: key
      });
    } else {
      kpTissueIds.set(key, record);
    }
  }

  return withinExport;
}

/**
 * @param {string} clinicId
 * @param {ReturnType<typeof normalizeExportBundle>} bundle
 */
export async function detectDuplicatesAgainstDatabase(clinicId, bundle) {
  const againstDatabase = [];

  for (const record of bundle.patients) {
    if (record.id != null) {
      const { rows } = await query(
        `SELECT id, legacy_local_id FROM visits WHERE clinic_id = $1 AND legacy_local_id = $2`,
        [clinicId, record.id]
      );
      if (rows[0]) {
        againstDatabase.push({
          entity: 'visit',
          type: 'existing_legacy_local_id',
          localId: record.id,
          serverId: rows[0].id
        });
      }
    }
    if (record.uuid) {
      const { rows } = await query(
        `SELECT id FROM visits WHERE clinic_id = $1 AND id = $2`,
        [clinicId, record.uuid]
      );
      if (rows[0]) {
        againstDatabase.push({
          entity: 'visit',
          type: 'existing_uuid',
          uuid: record.uuid,
          serverId: rows[0].id
        });
      }
    }
  }

  for (const record of bundle.kpPatients) {
    if (!record.kpPatientId) continue;
    const { rows } = await query(
      `SELECT id FROM keratoplasty_patients WHERE clinic_id = $1 AND kp_patient_id = $2`,
      [clinicId, record.kpPatientId]
    );
    if (rows[0]) {
      againstDatabase.push({
        entity: 'kp_patient',
        type: 'existing_kp_patient_id',
        kpPatientId: record.kpPatientId,
        serverId: rows[0].id
      });
    }
  }

  for (const record of bundle.kpTissues) {
    if (!record.kpTissueId) continue;
    const { rows } = await query(
      `SELECT id FROM corneal_tissues WHERE clinic_id = $1 AND kp_tissue_id = $2`,
      [clinicId, record.kpTissueId]
    );
    if (rows[0]) {
      againstDatabase.push({
        entity: 'kp_tissue',
        type: 'existing_kp_tissue_id',
        kpTissueId: record.kpTissueId,
        serverId: rows[0].id
      });
    }
  }

  return againstDatabase;
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
 * @param {Record<string, unknown>} record
 * @param {{ skipExisting: boolean, forceUpdate: boolean }} options
 */
async function importVisitRecord(client, clinicId, userId, record, options) {
  const legacyLocalId = record.id != null ? Number(record.id) : null;
  const entityId = record.uuid || null;

  let existing = null;
  if (entityId) {
    const res = await client.query(
      `SELECT * FROM visits WHERE id = $1 AND clinic_id = $2`,
      [entityId, clinicId]
    );
    existing = res.rows[0];
  }
  if (!existing && legacyLocalId != null) {
    const res = await client.query(
      `SELECT * FROM visits WHERE clinic_id = $1 AND legacy_local_id = $2`,
      [clinicId, legacyLocalId]
    );
    existing = res.rows[0];
  }

  if (existing && options.skipExisting && !options.forceUpdate) {
    return { action: 'skipped', entityId: existing.id, localId: existing.legacy_local_id, reason: 'already_exists' };
  }

  const demographics = extractPatientFromPayload(record);
  const patient = await upsertPatientRow(client, clinicId, demographics);
  const clinicalPayload = stripPatientFromPayload(record);
  const visitDate = record.visitDate || new Date().toISOString().slice(0, 10);

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
      [existing.id, clinicId, patient.id, visitDate, clinicalPayload, userId, legacyLocalId]
    );
    return {
      action: 'updated',
      entityId: updated.rows[0].id,
      localId: updated.rows[0].legacy_local_id,
      revision: updated.rows[0].revision
    };
  }

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

  return {
    action: 'inserted',
    entityId: inserted.rows[0].id,
    localId: inserted.rows[0].legacy_local_id,
    revision: inserted.rows[0].revision
  };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {Record<string, unknown>} record
 * @param {{ skipExisting: boolean, forceUpdate: boolean }} options
 */
async function importKpPatientRecord(client, clinicId, record, options) {
  const row = legacyKpPatientToRow(record, clinicId);
  if (!row.full_name) {
    throw new Error('kpFullName is required');
  }

  let existing = null;
  if (record.uuid) {
    const res = await client.query(
      `SELECT * FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2`,
      [record.uuid, clinicId]
    );
    existing = res.rows[0];
  }
  if (!existing && row.kp_patient_id) {
    const res = await client.query(
      `SELECT * FROM keratoplasty_patients WHERE clinic_id = $1 AND kp_patient_id = $2`,
      [clinicId, row.kp_patient_id]
    );
    existing = res.rows[0];
  }
  if (!existing && row.legacy_local_id != null) {
    const res = await client.query(
      `SELECT * FROM keratoplasty_patients WHERE clinic_id = $1 AND legacy_local_id = $2`,
      [clinicId, row.legacy_local_id]
    );
    existing = res.rows[0];
  }

  if (existing && options.skipExisting && !options.forceUpdate) {
    return { action: 'skipped', entityId: existing.id, localId: existing.legacy_local_id, reason: 'already_exists' };
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
    return { action: 'updated', entityId: updated.rows[0].id, localId: updated.rows[0].legacy_local_id };
  }

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
  return { action: 'inserted', entityId: inserted.rows[0].id, localId: inserted.rows[0].legacy_local_id };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {Record<string, unknown>} record
 * @param {{ skipExisting: boolean, forceUpdate: boolean }} options
 */
async function importKpTissueRecord(client, clinicId, record, options) {
  const row = legacyKpTissueToRow(record, clinicId);

  let existing = null;
  if (record.uuid) {
    const res = await client.query(
      `SELECT * FROM corneal_tissues WHERE id = $1 AND clinic_id = $2`,
      [record.uuid, clinicId]
    );
    existing = res.rows[0];
  }
  if (!existing && row.kp_tissue_id) {
    const res = await client.query(
      `SELECT * FROM corneal_tissues WHERE clinic_id = $1 AND kp_tissue_id = $2`,
      [clinicId, row.kp_tissue_id]
    );
    existing = res.rows[0];
  }

  if (existing && options.skipExisting && !options.forceUpdate) {
    return { action: 'skipped', entityId: existing.id, localId: existing.legacy_local_id, reason: 'already_exists' };
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
    return { action: 'updated', entityId: updated.rows[0].id, localId: updated.rows[0].legacy_local_id };
  }

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
  return { action: 'inserted', entityId: inserted.rows[0].id, localId: inserted.rows[0].legacy_local_id };
}

/**
 * @param {string} clinicId
 */
export async function getDatabaseCounts(clinicId) {
  const [visits, patients, kpPatients, kpTissues] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM visits WHERE clinic_id = $1 AND status != 'cancelled'`, [clinicId]),
    query(`SELECT COUNT(*)::int AS c FROM patients WHERE clinic_id = $1`, [clinicId]),
    query(`SELECT COUNT(*)::int AS c FROM keratoplasty_patients WHERE clinic_id = $1`, [clinicId]),
    query(`SELECT COUNT(*)::int AS c FROM corneal_tissues WHERE clinic_id = $1`, [clinicId])
  ]);

  return {
    visits: visits.rows[0].c,
    patients: patients.rows[0].c,
    kpPatients: kpPatients.rows[0].c,
    kpTissues: kpTissues.rows[0].c
  };
}

/**
 * @param {object} options
 * @param {unknown} options.bundle
 * @param {string} options.clinicId
 * @param {string} options.userId
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.skipExisting]
 * @param {boolean} [options.forceUpdate]
 */
export async function runMigration(options) {
  const {
    bundle: rawBundle,
    clinicId,
    userId,
    dryRun = false,
    skipExisting = true,
    forceUpdate = false
  } = options;

  const bundle = normalizeExportBundle(rawBundle);
  const checksums = computeBundleChecksums(bundle);
  const validation = validateExportBundle(bundle);
  const duplicatesWithin = detectDuplicatesInExport(bundle);
  const countsBefore = await getDatabaseCounts(clinicId);
  const duplicatesAgainst = await detectDuplicatesAgainstDatabase(clinicId, bundle);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'import',
    clinicId,
    userId,
    source: {
      version: bundle.version,
      exportedAt: bundle.exportedAt,
      source: bundle.source,
      dbVersion: bundle.dbVersion,
      counts: {
        visits: bundle.patients.length,
        kpPatients: bundle.kpPatients.length,
        kpTissues: bundle.kpTissues.length
      },
      checksums
    },
    validation,
    duplicates: {
      withinExport: duplicatesWithin,
      againstDatabase: duplicatesAgainst
    },
    import: {
      visits: { inserted: 0, updated: 0, skipped: 0, failed: 0, items: [] },
      kpPatients: { inserted: 0, updated: 0, skipped: 0, failed: 0, items: [] },
      kpTissues: { inserted: 0, updated: 0, skipped: 0, failed: 0, items: [] }
    },
    failures: [],
    idMappings: { visits: [], kpPatients: [], kpTissues: [] },
    database: {
      before: countsBefore,
      after: null
    },
    verification: null
  };

  if (!validation.valid) {
    report.verification = { passed: false, reason: 'Validation failed — no records imported' };
    return report;
  }

  if (dryRun) {
    report.database.after = countsBefore;
    report.verification = {
      passed: true,
      dryRun: true,
      message: 'Dry run complete — no database writes performed'
    };
    return report;
  }

  const importOptions = { skipExisting, forceUpdate };

  for (const record of bundle.patients) {
    try {
      const result = await withTransaction((client) =>
        importVisitRecord(client, clinicId, userId, record, importOptions)
      );
      report.import.visits[result.action === 'inserted' ? 'inserted' : result.action === 'updated' ? 'updated' : 'skipped']++;
      report.import.visits.items.push({ localId: record.id, ...result });
      if (result.entityId) {
        report.idMappings.visits.push({
          localId: result.localId ?? record.id,
          entityId: result.entityId
        });
      }
    } catch (err) {
      report.import.visits.failed++;
      report.failures.push({
        entity: 'visit',
        localId: record.id,
        error: err.message
      });
    }
  }

  for (const record of bundle.kpPatients) {
    try {
      const result = await withTransaction((client) =>
        importKpPatientRecord(client, clinicId, record, importOptions)
      );
      report.import.kpPatients[result.action === 'inserted' ? 'inserted' : result.action === 'updated' ? 'updated' : 'skipped']++;
      report.import.kpPatients.items.push({ localId: record.id, ...result });
      if (result.entityId) {
        report.idMappings.kpPatients.push({
          localId: result.localId ?? record.id,
          entityId: result.entityId,
          kpPatientId: record.kpPatientId
        });
      }
    } catch (err) {
      report.import.kpPatients.failed++;
      report.failures.push({
        entity: 'kp_patient',
        localId: record.id,
        kpPatientId: record.kpPatientId,
        error: err.message
      });
    }
  }

  for (const record of bundle.kpTissues) {
    try {
      const result = await withTransaction((client) =>
        importKpTissueRecord(client, clinicId, record, importOptions)
      );
      report.import.kpTissues[result.action === 'inserted' ? 'inserted' : result.action === 'updated' ? 'updated' : 'skipped']++;
      report.import.kpTissues.items.push({ localId: record.id, ...result });
      if (result.entityId) {
        report.idMappings.kpTissues.push({
          localId: result.localId ?? record.id,
          entityId: result.entityId,
          kpTissueId: record.kpTissueId
        });
      }
    } catch (err) {
      report.import.kpTissues.failed++;
      report.failures.push({
        entity: 'kp_tissue',
        localId: record.id,
        kpTissueId: record.kpTissueId,
        error: err.message
      });
    }
  }

  const countsAfter = await getDatabaseCounts(clinicId);
  report.database.after = countsAfter;

  const expectedVisits = countsBefore.visits
    + report.import.visits.inserted
    + (forceUpdate ? report.import.visits.updated : 0);
  const expectedKpPatients = countsBefore.kpPatients
    + report.import.kpPatients.inserted
    + (forceUpdate ? report.import.kpPatients.updated : 0);
  const expectedKpTissues = countsBefore.kpTissues
    + report.import.kpTissues.inserted
    + (forceUpdate ? report.import.kpTissues.updated : 0);

  const visitCountOk = skipExisting
    ? countsAfter.visits >= countsBefore.visits
    : countsAfter.visits === expectedVisits;
  const kpPatientCountOk = countsAfter.kpPatients >= countsBefore.kpPatients;
  const kpTissueCountOk = countsAfter.kpTissues >= countsBefore.kpTissues;
  const noFailures = report.failures.length === 0;

  report.verification = {
    passed: visitCountOk && kpPatientCountOk && kpTissueCountOk && noFailures,
    expected: {
      visits: expectedVisits,
      kpPatients: expectedKpPatients,
      kpTissues: expectedKpTissues
    },
    actual: countsAfter,
    delta: {
      visits: countsAfter.visits - countsBefore.visits,
      kpPatients: countsAfter.kpPatients - countsBefore.kpPatients,
      kpTissues: countsAfter.kpTissues - countsBefore.kpTissues
    },
    imported: {
      visits: report.import.visits.inserted + report.import.visits.updated,
      kpPatients: report.import.kpPatients.inserted + report.import.kpPatients.updated,
      kpTissues: report.import.kpTissues.inserted + report.import.kpTissues.updated
    },
    skipped: {
      visits: report.import.visits.skipped,
      kpPatients: report.import.kpPatients.skipped,
      kpTissues: report.import.kpTissues.skipped
    },
    failed: report.failures.length
  };

  await query(
    `
      INSERT INTO sync_logs (clinic_id, user_id, direction, level, message, details)
      VALUES ($1, $2, 'system', $3, $4, $5)
    `,
    [
      clinicId,
      userId,
      report.verification.passed ? 'info' : 'warn',
      `IndexedDB migration ${report.verification.passed ? 'completed' : 'completed with issues'}`,
      {
        sourceCounts: report.source.counts,
        verification: report.verification,
        failures: report.failures.length
      }
    ]
  );

  return report;
}

/**
 * @param {ReturnType<typeof runMigration>} report
 */
export function generateMigrationReportMarkdown(report) {
  const lines = [
    '# Cornea Clinic — IndexedDB Migration Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Mode:** ${report.mode}`,
    `**Clinic ID:** ${report.clinicId}`,
    '',
    '## Source export',
    '',
    '| Store | Count |',
    '|-------|------:|',
    `| Visits (patients store) | ${report.source.counts.visits} |`,
    `| KP patients | ${report.source.counts.kpPatients} |`,
    `| KP tissues | ${report.source.counts.kpTissues} |`,
    '',
    '## Validation',
    '',
    report.validation.valid ? '✅ Export validation passed' : '❌ Export validation failed',
    ''
  ];

  if (report.validation.errors.length) {
    lines.push('### Errors', '');
    for (const err of report.validation.errors) {
      lines.push(`- ${JSON.stringify(err)}`);
    }
    lines.push('');
  }

  lines.push('## Duplicate detection', '');
  lines.push(`- Within export: **${report.duplicates.withinExport.length}** issue(s)`);
  lines.push(`- Against database: **${report.duplicates.againstDatabase.length}** issue(s)`);
  lines.push('');

  if (report.duplicates.withinExport.length) {
    lines.push('### Duplicates in export', '');
    for (const dup of report.duplicates.withinExport.slice(0, 20)) {
      lines.push(`- \`${dup.type}\` — ${dup.entity}: ${dup.value || JSON.stringify(dup.localIds)}`);
    }
    if (report.duplicates.withinExport.length > 20) {
      lines.push(`- … and ${report.duplicates.withinExport.length - 20} more`);
    }
    lines.push('');
  }

  if (report.mode === 'import') {
    lines.push('## Import results', '');
    for (const key of ['visits', 'kpPatients', 'kpTissues']) {
      const section = report.import[key];
      lines.push(
        `### ${key}`,
        `- Inserted: ${section.inserted}`,
        `- Updated: ${section.updated}`,
        `- Skipped: ${section.skipped}`,
        `- Failed: ${section.failed}`,
        ''
      );
    }

    lines.push('## Database counts', '');
    lines.push('| Store | Before | After | Delta |');
    lines.push('|-------|-------:|------:|------:|');
    lines.push(`| Visits | ${report.database.before.visits} | ${report.database.after?.visits ?? '—'} | ${report.verification?.delta?.visits ?? '—'} |`);
    lines.push(`| Patients | ${report.database.before.patients} | ${report.database.after?.patients ?? '—'} | — |`);
    lines.push(`| KP patients | ${report.database.before.kpPatients} | ${report.database.after?.kpPatients ?? '—'} | ${report.verification?.delta?.kpPatients ?? '—'} |`);
    lines.push(`| KP tissues | ${report.database.before.kpTissues} | ${report.database.after?.kpTissues ?? '—'} | ${report.verification?.delta?.kpTissues ?? '—'} |`);
    lines.push('');
  }

  lines.push('## Verification', '');
  if (report.verification?.passed) {
    lines.push('✅ **Migration verification PASSED** — no data loss detected');
  } else {
    lines.push('❌ **Migration verification FAILED** — review failures below');
  }
  lines.push('');

  if (report.failures.length) {
    lines.push('## Failures', '');
    for (const failure of report.failures) {
      lines.push(`- **${failure.entity}** (localId=${failure.localId ?? '—'}): ${failure.error}`);
    }
    lines.push('');
  }

  lines.push('---', '*Original IndexedDB export is never modified or deleted by this tool.*');
  return lines.join('\n');
}

/**
 * @param {ReturnType<typeof normalizeExportBundle>} bundle
 */
export function createExportBundle(bundle) {
  const normalized = normalizeExportBundle(bundle);
  const checksums = computeBundleChecksums(normalized);
  return {
    ...normalized,
    checksums,
    counts: {
      visits: normalized.patients.length,
      kpPatients: normalized.kpPatients.length,
      kpTissues: normalized.kpTissues.length
    }
  };
}

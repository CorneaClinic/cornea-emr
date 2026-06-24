import { query } from '../db/pool.js';
import { ConflictError, NotFoundError, ValidationError } from '../core/errors.js';
import { requireUuid } from '../core/validation.js';

const ENTITY_TYPES = Object.freeze(['visit', 'kp_patient', 'kp_tissue']);
const DEFAULT_TTL_MINUTES = 5;

function mapLock(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    lockedByUserId: row.locked_by_user_id,
    lockedByName: row.locked_by_name,
    deviceId: row.device_id,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at
  };
}

async function cleanupExpired(clinicId) {
  await query(
    `DELETE FROM record_edit_locks WHERE clinic_id = $1 AND expires_at < now()`,
    [clinicId]
  );
}

async function userDisplayName(userId) {
  const { rows } = await query(`SELECT full_name, email FROM users WHERE id = $1`, [userId]);
  const u = rows[0];
  return u?.full_name || u?.email || 'User';
}

export async function getLock(clinicId, entityType, entityId) {
  if (!ENTITY_TYPES.includes(entityType)) {
    throw new ValidationError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
  }
  requireUuid(entityId, 'entityId');
  const { rows } = await query(
    `
      SELECT * FROM record_edit_locks
       WHERE clinic_id = $1 AND entity_type = $2 AND entity_id = $3 AND expires_at > now()
    `,
    [clinicId, entityType, entityId]
  );
  return rows[0] ? mapLock(rows[0]) : null;
}

export async function listActiveLocks(clinicId, entityType) {
  await cleanupExpired(clinicId);
  const params = [clinicId];
  let filter = 'clinic_id = $1 AND expires_at > now()';
  if (entityType) {
    if (!ENTITY_TYPES.includes(entityType)) {
      throw new ValidationError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
    }
    params.push(entityType);
    filter += ` AND entity_type = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT * FROM record_edit_locks WHERE ${filter} ORDER BY acquired_at DESC`,
    params
  );
  return rows.map(mapLock);
}

export async function acquireLock(req, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const entityType = String(body.entityType || '').trim();
  const entityId = body.entityId;
  const force = body.force === true;
  const deviceId = String(body.deviceId || req.headers['x-device-id'] || '').trim() || null;
  const ttlMinutes = Math.min(Math.max(Number(body.ttlMinutes) || DEFAULT_TTL_MINUTES, 1), 30);

  if (!ENTITY_TYPES.includes(entityType)) {
    throw new ValidationError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
  }
  requireUuid(entityId, 'entityId');

  await cleanupExpired(clinicId);
  const existing = await getLock(clinicId, entityType, entityId);

  if (existing && existing.lockedByUserId !== userId) {
    if (!force) {
      throw new ConflictError('Record is being edited by another user', {
        lock: existing
      });
    }
    await query(
      `DELETE FROM record_edit_locks WHERE clinic_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [clinicId, entityType, entityId]
    );
  }

  const lockedByName = await userDisplayName(userId);
  const { rows } = await query(
    `
      INSERT INTO record_edit_locks (
        clinic_id, entity_type, entity_id, locked_by_user_id, locked_by_name, device_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' minutes')::interval)
      ON CONFLICT (clinic_id, entity_type, entity_id)
      DO UPDATE SET
        locked_by_user_id = EXCLUDED.locked_by_user_id,
        locked_by_name = EXCLUDED.locked_by_name,
        device_id = EXCLUDED.device_id,
        acquired_at = now(),
        expires_at = EXCLUDED.expires_at
      RETURNING *
    `,
    [clinicId, entityType, entityId, userId, lockedByName, deviceId, String(ttlMinutes)]
  );

  return mapLock(rows[0]);
}

export async function renewLock(req, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const entityType = String(body.entityType || '').trim();
  const entityId = body.entityId;
  const ttlMinutes = Math.min(Math.max(Number(body.ttlMinutes) || DEFAULT_TTL_MINUTES, 1), 30);

  if (!ENTITY_TYPES.includes(entityType)) {
    throw new ValidationError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
  }
  requireUuid(entityId, 'entityId');

  const { rows } = await query(
    `
      UPDATE record_edit_locks
         SET expires_at = now() + ($5 || ' minutes')::interval,
             acquired_at = now()
       WHERE clinic_id = $1 AND entity_type = $2 AND entity_id = $3
         AND locked_by_user_id = $4 AND expires_at > now()
      RETURNING *
    `,
    [clinicId, entityType, entityId, userId, String(ttlMinutes)]
  );
  if (!rows[0]) throw new NotFoundError('Edit lock not found or expired');
  return mapLock(rows[0]);
}

export async function releaseLock(req, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const entityType = String(body.entityType || '').trim();
  const entityId = body.entityId;
  const force = body.force === true;

  if (!ENTITY_TYPES.includes(entityType)) {
    throw new ValidationError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
  }
  requireUuid(entityId, 'entityId');

  const sql = force
    ? `DELETE FROM record_edit_locks WHERE clinic_id = $1 AND entity_type = $2 AND entity_id = $3 RETURNING id`
    : `DELETE FROM record_edit_locks WHERE clinic_id = $1 AND entity_type = $2 AND entity_id = $3 AND locked_by_user_id = $4 RETURNING id`;

  const params = force ? [clinicId, entityType, entityId] : [clinicId, entityType, entityId, userId];
  const { rows } = await query(sql, params);
  return { released: !!rows[0] };
}

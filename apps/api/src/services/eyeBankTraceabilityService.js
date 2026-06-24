import { query } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import {
  optionalString,
  parseDate,
  optionalInt,
  optionalNumber,
  requireUuid,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { getCornealTissueById, mapCornealTissue } from './cornealTissueService.js';

const CUSTODY_TYPES = Object.freeze([
  'Received', 'Quarantine', 'Released', 'Reserved', 'Transferred',
  'Shipped', 'Implanted', 'Discarded', 'Audit'
]);

const COLD_CHAIN_TYPES = Object.freeze([
  'Storage check', 'Transfer', 'Out of range', 'Corrected', 'Alarm'
]);

const QUARANTINE_STATUSES = Object.freeze(['Quarantine', 'Cleared', 'Failed', 'Released']);

const SEROLOGY_VALUES = Object.freeze(['Negative', 'Positive', 'Pending', 'Not done']);

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function mapCustody(row) {
  return {
    id: row.id,
    tissueId: row.tissue_id,
    eventType: row.event_type,
    fromParty: row.from_party,
    toParty: row.to_party,
    actorName: row.actor_name,
    location: row.location,
    notes: row.notes,
    occurredAt: row.occurred_at,
    legacyLocalId: row.legacy_local_id
  };
}

function mapColdChain(row) {
  return {
    id: row.id,
    tissueId: row.tissue_id,
    eventType: row.event_type,
    temperatureC: row.temperature_c != null ? Number(row.temperature_c) : null,
    location: row.location,
    inRange: row.in_range,
    notes: row.notes,
    recordedAt: row.recorded_at,
    recordedBy: row.recorded_by,
    legacyLocalId: row.legacy_local_id
  };
}

async function assertTissue(clinicId, tissueId) {
  return getCornealTissueById(clinicId, tissueId);
}

export async function getEyeBankOverview(clinicId) {
  const { rows: tissueStats } = await query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE tissue_status = 'Available')::int AS available,
        COUNT(*) FILTER (WHERE quarantine_status = 'Quarantine')::int AS in_quarantine,
        COUNT(*) FILTER (WHERE quarantine_status = 'Failed')::int AS quarantine_failed,
        COUNT(*) FILTER (
          WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 7
            AND tissue_status = 'Available'
        )::int AS expiring_7d
      FROM corneal_tissues
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  const { rows: custodyStats } = await query(
    `SELECT COUNT(*)::int AS events FROM eye_bank_custody_events WHERE clinic_id = $1`,
    [clinicId]
  );

  const { rows: coldStats } = await query(
  `SELECT COUNT(*)::int AS events,
          COUNT(*) FILTER (WHERE in_range = false)::int AS out_of_range
     FROM eye_bank_cold_chain_events WHERE clinic_id = $1`,
    [clinicId]
  );

  return {
    generatedAt: new Date().toISOString(),
    tissues: tissueStats[0],
    custodyEvents: custodyStats[0]?.events || 0,
    coldChainEvents: coldStats[0]?.events || 0,
    coldChainOutOfRange: coldStats[0]?.out_of_range || 0
  };
}

export async function listCustodyEvents(clinicId, tissueId) {
  await assertTissue(clinicId, tissueId);
  const { rows } = await query(
    `
      SELECT * FROM eye_bank_custody_events
       WHERE clinic_id = $1 AND tissue_id = $2
       ORDER BY occurred_at DESC
    `,
    [clinicId, tissueId]
  );
  return rows.map(mapCustody);
}

export async function addCustodyEvent(req, tissueId, body) {
  const clinicId = req.user.clinicId;
  const tissue = await assertTissue(clinicId, tissueId);
  const eventType = String(body.eventType || '').trim();
  if (!CUSTODY_TYPES.includes(eventType)) {
    throw new ValidationError(`eventType must be one of: ${CUSTODY_TYPES.join(', ')}`);
  }

  const { rows } = await query(
    `
      INSERT INTO eye_bank_custody_events (
        clinic_id, tissue_id, event_type, from_party, to_party, actor_name,
        location, notes, occurred_at, legacy_local_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, now()),$10)
      RETURNING *
    `,
    [
      clinicId,
      tissueId,
      eventType,
      optionalString(body.fromParty, 'fromParty'),
      optionalString(body.toParty, 'toParty'),
      optionalString(body.actorName, 'actorName') || req.user.name || req.user.email,
      optionalString(body.location, 'location'),
      optionalString(body.notes, 'notes'),
      body.occurredAt || null,
      optionalInt(body.legacyLocalId, 'legacyLocalId')
    ]
  );

  if (eventType === 'Quarantine') {
    await query(
      `
        UPDATE corneal_tissues
           SET quarantine_status = 'Quarantine',
               quarantine_reason = COALESCE($3, quarantine_reason),
               tissue_status = CASE WHEN tissue_status = 'Available' THEN 'Ordered' ELSE tissue_status END,
               revision = revision + 1
         WHERE id = $1 AND clinic_id = $2
      `,
      [tissueId, clinicId, optionalString(body.notes, 'notes')]
    );
  } else if (eventType === 'Released') {
    await query(
      `
        UPDATE corneal_tissues
           SET quarantine_status = 'Released',
               quarantine_until = NULL,
               revision = revision + 1
         WHERE id = $1 AND clinic_id = $2
      `,
      [tissueId, clinicId]
    );
  }

  await auditMutation(req, 'corneal_tissue', tissueId, 'custody_event', {
    eventType,
    kpTissueId: tissue.kpTissueId
  });

  return mapCustody(rows[0]);
}

export async function listColdChainEvents(clinicId, tissueId) {
  await assertTissue(clinicId, tissueId);
  const { rows } = await query(
    `
      SELECT * FROM eye_bank_cold_chain_events
       WHERE clinic_id = $1 AND tissue_id = $2
       ORDER BY recorded_at DESC
    `,
    [clinicId, tissueId]
  );
  return rows.map(mapColdChain);
}

export async function addColdChainEvent(req, tissueId, body) {
  const clinicId = req.user.clinicId;
  const tissue = await assertTissue(clinicId, tissueId);
  const eventType = String(body.eventType || 'Storage check').trim();
  if (!COLD_CHAIN_TYPES.includes(eventType)) {
    throw new ValidationError(`eventType must be one of: ${COLD_CHAIN_TYPES.join(', ')}`);
  }

  const temp = optionalNumber(body.temperatureC, 'temperatureC');
  const inRange = body.inRange != null ? Boolean(body.inRange) : (temp == null ? null : temp >= 2 && temp <= 8);

  const { rows } = await query(
    `
      INSERT INTO eye_bank_cold_chain_events (
        clinic_id, tissue_id, event_type, temperature_c, location, in_range,
        notes, recorded_at, recorded_by, legacy_local_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, now()),$9,$10)
      RETURNING *
    `,
    [
      clinicId,
      tissueId,
      eventType,
      temp,
      optionalString(body.location, 'location'),
      inRange,
      optionalString(body.notes, 'notes'),
      body.recordedAt || null,
      optionalString(body.recordedBy, 'recordedBy') || req.user.name || req.user.email,
      optionalInt(body.legacyLocalId, 'legacyLocalId')
    ]
  );

  await auditMutation(req, 'corneal_tissue', tissueId, 'cold_chain_event', {
    eventType,
    inRange,
    kpTissueId: tissue.kpTissueId
  });

  return mapColdChain(rows[0]);
}

export async function updateQuarantine(req, tissueId, body) {
  const clinicId = req.user.clinicId;
  const existing = await assertTissue(clinicId, tissueId);
  const status = String(body.quarantineStatus || '').trim();
  if (!QUARANTINE_STATUSES.includes(status)) {
    throw new ValidationError(`quarantineStatus must be one of: ${QUARANTINE_STATUSES.join(', ')}`);
  }

  for (const field of ['serologyHiv', 'serologyHbv', 'serologyHcv', 'serologySyphilis', 'serologyCmv']) {
    const val = body[field];
    if (val != null && !SEROLOGY_VALUES.includes(String(val))) {
      throw new ValidationError(`${field} must be one of: ${SEROLOGY_VALUES.join(', ')}`);
    }
  }

  const clearedAt = status === 'Cleared' || status === 'Released'
    ? (body.serologyClearedAt || new Date().toISOString())
    : body.serologyClearedAt || null;

  const { rows } = await query(
    `
      UPDATE corneal_tissues SET
        donor_id = COALESCE($3, donor_id),
        lot_number = COALESCE($4, lot_number),
        tissue_laterality = COALESCE($5, tissue_laterality),
        serology_hiv = COALESCE($6, serology_hiv),
        serology_hbv = COALESCE($7, serology_hbv),
        serology_hcv = COALESCE($8, serology_hcv),
        serology_syphilis = COALESCE($9, serology_syphilis),
        serology_cmv = COALESCE($10, serology_cmv),
        serology_cleared_at = COALESCE($11::timestamptz, serology_cleared_at),
        quarantine_status = $12,
        quarantine_reason = COALESCE($13, quarantine_reason),
        quarantine_until = COALESCE($14::date, quarantine_until),
        received_at = COALESCE($15::timestamptz, received_at),
        revision = revision + 1
      WHERE id = $1 AND clinic_id = $2
      RETURNING *
    `,
    [
      tissueId,
      clinicId,
      optionalString(body.donorId, 'donorId'),
      optionalString(body.lotNumber, 'lotNumber'),
      optionalString(body.tissueLaterality, 'tissueLaterality'),
      optionalString(body.serologyHiv, 'serologyHiv'),
      optionalString(body.serologyHbv, 'serologyHbv'),
      optionalString(body.serologyHcv, 'serologyHcv'),
      optionalString(body.serologySyphilis, 'serologySyphilis'),
      optionalString(body.serologyCmv, 'serologyCmv'),
      clearedAt,
      status,
      optionalString(body.quarantineReason, 'quarantineReason'),
      parseDate(body.quarantineUntil, 'quarantineUntil'),
      body.receivedAt || null
    ]
  );

  if (!rows[0]) throw new NotFoundError('Corneal tissue not found');

  if (status === 'Quarantine' && existing.quarantineStatus !== 'Quarantine') {
    await addCustodyEvent(req, tissueId, {
      eventType: 'Quarantine',
      notes: body.quarantineReason || 'Quarantine status set',
      actorName: req.user.name
    });
  }

  await auditMutation(req, 'corneal_tissue', tissueId, 'quarantine_update', {
    quarantineStatus: status
  });

  return mapCornealTissue(rows[0]);
}

export async function getTraceabilityPacket(clinicId, tissueId) {
  const tissue = await assertTissue(clinicId, tissueId);
  const custody = await listCustodyEvents(clinicId, tissueId);
  const coldChain = await listColdChainEvents(clinicId, tissueId);

  let allocation = null;
  if (tissue.reservedKpPatientId) {
    const { rows } = await query(
      `SELECT kp_patient_id, full_name, status, surgery_date FROM keratoplasty_patients WHERE id = $1`,
      [tissue.reservedKpPatientId]
    );
    allocation = rows[0] ? {
      kpPatientId: rows[0].kp_patient_id,
      fullName: rows[0].full_name,
      status: rows[0].status,
      surgeryDate: formatDate(rows[0].surgery_date)
    } : null;
  }

  return {
    generatedAt: new Date().toISOString(),
    tissue,
    allocation,
    custodyEvents: custody,
    coldChainEvents: coldChain
  };
}

export async function exportTraceabilityCsv(clinicId, tissueId) {
  const packet = await getTraceabilityPacket(clinicId, tissueId);
  const t = packet.tissue;
  const lines = [
    'Section,Field,Value',
    `Tissue,kpTissueId,${csvEscape(t.kpTissueId)}`,
    `Tissue,donorId,${csvEscape(t.donorId)}`,
    `Tissue,lotNumber,${csvEscape(t.lotNumber)}`,
    `Tissue,laterality,${csvEscape(t.tissueLaterality)}`,
    `Tissue,quarantineStatus,${csvEscape(t.quarantineStatus)}`,
    `Tissue,serologyHiv,${csvEscape(t.serologyHiv)}`,
    `Tissue,serologyHbv,${csvEscape(t.serologyHbv)}`,
    `Tissue,serologyHcv,${csvEscape(t.serologyHcv)}`,
    `Tissue,serologySyphilis,${csvEscape(t.serologySyphilis)}`,
    `Tissue,serologyCmv,${csvEscape(t.serologyCmv)}`,
    `Tissue,eyeBank,${csvEscape(t.eyeBank)}`,
    `Tissue,storageLocation,${csvEscape(t.storageLocation)}`,
    `Tissue,preservationDate,${csvEscape(t.preservationDate)}`,
    `Tissue,expiryDate,${csvEscape(t.expiryDate)}`,
    `Tissue,tissueStatus,${csvEscape(t.tissueStatus)}`,
    ''
  ];

  if (packet.allocation) {
    lines.push('Allocation,kpPatientId,' + csvEscape(packet.allocation.kpPatientId));
    lines.push('Allocation,fullName,' + csvEscape(packet.allocation.fullName));
    lines.push('Allocation,status,' + csvEscape(packet.allocation.status));
  }

  lines.push('', 'Custody,occurredAt,eventType,fromParty,toParty,location,actor,notes');
  for (const e of packet.custodyEvents) {
    lines.push([
      'Custody',
      csvEscape(e.occurredAt),
      csvEscape(e.eventType),
      csvEscape(e.fromParty),
      csvEscape(e.toParty),
      csvEscape(e.location),
      csvEscape(e.actorName),
      csvEscape(e.notes)
    ].join(','));
  }

  lines.push('', 'ColdChain,recordedAt,eventType,temperatureC,inRange,location,recordedBy,notes');
  for (const e of packet.coldChainEvents) {
    lines.push([
      'ColdChain',
      csvEscape(e.recordedAt),
      csvEscape(e.eventType),
      csvEscape(e.temperatureC),
      csvEscape(e.inRange),
      csvEscape(e.location),
      csvEscape(e.recordedBy),
      csvEscape(e.notes)
    ].join(','));
  }

  return lines.join('\r\n');
}

/**
 * Map legacy flat visit documents ↔ v1 PostgreSQL schema.
 */

const PATIENT_KEYS = ['patientId', 'fullName', 'dob', 'sex', 'phone', 'address', 'nationalId'];
const VALID_SEX = ['Male', 'Female', 'Other'];

/**
 * @param {unknown} value
 */
export function normalizeSex(value) {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  const lower = str.toLowerCase();
  if (lower === 'm' || lower === 'male') return 'Male';
  if (lower === 'f' || lower === 'female') return 'Female';
  if (lower === 'other' || lower === 'o') return 'Other';
  if (VALID_SEX.includes(str)) return str;
  return null;
}

/**
 * @param {Record<string, unknown>} payload
 */
export function extractPatientFromPayload(payload) {
  const mrn = String(payload.patientId || '').trim();
  if (!mrn) {
    throw new Error('patientId (MRN) is required');
  }
  return {
    mrn,
    fullName: String(payload.fullName || '').trim() || 'Unknown',
    dob: payload.dob || null,
    sex: normalizeSex(payload.sex),
    phone: payload.phone || null,
    address: payload.address || null,
    nationalId: payload.nationalId || null
  };
}

/**
 * @param {Record<string, unknown>} payload
 */
export function stripPatientFromPayload(payload) {
  const copy = { ...payload };
  PATIENT_KEYS.forEach((k) => delete copy[k]);
  delete copy.id;
  delete copy.uuid;
  delete copy.lastModified;
  delete copy.revision;
  delete copy.sync_status;
  delete copy.client_mutation_id;
  delete copy.updated_at;
  return copy;
}

/**
 * @param {Record<string, unknown>} patient
 * @param {Record<string, unknown>} visit
 */
export function visitToLegacyRecord(patient, visit) {
  const payload = typeof visit.payload === 'string'
    ? JSON.parse(visit.payload)
    : (visit.payload || {});

  return {
    id: visit.legacy_local_id || visit.id,
    uuid: visit.id,
    patientId: patient.mrn,
    fullName: patient.full_name || patient.fullName,
    dob: patient.dob ? String(patient.dob).slice(0, 10) : '',
    sex: patient.sex || '',
    phone: patient.phone || '',
    address: patient.address || '',
    nationalId: patient.national_id || patient.nationalId || '',
    visitDate: visit.visit_date ? String(visit.visit_date).slice(0, 10) : '',
    lastModified: visit.updated_at,
    revision: visit.revision,
    sync_status: 'synced',
    updated_at: visit.updated_at,
    ...payload
  };
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapKpPatientToLegacy(row) {
  return {
    id: row.legacy_local_id || row.id,
    uuid: row.id,
    kpPatientId: row.kp_patient_id,
    kpFullName: row.full_name,
    kpAge: row.age,
    kpGender: row.gender,
    kpPhone: row.phone,
    kpAddress: row.address,
    kpEye: row.eye,
    kpDiagnosis: row.diagnosis,
    kpProcedure: row.procedure,
    kpPrognosis: row.prognosis,
    kpUrgency: row.urgency,
    kpCornealSize: row.corneal_size_mm,
    kpDonorAgePref: row.donor_age_pref,
    kpEndothelialReq: row.endothelial_req,
    kpInfection: row.infection,
    kpVisualAxis: row.visual_axis,
    kpStatus: row.status,
    kpRegDate: row.reg_date ? String(row.reg_date).slice(0, 10) : '',
    kpSurgeryDate: row.surgery_date ? String(row.surgery_date).slice(0, 10) : '',
    kpNotes: row.notes,
    recommendedTissueId: row.recommended_tissue_id,
    revision: row.revision,
    lastModified: row.updated_at,
    sync_status: 'synced',
    updated_at: row.updated_at
  };
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapKpTissueToLegacy(row) {
  return {
    id: row.legacy_local_id || row.id,
    uuid: row.id,
    kpTissueId: row.kp_tissue_id,
    kpDonorAge: row.donor_age,
    kpDonorGender: row.donor_gender,
    kpDeathToPreservation: row.death_to_preservation_hrs,
    kpPreservationDate: row.preservation_date ? String(row.preservation_date).slice(0, 10) : '',
    kpExpiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : '',
    kpSpecular: row.specular_count,
    kpEdema: row.edema,
    kpClarity: row.clarity,
    kpInfectionRisk: row.infection_risk,
    kpOpticalGrade: row.optical_grade,
    kpTherapeuticGrade: row.therapeutic_grade,
    kpTissueStatus: row.tissue_status,
    kpStorageMedium: row.storage_medium,
    kpStorageLocation: row.storage_location,
    kpEyeBank: row.eye_bank,
    kpDonorId: row.donor_id,
    kpLotNumber: row.lot_number,
    kpTissueLaterality: row.tissue_laterality,
    kpSerologyHiv: row.serology_hiv,
    kpSerologyHbv: row.serology_hbv,
    kpSerologyHcv: row.serology_hcv,
    kpSerologySyphilis: row.serology_syphilis,
    kpSerologyCmv: row.serology_cmv,
    kpQuarantineStatus: row.quarantine_status || 'Cleared',
    kpQuarantineReason: row.quarantine_reason,
    kpQuarantineUntil: row.quarantine_until ? String(row.quarantine_until).slice(0, 10) : '',
    kpReceivedAt: row.received_at,
    kpReservedFor: row.reserved_for_kp_patient_id,
    revision: row.revision,
    lastModified: row.updated_at,
    sync_status: 'synced',
    updated_at: row.updated_at
  };
}

/**
 * @param {Record<string, unknown>} body
 */
export function legacyKpPatientToRow(body, clinicId) {
  return {
    clinic_id: clinicId,
    kp_patient_id: body.kpPatientId,
    full_name: body.kpFullName,
    age: body.kpAge ?? null,
    gender: body.kpGender ?? null,
    phone: body.kpPhone ?? null,
    address: body.kpAddress ?? null,
    eye: body.kpEye ?? null,
    diagnosis: body.kpDiagnosis ?? null,
    procedure: body.kpProcedure ?? null,
    prognosis: body.kpPrognosis ?? null,
    urgency: body.kpUrgency ?? null,
    corneal_size_mm: body.kpCornealSize ?? null,
    donor_age_pref: body.kpDonorAgePref ?? null,
    endothelial_req: body.kpEndothelialReq ?? null,
    infection: body.kpInfection ?? null,
    visual_axis: body.kpVisualAxis ?? null,
    status: body.kpStatus || 'Waiting',
    reg_date: body.kpRegDate || null,
    surgery_date: body.kpSurgeryDate || null,
    notes: body.kpNotes ?? null,
    legacy_local_id: body.id != null ? Number(body.id) : null
  };
}

/**
 * @param {Record<string, unknown>} body
 */
export function legacyKpTissueToRow(body, clinicId) {
  return {
    clinic_id: clinicId,
    kp_tissue_id: body.kpTissueId,
    donor_age: body.kpDonorAge ?? null,
    donor_gender: body.kpDonorGender ?? null,
    death_to_preservation_hrs: body.kpDeathToPreservation ?? null,
    preservation_date: body.kpPreservationDate || null,
    expiry_date: body.kpExpiryDate || null,
    specular_count: body.kpSpecular ?? null,
    edema: body.kpEdema ?? null,
    clarity: body.kpClarity ?? null,
    infection_risk: body.kpInfectionRisk ?? null,
    optical_grade: body.kpOpticalGrade ?? null,
    therapeutic_grade: body.kpTherapeuticGrade ?? null,
    tissue_status: body.kpTissueStatus || 'Available',
    storage_medium: body.kpStorageMedium ?? null,
    storage_location: body.kpStorageLocation ?? null,
    eye_bank: body.kpEyeBank ?? null,
    donor_id: body.kpDonorId ?? null,
    lot_number: body.kpLotNumber ?? null,
    tissue_laterality: body.kpTissueLaterality ?? null,
    serology_hiv: body.kpSerologyHiv ?? null,
    serology_hbv: body.kpSerologyHbv ?? null,
    serology_hcv: body.kpSerologyHcv ?? null,
    serology_syphilis: body.kpSerologySyphilis ?? null,
    serology_cmv: body.kpSerologyCmv ?? null,
    quarantine_status: body.kpQuarantineStatus || 'Cleared',
    quarantine_reason: body.kpQuarantineReason ?? null,
    quarantine_until: body.kpQuarantineUntil || null,
    received_at: body.kpReceivedAt || null,
    legacy_local_id: body.id != null ? Number(body.id) : null
  };
}

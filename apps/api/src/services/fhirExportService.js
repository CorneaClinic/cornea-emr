import { query } from '../db/pool.js';
import { NotFoundError } from '../core/errors.js';
import { getPatientById } from './patientService.js';
import { mapVisit } from './visitService.js';
import { listCohortRows } from './researchAnalyticsService.js';

const FHIR_JSON = 'application/fhir+json';
const CORNEA_SYSTEM = 'http://corneaclinic.visionemr.net';
const MRN_SYSTEM = `${CORNEA_SYSTEM}/mrn`;
const REGISTRY_SYSTEM = `${CORNEA_SYSTEM}/registry`;

const COHORT_CONDITION = {
  kc: 'Keratoconus',
  cxl: 'Keratoconus — cross-linking candidate',
  keratitis: 'Microbial keratitis',
  kp: 'Keratoplasty',
  'kp-graft': 'Post-keratoplasty graft follow-up'
};

/**
 * @param {string | null | undefined} sex
 */
export function mapFhirGender(sex) {
  const v = String(sex || '').toLowerCase();
  if (v === 'male') return 'male';
  if (v === 'female') return 'female';
  if (v === 'other') return 'other';
  return 'unknown';
}

/**
 * @param {Record<string, unknown>} patient
 * @param {{ anonymize?: boolean }} [options]
 */
export function toFhirPatient(patient, options = {}) {
  const anonymize = Boolean(options.anonymize);
  const id = String(patient.id);
  const resource = {
    resourceType: 'Patient',
    id,
    meta: {
      profile: [`${CORNEA_SYSTEM}/fhir/StructureDefinition/CorneaPatient`]
    },
    identifier: [
      {
        system: MRN_SYSTEM,
        value: anonymize ? `ANON-${id.slice(0, 8)}` : patient.mrn
      }
    ],
    name: [{ text: anonymize ? `Research Patient ${id.slice(0, 8)}` : patient.fullName }],
    gender: mapFhirGender(patient.sex)
  };

  if (!anonymize && patient.dob) resource.birthDate = patient.dob;
  if (!anonymize && patient.phone) {
    resource.telecom = [{ system: 'phone', value: patient.phone, use: 'mobile' }];
  }
  if (!anonymize && patient.address) {
    resource.address = [{ text: patient.address }];
  }

  return resource;
}

/**
 * @param {Record<string, unknown>} visit
 */
export function toFhirEncounter(visit) {
  const statusMap = {
    finalized: 'finished',
    draft: 'in-progress',
    cancelled: 'cancelled'
  };
  return {
    resourceType: 'Encounter',
    id: String(visit.id),
    meta: {
      profile: [`${CORNEA_SYSTEM}/fhir/StructureDefinition/CorneaEncounter`]
    },
    status: statusMap[visit.status] || 'unknown',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    subject: { reference: `Patient/${visit.patientId}` },
    period: { start: visit.visitDate },
    identifier: visit.legacyLocalId != null
      ? [{ system: `${CORNEA_SYSTEM}/visit-local-id`, value: String(visit.legacyLocalId) }]
      : undefined
  };
}

/**
 * @param {string} patientId
 * @param {string} encounterId
 * @param {string} text
 * @param {string} [resourceId]
 */
export function toFhirCondition(patientId, encounterId, text, resourceId) {
  if (!text) return null;
  return {
    resourceType: 'Condition',
    id: resourceId || `condition-${encounterId}`,
    meta: {
      profile: [`${CORNEA_SYSTEM}/fhir/StructureDefinition/CorneaCondition`]
    },
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active'
      }]
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    code: { text: String(text).trim() }
  };
}

/**
 * @param {string} patientId
 * @param {string} label
 * @param {string | number} value
 * @param {string} unit
 * @param {string} resourceId
 */
export function toFhirObservation(patientId, label, value, unit, resourceId) {
  if (value == null || value === '') return null;
  return {
    resourceType: 'Observation',
    id: resourceId,
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'exam',
        display: 'Exam'
      }]
    }],
    code: { text: label },
    subject: { reference: `Patient/${patientId}` },
    valueQuantity: {
      value: Number(value),
      unit,
      system: 'http://unitsofmeasure.org',
      code: unit
    }
  };
}

/**
 * @param {Record<string, unknown>} payload
 */
export function extractDiagnosisFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const p = /** @type {Record<string, unknown>} */ (payload);
  return (
    p.diagnosis
    || p.chiefComplaint
    || (p.clinical && typeof p.clinical === 'object' ? /** @type {Record<string, unknown>} */ (p.clinical).diagnosis : null)
    || null
  );
}

/**
 * @param {Record<string, unknown>} visit
 * @param {string} patientId
 */
export function observationsFromVisitPayload(visit, patientId) {
  const payload = visit.payload && typeof visit.payload === 'object' ? visit.payload : {};
  const obs = [];
  const va = payload.visualAcuity || payload.va;
  if (va && typeof va === 'object') {
    for (const eye of ['od', 'os']) {
      const val = va[eye] || va[eye.toUpperCase()];
      if (val) {
        const row = toFhirObservation(
          patientId,
          `Visual acuity ${eye.toUpperCase()}`,
          String(val),
          '{score}',
          `va-${visit.id}-${eye}`
        );
        if (row) {
          row.valueString = String(val);
          delete row.valueQuantity;
          obs.push(row);
        }
      }
    }
  }
  return obs;
}

/**
 * @param {Array<Record<string, unknown>>} resources
 * @param {{ type?: string, anonymize?: boolean, cohortType?: string }} [meta]
 */
export function wrapFhirBundle(resources, meta = {}) {
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: {
      tag: [{
        system: `${CORNEA_SYSTEM}/fhir/tag`,
        code: 'cornea-emr-export',
        display: 'Cornea EMR FHIR export prototype (P4)'
      }]
    },
    identifier: {
      system: `${CORNEA_SYSTEM}/fhir/bundle`,
      value: `cornea-${meta.type || 'export'}-${new Date().toISOString().slice(0, 10)}`
    },
    entry: resources.map((resource) => ({ fullUrl: `${CORNEA_SYSTEM}/fhir/${resource.resourceType}/${resource.id}`, resource }))
  };

  if (meta.anonymize) {
    bundle.meta.security = [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'ANONY',
      display: 'anonymized'
    }];
  }
  if (meta.cohortType) {
    bundle.meta.profile = [`${CORNEA_SYSTEM}/fhir/StructureDefinition/CorneaCohortBundle`];
  }

  return bundle;
}

/**
 * @param {string} clinicId
 * @param {string} patientId
 * @param {{ limit?: number, anonymize?: boolean }} [options]
 */
export async function buildPatientFhirBundle(clinicId, patientId, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
  const patient = await getPatientById(clinicId, patientId);
  const { rows } = await query(
    `
      SELECT v.*, p.mrn, p.full_name, p.phone, p.dob, p.sex, p.address
        FROM visits v
        JOIN patients p ON p.id = v.patient_id AND p.clinic_id = v.clinic_id
       WHERE v.clinic_id = $1
         AND v.patient_id = $2
         AND v.status != 'cancelled'
       ORDER BY v.visit_date DESC, v.updated_at DESC
       LIMIT $3
    `,
    [clinicId, patientId, limit]
  );

  const resources = [toFhirPatient(patient, options)];

  for (const row of rows) {
    const visit = mapVisit(row, row);
    resources.push(toFhirEncounter(visit));

    const diagnosis = extractDiagnosisFromPayload(visit.payload);
    const condition = toFhirCondition(patientId, visit.id, diagnosis, `condition-${visit.id}`);
    if (condition) resources.push(condition);

    resources.push(...observationsFromVisitPayload(visit, patientId));
  }

  return wrapFhirBundle(resources, { type: 'patient', anonymize: options.anonymize });
}

/**
 * @param {string} cohortType
 * @param {Record<string, unknown>} row
 * @param {number} index
 * @param {{ anonymize?: boolean }} options
 */
export function cohortRowToFhirResources(cohortType, row, index, options = {}) {
  const patientKey = row.emrMrn || row.emrPatientMrn || row.id || row.caseId || row.kpPatientId || index;
  const patientId = `registry-${cohortType}-${String(patientKey).replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const patientRes = toFhirPatient({
    id: patientId,
    mrn: row.emrMrn || row.emrPatientMrn || `${cohortType}-${patientKey}`,
    fullName: row.fullName || 'Registry patient',
    sex: null,
    dob: null,
    phone: null,
    address: null
  }, { anonymize: options.anonymize !== false });

  patientRes.identifier.push({
    system: REGISTRY_SYSTEM,
    value: String(row.id || row.caseId || row.kpPatientId || patientKey)
  });

  const resources = [patientRes];

  const conditionText = COHORT_CONDITION[cohortType] || 'Cornea registry condition';
  const condition = toFhirCondition(patientId, `enc-${patientId}`, conditionText, `condition-${patientId}`);
  if (condition) resources.push(condition);

  if (cohortType === 'cxl' && row.procedureDate) {
    resources.push({
      resourceType: 'Procedure',
      id: `cxl-${patientId}`,
      status: 'completed',
      subject: { reference: `Patient/${patientId}` },
      performedDateTime: row.procedureDate,
      code: { text: 'Corneal cross-linking (CXL)' }
    });
  }

  const metricFields = [
    ['Kmax', row.kmax],
    ['Kmean', row.kmean],
    ['Thinnest pachymetry', row.thinnestPachy],
    ['Latest ECD', row.latestEcd],
    ['Rejection count', row.rejectionCount]
  ];
  for (const [label, value] of metricFields) {
    const obs = toFhirObservation(patientId, label, value, '{score}', `obs-${patientId}-${label}`);
    if (obs) resources.push(obs);
  }

  if (row.progressionStatus) {
    const prog = toFhirObservation(
      patientId,
      'KC progression status',
      1,
      '{score}',
      `prog-${patientId}`
    );
    if (prog) {
      prog.valueString = String(row.progressionStatus);
      delete prog.valueQuantity;
      resources.push(prog);
    }
  }

  if (row.graftOutcome) {
    const graft = toFhirObservation(
      patientId,
      'Graft outcome',
      1,
      '{score}',
      `graft-${patientId}`
    );
    if (graft) {
      graft.valueString = String(row.graftOutcome);
      delete graft.valueQuantity;
      resources.push(graft);
    }
  }

  return resources;
}

/**
 * @param {string} clinicId
 * @param {string} cohortType
 * @param {{ limit?: number, anonymize?: boolean }} [queryParams]
 */
export async function buildCohortFhirBundle(clinicId, cohortType, queryParams = {}) {
  const rows = await listCohortRows(clinicId, cohortType, queryParams);
  const resources = [];
  rows.forEach((row, index) => {
    resources.push(...cohortRowToFhirResources(cohortType, row, index, {
      anonymize: queryParams.anonymize !== 'false'
    }));
  });

  if (!resources.length) {
    throw new NotFoundError('No records in this cohort to export');
  }

  return wrapFhirBundle(resources, {
    type: 'cohort',
    cohortType,
    anonymize: queryParams.anonymize !== 'false'
  });
}

export { FHIR_JSON };

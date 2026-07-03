import { query } from '../db/pool.js';
import { ValidationError } from '../core/errors.js';
import { getKcRegistryOverview } from './kcRegistryService.js';
import { getKeratitisOverview } from './keratitisRegistryService.js';
import { getGraftOutcomesOverview } from './kpGraftOutcomesService.js';

const COHORT_TYPES = Object.freeze(['kc', 'cxl', 'keratitis', 'kp', 'kp-graft']);

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

function monthsBetween(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export async function getResearchDashboard(clinicId) {
  const [kc, keratitis, graft, kpStats, visitStats] = await Promise.all([
    getKcRegistryOverview(clinicId),
    getKeratitisOverview(clinicId),
    getGraftOutcomesOverview(clinicId),
    query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'Waiting')::int AS waiting
        FROM keratoplasty_patients WHERE clinic_id = $1
      `,
      [clinicId]
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM visits
       WHERE clinic_id = $1
         AND status != 'cancelled'
      `,
      [clinicId]
    )
  ]);

  return {
    generatedAt: new Date().toISOString(),
    registries: {
      kc,
      keratitis,
      graft,
      keratoplasty: kpStats.rows[0]
    },
    visits: visitStats.rows[0],
    cohorts: COHORT_TYPES.map((id) => ({ id, label: cohortLabel(id) }))
  };
}

function cohortLabel(id) {
  const labels = {
    kc: 'KC registry patients',
    cxl: 'CXL procedures',
    keratitis: 'Keratitis / ulcer cases',
    kp: 'Keratoplasty patients',
    'kp-graft': 'Post-graft outcomes (completed KP)'
  };
  return labels[id] || id;
}

export async function listCohortRows(clinicId, cohortType, queryParams = {}) {
  const type = String(cohortType || '').toLowerCase();
  if (!COHORT_TYPES.includes(type)) {
    throw new ValidationError(`Unknown cohort type. Use: ${COHORT_TYPES.join(', ')}`);
  }

  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 500, 1), 2000);

  if (type === 'kc') {
    const { rows } = await query(
      `
        SELECT kc_registry_id, full_name, eye_involvement, status, progression_status, index_date, emr_patient_mrn
        FROM kc_registry_patients
       WHERE clinic_id = $1
       ORDER BY updated_at DESC
       LIMIT $2
      `,
      [clinicId, limit]
    );
    return rows.map((r) => ({
      id: r.kc_registry_id,
      fullName: r.full_name,
      eye: r.eye_involvement,
      status: r.status,
      progressionStatus: r.progression_status,
      indexDate: r.index_date,
      emrMrn: r.emr_patient_mrn
    }));
  }

  if (type === 'cxl') {
    const { rows } = await query(
      `
        SELECT c.id, p.kc_registry_id, p.full_name, c.eye, c.procedure_date, c.epi_type, c.uv_energy_j_cm2, c.outcome
        FROM kc_cxl_procedures c
        JOIN kc_registry_patients p ON p.id = c.kc_patient_id AND p.clinic_id = c.clinic_id
       WHERE c.clinic_id = $1
       ORDER BY c.procedure_date DESC NULLS LAST
       LIMIT $2
      `,
      [clinicId, limit]
    );
    return rows.map((r) => ({
      id: r.id,
      kcPatientId: r.kc_registry_id,
      fullName: r.full_name,
      eye: r.eye,
      procedureDate: r.procedure_date,
      epiType: r.epi_type,
      energyJcm2: r.uv_energy_j_cm2,
      outcome: r.outcome
    }));
  }

  if (type === 'keratitis') {
    const { rows } = await query(
      `
        SELECT case_id, full_name, eye, etiology, status, presentation_date, contact_lens, emr_patient_mrn
        FROM keratitis_ulcer_cases
       WHERE clinic_id = $1
       ORDER BY presentation_date DESC NULLS LAST
       LIMIT $2
      `,
      [clinicId, limit]
    );
    return rows.map((r) => ({
      caseId: r.case_id,
      fullName: r.full_name,
      eye: r.eye,
      etiology: r.etiology,
      status: r.status,
      presentationDate: r.presentation_date,
      contactLens: r.contact_lens,
      emrMrn: r.emr_patient_mrn
    }));
  }

  if (type === 'kp') {
    const { rows } = await query(
      `
        SELECT kp_patient_id, full_name, eye, procedure, status, surgery_date, graft_outcome_status
        FROM keratoplasty_patients
       WHERE clinic_id = $1
       ORDER BY updated_at DESC
       LIMIT $2
      `,
      [clinicId, limit]
    );
    return rows.map((r) => ({
      kpPatientId: r.kp_patient_id,
      fullName: r.full_name,
      eye: r.eye,
      procedure: r.procedure,
      status: r.status,
      surgeryDate: r.surgery_date,
      graftOutcome: r.graft_outcome_status
    }));
  }

  // kp-graft
  const { rows } = await query(
    `
      SELECT
        kp.kp_patient_id,
        kp.full_name,
        kp.eye,
        kp.procedure,
        kp.surgery_date,
        kp.graft_outcome_status,
        COUNT(DISTINCT e.id)::int AS exam_count,
        MAX(e.endothelial_count) AS latest_ecd,
        COUNT(DISTINCT r.id)::int AS rejection_count
      FROM keratoplasty_patients kp
      LEFT JOIN kp_post_graft_exams e ON e.kp_patient_id = kp.id AND e.clinic_id = kp.clinic_id
      LEFT JOIN kp_rejection_episodes r ON r.kp_patient_id = kp.id AND r.clinic_id = kp.clinic_id
     WHERE kp.clinic_id = $1 AND kp.status = 'Completed'
     GROUP BY kp.id, kp.kp_patient_id, kp.full_name, kp.eye, kp.procedure, kp.surgery_date, kp.graft_outcome_status
     ORDER BY kp.surgery_date DESC NULLS LAST
     LIMIT $2
    `,
    [clinicId, limit]
  );
  return rows.map((r) => ({
    kpPatientId: r.kp_patient_id,
    fullName: r.full_name,
    eye: r.eye,
    procedure: r.procedure,
    surgeryDate: r.surgery_date,
    graftOutcome: r.graft_outcome_status,
    examCount: r.exam_count,
    latestEcd: r.latest_ecd,
    rejectionCount: r.rejection_count
  }));
}

export async function exportCohortCsv(clinicId, cohortType, queryParams = {}) {
  const rows = await listCohortRows(clinicId, cohortType, queryParams);
  if (!rows.length) {
    const headers = ['message'];
    return toCsv(headers, [{ message: 'No records in this cohort' }]);
  }
  const headers = Object.keys(rows[0]);
  return toCsv(headers, rows);
}

/**
 * Simplified graft survival summary at standard post-op month checkpoints.
 */
export async function getGraftSurvivalSummary(clinicId) {
  const { rows } = await query(
    `
      SELECT
        kp.id,
        kp.kp_patient_id,
        kp.full_name,
        kp.procedure,
        kp.surgery_date,
        kp.graft_outcome_status,
        kp.updated_at,
        MAX(e.exam_date) AS last_exam_date
      FROM keratoplasty_patients kp
      LEFT JOIN kp_post_graft_exams e ON e.kp_patient_id = kp.id AND e.clinic_id = kp.clinic_id
     WHERE kp.clinic_id = $1 AND kp.status = 'Completed' AND kp.surgery_date IS NOT NULL
     GROUP BY kp.id
     ORDER BY kp.surgery_date ASC
    `,
    [clinicId]
  );

  const today = new Date();
  const checkpoints = [1, 3, 6, 12, 24, 36];
  const patients = rows.map((r) => {
    const failed = String(r.graft_outcome_status || '').toLowerCase() === 'failed';
    const endDate = failed
      ? (r.last_exam_date || r.updated_at || today)
      : today;
    const followUpMonths = monthsBetween(r.surgery_date, endDate) ?? 0;
    return {
      kpPatientId: r.kp_patient_id,
      fullName: r.full_name,
      procedure: r.procedure,
      surgeryDate: r.surgery_date,
      graftOutcome: r.graft_outcome_status || 'Unknown',
      failed,
      followUpMonths
    };
  });

  const curve = checkpoints.map((month) => {
    const eligible = patients.filter((p) => p.followUpMonths >= month || p.failed);
    const atRisk = eligible.length;
    const survived = eligible.filter((p) => !p.failed || p.followUpMonths >= month).length;
    const survivalRate = atRisk ? Math.round((survived / atRisk) * 1000) / 10 : null;
    return { monthsPostOp: month, atRisk, survived, survivalRate };
  });

  const total = patients.length;
  const failed = patients.filter((p) => p.failed).length;

  return {
    totalGrafts: total,
    failedGrafts: failed,
    survivalRateOverall: total ? Math.round(((total - failed) / total) * 1000) / 10 : null,
    curve,
    patients
  };
}

import { query } from '../db/pool.js';
import { getVisitStats } from './visitService.js';
import { getKcRegistryOverview } from './kcRegistryService.js';
import { getKeratitisOverview } from './keratitisRegistryService.js';
import { getKeratoplastyOverview } from './keratoplastyPatientService.js';
import { purgeOrphanPatients } from './patientService.js';

/**
 * Institute-wide operational KPIs for the dashboard (tenant-scoped).
 * @param {string} clinicId
 */
export async function getInstituteKpis(clinicId) {
  await purgeOrphanPatients(clinicId);

  const [visitStats, patientRows, weekRows, kc, keratitis, kp] = await Promise.all([
    getVisitStats(clinicId),
    query(
      `
        SELECT COUNT(DISTINCT v.patient_id)::int AS total
          FROM visits v
         WHERE v.clinic_id = $1
           AND v.status != 'cancelled'
      `,
      [clinicId]
    ),
    query(
      `
        SELECT COUNT(*)::int AS week
          FROM visits
         WHERE clinic_id = $1
           AND status != 'cancelled'
           AND visit_date >= CURRENT_DATE - INTERVAL '7 days'
      `,
      [clinicId]
    ),
    getKcRegistryOverview(clinicId),
    getKeratitisOverview(clinicId),
    getKeratoplastyOverview(clinicId)
  ]);

  return {
    generatedAt: new Date().toISOString(),
    visits: {
      total: visitStats.total,
      today: visitStats.todayVisits,
      week: weekRows.rows[0].week,
      uniquePatients: patientRows.rows[0].total,
      sexRatio: visitStats.sexRatio,
      lastUpdated: visitStats.recent[0]?.updatedAt ?? null
    },
    recent: visitStats.recent,
    registries: {
      kc: {
        enrolled: kc.patients.total,
        active: kc.patients.active,
        cxl: kc.cxl.total,
        progression: kc.patients.progression_confirmed
      },
      keratitis: {
        total: keratitis.total,
        active: keratitis.active,
        resolved: keratitis.resolved
      },
      keratoplasty: {
        waiting: kp.patients.waiting,
        emergency: kp.patients.emergency,
        completed: kp.patients.completed,
        tissueAvailable: kp.tissues.available
      }
    }
  };
}

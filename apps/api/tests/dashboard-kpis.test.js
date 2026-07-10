import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(async (sql) => {
    if (sql.includes('COUNT(DISTINCT v.patient_id)')) {
      return { rows: [{ total: 42 }] };
    }
    if (sql.includes('FROM visits')) {
      return { rows: [{ week: 9 }] };
    }
    return { rows: [] };
  })
}));

vi.mock('../src/services/visitService.js', () => ({
  getVisitStats: vi.fn(async () => ({
    total: 120,
    todayVisits: 8,
    sexRatio: { male: 31, female: 29 },
    recent: [{ updatedAt: '2026-07-03T08:00:00.000Z' }]
  }))
}));

vi.mock('../src/services/kcRegistryService.js', () => ({
  getKcRegistryOverview: vi.fn(async () => ({
    patients: { total: 25, active: 19, progression_confirmed: 6 },
    cxl: { total: 11 }
  }))
}));

vi.mock('../src/services/keratitisRegistryService.js', () => ({
  getKeratitisOverview: vi.fn(async () => ({
    total: 14,
    active: 5,
    resolved: 9
  }))
}));

vi.mock('../src/services/keratoplastyPatientService.js', () => ({
  getKeratoplastyOverview: vi.fn(async () => ({
    patients: { waiting: 7, emergency: 2, completed: 10 },
    tissues: { available: 4 }
  }))
}));

vi.mock('../src/services/patientService.js', () => ({
  purgeOrphanPatients: vi.fn(async () => {})
}));

import { getInstituteKpis } from '../src/services/dashboardService.js';

describe('dashboardService.getInstituteKpis', () => {
  it('returns consolidated visit and registry KPI payload', async () => {
    const data = await getInstituteKpis('clinic-1');
    expect(data.generatedAt).toBeTruthy();
    expect(data.visits).toEqual({
      total: 120,
      today: 8,
      week: 9,
      uniquePatients: 42,
      sexRatio: { male: 31, female: 29 },
      lastUpdated: '2026-07-03T08:00:00.000Z'
    });
    expect(data.registries.kc).toEqual({
      enrolled: 25,
      active: 19,
      cxl: 11,
      progression: 6
    });
    expect(data.registries.keratitis).toEqual({
      total: 14,
      active: 5,
      resolved: 9
    });
    expect(data.registries.keratoplasty).toEqual({
      waiting: 7,
      emergency: 2,
      completed: 10,
      tissueAvailable: 4
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const clientQueryMock = vi.fn();

vi.mock('../src/db/pool.js', () => ({
  query: (...args) => queryMock(...args),
  withTransaction: vi.fn()
}));

import { deletePatientIfOrphaned, purgeOrphanPatients } from '../src/services/patientService.js';

describe('patient cleanup', () => {
  beforeEach(() => {
    queryMock.mockReset();
    clientQueryMock.mockReset();
  });

  it('deletePatientIfOrphaned removes patient with no active visits', async () => {
    clientQueryMock
      .mockResolvedValueOnce({ rows: [{ active_visits: 0 }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const client = { query: clientQueryMock };
    const deleted = await deletePatientIfOrphaned(client, 'clinic-1', 'patient-1');

    expect(deleted).toBe(true);
    expect(clientQueryMock).toHaveBeenCalledTimes(2);
    expect(clientQueryMock.mock.calls[1][0]).toContain('DELETE FROM patients');
  });

  it('deletePatientIfOrphaned keeps patient with active visits', async () => {
    clientQueryMock.mockResolvedValueOnce({ rows: [{ active_visits: 2 }] });

    const client = { query: clientQueryMock };
    const deleted = await deletePatientIfOrphaned(client, 'clinic-1', 'patient-1');

    expect(deleted).toBe(false);
    expect(clientQueryMock).toHaveBeenCalledTimes(1);
  });

  it('purgeOrphanPatients deletes patients without active visits', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 3 });

    await purgeOrphanPatients('clinic-1');

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain('DELETE FROM patients');
    expect(queryMock.mock.calls[0][1]).toEqual(['clinic-1']);
  });
});

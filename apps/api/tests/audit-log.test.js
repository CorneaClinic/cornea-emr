import { describe, it, expect } from 'vitest';
import { listClinicAuditLogs } from '../src/services/auditLogService.js';

describe('auditLogService', () => {
  it('exports listClinicAuditLogs', () => {
    expect(typeof listClinicAuditLogs).toBe('function');
  });
});

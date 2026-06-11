import { describe, it, expect } from 'vitest';
import {
  ROLES,
  PERMISSIONS,
  ROLE_LABELS,
  roleHasPermission,
  isValidRole
} from '../src/core/permissions.js';

describe('RBAC roles', () => {
  it('includes cornea consultant and doctor in training', () => {
    expect(ROLES).toContain('cornea_consultant');
    expect(ROLES).toContain('doctor_in_training');
    expect(ROLE_LABELS.doctor_in_training).toBe('General Doctor in Training');
  });

  it('senior clinical roles share full clinical permissions', () => {
    for (const role of ['ophthalmologist', 'cornea_consultant']) {
      expect(roleHasPermission(role, PERMISSIONS.VISITS_FINALIZE)).toBe(true);
      expect(roleHasPermission(role, PERMISSIONS.VISITS_DELETE)).toBe(true);
      expect(roleHasPermission(role, PERMISSIONS.KP_WRITE)).toBe(true);
    }
  });

  it('doctor in training matches senior clinical except visit delete', () => {
    expect(roleHasPermission('doctor_in_training', PERMISSIONS.VISITS_FINALIZE)).toBe(true);
    expect(roleHasPermission('doctor_in_training', PERMISSIONS.KP_WRITE)).toBe(true);
    expect(roleHasPermission('doctor_in_training', PERMISSIONS.VISITS_DELETE)).toBe(false);
    expect(roleHasPermission('doctor_in_training', PERMISSIONS.USERS_MANAGE)).toBe(false);
  });

  it('rejects unknown roles', () => {
    expect(isValidRole('general_doctor')).toBe(false);
  });
});

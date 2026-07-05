import { describe, it, expect } from 'vitest';
import { ENTITY_TYPES } from '../src/services/recordLockService.js';

describe('registry concurrency (P4)', () => {
  it('record lock entity types include all registries', () => {
    expect(ENTITY_TYPES).toContain('visit');
    expect(ENTITY_TYPES).toContain('kp_patient');
    expect(ENTITY_TYPES).toContain('kp_tissue');
    expect(ENTITY_TYPES).toContain('kc_patient');
    expect(ENTITY_TYPES).toContain('keratitis_case');
    expect(ENTITY_TYPES).toContain('dry_eye_case');
    expect(ENTITY_TYPES.length).toBe(6);
  });
});

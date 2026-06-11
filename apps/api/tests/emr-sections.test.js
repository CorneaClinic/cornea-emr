import { describe, it, expect } from 'vitest';
import {
  EMR_SECTIONS,
  resolveEmrSections,
  validateEmrSectionOverride,
  defaultSectionsForRole
} from '../src/core/emr-sections.js';

describe('EMR section visibility', () => {
  it('receptionist defaults hide clinical form and admin', () => {
    const sections = defaultSectionsForRole('receptionist');
    expect(sections.patient_form).toBe(false);
    expect(sections.user_admin).toBe(false);
    expect(sections.records).toBe(true);
  });

  it('admin override can grant patient form to receptionist', () => {
    const sections = resolveEmrSections('receptionist', { patient_form: true });
    expect(sections.patient_form).toBe(true);
    expect(sections.keratoplasty).toBe(false);
  });

  it('null override uses role defaults', () => {
    const base = defaultSectionsForRole('technician');
    expect(resolveEmrSections('technician', null)).toEqual(base);
  });

  it('validates section override keys', () => {
    const cleaned = validateEmrSectionOverride({ dashboard: true, records: false });
    expect(cleaned).toEqual({ dashboard: true, records: false });
    expect(EMR_SECTIONS).toContain('database');
  });

  it('rejects invalid override shapes', () => {
    expect(() => validateEmrSectionOverride({ unknown: true })).toThrow();
    expect(() => validateEmrSectionOverride(['dashboard'])).toThrow();
  });
});

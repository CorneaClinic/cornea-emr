import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  normalizeName,
  nameSimilarity,
  ageToApproxDob,
  scoreDuplicateMatch
} from '../src/services/duplicatePatientService.js';

describe('duplicatePatientService matching (P2)', () => {
  it('normalizes phone to last 10 digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });

  it('treats same MRN as existing patient (info, not block)', () => {
    const result = scoreDuplicateMatch(
      { mrn: 'CC-001', fullName: 'Jane Doe' },
      { mrn: 'CC-001', full_name: 'Jane Doe' }
    );
    expect(result.severity).toBe('info');
    expect(result.reasons).toContain('existing_patient');
  });

  it('blocks national ID registered under different MRN', () => {
    const result = scoreDuplicateMatch(
      { mrn: 'CC-002', nationalId: '12345-6789012-3', fullName: 'A' },
      { mrn: 'CC-001', national_id: '12345-6789012-3', full_name: 'B' }
    );
    expect(result.severity).toBe('block');
    expect(result.reasons).toContain('national_id_cross_mrn');
  });

  it('detects high-confidence name + phone match', () => {
    const result = scoreDuplicateMatch(
      { fullName: 'Muhammad Ali Khan', phone: '03001234567', sex: 'Male' },
      { full_name: 'Muhammad Ali Khan', phone: '+92 300 1234567', sex: 'Male' }
    );
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.severity).toBe('high');
  });

  it('name similarity handles token overlap', () => {
    expect(nameSimilarity('Dr. Jane Doe', 'Jane Doe')).toBeGreaterThan(0.8);
    expect(normalizeName('  Mr. John   Smith ')).toBe('john smith');
  });

  it('derives approximate DOB from age', () => {
    const dob = ageToApproxDob(40, 'years');
    expect(dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const year = Number(dob.slice(0, 4));
    expect(year).toBeLessThanOrEqual(new Date().getFullYear() - 39);
  });
});

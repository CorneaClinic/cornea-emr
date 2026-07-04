import { describe, it, expect } from 'vitest';
import {
  scrubPhiText,
  teachingCaseRef,
  anonymizedFilename,
  buildAnonymizedTeachingExport,
  toTeachingCaseListItem
} from '../src/services/teachingCaseAnonymizer.js';

describe('Teaching case anonymizer (backlog B3)', () => {
  const sampleAsset = {
    id: '11111111-2222-3333-4444-555555555555',
    category: 'teaching_case',
    originalFilename: 'John_Smith_slit_lamp.jpg',
    mimeType: 'image/jpeg',
    byteSize: 204800,
    createdAt: '2026-01-15T10:00:00Z',
    patientName: 'John Smith',
    patientMrn: 'CC-2024-001',
    visitDiagnosis: 'Keratoconus OD',
    metadata: {
      teaching: {
        teachingCase: true,
        title: 'Acute hydrops in KC',
        summary: 'Resident teaching case',
        tags: ['keratoconus', 'hydrops'],
        learningObjectives: ['Identify acute hydrops'],
        interestingCase: true
      }
    },
    link: {
      eye: 'OD',
      diagnosisLabel: 'Keratoconus with acute hydrops',
      procedureLabel: 'CXL planned',
      capturedAt: '2026-01-15T09:30:00Z'
    }
  };

  it('generates stable teaching case reference', () => {
    expect(teachingCaseRef(sampleAsset.id)).toBe('TC-11111111');
  });

  it('scrubs common PHI patterns from free text', () => {
    const scrubbed = scrubPhiText('Contact MRN: CC-99 on 15/01/1990 or test@clinic.com');
    expect(scrubbed).not.toContain('test@clinic.com');
    expect(scrubbed).toContain('[redacted]');
  });

  it('builds anonymized export without patient identifiers', () => {
    const exp = buildAnonymizedTeachingExport(sampleAsset);
    expect(exp.caseRef).toBe('TC-11111111');
    expect(exp.title).toBe('Acute hydrops in KC');
    expect(exp.patientName).toBeUndefined();
    expect(exp.patientMrn).toBeUndefined();
    expect(exp.filename).not.toContain('John_Smith');
    expect(exp.tags).toContain('keratoconus');
    expect(exp.flags.interestingCase).toBe(true);
  });

  it('uses generic filename for anonymized export', () => {
    expect(anonymizedFilename(sampleAsset)).toMatch(/^teaching_case-11111111\.jpg$/);
  });

  it('list item includes PHI only when not anonymized', () => {
    const staff = toTeachingCaseListItem(sampleAsset, { anonymize: false });
    expect(staff.patientName).toBe('John Smith');
    const anon = toTeachingCaseListItem(sampleAsset, { anonymize: true });
    expect(anon.caseRef).toBe('TC-11111111');
    expect(anon.patientName).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import {
  toFhirPatient,
  toFhirEncounter,
  toFhirCondition,
  extractDiagnosisFromPayload,
  cohortRowToFhirResources,
  wrapFhirBundle,
  mapFhirGender
} from '../src/services/fhirExportService.js';

describe('FHIR export mappers (P4)', () => {
  it('maps patient sex to FHIR gender', () => {
    expect(mapFhirGender('Male')).toBe('male');
    expect(mapFhirGender('Female')).toBe('female');
  });

  it('builds Patient resource with MRN', () => {
    const p = toFhirPatient({
      id: '11111111-2222-3333-4444-555555555555',
      mrn: 'CC-001',
      fullName: 'Jane Doe',
      sex: 'Female',
      dob: '1990-01-15',
      phone: '+1234567890'
    });
    expect(p.resourceType).toBe('Patient');
    expect(p.identifier[0].value).toBe('CC-001');
    expect(p.name[0].text).toBe('Jane Doe');
    expect(p.birthDate).toBe('1990-01-15');
  });

  it('anonymizes patient export', () => {
    const p = toFhirPatient({
      id: '11111111-2222-3333-4444-555555555555',
      mrn: 'CC-001',
      fullName: 'Jane Doe',
      sex: 'Female',
      dob: '1990-01-15',
      phone: '+1234567890'
    }, { anonymize: true });
    expect(p.name[0].text).toMatch(/Research Patient/);
    expect(p.birthDate).toBeUndefined();
    expect(p.telecom).toBeUndefined();
  });

  it('builds Encounter from visit', () => {
    const e = toFhirEncounter({
      id: 'visit-uuid',
      patientId: 'patient-uuid',
      visitDate: '2025-06-01',
      status: 'finalized',
      legacyLocalId: 42
    });
    expect(e.resourceType).toBe('Encounter');
    expect(e.status).toBe('finished');
    expect(e.subject.reference).toBe('Patient/patient-uuid');
  });

  it('extracts diagnosis from visit payload', () => {
    expect(extractDiagnosisFromPayload({ diagnosis: 'Keratoconus OD' })).toBe('Keratoconus OD');
    expect(extractDiagnosisFromPayload({ chiefComplaint: 'Red eye' })).toBe('Red eye');
  });

  it('maps KC cohort row to FHIR resources', () => {
    const resources = cohortRowToFhirResources('kc', {
      id: 'KC-001',
      fullName: 'John Smith',
      emrMrn: 'MRN-9',
      progressionStatus: 'Confirmed'
    }, 0, { anonymize: true });
    expect(resources.some((r) => r.resourceType === 'Patient')).toBe(true);
    expect(resources.some((r) => r.resourceType === 'Condition')).toBe(true);
    expect(resources.some((r) => r.resourceType === 'Observation' && r.valueString === 'Confirmed')).toBe(true);
  });

  it('wraps resources in a collection Bundle', () => {
    const bundle = wrapFhirBundle([
      { resourceType: 'Patient', id: 'p1' },
      { resourceType: 'Encounter', id: 'e1' }
    ], { type: 'cohort', cohortType: 'kc', anonymize: true });
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.entry).toHaveLength(2);
    expect(bundle.meta.security?.[0].code).toBe('ANONY');
  });
});

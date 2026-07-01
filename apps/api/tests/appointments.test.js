import { describe, it, expect } from 'vitest';
import { mapAppointment } from '../src/services/appointmentService.js';

describe('appointment mappers (P5)', () => {
  it('maps appointment database row', () => {
    const row = {
      id: 'uuid-1',
      clinic_id: 'clinic-1',
      appointment_id: 'APPT-0001',
      patient_id: 'pat-1',
      patient_mrn: 'MRN-1',
      patient_name: 'Jane Doe',
      patient_phone: '+123',
      appointment_date: '2025-06-15',
      start_time: '09:30:00',
      duration_minutes: 20,
      appointment_type: 'recall',
      station: 'doctor_exam',
      status: 'scheduled',
      reason: 'KC review',
      recall_source_visit_id: null,
      notes: null,
      legacy_local_id: null,
      revision: 1,
      created_at: '2025-06-01T00:00:00Z',
      updated_at: '2025-06-01T00:00:00Z'
    };
    const mapped = mapAppointment(row);
    expect(mapped.appointmentId).toBe('APPT-0001');
    expect(mapped.startTime).toBe('09:30');
    expect(mapped.appointmentType).toBe('recall');
  });
});

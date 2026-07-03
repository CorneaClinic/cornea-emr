import { describe, it, expect } from 'vitest';
import {
  isDicomPart10,
  formatDicomPatientName,
  formatDicomDate,
  formatDicomTime,
  suggestMediaCategory,
  parseDicomBuffer
} from '../src/services/dicomParserService.js';
import { buildMinimalDicomBuffer } from '../../../e2e/fixtures/minimal-dicom.js';

describe('DICOM parser helpers (P6)', () => {
  it('detects DICOM Part 10 preamble', () => {
    const buf = Buffer.alloc(132);
    buf.write('DICM', 128, 'ascii');
    expect(isDicomPart10(buf)).toBe(true);
    expect(isDicomPart10(Buffer.alloc(100))).toBe(false);
  });

  it('formats DICOM patient name PN component order', () => {
    expect(formatDicomPatientName('Doe^John')).toBe('John Doe');
    expect(formatDicomPatientName('SingleName')).toBe('SingleName');
  });

  it('formats DICOM dates and times', () => {
    expect(formatDicomDate('20250625')).toBe('2025-06-25');
    expect(formatDicomTime('093015')).toBe('09:30:15');
  });

  it('suggests media category from modality and descriptions', () => {
    expect(suggestMediaCategory('OCT', '', '')).toBe('as_oct');
    expect(suggestMediaCategory('OT', 'Pentacam HR', '')).toBe('topography');
    expect(suggestMediaCategory('', 'Sirius tomography', '')).toBe('tomography');
    expect(suggestMediaCategory('OP', 'Slit lamp photo', '')).toBe('slit_lamp');
    expect(suggestMediaCategory('XX', 'unknown study', '')).toBe('other');
  });

  it('parses synthetic Part 10 fixture', () => {
    const parsed = parseDicomBuffer(buildMinimalDicomBuffer());
    expect(parsed.suggestedCategory).toBe('topography');
    expect(parsed.tags.patientName).toBe('John Doe');
    expect(parsed.tags.modality).toBe('OT');
  });
});

import { describe, it, expect } from 'vitest';
import { computeOsdIndexScore, osdIndexToSeverity } from '../src/services/dryEyeScoring.js';
import { analyzeEctasiaMetricsV2 } from '../src/services/ectasiaAiService.js';

describe('Dry eye OSD scoring (P7)', () => {
  it('computes higher index for severe surface disease', () => {
    const mild = computeOsdIndexScore({ tbutOd: 9, schirmerOd: 12, osdiScore: 10 });
    const severe = computeOsdIndexScore({
      tbutOd: 4,
      tbutOs: 3,
      schirmerOd: 4,
      osdiScore: 40,
      deq5Score: 14,
      severity: 'severe',
      mgdGrade: 'Severe'
    });
    expect(severe).toBeGreaterThan(mild);
    expect(osdIndexToSeverity(severe)).toBe('Severe');
  });

  it('maps osd index to severity bands', () => {
    expect(osdIndexToSeverity(5)).toBe('Normal');
    expect(osdIndexToSeverity(20)).toBe('Mild');
    expect(osdIndexToSeverity(35)).toBe('Moderate');
    expect(osdIndexToSeverity(55)).toBe('Severe');
  });
});

describe('Ectasia AI v2 (P7)', () => {
  it('adds ABCD and biomechanical modifiers', () => {
    const v2 = analyzeEctasiaMetricsV2({
      od: { badD: 1.4, kmax: 46, abcdGrade: 'C', isv: 45 },
      os: { badD: 1.2, kmax: 44 },
      shared: { age: 22, ocularSurfaceDryEye: true }
    });
    expect(v2.modelVersion).toBe('ectasia-v2-topography');
    expect(v2.v2Enhancements?.length).toBeGreaterThan(0);
    expect(v2.compositeScore).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseContactLensRaw,
  hasContactLensData,
  summarizeContactLensFit
} from '../src/services/contactLensOutcomesService.js';

const SAMPLE_FIT = {
  version: 1,
  activeTab: 'finalRx',
  fit: {
    indication: ['Keratoconus'],
    lensSelection: { shared: { lensType: 'RGP', wearingSchedule: 'Daily wear' }, od: {}, os: {} },
    finalRx: {
      shared: { lensType: 'RGP' },
      od: { baseCurve: '7.2', power: '-3.00', diameter: '9.5', brand: 'Rose K' },
      os: { baseCurve: '7.4', power: '-2.50', diameter: '9.5', brand: 'Rose K' }
    },
    dispensing: { checklist: ['Insertion training', 'Written instructions given'], solutions: ['Multipurpose solution'], notes: '' },
    followUp: { interval: '2 weeks', compare: {}, notes: '', date: '' },
    complications: [],
    notes: ''
  },
  history: [{ at: '2026-01-01', snapshot: {} }]
};

describe('Contact lens outcomes (backlog B1)', () => {
  it('parses contactLensJSON string from visit payload', () => {
    const parsed = parseContactLensRaw(JSON.stringify(SAMPLE_FIT));
    expect(parsed?.fit?.indication).toEqual(['Keratoconus']);
  });

  it('detects meaningful contact lens data', () => {
    expect(hasContactLensData(JSON.stringify(SAMPLE_FIT))).toBe(true);
    expect(hasContactLensData('{"version":1,"fit":{},"history":[]}')).toBe(false);
    expect(hasContactLensData(null)).toBe(false);
  });

  it('summarizes fit for research cohort export', () => {
    const summary = summarizeContactLensFit(SAMPLE_FIT);
    expect(summary.lensType).toBe('RGP');
    expect(summary.indications).toBe('Keratoconus');
    expect(summary.finalRxOd).toContain('7.2');
    expect(summary.dispensingDocumented).toBe('Yes');
    expect(summary.historyEntries).toBe(1);
  });

  it('flags complications when present', () => {
    const withComp = {
      ...SAMPLE_FIT,
      fit: {
        ...SAMPLE_FIT.fit,
        complications: ['CLPU', 'Dry eye flare']
      }
    };
    const summary = summarizeContactLensFit(withComp);
    expect(summary.complications).toContain('CLPU');
  });
});

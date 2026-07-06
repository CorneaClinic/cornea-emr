import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PILOT_DOCS,
  checkAllPilotDocs,
  checkVerifyScript,
  checkWeeklyReviewScript,
  checkProjectDoc,
  checkMetricsExpansionLinkage,
  checkSafetyLinkage,
  classifySafetyStatus
} from '../lib/pilot-plan-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('pilot-plan-checks (P11)', () => {
  it('defines pilot docs', () => {
    assert.equal(PILOT_DOCS.length, 5);
  });

  it('detects all pilot docs', () => {
    assert.equal(checkAllPilotDocs(ROOT).ok, true);
  });

  it('detects verify script', () => {
    assert.equal(checkVerifyScript(ROOT).ok, true);
  });

  it('detects weekly review script', () => {
    assert.equal(checkWeeklyReviewScript(ROOT).ok, true);
  });

  it('detects safety linkage', () => {
    assert.equal(checkSafetyLinkage(ROOT).ok, true);
  });

  it('detects metrics/expansion linkage', () => {
    assert.equal(checkMetricsExpansionLinkage(ROOT).ok, true);
  });

  it('detects project doc', () => {
    assert.equal(checkProjectDoc(ROOT).ok, true);
  });

  it('classifies RED on critical findings', () => {
    const result = classifySafetyStatus([{ level: 'critical', message: 'API down' }]);
    assert.equal(result.status, 'RED');
  });

  it('classifies AMBER on repeated warnings', () => {
    const result = classifySafetyStatus([
      { level: 'warn', message: 'one' },
      { level: 'warn', message: 'two' }
    ]);
    assert.equal(result.status, 'AMBER');
  });
});

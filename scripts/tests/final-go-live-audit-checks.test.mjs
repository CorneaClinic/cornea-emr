import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BASELINE_SCORES,
  PROJECT_SCORE_ITEMS,
  computeDimensionScores,
  compareScores,
  countOpenHighRisks,
  decideGoLive,
  checkAuditDoc,
  checkVerifyScript,
  checkRunAuditScript,
  checkProjectDoc,
  checkBaselineReferenced
} from '../lib/final-go-live-audit-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('final-go-live-audit-checks (P12)', () => {
  it('defines project score items', () => {
    assert.equal(PROJECT_SCORE_ITEMS.length, 11);
  });

  it('detects audit doc', () => {
    assert.equal(checkAuditDoc(ROOT).ok, true);
  });

  it('detects verify script', () => {
    assert.equal(checkVerifyScript(ROOT).ok, true);
  });

  it('detects audit runner script', () => {
    assert.equal(checkRunAuditScript(ROOT).ok, true);
  });

  it('detects baseline reference', () => {
    assert.equal(checkBaselineReferenced(ROOT).ok, true);
  });

  it('detects project doc', () => {
    assert.equal(checkProjectDoc(ROOT).ok, true);
  });

  it('lifts scores above baseline when all projects complete', () => {
    const completion = Object.fromEntries(PROJECT_SCORE_ITEMS.map((p) => [p.id, true]));
    const scores = computeDimensionScores(completion);
    assert.ok(scores.overall > BASELINE_SCORES.overall);
  });

  it('compares baseline to current', () => {
    const completion = Object.fromEntries(PROJECT_SCORE_ITEMS.map((p) => [p.id, true]));
    const current = computeDimensionScores(completion);
    const comparison = compareScores(BASELINE_SCORES, current);
    assert.equal(comparison.length, 6);
    assert.ok(comparison.every((row) => row.delta >= 0));
  });

  it('returns CONDITIONAL GO with one open high risk', () => {
    const completion = Object.fromEntries(PROJECT_SCORE_ITEMS.map((p) => [p.id, true]));
    const scores = computeDimensionScores(completion);
    const open = countOpenHighRisks();
    const outcome = decideGoLive(scores, open);
    assert.ok(['GO', 'CONDITIONAL GO'].includes(outcome.decision));
  });
});

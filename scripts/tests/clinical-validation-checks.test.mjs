import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CLINICAL_WORKFLOWS,
  checkWorkflowDefinitions,
  checkWorkflowStaticModules,
  checkWorkflowUiMarkers,
  checkPrintingSupport,
  checkMediaPlatform,
  checkSimulationScript,
  checkClinicalE2e,
  checkProjectDoc
} from '../lib/clinical-validation-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('clinical-validation-checks (P8)', () => {
  it('defines 11 workflows', () => {
    assert.equal(CLINICAL_WORKFLOWS.length, 11);
    assert.equal(checkWorkflowDefinitions().ok, true);
  });

  it('detects static modules', () => {
    assert.equal(checkWorkflowStaticModules(ROOT).ok, true);
  });

  it('detects UI markers', () => {
    assert.equal(checkWorkflowUiMarkers(ROOT).ok, true);
  });

  it('detects printing support', () => {
    assert.equal(checkPrintingSupport(ROOT).ok, true);
  });

  it('detects media platform', () => {
    assert.equal(checkMediaPlatform(ROOT).ok, true);
  });

  it('detects simulation script', () => {
    assert.equal(checkSimulationScript(ROOT).ok, true);
  });

  it('detects clinical e2e', () => {
    assert.equal(checkClinicalE2e(ROOT).ok, true);
  });

  it('detects project doc', () => {
    assert.equal(checkProjectDoc(ROOT).ok, true);
  });
});

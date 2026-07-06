import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkPlaywrightSuite,
  checkApiUnitTests,
  checkStagingSmoke,
  checkProductionValidationSpec,
  checkLoadScript,
  checkA11yScript,
  checkOperatorRegression,
  checkProjectDoc,
  analyzeClinicA11y,
  checkClinicA11yStatic,
  percentile
} from '../lib/production-validation-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('production-validation-checks (P7)', () => {
  it('detects playwright suite', () => {
    assert.equal(checkPlaywrightSuite(ROOT).ok, true);
  });

  it('detects api unit tests', () => {
    assert.equal(checkApiUnitTests(ROOT).ok, true);
  });

  it('detects staging smoke', () => {
    assert.equal(checkStagingSmoke(ROOT).ok, true);
  });

  it('detects production validation spec', () => {
    assert.equal(checkProductionValidationSpec(ROOT).ok, true);
  });

  it('detects load script', () => {
    assert.equal(checkLoadScript(ROOT).ok, true);
  });

  it('detects a11y script', () => {
    assert.equal(checkA11yScript(ROOT).ok, true);
  });

  it('detects operator regression', () => {
    assert.equal(checkOperatorRegression(ROOT).ok, true);
  });

  it('detects project doc', () => {
    assert.equal(checkProjectDoc(ROOT).ok, true);
  });

  it('computes p95', () => {
    assert.equal(percentile([10, 20, 30, 40, 100], 95), 100);
  });

  it('flags missing a11y landmarks', () => {
    const bad = analyzeClinicA11y('<html><body></body></html>', '');
    assert.equal(bad.ok, false);
    assert.ok(bad.findings.length > 0);
  });

  it('passes accessible login shell in adapter', () => {
    const html = `
      <html lang="en">
      <head><title>Cornea</title><meta name="viewport" content="width=device-width"></head>
      <body>
        <div id="emrPatientModal" role="dialog"></div>
      </body></html>`;
    const adapter = `
      <label for="corneaLoginEmail">Email</label>
      <input id="corneaLoginEmail">
      <label for="corneaLoginPassword">Password</label>
      <input id="corneaLoginPassword">
      corneaCloudLoginModal`;
    assert.equal(analyzeClinicA11y(html, adapter).ok, true);
  });

  it('detects static a11y in repo', () => {
    assert.equal(checkClinicA11yStatic(ROOT).ok, true);
  });
});

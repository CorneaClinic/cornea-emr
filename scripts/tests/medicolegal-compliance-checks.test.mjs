import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GOVERNANCE_DOCS,
  checkAllGovernanceDocs,
  checkVerifyScript,
  checkAuditReviewScript,
  checkProjectDoc,
  checkConsentModule,
  checkAuditApi,
  checkIncidentLinkage,
  summarizeAuditFindings
} from '../lib/medicolegal-compliance-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('medicolegal-compliance-checks (P9)', () => {
  it('defines governance docs', () => {
    assert.equal(GOVERNANCE_DOCS.length, 4);
  });

  it('detects all governance docs', () => {
    assert.equal(checkAllGovernanceDocs(ROOT).ok, true);
  });

  it('detects verify script', () => {
    assert.equal(checkVerifyScript(ROOT).ok, true);
  });

  it('detects audit review script', () => {
    assert.equal(checkAuditReviewScript(ROOT).ok, true);
  });

  it('detects consent module', () => {
    assert.equal(checkConsentModule(ROOT).ok, true);
  });

  it('detects audit API', () => {
    assert.equal(checkAuditApi(ROOT).ok, true);
  });

  it('detects incident linkage', () => {
    assert.equal(checkIncidentLinkage(ROOT).ok, true);
  });

  it('detects project doc', () => {
    assert.equal(checkProjectDoc(ROOT).ok, true);
  });

  it('flags failed login spikes', () => {
    const rows = Array.from({ length: 15 }, () => ({ action: 'login_failed' }));
    const findings = summarizeAuditFindings(rows);
    assert.ok(findings.some((f) => f.level === 'warn'));
  });
});

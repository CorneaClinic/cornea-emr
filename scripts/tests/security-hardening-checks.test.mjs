import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkVirusScanIntegration,
  checkSecurityStatusApi,
  checkPentestSelfCheck,
  checkWafProbe,
  checkOwaspReportGenerator,
  checkAuthSessionReview,
  checkProjectDoc,
  checkVirusScanTests,
  checkDastWorkflow
} from '../lib/security-hardening-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('security-hardening-checks (P6)', () => {
  it('detects virus scan integration', () => {
    assert.equal(checkVirusScanIntegration(ROOT).ok, true);
  });

  it('detects security status API', () => {
    assert.equal(checkSecurityStatusApi(ROOT).ok, true);
  });

  it('detects pentest self-check', () => {
    assert.equal(checkPentestSelfCheck(ROOT).ok, true);
  });

  it('detects WAF probe', () => {
    assert.equal(checkWafProbe(ROOT).ok, true);
  });

  it('detects OWASP report generator', () => {
    assert.equal(checkOwaspReportGenerator(ROOT).ok, true);
  });

  it('detects auth session review script', () => {
    assert.equal(checkAuthSessionReview(ROOT).ok, true);
  });

  it('detects project doc', () => {
    assert.equal(checkProjectDoc(ROOT).ok, true);
  });

  it('detects virus scan tests', () => {
    assert.equal(checkVirusScanTests(ROOT).ok, true);
  });

  it('detects DAST workflow', () => {
    assert.equal(checkDastWorkflow(ROOT).ok, true);
  });
});

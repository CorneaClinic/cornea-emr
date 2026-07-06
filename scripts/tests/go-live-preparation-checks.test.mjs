import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GO_LIVE_DOCS,
  checkAllGoLiveDocs,
  checkVerifyScript,
  checkProjectDoc,
  checkRollbackLinkage,
  checkDowntimeLinkage,
  checkIncidentLinkage
} from '../lib/go-live-preparation-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('go-live-preparation-checks (P10)', () => {
  it('defines go-live docs', () => {
    assert.equal(GO_LIVE_DOCS.length, 6);
  });

  it('detects all go-live docs', () => {
    assert.equal(checkAllGoLiveDocs(ROOT).ok, true);
  });

  it('detects verify script', () => {
    assert.equal(checkVerifyScript(ROOT).ok, true);
  });

  it('detects rollback linkage', () => {
    assert.equal(checkRollbackLinkage(ROOT).ok, true);
  });

  it('detects downtime linkage', () => {
    assert.equal(checkDowntimeLinkage(ROOT).ok, true);
  });

  it('detects incident linkage', () => {
    assert.equal(checkIncidentLinkage(ROOT).ok, true);
  });

  it('detects project doc', () => {
    assert.equal(checkProjectDoc(ROOT).ok, true);
  });
});

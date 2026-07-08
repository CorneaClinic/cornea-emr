import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeDastTargets, isProductionHost } from '../dast/lib/safe-target.mjs';
import { analyzeAlerts, toMarkdown } from '../dast/lib/report-analyzer.mjs';

describe('DAST safe-target', () => {
  it('blocks active scan on production', () => {
    assert.throws(() =>
      assertSafeDastTargets({
        clinicUrl: 'https://corneaclinic.visionemr.net/Cornea',
        apiUrl: 'https://corneaclinic-2zfpt.ondigitalocean.app',
        activeScan: true
      })
    );
  });

  it('allows local active scan', () => {
    const out = assertSafeDastTargets({
      clinicUrl: 'http://127.0.0.1:8080/Cornea.html',
      apiUrl: 'http://127.0.0.1:3000',
      activeScan: true
    });
    assert.equal(out.clinic.hostname, '127.0.0.1');
  });

  it('detects production hosts', () => {
    assert.equal(isProductionHost('corneaclinic.visionemr.net'), true);
    assert.equal(isProductionHost('127.0.0.1'), false);
  });
});

describe('DAST report-analyzer', () => {
  it('enriches alerts with fix guidance', () => {
    const report = analyzeAlerts(
      [{ alert: 'Content Security Policy (CSP) Header Not Set', risk: 'Medium', url: 'http://x' }],
      { clinicUrl: 'http://127.0.0.1:8080', apiUrl: 'http://127.0.0.1:3000' }
    );
    assert.equal(report.alerts.length, 1);
    assert.ok(report.alerts[0].explanation);
    const md = toMarkdown(report);
    assert.match(md, /OWASP ZAP DAST Report/);
  });
});

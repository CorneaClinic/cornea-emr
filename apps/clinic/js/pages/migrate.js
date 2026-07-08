let accessToken = null;
    let currentBundle = null;

    const els = {
      btnExport: document.getElementById('btnExport'),
      btnDownload: document.getElementById('btnDownload'),
      fileInput: document.getElementById('fileInput'),
      exportStats: document.getElementById('exportStats'),
      statVisits: document.getElementById('statVisits'),
      statKpP: document.getElementById('statKpP'),
      statKpT: document.getElementById('statKpT'),
      localDupMsg: document.getElementById('localDupMsg'),
      apiUrl: document.getElementById('apiUrl'),
      apiEmail: document.getElementById('apiEmail'),
      apiPassword: document.getElementById('apiPassword'),
      btnLogin: document.getElementById('btnLogin'),
      loginStatus: document.getElementById('loginStatus'),
      btnAnalyze: document.getElementById('btnAnalyze'),
      btnImport: document.getElementById('btnImport'),
      forceUpdate: document.getElementById('forceUpdate'),
      actionStatus: document.getElementById('actionStatus'),
      verifyBadge: document.getElementById('verifyBadge'),
      reportOut: document.getElementById('reportOut')
    };

    function showBundle(bundle) {
      currentBundle = bundle;
      els.exportStats.hidden = false;
      els.statVisits.textContent = bundle.counts.visits;
      els.statKpP.textContent = bundle.counts.kpPatients;
      els.statKpT.textContent = bundle.counts.kpTissues;
      els.btnDownload.disabled = false;
      els.btnAnalyze.disabled = !accessToken;
      els.btnImport.disabled = !accessToken;

      const dupCount = (bundle.localDuplicates || []).length;
      els.localDupMsg.textContent = dupCount
        ? `⚠ ${dupCount} potential duplicate(s) detected in export (review before import).`
        : '✓ No duplicate keys detected within export.';
    }

    function showReport(result) {
      const report = result.data || result;
      const md = result.markdown || '';
      const passed = report.verification?.passed;
      els.verifyBadge.innerHTML = passed
        ? '<span class="badge ok">Verification PASSED</span>'
        : '<span class="badge fail">Verification FAILED</span>';
      els.reportOut.textContent = md || JSON.stringify(report, null, 2);
    }

    els.btnExport.addEventListener('click', async () => {
      els.btnExport.disabled = true;
      try {
        const bundle = await CorneaMigration.exportAll();
        showBundle(bundle);
      } catch (err) {
        alert('Export failed: ' + err.message);
      } finally {
        els.btnExport.disabled = false;
      }
    });

    els.btnDownload.addEventListener('click', () => {
      try {
        CorneaMigration.downloadExport(currentBundle);
      } catch (err) {
        alert(err.message);
      }
    });

    els.fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const bundle = await CorneaMigration.loadExportFile(file);
        showBundle(bundle);
      } catch (err) {
        alert('Invalid export file: ' + err.message);
      }
    });

    els.btnLogin.addEventListener('click', async () => {
      els.btnLogin.disabled = true;
      els.loginStatus.textContent = 'Connecting…';
      try {
        const session = await CorneaMigration.login({
          baseUrl: els.apiUrl.value.trim(),
          email: els.apiEmail.value.trim(),
          password: els.apiPassword.value
        });
        accessToken = session.accessToken;
        els.loginStatus.textContent = '✓ Connected as admin';
        els.btnAnalyze.disabled = !currentBundle;
        els.btnImport.disabled = !currentBundle;
      } catch (err) {
        accessToken = null;
        els.loginStatus.textContent = '✗ ' + err.message;
      } finally {
        els.btnLogin.disabled = false;
      }
    });

    els.btnAnalyze.addEventListener('click', async () => {
      els.actionStatus.textContent = 'Running dry-run analysis…';
      try {
        const result = await CorneaMigration.analyzeOnServer({
          baseUrl: els.apiUrl.value.trim(),
          accessToken,
          bundle: currentBundle
        });
        showReport(result);
        els.actionStatus.textContent = 'Dry-run complete — no database writes.';
      } catch (err) {
        els.actionStatus.textContent = '✗ ' + err.message;
      }
    });

    els.btnImport.addEventListener('click', async () => {
      if (!confirm('Import all records to PostgreSQL? Existing records will be skipped unless force-update is checked.')) {
        return;
      }
      els.btnImport.disabled = true;
      els.actionStatus.textContent = 'Importing…';
      try {
        const result = await CorneaMigration.importToServer({
          baseUrl: els.apiUrl.value.trim(),
          accessToken,
          bundle: currentBundle,
          dryRun: false,
          forceUpdate: els.forceUpdate.checked,
          skipExisting: true
        });
        showReport(result);
        const v = result.data?.verification;
        els.actionStatus.textContent = v?.passed
          ? 'Import complete — verification passed.'
          : 'Import finished with issues — review report.';
      } catch (err) {
        els.actionStatus.textContent = '✗ ' + err.message;
      } finally {
        els.btnImport.disabled = false;
      }
    });

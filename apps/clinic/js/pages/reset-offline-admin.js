const out = document.getElementById('out');

    if (window.CorneaAuthEnv?.isPublicDeployment?.()) {
      out.innerHTML = '<p style="color:#c62828;">Blocked: use Cloud Sign In on the public site. This tool is for local development only.</p>';
      document.getElementById('resetBtn').disabled = true;
    }

    function openDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('CorneaClinicDB', 6);
        req.onupgradeneeded = (e) => {
          if (window.CorneaOfflineAuth?.ensureUsersStore) {
            window.CorneaOfflineAuth.ensureUsersStore(e.target.result, e);
          }
        };
        req.onsuccess = () => { window.db = req.result; resolve(); };
        req.onerror = () => reject(req.error);
      });
    }

    function makePassword() {
      const chunk = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      return chunk + 'Aa1!';
    }

    document.getElementById('resetBtn')?.addEventListener('click', async () => {
      out.textContent = 'Working…';
      try {
        await openDb();
        const password = makePassword();
        const result = await window.CorneaOfflineAuth.resetAdministratorPassword(password, 'admin');
        out.innerHTML = '<div class="creds">Offline admin reset complete.\n\nUsername: ' +
          result.username + '\nPassword: ' + password +
          '\n\nYou will be asked to change this password on first sign-in.</div>';
      } catch (err) {
        out.innerHTML = '<p style="color:#c62828;">' + (err.message || err) + '</p>';
      }
    });

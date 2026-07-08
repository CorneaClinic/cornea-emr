(function () {
      const STORAGE_TOKEN = 'corneaEmr_apiToken';
      const STORAGE_BASE = 'corneaEmr_apiBase';
      const STORAGE_EMAIL = 'corneaEmr_apiEmail';
      const DEFAULT_API_BASE = 'https://corneaclinic-2zfpt.ondigitalocean.app';

      const panel = document.getElementById('panel');
      const params = new URLSearchParams(location.search);
      const accessToken = params.get('accessToken');
      const userB64 = params.get('user');

      function fail(message) {
        panel.classList.add('error');
        panel.innerHTML = '<h1><i class="fa-solid fa-circle-exclamation"></i> Sign-in failed</h1>'
          + '<p>' + message + '</p>'
          + '<p style="margin-top:16px;"><a href="Cornea.html?cloud=1">Return to sign in</a></p>';
      }

      if (!accessToken) {
        fail('Missing access token from identity provider.');
        return;
      }

      localStorage.setItem(STORAGE_TOKEN, accessToken);
      if (!localStorage.getItem(STORAGE_BASE)) {
        localStorage.setItem(STORAGE_BASE, DEFAULT_API_BASE);
      }

      if (userB64) {
        try {
          const json = atob(userB64.replace(/-/g, '+').replace(/_/g, '/'));
          const user = JSON.parse(json);
          if (user?.email) localStorage.setItem(STORAGE_EMAIL, user.email);
        } catch (_) { /* optional profile */ }
      }

      location.replace('Cornea.html?cloud=1');
    })();

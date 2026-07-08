const token = CorneaAuthPages.queryParam('token');
    const apiUrlEl = document.getElementById('apiUrl');
    const msgEl = document.getElementById('msg');
    const submitBtn = document.getElementById('submitBtn');

    CorneaAuthPages.initApiUrlField(apiUrlEl);

    function showMsg(text, type) {
      msgEl.textContent = text;
      msgEl.className = 'msg ' + type;
    }

    if (!token) {
      showMsg('Invalid reset link — no token in the URL. Request a new link from Forgot password.', 'error');
      submitBtn.disabled = true;
    }

    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!token) return;
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      const policyErr = CorneaAuthPages.validateNewPassword(password);
      if (policyErr) {
        showMsg(policyErr, 'error');
        return;
      }
      if (password !== confirm) {
        showMsg('Passwords do not match.', 'error');
        return;
      }
      msgEl.className = 'msg';
      submitBtn.disabled = true;
      try {
        await CorneaAuthPages.apiPost(
          '/api/v1/auth/password-reset/confirm',
          { token, newPassword: password },
          apiUrlEl.value
        );
        showMsg('Password updated. You can sign in with your new password.', 'success');
        document.getElementById('form').style.display = 'none';
      } catch (err) {
        showMsg(err.message || 'Reset failed. The link may have expired — request a new one.', 'error');
        submitBtn.disabled = false;
      }
    });

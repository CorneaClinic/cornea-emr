const apiUrlEl = document.getElementById('apiUrl');
    const emailEl = document.getElementById('email');
    const msgEl = document.getElementById('msg');
    const submitBtn = document.getElementById('submitBtn');

    CorneaAuthPages.initApiUrlField(apiUrlEl);

    function showMsg(text, type) {
      msgEl.textContent = text;
      msgEl.className = 'msg ' + type;
    }

    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.className = 'msg';
      submitBtn.disabled = true;
      try {
        await CorneaAuthPages.apiPost(
          '/api/v1/auth/password-reset/request',
          { email: emailEl.value.trim() },
          apiUrlEl.value
        );
        showMsg(
          'If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.',
          'success'
        );
      } catch (err) {
        showMsg(err.message || 'Could not send reset link.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });

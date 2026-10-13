// Login + Register form handling
(function () {
  function setError(form, msg) {
    const box = form.querySelector('[data-form-error]');
    if (!box) return;
    if (!msg) {
      box.classList.add('hidden');
      box.textContent = '';
      return;
    }
    box.classList.remove('hidden');
    box.textContent = msg;
    // Shake the form for feedback
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 250);
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    const label = btn.querySelector('[data-label]');
    const spin = btn.querySelector('[data-spin]');
    if (label) label.classList.toggle('hidden', loading);
    if (spin) spin.classList.toggle('hidden', !loading);
  }

  // Password visibility toggle
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-toggle-password'));
      if (!input) return;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.innerHTML = isText
        ? '<i class="fa-solid fa-eye"></i>'
        : '<i class="fa-solid fa-eye-slash"></i>';
    });
  });

  // ---------- Login form ----------
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError(loginForm, '');

      const btn = loginForm.querySelector('button[type="submit"]');
      setLoading(btn, true);

      const body = {
        email: loginForm.email.value.trim(),
        password: loginForm.password.value,
        remember: loginForm.remember ? loginForm.remember.checked : false
      };

      try {
        await window.api.post('/api/auth/login', body);

        // Wait for the session cookie to be fully set before verifying
        await new Promise((r) => setTimeout(r, 250));

        try {
          const check = await window.api.get('/api/auth/me');
          if (check && check.user) {
            window.toast('Signed in', 'success');
            const params = new URLSearchParams(window.location.search);
            const next = params.get('next') || '/dashboard.html';
            window.location.href = next.startsWith('/') ? next : '/dashboard.html';
          } else {
            setError(loginForm, 'Session not established. Try again.');
            setLoading(btn, false);
          }
        } catch (_) {
          setError(loginForm, 'Session not established. Try again.');
          setLoading(btn, false);
        }
      } catch (err) {
        setError(loginForm, err.message || 'Sign in failed');
        setLoading(btn, false);
      }
    });
  }

  // ---------- Register form ----------
  const regForm = document.getElementById('registerForm');
  if (regForm) {
    // Pre-fill referral code from URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && regForm.ref) regForm.ref.value = ref.toUpperCase();

    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError(regForm, '');

      const body = {
        fullName: regForm.fullName.value.trim(),
        email: regForm.email.value.trim(),
        password: regForm.password.value,
        confirmPassword: regForm.confirmPassword.value,
        ref: regForm.ref ? regForm.ref.value.trim() : '',
        remember: regForm.remember ? regForm.remember.checked : false
      };

      if (body.password !== body.confirmPassword) {
        setError(regForm, 'Passwords do not match.');
        return;
      }
      if (body.password.length < 8) {
        setError(regForm, 'Password must be at least 8 characters.');
        return;
      }

      const btn = regForm.querySelector('button[type="submit"]');
      setLoading(btn, true);

      try {
        await window.api.post('/api/auth/register', body);

        await new Promise((r) => setTimeout(r, 250));

        try {
          const check = await window.api.get('/api/auth/me');
          if (check && check.user) {
            window.toast('Account created', 'success');
            window.location.href = '/dashboard.html';
          } else {
            setError(regForm, 'Session not established. Try signing in.');
            setLoading(btn, false);
          }
        } catch (_) {
          setError(regForm, 'Session not established. Try signing in.');
          setLoading(btn, false);
        }
      } catch (err) {
        setError(regForm, err.message || 'Registration failed');
        setLoading(btn, false);
      }
    });
  }
})();
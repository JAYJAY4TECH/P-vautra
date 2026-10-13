// Vaultra — global UI helpers + auth-aware navigation
(function () {
  // ---------- Toast ----------
  function toast(message, kind) {
    const el = document.createElement('div');
    el.className = 'toast-enter';
    el.style.cssText = `
      position: fixed;
      bottom: 1.25rem;
      right: 1.25rem;
      z-index: 9999;
      padding: .85rem 1.1rem;
      border-radius: .75rem;
      font-size: .9rem;
      max-width: 22rem;
      box-shadow: 0 20px 40px -20px rgba(0,0,0,.6);
      background: ${kind === 'error' ? '#3b1220' : kind === 'success' ? '#0d2f22' : '#16212f'};
      color: ${kind === 'error' ? '#fda4af' : kind === 'success' ? '#7ff0bd' : '#cbd5e1'};
      border: 1px solid rgba(255,255,255,.08);
    `;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => {
      el.classList.remove('toast-enter');
      el.classList.add('toast-exit');
      setTimeout(() => el.remove(), 250);
    }, 4000);
  }

  window.toast = toast;

  // ---------- Scroll reveal ----------
  function setupReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
  }

  // ---------- Count up ----------
  function countUp(el, target, prefix, duration) {
    if (!el) return;
    prefix = prefix || '';
    duration = duration || 800;
    const start = performance.now();
    const from = 0;
    const isMoney = prefix === '$';

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      el.textContent = isMoney
        ? prefix + value.toFixed(2)
        : prefix + Math.round(value);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.countUp = countUp;

  // ---------- Body scroll lock (for modals) ----------
  function lockScroll(lock) {
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  window.lockScroll = lockScroll;

  // ---------- Active nav highlighting ----------
  const path = window.location.pathname;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href === path || (href !== '/' && path.startsWith(href))) {
      a.classList.add('text-white');
    }
  });

  // ---------- Auth state + nav ----------
  document.addEventListener('DOMContentLoaded', async () => {
    // Allow ?guest=1 to force guest view (useful for testing)
  const isHomepage =
    window.location.pathname === '/' ||
    window.location.pathname === '/index.html';

  const forceGuest =
    isHomepage ||
    new URLSearchParams(window.location.search).get('guest') === '1';

    if (forceGuest) {
      document.querySelectorAll('[data-auth="guest"]').forEach((el) => el.classList.remove('hidden'));
      document.querySelectorAll('[data-auth="user"]').forEach((el) => el.classList.add('hidden'));
      window.currentUser = null;
    } else {
      try {
        const data = await window.api.get('/api/auth/me');
        const user = data.user;

        document.querySelectorAll('[data-auth="guest"]').forEach((el) => el.classList.add('hidden'));
        document.querySelectorAll('[data-auth="user"]').forEach((el) => el.classList.remove('hidden'));
        document.querySelectorAll('[data-user-name]').forEach((el) => el.textContent = user.fullName || '');
        document.querySelectorAll('[data-user-email]').forEach((el) => el.textContent = user.email || '');
        document.querySelectorAll('[data-user-initial]').forEach((el) =>
          el.textContent = (user.fullName || 'U').charAt(0).toUpperCase()
        );
        window.currentUser = user;
      } catch (_) {
        document.querySelectorAll('[data-auth="guest"]').forEach((el) => el.classList.remove('hidden'));
        document.querySelectorAll('[data-auth="user"]').forEach((el) => el.classList.add('hidden'));
        window.currentUser = null;
      }
    }

    // Mobile menu toggle
    const toggle = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => menu.classList.toggle('hidden'));
    }

    // Logout
    document.querySelectorAll('[data-logout]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        btn.disabled = true;
        try {
          await window.api.post('/api/auth/logout');
          window.location.href = '/index.html';
        } catch (err) {
          window.toast(err.message || 'Logout failed', 'error');
          btn.disabled = false;
        }
      });
    });

    // Reveal animationsSelect-String -Path .\public\js\main.js -Pattern "isHomepage"
    
    setupReveal();
  });
})();
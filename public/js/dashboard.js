// Vaultra dashboard page — overview, activity, notifications, profile, settings, deposit/withdraw
(function () {
  const path = window.location.pathname;
  const isDashboardPage =
    path.endsWith('/dashboard.html') ||
    path.endsWith('/profile.html') ||
    path.endsWith('/settings.html') ||
    path.endsWith('/notifications.html') ||
    path.endsWith('/support.html');

  if (!isDashboardPage) return;

  // ---------- Utilities ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": ''' }[c];
    });
  }

  function fmtMoney(n) {
    const v = Number(n) || 0;
    return '$' + v.toFixed(2);
  }

  function fmtDate(d) {
    try {
      return new Date(d).toLocaleString();
    } catch (_) {
      return '';
    }
  }

  function redirectToLogin() {
    window.location.href =
      '/login.html?next=' + encodeURIComponent(window.location.pathname);
  }

  // Skeleton HTML for stat cards
  function statSkeleton() {
    return '<div class="skeleton h-4 w-3/4 mx-auto"></div>';
  }

  function statSkeletonValue() {
    return '<div class="skeleton h-8 w-1/2 mx-auto mt-3"></div>';
  }

  function statSkeletonLabel() {
    return '<div class="skeleton h-3 w-3/4 mx-auto mt-1"></div>';
  }

  // Show skeletons while loading
  function showStatSkeletons() {
    document.querySelectorAll('[data-stat="balance"]').forEach(el => el.innerHTML = statSkeletonValue());
    document.querySelectorAll('[data-stat="referrals"]').forEach(el => el.innerHTML = statSkeletonValue());
    document.querySelectorAll('[data-stat="rewards"]').forEach(el => el.innerHTML = statSkeletonValue());
    document.querySelectorAll('[data-stat="plan"]').forEach(el => el.innerHTML = statSkeletonValue());
  }

  // Hide skeletons and show real data with countUp
  function hideStatSkeletons(data) {
    const balanceEl = document.querySelector('[data-stat="balance"]');
    if (balanceEl) window.countUp(balanceEl, Number(data.user.balance) || 0);
    document.querySelectorAll('[data-stat="referrals"]').forEach(el => el.textContent = data.referralCount || 0);
    const rewardsEl = document.querySelector('[data-stat="rewards"]');
    if (rewardsEl) window.countUp(rewardsEl, Number(data.referralRewards) || 0);
    document.querySelectorAll('[data-stat="plan"]').forEach(el => el.textContent = (data.user.activePlan && data.user.activePlan.name) || 'None');
  }

  // ---------- Overview ----------
  async function loadOverview() {
    const root = document.getElementById('overviewRoot');
    if (!root) return;

    showStatSkeletons();

    try {
      const data = await window.api.get('/api/dashboard');

      hideStatSkeletons(data);

      // Activity list
      const act = document.getElementById('activityList');
      if (act) {
        if (!data.activities || !data.activities.length) {
          act.innerHTML =
            '<div class="empty"><i class="fa-regular fa-clock"></i>No activity yet</div>';
        } else {
          act.innerHTML = data.activities
            .map(function (a) {
              return (
                '<div class="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 reveal">' +
                '  <div class="w-9 h-9 rounded-lg bg-white/5 grid place-items-center text-mint">' +
                '    <i class="fa-solid fa-circle-dot text-xs"></i>' +
                '  </div>' +
                '  <div class="flex-1 min-w-0">' +
                '    <div class="text-sm text-slate-200 truncate">' + escapeHtml(a.message) + '</div>' +
                '    <div class="text-xs text-slate-500">' + escapeHtml(fmtDate(a.createdAt)) + '</div>' +
                '  </div>' +
                '</div>'
              );
            })
            .join('');
          act.querySelectorAll('.reveal').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(24px)';
            el.style.transition = 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)';
            setTimeout(() => {
              el.style.opacity = '1';
              el.style.transform = 'none';
            }, 50);
          });
        }
      }

      // Notifications preview
      const notif = document.getElementById('notifPreview');
      if (notif) {
        if (!data.notifications || !data.notifications.length) {
          notif.innerHTML =
            '<div class="empty"><i class="fa-regular fa-bell"></i>No notifications</div>';
        } else {
          notif.innerHTML = data.notifications
            .map(function (n) {
              return (
                '<div class="flex gap-3 py-3 border-b border-white/5 last:border-0 reveal">' +
                '  <div class="w-8 h-8 rounded-lg grid place-items-center bg-white/5 text-mint">' +
                '    <i class="fa-solid fa-bell text-xs"></i>' +
                '  </div>' +
                '  <div class="flex-1 min-w-0">' +
                '    <div class="text-sm text-slate-200 truncate">' + escapeHtml(n.title) + '</div>' +
                '    <div class="text-xs text-slate-500 truncate">' + escapeHtml(n.body || '') + '</div>' +
                '  </div>' +
                '</div>'
              );
            })
            .join('');
          notif.querySelectorAll('.reveal').forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(24px)';
            el.style.transition = 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)';
            setTimeout(() => {
              el.style.opacity = '1';
              el.style.transform = 'none';
            }, 50 * i);
          });
        }
      }
    } catch (err) {
      if (err.status === 401) return redirectToLogin();
      window.toast(err.message || 'Could not load dashboard', 'error');
    }
  }

  // ---------- Profile ----------
  async function loadProfile() {
    const form = document.getElementById('profileForm');
    if (!form) return;

    try {
      const data = await window.api.get('/api/dashboard/profile');
      if (form.fullName) form.fullName.value = data.user.fullName || '';
      if (form.email) {
        form.email.value = data.user.email || '';
        form.email.disabled = true;
      }
      const codeEl = document.getElementById('refCode');
      if (codeEl) codeEl.textContent = data.user.referralCode || '—';
    } catch (err) {
      if (err.status === 401) return redirectToLogin();
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      try {
        await window.api.post('/api/dashboard/profile', {
          fullName: form.fullName.value,
        });
        window.toast('Profile updated', 'success');
      } catch (err) {
        window.toast(err.message || 'Update failed', 'error');
      }
      if (btn) btn.disabled = false;
    });
  }

  // ---------- Notifications page ----------
  async function loadNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;

    try {
      const data = await window.api.get('/api/dashboard/notifications');
      if (!data.notifications || !data.notifications.length) {
        list.innerHTML =
          '<div class="empty"><i class="fa-regular fa-bell"></i>No notifications</div>';
        return;
      }
      list.innerHTML = data.notifications
        .map(function (n) {
          return (
            '<div class="card flex gap-4 items-start reveal ' + (n.read ? 'opacity-60' : '') + '">' +
            '  <div class="w-10 h-10 rounded-lg grid place-items-center bg-mint/10 text-mint flex-shrink-0">' +
            '    <i class="fa-solid fa-bell"></i>' +
            '  </div>' +
            '  <div class="flex-1 min-w-0">' +
            '    <div class="flex items-center justify-between gap-2">' +
            '      <h3 class="font-medium text-slate-100 truncate">' + escapeHtml(n.title) + '</h3>' +
            '      <span class="text-xs text-slate-500 flex-shrink-0">' +
            escapeHtml(new Date(n.createdAt).toLocaleDateString()) +
            '      </span>' +
            '    </div>' +
            '    <p class="text-sm text-slate-400 mt-1">' + escapeHtml(n.body || '') + '</p>' +
            (n.read
              ? ''
              : '    <button class="text-xs text-mint mt-2 hover:underline" data-mark-read="' +
                n._id +
                '">Mark as read</button>') +
            '  </div>' +
            '</div>'
          );
        })
        .join('');

      // Animate reveals
      list.querySelectorAll('.reveal').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)';
        setTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }, 50 * i);
      });

      list.querySelectorAll('[data-mark-read]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await window.api.post(
              '/api/dashboard/notifications/' + btn.getAttribute('data-mark-read') + '/read'
            );
            const card = btn.closest('.card');
            if (card) card.classList.add('opacity-60');
            btn.remove();
          } catch (err) {
            window.toast(err.message || 'Could not mark read', 'error');
          }
        });
      });
    } catch (err) {
      if (err.status === 401) return redirectToLogin();
      list.innerHTML =
        '<div class="alert alert-error">' +
        escapeHtml(err.message || 'Could not load notifications') +
        '</div>';
    }
  }

  // ---------- Deposit / Withdraw modals ----------
  function setupMoneyModals() {
    const depositModal = document.getElementById('depositModal');
    const withdrawModal = document.getElementById('withdrawModal');
    const openDeposit = document.getElementById('openDeposit');
    const openWithdraw = document.getElementById('openWithdraw');
    if (!depositModal || !withdrawModal) return;

    function openModal(m) {
      m.classList.remove('hidden');
      // Force reflow for animation
      m.offsetHeight;
      const content = m.querySelector('.card');
      if (content) content.classList.add('open');
      window.lockScroll(true);
    }
    function closeModal(m) {
      const content = m.querySelector('.card');
      if (content) content.classList.remove('open');
      setTimeout(() => {
        m.classList.add('hidden');
        window.lockScroll(false);
      }, 200);
    }
    function closeAll() {
      closeModal(depositModal);
      closeModal(withdrawModal);
    }

    if (openDeposit) {
      openDeposit.addEventListener('click', function () {
        openModal(depositModal);
      });
    }
    if (openWithdraw) {
      openWithdraw.addEventListener('click', function () {
        openModal(withdrawModal);
      });
    }

    document.querySelectorAll('[data-close-modal]').forEach(function (b) {
      b.addEventListener('click', closeAll);
    });

    [depositModal, withdrawModal].forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m) closeModal(m);
      });
    });

    // Escape key closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });

    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
      depositForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const amount = Number(depositForm.amount.value);
        if (!amount || amount <= 0) {
          window.toast('Enter a valid amount.', 'error');
          return;
        }
        const btn = depositForm.querySelector('button[type="submit"]');
        const label = btn ? btn.querySelector('[data-label]') : null;
        const spin = btn ? btn.querySelector('[data-spin]') : null;
        if (btn) btn.disabled = true;
        if (label) label.classList.add('hidden');
        if (spin) spin.classList.remove('hidden');

        try {
          const res = await window.api.post('/api/dashboard/deposit', { amount: amount });
          window.toast(res.message || 'Deposit initiated', 'success');
          closeAll();
          depositForm.reset();
          setTimeout(function () {
            window.location.reload();
          }, 1200);
        } catch (err) {
          window.toast(err.message || 'Deposit failed', 'error');
          if (btn) btn.disabled = false;
          if (label) label.classList.remove('hidden');
          if (spin) spin.classList.add('hidden');
        }
      });
    }

    const withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
      withdrawForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const amount = Number(withdrawForm.amount.value);
        if (!amount || amount <= 0) {
          window.toast('Enter a valid amount.', 'error');
          return;
        }
        const btn = withdrawForm.querySelector('button[type="submit"]');
        const label = btn ? btn.querySelector('[data-label]') : null;
        const spin = btn ? btn.querySelector('[data-spin]') : null;
        if (btn) btn.disabled = true;
        if (label) label.classList.add('hidden');
        if (spin) spin.classList.remove('hidden');

        try {
          const res = await window.api.post('/api/dashboard/withdraw', { amount: amount });
          window.toast(res.message || 'Withdrawal initiated', 'success');
          closeAll();
          withdrawForm.reset();
          setTimeout(function () {
            window.location.reload();
          }, 1200);
        } catch (err) {
          window.toast(err.message || 'Withdrawal failed', 'error');
          if (btn) btn.disabled = false;
          if (label) label.classList.remove('hidden');
          if (spin) spin.classList.add('hidden');
        }
      });
    }
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', function () {
    loadOverview();
    loadProfile();
    loadNotifications();
    setupMoneyModals();
  });
})();
(function () {
  var root = document.getElementById('adminRoot');
  if (!root) return;

  var data = { users: [], plans: [], pendingDeposits: [], recentActivity: [], stats: {} };
  var lockScreen = document.getElementById('lockScreen');
  var adminPanel = document.getElementById('adminPanel');
  var unlockForm = document.getElementById('unlockForm');
  var lockBtn = document.getElementById('lockBtn');

  function esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;')
      .split("'").join('&#39;');
  }

  function fmt(n) { return '$' + (Number(n) || 0).toFixed(2); }

  function showLocked() {
    lockScreen.classList.remove('hidden');
    adminPanel.classList.add('hidden');
  }
  function showUnlocked() {
    lockScreen.classList.add('hidden');
    adminPanel.classList.remove('hidden');
  }

  function load() {
    window.api.get('/api/admin').then(function (res) {
      data = res;
      document.querySelector('[data-stat="users"]').textContent = data.stats.userCount;
      document.querySelector('[data-stat="plans"]').textContent = data.stats.planCount;
      document.querySelector('[data-stat="referrals"]').textContent = data.stats.referralCount;
      document.querySelector('[data-stat="vaults"]').textContent = data.stats.activeVaults;
      document.querySelector('[data-stat="pending"]').textContent = data.stats.pendingDeposits;

      renderDeposits();
      renderUsers();
      renderPlans();
      renderActivity();
    }).catch(function (err) {
      if (err.status === 403) { showLocked(); return; }
      console.error(err);
    });
  }

  function renderDeposits() {
    var panel = document.querySelector('[data-panel="deposits"]');
    if (!data.pendingDeposits.length) {
      panel.innerHTML = '<div class="card"><div class="empty"><i class="fa-regular fa-clock"></i>No pending deposits.</div></div>';
      return;
    }
    panel.innerHTML = data.pendingDeposits.map(function (d) {
      return '' +
        '<div class="card">' +
        '  <div class="flex items-start justify-between">' +
        '    <div>' +
        '      <h3 class="text-white font-semibold">' + fmt(d.amountUsd) + ' in ' + esc(d.coin || '-') + '</h3>' +
        '      <p class="text-xs text-slate-500 mt-1">' +
        '        User: ' + esc(d.user && d.user.email || '-') + ' - ' + new Date(d.createdAt).toLocaleString() +
        '      </p>' +
        '    </div>' +
        '    <span class="badge badge-gold">pending</span>' +
        '  </div>' +
        (d.txHash ? '<p class="text-xs text-slate-500 mt-2 break-all">Tx: <code>' + esc(d.txHash) + '</code></p>' : '') +
        '  <div class="flex gap-2 mt-4">' +
        '    <button class="btn-primary !py-2 !px-4 text-xs" data-approve="' + d._id + '">' +
        '      <i class="fa-solid fa-check"></i> Approve and credit' +
        '    </button>' +
        '    <button class="btn-ghost !py-2 !px-4 text-xs !text-rose-300 !border-rose-500/30" data-reject="' + d._id + '">' +
        '      <i class="fa-solid fa-xmark"></i> Reject' +
        '    </button>' +
        '  </div>' +
        '</div>';
    }).join('');

    panel.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        window.api.post('/api/admin/deposits/' + btn.getAttribute('data-approve') + '/approve').then(function () {
          window.toast('Deposit approved and credited', 'success');
          load();
        }).catch(function (err) {
          window.toast(err.message || 'Could not approve', 'error');
          btn.disabled = false;
        });
      });
    });
    panel.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Reject this deposit?')) return;
        btn.disabled = true;
        window.api.post('/api/admin/deposits/' + btn.getAttribute('data-reject') + '/reject').then(function () {
          window.toast('Deposit rejected', 'info');
          load();
        }).catch(function (err) {
          window.toast(err.message || 'Could not reject', 'error');
          btn.disabled = false;
        });
      });
    });
  }

  function renderUsers() {
    var panel = document.querySelector('[data-panel="users"]');
    panel.innerHTML = '<div class="card"><div class="overflow-x-auto"><table class="table">' +
      '<thead><tr><th>Name</th><th>Email</th><th>Balance</th><th>Role</th><th>Joined</th><th></th></tr></thead>' +
      '<tbody>' +
      data.users.map(function (u) {
        return '<tr>' +
          '<td>' + esc(u.fullName) + '</td>' +
          '<td class="text-slate-400">' + esc(u.email) + '</td>' +
          '<td>' + fmt(u.balance) + '</td>' +
          '<td><span class="badge badge-' + (u.role === 'admin' ? 'gold' : 'slate') + '">' + u.role + '</span></td>' +
          '<td class="text-slate-400">' + new Date(u.createdAt).toLocaleDateString() + '</td>' +
          '<td><button class="btn-ghost !py-1 !px-2 text-xs" data-credit="' + u.id + '">Credit</button></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div></div>';

    panel.querySelectorAll('[data-credit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-credit');
        var amount = prompt('Amount to credit (USD). Use negative for debit:');
        if (!amount) return;
        var note = prompt('Note (optional):') || '';
        window.api.post('/api/admin/users/' + id + '/credit', { amount: Number(amount), note: note }).then(function () {
          window.toast('Balance adjusted', 'success');
          load();
        }).catch(function (err) {
          window.toast(err.message || 'Could not adjust', 'error');
        });
      });
    });
  }

  function renderPlans() {
    var panel = document.querySelector('[data-panel="plans"]');
    panel.innerHTML = '<div class="card"><div class="overflow-x-auto"><table class="table">' +
      '<thead><tr><th>Tier</th><th>Name</th><th>APY</th><th>Min</th><th>Max</th><th>Days</th><th>Enabled</th><th></th></tr></thead>' +
      '<tbody>' +
      data.plans.map(function (p) {
        return '<tr>' +
          '<td><span class="badge badge-mint">Tier ' + p.tier + '</span></td>' +
          '<td>' + esc(p.name) + '</td>' +
          '<td class="text-mint">' + p.apyPercent + '%</td>' +
          '<td>' + fmt(p.minAmount) + '</td>' +
          '<td>' + fmt(p.maxAmount) + '</td>' +
          '<td>' + p.durationDays + '</td>' +
          '<td><span class="badge badge-' + (p.enabled ? 'mint' : 'slate') + '">' + (p.enabled ? 'on' : 'off') + '</span></td>' +
          '<td><button class="btn-ghost !py-1 !px-3 text-xs" data-toggle="' + p._id + '">Toggle</button></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div></div>';

    panel.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        window.api.post('/api/admin/plans/' + btn.getAttribute('data-toggle') + '/toggle').then(function () {
          window.toast('Plan updated', 'success');
          load();
        }).catch(function (err) {
          window.toast(err.message || 'Toggle failed', 'error');
          btn.disabled = false;
        });
      });
    });
  }

  function renderActivity() {
    var panel = document.querySelector('[data-panel="activity"]');
    var inner = data.recentActivity.length
      ? data.recentActivity.map(function (a) {
          return '<div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 text-sm">' +
            '<span class="text-slate-500 w-44 shrink-0">' + new Date(a.createdAt).toLocaleString() + '</span>' +
            '<span class="text-slate-400 w-56 shrink-0 truncate">' + esc(a.user && a.user.email || '-') + '</span>' +
            '<span class="text-slate-300 flex-1">' + esc(a.message) + '</span>' +
            (a.status ? '<span class="badge badge-' + (a.status === 'completed' ? 'mint' : a.status === 'rejected' ? 'rose' : 'gold') + '">' + a.status + '</span>' : '') +
            '</div>';
        }).join('')
      : '<div class="empty">No activity</div>';
    panel.innerHTML = '<div class="card">' + inner + '</div>';
  }

  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-toggle-password'));
      if (!input) return;
      var isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.innerHTML = isText ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });
  });

  if (unlockForm) {
    unlockForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = unlockForm.querySelector('button[type="submit"]');
      var label = btn.querySelector('[data-label]');
      var spin = btn.querySelector('[data-spin]');
      var errBox = unlockForm.querySelector('[data-form-error]');

      btn.disabled = true;
      if (label) label.classList.add('hidden');
      if (spin) spin.classList.remove('hidden');
      if (errBox) errBox.classList.add('hidden');

      window.api.post('/api/admin/unlock', { password: unlockForm.password.value }).then(function () {
        showUnlocked();
        load();
      }).catch(function (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Wrong password';
          errBox.classList.remove('hidden');
        }
        unlockForm.password.value = '';
      }).finally(function () {
        btn.disabled = false;
        if (label) label.classList.remove('hidden');
        if (spin) spin.classList.add('hidden');
      });
    });
  }

  if (lockBtn) {
    lockBtn.addEventListener('click', function () {
      window.api.post('/api/admin/lock').then(function () {
        showLocked();
      });
    });
  }

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) {
        b.classList.remove('btn-primary');
        b.classList.add('btn-ghost');
      });
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn-primary');
      document.querySelectorAll('[data-panel]').forEach(function (p) { p.classList.add('hidden'); });
      var key = btn.getAttribute('data-tab');
      document.querySelector('[data-panel="' + key + '"]').classList.remove('hidden');
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    window.api.get('/api/admin/status').then(function (s) {
      if (s.unlocked) {
        showUnlocked();
        load();
      } else {
        showLocked();
      }
    }).catch(function () {
      showLocked();
    });
  });
})();
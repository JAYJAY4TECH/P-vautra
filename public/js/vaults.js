// Vaultra — vaults page (tiers + user vaults + open/cancel)
(function () {
  var tiersList = document.getElementById('tiersList');
  var vaultsList = document.getElementById('vaultsList');
  var modal = document.getElementById('openModal');
  var openForm = document.getElementById('openForm');
  if (!tiersList || !vaultsList || !modal || !openForm) return;

  var tiers = [];
  var activeTier = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n) { return '$' + (Number(n) || 0).toFixed(2); }

  function loadTiers() {
    tiersList.innerHTML = '<div class="empty">Loading tiers...</div>';

    window.api.get('/api/vaults/tiers').then(function (data) {
      tiers = (data && data.tiers) || [];
      if (!tiers.length) {
        tiersList.innerHTML = '<div class="empty">No tiers available yet.</div>';
        return;
      }
      tiersList.innerHTML = tiers.map(function (t) {
        return '' +
          '<div class="card fade-in">' +
          '  <div class="flex items-center justify-between mb-3">' +
          '    <span class="badge badge-mint">Tier ' + t.tier + '</span>' +
          '    <span class="badge badge-' + (t.riskLevel === 'low' ? 'mint' : t.riskLevel === 'high' ? 'rose' : 'gold') + '">' +
          '      ' + t.riskLevel + ' risk' +
          '    </span>' +
          '  </div>' +
          '  <h3 class="text-white font-semibold text-lg">' + escapeHtml(t.name) + '</h3>' +
          '  <p class="text-sm text-slate-400 mt-1">' + escapeHtml(t.description || '') + '</p>' +
          '  <div class="mt-5">' +
          '    <div class="text-3xl font-bold text-mint">' + t.apyPercent + '%</div>' +
          '    <div class="text-xs text-slate-500">projected annual yield</div>' +
          '  </div>' +
          '  <dl class="mt-5 grid grid-cols-2 gap-3 text-sm">' +
          '    <div><dt class="text-slate-500">Minimum</dt><dd class="text-slate-200">$' + t.minAmount + '</dd></div>' +
          '    <div><dt class="text-slate-500">Maximum</dt><dd class="text-slate-200">$' + t.maxAmount + '</dd></div>' +
          '    <div><dt class="text-slate-500">Duration</dt><dd class="text-slate-200">' + t.durationDays + ' days</dd></div>' +
          '    <div><dt class="text-slate-500">Fee</dt><dd class="text-slate-200">' + t.feePercent + '%</dd></div>' +
          '  </dl>' +
          '  <p class="text-xs text-slate-500 mt-4">' + escapeHtml(t.terms || '') + '</p>' +
          '  <button class="btn-primary w-full mt-5 min-h-[48px]" data-open-tier="' + t._id + '">' +
          '    Open ' + escapeHtml(t.name) +
          '  </button>' +
          '</div>';
      }).join('');

      tiersList.querySelectorAll('[data-open-tier]').forEach(function (btn) {
        btn.addEventListener('click', function () { openModal(btn.getAttribute('data-open-tier')); });
      });
    }).catch(function (err) {
      tiersList.innerHTML = '<div class="alert alert-error">' +
        escapeHtml(err.message || 'Could not load tiers') + '</div>';
    });
  }

  function openModal(tierId) {
    var t = null;
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i]._id === tierId) { t = tiers[i]; break; }
    }
    if (!t) return;
    activeTier = t;
    document.getElementById('tierName').textContent = t.name;
    document.getElementById('tierBounds').textContent = 'Min $' + t.minAmount + ' — Max $' + t.maxAmount;
    openForm.principalUsd.min = t.minAmount;
    openForm.principalUsd.max = t.maxAmount;
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    openForm.reset();
    activeTier = null;
  }

  document.querySelectorAll('[data-close-modal]').forEach(function (b) {
    b.addEventListener('click', closeModal);
  });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  openForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!activeTier) return;
    var btn = openForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    var body = {
      planId: activeTier._id,
      coin: openForm.coin.value,
      principalUsd: Number(openForm.principalUsd.value),
      depositTxHash: openForm.depositTxHash.value.trim() || null
    };

    window.api.post('/api/vaults/open', body).then(function () {
      window.toast('Vault opened. Send crypto to complete the deposit.', 'success');
      closeModal();
      setTimeout(function () { window.location.href = '/deposit.html'; }, 1200);
    }).catch(function (err) {
      window.toast(err.message || 'Could not open vault', 'error');
    }).finally(function () {
      btn.disabled = false;
    });
  });

  function loadVaults() {
    window.api.get('/api/vaults').then(function (data) {
      document.getElementById('totalPrincipal').textContent = fmt(data.totals.principalUsd);
      document.getElementById('totalAccrued').textContent = fmt(data.totals.accruedUsd);
      document.getElementById('activeCount').textContent =
        (data.vaults || []).filter(function (v) { return v.status === 'active'; }).length;

      if (!data.vaults || !data.vaults.length) {
        vaultsList.innerHTML = '<div class="empty"><i class="fa-solid fa-layer-group"></i>No vaults yet. Open one below to start earning.</div>';
        return;
      }

      vaultsList.innerHTML = data.vaults.map(function (v) {
        return '' +
          '<div class="card">' +
          '  <div class="flex items-start justify-between">' +
          '    <div>' +
          '      <h3 class="text-white font-semibold">' + escapeHtml(v.planName) + ' · ' + escapeHtml(v.coin) + '</h3>' +
          '      <p class="text-xs text-slate-500 mt-1">' +
          '        Started ' + new Date(v.startedAt).toLocaleDateString() +
          '        · Matures ' + new Date(v.maturesAt).toLocaleDateString() +
          '      </p>' +
          '    </div>' +
          '    <span class="badge badge-' +
                (v.status === 'active' ? 'mint' : v.status === 'matured' ? 'gold' : 'slate') +
          '">' + v.status + '</span>' +
          '  </div>' +
          '  <dl class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">' +
          '    <div><dt class="text-slate-500">Principal</dt><dd class="text-slate-200">' + fmt(v.principalUsd) + '</dd></div>' +
          '    <div><dt class="text-slate-500">APY</dt><dd class="text-slate-200">' + v.apyPercent + '%</dd></div>' +
          '    <div><dt class="text-slate-500">Earned</dt><dd class="text-mint">' + fmt(v.accruedUsd) + '</dd></div>' +
          '    <div><dt class="text-slate-500">Days left</dt><dd class="text-slate-200">' + v.daysRemaining + '</dd></div>' +
          '  </dl>' +
          (v.status === 'active'
            ? '<button class="btn-ghost !py-2 !px-4 text-xs mt-4" data-cancel="' + v.id + '">Cancel vault</button>'
            : '') +
          '</div>';
      }).join('');

      vaultsList.querySelectorAll('[data-cancel]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('Cancel this vault?')) return;
          btn.disabled = true;
          window.api.post('/api/vaults/' + btn.getAttribute('data-cancel') + '/cancel').then(function (res) {
            window.toast(res.message || 'Vault cancelled', 'success');
            loadVaults();
          }).catch(function (err) {
            window.toast(err.message || 'Could not cancel', 'error');
            btn.disabled = false;
          });
        });
      });
    }).catch(function (err) {
      if (err.status === 401) {
        window.location.href = '/login.html?next=/vaults.html';
        return;
      }
      vaultsList.innerHTML = '<div class="alert alert-error">' + escapeHtml(err.message || 'Could not load vaults') + '</div>';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadTiers();
    loadVaults();
  });
})();
(function () {
  const tiersList = document.getElementById('tiersList');
  const vaultsList = document.getElementById('vaultsList');
  const modal = document.getElementById('openModal');
  const openForm = document.getElementById('openForm');
  if (!tiersList || !vaultsList || !modal || !openForm) return;

  let tiers = [];
  let activeTier = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function fmt(n) { return '$' + (Number(n) || 0).toFixed(2); }

  async function loadTiers() {
    try {
      const data = await window.api.get('/api/vaults/tiers');
      tiers = data.tiers || [];
      if (!tiers.length) {
        tiersList.innerHTML = '<div class="empty">No tiers available yet.</div>';
        return;
      }
      tiersList.innerHTML = tiers.map(t => `
        <div class="card fade-in">
          <div class="flex items-center justify-between mb-3">
            <span class="badge badge-mint">Tier ${t.tier}</span>
            <span class="badge badge-${t.riskLevel === 'low' ? 'mint' : t.riskLevel === 'high' ? 'rose' : 'gold'}">
              ${t.riskLevel} risk
            </span>
          </div>
          <h3 class="text-white font-semibold text-lg">${escapeHtml(t.name)}</h3>
          <p class="text-sm text-slate-400 mt-1">${escapeHtml(t.description || '')}</p>
          <div class="mt-5">
            <div class="text-3xl font-bold text-mint">${t.apyPercent}%</div>
            <div class="text-xs text-slate-500">projected annual yield</div>
          </div>
          <dl class="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div><dt class="text-slate-500">Minimum</dt><dd class="text-slate-200">$${t.minAmount}</dd></div>
            <div><dt class="text-slate-500">Maximum</dt><dd class="text-slate-200">$${t.maxAmount}</dd></div>
            <div><dt class="text-slate-500">Duration</dt><dd class="text-slate-200">${t.durationDays} days</dd></div>
            <div><dt class="text-slate-500">Fee</dt><dd class="text-slate-200">${t.feePercent}%</dd></div>
          </dl>
          <p class="text-xs text-slate-500 mt-4">${escapeHtml(t.terms || '')}</p>
          <button class="btn-primary w-full mt-5 min-h-[48px]" data-open-tier="${t._id}">
            Open ${escapeHtml(t.name)}
          </button>
        </div>
      `).join('');

      tiersList.querySelectorAll('[data-open-tier]').forEach(btn => {
        btn.addEventListener('click', () => openModal(btn.getAttribute('data-open-tier')));
      });
    } catch (err) {
      tiersList.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || 'Could not load tiers')}</div>`;
    }
  }

  function openModal(tierId) {
    const t = tiers.find(x => x._id === tierId);
    if (!t) return;
    activeTier = t;
    document.getElementById('tierName').textContent = t.name;
    document.getElementById('tierBounds').textContent = `Min $${t.minAmount} — Max $${t.maxAmount}`;
    openForm.principalUsd.min = t.minAmount;
    openForm.principalUsd.max = t.maxAmount;
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    openForm.reset();
    activeTier = null;
  }

  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  openForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTier) return;
    const btn = openForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const body = {
      planId: activeTier._id,
      coin: openForm.coin.value,
      principalUsd: Number(openForm.principalUsd.value),
      depositTxHash: openForm.depositTxHash.value.trim() || null
    };

    try {
      await window.api.post('/api/vaults/open', body);
      window.toast('Vault opened. Send crypto to complete the deposit.', 'success');
      closeModal();
      setTimeout(() => {
        window.location.href = '/deposit.html';
      }, 1200);
    } catch (err) {
      window.toast(err.message || 'Could not open vault', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  async function loadVaults() {
    try {
      const data = await window.api.get('/api/vaults');

      document.getElementById('totalPrincipal').textContent = fmt(data.totals.principalUsd);
      document.getElementById('totalAccrued').textContent = fmt(data.totals.accruedUsd);
      document.getElementById('activeCount').textContent =
        data.vaults.filter(v => v.status === 'active').length;

      if (!data.vaults.length) {
        vaultsList.innerHTML = '<div class="empty"><i class="fa-solid fa-layer-group"></i>No vaults yet. Open one below to start earning.</div>';
        return;
      }

      vaultsList.innerHTML = data.vaults.map(v => `
        <div class="card">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-white font-semibold">${escapeHtml(v.planName)} · ${escapeHtml(v.coin)}</h3>
              <p class="text-xs text-slate-500 mt-1">
                Started ${new Date(v.startedAt).toLocaleDateString()} ·
                Matures ${new Date(v.maturesAt).toLocaleDateString()}
              </p>
            </div>
            <span class="badge badge-${
              v.status === 'active' ? 'mint' :
              v.status === 'matured' ? 'gold' : 'slate'
            }">${v.status}</span>
          </div>
          <dl class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><dt class="text-slate-500">Principal</dt><dd class="text-slate-200">${fmt(v.principalUsd)}</dd></div>
            <div><dt class="text-slate-500">APY</dt><dd class="text-slate-200">${v.apyPercent}%</dd></div>
            <div><dt class="text-slate-500">Earned</dt><dd class="text-mint">${fmt(v.accruedUsd)}</dd></div>
            <div><dt class="text-slate-500">Days left</dt><dd class="text-slate-200">${v.daysRemaining}</dd></div>
          </dl>
          ${v.status === 'active' ? `
            <button class="btn-ghost !py-2 !px-4 text-xs mt-4" data-cancel="${v.id}">
              Cancel vault
            </button>
          ` : ''}
        </div>
      `).join('');

      vaultsList.querySelectorAll('[data-cancel]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Cancel this vault? You will receive the accrued earnings and the principal back within 1–2 business days.')) return;
          btn.disabled = true;
          try {
            const res = await window.api.post('/api/vaults/' + btn.getAttribute('data-cancel') + '/cancel');
            window.toast(res.message || 'Vault cancelled', 'success');
            loadVaults();
          } catch (err) {
            window.toast(err.message || 'Could not cancel', 'error');
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      if (err.status === 401) {
        window.location.href = '/login.html?next=/vaults.html';
        return;
      }
      vaultsList.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || 'Could not load vaults')}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadTiers();
    loadVaults();
  });
})();
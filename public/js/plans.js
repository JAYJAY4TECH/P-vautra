// Vaults listing page
(function () {
  const root = document.getElementById('plansRoot');
  if (!root) return;

  async function load() {
    try {
      const { plans } = await window.api.get('/api/plans');
      if (!plans.length) {
        root.innerHTML = '<div class="empty"><i class="fa-solid fa-layer-group"></i>No vaults available</div>';
        return;
      }
      root.innerHTML = plans.map(p => `
        <div class="card fade-in">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-lg font-semibold text-white">${escapeHtml(p.name)}</h3>
              <p class="text-sm text-slate-400 mt-1">${escapeHtml(p.description || '')}</p>
            </div>
            <span class="badge badge-${
              p.riskLevel === 'low' ? 'mint' :
              p.riskLevel === 'high' ? 'rose' : 'gold'
            }">${p.riskLevel} risk</span>
          </div>
          <dl class="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div><dt class="text-slate-500">Minimum</dt><dd class="text-slate-200">$${p.minAmount}</dd></div>
            <div><dt class="text-slate-500">Maximum</dt><dd class="text-slate-200">$${p.maxAmount}</dd></div>
            <div><dt class="text-slate-500">Duration</dt><dd class="text-slate-200">${p.durationDays} days</dd></div>
            <div><dt class="text-slate-500">Fee</dt><dd class="text-slate-200">${p.feePercent}%</dd></div>
          </dl>
          <p class="text-xs text-slate-500 mt-4">${escapeHtml(p.terms || '')}</p>
          <button class="btn-primary w-full mt-5" data-join="${p.slug}">Open Vault</button>
        </div>
      `).join('');

      root.querySelectorAll('[data-join]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!window.currentUser) {
            window.location.href = '/login.html?next=/plans.html';
            return;
          }
          btn.disabled = true;
          try {
            const res = await window.api.post('/api/plans/' + btn.getAttribute('data-join') + '/join');
            window.toast(res.message || 'Vault opened', 'success');
          } catch (err) {
            window.toast(err.message || 'Could not open vault', 'error');
          }
          btn.disabled = false;
        });
      });
    } catch (err) {
      root.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || 'Failed to load vaults')}</div>`;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  document.addEventListener('DOMContentLoaded', load);
})();
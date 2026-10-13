// Referrals page
(function () {
  const root = document.getElementById('referralsRoot');
  if (!root) return;

  async function load() {
    try {
      const data = await window.api.get('/api/referrals');

      const codeEl = document.getElementById('refCode');
      const urlEl = document.getElementById('refUrl');
      if (codeEl) codeEl.textContent = data.referralCode;
      if (urlEl) urlEl.value = data.referralUrl;

      const copyBtn = document.getElementById('copyRefBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(data.referralUrl);
            window.toast('Referral link copied', 'success');
          } catch (_) {
            window.toast('Could not copy — copy manually', 'error');
          }
        });
      }

      const list = document.getElementById('refTable');
      if (!list) return;
      if (!data.referrals.length) {
        list.innerHTML = '<div class="empty"><i class="fa-solid fa-user-plus"></i>No referrals yet</div>';
        return;
      }
      list.innerHTML = `
        <table class="table">
          <thead><tr>
            <th>User</th><th>Email</th><th>Joined</th><th>Status</th><th>Reward</th>
          </tr></thead>
          <tbody>
            ${data.referrals.map(r => `
              <tr>
                <td>${escapeHtml(r.referee?.fullName || '—')}</td>
                <td class="text-slate-400">${escapeHtml(r.referee?.email || '—')}</td>
                <td class="text-slate-400">${new Date(r.createdAt).toLocaleDateString()}</td>
                <td><span class="badge badge-${
                  r.status === 'rewarded' ? 'mint' :
                  r.status === 'qualified' ? 'gold' : 'slate'
                }">${r.status}</span></td>
                <td>$${(r.rewardAmount || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      if (err.status === 401) {
        window.location.href = '/login.html?next=/referrals.html';
        return;
      }
      root.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || 'Failed to load')}</div>`;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  document.addEventListener('DOMContentLoaded', load);
})();
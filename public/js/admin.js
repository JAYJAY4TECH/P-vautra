// Admin dashboard
(function () {
  const root = document.getElementById('adminRoot');
  if (!root) return;

  async function load(q) {
    try {
      const url = '/api/admin' + (q ? '?q=' + encodeURIComponent(q) : '');
      const data = await window.api.get(url);

      document.querySelectorAll('[data-stat="users"]').forEach(el => el.textContent = data.stats.userCount);
      document.querySelectorAll('[data-stat="plans"]').forEach(el => el.textContent = data.stats.planCount);
      document.querySelectorAll('[data-stat="referrals"]').forEach(el => el.textContent = data.stats.referralCount);

      const usersTable = document.getElementById('usersTable');
      usersTable.innerHTML = `
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Balance</th><th>Joined</th></tr></thead>
          <tbody>
            ${data.users.map(u => `
              <tr>
                <td>${escapeHtml(u.fullName)}</td>
                <td class="text-slate-400">${escapeHtml(u.email)}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'gold' : 'slate'}">${u.role}</span></td>
                <td>$${(u.balance || 0).toFixed(2)}</td>
                <td class="text-slate-400">${new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;

      const plansTable = document.getElementById('plansTable');
      plansTable.innerHTML = `
        <table class="table">
          <thead><tr><th>Name</th><th>Slug</th><th>Min</th><th>Max</th><th>Days</th><th>Enabled</th><th></th></tr></thead>
          <tbody>
            ${data.plans.map(p => `
              <tr>
                <td>${escapeHtml(p.name)}</td>
                <td class="text-slate-400">${escapeHtml(p.slug)}</td>
                <td>$${p.minAmount}</td>
                <td>$${p.maxAmount}</td>
                <td>${p.durationDays}</td>
                <td><span class="badge badge-${p.enabled ? 'mint' : 'slate'}">${p.enabled ? 'on' : 'off'}</span></td>
                <td><button class="btn-ghost !py-1 !px-3 text-xs" data-toggle="${p._id}">Toggle</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;

      plansTable.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await window.api.post('/api/admin/plans/' + btn.getAttribute('data-toggle') + '/toggle');
            window.toast('Plan updated', 'success');
            load(q);
          } catch (err) {
            window.toast(err.message || 'Toggle failed', 'error');
            btn.disabled = false;
          }
        });
      });

      const activity = document.getElementById('adminActivity');
      activity.innerHTML = data.recentActivity.length ? data.recentActivity.map(a => `
        <div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 text-sm">
          <span class="text-slate-500 w-40 shrink-0">${new Date(a.createdAt).toLocaleString()}</span>
          <span class="text-slate-400 w-48 shrink-0">${escapeHtml(a.user?.email || '—')}</span>
          <span class="text-slate-300">${escapeHtml(a.message)}</span>
        </div>
      `).join('') : '<div class="empty">No activity</div>';
    } catch (err) {
      if (err.status === 403) {
        root.innerHTML = '<div class="alert alert-error">Administrator access required.</div>';
        return;
      }
      if (err.status === 401) {
        window.location.href = '/login.html?next=/admin.html';
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

  document.addEventListener('DOMContentLoaded', () => {
    load('');
    const search = document.getElementById('userSearch');
    if (search) {
      let t;
      search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => load(search.value.trim()), 300);
      });
    }
  });
})();
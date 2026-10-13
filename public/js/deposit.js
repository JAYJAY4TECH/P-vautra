// Deposit page — wallet cards + copy buttons + intent form
(function () {
  const root = document.getElementById('walletsRoot');
  if (!root) return;

  const COINS = [
    { key: 'btc',  symbol: 'BTC',  name: 'Bitcoin',      color: '#F7931A' },
    { key: 'eth',  symbol: 'ETH',  name: 'Ethereum',     color: '#627EEA' },
    { key: 'sol',  symbol: 'SOL',  name: 'Solana',       color: '#14F195' },
    { key: 'usdt', symbol: 'USDT', name: 'USDT (TRC20)', color: '#26A17B' }
  ];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  async function copyText(text, label) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      window.toast((label || 'Address') + ' copied', 'success');
    } catch (_) {
      window.toast('Could not copy — copy manually', 'error');
    }
  }

  async function loadWallets() {
    let addresses = { btc: '', eth: '', sol: '', usdt: '' };
    try {
      addresses = await window.api.get('/api/deposit/addresses');
    } catch (_) {}

    root.innerHTML = COINS.map(coin => {
      const address = (addresses[coin.key] || '').trim();
      const notConfigured =
        !address ||
        /^REPLACE_WITH|^bc1qxxxxx|^0xxxxx|^Txxxxx|^So11111{3,}/i.test(address);

      return `
        <div class="card">
          <div class="flex items-center gap-3 mb-3">
            <span class="w-10 h-10 rounded-lg grid place-items-center font-bold text-sm"
                  style="background:${coin.color}22;color:${coin.color}">
              ${coin.symbol}
            </span>
            <div>
              <h3 class="text-white font-semibold">${coin.symbol}</h3>
              <p class="text-xs text-slate-500">${coin.name}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <code class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/5 text-xs text-slate-300 break-all font-mono">
              ${notConfigured ? 'Not configured — contact support' : escapeHtml(address)}
            </code>
          </div>

          <button class="btn-primary w-full mt-3 ${notConfigured ? 'opacity-50 cursor-not-allowed' : ''}"
                  data-copy="${notConfigured ? '' : escapeHtml(address)}"
                  data-coin="${coin.symbol}"
                  ${notConfigured ? 'disabled' : ''}>
            <i class="fa-solid fa-copy"></i> Copy address
          </button>

          <button class="btn-ghost w-full mt-2" data-intent="${coin.symbol}">
            <i class="fa-solid fa-check"></i> I have sent ${coin.symbol}
          </button>
        </div>
      `;
    }).join('');

    root.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const addr = btn.getAttribute('data-copy');
        const coin = btn.getAttribute('data-coin');
        if (addr) copyText(addr, coin + ' address');
      });
    });

    root.querySelectorAll('[data-intent]').forEach(btn => {
      btn.addEventListener('click', () => {
        const coin = btn.getAttribute('data-intent');
        declareIntent(coin);
      });
    });
  }

  async function declareIntent(coin) {
    const amountStr = window.prompt(`Amount of ${coin} sent (optional):`, '');
    if (amountStr === null) return;
    const amount = amountStr.trim() === '' ? 0 : Number(amountStr);
    if (amount && (isNaN(amount) || amount < 0)) {
      window.toast('Enter a valid amount.', 'error');
      return;
    }
    const txHash = window.prompt('Transaction hash (optional):', '') || '';
    if (txHash && txHash.length < 32) {
      window.toast('Transaction hash looks too short.', 'error');
      return;
    }
    try {
      const res = await window.api.post('/api/deposit/intent', { coin, amount, txHash });
      window.toast(res.message || 'Deposit recorded', 'success');
    } catch (err) {
      window.toast(err.message || 'Could not record deposit', 'error');
    }
  }

  // Referral link (reuses /api/referrals)
  async function loadReferral() {
    const input = document.getElementById('refUrl');
    const btn = document.getElementById('copyRefBtn');
    if (!input) return;
    try {
      const data = await window.api.get('/api/referrals');
      input.value = data.referralUrl;
      if (btn) {
        btn.addEventListener('click', () => copyText(data.referralUrl, 'Referral link'));
      }
    } catch (err) {
      if (err.status === 401) {
        window.location.href = '/login.html?next=/deposit.html';
        return;
      }
      input.value = 'Sign in to see your link';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadWallets();
    loadReferral();
  });
})();
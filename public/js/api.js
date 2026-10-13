// Vaultra API helper — CSRF-aware fetch wrapper
(function () {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : null;
  }

  async function ensureCsrf() {
    let token = getCookie('XSRF-TOKEN');
    if (!token) {
      try {
        const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
        const data = await r.json();
        token = data.csrfToken || getCookie('XSRF-TOKEN');
      } catch (_) {}
    }
    return token;
  }

  async function request(method, url, body) {
    const opts = {
      method,
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    };

    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const token = await ensureCsrf();
      if (token) opts.headers['X-CSRF-Token'] = token;
    }

    const res = await fetch(url, opts);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : {};

    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.api = {
    get:   (url)       => request('GET', url),
    post:  (url, body) => request('POST', url, body || {}),
    put:   (url, body) => request('PUT', url, body || {}),
    del:   (url)       => request('DELETE', url)
  };
})();
// Security headers, redirect chain, mixed content, cache headers
const CAT = 'Technisch';

async function head(url) {
  const t0 = Date.now();
  const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  return { status: res.status, headers: Object.fromEntries(res.headers), durationMs: Date.now() - t0 };
}

async function fetchFollow(url) {
  const chain = [];
  let current = url;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(current, { method: 'HEAD', redirect: 'manual' });
    chain.push({ url: current, status: res.status, location: res.headers.get('location') });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).href;
      continue;
    }
    break;
  }
  return chain;
}

export async function run({ targetProd, emit }) {
  if (!targetProd) {
    emit({ id: 'headers.skip', title: 'HTTP headers checks', category: CAT, level: 'warn', message: 'Geen productie-URL opgegeven' });
    return;
  }

  // 1. Security headers
  try {
    const { headers, status } = await head(targetProd);
    const required = {
      'strict-transport-security': { name: 'HSTS', match: /max-age=\d+/ },
      'content-security-policy': { name: 'CSP', match: /./ },
      'x-content-type-options': { name: 'X-Content-Type-Options', match: /nosniff/i },
      'x-frame-options': { name: 'X-Frame-Options', match: /(DENY|SAMEORIGIN)/i },
      'referrer-policy': { name: 'Referrer-Policy', match: /./ },
      'permissions-policy': { name: 'Permissions-Policy', match: /./ },
    };
    for (const [key, { name, match }] of Object.entries(required)) {
      const v = headers[key];
      const present = v && match.test(v);
      emit({
        id: `headers.${key}`,
        title: `Security header: ${name}`,
        category: CAT,
        level: present ? 'pass' : 'warn',
        message: present ? v.slice(0, 100) : 'Ontbreekt',
      });
    }
  } catch (e) {
    emit({ id: 'headers.fetch', title: 'Security headers fetch', category: CAT, level: 'fail', message: e.message });
  }

  // 2. Redirect chain (www <-> apex, http -> https)
  try {
    const u = new URL(targetProd);
    const host = u.hostname.replace(/^www\./, '');
    const variants = [`http://${host}/`, `http://www.${host}/`, `https://${host}/`, `https://www.${host}/`];
    for (const variant of variants) {
      try {
        const chain = await fetchFollow(variant);
        const final = chain[chain.length - 1];
        const isFinalSecure = final.url.startsWith('https://');
        const ok = (final.status === 200 || (final.status >= 300 && final.status < 400)) && isFinalSecure;
        emit({
          id: `headers.redirect.${variant.replace(/[^a-z0-9]/gi, '_')}`,
          title: `Redirect: ${variant}`,
          category: CAT,
          level: ok ? 'pass' : 'warn',
          message: chain.map(c => `${c.status} → ${c.url}`).join('  →  '),
          detail: chain,
        });
      } catch (e) {
        emit({ id: `headers.redirect.${variant}`, title: `Redirect: ${variant}`, category: CAT, level: 'warn', message: e.message });
      }
    }
  } catch (e) {
    emit({ id: 'headers.redirect', title: 'Redirect chain', category: CAT, level: 'fail', message: e.message });
  }

  // 3. Cache headers on a sample asset
  try {
    const res = await fetch(targetProd);
    const html = await res.text();
    const assetMatch = html.match(/(?:href|src)="([^"]+\.(?:css|js|woff2?|png|jpg|svg))"/i);
    if (assetMatch) {
      const assetUrl = new URL(assetMatch[1], targetProd).href;
      const { headers } = await head(assetUrl);
      const cc = headers['cache-control'] || '';
      const ok = /max-age=\d+/.test(cc) && parseInt(cc.match(/max-age=(\d+)/)?.[1] || '0') >= 86400;
      emit({
        id: 'headers.cacheControl',
        title: 'Static asset cache-control ≥ 1 dag',
        category: CAT,
        level: ok ? 'pass' : 'warn',
        message: `${assetUrl} → ${cc || 'geen cache-control'}`,
      });
    }
  } catch (e) {
    emit({ id: 'headers.cache', title: 'Cache headers', category: CAT, level: 'warn', message: e.message });
  }
}

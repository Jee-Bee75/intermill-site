// BFS link crawl: detect broken internal + external links, count image formats
import pLimit from 'p-limit';

const CAT = 'Content';
const MAX_PAGES = 25;
const TIMEOUT = 8000;

function parseHtml(html, baseUrl) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)/gi)].map(m => m[1]);
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)/gi)].map(m => m[1]);
  const sources = [...html.matchAll(/<source[^>]+srcset=["']([^"']+)/gi)].map(m => m[1]);
  const all = [...links, ...imgs, ...sources];
  const resolved = all.map(href => {
    try { return new URL(href, baseUrl).href; } catch { return null; }
  }).filter(Boolean);
  return { links: resolved.filter(u => !u.startsWith('mailto:') && !u.startsWith('tel:') && !u.startsWith('javascript:')), imgs };
}

async function tryFetch(url) {
  const ctrl = AbortSignal.timeout(TIMEOUT);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl });
    if (res.status === 405 || res.status === 403) {
      const res2 = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT) });
      return { ok: res2.ok, status: res2.status };
    }
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

export async function run({ targetLocal, targetProd, emit }) {
  const target = targetProd || targetLocal;
  if (!target) return;
  const base = new URL(target);

  const visited = new Set();
  const queue = [target];
  const allLinks = new Set();
  const allImgs = new Set();

  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) continue;
      const html = await res.text();
      const { links, imgs } = parseHtml(html, url);
      links.forEach(l => allLinks.add(l));
      imgs.forEach(i => allImgs.add(new URL(i, url).href));
      // Enqueue only same-origin html-ish links
      links.filter(l => {
        try {
          const u = new URL(l);
          return u.hostname === base.hostname && !/\.(jpe?g|png|svg|gif|webp|avif|css|js|woff2?|pdf|zip)$/i.test(u.pathname);
        } catch { return false; }
      }).forEach(l => { if (!visited.has(l) && !queue.includes(l)) queue.push(l); });
    } catch {}
  }

  emit({
    id: 'crawl.scope',
    title: `Crawl scope: ${visited.size} pages, ${allLinks.size} links, ${allImgs.size} imgs`,
    category: CAT,
    level: 'pass',
    message: `Bezocht: ${[...visited].slice(0, 5).join(', ')}${visited.size > 5 ? '…' : ''}`,
  });

  // Check broken links (parallel, throttled)
  const limit = pLimit(8);
  const checks = [...allLinks].map(url => limit(async () => ({ url, ...(await tryFetch(url)) })));
  const results = await Promise.all(checks);

  const broken = results.filter(r => !r.ok);
  const internal = broken.filter(r => { try { return new URL(r.url).hostname === base.hostname; } catch { return false; } });
  const external = broken.filter(r => !internal.includes(r));

  emit({
    id: 'crawl.broken.internal',
    title: 'Geen broken interne links',
    category: CAT,
    level: internal.length === 0 ? 'pass' : 'fail',
    message: internal.length === 0 ? `${results.filter(r => !internal.includes(r) && !external.includes(r)).length} OK` : `${internal.length} broken`,
    detail: internal.slice(0, 20),
    metric: internal.length,
  });

  emit({
    id: 'crawl.broken.external',
    title: 'Geen broken externe links',
    category: CAT,
    level: external.length === 0 ? 'pass' : 'warn',
    message: external.length === 0 ? 'Alle externe links 200' : `${external.length} broken`,
    detail: external.slice(0, 20),
    metric: external.length,
  });

  // Image formats
  const imgChecks = [...allImgs].map(url => limit(async () => {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT) });
      return { url, type: res.headers.get('content-type') || '', size: res.headers.get('content-length') };
    } catch { return { url, type: '', size: null }; }
  }));
  const imgResults = await Promise.all(imgChecks);

  const total = imgResults.length;
  const modern = imgResults.filter(r => /(webp|avif)/.test(r.type)).length;
  const oldFmt = imgResults.filter(r => /(jpeg|png|jpg)/.test(r.type) && !/(webp|avif)/.test(r.type)).length;
  const modernPct = total ? Math.round((modern / total) * 100) : 0;

  emit({
    id: 'crawl.images.modern',
    title: 'Images zijn webp/avif',
    category: 'Performance',
    level: modernPct >= 70 ? 'pass' : modernPct >= 30 ? 'warn' : 'fail',
    message: `${modern}/${total} modern format (${modernPct}%)`,
    metric: modernPct,
    detail: imgResults.filter(r => /(jpeg|png|jpg)/.test(r.type)).slice(0, 10),
  });
}

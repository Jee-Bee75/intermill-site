// Sitemap.xml validation + JSON-LD validation + OG image probe
import xml2js from 'xml2js';
import probe from 'probe-image-size';

const CAT_SEO = 'SEO';
const CAT_SOCIAL = 'Social';

export async function run({ targetLocal, targetProd, emit }) {
  const target = targetProd || targetLocal;
  if (!target) return;
  const base = new URL(target);

  // 1. Sitemap.xml — parse + check each URL
  try {
    const res = await fetch(`${base.origin}/sitemap.xml`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = await xml2js.parseStringPromise(xml);
    const urls = parsed.urlset?.url?.map(u => u.loc[0]) || [];

    emit({
      id: 'sitemap.parse',
      title: 'Sitemap.xml is valide XML',
      category: CAT_SEO,
      level: 'pass',
      message: `${urls.length} URLs gevonden`,
    });

    // Check each sitemap URL returns 200
    const checks = await Promise.all(urls.slice(0, 30).map(async u => {
      try {
        const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        return { url: u, ok: r.ok, status: r.status };
      } catch (e) { return { url: u, ok: false, status: 0, error: e.message }; }
    }));
    const broken = checks.filter(c => !c.ok);
    emit({
      id: 'sitemap.urls',
      title: 'Alle sitemap-URLs geven 200',
      category: CAT_SEO,
      level: broken.length === 0 ? 'pass' : 'fail',
      message: broken.length === 0 ? `${checks.length} URLs OK` : `${broken.length}/${checks.length} broken`,
      detail: broken,
      metric: broken.length,
    });
  } catch (e) {
    emit({ id: 'sitemap.parse', title: 'Sitemap.xml valideren', category: CAT_SEO, level: 'fail', message: e.message });
  }

  // 2. JSON-LD validation
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim());

    if (!blocks.length) {
      emit({ id: 'jsonld.present', title: 'JSON-LD structured data', category: CAT_SEO, level: 'warn', message: 'Geen JSON-LD gevonden' });
    } else {
      const parsed = blocks.map(b => { try { return JSON.parse(b); } catch (e) { return { _error: e.message }; } });
      const invalid = parsed.filter(p => p._error);
      emit({
        id: 'jsonld.valid',
        title: `JSON-LD is valide JSON (${blocks.length} blok${blocks.length>1?'ken':''})`,
        category: CAT_SEO,
        level: invalid.length === 0 ? 'pass' : 'fail',
        message: invalid.length === 0 ? 'Alle blokken parsen' : `${invalid.length} ongeldig`,
        detail: parsed,
      });

      // Check required schema.org @types
      const types = parsed.flatMap(p => Array.isArray(p['@graph']) ? p['@graph'] : [p]).map(o => o?.['@type']).filter(Boolean);
      const hasOrg = types.some(t => /Organization|LocalBusiness/.test(t));
      const hasWeb = types.some(t => /WebSite|WebPage/.test(t));
      emit({
        id: 'jsonld.schema',
        title: 'JSON-LD bevat Organization + WebSite/WebPage',
        category: CAT_SEO,
        level: hasOrg && hasWeb ? 'pass' : 'warn',
        message: `Types: ${types.join(', ') || 'geen'}`,
      });
    }
  } catch (e) {
    emit({ id: 'jsonld.parse', title: 'JSON-LD parse', category: CAT_SEO, level: 'fail', message: e.message });
  }

  // 3. OG image — dimensions
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    if (!ogMatch) {
      emit({ id: 'og.image.dims', title: 'OG-image dimensies', category: CAT_SOCIAL, level: 'warn', message: 'og:image ontbreekt' });
    } else {
      const url = ogMatch[1];
      try {
        const info = await probe(url, { timeout: 10000 });
        const ratio = info.width / info.height;
        const recommended = info.width >= 1200 && info.height >= 630 && ratio > 1.7 && ratio < 2.0;
        emit({
          id: 'og.image.dims',
          title: 'OG-image ≥ 1200×630 + ratio ~1.91:1',
          category: CAT_SOCIAL,
          level: recommended ? 'pass' : 'warn',
          message: `${info.width}×${info.height} (${ratio.toFixed(2)}:1) — ${info.type}`,
          detail: info,
          metric: info.width * info.height,
        });
      } catch (e) {
        emit({ id: 'og.image.dims', title: 'OG-image laden', category: CAT_SOCIAL, level: 'fail', message: `Kon ${url} niet laden: ${e.message}` });
      }
    }
  } catch (e) {
    emit({ id: 'og.image.fetch', title: 'OG-image probe', category: CAT_SOCIAL, level: 'warn', message: e.message });
  }
}

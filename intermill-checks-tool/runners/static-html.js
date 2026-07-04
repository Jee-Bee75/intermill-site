// Statische HTML-checks die niet vereisten dat we de site renderen
const CAT_SEO = 'SEO';
const CAT_TECH = 'Technisch';

export async function run({ targetLocal, emit }) {
  if (!targetLocal) return;
  const res = await fetch(targetLocal);
  const html = await res.text();
  const doc = parseDom(html);

  const checks = [
    { id: 'static.title', cat: CAT_SEO, title: 'Title aanwezig + ≤ 65 chars',
      fn: () => {
        const t = doc.title;
        if (!t) return { level:'fail', message:'Ontbreekt' };
        return { level: t.length <= 65 ? 'pass' : 'warn', message: `"${t}" (${t.length})`, metric: t.length };
      }},
    { id: 'static.description', cat: CAT_SEO, title: 'Meta description 50–160 chars',
      fn: () => {
        const d = doc.metaName('description');
        if (!d) return { level:'fail', message:'Ontbreekt' };
        return { level: (d.length >= 50 && d.length <= 160) ? 'pass' : 'warn', message: `${d.length} chars`, metric: d.length };
      }},
    { id: 'static.canonical', cat: CAT_SEO, title: 'Canonical URL',
      fn: () => {
        const c = doc.linkHref('canonical');
        return c ? { level:'pass', message:c } : { level:'fail', message:'Ontbreekt' };
      }},
    { id: 'static.robots', cat: CAT_SEO, title: 'Meta robots = index, follow',
      fn: () => {
        const r = doc.metaName('robots') || '';
        return { level: /index/i.test(r) && !/noindex/i.test(r) ? 'pass' : 'fail', message: r || 'Ontbreekt' };
      }},
    { id: 'static.h1', cat: CAT_SEO, title: 'Exact 1× <h1>',
      fn: () => {
        const n = (html.match(/<h1\b/gi) || []).length;
        return { level: n===1?'pass':(n===0?'fail':'warn'), message:`${n}× <h1>`, metric:n };
      }},
    { id: 'static.lang', cat: CAT_SEO, title: '<html lang="…">',
      fn: () => {
        const m = html.match(/<html[^>]+lang=["']([^"']+)/i);
        return m ? { level:'pass', message:`lang="${m[1]}"` } : { level:'fail', message:'Ontbreekt' };
      }},
    { id: 'static.viewport', cat: CAT_TECH, title: 'Viewport meta met width=device-width',
      fn: () => {
        const v = doc.metaName('viewport') || '';
        return { level: /width=device-width/i.test(v) ? 'pass' : 'fail', message: v };
      }},
    { id: 'static.charset', cat: CAT_TECH, title: 'charset = UTF-8',
      fn: () => {
        const m = html.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i);
        return { level: m && /utf-?8/i.test(m[1]) ? 'pass' : 'fail', message: m ? m[1] : 'Ontbreekt' };
      }},
    { id: 'static.favicon', cat: CAT_TECH, title: 'Favicon link',
      fn: () => {
        const v = doc.linkHref('icon');
        return v ? { level:'pass', message:v } : { level:'fail', message:'Ontbreekt' };
      }},
    { id: 'static.themeColor', cat: CAT_TECH, title: 'theme-color meta',
      fn: () => {
        const v = doc.metaName('theme-color');
        return v ? { level:'pass', message:v } : { level:'warn', message:'Ontbreekt' };
      }},
    { id: 'static.appleTouch', cat: CAT_TECH, title: 'apple-touch-icon',
      fn: () => {
        const v = doc.linkHref('apple-touch-icon');
        return v ? { level:'pass', message:v } : { level:'warn', message:'Ontbreekt' };
      }},
    { id: 'static.og.title', cat: 'Social', title: 'og:title',
      fn: () => { const v = doc.metaProp('og:title'); return v ? {level:'pass', message:v} : {level:'fail', message:'Ontbreekt'}; }},
    { id: 'static.og.desc', cat: 'Social', title: 'og:description',
      fn: () => { const v = doc.metaProp('og:description'); return v ? {level:'pass', message:`${v.length} chars`} : {level:'fail', message:'Ontbreekt'}; }},
    { id: 'static.og.image', cat: 'Social', title: 'og:image absolute URL',
      fn: () => {
        const v = doc.metaProp('og:image');
        if (!v) return { level:'fail', message:'Ontbreekt' };
        return { level: /^https?:\/\//i.test(v) ? 'pass' : 'warn', message:v };
      }},
    { id: 'static.og.locale', cat: 'Social', title: 'og:locale',
      fn: () => { const v = doc.metaProp('og:locale'); return v ? {level:'pass', message:v} : {level:'warn', message:'Ontbreekt'}; }},
    { id: 'static.tw.card', cat: 'Social', title: 'twitter:card',
      fn: () => { const v = doc.metaName('twitter:card'); return v ? {level:'pass', message:v} : {level:'warn', message:'Ontbreekt'}; }},
    { id: 'static.img.alt', cat: 'A11y', title: 'Alle <img> hebben alt',
      fn: () => {
        const imgs = [...html.matchAll(/<img[^>]*>/gi)].map(m => m[0]);
        const missing = imgs.filter(i => !/\salt\s*=/i.test(i));
        return { level: missing.length===0?'pass':'fail', message:`${imgs.length} imgs, ${missing.length} zonder alt`, metric: missing.length };
      }},
    { id: 'static.skipLink', cat: 'A11y', title: 'Skip-to-content link',
      fn: () => {
        const ok = /class=["'][^"']*skip-link/i.test(html) || /<a[^>]+href=["']#(main|content|hoofdinhoud)/i.test(html);
        return { level: ok ? 'pass' : 'warn', message: ok ? 'Aanwezig' : 'Niet gevonden' };
      }},
    { id: 'static.lazy', cat: 'Performance', title: 'Below-fold images lazy-loaded',
      fn: () => {
        const imgs = [...html.matchAll(/<img[^>]*>/gi)].map(m => m[0]);
        const lazy = imgs.filter(i => /loading=["']lazy/i.test(i)).length;
        return { level: imgs.length<=2 ? 'pass' : (lazy >= imgs.length-2 ? 'pass' : 'warn'), message:`${lazy}/${imgs.length} lazy`, metric:lazy };
      }},
    { id: 'static.htmlSize', cat: 'Performance', title: 'HTML payload < 200 KB',
      fn: () => {
        const kb = Math.round(html.length / 1024);
        return { level: kb < 100 ? 'pass' : (kb < 200 ? 'warn' : 'fail'), message: `${kb} KB`, metric: kb };
      }},
    { id: 'static.privacyLink', cat: 'Legal', title: 'Link naar privacy/cookie verklaring',
      fn: () => {
        const ok = /<a[^>]*>[^<]*(privacy|cookie)/i.test(html);
        return { level: ok ? 'pass' : 'warn', message: ok ? 'Gevonden' : 'Niet gevonden' };
      }},
    { id: 'static.termsLink', cat: 'Legal', title: 'Link naar algemene voorwaarden',
      fn: () => {
        const ok = /<a[^>]*>[^<]*(voorwaarden|terms)/i.test(html);
        return { level: ok ? 'pass' : 'warn', message: ok ? 'Gevonden' : 'Niet gevonden' };
      }},
  ];

  for (const c of checks) {
    try {
      const r = c.fn();
      emit({ id: c.id, title: c.title, category: c.cat, ...r });
    } catch (e) {
      emit({ id: c.id, title: c.title, category: c.cat, level: 'fail', message: 'Check fout: ' + e.message });
    }
  }
}

// Minimal HTML helpers (no real DOM parser, regex-only — good enough voor static checks)
function parseDom(html) {
  return {
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' '),
    metaName: name => html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)`, 'i'))?.[1],
    metaProp: prop => html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)`, 'i'))?.[1],
    linkHref: rel => html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']*)`, 'i'))?.[1],
  };
}

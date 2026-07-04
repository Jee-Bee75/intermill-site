// 🟡 SEO files: sitemap.xml, robots.txt, JSON-LD generator
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, basename, relative } from 'node:path';
import { existsSync } from 'node:fs';

const RISK = 'medium';

async function findHtmlPages(root) {
  const out = [];
  async function walk(dir, rel = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (/^(node_modules|\.git|checks|dist|build)$/.test(e.name)) continue;
      const p = join(dir, e.name);
      const r = join(rel, e.name);
      if (e.isDirectory()) await walk(p, r);
      else if (e.isFile() && e.name.endsWith('.html')) out.push({ abs: p, rel: r });
    }
  }
  await walk(root);
  return out;
}

export const fixers = [

  // ============ 18. sitemap.xml regenereren ============
  {
    id: 'fix.sitemap.regen',
    title: 'Regenereer sitemap.xml uit *.html bestanden',
    description: 'Scant site-root recursief naar .html files (skipt node_modules/checks/dist), bouwt sitemap.xml met loc/lastmod. Vereist context.canonical voor base-URL.',
    risk: RISK,
    checkIds: ['seo.sitemap', 'sitemap.parse', 'sitemap.urls'],
    async dryRun(ctx) {
      const base = (ctx.canonical || '').replace(/\/$/, '');
      if (!base) return { skipped: true, reason: 'Geef context.canonical op (bv https://www.inter-mill.com)' };
      const pages = await findHtmlPages(ctx.siteRoot);
      const visible = pages.filter(p => !/(404|deploy-dashboard|deploy-checklist|audit)\.html$/i.test(p.rel));
      const file = resolve(ctx.siteRoot, 'sitemap.xml');
      const oldContent = existsSync(file) ? await readFile(file, 'utf8') : '';
      const urls = visible.map(p => {
        let path = '/' + p.rel.replace(/\\/g, '/');
        path = path.replace(/\/index\.html$/, '/');
        return `${base}${path}`;
      }).sort();
      const today = new Date().toISOString().slice(0, 10);
      const newContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
      if (oldContent === newContent) return { skipped: true, reason: 'Sitemap al up-to-date' };
      return { file, oldContent, newContent, summary: `${urls.length} URLs in sitemap.xml` };
    }
  },

  // ============ 19. robots.txt aanvullen met Sitemap-directive ============
  {
    id: 'fix.robots.sitemap',
    title: 'Voeg Sitemap: directive toe in robots.txt',
    description: 'Append/insert `Sitemap: <canonical>/sitemap.xml` in robots.txt. Vereist context.canonical.',
    risk: 'low',
    checkIds: ['seo.robotsTxt'],
    async dryRun(ctx) {
      const base = (ctx.canonical || '').replace(/\/$/, '');
      if (!base) return { skipped: true, reason: 'Geef context.canonical op' };
      const file = resolve(ctx.siteRoot, 'robots.txt');
      const sitemapLine = `Sitemap: ${base}/sitemap.xml`;
      let oldContent = existsSync(file) ? await readFile(file, 'utf8') : '';
      if (oldContent.includes(sitemapLine)) return { skipped: true, reason: 'Sitemap-line al aanwezig' };
      let newContent;
      if (!oldContent.trim()) {
        newContent = `User-agent: *\nAllow: /\n\n${sitemapLine}\n`;
      } else {
        const trimmed = oldContent.trimEnd();
        // Strip oude Sitemap: lijnen
        const cleaned = trimmed.split('\n').filter(l => !/^Sitemap:/i.test(l)).join('\n');
        newContent = cleaned + '\n\n' + sitemapLine + '\n';
      }
      return { file, oldContent, newContent, summary: `Sitemap-directive → ${base}/sitemap.xml` };
    }
  },

  // ============ 20. JSON-LD Organization + WebSite genereren ============
  {
    id: 'fix.jsonld.org',
    title: 'Injecteer JSON-LD Organization + WebSite',
    description: 'Voegt JSON-LD blok toe in <head> met @type Organization + WebSite. Vereist context.org { name, url, logo, sameAs[], email, phone, address }.',
    risk: 'low',
    checkIds: ['seo.jsonld', 'jsonld.schema', 'jsonld.present'],
    async dryRun(ctx) {
      const file = resolve(ctx.siteRoot, 'index.html');
      const content = await readFile(file, 'utf8');
      if (/"@type":\s*"Organization"/i.test(content)) return { skipped: true, reason: 'Organization JSON-LD al aanwezig' };

      const org = ctx.org || {};
      const name = org.name || 'InterMill';
      const url = org.url || ctx.canonical || 'https://www.inter-mill.com/';
      const logo = org.logo || `${url.replace(/\/$/, '')}/logo.png`;

      const jsonld = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${url}#organization`,
            name, url, logo,
            ...(org.email && { email: org.email }),
            ...(org.phone && { telephone: org.phone }),
            ...(org.address && { address: { '@type': 'PostalAddress', ...org.address } }),
            ...(org.sameAs && { sameAs: org.sameAs }),
          },
          {
            '@type': 'WebSite',
            '@id': `${url}#website`,
            url, name,
            publisher: { '@id': `${url}#organization` },
            inLanguage: ctx.lang || 'nl',
          }
        ]
      };
      // Escape < / > / & zodat org-waarden geen </script> kunnen injecteren (XSS-breakout).
      const jsonSafe = JSON.stringify(jsonld, null, 2)
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
      const snippet = `<script type="application/ld+json">\n${jsonSafe}\n</script>`;
      const newContent = content.replace(/<\/head>/i, `  ${snippet}\n</head>`);
      return { file, oldContent: content, newContent, summary: 'Organization + WebSite JSON-LD geïnjecteerd' };
    }
  },

  // ============ 21. Minify HTML naar dist/ ============
  {
    id: 'fix.minify.html',
    title: 'Genereer dist/ met geminifyde HTML',
    description: 'Maakt dist/ folder met geminifyde versies van alle .html (comments weg, whitespace ingekort). Originelen blijven onaangetast.',
    risk: RISK,
    checkIds: ['perf.size', 'static.htmlSize'],
    async dryRun(ctx) {
      const pages = await findHtmlPages(ctx.siteRoot);
      const targets = pages.filter(p => !p.rel.startsWith('dist/'));
      if (!targets.length) return { skipped: true, reason: 'Geen HTML files' };
      let savedKb = 0;
      for (const p of targets) {
        const orig = await readFile(p.abs, 'utf8');
        const min = minifyHtml(orig);
        savedKb += (orig.length - min.length) / 1024;
      }
      return { file: resolve(ctx.siteRoot, 'dist'), summary: `${targets.length} HTML files → dist/, ~${savedKb.toFixed(1)} KB bespaard` };
    },
    async apply(ctx) {
      const { mkdir, writeFile } = await import('node:fs/promises');
      const distRoot = resolve(ctx.siteRoot, 'dist');
      const pages = await findHtmlPages(ctx.siteRoot);
      const targets = pages.filter(p => !p.rel.startsWith('dist/'));
      const generated = [];
      for (const p of targets) {
        const orig = await readFile(p.abs, 'utf8');
        const min = minifyHtml(orig);
        const out = resolve(distRoot, p.rel);
        await mkdir(resolve(out, '..'), { recursive: true });
        await writeFile(out, min, 'utf8');
        generated.push(`dist/${p.rel}`);
      }
      return { ok: true, file: relative(ctx.siteRoot, distRoot), summary: `${generated.length} files`, generated };
    }
  },

];

function minifyHtml(html) {
  return html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')              // strip comments (behoud IE conditionals)
    .replace(/>\s+</g, '><')                               // whitespace tussen tags
    .replace(/[\r\n]+\s*/g, '\n')                          // multiple newlines
    .replace(/^\s+|\s+$/gm, '')                            // trim per regel
    .replace(/\n+/g, '\n')                                 // multiple newlines collapse
    .trim();
}

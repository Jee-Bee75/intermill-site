// 🟢 Low-risk HTML/meta fixers — idempotent, regex-based, alleen index.html
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const RISK = 'low';
const HTML_FILE = 'index.html';

async function loadHtml(siteRoot, file = HTML_FILE) {
  const abs = resolve(siteRoot, file);
  return { file: abs, content: await readFile(abs, 'utf8') };
}

function ret(file, oldContent, newContent, summary) {
  if (oldContent === newContent) return { skipped: true, reason: 'Niets te wijzigen (al goed)' };
  return { file, oldContent, newContent, summary };
}

// Helper: inject net voor </head>
function injectInHead(html, snippet) {
  return html.replace(/<\/head>/i, `  ${snippet}\n</head>`);
}

// Helper: inject net na <body>
function injectAfterBody(html, snippet) {
  return html.replace(/<body([^>]*)>/i, `<body$1>\n\n${snippet}\n`);
}

export const fixers = [

  // ============ 1. Demote extra H1s naar H2 ============
  {
    id: 'fix.h1.demote',
    title: 'Demote extra <h1> naar <h2>',
    description: 'Houdt eerste <h1> intact; alle volgende worden <h2 class="display">. Veilig wanneer .display CSS de styling regelt.',
    risk: RISK,
    checkIds: ['seo.h1', 'static.h1', 'a11y.page-has-heading-one'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      const matches = [...content.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi)];
      if (matches.length <= 1) return { skipped: true, reason: `${matches.length}× <h1> — niets te doen` };
      let out = content;
      let i = 0;
      out = out.replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi, (m, attrs, inner) => {
        i++;
        return i === 1 ? m : `<h2${attrs}>${inner}</h2>`;
      });
      return ret(file, content, out, `${matches.length - 1}× <h1> → <h2>`);
    }
  },

  // ============ 2. <html lang> ============
  {
    id: 'fix.html.lang',
    title: 'Voeg <html lang="nl"> toe',
    description: 'Set lang attribuut op <html>. Default "nl" — pas aan in context.lang voor andere taal.',
    risk: RISK,
    checkIds: ['seo.lang', 'static.lang', 'a11y.html-has-lang'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      if (/<html[^>]+lang=/i.test(content)) return { skipped: true, reason: 'lang al ingesteld' };
      const lang = escapeHtml(ctx.lang || 'nl');
      const out = content.replace(/<html\b([^>]*)>/i, `<html$1 lang="${lang}">`);
      return ret(file, content, out, `<html lang="${lang}">`);
    }
  },

  // ============ 3. Viewport meta ============
  {
    id: 'fix.meta.viewport',
    title: 'Voeg viewport meta toe',
    description: 'Inject <meta name="viewport" content="width=device-width, initial-scale=1.0">.',
    risk: RISK,
    checkIds: ['tech.viewport', 'static.viewport'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      if (/<meta[^>]+name=["']viewport/i.test(content)) return { skipped: true, reason: 'Al aanwezig' };
      const out = injectInHead(content, `<meta name="viewport" content="width=device-width, initial-scale=1.0">`);
      return ret(file, content, out, 'viewport meta toegevoegd');
    }
  },

  // ============ 4. Charset meta ============
  {
    id: 'fix.meta.charset',
    title: 'Voeg charset UTF-8 toe',
    description: 'Inject <meta charset="UTF-8"> als eerste regel in <head>.',
    risk: RISK,
    checkIds: ['tech.charset', 'static.charset'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      if (/<meta[^>]+charset/i.test(content)) return { skipped: true, reason: 'Al aanwezig' };
      const out = content.replace(/<head\b([^>]*)>/i, `<head$1>\n  <meta charset="UTF-8">`);
      return ret(file, content, out, 'charset=UTF-8');
    }
  },

  // ============ 5. theme-color ============
  {
    id: 'fix.meta.themecolor',
    title: 'Voeg theme-color meta toe',
    description: 'Default #FFDD00 (InterMill geel). Pas aan via context.themeColor.',
    risk: RISK,
    checkIds: ['tech.theme', 'static.themeColor'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      if (/<meta[^>]+name=["']theme-color/i.test(content)) return { skipped: true, reason: 'Al aanwezig' };
      const color = escapeHtml(ctx.themeColor || '#FFDD00');
      const out = injectInHead(content, `<meta name="theme-color" content="${color}">`);
      return ret(file, content, out, `theme-color=${color}`);
    }
  },

  // ============ 6. apple-touch-icon ============
  {
    id: 'fix.meta.appletouch',
    title: 'Voeg apple-touch-icon link toe',
    description: 'Default verwijst naar favicon.svg. Pas aan via context.appleTouchIcon.',
    risk: RISK,
    checkIds: ['tech.touchIcon', 'static.appleTouch'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      if (/<link[^>]+rel=["']apple-touch-icon/i.test(content)) return { skipped: true, reason: 'Al aanwezig' };
      const href = escapeHtml(ctx.appleTouchIcon || 'favicon.svg');
      const out = injectInHead(content, `<link rel="apple-touch-icon" href="${href}">`);
      return ret(file, content, out, `apple-touch-icon=${href}`);
    }
  },

  // ============ 7. Canonical URL ============
  {
    id: 'fix.meta.canonical',
    title: 'Voeg canonical URL toe',
    description: 'Inject <link rel="canonical" href="..."> in head. Vereist context.canonical URL.',
    risk: RISK,
    checkIds: ['seo.canonical', 'static.canonical'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      if (/<link[^>]+rel=["']canonical/i.test(content)) return { skipped: true, reason: 'Al aanwezig' };
      const url = ctx.canonical;
      if (!url) return { skipped: true, reason: 'Geef canonical URL op via context.canonical' };
      const safeUrl = escapeHtml(url);
      const out = injectInHead(content, `<link rel="canonical" href="${safeUrl}">`);
      return ret(file, content, out, `canonical=${safeUrl}`);
    }
  },

  // ============ 8. Skip-to-content link ============
  {
    id: 'fix.a11y.skiplink',
    title: 'Voeg skip-to-content link + CSS toe',
    description: 'Visueel verborgen anchor naar #main, zichtbaar bij focus. CSS injected in <head>.',
    risk: RISK,
    checkIds: ['a11y.skip', 'static.skipLink'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      if (/class=["'][^"']*skip-link/i.test(content)) return { skipped: true, reason: 'Al aanwezig' };
      const css = `<style>
  .skip-link{position:absolute;top:-48px;left:8px;background:#0F0F0F;color:#FFDD00;padding:10px 16px;border-radius:6px;font-weight:700;font-size:14px;text-decoration:none;z-index:1000;transition:top .15s}
  .skip-link:focus{top:8px;outline:2px solid #FFDD00;outline-offset:2px}
  main:focus{outline:none}
</style>`;
      let out = injectInHead(content, css);
      out = injectAfterBody(out, `<a class="skip-link" href="#main">Sla navigatie over</a>`);
      // Ensure main heeft id="main" + tabindex
      if (/<main[^>]*>/i.test(out) && !/<main[^>]+id=["']main/i.test(out)) {
        out = out.replace(/<main\b([^>]*)>/i, (m, attrs) => {
          const hasId = / id=/.test(attrs);
          const hasTab = /tabindex=/.test(attrs);
          return `<main${attrs}${hasId?'':' id="main"'}${hasTab?'':' tabindex="-1"'}>`;
        });
      }
      return ret(file, content, out, 'Skip-link + CSS + main id=main toegevoegd');
    }
  },

  // ============ 9. loading=lazy + decoding=async op below-fold imgs ============
  {
    id: 'fix.img.lazy',
    title: 'Voeg loading="lazy" + decoding="async" toe',
    description: 'Skipt eerste 2 imgs (above-fold). Voor rest: voeg loading=lazy + decoding=async toe als nog niet aanwezig.',
    risk: RISK,
    checkIds: ['perf.lazy', 'static.lazy'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      const imgRegex = /<img\b([^>]*)>/gi;
      const matches = [...content.matchAll(imgRegex)];
      if (matches.length <= 2) return { skipped: true, reason: `Slechts ${matches.length} imgs — niets below-fold` };

      let i = 0;
      let changed = 0;
      const out = content.replace(imgRegex, (m, attrs) => {
        i++;
        if (i <= 2) return m; // skip first 2 (above fold)
        let newAttrs = attrs;
        if (!/loading=/i.test(newAttrs)) { newAttrs += ' loading="lazy"'; changed++; }
        if (!/decoding=/i.test(newAttrs)) { newAttrs += ' decoding="async"'; }
        return `<img${newAttrs}>`;
      });
      if (changed === 0) return { skipped: true, reason: 'Alle below-fold imgs al lazy' };
      return ret(file, content, out, `${changed} imgs → loading=lazy + decoding=async`);
    }
  },

  // ============ 10. width/height op imgs (CLS fix) ============
  {
    id: 'fix.img.dimensions',
    title: 'Voeg width/height attributen toe op <img>',
    description: 'Probet elke <img> URL met probe-image-size, voegt width+height attributen toe om CLS te voorkomen. Network-call per img.',
    risk: RISK,
    checkIds: ['perf.cls', 'lh.mobile.cls'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      const { default: probe } = await import('probe-image-size');
      const imgRegex = /<img\b([^>]*)>/gi;
      const matches = [...content.matchAll(imgRegex)];
      const targetUrl = ctx.targetLocal || 'http://localhost:4173/';
      let changed = 0;
      let out = content;
      for (const m of matches) {
        const attrs = m[1];
        if (/width=/i.test(attrs) && /height=/i.test(attrs)) continue;
        const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
        if (!srcMatch) continue;
        try {
          const url = new URL(srcMatch[1], targetUrl).href;
          const info = await probe(url, { timeout: 5000 });
          let newAttrs = attrs;
          if (!/width=/i.test(newAttrs)) newAttrs += ` width="${info.width}"`;
          if (!/height=/i.test(newAttrs)) newAttrs += ` height="${info.height}"`;
          out = out.replace(m[0], `<img${newAttrs}>`);
          changed++;
        } catch {}
      }
      if (changed === 0) return { skipped: true, reason: 'Alle imgs hebben al width/height of probe faalde' };
      return ret(file, content, out, `${changed} imgs → width/height toegevoegd`);
    }
  },

  // ============ 11. rel=noopener noreferrer op target=_blank ============
  {
    id: 'fix.a.noopener',
    title: 'Voeg rel="noopener noreferrer" toe op target="_blank"',
    description: 'Security/perf — voorkomt tabnabbing en referrer-leak.',
    risk: RISK,
    checkIds: ['sec.noopener'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      const regex = /<a\b([^>]*\btarget=["']_blank["'][^>]*)>/gi;
      let changed = 0;
      const out = content.replace(regex, (m, attrs) => {
        if (/rel=["'][^"']*noopener/i.test(attrs)) return m;
        if (/rel=["']([^"']*)["']/i.test(attrs)) {
          changed++;
          return `<a${attrs.replace(/rel=["']([^"']*)["']/i, (mm, val) => `rel="${val} noopener noreferrer"`)}>`;
        }
        changed++;
        return `<a${attrs} rel="noopener noreferrer">`;
      });
      if (changed === 0) return { skipped: true, reason: 'Alle target=_blank links al safe' };
      return ret(file, content, out, `${changed} links → rel=noopener noreferrer`);
    }
  },

  // ============ 12. http:// → https:// ============
  {
    id: 'fix.https.refs',
    title: 'Vervang http:// door https:// (geen localhost)',
    description: 'Mixed content fix. Skipt localhost/127.0.0.1/schema.org/w3.org namespaces.',
    risk: RISK,
    checkIds: ['tech.https'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      const regex = /(["'])http:\/\/(?!localhost|127\.0\.0\.1|schema\.org|www\.w3\.org)([^"'\s]+)/g;
      const matches = [...content.matchAll(regex)];
      if (!matches.length) return { skipped: true, reason: 'Geen http:// refs gevonden' };
      const out = content.replace(regex, (m, q, rest) => `${q}https://${rest}`);
      return ret(file, content, out, `${matches.length} http:// → https://`);
    }
  },

  // ============ 13. OG + Twitter cards genereren ============
  {
    id: 'fix.meta.og',
    title: 'Genereer ontbrekende OG + Twitter meta tags',
    description: 'Leest title + description uit head, genereert og:title/og:description/og:type/og:url/twitter:card als ze ontbreken. Vereist context.canonical voor og:url + og:image.',
    risk: RISK,
    checkIds: ['og.title', 'og.desc', 'og.image', 'tw.card', 'static.og.title', 'static.og.desc', 'static.og.image', 'static.tw.card'],
    async dryRun(ctx) {
      const { file, content } = await loadHtml(ctx.siteRoot);
      const title = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' ');
      const desc = content.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1];
      const url = ctx.canonical || content.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i)?.[1];

      if (!title || !desc) return { skipped: true, reason: 'Title of description ontbreekt — vul eerst aan' };

      const missing = [];
      const add = (re, line) => { if (!re.test(content)) missing.push(line); };
      add(/<meta[^>]+property=["']og:type/i,        `<meta property="og:type" content="website">`);
      add(/<meta[^>]+property=["']og:title/i,       `<meta property="og:title" content="${escapeHtml(title)}">`);
      add(/<meta[^>]+property=["']og:description/i, `<meta property="og:description" content="${escapeHtml(desc)}">`);
      if (url) add(/<meta[^>]+property=["']og:url/i, `<meta property="og:url" content="${escapeHtml(url)}">`);
      if (ctx.ogImage) add(/<meta[^>]+property=["']og:image/i, `<meta property="og:image" content="${escapeHtml(ctx.ogImage)}">`);
      add(/<meta[^>]+name=["']twitter:card/i,       `<meta name="twitter:card" content="summary_large_image">`);
      add(/<meta[^>]+name=["']twitter:title/i,      `<meta name="twitter:title" content="${escapeHtml(title)}">`);
      add(/<meta[^>]+name=["']twitter:description/i,`<meta name="twitter:description" content="${escapeHtml(desc)}">`);
      if (ctx.ogImage) add(/<meta[^>]+name=["']twitter:image/i, `<meta name="twitter:image" content="${escapeHtml(ctx.ogImage)}">`);

      if (!missing.length) return { skipped: true, reason: 'Alle OG/Twitter tags al aanwezig' };
      const out = injectInHead(content, missing.join('\n  '));
      return ret(file, content, out, `${missing.length} OG/Twitter tags toegevoegd`);
    }
  },

];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

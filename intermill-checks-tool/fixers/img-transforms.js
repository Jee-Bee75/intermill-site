// 🟡 Medium-risk asset-transforms via sharp — genereert nieuwe files, raakt originelen niet aan
import sharp from 'sharp';
import { readdir, stat, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join, basename, extname, dirname, relative } from 'node:path';
import { existsSync } from 'node:fs';

const RISK = 'medium';

async function findImages(root, exts = ['.jpg', '.jpeg', '.png']) {
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory() && !/^(node_modules|\.git|checks|dist|build)/.test(e.name)) await walk(p);
      else if (e.isFile() && exts.includes(extname(e.name).toLowerCase())) out.push(p);
    }
  }
  await walk(root);
  return out;
}

export const fixers = [

  // ============ 14. PNG/JPG → WebP + AVIF (naast origineel) ============
  {
    id: 'fix.img.modern',
    title: 'Genereer WebP + AVIF naast bestaande JPG/PNG',
    description: 'Loopt door alle .jpg/.png in site-root, maakt .webp + .avif naast (overschrijft bestaande modern formats niet zonder context.overwrite=true). Originelen blijven onaangetast.',
    risk: RISK,
    checkIds: ['crawl.images.modern', 'perf.images'],
    async dryRun(ctx) {
      const imgs = await findImages(ctx.siteRoot);
      const plan = [];
      for (const p of imgs) {
        const base = p.replace(/\.(jpe?g|png)$/i, '');
        const webp = `${base}.webp`;
        const avif = `${base}.avif`;
        const todo = [];
        if (!existsSync(webp) || ctx.overwrite) todo.push('webp');
        if (!existsSync(avif) || ctx.overwrite) todo.push('avif');
        if (todo.length) plan.push({ src: relative(ctx.siteRoot, p), formats: todo });
      }
      if (!plan.length) return { skipped: true, reason: 'Alle imgs hebben al WebP + AVIF naast' };
      return {
        summary: `${plan.length} imgs → ${plan.reduce((s,p)=>s+p.formats.length,0)} nieuwe files`,
        artifacts: plan,
      };
    },
    async apply(ctx) {
      const imgs = await findImages(ctx.siteRoot);
      const generated = [];
      for (const p of imgs) {
        const base = p.replace(/\.(jpe?g|png)$/i, '');
        const webp = `${base}.webp`;
        const avif = `${base}.avif`;
        const img = sharp(p);
        if (!existsSync(webp) || ctx.overwrite) {
          await img.clone().webp({ quality: 82 }).toFile(webp);
          generated.push(relative(ctx.siteRoot, webp));
        }
        if (!existsSync(avif) || ctx.overwrite) {
          await img.clone().avif({ quality: 60 }).toFile(avif);
          generated.push(relative(ctx.siteRoot, avif));
        }
      }
      return { ok: true, file: '(multi)', summary: `${generated.length} files gegenereerd`, generated };
    }
  },

  // ============ 15. Responsive srcset variants ============
  {
    id: 'fix.img.srcset',
    title: 'Genereer responsive srcset varianten (320/640/1024/1920w)',
    description: 'Per JPG/PNG/WebP genereert -320w, -640w, -1024w, -1920w varianten. Output naast origineel. Skipt bestaande.',
    risk: RISK,
    checkIds: ['perf.images'],
    async dryRun(ctx) {
      const widths = ctx.widths || [320, 640, 1024, 1920];
      const imgs = await findImages(ctx.siteRoot, ['.jpg', '.jpeg', '.png', '.webp']);
      const plan = [];
      for (const p of imgs) {
        if (/-\d+w\.(jpe?g|png|webp)$/i.test(p)) continue; // skip already-variant
        const meta = await sharp(p).metadata().catch(() => null);
        if (!meta || meta.width < 400) continue;
        const ext = extname(p);
        const base = p.slice(0, -ext.length);
        const todo = widths.filter(w => w < meta.width && !existsSync(`${base}-${w}w${ext}`));
        if (todo.length) plan.push({ src: relative(ctx.siteRoot, p), widths: todo, orig: meta.width });
      }
      if (!plan.length) return { skipped: true, reason: 'Alle srcset-varianten al aanwezig' };
      return {
        summary: `${plan.length} imgs → ${plan.reduce((s,p)=>s+p.widths.length,0)} varianten`,
        artifacts: plan.slice(0, 20),
      };
    },
    async apply(ctx) {
      const widths = ctx.widths || [320, 640, 1024, 1920];
      const imgs = await findImages(ctx.siteRoot, ['.jpg', '.jpeg', '.png', '.webp']);
      const generated = [];
      for (const p of imgs) {
        if (/-\d+w\.(jpe?g|png|webp)$/i.test(p)) continue;
        const meta = await sharp(p).metadata().catch(() => null);
        if (!meta || meta.width < 400) continue;
        const ext = extname(p);
        const base = p.slice(0, -ext.length);
        for (const w of widths) {
          if (w >= meta.width) continue;
          const out = `${base}-${w}w${ext}`;
          if (existsSync(out) && !ctx.overwrite) continue;
          await sharp(p).resize({ width: w }).toFile(out);
          generated.push(relative(ctx.siteRoot, out));
        }
      }
      return { ok: true, file: '(multi)', summary: `${generated.length} varianten`, generated };
    }
  },

  // ============ 16. OG-image generator (1200x630) ============
  {
    id: 'fix.og.image',
    title: 'Genereer OG-image 1200×630',
    description: 'Maakt og-image.png 1200×630 uit context.source (default: logo.png met yellow background + title text overlay). Output: og-image.png in site-root.',
    risk: RISK,
    checkIds: ['og.image', 'og.image.dims', 'static.og.image'],
    async dryRun(ctx) {
      const out = resolve(ctx.siteRoot, ctx.ogImageOut || 'og-image.png');
      if (existsSync(out) && !ctx.overwrite) return { skipped: true, reason: `${relative(ctx.siteRoot, out)} bestaat al — context.overwrite=true om te vervangen` };
      return {
        file: out,
        summary: `OG image 1200×630 → ${relative(ctx.siteRoot, out)}`,
      };
    },
    async apply(ctx) {
      const out = resolve(ctx.siteRoot, ctx.ogImageOut || 'og-image.png');
      const bgColor = ctx.bgColor || '#FFDD00';
      const inkColor = ctx.inkColor || '#0F0F0F';
      const title = ctx.title || 'InterMill';
      const subtitle = ctx.subtitle || 'Snij- & meetgereedschap';

      const svgOverlay = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${bgColor}"/>
  <rect x="80" y="80" width="1040" height="470" fill="${inkColor}" rx="20"/>
  <text x="120" y="280" font-family="Helvetica, Arial, sans-serif" font-size="88" font-weight="900" fill="${bgColor}">${escapeXml(title)}</text>
  <text x="120" y="370" font-family="Helvetica, Arial, sans-serif" font-size="36" font-weight="500" fill="${bgColor}" opacity="0.85">${escapeXml(subtitle)}</text>
  <circle cx="1050" cy="490" r="30" fill="${bgColor}"/>
</svg>`.trim();

      await sharp(Buffer.from(svgOverlay)).png().toFile(out);
      return { ok: true, file: relative(ctx.siteRoot, out), summary: `OG image gegenereerd: ${out}` };
    }
  },

  // ============ 17. Favicon-set uit favicon.svg ============
  {
    id: 'fix.favicon.set',
    title: 'Genereer favicon-16/32/48/180/192/512 uit favicon.svg',
    description: 'Maakt favicon-16x16.png / -32 / -48 / apple-touch-icon-180.png / android-192.png / -512.png + manifest snippet.',
    risk: RISK,
    checkIds: ['tech.favicon', 'static.favicon'],
    async dryRun(ctx) {
      const src = resolve(ctx.siteRoot, ctx.faviconSrc || 'favicon.svg');
      if (!existsSync(src)) return { skipped: true, reason: `Source ontbreekt: ${src}` };
      const sizes = [16, 32, 48, 180, 192, 512];
      const todo = sizes.filter(s => !existsSync(resolve(ctx.siteRoot, `favicon-${s}x${s}.png`)) || ctx.overwrite);
      if (!todo.length) return { skipped: true, reason: 'Alle favicon-varianten bestaan al' };
      return { file: src, summary: `${todo.length} PNG varianten + manifest snippet` };
    },
    async apply(ctx) {
      const src = resolve(ctx.siteRoot, ctx.faviconSrc || 'favicon.svg');
      const sizes = [16, 32, 48, 180, 192, 512];
      const generated = [];
      for (const s of sizes) {
        const out = resolve(ctx.siteRoot, `favicon-${s}x${s}.png`);
        if (existsSync(out) && !ctx.overwrite) continue;
        await sharp(src).resize(s, s).png().toFile(out);
        generated.push(relative(ctx.siteRoot, out));
      }
      // Apple touch
      const apple = resolve(ctx.siteRoot, 'apple-touch-icon.png');
      if (!existsSync(apple) || ctx.overwrite) {
        await sharp(src).resize(180, 180).png().toFile(apple);
        generated.push('apple-touch-icon.png');
      }
      // Manifest snippet
      const manifest = {
        name: ctx.title || 'InterMill',
        short_name: ctx.shortName || 'InterMill',
        icons: [
          { src: 'favicon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'favicon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        theme_color: ctx.themeColor || '#FFDD00',
        background_color: '#ffffff',
        display: 'standalone',
      };
      const manifestPath = resolve(ctx.siteRoot, 'manifest.webmanifest');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      generated.push('manifest.webmanifest');
      return { ok: true, file: '(multi)', summary: `${generated.length} files`, generated };
    }
  },

];

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
}

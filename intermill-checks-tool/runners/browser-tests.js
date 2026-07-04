// Cross-browser smoke + mobile + cookie consent + JS errors + tracking detection
import { chromium, firefox, webkit, devices } from 'playwright';

const CAT_PRE = 'Pre-deploy';
const CAT_TRK = 'Tracking';
const CAT_LEG = 'Legal';

async function loadAndCapture(browserType, url, opts = {}) {
  const browser = await browserType.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ ...opts, locale: 'nl-NL' });
    const page = await ctx.newPage();
    const errors = [];
    const requests = [];
    const cookies = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => requests.push({ url: r.url(), resourceType: r.resourceType() }));

    const t0 = Date.now();
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const loadMs = Date.now() - t0;

    const title = await page.title();
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    const cookiesList = await ctx.cookies();
    await browser.close();
    return { status: res?.status(), title, h1, loadMs, errors, requests, cookies: cookiesList };
  } catch (e) {
    await browser.close();
    throw e;
  }
}

export async function run({ targetProd, targetLocal, emit }) {
  const target = targetProd || targetLocal;
  if (!target) return;

  // 1. Cross-browser (WebKit kan ontbreken op oudere macOS)
  const browsers = [['Chromium', chromium], ['Firefox', firefox], ['WebKit', webkit]];
  for (const [name, btype] of browsers) {
    try {
      const r = await loadAndCapture(btype, target);
      const ok = r.status === 200 && r.title && r.errors.length === 0;
      emit({
        id: `browser.${name.toLowerCase()}`,
        title: `Pageload in ${name}`,
        category: CAT_PRE,
        level: ok ? 'pass' : r.status === 200 ? 'warn' : 'fail',
        message: `${r.status} · ${r.loadMs}ms · ${r.errors.length} JS errors · title: "${(r.title||'').slice(0,40)}"`,
        detail: r.errors.length ? { errors: r.errors.slice(0, 10) } : undefined,
        metric: r.loadMs,
        durationMs: r.loadMs,
      });
    } catch (e) {
      const skipped = /Executable doesn't exist|does not support|browserType\.launch/i.test(e.message);
      emit({
        id: `browser.${name.toLowerCase()}`,
        title: `Pageload in ${name}`,
        category: CAT_PRE,
        level: skipped ? 'warn' : 'fail',
        message: skipped ? `Skipped: ${name} niet beschikbaar op dit OS` : e.message,
      });
    }
  }

  // 2. Mobile devices
  const mobileDevices = [['iPhone 14', devices['iPhone 14']], ['Pixel 7', devices['Pixel 7']]];
  for (const [name, device] of mobileDevices) {
    try {
      const r = await loadAndCapture(chromium, target, device);
      emit({
        id: `mobile.${name.replace(/\s/g, '_').toLowerCase()}`,
        title: `Mobiel device: ${name}`,
        category: CAT_PRE,
        level: r.status === 200 && r.errors.length === 0 ? 'pass' : 'warn',
        message: `${r.status} · ${r.loadMs}ms · ${r.errors.length} JS errors`,
        detail: r.errors.length ? { errors: r.errors.slice(0, 5) } : undefined,
      });
    } catch (e) {
      emit({ id: `mobile.${name}`, title: `Mobiel device: ${name}`, category: CAT_PRE, level: 'fail', message: e.message });
    }
  }

  // 3. Single deep run for tracking, consent, errors (chromium)
  let deep;
  try {
    deep = await loadAndCapture(chromium, target);
  } catch (e) {
    emit({ id: 'browser.deep', title: 'Deep browser scan', category: CAT_PRE, level: 'fail', message: e.message });
    return;
  }

  // JS errors
  emit({
    id: 'browser.jsErrors',
    title: 'Geen JS errors op pageload',
    category: CAT_PRE,
    level: deep.errors.length === 0 ? 'pass' : 'fail',
    message: deep.errors.length === 0 ? 'Clean console' : `${deep.errors.length} fouten`,
    detail: deep.errors.slice(0, 10),
    metric: deep.errors.length,
  });

  // Tracking detection (network requests)
  const trackingDomains = {
    'Google Analytics': /google-analytics\.com|googletagmanager\.com|gtag/,
    'Facebook Pixel': /facebook\.com\/tr|connect\.facebook\.net/,
    'Plausible': /plausible\.io/,
    'Umami': /umami/,
    'Matomo': /matomo|piwik/,
    'Hotjar': /hotjar/,
    'PostHog': /posthog/,
    'Sentry': /sentry\.io/,
  };
  const detected = [];
  for (const [name, pattern] of Object.entries(trackingDomains)) {
    if (deep.requests.some(r => pattern.test(r.url))) detected.push(name);
  }
  emit({
    id: 'tracking.detected',
    title: 'Tracking/analytics ingeladen',
    category: CAT_TRK,
    level: detected.length > 0 ? 'pass' : 'warn',
    message: detected.length > 0 ? detected.join(', ') : 'Geen tracking gedetecteerd',
    detail: detected,
  });

  // Cookies set pre-consent
  const trackingCookies = deep.cookies.filter(c =>
    /^(_ga|_gid|_fbp|_hjSession|_pk_|sid|sessionid|datadome)/i.test(c.name) ||
    /(google|facebook|hotjar|doubleclick)/i.test(c.domain || '')
  );
  emit({
    id: 'consent.preConsentCookies',
    title: 'Geen tracking-cookies vóór consent',
    category: CAT_LEG,
    level: trackingCookies.length === 0 ? 'pass' : 'fail',
    message: trackingCookies.length === 0 ? `${deep.cookies.length} cookies, geen tracking` : `${trackingCookies.length} tracking-cookies gezet zonder consent`,
    detail: trackingCookies.map(c => ({ name: c.name, domain: c.domain, expires: c.expires })),
    metric: trackingCookies.length,
  });

  // Cookie consent banner detection
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newContext({ locale: 'nl-NL' }).then(c => c.newPage());
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });

    const banner = await page.evaluate(() => {
      const candidates = document.querySelectorAll('[class*="cookie"],[class*="consent"],[id*="cookie"],[id*="consent"],[class*="cmp"],[aria-label*="cookie" i]');
      for (const el of candidates) {
        if (el.offsetWidth > 100 && el.offsetHeight > 30 && getComputedStyle(el).display !== 'none') {
          const buttons = [...el.querySelectorAll('button, a')].map(b => b.textContent.trim()).filter(Boolean);
          return { html: el.outerHTML.slice(0, 300), buttons };
        }
      }
      return null;
    });
    await browser.close();
    emit({
      id: 'consent.banner',
      title: 'Cookie consent banner zichtbaar bij laden',
      category: CAT_LEG,
      level: banner ? 'pass' : (detected.length > 0 ? 'fail' : 'warn'),
      message: banner ? `Knoppen: ${banner.buttons.join(' / ')}` : 'Geen banner gevonden',
      detail: banner,
    });
  } catch (e) {
    emit({ id: 'consent.banner', title: 'Cookie consent banner', category: CAT_LEG, level: 'warn', message: e.message });
  }
}

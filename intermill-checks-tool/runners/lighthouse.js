// Lighthouse mobile + desktop, Core Web Vitals
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';

const CAT = 'Performance';

async function runLh(url, formFactor = 'mobile') {
  const browser = await chromium.launch({
    args: ['--remote-debugging-port=0'],
  });
  try {
    // chrome-launcher-style: get debugging port from playwright's launched chromium
    const wsEndpoint = browser.wsEndpoint();
    const portMatch = wsEndpoint.match(/:(\d+)\//);
    // Lighthouse needs a CDP port — easier: launch chrome via chrome-launcher
    await browser.close();
  } catch {}

  const { default: chromeLauncher } = await import('chrome-launcher');
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
  try {
    const opts = {
      logLevel: 'error',
      output: 'json',
      port: chrome.port,
      formFactor,
      screenEmulation: formFactor === 'mobile'
        ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
        : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      throttling: formFactor === 'mobile'
        ? { rttMs: 150, throughputKbps: 1638, cpuSlowdownMultiplier: 4 }
        : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
    };
    const result = await lighthouse(url, opts);
    return JSON.parse(result.report);
  } finally {
    await chrome.kill();
  }
}

function score(lhr, key) {
  return Math.round((lhr.categories[key]?.score ?? 0) * 100);
}

export async function run({ targetProd, targetLocal, emit }) {
  const target = targetProd || targetLocal;
  if (!target) return;

  for (const form of ['mobile', 'desktop']) {
    let lhr;
    try {
      const t0 = Date.now();
      lhr = await runLh(target, form);
      const duration = Date.now() - t0;

      // Category scores
      for (const [key, name] of [['performance', 'Performance'], ['accessibility', 'Accessibility'], ['seo', 'SEO'], ['best-practices', 'Best Practices']]) {
        const s = score(lhr, key);
        emit({
          id: `lh.${form}.${key}`,
          title: `Lighthouse ${name} (${form}) ≥ 90`,
          category: CAT,
          level: s >= 90 ? 'pass' : s >= 70 ? 'warn' : 'fail',
          message: `${s}/100`,
          metric: s,
          durationMs: duration,
        });
      }

      // Core Web Vitals
      const lcp = lhr.audits['largest-contentful-paint']?.numericValue;
      const cls = lhr.audits['cumulative-layout-shift']?.numericValue;
      const tbt = lhr.audits['total-blocking-time']?.numericValue;
      const fcp = lhr.audits['first-contentful-paint']?.numericValue;
      const si = lhr.audits['speed-index']?.numericValue;

      emit({ id: `lh.${form}.lcp`, title: `LCP (${form}) < 2500ms`, category: CAT,
        level: lcp < 2500 ? 'pass' : lcp < 4000 ? 'warn' : 'fail',
        message: `${Math.round(lcp)} ms`, metric: lcp });
      emit({ id: `lh.${form}.cls`, title: `CLS (${form}) < 0.1`, category: CAT,
        level: cls < 0.1 ? 'pass' : cls < 0.25 ? 'warn' : 'fail',
        message: cls.toFixed(3), metric: cls });
      emit({ id: `lh.${form}.tbt`, title: `Total Blocking Time (${form}) < 200ms`, category: CAT,
        level: tbt < 200 ? 'pass' : tbt < 600 ? 'warn' : 'fail',
        message: `${Math.round(tbt)} ms`, metric: tbt });
      emit({ id: `lh.${form}.fcp`, title: `FCP (${form}) < 1800ms`, category: CAT,
        level: fcp < 1800 ? 'pass' : fcp < 3000 ? 'warn' : 'fail',
        message: `${Math.round(fcp)} ms`, metric: fcp });
      emit({ id: `lh.${form}.si`, title: `Speed Index (${form}) < 3400ms`, category: CAT,
        level: si < 3400 ? 'pass' : si < 5800 ? 'warn' : 'fail',
        message: `${Math.round(si)} ms`, metric: si });

      // Top opportunities
      const opps = Object.values(lhr.audits)
        .filter(a => a.details?.type === 'opportunity' && a.numericValue > 100)
        .sort((a, b) => b.numericValue - a.numericValue)
        .slice(0, 5)
        .map(a => ({ id: a.id, title: a.title, savings: `${Math.round(a.numericValue)}ms` }));
      if (opps.length) {
        emit({
          id: `lh.${form}.opportunities`,
          title: `Lighthouse top-opportunities (${form})`,
          category: CAT,
          level: 'warn',
          message: opps.map(o => `${o.title} — ${o.savings}`).join(' · '),
          detail: opps,
        });
      }
    } catch (e) {
      emit({ id: `lh.${form}.error`, title: `Lighthouse ${form} run`, category: CAT, level: 'fail', message: e.message });
    }
  }
}

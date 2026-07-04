// axe-core WCAG AA scan via Playwright
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const CAT = 'A11y';

export async function run({ targetLocal, targetProd, emit }) {
  const target = targetLocal || targetProd;
  if (!target) return;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ locale: 'nl-NL' });
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    const dur = Date.now() - t0;

    // Aggregate by impact
    const violations = results.violations || [];
    const critical = violations.filter(v => v.impact === 'critical');
    const serious = violations.filter(v => v.impact === 'serious');
    const moderate = violations.filter(v => v.impact === 'moderate');
    const minor = violations.filter(v => v.impact === 'minor');

    emit({
      id: 'a11y.summary',
      title: `axe-core scan: ${violations.length} violations`,
      category: CAT,
      level: critical.length === 0 && serious.length === 0 ? (violations.length === 0 ? 'pass' : 'warn') : 'fail',
      message: `Critical: ${critical.length}, Serious: ${serious.length}, Moderate: ${moderate.length}, Minor: ${minor.length}`,
      metric: violations.length,
      durationMs: dur,
    });

    // Specific rules of interest
    const ruleChecks = {
      'color-contrast': 'Kleurcontrast WCAG AA (≥ 4.5:1)',
      'image-alt': 'Alle images hebben alt',
      'label': 'Form inputs hebben label',
      'link-name': 'Alle links hebben tekst',
      'button-name': 'Alle buttons hebben tekst',
      'html-has-lang': 'HTML lang attribute',
      'landmark-one-main': 'Pagina heeft één <main>',
      'page-has-heading-one': 'Pagina heeft een h1',
      'region': 'Inhoud zit binnen landmarks',
      'heading-order': 'Heading hierarchie',
      'meta-viewport': 'Viewport meta zonder user-scalable=no',
    };

    for (const [rule, title] of Object.entries(ruleChecks)) {
      const violated = violations.find(v => v.id === rule);
      const passed = results.passes?.find(p => p.id === rule);
      const incomplete = results.incomplete?.find(i => i.id === rule);
      if (violated) {
        emit({
          id: `a11y.${rule}`,
          title,
          category: CAT,
          level: violated.impact === 'critical' || violated.impact === 'serious' ? 'fail' : 'warn',
          message: `${violated.nodes.length} element(en): ${violated.help}`,
          detail: violated.nodes.slice(0, 5).map(n => ({ html: n.html.slice(0, 200), target: n.target, failure: n.failureSummary })),
        });
      } else if (passed) {
        emit({ id: `a11y.${rule}`, title, category: CAT, level: 'pass', message: `${passed.nodes.length} element(en) OK` });
      } else if (incomplete) {
        emit({ id: `a11y.${rule}`, title, category: CAT, level: 'warn', message: 'Handmatige verificatie nodig' });
      }
    }

    // Reduced motion check (CSS scan since axe doesn't cover this)
    const reducedMotion = await page.evaluate(() => {
      const sheets = [...document.styleSheets];
      let found = false;
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.media && /prefers-reduced-motion/.test(rule.media.mediaText)) {
              found = true; break;
            }
          }
        } catch {}
        if (found) break;
      }
      return found;
    });
    emit({
      id: 'a11y.reducedMotion',
      title: '@media (prefers-reduced-motion) ondersteund',
      category: CAT,
      level: reducedMotion ? 'pass' : 'warn',
      message: reducedMotion ? 'Aanwezig' : 'Geen @media rule gevonden',
    });

    // Focus-visible check
    const focusVisible = await page.evaluate(() => {
      const sheets = [...document.styleSheets];
      let found = false;
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.cssText && /:focus(-visible)?\b/.test(rule.cssText) && /(outline|box-shadow|border)/.test(rule.cssText)) {
              found = true; break;
            }
          }
        } catch {}
        if (found) break;
      }
      return found;
    });
    emit({
      id: 'a11y.focusVisible',
      title: ':focus / :focus-visible styling aanwezig',
      category: CAT,
      level: focusVisible ? 'pass' : 'warn',
      message: focusVisible ? 'CSS gevonden' : 'Geen focus-styling gevonden',
    });

    await browser.close();
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    emit({ id: 'a11y.error', title: 'axe-core scan', category: CAT, level: 'fail', message: e.message });
  }
}

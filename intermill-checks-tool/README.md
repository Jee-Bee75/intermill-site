# Deploy checks — InterMill

Geautomatiseerde deploy-readiness checks die live in het dashboard gestreamd worden.

## Architectuur

```
intermill-site/
├── index.html              ← de site
├── deploy-dashboard.html   ← frontend (auto fetch naar :5174)
└── checks/
    ├── server.js           ← Express + SSE
    ├── storage.js          ← sqlite (results.db)
    ├── runners/
    │   ├── static-html.js     ← Title, meta, h1, alt, OG, etc.
    │   ├── sitemap-jsonld.js  ← Sitemap.xml + JSON-LD + OG-image
    │   ├── http-headers.js    ← Security headers, cache, redirect chain
    │   ├── tls-dns.js         ← SSL cert + DNS records + SPF/DMARC
    │   ├── link-crawler.js    ← Broken links + image-formats
    │   ├── axe.js             ← WCAG AA via axe-core + Playwright
    │   ├── browser-tests.js   ← Cross-browser, mobile, cookies, tracking
    │   └── lighthouse.js      ← Lighthouse mobile + desktop
    └── results.db          ← historie (auto-created)
```

## Starten

```bash
# 1. Site preview (in aparte terminal)
cd ~/Desktop/intermill-site
python3 -m http.server 4173

# 2. Check-server
cd ~/Desktop/intermill-site/checks
npm start

# 3. Open dashboard
open http://localhost:4173/deploy-dashboard.html
```

## Wat doet elk runner

| Runner | Snelheid | Vereist productie-URL? | Output |
|---|---|---|---|
| `static-html` | <1s | Nee | 22 checks: title, meta, h1, alt, OG, lang, etc. |
| `sitemap-jsonld` | ~3s | Nee | Sitemap valide + alle URLs 200, JSON-LD parse, OG-image dims |
| `http-headers` | ~2s | **Ja** | HSTS, CSP, X-Frame-Options, X-Content-Type, Referrer-Policy, cache headers, redirect chain (4 varianten) |
| `tls-dns` | ~3s | **Ja** | TLS cert + expiry, DNS A/AAAA/CNAME/MX/TXT, SPF, DMARC |
| `link-crawler` | ~30s | Nee | BFS crawl tot 25 pages, broken internal + extern links, image-format coverage |
| `axe` | ~10s | Nee | WCAG AA scan (contrast, labels, landmarks, focus-visible, prefers-reduced-motion) |
| `browser-tests` | ~30s | Nee | Pageload in Chromium + Firefox (WebKit op recente macOS), iPhone 14 + Pixel 7, JS errors, tracking detection, cookies pre-consent, cookie consent banner |
| `lighthouse` | ~60s | Nee | Lighthouse mobile + desktop: Performance/SEO/A11y/Best-Practices, LCP/CLS/INP/TBT/FCP/SI, top opportunities |

**Quick run** (knop in dashboard) = alleen `fast: true` runners (~10s totaal).
**Run all** = alles parallel (max 3 tegelijk), ~2-3 min totaal.

## API

| Endpoint | Beschrijving |
|---|---|
| `GET /api/runners` | Lijst van beschikbare runners |
| `POST /api/run` | Start een run. Body: `{targetLocal, targetProd, runners}` → `{runId}` |
| `GET /api/stream/:runId` | Server-Sent Events: `result`, `runner`, `end` |
| `GET /api/runs` | Historie laatste 30 runs |
| `GET /api/runs/:id` | Alle results van een run |
| `GET /api/metrics/:checkId` | Tijdreeks van numerieke metrics (voor sparklines) |

## Result-formaat

Elke runner emit-t result-objecten met:
```js
{
  id: 'static.h1',
  title: 'Exact 1× <h1>',
  category: 'SEO',
  level: 'pass' | 'warn' | 'fail',
  message: '1× <h1>',
  metric: 1,        // optioneel — numeriek voor trends
  detail: {...},    // optioneel — uitgebreid object voor modal
  durationMs: 12    // optioneel
}
```

## Notes

- `webkit` werkt niet op macOS 12 (Monterey) of ouder — runner skipt gracieus.
- SQLite-file `results.db` bouwt historie op; verwijderen reset alles.
- Server cleanup: na 5 min cached in-memory state per run.
- CORS open voor `*` (alleen lokaal gebruik).

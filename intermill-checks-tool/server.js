// Express + SSE server — orchestreert alle runners
import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pLimit from 'p-limit';

import { createRun, finishRun, saveResult, listRuns, getRunResults, getMetricHistory, listAudit } from './storage.js';
import { listFixers, findFixersForCheck, preview as fixPreview, apply as fixApply, undo as fixUndo } from './fix-registry.js';

import * as staticHtml from './runners/static-html.js';
import * as httpHeaders from './runners/http-headers.js';
import * as tlsDns from './runners/tls-dns.js';
import * as linkCrawler from './runners/link-crawler.js';
import * as sitemapJsonld from './runners/sitemap-jsonld.js';
import * as lighthouseR from './runners/lighthouse.js';
import * as axeR from './runners/axe.js';
import * as browserTests from './runners/browser-tests.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNNERS = [
  { id: 'static-html',    name: 'Statische HTML',         mod: staticHtml,    fast: true },
  { id: 'sitemap-jsonld', name: 'Sitemap + JSON-LD + OG', mod: sitemapJsonld, fast: true },
  { id: 'http-headers',   name: 'HTTP / Security headers',mod: httpHeaders,   fast: true, prodOnly: true },
  { id: 'tls-dns',        name: 'TLS + DNS records',      mod: tlsDns,        fast: true, prodOnly: true },
  { id: 'link-crawler',   name: 'Broken links + image-formats', mod: linkCrawler, fast: false },
  { id: 'axe',            name: 'axe-core a11y',          mod: axeR,          fast: false },
  { id: 'browser-tests',  name: 'Cross-browser + cookies + tracking', mod: browserTests, fast: false },
  { id: 'lighthouse',     name: 'Lighthouse (mobile+desktop)', mod: lighthouseR, fast: false },
];

const runEvents = new Map(); // runId -> EventEmitter
const runState = new Map();  // runId -> { results: [], status, runners: {id: 'pending|running|done|error'} }

async function executeRun(runId, { targetLocal, targetProd, runnerIds }) {
  const ee = runEvents.get(runId);
  const state = runState.get(runId);
  const limit = pLimit(3); // parallel runners

  const wanted = RUNNERS.filter(r => !runnerIds || runnerIds.includes(r.id));
  wanted.forEach(r => state.runners[r.id] = 'pending');

  await Promise.all(wanted.map(runner => limit(async () => {
    if (runner.prodOnly && !targetProd) {
      state.runners[runner.id] = 'skipped';
      ee.emit('runner', { runner: runner.id, status: 'skipped', reason: 'Geen productie-URL' });
      return;
    }
    state.runners[runner.id] = 'running';
    ee.emit('runner', { runner: runner.id, status: 'running' });
    const t0 = Date.now();
    try {
      const emit = (result) => {
        const enriched = { ...result, runner: runner.id, runnerName: runner.name, _ts: Date.now() };
        state.results.push(enriched);
        try { saveResult(runId, runner.id, result); } catch (e) { console.error('save fail', e.message); }
        ee.emit('result', enriched);
      };
      await runner.mod.run({ targetLocal, targetProd, emit });
      state.runners[runner.id] = 'done';
      ee.emit('runner', { runner: runner.id, status: 'done', durationMs: Date.now() - t0 });
    } catch (e) {
      state.runners[runner.id] = 'error';
      ee.emit('runner', { runner: runner.id, status: 'error', error: e.message, stack: e.stack });
      console.error(`Runner ${runner.id} fout:`, e);
    }
  })));

  state.status = 'done';
  finishRun(runId, 'done');
  ee.emit('end', { runId, status: 'done', results: state.results.length });
  setTimeout(() => { runEvents.delete(runId); runState.delete(runId); }, 5 * 60 * 1000);
}

const PORT = process.env.PORT || 5174;

// Alleen de lokale dashboard-origin mag de API cross-origin aanroepen.
const ALLOWED_ORIGINS = [
  `http://localhost:4173`, `http://127.0.0.1:4173`,
  `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
];
// Host-headers die we accepteren — blokkeert DNS-rebinding (aanvaller-domein → 127.0.0.1).
const ALLOWED_HOSTS = new Set([
  `localhost:${PORT}`, `127.0.0.1:${PORT}`,
]);

// SSRF-rem: alleen http/https, en cloud-metadata / link-local adressen blokkeren.
function validateTarget(u) {
  if (u == null || u === '') return;
  let parsed;
  try { parsed = new URL(u); } catch { throw new Error(`Ongeldige URL: ${u}`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Alleen http/https-URLs toegestaan');
  }
  const h = parsed.hostname;
  if (h === '169.254.169.254' || h.startsWith('169.254.') || h === '[::ffff:169.254.169.254]') {
    throw new Error('Adres niet toegestaan (metadata/link-local)');
  }
}

const app = express();
app.disable('x-powered-by');

// Anti DNS-rebinding: weiger requests met een onbekende Host-header.
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(403).json({ error: 'Host niet toegestaan' });
  }
  next();
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get('/api/runners', (_req, res) => {
  res.json(RUNNERS.map(r => ({ id: r.id, name: r.name, prodOnly: !!r.prodOnly, fast: r.fast })));
});

app.post('/api/run', (req, res) => {
  const { targetLocal = 'http://localhost:4173/index.html', targetProd, runners } = req.body || {};
  try {
    validateTarget(targetLocal);
    validateTarget(targetProd);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const runId = createRun({ targetLocal, targetProd });
  const ee = new EventEmitter();
  ee.setMaxListeners(100);
  runEvents.set(String(runId), ee);
  runState.set(String(runId), { results: [], status: 'running', runners: {}, targetLocal, targetProd });

  executeRun(String(runId), { targetLocal, targetProd, runnerIds: runners });
  res.json({ runId: String(runId) });
});

app.get('/api/stream/:runId', (req, res) => {
  const runId = req.params.runId;
  const ee = runEvents.get(runId);
  const state = runState.get(runId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!ee) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'run not found' })}\n\n`);
    return res.end();
  }

  // Snapshot existing state
  res.write(`event: snapshot\ndata: ${JSON.stringify(state)}\n\n`);

  const sendResult = r => res.write(`event: result\ndata: ${JSON.stringify(r)}\n\n`);
  const sendRunner = r => res.write(`event: runner\ndata: ${JSON.stringify(r)}\n\n`);
  const sendEnd = r => { res.write(`event: end\ndata: ${JSON.stringify(r)}\n\n`); res.end(); };

  ee.on('result', sendResult);
  ee.on('runner', sendRunner);
  ee.on('end', sendEnd);

  const ping = setInterval(() => res.write(`:ping\n\n`), 15000);
  req.on('close', () => {
    clearInterval(ping);
    ee.off('result', sendResult);
    ee.off('runner', sendRunner);
    ee.off('end', sendEnd);
  });
});

app.get('/api/runs', (_req, res) => res.json(listRuns(30)));
app.get('/api/runs/:id', (req, res) => res.json(getRunResults(req.params.id)));
app.get('/api/metrics/:checkId', (req, res) => res.json(getMetricHistory(req.params.checkId)));

// ===== FIX endpoints =====
app.get('/api/fixers', (_req, res) => res.json(listFixers()));
app.get('/api/fixers/for/:checkId', (req, res) => res.json(findFixersForCheck(req.params.checkId)));

app.post('/api/fix/preview', async (req, res) => {
  try {
    const result = await fixPreview(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/fix/apply', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.confirm) return res.status(400).json({ error: 'confirm:true vereist' });
    const result = await fixApply(body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/fix/undo/:auditId', async (req, res) => {
  try {
    const result = await fixUndo(parseInt(req.params.auditId, 10));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/fix/log', (_req, res) => res.json(listAudit(100)));

// Static: alleen de eigen dashboard-map serveren, NIET de parent (voorheen
// werd de hele Website/-map gedeeld, incl. broncode, .bak-backups en results.db).
app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Deploy-checks server draait op http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:4173/deploy-dashboard.html (of via 5174)`);
  console.log(`Runners: ${RUNNERS.map(r => r.id).join(', ')}`);
});

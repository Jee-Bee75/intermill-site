// Central registry voor alle fixers + path safety + apply wrapper
import { readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPatch } from 'diff';
import { saveAudit, getAudit, markUndone } from './storage.js';

import * as htmlMeta from './fixers/html-meta.js';
import * as imgTransforms from './fixers/img-transforms.js';
import * as seoFiles from './fixers/seo-files.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Whitelist: alles schrijven binnen site-root
export const SITE_ROOT = resolve(__dirname, '..');

// Alle fixers verzamelen
const ALL_FIXERS = [
  ...htmlMeta.fixers,
  ...imgTransforms.fixers,
  ...seoFiles.fixers,
];

const RISK_LABELS = { low: '🟢 Low', medium: '🟡 Medium', high: '🟠 High', extreme: '🔴 Extreme' };

export function listFixers() {
  return ALL_FIXERS.map(f => ({
    id: f.id,
    title: f.title,
    description: f.description,
    risk: f.risk,
    riskLabel: RISK_LABELS[f.risk],
    checkIds: f.checkIds,
  }));
}

export function findFixersForCheck(checkId) {
  return ALL_FIXERS.filter(f => f.checkIds.includes(checkId));
}

function getFixer(id) {
  const f = ALL_FIXERS.find(x => x.id === id);
  if (!f) throw new Error(`Onbekende fixer: ${id}`);
  return f;
}

// SAFETY: pad moet binnen SITE_ROOT liggen + bestaan
export function assertSafePath(p) {
  const abs = resolve(p);
  const rel = relative(SITE_ROOT, abs);
  if (rel.startsWith('..') || resolve(SITE_ROOT, rel) !== abs) {
    throw new Error(`Pad buiten site-root: ${abs}`);
  }
  // node_modules + .git uitsluiten
  if (/(^|\/)(node_modules|\.git|results\.db)(\/|$)/.test(rel)) {
    throw new Error(`Pad in beschermde folder: ${rel}`);
  }
  return abs;
}

// PREVIEW — dry-run, geen file-wijzigingen
export async function preview({ fixerId, checkId, context = {} }) {
  const fixer = getFixer(fixerId);
  const ctx = { ...context, siteRoot: SITE_ROOT };
  const result = await fixer.dryRun(ctx);
  if (!result || result.skipped) {
    return { fixerId, risk: fixer.risk, skipped: true, reason: result?.reason || 'Niets te wijzigen' };
  }
  // Genereer unified diff voor tekst-edits
  let diff = null;
  if (typeof result.oldContent === 'string' && typeof result.newContent === 'string') {
    diff = createPatch(
      relative(SITE_ROOT, result.file),
      result.oldContent,
      result.newContent,
      'voor', 'na',
      { context: 3 }
    );
  }
  return {
    fixerId, checkId,
    risk: fixer.risk,
    riskLabel: RISK_LABELS[fixer.risk],
    title: fixer.title,
    description: fixer.description,
    file: result.file ? relative(SITE_ROOT, result.file) : null,
    diff,
    summary: result.summary || null,
    artifacts: result.artifacts || null,
  };
}

// APPLY — vereist confirm:true, maakt .bak, schrijft, logt audit
export async function apply({ fixerId, checkId, context = {}, confirm, riskAck }) {
  if (!confirm) throw new Error('confirm:true vereist');
  const fixer = getFixer(fixerId);
  if (['medium', 'high', 'extreme'].includes(fixer.risk) && !riskAck) {
    throw new Error(`Risk-ack vereist voor ${fixer.risk}-risico fixer`);
  }

  const ctx = { ...context, siteRoot: SITE_ROOT };
  let preview;
  try {
    preview = await fixer.dryRun(ctx);
  } catch (e) {
    const id = saveAudit({ fixerId, checkId, filePath: '(unknown)', risk: fixer.risk, status: 'error', error: e.message });
    throw new Error(`Dry-run faalde: ${e.message}`);
  }

  if (!preview || preview.skipped) {
    return { ok: true, skipped: true, reason: preview?.reason };
  }

  // Tekst-edit fixer: maak .bak, schrijf nieuwe content
  if (typeof preview.newContent === 'string' && preview.file) {
    const file = assertSafePath(preview.file);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${file}.bak.${ts}`;
    try {
      if (existsSync(file)) await copyFile(file, backupPath);
      await writeFile(file, preview.newContent, 'utf8');
      const diff = createPatch(relative(SITE_ROOT, file), preview.oldContent || '', preview.newContent, 'voor', 'na', { context: 3 });
      const auditId = saveAudit({
        fixerId, checkId, filePath: file, backupPath, risk: fixer.risk, diff, status: 'applied'
      });
      return { ok: true, auditId, file: relative(SITE_ROOT, file), backupPath: relative(SITE_ROOT, backupPath), summary: preview.summary };
    } catch (e) {
      saveAudit({ fixerId, checkId, filePath: file, risk: fixer.risk, status: 'error', error: e.message });
      throw e;
    }
  }

  // Asset/file-generator fixer: heeft eigen apply()
  if (typeof fixer.apply === 'function') {
    try {
      const out = await fixer.apply(ctx);
      const auditId = saveAudit({
        fixerId, checkId, filePath: out.file || preview.file || '(multi)', backupPath: out.backupPath || null,
        risk: fixer.risk, diff: out.summary || preview.summary || null, status: 'applied'
      });
      return { ok: true, auditId, ...out };
    } catch (e) {
      saveAudit({ fixerId, checkId, filePath: preview.file || '(unknown)', risk: fixer.risk, status: 'error', error: e.message });
      throw e;
    }
  }

  throw new Error(`Fixer ${fixerId} heeft geen apply() en geen newContent`);
}

// UNDO — restore .bak file
export async function undo(auditId) {
  const entry = getAudit(auditId);
  if (!entry) throw new Error('Audit entry niet gevonden');
  if (entry.undone_at) throw new Error('Al ongedaan gemaakt');
  if (entry.status !== 'applied') throw new Error('Niet in applied-state');
  if (!entry.backup_path) throw new Error('Geen backup beschikbaar');
  if (!existsSync(entry.backup_path)) throw new Error(`Backup ontbreekt: ${entry.backup_path}`);
  const file = assertSafePath(entry.file_path);
  await copyFile(entry.backup_path, file);
  markUndone(auditId);
  return { ok: true, file: relative(SITE_ROOT, file), restoredFrom: relative(SITE_ROOT, entry.backup_path) };
}

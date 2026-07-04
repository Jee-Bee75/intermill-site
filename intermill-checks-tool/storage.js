import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'results.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    target_local TEXT,
    target_prod TEXT,
    status TEXT
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    runner TEXT NOT NULL,
    check_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT,
    detail TEXT,
    metric_value REAL,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id);
  CREATE INDEX IF NOT EXISTS idx_results_check ON results(check_id);

  CREATE TABLE IF NOT EXISTS fix_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    fixer_id TEXT NOT NULL,
    check_id TEXT,
    file_path TEXT NOT NULL,
    backup_path TEXT,
    risk TEXT NOT NULL,
    diff TEXT,
    status TEXT NOT NULL,
    error TEXT,
    undone_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_audit_ts ON fix_audit(ts DESC);
`);

export function createRun({ targetLocal, targetProd }) {
  const info = db.prepare(`
    INSERT INTO runs (started_at, target_local, target_prod, status)
    VALUES (?, ?, ?, 'running')
  `).run(Date.now(), targetLocal, targetProd);
  return info.lastInsertRowid;
}

export function finishRun(runId, status = 'done') {
  db.prepare('UPDATE runs SET finished_at=?, status=? WHERE id=?')
    .run(Date.now(), status, runId);
}

export function saveResult(runId, runner, result) {
  db.prepare(`
    INSERT INTO results (run_id, runner, check_id, title, category, level, message, detail, metric_value, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    runner,
    result.id,
    result.title,
    result.category,
    result.level,
    result.message ?? null,
    result.detail ? JSON.stringify(result.detail) : null,
    typeof result.metric === 'number' ? result.metric : null,
    result.durationMs ?? null,
    Date.now()
  );
}

export function listRuns(limit = 30) {
  return db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM results WHERE run_id=r.id AND level='pass') AS pass,
      (SELECT COUNT(*) FROM results WHERE run_id=r.id AND level='fail') AS fail,
      (SELECT COUNT(*) FROM results WHERE run_id=r.id AND level='warn') AS warn,
      (SELECT COUNT(*) FROM results WHERE run_id=r.id) AS total
    FROM runs r ORDER BY r.started_at DESC LIMIT ?
  `).all(limit);
}

export function getRunResults(runId) {
  return db.prepare('SELECT * FROM results WHERE run_id=? ORDER BY id').all(runId);
}

export function getMetricHistory(checkId, limit = 30) {
  return db.prepare(`
    SELECT r.metric_value AS value, r.level, runs.started_at AS at
    FROM results r JOIN runs ON runs.id = r.run_id
    WHERE r.check_id=? AND r.metric_value IS NOT NULL
    ORDER BY runs.started_at DESC LIMIT ?
  `).all(checkId, limit);
}

export function saveAudit(entry) {
  const info = db.prepare(`
    INSERT INTO fix_audit (ts, fixer_id, check_id, file_path, backup_path, risk, diff, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Date.now(),
    entry.fixerId,
    entry.checkId ?? null,
    entry.filePath,
    entry.backupPath ?? null,
    entry.risk,
    entry.diff ?? null,
    entry.status,
    entry.error ?? null
  );
  return info.lastInsertRowid;
}

export function listAudit(limit = 100) {
  return db.prepare('SELECT * FROM fix_audit ORDER BY ts DESC LIMIT ?').all(limit);
}

export function getAudit(id) {
  return db.prepare('SELECT * FROM fix_audit WHERE id=?').get(id);
}

export function markUndone(id) {
  db.prepare('UPDATE fix_audit SET undone_at=? WHERE id=?').run(Date.now(), id);
}

export default db;

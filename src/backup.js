import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resolvePath } from './config.js';
import { getDb } from './db.js';

function backupCfg() {
  return loadConfig().backup;
}

function dbPath() {
  return resolvePath(loadConfig().database.path);
}

function driveFolder() {
  return backupCfg().googleDriveFolder;
}

function checkpoint() {
  try {
    getDb().pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // ignore
  }
}

export function copyDb(dest) {
  const src = dbPath();
  if (!fs.existsSync(src)) return false;
  checkpoint();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

// Snapshot after a change — overwrites the "latest backup" in the Drive folder.
export function snapshot() {
  const cfg = backupCfg();
  if (!cfg.enabled || !cfg.snapshotAfterChange) return false;
  try {
    const ok = copyDb(path.join(driveFolder(), 'crypto_portfolio_backup.db'));
    if (ok) console.log('[backup] snapshot saved to Google Drive');
    return ok;
  } catch (err) {
    console.error('[backup] snapshot failed:', err.message);
    return false;
  }
}

// Nightly dated copy + prune old backups.
export function runNightly() {
  const cfg = backupCfg();
  if (!cfg.enabled) return false;
  try {
    const folder = driveFolder();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ok = copyDb(path.join(folder, `crypto_portfolio_${stamp}.db`));
    pruneOld(folder, cfg.keepDays || 30);
    return ok;
  } catch (err) {
    console.error('[backup] nightly failed:', err.message);
    return false;
  }
}

function pruneOld(folder, keepDays) {
  if (!fs.existsSync(folder)) return;
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  for (const f of fs.readdirSync(folder)) {
    if (!/^crypto_portfolio_\d{8}\.db$/.test(f)) continue;
    const fp = path.join(folder, f);
    const st = fs.statSync(fp);
    if (st.mtimeMs < cutoff) fs.unlinkSync(fp);
  }
}

// On startup: if local DB is missing or corrupt, restore the newest Drive backup.
export function restoreIfNeeded() {
  const cfg = backupCfg();
  const local = dbPath();
  if (fs.existsSync(local)) {
    try {
      getDb().prepare('SELECT count(*) AS c FROM trades').get();
      return false;
    } catch {
      closeAndRemove(local);
    }
  }
  if (!cfg.enabled) return false;
  const folder = driveFolder();
  if (!fs.existsSync(folder)) return false;
  const backups = fs
    .readdirSync(folder)
    .filter((f) => /^crypto_portfolio_(\d{8}|backup)\.db$/.test(f))
    .map((f) => path.join(folder, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!backups.length) return false;
  fs.mkdirSync(path.dirname(local), { recursive: true });
  fs.copyFileSync(backups[0], local);
  console.log(`[backup] restored ${path.basename(backups[0])}`);
  return true;
}

function closeAndRemove(p) {
  // best-effort: remove the corrupt file
  try {
    fs.rmSync(p, { force: true });
    fs.rmSync(p + '-wal', { force: true });
    fs.rmSync(p + '-shm', { force: true });
  } catch {
    // ignore
  }
}

// Schedule nightly backup using configured time "HH:MM".
export function scheduleNightly() {
  const cfg = backupCfg();
  const [h, m] = (cfg.nightlyTime || '02:00').split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  setTimeout(() => {
    runNightly();
    scheduleNightly();
  }, delay);
  console.log(`[backup] next nightly backup at ${next.toLocaleString()}`);
}

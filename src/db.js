import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resolvePath } from './config.js';

let db = null;

export function getDb() {
  if (db) return db;
  const cfg = loadConfig();
  const dbPath = resolvePath(cfg.database.path);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_value REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      symbol TEXT PRIMARY KEY,
      name TEXT,
      type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('core','meme','stable','other')),
      profit_target_pct REAL,
      trailing_stop_pct REAL,
      stop_loss_pct REAL,
      alerts_enabled INTEGER NOT NULL DEFAULT 1,
      watch INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS marketdata (
      symbol TEXT NOT NULL,
      ts INTEGER NOT NULL,
      price REAL NOT NULL,
      change_24h REAL,
      volume_24h REAL,
      PRIMARY KEY (symbol, ts)
    );

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      price REAL,
      target_price REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      notified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trailing_state (
      symbol TEXT PRIMARY KEY,
      high_price REAL NOT NULL,
      triggered INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export function setMeta(key, value) {
  const d = getDb();
  d.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, typeof value === 'string' ? value : JSON.stringify(value));
}

export function getMeta(key) {
  const d = getDb();
  const row = d.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  if (!row) return null;
  const v = row.value;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

// ---- Positions (computed from trades) ----

export function getPositions() {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT symbol,
              SUM(CASE WHEN side='BUY'  THEN quantity ELSE 0 END) AS boughtQty,
              SUM(CASE WHEN side='SELL' THEN quantity ELSE 0 END) AS soldQty,
              SUM(CASE WHEN side='BUY'  THEN total_value ELSE 0 END) AS spentUsd,
              SUM(CASE WHEN side='SELL' THEN total_value ELSE 0 END) AS receivedUsd
       FROM trades GROUP BY symbol`
    )
    .all();
  return rows
    .map((r) => {
      const qty = (r.boughtQty || 0) - (r.soldQty || 0);
      const avgBuy = r.boughtQty > 0 ? r.spentUsd / r.boughtQty : 0;
      return {
        symbol: r.symbol,
        qty,
        boughtQty: r.boughtQty,
        soldQty: r.soldQty,
        avgBuy,
        spentUsd: r.spentUsd,
        receivedUsd: r.receivedUsd,
        realizedPnl: r.receivedUsd - (r.soldQty * (r.boughtQty > 0 ? r.spentUsd / r.boughtQty : 0)),
      };
    })
    .filter((p) => p.qty > 0);
}

export function getAssets() {
  const d = getDb();
  return d.prepare('SELECT * FROM assets ORDER BY symbol').all();
}

export function upsertAsset(asset) {
  const d = getDb();
  d.prepare(
    `INSERT INTO assets (symbol, name, type, profit_target_pct, trailing_stop_pct, stop_loss_pct, alerts_enabled, watch)
     VALUES (@symbol, @name, @type, @profit_target_pct, @trailing_stop_pct, @stop_loss_pct, @alerts_enabled, @watch)
     ON CONFLICT(symbol) DO UPDATE SET
       name = COALESCE(excluded.name, assets.name),
       type = excluded.type,
       profit_target_pct = COALESCE(excluded.profit_target_pct, assets.profit_target_pct),
       trailing_stop_pct = COALESCE(excluded.trailing_stop_pct, assets.trailing_stop_pct),
       stop_loss_pct = COALESCE(excluded.stop_loss_pct, assets.stop_loss_pct),
       alerts_enabled = excluded.alerts_enabled,
       watch = excluded.watch`
  ).run(asset);
}

export function addTrade(trade) {
  const d = getDb();
  const info = d
    .prepare(
      `INSERT INTO trades (date, symbol, side, quantity, unit_price, total_value, notes)
       VALUES (@date, @symbol, @side, @quantity, @unit_price, @total_value, @notes)`
    )
    .run(trade);
  return info.lastInsertRowid;
}

export function updateTrade(id, trade) {
  const d = getDb();
  d.prepare(
    `UPDATE trades SET
       date = @date, symbol = @symbol, side = @side, quantity = @quantity,
       unit_price = @unit_price, total_value = @total_value, notes = @notes
     WHERE id = @id`
  ).run({ ...trade, id });
}

export function deleteTrade(id) {
  const d = getDb();
  d.prepare('DELETE FROM trades WHERE id = ?').run(id);
}

export function getTrades(symbol) {
  const d = getDb();
  if (symbol) {
    return d
      .prepare('SELECT * FROM trades WHERE symbol = ? ORDER BY date, id')
      .all(symbol);
  }
  return d.prepare('SELECT * FROM trades ORDER BY date, id').all();
}

export function logSignal(signal) {
  const d = getDb();
  const info = d
    .prepare(
      `INSERT INTO signals (symbol, type, severity, message, price, target_price, notified)
       VALUES (@symbol, @type, @severity, @message, @price, @target_price, @notified)`
    )
    .run(signal);
  return info.lastInsertRowid;
}

export function getRecentSignals(limit = 50) {
  const d = getDb();
  return d
    .prepare('SELECT * FROM signals ORDER BY id DESC LIMIT ?')
    .all(limit);
}

export function recordPrice(symbol, price, change24h, volume24h) {
  const d = getDb();
  const ts = Math.floor(Date.now() / 1000);
  d.prepare(
    `INSERT INTO marketdata (symbol, ts, price, change_24h, volume_24h)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(symbol, ts) DO UPDATE SET price = excluded.price`
  ).run(symbol, ts, price, change24h, volume24h);
  const cutoff = ts - 7 * 24 * 60 * 60;
  d.prepare('DELETE FROM marketdata WHERE ts < ?').run(cutoff);
}

export function getPriceHistory(symbol, hours = 24) {
  const d = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
  return d
    .prepare('SELECT ts, price FROM marketdata WHERE symbol = ? AND ts >= ? ORDER BY ts')
    .all(symbol, cutoff);
}

export function setTrailingState(symbol, highPrice) {
  const d = getDb();
  d.prepare(
    `INSERT INTO trailing_state (symbol, high_price, triggered)
     VALUES (?, ?, 0)
     ON CONFLICT(symbol) DO UPDATE SET high_price = excluded.high_price, triggered = 0`
  ).run(symbol, highPrice);
}

export function getTrailingState(symbol) {
  const d = getDb();
  return d.prepare('SELECT * FROM trailing_state WHERE symbol = ?').get(symbol) || null;
}

export function markTrailingTriggered(symbol) {
  const d = getDb();
  d.prepare('UPDATE trailing_state SET triggered = 1 WHERE symbol = ?').run(symbol);
}

export function close() {
  if (db) {
    db.close();
    db = null;
  }
}

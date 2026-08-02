import express from 'express';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { loadConfig, resolvePath } from './config.js';
import { getDb, getAssets, upsertAsset } from './db.js';
import { createRouter } from './routes.js';
import { notifier } from './alerts.js';
import { restoreIfNeeded, scheduleNightly, snapshot } from './backup.js';

const SEED_ASSETS = [
  { symbol: 'XRP', name: 'XRP', type: 'core' },
  { symbol: 'POL', name: 'Polygon', type: 'core' },
  { symbol: 'DOT', name: 'Polkadot', type: 'core' },
  { symbol: 'WLD', name: 'Worldcoin', type: 'core' },
  { symbol: 'ADA', name: 'Cardano', type: 'core' },
  { symbol: 'DOGE', name: 'Dogecoin', type: 'meme', profit_target_pct: 20, stop_loss_pct: 20, trailing_stop_pct: 15 },
  { symbol: 'USDT', name: 'Tether', type: 'stable' },
  { symbol: 'USDC', name: 'USD Coin', type: 'stable' },
  { symbol: 'BNB', name: 'BNB', type: 'other' },
];

function seedAssets() {
  const existing = getAssets();
  const known = new Set(existing.map((a) => a.symbol));
  for (const s of SEED_ASSETS) {
    if (known.has(s.symbol)) continue;
    upsertAsset({
      symbol: s.symbol,
      name: s.name,
      type: s.type,
      profit_target_pct: s.profit_target_pct ?? null,
      trailing_stop_pct: s.trailing_stop_pct ?? null,
      stop_loss_pct: s.stop_loss_pct ?? null,
      alerts_enabled: 1,
      watch: s.type === 'stable' || s.type === 'other' ? 0 : 1,
    });
  }
}

function main() {
  const cfg = loadConfig();
  getDb();
  restoreIfNeeded();
  seedAssets();

  const app = express();
  app.use(express.json());

  app.use('/api', createRouter());

  app.get('/', (req, res) =>
    res.json({ service: 'Crypto Income Assistant', api: '/api', dashboard: 'http://127.0.0.1:10065' })
  );

  const host = cfg.server.host;

  http.createServer(app).listen(cfg.server.port, host, () => {
    console.log(`Backend API  (HTTP) : http://${host}:${cfg.server.port}`);
    console.log(`Portfolio API:        http://${host}:${cfg.server.port}/api/portfolio`);
    console.log(`Scanner API:          http://${host}:${cfg.server.port}/api/scanner`);
    console.log(`Analysis API:         http://${host}:${cfg.server.port}/api/analysis/XRP`);
  });

  if (cfg.server.httpsEnabled) {
    const keyPath = resolvePath(cfg.server.httpsKey);
    const certPath = resolvePath(cfg.server.httpsCert);
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      const tls = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
      https.createServer(tls, app).listen(cfg.server.httpsPort, host, () => {
        console.log(`Backend API (HTTPS) : https://${host}:${cfg.server.httpsPort}`);
      });
    } else {
      console.log(`Backend API (HTTPS) : skipped - cert files not found (${cfg.server.httpsKey})`);
    }
  }

  if (cfg.scanner.enabled) {
    notifier.start(cfg.scanner.scanIntervalSec);
  }
  if (cfg.backup.enabled) {
    scheduleNightly();
    snapshot();
  }
}

main();

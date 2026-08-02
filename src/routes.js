import express from 'express';
import { loadConfig } from './config.js';
import {
  getDb, getPositions, getAssets, getTrades, addTrade, updateTrade, deleteTrade,
  getRecentSignals, upsertAsset, getMeta, setMeta,
} from './db.js';
import { fetchAllPrices, fetchKlines } from './binance.js';
import { buildVerdict, scoreSignal } from './indicators.js';
import { getScanCache, scanWatchlist, refreshTopMovers, computeCandidates, evaluateSignals } from './scanner.js';
import { notifier } from './alerts.js';
import { snapshot } from './backup.js';

export function createRouter() {
  const router = express.Router();
  const cfg = loadConfig();

  // ---- Portfolio ----

  router.get('/portfolio', async (req, res) => {
    try {
      const positions = getPositions();
      const assets = new Map(getAssets().map((a) => [a.symbol, a]));

      const prices = await getLivePrices(positions.map((p) => p.symbol));

      const rows = positions.map((p) => {
        const asset = assets.get(p.symbol) || {};
        const price = prices[p.symbol] ?? null;
        const value = price != null ? p.qty * price : null;
        const pnlUsd = value != null ? value - p.spentUsd : null;
        const pnlPct = price != null && p.avgBuy > 0 ? ((price - p.avgBuy) / p.avgBuy) * 100 : null;
        const type = asset.type || 'other';
        const flags = [];
        if (pnlPct != null) {
          if (type === 'core' && pnlPct >= 0) flags.push('recovered');
          if (type === 'meme' && asset.profit_target_pct != null && pnlPct >= asset.profit_target_pct) flags.push('take-profit');
          if (type === 'meme' && pnlPct <= -20) flags.push('deep-loss');
          if (pnlPct >= 0) flags.push('profit');
        }
        return {
          symbol: p.symbol,
          type,
          name: asset.name || p.symbol,
          qty: p.qty,
          avgBuy: p.avgBuy,
          spentUsd: p.spentUsd,
          receivedUsd: p.receivedUsd,
          realizedPnl: p.realizedPnl,
          price,
          value,
          pnlUsd,
          pnlPct,
          breakEven: p.avgBuy,
          profitTargetPct: asset.profit_target_pct ?? null,
          trailingStopPct: asset.trailing_stop_pct ?? cfg.alerts.trailingStopDefaultPct,
          alertsEnabled: asset.alerts_enabled ?? 1,
          flags,
        };
      });

      const totals = rows.reduce(
        (acc, r) => {
          acc.invested += r.spentUsd;
          if (r.value != null) acc.value += r.value;
          if (r.pnlUsd != null) acc.pnlUsd += r.pnlUsd;
          acc.realized += r.realizedPnl || 0;
          return acc;
        },
        { invested: 0, value: 0, pnlUsd: 0, realized: 0 }
      );
      totals.pnlPct = totals.invested > 0 ? (totals.pnlUsd / totals.invested) * 100 : 0;

      res.json({ rows, totals });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Scanner ----

  router.get('/scanner', (req, res) => {
    const cache = getScanCache();
    res.json({
      ts: cache.ts,
      verdicts: Object.values(cache.verdicts),
      positions: getPositions().map((p) => p.symbol),
    });
  });

  router.get('/scanner/top-movers', async (req, res) => {
    const movers = await refreshTopMovers();
    res.json({ movers, ts: getMeta('topMoversLastTs') });
  });

  router.get('/scanner/candidate-day', (req, res) => {
    const candidates = computeCandidates();
    res.json({ candidates, ts: Date.now() });
  });

  router.get('/signals', (req, res) => {
    res.json(getRecentSignals(100));
  });

  // ---- Trades ----

  router.get('/trades', (req, res) => {
    res.json(getTrades(req.query.symbol));
  });

  router.post('/trades', (req, res) => {
    const b = req.body || {};
    if (!b.date || !b.symbol || !b.side || b.quantity == null || b.unit_price == null) {
      return res.status(400).json({ error: 'date, symbol, side, quantity, unit_price are required' });
    }
    const side = b.side.toUpperCase();
    if (!['BUY', 'SELL'].includes(side)) {
      return res.status(400).json({ error: 'side must be BUY or SELL' });
    }
    const qty = parseFloat(b.quantity);
    const price = parseFloat(b.unit_price);
    if (!(qty > 0) || !(price >= 0)) return res.status(400).json({ error: 'invalid quantity or price' });
    const symbol = b.symbol.trim().toUpperCase();
    const id = addTrade({
      date: b.date,
      symbol,
      side,
      quantity: qty,
      unit_price: price,
      total_value: qty * price,
      notes: b.notes || '',
    });
    ensureAssetForSymbol(symbol);
    snapshot();
    res.status(201).json({ id });
  });

  router.put('/trades/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const existing = getDb().prepare('SELECT * FROM trades WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'trade not found' });
    const qty = b.quantity != null ? parseFloat(b.quantity) : existing.quantity;
    const price = b.unit_price != null ? parseFloat(b.unit_price) : existing.unit_price;
    const side = (b.side || existing.side).toUpperCase();
    if (!['BUY', 'SELL'].includes(side)) return res.status(400).json({ error: 'side must be BUY or SELL' });
    updateTrade(id, {
      date: b.date || existing.date,
      symbol: (b.symbol || existing.symbol).trim().toUpperCase(),
      side,
      quantity: qty,
      unit_price: price,
      total_value: qty * price,
      notes: b.notes != null ? b.notes : existing.notes,
    });
    snapshot();
    res.json({ ok: true });
  });

  router.delete('/trades/:id', (req, res) => {
    deleteTrade(parseInt(req.params.id, 10));
    snapshot();
    res.json({ ok: true });
  });

  // ---- Assets ----

  router.get('/assets', (req, res) => {
    const positions = new Map(getPositions().map((p) => [p.symbol, p]));
    res.json(getAssets().map((a) => ({ ...a, qty: positions.get(a.symbol)?.qty ?? 0 })));
  });

  router.put('/assets/:symbol', (req, res) => {
    const b = req.body || {};
    const symbol = req.params.symbol.toUpperCase();
    const existing = getDb().prepare('SELECT * FROM assets WHERE symbol = ?').get(symbol);
    if (!existing) return res.status(404).json({ error: 'asset not found' });
    upsertAsset({
      symbol,
      name: b.name ?? existing.name ?? symbol,
      type: b.type ?? existing.type,
      profit_target_pct: b.profit_target_pct != null ? parseFloat(b.profit_target_pct) : existing.profit_target_pct,
      trailing_stop_pct: b.trailing_stop_pct != null ? parseFloat(b.trailing_stop_pct) : existing.trailing_stop_pct,
      stop_loss_pct: b.stop_loss_pct != null ? parseFloat(b.stop_loss_pct) : existing.stop_loss_pct,
      alerts_enabled: b.alerts_enabled != null ? (b.alerts_enabled ? 1 : 0) : existing.alerts_enabled,
      watch: b.watch != null ? (b.watch ? 1 : 0) : existing.watch,
    });
    snapshot();
    res.json({ ok: true });
  });

  // ---- Analysis (for OpenCode) ----

  router.get('/analysis/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const candles = await fetchKlines(symbol, '1h', 200);
      const closes = candles.map((c) => c.close);
      const v = buildVerdict(symbol, candles, null);
      const asset = getDb().prepare('SELECT * FROM assets WHERE symbol = ?').get(symbol);
      const position = getPositions().find((p) => p.symbol === symbol) || null;
      const signals = asset ? evaluateSignals(asset, v, position) : [];
      const recentSignals = getDb()
        .prepare('SELECT * FROM signals WHERE symbol = ? ORDER BY id DESC LIMIT 10')
        .all(symbol);
      res.json({
        symbol,
        verdict: v.verdict,
        indicators: {
          trend: v.trend,
          rsi14: v.rsi,
          rsiLabel: v.rsiLabel,
          momentum4hPct: v.mom4h,
          momentum24hPct: v.mom24h,
          volumeSpike: v.volumeSpike,
          support: v.support,
          resistance: v.resistance,
          score: scoreSignal(closes, v.rsi, v.mom4h, v.volumeSpike),
        },
        position,
        asset: asset || null,
        activeSignals: signals.map((s) => ({ type: s.type, severity: s.severity, message: s.message })),
        recentSignals,
        candles: candles.slice(-60).map((c) => ({
          t: c.openTime,
          o: c.open,
          h: c.high,
          l: c.low,
          c: c.close,
          v: c.volume,
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Prices ----

  router.get('/prices', async (req, res) => {
    const prices = await fetchAllPrices();
    const requested = (req.query.symbols || '').split(',').filter(Boolean);
    if (requested.length) {
      const out = {};
      for (const s of requested) out[s] = prices[`${s}USDT`] ?? null;
      res.json(out);
    } else {
      res.json(prices);
    }
  });

  // ---- Server-Sent Events (browser toasts) ----

  router.get('/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('event: ready\ndata: {}\n\n');
    notifier.addClient(res);
    const hb = setInterval(() => res.write(': ping\n\n'), 30000);
    res.on('close', () => clearInterval(hb));
  });

  return router;
}

async function getLivePrices(symbols) {
  const cache = getScanCache();
  const prices = { ...cache.prices };
  const missing = [...new Set(symbols)].filter((s) => prices[s] == null && !['USDT', 'USDC'].includes(s));
  if (missing.length) {
    try {
      const all = await fetchAllPrices();
      for (const s of missing) prices[s] = all[`${s}USDT`] ?? null;
    } catch {
      // keep cache values on failure
    }
  }
  for (const s of symbols) {
    if (s === 'USDT' || s === 'USDC') prices[s] = 1.0;
  }
  return prices;
}

function ensureAssetForSymbol(symbol) {
  const existing = getDb().prepare('SELECT * FROM assets WHERE symbol = ?').get(symbol);
  if (existing) return;
  upsertAsset({
    symbol,
    name: symbol,
    type: 'meme',
    profit_target_pct: null,
    trailing_stop_pct: null,
    stop_loss_pct: null,
    alerts_enabled: 1,
    watch: 1,
  });
}

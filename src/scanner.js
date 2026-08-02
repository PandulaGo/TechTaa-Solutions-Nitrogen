import { loadConfig } from './config.js';
import { getDb, getAssets, getPositions, getMeta, setMeta, recordPrice } from './db.js';
import { fetchAllPrices, fetch24hAll, fetchKlines } from './binance.js';
import { buildVerdict, scoreSignal } from './indicators.js';

const scanCache = { ts: 0, verdicts: {}, prices: {}, tickers: {} };

export function isUsdtPair(symbol) {
  return symbol.endsWith('USDT');
}

// Scan watchlist assets: verdicts + price snapshots. Returns { verdicts, prices, tickers }.
export async function scanWatchlist() {
  const cfg = loadConfig();
  const assets = getAssets();
  const symbols = [...new Set(assets.filter((a) => a.watch === 1).map((a) => a.symbol))];

  const [prices, tickers] = await Promise.all([fetchAllPrices(), fetch24hAll()]);
  const tickerMap = {};
  for (const t of tickers) tickerMap[t.symbol] = t;

  const verdicts = [];
  for (const symbol of symbols) {
    try {
      const pair = `${symbol}USDT`;
      const candles = await fetchKlines(symbol, cfg.binance.candleInterval, cfg.binance.candleLimit);
      const ticker = tickerMap[pair] || null;
      const v = buildVerdict(symbol, candles, ticker);
      verdicts.push(v);
      scanCache.verdicts[symbol] = v;
      if (prices[pair] != null) {
        scanCache.prices[symbol] = prices[pair];
        recordPrice(symbol, prices[pair], ticker?.priceChangePercent ?? null, ticker?.quoteVolume ?? null);
      }
    } catch (err) {
      console.error(`[scanner] failed for ${symbol}:`, err.message);
    }
  }

  scanCache.ts = Date.now();
  scanCache.tickers = tickerMap;
  return { verdicts, prices: scanCache.prices, tickers: tickerMap, ts: scanCache.ts };
}

export async function refreshTopMovers() {
  const cfg = loadConfig().scanner;
  const last = getMeta('topMoversLastTs') || 0;
  if (Date.now() - last < cfg.topMoversRefreshMin * 60 * 1000) {
    return getMeta('topMovers') || [];
  }
  try {
    const tickers = await fetch24hAll();
    const usdt = tickers.filter(
      (t) => isUsdtPair(t.symbol) && t.quoteVolume >= cfg.topMoversMinVolumeUsdt
    );
    const movers = usdt
      .map((t) => ({
        symbol: t.symbol.replace(/USDT$/, ''),
        change24h: t.priceChangePercent,
        volumeUsdt: t.quoteVolume,
        price: t.lastPrice,
      }))
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, cfg.topMoversCount);

    setMeta('topMovers', movers);
    setMeta('topMoversLastTs', Date.now());
    return movers;
  } catch (err) {
    console.error('[scanner] top movers failed:', err.message);
    return [];
  }
}

// Pick strongest setups from watchlist verdicts + top movers.
export function computeCandidates() {
  const cfg = loadConfig().scanner;
  const positions = new Map(getPositions().map((p) => [p.symbol, p]));
  const pool = [];

  for (const [symbol, v] of Object.entries(scanCache.verdicts)) {
    pool.push({ symbol, v, score: v.score, held: positions.has(symbol) });
  }
  for (const m of getMeta('topMovers') || []) {
    if (!scanCache.verdicts[m.symbol]) {
      pool.push({
        symbol: m.symbol,
        v: { verdict: `${m.symbol}: 24h ${m.change24h >= 0 ? '+' : ''}${m.change24h.toFixed(1)}% — top mover`, score: scoreSignal(null, null, m.change24h, null), trend: m.change24h > 0 ? 'up' : 'down' },
        score: 0,
        held: positions.has(m.symbol),
      });
    }
  }

  const candidates = pool
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, cfg.candidateOfDayCount);

  setMeta('candidates', candidates.map((c) => ({ symbol: c.symbol, held: c.held, score: c.score, verdict: c.v.verdict })));
  return candidates.map((c) => ({ symbol: c.symbol, held: c.held, score: c.score, verdict: c.v.verdict }));
}

// Evaluate signals for one asset given its verdict + position. Returns signal objects.
export function evaluateSignals(asset, v, position) {
  const cfg = loadConfig();
  const sc = cfg.scanner;
  const al = cfg.alerts;
  const signals = [];
  if (!asset.alerts_enabled) return signals;
  const price = v.price;
  if (price == null) return signals;

  if (asset.type === 'meme' || asset.type === 'core') {
    if (
      asset.type === 'meme' &&
      v.mom4h != null &&
      v.mom4h >= sc.momentum4hPct &&
      v.volumeSpike != null &&
      v.volumeSpike >= sc.volumeSpikeMultiplier &&
      (v.rsi == null || (v.rsi >= 40 && v.rsi <= 70))
    ) {
      signals.push({
        type: 'BUY_CANDIDATE',
        severity: 'alert',
        message: `${asset.symbol} is pumping (${v.mom4h.toFixed(1)}% in 4h, volume ${v.volumeSpike.toFixed(1)}x). Short-term buy opportunity.`,
        price,
        target_price: price * 1.05,
      });
    }

    if (position && position.qty > 0) {
      const gainPct = ((price - position.avgBuy) / position.avgBuy) * 100;
      const targetPct = asset.profit_target_pct ?? sc.memeProfitTargetPct;
      if (asset.type === 'meme' && gainPct >= targetPct) {
        signals.push({
          type: 'TAKE_PROFIT',
          severity: 'alert',
          message: `${asset.symbol} is up ${gainPct.toFixed(1)}% above your average buy. Target ${targetPct}% reached — take profit now.`,
          price,
          target_price: position.avgBuy * (1 + targetPct / 100),
        });
      }
      if (asset.type === 'meme') {
        const slPct = asset.stop_loss_pct ?? sc.memeStopLossPct;
        if (gainPct <= -slPct) {
          signals.push({
            type: 'CUT_LOSS',
            severity: 'alert',
            message: `${asset.symbol} is down ${Math.abs(gainPct).toFixed(1)}% (stop loss ${slPct}%). Consider cutting losses.`,
            price,
          });
        }
      }
      if (asset.type === 'core' && price >= position.avgBuy) {
        signals.push({
          type: 'RECOVERED',
          severity: 'info',
          message: `${asset.symbol} reached your break-even price (${position.avgBuy.toFixed(4)}). You're back to even.`,
          price,
          target_price: position.avgBuy,
        });
      }
    }

    if (asset.type === 'meme' && position && position.qty > 0) {
      const tsPct = asset.trailing_stop_pct ?? al.trailingStopDefaultPct;
      const d = getDb();
      const state = d.prepare('SELECT * FROM trailing_state WHERE symbol = ?').get(asset.symbol);
      if (!state) {
        d.prepare(
          `INSERT INTO trailing_state (symbol, high_price, triggered) VALUES (?, ?, 0)`
        ).run(asset.symbol, price);
      } else if (!state.triggered) {
        if (price > state.high_price) {
          d.prepare('UPDATE trailing_state SET high_price = ? WHERE symbol = ?').run(price, asset.symbol);
        } else if (price <= state.high_price * (1 - tsPct / 100)) {
          d.prepare('UPDATE trailing_state SET triggered = 1 WHERE symbol = ?').run(asset.symbol);
          signals.push({
            type: 'TRAILING_STOP',
            severity: 'alert',
            message: `${asset.symbol} fell ${tsPct}% from its high of ${state.high_price.toFixed(4)}. Lock in gains now.`,
            price,
            target_price: state.high_price * (1 - tsPct / 100),
          });
        }
      }
    }

    if (v.rsi != null) {
      if (v.rsi >= sc.rsiOverbought) {
        signals.push({ type: 'OVERBOUGHT', severity: 'warning', message: `${asset.symbol} RSI ${v.rsi.toFixed(0)} — overbought, pullback likely.`, price });
      } else if (asset.type === 'meme' && v.rsi <= sc.rsiOversold) {
        signals.push({ type: 'OVERSOLD', severity: 'info', message: `${asset.symbol} RSI ${v.rsi.toFixed(0)} — oversold, watch for a bounce.`, price });
      }
    }
  }

  return signals;
}

export function getScanCache() {
  return scanCache;
}

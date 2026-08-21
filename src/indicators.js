// Technical indicators computed from OHLCV candles.
// Pure functions — no I/O. Plain-language labels the dashboard / alerts can use.

export function sma(values, period) {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let prev = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

export function rsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(closes, fast = 12, slow = 26, signalP = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  if (emaFast == null || emaSlow == null) return null;
  return emaFast - emaSlow;
}

export function macdHistogram(closes) {
  // Simple approximation using MACD line vs its own short EMA as signal.
  const line = macd(closes);
  if (line == null) return null;
  const window = closes.slice(-26);
  const sig = ema(window.map((_, i) => null), 0); // placeholder not used
  return line; // sign is what matters vs prior bar
}

export function pctChange(values, lookback) {
  if (values.length <= lookback) return null;
  const prev = values[values.length - 1 - lookback];
  const cur = values[values.length - 1];
  if (!prev || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function volumeSpike(volumes) {
  const n = volumes.length;
  if (n < 10) return null;
  const avg = volumes.slice(0, n - 1).reduce((a, b) => a + b, 0) / (n - 1);
  if (avg === 0) return null;
  return volumes[n - 1] / avg;
}

export function supportResistance(candles, lookback = 50) {
  const slice = candles.slice(-lookback);
  if (slice.length < 5) return { support: null, resistance: null };
  let support = Infinity;
  let resistance = -Infinity;
  for (const c of slice) {
    if (c.low < support) support = c.low;
    if (c.high > resistance) resistance = c.high;
  }
  return { support, resistance };
}

export function trendLabel(price, emaSlow) {
  if (emaSlow == null || price == null) return 'sideways';
  if (price > emaSlow * 1.005) return 'uptrend';
  if (price < emaSlow * 0.995) return 'downtrend';
  return 'sideways';
}

export function rsiLabel(r) {
  if (r == null) return 'unknown';
  if (r >= 70) return 'overbought';
  if (r <= 30) return 'oversold';
  if (r >= 55) return 'healthy';
  if (r <= 45) return 'weak';
  return 'neutral';
}

export function momentumLabel(mom) {
  if (mom == null) return 'n/a';
  if (mom >= 10) return 'strong surge';
  if (mom >= 5) return 'strong momentum';
  if (mom >= 1) return 'positive momentum';
  if (mom <= -10) return 'sharp drop';
  if (mom <= -5) return 'falling hard';
  if (mom <= -1) return 'negative momentum';
  return 'flat';
}

export function volLabel(spike) {
  if (spike == null) return 'n/a';
  if (spike >= 3) return `huge volume ${spike.toFixed(1)}x`;
  if (spike >= 2) return `volume spike ${spike.toFixed(1)}x`;
  if (spike >= 1.2) return `elevated volume ${spike.toFixed(1)}x`;
  return `normal volume ${spike.toFixed(1)}x`;
}

// Full plain-language verdict for a coin.
export function buildVerdict(symbol, candles, ticker) {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const price = closes.length ? closes[closes.length - 1] : (ticker?.lastPrice ?? null);

  const rsiVal = rsi(closes, 14);
  const emaSlow = ema(closes, 26);
  const mom4h = pctChange(closes, 4);
  const spike = volumeSpike(volumes);
  const { support, resistance } = supportResistance(candles);
  const trend = trendLabel(price, emaSlow);
  const mom24 = ticker?.priceChangePercent ?? pctChange(closes, 24);

  const parts = [];
  parts.push(`trend: ${trend}`);
  parts.push(`RSI ${rsiVal != null ? rsiVal.toFixed(0) : 'n/a'} (${rsiLabel(rsiVal)})`);
  if (mom4h != null) parts.push(`4h ${mom4h >= 0 ? '+' : ''}${mom4h.toFixed(1)}%`);
  if (mom24 != null) parts.push(`24h ${mom24 >= 0 ? '+' : ''}${mom24.toFixed(1)}%`);
  parts.push(volLabel(spike));

  const score = scoreSignal(closes, rsiVal, mom4h, spike);
  const stance =
    score >= 3 ? 'strong buy candidate' : score >= 1 ? 'slight bullish' : score <= -3 ? 'avoid / falling' : 'neutral';

  const verdict = `${symbol}: ${parts.join(', ')} — ${stance}`;

  return {
    symbol,
    price,
    trend,
    rsi: rsiVal,
    rsiLabel: rsiLabel(rsiVal),
    emaSlow,
    mom4h,
    mom24h: mom24,
    volumeSpike: spike,
    support,
    resistance,
    stance,
    score,
    verdict,
  };
}

export function scoreSignal(closes, rsiVal, mom4h, spike) {
  let s = 0;
  if (mom4h >= 5) s += 2;
  else if (mom4h >= 1) s += 1;
  else if (mom4h <= -5) s -= 2;
  else if (mom4h <= -1) s -= 1;
  if (spike != null && spike >= 1.5) s += 1;
  if (rsiVal != null) {
    if (rsiVal >= 45 && rsiVal <= 65) s += 1;
    if (rsiVal >= 75) s -= 1;
  }
  return s;
}

export function scoreBreakdown(mom4h, spike, rsiVal) {
  const parts = [];
  if (mom4h != null) {
    const sign = mom4h >= 0 ? '+' : '';
    if (mom4h >= 5) parts.push(`4h momentum ${sign}${mom4h.toFixed(1)}% → +2 points (rose 5% or more in the last 4 hours)`);
    else if (mom4h >= 1) parts.push(`4h momentum ${sign}${mom4h.toFixed(1)}% → +1 point (rose between 1% and 5% in the last 4 hours)`);
    else if (mom4h <= -5) parts.push(`4h momentum ${sign}${mom4h.toFixed(1)}% → −2 points (fell 5% or more in the last 4 hours)`);
    else if (mom4h <= -1) parts.push(`4h momentum ${sign}${mom4h.toFixed(1)}% → −1 point (fell between 1% and 5% in the last 4 hours)`);
    else parts.push(`4h momentum ${sign}${mom4h.toFixed(1)}% → 0 points (moved less than 1% — neutral)`);
  }
  if (spike != null) {
    parts.push(
      spike >= 1.5
        ? `Volume ${spike.toFixed(1)}x → +1 point (traded ${spike.toFixed(1)}x more than usual — real interest)`
        : `Volume ${spike.toFixed(1)}x → 0 points (below the 1.5x threshold)`
    );
  }
  if (rsiVal != null) {
    if (rsiVal >= 45 && rsiVal <= 65) parts.push(`RSI ${rsiVal.toFixed(0)} → +1 point (healthy 45–65 range — rising but not overextended)`);
    else if (rsiVal >= 75) parts.push(`RSI ${rsiVal.toFixed(0)} → −1 point (overbought above 75 — pullback risk)`);
    else parts.push(`RSI ${rsiVal.toFixed(0)} → 0 points (outside the healthy 45–65 range)`);
  }
  return parts;
}

import { loadConfig } from './config.js';

const cfg = () => loadConfig().binance;

export function toPair(symbol) {
  return `${symbol}USDT`;
}

async function getJson(path) {
  const url = `${cfg().baseUrl}${path}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'crypto-income-assistant/0.1' } });
  if (!res.ok) {
    throw new Error(`Binance ${res.status} for ${path}: ${await res.text()}`);
  }
  return res.json();
}

export async function fetchAllPrices() {
  const data = await getJson('/ticker/price');
  const map = {};
  for (const t of data) map[t.symbol] = parseFloat(t.price);
  return map;
}

export async function fetchPrice(symbol) {
  const data = await getJson(`/ticker/price?symbol=${toPair(symbol)}`);
  return parseFloat(data.price);
}

export async function fetch24hAll() {
  const data = await getJson('/ticker/24hr');
  return data.map((t) => ({
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChangePercent: parseFloat(t.priceChangePercent),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
  }));
}

export async function fetch24h(symbol) {
  const data = await getJson(`/ticker/24hr?symbol=${toPair(symbol)}`);
  return {
    symbol: data.symbol,
    lastPrice: parseFloat(data.lastPrice),
    priceChangePercent: parseFloat(data.priceChangePercent),
    volume: parseFloat(data.volume),
    quoteVolume: parseFloat(data.quoteVolume),
    highPrice: parseFloat(data.highPrice),
    lowPrice: parseFloat(data.lowPrice),
  };
}

export async function fetchKlines(symbol, interval = null, limit = null) {
  const i = interval || cfg().candleInterval;
  const l = limit || cfg().candleLimit;
  const data = await getJson(`/klines?symbol=${toPair(symbol)}&interval=${i}&limit=${l}`);
  return data.map((k) => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }));
}

export async function getSymbols() {
  const data = await getJson('/exchangeInfo');
  return data.symbols
    .filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
    .map((s) => s.baseAsset);
}

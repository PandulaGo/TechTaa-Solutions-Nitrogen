import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.join(__dirname, 'appsettings.json');

const DEFAULTS = {
  server: {
    host: '127.0.0.1',
    port: 10061,
    httpsPort: 10062,
    httpsEnabled: true,
    httpsKey: 'certs/key.pem',
    httpsCert: 'certs/cert.pem',
  },
  frontend: {
    host: '127.0.0.1',
    port: 10065,
    httpsPort: 10066,
    httpsEnabled: true,
    httpsKey: 'certs/key.pem',
    httpsCert: 'certs/cert.pem',
  },
  database: { path: 'data/crypto_portfolio.db' },
  binance: {
    baseUrl: 'https://api.binance.com/api/v3',
    pricePollSec: 60,
    candleInterval: '1h',
    candleLimit: 100,
    klineWindowHours: 8,
  },
  scanner: {
    enabled: true,
    scanIntervalSec: 60,
    topMoversCount: 20,
    topMoversRefreshMin: 60,
    topMoversMinVolumeUsdt: 500000,
    rsiOverbought: 70,
    rsiOversold: 30,
    volumeSpikeMultiplier: 1.5,
    momentum4hPct: 5.0,
    momentum24hPct: 8.0,
    memeStopLossPct: 20.0,
    memeProfitTargetPct: 20.0,
    candidateOfDayCount: 3,
  },
  alerts: {
    discordWebhookUrl: '',
    enableDiscord: true,
    enableBrowserToast: true,
    minMinutesBetweenAlerts: 30,
    trailingStopDefaultPct: 15.0,
  },
  backup: {
    enabled: true,
    googleDriveFolder: 'C:/Users/Pandula/Google Drive/CryptoApp',
    snapshotAfterChange: true,
    nightlyTime: '02:00',
    keepDays: 30,
  },
  watchlist: { defaults: [] },
};

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override)) {
    if (isObject(base[key]) && isObject(override[key])) {
      out[key] = deepMerge(base[key], override[key]);
    } else {
      out[key] = override[key];
    }
  }
  return out;
}

let cached = null;

export function loadConfig() {
  if (cached) return cached;
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `appsettings.json not found at ${CONFIG_PATH}. Copy appsettings.example.json to appsettings.json first.`
    );
  }
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  cached = deepMerge(DEFAULTS, raw);
  return cached;
}

export function configPath() {
  return CONFIG_PATH;
}

export function resolvePath(p) {
  if (path.isAbsolute(p)) return p;
  return path.resolve(__dirname, p);
}

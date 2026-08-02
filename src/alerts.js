import { loadConfig } from './config.js';
import { getAssets, getPositions, getMeta, setMeta, logSignal, getRecentSignals } from './db.js';
import { scanWatchlist, refreshTopMovers, computeCandidates, evaluateSignals } from './scanner.js';

const clients = new Set();
const fired = new Map(); // key "symbol:type" -> last fired timestamp

class Notifier {
  constructor() {
    this.running = false;
  }

  addClient(res) {
    clients.add(res);
    res.on('close', () => clients.delete(res));
  }

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch {
        clients.delete(res);
      }
    }
  }

  async sendDiscord(signal) {
    const cfg = loadConfig();
    const al = cfg.alerts;
    if (!al.enableDiscord || !al.discordWebhookUrl) return;

    const colors = { alert: 0xff5252, warning: 0xffb74d, info: 0x66bb6a };
    const emoji = { alert: '🔴', warning: '🟠', info: '🟢' };
    const embed = {
      title: `${emoji[signal.severity] || ''} ${signal.symbol} — ${signal.type.replace(/_/g, ' ')}`,
      description: signal.message,
      color: colors[signal.severity] || 0x888888,
      fields: [],
      timestamp: new Date().toISOString(),
    };
    if (signal.price != null) embed.fields.push({ name: 'Current price', value: signal.price.toFixed(6), inline: true });
    if (signal.target_price != null) embed.fields.push({ name: 'Target', value: signal.target_price.toFixed(6), inline: true });

    try {
      await fetch(al.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [embed],
        }),
      });
    } catch (err) {
      console.error('[alerts] discord send failed:', err.message);
    }
  }

  isCooledDown(key) {
    const cfg = loadConfig();
    const cooldownMs = cfg.alerts.minMinutesBetweenAlerts * 60 * 1000;
    const last = fired.get(key) || 0;
    return Date.now() - last < cooldownMs;
  }

  async processSignals(asset, signals) {
    for (const s of signals) {
      const key = `${asset.symbol}:${s.type}`;
      const infoOnly = s.severity === 'info';
      if (!infoOnly && this.isCooledDown(key)) continue;

      const id = logSignal({
        symbol: asset.symbol,
        type: s.type,
        severity: s.severity,
        message: s.message,
        price: s.price ?? null,
        target_price: s.target_price ?? null,
        notified: infoOnly ? 0 : 1,
      });
      fired.set(key, Date.now());
      this.broadcast('signal', { ...s, symbol: asset.symbol, id });
      await this.sendDiscord(s);
    }
  }

  async runCycle() {
    if (this.running) return;
    this.running = true;
    try {
      const assets = getAssets().filter((a) => a.watch === 1);
      const { verdicts } = await scanWatchlist();
      const positions = new Map(getPositions().map((p) => [p.symbol, p]));

      for (const asset of assets) {
        const v = verdicts.find((x) => x.symbol === asset.symbol);
        if (!v) continue;
        const position = positions.get(asset.symbol) || null;
        const signals = evaluateSignals(asset, v, position);
        await this.processSignals(asset, signals);
      }

      await refreshTopMovers();
      computeCandidates();
    } catch (err) {
      console.error('[alerts] cycle failed:', err.message);
    } finally {
      this.running = false;
    }
  }

  start(intervalSec) {
    const run = () => this.runCycle();
    run();
    return setInterval(run, intervalSec * 1000);
  }
}

export const notifier = new Notifier();
export { getRecentSignals, getMeta, setMeta };

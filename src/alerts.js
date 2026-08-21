import { loadConfig } from './config.js';
import { getAssets, getPositions, getMeta, setMeta, logSignal, getRecentSignals } from './db.js';
import { scanWatchlist, refreshTopMovers, computeCandidates, evaluateSignals } from './scanner.js';
import { explainSignal } from './explanations.js';
import { adviceField } from './planner.js';
import { askOpenCode, SYSTEM_PROMPT } from './consultant.js';

const clients = new Set();
const fired = new Map(); // key "symbol:type" -> last fired timestamp
const aiAskedAt = new Map(); // symbol -> last AI consultation timestamp
let aiSessionId = null; // persistent opencode session across alerts

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

  async sendDiscord(signal, position = null) {
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
    const advice = adviceField(signal, position);
    if (advice) embed.fields.push(advice);
    if (position?.qty != null) {
      embed.fields.push({ name: 'Qty', value: `${position.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${signal.symbol}`, inline: true });
      if (position.avgBuy != null) {
        embed.fields.push({ name: 'Avg buy', value: `$${position.avgBuy.toFixed(4)}`, inline: true });
      }
    }
    if (signal.price != null) embed.fields.push({ name: 'Current price', value: signal.price.toFixed(6), inline: true });
    if (signal.target_price != null) embed.fields.push({ name: 'Target', value: signal.target_price.toFixed(6), inline: true });
    if (al.includeExplanations) {
      const learn = explainSignal(signal);
      if (learn) embed.fields.push({ name: '📚 What this means', value: `\n${learn}` });
    }

    let msgId = null;
    try {
      const res = await fetch(al.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        msgId = body?.id ?? null;
      }
    } catch (err) {
      console.error('[alerts] discord send failed:', err.message);
    }

    if (msgId && cfg.consultant.aiInAlerts && cfg.consultant.enabled) {
      this.enrichWithAi(signal, position, msgId, embed).catch((err) =>
        console.error('[alerts] AI enrichment failed:', err.message)
      );
    }
  }

  async enrichWithAi(signal, position, msgId, embed) {
    const cfg = loadConfig();
    const cons = cfg.consultant;
    const key = signal.symbol;
    const cacheMs = cons.aiInAlertsCacheHours * 3600 * 1000;
    const last = aiAskedAt.get(key) || 0;
    if (Date.now() - last < cacheMs) return;
    aiAskedAt.set(key, Date.now());

    const buy = position?.avgBuy != null ? `$${position.avgBuy.toFixed(4)}` : 'unknown';
    const qty = position?.qty != null ? `${position.qty.toFixed(4)}` : 'unknown';
    const question =
      `My coin ${signal.symbol} just triggered a ${signal.type.replace(/_/g, ' ')} alert: "${signal.message}".\n` +
      `My average buy is ${buy}, I hold ${qty} ${signal.symbol}, current price $${(signal.price ?? 0).toFixed(4)}.\n` +
      `Should I sell or buy, and exactly how much (quantity + approx USD)? Explain the reasoning simply.`;

    const reply = await askOpenCode(question, { system: SYSTEM_PROMPT, session: aiSessionId });
    if (!reply || reply.startsWith('⚠️')) return;

    embed.fields.push({ name: '🤖 AI consultant', value: reply.slice(0, 1000) });
    try {
      await fetch(`${cfg.alerts.discordWebhookUrl}/messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    } catch (err) {
      console.error('[alerts] discord edit failed:', err.message);
    }
  }

  isCooledDown(key) {
    const cfg = loadConfig();
    const cooldownMs = cfg.alerts.minMinutesBetweenAlerts * 60 * 1000;
    const last = fired.get(key) || 0;
    return Date.now() - last < cooldownMs;
  }

  async processSignals(asset, signals, position = null) {
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
      await this.sendDiscord({ ...s, symbol: asset.symbol }, position);
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
        await this.processSignals(asset, signals, position);
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

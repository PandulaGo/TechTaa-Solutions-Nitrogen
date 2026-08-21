import { loadConfig } from './config.js';

const CUT_PCT = 50;
const PROFIT_PCT = 50;

const ACTION_EMOJI = { SELL: '🔴', BUY: '🟢', HOLD: '⏸️', WAIT: '⏳' };

function fmtUsd(n) {
  if (n == null) return null;
  return `$${n.toFixed(2)}`;
}

function fmtQty(n) {
  if (n == null) return null;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function amountText(sym, pct, qty, price) {
  const sellQty = qty != null ? qty * (pct / 100) : null;
  const usd = sellQty != null && price != null ? sellQty * price : null;
  const base = sellQty != null ? `${fmtQty(sellQty)} ${sym}` : `${pct}% of your ${sym}`;
  return usd != null ? `${base} (≈ ${fmtUsd(usd)})` : base;
}

// Rule-based "what to do" for one alert signal. Never blocks, never costs.
// Returns { action, text, reason } or null when there is no sensible advice.
export function planAction(signal, position = null) {
  const cfg = loadConfig();
  if (!cfg.consultant.enabled || !cfg.consultant.plannerInAlerts) return null;
  const sym = signal.symbol;
  const price = signal.price;
  const qty = position?.qty ?? null;

  switch (signal.type) {
    case 'CUT_LOSS': {
      const buy = signal.avgBuy != null ? `$${signal.avgBuy.toFixed(4)}` : null;
      const down = Math.abs(signal.gainPct ?? 0).toFixed(1);
      return {
        action: 'SELL',
        text: `SELL ${CUT_PCT}% = ${amountText(sym, CUT_PCT, qty, price)}`,
        reason: `Price is ${down}% below your buy${buy ? ` (${buy})` : ''} — far past your ${signal.slPct ?? '?'}% stop-loss. Sell half now to limit the damage; keep the rest only if you genuinely expect a rebound.`,
      };
    }
    case 'TAKE_PROFIT': {
      const buy = signal.avgBuy != null ? `$${signal.avgBuy.toFixed(4)}` : null;
      return {
        action: 'SELL',
        text: `SELL ${PROFIT_PCT}% = ${amountText(sym, PROFIT_PCT, qty, price)} — lock in the gain`,
        reason: `${sym} is ${(signal.gainPct ?? 0).toFixed(1)}% above your average buy${buy ? ` (${buy})` : ''}. Selling ${PROFIT_PCT}% now banks real profit; the rest can keep growing.`,
      };
    }
    case 'TRAILING_STOP': {
      const usd = qty != null && price != null ? qty * price : null;
      const base = qty != null ? `all ${fmtQty(qty)} ${sym}` : `all your ${sym}`;
      return {
        action: 'SELL',
        text: `SELL ${base}${usd != null ? ` (≈ ${fmtUsd(usd)})` : ''}`,
        reason: `The price fell ${signal.trailPct ?? '?'}% from its high of $${(signal.highPrice ?? 0).toFixed(4)} — your trailing stop just triggered. Sell now to protect the gains you already had.`,
      };
    }
    case 'BUY_CANDIDATE':
      return {
        action: 'BUY',
        text: 'optional small BUY (start with $5–10)',
        reason: `${sym} moved ${(signal.mom4h ?? 0).toFixed(1)}% in 4h with ${(signal.volumeSpike ?? 0).toFixed(1)}x volume — real interest, not noise. Still never a guarantee: start small and learn.`,
      };
    case 'OVERBOUGHT':
      return {
        action: 'HOLD',
        text: 'HOLD — do not buy now',
        reason: `RSI ${(signal.rsi ?? 0).toFixed(0)} means ${sym} rose too fast, so a pullback is likely. Do not chase. If you already hold it, wait — overbought alone is not a sell signal.`,
      };
    case 'OVERSOLD':
      return {
        action: 'WAIT',
        text: 'WAIT — watch for a bounce',
        reason: `RSI ${(signal.rsi ?? 0).toFixed(0)} means ${sym} fell hard. Wait for a confirmed recovery before buying — it can keep falling.`,
      };
    case 'RECOVERED': {
      const buy = signal.avgBuy != null ? `$${signal.avgBuy.toFixed(4)}` : null;
      return {
        action: 'HOLD',
        text: `HOLD — back at break-even (${buy ?? 'your buy price'})`,
        reason: `${sym} has climbed back to what you paid. You are no longer losing money. Hold, or sell at break-even to free up your cash.`,
      };
    }
    default:
      return null;
  }
}

export function adviceField(signal, position = null) {
  const plan = planAction(signal, position);
  if (!plan) return null;
  const emoji = ACTION_EMOJI[plan.action] || '💡';
  return { name: '💡 What to do', value: `\n**${emoji} ${plan.text}**\n${plan.reason}` };
}

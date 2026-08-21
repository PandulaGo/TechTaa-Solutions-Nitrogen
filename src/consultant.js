import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig } from './config.js';

export const SYSTEM_PROMPT = `You are a friendly crypto tutor for a total beginner who is learning.
You only ever discuss the user's OWN crypto portfolio (data provided below or via the local app).
Rules:
1. Answer in simple, plain English. Explain every term you use (RSI, stop loss, break-even, momentum, etc.).
2. When recommending an action, say clearly BUY or SELL (or HOLD/WAIT) and give an EXACT amount: how much of the coin (quantity), roughly how much in USD, and why.
3. Base advice on the current price and market data provided. Never invent prices or numbers not in the data.
4. If you are unsure, say so and explain what to watch for instead of guessing.
5. Always end with: "This is educational guidance, not financial advice. You decide and trade on Binance yourself."
Keep replies reasonably short (under ~250 words).`;

function resolveBinary() {
  const cfg = loadConfig().consultant;
  if (cfg.opencodePath && fs.existsSync(cfg.opencodePath)) return cfg.opencodePath;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(home, '.local', 'bin', 'opencode'),
    path.join(home, 'AppData', 'Local', 'OpenCode', 'opencode-cli.exe'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return 'opencode';
}

export function opencodeAvailable() {
  try {
    const cfg = loadConfig().consultant;
    if (!cfg.enabled) return false;
    return true;
  } catch {
    return false;
  }
}

function extractText(stdout, stderr, code) {
  const lines = String(stdout)
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  const texts = [];
  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      const part = ev?.part ?? ev?.part?.updated?.part ?? null;
      if (part?.type === 'text' && part.text) texts.push(part.text);
      else if (typeof ev?.text === 'string' && ev.text) texts.push(ev.text);
    } catch {
      // not JSON — ignore
    }
  }
  if (texts.length) return texts.join('\n').trim();
  const cleaned = String(stdout).trim();
  if (cleaned) return cleaned.slice(0, 4000);
  return `⚠️ opencode didn't reply (exit ${code}). ${String(stderr).trim().slice(0, 400)}`;
}

export async function askOpenCode(userText, opts = {}) {
  const cfg = loadConfig().consultant;
  const bin = resolveBinary();
  const args = ['run', '--format', 'json'];
  if (cfg.model) args.push('--model', cfg.model);
  if (opts.session) args.push('--session', opts.session);
  if (opts.continue) args.push('--continue');
  args.push(`${opts.system || SYSTEM_PROMPT}\n\n${userText}`);

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: process.cwd(),
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
    }, 120000);
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve(`⚠️ opencode could not be started: ${e.message}`);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(extractText(out, err, code));
    });
  });
}

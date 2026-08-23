# Crypto Income Assistant

A local, self-hosted crypto portfolio tracker and 24/7 market scanner with Discord alerts.

## Quick Start

```bash
# Install dependencies
npm install

# Full production start (builds web + launches both servers)
npm start

# Development (hot reload)
npm run dev
```

## Ports

| Service | HTTP | HTTPS |
|---|---|---|
| Backend API | 10061 | 10062 |
| Dashboard | 10065 | 10066 |

Open **http://127.0.0.1:10065** in your browser.

## What It Does

- **Tracks real Binance holdings** — imports trade history, calculates PnL, shows live prices
- **Scans markets every 60s** — RSI, volume spikes, momentum, breakouts
- **Sends Discord alerts** — with rule-based advice ("SELL 50%", "BUY $5-10", etc.)
- **Dashboard** — portfolio, scanner signals, trade log, settings
- **Sell simulator** — "What happens if I sell X%" with live formulas
- **Backup** — Google Drive copy, nightly schedule, restore on startup

## Configuration

Edit `src/appsettings.json`. See `docs/Architecture and Other Details.md` for all options.

Key settings:
- `alerts.discordWebhookUrl` — your Discord webhook URL
- `scanner.scanIntervalSec` — how often to scan (default 60s)
- `consultant.aiInAlerts` — enable AI verdicts (requires opencode-cli)

## Documentation

- [Architecture and Other Details.md](docs/Architecture%20and%20Other%20Details.md) — full system docs
- [Context Ledger.md](docs/Context%20Ledger.md) — session history, current status

## Tech Stack

Node.js 24+ / Express 4 / SQLite / React 18 / Vite 6

## License

Private — personal use only.

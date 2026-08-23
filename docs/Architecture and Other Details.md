# Unified System Architecture, Schema & API Blueprint

> **Generated:** 2026-08-19
> **Project:** Crypto Income Assistant
> **Codebase Root:** F:/GitHub/Nitrogen App

---

## 1. System Architecture Specification

### Executive Summary

- **Core Purpose:** A local, self-hosted crypto portfolio tracker and 24/7 market scanner that tracks real Binance holdings, scans for trading signals every 60 seconds, sends Discord alerts with rule-based advice, and exposes a React dashboard. No cloud infrastructure -- runs entirely on the user's machine for $0/month.
- **Target Audience:** A single end-user (the owner) who manually trades on Binance based on alerts and dashboard insights. Background services (scanner, backup) also operate autonomously.

### Component Blueprint & Tech Stack

Map out the technical dependencies detected in configuration files.

#### Frontend Layer

| Aspect | Technology |
|---|---|
| Framework | React 18.3.1 (functional components, hooks) |
| Language | JavaScript (JSX) |
| State Management | Local component state (useState, useEffect, useMemo, useRef) |
| Styling | Plain CSS (styles.css -- dark theme, CSS Grid, custom properties) |
| Build Tool | Vite 6.4.3 (@vitejs/plugin-react) |
| Production Serve | Express static file server (src/web/server.js) with API proxy |

#### Backend/API Layer

| Aspect | Technology |
|---|---|
| Runtime | Node.js 24+ / ES modules (type: module) |
| Routing Framework | Express 4.21.2 |
| Auth Mechanism | None (localhost-only, no authentication) |
| Entry Point | src/index.js (creates HTTP + HTTPS servers) |

#### Data Persistence Layer

| Aspect | Technology |
|---|---|
| Database Type | SQLite (file-based, WAL mode) |
| ORM/ODM Engine | better-sqlite3 v12.2.0 (synchronous, prepared statements) |
| Caching Layers | In-memory scanCache object (verdicts, prices, tickers); meta table for top movers and candidates |
| Database File | data/crypto_portfolio.db |

#### External Integrations

| Integration | Purpose |
|---|---|
| Binance REST API | Live prices (GET /api/v3/ticker/price), 24h stats (GET /api/v3/ticker/24hr), candlestick data (GET /api/v3/klines) |
| Discord Webhook | Alert delivery via POST to webhook URL with embed JSON |
| Google Drive | Backup copy to local Google Drive folder |
| OpenCode CLI | Optional AI verdicts (spawns opencode-cli.exe, off by default) |

### Data Flow & Communication Lifecycle

#### 1. Alert/Scan Flow (every 60s)

```
notifier.start(60)
  -> notifier.runCycle()
    -> scanWatchlist()
      -> Binance fetchAllPrices() + fetch24hAll() + fetchKlines()
      -> buildVerdict() per symbol (indicators.js: RSI, momentum, volume, support/resistance)
      -> recordPrice() into marketdata table
    -> refreshTopMovers() (every 60min from Binance 24hr ticker)
    -> computeCandidates() (score >= 2 from watchlist + top movers)
    -> evaluateSignals(asset, verdict, position) per watched asset
      -> CUT_LOSS, TAKE_PROFIT, TRAILING_STOP, BUY_CANDIDATE, OVERBOUGHT, OVERSOLD, RECOVERED
    -> processSignals(asset, signals, position)
      -> logSignal() into signals table
      -> broadcast('signal', data) to SSE clients (browser toasts)
      -> sendDiscord(signal, position)
        -> Build embed with: title, message, advice field, qty/avg buy, price, target, explanations
        -> POST to Discord webhook
        -> If aiInAlerts enabled: askOpenCode() -> PATCH webhook message with AI verdict
```

#### 2. Dashboard Read Flow (every 15s portfolio, 30s scanner)

```
Browser -> GET /api/portfolio (via frontend proxy /api)
  -> getPositions() (aggregates trades table: qty, avgBuy, spentUsd, receivedUsd, realizedPnl)
  -> getLivePrices() (from scanCache, fallback to Binance fetchAllPrices())
  -> Enriches with asset metadata (type, flags, profitTargetPct, trailingStopPct)
  -> Returns { rows: [...], totals: { invested, value, pnlUsd, pnlPct, realized } }

Browser -> GET /api/scanner
  -> getScanCache() (in-memory)
  -> Enriches each verdict with explainVerdict() if includeExplanations enabled
  -> Returns { ts, verdicts: [...], positions: [...] }
```

#### 3. Trade Recording Flow

```
User -> POST /api/trades (date, symbol, side, quantity, unit_price, notes)
  -> Validates fields, computes total_value = qty * price
  -> addTrade() into trades table
  -> ensureAssetForSymbol() creates asset record if missing
  -> snapshot() triggers backup
```

#### 4. Backup/Restore Flow

```
Startup:
  -> restoreIfNeeded() (copies latest backup to data/ if DB missing)

On trade change:
  -> snapshot() copies DB to Google Drive folder

Nightly (02:00):
  -> scheduleNightly() copies DB, prunes backups older than keepDays
```

### Project Structure

```
Nitrogen App/
  advice.ps1                          -- OpenCode AI advice entry point
  start-nitrogen.ahk                 -- AutoHotkey v2 startup script
  package.json                        -- Root workspace (npm workspaces)
  scripts/
    start.mjs                         -- Watchdog: spawns backend + frontend, restarts on crash
    backup.ps1                        -- Manual backup trigger
    import-excel.mjs                  -- Excel trade history importer
    install-autostart.ps1             -- Installs Startup folder shortcut
    run-nightly.mjs                   -- Nightly backup scheduler
  src/
    index.js                          -- Backend entry: Express, HTTP/HTTPS servers, seeds, scanner
    config.js                         -- Loads appsettings.json, resolves paths, deep-merge defaults
    appsettings.json                  -- Main config
    appsettings.example.json          -- Example config (committed to git)
    db.js                             -- SQLite schema, queries, trade/portfolio math
    routes.js                         -- /api/* endpoints
    scanner.js                        -- Market scanner: top movers, signal generation, candidates
    alerts.js                         -- Discord webhook alerts, browser SSE events, cooldown
    indicators.js                     -- Technical indicators (RSI, volume, momentum, scoreBreakdown)
    planner.js                        -- Rule-based advice: planAction, adviceField per alert type
    consultant.js                     -- OpenCode AI integration (opencode-cli, off by default)
    explanations.js                   -- Glossary + explainVerdict + explainCandidate
    backup.js                         -- Google Drive backup, nightly schedule, snapshot on change
    binance.js                        -- Binance REST API client
    certs/                            -- Self-signed TLS certs (key.pem, cert.pem)
    data/                             -- SQLite database file
    web/
      server.js                       -- Frontend static server + API proxy
      vite.config.js                  -- Vite build config
      index.html                      -- HTML shell with favicon link
      public/favicon.svg              -- Gold coin "N" favicon
      dist/                           -- Production build output
      src/
        main.jsx                      -- React mount point
        App.jsx                       -- Root component: tab/dashboard layout, SSE, polling
        styles.css                    -- Global styles
        components/                   -- 7 React components (see Frontend Layer above)
  logs/                               -- Watchdog log files (backend.log, frontend.log)
```

### Configuration

All in src/appsettings.json. Key sections:

| Section | Purpose | Key Settings |
|---|---|---|
| server | Backend ports, HTTPS | port: 10061, httpsPort: 10062, httpsEnabled: true |
| frontend | Frontend ports, HTTPS | port: 10065, httpsPort: 10066 |
| database | SQLite file | path: data/crypto_portfolio.db |
| binance | API base, poll interval | baseUrl, pricePollSec: 60, candleInterval: 1h, candleLimit: 100 |
| scanner | Scan interval, thresholds | scanIntervalSec: 60, rsiOverbought: 70, rsiOversold: 30, momentum4hPct: 5.0 |
| alerts | Discord, explanations | discordWebhookUrl, includeExplanations: true, minMinutesBetweenAlerts: 30 |
| consultant | AI verdicts toggle | aiInAlerts: false, plannerInAlerts: true, aiInAlertsCacheHours: 6 |
| backup | Google Drive, schedule | googleDriveFolder, nightlyTime: 02:00, keepDays: 30 |
| watchlist | Default coins | defaults: [XRP, POL, DOT, WLD, ADA, DOGE] |

### Running

```bash
npm start          # Full production (builds web + launches both servers)
npm run dev        # Development (hot reload)
npm run build:web  # Manual web build only
```

Watchdog (scripts/start.mjs) auto-restarts backend/frontend on crash with exponential backoff (3s if up 3s+, 10s if up less).

---

## 2. Database Schema & Data Models Matrix

> Schema defined in src/db.js migrate() function. SQLite with WAL mode and foreign keys ON.

### Entity: trades

| Attribute Name | Storage Data Type | Key / Modifiers | Logical Field Description |
|---|---|---|---|
| id | INTEGER | Primary Key / AUTOINCREMENT | Unique trade identifier |
| date | TEXT | NOT NULL | Trade date (user-provided, any format) |
| symbol | TEXT | NOT NULL | Coin ticker (e.g., XRP, BTC) |
| side | TEXT | NOT NULL / CHECK (BUY, SELL) | Trade direction |
| quantity | REAL | NOT NULL | Amount of coin traded |
| unit_price | REAL | NOT NULL | Price per unit at time of trade |
| total_value | REAL | NOT NULL | Computed: quantity * unit_price |
| notes | TEXT | Optional | User notes about the trade |
| created_at | TEXT | NOT NULL / DEFAULT datetime('now') | Audit timestamp |

### Entity: assets

| Attribute Name | Storage Data Type | Key / Modifiers | Logical Field Description |
|---|---|---|---|
| symbol | TEXT | Primary Key | Coin ticker (e.g., XRP, POL) |
| name | TEXT | Optional | Display name (e.g., "Polygon") |
| type | TEXT | NOT NULL / DEFAULT 'other' / CHECK (core, meme, stable, other) | Asset classification for signal logic |
| profit_target_pct | REAL | Optional | Custom profit target percentage |
| trailing_stop_pct | REAL | Optional | Custom trailing stop percentage |
| stop_loss_pct | REAL | Optional | Custom stop-loss percentage |
| alerts_enabled | INTEGER | NOT NULL / DEFAULT 1 | Whether to generate alerts for this coin |
| watch | INTEGER | NOT NULL / DEFAULT 1 | Whether to include in scanner watchlist |
| created_at | TEXT | NOT NULL / DEFAULT datetime('now') | Audit timestamp |

### Entity: marketdata

| Attribute Name | Storage Data Type | Key / Modifiers | Logical Field Description |
|---|---|---|---|
| symbol | TEXT | Composite PK (with ts) | Coin ticker |
| ts | INTEGER | Composite PK (with symbol) | Unix timestamp (seconds) |
| price | REAL | NOT NULL | Price at this timestamp |
| change_24h | REAL | Optional | 24h price change percentage |
| volume_24h | REAL | Optional | 24h quote volume in USDT |

> Auto-pruned: rows older than 7 days are deleted on each insert.

### Entity: signals

| Attribute Name | Storage Data Type | Key / Modifiers | Logical Field Description |
|---|---|---|---|
| id | INTEGER | Primary Key / AUTOINCREMENT | Unique signal identifier |
| symbol | TEXT | NOT NULL | Coin ticker |
| type | TEXT | NOT NULL | Signal type (CUT_LOSS, TAKE_PROFIT, TRAILING_STOP, BUY_CANDIDATE, OVERBOUGHT, OVERSOLD, RECOVERED) |
| severity | TEXT | NOT NULL / DEFAULT 'info' | alert, warning, or info |
| message | TEXT | NOT NULL | Human-readable alert message |
| price | REAL | Optional | Price at time of signal |
| target_price | REAL | Optional | Target price for the signal |
| created_at | TEXT | NOT NULL / DEFAULT datetime('now') | Audit timestamp |
| notified | INTEGER | NOT NULL / DEFAULT 0 | Whether Discord notification was sent |

### Entity: trailing_state

| Attribute Name | Storage Data Type | Key / Modifiers | Logical Field Description |
|---|---|---|---|
| symbol | TEXT | Primary Key | Coin ticker |
| high_price | REAL | NOT NULL | Highest price seen since trailing stop started |
| triggered | INTEGER | NOT NULL / DEFAULT 0 | Whether trailing stop has fired (1 = fired, prevents repeat) |

### Entity: meta

| Attribute Name | Storage Data Type | Key / Modifiers | Logical Field Description |
|---|---|---|---|
| key | TEXT | Primary Key | Setting key (e.g., "topMovers", "topMoversLastTs", "candidates") |
| value | TEXT | Optional | JSON-serialized value |

### Entity Relationships

- **trades** -> **assets** (logical, via symbol): Portfolio positions are computed from trades grouped by symbol. An asset record is auto-created when a trade is recorded for a new symbol (type defaults to 'meme').
- **signals** -> **assets** (logical, via symbol): Signals are generated per watched asset during scan cycles.
- **marketdata** -> **assets** (logical, via symbol): Price history snapshots per watched coin.
- **trailing_state** -> **assets** (logical, via symbol): Tracks high-water mark for trailing stop logic on meme coins.

### Computed Models (not stored, derived at query time)

**Position** (from getPositions()):
- symbol, qty (boughtQty - soldQty), avgBuy (spentUsd / boughtQty), spentUsd, receivedUsd, realizedPnl

**Portfolio Row** (from GET /api/portfolio):
- symbol, type, name, qty, avgBuy, spentUsd, receivedUsd, realizedPnl, price, value, pnlUsd, pnlPct, breakEven, profitTargetPct, trailingStopPct, alertsEnabled, flags[]

**Flags**: recovered (core + in profit), take-profit (meme + above target), deep-loss (meme + below -20%), profit (any + in profit)

---

## 3. RESTful API Endpoint Reference

### Service Context & Global Defaults

- **Local Base Path:** http://localhost:10061/api/v1 (mapped as /api in Express)
- **Frontend Proxy:** http://localhost:10065 proxies /api/* to backend (http-proxy-middleware)
- **Global Headers:** Content-Type: application/json
- **Authentication:** None (localhost-only)

---

### Route Catalog

#### [GET /api/portfolio]
- **Title:** Get Portfolio
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:** None
- **Success Response (200 OK):**
```json
{
  "rows": [
    {
      "symbol": "XRP",
      "type": "core",
      "name": "XRP",
      "qty": 25.067,
      "avgBuy": 2.8139,
      "spentUsd": 261.60,
      "receivedUsd": 211.26,
      "realizedPnl": 20.19,
      "price": 1.3859,
      "value": 34.74,
      "pnlUsd": -226.86,
      "pnlPct": -50.75,
      "breakEven": 2.8139,
      "profitTargetPct": null,
      "trailingStopPct": 15.0,
      "alertsEnabled": 1,
      "flags": []
    }
  ],
  "totals": {
    "invested": 629.81,
    "value": 235.72,
    "pnlUsd": -394.09,
    "pnlPct": -62.57,
    "realized": 23.94
  }
}
```
- **Error Response (500):**
```json
{ "error": "error message" }
```

#### [GET /api/scanner]
- **Title:** Get Scanner Verdicts
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:** None
- **Success Response (200 OK):**
```json
{
  "ts": 1692400000000,
  "verdicts": [
    {
      "symbol": "XRP",
      "verdict": "XRP: trending UP, RSI 55, momentum +3.2% in 4h",
      "price": 1.3859,
      "trend": "up",
      "rsi": 55,
      "score": 2,
      "explain": "XRP is showing upward momentum..."
    }
  ],
  "positions": ["XRP", "POL", "WLD"]
}
```

#### [GET /api/scanner/top-movers]
- **Title:** Get Top Movers (24h)
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:** None
- **Success Response (200 OK):**
```json
{
  "movers": [
    {
      "symbol": "PEPE",
      "change24h": 15.2,
      "volumeUsdt": 50000000,
      "price": 0.00001234
    }
  ],
  "ts": 1692400000000
}
```
- **Note:** Refreshes every 60 minutes (configurable via topMoversRefreshMin). Only includes pairs with volume >= topMoversMinVolumeUsdt.

#### [GET /api/scanner/candidate-day]
- **Title:** Get Candidate-of-the-Day
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:** None
- **Success Response (200 OK):**
```json
{
  "candidates": [
    {
      "symbol": "WLD",
      "held": true,
      "score": 3,
      "verdict": "WLD: RSI 45, momentum +6.1% in 4h, volume 2.1x",
      "trend": "up",
      "rsi": 45,
      "mom4h": 6.1,
      "mom24h": 8.3,
      "volumeSpike": 2.1,
      "price": 0.394,
      "scoreDetail": [
        { "label": "Momentum (4h)", "points": 1, "max": 1 },
        { "label": "Volume spike", "points": 1, "max": 1 },
        { "label": "RSI zone", "points": 1, "max": 1 }
      ],
      "explain": "WLD has strong momentum with rising volume..."
    }
  ],
  "ts": 1692400000000
}
```
- **Note:** Top 3 candidates with score >= 2 from watchlist + top movers. Includes scoreDetail breakdown when includeExplanations is true.

#### [GET /api/analysis/:symbol]
- **Title:** Detailed Analysis for One Coin
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:** None
- **Path Parameters:** symbol (e.g., XRP, BTC)
- **Success Response (200 OK):**
```json
{
  "symbol": "XRP",
  "verdict": "XRP: trending UP, RSI 55, momentum +3.2%",
  "indicators": {
    "trend": "up",
    "rsi14": 55,
    "rsiLabel": "neutral",
    "momentum4hPct": 3.2,
    "momentum24hPct": 5.1,
    "volumeSpike": 1.8,
    "support": 1.32,
    "resistance": 1.45,
    "score": 3
  },
  "position": { "symbol": "XRP", "qty": 25.067, "avgBuy": 2.8139, ... },
  "asset": { "symbol": "XRP", "type": "core", ... },
  "activeSignals": [{ "type": "OVERBOUGHT", "severity": "warning", "message": "..." }],
  "recentSignals": [],
  "candles": [{ "t": 1692400000000, "o": 1.38, "h": 1.39, "l": 1.37, "c": 1.3859, "v": 500000 }]
}
```
- **Note:** Returns last 60 hourly candles for charting. Fetches 200 candles from Binance but returns only 60.

#### [GET /api/signals]
- **Title:** Get Recent Signals
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:** None
- **Success Response (200 OK):**
```json
[
  {
    "id": 42,
    "symbol": "POL",
    "type": "CUT_LOSS",
    "severity": "alert",
    "message": "POL is down 61.7% (stop loss 20%). Consider cutting losses.",
    "price": 0.08889,
    "target_price": null,
    "created_at": "2026-08-19T10:30:00",
    "notified": 1
  }
]
```
- **Note:** Returns last 100 signals ordered by id DESC.

#### [GET /api/trades]
- **Title:** Get Trade History
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Query Parameters:** symbol (optional filter)
- **Request Body:** None
- **Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "date": "2024-01-15",
    "symbol": "XRP",
    "side": "BUY",
    "quantity": 100,
    "unit_price": 2.50,
    "total_value": 250.00,
    "notes": "Initial buy",
    "created_at": "2026-08-18T12:00:00"
  }
]
```

#### [POST /api/trades]
- **Title:** Record a Manual Trade
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:**
```json
{
  "date": "2026-08-19",
  "symbol": "XRP",
  "side": "BUY",
  "quantity": 50,
  "unit_price": 1.38,
  "notes": "optional notes"
}
```
- **Required Fields:** date, symbol, side (BUY or SELL), quantity (>0), unit_price (>=0)
- **Success Response (201 Created):**
```json
{ "id": 43 }
```
- **Error Response (400 Bad Request):**
```json
{ "error": "date, symbol, side, quantity, unit_price are required" }
```
- **Side Effects:** Auto-creates asset record if symbol is new. Triggers backup snapshot.

#### [PUT /api/trades/:id]
- **Title:** Update a Trade
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Path Parameters:** id (trade ID)
- **Request Body:** Any subset of { date, symbol, side, quantity, unit_price, notes } (missing fields keep existing values)
- **Success Response (200 OK):**
```json
{ "ok": true }
```
- **Error Response (404):**
```json
{ "error": "trade not found" }
```
- **Side Effects:** Triggers backup snapshot.

#### [DELETE /api/trades/:id]
- **Title:** Delete a Trade
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Path Parameters:** id (trade ID)
- **Success Response (200 OK):**
```json
{ "ok": true }
```
- **Side Effects:** Triggers backup snapshot.

#### [GET /api/assets]
- **Title:** Get All Asset Configurations
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Request Body:** None
- **Success Response (200 OK):**
```json
[
  {
    "symbol": "XRP",
    "name": "XRP",
    "type": "core",
    "profit_target_pct": null,
    "trailing_stop_pct": 15.0,
    "stop_loss_pct": null,
    "alerts_enabled": 1,
    "watch": 1,
    "created_at": "...",
    "qty": 25.067
  }
]
```
- **Note:** Each asset is enriched with current qty from computed positions.

#### [PUT /api/assets/:symbol]
- **Title:** Update Asset Configuration
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Path Parameters:** symbol (e.g., XRP)
- **Request Body:** Any subset of { name, type, profit_target_pct, trailing_stop_pct, stop_loss_pct, alerts_enabled, watch }
- **Success Response (200 OK):**
```json
{ "ok": true }
```
- **Side Effects:** Triggers backup snapshot.

#### [GET /api/events]
- **Title:** Server-Sent Events Stream (Browser Toasts)
- **Auth Level:** Public
- **Request Headers:** None required
- **Request Body:** None
- **Response:** text/event-stream
  - Initial event: `event: ready\ndata: {}\n\n`
  - Signal events: `event: signal\ndata: { symbol, type, severity, message, ... }\n\n`
  - Heartbeat: `: ping\n\n` every 30s
- **Note:** Client is automatically added to broadcast list. Cleaned up on connection close.

#### [GET /api/prices]
- **Title:** Get Live Prices
- **Auth Level:** Public
- **Request Headers:** Content-Type: application/json
- **Query Parameters:** symbols (optional, comma-separated, e.g., ?symbols=XRP,POL)
- **Request Body:** None
- **Success Response (200 OK):**
```json
{
  "XRPUSDT": 1.3859,
  "POLUSDT": 0.08889
}
```
- **Note:** If symbols param provided, returns only those. Otherwise returns all Binance USDT pair prices.

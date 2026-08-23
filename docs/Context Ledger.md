# Engineering Sprint & Session Ledger (Context Synchronization)

> **AI Instruction:** Act as the Context Continuity Agent. Compare the active workspace state against git history. Whenever a coding session ends or before switching machines, append a completed session block to the **top** of the Ledger section. Use this file as the primary source of truth to resume work across multiple computers.

---

## 1. Current Machine Context & Environment State

> **AI Instruction:** Update this section at the end of every session so the secondary machine can immediately sync and restore the exact runtime state.

* **Last Updated:** `2026-08-19 11:45 PM`
* **Active Computer / OS:** `Pandula PC (Windows 10/11)`
* **Git Branch:** `main`
* **Last Commit Hash:** `(not yet committed -- all changes in working tree)`
* **Uncommitted File Changes:**
  * `src/web/src/App.jsx` (Modified -- layout toggle, SellSimulator import)
  * `src/web/src/styles.css` (Modified -- .sim-*, .dash-*, .layout-dashboard styles)
  * `src/web/src/components/SellSimulator.jsx` (Created)
  * `src/web/index.html` (Modified -- favicon link)
  * `src/web/public/favicon.svg` (Created)
  * `src/web/src/components/SettingsPanel.jsx` (Modified)
  * `src/web/src/components/ScannerPanel.jsx` (Modified)
  * `src/web/src/components/PortfolioTable.jsx` (Modified)
  * `src/alerts.js` (Modified -- advice, qty/avg buy, explanations, AI enrichment)
  * `src/explanations.js` (Created)
  * `src/indicators.js` (Modified -- scoreBreakdown)
  * `src/planner.js` (Created)
  * `src/consultant.js` (Created)
  * `src/config.js` (Modified -- consultant section)
  * `src/appsettings.json` (Modified)
  * `src/appsettings.example.json` (Modified)
  * `docs/Architecture and Other Details.md` (Created)
  * `docs/Context Ledger.md` (Created)
  * `README.md` (Created)
* **Active Port / Local Services Running:**
  * Backend API: http://127.0.0.1:10061 (HTTP) / https://127.0.0.1:10062 (HTTPS)
  * Frontend Dashboard: http://127.0.0.1:10065 (HTTP) / https://127.0.0.1:10066 (HTTPS)
  * Both verified responding 200
* **Required Environment Variables / Flags:** None -- all config in appsettings.json. Binance public API (no keys needed). Discord webhook URL in config.

---

## 2. Session History Ledger

> **AI Instruction:** Always append new sessions at the **top** of this list directly below this header. Do not delete past entries.

### `[2026-08-19 11:45 PM]` - Session `7`: `Documentation Generation`

#### 1. Active Focus & Target Objective
* **Primary Objective:** Generate comprehensive project documentation following the Architecture and Other Details template and Context Ledger template.
* **Context Bridge:** User requested documentation to capture all context from the project after 6 prior development sessions.

#### 2. Comprehensive Changes & File Ledger
* **Files Modified / Created:**
  * `docs/Architecture and Other Details.md` (Created -- 3-section template: System Architecture, Database Schema, API Endpoints)
  * `docs/Context Ledger.md` (Created/Updated -- machine state + 7 session blocks)
  * `README.md` (Created -- quick start guide)
* **Structural & Logical Implementations:**
  * Documented all 6 SQLite entities with full attribute tables
  * Documented all 13 API endpoints with request/response contracts
  * Documented data flow diagrams for alert pipeline, dashboard read, trade recording, and backup/restore
  * Captured 7 session history blocks with file ledgers and handover state

#### 3. State Handover & Next Engineering Actions
* **Current Working State:** `Fully Functional -- all features working, docs generated`
* **Active Blockers / Unhandled Edge Cases:**
  * Android push notification delivery unconfirmed
  * opencode-cli AI path not verified (disabled by default)
  * All changes uncommitted to git
* **Exact Next Actions (For Machine Switch Handover):**
  1. Review docs/ for accuracy
  2. Commit all changes to git
  3. Verify frontend serves updated bundle on port 10065
* **Notes / Edge Cases Discovered:** None new this session.

---

### `[2026-08-19 10:30 PM]` - Session `6`: `Grid/Dashboard Layout Toggle`

#### 1. Active Focus & Target Objective
* **Primary Objective:** Add a frontend-switchable dashboard layout showing all 4 panels simultaneously on wide monitors, with auto-detection and toggle button.
* **Context Bridge:** User has a wide monitor and wanted to see everything at once without navigating tabs.

#### 2. Comprehensive Changes & File Ledger
* **Files Modified / Created:**
  * `src/web/src/App.jsx` (Modified -- layout state, getInitialLayout, toggleLayout, dashboard grid)
  * `src/web/src/styles.css` (Modified -- .layout-dashboard, .dash-grid, .dash-col, .dash-section)
* **Structural & Logical Implementations:**
  * `getInitialLayout()` reads localStorage, defaults to 'dashboard' if viewport >= 1500px
  * `toggleLayout()` flips between modes, persists to localStorage
  * Dashboard mode: 2-column CSS grid (drops to 1-col below 1200px)
  * Toggle button labeled "Grid" / "Tabs" in topbar nav

#### 3. State Handover & Next Engineering Actions
* **Current Working State:** `Fully Functional -- build verified`
* **Active Blockers / Unhandled Edge Cases:** None
* **Exact Next Actions (For Machine Switch Handover):**
  1. Build web: `npm run build --workspace crypto-dashboard`
  2. Verify port 10065 serves new bundle
* **Notes / Edge Cases Discovered:** Build size 170.94 kB JS, 8.58 kB CSS.

---

### `[2026-08-19 09:45 PM]` - Session `5`: `Sell Simulator`

#### 1. Active Focus & Target Objective
* **Primary Objective:** Create an interactive "What happens if I sell X%" calculator with live formulas.
* **Context Bridge:** User wanted to understand the math behind selling decisions.

#### 2. Comprehensive Changes & File Ledger
* **Files Modified / Created:**
  * `src/web/src/components/SellSimulator.jsx` (Created -- coin selector, sliders, formula display)
  * `src/web/src/App.jsx` (Modified -- import + render below Coin cards)
  * `src/web/src/styles.css` (Modified -- .sim-* block)
* **Structural & Logical Implementations:**
  * Coin selector defaults to biggest loss (min pnlPct)
  * Sell % slider + number input (0-100), break-even target slider
  * Future price scenario with quick buttons (-50%, -25%, current, +25%, +50%)
  * Every result shows live formula in monospace with actual numbers
  * Formulas: current loss %, sell qty, cash, realized loss, kept qty/value, after-sale total, overall %, break-even price, scenario

#### 3. State Handover & Next Engineering Actions
* **Current Working State:** `Fully Functional -- build verified`
* **Active Blockers / Unhandled Edge Cases:** None
* **Exact Next Actions (For Machine Switch Handover):**
  1. Build web: `npm run build --workspace crypto-dashboard`
* **Notes / Edge Cases Discovered:** Build size 169.83 kB JS, 8.30 kB CSS.

---

### `[2026-08-19 08:30 PM]` - Session `4`: `Dashboard Polish & Settings Help`

#### 1. Active Focus & Target Objective
* **Primary Objective:** Polish settings panel with help cards, add favicon, wrap SettingsPanel in fragment.
* **Context Bridge:** User wanted to understand what each setting does.

#### 2. Comprehensive Changes & File Ledger
* **Files Modified / Created:**
  * `src/web/src/components/SettingsPanel.jsx` (Modified -- fragment, help card)
  * `src/web/public/favicon.svg` (Created -- gold coin "N")
  * `src/web/index.html` (Modified -- favicon link)
  * `src/web/src/styles.css` (Modified -- .settings-help, .help-* styles)
* **Structural & Logical Implementations:**
  * Help card covers Profit target %, Trailing stop %, Stop loss % with examples
  * Favicon: gold (#fbbf24) coin with "N" letter

#### 3. State Handover & Next Engineering Actions
* **Current Working State:** `Fully Functional -- build verified`
* **Active Blockers / Unhandled Edge Cases:** None
* **Exact Next Actions (For Machine Switch Handover):**
  1. Build web: `npm run build --workspace crypto-dashboard`
* **Notes / Edge Cases Discovered:** Build size 6.66 kB CSS, 163.32 kB JS.

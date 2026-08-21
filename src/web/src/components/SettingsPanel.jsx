import React, { useState, useEffect, useCallback } from 'react';

const TYPES = ['core', 'meme', 'stable', 'other'];

export default function SettingsPanel() {
  const [assets, setAssets] = useState([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/assets');
    setAssets(await r.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(a) {
    try {
      const res = await fetch(`/api/assets/${a.symbol}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      setMsg(`Saved ${a.symbol}.`);
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    }
  }

  function patch(symbol, field, value) {
    setAssets((list) => list.map((a) => (a.symbol === symbol ? { ...a, [field]: value } : a)));
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Asset settings</h2>
          <span className="muted">controls which coins the scanner watches and how alerts behave</span>
        </div>
        {msg && <p>{msg}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Profit target %</th>
              <th>Trailing stop %</th>
              <th>Stop loss %</th>
              <th>Scan</th>
              <th>Alerts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.symbol}>
                <td className="strong">{a.symbol}</td>
                <td>
                  <select value={a.type} onChange={(e) => patch(a.symbol, 'type', e.target.value)}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td>{a.qty}</td>
                <td>
                  <input
                    type="number" step="any" className="num"
                    value={a.profit_target_pct ?? ''}
                    onChange={(e) => patch(a.symbol, 'profit_target_pct', e.target.value === '' ? null : parseFloat(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number" step="any" className="num"
                    value={a.trailing_stop_pct ?? ''}
                    onChange={(e) => patch(a.symbol, 'trailing_stop_pct', e.target.value === '' ? null : parseFloat(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number" step="any" className="num"
                    value={a.stop_loss_pct ?? ''}
                    onChange={(e) => patch(a.symbol, 'stop_loss_pct', e.target.value === '' ? null : parseFloat(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={a.watch === 1}
                    onChange={(e) => patch(a.symbol, 'watch', e.target.checked ? 1 : 0)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={a.alerts_enabled === 1}
                    onChange={(e) => patch(a.symbol, 'alerts_enabled', e.target.checked ? 1 : 0)}
                  />
                </td>
                <td>
                  <button className="btn small" onClick={() => save(assets.find((x) => x.symbol === a.symbol))}>
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Meme coins: BUY signals on momentum + volume, TAKE PROFIT at target %, TRAILING STOP follows price up, CUT LOSS at stop loss %.
        Core coins: alert when price returns to break-even (your real average cost).
      </p>
    </div>

    <div className="card">
      <div className="card-head">
        <h2>How these settings work</h2>
        <span className="muted">what each one does — in plain words</span>
      </div>
      <div className="settings-help">
        <div className="help-box">
          <div className="help-title">🎯 Profit target %</div>
          <div className="help-text">
            The gain you want before taking profit. When a coin rises this much <b>above your average buy price</b>, the app sends a{' '}
            <b>TAKE PROFIT</b> alert telling you to sell some and lock in the gain.
          </div>
          <div className="help-example">
            Example: you buy at $1.00 and set target 20% → the app warns you when the price reaches <b>$1.20</b>.
          </div>
        </div>
        <div className="help-box">
          <div className="help-title">🪝 Trailing stop %</div>
          <div className="help-text">
            A safety net that <b>follows the price up</b>. The app remembers the highest price your coin reached. If the price then falls
            this much below that high, it sends a <b>TRAILING STOP</b> alert — "sell now to protect the gains." It moves up with the price but never down.
          </div>
          <div className="help-example">
            Example: price climbs to $1.20, trailing stop 15% → sell alert if it drops to <b>$1.02</b>.
          </div>
        </div>
        <div className="help-box">
          <div className="help-title">🛑 Stop loss %</div>
          <div className="help-text">
            Your emergency brake. If the price falls this much <b>below your average buy price</b>, the app sends a <b>CUT LOSS</b> alert
            telling you to sell so the loss doesn't grow bigger.
          </div>
          <div className="help-example">
            Example: you buy at $1.00 and set stop loss 20% → the app warns you at <b>$0.80</b>.
          </div>
        </div>
      </div>
      <p className="muted small">
        These are <b>alerts and advice only</b> — the app never trades for you. You read the message, decide, and place the order on Binance yourself.
        Values here apply per coin; if a coin has no value, the app falls back to the defaults in <code>appsettings.json</code>.
      </p>
      </div>
    </>
  );
}

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
  );
}

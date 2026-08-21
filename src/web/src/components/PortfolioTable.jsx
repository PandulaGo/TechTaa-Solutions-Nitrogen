import React, { useState, useMemo } from 'react';

const fmt = (n, d = 2) =>
  n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

const TYPE_BADGE = { core: 'core', meme: 'meme', stable: 'stable', other: 'other' };

export default function PortfolioTable({ rows }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('pnl');

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== 'all') list = list.filter((r) => r.type === filter);
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'pnl':
          return (a.pnlPct ?? 0) - (b.pnlPct ?? 0);
        case 'value':
          return (b.value ?? 0) - (a.value ?? 0);
        case 'symbol':
          return a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });
    return sorted;
  }, [rows, filter, sort]);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Your positions</h2>
          <div className="controls">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="core">Core only</option>
              <option value="meme">Meme only</option>
              <option value="stable">Stablecoins</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="pnl">Sort: biggest loss</option>
              <option value="value">Sort: value</option>
              <option value="symbol">Sort: symbol</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Avg buy</th>
                <th>Price</th>
                <th>Value</th>
                <th>PnL $</th>
                <th>PnL %</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.symbol}>
                  <td className="strong">{r.symbol}</td>
                  <td>
                    <span className={`badge badge-${TYPE_BADGE[r.type] || 'other'}`}>{r.type}</span>
                  </td>
                  <td>{fmt(r.qty, 4)}</td>
                  <td>${fmt(r.avgBuy, 4)}</td>
                  <td>${fmt(r.price, 4)}</td>
                  <td>${fmt(r.value)}</td>
                  <td className={r.pnlUsd >= 0 ? 'pos' : 'neg'}>${fmt(r.pnlUsd)}</td>
                  <td className={r.pnlPct >= 0 ? 'pos' : 'neg'}>{fmt(r.pnlPct, 1)}%</td>
                  <td>
                    {r.flags.map((f) => (
                      <span key={f} className={`flag flag-${f}`}>
                        {f.replace(/-/g, ' ')}
                      </span>
                    ))}
                    {!r.flags.length && <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="muted">
                    No positions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Coin cards</h2>
          <span className="muted">live prices, buy price, quantity and value</span>
        </div>
        <div className="pcards">
          {filtered.map((r) => (
            <div key={r.symbol} className="pcard">
              <div className="pcard-head">
                <div className="pcard-title">
                  <span className="pcard-symbol">{r.symbol}</span>
                  <span className={`badge badge-${TYPE_BADGE[r.type] || 'other'}`}>{r.type}</span>
                  {r.flags.map((f) => (
                    <span key={f} className={`flag flag-${f}`}>
                      {f.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
                <span className={`pcard-pnl ${r.pnlPct >= 0 ? 'pos' : 'neg'}`}>
                  {fmt(r.pnlPct, 1)}%
                </span>
              </div>

              <div>
                <div className={`pcard-price ${r.pnlPct >= 0 ? 'pos' : 'neg'}`}>${fmt(r.price, 4)}</div>
                <div className="pcard-label">current price</div>
              </div>

              <div className="pcard-stats">
                <div className="pcard-stat">
                  <span className="pcard-label">Bought at</span>
                  <span className="pcard-val">${fmt(r.avgBuy, 4)}</span>
                </div>
                <div className="pcard-stat">
                  <span className="pcard-label">Quantity</span>
                  <span className="pcard-val">{fmt(r.qty, 4)}</span>
                </div>
                <div className="pcard-stat">
                  <span className="pcard-label">Total value</span>
                  <span className="pcard-val">${fmt(r.value)}</span>
                </div>
              </div>

              <div className="pcard-foot">
                <span className="pcard-label">Break-even</span>
                <span className={`pcard-foot-pnl ${r.pnlUsd >= 0 ? 'pos' : 'neg'}`}>
                  PnL {r.pnlUsd >= 0 ? '+' : '−'}${fmt(Math.abs(r.pnlUsd))}
                </span>
              </div>
            </div>
          ))}
          {!filtered.length && <div className="muted">No positions.</div>}
        </div>
      </div>
    </>
  );
}

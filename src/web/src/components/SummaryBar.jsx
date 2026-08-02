import React from 'react';

const fmt = (n, d = 2) =>
  n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export default function SummaryBar({ totals }) {
  if (!totals) return <div className="summary loading">Loading…</div>;
  const pnl = totals.pnlUsd ?? 0;
  const pnlPct = totals.pnlPct ?? 0;
  const cls = pnl >= 0 ? 'pos' : 'neg';
  return (
    <div className="summary">
      <div className="stat">
        <span className="label">Invested</span>
        <span className="value">${fmt(totals.invested)}</span>
      </div>
      <div className="stat">
        <span className="label">Current value</span>
        <span className="value">${fmt(totals.value)}</span>
      </div>
      <div className="stat">
        <span className="label">Unrealized P/L</span>
        <span className={`value ${cls}`}>
          ${fmt(pnl)} ({fmt(pnlPct, 1)}%)
        </span>
      </div>
      <div className="stat">
        <span className="label">Realized P/L</span>
        <span className={`value ${totals.realized >= 0 ? 'pos' : 'neg'}`}>${fmt(totals.realized)}</span>
      </div>
    </div>
  );
}

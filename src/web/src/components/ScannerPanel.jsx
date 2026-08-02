import React, { useState, useEffect } from 'react';

const stanceColor = (s) => {
  if (s === 'strong buy candidate') return '#22c55e';
  if (s === 'slight bullish') return '#84cc16';
  if (s === 'avoid / falling') return '#f87171';
  if (s === 'neutral') return '#94a3b8';
  return '#94a3b8';
};

export default function ScannerPanel({ scanner }) {
  const [movers, setMovers] = useState([]);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const [m, c] = await Promise.all([
          fetch('/api/scanner/top-movers').then((r) => r.json()),
          fetch('/api/scanner/candidate-day').then((r) => r.json()),
        ]);
        if (!stop) {
          setMovers(m.movers || []);
          setCandidates(c.candidates || []);
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 120000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const verdicts = scanner?.verdicts || [];

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-head">
          <h2>Scanner verdicts</h2>
          <span className="muted">
            {scanner ? `updated ${new Date(scanner.ts).toLocaleTimeString()}` : ''}
          </span>
        </div>
        {verdicts.map((v) => (
          <div key={v.symbol} className="verdict-row">
            <span
              className="dot"
              style={{ background: stanceColor(v.stance) }}
              title={v.stance}
            />
            <div>
              <div className="strong">
                {v.symbol}
                {v.rsiLabel === 'overbought' && <span className="flag flag-take-profit">overbought</span>}
                {v.rsiLabel === 'oversold' && <span className="flag flag-cut-loss">oversold</span>}
              </div>
              <div className="muted">{v.verdict}</div>
            </div>
          </div>
        ))}
        {!verdicts.length && <div className="muted">No scan data yet — the scanner runs every minute.</div>}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Candidate of the day</h2>
        </div>
        {candidates.map((c) => (
          <div key={c.symbol} className="candidate">
            <span className="strong">{c.symbol}</span>
            <span className="muted">{c.held ? 'held' : 'watch'}</span>
            <span className="score">score {c.score}</span>
            <div className="muted small">{c.verdict}</div>
          </div>
        ))}
        {!candidates.length && (
          <div className="muted">
            No strong setups right now. The scanner only flags when real momentum + volume appear.
          </div>
        )}
      </div>

      <div className="card span-2">
        <div className="card-head">
          <h2>Top movers (24h)</h2>
          <span className="muted">refreshed hourly</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>24h %</th>
                <th>Volume</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {movers.map((m) => (
                <tr key={m.symbol}>
                  <td className="strong">{m.symbol}</td>
                  <td className={m.change24h >= 0 ? 'pos' : 'neg'}>
                    {m.change24h >= 0 ? '+' : ''}
                    {m.change24h.toFixed(1)}%
                  </td>
                  <td>${(m.volumeUsdt / 1e6).toFixed(1)}M</td>
                  <td>${m.price.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

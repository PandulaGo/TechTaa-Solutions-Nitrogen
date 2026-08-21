import React, { useMemo, useState } from 'react';

const fmt = (n, d = 2) =>
  n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

const usd = (n, d = 2) => (n == null ? '—' : `$${fmt(n, d)}`);

function Row({ label, value, className, formula }) {
  return (
    <div className="sim-row">
      <div className="sim-row-top">
        <span className="sim-row-label">{label}</span>
        <span className={`sim-row-value ${className || ''}`}>{value}</span>
      </div>
      {formula && <div className="sim-formula">{formula}</div>}
    </div>
  );
}

export default function SellSimulator({ rows }) {
  const held = useMemo(
    () => rows.filter((r) => r.qty > 0 && r.price != null && r.avgBuy > 0),
    [rows]
  );
  const defaultSym = useMemo(() => {
    if (!held.length) return '';
    return held.reduce((worst, r) => (r.pnlPct < worst.pnlPct ? r : worst), held[0]).symbol;
  }, [held]);

  const [symbol, setSymbol] = useState('');
  const [sellPct, setSellPct] = useState(50);
  const [targetLoss, setTargetLoss] = useState(20);
  const [future, setFuture] = useState('');

  const sym = symbol || defaultSym;
  const coin = held.find((r) => r.symbol === sym);

  const setFutureFromMult = (m) => {
    if (coin) setFuture(fmt(coin.price * m, 8));
  };

  if (!coin) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>Sell simulator</h2>
          <span className="muted">what happens if you sell X%</span>
        </div>
        <div className="muted">No held positions with a live price.</div>
      </div>
    );
  }

  const qty = coin.qty;
  const avgBuy = coin.avgBuy;
  const price = coin.price;
  const invested = coin.spentUsd;

  const p = sellPct / 100;
  const sellQty = qty * p;
  const cash = sellQty * price;
  const realized = (price - avgBuy) * sellQty;
  const keptQty = qty - sellQty;
  const keptValue = keptQty * price;
  const keptLoss = (price - avgBuy) * keptQty;
  const afterTotal = cash + keptValue;
  const afterPct = invested > 0 ? ((afterTotal - invested) / invested) * 100 : null;
  const currentPct = (price - avgBuy) / avgBuy * 100;
  const breakEven = avgBuy * (1 - targetLoss / 100);

  const hasScenario = Number.isFinite(parseFloat(future)) && parseFloat(future) >= 0 && future !== '';
  const f = hasScenario ? parseFloat(future) : null;
  const scenKeptValue = f != null ? keptQty * f : null;
  const scenTotal = f != null ? cash + scenKeptValue : null;
  const scenPct = f != null && invested > 0 ? ((scenTotal - invested) / invested) * 100 : null;

  const symLabel = `${sym} @ ${usd(price, 4)}`;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Sell simulator</h2>
        <span className="muted">what happens if you sell X%</span>
      </div>

      <div className="sim">
        <div className="sim-col sim-controls">
          <div className="sim-field">
            <label htmlFor="sim-coin">Coin</label>
            <select id="sim-coin" value={sym} onChange={(e) => setSymbol(e.target.value)}>
              {held.map((r) => (
                <option key={r.symbol} value={r.symbol}>
                  {r.symbol} — {fmt(r.pnlPct, 1)}%
                </option>
              ))}
            </select>
          </div>

          <div className="sim-field">
            <label htmlFor="sim-sell">Sell %</label>
            <div className="sim-slider-row">
              <input
                id="sim-sell"
                type="range"
                min="0"
                max="100"
                step="1"
                value={sellPct}
                onChange={(e) => setSellPct(Number(e.target.value))}
              />
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className="num"
                value={sellPct}
                onChange={(e) => setSellPct(Number(e.target.value))}
              />
            </div>
            <span className="pcard-label">
              = {fmt(sellQty, 4)} {sym} ({usd(cash)})
            </span>
          </div>

          <div className="sim-field">
            <label htmlFor="sim-target">Break-even target — be down only this % after recovery</label>
            <div className="sim-slider-row">
              <input
                id="sim-target"
                type="range"
                min="0"
                max="100"
                step="1"
                value={targetLoss}
                onChange={(e) => setTargetLoss(Number(e.target.value))}
              />
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className="num"
                value={targetLoss}
                onChange={(e) => setTargetLoss(Number(e.target.value))}
              />
            </div>
            <span className="pcard-label">
              price needed: {usd(breakEven, 4)}
            </span>
          </div>

          <div className="sim-field">
            <label htmlFor="sim-future">What if the price later reaches…</label>
            <input
              id="sim-future"
              type="number"
              min="0"
              step="0.0001"
              className="num sim-future"
              placeholder={fmt(price, 4)}
              value={future}
              onChange={(e) => setFuture(e.target.value)}
            />
            <div className="sim-buttons">
              {[
                { label: '−50%', m: 0.5 },
                { label: '−25%', m: 0.75 },
                { label: 'current', m: 1 },
                { label: '+25%', m: 1.25 },
                { label: '+50%', m: 1.5 },
              ].map((b) => (
                <button key={b.label} type="button" className="btn small" onClick={() => setFutureFromMult(b.m)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sim-summary">
            Selling cuts how much of your money is <b>exposed</b> to this coin — it does not change the
            loss % on the coins you keep, and it does not change your overall result: cash + coins still
            equals today's total value. The only way to bring the percentage back up is for the price to
            rise (see the break-even price above).
          </div>
        </div>

        <div className="sim-col sim-results">
          <h3>Current position — {symLabel}</h3>
          <Row
            label="Loss right now"
            value={`${fmt(currentPct, 1)}% (${usd((price - avgBuy) * qty)})`}
            className="neg"
            formula={`(price − avgBuy) ÷ avgBuy × 100 = (${fmt(price, 4)} − ${fmt(avgBuy, 4)}) ÷ ${fmt(avgBuy, 4)} × 100 = ${fmt(currentPct, 1)}%`}
          />

          <h3>Sell {sellPct}% now</h3>
          <Row
            label="Coins sold"
            value={`${fmt(sellQty, 4)} ${sym}`}
            formula={`qty × sell% ÷ 100 = ${fmt(qty, 4)} × ${sellPct} ÷ 100 = ${fmt(sellQty, 4)}`}
          />
          <Row
            label="Cash you'd get"
            value={usd(cash)}
            formula={`sellQty × price = ${fmt(sellQty, 4)} × ${fmt(price, 4)} = ${usd(cash)}`}
          />
          <Row
            label="Realized loss locked in"
            value={`−${usd(Math.abs(realized))}`}
            className="neg"
            formula={`(price − avgBuy) × sellQty = (${fmt(price, 4)} − ${fmt(avgBuy, 4)}) × ${fmt(sellQty, 4)} = −${usd(Math.abs(realized))}`}
          />
          <Row
            label="Coins kept"
            value={`${fmt(keptQty, 4)} ${sym}`}
            formula={`qty − sellQty = ${fmt(qty, 4)} − ${fmt(sellQty, 4)} = ${fmt(keptQty, 4)}`}
          />
          <Row
            label="Value of kept coins"
            value={usd(keptValue)}
            formula={`keptQty × price = ${fmt(keptQty, 4)} × ${fmt(price, 4)} = ${usd(keptValue)}`}
          />
          <Row
            label="Loss still on kept coins"
            value={`−${usd(Math.abs(keptLoss))} (${fmt(currentPct, 1)}%)`}
            className="neg"
            formula={`(price − avgBuy) × keptQty = (${fmt(price, 4)} − ${fmt(avgBuy, 4)}) × ${fmt(keptQty, 4)} = −${usd(Math.abs(keptLoss))}`}
          />

          <h3>After the sale — your total</h3>
          <Row
            label="Total (cash + kept coins)"
            value={usd(afterTotal)}
            formula={`cash + keptValue = ${usd(cash)} + ${usd(keptValue)} = ${usd(afterTotal)}`}
          />
          <Row
            label="Overall result"
            value={`${fmt(afterPct, 1)}% (${usd(afterTotal - invested)})`}
            className={afterPct >= 0 ? 'pos' : 'neg'}
            formula={`(total − invested) ÷ invested × 100 = (${usd(afterTotal)} − ${usd(invested)}) ÷ ${usd(invested)} × 100 = ${fmt(afterPct, 1)}%`}
          />

          <h3>Break-even</h3>
          <Row
            label={`Price to be down only ${targetLoss}%`}
            value={usd(breakEven, 4)}
            formula={`avgBuy × (1 − target% ÷ 100) = ${fmt(avgBuy, 4)} × ${(1 - targetLoss / 100).toFixed(2)} = ${usd(breakEven, 4)}`}
          />

          {hasScenario && f != null && (
            <>
              <h3>If price later reaches {usd(f, 4)}</h3>
              <Row
                label="Kept coins worth"
                value={usd(scenKeptValue)}
                formula={`keptQty × future = ${fmt(keptQty, 4)} × ${fmt(f, 4)} = ${usd(scenKeptValue)}`}
              />
              <Row
                label="New total (cash + kept at future price)"
                value={usd(scenTotal)}
                formula={`cash + scenKeptValue = ${usd(cash)} + ${usd(scenKeptValue)} = ${usd(scenTotal)}`}
              />
              <Row
                label="New overall result"
                value={`${fmt(scenPct, 1)}% (${usd(scenTotal - invested)})`}
                className={scenPct >= 0 ? 'pos' : 'neg'}
                formula={`(scenTotal − invested) ÷ invested × 100 = (${usd(scenTotal)} − ${usd(invested)}) ÷ ${usd(invested)} × 100 = ${fmt(scenPct, 1)}%`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

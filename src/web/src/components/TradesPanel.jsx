import React, { useState, useEffect, useCallback } from 'react';

const emptyForm = { date: new Date().toISOString().slice(0, 10), symbol: '', side: 'BUY', quantity: '', unit_price: '', notes: '' };

export default function TradesPanel() {
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/trades');
    setTrades(await r.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    try {
      const body = {
        date: form.date,
        symbol: form.symbol.trim().toUpperCase(),
        side: form.side,
        quantity: parseFloat(form.quantity),
        unit_price: parseFloat(form.unit_price),
        notes: form.notes,
      };
      const res = await fetch(editing ? `/api/trades/${editing}` : '/api/trades', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      setForm(emptyForm);
      setEditing(null);
      setMsg(editing ? 'Trade updated.' : 'Trade added.');
      load();
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    }
  }

  async function remove(id) {
    await fetch(`/api/trades/${id}`, { method: 'DELETE' });
    load();
  }

  function startEdit(t) {
    setEditing(t.id);
    setForm({
      date: t.date,
      symbol: t.symbol,
      side: t.side,
      quantity: String(t.quantity),
      unit_price: String(t.unit_price),
      notes: t.notes || '',
    });
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>{editing ? `Edit trade #${editing}` : 'Add a trade'}</h2>
        {editing && (
          <button className="btn" onClick={() => { setEditing(null); setForm(emptyForm); }}>
            Cancel edit
          </button>
        )}
      </div>

      <form className="trade-form" onSubmit={submit}>
        <input type="date" value={form.date} onChange={set('date')} required />
        <input placeholder="Symbol (e.g. DOGE)" value={form.symbol} onChange={set('symbol')} required />
        <select value={form.side} onChange={set('side')}>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
        <input type="number" step="any" placeholder="Quantity" value={form.quantity} onChange={set('quantity')} required />
        <input type="number" step="any" placeholder="Unit price (USDT)" value={form.unit_price} onChange={set('unit_price')} required />
        <input placeholder="Notes (optional)" value={form.notes} onChange={set('notes')} />
        <button type="submit" className="btn primary">{editing ? 'Save' : 'Add'}</button>
      </form>
      {msg && <p className={msg.startsWith('Error') ? 'neg' : 'pos'}>{msg}</p>}

      <h3>Transaction history ({trades.length})</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td className="nowrap">{t.date}</td>
                <td className="strong">{t.symbol}</td>
                <td className={t.side === 'BUY' ? 'pos' : 'neg'}>{t.side}</td>
                <td>{t.quantity}</td>
                <td>${t.unit_price}</td>
                <td>${t.total_value.toFixed(4)}</td>
                <td className="muted small notes-cell" title={t.notes || ''}>{t.notes || ''}</td>
                <td>
                  <button className="btn small" onClick={() => startEdit(t)}>Edit</button>{' '}
                  <button className="btn small danger" onClick={() => remove(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!trades.length && (
              <tr><td colSpan={8} className="muted">No trades yet. Add one above or import from Excel (npm run import).</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

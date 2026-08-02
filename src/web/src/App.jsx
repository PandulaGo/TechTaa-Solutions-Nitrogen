import React, { useState, useEffect, useCallback, useRef } from 'react';
import SummaryBar from './components/SummaryBar.jsx';
import PortfolioTable from './components/PortfolioTable.jsx';
import ScannerPanel from './components/ScannerPanel.jsx';
import TradesPanel from './components/TradesPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Toasts from './components/Toasts.jsx';

const TABS = ['Portfolio', 'Scanner', 'Trades', 'Settings'];

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function App() {
  const [tab, setTab] = useState('Portfolio');
  const [portfolio, setPortfolio] = useState(null);
  const [scanner, setScanner] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);

  const addToast = useCallback((t) => {
    const id = Date.now() + Math.random();
    const item = { ...t, id };
    toastsRef.current = [...toastsRef.current, item].slice(-5);
    setToasts(toastsRef.current);
    setTimeout(() => {
      toastsRef.current = toastsRef.current.filter((x) => x.id !== id);
      setToasts(toastsRef.current);
    }, 12000);
  }, []);

  // SSE for browser toasts
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('signal', (e) => {
      try {
        const s = JSON.parse(e.data);
        addToast({ title: `${s.symbol} — ${s.type.replace(/_/g, ' ')}`, body: s.message, severity: s.severity });
      } catch {}
    });
    return () => es.close();
  }, [addToast]);

  // Poll portfolio every 15s
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const data = await api('/api/portfolio');
        if (!stop) setPortfolio(data);
      } catch (err) {
        if (!stop) addToast({ title: 'Portfolio error', body: err.message, severity: 'error' });
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [addToast]);

  // Poll scanner every 30s
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const data = await api('/api/scanner');
        if (!stop) setScanner(data);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Crypto Income Assistant</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'Portfolio' && (
          <>
            <SummaryBar totals={portfolio?.totals} />
            <PortfolioTable rows={portfolio?.rows || []} />
          </>
        )}
        {tab === 'Scanner' && <ScannerPanel scanner={scanner} />}
        {tab === 'Trades' && <TradesPanel />}
        {tab === 'Settings' && <SettingsPanel />}
      </main>

      <Toasts toasts={toasts} />
    </div>
  );
}

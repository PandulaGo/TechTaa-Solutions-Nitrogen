import React, { useState, useEffect, useCallback, useRef } from 'react';
import SummaryBar from './components/SummaryBar.jsx';
import PortfolioTable from './components/PortfolioTable.jsx';
import SellSimulator from './components/SellSimulator.jsx';
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

function getInitialLayout() {
  try {
    const saved = localStorage.getItem('layout');
    if (saved === 'dashboard' || saved === 'tabs') return saved;
  } catch {}
  return window.innerWidth >= 1500 ? 'dashboard' : 'tabs';
}

export default function App() {
  const [tab, setTab] = useState('Portfolio');
  const [layout, setLayout] = useState(getInitialLayout);
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

  const toggleLayout = () => {
    setLayout((prev) => {
      const next = prev === 'tabs' ? 'dashboard' : 'tabs';
      try { localStorage.setItem('layout', next); } catch {}
      return next;
    });
  };

  return (
    <div className={`app ${layout === 'dashboard' ? 'layout-dashboard' : ''}`}>
      <header className="topbar">
        <h1>Crypto Income Assistant</h1>
        <nav>
          {layout === 'tabs' ? (
            TABS.map((t) => (
              <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
                {t}
              </button>
            ))
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>all panels</span>
          )}
          <button
            className="tab"
            title={layout === 'tabs' ? 'Switch to dashboard view' : 'Switch to tab view'}
            onClick={toggleLayout}
          >
            {layout === 'tabs' ? '⊞ Grid' : '≡ Tabs'}
          </button>
        </nav>
      </header>

      <main>
        {layout === 'tabs' ? (
          <>
            {tab === 'Portfolio' && (
              <>
                <SummaryBar totals={portfolio?.totals} />
                <PortfolioTable rows={portfolio?.rows || []} />
                <SellSimulator rows={portfolio?.rows || []} />
              </>
            )}
            {tab === 'Scanner' && <ScannerPanel scanner={scanner} />}
            {tab === 'Trades' && <TradesPanel />}
            {tab === 'Settings' && <SettingsPanel />}
          </>
        ) : (
          <>
            <div className="dash-section">
              <SummaryBar totals={portfolio?.totals} />
            </div>
            <div className="dash-grid">
              <div className="dash-col">
                <PortfolioTable rows={portfolio?.rows || []} />
                <SellSimulator rows={portfolio?.rows || []} />
              </div>
              <div className="dash-col">
                <ScannerPanel scanner={scanner} />
              </div>
              <div className="dash-col">
                <TradesPanel />
              </div>
              <div className="dash-col">
                <SettingsPanel />
              </div>
            </div>
          </>
        )}
      </main>

      <Toasts toasts={toasts} />
    </div>
  );
}

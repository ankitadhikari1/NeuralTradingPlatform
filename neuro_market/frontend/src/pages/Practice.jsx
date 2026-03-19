import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, TrendingDown, Minus, Camera, Activity } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';
import CandlestickChart from '../components/CandlestickChart';
import TradingSimulator from '../components/TradingSimulator';

const Practice = () => {
  const [symbol, setSymbol] = useState('AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rec, setRec] = useState(null);
  const [price, setPrice] = useState(null);
  const [practiceQty, setPracticeQty] = useState(1);
  const [symbolOptions, setSymbolOptions] = useState([]);

  const { active, start, wsStatus, emotion, timeline } = useEmotion();

  const PRACTICE_BALANCE_KEY = 'practice_balance_v1';
  const PRACTICE_POSITION_KEY = 'practice_position_v1';
  const START_BALANCE = 10000000;

  const [practiceCash, setPracticeCash] = useState(() => {
    const raw = localStorage.getItem(PRACTICE_BALANCE_KEY);
    const v = raw ? Number(raw) : START_BALANCE;
    return Number.isFinite(v) ? v : START_BALANCE;
  });
  const [position, setPosition] = useState(() => {
    try {
      const raw = localStorage.getItem(PRACTICE_POSITION_KEY);
      return raw ? JSON.parse(raw) : { symbol: 'AAPL', qty: 0, avg: 0, trades: [] };
    } catch {
      return { symbol: 'AAPL', qty: 0, avg: 0, trades: [] };
    }
  });

  const computePracticeStats = useCallback(() => {
    const trades = Array.isArray(position.trades) ? position.trades : [];
    let realized = 0;
    let sells = 0;
    let wins = 0;
    const lots = [];
    for (const t of trades) {
      const qty = Number(t.qty || 0);
      const px = Number(t.price || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(px) || qty <= 0) continue;
      if (t.side === 'BUY') {
        lots.push({ qty, px });
      } else if (t.side === 'SELL') {
        let remaining = qty;
        let pnl = 0;
        while (remaining > 0 && lots.length) {
          const lot = lots[0];
          const take = Math.min(remaining, lot.qty);
          pnl += (px - lot.px) * take;
          lot.qty -= take;
          remaining -= take;
          if (lot.qty <= 1e-9) lots.shift();
        }
        realized += pnl;
        sells += 1;
        if (pnl > 0) wins += 1;
      }
    }
    const winRate = sells ? (wins / sells) * 100 : 0;
    const recent = (Array.isArray(timeline) ? timeline : []).slice(-30);
    const calm = recent.filter((x) => String(x.emotion || '').toLowerCase() === 'calm').length;
    const calmRatio = recent.length ? calm / recent.length : 0;
    return {
      realized_pnl: realized,
      sell_trades: sells,
      win_rate: winRate,
      calm_ratio: calmRatio,
    };
  }, [position, timeline]);

  useEffect(() => {
    if (!active) start();
  }, [active, start]);

  useEffect(() => {
    localStorage.setItem(PRACTICE_BALANCE_KEY, String(practiceCash));
  }, [practiceCash]);

  useEffect(() => {
    localStorage.setItem(PRACTICE_POSITION_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await axios.get('/trading/stocks/popular');
        const list = (resp.data || []).map((s) => ({ symbol: s.symbol, name: s.company_name || s.symbol }));
        setSymbolOptions(list);
      } catch {
        setSymbolOptions([
          { symbol: 'AAPL', name: 'Apple' },
          { symbol: 'MSFT', name: 'Microsoft' },
          { symbol: 'GOOGL', name: 'Alphabet' },
          { symbol: 'AMZN', name: 'Amazon' },
          { symbol: 'NVDA', name: 'NVIDIA' },
          { symbol: 'TSLA', name: 'Tesla' },
          { symbol: 'META', name: 'Meta' },
        ]);
      }
    };
    load();
  }, []);

  const badge = useMemo(() => {
    if (!rec) return null;
    const a = rec.action;
    if (a === 'BUY') return { text: 'BUY', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: TrendingUp };
    if (a === 'SELL') return { text: 'SELL', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30', icon: TrendingDown };
    return { text: 'HOLD', cls: 'bg-slate-500/10 text-slate-200 border-slate-500/30', icon: Minus };
  }, [rec]);

  const fetchRec = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await axios.post('/practice/recommendation', {
        symbol,
        current_price: Number.isFinite(Number(price)) ? Number(price) : null,
        practice_stats: computePracticeStats(),
        emotion: { state: emotion.state, confidence: Number(emotion.confidence || 0) },
      });
      setRec(resp.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to generate recommendation');
      setRec(null);
    } finally {
      setLoading(false);
    }
  }, [computePracticeStats, emotion.confidence, emotion.state, price, symbol]);

  useEffect(() => {
    fetchRec();
    const id = setInterval(fetchRec, 15000);
    return () => clearInterval(id);
  }, [fetchRec, symbol]);

  useEffect(() => {
    if (position.symbol !== symbol) {
      setPosition({ symbol, qty: 0, avg: 0, trades: [] });
    }
  }, [position.symbol, symbol]);

  const resetPractice = () => {
    setPracticeCash(START_BALANCE);
    setPosition({ symbol, qty: 0, avg: 0, trades: [] });
  };

  const buyPractice = () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    const qty = Math.max(1, Math.floor(Number(practiceQty) || 1));
    const cost = p * qty;
    if (practiceCash < cost) return;
    const newQty = position.qty + qty;
    const newAvg = newQty > 0 ? ((position.qty * position.avg) + (qty * p)) / newQty : 0;
    setPracticeCash(practiceCash - cost);
    setPosition({
      ...position,
      qty: newQty,
      avg: newAvg,
      trades: [...position.trades, { ts: Date.now(), side: 'BUY', qty, price: p }],
    });
  };

  const sellPractice = () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    const qty = Math.max(1, Math.floor(Number(practiceQty) || 1));
    if (position.qty < qty) return;
    const proceeds = p * qty;
    setPracticeCash(practiceCash + proceeds);
    setPosition({
      ...position,
      qty: position.qty - qty,
      avg: position.qty - qty > 0 ? position.avg : 0,
      trades: [...position.trades, { ts: Date.now(), side: 'SELL', qty, price: p }],
    });
  };

  const unrealized = position.qty > 0 && Number.isFinite(Number(price))
    ? (Number(price) - position.avg) * position.qty
    : 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="text-blue-500" /> Practice Session
          </h1>
          <p className="text-slate-400">Training mode with demo funds + live chart. AI suggests BUY/SELL/HOLD based on stock signals and your stats.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 flex items-center gap-2">
            <Camera size={14} /> WS: <span className="font-mono">{wsStatus}</span>
          </div>
          <button onClick={resetPractice} className="btn-secondary">Reset Demo</button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Symbol</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="input-field">
              {symbolOptions.map((s) => (
                <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchRec} className="btn-primary h-11 w-full md:w-auto" disabled={loading}>
            {loading ? 'Analyzing…' : 'Get Recommendation'}
          </button>
        </div>

        {error && <p className="mt-4 text-rose-400 font-bold">{error}</p>}
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Demo Balance</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">${Number(practiceCash).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Position</p>
            <p className="text-sm text-slate-200">
              {position.symbol} • Qty: <span className="font-mono">{position.qty}</span> • Avg: <span className="font-mono">${Number(position.avg).toFixed(2)}</span>
            </p>
            <p className={`text-sm font-bold ${unrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Unrealized: ${Number(unrealized).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Emotion</p>
            <p className="text-sm font-bold">{emotion.state} ({Math.round((emotion.confidence || 0) * 100)}%)</p>
          </div>
        </div>

        <CandlestickChart symbol={symbol} height={320} onPrice={setPrice} />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Quantity</label>
            <input className="input-field" type="number" min="1" value={practiceQty} onChange={(e) => setPracticeQty(e.target.value)} />
          </div>
          <button className="btn-secondary md:col-span-1" onClick={buyPractice} disabled={!Number.isFinite(Number(price))}>Practice BUY</button>
          <button className="btn-danger md:col-span-1" onClick={sellPractice} disabled={position.qty <= 0 || !Number.isFinite(Number(price))}>Practice SELL</button>
          <div className="md:col-span-1 text-sm text-slate-400 text-right">
            {Number.isFinite(Number(price)) ? (
              <span>Est: <span className="font-mono text-slate-200">${(Number(price) * Math.max(1, Math.floor(Number(practiceQty) || 1))).toFixed(2)}</span></span>
            ) : (
              <span>Waiting price…</span>
            )}
          </div>
        </div>
      </div>

      

      {rec && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-2">Recommendation</p>
                  <h2 className="text-2xl font-black flex items-center gap-3">
                    {badge && <span className={`px-3 py-1 rounded-lg border text-sm ${badge.cls}`}>{badge.text}</span>}
                    <span>{rec.symbol}</span>
                  </h2>
                  <p className="text-slate-300 mt-2">Confidence: <span className="font-mono">{Math.round(rec.confidence * 100)}%</span></p>
                </div>
                <Link to={`/stock/${rec.symbol}`} className="btn-secondary">Open Chart</Link>
              </div>

              <div className="mt-6 space-y-2">
                {(rec.rationale || []).map((r, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/40 border border-slate-700 text-sm text-slate-200">
                    {r}
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-4">Your Stats</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Realized P/L</p>
                  <p className={`text-2xl font-black ${rec.user_stats.realized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${Number(rec.user_stats.realized_pnl).toFixed(2)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Win Rate</p>
                  <p className="text-2xl font-black">{Number(rec.user_stats.win_rate).toFixed(0)}%</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Calm Ratio</p>
                  <p className="text-2xl font-black">{Math.round(Number(rec.user_stats.calm_ratio) * 100)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-6">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-4">Indicators (3mo)</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Last Price</span><span className="font-mono">${Number(rec.indicators.last_price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">SMA 20</span><span className="font-mono">${Number(rec.indicators.sma20).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">SMA 50</span><span className="font-mono">${Number(rec.indicators.sma50).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">RSI 14</span><span className="font-mono">{Number(rec.indicators.rsi14).toFixed(1)}</span></div>
              </div>
            </div>

            <div className="card p-6 border border-blue-500/20 bg-blue-600/10">
              <p className="text-sm text-slate-200">
                Use Practice Session to rehearse discipline. If your emotion guard shows Stress/Excitement, treat the recommendation as “HOLD” unless your plan is explicit.
              </p>
            </div>
            
          </div>
          
        </div>
        
      )}
      <div className="grid grid-cols-1 gap-6">
        <TradingSimulator />
      </div>
    </div>
    
  );
};

export default Practice;

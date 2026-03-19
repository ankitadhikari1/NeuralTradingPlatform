import React, { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Camera, Star, Clock } from 'lucide-react';
import CandlestickChart from '../components/CandlestickChart';
import { useEmotion } from '../context/EmotionContext';
import Modal from '../components/Modal';

const StockDetail = () => {
  const { symbol } = useParams();
  const { emotion: liveEmotion } = useEmotion();
  const emotion = liveEmotion || { state: 'Calm', confidence: 0.0 };
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState('BUY');
  const [alert, setAlert] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', tone: 'primary', onConfirm: null });
  const [cashBalance, setCashBalance] = useState(0);
  const [tradeMarkers, setTradeMarkers] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);

  const [optType, setOptType] = useState('CALL');
  const [optStrike, setOptStrike] = useState('');
  const [optExpiry, setOptExpiry] = useState('');
  const [optContracts, setOptContracts] = useState(1);
  const [optStopLoss, setOptStopLoss] = useState('');
  const [optTakeProfit, setOptTakeProfit] = useState('');
  const [optPositions, setOptPositions] = useState([]);
  const [optAlert, setOptAlert] = useState(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optPremium, setOptPremium] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionDurationMin, setSessionDurationMin] = useState(60);
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());

  const parseBackendDate = useCallback((value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value);
    const hasTime = /^\d{4}-\d{2}-\d{2}T/.test(s);
    const hasZone = /[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s);
    if (hasTime && !hasZone) return new Date(`${s}Z`);
    return new Date(s);
  }, []);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const fetchActiveSession = useCallback(async () => {
    try {
      const resp = await axios.get('/trading/session/active');
      setActiveSession(resp.data || null);
    } catch {
      setActiveSession(null);
    }
  }, []);

  const startSession = async () => {
    setSessionBusy(true);
    setAlert(null);
    try {
      const resp = await axios.post('/trading/session/start', { duration_minutes: Number(sessionDurationMin) });
      setActiveSession(resp.data);
      setAlert({ type: 'success', message: 'Trading session started' });
    } catch (e) {
      setAlert({ type: 'error', message: e?.response?.data?.detail || e?.message || 'Failed to start session' });
    } finally {
      setSessionBusy(false);
    }
  };

  const endSession = async () => {
    if (!activeSession?.id) return;
    setSessionBusy(true);
    setAlert(null);
    try {
      const resp = await axios.post('/trading/session/end', { session_id: Number(activeSession.id) });
      setActiveSession(null);
      setAlert({ type: 'success', message: `Session ended. Report ${resp.data?.report_path ? 'generated' : 'processing'}.` });
    } catch (e) {
      setAlert({ type: 'error', message: e?.response?.data?.detail || e?.message || 'Failed to end session' });
    } finally {
      setSessionBusy(false);
    }
  };

  const fetchTotalProfit = useCallback(async () => {
    try {
      const resp = await axios.get('/trading/history');
      const trades = resp.data || [];
      // Calculate total P/L from trade history
      const profit = trades.reduce((acc, t) => {
        // Simple heuristic for realized profit: SELL - BUY
        // In a real app, this would be more complex (FIFO/LIFO)
        return acc + (t.trade_type === 'SELL' ? t.price * t.quantity : -t.price * t.quantity);
      }, 0);
      setTotalProfit(profit);
    } catch (err) {
      console.error('Failed to fetch profit:', err);
    }
  }, []);

  const fetchWatchlist = useCallback(async () => {
    try {
      const resp = await axios.get('/trading/watchlist');
      setInWatchlist((resp.data || []).includes(symbol.toUpperCase()));
    } catch (err) {
      console.error('Failed to fetch watchlist:', err);
    }
  }, [symbol]);

  const toggleWatchlist = async () => {
    try {
      if (inWatchlist) {
        await axios.delete(`/trading/watchlist/${symbol}`);
        setInWatchlist(false);
      } else {
        await axios.post('/trading/watchlist', { symbol });
        setInWatchlist(true);
      }
    } catch (err) {
      console.error('Watchlist toggle failed:', err);
    }
  };

  // Estimate premium when strike/expiry/type changes
  useEffect(() => {
    const strikeNum = Number(optStrike);
    if (!strikeNum || !optExpiry || !symbol) {
      setOptPremium(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        const resp = await axios.get('/options/estimate', {
          params: { symbol, strike: strikeNum, expiry: optExpiry, option_type: optType }
        });
        setOptPremium(resp.data.premium);
      } catch {
        setOptPremium(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [optStrike, optExpiry, optType, symbol]);

  const fetchStockData = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [stockRes] = await Promise.all([
        axios.get(`/trading/stocks/${symbol}`),
      ]);
      setStock(stockRes.data);
      const me = await axios.get('/auth/me');
      setCashBalance(Number(me.data.cash_balance || 0));
      const historyRes = await axios.get('/trading/history');
      const trades = (historyRes.data || []).filter((t) => String(t.stock_symbol).toUpperCase() === symbol.toUpperCase());
      setTradeHistory(trades);
      const markers = trades.map((t) => {
        const ts = Math.floor(new Date(t.timestamp).getTime() / 1000);
        const time = ts - (ts % 60);
        const isBuy = t.trade_type === 'BUY';
        return {
          time,
          position: isBuy ? 'belowBar' : 'aboveBar',
          color: isBuy ? '#10b981' : '#ef4444',
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          text: `${t.trade_type} ${t.quantity}`,
        };
      });
      setTradeMarkers(markers);
    } catch (error) {
      setStock(null);
      setPageError(error?.response?.data?.detail || error?.message || 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const fetchOptionPositions = useCallback(async () => {
    try {
      setOptLoading(true);
      const resp = await axios.get('/options/positions');
      setOptPositions(resp.data || []);
    } catch {
      return;
    } finally {
      setOptLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockData();
    fetchOptionPositions();
    fetchWatchlist();
    fetchTotalProfit();
    fetchActiveSession();
    if (!optExpiry) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setOptExpiry(d.toISOString().slice(0, 10));
    }
  }, [fetchActiveSession, fetchOptionPositions, fetchStockData, fetchTotalProfit, fetchWatchlist, optExpiry, symbol]);

  useEffect(() => {
    let ws;
    const token = localStorage.getItem('token') || '';
    const httpBase = axios.defaults.baseURL || 'http://localhost:8000';
    let wsBase = 'ws://localhost:8000';
    try {
      const url = new URL(httpBase);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBase = `${url.protocol}//${url.host}`;
    } catch {}

    ws = new WebSocket(`${wsBase}/options/ws/pnl?token=${encodeURIComponent(token)}`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'options_pnl') return;
        setCashBalance(Number(msg.cash_balance || 0));
        setOptPositions(msg.positions || []);
      } catch {}
    };
    return () => {
      if (ws) ws.close();
    };
  }, [symbol]);

  const submitTrade = async ({ confirmed = false } = {}) => {
    try {
      const executionPrice = Number(livePrice ?? stock.price);
      const resp = await axios.post('/trading/trade', {
        stock_symbol: symbol,
        trade_type: orderType,
        quantity: parseFloat(quantity),
        price: executionPrice,
        emotional_state: `${emotion.state} (${(emotion.confidence * 100).toFixed(0)}%)`,
        confirmed,
      });
      const t = resp.data;
      if (t?.timestamp) {
        const ts = Math.floor(new Date(t.timestamp).getTime() / 1000);
        const time = ts - (ts % 60);
        const isBuy = t.trade_type === 'BUY';
        setTradeHistory((prev) => [t, ...prev]);
        setTradeMarkers((prev) => [
          ...prev,
          {
            time,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: isBuy ? '#10b981' : '#ef4444',
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            text: `${t.trade_type} ${t.quantity}`,
          },
        ]);
      }
      setAlert({ type: 'success', message: `Successfully ${orderType === 'BUY' ? 'bought' : 'sold'} ${quantity} shares of ${symbol}` });
      setConfirmModal({ open: false, title: '', message: '', tone: 'primary', onConfirm: null });
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object' && detail.action === 'BLOCK') {
        setCooldown(detail.cooldown_remaining || 0);
        setAlert({ type: 'error', message: detail.message });
        setConfirmModal({ open: false, title: '', message: '', tone: 'primary', onConfirm: null });
        return;
      }

      if (typeof detail === 'object' && detail.action === 'LIMIT') {
        const max = Number(detail.max_trade_amount || 0);
        const px = Number(livePrice ?? stock.price);
        if (max > 0 && px > 0) {
          const maxQty = Math.max(1, Math.floor(max / px));
          setQuantity(maxQty);
          setAlert({ type: 'error', message: `${detail.message} Quantity adjusted to ${maxQty}.` });
        } else {
          setAlert({ type: 'error', message: detail.message });
        }
        setConfirmModal({ open: false, title: '', message: '', tone: 'primary', onConfirm: null });
        return;
      }

      if (typeof detail === 'object' && detail.action === 'CONFIRMATION') {
        setConfirmModal({
          open: true,
          title: 'Confirm Again',
          message: (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
                {detail.message}
              </div>
              <div className="text-xs text-slate-400">
                This is an extra verification step (MVP risk rules).
              </div>
            </div>
          ),
          tone: 'secondary',
          onConfirm: () => submitTrade({ confirmed: true }),
        });
        return;
      }

      if (typeof detail === 'string' && detail.toLowerCase().includes('start a trading session')) {
        setActiveSession(null);
        setAlert({ type: 'error', message: detail });
        setConfirmModal({ open: false, title: '', message: '', tone: 'primary', onConfirm: null });
        return;
      }

      setAlert({ type: 'error', message: typeof detail === 'string' ? detail : "Trade failed. Please try again." });
      setConfirmModal({ open: false, title: '', message: '', tone: 'primary', onConfirm: null });
    }
  };

  const handleTrade = async () => {
    setAlert(null);
    if (cooldown > 0) return;

    const currentEmotion = liveEmotion || { state: 'Calm', confidence: 0.0 };
    const emotionName = currentEmotion.state.toLowerCase();
    const tradeAmount = parseFloat(quantity) * (livePrice ?? stock.price);
    
    // Check behavior-based rules via a "Pre-flight" confirmation for everything
    setConfirmModal({
      open: true,
      title: 'Confirm Execution',
      message: (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex justify-between mb-2">
              <span className="text-slate-400">Order</span>
              <span className={`font-black ${orderType === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{orderType} {quantity} {symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Value</span>
              <span className="font-black text-white">${tradeAmount.toLocaleString()}</span>
            </div>
          </div>
          
          {emotionName !== 'calm' && (
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${
              emotionName === 'stress' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' :
              emotionName === 'anxiety' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
              'bg-blue-500/10 border-blue-500/30 text-blue-500'
            }`}>
              <AlertTriangle size={18} />
              <p className="text-xs font-bold uppercase tracking-tight">AI Warning: Trading while {emotionName}</p>
            </div>
          )}
        </div>
      ),
      tone: emotionName === 'stress' ? 'danger' : 'primary',
      onConfirm: submitTrade,
    });
  };

  const openOption = async () => {
    setOptAlert(null);
    try {
      const emotion = liveEmotion || { state: 'Calm', confidence: 0.0 };
      const payload = {
        underlying_symbol: symbol,
        option_type: optType,
        strike: Number(optStrike),
        expiry: optExpiry,
        contracts: Number(optContracts),
        stop_loss: optStopLoss === '' ? null : Number(optStopLoss),
        take_profit: optTakeProfit === '' ? null : Number(optTakeProfit),
        emotional_state: `${emotion.state} (${(emotion.confidence * 100).toFixed(0)}%)`,
      };
      await axios.post('/options/open', payload);
      setOptAlert({ type: 'success', message: 'Option position opened' });
      await fetchOptionPositions();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to open option';
      if (typeof msg === 'string' && msg.toLowerCase().includes('start a trading session')) {
        setActiveSession(null);
        setAlert({ type: 'error', message: msg });
      }
      setOptAlert({ type: 'error', message: msg });
    }
  };

  const closeOption = async (id) => {
    setOptAlert(null);
    try {
      await axios.post(`/options/close/${id}`);
      setOptAlert({ type: 'success', message: 'Option position closed' });
      await fetchOptionPositions();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to close option';
      if (typeof msg === 'string' && msg.toLowerCase().includes('start a trading session')) {
        setActiveSession(null);
        setAlert({ type: 'error', message: msg });
      }
      setOptAlert({ type: 'error', message: msg });
    }
  };

  useEffect(() => {
    if (!activeSession?.expires_at) return;
    setSessionNowMs(Date.now());
    const id = setInterval(() => setSessionNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeSession?.expires_at]);

  const expiresAtMs = activeSession?.expires_at ? parseBackendDate(activeSession.expires_at)?.getTime() : null;
  const sessionSecondsLeft =
    Number.isFinite(expiresAtMs) && expiresAtMs != null
      ? Math.max(0, Math.floor((expiresAtMs - sessionNowMs) / 1000))
      : 0;
  const sessionMinLeft = Math.floor(sessionSecondsLeft / 60);
  const sessionSecLeft = sessionSecondsLeft % 60;

  useEffect(() => {
    if (!activeSession?.id) return;
    if (sessionSecondsLeft !== 0) return;
    fetchActiveSession();
  }, [activeSession?.id, fetchActiveSession, sessionSecondsLeft]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div></div>;

  if (!stock) {
    return (
      <div className="card p-6 border border-rose-500/30 bg-rose-500/10">
        <p className="text-rose-400 font-bold mb-2">Stock failed to load</p>
        <p className="text-sm text-slate-300 mb-4">
          {pageError || 'Unable to load this stock. Make sure the backend is running on http://127.0.0.1:8000.'}
        </p>
        <button onClick={fetchStockData} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Modal
        open={confirmModal.open}
        title={confirmModal.title}
        tone={confirmModal.tone}
        onClose={() => setConfirmModal({ open: false, title: '', message: '', tone: 'primary', onConfirm: null })}
        onConfirm={() => confirmModal.onConfirm && confirmModal.onConfirm()}
        confirmText="Confirm Trade"
        cancelText="Cancel"
      >
        {confirmModal.message}
      </Modal>
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-6">
          <button 
            onClick={toggleWatchlist}
            className={`mt-2 p-3 rounded-2xl border transition-all duration-300 ${
              inWatchlist 
                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/20' 
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
            title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
          >
            <Star size={24} fill={inWatchlist ? 'currentColor' : 'none'} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-extrabold text-white">{symbol}</h1>
              <span className="px-3 py-1 bg-slate-800 rounded-lg text-slate-400 font-medium">{stock.company_name}</span>
            </div>
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold">${stock.price.toFixed(2)}</h2>
              <div className={`flex items-center gap-1 font-bold ${stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stock.change >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {Math.abs(stock.change_percent).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
          <div className="px-4 py-2 rounded-xl flex items-center gap-3 border bg-slate-900/40 border-slate-700/60">
            <Clock size={20} className={activeSession ? 'text-emerald-400' : 'text-slate-500'} />
            <div className="text-sm font-bold">
              <p className="opacity-70 leading-none mb-1">TRADING SESSION</p>
              {activeSession ? (
                <p className="uppercase text-emerald-300">Active • {sessionMinLeft}m {String(sessionSecLeft).padStart(2, '0')}s</p>
              ) : (
                <p className="uppercase text-slate-300">Inactive</p>
              )}
            </div>
            <div className="ml-2 flex items-center gap-2">
              {!activeSession ? (
                <>
                  <select value={sessionDurationMin} onChange={(e) => setSessionDurationMin(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                    <option value={30}>30m</option>
                    <option value={60}>60m</option>
                    <option value={90}>90m</option>
                    <option value={120}>120m</option>
                  </select>
                  <button onClick={startSession} disabled={sessionBusy} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${sessionBusy ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'btn-secondary'}`}>
                    Start
                  </button>
                </>
              ) : (
                <button onClick={endSession} disabled={sessionBusy} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${sessionBusy ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'btn-danger'}`}>
                  End
                </button>
              )}
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl flex items-center gap-3 border ${
            emotion.state === 'Calm' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
            emotion.state === 'Stress' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' :
            emotion.state === 'Excitement' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
            'bg-purple-500/10 border-purple-500/30 text-purple-500'
          }`}>
            <Camera size={20} />
            <div className="text-sm font-bold">
              <p className="opacity-70 leading-none mb-1">AI EMOTION GUARD</p>
              <p className="uppercase">{emotion.state} ({(emotion.confidence * 100).toFixed(0)}%)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <CandlestickChart symbol={symbol} markers={tradeMarkers} onPrice={setLivePrice} />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Options Trading</h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest border border-blue-400/30 px-2 py-1 rounded"
                >
                  {showGuide ? 'Hide Guide' : 'Options 101'}
                </button>
                <div className="text-sm text-slate-300">
                  Cash: <span className="font-mono text-emerald-400">${cashBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {showGuide && (
              <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 text-slate-200 text-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} /> New to Options?
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p><strong className="text-emerald-400">CALL:</strong> Use if you think the stock will go <strong>UP</strong>. You profit if the premium increases.</p>
                    <p><strong className="text-rose-400">PUT:</strong> Use if you think the stock will go <strong>DOWN</strong>. You profit if the premium increases.</p>
                  </div>
                  <div className="space-y-2">
                    <p><strong className="text-amber-400">Strike:</strong> The target price. For Calls, you want stock price &gt; strike. For Puts, you want stock price &lt; strike.</p>
                    <p><strong className="text-purple-400">Premium:</strong> The "price" of 1 contract. Total cost = Premium × Contracts × 100.</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-blue-500/20 text-xs text-slate-400">
                  <strong>Risk Tip:</strong> Options can move much faster than stocks. Start with small contract sizes (e.g., 1) to learn the rhythm.
                </div>
              </div>
            )}

            {optAlert && (
              <div className={`p-4 rounded-lg mb-4 ${optAlert.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'}`}>
                <p className="text-sm font-medium">{optAlert.message}</p>
              </div>
            )}

            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Strategy</label>
                  <div className="flex p-1 bg-slate-800 rounded-xl">
                    <button 
                      onClick={() => setOptType('CALL')}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${optType === 'CALL' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      CALL (Bullish)
                    </button>
                    <button 
                      onClick={() => setOptType('PUT')}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${optType === 'PUT' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      PUT (Bearish)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Target Price (Strike)</label>
                  <input className="input-field" value={optStrike} onChange={(e) => setOptStrike(e.target.value)} placeholder={`e.g. ${Math.round(stock.price)}`} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Expiration Date</label>
                  <input
                    className="input-field"
                    type="date"
                    value={optExpiry}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setOptExpiry(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Quantity (Contracts)</label>
                  <input className="input-field" type="number" min="1" value={optContracts} onChange={(e) => setOptContracts(e.target.value)} />
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">1 contract = 100 shares</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Stop Loss (Premium)</label>
                  <input className="input-field" value={optStopLoss} onChange={(e) => setOptStopLoss(e.target.value)} placeholder="e.g. 1.50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Take Profit (Premium)</label>
                  <input className="input-field" value={optTakeProfit} onChange={(e) => setOptTakeProfit(e.target.value)} placeholder="e.g. 5.00" />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Est. Premium</p>
                    <p className="text-2xl font-mono font-bold text-white">
                      {optPremium ? `$${optPremium.toFixed(2)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Total Cost</p>
                    <p className="text-2xl font-mono font-bold text-emerald-400">
                      {optPremium ? `$${(optPremium * optContracts * 100).toLocaleString()}` : '—'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={openOption} 
                  disabled={!optPremium}
                  className={`w-full md:w-auto px-12 py-4 rounded-xl font-black text-lg shadow-2xl transition-all active:scale-95 ${
                    !optPremium ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'btn-secondary'
                  }`}
                >
                  Buy {optContracts} {optType} Contract{optContracts > 1 ? 's' : ''}
                </button>
              </div>
              {!optPremium && optStrike && (
                <p className="text-center mt-4 text-xs text-slate-500 italic">
                  * Enter a valid strike and expiry to calculate premium.
                </p>
              )}
            </div>

            <div className="mt-6 overflow-x-auto">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Open Positions</h4>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3">Contract</th>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Mark</th>
                    <th className="px-4 py-3 text-right">P/L</th>
                    <th className="px-4 py-3 text-right">P/L %</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {optLoading ? (
                    <tr><td className="px-4 py-6 text-slate-500" colSpan="6">Loading option positions…</td></tr>
                  ) : optPositions.length ? optPositions.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-bold">
                        <span className={p.option_type === 'CALL' ? 'text-emerald-400' : 'text-rose-400'}>{p.option_type}</span> {p.underlying_symbol} ${p.strike} {p.expiry}
                        <span className="ml-2 text-xs text-slate-500">x{p.contracts}</span>
                      </td>
                      <td className="px-4 py-3 font-mono">${Number(p.entry_price).toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono">${Number(p.mark_price).toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${Number(p.pnl) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${Number(p.pnl).toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${Number(p.pnl_percent) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Number(p.pnl_percent).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => closeOption(p.id)} className="btn-danger py-2 px-3 text-xs">Close</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td className="px-4 py-6 text-slate-500" colSpan="6">No open option positions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs text-slate-400 mb-1 uppercase">Market Cap</p>
              <p className="font-bold">$2.84T</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-400 mb-1 uppercase">P/E Ratio</p>
              <p className="font-bold">28.45</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-400 mb-1 uppercase">52W High</p>
              <p className="font-bold">$196.38</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-400 mb-1 uppercase">52W Low</p>
              <p className="font-bold">$124.17</p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold">Past Trades ({symbol})</h3>
              <div className="text-xs text-slate-500">Shows executed trades for this stock</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Qty</th>
                    <th className="px-6 py-3">Price</th>
                    <th className="px-6 py-3">Emotion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {tradeHistory.length ? tradeHistory.slice(0, 50).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-3 text-slate-300">{new Date(t.timestamp).toLocaleString()}</td>
                      <td className={`px-6 py-3 font-bold ${t.trade_type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.trade_type}</td>
                      <td className="px-6 py-3 font-mono">{t.quantity}</td>
                      <td className="px-6 py-3 font-mono">${Number(t.price).toFixed(2)}</td>
                      <td className="px-6 py-3 text-slate-400">{t.emotional_state || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td className="px-6 py-6 text-slate-500" colSpan="5">No past trades for this stock yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-6">Execution Panel</h3>
            
            {alert && (
              <div className={`p-4 rounded-lg mb-6 flex items-start gap-3 ${
                alert.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
              }`}>
                {alert.type === 'success' ? <ShieldCheck size={20} className="shrink-0" /> : <AlertTriangle size={20} className="shrink-0" />}
                <p className="text-sm font-medium">{alert.message}</p>
              </div>
            )}

            <div className="flex gap-4 mb-6">
              <div className="flex-1 flex p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button 
                  onClick={() => setOrderType('BUY')}
                  className={`flex-1 py-4 rounded-xl font-black text-sm transition-all duration-300 ${orderType === 'BUY' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  BUY
                </button>
                <button 
                  onClick={() => setOrderType('SELL')}
                  className={`flex-1 py-4 rounded-xl font-black text-sm transition-all duration-300 ${orderType === 'SELL' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  SELL
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Quantity</label>
                <input 
                  type="number" 
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input-field text-xl font-bold"
                  min="1"
                />
              </div>
              <div className="flex justify-between items-end p-4 bg-slate-900 rounded-xl border border-slate-700">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Estimated Total</p>
                <p className="text-2xl font-black text-white">${((Number(livePrice ?? stock.price)) * quantity).toLocaleString()}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  Market Order
                </div>
              </div>
            </div>

            <div className="relative">
              <button 
                onClick={handleTrade} 
                disabled={cooldown > 0}
                className={`w-full py-5 rounded-2xl font-black text-lg shadow-2xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${
                  cooldown > 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 
                  orderType === 'BUY' ? 'btn-secondary' : 'btn-danger'
                }`}
              >
                {cooldown > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock size={20} className="animate-pulse" />
                      <span>COOLDOWN ACTIVE</span>
                    </div>
                    <span className="text-xs font-mono opacity-60">Locked for {cooldown}s</span>
                  </>
                ) : (
                  `PLACE ${orderType} ORDER`
                )}
              </button>
              
              {cooldown > 0 && (
                <div className="absolute -top-12 left-0 w-full animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-center">
                    Emotional Cooldown in Effect
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-center mt-6 text-xs text-slate-500 uppercase tracking-widest font-bold">
              Emotional Guard Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDetail;

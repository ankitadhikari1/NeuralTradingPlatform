import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Treemap } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, PieChart as PieIcon, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';
import Modal from '../components/Modal';

const Portfolio = ({ onRefreshUser }) => {
  const { emotion: liveEmotion } = useEmotion();
  const [portfolio, setPortfolio] = useState([]);
  const [stocks, setStocks] = useState({});
  const [loading, setLoading] = useState(true);
  const [cashBalance, setCashBalance] = useState(0);
  const [optionPositions, setOptionPositions] = useState([]);
  const [allocationView, setAllocationView] = useState('donut');

  // Sell Modal State
  const [sellModal, setSellModal] = useState({ open: false, item: null, quantity: 1 });
  const [alert, setAlert] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sellConfirmation, setSellConfirmation] = useState({ required: false, message: '' });

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const fetchPortfolio = useCallback(async () => {
    try {
      const response = await axios.get('/trading/portfolio');
      setPortfolio(response.data);
      if (onRefreshUser) {
        const userData = await onRefreshUser();
        if (userData) setCashBalance(Number(userData.cash_balance || 0));
      } else {
        const me = await axios.get('/auth/me');
        setCashBalance(Number(me.data.cash_balance || 0));
      }
      try {
        const opt = await axios.get('/options/positions');
        setOptionPositions(opt.data || []);
      } catch {
        setOptionPositions([]);
      }
      
      // Fetch current prices for each stock in portfolio
      const stockData = {};
      await Promise.all(response.data.map(async (item) => {
        try {
          const res = await axios.get(`/trading/stocks/${item.stock_symbol}`);
          stockData[item.stock_symbol] = res.data;
        } catch (e) {
          console.error(`Failed to fetch price for ${item.stock_symbol}`);
          stockData[item.stock_symbol] = { price: item.avg_price, change_percent: 0 };
        }
      }));
      setStocks(stockData);
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    } finally {
      setLoading(false);
    }
  }, [onRefreshUser]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const ensureActiveSession = async () => {
    try {
      const active = await axios.get('/trading/session/active');
      if (active.data?.id) return active.data;
    } catch {
      // ignore
    }
    const started = await axios.post('/trading/session/start', { duration_minutes: 60 });
    return started.data;
  };

  const submitSell = async ({ confirmed = false } = {}) => {
    if (!sellModal.item) return;
    setIsSubmitting(true);
    setAlert(null);
    try {
      const item = sellModal.item;
      const qty = Math.min(Number(sellModal.quantity || 0), Number(item.quantity || 0));
      if (!Number.isFinite(qty) || qty <= 0) {
        setAlert({ type: 'error', message: 'Enter a valid quantity to sell.' });
        return;
      }

      await ensureActiveSession();

      const px = Number(stocks[item.stock_symbol]?.price || item.avg_price);
      const currentPrice = Number.isFinite(px) && px > 0 ? px : Number(item.avg_price || 0);
      const emotion = liveEmotion || { state: 'Calm', confidence: 0.0 };

      await axios.post('/trading/trade', {
        stock_symbol: item.stock_symbol,
        trade_type: 'SELL',
        quantity: qty,
        price: currentPrice,
        emotional_state: `${emotion.state} (${(emotion.confidence * 100).toFixed(0)}%)`,
        confirmed,
      });

      setAlert({ type: 'success', message: `Successfully sold ${qty} shares of ${item.stock_symbol}` });
      setSellModal({ open: false, item: null, quantity: 1 });
      setSellConfirmation({ required: false, message: '' });
      fetchPortfolio();
      if (onRefreshUser) onRefreshUser();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string' && detail.toLowerCase().includes('start a trading session')) {
        setAlert({ type: 'error', message: 'Start a trading session before selling.' });
        return;
      }
      if (typeof detail === 'object' && detail.action === 'BLOCK') {
        setCooldown(detail.cooldown_remaining || 0);
        setAlert({ type: 'error', message: detail.message });
        return;
      }
      if (typeof detail === 'object' && detail.action === 'CONFIRMATION') {
        setSellConfirmation({ required: true, message: String(detail.message || 'Please confirm to proceed.') });
        return;
      }
      setAlert({ type: 'error', message: typeof detail === 'string' ? detail : "Sell failed. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseOption = async (optionId) => {
    try {
      await axios.post(`/options/trade/${optionId}/close`);
      setAlert({ type: 'success', message: 'Option position closed successfully' });
      fetchPortfolio();
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.detail || 'Failed to close option position' });
    }
  };

  const calculateTotals = () => {
    let totalValue = 0;
    let totalCost = 0;
    
    portfolio.forEach(item => {
      const currentPrice = stocks[item.stock_symbol]?.price || item.avg_price;
      totalValue += item.quantity * currentPrice;
      totalCost += item.quantity * item.avg_price;
    });

    const profitLoss = totalValue - totalCost;
    const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

    return { totalValue, totalCost, profitLoss, profitLossPercent };
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div></div>;

  const totals = calculateTotals();
  const rawChart = portfolio
    .map((item) => {
      const value = item.quantity * (stocks[item.stock_symbol]?.price || item.avg_price);
      return {
        name: item.stock_symbol,
        value,
      };
    })
    .filter((x) => Number.isFinite(x.value) && x.value > 0)
    .sort((a, b) => b.value - a.value);

  const topN = 10;
  const top = rawChart.slice(0, topN);
  const otherValue = rawChart.slice(topN).reduce((acc, x) => acc + x.value, 0);
  const baseData = otherValue > 0 ? [...top, { name: 'OTHER', value: otherValue }] : top;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#a3e635', '#22c55e', '#eab308', '#60a5fa'];
  const allocationData = baseData.map((d, index) => ({
    ...d,
    fill: COLORS[index % COLORS.length],
    percent: totals.totalValue > 0 ? (d.value / totals.totalValue) * 100 : 0,
  }));

  const currencyFormatter = (value) => `$${Number(value || 0).toLocaleString()}`;
  const AllocationTreemapContent = (props) => {
    const { x, y, width, height, name, depth, fill } = props;
    if (depth === 0) return null;

    const showText = width >= 70 && height >= 40;
    const text = String(name || '');

    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill || '#334155'} stroke="#0f172a" strokeWidth={2} rx={10} ry={10} />
        {showText && (
          <text x={x + 10} y={y + 22} fill="#0b1220" fontSize={12} fontWeight={800}>
            {text.length > 10 ? `${text.slice(0, 10)}…` : text}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Your Portfolio</h1>
        <p className="text-slate-400">Total value and asset distribution</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 col-span-1 md:col-span-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-600/20 rounded-xl text-blue-500">
              <Wallet size={24} />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Value</p>
          </div>
          <h2 className="text-4xl font-black">${totals.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          <div className={`mt-4 flex items-center gap-2 font-bold ${totals.profitLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {totals.profitLoss >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            <span>${Math.abs(totals.profitLoss).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({totals.profitLossPercent.toFixed(2)}%)</span>
            <span className="text-slate-500 font-normal ml-2 text-sm">All Time Profit/Loss</span>
          </div>
          <div className="mt-4 text-sm text-slate-400">
            Cash: <span className="font-mono text-emerald-400">${cashBalance.toLocaleString()}</span>
          </div>
        </div>

        <div className="card p-6 md:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Allocation</p>
              <p className="text-xs text-slate-500 mt-1">Choose a chart view</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-900/40 border border-slate-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setAllocationView('donut')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  allocationView === 'donut' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'
                }`}
              >
                Donut
              </button>
              <button
                type="button"
                onClick={() => setAllocationView('bar')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  allocationView === 'bar' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'
                }`}
              >
                Bars
              </button>
              <button
                type="button"
                onClick={() => setAllocationView('treemap')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  allocationView === 'treemap' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'
                }`}
              >
                Treemap
              </button>
            </div>
          </div>

          {allocationData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-500">
              No holdings to chart
            </div>
          ) : allocationView === 'donut' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#0f172a"
                      strokeWidth={2}
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value, name, props) => [`${currencyFormatter(value)} • ${(props?.payload?.percent || 0).toFixed(1)}%`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {allocationData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/30 border border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-sm font-semibold text-slate-100 truncate">{d.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-slate-200">{currencyFormatter(d.value)}</p>
                      <p className="text-xs text-slate-400">{d.percent.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : allocationView === 'bar' ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allocationData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                    tickLine={false}
                    tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#cbd5e1', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value, name, props) => [`${currencyFormatter(value)} • ${(props?.payload?.percent || 0).toFixed(1)}%`, 'Value']}
                    labelStyle={{ color: '#e2e8f0' }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
                  />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                    {allocationData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={allocationData}
                  dataKey="value"
                  content={<AllocationTreemapContent />}
                  isAnimationActive={false}
                >
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value, name, props) => [`${currencyFormatter(value)} • ${(props?.payload?.percent || 0).toFixed(1)}%`, 'Value']}
                    labelStyle={{ color: '#e2e8f0' }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {alert && (
          <div className={`m-4 p-4 rounded-lg flex items-start gap-3 ${
            alert.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
          }`}>
            {alert.type === 'success' ? <ShieldCheck size={20} className="shrink-0" /> : <AlertTriangle size={20} className="shrink-0" />}
            <p className="text-sm font-medium">{alert.message}</p>
          </div>
        )}
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">Avg Price</th>
              <th className="px-6 py-4">Current Price</th>
              <th className="px-6 py-4 text-right">Market Value</th>
              <th className="px-6 py-4 text-right">Profit / Loss</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {portfolio.length > 0 ? (
              portfolio.map((item) => {
                const stock = stocks[item.stock_symbol];
                const currentPrice = stock?.price || item.avg_price;
                const marketValue = item.quantity * currentPrice;
                const costBasis = item.quantity * item.avg_price;
                const pl = marketValue - costBasis;
                const plPercent = (pl / costBasis) * 100;

                return (
                  <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold">
                          {item.stock_symbol[0]}
                        </div>
                        <div>
                          <p className="font-bold">{item.stock_symbol}</p>
                          <p className="text-xs text-slate-500">{stock?.company_name || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{item.quantity}</td>
                    <td className="px-6 py-4 text-slate-300">${item.avg_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-300">${currentPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-bold">${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className={`px-6 py-4 text-right font-bold ${pl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <p>${pl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs font-medium">{plPercent.toFixed(2)}%</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          setAlert(null);
                          setSellConfirmation({ required: false, message: '' });
                          setSellModal({ open: true, item, quantity: 1 });
                        }}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={Number(item.quantity || 0) <= 0}
                      >
                        SELL
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                  <PieIcon size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Your portfolio is empty</p>
                  <p className="text-sm">Start trading to see your assets here</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Open Options</h2>
        {optionPositions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Contract</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Mark</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                  <th className="px-4 py-3 text-right">P/L %</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {optionPositions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-bold">{p.underlying_symbol} {p.option_type} {p.strike} {p.expiry} x{p.contracts}</td>
                    <td className="px-4 py-3 font-mono">${Number(p.entry_price).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">${Number(p.mark_price).toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${Number(p.pnl) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${Number(p.pnl).toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${Number(p.pnl_percent) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Number(p.pnl_percent).toFixed(2)}%</td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => handleCloseOption(p.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 text-xs font-bold"
                      >
                        CLOSE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500">No open options positions.</p>
        )}
      </div>

      {/* Quick Sell Modal */}
      <Modal 
        open={sellModal.open}
        onClose={() => {
          setSellModal({ open: false, item: null, quantity: 1 });
          setSellConfirmation({ required: false, message: '' });
        }}
        title={`Quick Sell: ${sellModal.item?.stock_symbol}`}
        onConfirm={() => submitSell({ confirmed: sellConfirmation.required })}
        confirmText={
          isSubmitting ? 'Processing…' : cooldown > 0 ? `Locked (${cooldown}s)` : sellConfirmation.required ? 'Confirm Sale' : 'Sell'
        }
        cancelText={sellConfirmation.required ? 'Back' : 'Cancel'}
        tone={sellConfirmation.required ? 'secondary' : 'danger'}
      >
        <div className="space-y-6">
          {sellConfirmation.required && (
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
              {sellConfirmation.message}
            </div>
          )}

          {alert && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              alert.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
            }`}>
              {alert.type === 'success' ? <ShieldCheck size={20} className="shrink-0" /> : <AlertTriangle size={20} className="shrink-0" />}
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
          )}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Current Price</span>
              <span className="font-mono text-white text-lg">${(stocks[sellModal.item?.stock_symbol]?.price || 0).toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Available</span>
              <span className="font-mono text-blue-400 text-lg">{sellModal.item?.quantity} shares</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quantity to Sell</label>
            <div className="flex items-center gap-4">
              <input 
                type="number"
                min="1"
                max={sellModal.item?.quantity}
                value={sellModal.quantity}
                onChange={(e) => setSellModal({ ...sellModal, quantity: Number(e.target.value) })}
                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:border-blue-500"
                disabled={sellConfirmation.required || isSubmitting}
              />
              <button 
                onClick={() => setSellModal({ ...sellModal, quantity: sellModal.item?.quantity })}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                disabled={sellConfirmation.required || isSubmitting}
              >
                MAX
              </button>
            </div>
          </div>

          {sellModal.item && (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Projected P/L</span>
                <div className="text-right">
                  <p className={`text-lg font-black font-mono ${
                    ((stocks[sellModal.item.stock_symbol]?.price || 0) - sellModal.item.avg_price) * sellModal.quantity >= 0 
                    ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {((stocks[sellModal.item.stock_symbol]?.price || 0) - sellModal.item.avg_price) * sellModal.quantity >= 0 ? '+' : ''}
                    ${(((stocks[sellModal.item.stock_symbol]?.price || 0) - sellModal.item.avg_price) * sellModal.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">
                    Sale proceeds: ${((stocks[sellModal.item.stock_symbol]?.price || 0) * sellModal.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Portfolio;

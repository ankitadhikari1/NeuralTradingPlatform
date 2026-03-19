import React, { useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Activity, Play, AlertCircle, TrendingUp, TrendingDown, Info, ChevronRight, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';

const TradingSimulator = () => {
  const [mode, setMode] = useState('calm');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simResults, setSimResults] = useState([]);
  const [showTrades, setShowTrades] = useState(false);

  const emotionInsights = {
    calm: {
      title: 'Rational Precision',
      desc: 'Focuses on high-probability setups, consistent risk management, and patient execution. Minimal impulsive errors.',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    stress: {
      title: 'Panic Response',
      desc: 'Prone to "revenge trading" after losses, cutting winners too early, and freezing during high volatility.',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10'
    },
    excitement: {
      title: 'FOMO Overload',
      desc: 'Over-leveraging due to overconfidence, chasing parabolic moves, and ignoring stop losses.',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10'
    }
  };

  const runSimulation = async () => {
    setLoading(true);
    try {
      const resp = await axios.post('/ai/simulate', { mode });
      const data = resp.data;
      
      // Generate equity curve data
      let currentEquity = 0;
      const equityCurve = data.trades.map((t, idx) => {
        currentEquity += t.pnl;
        return { name: `T${idx + 1}`, equity: currentEquity };
      });
      
      const enrichedResult = { ...data, equityCurve };
      setResult(enrichedResult);
      
      // Update historical results for the bar chart
      setSimResults(prev => {
        const next = [...prev, {
          name: data.emotion,
          profit: data.total_profit,
          color: data.emotion === 'Calm' ? '#10b981' : 
                 data.emotion === 'Stress' ? '#ef4444' : '#f59e0b'
        }];
        return next.slice(-5); // Keep last 5
      });
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 bg-slate-900/40 backdrop-blur-xl border-slate-700/50">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-xl text-blue-500">
            <Activity size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Emotional Trading Simulator</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Psychology Impact Analysis</p>
          </div>
        </div>
        <button 
          onClick={runSimulation}
          disabled={loading}
          className="w-full md:w-auto btn-secondary py-3 px-8 flex items-center justify-center gap-3 text-sm font-black shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
        >
          {loading ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div> : <Play size={18} />}
          RUN {mode.toUpperCase()} SIMULATION
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls & Insights */}
        <div className="lg:col-span-4 space-y-6">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Simulation Mode</label>
            <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              {['calm', 'stress', 'excitement'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all duration-300 ${
                    mode === m 
                      ? (m === 'calm' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : m === 'stress' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'bg-amber-600 text-white shadow-lg shadow-amber-900/20')
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className={`p-5 rounded-2xl border border-slate-800 transition-all duration-500 ${emotionInsights[mode].bg}`}>
            <h4 className={`text-sm font-black uppercase tracking-tight mb-2 ${emotionInsights[mode].color}`}>
              {emotionInsights[mode].title}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {emotionInsights[mode].desc}
            </p>
          </div>

          <div className="h-[180px] w-full bg-slate-950/30 rounded-2xl border border-slate-800 p-4">
            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Global Benchmarks</label>
            {simResults.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simResults}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 8, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 8, fontWeight: 'bold' }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {simResults.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-700 text-[8px] font-black uppercase tracking-widest">
                No data points collected
              </div>
            )}
          </div>
        </div>

        {/* Results & Charts */}
        <div className="lg:col-span-8 space-y-6">
          {result ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total P/L</p>
                  <p className={`text-2xl font-black ${result.total_profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {result.total_profit >= 0 ? '+' : ''}${result.total_profit.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Win Rate</p>
                  <p className="text-2xl font-black text-white">{result.win_rate}%</p>
                </div>
                <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Avg Trade</p>
                  <p className="text-2xl font-black text-blue-400">
                    ${(result.total_profit / result.num_trades).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Equity Growth Curve</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Simulated Performance</span>
                  </div>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.equityCurve}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                        tickFormatter={(val) => `$${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="equity" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorEquity)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card overflow-hidden">
                <button 
                  onClick={() => setShowTrades(!showTrades)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                >
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Trade-by-Trade Log</h4>
                  {showTrades ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                </button>
                {showTrades && (
                  <div className="overflow-x-auto border-t border-slate-800">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-700/30 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                          <th className="px-6 py-3">Sequence</th>
                          <th className="px-6 py-3">Asset</th>
                          <th className="px-6 py-3">Result</th>
                          <th className="px-6 py-3 text-right">Profit/Loss</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {result.trades.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-700/20 transition-colors">
                            <td className="px-6 py-3 text-xs font-bold text-slate-400">{t.timestamp}</td>
                            <td className="px-6 py-3 text-xs font-black text-blue-500">{t.symbol}</td>
                            <td className="px-6 py-3">
                              <span className={`flex items-center gap-2 text-xs font-black uppercase ${t.result === 'WIN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {t.result === 'WIN' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                {t.result}
                              </span>
                            </td>
                            <td className={`px-6 py-3 text-right font-mono text-xs font-black ${t.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-950/20 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center">
              <div className="p-6 bg-slate-900/50 rounded-full mb-6 relative">
                <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-10 animate-pulse"></div>
                <Activity className="text-slate-700 relative" size={64} />
              </div>
              <h4 className="text-xl font-black text-white uppercase tracking-tight mb-2">Simulation Ready</h4>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest max-w-md">
                Select an emotional mode and run the simulator to visualize the impact on your trading strategy.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingSimulator;

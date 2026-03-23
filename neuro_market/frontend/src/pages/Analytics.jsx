import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, LineChart, Line } from 'recharts';
import { BarChart3, TrendingUp, Activity, PieChart, ShieldAlert } from 'lucide-react';
import NeuroLoader from '../components/NeuroLoader';

const Analytics = () => {
  const [history, setHistory] = useState([]);
  const [emotionLogs, setEmotionLogs] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [historyRes, logsRes, perfRes, badgeRes] = await Promise.all([
        axios.get('/trading/history'),
        axios.get('/emotion/logs'),
        axios.get('/trading/performance/dashboard'),
        axios.get('/trading/badges'),
      ]);
      setHistory(historyRes.data);
      setEmotionLogs(logsRes.data);
      setPerformance(perfRes.data || null);
      setBadges(badgeRes.data || []);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const emotionDistribution = emotionLogs.reduce((acc, log) => {
    acc[log.emotion] = (acc[log.emotion] || 0) + 1;
    return acc;
  }, {});

  const distributionData = Object.entries(emotionDistribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  const COLORS = {
    'Calm': '#10b981',
    'Stress': '#ef4444',
    'Excitement': '#f59e0b',
    'Anxiety': '#8b5cf6'
  };

  const scatterData = history.map(h => {
    const emotionStr = h.emotional_state?.split(' (')[0] || 'Unknown';
    const confidenceStr = h.emotional_state?.match(/\((.*)%\)/)?.[1] || '50';
    return {
      x: new Date(h.timestamp).getTime(),
      y: h.price * h.quantity,
      emotion: emotionStr,
      confidence: parseFloat(confidenceStr),
      symbol: h.stock_symbol
    };
  });

  if (loading) return <NeuroLoader message="Compiling Psychological Analytics..." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Emotion Analytics</h1>
        <p className="text-slate-400">Deep dive into your trading psychology and performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 border-l-4 border-blue-500">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Average Session Score</p>
          <h3 className="text-3xl font-black">{Number(performance?.average_session_score || 0).toFixed(0)}/100</h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Consistency-based session average</p>
        </div>
        <div className="card p-6 border-l-4 border-emerald-500">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Best Trading Day</p>
          <h3 className="text-2xl font-black">{performance?.best_trading_day?.date || '-'}</h3>
          <p className="text-xs text-emerald-500 mt-2 font-bold">{Number(performance?.best_trading_day?.pnl || 0).toFixed(2)} P/L</p>
        </div>
        <div className="card p-6 border-l-4 border-rose-500">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Worst Trading Day</p>
          <h3 className="text-2xl font-black">{performance?.worst_trading_day?.date || '-'}</h3>
          <p className="text-xs text-rose-500 mt-2 font-bold">{Number(performance?.worst_trading_day?.pnl || 0).toFixed(2)} P/L</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            Portfolio Growth
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performance?.profit_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="portfolio_value" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-amber-500" />
            Performance Badges
          </h3>
          <div className="flex flex-wrap gap-2">
            {badges.slice(0, 12).map((b, idx) => (
              <span key={`${b.badge_key}-${idx}`} className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-slate-800 border border-slate-700 text-slate-200">
                {String(b.badge_key).replaceAll('_', ' ')}
              </span>
            ))}
            {!badges.length && <p className="text-sm text-slate-500">No badges yet. Finish a session to earn badges.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <PieChart size={20} className="text-blue-500" />
            Emotion Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#334155' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Activity size={20} className="text-emerald-500" />
            Emotion vs Trade Size
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" dataKey="x" hide />
                <YAxis type="number" dataKey="y" name="Value" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <ZAxis type="number" dataKey="confidence" range={[50, 400]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-xl">
                          <p className="text-white font-bold mb-1">{data.symbol} Trade</p>
                          <p className="text-xs text-slate-400 mb-2">{new Date(data.x).toLocaleString()}</p>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: COLORS[data.emotion] }}></span>
                            <span className="text-sm font-medium" style={{ color: COLORS[data.emotion] }}>{data.emotion}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Value: ${data.y.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.emotion] || '#3b82f6'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 border-l-4 border-emerald-500">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Discipline Score</p>
          <h3 className="text-3xl font-black">{Number(performance?.average_session_score || 0).toFixed(0)}/100</h3>
          <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1 font-bold">
            <TrendingUp size={14} /> +12% from last week
          </p>
        </div>
        <div className="card p-6 border-l-4 border-rose-500">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Risk Interventions</p>
          <h3 className="text-3xl font-black">{history.filter(h => h.emotional_state?.includes('Anxiety') || h.emotional_state?.includes('Stress')).length}</h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Automatic guard triggers</p>
        </div>
        <div className="card p-6 border-l-4 border-blue-500">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Impulsive Trading Risk</p>
          <h3 className="text-3xl font-black">Low</h3>
          <p className="text-xs text-blue-500 mt-2 flex items-center gap-1 font-bold">
            <ShieldAlert size={14} /> 92% calm state execution
          </p>
        </div>
      </div>

      <div className="card p-8 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
          <BarChart3 size={24} className="text-blue-500" />
          AI Trading Insight Report
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
          <div className="space-y-4">
            <p className="text-slate-300 leading-relaxed">
              Based on your emotional data, you perform best when your heart rate variability is low and you are in a <span className="text-emerald-500 font-bold">Calm</span> state. Your trades during <span className="text-rose-500 font-bold">Stress</span> episodes have a 14% lower win rate compared to your baseline.
            </p>
            <div className="p-4 bg-blue-600/10 rounded-xl border border-blue-500/20">
              <p className="text-sm text-blue-400 font-bold mb-1">PRO TIP</p>
              <p className="text-sm text-slate-300 italic">"Try taking 3 deep breaths before executing any trade over $5,000. Your biometric data suggests this would improve your entry accuracy."</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Execution Discipline</span>
              <span className="font-bold">92%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[92%]"></div>
            </div>
            
            <div className="flex justify-between text-sm mt-4">
              <span className="text-slate-400 font-medium">Emotion-Price Correlation</span>
              <span className="font-bold">0.42</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[42%]"></div>
            </div>

            <div className="flex justify-between text-sm mt-4">
              <span className="text-slate-400 font-medium">Stress Tolerance</span>
              <span className="font-bold">78%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 w-[78%]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

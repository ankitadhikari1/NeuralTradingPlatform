import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { RefreshCcw, Download, Filter } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const SessionHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = [];
      if (fromDate) qs.push(`from_date=${encodeURIComponent(fromDate)}`);
      if (toDate) qs.push(`to_date=${encodeURIComponent(toDate)}`);
      const resp = await axios.get(`/trading/sessions${qs.length ? `?${qs.join('&')}` : ''}`);
      setSessions(resp.data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const equitySeries = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    let running = 0;
    return sorted.map((s) => {
      running += Number(s.profit_loss || 0);
      return { date: s.session_date, equity: Number(running.toFixed(2)) };
    });
  }, [sessions]);

  const downloadPdf = async (sessionId) => {
    try {
      const resp = await axios.get(`/trading/sessions/${sessionId}/report`, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_${sessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to download report');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Session History</h1>
          <p className="text-slate-400">View past sessions, reports, and quick performance</p>
        </div>
        <button onClick={fetchSessions} className="btn-primary flex items-center gap-2">
          <RefreshCcw size={18} /> Refresh
        </button>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-slate-300" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filters</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">From</label>
            <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} type="date" className="input-field" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">To</label>
            <input value={toDate} onChange={(e) => setToDate(e.target.value)} type="date" className="input-field" />
          </div>
          <button onClick={fetchSessions} className="btn-secondary h-11">Apply</button>
        </div>
        {error && <p className="mt-4 text-rose-500 font-bold">{error}</p>}
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Equity Curve (Sessions)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equitySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold">Sessions</h2>
          <p className="text-xs text-slate-500">{sessions.length} results</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Trades</th>
                  <th className="px-4 py-3">Win Rate</th>
                  <th className="px-4 py-3">P/L</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">
                      <Link to={`/sessions/${s.id}`} className="underline decoration-dotted">{s.session_date}</Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {Math.max(0, Math.round(Number(s.duration_seconds || 0) / 60))}m
                    </td>
                    <td className="px-4 py-3 font-mono">{Number(s.trades_count || 0)}</td>
                    <td className="px-4 py-3 font-mono">{Number(s.win_rate || 0).toFixed(2)}%</td>
                    <td className={`px-4 py-3 font-mono ${Number(s.profit_loss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(s.profit_loss || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono">{Number(s.risk_score || 0).toFixed(0)}/100</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => downloadPdf(s.id)}
                        disabled={!s.report_available}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          s.report_available ? 'btn-secondary' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Download size={14} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {!sessions.length && <tr><td className="px-4 py-6 text-slate-500" colSpan="7">No sessions found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionHistory;

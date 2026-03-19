import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { Download, RefreshCcw, ArrowLeft, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';

const SessionDetail = () => {
  const { id } = useParams();
  const sessionId = Number(id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await axios.get(`/trading/sessions/${sessionId}`);
      setData(resp.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    fetchDetail();
  }, [sessionId, fetchDetail]);

  const downloadPdf = async () => {
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

  const replayEvents = useMemo(() => {
    const events = (data?.events || []).map((e) => {
      let payload = null;
      try {
        payload = e.payload ? JSON.parse(e.payload) : null;
      } catch {
        payload = null;
      }
      return { ...e, parsed: payload, ts: new Date(e.created_at).getTime() };
    });
    events.sort((a, b) => a.ts - b.ts);
    return events;
  }, [data]);

  const equityCurve = useMemo(() => {
    const pnlEvents = replayEvents
      .filter((e) => e.event_type === 'TRADE_EXECUTED' || e.event_type === 'OPTION_CLOSED')
      .map((e) => {
        const pnl = Number(e?.parsed?.realized_pnl ?? e?.parsed?.pnl ?? 0);
        return { ts: e.ts, pnl };
      })
      .filter((x) => Number.isFinite(x.pnl));

    pnlEvents.sort((a, b) => a.ts - b.ts);
    let running = 0;
    return pnlEvents.map((x) => {
      running += x.pnl;
      return { time: new Date(x.ts).toLocaleTimeString(), equity: Number(running.toFixed(2)) };
    });
  }, [replayEvents]);

  const winLoss = useMemo(() => {
    let wins = 0;
    let losses = 0;
    replayEvents.forEach((e) => {
      if (e.event_type !== 'TRADE_EXECUTED' && e.event_type !== 'OPTION_CLOSED') return;
      const pnl = Number(e?.parsed?.realized_pnl ?? e?.parsed?.pnl);
      if (!Number.isFinite(pnl)) return;
      if (pnl >= 0) wins += 1;
      else losses += 1;
    });
    return [
      { name: 'Wins', value: wins, fill: '#10b981' },
      { name: 'Losses', value: losses, fill: '#ef4444' },
    ];
  }, [replayEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 border border-rose-500/30 bg-rose-500/10">
        <p className="text-rose-400 font-bold mb-2">Session failed to load</p>
        <p className="text-sm text-slate-300 mb-4">{error}</p>
        <button onClick={fetchDetail} className="btn-primary flex items-center gap-2">
          <RefreshCcw size={18} /> Retry
        </button>
      </div>
    );
  }

  const s = data?.session;
  const riskAlerts = replayEvents.filter((e) => e.event_type === 'RISK_ALERT');

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/sessions" className="btn-secondary flex items-center gap-2">
            <ArrowLeft size={18} /> Back
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Session {sessionId}</h1>
            <p className="text-slate-400">
              {s?.started_at ? new Date(s.started_at).toLocaleString() : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDetail} className="btn-secondary flex items-center gap-2">
            <RefreshCcw size={18} /> Refresh
          </button>
          <button onClick={downloadPdf} disabled={!s?.report_path} className={s?.report_path ? 'btn-primary flex items-center gap-2' : 'bg-slate-700 text-slate-500 px-4 py-2 rounded-lg cursor-not-allowed'}>
            <Download size={18} /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Trades</p>
          <h3 className="text-3xl font-black">{Number(s?.total_trades || 0)}</h3>
        </div>
        <div className="card p-6">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Win Rate</p>
          <h3 className="text-3xl font-black">{Number(s?.win_rate || 0).toFixed(2)}%</h3>
        </div>
        <div className="card p-6">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">P/L</p>
          <h3 className={`text-3xl font-black ${Number(s?.profit_loss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {Number(s?.profit_loss || 0).toFixed(2)}
          </h3>
        </div>
        <div className="card p-6">
          <p className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-widest">Risk</p>
          <h3 className="text-3xl font-black">{Number(s?.risk_score || 0).toFixed(0)}/100</h3>
        </div>
      </div>

      {riskAlerts.length > 0 && (
        <div className="card p-6 border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-400" />
            <p className="text-amber-300 font-bold">Risk Alerts</p>
          </div>
          <div className="space-y-2">
            {riskAlerts.slice(-5).map((e) => (
              <div key={e.id} className="text-sm text-slate-200 flex items-center justify-between">
                <span className="font-mono">{new Date(e.created_at).toLocaleTimeString()}</span>
                <span className="text-slate-300">{e.payload}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h3 className="text-xl font-bold mb-4">Equity Curve</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-xl font-bold mb-4">Win vs Loss</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winLoss}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="value">
                  {winLoss.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-xl font-bold mb-4">AI Coach Recommendations</h3>
        <ul className="space-y-2">
          {(data?.recommendations || []).map((r, idx) => (
            <li key={idx} className="text-slate-200 text-sm">- {r}</li>
          ))}
        </ul>
      </div>

      <div className="card p-6">
        <h3 className="text-xl font-bold mb-4">Session Replay</h3>
        <div className="max-h-[420px] overflow-auto divide-y divide-slate-700">
          {replayEvents.map((e) => (
            <div key={e.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-mono">{new Date(e.created_at).toLocaleString()}</p>
                <p className="text-sm font-bold text-white">{e.event_type}</p>
                {e.payload && <p className="text-xs text-slate-300 break-words">{e.payload}</p>}
              </div>
            </div>
          ))}
          {!replayEvents.length && <div className="py-6 text-slate-500">No events recorded</div>}
        </div>
      </div>
    </div>
  );
};

export default SessionDetail;

import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { UserCog, Search, RefreshCcw, ListTree, BarChart3, History, Brain, Download, Filter } from 'lucide-react';

const Admin = ({ onRefreshUser }) => {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('topup');
  const [result, setResult] = useState('');
  const [inspectUser, setInspectUser] = useState('');
  const [tab, setTab] = useState('portfolio'); // portfolio | trades | options | emotions
  const [inspectLoading, setInspectLoading] = useState(false);
  const [portfolio, setPortfolio] = useState([]);
  const [trades, setTrades] = useState([]);
  const [options, setOptions] = useState([]);
  const [emotions, setEmotions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionStats, setSessionStats] = useState(null);
  const [sessionUserQ, setSessionUserQ] = useState('');
  const [sessionFrom, setSessionFrom] = useState('');
  const [sessionTo, setSessionTo] = useState('');
  const [sessionMinProfit, setSessionMinProfit] = useState('');
  const [sessionMaxProfit, setSessionMaxProfit] = useState('');

  const fetchUsers = useCallback(async (query) => {
    setLoading(true);
    setError('');
    try {
      const qv = String(query || '');
      const resp = await axios.get(`/admin/users${qv ? `?q=${encodeURIComponent(qv)}` : ''}`);
      setUsers(resp.data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessionStats = useCallback(async () => {
    try {
      const resp = await axios.get('/admin/sessions/stats');
      setSessionStats(resp.data || null);
    } catch {
      setSessionStats(null);
    }
  }, []);

  const fetchSessions = useCallback(async (filters = {}) => {
    setError('');
    try {
      const f = filters || {};
      const qs = [];
      if (f.user) qs.push(`user=${encodeURIComponent(String(f.user))}`);
      if (f.from_date) qs.push(`from_date=${encodeURIComponent(String(f.from_date))}`);
      if (f.to_date) qs.push(`to_date=${encodeURIComponent(String(f.to_date))}`);
      if (f.min_profit !== '' && f.min_profit != null) qs.push(`min_profit=${encodeURIComponent(String(f.min_profit))}`);
      if (f.max_profit !== '' && f.max_profit != null) qs.push(`max_profit=${encodeURIComponent(String(f.max_profit))}`);
      const resp = await axios.get(`/admin/sessions${qs.length ? `?${qs.join('&')}` : ''}`);
      setSessions(resp.data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load sessions');
    }
  }, []);

  useEffect(() => {
    fetchUsers('');
    fetchSessionStats();
    fetchSessions({});
  }, [fetchSessions, fetchSessionStats, fetchUsers]);

  const downloadSessionReport = async (sessionId) => {
    try {
      const resp = await axios.get(`/admin/session/${sessionId}/report`, { responseType: 'blob' });
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

  const submit = async (e) => {
    e.preventDefault();
    setResult('');
    setError('');
    try {
      const endpoint = mode === 'set' ? '/admin/balance/set' : '/admin/balance/topup';
      const resp = await axios.post(endpoint, {
        username: targetUsername,
        amount: Number(amount),
      });
      setResult(`${resp.data.username} balance: ${Number(resp.data.cash_balance).toLocaleString()}`);
      await fetchUsers(q);
      if (onRefreshUser) onRefreshUser();
    } catch (e2) {
      setError(e2?.response?.data?.detail || e2?.message || 'Failed to update balance');
    }
  };

  const loadInspect = async (u, t = tab) => {
    if (!u) return;
    setInspectLoading(true);
    setError('');
    try {
      if (t === 'portfolio') {
        const resp = await axios.get(`/admin/user/${encodeURIComponent(u)}/portfolio`);
        setPortfolio(resp.data || []);
      } else if (t === 'trades') {
        const resp = await axios.get(`/admin/user/${encodeURIComponent(u)}/trades`);
        setTrades(resp.data || []);
      } else if (t === 'options') {
        const resp = await axios.get(`/admin/user/${encodeURIComponent(u)}/options`);
        setOptions(resp.data || []);
      } else if (t === 'emotions') {
        const resp = await axios.get(`/admin/user/${encodeURIComponent(u)}/emotions`);
        setEmotions(resp.data || []);
      }
    } catch (e3) {
      setError(e3?.response?.data?.detail || e3?.message || 'Failed to load data');
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="text-blue-500" /> Admin Console
          </h1>
          <p className="text-slate-400">Manage user balances</p>
        </div>
        <button onClick={() => fetchUsers(q)} className="btn-primary flex items-center gap-2">
          <RefreshCcw size={18} /> Refresh
        </button>
      </div>

      <div className="card p-6">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Username</label>
            <input value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} className="input-field" placeholder="e.g. testuser" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Amount</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" placeholder="e.g. 5000" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="input-field">
              <option value="topup">Top Up (+)</option>
              <option value="set">Set (=)</option>
            </select>
          </div>
          <button className="btn-secondary h-11" type="submit">Apply</button>
        </form>
        {result && <p className="mt-4 text-emerald-500 font-bold">{result}</p>}
        {error && <p className="mt-4 text-rose-500 font-bold">{error}</p>}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold">Users</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers(q)}
              className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
              placeholder="Search username…"
            />
          </div>
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
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Cash Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => { setInspectUser(u.username); setTab('portfolio'); loadInspect(u.username, 'portfolio'); }}>
                    <td className="px-4 py-3 font-bold text-white underline decoration-dotted">{u.username}</td>
                    <td className="px-4 py-3 text-slate-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${u.is_admin ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' : 'bg-slate-600/10 text-slate-300 border border-slate-600/30'}`}>
                        {u.is_admin ? 'ADMIN' : 'USER'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">${Number(u.cash_balance || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold">Session Analytics</h2>
            <p className="text-slate-400 text-xs">All trading sessions and reports</p>
          </div>
          <button onClick={() => { fetchSessionStats(); fetchSessions({ user: sessionUserQ, from_date: sessionFrom, to_date: sessionTo, min_profit: sessionMinProfit, max_profit: sessionMaxProfit }); }} className="btn-secondary flex items-center gap-2">
            <RefreshCcw size={18} /> Refresh
          </button>
        </div>

        {sessionStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/30">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total Users</p>
              <p className="text-2xl font-black">{sessionStats.total_users}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/30">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total Sessions</p>
              <p className="text-2xl font-black">{sessionStats.total_sessions}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/30">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Avg Performance</p>
              <p className="text-2xl font-black">{Number(sessionStats.average_trader_performance || 0).toFixed(2)}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/30">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Risk Distribution</p>
              <p className="text-xs text-slate-300 mt-1 font-mono">
                low:{sessionStats?.risk_distribution?.low ?? 0} • medium:{sessionStats?.risk_distribution?.medium ?? 0} • high:{sessionStats?.risk_distribution?.high ?? 0}
              </p>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/20 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} className="text-slate-300" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filters</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">User</label>
              <input value={sessionUserQ} onChange={(e) => setSessionUserQ(e.target.value)} className="input-field" placeholder="username…" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">From</label>
              <input value={sessionFrom} onChange={(e) => setSessionFrom(e.target.value)} type="date" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">To</label>
              <input value={sessionTo} onChange={(e) => setSessionTo(e.target.value)} type="date" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Min P/L</label>
              <input value={sessionMinProfit} onChange={(e) => setSessionMinProfit(e.target.value)} className="input-field" placeholder="-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Max P/L</label>
              <input value={sessionMaxProfit} onChange={(e) => setSessionMaxProfit(e.target.value)} className="input-field" placeholder="5000" />
            </div>
            <button onClick={() => fetchSessions({ user: sessionUserQ, from_date: sessionFrom, to_date: sessionTo, min_profit: sessionMinProfit, max_profit: sessionMaxProfit })} className="btn-primary h-11">Apply</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
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
                <tr key={s.session_id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-white">{s.user_name}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{s.session_date}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{Math.max(0, Math.round(Number(s.session_duration || 0) / 60))}m</td>
                  <td className="px-4 py-3 font-mono">{Number(s.trades_count || 0)}</td>
                  <td className="px-4 py-3 font-mono">{Number(s.win_rate || 0).toFixed(2)}%</td>
                  <td className={`px-4 py-3 font-mono ${Number(s.profit_loss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(s.profit_loss || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono">{Number(s.risk_score || 0).toFixed(0)}/100</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => downloadSessionReport(s.session_id)}
                      disabled={!s.report_path}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                        s.report_path ? 'btn-secondary' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Download size={14} /> Report
                    </button>
                  </td>
                </tr>
              ))}
              {!sessions.length && <tr><td className="px-4 py-6 text-slate-500" colSpan="8">No sessions</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {inspectUser && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Inspect: {inspectUser}</h2>
              <p className="text-slate-400 text-xs">Holdings, trades, emotions, and options</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest border ${tab === 'portfolio' ? 'bg-slate-700 text-white border-slate-600' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                onClick={() => { setTab('portfolio'); loadInspect(inspectUser, 'portfolio'); }}
                title="Portfolio"
              >
                <ListTree size={14} className="inline mr-2" /> Portfolio
              </button>
              <button
                className={`px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest border ${tab === 'trades' ? 'bg-slate-700 text-white border-slate-600' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                onClick={() => { setTab('trades'); loadInspect(inspectUser, 'trades'); }}
                title="Trades"
              >
                <History size={14} className="inline mr-2" /> Trades
              </button>
              <button
                className={`px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest border ${tab === 'options' ? 'bg-slate-700 text-white border-slate-600' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                onClick={() => { setTab('options'); loadInspect(inspectUser, 'options'); }}
                title="Options"
              >
                <BarChart3 size={14} className="inline mr-2" /> Options
              </button>
              <button
                className={`px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest border ${tab === 'emotions' ? 'bg-slate-700 text-white border-slate-600' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                onClick={() => { setTab('emotions'); loadInspect(inspectUser, 'emotions'); }}
                title="Emotions"
              >
                <Brain size={14} className="inline mr-2" /> Emotions
              </button>
            </div>
          </div>

          {inspectLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : tab === 'portfolio' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {portfolio.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-white">{p.stock_symbol}</td>
                      <td className="px-4 py-3">{p.quantity}</td>
                      <td className="px-4 py-3">${Number(p.avg_price).toFixed(2)}</td>
                    </tr>
                  ))}
                  {portfolio.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="3">No holdings</td></tr>}
                </tbody>
              </table>
            </div>
          ) : tab === 'trades' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Emotion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {trades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(t.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-white">{t.stock_symbol}</td>
                      <td className={`px-4 py-3 font-bold ${t.trade_type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.trade_type}</td>
                      <td className="px-4 py-3">{t.quantity}</td>
                      <td className="px-4 py-3">${Number(t.price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{t.emotional_state || '-'}</td>
                    </tr>
                  ))}
                  {trades.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="6">No trades</td></tr>}
                </tbody>
              </table>
            </div>
          ) : tab === 'options' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3">Contract</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Exit</th>
                    <th className="px-4 py-3">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {options.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-white">{o.underlying_symbol} {o.option_type} {o.strike} {o.expiry} x{o.contracts}</td>
                      <td className="px-4 py-3">{o.status}</td>
                      <td className="px-4 py-3">${Number(o.entry_price).toFixed(2)}</td>
                      <td className="px-4 py-3">{o.exit_price != null ? `$${Number(o.exit_price).toFixed(2)}` : '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(o.opened_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {options.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="5">No options</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Emotion</th>
                    <th className="px-4 py-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {emotions.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-white capitalize">{e.emotion}</td>
                      <td className="px-4 py-3">{(Number(e.confidence) * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                  {emotions.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="3">No logs</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Admin;

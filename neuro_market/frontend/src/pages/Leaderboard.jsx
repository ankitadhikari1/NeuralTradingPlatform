import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { RefreshCcw } from 'lucide-react';

const Leaderboard = () => {
  const [timeframe, setTimeframe] = useState('weekly');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBoard = useCallback(async (tf) => {
    setLoading(true);
    setError('');
    try {
      const resp = await axios.get(`/trading/leaderboard?timeframe=${encodeURIComponent(tf)}`);
      setData(resp.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard(timeframe);
  }, [timeframe, fetchBoard]);

  const rows = useMemo(() => data?.entries || [], [data]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Global Leaderboard</h1>
          <p className="text-slate-400">Ranked by a combined score across performance and behavior</p>
        </div>
        <button onClick={() => fetchBoard(timeframe)} className="btn-primary flex items-center gap-2">
          <RefreshCcw size={18} /> Refresh
        </button>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Timeframe</p>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="input-field max-w-[220px]">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            {data?.generated_at ? `Generated: ${new Date(data.generated_at).toLocaleString()}` : ''}
          </p>
        </div>
        {error && <p className="mt-4 text-rose-500 font-bold">{error}</p>}
      </div>

      <div className="card p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Portfolio</th>
                  <th className="px-4 py-3">Profit %</th>
                  <th className="px-4 py-3">Win Rate</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {rows.map((r) => (
                  <tr
                    key={r.user_id}
                    className={`transition-colors ${r.is_current_user ? 'bg-blue-500/10' : 'hover:bg-slate-700/30'}`}
                  >
                    <td className="px-4 py-3 font-mono">{r.rank}</td>
                    <td className="px-4 py-3 font-bold text-white">
                      {r.user_name} {r.is_current_user ? <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-blue-300">You</span> : null}
                    </td>
                    <td className="px-4 py-3 font-mono">${Number(r.portfolio_value || 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 font-mono ${Number(r.profit_percent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(r.profit_percent || 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 font-mono">{Number(r.win_rate || 0).toFixed(2)}%</td>
                    <td className="px-4 py-3 font-mono">{Number(r.score || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">{Number(r.sessions_completed || 0)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td className="px-4 py-6 text-slate-500" colSpan="7">No data</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History, Search, Download, TrendingUp, TrendingDown, Clock, Camera } from 'lucide-react';

const TradeHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/trading/history');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(h => 
    h.stock_symbol.toLowerCase().includes(search.toLowerCase()) || 
    h.trade_type.toLowerCase().includes(search.toLowerCase()) ||
    h.emotional_state?.toLowerCase().includes(search.toLowerCase())
  );

  const getEmotionColor = (state) => {
    if (!state) return 'text-slate-500';
    const s = state.toLowerCase();
    if (s.includes('calm')) return 'text-emerald-500';
    if (s.includes('stress')) return 'text-rose-500';
    if (s.includes('excitement')) return 'text-amber-500';
    if (s.includes('anxiety')) return 'text-purple-500';
    return 'text-blue-500';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trade History</h1>
          <p className="text-slate-400">Complete log of all past trades and emotional states</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Filter history..."
              className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors text-slate-400 hover:text-white">
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Symbol</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Emotional State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((trade) => (
                <tr key={trade.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Clock size={14} />
                      {new Date(trade.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-blue-500">{trade.stock_symbol}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                      trade.trade_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                    }`}>
                      {trade.trade_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{trade.quantity}</td>
                  <td className="px-6 py-4 text-slate-300">${trade.price.toFixed(2)}</td>
                  <td className="px-6 py-4 font-bold text-white">${(trade.price * trade.quantity).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-2 text-sm font-bold ${getEmotionColor(trade.emotional_state)}`}>
                      <Camera size={14} />
                      {trade.emotional_state || 'N/A'}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No history found</p>
                  <p className="text-sm">Start trading to build your history</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradeHistory;

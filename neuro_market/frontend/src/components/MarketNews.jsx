import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Newspaper, TrendingUp, TrendingDown, RefreshCcw, ExternalLink, Clock } from 'lucide-react';

const MarketNews = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentiment, setSentiment] = useState('Neutral');
  const [breadth, setBreadth] = useState({ gainers: 0, losers: 0 });

  const fetchNews = async () => {
    setLoading(true);
    try {
      const resp = await axios.get('/ai/brief');
      const data = resp.data || {};
      setNews(data.headlines || []);
      setSentiment(data.sentiment || 'Neutral');
      setBreadth(data.breadth || { gainers: 0, losers: 0 });
    } catch (error) {
      console.error('Failed to fetch market news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card flex flex-col p-0 overflow-hidden bg-slate-900/40 backdrop-blur-xl border-slate-700/50">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-xl text-blue-500">
            <Newspaper size={20} />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Market News</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => !loading && fetchNews()}
            className={`p-2 rounded-lg transition-all ${loading ? 'text-blue-500 cursor-not-allowed' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
            title="Refresh News"
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            sentiment === 'Bullish' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
            sentiment === 'Bearish' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
            'bg-blue-500/10 text-blue-500 border border-blue-500/20'
          }`}>
            {sentiment}
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-900/20 grid grid-cols-2 gap-4 border-b border-slate-800">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gainers</span>
          <span className="text-xl font-black text-emerald-500">{breadth.gainers}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Losers</span>
          <span className="text-xl font-black text-rose-500">{breadth.losers}</span>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto max-h-[300px] custom-scrollbar">
        {loading && news.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Scanning Markets...</p>
          </div>
        ) : news.length > 0 ? (
          <div className="divide-y divide-slate-800/50">
            {news.map((item, idx) => (
              <div 
                key={idx} 
                className="p-4 hover:bg-slate-800/30 transition-all group cursor-default"
              >
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-200 leading-relaxed font-medium group-hover:text-white transition-colors">
                      {item}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-bold uppercase tracking-tighter">
                        <Clock size={10} /> Just Now
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            <Newspaper size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No news available</p>
          </div>
        )}
      </div>
      
      <div className="p-3 bg-slate-950/40 border-t border-slate-800 text-center">
        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">
          Powered by NeuroMarket Intelligence
        </p>
      </div>
    </div>
  );
};

export default MarketNews;

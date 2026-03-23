import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, TrendingUp, TrendingDown, ChevronRight, Activity, PieChart, Wallet, Camera, Brain, Star } from 'lucide-react';
import BrainwaveVisualizer from '../components/BrainwaveVisualizer';
import EmotionalTrend from '../components/EmotionalTrend';
import MarketNews from '../components/MarketNews';
import CandlestickChart from '../components/CandlestickChart';
import NeuroLoader from '../components/NeuroLoader';

const Dashboard = ({ onRefreshUser }) => {
  const [stocks, setStocks] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [quickSymbol, setQuickSymbol] = useState('AAPL');
  const [quickPrice, setQuickPrice] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const [stocksRes, portfolioRes, watchlistRes] = await Promise.all([
        axios.get('/trading/stocks/popular'),
        axios.get('/trading/portfolio'),
        axios.get('/trading/watchlist')
      ]);
      setStocks(stocksRes.data);
      setPortfolio(portfolioRes.data);
      setWatchlist(watchlistRes.data);
      if (onRefreshUser) onRefreshUser();
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error?.response?.data?.detail || error?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [onRefreshUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleWatchlist = async (e, symbol) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (watchlist.includes(symbol)) {
        await axios.delete(`/trading/watchlist/${symbol}`);
        setWatchlist(prev => prev.filter(s => s !== symbol));
      } else {
        await axios.post('/trading/watchlist', { symbol });
        setWatchlist(prev => [...prev, symbol]);
      }
    } catch (err) {
      console.error('Watchlist toggle failed:', err);
    }
  };

  const filteredStocks = stocks.filter(s => 
    s.symbol.toLowerCase().includes(search.toLowerCase()) || 
    s.company_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPortfolioValue = portfolio.reduce((acc, item) => {
    const stock = stocks.find(s => s.symbol === item.stock_symbol);
    return acc + (item.quantity * (stock?.price || item.avg_price));
  }, 0);

  // Market Insights Calculations
  const sortedByPerformance = [...stocks].sort((a, b) => b.change_percent - a.change_percent);
  const topGainers = sortedByPerformance.slice(0, 3);
  const topLosers = sortedByPerformance.slice(-3).reverse();
  const mostVolatile = [...stocks].sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent)).slice(0, 3);
  
  const gainerCount = stocks.filter(s => s.change_percent > 0).length;
  const loserCount = stocks.filter(s => s.change_percent < 0).length;
  const marketSentiment = gainerCount > loserCount ? 'Bullish' : gainerCount < loserCount ? 'Bearish' : 'Neutral';

  if (loading) {
    return <NeuroLoader message="Synchronizing Neural Market Data..." />;
  }

  if (error) {
    return (
      <div className="card p-6 border border-rose-500/30 bg-rose-500/10">
        <p className="text-rose-400 font-bold mb-2">Dashboard failed to load</p>
        <p className="text-sm text-slate-300 mb-4">{error}</p>
        <button onClick={fetchData} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-xl text-blue-500">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Total Portfolio</p>
            <h3 className="text-2xl font-bold">${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>
        
        <div className="card p-6 flex items-center gap-4">
          <div className="p-3 bg-emerald-600/20 rounded-xl text-emerald-500">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Daily Change</p>
            <h3 className="text-2xl font-bold text-emerald-500">+2.45%</h3>
          </div>
        </div>

        <div className="card p-6 flex items-center gap-4">
          <div className="p-3 bg-purple-600/20 rounded-xl text-purple-500">
            <PieChart size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Holdings</p>
            <h3 className="text-2xl font-bold">{portfolio.length} Assets</h3>
          </div>
        </div>
      </div>

      {/* Market Performance Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 bg-slate-900/40 backdrop-blur-xl border-slate-700/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            {marketSentiment === 'Bullish' ? <TrendingUp size={64} /> : <TrendingDown size={64} />}
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Market Sentiment</p>
          <h3 className={`text-2xl font-black uppercase ${marketSentiment === 'Bullish' ? 'text-emerald-500' : marketSentiment === 'Bearish' ? 'text-rose-500' : 'text-blue-500'}`}>
            {marketSentiment}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">
            {gainerCount} Gainers vs {loserCount} Losers
          </p>
        </div>

        <div className="card p-5 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-emerald-500" />
            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Top Gainers</h4>
          </div>
          <div className="space-y-3">
            {topGainers.map(s => (
              <div key={s.symbol} className="flex items-center justify-between">
                <span className="text-xs font-black text-white">{s.symbol}</span>
                <span className="text-xs font-mono font-bold text-emerald-500">+{s.change_percent.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 bg-rose-500/5 border-rose-500/20">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={16} className="text-rose-500" />
            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Top Losers</h4>
          </div>
          <div className="space-y-3">
            {topLosers.map(s => (
              <div key={s.symbol} className="flex items-center justify-between">
                <span className="text-xs font-black text-white">{s.symbol}</span>
                <span className="text-xs font-mono font-bold text-rose-500">{s.change_percent.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 bg-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-purple-500" />
            <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Most Volatile</h4>
          </div>
          <div className="space-y-3">
            {mostVolatile.map(s => (
              <div key={s.symbol} className="flex items-center justify-between">
                <span className="text-xs font-black text-white">{s.symbol}</span>
                <span className="text-xs font-mono font-bold text-purple-500">±{Math.abs(s.change_percent).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* Quick Analysis Section */}
      <div className="card p-6 bg-slate-900/40 backdrop-blur-xl border-slate-700/50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/20 rounded-xl text-emerald-500">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Quick Stock Analysis</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Visualization</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex-1 md:w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <select 
                value={quickSymbol}
                onChange={(e) => setQuickSymbol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white transition-all outline-none appearance-none"
              >
                <optgroup label="Popular Stocks">
                  {stocks.slice(0, 10).map(s => (
                    <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.company_name}</option>
                  ))}
                </optgroup>
                <optgroup label="All Stocks">
                  {stocks.map(s => (
                    <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <Link 
              to={`/stock/${quickSymbol}`}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
            >
              Full Analysis
            </Link>
          </div>
        </div>

        <div className="bg-slate-950/30 p-6 rounded-3xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h4 className="text-2xl font-black text-white">{quickSymbol}</h4>
              <p className="text-sm font-mono text-emerald-400 font-bold">
                {quickPrice ? `$${quickPrice.toFixed(2)}` : 'Loading...'}
              </p>
            </div>
          </div>
          <CandlestickChart symbol={quickSymbol} height={350} onPrice={setQuickPrice} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Market List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Market Overview</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search stocks..."
                className="bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4"></th>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-right">Change</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredStocks.map((stock) => (
                  <tr key={stock.symbol} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4">
                      <button 
                        onClick={(e) => toggleWatchlist(e, stock.symbol)}
                        className={`transition-colors ${watchlist.includes(stock.symbol) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Star size={18} fill={watchlist.includes(stock.symbol) ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-6 py-4 font-bold text-blue-500">{stock.symbol}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{stock.company_name}</td>
                    <td className="px-6 py-4 text-right font-medium">${stock.price.toFixed(2)}</td>
                    <td className={`px-6 py-4 text-right font-medium ${stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <span className="flex items-center justify-end gap-1">
                        {stock.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(stock.change_percent).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/stock/${stock.symbol}`}
                        className="p-2 hover:bg-slate-700 rounded-full inline-block transition-colors text-slate-400 hover:text-white"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar: Your Portfolio Preview + Market News */}
        <div className="space-y-6">
          <MarketNews />

          <div className="flex items-center justify-between mt-8">
            <h2 className="text-xl font-bold">Watchlist</h2>
          </div>
          <div className="card divide-y divide-slate-700">
            {watchlist.length > 0 ? (
              watchlist.map(sym => {
                const stock = stocks.find(s => s.symbol === sym);
                return (
                  <Link to={`/stock/${sym}`} key={sym} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Star size={14} className="text-amber-400" fill="currentColor" />
                      <div>
                        <p className="font-bold text-sm">{sym}</p>
                        <p className="text-[10px] text-slate-500">{stock?.company_name || 'Loading...'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">${stock?.price?.toFixed(2) || '---'}</p>
                      <p className={`text-[10px] font-bold ${stock?.change_percent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stock?.change_percent >= 0 ? '+' : ''}{stock?.change_percent?.toFixed(2) || '0.00'}%
                      </p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p className="text-xs">No favorites yet.</p>
                <p className="text-[10px]">Star stocks to track them here!</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-8">
            <h2 className="text-xl font-bold">Your Portfolio</h2>
            <Link to="/portfolio" className="text-sm text-blue-500 hover:underline">View All</Link>
          </div>

          <div className="card divide-y divide-slate-700">
            {portfolio.length > 0 ? (
              portfolio.slice(0, 5).map((item) => {
                const stock = stocks.find(s => s.symbol === item.stock_symbol);
                return (
                  <div key={item.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{item.stock_symbol}</p>
                      <p className="text-xs text-slate-500">{item.quantity} shares</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${((stock?.price || item.avg_price) * item.quantity).toLocaleString()}</p>
                      <p className={`text-xs ${stock?.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stock?.change >= 0 ? '+' : ''}{stock?.change?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p>No holdings yet.</p>
                <p className="text-sm">Start trading to build your portfolio!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Brain, ShieldAlert, CheckCircle, TrendingUp } from 'lucide-react';

const EmotionalTrend = () => {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const resp = await axios.get('/ai/forecast');
        setForecast(resp.data);
      } catch (err) {
        console.error('Failed to fetch forecast:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
    const interval = setInterval(fetchForecast, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="card h-48 flex items-center justify-center animate-pulse">
      <div className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Forecast...</div>
    </div>
  );

  if (!forecast) return null;

  return (
    <div className="card p-6 bg-slate-900/40 backdrop-blur-xl border-slate-700/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-600/20 rounded-xl text-purple-500">
          <Activity size={20} />
        </div>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">Emotional Trend AI</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current</p>
          <p className="text-lg font-black text-white uppercase">{forecast.current}</p>
        </div>
        <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-600/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 bg-blue-500 text-[8px] font-bold text-white uppercase rounded-bl-lg tracking-tighter">
            Next Prediction
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Forecast</p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-black text-blue-400 uppercase">{forecast.predicted}</p>
            <p className="text-xs font-mono font-bold text-blue-500">{(forecast.confidence * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      <div className={`p-4 rounded-2xl border ${
        forecast.predicted === 'Stress' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' :
        forecast.predicted === 'Excitement' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
        'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
      }`}>
        <div className="flex items-start gap-3">
          {forecast.predicted === 'Stress' ? <ShieldAlert size={20} /> : <CheckCircle size={20} />}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">AI Recommendation</p>
            <p className="text-sm font-bold leading-tight">{forecast.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmotionalTrend;

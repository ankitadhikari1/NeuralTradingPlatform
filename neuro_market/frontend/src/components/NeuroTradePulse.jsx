import React, { useMemo } from 'react';
import { Brain, Zap, ShieldAlert, CheckCircle2, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';

const NeuroTradePulse = ({ volatility = 0.5 }) => {
  const { emotion: liveEmotion } = useEmotion();
  
  const emotion = useMemo(() => {
    const raw = liveEmotion || { state: 'Calm', confidence: 0.0 };
    return {
      state: raw.state || 'Calm',
      confidence: raw.confidence || 0,
      label: (raw.state || 'Calm').toLowerCase()
    };
  }, [liveEmotion]);

  const config = useMemo(() => {
    const states = {
      calm: {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        pulse: 'animate-pulse-slow',
        risk: 15,
        status: 'Optimal',
        icon: CheckCircle2,
        advice: 'Strategic clarity high. Ideal for execution.'
      },
      stress: {
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        pulse: 'animate-pulse-fast',
        risk: 85,
        status: 'High Risk',
        icon: ShieldAlert,
        advice: 'Stress detected. Risk of panic execution. Take 3 deep breaths.'
      },
      anxiety: {
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        pulse: 'animate-pulse-fast',
        risk: 75,
        status: 'Unstable',
        icon: AlertCircle,
        advice: 'Hesitation risk high. Review stop-loss levels.'
      },
      excitement: {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        pulse: 'animate-pulse-fast',
        risk: 60,
        status: 'Impulsive',
        icon: Zap,
        advice: 'FOMO potential detected. Confirm your exit strategy.'
      },
      neutral: {
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        pulse: 'animate-pulse-slow',
        risk: 30,
        status: 'Stable',
        icon: Activity,
        advice: 'Market focus normal. Trade with discipline.'
      }
    };
    return states[emotion.label] || states.neutral;
  }, [emotion.label]);

  // Combined risk based on emotion and market volatility
  const combinedRisk = Math.min(100, config.risk + (volatility * 20));

  return (
    <div className={`card p-5 border ${config.border} ${config.bg} backdrop-blur-xl transition-all duration-500`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-slate-900/50 ${config.color} ${config.pulse}`}>
            <Brain size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-0.5">Neuro-Pulse</h3>
            <p className={`text-sm font-black uppercase tracking-wider ${config.color}`}>{config.status}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Risk Score</p>
          <p className={`text-xl font-black font-mono ${combinedRisk > 70 ? 'text-rose-500' : combinedRisk > 40 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {Math.round(combinedRisk)}%
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Risk Gauge */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Neural Readiness</span>
            <span className="text-[10px] font-mono text-slate-500">{Math.round(100 - combinedRisk)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800/50 rounded-full overflow-hidden p-0.5 border border-slate-700/30">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                combinedRisk > 70 ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 
                combinedRisk > 40 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 
                'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
              }`}
              style={{ width: `${100 - combinedRisk}%` }}
            />
          </div>
        </div>

        {/* Intelligence Insight */}
        <div className="flex gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/50">
          <config.icon size={16} className={`shrink-0 mt-0.5 ${config.color}`} />
          <p className="text-xs text-slate-300 leading-relaxed italic">
            "{config.advice}"
          </p>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-slate-900/30 border border-slate-800/50 flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">State</span>
            <span className={`text-[10px] font-bold uppercase ${config.color}`}>{emotion.state}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/30 border border-slate-800/50 flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Confidence</span>
            <span className="text-[10px] font-bold text-slate-300">{(emotion.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes pulse-fast {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.7; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite ease-in-out;
        }
        .animate-pulse-fast {
          animation: pulse-fast 1s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default NeuroTradePulse;

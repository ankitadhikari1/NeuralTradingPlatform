import React from 'react';
import { Brain, Zap, TrendingUp, Activity } from 'lucide-react';

const NeuroLoader = ({ message = "Analyzing Neural Markets..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full space-y-8 animate-in fade-in duration-700">
      <div className="relative">
        {/* Pulsing Outer Rings */}
        <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping duration-[3000ms]"></div>
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping duration-[2000ms] delay-700"></div>
        
        {/* Central Neural Hub */}
        <div className="relative bg-slate-900 p-8 rounded-full border border-slate-800 shadow-2xl shadow-blue-500/20">
          <Brain size={64} className="text-blue-500 animate-pulse-brain" />
          
          {/* Orbiting Particles */}
          <div className="absolute inset-0 animate-spin-slow">
            <Zap size={16} className="absolute -top-2 left-1/2 -translate-x-1/2 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          </div>
          <div className="absolute inset-0 animate-spin-reverse-slow">
            <Activity size={16} className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>
          <div className="absolute inset-0 animate-spin-mid">
            <TrendingUp size={16} className="absolute top-1/2 -right-2 -translate-y-1/2 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          </div>
        </div>
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-xl font-black text-white uppercase tracking-[0.3em] animate-pulse">
          {message}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-loading-bar"></div>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Syncing Synapses
          </span>
          <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 animate-loading-bar delay-500"></div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-brain {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.1); filter: brightness(1.3) drop-shadow(0 0 15px rgba(59,130,246,0.5)); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse-slow {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes spin-mid {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-pulse-brain {
          animation: pulse-brain 2s infinite ease-in-out;
        }
        .animate-spin-slow {
          animation: spin-slow 8s infinite linear;
        }
        .animate-spin-reverse-slow {
          animation: spin-reverse-slow 6s infinite linear;
        }
        .animate-spin-mid {
          animation: spin-mid 4s infinite linear;
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default NeuroLoader;

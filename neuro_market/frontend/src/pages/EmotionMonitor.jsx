import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Activity, Shield, AlertTriangle, Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEmotion } from '../context/EmotionContext';
import BrainwaveVisualizer from '../components/BrainwaveVisualizer';

const EmotionMonitor = () => {
  const { active, cameraStatus, cameraError, wsStatus, wsCloseInfo, emotion, timeline, stream, start, stop } = useEmotion();
  const [insight, setInsight] = useState('Your emotional state is optimal for trading.');
  const videoRef = useRef(null);

  const updateInsight = (emotion) => {
    if (emotion === 'stress') setInsight("High stress levels detected. Your decision-making might be compromised.");
    else if (emotion === 'excitement') setInsight("High excitement detected. Beware of impulsive FOMO trades.");
    else if (emotion === 'anxiety') setInsight("Anxiety detected. Consider stepping away for a few minutes.");
    else setInsight("You are in a calm, focused state. Optimal for disciplined trading.");
  };

  useEffect(() => {
    if (!videoRef.current) return;
    if (!active || !stream) {
      videoRef.current.srcObject = null;
      return;
    }
    videoRef.current.srcObject = stream;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn("Monitor video play failed:", err);
        }
      });
    }
  }, [active, stream]);

  useEffect(() => {
    updateInsight(String(emotion.state || '').toLowerCase());
  }, [emotion.state]);

  const getEmotionColor = (emotion) => {
    switch (emotion.toLowerCase()) {
      case 'stress': return 'text-rose-500';
      case 'excitement': return 'text-amber-500';
      case 'anxiety': return 'text-purple-500';
      case 'calm': return 'text-emerald-500';
      default: return 'text-blue-500';
    }
  };

  const getEmotionBg = (emotion) => {
    switch (emotion.toLowerCase()) {
      case 'stress': return 'bg-rose-500/10 border-rose-500/30';
      case 'excitement': return 'bg-amber-500/10 border-amber-500/30';
      case 'anxiety': return 'bg-purple-500/10 border-purple-500/30';
      case 'calm': return 'bg-emerald-500/10 border-emerald-500/30';
      default: return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Emotion & Neural Monitoring</h1>
          <p className="text-slate-400">Real-time biometric feedback for trading discipline</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300">
            WS: <span className="font-mono">{wsStatus}{wsStatus === 'closed' && wsCloseInfo?.code ? ` (${wsCloseInfo.code}${wsCloseInfo.reason ? `:${wsCloseInfo.reason}` : ''})` : ''}</span>
          </div>
          <button
            onClick={active ? stop : start}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
              active 
                ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {active ? <><CameraOff size={20} /> Stop Monitoring</> : <><Camera size={20} /> Start AI Monitoring</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Webcam Feed */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card aspect-video relative flex items-center justify-center bg-slate-900 border-2 border-slate-700">
            {active && (cameraStatus === 'starting' || cameraStatus === 'streaming') ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="text-center p-8">
                <Camera size={48} className="mx-auto mb-4 text-slate-700" />
                <p className="text-slate-500 font-medium">
                  {cameraStatus === 'requesting' ? 'Requesting webcam…' : cameraStatus === 'starting' ? 'Starting camera…' : 'Webcam inactive'}
                </p>
                {cameraError && <p className="text-xs text-rose-400 mt-2 max-w-xs mx-auto">{cameraError}</p>}
              </div>
            )}
            
            {active && (
              <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-slate-700 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                <span className="text-xs font-mono uppercase tracking-widest">Live Face Tracking</span>
              </div>
            )}
          </div>

          <div className={`card p-6 border-l-4 ${getEmotionBg(emotion.state)}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <Activity size={18} />
                Current State
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getEmotionBg(emotion.state)} ${getEmotionColor(emotion.state)}`}>
                {emotion.state}
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Emotional Intensity</span>
                  <span className="font-mono">{(emotion.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${getEmotionColor(emotion.state).replace('text-', 'bg-')}`}
                    style={{ width: `${emotion.confidence * 100}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                "{insight}"
              </p>
            </div>
          </div>
        </div>

        {/* Neural Activity */}
        <div className="lg:col-span-2 space-y-8">
          <BrainwaveVisualizer />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-bold flex items-center gap-2 mb-6">
                <Camera size={18} className="text-purple-500" />
                Face Emotion Scores
              </h3>
              <div className="space-y-4">
                {Object.entries(emotion.face || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 6).map(([band, value]) => (
                  <div key={band}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="uppercase font-medium text-slate-400">{band}</span>
                      <span className="font-mono text-slate-500">{(value * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-purple-500/60 transition-all duration-1000`}
                        style={{ width: `${value * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold flex items-center gap-2 mb-6">
                <Shield size={18} className="text-emerald-500" />
                Risk Status
              </h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${String(emotion.state).toLowerCase() === 'calm' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Trading Permission</p>
                    <p className={`text-xl font-bold ${String(emotion.state).toLowerCase() === 'anxiety' ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {String(emotion.state).toLowerCase() === 'anxiety' ? 'BLOCKED' : 'ALLOWED'}
                    </p>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <p className="text-xs text-slate-400 mb-2 uppercase font-bold tracking-wider">Active Guard Rules</p>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2 text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      Stress Warning (Threshold: 60%)
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                      Excitement Confirmation (70%)
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                      Anxiety Cooldown (50%)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-6">Emotion Intensity Timeline</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={false} 
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmotionMonitor;

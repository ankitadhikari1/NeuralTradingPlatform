import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useEmotion } from '../context/EmotionContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BrainwaveVisualizer = () => {
  const { emotion, active, eegHistory } = useEmotion();
  const [chartData, setChartData] = useState({
    alpha: Array(20).fill(0),
    beta: Array(20).fill(0),
    gamma: Array(20).fill(0),
    theta: Array(20).fill(0),
    delta: Array(20).fill(0),
    labels: Array(20).fill('')
  });

  // Synchronize local chart data with global eegHistory
  useEffect(() => {
    if (eegHistory) {
      setChartData(eegHistory);
    }
  }, [eegHistory]);

  const createOptions = (title, color) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: '#94a3b8', font: { size: 10, weight: 'bold' } },
    },
    scales: {
      x: { display: false },
      y: {
        min: 0,
        max: 1.2,
        grid: { color: '#1e293b' },
        ticks: { color: '#64748b', font: { size: 8 } }
      }
    },
    elements: {
      line: { tension: 0.4, borderWidth: 2, borderColor: color, fill: true, backgroundColor: `${color}20` },
      point: { radius: 0 }
    },
    animation: { duration: 0 }
  });

  const getChartData = (data, label, color) => ({
    labels: chartData.labels,
    datasets: [{ label, data, borderColor: color, backgroundColor: `${color}22`, fill: true }]
  });

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-white uppercase tracking-tight">EEG Brainwave Monitor</h3>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</p>
            <p className={`text-sm font-black uppercase ${emotion?.state === 'Calm' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {emotion?.state || 'OFFLINE'}
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Alpha', value: emotion?.eeg?.alpha, color: 'text-blue-400' },
          { label: 'Beta', value: emotion?.eeg?.beta, color: 'text-purple-400' },
          { label: 'Gamma', value: emotion?.eeg?.gamma, color: 'text-rose-400' },
          { label: 'Theta', value: emotion?.eeg?.theta, color: 'text-amber-400' },
          { label: 'Delta', value: emotion?.eeg?.delta, color: 'text-emerald-400' }
        ].map((item, idx) => (
          <div key={idx} className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
            <p className={`text-lg font-mono font-black ${item.color}`}>
              {item.value ? item.value.toFixed(3) : '0.000'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-48">
        <div className="h-full"><Line options={createOptions('ALPHA', '#60a5fa')} data={getChartData(chartData.alpha, 'Alpha', '#60a5fa')} /></div>
        <div className="h-full"><Line options={createOptions('BETA', '#a855f7')} data={getChartData(chartData.beta, 'Beta', '#a855f7')} /></div>
        <div className="h-full"><Line options={createOptions('GAMMA', '#fb7185')} data={getChartData(chartData.gamma, 'Gamma', '#fb7185')} /></div>
        <div className="h-full"><Line options={createOptions('THETA', '#fbbf24')} data={getChartData(chartData.theta, 'Theta', '#fbbf24')} /></div>
        <div className="h-full"><Line options={createOptions('DELTA', '#10b981')} data={getChartData(chartData.delta, 'Delta', '#10b981')} /></div>
      </div>
      
      {!active && (
        <div className="mt-4 p-4 bg-blue-600/10 border border-blue-600/30 rounded-2xl text-center">
          <p className="text-sm text-blue-400 font-bold uppercase tracking-widest">
            Camera inactive. Start monitoring to see live EEG data.
          </p>
        </div>
      )}
    </div>
  );
};

export default BrainwaveVisualizer;

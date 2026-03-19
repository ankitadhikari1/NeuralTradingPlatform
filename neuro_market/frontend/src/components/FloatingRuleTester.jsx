import React, { useEffect, useRef, useState } from 'react';
import { Bot, Beaker, X, GripVertical, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';
import AITradingAssistant from './AITradingAssistant';

const emotions = ['Calm', 'Stress', 'Anxiety', 'Excitement', 'Fear', 'Greed', 'Neutral'];

const FloatingRuleTester = () => {
  const { active, emotion, simulateEmotion, demoRules, setDemoRules } = useEmotion();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('tester'); // tester | chat
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 20, y: 80 });
  const [panelSize, setPanelSize] = useState('md'); // sm | md | lg
  const panelRef = useRef(null);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const dims = panelSize === 'sm' ? { w: 300, h: 380 } : panelSize === 'lg' ? { w: 420, h: 560 } : { w: 340, h: 460 };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging) return;
      const dx = (e.touches ? e.touches[0].clientX : e.clientX) - dragRef.current.startX;
      const dy = (e.touches ? e.touches[0].clientY : e.clientY) - dragRef.current.startY;
      const nextX = Math.max(8, Math.min(window.innerWidth - dims.w - 8, dragRef.current.origX + dx));
      const nextY = Math.max(8, Math.min(window.innerHeight - dims.h - 8, dragRef.current.origY + dy));
      setPos({ x: nextX, y: nextY });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, dims.h, dims.w]);

  useEffect(() => {
    setPos((p) => ({
      x: Math.max(8, Math.min(window.innerWidth - dims.w - 8, p.x)),
      y: Math.max(8, Math.min(window.innerHeight - dims.h - 8, p.y)),
    }));
  }, [dims.h, dims.w]);

  if (active) {
    return null; // Only show when camera is OFF (MVP demo mode)
  }

  const onDragStart = (e) => {
    setDragging(true);
    dragRef.current.startX = e.touches ? e.touches[0].clientX : e.clientX;
    dragRef.current.startY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current.origX = pos.x;
    dragRef.current.origY = pos.y;
  };

  const applyEmotion = (state, conf) => {
    simulateEmotion({
      state,
      confidence: conf ?? emotion.confidence,
      face: { [state.toLowerCase()]: 1.0 },
    });
  };

  const emotionName = String(emotion.state || 'Calm').toLowerCase();
  const confidencePct = Math.round((Number(emotion.confidence || 0) || 0) * 100);
  const cooldownEmotions = new Set(['stress', 'anxiety', 'fear', 'greed']);
  const requiresDoubleVerify =
    emotionName === 'excitement' || (emotionName !== 'calm' && emotionName !== 'neutral' && confidencePct < 50);

  let cooldownSeconds = 0;
  if (cooldownEmotions.has(emotionName)) {
    if (confidencePct >= 100) cooldownSeconds = 15;
    else if (confidencePct >= 70) cooldownSeconds = 10;
    else if (confidencePct >= 50) cooldownSeconds = 5;
  }

  let maxTradeAmount = null;
  if (cooldownEmotions.has(emotionName) && confidencePct >= 50) {
    if (confidencePct >= 100) maxTradeAmount = 250;
    else if (confidencePct >= 70) maxTradeAmount = 500;
    else maxTradeAmount = 1000;
  }

  return (
    <>
      {!open && (
        <>
          <button
            title="Open AI Assistant"
            onClick={() => {
              setOpen(true);
              setTab('chat');
            }}
            className="fixed z-[60] bottom-20 right-4 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 flex items-center justify-center"
          >
            <Bot size={22} />
          </button>
          <button
            title="Open Rule Tester"
            onClick={() => {
              setOpen(true);
              setTab('tester');
            }}
            className="fixed z-[60] bottom-4 right-4 h-12 w-12 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 shadow-lg flex items-center justify-center"
          >
            <Beaker size={22} />
          </button>
        </>
      )}

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[70]"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="card p-0 overflow-hidden" style={{ width: dims.w, height: dims.h }}>
            <div
              className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-900/60 cursor-grab active:cursor-grabbing"
              onMouseDown={onDragStart}
              onTouchStart={onDragStart}
            >
              <div className="flex items-center gap-2">
                <GripVertical size={16} className="text-slate-400" />
                <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Demo Panel
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-1 text-slate-300 hover:text-white"
                  onClick={() => setPanelSize((s) => (s === 'sm' ? 'md' : s === 'md' ? 'lg' : 'sm'))}
                  title="Resize"
                >
                  {panelSize === 'lg' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  className={`px-2 py-1 text-xs rounded-md ${tab === 'tester' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'}`}
                  onClick={() => setTab('tester')}
                >
                  Tester
                </button>
                <button
                  className={`px-2 py-1 text-xs rounded-md ${tab === 'chat' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'}`}
                  onClick={() => setTab('chat')}
                >
                  Chat
                </button>
                <button
                  className="p-1 text-slate-400 hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {tab === 'tester' ? (
              <div className="p-3 space-y-3">
                <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/40">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Emotion</p>
                  <div className="grid grid-cols-3 gap-2">
                    {emotions.map((e) => (
                      <button
                        key={e}
                        onClick={() => applyEmotion(e)}
                        className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                          emotion.state === e
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800/60 text-slate-200 hover:bg-slate-700/60'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-slate-400">Confidence: {(Math.round((emotion.confidence || 0) * 100))}%</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((emotion.confidence || 0) * 100)}
                      onChange={(e) => applyEmotion(emotion.state, Number(e.target.value) / 100)}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/40">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Streaks</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400">Wins</label>
                      <input
                        type="number"
                        min={0}
                        value={demoRules.streakWins}
                        onChange={(e) =>
                          setDemoRules((r) => ({ ...r, streakWins: Math.max(0, Number(e.target.value) || 0) }))
                        }
                        className="input-field py-1 px-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Losses</label>
                      <input
                        type="number"
                        min={0}
                        value={demoRules.streakLosses}
                        onChange={(e) =>
                          setDemoRules((r) => ({ ...r, streakLosses: Math.max(0, Number(e.target.value) || 0) }))
                        }
                        className="input-field py-1 px-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/30 p-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Rules (Demo)</p>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Double verify</span>
                        <span className={requiresDoubleVerify ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                          {requiresDoubleVerify ? 'Required' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Cooldown after trade</span>
                        <span className={cooldownSeconds > 0 ? 'text-blue-400 font-bold' : 'text-slate-300'}>
                          {cooldownSeconds > 0 ? `${cooldownSeconds}s` : 'None'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Max trade size</span>
                        <span className={maxTradeAmount ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                          {maxTradeAmount ? `$${maxTradeAmount}` : 'Normal'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const parts = [];
                      parts.push(`Emotion: ${String(emotion.state)} (${confidencePct}%)`);
                      if (requiresDoubleVerify) parts.push('Double verify: required');
                      if (cooldownSeconds > 0) parts.push(`Cooldown after trade: ${cooldownSeconds}s`);
                      if (maxTradeAmount) parts.push(`Max trade size: $${maxTradeAmount}`);
                      if ((demoRules.streakLosses || 0) > 0) parts.push(`Loss streak: ${demoRules.streakLosses}`);
                      if ((demoRules.streakWins || 0) > 0) parts.push(`Win streak: ${demoRules.streakWins}`);
                      alert(parts.join('\n'));
                    }}
                    className="mt-3 w-full btn-primary flex items-center justify-center gap-2"
                  >
                    Evaluate Rules <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3" style={{ height: dims.h - 41 }}>
                <AITradingAssistant />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingRuleTester;

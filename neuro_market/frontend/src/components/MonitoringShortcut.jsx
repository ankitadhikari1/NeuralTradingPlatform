import React, { useEffect } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';

const MonitoringShortcut = () => {
  const { active, cameraStatus, start, stop } = useEmotion();

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.key.toLowerCase() !== 'm') return;
      if (cameraStatus === 'requesting' || cameraStatus === 'starting') return;
      if (active) stop();
      else start();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, cameraStatus, start, stop]);

  const busy = cameraStatus === 'requesting' || cameraStatus === 'starting';

  return (
    <button
      type="button"
      className={`fixed z-[60] bottom-4 left-4 h-12 w-12 rounded-full border shadow-lg flex items-center justify-center transition-colors ${
        active
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
          : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
      } ${busy ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={() => (active ? stop() : start())}
      disabled={busy}
      title={active ? 'Stop monitoring (M)' : 'Start monitoring (M)'}
    >
      {active ? <CameraOff size={20} /> : <Camera size={20} />}
    </button>
  );
};

export default MonitoringShortcut;


import React, { useEffect, useRef, useState } from 'react';
import { CameraOff, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';

const CameraOverlay = () => {
  const { active, stream, emotion, stop } = useEmotion();
  const videoRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState('md'); // sm | md | lg
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  const dims = size === 'sm' ? { w: 220, h: 140 } : size === 'lg' ? { w: 380, h: 240 } : { w: 280, h: 180 };

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
          console.warn("Camera video play failed:", err);
        }
      });
    }
  }, [active, stream]);

  useEffect(() => {
    if (!active) return;
    setPos((prev) => {
      const fallback = {
        x: Math.max(8, window.innerWidth - dims.w - 16),
        y: Math.max(8, window.innerHeight - dims.h - 24),
      };
      if (!prev || (prev.x === 0 && prev.y === 0)) return fallback;
      return {
        x: Math.max(8, Math.min(window.innerWidth - dims.w - 8, prev.x)),
        y: Math.max(8, Math.min(window.innerHeight - dims.h - 8, prev.y)),
      };
    });
  }, [active, dims.w, dims.h]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
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
  }, [dragging, dims.w, dims.h]);

  if (!active) return null;

  const startDrag = (e) => {
    setDragging(true);
    dragRef.current.startX = e.touches ? e.touches[0].clientX : e.clientX;
    dragRef.current.startY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current.origX = pos.x;
    dragRef.current.origY = pos.y;
  };

  return (
    <div className="fixed z-50" style={{ left: pos.x, top: pos.y, width: dims.w }}>
      <div className="card overflow-hidden border border-slate-700">
        <div
          className="flex items-center justify-between px-2 py-2 bg-slate-900/70 border-b border-slate-700 cursor-grab active:cursor-grabbing"
          onMouseDown={startDrag}
          onTouchStart={startDrag}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="text-slate-400" />
            <div className="text-xs font-bold text-slate-300">
              {emotion.state} {(emotion.confidence * 100).toFixed(0)}% {emotion.face_status && emotion.face_status !== 'ok' ? `(${emotion.face_status})` : ''}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSize((s) => (s === 'sm' ? 'md' : s === 'md' ? 'lg' : 'sm'))}
              className="p-1 rounded-md bg-slate-900/60 border border-slate-700 text-slate-200 hover:text-white"
              title="Resize"
            >
              {size === 'lg' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={stop}
              className="p-1 rounded-md bg-slate-900/60 border border-slate-700 text-slate-200 hover:text-rose-400"
              title="Stop Camera"
            >
              <CameraOff size={16} />
            </button>
          </div>
        </div>
        <div className="relative">
          <video ref={videoRef} playsInline muted className="w-full object-cover bg-slate-900" style={{ height: dims.h }} />
        </div>
      </div>
    </div>
  );
};

export default CameraOverlay;

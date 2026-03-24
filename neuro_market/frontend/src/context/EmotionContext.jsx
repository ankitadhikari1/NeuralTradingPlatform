import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';

const EmotionContext = createContext(null);

const toWsBaseUrl = (httpUrl) => {
  try {
    const url = new URL(httpUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${url.protocol}//${url.host}`;
  } catch {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:8000`;
  }
};

export const EmotionProvider = ({ children }) => {
  const [active, setActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('inactive');
  const [cameraError, setCameraError] = useState('');
  const [wsStatus, setWsStatus] = useState('idle');
  const [wsCloseInfo, setWsCloseInfo] = useState({ code: null, reason: '' });
  const [emotion, setEmotion] = useState({ 
    state: 'Calm', 
    confidence: 0.0, 
    face: { neutral: 1.0 }, 
    face_status: 'missing',
    eeg: { alpha: 0, beta: 0, gamma: 0, theta: 0, delta: 0 }
  });
  const [timeline, setTimeline] = useState([]);
  const [eegHistory, setEegHistory] = useState({
    alpha: Array(20).fill(0),
    beta: Array(20).fill(0),
    gamma: Array(20).fill(0),
    theta: Array(20).fill(0),
    delta: Array(20).fill(0),
    labels: Array(20).fill('')
  });
  const [demoRules, setDemoRules] = useState({
    streakWins: 0,
    streakLosses: 0,
  });

  const streamRef = useRef(null);
  const hiddenVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const allowReconnectRef = useRef(false);
  const demoPersistRef = useRef(0);
  const startingRef = useRef(false);

  const wsBase = useMemo(() => toWsBaseUrl(axios.defaults.baseURL || 'http://localhost:8000'), []);

  const stop = useCallback(() => {
    allowReconnectRef.current = false;
    startingRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }
    wsRef.current = null;
    setWsStatus('idle');
    setWsCloseInfo({ code: null, reason: '' });

    const stream = streamRef.current;
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    setActive(false);
    setCameraStatus('inactive');
  }, []);

  const sendFrame = useCallback(() => {
    if (!hiddenVideoRef.current || !canvasRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    const video = hiddenVideoRef.current;
    if (video.readyState < 2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = 320;
    const h = 240;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const frame = canvas.toDataURL('image/jpeg', 0.75);
    wsRef.current.send(JSON.stringify({ frame }));
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || active) return;
    startingRef.current = true;

    try {
      setCameraError('');
      setCameraStatus('requesting');
      setWsCloseInfo({ code: null, reason: '' });
      reconnectAttemptRef.current = 0;

      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraStatus('error');
        setCameraError('Camera requires a secure context. Open the app on http://localhost (not the LAN IP).');
        startingRef.current = false;
        return;
      }

      if (!hiddenVideoRef.current) {
        const v = document.createElement('video');
        v.playsInline = true;
        v.muted = true;
        v.autoplay = true;
        hiddenVideoRef.current = v;
      }
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      hiddenVideoRef.current.srcObject = stream;
      setActive(true);
      setCameraStatus('starting');

      try { 
        const playPromise = hiddenVideoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } catch (err) {
        console.warn("Hidden video play interrupted:", err);
      }
      setCameraStatus('streaming');

      const token = localStorage.getItem('token') || '';
      if (!token) {
        setWsStatus('error');
        setCameraError('Login required: missing token. Please log out and log in again.');
        startingRef.current = false;
        return;
      }

      allowReconnectRef.current = true;

      const connect = () => {
        if (!allowReconnectRef.current) return;
        if (wsRef.current) {
          try { wsRef.current.close(); } catch {}
          wsRef.current = null;
        }
        setWsStatus('connecting');
        const ws = new WebSocket(`${wsBase}/emotion/ws?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptRef.current = 0;
          setWsStatus('connected');
          sendFrame();
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(sendFrame, 2000);
        };

        ws.onerror = () => {
          setWsStatus('error');
        };

        ws.onclose = (evt) => {
          setWsStatus('closed');
          setWsCloseInfo({ code: evt.code, reason: evt.reason || '' });
          if (!allowReconnectRef.current) return;
          if (evt.code === 1000) return;
          if (evt.code === 1008) {
            allowReconnectRef.current = false;
            setCameraError(`WebSocket rejected (${evt.reason || 'unauthorized'}). Please log out and log in again.`);
            return;
          }
          const attempt = reconnectAttemptRef.current + 1;
          reconnectAttemptRef.current = attempt;
          if (attempt > 5) return;
          const delay = Math.min(10000, 1000 * attempt * attempt);
          setTimeout(() => {
            if (allowReconnectRef.current) connect();
          }, delay);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const next = {
              state: String(data.emotion || 'calm').charAt(0).toUpperCase() + String(data.emotion || 'calm').slice(1),
              confidence: Number(data.confidence || 0),
              face: data.face || { neutral: 1.0 },
              face_status: data.face_status || 'ok',
              dominant_face_emotion: data.dominant_face_emotion,
              eeg: data.eeg || { alpha: 0, beta: 0, gamma: 0, theta: 0, delta: 0 },
              timestamp: data.timestamp,
            };
            setEmotion(next);
            setTimeline((prev) => [
              ...prev.slice(-59),
              { time: new Date().toLocaleTimeString(), confidence: (next.confidence || 0) * 100, emotion: next.state },
            ]);
            setEegHistory((prev) => {
              const eeg = next.eeg || { alpha: 0, beta: 0, gamma: 0, theta: 0, delta: 0 };
              return {
                alpha: [...prev.alpha.slice(1), eeg.alpha],
                beta: [...prev.beta.slice(1), eeg.beta],
                gamma: [...prev.gamma.slice(1), eeg.gamma],
                theta: [...prev.theta.slice(1), eeg.theta],
                delta: [...prev.delta.slice(1), eeg.delta],
                labels: [...prev.labels.slice(1), new Date().toLocaleTimeString().split(' ')[0]]
              };
            });
          } catch {}
        };
      };

      connect();
    } catch (e) {
      setCameraStatus('error');
      setCameraError(e?.message || 'Failed to access webcam.');
      stop();
    } finally {
      startingRef.current = false;
    }
  }, [active, stop, sendFrame, wsBase]);

  const simulateEmotion = useCallback((next) => {
    setEmotion((prev) => {
      const e = {
        state: String(next?.state || prev.state),
        confidence: Number(next?.confidence ?? prev.confidence) || 0,
        face: next?.face || prev.face || { neutral: 1.0 },
        face_status: next?.face_status || 'simulated',
        eeg: next?.eeg || { alpha: 0, beta: 0, gamma: 0, theta: 0, delta: 0 },
        timestamp: Date.now(),
      };

      setTimeline((prevT) => [
        ...prevT.slice(-59),
        { time: new Date().toLocaleTimeString(), confidence: (e.confidence || 0) * 100, emotion: e.state },
      ]);
      setEegHistory((prevH) => {
        const eeg = e.eeg || { alpha: 0, beta: 0, gamma: 0, theta: 0, delta: 0 };
        return {
          alpha: [...prevH.alpha.slice(1), eeg.alpha],
          beta: [...prevH.beta.slice(1), eeg.beta],
          gamma: [...prevH.gamma.slice(1), eeg.gamma],
          theta: [...prevH.theta.slice(1), eeg.theta],
          delta: [...prevH.delta.slice(1), eeg.delta],
          labels: [...prevH.labels.slice(1), new Date().toLocaleTimeString().split(' ')[0]],
        };
      });

      const now = Date.now();
      if (now - demoPersistRef.current >= 1500) {
        demoPersistRef.current = now;
        axios
          .post('/emotion/log', {
            emotion: String(e.state || 'calm').toLowerCase(),
            confidence: Math.max(0, Math.min(1, Number(e.confidence || 0))),
          })
          .catch(() => {});
      }
      return e;
    });
  }, []);

  useEffect(() => {
    const handler = () => stop();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const value = useMemo(() => ({
    active,
    cameraStatus,
    cameraError,
    wsStatus,
    wsCloseInfo,
    emotion,
    timeline,
    eegHistory,
    stream: streamRef.current,
    start,
    stop,
    simulateEmotion,
    demoRules,
    setDemoRules,
  }), [
    active,
    cameraStatus,
    cameraError,
    wsStatus,
    wsCloseInfo,
    emotion,
    timeline,
    eegHistory,
    start,
    stop,
    simulateEmotion,
    demoRules,
  ]);

  return <EmotionContext.Provider value={value}>{children}</EmotionContext.Provider>;
};

export const useEmotion = () => {
  const ctx = useContext(EmotionContext);
  if (!ctx) throw new Error('useEmotion must be used within EmotionProvider');
  return ctx;
};

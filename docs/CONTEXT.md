# NeuroMarket Lite – Project Context

This repository is an emotion-aware trading simulator. It combines:
- A FastAPI backend (auth, trading, emotion websocket, options, admin, practice advisor)
- A React + Vite + Tailwind frontend (dashboard, trading screens, practice mode, analytics)
- A persistent camera/emotion monitoring layer that stays active across routes

The focus is educational: build trading discipline by surfacing emotional state while the user trades and practices.

## Core User Flows

### Authentication
- Sign up and log in to receive a JWT token.
- The frontend stores the token in localStorage and uses it as a Bearer token for API calls.

### Emotion Monitoring (Camera)
- A global provider owns the MediaStream and a WebSocket connection to `/emotion/ws`.
- The provider sends low-res JPEG frames every ~2s.
- The backend runs DeepFace emotion analysis and returns:
  - `emotion` (mapped to calm/stress/excitement/anxiety)
  - `confidence` (0..1)
  - `face` (raw face emotion distribution)
- The UI shows a floating camera overlay while navigating the app.

### Stock Trading (Simulator)
- Uses yfinance to fetch market prices, with timeouts and fallback simulation for reliability.
- Records trades and updates holdings.
- Adds buy/sell markers on the candlestick chart for a “real platform” feel.
- Emotion guard gates trades:
  - Stress/excitement triggers an in-app confirmation modal.
  - Anxiety blocks trading.

### Options Trading (Prototype)
- Opens LONG CALL/PUT positions with strike/expiry/contracts.
- Uses a Black–Scholes mark price for live P&L updates.
- Stop-loss/take-profit auto-close positions in the options P&L websocket loop.

### Practice Session (Learning Tool)
- Starts camera automatically.
- Gives a very large demo balance and lets the user practice BUY/SELL on a live chart.
- Calls the backend practice advisor to suggest BUY/SELL/HOLD based on:
  - Technical indicators (SMA20/SMA50/RSI14)
  - User’s realized trade stats + emotional baseline


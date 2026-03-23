# Architecture

## Backend (FastAPI)

Entry: `neuro_market/backend/main.py`

Key modules:
- Models/DB: `neuro_market/backend/models/database.py`, `neuro_market/backend/models/schemas.py`
- Auth: `neuro_market/backend/services/auth.py`, `neuro_market/backend/routes/auth.py`
- Stock data + candles: `neuro_market/backend/services/stock_service.py`
- Emotion websocket + mapping: `neuro_market/backend/routes/emotion.py`, `neuro_market/backend/services/facial_emotion.py`
- Trading routes + sessions + reports + leaderboard: `neuro_market/backend/routes/trading.py`
- Risk engine (emotion + behavior gating): `neuro_market/backend/risk_engine/risk_control_engine.py`
- Options: `neuro_market/backend/routes/options.py`, `neuro_market/backend/services/options_pricing.py`
- Practice advisor: `neuro_market/backend/routes/practice.py`, `neuro_market/backend/services/practice_advisor.py`
- Admin + DB explorer endpoints: `neuro_market/backend/routes/admin.py`
- Market brief (dashboard news): `neuro_market/backend/routes/ai_assistant.py`

### Persistence
- SQLite is used by default.
- Emotion logs are persisted on a throttled cadence to avoid websocket crashes.
- Trading session reports are generated into `neuro_market/backend/session_reports/` (configurable).

## Frontend (React + Vite + Tailwind)

Entry: `neuro_market/frontend/src/main.jsx`

Key pieces:
- Global camera + emotion monitoring: `neuro_market/frontend/src/context/EmotionContext.jsx`
- Floating camera overlay: `neuro_market/frontend/src/components/CameraOverlay.jsx`
- Candles + live updates + markers: `neuro_market/frontend/src/components/CandlestickChart.jsx`
- Trading confirmation modal: `neuro_market/frontend/src/components/Modal.jsx`
- Global auth + routing + admin gating: `neuro_market/frontend/src/App.jsx`
- Neuro-themed UX:
  - Loader: `neuro_market/frontend/src/components/NeuroLoader.jsx`
  - Neuro-Pulse (live readiness/risk widget): `neuro_market/frontend/src/components/NeuroTradePulse.jsx`
  - Market news: `neuro_market/frontend/src/components/MarketNews.jsx`

Main pages:
- Auth: `neuro_market/frontend/src/pages/Login.jsx`, `neuro_market/frontend/src/pages/Signup.jsx`
- Dashboard: `neuro_market/frontend/src/pages/Dashboard.jsx`
- Stock trading: `neuro_market/frontend/src/pages/StockDetail.jsx`
- Practice mode: `neuro_market/frontend/src/pages/Practice.jsx`
- Portfolio: `neuro_market/frontend/src/pages/Portfolio.jsx`
- Sessions: `neuro_market/frontend/src/pages/SessionHistory.jsx`, `neuro_market/frontend/src/pages/SessionDetail.jsx`
- Analytics: `neuro_market/frontend/src/pages/Analytics.jsx`
- Leaderboard: `neuro_market/frontend/src/pages/Leaderboard.jsx`
- Admin: `neuro_market/frontend/src/pages/Admin.jsx`
- Admin DB Explorer: `neuro_market/frontend/src/pages/DatabaseExplorer.jsx`

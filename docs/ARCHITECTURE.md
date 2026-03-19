# Architecture

## Backend (FastAPI)

Entry: [main.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/main.py)

Key modules:
- Models/DB: [database.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/models/database.py), [schemas.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/models/schemas.py)
- Auth: [auth.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/services/auth.py), [auth.py (routes)](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/routes/auth.py)
- Stock data + candles: [stock_service.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/services/stock_service.py)
- Emotion websocket + mapping: [emotion.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/routes/emotion.py), [facial_emotion.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/services/facial_emotion.py)
- Trading routes: [trading.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/routes/trading.py)
- Options: [options.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/routes/options.py), [options_pricing.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/services/options_pricing.py)
- Practice advisor: [practice.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/routes/practice.py), [practice_advisor.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/services/practice_advisor.py)
- Admin: [admin.py](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/backend/routes/admin.py)

### Persistence
- SQLite is used by default.
- Emotion logs are persisted on a throttled cadence to avoid websocket crashes.

## Frontend (React + Vite + Tailwind)

Entry: [main.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/main.jsx)

Key pieces:
- Global camera + emotion monitoring: [EmotionContext.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/context/EmotionContext.jsx)
- Floating camera overlay: [CameraOverlay.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/components/CameraOverlay.jsx)
- Candles + live updates + markers: [CandlestickChart.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/components/CandlestickChart.jsx)
- Trading confirmation modal: [Modal.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/components/Modal.jsx)

Main pages:
- Auth: [Login.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/Login.jsx), [Signup.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/Signup.jsx)
- Dashboard: [Dashboard.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/Dashboard.jsx)
- Stock trading: [StockDetail.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/StockDetail.jsx)
- Practice mode: [Practice.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/Practice.jsx)
- Portfolio: [Portfolio.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/Portfolio.jsx)
- Analytics: [Analytics.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/Analytics.jsx)
- Admin: [Admin.jsx](file:///Users/ankitadhikari/Desktop/NeuroMarket/neuro_market/frontend/src/pages/Admin.jsx)


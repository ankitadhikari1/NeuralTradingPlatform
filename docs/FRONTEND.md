# Frontend Guide (React + Vite)

Frontend code lives in `neuro_market/frontend`.

## Entry + Providers

- `src/main.jsx` mounts the app and wraps it with providers:
  - `EmotionProvider` – global camera + emotion websocket
  - `ChatProvider` – AI assistant chat state (still used in some UI tools)

## Networking

Axios is configured in `src/App.jsx`:

- `axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'`
- the JWT token is loaded from `localStorage` and applied to the Authorization header.

## Routing + Access Control

Routes are defined in `src/App.jsx`:

- Protected routes require a logged-in user.
- Admin routes require `user.is_admin === true`.

Admin-only pages:

- `/admin`
- `/admin/explorer`

## Core Pages

- Dashboard: `src/pages/Dashboard.jsx`
  - market overview + watchlist + quick chart
  - market news panel
  - uses the Neuro-themed loader while fetching data

- Stock Detail / Trading: `src/pages/StockDetail.jsx`
  - candlestick chart + real-time websocket price updates
  - session start/end controls
  - trade confirmation flow integrated with risk engine responses
  - options trading panel
  - Neuro-Pulse widget (trade readiness / risk)

- Portfolio: `src/pages/Portfolio.jsx`
  - holdings + allocation charts
  - quick SELL modal with quantity + projected P/L
  - closes option positions (prototype)

- Sessions: `src/pages/SessionHistory.jsx`, `src/pages/SessionDetail.jsx`
  - view session summaries and report links

- Analytics: `src/pages/Analytics.jsx`
  - emotion distribution charts
  - emotion vs trade size scatter chart
  - portfolio growth chart

- Leaderboard: `src/pages/Leaderboard.jsx`
  - ranks non-admin users using backend aggregation

## Key Components

- Candlestick chart: `src/components/CandlestickChart.jsx`
  - uses lightweight-charts
  - fetches historical candles
  - subscribes to `WS /trading/ws/price` for 1D realtime updates
  - supports BUY/SELL markers

- Modal: `src/components/Modal.jsx`
  - generic confirm/cancel modal used for trade confirmations and portfolio sells

- Emotion Overlay: `src/components/CameraOverlay.jsx`
  - persistent webcam overlay across routes

- Neuro UX:
  - `src/components/NeuroLoader.jsx`
  - `src/components/NeuroTradePulse.jsx`
  - `src/components/MarketNews.jsx`

## UI Conventions

- TailwindCSS is used for layout and styling.
- Pages use “card” containers and consistent spacing.
- Data tables use sticky headers and hover rows for readability.

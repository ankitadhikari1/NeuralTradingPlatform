# Backend Guide (FastAPI)

Backend code lives in `neuro_market/backend`.

## Entry Point

- `main.py` creates the FastAPI app, enables CORS, initializes the database, and registers routers.

Routers included:

- `routes/auth.py`
- `routes/trading.py`
- `routes/emotion.py`
- `routes/options.py`
- `routes/practice.py`
- `routes/admin.py`
- `routes/ai_assistant.py`

## Authentication

Auth is JWT-based:

- Login returns a token; frontend stores it in `localStorage`.
- Every request uses `Authorization: Bearer <token>`.

Key files:

- `services/auth.py` – token creation/verification, DB session dependency.
- `routes/auth.py` – signup/login/me endpoints.

## Trading Sessions

Trading requires an active session:

- `POST /trading/session/start`
- `GET /trading/session/active`
- `POST /trading/session/end`

Sessions power:

- discipline/risk metrics
- leaderboard score aggregation
- end-of-session PDF report generation

Core logic is in `routes/trading.py`:

- `_require_active_session` enforces session gating.
- `_finalize_session` computes win rate, P/L, drawdown, behavioral metrics, and triggers report generation.

## Risk Engine (Emotion + Behavior)

Risk gating happens before trade execution:

- cooldowns (stress/anxiety/fear/greed)
- confirmations for certain states/trade sizes
- trade-size limits under high emotional intensity

Core logic:

- `risk_engine/risk_control_engine.py`

## Market Data

Market pricing uses yfinance with:

- timeouts (to avoid UI freezes)
- cached responses
- simulated fallback prices/candles if Yahoo data is missing

Core logic:

- `services/stock_service.py`

## Options (Prototype)

Options trades use:

- simplified mark price / Black–Scholes model
- P&L websocket updates
- stop-loss/take-profit auto-close behavior

Core logic:

- `routes/options.py`
- `services/options_pricing.py`

## Emotion WebSocket

Emotion streaming:

- frontend sends frames to `/emotion/ws`
- backend runs face/emotion inference (DeepFace)
- backend returns `emotion`, `confidence`, `face` distribution

Core logic:

- `routes/emotion.py`
- `services/facial_emotion.py`

## Session Reports

When a session ends, the backend generates:

- PDF report
- charts (equity curve, distribution)

Files are written under:

- `neuro_market/backend/session_reports/` (configurable via `SESSION_REPORTS_DIR`)

## Admin + Database Explorer

Admin-only routes are protected by an admin dependency (`require_admin`).

Admin DB explorer endpoints:

- `/admin/db/schema` – list tables + columns + keys + row counts
- `/admin/db/table/{table}/data` – paginated data viewer with search/sort

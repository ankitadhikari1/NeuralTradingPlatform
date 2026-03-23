# Database (Schema + Relationships)

NeuroMarket Lite uses SQLAlchemy models with SQLite by default.

Main model definitions live in:

- `neuro_market/backend/models/database.py`

## Default Database

- SQLite file: `neuro_market/backend/neuro_market.db`
- Configurable via `DATABASE_URL`

## Core Tables (High-Level)

### Users

Holds authentication identity, role and balances:

- `users`
  - `id` (PK)
  - `username`, `email`, `hashed_password`
  - `cash_balance`
  - `is_admin`

### Portfolio

Current stock holdings per user:

- `portfolio`
  - `id` (PK)
  - `user_id` (FK → users.id)
  - `stock_symbol`
  - `quantity`
  - `avg_price`

### Trades

Recorded stock trades:

- `trades`
  - `id` (PK)
  - `user_id` (FK → users.id)
  - `session_id` (FK-like integer; used for grouping into sessions)
  - `stock_symbol`
  - `trade_type` (BUY/SELL)
  - `quantity`, `price`
  - `timestamp`
  - `emotional_state` (stored as a label + confidence string)

### TradePerformance

Performance metadata for SELL trades (realized P/L, win flag, trade amount):

- `trade_performance`
  - `trade_id` (FK → trades.id)
  - `session_id`
  - `user_id`
  - `realized_pnl`
  - `is_win`

### TradingSession

Sessions group trades and power reports, session history, and the leaderboard:

- `trading_sessions`
  - `id` (PK)
  - `user_id` (FK → users.id)
  - `status` (ACTIVE / ENDED)
  - `started_at`, `ended_at`, `expires_at`
  - `profit_loss`, `win_rate`, `max_drawdown`
  - `total_trades`
  - `risk_score`, `trading_consistency_score`
  - `report_path`

### SessionEvent

Event stream used for analytics/debugging:

- `session_events`
  - `session_id`
  - `user_id`
  - `event_type` (TRADE_EXECUTED, OPTION_OPENED, OPTION_CLOSED, RISK_ALERT, etc.)
  - `payload` (JSON string)
  - `created_at`

### EmotionLog

Stores emotion outputs over time:

- `emotion_logs`
  - `user_id` (FK → users.id)
  - `emotion`, `confidence`
  - `timestamp`

### OptionTrade

Options trades (prototype):

- `option_trades`
  - `user_id`
  - `session_id`
  - `underlying_symbol`
  - `option_type` (CALL/PUT)
  - `strike`, `expiry`, `contracts`
  - `entry_price`, `exit_price`
  - `status` (OPEN/CLOSED)
  - `stop_loss`, `take_profit`
  - `opened_at`, `closed_at`

## Relationship Patterns

Common chains you’ll see in queries and the Admin Explorer:

- `users → trading_sessions → trades`
- `users → portfolio`
- `users → emotion_logs`
- `trading_sessions → session_events`
- `option_trades` are linked to `trading_sessions` via `session_id`

## Admin Database Explorer

The UI reads schema + row counts via:

- `GET /admin/db/schema`
- `GET /admin/db/table/{table}/data`

Only admin users can access these endpoints.

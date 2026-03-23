# API Endpoints

Base URL: `http://localhost:8000`

## Auth
- `POST /auth/signup`
- `POST /auth/login` (OAuth2 password form)
- `GET /auth/me`

## Trading (Stocks)
- `GET /trading/stocks/popular`
- `GET /trading/stocks/{symbol}`
- `GET /trading/stocks/{symbol}/history?period=1mo`
- `GET /trading/stocks/{symbol}/candles?interval=1m&period=1d`
- `POST /trading/session/start`
- `POST /trading/session/end`
- `GET /trading/session/active`
- `POST /trading/trade`
- `GET /trading/portfolio`
- `GET /trading/watchlist`
- `POST /trading/watchlist` (body: `{ "symbol": "AAPL" }`)
- `DELETE /trading/watchlist/{symbol}`
- `GET /trading/history`
- `GET /trading/sessions`
- `GET /trading/sessions/{id}`
- `GET /trading/sessions/{id}/replay`
- `GET /trading/sessions/{id}/report` (downloads the PDF if present)
- `GET /trading/leaderboard?timeframe=weekly|monthly|all`
- `GET /trading/badges`
- `GET /trading/performance/dashboard`
- `WS /trading/ws/price?token=...&symbols=AAPL,MSFT&simulate=true`

## Emotion (Camera)
- `GET /emotion/logs`
- `WS /emotion/ws?token=...`
  - client sends `{ "frame": "data:image/jpeg;base64,..." }`
  - server responds with `{ emotion, confidence, face, dominant_face_emotion, face_status, timestamp }`

## Options
- `POST /options/open`
- `POST /options/close/{trade_id}`
- `GET /options/estimate?symbol=...&strike=...&expiry=...&option_type=CALL|PUT&contracts=...`
- `GET /options/positions`
- `GET /options/history`
- `WS /options/ws/pnl?token=...`

## Practice
- `GET /practice/recommendation?symbol=AAPL`

## AI Brief (Market News Feed)
- `GET /ai/brief`

## Admin
- `GET /admin/users?q=...`
- `POST /admin/balance/set`
- `POST /admin/balance/topup`
- `GET /admin/user/{username}/portfolio`
- `GET /admin/user/{username}/trades`
- `GET /admin/user/{username}/options`
- `GET /admin/user/{username}/emotions`
- `GET /admin/sessions`
- `GET /admin/sessions/stats`
- `GET /admin/db/schema`
- `GET /admin/db/table/{table_name}/data?page=1&page_size=50&search=...&sort_by=...&sort_order=asc|desc`

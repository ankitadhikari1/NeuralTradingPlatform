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
- `POST /trading/trade`
- `GET /trading/portfolio`
- `GET /trading/history`
- `WS /trading/ws/price?token=...&symbols=AAPL,MSFT&simulate=true`

## Emotion (Camera)
- `GET /emotion/logs`
- `WS /emotion/ws?token=...`
  - client sends `{ "frame": "data:image/jpeg;base64,..." }`
  - server responds with `{ emotion, confidence, face, dominant_face_emotion, face_status, timestamp }`

## Options
- `POST /options/open`
- `POST /options/close/{trade_id}`
- `GET /options/positions`
- `GET /options/history`
- `WS /options/ws/pnl?token=...`

## Practice
- `GET /practice/recommendation?symbol=AAPL`

## Admin
- `GET /admin/users?q=...`
- `POST /admin/balance/set`
- `POST /admin/balance/topup`


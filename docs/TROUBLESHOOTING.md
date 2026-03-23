# Troubleshooting

## Frontend

### Blank UI / Cannot Load Data

- Confirm the backend is running on the expected URL (`http://localhost:8000` by default).
- Confirm the frontend uses the correct backend base URL:
  - `VITE_API_BASE_URL` or the default in `src/App.jsx`

### “Too many refreshes” / UI refresh loops

- Usually caused by unstable function dependencies in `useEffect`.
- Wrap async fetch functions in `useCallback` and include them in dependency arrays.

### ESLint fails with hook dependency warnings

The frontend lint script treats warnings as errors. Fix by:

- converting inline functions used by `useEffect` into `useCallback` hooks
- adding the callback to the dependency array

## Backend

### “Start a trading session before trading”

Trading endpoints require an active session:

- start one using `POST /trading/session/start`
- or start it from the UI in the trading screen

### Market data warnings (yfinance)

Yahoo can fail for some tickers or return empty data. The backend:

- uses timeouts + caching
- falls back to simulated prices/candles when data is missing

If you see “symbol may be delisted” for a `$SYMBOL` style ticker, ensure the ticker is sent as `SYMBOL` without a leading `$`.

### Login issues

If login fails unexpectedly:

- check `SECRET_KEY` consistency
- confirm the backend server is running and reachable from the frontend

## Admin Database Explorer

If `/admin/explorer` loads but shows no tables:

- confirm you are logged in as an admin (`user.is_admin === true`)
- confirm the backend includes the admin router
- confirm the DB is accessible (SQLite file exists or `DATABASE_URL` is valid)

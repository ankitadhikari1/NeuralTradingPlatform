# Setup & Local Development

## Prerequisites

- Node.js (for the React frontend)
- Python (for the FastAPI backend)

## Repository Layout

- Backend: `neuro_market/backend`
- Frontend: `neuro_market/frontend`
- Docs: `docs`

## Backend (FastAPI)

From the repository root:

1) Create a virtual environment (recommended) and install dependencies:

```bash
cd neuro_market/backend
pip install -r requirements.txt
```

2) Run the API server:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at:

- `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`

### Backend Environment Variables

These are optional (defaults exist):

- `SECRET_KEY` – JWT signing key (development default is used if not set).
- `DATABASE_URL` – SQLAlchemy DB URL (default: `sqlite:///./neuro_market.db`)
- `DEFAULT_CASH_BALANCE` – starting cash (default: `10000`)
- `SESSION_DEFAULT_MINUTES` – default trading session duration (default: `60`)
- `SESSION_REPORTS_DIR` – session report output directory (default: `./session_reports`)

Admin bootstrap (optional):

- `ADMIN_USERNAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_BALANCE` (default: `1000000`)

## Frontend (React + Vite)

From the repository root:

```bash
cd neuro_market/frontend
npm install
npm run dev
```

The UI will be available at:

- `http://localhost:3000` (Vite typically prints the exact URL)

### Frontend Environment Variables

- `VITE_API_BASE_URL` – backend base URL (default: `http://localhost:8000`)

## First Run Checklist

- Sign up a new user via the UI.
- Start a trading session inside a stock page before trading.
- Allow camera permissions to enable emotion monitoring.
- Use Portfolio → SELL to exit holdings (Portfolio auto-starts a session when needed).

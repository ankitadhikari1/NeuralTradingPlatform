# NeuroMarket Lite – Emotion-Aware AI Trading Platform

NeuroMarket Lite is an emotion-aware trading simulator that monitors the user's emotional state using real-time webcam-based facial emotion recognition (DeepFace). It reduces impulsive trading by applying emotion-aware confirmations/blocks and provides a dedicated Practice Session mode for learning.

## Features

- **Authentication System**: Secure JWT-based login and signup.
- **Trading Simulator**: Real-time market data (via yfinance), candlestick charts, portfolio management, trade history, and chart markers showing buy/sell points.
- **Emotion Monitoring**: Persistent webcam monitoring across pages with a floating camera overlay.
- **AI Risk Engine**: Automatic trade blocking, warnings, and confirmations based on emotional states (Stress, Excitement, Anxiety, Calm).
- **Advanced Analytics**: Emotion vs. Profit analysis, distribution charts, and AI-driven trading insights.
- **Practice Session**: Demo balance + live chart + AI BUY/SELL/HOLD recommendations based on stock indicators and your stats.
- **Options Trading (Prototype)**: LONG CALL/PUT positions with stop-loss/take-profit and real-time P&L updates.

## Tech Stack

- **Backend**: Python, FastAPI, SQL, JWT, WebSockets.
- **AI/ML**: DeepFace (Facial Emotion).
- **Frontend**: React (Vite), TailwindCSS, Recharts, Axios, Lucide Icons.
- **Market Data**: yfinance API.

## Project Structure

```text
neuro_market/
├── backend/
│   ├── main.py              # Entry point
│   ├── routes/              # API endpoints (Auth, Trading, Emotion)
│   ├── models/              # Database models and Pydantic schemas
│   ├── services/            # Business logic (Auth, Stock, Facial Emotion)
│   ├── ai/                  # AI logic (EEG Simulator, Emotion Classifier)
│   └── risk_engine/         # Risk management rules
└── frontend/
    ├── src/
    │   ├── pages/           # React pages (Dashboard, Monitor, Analytics, etc.)
    │   ├── components/      # Reusable UI components
    │   └── App.jsx          # Main application & Routing
    └── tailwind.config.js   # UI Styling
```

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- Webcam (for emotion monitoring)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd neuro_market/backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```
   The server will start at `http://localhost:8000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd neuro_market/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000` (or the port printed by Vite).

## Documentation

- [docs/CONTEXT.md](file:///Users/ankitadhikari/Desktop/NeuroMarket/docs/CONTEXT.md)
- [docs/ARCHITECTURE.md](file:///Users/ankitadhikari/Desktop/NeuroMarket/docs/ARCHITECTURE.md)
- [docs/ENDPOINTS.md](file:///Users/ankitadhikari/Desktop/NeuroMarket/docs/ENDPOINTS.md)

---
*Note: This is a prototype intended for research and demonstration purposes. Do not use with real financial accounts.*
# NeuralTradingPlatform

from typing import Dict, List, Any, Tuple
import pandas as pd
from models import database
from services import stock_service

def _rsi(series: pd.Series, period: int = 14) -> float:
    if series is None or len(series) < period + 1:
        return 50.0
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, 1e-9)
    rsi = 100 - (100 / (1 + rs))
    value = float(rsi.iloc[-1])
    if value != value:
        return 50.0
    return max(0.0, min(100.0, value))

def _sma(series: pd.Series, window: int) -> float:
    if series is None or len(series) < window:
        return float(series.mean()) if series is not None and len(series) else 0.0
    return float(series.rolling(window).mean().iloc[-1])

def _compute_realized_pnl(trades: List[database.Trade], symbol: str) -> Dict[str, float]:
    symbol = symbol.upper()
    t = [x for x in trades if x.stock_symbol.upper() == symbol]
    t.sort(key=lambda x: x.timestamp)

    lots: List[Tuple[float, float]] = []
    realized = 0.0
    sells = 0
    wins = 0

    for tr in t:
        qty = float(tr.quantity)
        price = float(tr.price)
        if tr.trade_type == "BUY":
            lots.append((qty, price))
        elif tr.trade_type == "SELL":
            remaining = qty
            pnl = 0.0
            while remaining > 0 and lots:
                lot_qty, lot_price = lots[0]
                take = min(remaining, lot_qty)
                pnl += (price - lot_price) * take
                lot_qty -= take
                remaining -= take
                if lot_qty <= 1e-9:
                    lots.pop(0)
                else:
                    lots[0] = (lot_qty, lot_price)
            realized += pnl
            sells += 1
            if pnl > 0:
                wins += 1

    win_rate = (wins / sells) * 100.0 if sells else 0.0
    return {
        "realized_pnl": float(realized),
        "sell_trades": float(sells),
        "win_rate": float(win_rate),
    }

def _intraday_momentum(symbol: str) -> Dict[str, float]:
    candles = stock_service.StockService.get_candles(symbol, interval="1m", period="1d")
    if not candles or len(candles) < 25:
        return {"return_15m": 0.0, "sma5": 0.0, "sma20": 0.0}

    closes = pd.Series([float(c["close"]) for c in candles if "close" in c])
    if closes.empty:
        return {"return_15m": 0.0, "sma5": 0.0, "sma20": 0.0}

    last = float(closes.iloc[-1])
    prev = float(closes.iloc[-16]) if len(closes) >= 16 else float(closes.iloc[0])
    ret = ((last - prev) / max(1e-9, prev)) * 100.0
    sma5 = float(closes.tail(5).mean()) if len(closes) >= 5 else float(closes.mean())
    sma20 = float(closes.tail(20).mean()) if len(closes) >= 20 else float(closes.mean())
    return {"return_15m": float(ret), "sma5": sma5, "sma20": sma20}

def recommend(symbol: str, user: database.User, db, current_price: float | None = None, practice_stats: Dict[str, float] | None = None, emotion: Dict[str, float] | None = None) -> Dict[str, Any]:
    symbol = symbol.upper().strip()
    history = stock_service.StockService.get_historical_data(symbol, period="3mo")
    if not history:
        raise ValueError("No historical data")

    df = pd.DataFrame(history)
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df = df.dropna(subset=["price"])
    prices = df["price"]
    last_price = float(current_price) if current_price is not None else float(prices.iloc[-1])

    sma20 = _sma(prices, 20)
    sma50 = _sma(prices, 50)
    rsi14 = _rsi(prices, 14)
    intraday = _intraday_momentum(symbol)

    trades = db.query(database.Trade).filter(database.Trade.user_id == user.id).all()
    stats = practice_stats or _compute_realized_pnl(trades, symbol)
    realized_pnl = float(stats.get("realized_pnl", 0.0))
    sell_trades = float(stats.get("sell_trades", 0.0))
    win_rate = float(stats.get("win_rate", 0.0))

    emotion_logs = (
        db.query(database.EmotionLog)
        .filter(database.EmotionLog.user_id == user.id)
        .order_by(database.EmotionLog.timestamp.desc())
        .limit(100)
        .all()
    )
    calm_count = sum(1 for e in emotion_logs if (e.emotion or "").lower() == "calm")
    calm_ratio = float(practice_stats.get("calm_ratio")) if practice_stats and "calm_ratio" in practice_stats else (calm_count / len(emotion_logs) if emotion_logs else 0.0)

    action = "HOLD"
    confidence = 0.55
    rationale: List[str] = []

    trend_up = sma20 >= sma50 and last_price >= sma20
    trend_down = sma20 < sma50 and last_price < sma20
    momo_up = intraday["return_15m"] > 0.15 and intraday["sma5"] >= intraday["sma20"]
    momo_down = intraday["return_15m"] < -0.15 and intraday["sma5"] < intraday["sma20"]

    if trend_up and rsi14 < 70:
        action = "BUY"
        confidence = 0.66
        rationale.append("Uptrend detected (SMA20 >= SMA50 and price above SMA20).")
        rationale.append("RSI below 70 suggests momentum without extreme overbought conditions.")
    elif trend_down and rsi14 > 30:
        action = "SELL"
        confidence = 0.66
        rationale.append("Downtrend detected (SMA20 < SMA50 and price below SMA20).")
        rationale.append("RSI above 30 suggests room for downside continuation before oversold.")
    else:
        action = "HOLD"
        confidence = 0.60
        rationale.append("No strong trend signal; avoid forcing a trade.")

    if momo_up and action != "SELL":
        action = "BUY"
        confidence += 0.06
        rationale.append("Short-term momentum is positive (15m return up; SMA5 >= SMA20).")
    if momo_down and action != "BUY":
        action = "SELL"
        confidence += 0.06
        rationale.append("Short-term momentum is negative (15m return down; SMA5 < SMA20).")

    if sell_trades >= 3 and win_rate < 40:
        confidence -= 0.08
        rationale.append("Your recent realized win rate on this symbol is low; reduce frequency and size.")

    if calm_ratio < 0.45 and len(emotion_logs) >= 10:
        confidence -= 0.10
        rationale.append("Your recent emotional baseline is not calm; prioritize discipline over entries.")

    if emotion and emotion.get("confidence", 0.0) >= 0.6:
        state = str(emotion.get("state", "")).lower()
        if state in {"stress", "excitement", "anxiety"}:
            confidence -= 0.10
            rationale.append(f"Current emotion is {state}; reduce aggressiveness or wait for calm.")

    confidence = float(max(0.05, min(0.95, confidence)))

    return {
        "symbol": symbol,
        "action": action,
        "confidence": confidence,
        "rationale": rationale,
        "indicators": {
            "last_price": last_price,
            "sma20": float(sma20),
            "sma50": float(sma50),
            "rsi14": float(rsi14),
            "return_15m": float(intraday["return_15m"]),
            "intraday_sma5": float(intraday["sma5"]),
            "intraday_sma20": float(intraday["sma20"]),
        },
        "user_stats": {
            "realized_pnl": realized_pnl,
            "win_rate": win_rate,
            "calm_ratio": float(calm_ratio),
        },
    }

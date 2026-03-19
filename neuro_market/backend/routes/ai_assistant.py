from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import database, schemas
from services import auth, emotion_forecast, trading_simulator, stock_service
from typing import List, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/ai", tags=["ai"])

@router.get("/brief", response_model=Dict[str, Any])
def ai_brief(
    current_user: database.User = Depends(auth.get_current_user),
):
    stocks = stock_service.StockService.get_popular_stocks()
    if not stocks:
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "sentiment": "Neutral",
            "breadth": {"gainers": 0, "losers": 0},
            "top_gainers": [],
            "top_losers": [],
            "headlines": [],
        }

    gainers = [s for s in stocks if float(getattr(s, "change_percent", 0.0) or 0.0) > 0]
    losers = [s for s in stocks if float(getattr(s, "change_percent", 0.0) or 0.0) < 0]

    sentiment = "Neutral"
    if len(gainers) > len(losers):
        sentiment = "Bullish"
    elif len(losers) > len(gainers):
        sentiment = "Bearish"

    sorted_by_move = sorted(stocks, key=lambda s: float(getattr(s, "change_percent", 0.0) or 0.0), reverse=True)
    top_gainers = sorted_by_move[:3]
    top_losers = list(reversed(sorted_by_move[-3:]))

    def pct(s):
        return float(getattr(s, "change_percent", 0.0) or 0.0)

    def px(s):
        return float(getattr(s, "price", 0.0) or 0.0)

    movers = top_gainers + top_losers
    headlines = []
    for s in movers[:5]:
        sym = str(getattr(s, "symbol", "") or "").upper()
        p = pct(s)
        direction = "jumps" if p >= 0 else "slides"
        bucket = "tech momentum" if sym in {"AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META"} else "market rotation"
        headlines.append(f"{sym} {direction} {abs(p):.2f}% amid {bucket}.")

    headlines.append("Macro watch: rates, earnings, and risk sentiment drive intraday volatility.")

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "sentiment": sentiment,
        "breadth": {"gainers": len(gainers), "losers": len(losers)},
        "top_gainers": [{"symbol": s.symbol, "price": px(s), "change_percent": pct(s)} for s in top_gainers],
        "top_losers": [{"symbol": s.symbol, "price": px(s), "change_percent": pct(s)} for s in top_losers],
        "headlines": headlines,
    }

@router.get("/forecast", response_model=Dict[str, Any])
def ai_forecast(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    # Get recent emotion history
    history = db.query(database.EmotionLog).filter(
        database.EmotionLog.user_id == current_user.id
    ).order_by(database.EmotionLog.timestamp.desc()).limit(20).all()
    
    emotion_list = [h.emotion for h in reversed(history)]
    prediction = emotion_forecast.predict_next_emotion(emotion_list)
    
    # Recommendation logic
    rec = "Trading conditions stable. Follow your plan."
    if prediction["prediction"] == "Stress":
        rec = "High stress predicted. Consider pausing trading to avoid impulsive decisions."
    elif prediction["prediction"] == "Excitement":
        rec = "Excitement predicted. This can lead to FOMO. Confirm risk before executing."
    elif prediction["prediction"] == "Anxiety":
        rec = "Anxiety predicted. Review your strategy and consider smaller positions."

    return {
        "current": emotion_list[-1] if emotion_list else "Calm",
        "predicted": prediction["prediction"],
        "confidence": prediction["confidence"],
        "recommendation": rec
    }

@router.post("/simulate", response_model=Dict[str, Any])
def ai_simulate(
    payload: Dict[str, str],
    current_user: database.User = Depends(auth.get_current_user)
):
    mode = payload.get("mode", "calm")
    if mode not in {"calm", "stress", "excitement"}:
        raise HTTPException(status_code=400, detail="Invalid simulation mode")
        
    return trading_simulator.run_trading_simulation(mode)

@router.post("/chat", response_model=Dict[str, str])
def ai_chat(
    payload: Dict[str, str],
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    message = payload.get("message", "").lower()
    
    # Get recent trades
    recent_trades = db.query(database.Trade).filter(
        database.Trade.user_id == current_user.id
    ).order_by(database.Trade.timestamp.desc()).limit(5).all()
    
    # Get last emotion log
    last_emotion = db.query(database.EmotionLog).filter(
        database.EmotionLog.user_id == current_user.id
    ).order_by(database.EmotionLog.timestamp.desc()).first()
    
    emotion_state = last_emotion.emotion if last_emotion else "calm"
    
    # Rule-based logic
    reply = "I'm here to help you trade with emotional intelligence. How can I assist you today?"
    
    if "emotion" in message or "feeling" in message:
        if emotion_state == "stress":
            reply = "High stress detected. Consider pausing trading to avoid impulsive decisions."
        elif emotion_state == "excitement" or emotion_state == "excited":
            reply = "Excitement detected. This can lead to FOMO. Confirm your risk plan before executing."
        elif emotion_state == "anxiety":
            reply = "Anxiety detected. Take a break and review your strategy when you're feeling more confident."
        else:
            reply = "Emotional state stable. Trading conditions normal. Stay focused!"
            
    elif "trade" in message or "performance" in message or "loss" in message:
        losses = [t for t in recent_trades if t.trade_type == "SELL"] # Simplified loss detection
        if len(losses) >= 3:
            reply = "Recent multiple losses detected. It might be wise to reduce your position size or re-evaluate your entry criteria."
        else:
            reply = "Your recent trade activity looks stable. Remember to keep an eye on your emotional state during high volatility."
            
    elif "advice" in message or "help" in message:
        if emotion_state != "calm":
            reply = f"Since you're currently feeling {emotion_state}, my advice is to slow down. Check your stop losses and don't over-leverage."
        else:
            reply = "Stay disciplined! Ensure every trade follows your pre-defined rules. You're doing great."

    return {"reply": reply}

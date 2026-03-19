from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from models import database, schemas
from services import auth, stock_service
from risk_engine import risk_control_engine
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
import json
import random
import os
import math
import statistics

router = APIRouter(prefix="/trading", tags=["trading"])
risk_engine = risk_control_engine.RiskControlEngine()
DEFAULT_SESSION_MINUTES = int(os.getenv("SESSION_DEFAULT_MINUTES", "60"))
REPORTS_DIR = os.getenv("SESSION_REPORTS_DIR", "./session_reports")

def _now() -> datetime:
    return datetime.utcnow()

def _parse_emotion_label(label: str) -> str:
    if not label:
        return ""
    base = label.split(" (")[0].strip().lower()
    if base == "anxiet":
        base = "anxiety"
    if base == "greeed":
        base = "greed"
    return base

def _get_active_session(db: Session, user_id: int) -> database.TradingSession | None:
    return (
        db.query(database.TradingSession)
        .filter(database.TradingSession.user_id == user_id, database.TradingSession.status == "ACTIVE")
        .order_by(database.TradingSession.started_at.desc())
        .first()
    )

def _bucket_risk(score: float) -> str:
    s = float(score or 0.0)
    if s < 33:
        return "low"
    if s < 66:
        return "medium"
    return "high"

def _compute_max_drawdown(equity: List[float]) -> float:
    peak = -float("inf")
    max_dd = 0.0
    for x in equity:
        peak = max(peak, float(x))
        dd = peak - float(x)
        if dd > max_dd:
            max_dd = dd
    return float(max_dd)

def _score_clamp(x: float) -> float:
    return float(max(0.0, min(100.0, float(x))))

def _compute_scores(
    duration_seconds: float,
    total_exec: int,
    impulsive_count: int,
    overtrade_flag: bool,
    max_drawdown: float,
    realized_losses: int,
    high_emotion_exec: int,
    risk_alerts: int,
    amounts: List[float],
    gaps: List[float],
) -> Dict[str, float]:
    duration_minutes = max(1.0, float(duration_seconds) / 60.0)
    exec_rate = float(total_exec) / duration_minutes
    overtrade_ratio = 1.0 if overtrade_flag else min(1.0, max(0.0, (exec_rate - 1.5) / 4.0))
    impulsive_rate = float(impulsive_count) / max(1.0, float(total_exec))
    emo_rate = float(high_emotion_exec) / max(1.0, float(total_exec))
    drawdown_ratio = min(1.0, float(max_drawdown) / 2000.0)
    loss_ratio = min(1.0, float(realized_losses) / max(1.0, float(total_exec)))

    risk_score = _score_clamp((overtrade_ratio * 35.0) + (drawdown_ratio * 35.0) + (emo_rate * 20.0) + (loss_ratio * 10.0) + (min(10.0, risk_alerts) * 2.0))
    discipline_score = _score_clamp(100.0 - (impulsive_rate * 70.0) - (overtrade_ratio * 45.0) - (min(10.0, risk_alerts) * 4.0))

    cv_amount = 0.0
    if len(amounts) >= 3:
        mean_a = float(statistics.mean(amounts))
        if mean_a > 1e-9:
            cv_amount = float(statistics.pstdev(amounts) / mean_a)
    cv_gap = 0.0
    if len(gaps) >= 3:
        mean_g = float(statistics.mean(gaps))
        if mean_g > 1e-9:
            cv_gap = float(statistics.pstdev(gaps) / mean_g)
    cv_amount = min(2.0, cv_amount)
    cv_gap = min(2.0, cv_gap)
    consistency_score = _score_clamp(100.0 - (cv_amount * 35.0) - (cv_gap * 35.0) - (overtrade_ratio * 20.0))

    return {
        "risk_score": float(risk_score),
        "discipline_score": float(discipline_score),
        "trading_consistency_score": float(consistency_score),
    }

def _generate_recommendations(metrics: Dict[str, Any]) -> List[str]:
    recs: List[str] = []
    if metrics.get("overtrading_detected"):
        recs.append("Overtrading detected. Set a max trades-per-hour limit and require a checklist before each entry.")
    if int(metrics.get("impulsive_trades", 0) or 0) > 0:
        recs.append("Impulsive trades detected. Add a 60-second rule: wait one minute and re-validate your thesis before executing.")
    if int(metrics.get("revenge_trading_indicator", 0) or 0) > 0:
        recs.append("Revenge trading signals detected. After a loss, take a 5–10 minute cooldown and reduce size on the next trade.")
    if float(metrics.get("max_drawdown", 0.0) or 0.0) > 0:
        recs.append("Review drawdown periods and identify what changed (emotion, size, speed). Add a drawdown stop for the day/session.")
    if float(metrics.get("risk_exposure_max_pct_cash", 0.0) or 0.0) >= 25.0:
        recs.append("Risk exposure was high. Cap single-trade exposure and use smaller sizing when emotion confidence is elevated.")
    if not recs:
        recs.append("Session looked stable. Keep following your plan and focus on consistent sizing and patience.")
    return recs[:6]

def _award_badges(
    db: Session,
    user_id: int,
    session_id: int,
    profit_loss: float,
    risk_score: float,
    discipline_score: float,
    consistency_score: float,
    max_drawdown: float,
):
    badges: List[str] = []
    if discipline_score >= 80.0:
        badges.append("disciplined_trader")
    if consistency_score >= 80.0:
        badges.append("consistent_trader")
    if risk_score >= 75.0:
        badges.append("high_risk_trader")
    if profit_loss > 0.0:
        badges.append("profitable_trader")
    if profit_loss > 0.0 and max_drawdown >= 500.0:
        badges.append("comeback_trader")

    for key in badges:
        db.add(
            database.UserBadge(
                user_id=user_id,
                badge_key=key,
                session_id=session_id,
                badge_metadata=None,
            )
        )

def _try_generate_pdf_report(
    user: database.User,
    session: database.TradingSession,
    trades: List[database.Trade],
    option_trades: List[database.OptionTrade],
    recommendations: List[str],
    behavioral_metrics: Dict[str, Any],
) -> str | None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    except Exception:
        return None

    base_dir = os.path.join(REPORTS_DIR, f"user_{user.id}")
    os.makedirs(base_dir, exist_ok=True)
    pdf_path = os.path.join(base_dir, f"session_{session.id}.pdf")

    realized = []
    for t in trades:
        if t.trade_type == "SELL":
            perf = getattr(t, "perf", None)
            realized.append((t.timestamp, float(perf.realized_pnl) if perf is not None else 0.0))
    for o in option_trades:
        if o.status == "CLOSED" and o.closed_at is not None and o.exit_price is not None:
            pnl = (float(o.exit_price) - float(o.entry_price)) * float(o.contracts) * 100.0
            realized.append((o.closed_at, pnl))
    realized.sort(key=lambda x: x[0])
    eq = []
    cur = 0.0
    for _, pnl in realized:
        cur += float(pnl)
        eq.append(cur)

    equity_png = os.path.join(base_dir, f"session_{session.id}_equity.png")
    plt.figure(figsize=(7.0, 2.6))
    plt.plot(list(range(1, len(eq) + 1)), eq, linewidth=2)
    plt.title("Equity Curve (Realized P/L)")
    plt.xlabel("Trade #")
    plt.ylabel("P/L")
    plt.tight_layout()
    plt.savefig(equity_png, dpi=160)
    plt.close()

    wins = int(session.winning_trades or 0)
    losses = int(session.losing_trades or 0)
    dist_png = os.path.join(base_dir, f"session_{session.id}_dist.png")
    plt.figure(figsize=(4.0, 2.6))
    plt.bar(["Wins", "Losses"], [wins, losses], color=["#10b981", "#ef4444"])
    plt.title("Win vs Loss")
    plt.tight_layout()
    plt.savefig(dist_png, dpi=160)
    plt.close()

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, title=f"Trading Session {session.id}")
    story = []

    story.append(Paragraph("Trading Session Report", styles["Title"]))
    story.append(Spacer(1, 10))

    header_rows = [
        ["User", str(user.username)],
        ["Session Date", session.started_at.strftime("%Y-%m-%d")],
        ["Start Time (UTC)", session.started_at.strftime("%H:%M:%S")],
        ["End Time (UTC)", session.ended_at.strftime("%H:%M:%S") if session.ended_at else "-"],
        ["Total Duration", f"{int((session.ended_at - session.started_at).total_seconds()) if session.ended_at else 0}s"],
    ]
    header_tbl = Table(header_rows, colWidths=[150, 360])
    header_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(header_tbl)
    story.append(Spacer(1, 12))

    stats_rows = [
        ["Total Trades", str(int(session.total_trades or 0))],
        ["Win Rate", f"{float(session.win_rate or 0.0):.2f}%"],
        ["Profit / Loss", f"{float(session.profit_loss or 0.0):.2f}"],
        ["Risk Score", f"{float(session.risk_score or 0.0):.1f}/100"],
        ["Discipline Score", f"{float(session.discipline_score or 0.0):.1f}/100"],
        ["Consistency Score", f"{float(session.trading_consistency_score or 0.0):.1f}/100"],
        ["Max Drawdown", f"{float(session.max_drawdown or 0.0):.2f}"],
        ["Avg Trade Time", f"{float(session.average_trade_time or 0.0):.1f}s"],
    ]
    stats_tbl = Table(stats_rows, colWidths=[150, 360])
    stats_tbl.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(Paragraph("Trading Statistics", styles["Heading2"]))
    story.append(Spacer(1, 6))
    story.append(stats_tbl)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Performance Charts", styles["Heading2"]))
    story.append(Spacer(1, 6))
    if os.path.exists(equity_png):
        story.append(Image(equity_png, width=500, height=190))
        story.append(Spacer(1, 10))
    if os.path.exists(dist_png):
        story.append(Image(dist_png, width=320, height=210))
        story.append(Spacer(1, 12))

    story.append(Paragraph("Behavioral Analysis", styles["Heading2"]))
    story.append(Spacer(1, 6))
    beh_rows = [
        ["Impulsive trades", str(int(behavioral_metrics.get("impulsive_trades", 0) or 0))],
        ["Overtrading detected", "Yes" if behavioral_metrics.get("overtrading_detected") else "No"],
        ["Revenge trading indicator", str(int(behavioral_metrics.get("revenge_trading_indicator", 0) or 0))],
        ["Risk exposure (max % cash)", f"{float(behavioral_metrics.get('risk_exposure_max_pct_cash', 0.0) or 0.0):.1f}%"],
    ]
    beh_tbl = Table(beh_rows, colWidths=[220, 290])
    beh_tbl.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(beh_tbl)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Recommendations", styles["Heading2"]))
    story.append(Spacer(1, 6))
    for r in recommendations[:8]:
        story.append(Paragraph(f"• {r}", styles["BodyText"]))
        story.append(Spacer(1, 3))

    doc.build(story)
    return pdf_path

def _finalize_session(db: Session, user: database.User, session: database.TradingSession) -> database.TradingSession:
    ended_at = _now()
    trades = (
        db.query(database.Trade)
        .filter(database.Trade.session_id == session.id)
        .order_by(database.Trade.timestamp.asc())
        .all()
    )
    for t in trades:
        perf = db.query(database.TradePerformance).filter(database.TradePerformance.trade_id == t.id).first()
        setattr(t, "perf", perf)

    option_trades = (
        db.query(database.OptionTrade)
        .filter(database.OptionTrade.session_id == session.id)
        .order_by(database.OptionTrade.opened_at.asc())
        .all()
    )

    exec_times: List[datetime] = []
    amounts: List[float] = []
    high_emotion_exec = 0
    for t in trades:
        exec_times.append(t.timestamp)
        amounts.append(float(t.price) * float(t.quantity))
        emo = _parse_emotion_label(t.emotional_state or "")
        if emo in {"stress", "anxiety", "fear", "greed", "excitement"}:
            high_emotion_exec += 1
    for o in option_trades:
        exec_times.append(o.opened_at)
        amounts.append(float(o.entry_price) * float(o.contracts) * 100.0)
        emo = _parse_emotion_label(o.emotional_state or "")
        if emo in {"stress", "anxiety", "fear", "greed", "excitement"}:
            high_emotion_exec += 1
        if o.status == "CLOSED" and o.closed_at is not None:
            exec_times.append(o.closed_at)
            amounts.append(float(o.exit_price or 0.0) * float(o.contracts) * 100.0)

    exec_times.sort()
    gaps = []
    impulsive = 0
    for i in range(1, len(exec_times)):
        g = float((exec_times[i] - exec_times[i - 1]).total_seconds())
        gaps.append(g)
        if g <= 30.0:
            impulsive += 1

    duration_seconds = float((ended_at - session.started_at).total_seconds())
    total_exec = len(exec_times)
    overtrading_detected = bool(total_exec > max(25, int(max(1.0, duration_seconds / 3600.0) * 12)))

    realized_events = []
    wins = 0
    losses = 0
    total_profit = 0.0
    total_loss = 0.0
    profit_loss = 0.0

    for t in trades:
        if t.trade_type == "SELL":
            perf = getattr(t, "perf", None)
            pnl = float(perf.realized_pnl) if perf is not None else 0.0
            realized_events.append((t.timestamp, pnl))
            profit_loss += pnl
            if pnl >= 0:
                wins += 1
                total_profit += pnl
            else:
                losses += 1
                total_loss += abs(pnl)

    for o in option_trades:
        if o.status == "CLOSED" and o.closed_at is not None and o.exit_price is not None:
            pnl = (float(o.exit_price) - float(o.entry_price)) * float(o.contracts) * 100.0
            realized_events.append((o.closed_at, pnl))
            profit_loss += pnl
            if pnl >= 0:
                wins += 1
                total_profit += pnl
            else:
                losses += 1
                total_loss += abs(pnl)

    realized_events.sort(key=lambda x: x[0])
    equity = []
    cur = 0.0
    for _, pnl in realized_events:
        cur += float(pnl)
        equity.append(cur)
    max_drawdown = _compute_max_drawdown(equity)
    avg_trade_time = float(statistics.mean(gaps)) if gaps else 0.0
    win_rate = (float(wins) / max(1.0, float(wins + losses))) * 100.0

    risk_alerts = (
        db.query(database.SessionEvent)
        .filter(database.SessionEvent.session_id == session.id, database.SessionEvent.event_type == "RISK_ALERT")
        .count()
    )

    risk_cash = float(user.cash_balance or 0.0)
    max_amt = float(max(amounts) if amounts else 0.0)
    risk_pct = (max_amt / max(1.0, risk_cash)) * 100.0

    revenge = 0
    last_loss_at: datetime | None = None
    last_loss_amt = 0.0
    for t, pnl in realized_events:
        if pnl < 0:
            last_loss_at = t
            last_loss_amt = abs(float(pnl))
            continue
        if last_loss_at is not None and (t - last_loss_at).total_seconds() <= 240.0 and float(pnl) > 0 and float(pnl) >= last_loss_amt * 0.1:
            revenge += 1
            last_loss_at = None

    behavioral_metrics = {
        "impulsive_trades": int(impulsive),
        "overtrading_detected": bool(overtrading_detected),
        "revenge_trading_indicator": int(revenge),
        "risk_exposure_max_pct_cash": float(risk_pct),
        "risk_alerts": int(risk_alerts),
        "max_drawdown": float(max_drawdown),
    }

    scores = _compute_scores(
        duration_seconds=duration_seconds,
        total_exec=total_exec,
        impulsive_count=impulsive,
        overtrade_flag=overtrading_detected,
        max_drawdown=max_drawdown,
        realized_losses=losses,
        high_emotion_exec=high_emotion_exec,
        risk_alerts=risk_alerts,
        amounts=amounts,
        gaps=gaps,
    )
    recommendations = _generate_recommendations(behavioral_metrics)

    session.status = "ENDED"
    session.ended_at = ended_at
    session.expires_at = session.expires_at
    session.trades_count = int(total_exec)
    session.total_trades = int(total_exec)
    session.winning_trades = int(wins)
    session.losing_trades = int(losses)
    session.total_profit = float(total_profit)
    session.total_loss = float(total_loss)
    session.profit_loss = float(profit_loss)
    session.win_rate = float(win_rate)
    session.max_drawdown = float(max_drawdown)
    session.average_trade_time = float(avg_trade_time)
    session.risk_score = float(scores["risk_score"])
    session.discipline_score = float(scores["discipline_score"])
    session.trading_consistency_score = float(scores["trading_consistency_score"])
    session.behavioral_metrics = json.dumps(behavioral_metrics)
    session.emotional_state = trades[-1].emotional_state if trades else (option_trades[-1].emotional_state if option_trades else None)

    _award_badges(
        db=db,
        user_id=user.id,
        session_id=session.id,
        profit_loss=session.profit_loss,
        risk_score=session.risk_score,
        discipline_score=session.discipline_score,
        consistency_score=session.trading_consistency_score,
        max_drawdown=session.max_drawdown,
    )

    pdf_path = _try_generate_pdf_report(
        user=user,
        session=session,
        trades=trades,
        option_trades=option_trades,
        recommendations=recommendations,
        behavioral_metrics=behavioral_metrics,
    )
    if pdf_path:
        session.report_path = pdf_path

    db.commit()
    db.refresh(session)
    return session

def _require_active_session(db: Session, user: database.User) -> database.TradingSession:
    s = _get_active_session(db, user.id)
    if s and s.expires_at is not None and _now() >= s.expires_at:
        _finalize_session(db, user, s)
        s = None
    if not s:
        raise HTTPException(status_code=403, detail="Start a trading session before trading")
    return s

@router.get("/stocks/popular", response_model=List[schemas.StockInfo])
def get_popular_stocks():
    return stock_service.StockService.get_popular_stocks()

@router.get("/stocks/{symbol}", response_model=schemas.StockInfo)
def get_stock_info(symbol: str):
    info = stock_service.StockService.get_stock_price(symbol)
    if not info:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    return info

@router.get("/stocks/{symbol}/history")
def get_stock_history(symbol: str, period: str = "1mo"):
    return stock_service.StockService.get_historical_data(symbol, period)

@router.get("/stocks/{symbol}/candles")
def get_stock_candles(symbol: str, interval: str = "1m", period: str = "1d"):
    return stock_service.StockService.get_candles(symbol, interval=interval, period=period)

@router.websocket("/ws/price")
async def price_websocket(websocket: WebSocket, token: str, symbols: str = "AAPL", simulate: bool = True):
    await websocket.accept()
    try:
        from jose import jwt
        import os
        SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-development-only")
        ALGORITHM = "HS256"
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    requested = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    last_prices: Dict[str, float] = {}
    try:
        while True:
            data = []
            for sym in requested:
                info = stock_service.StockService.get_stock_price(sym, max_age_s=1.5)
                if info:
                    payload = info.model_dump() if hasattr(info, "model_dump") else info.dict()
                    if simulate:
                        current = float(payload.get("price", 0.0) or 0.0)
                        prev = last_prices.get(sym)
                        if prev is not None and abs(current - prev) < 1e-9:
                            drift = (random.random() - 0.5) * max(0.01, prev * 0.0005)
                            current = max(0.01, prev + drift)
                            payload["price"] = current
                        last_prices[sym] = float(payload.get("price", 0.0) or 0.0)
                    data.append(payload)
            await websocket.send_text(json.dumps({"type": "prices", "data": data}))
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        return

@router.post("/trade", response_model=schemas.Trade)
def create_trade(
    trade_in: schemas.TradeCreate,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    session = _require_active_session(db, current_user)
    # Check emotional state for risk management if provided
    if trade_in.emotional_state:
        # Split "state (confidence)" format
        parts = trade_in.emotional_state.split(" (")
        emotion = parts[0].lower().strip()
        if emotion == "anxiet":
            emotion = "anxiety"
        if emotion == "greeed":
            emotion = "greed"
        confidence = 0.8
        if len(parts) > 1:
            try:
                confidence = float(parts[1].replace("%)", "")) / 100
            except:
                pass

        # Get recent trades for behavior rules
        recent_trades = db.query(database.Trade).filter(
            database.Trade.user_id == current_user.id
        ).order_by(database.Trade.timestamp.desc()).limit(20).all()

        trade_amount = float(trade_in.quantity) * float(trade_in.price)
        
        permission = risk_engine.check_trade_permission(
            current_user.id, 
            emotion, 
            confidence, 
            trade_amount=trade_amount,
            recent_trades=recent_trades,
            confirmed=bool(trade_in.confirmed)
        )
        
        if not permission["allowed"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": permission["message"],
                    "action": permission["action"],
                    "cooldown_remaining": permission.get("cooldown_remaining", 0),
                    "max_trade_amount": permission.get("max_trade_amount")
                }
            )

    prev_trade = (
        db.query(database.Trade)
        .filter(database.Trade.user_id == current_user.id, database.Trade.session_id == session.id)
        .order_by(database.Trade.timestamp.desc())
        .first()
    )
    prev_ts = prev_trade.timestamp if prev_trade else None

    # Handle Portfolio update
    portfolio_item = db.query(database.Portfolio).filter(
        database.Portfolio.user_id == current_user.id,
        database.Portfolio.stock_symbol == trade_in.stock_symbol
    ).first()

    realized_pnl = 0.0
    if trade_in.trade_type == "BUY":
        total_cost = float(trade_in.quantity) * float(trade_in.price)
        if (current_user.cash_balance or 0.0) < total_cost:
            raise HTTPException(status_code=400, detail="Insufficient cash balance")
        current_user.cash_balance = float(current_user.cash_balance or 0.0) - total_cost
        if portfolio_item:
            # Update existing holding
            total_cost = (portfolio_item.quantity * portfolio_item.avg_price) + (trade_in.quantity * trade_in.price)
            new_quantity = portfolio_item.quantity + trade_in.quantity
            portfolio_item.avg_price = total_cost / new_quantity
            portfolio_item.quantity = new_quantity
        else:
            # Create new holding
            new_item = database.Portfolio(
                user_id=current_user.id,
                stock_symbol=trade_in.stock_symbol,
                quantity=trade_in.quantity,
                avg_price=trade_in.price
            )
            db.add(new_item)
    elif trade_in.trade_type == "SELL":
        if not portfolio_item or portfolio_item.quantity < trade_in.quantity:
            raise HTTPException(status_code=400, detail="Insufficient quantity to sell")
        
        entry_cost = float(portfolio_item.avg_price)
        realized_pnl = (float(trade_in.price) - entry_cost) * float(trade_in.quantity)
        proceeds = float(trade_in.quantity) * float(trade_in.price)
        current_user.cash_balance = float(current_user.cash_balance or 0.0) + proceeds
        portfolio_item.quantity -= trade_in.quantity
        if portfolio_item.quantity == 0:
            db.delete(portfolio_item)
    
    # Record trade
    new_trade = database.Trade(
        user_id=current_user.id,
        session_id=session.id,
        stock_symbol=trade_in.stock_symbol,
        trade_type=trade_in.trade_type,
        quantity=trade_in.quantity,
        price=trade_in.price,
        emotional_state=trade_in.emotional_state
    )
    db.add(new_trade)
    db.commit()
    db.refresh(new_trade)

    if trade_in.trade_type == "SELL":
        is_win = bool(realized_pnl >= 0.0)
        seconds_since_prev = float((_now() - prev_ts).total_seconds()) if prev_ts else None
        tp = database.TradePerformance(
            trade_id=new_trade.id,
            session_id=session.id,
            user_id=current_user.id,
            realized_pnl=float(realized_pnl),
            is_win=bool(is_win),
            trade_amount=float(float(trade_in.quantity) * float(trade_in.price)),
            seconds_since_prev_trade=seconds_since_prev,
        )
        db.add(tp)
        db.add(
            database.SessionEvent(
                session_id=session.id,
                user_id=current_user.id,
                event_type="TRADE_EXECUTED",
                payload=json.dumps(
                    {
                        "trade_id": new_trade.id,
                        "symbol": new_trade.stock_symbol,
                        "side": new_trade.trade_type,
                        "qty": float(new_trade.quantity),
                        "price": float(new_trade.price),
                        "timestamp": new_trade.timestamp.isoformat(),
                        "realized_pnl": float(realized_pnl),
                    }
                ),
            )
        )
    else:
        db.add(
            database.SessionEvent(
                session_id=session.id,
                user_id=current_user.id,
                event_type="TRADE_EXECUTED",
                payload=json.dumps(
                    {
                        "trade_id": new_trade.id,
                        "symbol": new_trade.stock_symbol,
                        "side": new_trade.trade_type,
                        "qty": float(new_trade.quantity),
                        "price": float(new_trade.price),
                        "timestamp": new_trade.timestamp.isoformat(),
                    }
                ),
            )
        )

    recent_exec = (
        db.query(database.Trade)
        .filter(
            database.Trade.user_id == current_user.id,
            database.Trade.session_id == session.id,
            database.Trade.timestamp >= (_now() - timedelta(minutes=10)),
        )
        .count()
    )
    if recent_exec >= 15:
        db.add(
            database.SessionEvent(
                session_id=session.id,
                user_id=current_user.id,
                event_type="RISK_ALERT",
                payload=json.dumps({"type": "too_many_trades", "window_minutes": 10, "count": recent_exec}),
            )
        )

    trade_amount = float(float(trade_in.quantity) * float(trade_in.price))
    cash = float(current_user.cash_balance or 0.0)
    if cash > 0.0 and (trade_amount / cash) >= 0.25:
        db.add(
            database.SessionEvent(
                session_id=session.id,
                user_id=current_user.id,
                event_type="RISK_ALERT",
                payload=json.dumps({"type": "high_risk_exposure", "trade_amount": trade_amount, "cash_balance": cash}),
            )
        )

    db.commit()
    return new_trade

@router.get("/portfolio", response_model=List[schemas.Portfolio])
def get_portfolio(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    return db.query(database.Portfolio).filter(database.Portfolio.user_id == current_user.id).all()

@router.get("/watchlist", response_model=List[str])
def get_watchlist(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    items = db.query(database.Watchlist).filter(database.Watchlist.user_id == current_user.id).all()
    return [item.stock_symbol for item in items]

@router.post("/watchlist", response_model=Dict[str, str])
def add_to_watchlist(
    payload: Dict[str, str],
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    symbol = payload.get("symbol", "").upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    
    existing = db.query(database.Watchlist).filter(
        database.Watchlist.user_id == current_user.id,
        database.Watchlist.stock_symbol == symbol
    ).first()
    
    if existing:
        return {"message": "Already in watchlist"}
        
    new_item = database.Watchlist(user_id=current_user.id, stock_symbol=symbol)
    db.add(new_item)
    db.commit()
    return {"message": f"Added {symbol} to watchlist"}

@router.delete("/watchlist/{symbol}", response_model=Dict[str, str])
def remove_from_watchlist(
    symbol: str,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    symbol = symbol.upper()
    item = db.query(database.Watchlist).filter(
        database.Watchlist.user_id == current_user.id,
        database.Watchlist.stock_symbol == symbol
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Not in watchlist")
        
    db.delete(item)
    db.commit()
    return {"message": f"Removed {symbol} from watchlist"}

@router.get("/history", response_model=List[schemas.Trade])
def get_trade_history(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    return db.query(database.Trade).filter(database.Trade.user_id == current_user.id).order_by(database.Trade.timestamp.desc()).all()

@router.post("/session/start", response_model=schemas.TradingSession)
def start_session(
    payload: schemas.SessionStartRequest,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    existing = _get_active_session(db, current_user.id)
    if existing and existing.expires_at is not None and _now() >= existing.expires_at:
        _finalize_session(db, current_user, existing)
        existing = None
    if existing:
        return existing
    mins = payload.duration_minutes if payload and payload.duration_minutes is not None else DEFAULT_SESSION_MINUTES
    mins = int(max(5, min(8 * 60, int(mins))))
    s = database.TradingSession(
        user_id=current_user.id,
        status="ACTIVE",
        started_at=_now(),
        expires_at=_now() + timedelta(minutes=mins),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    db.add(
        database.SessionEvent(
            session_id=s.id,
            user_id=current_user.id,
            event_type="SESSION_STARTED",
            payload=json.dumps({"duration_minutes": mins}),
        )
    )
    db.commit()
    return s

@router.post("/session/end", response_model=schemas.TradingSession)
def end_session(
    payload: schemas.SessionEndRequest,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    session = None
    if payload and payload.session_id is not None:
        session = (
            db.query(database.TradingSession)
            .filter(database.TradingSession.id == int(payload.session_id), database.TradingSession.user_id == current_user.id)
            .first()
        )
    if session is None:
        session = _get_active_session(db, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    if session.status != "ACTIVE":
        return session
    db.add(
        database.SessionEvent(
            session_id=session.id,
            user_id=current_user.id,
            event_type="SESSION_ENDED",
            payload=json.dumps({"ended_by": "user"}),
        )
    )
    db.commit()
    return _finalize_session(db, current_user, session)

@router.get("/session/active", response_model=Optional[schemas.TradingSession])
def get_active_session(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    s = _get_active_session(db, current_user.id)
    if s and s.expires_at is not None and _now() >= s.expires_at:
        _finalize_session(db, current_user, s)
        return None
    return s

@router.get("/sessions", response_model=List[schemas.SessionSummary])
def list_sessions(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    q = db.query(database.TradingSession).filter(database.TradingSession.user_id == current_user.id)
    if from_date:
        try:
            d = datetime.strptime(from_date, "%Y-%m-%d").date()
            q = q.filter(database.TradingSession.started_at >= datetime(d.year, d.month, d.day))
        except Exception:
            pass
    if to_date:
        try:
            d = datetime.strptime(to_date, "%Y-%m-%d").date()
            q = q.filter(database.TradingSession.started_at < datetime(d.year, d.month, d.day) + timedelta(days=1))
        except Exception:
            pass

    rows = q.order_by(database.TradingSession.started_at.desc()).limit(200).all()
    out: List[schemas.SessionSummary] = []
    for s in rows:
        ended = s.ended_at
        dur = float((ended - s.started_at).total_seconds()) if ended else 0.0
        out.append(
            schemas.SessionSummary(
                id=s.id,
                session_date=s.started_at.strftime("%Y-%m-%d"),
                started_at=s.started_at,
                ended_at=s.ended_at,
                duration_seconds=dur,
                trades_count=int(s.total_trades or 0),
                win_rate=float(s.win_rate or 0.0),
                profit_loss=float(s.profit_loss or 0.0),
                risk_score=float(s.risk_score or 0.0),
                discipline_score=float(s.discipline_score or 0.0),
                trading_consistency_score=float(s.trading_consistency_score or 0.0),
                report_available=bool(s.report_path),
            )
        )
    return out

@router.get("/sessions/{session_id}", response_model=schemas.SessionDetail)
def get_session_detail(
    session_id: int,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    s = (
        db.query(database.TradingSession)
        .filter(database.TradingSession.id == session_id, database.TradingSession.user_id == current_user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    events = (
        db.query(database.SessionEvent)
        .filter(database.SessionEvent.session_id == s.id)
        .order_by(database.SessionEvent.created_at.asc())
        .limit(2000)
        .all()
    )
    trades = (
        db.query(database.Trade)
        .filter(database.Trade.session_id == s.id, database.Trade.user_id == current_user.id)
        .order_by(database.Trade.timestamp.desc())
        .limit(500)
        .all()
    )
    behavioral = {}
    if s.behavioral_metrics:
        try:
            behavioral = json.loads(s.behavioral_metrics)
        except Exception:
            behavioral = {}
    recs = _generate_recommendations(behavioral)
    return schemas.SessionDetail(session=s, events=events, trades=trades, recommendations=recs)

@router.get("/sessions/{session_id}/replay", response_model=List[schemas.SessionEvent])
def session_replay(
    session_id: int,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    s = (
        db.query(database.TradingSession)
        .filter(database.TradingSession.id == session_id, database.TradingSession.user_id == current_user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return (
        db.query(database.SessionEvent)
        .filter(database.SessionEvent.session_id == s.id)
        .order_by(database.SessionEvent.created_at.asc())
        .limit(5000)
        .all()
    )

@router.get("/sessions/{session_id}/report")
def download_session_report(
    session_id: int,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    s = (
        db.query(database.TradingSession)
        .filter(database.TradingSession.id == session_id, database.TradingSession.user_id == current_user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if not s.report_path or not os.path.exists(s.report_path):
        raise HTTPException(status_code=404, detail="Report not available")
    return FileResponse(s.report_path, media_type="application/pdf", filename=os.path.basename(s.report_path))

@router.get("/badges", response_model=List[schemas.Badge])
def get_badges(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    rows = (
        db.query(database.UserBadge)
        .filter(database.UserBadge.user_id == current_user.id)
        .order_by(database.UserBadge.awarded_at.desc())
        .limit(200)
        .all()
    )
    return [schemas.Badge(badge_key=b.badge_key, awarded_at=b.awarded_at, session_id=b.session_id) for b in rows]

@router.get("/performance/dashboard", response_model=Dict[str, Any])
def performance_dashboard(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    sessions = (
        db.query(database.TradingSession)
        .filter(database.TradingSession.user_id == current_user.id, database.TradingSession.status == "ENDED")
        .order_by(database.TradingSession.ended_at.asc())
        .limit(500)
        .all()
    )
    daily: Dict[str, float] = {}
    for s in sessions:
        if not s.ended_at:
            continue
        d = s.ended_at.strftime("%Y-%m-%d")
        daily[d] = float(daily.get(d, 0.0)) + float(s.profit_loss or 0.0)

    default_balance = float(os.getenv("DEFAULT_CASH_BALANCE", "10000"))
    growth = []
    running = default_balance
    for d in sorted(daily.keys()):
        running += float(daily[d])
        growth.append({"date": d, "portfolio_value": float(running), "pnl": float(daily[d])})

    best_day = None
    worst_day = None
    if daily:
        best_k = max(daily.keys(), key=lambda k: float(daily[k]))
        worst_k = min(daily.keys(), key=lambda k: float(daily[k]))
        best_day = {"date": best_k, "pnl": float(daily[best_k])}
        worst_day = {"date": worst_k, "pnl": float(daily[worst_k])}

    avg_score = 0.0
    if sessions:
        avg_score = float(statistics.mean([float(s.trading_consistency_score or 0.0) for s in sessions]))

    return {
        "profit_trends": growth,
        "best_trading_day": best_day,
        "worst_trading_day": worst_day,
        "average_session_score": float(avg_score),
    }

@router.get("/leaderboard", response_model=schemas.LeaderboardResponse)
def leaderboard(
    timeframe: str = "all",
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    tf = str(timeframe or "all").lower()
    now = _now()
    start = None
    if tf == "weekly":
        start = now - timedelta(days=7)
    elif tf == "monthly":
        start = now - timedelta(days=30)

    users = db.query(database.User).order_by(database.User.created_at.asc()).limit(500).all()
    default_balance = float(os.getenv("DEFAULT_CASH_BALANCE", "10000"))

    entries = []
    for u in users:
        sessions_q = db.query(database.TradingSession).filter(database.TradingSession.user_id == u.id, database.TradingSession.status == "ENDED")
        if start is not None:
            sessions_q = sessions_q.filter(database.TradingSession.ended_at >= start)
        sess = sessions_q.all()
        sessions_completed = len(sess)
        win_rate = float(statistics.mean([float(s.win_rate or 0.0) for s in sess])) if sess else 0.0
        risk_score = float(statistics.mean([float(s.risk_score or 0.0) for s in sess])) if sess else 0.0
        consistency = float(statistics.mean([float(s.trading_consistency_score or 0.0) for s in sess])) if sess else 0.0
        pnl_sum = float(sum([float(s.profit_loss or 0.0) for s in sess]))

        holdings = db.query(database.Portfolio).filter(database.Portfolio.user_id == u.id).all()
        holdings_value = float(sum([float(p.quantity) * float(p.avg_price) for p in holdings]))
        portfolio_value = float(float(u.cash_balance or 0.0) + holdings_value)
        profit_percent = ((portfolio_value - default_balance) / max(1.0, default_balance)) * 100.0

        score = (
            (profit_percent * 0.45)
            + (win_rate * 0.25)
            + (consistency * 0.20)
            - (risk_score * 0.15)
            + (min(20, sessions_completed) * 0.5)
            + (pnl_sum * 0.001)
        )
        entries.append(
            {
                "user_id": u.id,
                "user_name": u.username,
                "portfolio_value": portfolio_value,
                "profit_percent": profit_percent,
                "win_rate": win_rate,
                "risk_score": risk_score,
                "consistency_score": consistency,
                "sessions_completed": sessions_completed,
                "score": float(score),
                "is_current_user": bool(u.id == current_user.id),
            }
        )

    entries.sort(key=lambda x: x["score"], reverse=True)
    ranked = []
    for idx, e in enumerate(entries[:200], start=1):
        ranked.append(schemas.LeaderboardEntry(rank=idx, **e))

    return schemas.LeaderboardResponse(timeframe=tf, generated_at=now.isoformat(), entries=ranked)

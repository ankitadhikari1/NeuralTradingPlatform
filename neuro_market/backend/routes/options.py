from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict, Any
import asyncio
import json

from models import database, schemas
from services import auth, stock_service, options_pricing

router = APIRouter(prefix="/options", tags=["options"])

def _now() -> datetime:
    return datetime.utcnow()

def _get_active_session(db: Session, user_id: int) -> database.TradingSession | None:
    return (
        db.query(database.TradingSession)
        .filter(database.TradingSession.user_id == user_id, database.TradingSession.status == "ACTIVE")
        .order_by(database.TradingSession.started_at.desc())
        .first()
    )

def _finalize_if_expired(db: Session, user: database.User, s: database.TradingSession):
    if s.expires_at is not None and _now() >= s.expires_at:
        from routes import trading as trading_routes
        trading_routes._finalize_session(db, user, s)

def _require_active_session(db: Session, user: database.User) -> database.TradingSession:
    s = _get_active_session(db, user.id)
    if s:
        _finalize_if_expired(db, user, s)
        if s.status != "ACTIVE":
            s = None
    if not s:
        raise HTTPException(status_code=403, detail="Start a trading session before trading")
    return s

def _underlying_price(symbol: str) -> float:
    info = stock_service.StockService.get_stock_price(symbol, max_age_s=1.5)
    if not info:
        raise HTTPException(status_code=404, detail="Underlying not found")
    return float(info.price)

def _mark_price(underlying: float, trade: database.OptionTrade) -> float:
    t = options_pricing.years_to_expiry(trade.expiry)
    sigma = 0.65
    r = 0.01
    price = options_pricing.black_scholes_price(
        s=float(underlying),
        k=float(trade.strike),
        t_years=float(t),
        r=float(r),
        sigma=float(sigma),
        option_type=trade.option_type,
    )
    return max(0.01, float(price))

@router.get("/positions", response_model=List[schemas.OptionPositionSnapshot])
def get_positions(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    open_trades = (
        db.query(database.OptionTrade)
        .filter(database.OptionTrade.user_id == current_user.id, database.OptionTrade.status == "OPEN")
        .order_by(database.OptionTrade.opened_at.desc())
        .all()
    )

    snapshots: List[schemas.OptionPositionSnapshot] = []
    for t in open_trades:
        s = _underlying_price(t.underlying_symbol)
        mark = _mark_price(s, t)
        multiplier = 100.0
        pnl = (mark - float(t.entry_price)) * float(t.contracts) * multiplier
        denom = max(0.01, float(t.entry_price) * float(t.contracts) * multiplier)
        pnl_pct = (pnl / denom) * 100.0
        snapshots.append(
            schemas.OptionPositionSnapshot(
                id=t.id,
                underlying_symbol=t.underlying_symbol,
                option_type=t.option_type,
                strike=t.strike,
                expiry=t.expiry,
                contracts=t.contracts,
                entry_price=t.entry_price,
                mark_price=mark,
                pnl=pnl,
                pnl_percent=pnl_pct,
                stop_loss=t.stop_loss,
                take_profit=t.take_profit,
            )
        )
    return snapshots

@router.get("/history", response_model=List[schemas.OptionTrade])
def get_history(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    return (
        db.query(database.OptionTrade)
        .filter(database.OptionTrade.user_id == current_user.id)
        .order_by(database.OptionTrade.opened_at.desc())
        .limit(200)
        .all()
    )

@router.post("/open", response_model=schemas.OptionTrade)
def open_option(
    payload: schemas.OptionTradeCreate,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    session = _require_active_session(db, current_user)
    symbol = payload.underlying_symbol.upper()
    option_type = payload.option_type.upper()
    if option_type not in {"CALL", "PUT"}:
        raise HTTPException(status_code=400, detail="option_type must be CALL or PUT")
    if payload.contracts <= 0:
        raise HTTPException(status_code=400, detail="contracts must be > 0")

    s = _underlying_price(symbol)
    t_years = options_pricing.years_to_expiry(payload.expiry)
    if t_years <= 0:
        raise HTTPException(status_code=400, detail="expiry must be in the future (YYYY-MM-DD)")

    sigma = 0.65
    r = 0.01
    entry = options_pricing.black_scholes_price(s, payload.strike, t_years, r, sigma, option_type)
    entry = max(0.01, float(entry))

    # Validate stop_loss and take_profit against entry price to prevent instant closure
    if payload.stop_loss is not None and entry <= float(payload.stop_loss):
        raise HTTPException(
            status_code=400, 
            detail=f"Stop loss ({payload.stop_loss}) must be below the current premium ({entry:.2f})"
        )
    if payload.take_profit is not None and entry >= float(payload.take_profit):
        raise HTTPException(
            status_code=400, 
            detail=f"Take profit ({payload.take_profit}) must be above the current premium ({entry:.2f})"
        )

    cost = entry * float(payload.contracts) * 100.0
    if (current_user.cash_balance or 0.0) < cost:
        raise HTTPException(status_code=400, detail="Insufficient cash balance for premium")
    current_user.cash_balance = float(current_user.cash_balance or 0.0) - cost

    trade = database.OptionTrade(
        user_id=current_user.id,
        session_id=session.id,
        underlying_symbol=symbol,
        option_type=option_type,
        strike=float(payload.strike),
        expiry=payload.expiry,
        contracts=int(payload.contracts),
        side="LONG",
        entry_price=entry,
        status="OPEN",
        stop_loss=float(payload.stop_loss) if payload.stop_loss is not None else None,
        take_profit=float(payload.take_profit) if payload.take_profit is not None else None,
        emotional_state=payload.emotional_state,
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)

    db.add(
        database.SessionEvent(
            session_id=session.id,
            user_id=current_user.id,
            event_type="OPTION_OPENED",
            payload=json.dumps(
                {
                    "option_trade_id": trade.id,
                    "symbol": trade.underlying_symbol,
                    "type": trade.option_type,
                    "strike": float(trade.strike),
                    "expiry": trade.expiry,
                    "contracts": int(trade.contracts),
                    "entry_price": float(trade.entry_price),
                    "opened_at": trade.opened_at.isoformat(),
                }
            ),
        )
    )

    recent_exec = (
        db.query(database.SessionEvent)
        .filter(
            database.SessionEvent.session_id == session.id,
            database.SessionEvent.created_at >= (_now() - timedelta(minutes=10)),
            database.SessionEvent.event_type.in_(["TRADE_EXECUTED", "OPTION_OPENED", "OPTION_CLOSED"]),
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
    db.commit()
    return trade

@router.post("/close/{trade_id}", response_model=schemas.OptionTrade)
def close_option(
    trade_id: int,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    session = _require_active_session(db, current_user)
    trade = (
        db.query(database.OptionTrade)
        .filter(database.OptionTrade.id == trade_id, database.OptionTrade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Option trade not found")
    if trade.status != "OPEN":
        raise HTTPException(status_code=400, detail="Trade already closed")

    s = _underlying_price(trade.underlying_symbol)
    exit_price = _mark_price(s, trade)

    credit = float(exit_price) * float(trade.contracts) * 100.0
    current_user.cash_balance = float(current_user.cash_balance or 0.0) + credit

    trade.exit_price = float(exit_price)
    trade.status = "CLOSED"
    trade.closed_at = _now()
    trade.session_id = trade.session_id or session.id
    db.commit()
    db.refresh(trade)

    pnl = (float(trade.exit_price) - float(trade.entry_price)) * float(trade.contracts) * 100.0
    db.add(
        database.SessionEvent(
            session_id=trade.session_id or session.id,
            user_id=current_user.id,
            event_type="OPTION_CLOSED",
            payload=json.dumps(
                {
                    "option_trade_id": trade.id,
                    "symbol": trade.underlying_symbol,
                    "type": trade.option_type,
                    "strike": float(trade.strike),
                    "expiry": trade.expiry,
                    "contracts": int(trade.contracts),
                    "entry_price": float(trade.entry_price),
                    "exit_price": float(trade.exit_price),
                    "pnl": float(pnl),
                    "closed_at": trade.closed_at.isoformat() if trade.closed_at else None,
                }
            ),
        )
    )
    db.commit()
    return trade

@router.get("/estimate", response_model=Dict[str, float])
def estimate_premium(
    symbol: str,
    strike: float,
    expiry: str,
    option_type: str,
    current_user: database.User = Depends(auth.get_current_user),
):
    s = _underlying_price(symbol)
    t_years = options_pricing.years_to_expiry(expiry)
    if t_years <= 0:
        return {"premium": 0.01}
    
    sigma = 0.65
    r = 0.01
    premium = options_pricing.black_scholes_price(s, strike, t_years, r, sigma, option_type)
    return {"premium": max(0.01, float(premium))}

@router.websocket("/ws/pnl")
async def pnl_websocket(websocket: WebSocket, token: str):
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

    db = database.SessionLocal()
    try:
        user = db.query(database.User).filter(database.User.username == username).first()
        if not user:
            await websocket.close(code=1008)
            return

        while True:
            open_trades = (
                db.query(database.OptionTrade)
                .filter(database.OptionTrade.user_id == user.id, database.OptionTrade.status == "OPEN")
                .all()
            )

            snapshots = []
            for t in open_trades:
                # Try to get live price, but don't skip the trade if it fails
                s = stock_service.StockService.get_stock_price(t.underlying_symbol, max_age_s=1.5)
                
                if s:
                    mark = _mark_price(float(s.price), t)
                else:
                    # Fallback to entry price if market data is temporarily unavailable
                    mark = float(t.entry_price)

                pnl = (mark - float(t.entry_price)) * float(t.contracts) * 100.0
                denom = max(0.01, float(t.entry_price) * float(t.contracts) * 100.0)
                pnl_pct = (pnl / denom) * 100.0

                triggered = False
                trigger_reason = None
                # Only check triggers if we have a real live price
                if s:
                    if t.stop_loss is not None and mark <= float(t.stop_loss):
                        triggered = True
                        trigger_reason = "STOP_LOSS"
                    if t.take_profit is not None and mark >= float(t.take_profit):
                        triggered = True
                        trigger_reason = "TAKE_PROFIT"

                if triggered:
                    credit = float(mark) * float(t.contracts) * 100.0
                    user.cash_balance = float(user.cash_balance or 0.0) + credit
                    t.exit_price = float(mark)
                    t.status = "CLOSED"
                    t.closed_at = _now()
                    db.commit()
                    db.add(
                        database.Notification(
                            user_id=user.id,
                            type=str(trigger_reason or "OPTION_TRIGGER"),
                            title=f"{t.underlying_symbol} option auto-closed",
                            message=(
                                f"{t.underlying_symbol} {t.option_type} was auto-closed at premium ${float(mark):.2f} "
                                f"({trigger_reason or 'TRIGGER'})."
                            ),
                            symbol=t.underlying_symbol,
                            notification_metadata=json.dumps(
                                {
                                    "option_trade_id": int(t.id),
                                    "reason": trigger_reason,
                                    "mark_price": float(mark),
                                    "stop_loss": float(t.stop_loss) if t.stop_loss is not None else None,
                                    "take_profit": float(t.take_profit) if t.take_profit is not None else None,
                                }
                            ),
                            created_at=_now(),
                            read_at=None,
                        )
                    )
                    db.commit()
                    if t.session_id:
                        pnl = (float(t.exit_price) - float(t.entry_price)) * float(t.contracts) * 100.0
                        db.add(
                            database.SessionEvent(
                                session_id=t.session_id,
                                user_id=user.id,
                                event_type="OPTION_CLOSED",
                                payload=json.dumps(
                                    {
                                        "option_trade_id": t.id,
                                        "symbol": t.underlying_symbol,
                                        "type": t.option_type,
                                        "strike": float(t.strike),
                                        "expiry": t.expiry,
                                        "contracts": int(t.contracts),
                                        "entry_price": float(t.entry_price),
                                        "exit_price": float(t.exit_price),
                                        "pnl": float(pnl),
                                        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
                                        "auto_triggered": True,
                                    }
                                ),
                            )
                        )
                        db.commit()
                    continue

                snapshots.append(
                    {
                        "id": t.id,
                        "underlying_symbol": t.underlying_symbol,
                        "option_type": t.option_type,
                        "strike": t.strike,
                        "expiry": t.expiry,
                        "contracts": t.contracts,
                        "entry_price": t.entry_price,
                        "mark_price": mark,
                        "pnl": pnl,
                        "pnl_percent": pnl_pct,
                        "stop_loss": t.stop_loss,
                        "take_profit": t.take_profit,
                    }
                )

            await websocket.send_text(
                json.dumps(
                    {
                        "type": "options_pnl",
                        "cash_balance": float(user.cash_balance or 0.0),
                        "positions": snapshots,
                    }
                )
            )
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        return
    finally:
        db.close()

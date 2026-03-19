from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from models import database, schemas
from services import auth
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
import statistics

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(current_user: database.User = Depends(auth.get_current_user)) -> database.User:
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.get("/users", response_model=List[schemas.AdminUser])
def list_users(
    q: Optional[str] = None,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    query = db.query(database.User)
    if q:
        query = query.filter(database.User.username.contains(q))
    return query.order_by(database.User.created_at.desc()).limit(200).all()

@router.post("/balance/set", response_model=schemas.AdminUser)
def set_balance(
    payload: schemas.AdminBalanceUpdate,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    user = db.query(database.User).filter(database.User.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.cash_balance = float(payload.amount)
    db.commit()
    db.refresh(user)
    return user

@router.post("/balance/topup", response_model=schemas.AdminUser)
def top_up(
    payload: schemas.AdminTopUp,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    user = db.query(database.User).filter(database.User.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.cash_balance = float(user.cash_balance or 0.0) + float(payload.amount)
    db.commit()
    db.refresh(user)
    return user

def _get_user_or_404(db: Session, username: str) -> database.User:
    user = db.query(database.User).filter(database.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/user/{username}/portfolio", response_model=List[schemas.Portfolio])
def admin_user_portfolio(
    username: str,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    user = _get_user_or_404(db, username)
    return db.query(database.Portfolio).filter(database.Portfolio.user_id == user.id).all()

@router.get("/user/{username}/trades", response_model=List[schemas.Trade])
def admin_user_trades(
    username: str,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    user = _get_user_or_404(db, username)
    return (
        db.query(database.Trade)
        .filter(database.Trade.user_id == user.id)
        .order_by(database.Trade.timestamp.desc())
        .limit(300)
        .all()
    )

@router.get("/user/{username}/options", response_model=List[schemas.OptionTrade])
def admin_user_options(
    username: str,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    user = _get_user_or_404(db, username)
    return (
        db.query(database.OptionTrade)
        .filter(database.OptionTrade.user_id == user.id)
        .order_by(database.OptionTrade.opened_at.desc())
        .limit(300)
        .all()
    )

@router.get("/user/{username}/emotions", response_model=List[schemas.EmotionLog])
def admin_user_emotion_logs(
    username: str,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    user = _get_user_or_404(db, username)
    return (
        db.query(database.EmotionLog)
        .filter(database.EmotionLog.user_id == user.id)
        .order_by(database.EmotionLog.timestamp.desc())
        .limit(200)
        .all()
    )

@router.get("/sessions", response_model=List[schemas.AdminSessionRow])
def admin_list_sessions(
    user: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    min_profit: Optional[float] = None,
    max_profit: Optional[float] = None,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    q = (
        db.query(database.TradingSession, database.User)
        .join(database.User, database.TradingSession.user_id == database.User.id)
    )
    if user:
        q = q.filter(database.User.username.contains(user))
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
    if min_profit is not None:
        q = q.filter(database.TradingSession.profit_loss >= float(min_profit))
    if max_profit is not None:
        q = q.filter(database.TradingSession.profit_loss <= float(max_profit))

    rows = q.order_by(database.TradingSession.started_at.desc()).limit(500).all()
    out: List[schemas.AdminSessionRow] = []
    for s, u in rows:
        dur = 0.0
        if s.ended_at:
            dur = float((s.ended_at - s.started_at).total_seconds())
        out.append(
            schemas.AdminSessionRow(
                session_id=int(s.id),
                user_name=str(u.username),
                session_date=s.started_at.strftime("%Y-%m-%d"),
                session_duration=float(dur),
                trades_count=int(s.total_trades or 0),
                win_rate=float(s.win_rate or 0.0),
                profit_loss=float(s.profit_loss or 0.0),
                risk_score=float(s.risk_score or 0.0),
                report_path=s.report_path,
            )
        )
    return out

@router.get("/sessions/stats", response_model=schemas.AdminAnalytics)
def admin_sessions_stats(
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    total_users = int(db.query(database.User).count())
    total_sessions = int(db.query(database.TradingSession).count())
    sessions = (
        db.query(database.TradingSession)
        .filter(database.TradingSession.status == "ENDED")
        .order_by(database.TradingSession.started_at.desc())
        .limit(2000)
        .all()
    )
    avg_perf = float(statistics.mean([float(s.profit_loss or 0.0) for s in sessions])) if sessions else 0.0

    best = (
        db.query(database.TradingSession, database.User)
        .join(database.User, database.TradingSession.user_id == database.User.id)
        .order_by(database.TradingSession.profit_loss.desc())
        .first()
    )
    highest_profit_session = None
    if best:
        s, u = best
        highest_profit_session = {
            "session_id": int(s.id),
            "user_name": str(u.username),
            "profit_loss": float(s.profit_loss or 0.0),
            "date": s.started_at.strftime("%Y-%m-%d"),
        }

    active = (
        db.query(database.User, database.TradingSession)
        .join(database.TradingSession, database.TradingSession.user_id == database.User.id)
        .all()
    )
    counts: Dict[int, int] = {}
    for u, s in active:
        counts[u.id] = counts.get(u.id, 0) + 1
    most_active_trader = None
    if counts:
        uid = max(counts.keys(), key=lambda k: counts[k])
        u = db.query(database.User).filter(database.User.id == uid).first()
        if u:
            most_active_trader = {"user_name": str(u.username), "sessions": int(counts[uid])}

    buckets = {"low": 0, "medium": 0, "high": 0}
    users = db.query(database.User).limit(2000).all()
    for u in users:
        rs = (
            db.query(database.TradingSession)
            .filter(database.TradingSession.user_id == u.id, database.TradingSession.status == "ENDED")
            .order_by(database.TradingSession.ended_at.desc())
            .limit(50)
            .all()
        )
        avg_risk = float(statistics.mean([float(s.risk_score or 0.0) for s in rs])) if rs else 0.0
        if avg_risk < 33:
            buckets["low"] += 1
        elif avg_risk < 66:
            buckets["medium"] += 1
        else:
            buckets["high"] += 1

    return schemas.AdminAnalytics(
        total_users=total_users,
        total_sessions=total_sessions,
        average_trader_performance=float(avg_perf),
        highest_profit_session=highest_profit_session,
        most_active_trader=most_active_trader,
        risk_distribution=buckets,
    )

@router.get("/session/{session_id}/report")
def admin_download_session_report(
    session_id: int,
    _: database.User = Depends(require_admin),
    db: Session = Depends(auth.get_db),
):
    s = db.query(database.TradingSession).filter(database.TradingSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if not s.report_path or not os.path.exists(s.report_path):
        raise HTTPException(status_code=404, detail="Report not available")
    return FileResponse(s.report_path, media_type="application/pdf", filename=os.path.basename(s.report_path))

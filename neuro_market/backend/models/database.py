from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from urllib.parse import urlparse

def _normalize_database_url(raw: str) -> str:
    if not raw:
        return "sqlite:///./neuro_market.db"
    value = str(raw).strip()
    if value.startswith("jdbc:mysql://"):
        parsed = urlparse(value.replace("jdbc:", "", 1))
        db_user = os.getenv("MYSQL_USER") or os.getenv("DB_USER") or ""
        db_pass = os.getenv("MYSQL_PASSWORD") or os.getenv("DB_PASSWORD") or ""
        host = parsed.hostname or "localhost"
        port = parsed.port or 3306
        dbname = (parsed.path or "").lstrip("/") or "neuroMarketLite"
        auth = ""
        if db_user:
            auth = db_user
            if db_pass:
                auth = f"{db_user}:{db_pass}"
            auth = f"{auth}@"
        return f"mysql+pymysql://{auth}{host}:{port}/{dbname}"
    return value

SQLALCHEMY_DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./neuro_market.db"))

_engine_kwargs = {"pool_pre_ping": True}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(255), unique=True, index=True)
    hashed_password = Column(String(255))
    is_admin = Column(Boolean, default=False)
    cash_balance = Column(Float, default=10000.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    trades = relationship("Trade", back_populates="user")
    portfolio = relationship("Portfolio", back_populates="user")
    watchlist = relationship("Watchlist", back_populates="user")
    emotion_logs = relationship("EmotionLog", back_populates="user")
    eeg_signals = relationship("EEGSignal", back_populates="user")

class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    stock_symbol = Column(String(16), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="watchlist")

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(Integer, ForeignKey("trading_sessions.id"), index=True, nullable=True)
    stock_symbol = Column(String(16))
    trade_type = Column(String(8)) # BUY or SELL
    quantity = Column(Float)
    price = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    emotional_state = Column(String(255))

    user = relationship("User", back_populates="trades")
    session = relationship("TradingSession", back_populates="trades")

class TradingSession(Base):
    __tablename__ = "trading_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    status = Column(String(16), default="ACTIVE", index=True)
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    ended_at = Column(DateTime, nullable=True, index=True)
    expires_at = Column(DateTime, nullable=True, index=True)

    trades_count = Column(Integer, default=0)
    profit_loss = Column(Float, default=0.0)
    win_rate = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    discipline_score = Column(Float, default=0.0)
    trading_consistency_score = Column(Float, default=0.0)
    behavioral_metrics = Column(Text, nullable=True)

    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    total_profit = Column(Float, default=0.0)
    total_loss = Column(Float, default=0.0)
    max_drawdown = Column(Float, default=0.0)
    average_trade_time = Column(Float, default=0.0)
    emotional_state = Column(String(255), nullable=True)

    report_path = Column(String(512), nullable=True)

    user = relationship("User")
    trades = relationship("Trade", back_populates="session")
    events = relationship("SessionEvent", back_populates="session")
    trade_performance = relationship("TradePerformance", back_populates="session")

class SessionEvent(Base):
    __tablename__ = "session_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("trading_sessions.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    event_type = Column(String(64), index=True)
    payload = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("TradingSession", back_populates="events")
    user = relationship("User")

class TradePerformance(Base):
    __tablename__ = "trade_performance"

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey("trades.id"), index=True, unique=True)
    session_id = Column(Integer, ForeignKey("trading_sessions.id"), index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    realized_pnl = Column(Float, default=0.0)
    is_win = Column(Boolean, default=False)
    trade_amount = Column(Float, default=0.0)
    seconds_since_prev_trade = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("TradingSession", back_populates="trade_performance")
    user = relationship("User")

class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    badge_key = Column(String(64), index=True)
    session_id = Column(Integer, ForeignKey("trading_sessions.id"), index=True, nullable=True)
    badge_metadata = Column("metadata", Text, nullable=True)
    awarded_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")

class OptionTrade(Base):
    __tablename__ = "option_trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    session_id = Column(Integer, ForeignKey("trading_sessions.id"), index=True, nullable=True)
    underlying_symbol = Column(String(16), index=True)
    option_type = Column(String(8))  # CALL or PUT
    strike = Column(Float)
    expiry = Column(String(10))  # YYYY-MM-DD
    contracts = Column(Integer)
    side = Column(String(8), default="LONG")  # LONG only for now
    entry_price = Column(Float)
    exit_price = Column(Float, nullable=True)
    status = Column(String(16), default="OPEN")  # OPEN or CLOSED
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    emotional_state = Column(String(255), nullable=True)

    user = relationship("User")

class Portfolio(Base):
    __tablename__ = "portfolio"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stock_symbol = Column(String(16))
    quantity = Column(Float)
    avg_price = Column(Float)

    user = relationship("User", back_populates="portfolio")

class EmotionLog(Base):
    __tablename__ = "emotion_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    emotion = Column(String(32))
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="emotion_logs")

class EEGSignal(Base):
    __tablename__ = "eeg_signals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    alpha = Column(Float)
    beta = Column(Float)
    gamma = Column(Float)
    theta = Column(Float)
    delta = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="eeg_signals")

def init_db():
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        if engine.dialect.name == "sqlite":
            cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()]
            if "is_admin" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0")
                conn.exec_driver_sql("UPDATE users SET is_admin = 0 WHERE is_admin IS NULL")
            if "cash_balance" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN cash_balance FLOAT DEFAULT 10000.0")
                conn.exec_driver_sql("UPDATE users SET cash_balance = 10000.0 WHERE cash_balance IS NULL")

            trade_cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(trades)").fetchall()]
            if "session_id" not in trade_cols:
                conn.exec_driver_sql("ALTER TABLE trades ADD COLUMN session_id INTEGER")

            option_cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(option_trades)").fetchall()]
            if "session_id" not in option_cols:
                conn.exec_driver_sql("ALTER TABLE option_trades ADD COLUMN session_id INTEGER")
            conn.commit()

    admin_username = os.getenv("ADMIN_USERNAME")
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    admin_balance = float(os.getenv("ADMIN_BALANCE", "1000000"))

    if admin_username and admin_email and admin_password:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.username == admin_username).first()
            if not existing:
                admin_user = User(
                    username=admin_username,
                    email=admin_email,
                    hashed_password=pwd_context.hash(admin_password),
                    is_admin=True,
                    cash_balance=admin_balance,
                )
                db.add(admin_user)
                db.commit()
        finally:
            db.close()

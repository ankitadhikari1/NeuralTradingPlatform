from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    password_confirmation: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    is_admin: bool = False
    cash_balance: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class TradeBase(BaseModel):
    stock_symbol: str
    trade_type: str
    quantity: float
    price: float
    emotional_state: Optional[str] = None

class TradeCreate(TradeBase):
    confirmed: Optional[bool] = False

class Trade(TradeBase):
    id: int
    user_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class PortfolioBase(BaseModel):
    stock_symbol: str
    quantity: float
    avg_price: float

class Portfolio(PortfolioBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class EmotionLogBase(BaseModel):
    emotion: str
    confidence: float

class EmotionLog(EmotionLogBase):
    id: int
    user_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class EEGSignalBase(BaseModel):
    alpha: float
    beta: float
    gamma: float
    theta: float
    delta: float

class EEGSignal(EEGSignalBase):
    id: int
    user_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class StockInfo(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    company_name: str

class AdminBalanceUpdate(BaseModel):
    username: str
    amount: float

class AdminTopUp(BaseModel):
    username: str
    amount: float

class AdminUser(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    cash_balance: float
    created_at: datetime

    class Config:
        from_attributes = True

class OptionTradeCreate(BaseModel):
    underlying_symbol: str
    option_type: str
    strike: float
    expiry: str
    contracts: int
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    emotional_state: Optional[str] = None

class OptionTrade(BaseModel):
    id: int
    user_id: int
    underlying_symbol: str
    option_type: str
    strike: float
    expiry: str
    contracts: int
    side: str
    entry_price: float
    exit_price: Optional[float] = None
    status: str
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    emotional_state: Optional[str] = None

    class Config:
        from_attributes = True

class OptionPositionSnapshot(BaseModel):
    id: int
    underlying_symbol: str
    option_type: str
    strike: float
    expiry: str
    contracts: int
    entry_price: float
    mark_price: float
    pnl: float
    pnl_percent: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

class PracticeRecommendation(BaseModel):
    symbol: str
    action: str
    confidence: float
    rationale: List[str]
    indicators: Dict[str, float]
    user_stats: Dict[str, float]

class PracticeEmotion(BaseModel):
    state: str
    confidence: float = 0.0

class PracticeRecommendationRequest(BaseModel):
    symbol: str
    current_price: Optional[float] = None
    practice_stats: Optional[Dict[str, float]] = None
    emotion: Optional[PracticeEmotion] = None

class SessionStartRequest(BaseModel):
    duration_minutes: Optional[int] = None

class SessionEndRequest(BaseModel):
    session_id: Optional[int] = None

class SessionEvent(BaseModel):
    id: int
    session_id: int
    user_id: int
    event_type: str
    payload: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TradingSession(BaseModel):
    id: int
    user_id: int
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    trades_count: int = 0
    profit_loss: float = 0.0
    win_rate: float = 0.0
    risk_score: float = 0.0
    discipline_score: float = 0.0
    trading_consistency_score: float = 0.0
    behavioral_metrics: Optional[str] = None
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_profit: float = 0.0
    total_loss: float = 0.0
    max_drawdown: float = 0.0
    average_trade_time: float = 0.0
    emotional_state: Optional[str] = None
    report_path: Optional[str] = None

    class Config:
        from_attributes = True

class SessionSummary(BaseModel):
    id: int
    session_date: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: float = 0.0
    trades_count: int = 0
    win_rate: float = 0.0
    profit_loss: float = 0.0
    risk_score: float = 0.0
    discipline_score: float = 0.0
    trading_consistency_score: float = 0.0
    report_available: bool = False

class SessionDetail(BaseModel):
    session: TradingSession
    events: List[SessionEvent] = []
    trades: List[Trade] = []
    recommendations: List[str] = []

class Badge(BaseModel):
    badge_key: str
    awarded_at: datetime
    session_id: Optional[int] = None

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    user_name: str
    portfolio_value: float
    profit_percent: float
    win_rate: float
    risk_score: float
    consistency_score: float
    sessions_completed: int
    score: float
    is_current_user: bool = False

class LeaderboardResponse(BaseModel):
    timeframe: str
    generated_at: str
    entries: List[LeaderboardEntry]

class AdminSessionRow(BaseModel):
    session_id: int
    user_name: str
    session_date: str
    session_duration: float
    trades_count: int
    win_rate: float
    profit_loss: float
    risk_score: float
    report_path: Optional[str] = None

class AdminAnalytics(BaseModel):
    total_users: int
    total_sessions: int
    average_trader_performance: float
    highest_profit_session: Optional[Dict[str, Any]] = None
    most_active_trader: Optional[Dict[str, Any]] = None
    risk_distribution: Dict[str, int]

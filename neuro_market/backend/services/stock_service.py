import yfinance as yf
from typing import List, Dict, Any, Optional
import pandas as pd
from models import schemas
import time
import random
from concurrent.futures import ThreadPoolExecutor, TimeoutError

class StockService:
    """
    Service for fetching market data using yfinance.
    """

    _price_cache: Dict[str, Dict[str, Any]] = {}
    _history_cache: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def _now() -> float:
        return time.time()

    @staticmethod
    def _simulated_stock(symbol: str) -> schemas.StockInfo:
        seed = sum(ord(c) for c in symbol) + int(StockService._now() // 60)
        rng = random.Random(seed)
        base = 50 + (sum(ord(c) for c in symbol) % 250)
        drift = rng.uniform(-2.5, 2.5)
        price = max(1.0, base + drift)
        change = rng.uniform(-2.0, 2.0)
        open_price = max(0.5, price - change)
        change_percent = (change / open_price) * 100 if open_price else 0.0
        return schemas.StockInfo(
            symbol=symbol,
            price=float(price),
            change=float(change),
            change_percent=float(change_percent),
            company_name=symbol,
        )

    @staticmethod
    def _with_timeout(fn, timeout_s: float):
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(fn)
            return future.result(timeout=timeout_s)

    @staticmethod
    def get_stock_price(symbol: str, max_age_s: float = 15.0) -> Optional[schemas.StockInfo]:
        cached = StockService._price_cache.get(symbol)
        if cached and (StockService._now() - cached["ts"] < max_age_s):
            return cached["value"]

        try:
            def fetch():
                ticker = yf.Ticker(symbol)
                info = ticker.info
                return ticker, info

            ticker, info = StockService._with_timeout(fetch, timeout_s=2.5)
            
            # Use fast_info if available or just the basic info
            price = info.get('regularMarketPrice') or info.get('currentPrice')
            change = info.get('regularMarketChange') or 0.0
            change_percent = info.get('regularMarketChangePercent') or 0.0
            company_name = info.get('longName') or symbol
            
            if price is None:
                # Try another way for real-time price
                data = StockService._with_timeout(lambda: ticker.history(period="1d"), timeout_s=2.5)
                if not data.empty:
                    price = data['Close'].iloc[-1]
                    change = price - data['Open'].iloc[-1]
                    change_percent = (change / data['Open'].iloc[-1]) * 100
                else:
                    value = StockService._simulated_stock(symbol)
                    StockService._price_cache[symbol] = {"ts": StockService._now(), "value": value}
                    return value

            value = schemas.StockInfo(
                symbol=symbol,
                price=float(price),
                change=float(change),
                change_percent=float(change_percent),
                company_name=company_name
            )
            StockService._price_cache[symbol] = {"ts": StockService._now(), "value": value}
            return value
        except TimeoutError:
            value = StockService._simulated_stock(symbol)
            StockService._price_cache[symbol] = {"ts": StockService._now(), "value": value}
            return value
        except Exception as e:
            print(f"Error fetching stock data for {symbol}: {e}")
            value = StockService._simulated_stock(symbol)
            StockService._price_cache[symbol] = {"ts": StockService._now(), "value": value}
            return value

    @staticmethod
    def get_popular_stocks() -> List[schemas.StockInfo]:
        symbols = [
            "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "NFLX", "AMD", "INTC",
            "UBER", "LYFT", "DIS", "NKE", "SBUX", "KO", "PEP", "WMT", "COST", "TGT",
            "JPM", "BAC", "GS", "MS", "V", "MA", "PYPL", "SQ",
            "XOM", "CVX", "COP",
            "JNJ", "PFE", "MRNA", "UNH",
            "BA", "CAT", "GE",
            "SPY", "QQQ", "DIA", "IWM",
            "GLD", "SLV",
            "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "DOGE-USD",
        ]

        results_by_symbol: Dict[str, schemas.StockInfo] = {}
        with ThreadPoolExecutor(max_workers=12) as ex:
            futures = {ex.submit(StockService.get_stock_price, sym): sym for sym in symbols}
            for fut, sym in list(futures.items()):
                try:
                    info = fut.result(timeout=3.5)
                    if info:
                        results_by_symbol[sym] = info
                except Exception:
                    continue

        return [results_by_symbol[s] for s in symbols if s in results_by_symbol]

    @staticmethod
    def get_historical_data(symbol: str, period: str = "1mo") -> List[Dict[str, Any]]:
        cache_key = f"{symbol}:{period}"
        cached = StockService._history_cache.get(cache_key)
        if cached and (StockService._now() - cached["ts"] < 60):
            return cached["value"]

        try:
            def fetch():
                ticker = yf.Ticker(symbol)
                return ticker.history(period=period)

            history = StockService._with_timeout(fetch, timeout_s=3.0)
            
            data = []
            for date, row in history.iterrows():
                data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "price": float(row['Close']),
                    "volume": float(row['Volume'])
                })
            StockService._history_cache[cache_key] = {"ts": StockService._now(), "value": data}
            return data
        except TimeoutError:
            data = []
            today = pd.Timestamp.utcnow().normalize()
            seed = sum(ord(c) for c in symbol)
            rng = random.Random(seed)
            price = 50 + (seed % 200)
            for i in range(30):
                day = today - pd.Timedelta(days=(29 - i))
                price = max(1.0, price + rng.uniform(-2.0, 2.0))
                data.append({"date": day.strftime("%Y-%m-%d"), "price": float(price), "volume": float(rng.randint(100000, 5000000))})
            StockService._history_cache[cache_key] = {"ts": StockService._now(), "value": data}
            return data
        except Exception as e:
            print(f"Error fetching historical data for {symbol}: {e}")
            return []

    @staticmethod
    def get_candles(symbol: str, interval: str = "1m", period: str = "1d") -> List[Dict[str, Any]]:
        cache_key = f"{symbol}:{interval}:{period}"
        cached = StockService._history_cache.get(cache_key)
        if cached and (StockService._now() - cached["ts"] < 10):
            return cached["value"]

        try:
            def fetch():
                ticker = yf.Ticker(symbol)
                return ticker.history(period=period, interval=interval)

            history = StockService._with_timeout(fetch, timeout_s=4.0)
            if history is None or history.empty:
                raise ValueError("empty candle history")

            candles: List[Dict[str, Any]] = []
            for date, row in history.iterrows():
                candles.append({
                    "time": int(pd.Timestamp(date).timestamp()),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row.get("Volume", 0.0)),
                })

            StockService._history_cache[cache_key] = {"ts": StockService._now(), "value": candles}
            return candles
        except Exception:
            seed = sum(ord(c) for c in symbol)
            rng = random.Random(seed + int(StockService._now() // 60))
            now = int(time.time())
            candles = []
            price = 50 + (seed % 200)
            for i in range(60):
                t = now - (59 - i) * 60
                o = max(1.0, price + rng.uniform(-1.0, 1.0))
                h = max(o, o + rng.uniform(0.0, 1.5))
                l = min(o, o - rng.uniform(0.0, 1.5))
                c = max(1.0, l + rng.random() * (h - l))
                v = float(rng.randint(1000, 200000))
                candles.append({"time": t, "open": o, "high": h, "low": l, "close": c, "volume": v})
                price = c
            StockService._history_cache[cache_key] = {"ts": StockService._now(), "value": candles}
            return candles

from typing import List, Dict, Any
import random

def run_trading_simulation(emotion_mode: str) -> Dict[str, Any]:
    """
    Simulates a mock trading session based on an emotional state.
    Returns profit/loss and basic stats.
    """
    emotion_mode = emotion_mode.lower()
    
    # Simulation parameters based on emotion
    # Calm traders are more consistent, take smaller but higher probability wins.
    # Excited traders are prone to FOMO, take larger sizes but lower probability wins.
    # Stressed traders are prone to panic, take impulsive losses and smaller wins.
    
    config = {
        "calm": {
            "win_rate": 0.65,
            "avg_win": 150,
            "avg_loss": 100,
            "num_trades": 5,
            "risk_score": 0.2
        },
        "excitement": {
            "win_rate": 0.45,
            "avg_win": 300,
            "avg_loss": 250,
            "num_trades": 10,
            "risk_score": 0.8
        },
        "stress": {
            "win_rate": 0.35,
            "avg_win": 100,
            "avg_loss": 200,
            "num_trades": 8,
            "risk_score": 0.95
        }
    }
    
    params = config.get(emotion_mode, config["calm"])
    
    trades = []
    total_profit = 0
    
    for i in range(params["num_trades"]):
        is_win = random.random() < params["win_rate"]
        
        # Add some variance to wins and losses
        if is_win:
            pnl = params["avg_win"] * random.uniform(0.8, 1.2)
        else:
            pnl = -params["avg_loss"] * random.uniform(0.8, 1.2)
            
        symbols = ["AAPL", "TSLA", "NVDA", "BTC-USD", "ETH-USD", "MSFT", "GOOGL"]
        symbol = random.choice(symbols)
        
        total_profit += pnl
        trades.append({
            "id": i + 1,
            "result": "WIN" if is_win else "LOSS",
            "pnl": round(pnl, 2),
            "symbol": symbol,
            "timestamp": f"Trade {i+1}"
        })
        
    return {
        "emotion": emotion_mode.capitalize(),
        "total_profit": round(total_profit, 2),
        "num_trades": params["num_trades"],
        "win_rate": round(params["win_rate"] * 100, 2),
        "risk_score": params["risk_score"],
        "trades": trades
    }

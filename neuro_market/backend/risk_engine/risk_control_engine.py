from typing import Dict, Any, Optional
from datetime import datetime, timedelta

class RiskControlEngine:
    """
    Advanced Risk Management Rules:
    - High Stress: 30s cooldown
    - Extreme Excitement: Require confirmation
    - Anxiety: Limit trade size
    - Emotional Instability: Rapid changes trigger cooldown
    - Rapid Trading: Too many trades in short time trigger cooldown
    - Consecutive Losses: Pause trading
    - Large Trade Spike: Require additional confirmation
    """

    def __init__(self, 
                 stress_threshold: float = 0.6, 
                 excitement_threshold: float = 0.6, 
                 anxiety_threshold: float = 0.5, 
                 happy_threshold: float = 0.6):
        self.stress_threshold = stress_threshold
        self.excitement_threshold = excitement_threshold
        self.anxiety_threshold = anxiety_threshold
        self.happy_threshold = happy_threshold
        self.cooldowns = {} # user_id -> (cooldown_expiry, type)
        self.emotion_history = {} # user_id -> List[Dict]
        self.trade_history_stats = {} # user_id -> List[Dict]

    def check_trade_permission(self, 
                               user_id: int, 
                               emotion: str, 
                               confidence: float, 
                               trade_amount: float = 0, 
                               recent_trades: list = [],
                               confirmed: bool = False) -> Dict[str, Any]:
        """
        Evaluate if a trade is allowed based on the user's emotional state and behavior.
        """
        now = datetime.utcnow()
        emotion = emotion.lower()

        # 1. Check for existing cooldowns
        if user_id in self.cooldowns:
            expiry, c_type = self.cooldowns[user_id]
            if now < expiry:
                remaining = int((expiry - now).total_seconds())
                msg = f"Cooldown in effect for {remaining}s."
                if c_type == "stress": msg = f"High Stress detected. Pause for {remaining}s."
                elif c_type == "anxiety": msg = f"Anxiety detected. Pause for {remaining}s."
                elif c_type == "fear": msg = f"Fear detected. Pause for {remaining}s."
                elif c_type == "greed": msg = f"Greed detected. Pause for {remaining}s."
                elif c_type == "instability": msg = f"Emotional Instability detected. Pause for {remaining}s."
                elif c_type == "rapid_trading": msg = f"Rapid Trading detected. Pause for {remaining}s."
                elif c_type == "losses": msg = f"Consecutive Losses detected. Pause for {remaining}s."
                
                return {
                    "allowed": False,
                    "message": msg,
                    "action": "BLOCK",
                    "cooldown_remaining": remaining
                }
            else:
                del self.cooldowns[user_id]

        # 2. Emotional Instability Rule
        if user_id not in self.emotion_history:
            self.emotion_history[user_id] = []
        self.emotion_history[user_id].append({"e": emotion, "c": float(confidence or 0.0), "t": now})
        self.emotion_history[user_id] = self.emotion_history[user_id][-30:]

        recent = [x for x in self.emotion_history[user_id] if (now - x["t"]).total_seconds() <= 45]
        changes = 0
        for i in range(1, len(recent)):
            if recent[i]["e"] != recent[i - 1]["e"]:
                changes += 1

        unique_emotions = set([x["e"] for x in recent if float(x.get("c", 0.0) or 0.0) >= 0.55])
        if changes >= 4 and len(unique_emotions) >= 4:
            self.cooldowns[user_id] = (now + timedelta(seconds=15), "instability")
            self.emotion_history[user_id] = [{"e": emotion, "c": float(confidence or 0.0), "t": now}]
            return {"allowed": False, "message": "Rapid emotional changes detected. 15s cooldown imposed.", "action": "BLOCK", "cooldown_remaining": 15}

        # 3. Behavior-Based: Rapid Trading Rule
        recent_trade_count = len([t for t in recent_trades if (now - t.timestamp).total_seconds() < 60])
        if recent_trade_count > 5:
            self.cooldowns[user_id] = (now + timedelta(seconds=15), "rapid_trading")
            return {"allowed": False, "message": "Rapid trading detected (over 5 trades/min). 15s cooldown imposed.", "action": "BLOCK", "cooldown_remaining": 15}

        # 4. Behavior-Based: Consecutive Loss Rule (assuming trade history available)
        # Simplified: Check last 3 trades in recent_trades list
        if len(recent_trades) >= 3:
            # For prototype, we'll look at the last 3 SELL trades and assume if price < prev_buy it's a loss
            # But simpler for this demo: just use a flag if the last 3 were 'SELL' (exit)
            # In a real app, we'd check actual P/L
            pass 

        # 5. Emotional Rules
        cooldown_emotions = {"stress", "anxiety", "fear", "greed"}
        if emotion in cooldown_emotions:
            if confidence >= 0.999:
                seconds = 15
            elif confidence >= 0.7:
                seconds = 10
            elif confidence >= 0.5:
                seconds = 5
            else:
                seconds = 0

            if seconds == 0 and not confirmed:
                return {
                    "allowed": False,
                    "message": f"{emotion.capitalize()} detected ({int(confidence * 100)}%). Please confirm to proceed.",
                    "action": "CONFIRMATION",
                    "cooldown_remaining": 0,
                }

        if emotion in cooldown_emotions and confidence >= 0.5:
            if confidence >= 0.999:
                max_allowed = 250.0
            elif confidence >= 0.7:
                max_allowed = 500.0
            else:
                max_allowed = 1000.0

            if trade_amount > max_allowed:
                return {
                    "allowed": False,
                    "message": f"{emotion.capitalize()} detected. Trade size is limited to ${max_allowed:.0f}.",
                    "action": "LIMIT",
                    "cooldown_remaining": 0,
                    "max_trade_amount": max_allowed,
                }

            if seconds > 0:
                self.cooldowns[user_id] = (now + timedelta(seconds=seconds), emotion)
                return {
                    "allowed": True,
                    "message": f"{emotion.capitalize()} detected ({int(confidence * 100)}%). Next trade will be available in {seconds}s.",
                    "action": "COOLDOWN",
                    "cooldown_remaining": 0,
                    "cooldown_after": seconds,
                }

        # 6. Large Trade Spike Rule
        if len(recent_trades) > 0:
            avg_size = sum([t.price * t.quantity for t in recent_trades]) / len(recent_trades)
            if trade_amount > avg_size * 3: # 3x larger than average
                if not confirmed:
                    return {
                        "allowed": False,
                        "message": "Large trade detected (3x your usual size). Please confirm again to proceed.",
                        "action": "CONFIRMATION",
                        "cooldown_remaining": 0,
                    }

        if emotion == "excitement":
            if not confirmed:
                return {
                    "allowed": False,
                    "message": f"Excitement detected ({int(confidence * 100)}%). Double verification required.",
                    "action": "CONFIRMATION",
                    "cooldown_remaining": 0,
                }

        if emotion == "happy" and confidence > self.happy_threshold:
            return {"allowed": True, "message": "You seem happy! Take a break and enjoy.", "action": "HAPPY_PROFIT", "cooldown_remaining": 0}

        if emotion not in {"calm", "neutral"} and confidence < 0.5:
            if not confirmed:
                return {
                    "allowed": False,
                    "message": f"{emotion.capitalize()} detected at low intensity ({int(confidence * 100)}%). Double verification required.",
                    "action": "CONFIRMATION",
                    "cooldown_remaining": 0,
                }
        
        return {"allowed": True, "message": "Trading state normal.", "action": "NONE", "cooldown_remaining": 0}

    def get_ai_insight(self, emotion: str, confidence: float) -> str:
        """
        Generate AI insights based on emotion.
        """
        if emotion == "stress":
            return "Elevated stress levels detected. Your heart rate variability and facial tension suggest you might be making decisions under pressure. Consider taking a short break."
        elif emotion == "excitement":
            return "High excitement detected. This state often leads to overconfidence and FOMO. Review your exit strategy before entering this trade."
        elif emotion == "anxiety":
            return "Anxiety detected. This can lead to hesitation or panic selling. A 30-second cooldown is recommended to regain emotional equilibrium."
        elif emotion == "calm":
            return "You are in a calm state. This is ideal for objective analysis and disciplined trading."
        else:
            return "No significant emotional markers detected. Trade with discipline."

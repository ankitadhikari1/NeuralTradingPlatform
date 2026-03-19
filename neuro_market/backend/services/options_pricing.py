import math
from datetime import datetime, date
from typing import Optional

def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def black_scholes_price(
    s: float,
    k: float,
    t_years: float,
    r: float,
    sigma: float,
    option_type: str,
) -> float:
    if t_years <= 0:
        if option_type.upper() == "CALL":
            return max(0.0, s - k)
        return max(0.0, k - s)

    if s <= 0 or k <= 0 or sigma <= 0:
        return 0.0

    d1 = (math.log(s / k) + (r + 0.5 * sigma * sigma) * t_years) / (sigma * math.sqrt(t_years))
    d2 = d1 - sigma * math.sqrt(t_years)

    if option_type.upper() == "CALL":
        return s * _norm_cdf(d1) - k * math.exp(-r * t_years) * _norm_cdf(d2)
    return k * math.exp(-r * t_years) * _norm_cdf(-d2) - s * _norm_cdf(-d1)

def years_to_expiry(expiry_yyyy_mm_dd: str) -> float:
    try:
        exp = datetime.strptime(expiry_yyyy_mm_dd, "%Y-%m-%d").date()
    except Exception:
        return 0.0
    today = date.today()
    days = (exp - today).days
    return max(0.0, days / 365.0)


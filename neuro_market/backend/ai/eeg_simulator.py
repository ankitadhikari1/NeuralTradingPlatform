import numpy as np
from datetime import datetime
from typing import Dict

class EEGSimulator:
    """
    Simulates EEG brainwave data for:
    Delta (0.5–4 Hz)
    Theta (4–8 Hz)
    Alpha (8–13 Hz)
    Beta (13–30 Hz)
    Gamma (30–100 Hz)
    """

    @staticmethod
    def generate_signal() -> Dict[str, float]:
        # Generate random but somewhat realistic power values for each band
        # These are normalized relative power values (0 to 1)
        # In a real EEG, these would be microvolts squared per Hz (uV^2/Hz)
        
        # Base values
        alpha = np.random.uniform(0.1, 0.4)
        beta = np.random.uniform(0.1, 0.4)
        gamma = np.random.uniform(0.01, 0.1)
        theta = np.random.uniform(0.1, 0.3)
        delta = np.random.uniform(0.1, 0.5)

        # Normalize to ensure they sum to something reasonable or just return as is
        # for simplicity in a prototype.
        
        return {
            "alpha": float(alpha),
            "beta": float(beta),
            "gamma": float(gamma),
            "theta": float(theta),
            "delta": float(delta),
            "timestamp": datetime.utcnow().timestamp()
        }

    @staticmethod
    def simulate_state(state: str) -> Dict[str, float]:
        """
        Simulate EEG signals based on a specific emotional state.
        
        - Stress: High Beta, Low Alpha
        - Calm: High Alpha, Low Beta
        - Excitement: High Beta, High Gamma
        - Anxiety: High Beta, High Theta
        """
        if state == "stress":
            alpha = np.random.uniform(0.05, 0.15)
            beta = np.random.uniform(0.4, 0.7)
            gamma = np.random.uniform(0.05, 0.15)
            theta = np.random.uniform(0.1, 0.2)
            delta = np.random.uniform(0.1, 0.3)
        elif state == "calm":
            alpha = np.random.uniform(0.4, 0.7)
            beta = np.random.uniform(0.05, 0.15)
            gamma = np.random.uniform(0.01, 0.05)
            theta = np.random.uniform(0.1, 0.2)
            delta = np.random.uniform(0.2, 0.4)
        elif state == "excitement":
            alpha = np.random.uniform(0.1, 0.2)
            beta = np.random.uniform(0.3, 0.5)
            gamma = np.random.uniform(0.2, 0.4)
            theta = np.random.uniform(0.1, 0.2)
            delta = np.random.uniform(0.1, 0.2)
        elif state == "anxiety":
            alpha = np.random.uniform(0.05, 0.15)
            beta = np.random.uniform(0.3, 0.5)
            gamma = np.random.uniform(0.05, 0.1)
            theta = np.random.uniform(0.3, 0.6)
            delta = np.random.uniform(0.1, 0.3)
        else: # Default random
            return EEGSimulator.generate_signal()

        return {
            "alpha": float(alpha),
            "beta": float(beta),
            "gamma": float(gamma),
            "theta": float(theta),
            "delta": float(delta),
            "timestamp": datetime.utcnow().timestamp()
        }

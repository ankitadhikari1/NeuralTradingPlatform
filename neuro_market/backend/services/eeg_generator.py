import numpy as np
import random

def generate_eeg(emotion: str):
    """
    Generates synthetic EEG signals based on the provided emotion.
    Brainwave types: delta, theta, alpha, beta, gamma.
    
    Emotion Mapping:
    - Calm: high alpha, low beta
    - Stress: high beta, high gamma, low alpha
    - Excited: high gamma, high beta
    - Anxiety: high theta, medium beta
    """
    emotion = emotion.lower()
    
    # Base values (low intensity)
    eeg = {
        "delta": random.uniform(0.1, 0.3),
        "theta": random.uniform(0.1, 0.4),
        "alpha": random.uniform(0.2, 0.5),
        "beta": random.uniform(0.1, 0.4),
        "gamma": random.uniform(0.05, 0.2)
    }
    
    if "calm" in emotion:
        eeg["alpha"] = random.uniform(0.7, 1.0)
        eeg["beta"] = random.uniform(0.1, 0.3)
    elif "stress" in emotion:
        eeg["beta"] = random.uniform(0.7, 1.0)
        eeg["gamma"] = random.uniform(0.6, 0.9)
        eeg["alpha"] = random.uniform(0.1, 0.3)
    elif "excited" in emotion or "excitement" in emotion:
        eeg["gamma"] = random.uniform(0.7, 1.0)
        eeg["beta"] = random.uniform(0.6, 0.9)
    elif "anxiety" in emotion:
        eeg["theta"] = random.uniform(0.7, 1.0)
        eeg["beta"] = random.uniform(0.4, 0.6)
        
    # Ensure values are floats and rounded for cleanliness
    return {k: round(float(v), 4) for k, v in eeg.items()}

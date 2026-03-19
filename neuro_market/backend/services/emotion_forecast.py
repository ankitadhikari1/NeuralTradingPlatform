from typing import List, Dict, Any
from collections import Counter
import random

def predict_next_emotion(history: List[str]) -> Dict[str, Any]:
    """
    Predicts the next emotional state based on recent history using a simple Markov Chain approach.
    """
    if not history or len(history) < 2:
        return {"prediction": "calm", "confidence": 0.5}

    # Use the most recent 5 states
    recent = history[-5:]
    
    # Transition probabilities based on the last state
    last_state = recent[-1]
    
    # Rule-based transitions (simplified Markov chain)
    transitions = {
        "calm": ["calm", "calm", "calm", "excitement", "anxiety"],
        "excitement": ["excitement", "excitement", "stress", "calm", "stress"],
        "stress": ["stress", "stress", "anxiety", "calm", "stress"],
        "anxiety": ["anxiety", "stress", "calm", "anxiety", "calm"]
    }
    
    # Get possible next states
    possible = transitions.get(last_state.lower(), ["calm"])
    
    # Simple prediction based on the most frequent transition
    prediction = random.choice(possible)
    
    # Confidence is higher if the last few states are the same
    same_count = recent.count(last_state)
    confidence = min(0.4 + (same_count * 0.1), 0.95)
    
    # Add some randomness for realism
    if random.random() < 0.2:
        prediction = random.choice(list(transitions.keys()))
        confidence = random.uniform(0.5, 0.7)

    return {
        "prediction": prediction.capitalize(),
        "confidence": round(confidence, 2)
    }

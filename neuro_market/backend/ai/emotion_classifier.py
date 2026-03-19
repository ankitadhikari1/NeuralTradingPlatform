import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
import joblib
import os

class EmotionClassifier:
    """
    Emotion Classifier Model using RandomForest.
    Inputs:
    - facial emotion score (angry, disgust, fear, happy, sad, surprise, neutral)
    - simulated EEG signals (alpha, beta, gamma, theta, delta)
    
    Output:
    - predicted emotional state (stress, excitement, anxiety, calm)
    """

    def __init__(self, model_path: str = "emotion_model.joblib"):
        self.model_path = model_path
        self.classes = ["stress", "excitement", "anxiety", "calm"]
        self.model = None
        
        # Load model if it exists
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
        else:
            # If model doesn't exist, we will need to train a dummy one
            # or just initialize it during the first use if data is available
            print(f"Model not found at {self.model_path}. Please train the model first.")
            self.train_dummy_model()

    def train_dummy_model(self):
        """
        Train a dummy model to have something working immediately.
        In a real scenario, this would be trained on actual data.
        """
        # Lazy import for faster startup
        from sklearn.ensemble import RandomForestClassifier

        # Create synthetic training data
        n_samples = 1000
        
        # Facial emotions (angry, disgust, fear, happy, sad, surprise, neutral)
        face_emotions = np.random.rand(n_samples, 7)
        
        # EEG bands (alpha, beta, gamma, theta, delta)
        eeg_bands = np.random.rand(n_samples, 5)
        
        X = np.hstack([face_emotions, eeg_bands])
        y = []
        
        for i in range(n_samples):
            # Assign labels based on some rules for synthetic data consistency
            # Stress: high fear/angry (indices 2/0) and high beta (index 8)
            if X[i, 2] > 0.5 or X[i, 0] > 0.5:
                y.append("stress")
            # Excitement: high happy/surprise (indices 3/5) and high gamma (index 9)
            elif X[i, 3] > 0.5 or X[i, 5] > 0.5:
                y.append("excitement")
            # Anxiety: high fear/surprise (indices 2/5) and high theta (index 10)
            elif X[i, 2] > 0.4 and X[i, 10] > 0.5:
                y.append("anxiety")
            # Calm: high neutral (index 6) and high alpha (index 7)
            else:
                y.append("calm")
        
        # Train model
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.model.fit(X, y)
        
        # Save model
        joblib.dump(self.model, self.model_path)
        print(f"Dummy model trained and saved to {self.model_path}")

    def predict(self, face_emotions: Dict[str, float], eeg_signal: Dict[str, float]) -> Tuple[str, float]:
        """
        Predict emotion state and return (class, probability)
        """
        if self.model is None:
            return "unknown", 0.0

        # Feature vector construction
        # Order must match training data: 
        # Face: angry, disgust, fear, happy, sad, surprise, neutral
        # EEG: alpha, beta, gamma, theta, delta
        
        face_features = [
            face_emotions.get('angry', 0.0),
            face_emotions.get('disgust', 0.0),
            face_emotions.get('fear', 0.0),
            face_emotions.get('happy', 0.0),
            face_emotions.get('sad', 0.0),
            face_emotions.get('surprise', 0.0),
            face_emotions.get('neutral', 0.0)
        ]
        
        eeg_features = [
            eeg_signal.get('alpha', 0.0),
            eeg_signal.get('beta', 0.0),
            eeg_signal.get('gamma', 0.0),
            eeg_signal.get('theta', 0.0),
            eeg_signal.get('delta', 0.0)
        ]
        
        X = np.array([face_features + eeg_features])
        
        prediction = self.model.predict(X)[0]
        probabilities = self.model.predict_proba(X)[0]
        
        # Get the index of the predicted class
        class_idx = list(self.model.classes_).index(prediction)
        confidence = float(probabilities[class_idx])
        
        return prediction, confidence

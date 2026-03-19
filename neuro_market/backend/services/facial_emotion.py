import cv2
import numpy as np
import base64
from typing import Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, TimeoutError

class FacialEmotionService:
    """
    Service for facial emotion detection using DeepFace.
    """

    _warmed_up = False
    _reloaded = False

    @staticmethod
    def _neutral() -> Dict[str, float]:
        return {
            'angry': 0.0,
            'disgust': 0.0,
            'fear': 0.0,
            'happy': 0.0,
            'sad': 0.0,
            'surprise': 0.0,
            'neutral': 1.0
        }

    @staticmethod
    def _heuristic(frame) -> Tuple[Dict[str, float], str]:
        if frame is None:
            return FacialEmotionService._neutral(), "bad_frame"

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(getattr(cv2.data, "haarcascades", "") + "haarcascade_frontalface_default.xml")
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
        if faces is None or len(faces) == 0:
            return FacialEmotionService._neutral(), "no_face"

        x, y, w, h = max(faces, key=lambda b: b[2] * b[3])
        roi = gray[y:y + h, x:x + w]
        mean = float(np.mean(roi))
        std = float(np.std(roi))
        edges = cv2.Canny(roi, 80, 160)
        edge_density = float(np.mean(edges)) / 255.0

        dominant = "neutral"
        if mean > 150 and std > 45:
            dominant = "happy"
        elif edge_density > 0.22:
            dominant = "angry"
        elif mean < 85 and std < 35:
            dominant = "sad"
        elif std > 65:
            dominant = "surprise"

        scores = {
            "angry": 0.05,
            "disgust": 0.02,
            "fear": 0.03,
            "happy": 0.05,
            "sad": 0.05,
            "surprise": 0.05,
            "neutral": 0.75,
        }
        scores[dominant] = 0.7
        if dominant != "neutral":
            scores["neutral"] = 0.2

        total = sum(scores.values()) or 1.0
        normalized = {k: float(v) / total for k, v in scores.items()}
        return normalized, "fallback"

    @staticmethod
    def analyze_frame(base64_frame: str) -> Tuple[Dict[str, float], str]:
        """
        Analyze a base64 encoded frame and return emotion scores.
        """
        try:
            # Lazy import to speed up startup
            from deepface import DeepFace
            
            # Decode base64 image
            header, encoded = base64_frame.split(",", 1)
            data = base64.b64decode(encoded)
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                return FacialEmotionService._neutral(), "bad_frame"

            if len(frame.shape) == 2:
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
            elif frame.shape[2] == 4:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

            h, w = frame.shape[:2]
            max_dim = max(h, w)
            if max_dim > 640:
                scale = 640.0 / float(max_dim)
                frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

            # Analyze with DeepFace
            # enforce_detection=False to avoid errors if no face is found
            def run():
                return DeepFace.analyze(
                    frame,
                    actions=['emotion'],
                    enforce_detection=False,
                    detector_backend="opencv",
                    silent=True,
                )

            timeout_s = 30.0 if not FacialEmotionService._warmed_up else 3.0
            with ThreadPoolExecutor(max_workers=1) as ex:
                results = ex.submit(run).result(timeout=timeout_s)
            
            if isinstance(results, list):
                results = results[0]
            
            # Extract emotion scores (normalized 0 to 1)
            emotions = results.get('emotion', {})
            # DeepFace returns percentages (0-100), convert to 0-1 (force Python float for JSON)
            normalized_emotions = {str(k): float(v) / 100.0 for k, v in emotions.items()}
            FacialEmotionService._warmed_up = True

            if not normalized_emotions:
                return FacialEmotionService._neutral(), "no_face"

            return normalized_emotions, "ok"
        except TimeoutError:
            return FacialEmotionService._neutral(), "timeout"
        except Exception as e:
            print(f"DeepFace analysis error: {e}")
            reason = str(e).replace("\n", " ").strip()
            if len(reason) > 120:
                reason = reason[:120] + "…"

            if not FacialEmotionService._reloaded and isinstance(e, AttributeError) and "build_model" in str(e):
                FacialEmotionService._reloaded = True
                try:
                    import sys
                    import importlib
                    for m in [
                        "deepface.modules.modeling",
                        "deepface.modules",
                        "deepface.DeepFace",
                        "deepface",
                    ]:
                        if m in sys.modules:
                            del sys.modules[m]
                    from deepface import DeepFace
                    header, encoded = base64_frame.split(",", 1)
                    data = base64.b64decode(encoded)
                    nparr = np.frombuffer(data, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    if frame is None:
                        return FacialEmotionService._neutral(), "bad_frame"
                    if len(frame.shape) == 2:
                        frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
                    elif frame.shape[2] == 4:
                        frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                    h, w = frame.shape[:2]
                    max_dim = max(h, w)
                    if max_dim > 640:
                        scale = 640.0 / float(max_dim)
                        frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

                    def run_retry():
                        return DeepFace.analyze(
                            frame,
                            actions=["emotion"],
                            enforce_detection=False,
                            detector_backend="opencv",
                            silent=True,
                        )

                    with ThreadPoolExecutor(max_workers=1) as ex:
                        results = ex.submit(run_retry).result(timeout=5.0)
                    if isinstance(results, list):
                        results = results[0]
                    emotions = results.get("emotion", {})
                    normalized = {str(k): float(v) / 100.0 for k, v in emotions.items()}
                    if normalized:
                        FacialEmotionService._warmed_up = True
                        return normalized, "ok"
                except Exception:
                    pass

            try:
                header, encoded = base64_frame.split(",", 1)
                data = base64.b64decode(encoded)
                nparr = np.frombuffer(data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                scores, _ = FacialEmotionService._heuristic(frame)
                return scores, f"fallback:{type(e).__name__}:{reason}"
            except Exception:
                return FacialEmotionService._neutral(), "error"

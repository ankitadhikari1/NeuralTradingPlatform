from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from models import database, schemas
from services import auth, facial_emotion, eeg_generator
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter(prefix="/emotion", tags=["emotion"])
face_service = facial_emotion.FacialEmotionService()

def map_face_to_state(face_scores: Dict[str, float]) -> Dict[str, Any]:
    scores = {k.lower(): float(v) for k, v in (face_scores or {}).items()}
    if not scores:
        return {"emotion": "calm", "confidence": 0.5, "dominant": "neutral"}

    dominant = max(scores.items(), key=lambda kv: kv[1])[0]
    confidence = float(scores.get(dominant, 0.0))

    if dominant in {"happy", "surprise"}:
        state = "excitement"
    elif dominant in {"fear", "angry"}:
        state = "stress"
    elif dominant in {"sad", "disgust"}:
        state = "anxiety"
    else:
        state = "calm"

    return {"emotion": state, "confidence": confidence, "dominant": dominant}

@router.get("/logs", response_model=List[schemas.EmotionLog])
def get_emotion_logs(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db)
):
    return db.query(database.EmotionLog).filter(database.EmotionLog.user_id == current_user.id).order_by(database.EmotionLog.timestamp.desc()).limit(100).all()

@router.post("/log", response_model=schemas.EmotionLog)
def create_emotion_log(
    payload: schemas.EmotionLogBase,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    emotion = str(payload.emotion or "").strip().lower()
    confidence = float(payload.confidence or 0.0)
    confidence = max(0.0, min(1.0, confidence))
    if not emotion:
        emotion = "calm"

    new_log = database.EmotionLog(
        user_id=current_user.id,
        emotion=emotion,
        confidence=confidence,
    )
    db.add(new_log)

    eeg = eeg_generator.generate_eeg(emotion)
    new_eeg = database.EEGSignal(
        user_id=current_user.id,
        alpha=eeg.get("alpha", 0.0),
        beta=eeg.get("beta", 0.0),
        gamma=eeg.get("gamma", 0.0),
        theta=eeg.get("theta", 0.0),
        delta=eeg.get("delta", 0.0),
    )
    db.add(new_eeg)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.websocket("/ws")
async def emotion_websocket(websocket: WebSocket, token: str):
    """
    WebSocket for real-time emotion updates.
    The client should send webcam frames periodically.
    The server runs DeepFace emotion analysis and returns an emotion state.
    """
    await websocket.accept()
    
    # Authenticate via token passed in query parameter
    try:
        # Use simple JWT decode to avoid async issues in websocket handler
        # for a prototype. In production, use auth.get_current_user
        from jose import jwt
        import os
        SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-development-only")
        ALGORITHM = "HS256"
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            await websocket.close(code=1008, reason="missing_sub")
            return
    except Exception as e:
        print(f"WebSocket auth error: {e}")
        await websocket.close(code=1008, reason="invalid_token")
        return

    # Database session
    db = database.SessionLocal()
    user = db.query(database.User).filter(database.User.username == username).first()
    if not user:
        await websocket.close(code=1008, reason="user_not_found")
        return

    try:
        last_persist_at = 0.0
        while True:
            # Receive data from frontend
            # The frontend can send either a base64 frame OR pre-computed scores
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except Exception:
                continue
            
            face_scores = {}
            face_status = "ok"
            if "frame" in message:
                # Backend analyzes frame using DeepFace
                face_scores, face_status = face_service.analyze_frame(message["frame"])
            elif "face_scores" in message:
                # Client sends scores directly (lighter)
                face_scores = message["face_scores"]
            else:
                # Default empty/neutral scores
                face_scores = {'neutral': 1.0}
                face_status = "missing"

            try:
                face_scores = {str(k): float(v) for k, v in (face_scores or {}).items()}
            except Exception:
                face_scores = {'neutral': 1.0}
                face_status = "bad_face_scores"

            mapped = map_face_to_state(face_scores)
            predicted_emotion = mapped["emotion"]
            confidence = float(mapped["confidence"])

            is_fallback = str(face_status).startswith("fallback")
            if face_status != "ok" and not is_fallback:
                predicted_emotion = "neutral"
                confidence = 0.5
                mapped["dominant"] = "neutral"
            elif mapped.get("dominant") == "neutral" and confidence >= 0.99:
                predicted_emotion = "neutral"
                confidence = 0.5

            # Generate EEG signals based on emotion
            eeg_signals = eeg_generator.generate_eeg(predicted_emotion)

            now_ts = datetime.utcnow().timestamp()
            if now_ts - last_persist_at >= 5.0:
                try:
                    new_log = database.EmotionLog(
                        user_id=user.id,
                        emotion=predicted_emotion,
                        confidence=confidence
                    )
                    db.add(new_log)
                    
                    # Also persist EEG signal
                    new_eeg = database.EEGSignal(
                        user_id=user.id,
                        alpha=eeg_signals["alpha"],
                        beta=eeg_signals["beta"],
                        gamma=eeg_signals["gamma"],
                        theta=eeg_signals["theta"],
                        delta=eeg_signals["delta"]
                    )
                    db.add(new_eeg)
                    
                    db.commit()
                    last_persist_at = now_ts
                except SQLAlchemyError:
                    db.rollback()
            
            # Send back the result
            response_data = {
                "emotion": predicted_emotion,
                "confidence": confidence,
                "face": face_scores, # Send back face scores too
                "face_status": face_status,
                "dominant_face_emotion": mapped["dominant"],
                "eeg": eeg_signals, # Add EEG data
                "timestamp": datetime.utcnow().isoformat()
            }
            await websocket.send_text(json.dumps(response_data))
            
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user {username}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close(code=1011, reason="server_error")
        except Exception:
            pass
    finally:
        db.close()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import database, schemas
from services import auth
from services import practice_advisor

router = APIRouter(prefix="/practice", tags=["practice"])

@router.get("/recommendation", response_model=schemas.PracticeRecommendation)
def get_recommendation(
    symbol: str,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    try:
        data = practice_advisor.recommend(symbol, current_user, db)
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate recommendation")

@router.post("/recommendation", response_model=schemas.PracticeRecommendation)
def post_recommendation(
    payload: schemas.PracticeRecommendationRequest,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(auth.get_db),
):
    try:
        emotion = payload.emotion.model_dump() if payload.emotion is not None else None
        data = practice_advisor.recommend(
            payload.symbol,
            current_user,
            db,
            current_price=payload.current_price,
            practice_stats=payload.practice_stats,
            emotion=emotion,
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate recommendation")

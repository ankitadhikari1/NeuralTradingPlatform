from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import database, schemas
from services import auth
from fastapi.security import OAuth2PasswordRequestForm
import os

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/signup", response_model=schemas.User)
def signup(user_in: schemas.UserCreate, db: Session = Depends(auth.get_db)):
    if user_in.password != user_in.password_confirmation:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    db_user = db.query(database.User).filter(
        (database.User.username == user_in.username) | (database.User.email == user_in.email)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    hashed_password = auth.get_password_hash(user_in.password)
    default_balance = float(os.getenv("DEFAULT_CASH_BALANCE", "10000"))
    new_user = database.User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
        cash_balance=default_balance,
        is_admin=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(auth.get_db)):
    user = db.query(database.User).filter(database.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: database.User = Depends(auth.get_current_user)):
    return current_user

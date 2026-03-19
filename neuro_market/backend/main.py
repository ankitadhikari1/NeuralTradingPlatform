from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Absolute imports within the backend directory
from models import database
from routes import auth, trading, emotion, admin, options, practice, ai_assistant

load_dotenv()

# Initialize database
database.init_db()

app = FastAPI(title="NeuroMarket Lite API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(trading.router)
app.include_router(emotion.router)
app.include_router(admin.router)
app.include_router(options.router)
app.include_router(practice.router)
app.include_router(ai_assistant.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to NeuroMarket Lite API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

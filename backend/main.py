# AWS Resources Connected
from contextlib import asynccontextmanager


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import api, core
from app.services.prediction_service import run_daily_predictions
from app.services.seed import seed_database
from app.services.auto_pipeline import start_pipeline_scheduler, run_pipeline_once
from app.database import SessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_database()
    db = SessionLocal()
    try:
        run_daily_predictions(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.app_name,
    description="Autonomous AI-powered blood support network for Blood Warriors",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core.router, prefix="/api/v1")
app.include_router(api.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "name": "BloodMind",
        "tagline": "A Sentient Blood Coordination Network — Autonomous Pipeline Active",
        "version": "3.0.0",
        "docs": "/docs",
        "api": "/api/v1",
    }

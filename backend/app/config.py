from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "BloodMind API"
    dataset_path: Path = Path(__file__).resolve().parents[2] / "Dataset.csv"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    pre_staging_hours: int = 72
    outreach_escalation_hours: int = 6

    class Config:
        env_prefix = "BLOODMIND_"


settings = Settings()

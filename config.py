import os
from pydantic_settings import BaseSettings

# Auto-create necessary directories so Render doesn't crash
os.makedirs("data", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/ai_create.db")
    PORT: int = int(os.getenv("PORT", 8000))

settings = Settings()

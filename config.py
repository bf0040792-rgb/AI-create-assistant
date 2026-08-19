import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/ai_create.db")
    PORT: int = int(os.getenv("PORT", 8000))

settings = Settings()

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://appuser:changeme@db:5432/appointment_agent"
    secret_key: str = "change-me-in-production"
    encryption_key: Optional[str] = None
    github_token: Optional[str] = None
    first_user: str = "admin"
    first_password: str = "changeme"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

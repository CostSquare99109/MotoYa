"""Application configuration and environment variables."""

import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    APP_ENV: str = "development"  # development | staging | production

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10_485_760  # 10 MB
    ALLOWED_UPLOAD_TYPES: str = "image/jpeg,image/png,image/webp,application/pdf"

    # ── Validación de seguridad ─────────────────────────────────────────────
    def model_post_init(self, __context) -> None:
        """Validate that production settings are secure."""
        if self.APP_ENV in ("production", "staging"):
            if self.JWT_SECRET == "change-me-in-production":
                raise ValueError(
                    "JWT_SECRET must be changed from default in "
                    f"{self.APP_ENV} environment. "
                    "Set a strong secret in your .env file."
                )
            if "localhost" in self.DATABASE_URL:
                raise ValueError(
                    f"DATABASE_URL points to localhost in {self.APP_ENV} environment. "
                    "Configure a proper database host."
                )

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_upload_types_list(self) -> list[str]:
        return [t.strip() for t in self.ALLOWED_UPLOAD_TYPES.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

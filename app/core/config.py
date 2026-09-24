"""Application settings loaded from environment / .env via Pydantic v2."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Top-level application settings (12-factor)."""

    app_name: str = Field(default="AM-TradingAgents")
    debug: bool = Field(default=False)
    api_v1_prefix: str = Field(default="/api/v1")
    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expires_minutes: int = Field(default=30)

    model_config = {"extra": "ignore"}
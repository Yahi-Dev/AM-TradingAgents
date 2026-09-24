"""Health-check response schema."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Body returned by GET /health."""

    status: str = "ok"
    version: str
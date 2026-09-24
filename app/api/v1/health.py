"""Health-check endpoint (public, no auth)."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.schemas.health import HealthResponse

health_router = APIRouter(tags=["health"])


@health_router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness / readiness probe",
)
async def health() -> HealthResponse:
    """Return service status and application version."""
    return HealthResponse(status="ok", version=__version__)
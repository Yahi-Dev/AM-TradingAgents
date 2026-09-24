"""FastAPI application factory and top-level wiring."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.v1.router import api_v1_router
from app.core.config import Settings
from app.core.errors import AppError, app_error_handler
from app.core.security import require_auth

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application instance.

    Wires routers, middleware, exception handlers and OpenAPI metadata.
    """
    app = FastAPI(
        title="AM-TradingAgents API",
        version=__version__,
        description="Professional agentic trading platform – backend API.",
        openapi_url="/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handler
    app.add_exception_handler(AppError, app_error_handler)

    # Routers
    app.include_router(api_v1_router, prefix="/api/v1")

    # Root health (convenience, no prefix)
    app.include_router(_root_health_router())

    return app


def _root_health_router() -> Any:
    """Build a minimal router exposing /health at the root level."""
    from fastapi import APIRouter

    from app.api.v1.health import health_router

    router = APIRouter()

    @router.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    return router


# ---------------------------------------------------------------------------
# Module-level app instance (for `uvicorn app.main:app`)
# ---------------------------------------------------------------------------

app: FastAPI = create_app()
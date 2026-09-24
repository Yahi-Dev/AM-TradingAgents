"""Tests for 401 on unauthenticated protected endpoints (AC-03)."""

from __future__ import annotations

from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from app.core.security import require_auth


def _build_app_with_protected_route() -> FastAPI:
    """Create a minimal app with one JWT-protected route."""
    app = FastAPI()

    @app.get("/protected")
    async def protected(
        user: str = Depends(require_auth),
    ) -> dict[str, str]:
        return {"user": user}

    return app


class TestUnauthorized:
    """Verify 401 behaviour when no/invalid token is sent."""

    def test_missing_token_returns_401(self) -> None:
        """AC-03: request without JWT → 401 with structured message."""
        app = _build_app_with_protected_route()
        client = TestClient(app)
        resp = client.get("/protected")
        assert resp.status_code == 401
        body = resp.json()
        # FastAPI's HTTPException serialises detail as a string
        assert "detail" in body
        assert isinstance(body["detail"], str)
        assert len(body["detail"]) > 0

    def test_invalid_token_returns_401(self) -> None:
        """AC-03: request with garbage token → 401."""
        app = _build_app_with_protected_route()
        client = TestClient(app)
        resp = client.get(
            "/protected",
            headers={"Authorization": "Bearer not-a-valid-jwt"},
        )
        assert resp.status_code == 401
        body = resp.json()
        assert "detail" in body

    def test_health_still_public(self, app_client: TestClient) -> None:
        """Health endpoint must remain public (no auth required)."""
        resp = app_client.get("/health")
        assert resp.status_code == 200
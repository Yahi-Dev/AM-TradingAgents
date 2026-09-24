"""Tests for the /health endpoint (AC-01)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


class TestHealthEndpoint:
    """Verify GET /health contract."""

    def test_health_returns_200_ok(self, app_client: TestClient) -> None:
        """AC-01: GET /health → 200 with status ok and version."""
        resp = app_client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "version" in body
        assert isinstance(body["version"], str)

    def test_health_via_api_v1_prefix(self, app_client: TestClient) -> None:
        """Health is also reachable under /api/v1/health."""
        resp = app_client.get("/api/v1/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"

    def test_openapi_json_available(self, app_client: TestClient) -> None:
        """AC-03 / DoD: GET /openapi.json returns 200 with valid JSON."""
        resp = app_client.get("/openapi.json")
        assert resp.status_code == 200
        data = resp.json()
        assert "openapi" in data
        assert data["openapi"].startswith("3.")

    def test_docs_page_available(self, app_client: TestClient) -> None:
        """AC-02: GET /docs returns 200 (HTML)."""
        resp = app_client.get("/docs")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
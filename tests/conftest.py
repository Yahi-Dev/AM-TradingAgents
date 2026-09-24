"""Shared pytest fixtures for the test suite."""

from __future__ import annotations

from collections.abc import Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def app_client() -> Generator[TestClient, Any, None]:
    """Yield a TestClient bound to a fresh app instance."""
    app = create_app()
    with TestClient(app) as client:
        yield client
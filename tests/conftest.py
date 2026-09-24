"""Shared test fixtures for the agents test suite."""

import pytest


@pytest.fixture
def sample_run_id() -> str:
    """A sample run UUID for tests."""
    return "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


@pytest.fixture
def sample_correlation_id() -> str:
    """A sample correlation UUID for tests."""
    return "11111111-2222-3333-4444-555555555555"
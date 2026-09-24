"""Shared fixtures for dataflows unit tests."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.dataflows.orm_models import Base


@pytest.fixture()
def sample_df() -> pd.DataFrame:
    """A small OHLCV DataFrame mimicking yfinance output."""
    return pd.DataFrame(
        {
            "date": [
                date(2024, 1, 2),
                date(2024, 1, 3),
                date(2024, 1, 4),
                date(2024, 1, 5),
                date(2024, 1, 8),
            ],
            "open": [185.0, 186.0, 187.0, 188.0, 189.0],
            "high": [186.5, 187.5, 188.5, 189.5, 190.5],
            "low": [184.0, 185.0, 186.0, 187.0, 188.0],
            "close": [185.5, 186.5, 187.5, 188.5, 189.5],
            "volume": [50_000_000, 52_000_000, 48_000_000, 51_000_000, 49_000_000],
        }
    )


@pytest.fixture()
def engine():
    """In-memory SQLite engine for persistence tests."""
    eng = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture()
def session(engine):
    """SQLAlchemy session bound to the in-memory engine."""
    with Session(engine) as s:
        yield s
"""AC-03 – OHLCV data persists in market_data_ohlcv with (symbol, date) PK."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dataflows.api import get_stock_data
from app.dataflows.orm_models import MarketDataOHLCV
from app.dataflows.persistence import fetch_ohlcv, persist_ohlcv


def test_ohlcv_persistence(sample_df, engine) -> None:
    """GIVEN data obtained via get_stock_data
    WHEN persisted with a session
    THEN rows land in market_data_ohlcv with (symbol, date) as PK.
    """
    with patch("app.dataflows.ingestion._fetch_yfinance", return_value=sample_df):
        with Session(engine) as session:
            result = get_stock_data(
                "AAPL",
                "2024-01-01",
                "2024-12-31",
                vendor="yfinance",
                session=session,
            )
            session.commit()

    assert result.status == "ok"
    assert result.records is not None
    assert len(result.records) == 5

    # Verify rows in DB
    with Session(engine) as session:
        rows = session.execute(
            select(MarketDataOHLCV).where(MarketDataOHLCV.symbol == "AAPL")
        ).scalars().all()

    assert len(rows) == 5
    for row in rows:
        assert row.symbol == "AAPL"
        assert row.date is not None
        assert row.open is not None
        assert row.high is not None
        assert row.low is not None
        assert row.close is not None
        assert row.volume is not None


def test_ohlcv_persistence_upsert(sample_df, engine) -> None:
    """Persisting the same (symbol, date) twice must not duplicate rows."""
    with patch("app.dataflows.ingestion._fetch_yfinance", return_value=sample_df):
        with Session(engine) as session:
            get_stock_data(
                "AAPL",
                "2024-01-01",
                "2024-12-31",
                vendor="yfinance",
                session=session,
            )
            session.commit()

            # Second upsert with modified close
            sample_df_modified = sample_df.copy()
            sample_df_modified.loc[0, "close"] = 999.0
            with patch(
                "app.dataflows.ingestion._fetch_yfinance",
                return_value=sample_df_modified,
            ):
                get_stock_data(
                    "AAPL",
                    "2024-01-01",
                    "2024-12-31",
                    vendor="yfinance",
                    session=session,
                )
            session.commit()

    with Session(engine) as session:
        rows = session.execute(
            select(MarketDataOHLCV).where(MarketDataOHLCV.symbol == "AAPL")
        ).scalars().all()

    assert len(rows) == 5  # still 5, no duplicates


def test_ohlcv_persistence_fetch_range(sample_df, engine) -> None:
    """fetch_ohlcv returns only rows within the requested date range."""
    with patch("app.dataflows.ingestion._fetch_yfinance", return_value=sample_df):
        with Session(engine) as session:
            get_stock_data(
                "AAPL",
                "2024-01-01",
                "2024-12-31",
                vendor="yfinance",
                session=session,
            )
            session.commit()

    with Session(engine) as session:
        rows = fetch_ohlcv(
            session,
            "AAPL",
            date(2024, 1, 3),
            date(2024, 1, 5),
        )

    assert len(rows) == 3  # Jan 3, 4, 5
    assert all(date(2024, 1, 3) <= r.date <= date(2024, 1, 5) for r in rows)


# Local import to avoid circular issues in test scope
from unittest.mock import patch  # noqa: E402
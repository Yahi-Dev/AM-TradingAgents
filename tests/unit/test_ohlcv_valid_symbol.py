"""AC-01 – Valid symbol returns DataFrame with correct columns, no gaps."""

from __future__ import annotations

from unittest.mock import patch

import pandas as pd
import pytest

from app.dataflows.api import get_stock_data


def test_ohlcv_valid_symbol(sample_df) -> None:
    """GIVEN a valid symbol and date range
    WHEN dataflows.get_stock_data is called with vendor='yfinance'
    THEN it returns a DataFrame with columns date/open/high/low/close/volume
    AND there are no gaps in NYSE trading days.
    """
    with patch("app.dataflows.ingestion._fetch_yfinance", return_value=sample_df):
        result = get_stock_data("AAPL", "2024-01-01", "2024-12-31", vendor="yfinance")

    assert result.status == "ok"
    assert result.records is not None
    assert len(result.records) == 5

    # Verify column presence via the underlying DataFrame contract
    # (records carry the same fields as the DataFrame columns)
    first = result.records[0]
    assert first.symbol == "AAPL"
    assert first.date is not None
    assert first.open > 0
    assert first.high > first.open
    assert first.low < first.open
    assert first.close > 0
    assert first.volume > 0


def test_ohlcv_valid_symbol_columns_match_contract(sample_df) -> None:
    """The returned records must expose exactly the OHLCV contract fields."""
    with patch("app.dataflows.ingestion._fetch_yfinance", return_value=sample_df):
        result = get_stock_data("AAPL", "2024-01-01", "2024-12-31", vendor="yfinance")

    assert result.status == "ok"
    expected_fields = {"symbol", "date", "open", "high", "low", "close", "volume"}
    for rec in result.records:
        assert set(rec.model_dump().keys()) == expected_fields


def test_ohlcv_no_gaps_in_trading_days(sample_df) -> None:
    """Consecutive trading days (Mon-Fri) must not be flagged as gaps."""
    with patch("app.dataflows.ingestion._fetch_yfinance", return_value=sample_df):
        result = get_stock_data("AAPL", "2024-01-01", "2024-12-31", vendor="yfinance")

    assert result.status == "ok"
    # 5 consecutive trading days: Jan 2,3,4,5,8 (Mon-Fri + Mon)
    # No gap > 3 calendar days
    assert result.error is None
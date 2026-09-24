"""Symbol and data validation for the OHLCV ingestion pipeline."""

from __future__ import annotations

import re
from datetime import date

import pandas as pd

from app.dataflows.models import IngestionError

# Valid NYSE ticker pattern: 1-6 uppercase letters, optionally followed by
# a dot and a digit (e.g. "BRK.B").  We keep it permissive but reject
# obviously non-ticker strings.
_TICKER_RE = re.compile(r"^[A-Z]{1,6}(\.[A-Z0-9]{1,2})?$")


def validate_symbol(symbol: str) -> IngestionError | None:
    """Return an IngestionError if *symbol* is not a plausible ticker.

    Returns None when the symbol passes basic structural checks.
    """
    if not symbol or not isinstance(symbol, str):
        return IngestionError(
            code="INVALID_SYMBOL",
            message="Symbol must be a non-empty string.",
            symbol=str(symbol),
        )
    if not _TICKER_RE.match(symbol.strip()):
        return IngestionError(
            code="INVALID_SYMBOL",
            message=f"Symbol '{symbol}' does not match NYSE ticker pattern.",
            symbol=symbol,
        )
    return None


def validate_dataframe(df: pd.DataFrame, symbol: str) -> IngestionError | None:
    """Validate that *df* contains the expected OHLCV columns and is non-empty.

    Returns None on success, otherwise an IngestionError.
    """
    required_cols = {"date", "open", "high", "low", "close", "volume"}
    if df is None or df.empty:
        return IngestionError(
            code="NO_DATA",
            message=f"No OHLCV data returned for symbol '{symbol}'.",
            symbol=symbol,
        )
    missing = required_cols - set(df.columns.str.lower())
    if missing:
        return IngestionError(
            code="SCHEMA_MISMATCH",
            message=f"Missing columns: {sorted(missing)}",
            symbol=symbol,
        )
    return None


def validate_no_gaps(df: pd.DataFrame, symbol: str) -> IngestionError | None:
    """Check that trading dates are contiguous (no unexpected gaps > 3 calendar days).

    Weekends and market holidays are expected; a gap > 3 calendar days
    signals a data problem.
    """
    dates = df["date"].sort_values().reset_index(drop=True)
    for i in range(1, len(dates)):
        gap_days = (dates.iloc[i] - dates.iloc[i - 1]).days
        if gap_days > 3:
            return IngestionError(
                code="DATA_GAP",
                message=(
                    f"Gap of {gap_days} calendar days between "
                    f"{dates.iloc[i - 1].date()} and {dates.iloc[i].date()}"
                ),
                symbol=symbol,
            )
    return None
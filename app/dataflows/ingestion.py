"""Core OHLCV ingestion using the yfinance vendor."""

from __future__ import annotations

from datetime import date, datetime

import pandas as pd

from app.dataflows.models import IngestionError
from app.dataflows.validators import validate_dataframe, validate_no_gaps, validate_symbol


def _fetch_yfinance(symbol: str, start: str, end: str) -> pd.DataFrame:
    """Fetch OHLCV data from yfinance for *symbol* in [start, end].

    Returns a DataFrame with columns: date, open, high, low, close, volume.
    Raises RuntimeError if the vendor returns no rows.
    """
    import yfinance as yf

    df = yf.Ticker(symbol).history(start=start, end=end, interval="1d")
    if df is None or df.empty:
        raise RuntimeError(f"yfinance returned no data for '{symbol}'")

    df = df.reset_index()
    df.columns = [c.lower() for c in df.columns]
    # yfinance returns a 'Date' or 'Datetime' column; normalise to 'date'
    if "date" not in df.columns and "datetime" in df.columns:
        df = df.rename(columns={"datetime": "date"})
    elif "date" not in df.columns:
        # Fallback: first column is the index date
        df = df.rename(columns={df.columns[0]: "date"})

    # Ensure required columns exist
    required = {"date", "open", "high", "low", "close", "volume"}
    if not required.issubset(set(df.columns)):
        raise RuntimeError(
            f"yfinance response missing columns; got {list(df.columns)}"
        )

    df["date"] = pd.to_datetime(df["date"]).dt.date
    return df[["date", "open", "high", "low", "close", "volume"]]


def ingest_ohlcv(
    symbol: str,
    start: str,
    end: str,
    vendor: str = "yfinance",
) -> tuple[pd.DataFrame | None, IngestionError | None]:
    """Ingest OHLCV data for *symbol* over [start, end].

    Returns (DataFrame, None) on success or (None, IngestionError) on failure.
    """
    # 1. Structural symbol validation
    err = validate_symbol(symbol)
    if err is not None:
        return None, err

    # 2. Fetch from vendor
    try:
        df = _fetch_yfinance(symbol, start, end)
    except Exception as exc:
        return None, IngestionError(
            code="VENDOR_ERROR",
            message=f"Vendor '{vendor}' failed: {exc}",
            symbol=symbol,
        )

    # 3. Schema validation
    err = validate_dataframe(df, symbol)
    if err is not None:
        return None, err

    # 4. Gap validation
    err = validate_no_gaps(df, symbol)
    if err is not None:
        return None, err

    return df, None
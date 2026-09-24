"""Public API for the dataflows domain – single entry point."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd
from sqlalchemy.orm import Session

from app.dataflows.events import emit
from app.dataflows.ingestion import ingest_ohlcv
from app.dataflows.models import (
    DataValidationFailed,
    IngestionResult,
    OHLCVRecord,
)
from app.dataflows.persistence import persist_ohlcv


def get_stock_data(
    symbol: str,
    start: str,
    end: str,
    vendor: str = "yfinance",
    session: Session | None = None,
) -> IngestionResult:
    """Fetch, validate, and optionally persist OHLCV data for *symbol*.

    Parameters
    ----------
    symbol : str
        Ticker symbol (e.g. "AAPL").
    start : str
        ISO date string, e.g. "2024-01-01".
    end : str
        ISO date string, e.g. "2024-12-31".
    vendor : str
        Data vendor name; currently only "yfinance" is supported.
    session : Session | None
        SQLAlchemy session for persistence.  When provided, records are
        upserted into ``market_data_ohlcv``.

    Returns
    -------
    IngestionResult
        On success: status="ok", records populated.
        On failure: status="error", error populated, events populated.
    """
    df, error = ingest_ohlcv(symbol, start, end, vendor=vendor)

    if error is not None:
        event = DataValidationFailed(
            symbol=symbol,
            reason=error.message,
        )
        emit(event)
        return IngestionResult(status="error", error=error, events=[event])

    # Convert DataFrame → list[OHLCVRecord]
    records: list[OHLCVRecord] = []
    for row in df.itertuples(index=False):
        records.append(
            OHLCVRecord(
                symbol=symbol,
                date=row.date,
                open=Decimal(str(row.open)),
                high=Decimal(str(row.high)),
                low=Decimal(str(row.low)),
                close=Decimal(str(row.close)),
                volume=int(row.volume),
            )
        )

    # Persist if a session is supplied
    if session is not None:
        persist_ohlcv(session, records)

    return IngestionResult(status="ok", records=records)
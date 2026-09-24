"""Persistence layer for OHLCV records (SQLAlchemy 2 session-based)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.dataflows.models import OHLCVRecord
from app.dataflows.orm_models import MarketDataOHLCV


def persist_ohlcv(
    session: Session,
    records: list[OHLCVRecord],
) -> int:
    """Upsert *records* into ``market_data_ohlcv``.

    Returns the number of rows written (inserted or updated).
    """
    for rec in records:
        stmt = select(MarketDataOHLCV).where(
            MarketDataOHLCV.symbol == rec.symbol,
            MarketDataOHLCV.date == rec.date,
        )
        existing = session.execute(stmt).scalar_one_or_none()

        if existing is not None:
            existing.open = rec.open
            existing.high = rec.high
            existing.low = rec.low
            existing.close = rec.close
            existing.volume = rec.volume
        else:
            session.add(
                MarketDataOHLCV(
                    symbol=rec.symbol,
                    date=rec.date,
                    open=rec.open,
                    high=rec.high,
                    low=rec.low,
                    close=rec.close,
                    volume=rec.volume,
                )
            )
    session.flush()
    return len(records)


def fetch_ohlcv(
    session: Session,
    symbol: str,
    start_date: date,
    end_date: date,
) -> list[MarketDataOHLCV]:
    """Return persisted OHLCV rows for *symbol* within [start, end]."""
    stmt = (
        select(MarketDataOHLCV)
        .where(
            MarketDataOHLCV.symbol == symbol,
            MarketDataOHLCV.date >= start_date,
            MarketDataOHLCV.date <= end_date,
        )
        .order_by(MarketDataOHLCV.date)
    )
    return list(session.execute(stmt).scalars().all())
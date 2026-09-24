"""SQLAlchemy 2 ORM models for the market_data_ohlcv table."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base for dataflows ORM models."""


class MarketDataOHLCV(Base):
    """Row in the ``market_data_ohlcv`` table.

    Primary key: (symbol, date).
    """

    __tablename__ = "market_data_ohlcv"
    __table_args__ = (
        UniqueConstraint("symbol", "date", name="uq_symbol_date"),
    )

    symbol: Mapped[str] = mapped_column(
        String(20), primary_key=True, default=None,
    )
    date: Mapped[date] = mapped_column(
        Date, primary_key=True, default=None,
    )
    open: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=None)
    high: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=None)
    low: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=None)
    close: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=None)
    volume: Mapped[int] = mapped_column(Integer, default=None)
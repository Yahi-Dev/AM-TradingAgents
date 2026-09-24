"""Pydantic v2 data models for the OHLCV dataflows domain."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class OHLCVRecord(BaseModel):
    """Single OHLCV bar for one symbol on one trading day."""

    symbol: str = Field(min_length=1, max_length=20)
    date: date
    open: Decimal = Field(ge=0)
    high: Decimal = Field(ge=0)
    low: Decimal = Field(ge=0)
    close: Decimal = Field(ge=0)
    volume: int = Field(ge=0)


class IngestionError(BaseModel):
    """Structured error returned when ingestion fails (AC-02)."""

    code: str
    message: str
    symbol: str
    detail: str | None = None


class DataValidationFailed(BaseModel):
    """Event payload emitted when symbol/data validation fails (AC-02)."""

    event_type: Literal["DataValidationFailed"] = "DataValidationFailed"
    symbol: str
    reason: str
    correlation_id: str | None = None
    run_id: str | None = None


class IngestionResult(BaseModel):
    """Discriminated result: either success (records) or structured error."""

    status: Literal["ok", "error"]
    records: list[OHLCVRecord] | None = None
    error: IngestionError | None = None
    events: list[DataValidationFailed] = Field(default_factory=list)
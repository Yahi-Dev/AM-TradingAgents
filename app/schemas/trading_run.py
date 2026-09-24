"""Pydantic v2 schemas for TradingRun API I/O."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TradingRunCreate(BaseModel):
    """Request body for POST /api/v1/runs."""

    symbol: str = Field(min_length=1, max_length=20)
    mode: Literal["PAPER", "BACKTEST", "SHADOW", "LIVE"] = "PAPER"


class TradingRunResponse(BaseModel):
    """Response body for a TradingRun."""

    run_id: str
    symbol: str
    mode: str
    status: str
    correlation_id: str
    tenant_id: str
    started_at: datetime
    completed_at: datetime | None = None
    config_snapshot: dict = Field(default_factory=dict)
    error_message: str | None = None
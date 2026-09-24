"""Pydantic v2 schemas for TradeIntent contract."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class TradeIntentSchema(BaseModel):
    """Strict contract: output of the agentic brain toward Risk Engine.

    This is the pivotal contract between agents and execution.
    """

    action: Literal["BUY", "SELL", "SELL_SHORT", "BUY_TO_COVER", "HOLD"]
    confidence: float = Field(ge=0.0, le=1.0)
    entry_price_target: Decimal | None = Field(default=None, gt=0)
    stop_loss: Decimal | None = Field(default=None, gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)
    rationale: str = Field(default="", min_length=0)
    position_size_pct: float | None = Field(default=None, ge=0.0, le=100.0)
    time_horizon: Literal["intraday", "swing", "position"] = "intraday"

    @model_validator(mode="after")
    def validate_price_consistency(self) -> "TradeIntentSchema":
        """Ensure stop_loss < entry < take_profit when all present."""
        if (
            self.entry_price_target is not None
            and self.stop_loss is not None
            and self.take_profit is not None
        ):
            if self.stop_loss >= self.entry_price_target:
                raise ValueError("stop_loss must be less than entry_price_target")
            if self.take_profit <= self.entry_price_target:
                raise ValueError("take_profit must be greater than entry_price_target")
        return self


class TradeIntentCreate(TradeIntentSchema):
    """Schema for creating a TradeIntent (includes run context)."""

    run_id: str
    symbol: str = Field(min_length=1, max_length=20)
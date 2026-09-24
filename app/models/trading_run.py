"""SQLAlchemy 2 ORM models for TradingRun and TradeIntent."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import IntentAction, RunStatus, TimeHorizon, TradingMode


class TradingRun(Base):
    """Aggregate root representing one full agentic pipeline execution."""

    __tablename__ = "trading_runs"

    run_id: Mapped[str] = mapped_column(
        Uuid, primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=RunStatus.PENDING)
    correlation_id: Mapped[str] = mapped_column(
        Uuid, nullable=False, unique=True, index=True
    )
    tenant_id: Mapped[str] = mapped_column(Uuid, nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    config_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    trade_intent: Mapped["TradeIntent | None"] = relationship(
        back_populates="trading_run", uselist=False
    )

    def __init__(
        self,
        *,
        symbol: str,
        mode: TradingMode,
        tenant_id: str,
        correlation_id: str,
        config_snapshot: dict | None = None,
    ) -> None:
        self.symbol = symbol
        self.mode = mode.value if isinstance(mode, TradingMode) else mode
        self.tenant_id = tenant_id
        self.correlation_id = correlation_id
        self.config_snapshot = config_snapshot or {}
        self.status = RunStatus.PENDING
        self.started_at = datetime.utcnow()
        self.completed_at = None
        self.error_message = None


class TradeIntent(Base):
    """Contract entity: output of the agentic brain toward Risk Engine."""

    __tablename__ = "trade_intents"

    intent_id: Mapped[str] = mapped_column(
        Uuid, primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    run_id: Mapped[str] = mapped_column(
        Uuid, ForeignKey("trading_runs.run_id"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False, default="")
    confidence: Mapped[float] = mapped_column(Numeric(4, 4), nullable=False)
    entry_price_target: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    take_profit: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    position_size_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    time_horizon: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    trading_run: Mapped["TradingRun"] = relationship(back_populates="trade_intent")

    def __init__(
        self,
        *,
        run_id: str,
        symbol: str,
        action: IntentAction,
        confidence: float,
        entry_price_target: Decimal | None,
        stop_loss: Decimal | None,
        take_profit: Decimal | None,
        rationale: str = "",
        position_size_pct: float | None = None,
        time_horizon: TimeHorizon = TimeHorizon.INTRADAY,
    ) -> None:
        self.run_id = run_id
        self.symbol = symbol
        self.action = action.value if isinstance(action, IntentAction) else action
        self.confidence = confidence
        self.entry_price_target = entry_price_target
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.rationale = rationale
        self.position_size_pct = position_size_pct
        self.time_horizon = time_horizon.value if isinstance(time_horizon, TimeHorizon) else time_horizon
        self.created_at = datetime.utcnow()
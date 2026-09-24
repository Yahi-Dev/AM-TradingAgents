"""Domain events for TradingRun lifecycle."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


@dataclass(frozen=True)
class DomainEvent:
    """Base domain event carrying traceability identifiers."""

    event_id: str = field(default_factory=lambda: str(uuid4()))
    correlation_id: str = ""
    run_id: str = ""
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class TradingRunStarted(DomainEvent):
    """Emitted when a TradingRun transitions to RUNNING."""

    symbol: str = ""
    mode: str = ""


@dataclass(frozen=True)
class TradingRunCompleted(DomainEvent):
    """Emitted when a TradingRun reaches COMPLETED status."""

    symbol: str = ""


@dataclass(frozen=True)
class TradingRunFailed(DomainEvent):
    """Emitted when a TradingRun encounters an unrecoverable error."""

    error_message: str = ""


@dataclass(frozen=True)
class TradeIntentCreated(DomainEvent):
    """Emitted when a TradeIntent is persisted for a run."""

    action: str = ""
    confidence: float = 0.0
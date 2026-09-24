"""Service orchestrating TradingRun lifecycle and TradeIntent persistence."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.trading_run_events import (
    TradeIntentCreated,
    TradingRunCompleted,
    TradingRunFailed,
    TradingRunStarted,
)
from app.models.enums import RunStatus, TradingMode
from app.models.trading_run import TradeIntent, TradingRun
from app.schemas.trade_intent import TradeIntentCreate
from app.schemas.trading_run import TradingRunCreate


class TradingRunService:
    """Orchestrates the full lifecycle of a TradingRun.

    Responsibilities:
    - Create and persist a new TradingRun (status PENDING).
    - Transition to RUNNING, COMPLETED, or FAILED.
    - Persist TradeIntent on successful completion.
    - Emit domain events with correlation_id + run_id.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_run(
        self,
        payload: TradingRunCreate,
        tenant_id: str,
    ) -> TradingRun:
        """Create a new TradingRun in PENDING status and persist it."""
        run = TradingRun(
            symbol=payload.symbol,
            mode=TradingMode(payload.mode),
            tenant_id=tenant_id,
            correlation_id=str(uuid4()),
            config_snapshot={"mode": payload.mode, "symbol": payload.symbol},
        )
        self._session.add(run)
        await self._session.flush()
        return run

    async def start_run(self, run: TradingRun) -> TradingRun:
        """Transition run to RUNNING and emit TradingRunStarted."""
        run.status = RunStatus.RUNNING
        await self._session.flush()
        event = TradingRunStarted(
            correlation_id=run.correlation_id,
            run_id=run.run_id,
            symbol=run.symbol,
            mode=run.mode,
        )
        self._emit_event(event)
        return run

    async def complete_run(self, run: TradingRun) -> TradingRun:
        """Transition run to COMPLETED and emit TradingRunCompleted."""
        run.status = RunStatus.COMPLETED
        run.completed_at = datetime.utcnow()
        await self._session.flush()
        event = TradingRunCompleted(
            correlation_id=run.correlation_id,
            run_id=run.run_id,
            symbol=run.symbol,
        )
        self._emit_event(event)
        return run

    async def fail_run(self, run: TradingRun, error_message: str) -> TradingRun:
        """Transition run to FAILED and emit TradingRunFailed.

        No orders are created in this path.
        """
        run.status = RunStatus.FAILED
        run.completed_at = datetime.utcnow()
        run.error_message = error_message
        await self._session.flush()
        event = TradingRunFailed(
            correlation_id=run.correlation_id,
            run_id=run.run_id,
            error_message=error_message,
        )
        self._emit_event(event)
        return run

    async def persist_trade_intent(
        self,
        run: TradingRun,
        intent_payload: TradeIntentCreate,
    ) -> TradeIntent:
        """Persist a TradeIntent for a completed run and emit TradeIntentCreated."""
        intent = TradeIntent(
            run_id=run.run_id,
            symbol=intent_payload.symbol,
            action=intent_payload.action,
            confidence=intent_payload.confidence,
            entry_price_target=intent_payload.entry_price_target,
            stop_loss=intent_payload.stop_loss,
            take_profit=intent_payload.take_profit,
            rationale=intent_payload.rationale,
            position_size_pct=intent_payload.position_size_pct,
            time_horizon=intent_payload.time_horizon,
        )
        self._session.add(intent)
        await self._session.flush()
        event = TradeIntentCreated(
            correlation_id=run.correlation_id,
            run_id=run.run_id,
            action=intent_payload.action,
            confidence=intent_payload.confidence,
        )
        self._emit_event(event)
        return intent

    def _emit_event(self, event: DomainEvent) -> None:
        """Emit a domain event (hook for event bus / outbox).

        In production this would publish to an event bus.
        Here we keep it as a no-op hook for testability.
        """
        # Production: publish to event bus / outbox table.
        # For now, this is a no-op that can be overridden in tests.
        pass

    async def get_run(self, run_id: str) -> TradingRun | None:
        """Fetch a TradingRun by its primary key."""
        stmt = select(TradingRun).where(TradingRun.run_id == run_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
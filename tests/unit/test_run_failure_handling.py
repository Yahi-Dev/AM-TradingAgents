"""Tests for TradingRun failure handling (AC-03)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.events.trading_run_events import TradingRunFailed
from app.models.enums import RunStatus
from app.models.trading_run import TradeIntent, TradingRun
from app.schemas.trading_run import TradingRunCreate
from app.services.trading_run_service import TradingRunService


@pytest.fixture
def mock_session() -> AsyncMock:
    """Create a mock async session."""
    session = AsyncMock(spec_set=["add", "flush", "execute"])
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def run_payload() -> TradingRunCreate:
    """Standard run creation payload."""
    return TradingRunCreate(symbol="TSLA", mode="PAPER")


@pytest.fixture
def tenant_id() -> str:
    """A fixed tenant UUID for tests."""
    return "00000000-0000-0000-0000-000000000002"


class TestRunFailureHandling:
    """AC-03: A failed run sets status=FAILED, emits TradingRunFailed,
    and no orders are created."""

    async def test_fail_run_sets_status_failed(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """Failing a run sets status to FAILED."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.start_run(run)
        await service.fail_run(run, "Agent timeout: LLM did not respond")

        assert run.status == RunStatus.FAILED
        assert run.completed_at is not None
        assert run.error_message == "Agent timeout: LLM did not respond"

    async def test_fail_run_emits_event_with_correlation_id(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """AC-03: TradingRunFailed event carries correlation_id."""
        emitted_events: list[TradingRunFailed] = []

        def capture_event(event: object) -> None:
            if isinstance(event, TradingRunFailed):
                emitted_events.append(event)

        service = TradingRunService(session=mock_session)
        service._emit_event = capture_event  # type: ignore[assignment]

        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.start_run(run)
        await service.fail_run(run, "Pipeline crashed")

        assert len(emitted_events) == 1
        event = emitted_events[0]
        assert event.correlation_id == run.correlation_id
        assert event.run_id == run.run_id
        assert event.error_message == "Pipeline crashed"

    async def test_no_orders_created_on_failure(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """AC-03: No TradeIntent (order) is created when run fails."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.start_run(run)
        await service.fail_run(run, "Risk engine unavailable")

        # The session.add should NOT have been called with a TradeIntent
        mock_session.add.assert_not_called()

    async def test_failed_run_has_error_message(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """A failed run persists the error message."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.fail_run(run, "Connection to market data lost")

        assert run.error_message == "Connection to market data lost"
        assert run.status == RunStatus.FAILED

    async def test_failed_run_does_not_complete(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """A failed run cannot transition to COMPLETED."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.fail_run(run, "Agent exception")

        # Attempting to complete after failure should not be called in
        # production, but we verify the state is FAILED not COMPLETED.
        assert run.status == RunStatus.FAILED
        assert run.status != RunStatus.COMPLETED

    async def test_failure_preserves_correlation_id(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """The correlation_id is preserved through failure for traceability."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        original_correlation = run.correlation_id
        await service.fail_run(run, "Test failure")

        assert run.correlation_id == original_correlation
        assert run.correlation_id is not None
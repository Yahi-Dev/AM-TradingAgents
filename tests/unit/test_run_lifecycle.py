"""Tests for TradingRun lifecycle (AC-01, AC-02)."""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.enums import IntentAction, RunStatus, TimeHorizon, TradingMode
from app.models.trading_run import TradeIntent, TradingRun
from app.schemas.trade_intent import TradeIntentCreate
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
    return TradingRunCreate(symbol="AAPL", mode="PAPER")


@pytest.fixture
def tenant_id() -> str:
    """A fixed tenant UUID for tests."""
    return "00000000-0000-0000-0000-000000000001"


class TestRunLifecycle:
    """AC-01: POST /api/v1/runs creates TradingRun with correct fields."""

    async def test_create_run_persists_pending_status(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """Creating a run results in status=PENDING with all required fields."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)

        assert run.status == RunStatus.PENDING
        assert run.run_id is not None
        assert run.correlation_id is not None
        assert run.tenant_id == tenant_id
        assert run.mode == "PAPER"
        assert run.symbol == "AAPL"
        assert run.started_at is not None
        assert run.completed_at is None

    async def test_create_run_has_unique_correlation_id(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """Each run gets a unique correlation_id."""
        service = TradingRunService(session=mock_session)
        run1 = await service.create_run(run_payload, tenant_id=tenant_id)
        run2 = await service.create_run(run_payload, tenant_id=tenant_id)
        assert run1.correlation_id != run2.correlation_id

    async def test_run_transitions_to_running(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """Starting a run transitions status to RUNNING."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.start_run(run)
        assert run.status == RunStatus.RUNNING

    async def test_run_transitions_to_completed(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """Completing a run sets status to COMPLETED and completed_at."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.start_run(run)
        await service.complete_run(run)
        assert run.status == RunStatus.COMPLETED
        assert run.completed_at is not None

    async def test_trade_intent_persisted_on_completion(
        self, mock_session, run_payload, tenant_id
    ) -> None:
        """AC-02: A completed run can persist a TradeIntent with full contract."""
        service = TradingRunService(session=mock_session)
        run = await service.create_run(run_payload, tenant_id=tenant_id)
        await service.start_run(run)
        await service.complete_run(run)

        intent_payload = TradeIntentCreate(
            run_id=run.run_id,
            symbol="AAPL",
            action="BUY",
            confidence=0.85,
            entry_price_target=Decimal("150.00"),
            stop_loss=Decimal("145.00"),
            take_profit=Decimal("160.00"),
            rationale="Momentum breakout with volume confirmation",
            position_size_pct=5.0,
            time_horizon="swing",
        )
        intent = await service.persist_trade_intent(run, intent_payload)

        assert intent.action == "BUY"
        assert intent.confidence == 0.85
        assert intent.entry_price_target == Decimal("150.00")
        assert intent.stop_loss == Decimal("145.00")
        assert intent.take_profit == Decimal("160.00")
        assert intent.rationale == "Momentum breakout with volume confirmation"
        assert intent.position_size_pct == 5.0
        assert intent.time_horizon == "swing"
        assert intent.run_id == run.run_id
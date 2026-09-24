"""Tests for TradeIntent Pydantic schema contract (AC-02)."""

import pytest
from decimal import Decimal

from pydantic import ValidationError

from app.schemas.trade_intent import TradeIntentCreate, TradeIntentSchema


class TestTradeIntentSchema:
    """AC-02: TradeIntent must validate all contract fields strictly."""

    def test_valid_intent_all_fields(self) -> None:
        """A fully-populated TradeIntent passes validation."""
        intent = TradeIntentSchema(
            action="BUY",
            confidence=0.92,
            entry_price_target=Decimal("155.50"),
            stop_loss=Decimal("150.00"),
            take_profit=Decimal("165.00"),
            rationale="Bullish divergence on RSI",
            position_size_pct=10.0,
            time_horizon="position",
        )
        assert intent.action == "BUY"
        assert intent.confidence == 0.92
        assert intent.entry_price_target == Decimal("155.50")

    def test_confidence_bounds(self) -> None:
        """Confidence must be in [0.0, 1.0]."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(action="BUY", confidence=1.5)
        with pytest.raises(ValidationError):
            TradeIntentSchema(action="BUY", confidence=-0.1)

    def test_confidence_zero_is_valid(self) -> None:
        """Confidence of 0.0 is allowed (minimum)."""
        intent = TradeIntentSchema(action="HOLD", confidence=0.0)
        assert intent.confidence == 0.0

    def test_confidence_one_is_valid(self) -> None:
        """Confidence of 1.0 is allowed (maximum)."""
        intent = TradeIntentSchema(action="SELL", confidence=1.0)
        assert intent.confidence == 1.0

    def test_invalid_action_rejected(self) -> None:
        """Action must be one of the five enum values."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(action="TRADE", confidence=0.5)

    def test_valid_actions(self) -> None:
        """All five actions are accepted."""
        for action in ["BUY", "SELL", "SELL_SHORT", "BUY_TO_COVER", "HOLD"]:
            intent = TradeIntentSchema(action=action, confidence=0.5)
            assert intent.action == action

    def test_entry_price_must_be_positive(self) -> None:
        """entry_price_target must be > 0 when provided."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(
                action="BUY",
                confidence=0.5,
                entry_price_target=Decimal("-1"),
            )

    def test_stop_loss_must_be_positive(self) -> None:
        """stop_loss must be > 0 when provided."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(
                action="BUY",
                confidence=0.5,
                stop_loss=Decimal("-5"),
            )

    def test_take_profit_must_be_positive(self) -> None:
        """take_profit must be > 0 when provided."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(
                action="BUY",
                confidence=0.5,
                take_profit=Decimal("-10"),
            )

    def test_price_consistency_stop_below_entry(self) -> None:
        """stop_loss must be < entry_price_target."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(
                action="BUY",
                confidence=0.5,
                entry_price_target=Decimal("100"),
                stop_loss=Decimal("110"),
                take_profit=Decimal("120"),
            )

    def test_price_consistency_tp_above_entry(self) -> None:
        """take_profit must be > entry_price_target."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(
                action="BUY",
                confidence=0.5,
                entry_price_target=Decimal("100"),
                stop_loss=Decimal("90"),
                take_profit=Decimal("95"),
            )

    def test_valid_price_consistency(self) -> None:
        """A consistent set of prices passes validation."""
        intent = TradeIntentSchema(
            action="BUY",
            confidence=0.5,
            entry_price_target=Decimal("100"),
            stop_loss=Decimal("95"),
            take_profit=Decimal("110"),
        )
        assert intent.entry_price_target == Decimal("100")

    def test_position_size_bounds(self) -> None:
        """position_size_pct must be in [0, 100]."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(action="BUY", confidence=0.5, position_size_pct=150.0)
        with pytest.raises(ValidationError):
            TradeIntentSchema(action="BUY", confidence=0.5, position_size_pct=-1.0)

    def test_valid_position_size(self) -> None:
        """position_size_pct of 0 and 100 are valid."""
        assert TradeIntentSchema(action="HOLD", confidence=0.5, position_size_pct=0.0)
        assert TradeIntentSchema(action="BUY", confidence=0.5, position_size_pct=100.0)

    def test_time_horizon_valid_values(self) -> None:
        """Only intraday, swing, position are accepted."""
        for hz in ["intraday", "swing", "position"]:
            intent = TradeIntentSchema(action="HOLD", confidence=0.5, time_horizon=hz)
            assert intent.time_horizon == hz

    def test_invalid_time_horizon_rejected(self) -> None:
        """An unknown time_horizon is rejected."""
        with pytest.raises(ValidationError):
            TradeIntentSchema(action="HOLD", confidence=0.5, time_horizon="weekly")

    def test_none_prices_allowed(self) -> None:
        """entry_price_target, stop_loss, take_profit can be None."""
        intent = TradeIntentSchema(
            action="HOLD",
            confidence=0.3,
            entry_price_target=None,
            stop_loss=None,
            take_profit=None,
        )
        assert intent.entry_price_target is None
        assert intent.stop_loss is None
        assert intent.take_profit is None

    def test_trade_intent_create_requires_run_and_symbol(self) -> None:
        """TradeIntentCreate requires run_id and symbol."""
        with pytest.raises(ValidationError):
            TradeIntentCreate(
                action="BUY",
                confidence=0.5,
                entry_price_target=None,
                stop_loss=None,
                take_profit=None,
            )
        intent = TradeIntentCreate(
            run_id="some-uuid",
            symbol="MSFT",
            action="BUY",
            confidence=0.7,
            entry_price_target=Decimal("300"),
            stop_loss=Decimal("280"),
            take_profit=Decimal("320"),
        )
        assert intent.run_id == "some-uuid"
        assert intent.symbol == "MSFT"
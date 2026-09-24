"""AC-02 – Invalid symbol returns structured error + DataValidationFailed event."""

from __future__ import annotations

from unittest.mock import patch

from app.dataflows.api import get_stock_data
from app.dataflows.events import EventBus


def test_ohlcv_invalid_symbol_returns_structured_error() -> None:
    """GIVEN an invalid symbol 'XXXX999'
    WHEN the ingestion function is called
    THEN it returns a structured error (not an unhandled exception)
    AND emits a DataValidationFailed event.
    """
    bus = EventBus()
    captured: list[object] = []
    bus.subscribe(lambda e: captured.append(e))

    with patch("app.dataflows.events._default_bus", bus):
        result = get_stock_data("XXXX999", "2024-01-01", "2024-12-31", vendor="yfinance")

    assert result.status == "error"
    assert result.error is not None
    assert result.error.code == "INVALID_SYMBOL"
    assert result.error.symbol == "XXXX999"
    assert result.records is None

    # Event was emitted
    assert len(captured) == 1
    event = captured[0]
    assert event.event_type == "DataValidationFailed"
    assert event.symbol == "XXXX999"


def test_ohlcv_invalid_symbol_no_exception_raised() -> None:
    """The function must NOT raise; it must return a structured result."""
    try:
        result = get_stock_data("XXXX999", "2024-01-01", "2024-12-31", vendor="yfinance")
    except Exception:
        pytest.fail("get_stock_data raised an unhandled exception")
    assert result.status == "error"
    assert result.error is not None


def test_ohlcv_invalid_symbol_event_carries_reason() -> None:
    """The DataValidationFailed event must carry a human-readable reason."""
    bus = EventBus()
    captured: list[object] = []
    bus.subscribe(lambda e: captured.append(e))

    with patch("app.dataflows.events._default_bus", bus):
        result = get_stock_data("XXXX999", "2024-01-01", "2024-12-31", vendor="yfinance")

    assert result.status == "error"
    assert len(captured) == 1
    assert isinstance(captured[0].reason, str)
    assert len(captured[0].reason) > 0
"""Enumerations for trading domain."""

from enum import StrEnum


class RunStatus(StrEnum):
    """Lifecycle status of a TradingRun."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TradingMode(StrEnum):
    """Execution mode for a trading run."""

    PAPER = "PAPER"
    BACKTEST = "BACKTEST"
    SHADOW = "SHADOW"
    LIVE = "LIVE"


class IntentAction(StrEnum):
    """Action encoded in a TradeIntent."""

    BUY = "BUY"
    SELL = "SELL"
    SELL_SHORT = "SELL_SHORT"
    BUY_TO_COVER = "BUY_TO_COVER"
    HOLD = "HOLD"


class TimeHorizon(StrEnum):
    """Time horizon classification for a trade intent."""

    INTRADAY = "intraday"
    SWING = "swing"
    POSITION = "position"
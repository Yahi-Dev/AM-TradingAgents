"""Lightweight in-process event bus for dataflows domain events."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.dataflows.models import DataValidationFailed


class EventBus:
    """Minimal pub/sub bus; listeners receive typed event payloads."""

    def __init__(self) -> None:
        self._listeners: list[Callable[..., None]] = []

    def subscribe(self, handler: Callable[..., None]) -> None:
        """Register a handler for all events."""
        self._listeners.append(handler)

    def publish(self, event: DataValidationFailed) -> None:
        """Dispatch *event* to every registered listener."""
        for handler in self._listeners:
            handler(event)


# Module-level default bus (replace via DI in production).
_default_bus: EventBus = EventBus()


def get_event_bus() -> EventBus:
    """Return the module-level default event bus."""
    return _default_bus


def set_event_bus(bus: EventBus) -> None:
    """Override the module-level event bus (for DI / testing)."""
    global _default_bus
    _default_bus = bus


def emit(event: DataValidationFailed) -> None:
    """Convenience: publish *event* on the default bus."""
    _default_bus.publish(event)
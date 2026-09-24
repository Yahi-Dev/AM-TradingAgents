"""Dataflows package – OHLCV ingestion and persistence."""

from app.dataflows.api import get_stock_data

__all__ = ["get_stock_data"]
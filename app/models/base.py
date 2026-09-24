"""Base model utilities for AM-TradingAgents."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    metadata = MetaData()


def new_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid4())


def utcnow() -> datetime:
    """Return current UTC timestamp."""
    return datetime.utcnow()
"""SQLAlchemy 2 ORM models for the initial schema."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tenant(Base):
    """A tenant (organisation) that owns users and trading runs."""

    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )

    users: Mapped[list[User]] = relationship(
        "User", back_populates="tenant", lazy="selectin",
    )
    trading_runs: Mapped[list[TradingRun]] = relationship(
        "TradingRun", back_populates="tenant", lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Tenant {self.name}>"


class User(Base):
    """A user belonging to a tenant."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), nullable=False, index=True,
    )
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False,
    )
    display_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="viewer",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )

    tenant: Mapped[Tenant] = relationship(
        "Tenant", back_populates="users",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.email}>"


class TradingRun(Base):
    """A single execution of the agentic trading pipeline."""

    __tablename__ = "trading_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), nullable=False, index=True,
    )
    symbol: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True,
    )
    mode: Mapped[str] = mapped_column(
        String(16), nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    config_snapshot: Mapped[dict] = mapped_column(
        JSON, nullable=False, server_default="{}",
    )
    correlation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )

    tenant: Mapped[Tenant] = relationship(
        "Tenant", back_populates="trading_runs",
    )
    analyst_reports: Mapped[list[AnalystReport]] = relationship(
        "AnalystReport", back_populates="run", lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TradingRun {self.symbol} {self.status}>"


class AnalystReport(Base):
    """A report produced by one analyst agent within a trading run."""

    __tablename__ = "analyst_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("trading_runs.id"), nullable=False, index=True,
    )
    analyst_name: Mapped[str] = mapped_column(
        String(128), nullable=False,
    )
    report_content: Mapped[str] = mapped_column(
        Text, nullable=False,
    )
    sentiment: Mapped[str] = mapped_column(
        String(16), nullable=False,
    )
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )

    run: Mapped[TradingRun] = relationship(
        "TradingRun", back_populates="analyst_reports",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AnalystReport {self.analyst_name}>"
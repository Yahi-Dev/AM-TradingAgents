"""Alembic environment configuration for AM-TradingAgents."""

from __future__ import annotations

import os
from logging import config as logging_config
from urllib.parse import quote_plus

from alembic import context
from sqlalchemy import engine, pool

from app.db.base import Base
from app.db.models import (  # noqa: F401  – ensure models are registered
    AnalystReport,
    Tenant,
    TradingRun,
    User,
)

target_metadata = Base.metadata


def _build_url() -> str:
    """Build the database URL from environment variables."""
    user = os.environ.get("DB_USER", "amtrading")
    password = os.environ.get("DB_PASSWORD", "amtrading")
    host = os.environ.get("DB_HOST", "localhost")
    port = os.environ.get("DB_PORT", "5432")
    dbname = os.environ.get("DB_NAME", "amtrading")
    return (
        f"postgresql+psycopg://{user}:{quote_plus(password)}"
        f"@{host}:{port}/{dbname}"
    )


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection)."""
    url = context.config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"default_paramstyle": "named"},
        compare_type=True,
        compare_servers=True,
    )
    context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (live DB connection)."""
    url = _build_url()
    connectable = engine.url.resolve(
        str(url),
    )
    context.configure(
        url=url,
        target_metadata=target_metadata,
        connectable=connectable,
        poolclass=pool.NullPool,
        compare_type=True,
        compare_servers=True,
    )
    context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
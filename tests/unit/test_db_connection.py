"""Tests for database connectivity (AC-01)."""

from __future__ import annotations

import sqlalchemy
from sqlalchemy import text

from app.db.config import DatabaseSettings
from app.db.session import create_engine_from_settings


class TestDbConnection:
    """Verify that PostgreSQL is reachable and the database exists."""

    def test_connection_succeeds(
        self,
        db_settings: DatabaseSettings,
        db_ready: None,
    ) -> None:
        """AC-01: GIVEN docker-compose up WHEN PostgreSQL arranca
        THEN la DB 'amtrading' está disponible en localhost:5432."""
        engine = create_engine_from_settings(db_settings)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
        engine.dispose()

    def test_database_name_matches(
        self,
        db_settings: DatabaseSettings,
        db_ready: None,
    ) -> None:
        """Verify the connected database is named 'amtrading'."""
        engine = create_engine_from_settings(db_settings)
        with engine.connect() as conn:
            row = conn.execute(text("SELECT current_database()")).scalar()
            assert row == db_settings.dbname
        engine.dispose()

    def test_postgres_version_at_least_15(
        self,
        db_settings: DatabaseSettings,
        db_ready: None,
    ) -> None:
        """Sanity-check that we are on PostgreSQL >= 15."""
        engine = create_engine_from_settings(db_settings)
        with engine.connect() as conn:
            version = conn.execute(text("SHOW server_version")).scalar()
        engine.dispose()
        major = int(version.split(".")[0])
        assert major >= 15
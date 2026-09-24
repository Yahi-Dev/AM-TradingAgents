"""Tests for Alembic migrations up/down (AC-02, AC-03)."""

from __future__ import annotations

import sqlalchemy
from sqlalchemy import text

from app.db.config import DatabaseSettings


EXPECTED_TABLES = frozenset(
    {
        "tenants",
        "users",
        "trading_runs",
        "analyst_reports",
    }
)


def _fetch_tables(engine: sqlalchemy.engine.Engine) -> set[str]:
    """Return the set of table names in the public schema."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT tablename FROM pg_catalog.pg_stat_user_tables "
                "WHERE schemaname = 'public'"
            )
        )
        return {row[0] for row in rows}


class TestMigrations:
    """Verify that Alembic migrations are applied and reversible."""

    def test_upgrade_head_creates_all_tables(
        self,
        db_engine: sqlalchemy.engine.Engine,
        db_ready: None,
        migrated: None,
    ) -> None:
        """AC-02: GIVEN la migración inicial
        WHEN alembic upgrade head
        THEN se crean las tablas: tenants, users, trading_runs, analyst_reports."""
        tables = _fetch_tables(db_engine)
        assert EXPECTED_TABLES.issubset(tables)

    def test_tables_have_expected_columns(
        self,
        db_engine: sqlalchemy.engine.Engine,
        db_ready: None,
        migrated: None,
    ) -> None:
        """Verify each table has its primary key column."""
        with db_engine.connect() as conn:
            for table in EXPECTED_TABLES:
                cols = conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        f"WHERE table_name = '{table}'"
                    )
                ).scalars()
                col_set = set(cols)
                assert "id" in col_set, f"Table '{table}' missing 'id' column"

    def test_downgrade_reverses_migration(
        self,
        db_engine: sqlalchemy.engine.Engine,
        db_ready: None,
        migrated: None,
        alembic_config: "AlembicConfig",
    ) -> None:
        """AC-03: GIVEN una nueva migración
        WHEN alembic downgrade -1
        THEN la migración se revierte sin error."""
        from alembic import command

        # We are already at head (from the `migrated` fixture).
        # Downgrade one step.
        command.downgrade(alembic_config, "-1")

        tables = _fetch_tables(db_engine)
        assert not EXPECTED_TABLES.intersection(tables)

        # Re-apply so the session-scoped fixture teardown (downgrade to base)
        # does not leave the DB in a broken state for other tests.
        command.upgrade(alembic_config, "head")

    def test_alembic_version_table_exists(
        self,
        db_engine: sqlalchemy.engine.Engine,
        db_ready: None,
        migrated: None,
    ) -> None:
        """The alembic_version bookkeeping table must exist after upgrade."""
        tables = _fetch_tables(db_engine)
        assert "alembic_version" in tables
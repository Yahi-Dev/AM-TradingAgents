"""Initial tables: tenants, users, trading_runs, analyst_reports.

Revision ID: 0001
Revises:
Create Date: 2025-01-01
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the initial schema."""
    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tenants_name", "tenants", ["name"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="viewer"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_users_tenant_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])

    op.create_table(
        "trading_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("config_snapshot", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("correlation_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], name="fk_trading_runs_tenant_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trading_runs_tenant_id", "trading_runs", ["tenant_id"])
    op.create_index("ix_trading_runs_symbol", "trading_runs", ["symbol"])
    op.create_index("ix_trading_runs_status", "trading_runs", ["status"])

    op.create_table(
        "analyst_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("analyst_name", sa.String(length=128), nullable=False),
        sa.Column("report_content", sa.Text(), nullable=False),
        sa.Column("sentiment", sa.String(length=16), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["run_id"], ["trading_runs.id"], name="fk_analyst_reports_run_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analyst_reports_run_id", "analyst_reports", ["run_id"])


def downgrade() -> None:
    """Drop the initial schema in reverse order."""
    op.drop_index("ix_analyst_reports_run_id")
    op.drop_table("analyst_reports")

    op.drop_index("ix_trading_runs_status")
    op.drop_index("ix_trading_runs_symbol")
    op.drop_index("ix_trading_runs_tenant_id")
    op.drop_table("trading_runs")

    op.drop_index("ix_users_tenant_id")
    op.drop_table("users")

    op.drop_index("ix_tenants_name")
    op.drop_table("tenants")
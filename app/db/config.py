"""Database configuration using Pydantic v2 settings."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DatabaseSettings(BaseModel):
    """Connection settings for the primary PostgreSQL database."""

    host: str = Field(default="localhost")
    port: int = Field(default=5432)
    user: str = Field(default="amtrading")
    password: str = Field(default="amtrading")
    dbname: str = Field(default="amtrading")

    @property
    def dsn(self) -> str:
        """Return the full DSN string."""
        return (
            f"postgresql+psycopg://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.dbname}"
        )

    @property
    def sqlalchemy_url(self) -> str:
        """Return the SQLAlchemy connection URL."""
        return self.dsn
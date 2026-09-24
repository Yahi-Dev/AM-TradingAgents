"""Structured error body schema."""

from __future__ import annotations

from pydantic import BaseModel


class ErrorBody(BaseModel):
    """Uniform error envelope for all 4xx/5xx responses."""

    code: str
    detail: str
    status_code: int
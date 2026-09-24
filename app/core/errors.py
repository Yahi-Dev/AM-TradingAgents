"""Structured error types and FastAPI exception handler."""

from __future__ import annotations

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.schemas.error import ErrorBody


class AppError(Exception):
    """Base application error carrying a structured body."""

    def __init__(self, status_code: int, detail: str, code: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.code = code


def app_error_handler(exc: AppError) -> JSONResponse:
    """Translate AppError into a JSONResponse with structured body."""
    body = ErrorBody(
        code=exc.code,
        detail=exc.detail,
        status_code=exc.status_code,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=body.model_dump(),
    )
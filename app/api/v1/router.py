"""Aggregate router for API v1."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.health import health_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
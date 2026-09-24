"""JWT auth dependency and middleware helpers."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings

_bearer_scheme = HTTPBearer(auto_error=False)


def require_auth(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer_scheme),
    ],
) -> str:
    """FastAPI dependency that validates a Bearer token.

    Raises 401 with a structured message when the token is missing
    or invalid.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid bearer token.",
        )
    try:
        payload: dict = jwt.decode(
            credentials.credentials,
            Settings().jwt_secret,
            algorithms=[Settings().jwt_algorithm],
        )
        return str(payload.get("sub", ""))
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {exc}",
        ) from exc
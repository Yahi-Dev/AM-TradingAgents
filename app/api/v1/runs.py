"""API router for TradingRun endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RunStatus
from app.schemas.trading_run import TradingRunCreate, TradingRunResponse
from app.services.trading_run_service import TradingRunService


router = APIRouter(prefix="/api/v1/runs", tags=["runs"])


def get_db_session() -> AsyncSession:
    """Dependency: yield an async DB session (wired in app wiring)."""
    raise NotImplementedError("Wire via FastAPI dependency injection.")


@router.post("", response_model=TradingRunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    payload: TradingRunCreate,
    tenant_id: str = Depends(lambda: "default-tenant"),
    db: AsyncSession = Depends(get_db_session),
) -> TradingRunResponse:
    """Create a new TradingRun in PENDING status.

    AC-01: POST /api/v1/runs with {"symbol": "AAPL", "mode": "paper"}
    persists a TradingRun with run_id, status=PENDING, correlation_id,
    tenant_id, and mode=PAPER.
    """
    service = TradingRunService(session=db)
    run = await service.create_run(payload, tenant_id=tenant_id)
    return TradingRunResponse(
        run_id=run.run_id,
        symbol=run.symbol,
        mode=run.mode,
        status=run.status,
        correlation_id=run.correlation_id,
        tenant_id=run.tenant_id,
        started_at=run.started_at,
        completed_at=run.completed_at,
        config_snapshot=run.config_snapshot,
        error_message=run.error_message,
    )


@router.get("/{run_id}", response_model=TradingRunResponse)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> TradingRunResponse:
    """Retrieve a TradingRun by its run_id."""
    service = TradingRunService(session=db)
    run = await service.get_run(run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TradingRun {run_id} not found",
        )
    return TradingRunResponse(
        run_id=run.run_id,
        symbol=run.symbol,
        mode=run.mode,
        status=run.status,
        correlation_id=run.correlation_id,
        tenant_id=run.tenant_id,
        started_at=run.started_at,
        completed_at=run.completed_at,
        config_snapshot=run.config_snapshot,
        error_message=run.error_message,
    )
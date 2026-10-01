"""System health check endpoint with active database ping."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_database_session

logger = logging.getLogger(__name__)

router = APIRouter(tags=["System Health"])


class HealthResponse(BaseModel):
    """Schema for health status output."""

    model_config = ConfigDict(str_strip_whitespace=True)

    status: Literal["healthy", "degraded"]
    database: Literal["connected", "unreachable"]
    application: str
    version: str


@router.get("/health", response_model=HealthResponse, summary="Check backend and database health")
def check_system_health(db: Session = Depends(get_database_session)) -> HealthResponse:
    """
    Verifies that the FastAPI server is online and executes a ping query
    against PostgreSQL to guarantee genuine database connectivity.
    """
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        logger.warning("Database ping failed during health check: %s", exc)
        db_status = "unreachable"

    overall_status = "healthy" if db_status == "connected" else "degraded"

    return HealthResponse(
        status=overall_status,
        database=db_status,
        application=settings.application_name,
        version=settings.application_version,
    )

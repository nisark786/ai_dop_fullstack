from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.cost import OpenAICostLogModel
from app.schemas.costs import (
    AgentCostBreakdown,
    CostInvocationsResponse,
    CostLogEntry,
    CostSummaryResponse,
)

router = APIRouter(prefix="/costs", tags=["Cost Monitoring"])


@router.get("/summary", response_model=CostSummaryResponse)
def get_cost_summary(
    days: Annotated[int, Query(ge=1, le=90)] = 7,
    db: Session = Depends(get_database_session),
) -> CostSummaryResponse:
    """Retrieve aggregate OpenAI cost and token usage metrics grouped by agent."""
    since_date = datetime.now(UTC) - timedelta(days=days)

    agent_stats = (
        db.query(
            OpenAICostLogModel.agent_name,
            func.count(OpenAICostLogModel.id).label("total_calls"),
            func.sum(OpenAICostLogModel.total_tokens).label("total_tokens"),
            func.sum(OpenAICostLogModel.cost_usd).label("total_cost_usd"),
        )
        .filter(OpenAICostLogModel.logged_at >= since_date)
        .group_by(OpenAICostLogModel.agent_name)
        .order_by(func.sum(OpenAICostLogModel.cost_usd).desc())
        .all()
    )

    breakdown = [
        AgentCostBreakdown(
            agent_name=row.agent_name,
            total_calls=int(row.total_calls or 0),
            total_tokens=int(row.total_tokens or 0),
            total_cost_usd=round(float(row.total_cost_usd or 0.0), 6),
        )
        for row in agent_stats
    ]

    total_cost = sum(item.total_cost_usd for item in breakdown)
    total_calls = sum(item.total_calls for item in breakdown)
    total_tokens = sum(item.total_tokens for item in breakdown)
    avg_cost = round(total_cost / total_calls, 6) if total_calls > 0 else 0.0

    return CostSummaryResponse(
        total_cost_usd=round(total_cost, 6),
        total_calls=total_calls,
        total_tokens=total_tokens,
        avg_cost_per_call_usd=avg_cost,
        agent_breakdown=breakdown,
        period_label=f"Last {days} days",
    )


@router.get("/invocations", response_model=CostInvocationsResponse)
def get_cost_invocations(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=5, le=100)] = 20,
    agent_name: Annotated[str | None, Query(max_length=100)] = None,
    batch_id: Annotated[str | None, Query(max_length=100)] = None,
    db: Session = Depends(get_database_session),
) -> CostInvocationsResponse:
    """Retrieve paginated individual OpenAI invocations with optional filters."""
    query = db.query(OpenAICostLogModel)

    if agent_name:
        query = query.filter(OpenAICostLogModel.agent_name == agent_name.strip())
    if batch_id:
        query = query.filter(OpenAICostLogModel.batch_id == batch_id.strip())

    total = query.count()
    offset = (page - 1) * page_size
    records = (
        query.order_by(OpenAICostLogModel.logged_at.desc()).offset(offset).limit(page_size).all()
    )

    items = [
        CostLogEntry(
            id=rec.id,
            agent_name=rec.agent_name,
            school_id=rec.school_id,
            batch_id=rec.batch_id,
            task_name=rec.task_name,
            model=rec.model,
            prompt_tokens=rec.prompt_tokens,
            completion_tokens=rec.completion_tokens,
            total_tokens=rec.total_tokens,
            cost_usd=rec.cost_usd,
            duration_ms=rec.duration_ms,
            logged_at=rec.logged_at,
        )
        for rec in records
    ]

    return CostInvocationsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )

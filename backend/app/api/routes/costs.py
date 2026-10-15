import contextlib
import csv
import io
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.batch import BatchModel
from app.models.cost import OpenAICostLogModel
from app.models.staging_school import StagingSchoolModel
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
            func.sum(OpenAICostLogModel.prompt_tokens).label("prompt_tokens"),
            func.sum(OpenAICostLogModel.completion_tokens).label("completion_tokens"),
            func.sum(OpenAICostLogModel.cost_usd).label("total_cost_usd"),
            func.avg(OpenAICostLogModel.duration_ms).label("avg_duration_ms"),
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
            prompt_tokens=int(row.prompt_tokens or 0),
            completion_tokens=int(row.completion_tokens or 0),
            total_cost_usd=round(float(row.total_cost_usd or 0.0), 6),
            avg_duration_ms=round(float(row.avg_duration_ms or 0.0), 2),
        )
        for row in agent_stats
    ]

    total_cost = sum(item.total_cost_usd for item in breakdown)
    total_calls = sum(item.total_calls for item in breakdown)
    total_tokens = sum(item.total_tokens for item in breakdown)
    total_prompt_tokens = sum(item.prompt_tokens for item in breakdown)
    total_completion_tokens = sum(item.completion_tokens for item in breakdown)
    avg_cost = round(total_cost / total_calls, 6) if total_calls > 0 else 0.0

    total_duration_weighted = sum(item.avg_duration_ms * item.total_calls for item in breakdown)
    overall_avg_duration = (
        round(total_duration_weighted / total_calls, 2) if total_calls > 0 else 0.0
    )

    return CostSummaryResponse(
        total_cost_usd=round(total_cost, 6),
        total_calls=total_calls,
        total_tokens=total_tokens,
        total_prompt_tokens=total_prompt_tokens,
        total_completion_tokens=total_completion_tokens,
        avg_cost_per_call_usd=avg_cost,
        avg_duration_ms=overall_avg_duration,
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
    """Retrieve paginated individual OpenAI invocations with resolved batch/school names."""
    query = db.query(OpenAICostLogModel)

    if agent_name:
        query = query.filter(OpenAICostLogModel.agent_name == agent_name.strip())
    if batch_id:
        cleaned_batch = batch_id.strip()
        named_batches = (
            db.query(BatchModel.id).filter(BatchModel.name.ilike(f"%{cleaned_batch}%")).all()
        )
        target_ids = list({cleaned_batch} | {str(b.id) for b in named_batches})
        query = query.filter(OpenAICostLogModel.batch_id.in_(target_ids))

    total = query.count()
    offset = (page - 1) * page_size
    records = (
        query.order_by(OpenAICostLogModel.logged_at.desc()).offset(offset).limit(page_size).all()
    )

    # Resolve batch names
    b_ids = {rec.batch_id for rec in records if rec.batch_id}
    batch_map: dict[str, str] = {}
    if b_ids:
        valid_b_uuids = []
        for bid in b_ids:
            with contextlib.suppress(ValueError):
                valid_b_uuids.append(uuid.UUID(bid))
        if valid_b_uuids:
            for b in (
                db.query(BatchModel.id, BatchModel.name)
                .filter(BatchModel.id.in_(valid_b_uuids))
                .all()
            ):
                batch_map[str(b.id)] = b.name

    # Resolve school names
    s_ids = {rec.school_id for rec in records if rec.school_id}
    school_map: dict[str, str] = {}
    if s_ids:
        valid_s_uuids = []
        for sid in s_ids:
            with contextlib.suppress(ValueError):
                valid_s_uuids.append(uuid.UUID(sid))
        if valid_s_uuids:
            for s in (
                db.query(StagingSchoolModel.id, StagingSchoolModel.name)
                .filter(StagingSchoolModel.id.in_(valid_s_uuids))
                .all()
            ):
                school_map[str(s.id)] = s.name

    items = [
        CostLogEntry(
            id=rec.id,
            agent_name=rec.agent_name,
            school_id=rec.school_id,
            batch_id=rec.batch_id,
            batch_name=batch_map.get(rec.batch_id) if rec.batch_id else None,
            school_name=school_map.get(rec.school_id) if rec.school_id else None,
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


@router.get("/export")
def export_cost_logs_csv(
    days: Annotated[int | None, Query(ge=1, le=365)] = None,
    agent_name: Annotated[str | None, Query(max_length=100)] = None,
    batch_id: Annotated[str | None, Query(max_length=100)] = None,
    db: Session = Depends(get_database_session),
) -> StreamingResponse:
    """Stream all matching cost log entries as a downloadable CSV audit file."""
    query = db.query(OpenAICostLogModel)

    if days:
        since_date = datetime.now(UTC) - timedelta(days=days)
        query = query.filter(OpenAICostLogModel.logged_at >= since_date)
    if agent_name:
        query = query.filter(OpenAICostLogModel.agent_name == agent_name.strip())
    if batch_id:
        cleaned_batch = batch_id.strip()
        named_batches = (
            db.query(BatchModel.id).filter(BatchModel.name.ilike(f"%{cleaned_batch}%")).all()
        )
        target_ids = list({cleaned_batch} | {str(b.id) for b in named_batches})
        query = query.filter(OpenAICostLogModel.batch_id.in_(target_ids))

    query = query.order_by(OpenAICostLogModel.logged_at.desc())

    # Pre-fetch lookup dictionaries
    batches = {str(b.id): b.name for b in db.query(BatchModel.id, BatchModel.name).all()}
    schools = {
        str(s.id): s.name for s in db.query(StagingSchoolModel.id, StagingSchoolModel.name).all()
    }

    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)

        # Write CSV header row
        writer.writerow(
            [
                "ID",
                "Logged At (UTC)",
                "Agent",
                "Model",
                "Task",
                "Batch Name",
                "Batch ID",
                "School Name",
                "School ID",
                "Prompt Tokens",
                "Completion Tokens",
                "Total Tokens",
                "Cost (USD)",
                "Duration (ms)",
            ]
        )
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for rec in query.yield_per(500):
            b_name = batches.get(rec.batch_id, "") if rec.batch_id else ""
            s_name = schools.get(rec.school_id, "") if rec.school_id else ""
            writer.writerow(
                [
                    rec.id,
                    rec.logged_at.isoformat() if rec.logged_at else "",
                    rec.agent_name,
                    rec.model,
                    rec.task_name or "",
                    b_name,
                    rec.batch_id or "",
                    s_name,
                    rec.school_id or "",
                    rec.prompt_tokens,
                    rec.completion_tokens,
                    rec.total_tokens,
                    f"{rec.cost_usd:.6f}",
                    rec.duration_ms,
                ]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"openai_cost_audit_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": "text/csv; charset=utf-8",
    }
    return StreamingResponse(generate_csv(), media_type="text/csv", headers=headers)

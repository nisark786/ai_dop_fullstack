import json
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.core.database import DatabaseSessionFactory
from app.models.cost import OpenAICostLogModel

logger = logging.getLogger(__name__)
FALLBACK_LOG_PATH = Path("logs/openai_costs.jsonl")


def record_cost_event(
    agent_name: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    cost_usd: float,
    duration_ms: int,
    school_id: str | None = None,
    batch_id: str | None = None,
    task_name: str | None = None,
) -> None:
    """Persist OpenAI cost event to DB; gracefully fallback to JSONL file on failure."""
    try:
        _write_to_db(
            agent_name=agent_name,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
            school_id=school_id,
            batch_id=batch_id,
            task_name=task_name,
        )
    except Exception as exc:
        logger.warning(
            "Primary database cost log insert failed (%s). Appending to JSONL fallback.",
            exc,
        )
        _write_to_jsonl(
            agent_name=agent_name,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
            school_id=school_id,
            batch_id=batch_id,
            task_name=task_name,
        )


def _write_to_db(
    agent_name: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    cost_usd: float,
    duration_ms: int,
    school_id: str | None,
    batch_id: str | None,
    task_name: str | None,
) -> None:
    with DatabaseSessionFactory() as db:
        log_entry = OpenAICostLogModel(
            id=str(uuid.uuid4()),
            agent_name=agent_name,
            school_id=school_id,
            batch_id=batch_id,
            task_name=task_name,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=round(cost_usd, 8),
            duration_ms=duration_ms,
            logged_at=datetime.now(UTC),
        )
        db.add(log_entry)
        db.commit()


def _write_to_jsonl(
    agent_name: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    cost_usd: float,
    duration_ms: int,
    school_id: str | None,
    batch_id: str | None,
    task_name: str | None,
) -> None:
    try:
        FALLBACK_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "id": str(uuid.uuid4()),
            "agent_name": agent_name,
            "school_id": school_id,
            "batch_id": batch_id,
            "task_name": task_name,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cost_usd": round(cost_usd, 8),
            "duration_ms": duration_ms,
            "logged_at": datetime.now(UTC).isoformat(),
        }
        with FALLBACK_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception as fallback_err:
        logger.error("Failed to write to JSONL fallback log: %s", fallback_err)

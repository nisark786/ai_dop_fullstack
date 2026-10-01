"""Prompt Studio endpoints — database-backed prompt template configuration."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.prompt_template import PromptTemplateModel
from app.schemas.prompt import PromptTemplateResponse, PromptTemplateUpdateRequest

router = APIRouter(prefix="/prompts", tags=["Prompt Studio"])

DEFAULT_INITIAL_PROMPTS = [
    {
        "id": "prompt-os-01",
        "product_name": "Open Seats (Grade 1)",
        "version": "v2.1",
        "prompt_text": "Extract exact numeric count of Grade 1 open seats for 2026-2027. Distinguish waitlist from immediate enrollment.",
        "approval_rate": 88.5,
        "correction_rate": 9.2,
        "rejection_rate": 2.3,
        "total_evaluations": 120,
        "is_active": True,
    },
    {
        "id": "prompt-sped-01",
        "product_name": "SPED Accommodations",
        "version": "v1.4",
        "prompt_text": "Identify Special Education services (Speech, OT, Inclusion, Autism Spectrum). Categorize as Full, Partial, or Referral.",
        "approval_rate": 81.0,
        "correction_rate": 14.5,
        "rejection_rate": 4.5,
        "total_evaluations": 80,
        "is_active": True,
    },
]


def _seed_initial_prompts_if_empty(db: Session) -> None:
    """Seeds default templates into the database if table is empty."""
    count = db.query(PromptTemplateModel).count()
    if count == 0:
        for p in DEFAULT_INITIAL_PROMPTS:
            tmpl = PromptTemplateModel(**p)
            db.add(tmpl)
        db.commit()


@router.get(
    "",
    response_model=list[PromptTemplateResponse],
    summary="Fetch prompt templates from database",
)
def get_prompts(db: Session = Depends(get_database_session)) -> list[PromptTemplateResponse]:
    """Fetch active prompt templates from PostgreSQL."""
    _seed_initial_prompts_if_empty(db)
    prompts = db.query(PromptTemplateModel).order_by(PromptTemplateModel.product_name.asc()).all()
    return [PromptTemplateResponse.model_validate(p) for p in prompts]


@router.put(
    "/{template_id}",
    response_model=PromptTemplateResponse,
    summary="Update a prompt template in database",
)
def update_prompt(
    template_id: str,
    payload: PromptTemplateUpdateRequest,
    db: Session = Depends(get_database_session),
) -> PromptTemplateResponse:
    """Updates prompt template text or version in PostgreSQL."""
    template = db.query(PromptTemplateModel).filter(PromptTemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail=f"Prompt template '{template_id}' not found.")

    template.prompt_text = payload.prompt_text
    if payload.version is not None:
        template.version = payload.version
    if payload.is_active is not None:
        template.is_active = payload.is_active
    template.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(template)
    return PromptTemplateResponse.model_validate(template)

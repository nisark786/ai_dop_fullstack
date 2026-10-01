"""Factory for instantiating Schools ORM records with schema defaults."""

import uuid
from datetime import datetime

from app.models.schools import Schools
from app.schemas.batch import BatchConfirmRow


def create_school_from_intake_row(row: BatchConfirmRow) -> Schools:
    """Creates a Schools ORM instance from a validated intake row with safe schema defaults."""
    now = datetime.utcnow()
    return Schools(
        id=uuid.uuid4(),
        name=row.name,
        website=row.website,
        address=row.address,
        district_name=row.district,
        state=row.state,
        type={},
        grades={},
        learning_models={},
        has_academic_rigor=False,
        is_active=True,
        is_tefa_approved=False,
        created_at=now,
        updated_at=now,
        faith_and_values=False,
        has_arts_program=False,
        hands_on_and_technical=False,
        has_sports_program=False,
        small_and_personal=False,
        learning_differences=False,
        budget_friendly=False,
        dual_language=False,
        before_after_care=False,
        transportation_provided=False,
        stem_program=False,
        open_enrollment=False,
        packet_available=False,
    )
